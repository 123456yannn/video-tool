import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { MATERIALS_DIR, UPLOADS_DIR } from '@/lib/video/constants';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const file = searchParams.get('file');
    const category = searchParams.get('category');
    const jobId = searchParams.get('jobId');

    if (!file) {
      return NextResponse.json({ error: 'File parameter required' }, { status: 400 });
    }

    let filePath: string;

    if (jobId) {
      // Serve preview video from uploads
      filePath = path.join(UPLOADS_DIR, file);
    } else if (category) {
      // Serve processed material
      const categoryDir =
        category === 'product-closeup'
          ? 'product-closeup'
          : category === 'production-line'
            ? 'production-line'
            : category === 'dynamic-to-static'
              ? 'dynamic-to-static'
              : category;
      filePath = path.join(MATERIALS_DIR, categoryDir, file);
    } else {
      // Search in all material dirs
      filePath = '';
      const dirs = fs.readdirSync(MATERIALS_DIR);
      for (const dir of dirs) {
        const fullPath = path.join(MATERIALS_DIR, dir, file);
        if (fs.existsSync(fullPath)) {
          filePath = fullPath;
          break;
        }
      }
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const stat = fs.statSync(filePath);
    const fileBuffer = fs.readFileSync(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': stat.size.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('Video serve error:', error);
    return NextResponse.json(
      { error: 'Failed to serve video', details: String(error) },
      { status: 500 }
    );
  }
}
