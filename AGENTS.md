# 项目上下文

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4

## 目录结构

```
├── public/                 # 静态资源
├── data/                   # 数据存储（运行时生成）
│   ├── uploads/            # 上传的原始视频
│   ├── materials/          # 处理后的素材（按类型分类）
│   │   ├── product-closeup/
│   │   ├── environment/
│   │   ├── human/
│   │   ├── production-line/
│   │   └── dynamic-to-static/
│   └── jobs.json           # 任务状态记录
├── scripts/                # 构建与启动脚本
├── src/
│   ├── app/                # 页面路由与布局
│   │   ├── api/            # API 路由
│   │   │   ├── upload/     # 视频上传
│   │   │   ├── jobs/       # 任务管理（分析/查询）
│   │   │   ├── confirm/    # 确认处理
│   │   │   ├── library/    # 素材库列表
│   │   │   └── videos/     # 视频文件服务
│   │   ├── layout.tsx      # 根布局
│   │   └── page.tsx        # 主页面（SPA 视图切换）
│   ├── components/         # 前端组件
│   │   ├── upload-view.tsx       # 上传视图
│   │   ├── processing-view.tsx   # 处理进度视图
│   │   ├── preview-view.tsx      # 预览确认视图
│   │   └── library-view.tsx      # 素材库视图
│   ├── components/ui/      # Shadcn UI 组件库
│   └── lib/                # 工具库
│       ├── types.ts        # 类型定义
│       ├── utils.ts        # 通用工具函数
│       └── video/          # 视频处理核心模块
│           ├── constants.ts      # 路径常量与 Job 存储
│           ├── ffprobe.ts        # FFmpeg/FFprobe 封装
│           ├── analysis.ts       # 视频分析（场景检测/分类/评分）
│           ├── color-grading.ts  # 调色预设
│           └── processing.ts     # 视频处理流水线
├── next.config.ts          # Next.js 配置
├── package.json            # 项目依赖管理
└── tsconfig.json           # TypeScript 配置
```

## 包管理规范

**仅允许使用 pnpm** 作为包管理器。

## 核心功能

### 视频处理流水线
1. **上传** → 保存原始视频到 `data/uploads/`
2. **分析** → FFmpeg 场景检测 + 帧分析（亮度/运动/色彩）→ 自动分类镜头类型
3. **选片** → 根据评分选出 1-2 段最佳 3 秒片段
4. **预处理** → vidstab 防抖 + 曝光修正 + unsharp 锐化
5. **调色** → 按场景类型自动匹配调色预设
6. **输出** → 保留原始比例/分辨率/音频，输出 MP4

### 镜头类型分类
- `product-closeup` 产品特写 → 暖色生活化调色
- `environment` 环境空镜 → 蓝绿通透调色
- `human` 人物空镜 → 暖色生活化调色
- `production-line` 生产线 → 高级冷调调色
- `dynamic-to-static` 动态转静态 → 自然增强调色

### API 路由
- `POST /api/upload` - 上传视频文件（multipart/form-data）
- `GET /api/jobs` - 获取任务列表或单个任务详情（?id=xxx）
- `POST /api/jobs` - 触发分析（body: {jobId, action:"analyze"}）
- `POST /api/confirm` - 确认片段并处理（body: {jobId, clips}）
- `GET /api/library` - 获取素材库列表（?category=xxx）
- `GET /api/videos` - 提供视频文件流（?file=xxx&category=xxx）

## 开发规范

- 深色主题 UI，cyan 强调色
- 前端 SPA 四视图：上传 → 处理 → 预览 → 素材库
- 后端使用 FFmpeg 进行视频处理
- 支持 Log/灰度素材自动检测与色彩还原
- 文件命名规则：`类型_日期_编号.mp4`
