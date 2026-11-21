import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import type { ShotType, SelectedClip } from '../types';
import { SHOT_TYPE_DIRS } from '../types';
import { UPLOADS_DIR, MATERIALS_DIR } from './constants';

const execAsync = promisify(exec);

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

let hasNvenc: boolean | null = null;

function detectNvenc(): boolean {
  if (hasNvenc !== null) return hasNvenc;
  try {
    // Check for NVENC support (GPU encoding is much faster on NVIDIA cards)
    const out = execSync('ffmpeg -hide_banner -encoders 2>&1', {
      encoding: 'utf-8',
      maxBuffer: 20 * 1024 * 1024,
    });
    hasNvenc = out.includes('h264_nvenc');
  } catch {
    hasNvenc = false;
  }
  return hasNvenc;
}

async function processSingleClip(opts: ProcessOptions): Promise<string> {
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

  // Pass 1: Stabilization detection (lightweight params for speed)
  try {
    const stabCmd = `ffmpeg -y -ss ${clip.startTime} -t ${clip.duration} -i "${inputPath}" -vf "vidstabdetect=stepsize=10:shakiness=5:accuracy=5:result=${transformsFile}" -f null -`;
    await execAsync(stabCmd, { maxBuffer: 50 * 1024 * 1024 });
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

  // Pass 2: Main processing — prefer GPU (NVENC) when available, else fast CPU preset
  const audioFlag = hasAudio ? '-c:a copy' : '-an';
  const useNvenc = detectNvenc();
  const encoderArgs = useNvenc
    ? '-c:v h264_nvenc -preset p4 -cq 20 -rc-lookahead 0 -threads 8'
    : '-c:v libx264 -preset veryfast -crf 20 -threads 8';
  const processCmd = `ffmpeg -y -ss ${clip.startTime} -t ${clip.duration} -i "${inputPath}" -vf "${videoFilter}" ${audioFlag} ${encoderArgs} -pix_fmt yuv420p -movflags +faststart "${outputPath}"`;

  await execAsync(processCmd, { maxBuffer: 100 * 1024 * 1024 });

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
): Promise<ProcessResult> {
  const outputFiles: ProcessResult['outputFiles'] = [];
  const accepted = clips.filter((c) => c.accepted);
  const total = accepted.length;
  let completed = 0;

  if (total === 0) return Promise.resolve({ outputFiles });

  // Process clips in parallel with limited concurrency (2) for speed.
  // Each clip uses its own temp dir + output path, so parallel is safe.
  const CONCURRENCY = 2;
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (nextIndex < total) {
      const i = nextIndex++;
      const clip = accepted[i];
      const outputPath = await processSingleClip({
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
      completed++;
      onProgress?.('processing', Math.round((completed / total) * 100));
    }
  };

  const workers = Array.from({ length: Math.min(CONCURRENCY, total) }, () => worker());
  return Promise.all(workers).then(() => {
    onProgress?.('processing', 100);
    return { outputFiles };
  });
}
