'use client';

import React, { useCallback, useState } from 'react';
import { Upload, Film, X, FileVideo } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface UploadViewProps {
  onUploadComplete: (jobIds: string[]) => void;
}

export function UploadView({ onUploadComplete }: UploadViewProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter((f) =>
      ['video/mp4', 'video/quicktime', 'video/mov', 'video/x-msvideo'].includes(
        f.type
      ) || f.name.match(/\.(mp4|mov|avi)$/i)
    );
    setFiles((prev) => [...prev, ...droppedFiles]);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        const selected = Array.from(e.target.files);
        setFiles((prev) => [...prev, ...selected]);
      }
    },
    []
  );

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpload = useCallback(async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      for (const file of files) {
        formData.append('videos', file);
      }

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Upload failed (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      onUploadComplete(data.jobIds);
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  }, [files, onUploadComplete]);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-3xl mx-auto">
      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'w-full border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 cursor-pointer',
          isDragging
            ? 'border-cyan-500 bg-cyan-500/5'
            : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900/50'
        )}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept="video/mp4,video/quicktime,.mp4,.mov"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
            <Upload className="w-8 h-8 text-zinc-400" />
          </div>
          <div>
            <p className="text-lg font-medium text-zinc-200">
              拖放视频文件到此处
            </p>
            <p className="text-sm text-zinc-500 mt-1">
              支持 MP4、MOV 格式 | 支持批量上传
            </p>
            <p className="text-xs text-zinc-600 mt-2">
              适配器材：苹果手机 / 大疆无人机 / Pocket 3 / 专业相机（含Log素材）
            </p>
          </div>
          <Button
            variant="outline"
            className="mt-2 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            onClick={(e) => {
              e.stopPropagation();
              document.getElementById('file-input')?.click();
            }}
          >
            选择文件
          </Button>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="w-full space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-zinc-400">
              已选择 {files.length} 个文件
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="text-zinc-500 hover:text-zinc-300"
              onClick={() => setFiles([])}
            >
              清空
            </Button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center gap-3 p-3 bg-zinc-900/80 rounded-lg border border-zinc-800"
              >
                <FileVideo className="w-5 h-5 text-cyan-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {formatSize(file.size)}
                  </p>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="p-1 hover:bg-zinc-800 rounded transition-colors"
                >
                  <X className="w-4 h-4 text-zinc-500" />
                </button>
              </div>
            ))}
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-cyan-500 transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}

          {/* Upload Button */}
          <Button
            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white h-12 text-base"
            onClick={handleUpload}
            disabled={isUploading || files.length === 0}
          >
            {isUploading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                上传中...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Film className="w-4 h-4" />
                开始处理 ({files.length} 个视频)
              </span>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
