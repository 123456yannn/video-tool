export type ShotType =
  | 'product-closeup'
  | 'environment'
  | 'human'
  | 'production-line'
  | 'dynamic-to-static';

export const SHOT_TYPE_LABELS: Record<ShotType, string> = {
  'product-closeup': '产品特写',
  environment: '环境空镜',
  human: '人物空镜',
  'production-line': '生产线',
  'dynamic-to-static': '动态转静态',
};

export const SHOT_TYPE_DIRS: Record<ShotType, string> = {
  'product-closeup': 'product-closeup',
  environment: 'environment',
  human: 'human',
  'production-line': 'production-line',
  'dynamic-to-static': 'dynamic-to-static',
};

export type JobStatus =
  | 'uploading'
  | 'analyzing'
  | 'ready-for-preview'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'rejected';

export interface SceneSegment {
  index: number;
  startTime: number;
  endTime: number;
  duration: number;
  score: number;
  shotType: ShotType;
  motionLevel: number; // 0-1
  brightness: number; // 0-255
  isLog: boolean;
}

export interface SelectedClip {
  segmentIndex: number;
  startTime: number;
  duration: number;
  shotType: ShotType;
  accepted: boolean;
}

export interface Job {
  id: string;
  fileName: string;
  originalName: string;
  status: JobStatus;
  progress: number; // 0-100
  currentStep: string;
  videoMetadata: {
    duration: number;
    width: number;
    height: number;
    fps: number;
    hasAudio: boolean;
    aspectRatio: string;
  } | null;
  scenes: SceneSegment[];
  selectedClips: SelectedClip[];
  outputFiles: string[];
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface MaterialItem {
  id: string;
  fileName: string;
  shotType: ShotType;
  shotTypeLabel: string;
  filePath: string;
  duration: number;
  createdAt: string;
  sourceJobId: string;
}

export interface ProcessingStep {
  key: string;
  label: string;
  status: 'pending' | 'active' | 'done';
}

export const PROCESSING_STEPS: ProcessingStep[] = [
  { key: 'analyzing', label: '分析中', status: 'pending' },
  { key: 'selecting', label: '选片中', status: 'pending' },
  { key: 'preprocessing', label: '预处理中', status: 'pending' },
  { key: 'color-grading', label: '调色中', status: 'pending' },
  { key: 'outputting', label: '输出中', status: 'pending' },
];
