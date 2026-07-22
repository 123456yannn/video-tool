import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { MATERIALS_DIR } from '@/lib/video/constants';
import { SHOT_TYPE_LABELS, SHOT_TYPE_DIRS } from '@/lib/types';
import type { ShotType, MaterialItem } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    const materials: MaterialItem[] = [];
    const categories: ShotType[] = [
      'product-closeup',
      'environment',
      'human',
      'production-line',
      'dynamic-to-static',
    ];

    const targetCategories = category
      ? categories.filter((c) => c === category)
      : categories;

    for (const cat of targetCategories) {
      const dir = path.join(MATERIALS_DIR, SHOT_TYPE_DIRS[cat]);
      if (!fs.existsSync(dir)) continue;

      const files = fs.readdirSync(dir).filter((f: string) => f.endsWith('.mp4'));

      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        materials.push({
          id: `${cat}_${file}`,
          fileName: file,
          shotType: cat,
          shotTypeLabel: SHOT_TYPE_LABELS[cat],
          filePath: `/api/videos?file=${encodeURIComponent(file)}&category=${cat}`,
          duration: 3.0,
          createdAt: stat.birthtime.toISOString(),
          sourceJobId: '',
        });
      }
    }

    // Sort by filename
    materials.sort((a, b) => a.fileName.localeCompare(b.fileName));

    return NextResponse.json(materials);
  } catch (error) {
    console.error('Library error:', error);
    return NextResponse.json(
      { error: 'Failed to list materials', details: String(error) },
      { status: 500 }
    );
  }
}
