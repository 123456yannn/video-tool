import type { ShotType } from '../types';

interface ColorGradePreset {
  label: string;
  filters: string;
}

const COLOR_GRADES: Record<string, ColorGradePreset> = {
  'product-closeup': {
    label: '暖色生活化',
    filters:
      'eq=brightness=0.04:contrast=1.18:saturation=1.35:gamma=0.92,colorbalance=rs=0.12:gs=0.05:bs=-0.08:rm=0.08:gm=0.03:bm=-0.06:rh=0.05:gh=0.02:bh=-0.04,curves=preset=lighter,unsharp=3:3:1.2:3:3:0.6',
  },
  environment: {
    label: '蓝绿通透',
    filters:
      'eq=brightness=0.03:contrast=1.22:saturation=1.30:gamma=0.93,colorbalance=rs=-0.08:gs=0.08:bs=0.12:rm=-0.05:gm=0.08:bm=0.10:rh=-0.03:gh=0.04:bh=0.06,curves=r=\'0/0 0.2/0.18 0.5/0.52 0.8/0.82 1/1\':g=\'0/0 0.2/0.19 0.5/0.53 0.8/0.83 1/1\':b=\'0/0 0.2/0.20 0.5/0.54 0.8/0.84 1/1\',unsharp=3:3:1.0:3:3:0.5',
  },
  human: {
    label: '暖色生活化',
    filters:
      'eq=brightness=0.04:contrast=1.15:saturation=1.28:gamma=0.93,colorbalance=rs=0.10:gs=0.04:bs=-0.06:rm=0.07:gm=0.02:bm=-0.05:rh=0.04:gh=0.01:bh=-0.03,curves=preset=lighter,unsharp=3:3:1.0:3:3:0.5',
  },
  'production-line': {
    label: '高级冷调',
    filters:
      'eq=brightness=0.02:contrast=1.25:saturation=1.10:gamma=0.95,colorbalance=rs=-0.10:gs=-0.02:bs=0.08:rm=-0.08:gm=-0.01:bm=0.10:rh=-0.05:gh=0:bh=0.06,curves=preset=darker,unsharp=3:3:1.2:3:3:0.6',
  },
  'dynamic-to-static': {
    label: '自然增强',
    filters:
      'eq=brightness=0.03:contrast=1.20:saturation=1.25:gamma=0.94,colorbalance=rs=0.04:gs=0.03:bs=0.05:rm=0.02:gm=0.02:bm=0.03,curves=preset=medium,unsharp=3:3:1.0:3:3:0.5',
  },
};

const LOG_CONVERSION =
  'eq=brightness=0.05:contrast=1.15:saturation=1.20,curves=r=\'0/0.03 0.15/0.08 0.3/0.25 0.5/0.5 0.7/0.75 0.85/0.92 1/1\':g=\'0/0.03 0.15/0.08 0.3/0.25 0.5/0.5 0.7/0.75 0.85/0.92 1/1\':b=\'0/0.03 0.15/0.08 0.3/0.25 0.5/0.5 0.7/0.75 0.85/0.92 1/1\'';

export function getColorGradeFilter(shotType: ShotType, isLog: boolean): string {
  const grade = COLOR_GRADES[shotType] || COLOR_GRADES['dynamic-to-static'];
  const parts: string[] = [];

  if (isLog) {
    parts.push(LOG_CONVERSION);
  }

  parts.push(grade.filters);
  return parts.join(',');
}

export function getProcessingFilterChain(
  shotType: ShotType,
  isLog: boolean,
  enableStabilization: boolean = true,
  enableSharpen: boolean = true
): string {
  const parts: string[] = [];

  // Exposure correction (slight brightness boost)
  parts.push('eq=brightness=0.03:saturation=1.0');

  if (enableSharpen) {
    parts.push('unsharp=5:5:1.0:5:5:0.5');
  }

  // Color grading (includes additional sharpening per preset)
  parts.push(getColorGradeFilter(shotType, isLog));

  return parts.join(',');
}

export function getStabilizeFilter(): string {
  return 'vidstabdetect=stepsize=6:shakiness=8:accuracy=9';
}

export function getStabilizeTransformFilter(transformsFile: string): string {
  return `vidstabtransform=input="${transformsFile}":smoothing=10:zoom=1:interpol=bicubic`;
}
