import type { ShotType } from '../types';

interface ColorGradePreset {
  label: string;
  filters: string;
}

const COLOR_GRADES: Record<string, ColorGradePreset> = {
  'product-closeup': {
    label: '暖色生活化',
    filters:
      'colorbalance=rs=0.08:gs=0.03:bs=-0.05:rm=0.06:gm=0.02:bm=-0.04:rh=0.04:gh=0.01:bh=-0.03,curves=preset=lighter,eq=saturation=1.12:gamma=0.97',
  },
  environment: {
    label: '蓝绿通透',
    filters:
      'colorbalance=rs=-0.06:gs=0.05:bs=0.08:rm=-0.04:gm=0.06:bm=0.07:rh=-0.02:gh=0.03:bh=0.05,curves=r=\'0/0 0.25/0.22 0.5/0.48 0.75/0.76 1/1\':g=\'0/0 0.25/0.24 0.5/0.51 0.75/0.77 1/1\',eq=saturation=1.15:contrast=1.05',
  },
  human: {
    label: '暖色生活化',
    filters:
      'colorbalance=rs=0.08:gs=0.03:bs=-0.05:rm=0.06:gm=0.02:bm=-0.04:rh=0.04:gh=0.01:bh=-0.03,curves=preset=lighter,eq=saturation=1.12:gamma=0.97',
  },
  'production-line': {
    label: '高级冷调',
    filters:
      'colorbalance=rs=-0.08:gs=-0.03:bs=0.06:rm=-0.06:gm=-0.02:bm=0.08:rh=-0.04:gh=0:bh=0.05,curves=preset=darker,eq=saturation=0.88:contrast=1.08:brightness=-0.02',
  },
  'dynamic-to-static': {
    label: '自然增强',
    filters:
      'colorbalance=rs=0.02:gs=0.02:bs=0.03:rm=0.01:gm=0.01:bm=0.02,eq=saturation=1.08:contrast=1.05',
  },
};

const LOG_CONVERSION =
  'curves=r=\'0/0.05 0.18/0.1 0.35/0.3 0.5/0.5 0.65/0.7 0.82/0.9 1/1\':g=\'0/0.05 0.18/0.1 0.35/0.3 0.5/0.5 0.65/0.7 0.82/0.9 1/1\':b=\'0/0.05 0.18/0.1 0.35/0.3 0.5/0.5 0.65/0.7 0.82/0.9 1/1\'';

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

  // Exposure correction (auto levels)
  parts.push('eq=brightness=0.02:saturation=1.0');

  // Sharpening
  if (enableStabilization) {
    // Note: vidstab requires two-pass, we handle it separately
    // For single-pass, we use unsharp for mild stabilization effect
  }

  if (enableSharpen) {
    parts.push('unsharp=5:5:0.8:5:5:0.4');
  }

  // Color grading
  parts.push(getColorGradeFilter(shotType, isLog));

  return parts.join(',');
}

export function getStabilizeFilter(): string {
  return 'vidstabdetect=stepsize=6:shakiness=8:accuracy=9';
}

export function getStabilizeTransformFilter(transformsFile: string): string {
  return `vidstabtransform=input="${transformsFile}":smoothing=10:zoom=1:interpol=bicubic`;
}
