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
  | 'uploaded'
  | 'analyzing'
  | 'selecting'
  | 'preprocessing'
  | 'color-grading'
  | 'outputting'
  | 'ready-for-preview'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'rejected';

export type PipelineStage =
  | 'uploaded'
  | 'analyzing'
  | 'selecting'
  | 'preview-ready'
  | 'preprocessing'
  | 'color-grading'
  | 'outputting'
  | 'completed';

export const PIPELINE_STAGES: { key: PipelineStage; label: string }[] = [
  { key: 'uploaded', label: '已上传' },
  { key: 'analyzing', label: '正在分析' },
  { key: 'selecting', label: '正在选片' },
  { key: 'preview-ready', label: '等待确认' },
  { key: 'preprocessing', label: '正在预处理' },
  { key: 'color-grading', label: '正在调色' },
  { key: 'outputting', label: '正在输出' },
  { key: 'completed', label: '已完成' },
];

export const PIPELINE_STAGE_DESCRIPTIONS: Record<PipelineStage, string> = {
  uploaded: '等待处理',
  analyzing: 'AI 正在识别镜头类型、分析画面质量',
  selecting: '正在节选精华 3 秒片段',
  'preview-ready': '分析完成，等待预览确认',
  preprocessing: '防抖稳定 + 曝光修正 + 锐化增强',
  'color-grading': '按场景类型自动匹配调色预设',
  outputting: '生成最终 MP4 片段',
  completed: '处理完成',
};

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
  contentTags?: string[];
}

export interface SelectedClip {
  segmentIndex: number;
  startTime: number;
  duration: number;
  shotType: ShotType;
  accepted: boolean;
  score?: number;
  contentTags?: string[];
}

export interface Job {
  id: string;
  fileName: string;
  originalName: string;
  fileSize: number; // bytes
  status: JobStatus;
  progress: number; // 0-100
  currentStep: string;
  pipelineStage: PipelineStage;
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
