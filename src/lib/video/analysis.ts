import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import type { SceneSegment, ShotType } from '../types';
import {
  getVideoMetadata,
  detectScenes,
  extractFrame,
  analyzeFrame,
  computeMotionScore,
} from './ffprobe';
import { UPLOADS_DIR } from './constants';

function classifyShotType(
  motionLevel: number,
  brightness: number,
  _colorProfile: string,
  duration: number,
  position: number,
  totalDuration: number
): ShotType {
  // position: normalized position in video (0-1)
  const isEarlyOrLate = position < 0.15 || position > 0.85;

  if (motionLevel > 0.6 && brightness > 100 && brightness < 200) {
    return 'dynamic-to-static';
  }
  if (motionLevel > 0.5 && duration > 3) {
    return 'production-line';
  }
  if (motionLevel < 0.3 && brightness > 80 && brightness < 200) {
    if (isEarlyOrLate) return 'environment';
    return 'product-closeup';
  }
  if (motionLevel > 0.3 && motionLevel <= 0.5) {
    return 'human';
  }
  if (motionLevel > 0.5) {
    return 'environment';
  }
  return 'product-closeup';
}

function scoreSegment(
  motionLevel: number,
  brightness: number,
  contrast: number,
  duration: number
): number {
  let score = 0;

  // Duration score: prefer 2.8-3.2s
  if (duration >= 2.8 && duration <= 3.2) {
    score += 30;
  } else if (duration >= 2.5 && duration <= 3.5) {
    score += 15;
  } else {
    score += 5;
  }

  // Brightness score: prefer well-exposed (100-180)
  if (brightness >= 100 && brightness <= 180) {
    score += 25;
  } else if (brightness >= 70 && brightness <= 210) {
    score += 15;
  } else {
    score += 5;
  }

  // Contrast score: prefer good contrast (60-150)
  if (contrast >= 60 && contrast <= 150) {
    score += 20;
  } else if (contrast >= 40 && contrast <= 180) {
    score += 10;
  } else {
    score += 5;
  }

  // Motion score: moderate motion is generally more interesting
  if (motionLevel >= 0.2 && motionLevel <= 0.6) {
    score += 25;
  } else if (motionLevel >= 0.1 && motionLevel <= 0.8) {
    score += 15;
  } else {
    score += 5;
  }

  return score;
}

function getClipCountByDuration(duration: number): number {
  if (duration <= 10) return 1;
  if (duration <= 20) return 4;
  return 5;
}

function generateContentTags(scene: SceneSegment): string[] {
  const tags: string[] = [];

  // Shot type based tags
  const shotTypeTagMap: Record<ShotType, string[]> = {
    'product-closeup': ['产品', '特写'],
    environment: ['环境', '空镜'],
    human: ['人物', '空镜'],
    'production-line': ['生产线', '厂房'],
    'dynamic-to-static': ['动态', '转场'],
  };
  tags.push(...(shotTypeTagMap[scene.shotType] || []));

  // Motion based tags
  if (scene.motionLevel > 0.6) {
    tags.push('运动');
  } else if (scene.motionLevel > 0.3) {
    tags.push('中速');
  } else {
    tags.push('静态');
  }

  // Brightness based tags
  if (scene.brightness > 180) {
    tags.push('明亮');
  } else if (scene.brightness > 120) {
    tags.push('正常');
  } else {
    tags.push('偏暗');
  }

  // Color based tags (inferred from shot type and brightness)
  if (scene.shotType === 'product-closeup' || scene.shotType === 'human') {
    tags.push('暖色');
  } else if (scene.shotType === 'environment') {
    tags.push('冷色');
  } else if (scene.shotType === 'production-line') {
    tags.push('冷色');
  }

  // Time position tags
  if (scene.startTime < 3) {
    tags.push('开头');
  }

  return tags;
}

function areScenesDiverse(
  existingClips: AnalysisResult['selectedClips'],
  candidateScene: SceneSegment,
  allScenes: SceneSegment[]
): boolean {
  // Check shot type diversity
  const existingTypes = new Set(existingClips.map((c) => c.shotType));
  if (!existingTypes.has(candidateScene.shotType)) return true;

  // If same shot type, check if it's far enough from existing clips
  for (const clip of existingClips) {
    const clipEnd = clip.startTime + clip.duration;
    const distance = Math.min(
      Math.abs(candidateScene.startTime - clip.startTime),
      Math.abs(candidateScene.startTime - clipEnd),
      Math.abs(candidateScene.endTime - clip.startTime),
      Math.abs(candidateScene.endTime - clipEnd)
    );
    if (distance < 3) return false;
  }

  // Check motion level diversity
  const existingMotions = existingClips.map((c) => {
    const s = allScenes.find((sc) => sc.index === c.segmentIndex);
    return s?.motionLevel || 0;
  });
  const avgMotion = existingMotions.reduce((a, b) => a + b, 0) / existingMotions.length;
  if (Math.abs(candidateScene.motionLevel - avgMotion) > 0.2) return true;

  return existingTypes.size < 3;
}

export interface AnalysisResult {
  metadata: {
    duration: number;
    width: number;
    height: number;
    fps: number;
    hasAudio: boolean;
    aspectRatio: string;
  };
  scenes: SceneSegment[];
  selectedClips: {
    segmentIndex: number;
    startTime: number;
    duration: number;
    shotType: ShotType;
    score: number;
    contentTags: string[];
  }[];
}

export function analyzeVideo(jobId: string, fileName: string): AnalysisResult {
  const filePath = path.join(UPLOADS_DIR, fileName);

  // Step 1: Get metadata
  const metadata = getVideoMetadata(filePath);

  // Step 2: Detect scene changes
  const sceneTimestamps = detectScenes(filePath, 0.3);

  // Build segments from scene changes
  const boundaries = [0, ...sceneTimestamps, metadata.duration];
  const rawSegments: { start: number; end: number }[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i];
    const end = boundaries[i + 1];
    const duration = end - start;
    if (duration >= 0.5) {
      rawSegments.push({ start, end });
    }
  }

  // If no scenes detected, treat the whole video as one segment
  if (rawSegments.length === 0) {
    rawSegments.push({ start: 0, end: metadata.duration });
  }

  // Step 3: Analyze each segment
  const tempDir = `/tmp/video_analysis_${jobId}`;
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const scenes: SceneSegment[] = rawSegments.map((seg, idx) => {
    const midTime = seg.start + (seg.end - seg.start) / 2;
    const framePath = path.join(tempDir, `frame_${idx}.ppm`);

    let brightness = 128;
    let contrast = 80;
    let isLog = false;
    let colorProfile: 'warm' | 'cool' | 'neutral' = 'neutral';

    try {
      extractFrame(filePath, midTime, framePath);
      const analysis = analyzeFrame(framePath);
      brightness = analysis.brightness;
      contrast = analysis.contrast;
      isLog = analysis.isLog;
      colorProfile = analysis.colorProfile;
    } catch {
      // use defaults
    }

    const motionLevel = computeMotionScore(filePath, seg.start, seg.end);
    const position = midTime / metadata.duration;
    const shotType = classifyShotType(
      motionLevel,
      brightness,
      colorProfile,
      seg.end - seg.start,
      position,
      metadata.duration
    );
    const score = scoreSegment(motionLevel, brightness, contrast, seg.end - seg.start);

    return {
      index: idx,
      startTime: seg.start,
      endTime: seg.end,
      duration: seg.end - seg.start,
      score,
      shotType,
      motionLevel,
      brightness,
      isLog,
    };
  });

  // Clean up temp frames
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // ignore
  }

  // Step 4: Select best clips based on duration and diversity
  const targetCount = getClipCountByDuration(metadata.duration);
  const selectedClips: AnalysisResult['selectedClips'] = [];
  const usedSegments = new Set<number>();

  // Sort by score descending
  const sortedScenes = [...scenes].sort((a, b) => b.score - a.score);

  // First pass: pick best clip per shot type (ensures diversity)
  const shotTypesSeen = new Set<ShotType>();
  for (const scene of sortedScenes) {
    if (selectedClips.length >= targetCount) break;
    if (usedSegments.has(scene.index)) continue;

    if (!shotTypesSeen.has(scene.shotType)) {
      const clipDuration = Math.min(3.0, scene.duration);
      const clipStart = scene.startTime + (scene.duration - clipDuration) / 2;
      selectedClips.push({
        segmentIndex: scene.index,
        startTime: Math.max(0, clipStart),
        duration: clipDuration,
        shotType: scene.shotType,
        score: scene.score,
        contentTags: generateContentTags(scene),
      });
      shotTypesSeen.add(scene.shotType);
      usedSegments.add(scene.index);
    }
  }

  // Second pass: fill remaining slots with diverse scenes
  for (const scene of sortedScenes) {
    if (selectedClips.length >= targetCount) break;
    if (usedSegments.has(scene.index)) continue;

    if (areScenesDiverse(selectedClips, scene, scenes)) {
      const clipDuration = Math.min(3.0, scene.duration);
      const clipStart = scene.startTime + (scene.duration - clipDuration) / 2;
      selectedClips.push({
        segmentIndex: scene.index,
        startTime: Math.max(0, clipStart),
        duration: clipDuration,
        shotType: scene.shotType,
        score: scene.score,
        contentTags: generateContentTags(scene),
      });
      usedSegments.add(scene.index);
    }
  }

  // Third pass: fill remaining slots with highest scoring scenes
  for (const scene of sortedScenes) {
    if (selectedClips.length >= targetCount) break;
    if (usedSegments.has(scene.index)) continue;

    const clipDuration = Math.min(3.0, scene.duration);
    const clipStart = scene.startTime + (scene.duration - clipDuration) / 2;
    selectedClips.push({
      segmentIndex: scene.index,
      startTime: Math.max(0, clipStart),
      duration: clipDuration,
      shotType: scene.shotType,
      score: scene.score,
      contentTags: generateContentTags(scene),
    });
    usedSegments.add(scene.index);
  }

  // If we still don't have any clips, take the best scoring segment regardless
  if (selectedClips.length === 0 && scenes.length > 0) {
    const best = sortedScenes[0];
    selectedClips.push({
      segmentIndex: best.index,
      startTime: best.startTime,
      duration: Math.min(3.0, best.duration),
      shotType: best.shotType,
      score: best.score,
      contentTags: generateContentTags(best),
    });
  }

  return { metadata, scenes, selectedClips };
}
