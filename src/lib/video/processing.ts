import { execSync, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import type { ShotType, SelectedClip } from '../types';
import { SHOT_TYPE_DIRS } from '../types';
import { UPLOADS_DIR, MATERIALS_DIR } from './constants';

function getUniqueOutputPath(dir: string, baseName: string, seq: number): string {
  const paddedSeq = String(seq).padStart(2, '0');
  let candidate = path.join(dir, `${baseName}_${paddedSeq}.mp4`);
  let counter = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${baseName}_${paddedSeq}(${counter}).mp4`);
    counter++;
  }
  return candidate;
}

interface ProcessOptions {
  jobId: string;
  fileName: string;
  originalName?: string;
  clip: SelectedClip;
  width: number;
  height: number;
  hasAudio: boolean;
}

function processSingleClip(opts: ProcessOptions): string {
  const { jobId, fileName, originalName, clip, hasAudio } = opts;
  const inputPath = path.join(UPLOADS_DIR, fileName);
  // Fallback to a valid category if shotType is missing/invalid
  const category: ShotType = SHOT_TYPE_DIRS[clip.shotType] ? clip.shotType : 'environment';
  const outputDir = path.join(MATERIALS_DIR, SHOT_TYPE_DIRS[category]);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Use original video filename as base (fall back to stored fileName)
  const nameSource = originalName || fileName;
  const baseName = path.basename(nameSource, path.extname(nameSource));
  const outputPath = getUniqueOutputPath(outputDir, baseName, clip.segmentIndex + 1);
  const outputName = path.basename(outputPath);

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

  // Build filter chain - basic processing only (no color grading)
  const filterParts: string[] = [];

  // Pass 2: Stabilization transform
  if (fs.existsSync(transformsFile)) {
    filterParts.push(
      `vidstabtransform=input="${transformsFile}":smoothing=10:zoom=1:interpol=bicubic`
    );
  }

  const videoFilter = filterParts.length > 0 ? filterParts.join(',') : 'null';

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
  metadata: { width: number; height: number; hasAudio: boolean },
  onProgress?: (step: string, percent: number) => void,
  originalName?: string
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
        originalName,
        clip,
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
