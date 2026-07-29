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
  // Use simpler scene detection with showinfo filter
  const cmd = `ffmpeg -i "${filePath}" -vf "select='gt(scene\\,${threshold})',showinfo" -f null - 2>&1`;
  try {
    const result = execSync(cmd, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024, timeout: 60000 });
    const timestamps: number[] = [];
    // Parse pts_time from showinfo output
    const ptsTimeRegex = /pts_time:([\d.]+)/g;
    let match;
    while ((match = ptsTimeRegex.exec(result)) !== null) {
      const t = parseFloat(match[1]);
      // Avoid duplicate timestamps and ensure minimum gap
      if (timestamps.length === 0 || t - timestamps[timestamps.length - 1] > 0.5) {
        timestamps.push(t);
      }
    }
    console.log(`[detectScenes] Found ${timestamps.length} scene changes in ${filePath}`);
    return timestamps;
  } catch (err) {
    console.warn(`[detectScenes] Scene detection failed for ${filePath}: ${err}`);
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
  // Use ffmpeg stats filter for reliable brightness/contrast analysis
  const cmd = `ffmpeg -i "${framePath}" -vf "signalstats" -f null - 2>&1`;
  let brightness = 128;
  let minVal = 0;
  let maxVal = 255;
  let colorProfile: 'warm' | 'cool' | 'neutral' = 'neutral';

  try {
    const result = execSync(cmd, { encoding: 'utf-8', maxBuffer: 20 * 1024 * 1024, timeout: 30000 });
    // Parse signalstats output
    const lavfiBrightnessMatch = /lavfi\.signalstats\.YAVG=([\d.]+)/.exec(result);
    const lavfiMinMatch = /lavfi\.signalstats\.YMIN=(\d+)/.exec(result);
    const lavfiMaxMatch = /lavfi\.signalstats\.YMAX=(\d+)/.exec(result);
    const uAvgMatch = /lavfi\.signalstats\.UAVG=([\d.]+)/.exec(result);

    if (lavfiBrightnessMatch) brightness = parseFloat(lavfiBrightnessMatch[1]);
    if (lavfiMinMatch) minVal = parseInt(lavfiMinMatch[1], 10);
    if (lavfiMaxMatch) maxVal = parseInt(lavfiMaxMatch[1], 10);
    
    // Color temperature estimation
    if (uAvgMatch) {
      const uAvg = parseFloat(uAvgMatch[1]);
      if (uAvg < 124) colorProfile = 'warm';
      else if (uAvg > 132) colorProfile = 'cool';
    }
  } catch (err) {
    console.warn(`[analyzeFrame] Frame analysis failed for ${framePath}: ${err}`);
    // Use defaults
  }

  const contrast = maxVal - minVal;
  const isLog = contrast < 100 && brightness > 80 && brightness < 180;

  return { brightness, contrast, isLog, colorProfile };
}

export function computeMotionScore(filePath: string, startTime: number, endTime: number): number {
  const duration = endTime - startTime;
  const midTime = startTime + duration / 2;
  const uniqueId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const frame1Path = `/tmp/motion_f1_${uniqueId}.ppm`;
  const frame2Path = `/tmp/motion_f2_${uniqueId}.ppm`;

  try {
    // Extract two frames with a small time gap
    const gap = Math.min(0.5, duration * 0.3);
    extractFrame(filePath, Math.max(0, midTime - gap), frame1Path);
    extractFrame(filePath, midTime + gap, frame2Path);

    // Use ffmpeg tmix filter to compute frame difference (more reliable than psnr)
    const cmd = `ffmpeg -i "${frame1Path}" -i "${frame2Path}" -lavfi "blend=difference=1,signalstats" -f null - 2>&1`;
    const result = execSync(cmd, { encoding: 'utf-8', maxBuffer: 20 * 1024 * 1024, timeout: 30000 });

    // Get average difference value
    const yavgMatch = /lavfi\.signalstats\.YAVG=([\d.]+)/.exec(result);
    if (yavgMatch) {
      const avgDiff = parseFloat(yavgMatch[1]);
      // Convert 0-255 difference to 0-1 score
      const score = Math.max(0, Math.min(1, avgDiff / 80));
      return score;
    }

    // Fallback: use psnr
    const psnrCmd = `ffmpeg -i "${frame1Path}" -i "${frame2Path}" -lavfi "psnr" -f null - 2>&1`;
    const psnrResult = execSync(psnrCmd, { encoding: 'utf-8', maxBuffer: 20 * 1024 * 1024, timeout: 30000 });
    const psnrMatch = /psnr_average:([\d.]+)|psnr:([\d.]+)/.exec(psnrResult);
    const psnr = psnrMatch ? parseFloat(psnrMatch[1] || psnrMatch[2]) : 30;
    const score = Math.max(0, Math.min(1, (60 - psnr) / 40));
    return score;
  } catch {
    console.warn(`[computeMotionScore] Motion analysis failed for segment ${startTime}-${endTime}, using default`);
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
