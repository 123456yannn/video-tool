'use client';

import React, { useState, useCallback } from 'react';
import { Upload, Settings, Eye, FolderOpen, Film } from 'lucide-react';
import { UploadView } from '@/components/upload-view';
import { ProcessingView } from '@/components/processing-view';
import { PreviewView } from '@/components/preview-view';
import { LibraryView } from '@/components/library-view';
import { cn } from '@/lib/utils';

type AppView = 'upload' | 'processing' | 'preview' | 'library';

const NAV_ITEMS: { key: AppView; label: string; icon: React.ElementType }[] = [
  { key: 'upload', label: '上传', icon: Upload },
  { key: 'processing', label: '处理', icon: Settings },
  { key: 'preview', label: '预览', icon: Eye },
  { key: 'library', label: '素材库', icon: FolderOpen },
];

export default function Home() {
  const [currentView, setCurrentView] = useState<AppView>('upload');
  const [currentJobIds, setCurrentJobIds] = useState<string[]>([]);
  const [hasJobs, setHasJobs] = useState(false);
  const [hasReadyJobs, setHasReadyJobs] = useState(false);

  const handleUploadComplete = useCallback((jobIds: string[]) => {
    setCurrentJobIds(jobIds);
    setHasJobs(true);
    setCurrentView('processing');
  }, []);

  const handleAnalysisComplete = useCallback((jobIds: string[]) => {
    setCurrentJobIds(jobIds);
    setHasReadyJobs(true);
    setCurrentView('preview');
  }, []);

  const handleConfirm = useCallback((_jobIds: string[]) => {
    setCurrentView('library');
  }, []);

  const handleReject = useCallback((jobIds: string[]) => {
    setCurrentJobIds(jobIds);
  }, []);

  const handleNavigate = useCallback((view: AppView) => {
    setCurrentView(view);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-cyan-600 flex items-center justify-center">
                <Film className="w-4.5 h-4.5 text-white" />
              </div>
              <span className="text-sm font-semibold text-zinc-200 tracking-tight">
                视频素材处理工具
              </span>
            </div>

            {/* Nav */}
            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.key;
                const isAccessible =
                  item.key === 'upload' ||
                  item.key === 'library' ||
                  (item.key === 'processing' && hasJobs) ||
                  (item.key === 'preview' && (hasReadyJobs || hasJobs));

                return (
                  <button
                    key={item.key}
                    onClick={() => isAccessible && handleNavigate(item.key)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all',
                      isActive
                        ? 'bg-zinc-800 text-cyan-400'
                        : isAccessible
                          ? 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                          : 'text-zinc-700 cursor-not-allowed'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        {currentView === 'upload' && (
          <UploadView onUploadComplete={handleUploadComplete} />
        )}
        {currentView === 'processing' && (
          <ProcessingView
            jobIds={currentJobIds}
            onAnalysisComplete={handleAnalysisComplete}
          />
        )}
        {currentView === 'preview' && (
          <PreviewView
            jobIds={currentJobIds}
            onConfirm={handleConfirm}
            onReject={handleReject}
          />
        )}
        {currentView === 'library' && <LibraryView />}
      </main>
    </div>
  );
}
