'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Play,
  Check,
  X,
  RotateCcw,
  ArrowRight,
  Film,
  Plus,
  Minus,
  Scissors,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SHOT_TYPE_LABELS } from '@/lib/types';
import type { Job, SelectedClip, ShotType } from '@/lib/types';

interface PreviewViewProps {
  jobIds: string[];
  onConfirm: (jobIds: string[]) => void;
  onReject: (jobIds: string[]) => void;
}

interface ManualClip {
  startTime: number;
  endTime: number;
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
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [manualClipCount, setManualClipCount] = useState(3);
  const [manualClips, setManualClips] = useState<ManualClip[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  const activeClip = clips[activeClipIndex];

  // Initialize manual clips when switching to manual mode
  const initManualClips = useCallback(() => {
    const duration = job.videoMetadata?.duration || 30;
    const clipDuration = 3;
    const count = Math.min(manualClipCount, Math.floor(duration / clipDuration));
    const newClips: ManualClip[] = [];
    for (let i = 0; i < count; i++) {
      const start = Math.round((duration / (count + 1)) * (i + 1) * 10) / 10;
      newClips.push({
        startTime: Math.max(0, start - clipDuration / 2),
        endTime: Math.min(duration, start + clipDuration / 2),
      });
    }
    setManualClips(newClips);
  }, [manualClipCount, job.videoMetadata?.duration]);

  const updateManualClip = useCallback((index: number, field: 'startTime' | 'endTime', value: number) => {
    setManualClips((prev) =>
      prev.map((clip, i) => (i === index ? { ...clip, [field]: value } : clip))
    );
  }, []);

  const applyManualClips = useCallback(() => {
    const duration = job.videoMetadata?.duration || 30;
    const newClips: SelectedClip[] = manualClips.map((mc, i) => ({
      segmentIndex: i,
      startTime: mc.startTime,
      duration: mc.endTime - mc.startTime,
      shotType: 'dynamic-to-static' as ShotType,
      accepted: true,
      score: 0,
    }));
    setClips(newClips);
    setActiveClipIndex(0);
  }, [manualClips, job.videoMetadata?.duration]);

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

  const videoDuration = job.videoMetadata?.duration || 0;

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
              {videoDuration > 0 && (
                <span className="ml-2 text-zinc-600">
                  (总时长 {videoDuration.toFixed(1)}s)
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Mode Toggle */}
            <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-0.5">
              <button
                onClick={() => setMode('auto')}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  mode === 'auto'
                    ? 'bg-cyan-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-300'
                }`}
              >
                自动
              </button>
              <button
                onClick={() => {
                  setMode('manual');
                  initManualClips();
                }}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  mode === 'manual'
                    ? 'bg-cyan-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-300'
                }`}
              >
                手动
              </button>
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
      </div>

      {/* Manual Clip Settings */}
      {mode === 'manual' && (
        <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-3 mb-3">
            <Scissors className="w-4 h-4 text-cyan-500" />
            <span className="text-sm text-zinc-300">手动剪辑设置</span>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => {
                  const newCount = Math.max(1, manualClipCount - 1);
                  setManualClipCount(newCount);
                  setTimeout(initManualClips, 0);
                }}
                className="w-6 h-6 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 flex items-center justify-center"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-sm text-zinc-300 w-8 text-center">{manualClipCount} 段</span>
              <button
                onClick={() => {
                  const maxClips = Math.floor(videoDuration / 1);
                  const newCount = Math.min(maxClips, manualClipCount + 1);
                  setManualClipCount(newCount);
                  setTimeout(initManualClips, 0);
                }}
                className="w-6 h-6 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 flex items-center justify-center"
              >
                <Plus className="w-3 h-3" />
              </button>
              <Button
                size="sm"
                className="ml-2 bg-cyan-600 hover:bg-cyan-700 text-white h-7 text-xs"
                onClick={applyManualClips}
              >
                应用
              </Button>
            </div>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {manualClips.map((mc, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-zinc-500 w-8">#{i + 1}</span>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max={videoDuration}
                  value={mc.startTime}
                  onChange={(e) => updateManualClip(i, 'startTime', parseFloat(e.target.value) || 0)}
                  className="w-20 h-7 bg-zinc-800 border-zinc-700 text-zinc-300 text-xs"
                />
                <span className="text-zinc-600">至</span>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max={videoDuration}
                  value={mc.endTime}
                  onChange={(e) => updateManualClip(i, 'endTime', parseFloat(e.target.value) || 0)}
                  className="w-20 h-7 bg-zinc-800 border-zinc-700 text-zinc-300 text-xs"
                />
                <span className="text-zinc-600">
                  ({(mc.endTime - mc.startTime).toFixed(1)}s)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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
