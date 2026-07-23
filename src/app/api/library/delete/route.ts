import { NextRequest, NextResponse } from 'next/server';
import { MATERIALS_DIR } from '@/lib/video/constants';
import { SHOT_TYPE_DIRS } from '@/lib/types';
import path from 'path';
import fs from 'fs';

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const file = searchParams.get('file');
    const category = searchParams.get('category');

    if (!file || !category) {
      return NextResponse.json({ error: 'file 和 category 不能为空' }, { status: 400 });
    }

    const dirName = SHOT_TYPE_DIRS[category as keyof typeof SHOT_TYPE_DIRS] || category;
    const filePath = path.join(MATERIALS_DIR, dirName, file);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: '文件不存在' }, { status: 404 });
    }

    fs.unlinkSync(filePath);

    return NextResponse.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
