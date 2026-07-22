import { NextRequest, NextResponse } from 'next/server';
import { getJob, updateJob } from '@/lib/video/constants';
import { processClips } from '@/lib/video/processing';
import type { SelectedClip } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const { jobId, clips } = await request.json();

    const job = getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (!clips || !Array.isArray(clips) || clips.length === 0) {
      return NextResponse.json(
        { error: 'No clips selected' },
        { status: 400 }
      );
    }

    // Check if any clips are rejected - handle re-selection
    const hasRejected = clips.some((c: SelectedClip) => !c.accepted);
    const acceptedClips = clips.filter((c: SelectedClip) => c.accepted);

    if (acceptedClips.length === 0) {
      // All rejected, re-analyze
      updateJob(jobId, {
        status: 'analyzing',
        currentStep: '重新分析中...',
        progress: 10,
      });

      // Import here to avoid circular dependency
      const { analyzeVideo } = await import('@/lib/video/analysis');
      try {
        const result = analyzeVideo(jobId, job.fileName);
        const newSelectedClips = result.selectedClips.map((clip) => ({
          segmentIndex: clip.segmentIndex,
          startTime: clip.startTime,
          duration: clip.duration,
          shotType: clip.shotType,
          accepted: true,
        }));

        updateJob(jobId, {
          status: 'ready-for-preview',
          progress: 100,
          currentStep: '重新分析完成',
          scenes: result.scenes,
          selectedClips: newSelectedClips,
        });

        return NextResponse.json({
          success: true,
          reAnalyzed: true,
          selectedClips: newSelectedClips,
          scenes: result.scenes,
        });
      } catch (err) {
        updateJob(jobId, {
          status: 'failed',
          error: String(err),
        });
        return NextResponse.json(
          { error: 'Re-analysis failed' },
          { status: 500 }
        );
      }
    }

    // Process accepted clips
    updateJob(jobId, {
      status: 'processing',
      currentStep: '预处理中...',
      progress: 20,
      selectedClips: clips,
    });

    const isLog = job.scenes.some((s: { isLog: boolean }) => s.isLog);

    try {
      const result = processClips(
        jobId,
        job.fileName,
        acceptedClips,
        isLog,
        {
          width: job.videoMetadata?.width || 1920,
          height: job.videoMetadata?.height || 1080,
          hasAudio: job.videoMetadata?.hasAudio || false,
        },
        (step, percent) => {
          updateJob(jobId, {
            currentStep: step === 'processing' ? '处理中...' : step,
            progress: 20 + Math.round(percent * 0.8),
          });
        }
      );

      const outputFiles = result.outputFiles.map((f) => f.path);

      updateJob(jobId, {
        status: 'completed',
        currentStep: '处理完成',
        progress: 100,
        outputFiles,
      });

      return NextResponse.json({
        success: true,
        outputFiles: result.outputFiles.map((f) => ({
          path: f.path,
          fileName: f.fileName,
          shotType: f.shotType,
        })),
      });
    } catch (processError) {
      updateJob(jobId, {
        status: 'failed',
        currentStep: '处理失败',
        error: String(processError),
      });
      return NextResponse.json(
        { error: 'Processing failed', details: String(processError) },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Confirm error:', error);
    return NextResponse.json(
      { error: 'Confirm failed', details: String(error) },
      { status: 500 }
    );
  }
}
