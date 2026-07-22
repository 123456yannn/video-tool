import { execSync, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import type { ShotType, SelectedClip } from '../types';
import { SHOT_TYPE_LABELS, SHOT_TYPE_DIRS } from '../types';
import { UPLOADS_DIR, MATERIALS_DIR } from './constants';
import { getColorGradeFilter } from './color-grading';

function formatDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function getNextSequence(category: string): string {
  const dir = path.join(MATERIALS_DIR, SHOT_TYPE_DIRS[category as ShotType] || category);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const files = fs.readdirSync(dir).filter((f: string) => f.endsWith('.mp4'));
  const seq = String(files.length + 1).padStart(3, '0');
  return seq;
}

interface ProcessOptions {
  jobId: string;
  fileName: string;
  clip: SelectedClip;
  isLog: boolean;
  width: number;
  height: number;
  hasAudio: boolean;
}

function processSingleClip(opts: ProcessOptions): string {
  const { jobId, fileName, clip, isLog, hasAudio } = opts;
  const inputPath = path.join(UPLOADS_DIR, fileName);
  const category = clip.shotType;
  const seq = getNextSequence(category);
  const dateStr = formatDate();
  const label = SHOT_TYPE_LABELS[category] || category;
  const outputName = `${label}_${dateStr}_${seq}.mp4`;
  const outputDir = path.join(MATERIALS_DIR, SHOT_TYPE_DIRS[category]);
  const outputPath = path.join(outputDir, outputName);

  const tempDir = `/tmp/process_${jobId}_${clip.segmentIndex}`;
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const transformsFile = path.join(tempDir, 'transforms.trf');

  // Pass 1: Stabilization detection
  try {
    const stabCmd = `ffmpeg -y -ss ${clip.startTime} -t ${clip.duration} -i "${inputPath}" -vf "vidstabdetect=stepsize=6:shakiness=8:accuracy=9:result=${transformsFile}" -f null -`;
    execSync(stabCmd, {
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024,
      timeout: 120000,
    });
  } catch {
    // Stabilization may fail, continue without it
  }

  // Build filter chain
  const filterParts: string[] = [];

  // Pass 2: Stabilization transform
  if (fs.existsSync(transformsFile)) {
    filterParts.push(
      `vidstabtransform=input="${transformsFile}":smoothing=10:zoom=1:interpol=bicubic`
    );
  }

  // Exposure correction
  filterParts.push('eq=brightness=0.02');

  // Sharpening
  filterParts.push('unsharp=5:5:0.8:5:5:0.4');

  // Color grading
  const colorFilter = getColorGradeFilter(clip.shotType, isLog);
  filterParts.push(colorFilter);

  const videoFilter = filterParts.join(',');

  // Pass 2: Main processing
  const audioFlag = hasAudio ? '-c:a copy' : '-an';
  const processCmd = `ffmpeg -y -ss ${clip.startTime} -t ${clip.duration} -i "${inputPath}" -vf "${videoFilter}" ${audioFlag} -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -movflags +faststart "${outputPath}"`;

  execSync(processCmd, {
    encoding: 'utf-8',
    maxBuffer: 100 * 1024 * 1024,
    timeout: 300000,
  });

  // Clean up temp files
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // ignore
  }

  return outputPath;
}

export interface ProcessResult {
  outputFiles: { path: string; shotType: ShotType; fileName: string }[];
}

export function processClips(
  jobId: string,
  fileName: string,
  clips: SelectedClip[],
  isLog: boolean,
  metadata: { width: number; height: number; hasAudio: boolean },
  onProgress?: (step: string, percent: number) => void
): ProcessResult {
  const outputFiles: ProcessResult['outputFiles'] = [];
  const total = clips.length;

  for (let i = 0; i < total; i++) {
    const clip = clips[i];
    if (!clip.accepted) continue;

    onProgress?.('processing', Math.round((i / total) * 100));

    try {
      const outputPath = processSingleClip({
        jobId,
        fileName,
        clip,
        isLog,
        width: metadata.width,
        height: metadata.height,
        hasAudio: metadata.hasAudio,
      });

      const outputName = path.basename(outputPath);
      outputFiles.push({
        path: outputPath,
        shotType: clip.shotType,
        fileName: outputName,
      });
    } catch (err) {
      console.error(`Failed to process clip ${clip.segmentIndex}:`, err);
      throw err;
    }
  }

  onProgress?.('processing', 100);
  return { outputFiles };
}
