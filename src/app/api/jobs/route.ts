import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import {
  getJob,
  updateJob,
  loadJobs,
  UPLOADS_DIR,
  MATERIALS_DIR,
} from '@/lib/video/constants';
import { analyzeVideo } from '@/lib/video/analysis';
import type { MaterialItem, ShotType } from '@/lib/types';
import { SHOT_TYPE_LABELS } from '@/lib/types';

// GET /api/jobs?id=xxx or GET /api/jobs (list all)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('id');

    if (jobId) {
      const job = getJob(jobId);
      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }
      return NextResponse.json(job);
    }

    // List all jobs
    const jobs = loadJobs();
    const jobList = Object.values(jobs).sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return NextResponse.json(jobList);
  } catch (error) {
    console.error('Jobs GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get jobs', details: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/jobs - trigger analysis for a job
export async function POST(request: NextRequest) {
  try {
    const { jobId, action } = await request.json();

    if (action === 'analyze') {
      const job = getJob(jobId);
      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }

      // Run analysis synchronously (in production, this should be a background job)
      updateJob(jobId, {
        status: 'analyzing',
        currentStep: '分析视频内容...',
        progress: 20,
      });

      try {
        const result = analyzeVideo(jobId, job.fileName);

        const selectedClips = result.selectedClips.map((clip) => ({
          segmentIndex: clip.segmentIndex,
          startTime: clip.startTime,
          duration: clip.duration,
          shotType: clip.shotType,
          accepted: true,
        }));

        updateJob(jobId, {
          status: 'ready-for-preview',
          progress: 100,
          currentStep: '分析完成，等待预览确认',
          videoMetadata: result.metadata,
          scenes: result.scenes,
          selectedClips,
        });

        return NextResponse.json({
          success: true,
          metadata: result.metadata,
          scenes: result.scenes,
          selectedClips,
        });
      } catch (analysisError) {
        updateJob(jobId, {
          status: 'failed',
          currentStep: '分析失败',
          error: String(analysisError),
        });
        return NextResponse.json(
          { error: 'Analysis failed', details: String(analysisError) },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Jobs POST error:', error);
    return NextResponse.json(
      { error: 'Operation failed', details: String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/jobs?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('id');

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
    }

    const job = getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Delete uploaded file
    const filePath = path.join(UPLOADS_DIR, job.fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete output files
    for (const outputFile of job.outputFiles) {
      if (fs.existsSync(outputFile)) {
        fs.unlinkSync(outputFile);
      }
    }

    // Remove job record
    const jobs = loadJobs();
    delete jobs[jobId];
    fs.writeFileSync(
      path.join(process.env.COZE_WORKSPACE_PATH || '/workspace/projects', 'data', 'jobs.json'),
      JSON.stringify(jobs, null, 2)
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Jobs DELETE error:', error);
    return NextResponse.json(
      { error: 'Delete failed', details: String(error) },
      { status: 500 }
    );
  }
}
