import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { UPLOADS_DIR, ensureDirs, createJob } from '@/lib/video/constants';
import type { Job } from '@/lib/types';

// Allow large video file uploads (up to 2GB)
export const bodySizeLimit = '2gb';

export async function POST(request: NextRequest) {
  try {
    ensureDirs();

    const formData = await request.formData();
    const files: File[] = [];

    for (const [key, value] of formData.entries()) {
      if (key === 'videos' && value instanceof File) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
    }

    const jobIds: string[] = [];

    for (const file of files) {
      const jobId = uuidv4();
      const ext = path.extname(file.name).toLowerCase();
      const fileName = `${jobId}${ext}`;
      const filePath = path.join(UPLOADS_DIR, fileName);

      // Save file to disk
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(filePath, buffer);

      // Create job record
      const job: Job = {
        id: jobId,
        fileName,
        originalName: file.name,
        fileSize: file.size,
        status: 'uploaded',
        progress: 0,
        currentStep: '已上传，等待处理',
        pipelineStage: 'uploaded',
        videoMetadata: null,
        scenes: [],
        selectedClips: [],
        outputFiles: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      createJob(job);
      jobIds.push(jobId);
    }

    return NextResponse.json({ jobIds, count: files.length });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed', details: String(error) },
      { status: 500 }
    );
  }
}
