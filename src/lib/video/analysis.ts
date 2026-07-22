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

  // Step 4: Select best 1-2 clips (target ~3s each)
  // Sort by score descending
  const sortedScenes = [...scenes].sort((a, b) => b.score - a.score);

  const selectedClips: AnalysisResult['selectedClips'] = [];
  const usedTimeRanges: { start: number; end: number }[] = [];

  for (const scene of sortedScenes) {
    if (selectedClips.length >= 2) break;

    // Try to extract a ~3s clip from this segment
    let clipStart = scene.startTime;
    let clipDuration = Math.min(3.0, scene.duration);

    // Clamp to 2.8-3.2 range if possible
    if (clipDuration < 2.8) {
      // Segment too short, try to extend
      const extendBefore = Math.min(0.2, clipStart);
      const extendAfter = Math.min(
        2.8 - clipDuration + extendBefore,
        metadata.duration - (clipStart + clipDuration)
      );
      clipStart = Math.max(0, clipStart - extendBefore);
      clipDuration = Math.min(3.0, clipDuration + extendBefore + extendAfter);
    }

    if (clipDuration < 2.8) {
      clipDuration = Math.max(2.8, clipDuration);
    }
    if (clipDuration > 3.2) {
      clipDuration = 3.2;
    }

    // Check no overlap with already selected clips
    const clipEnd = clipStart + clipDuration;
    const overlaps = usedTimeRanges.some(
      (r) => clipStart < r.end && clipEnd > r.start
    );
    if (overlaps) continue;

    selectedClips.push({
      segmentIndex: scene.index,
      startTime: clipStart,
      duration: clipDuration,
      shotType: scene.shotType,
      score: scene.score,
    });

    usedTimeRanges.push({ start: clipStart, end: clipEnd });
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
    });
  }

  return { metadata, scenes, selectedClips };
}
