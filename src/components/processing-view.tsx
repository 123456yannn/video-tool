'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Job, ProcessingStep } from '@/lib/types';

interface ProcessingViewProps {
  jobIds: string[];
  onAnalysisComplete: (jobIds: string[]) => void;
}

const STEPS: { key: string; label: string }[] = [
  { key: 'analyzing', label: '分析视频内容' },
  { key: 'selecting', label: '选择精华片段' },
  { key: 'preprocessing', label: '预处理（防抖/曝光/锐化）' },
  { key: 'color-grading', label: '自动调色' },
  { key: 'outputting', label: '输出成片' },
];

function JobProgress({
  jobId,
  onComplete,
}: {
  jobId: string;
  onComplete: () => void;
}) {
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const fetchJob = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs?id=${jobId}`);
      if (res.ok) {
        const data: Job = await res.json();
        setJob(data);

        if (data.status === 'ready-for-preview') {
          onComplete();
          return;
        }
        if (data.status === 'failed') {
          setError(data.error || '处理失败');
          return;
        }
      }
    } catch {
      // retry
    }
  }, [jobId, onComplete]);

  // Start analysis on mount
  useEffect(() => {
    const startAnalysis = async () => {
      try {
        const res = await fetch('/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId, action: 'analyze' }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || '分析启动失败');
          return;
        }

        const data = await res.json();
        if (data.success) {
          // Analysis complete, update step
          setCurrentStepIndex(2);
          // Small delay then complete
          setTimeout(() => onComplete(), 500);
        }
      } catch (err) {
        setError(String(err));
      }
    };

    startAnalysis();
  }, [jobId, onComplete]);

  // Poll for status updates
  useEffect(() => {
    const interval = setInterval(fetchJob, 1000);
    return () => clearInterval(interval);
  }, [fetchJob]);

  // Update step index based on job status
  useEffect(() => {
    if (!job) return;
    switch (job.status) {
      case 'analyzing':
        setCurrentStepIndex(0);
        break;
      case 'processing':
        if (job.currentStep.includes('预处理')) setCurrentStepIndex(2);
        else if (job.currentStep.includes('调色')) setCurrentStepIndex(3);
        else if (job.currentStep.includes('输出')) setCurrentStepIndex(4);
        else setCurrentStepIndex(1);
        break;
      case 'ready-for-preview':
        setCurrentStepIndex(5);
        break;
    }
  }, [job]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 p-6 bg-zinc-900/80 rounded-xl border border-red-900/30">
        <AlertCircle className="w-8 h-8 text-red-500" />
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-zinc-900/80 rounded-xl border border-zinc-800">
      <div className="flex items-center gap-3 mb-4">
        <Loader2 className="w-5 h-5 text-cyan-500 animate-spin" />
        <span className="text-sm text-zinc-300">
          {job?.originalName || '处理中...'}
        </span>
      </div>

      <div className="space-y-3">
        {STEPS.map((step, index) => {
          const isDone = index < currentStepIndex;
          const isActive = index === currentStepIndex;

          return (
            <div key={step.key} className="flex items-center gap-3">
              {isDone ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              ) : isActive ? (
                <div className="w-5 h-5 flex items-center justify-center shrink-0">
                  <div className="w-3 h-3 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="w-5 h-5 flex items-center justify-center shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                </div>
              )}
              <span
                className={`text-sm ${
                  isDone
                    ? 'text-green-400'
                    : isActive
                      ? 'text-cyan-400'
                      : 'text-zinc-600'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="mt-4 w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full bg-cyan-500 transition-all duration-500"
          style={{
            width: `${Math.min(100, (currentStepIndex / STEPS.length) * 100)}%`,
          }}
        />
      </div>
    </div>
  );
}

export function ProcessingView({
  jobIds,
  onAnalysisComplete,
}: ProcessingViewProps) {
  const [completedJobs, setCompletedJobs] = useState<Set<string>>(new Set());

  const handleJobComplete = useCallback(
    (jobId: string) => {
      setCompletedJobs((prev) => {
        const next = new Set(prev);
        next.add(jobId);
        // When all jobs complete, navigate to preview
        if (next.size >= jobIds.length) {
          onAnalysisComplete(Array.from(next));
        }
        return next;
      });
    },
    [jobIds, onAnalysisComplete]
  );

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-xl font-semibold text-zinc-200">正在处理</h2>
        <p className="text-sm text-zinc-500 mt-1">
          系统正在分析视频并选择精华片段...
        </p>
      </div>

      {jobIds.map((jobId) => (
        <JobProgress
          key={jobId}
          jobId={jobId}
          onComplete={() => handleJobComplete(jobId)}
        />
      ))}
    </div>
  );
}
