import { execSync } from 'child_process';

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  aspectRatio: string;
}

export function getVideoMetadata(filePath: string): VideoMetadata {
  const cmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`;
  const result = execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
  const data = JSON.parse(result);

  const videoStream = data.streams?.find((s: Record<string, unknown>) => s.codec_type === 'video');
  const audioStream = data.streams?.find((s: Record<string, unknown>) => s.codec_type === 'audio');

  const duration = parseFloat(data.format?.duration || '0');
  const width = parseInt(videoStream?.width || '0', 10);
  const height = parseInt(videoStream?.height || '0', 10);

  let fps = 30;
  if (videoStream?.r_frame_rate) {
    const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
    if (den > 0) fps = num / den;
  }

  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height) || 1;
  const aspectRatio = `${width / divisor}:${height / divisor}`;

  return {
    duration,
    width,
    height,
    fps,
    hasAudio: !!audioStream,
    aspectRatio,
  };
}

export function detectScenes(filePath: string, threshold = 0.3): number[] {
  const cmd = `ffmpeg -i "${filePath}" -vf "select='gt(scene\\,${threshold})',showinfo" -f null - 2>&1`;
  try {
    const result = execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    const timestamps: number[] = [];
    const ptsTimeRegex = /pts_time:([\d.]+)/g;
    let match;
    while ((match = ptsTimeRegex.exec(result)) !== null) {
      timestamps.push(parseFloat(match[1]));
    }
    return timestamps;
  } catch {
    return [];
  }
}

export function extractFrame(filePath: string, timestamp: number, outputPath: string): void {
  const cmd = `ffmpeg -y -ss ${timestamp} -i "${filePath}" -frames:v 1 -q:v 2 "${outputPath}"`;
  execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
}

export function analyzeFrame(framePath: string): {
  brightness: number;
  contrast: number;
  isLog: boolean;
  colorProfile: 'warm' | 'cool' | 'neutral';
} {
  // Use ffprobe to get average brightness from the frame
  const cmd = `ffmpeg -i "${framePath}" -vf "format=gray,format=gray" -f rawvideo - 2>/dev/null | od -A n -t u1 | tr -s ' ' '\\n' | awk 'NF{s+=$1;n++}END{if(n>0)print s/n; else print 0}'`;
  let brightness = 128;
  try {
    const result = execSync(cmd, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
    brightness = parseFloat(result.trim()) || 128;
  } catch {
    // fallback
  }

  // Get min/max brightness for contrast estimation
  const contrastCmd = `ffmpeg -i "${framePath}" -vf "format=gray,format=gray" -f rawvideo - 2>/dev/null | od -A n -t u1 | tr -s ' ' '\\n' | awk 'NF{v=$1+0;if(NR==1||v<mn)mn=v;if(v>mx)mx=v;n++}END{if(n>0)print mn,mx; else print "0 255"}'`;
  let minVal = 0;
  let maxVal = 255;
  try {
    const result = execSync(contrastCmd, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
    const parts = result.trim().split(/\s+/);
    minVal = parseInt(parts[0], 10) || 0;
    maxVal = parseInt(parts[1], 10) || 255;
  } catch {
    // fallback
  }

  const contrast = maxVal - minVal;
  const isLog = contrast < 100 && brightness > 80 && brightness < 180;

  // Simple color temperature estimation using YUV
  let colorProfile: 'warm' | 'cool' | 'neutral' = 'neutral';
  try {
    const colorCmd = `ffmpeg -i "${framePath}" -vf "format=yuv422p,extractplanes=u" -f rawvideo - 2>/dev/null | od -A n -t u1 | tr -s ' ' '\\n' | awk 'NF{s+=$1;n++}END{if(n>0)print s/n; else print 128}'`;
    const uResult = execSync(colorCmd, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
    const uAvg = parseFloat(uResult.trim()) || 128;
    if (uAvg < 124) colorProfile = 'warm';
    else if (uAvg > 132) colorProfile = 'cool';
  } catch {
    // fallback
  }

  return { brightness, contrast, isLog, colorProfile };
}

export function computeMotionScore(filePath: string, startTime: number, endTime: number): number {
  const duration = endTime - startTime;
  const midTime = startTime + duration / 2;
  const frame1Path = `/tmp/motion_f1_${Date.now()}.ppm`;
  const frame2Path = `/tmp/motion_f2_${Date.now()}.ppm`;

  try {
    extractFrame(filePath, midTime - 0.2, frame1Path);
    extractFrame(filePath, midTime + 0.2, frame2Path);

    // Compare two frames using MSE
    const cmd = `ffmpeg -i "${frame1Path}" -i "${frame2Path}" -lavfi "psnr" -f null - 2>&1`;
    const result = execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    const psnrMatch = /psnr_average:([\d.]+)|psnr:([\d.]+)/.exec(result);
    const psnr = psnrMatch ? parseFloat(psnrMatch[1] || psnrMatch[2]) : 30;

    // Convert PSNR to 0-1 motion score (lower PSNR = more motion)
    const score = Math.max(0, Math.min(1, (60 - psnr) / 40));
    return score;
  } catch {
    return 0.5;
  } finally {
    try {
      const fs = require('fs');
      if (fs.existsSync(frame1Path)) fs.unlinkSync(frame1Path);
      if (fs.existsSync(frame2Path)) fs.unlinkSync(frame2Path);
    } catch {
      // ignore
    }
  }
}
