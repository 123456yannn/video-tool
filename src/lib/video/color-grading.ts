import type { ShotType } from '../types';

/**
 * 调色模块 - 已禁用画面增强
 * 仅保留 Log 素材的基础色彩还原
 */

const LOG_CONVERSION =
  'eq=brightness=0.05:contrast=1.15:saturation=1.20,curves=r=\'0/0.03 0.15/0.08 0.3/0.25 0.5/0.5 0.7/0.75 0.85/0.92 1/1\':g=\'0/0.03 0.15/0.08 0.3/0.25 0.5/0.5 0.7/0.75 0.85/0.92 1/1\':b=\'0/0.03 0.15/0.08 0.3/0.25 0.5/0.5 0.7/0.75 0.85/0.92 1/1\'';

export function getColorGradeFilter(_shotType: ShotType, isLog: boolean): string {
  if (isLog) {
    return LOG_CONVERSION;
  }
  return '';
}
