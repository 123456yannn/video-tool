'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Upload, Film, X, FileVideo, AlertCircle } from 'lucide-react';
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
  const [error, setError] = useState<string | null>(null);
  const [duplicateDialog, setDuplicateDialog] = useState<{
    show: boolean;
    duplicates: File[];
    newFiles: File[];
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const addFiles = useCallback((newFiles: File[]) => {
    setError(null);
    setFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      const duplicates = newFiles.filter((f) => existingNames.has(f.name));
      const fresh = newFiles.filter((f) => !existingNames.has(f.name));

      if (duplicates.length > 0) {
        setDuplicateDialog({ show: true, duplicates, newFiles: fresh });
        return [...prev, ...fresh];
      }
      return [...prev, ...newFiles];
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFiles = Array.from(e.dataTransfer.files).filter(
        (f) =>
          ['video/mp4', 'video/quicktime', 'video/mov', 'video/x-msvideo'].includes(f.type) ||
          f.name.match(/\.(mp4|mov|avi)$/i)
      );
      addFiles(droppedFiles);
    },
    [addFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        const selected = Array.from(e.target.files);
        addFiles(selected);
      }
      // Reset input value to allow re-selecting the same file
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    [addFiles]
  );

  const handleDuplicateConfirm = useCallback(
    (replace: boolean) => {
      if (!duplicateDialog) return;
      if (replace) {
        // Replace duplicates: remove old ones with same name, add new ones
        const duplicateNames = new Set(duplicateDialog.duplicates.map((f) => f.name));
        setFiles((prev) => [
          ...prev.filter((f) => !duplicateNames.has(f.name)),
          ...duplicateDialog.duplicates,
        ]);
      }
      // If not replacing, just keep the existing files (duplicates are skipped)
      setDuplicateDialog(null);
    },
    [duplicateDialog]
  );

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpload = useCallback(async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      for (const file of files) {
        formData.append('videos', file);
      }

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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Upload error:', err);
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
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
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
              inputRef.current?.click();
            }}
          >
            选择文件
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="w-full flex items-center gap-3 p-3 rounded-lg bg-red-950/50 border border-red-800/50">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-300 flex-1">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Duplicate Dialog */}
      {duplicateDialog?.show && (
        <div className="w-full p-4 rounded-lg bg-amber-950/50 border border-amber-800/50">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-amber-200 font-medium">
                发现同名文件
              </p>
              <p className="text-xs text-amber-400/80 mt-1">
                以下文件已存在于上传列表中：
                {duplicateDialog.duplicates.map((f) => f.name).join('、')}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-700 text-amber-300 hover:bg-amber-900/50 text-xs"
                  onClick={() => handleDuplicateConfirm(true)}
                >
                  替换并继续
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-amber-400 hover:bg-amber-900/30 text-xs"
                  onClick={() => handleDuplicateConfirm(false)}
                >
                  跳过重复
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/80 border border-zinc-800"
              >
                <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center shrink-0">
                  <FileVideo className="w-4 h-4 text-zinc-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200 font-mono truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {formatSize(file.size)}
                  </p>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Upload Button */}
          <Button
            onClick={handleUpload}
            disabled={isUploading || files.length === 0}
            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white h-11"
          >
            {isUploading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                上传中 {uploadProgress}%
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4" />
                上传并开始处理
              </div>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
