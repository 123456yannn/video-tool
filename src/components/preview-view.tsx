'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Play,
  Check,
  X,
  RotateCcw,
  ArrowRight,
  Film,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SHOT_TYPE_LABELS } from '@/lib/types';
import type { Job, SelectedClip, ShotType } from '@/lib/types';

interface PreviewViewProps {
  jobIds: string[];
  onConfirm: (jobIds: string[]) => void;
  onReject: (jobIds: string[]) => void;
}

function ClipPreview({
  job,
  onConfirm,
  onReject,
}: {
  job: Job;
  onConfirm: () => void;
  onReject: () => void;
}) {
  const [clips, setClips] = useState<SelectedClip[]>(job.selectedClips);
  const [activeClipIndex, setActiveClipIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const activeClip = clips[activeClipIndex];

  const toggleClipAcceptance = useCallback(
    (index: number) => {
      setClips((prev) =>
        prev.map((clip, i) =>
          i === index ? { ...clip, accepted: !clip.accepted } : clip
        )
      );
    },
    []
  );

  const handleConfirm = useCallback(async () => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, clips }),
      });

      if (res.ok) {
        onConfirm();
      }
    } catch (error) {
      console.error('Confirm error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [job.id, clips, onConfirm]);

  const handleRejectAll = useCallback(async () => {
    setIsProcessing(true);
    try {
      const rejectedClips = clips.map((c) => ({ ...c, accepted: false }));
      const res = await fetch('/api/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, clips: rejectedClips }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.reAnalyzed) {
          setClips(data.selectedClips);
        }
        onReject();
      }
    } catch (error) {
      console.error('Reject error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [job.id, clips, onReject]);

  const videoSrc = activeClip
    ? `/api/videos?file=${job.fileName}&jobId=${job.id}#t=${activeClip.startTime},${activeClip.startTime + activeClip.duration}`
    : '';

  return (
    <div className="bg-zinc-900/80 rounded-xl border border-zinc-800 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-zinc-200">
              {job.originalName}
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              已选择 {clips.filter((c) => c.accepted).length} / {clips.length}{' '}
              个片段
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-zinc-500 hover:text-zinc-300"
            onClick={handleRejectAll}
            disabled={isProcessing}
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            重新选择
          </Button>
        </div>
      </div>

      {/* Video Preview */}
      <div className="aspect-video bg-black flex items-center justify-center relative">
        {activeClip && (
          <video
            ref={videoRef}
            src={videoSrc}
            className="max-w-full max-h-full"
            controls
            autoPlay
            muted
          />
        )}
        {!activeClip && (
          <div className="text-zinc-600 text-sm">无可用片段</div>
        )}
      </div>

      {/* Clip List */}
      <div className="p-4 space-y-2">
        {clips.map((clip, index) => (
          <div
            key={clip.segmentIndex}
            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
              index === activeClipIndex
                ? 'bg-zinc-800 border border-cyan-800/50'
                : 'bg-zinc-900/50 border border-zinc-800/50 hover:bg-zinc-800/50'
            } ${!clip.accepted ? 'opacity-50' : ''}`}
            onClick={() => setActiveClipIndex(index)}
          >
            <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center shrink-0">
              <Film className="w-4 h-4 text-zinc-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-cyan-400">
                  {SHOT_TYPE_LABELS[clip.shotType]}
                </span>
                <span className="text-xs text-zinc-500">
                  {clip.duration.toFixed(1)}s
                </span>
              </div>
              <p className="text-xs text-zinc-600 mt-0.5">
                起始: {clip.startTime.toFixed(1)}s
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleClipAcceptance(index);
              }}
              className={`p-1.5 rounded transition-colors ${
                clip.accepted
                  ? 'bg-green-900/30 text-green-400 hover:bg-green-900/50'
                  : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
              }`}
            >
              {clip.accepted ? (
                <Check className="w-4 h-4" />
              ) : (
                <X className="w-4 h-4" />
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="px-4 pb-4">
        <Button
          className="w-full bg-cyan-600 hover:bg-cyan-700 text-white h-11"
          onClick={handleConfirm}
          disabled={
            isProcessing || clips.every((c) => !c.accepted)
          }
        >
          {isProcessing ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              处理中...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              确认输出
              <ArrowRight className="w-4 h-4" />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}

export function PreviewView({
  jobIds,
  onConfirm,
  onReject,
}: PreviewViewProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [confirmedJobs, setConfirmedJobs] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchJobs = async () => {
      const fetchedJobs: Job[] = [];
      for (const jobId of jobIds) {
        const res = await fetch(`/api/jobs?id=${jobId}`);
        if (res.ok) {
          fetchedJobs.push(await res.json());
        }
      }
      setJobs(fetchedJobs);
    };
    fetchJobs();
  }, [jobIds]);

  const handleConfirm = useCallback(
    (jobId: string) => {
      setConfirmedJobs((prev) => {
        const next = new Set(prev);
        next.add(jobId);
        if (next.size >= jobs.length) {
          onConfirm(jobIds);
        }
        return next;
      });
    },
    [jobs.length, jobIds, onConfirm]
  );

  if (jobs.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-xl font-semibold text-zinc-200">预览确认</h2>
        <p className="text-sm text-zinc-500 mt-1">
          系统已选择精华片段，请预览后确认输出
        </p>
      </div>

      {jobs.map((job) => (
        <ClipPreview
          key={job.id}
          job={job}
          onConfirm={() => handleConfirm(job.id)}
          onReject={() => {}}
        />
      ))}
    </div>
  );
}
