'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  FileVideo,
} from 'lucide-react';
import type { Job, PipelineStage } from '@/lib/types';
import {
  PIPELINE_STAGES,
  PIPELINE_STAGE_DESCRIPTIONS,
} from '@/lib/types';
import { cn } from '@/lib/utils';

interface ProcessingViewProps {
  jobIds: string[];
  onAnalysisComplete: (jobIds: string[]) => void;
}

// Estimate total processing time in seconds based on file sizes
function estimateTotalTime(jobs: { fileSize: number }[]): number {
  const totalMB = jobs.reduce((sum, j) => sum + j.fileSize / (1024 * 1024), 0);
  // ~3s per MB for analysis + ~5s per clip for processing (estimate 2 clips per video)
  return Math.max(15, Math.round(totalMB * 3 + jobs.length * 2 * 5));
}

function getStageIndex(stage: PipelineStage): number {
  return PIPELINE_STAGES.findIndex((s) => s.key === stage);
}

function formatTime(seconds: number): string {
  if (seconds <= 0) return '即将完成';
  if (seconds < 60) return `${seconds} 秒`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m} 分 ${s} 秒` : `${m} 分`;
}

// --- Single File Progress Card ---
function FileProgressCard({
  job,
  expanded,
  onToggle,
}: {
  job: Job;
  expanded: boolean;
  onToggle: () => void;
}) {
  const stageIdx = getStageIndex(job.pipelineStage);
  const isComplete = job.pipelineStage === 'completed';
  const isFailed = job.status === 'failed';

  return (
    <div
      className={cn(
        'rounded-lg border transition-all',
        isFailed
          ? 'border-red-900/40 bg-red-950/20'
          : isComplete
            ? 'border-green-900/30 bg-green-950/10'
            : 'border-zinc-800 bg-zinc-900/60'
      )}
    >
      {/* Header row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={onToggle}
      >
        {/* Status icon */}
        {isFailed ? (
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
        ) : isComplete ? (
          <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
        ) : (
          <div className="w-5 h-5 flex items-center justify-center shrink-0">
            <div className="w-3 h-3 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* File info */}
        <FileVideo className="w-4 h-4 text-zinc-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-zinc-200 truncate">
            {job.originalName}
          </p>
          <p className="text-xs text-zinc-500">
            {isFailed
              ? job.error || '处理失败'
              : isComplete
                ? '已完成'
                : PIPELINE_STAGE_DESCRIPTIONS[job.pipelineStage]}
          </p>
        </div>

        {/* Progress percentage */}
        <span
          className={cn(
            'text-xs font-mono tabular-nums shrink-0',
            isComplete ? 'text-green-500' : 'text-zinc-400'
          )}
        >
          {job.progress}%
        </span>

        {/* Expand toggle */}
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-zinc-600 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-zinc-600 shrink-0" />
        )}
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-2">
        <div className="w-full bg-zinc-800 rounded-full h-1 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700 ease-out',
              isFailed
                ? 'bg-red-500'
                : isComplete
                  ? 'bg-green-500'
                  : 'bg-cyan-500'
            )}
            style={{ width: `${job.progress}%` }}
          />
        </div>
      </div>

      {/* Expanded detail: pipeline stages */}
      {expanded && (
        <div className="px-4 pb-4 pt-1">
          <div className="relative pl-4">
            {/* Vertical connector line */}
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-zinc-800" />

            <div className="space-y-2.5">
              {PIPELINE_STAGES.map((stage, index) => {
                const isDone = index < stageIdx;
                const isActive = index === stageIdx && !isComplete;
                const isPending = index > stageIdx;

                return (
                  <div key={stage.key} className="flex items-start gap-3 relative">
                    {/* Node */}
                    <div className="relative z-10 shrink-0 mt-0.5">
                      {isDone || isComplete && index <= stageIdx ? (
                        <CheckCircle2 className="w-[18px] h-[18px] text-green-500" />
                      ) : isActive ? (
                        <div className="w-[18px] h-[18px] flex items-center justify-center">
                          <div className="w-2.5 h-2.5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : (
                        <div className="w-[18px] h-[18px] flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-zinc-700" />
                        </div>
                      )}
                    </div>

                    {/* Label + description */}
                    <div className="min-w-0">
                      <p
                        className={cn(
                          'text-sm leading-tight',
                          isDone || (isComplete && index <= stageIdx)
                            ? 'text-green-400'
                            : isActive
                              ? 'text-cyan-400 font-medium'
                              : 'text-zinc-600'
                        )}
                      >
                        {stage.label}
                      </p>
                      {isActive && (
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {PIPELINE_STAGE_DESCRIPTIONS[stage.key]}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main Processing View ---
export function ProcessingView({
  jobIds,
  onAnalysisComplete,
}: ProcessingViewProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [isStarted, setIsStarted] = useState(false);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const startTimeRef = useRef<number | null>(null);

  // Fetch all jobs
  const fetchJobs = useCallback(async () => {
    const fetched: Job[] = [];
    for (const id of jobIds) {
      try {
        const res = await fetch(`/api/jobs?id=${id}`);
        if (res.ok) {
          fetched.push(await res.json());
        }
      } catch {
        // retry next poll
      }
    }
    return fetched;
  }, [jobIds]);

  // Start analysis for all jobs on mount
  useEffect(() => {
    if (isStarted) return;
    setIsStarted(true);
    startTimeRef.current = Date.now();

    // Initial estimate: ~3s per MB + ~5s per clip (2 clips per video)
    setRemainingSeconds(30);

    const startAll = async () => {
      for (const jobId of jobIds) {
        try {
          await fetch('/api/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId, action: 'analyze' }),
          });
        } catch {
          // ignore
        }
      }
    };
    startAll();
  }, [jobIds, isStarted]);

  // Poll job status
  useEffect(() => {
    const poll = async () => {
      const fetched = await fetchJobs();
      setJobs(fetched);

      // Update estimated time based on actual progress and file sizes
      if (fetched.length > 0 && startTimeRef.current) {
        const totalEstimated = estimateTotalTime(fetched);
        const avgProgress =
          fetched.reduce((sum, j) => sum + j.progress, 0) / fetched.length;
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        // Adjust: if progress is faster than expected, reduce remaining time
        if (avgProgress > 5) {
          const projectedTotal = elapsed / (avgProgress / 100);
          const adjustedRemaining = Math.max(
            0,
            Math.round(projectedTotal - elapsed)
          );
          setRemainingSeconds(adjustedRemaining);
        } else {
          setRemainingSeconds(totalEstimated);
        }
      }

      // Check completed
      let hasNewCompletion = false;
      for (const job of fetched) {
        if (
          (job.status === 'ready-for-preview' || job.status === 'completed') &&
          !completedIds.has(job.id)
        ) {
          hasNewCompletion = true;
        }
      }
      if (hasNewCompletion) {
        setCompletedIds((prev) => {
          const next = new Set(prev);
          for (const job of fetched) {
            if (job.status === 'ready-for-preview' || job.status === 'completed') {
              next.add(job.id);
            }
          }
          return next;
        });
      }

      // All done?
      const newCompletedCount = fetched.filter(
        (j) => j.status === 'ready-for-preview' || j.status === 'completed'
      ).length;
      if (newCompletedCount >= jobIds.length && fetched.length === jobIds.length) {
        setTimeout(() => onAnalysisComplete(jobIds), 600);
      }
    };

    const interval = setInterval(poll, 800);
    // Initial fetch
    poll();
    return () => clearInterval(interval);
  }, [fetchJobs, jobIds, onAnalysisComplete]);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleExpand = useCallback((jobId: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedFiles(new Set(jobIds));
  }, [jobIds]);

  const collapseAll = useCallback(() => {
    setExpandedFiles(new Set());
  }, []);

  const allExpanded = jobs.length > 0 && expandedFiles.size >= jobs.length;
  const completedCount = completedIds.size;
  const totalCount = jobIds.length;
  const allDone = completedCount >= totalCount;

  // Overall progress
  const overallProgress =
    jobs.length > 0
      ? Math.round(jobs.reduce((sum, j) => sum + j.progress, 0) / jobs.length)
      : 0;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-zinc-200">
          {allDone ? '处理完成' : '正在处理'}
        </h2>
        <p className="text-sm text-zinc-500">
          {allDone
            ? '所有视频已处理完毕，即将跳转到预览页面'
            : '系统正在分析视频并选择精华片段'}
        </p>
      </div>

      {/* Overall progress section */}
      <div className="bg-zinc-900/80 rounded-xl border border-zinc-800 p-5 space-y-4">
        {/* Top row: completion count + timer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-400">
              整体进度{' '}
              <span className="text-zinc-200 font-medium">
                {completedCount}/{totalCount}
              </span>
            </span>
            <span className="text-xs text-zinc-600">
              ({overallProgress}%)
            </span>
          </div>

          {!allDone && (
            <div className="flex items-center gap-1.5 text-zinc-500">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-xs tabular-nums">
                预计还需 {formatTime(remainingSeconds)}
              </span>
            </div>
          )}
        </div>

        {/* Overall progress bar */}
        <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700 ease-out',
              allDone ? 'bg-green-500' : 'bg-cyan-500'
            )}
            style={{ width: `${overallProgress}%` }}
          />
        </div>

        {/* Pipeline stage summary (horizontal) */}
        <div className="flex items-center gap-1">
          {PIPELINE_STAGES.map((stage, index) => {
            // Determine if this stage is active across any job
            const anyActive = jobs.some(
              (j) => j.pipelineStage === stage.key && j.status !== 'failed'
            );
            const allPast = jobs.every((j) => {
              const jIdx = getStageIndex(j.pipelineStage);
              return jIdx > index || j.pipelineStage === 'completed';
            });

            return (
              <React.Fragment key={stage.key}>
                <div
                  className={cn(
                    'flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] transition-all',
                    allPast
                      ? 'text-green-500'
                      : anyActive
                        ? 'text-cyan-400 bg-cyan-950/30'
                        : 'text-zinc-700'
                  )}
                >
                  {allPast ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : anyActive ? (
                    <div className="w-3 h-3 border border-cyan-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-zinc-700" />
                  )}
                  <span className="hidden sm:inline">{stage.label}</span>
                </div>
                {index < PIPELINE_STAGES.length - 1 && (
                  <div
                    className={cn(
                      'flex-1 h-px',
                      allPast ? 'bg-green-800' : 'bg-zinc-800'
                    )}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Per-file list */}
      <div className="space-y-2">
        {/* Expand/Collapse toggle */}
        {jobs.length > 1 && (
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-zinc-500">
              {jobs.length} 个文件
            </span>
            <button
              onClick={allExpanded ? collapseAll : expandAll}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {allExpanded ? '全部收起' : '全部展开'}
            </button>
          </div>
        )}

        {jobs.map((job) => (
          <FileProgressCard
            key={job.id}
            job={job}
            expanded={expandedFiles.has(job.id)}
            onToggle={() => toggleExpand(job.id)}
          />
        ))}
      </div>
    </div>
  );
}
