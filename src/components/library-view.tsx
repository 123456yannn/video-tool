'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  FolderOpen,
  Play,
  Filter,
  ArrowUpDown,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SHOT_TYPE_LABELS } from '@/lib/types';
import type { MaterialItem, ShotType } from '@/lib/types';
import { cn } from '@/lib/utils';

const CATEGORIES: { value: ShotType | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'product-closeup', label: '产品特写' },
  { value: 'environment', label: '环境空镜' },
  { value: 'human', label: '人物空镜' },
  { value: 'production-line', label: '生产线' },
  { value: 'dynamic-to-static', label: '动态转静态' },
];

export function LibraryView() {
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<ShotType | 'all'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchMaterials = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeCategory !== 'all') {
        params.set('category', activeCategory);
      }
      const res = await fetch(`/api/library?${params}`);
      if (res.ok) {
        const data: MaterialItem[] = await res.json();
        setMaterials(data);
      }
    } catch (error) {
      console.error('Library fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [activeCategory]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  const sortedMaterials = [...materials].sort((a, b) => {
    const cmp = a.fileName.localeCompare(b.fileName);
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  const groupedMaterials = sortedMaterials.reduce(
    (groups, item) => {
      const label = item.shotTypeLabel;
      if (!groups[label]) groups[label] = [];
      groups[label].push(item);
      return groups;
    },
    {} as Record<string, MaterialItem[]>
  );

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-zinc-200">素材库</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            共 {materials.length} 个素材片段
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-zinc-700 text-zinc-400 hover:bg-zinc-800"
            onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
          >
            <ArrowUpDown className="w-3.5 h-3.5 mr-1.5" />
            {sortOrder === 'asc' ? '升序' : '降序'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-zinc-700 text-zinc-400 hover:bg-zinc-800"
            onClick={fetchMaterials}
          >
            <RefreshCw
              className={cn('w-3.5 h-3.5 mr-1.5', isLoading && 'animate-spin')}
            />
            刷新
          </Button>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        <Filter className="w-4 h-4 text-zinc-500 shrink-0" />
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setActiveCategory(cat.value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap',
              activeCategory === cat.value
                ? 'bg-cyan-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : materials.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
          <FolderOpen className="w-12 h-12 mb-3" />
          <p className="text-sm">素材库为空</p>
          <p className="text-xs text-zinc-700 mt-1">
            上传并处理视频后，素材将自动分类存储于此
          </p>
        </div>
      ) : activeCategory === 'all' ? (
        // Grouped view
        <div className="space-y-6">
          {Object.entries(groupedMaterials).map(([label, items]) => (
            <div key={label}>
              <h3 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-500" />
                {label}
                <span className="text-zinc-600">({items.length})</span>
              </h3>
              <div className="space-y-1">
                {items.map((item) => (
                  <MaterialRow
                    key={item.id}
                    item={item}
                    isPlaying={playingVideo === item.id}
                    onPlay={() =>
                      setPlayingVideo(
                        playingVideo === item.id ? null : item.id
                      )
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Filtered view
        <div className="space-y-1">
          {sortedMaterials.map((item) => (
            <MaterialRow
              key={item.id}
              item={item}
              isPlaying={playingVideo === item.id}
              onPlay={() =>
                setPlayingVideo(playingVideo === item.id ? null : item.id)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MaterialRow({
  item,
  isPlaying,
  onPlay,
}: {
  item: MaterialItem;
  isPlaying: boolean;
  onPlay: () => void;
}) {
  return (
    <div className="group">
      <div
        className={cn(
          'flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer',
          isPlaying
            ? 'bg-zinc-800 border border-cyan-800/50'
            : 'hover:bg-zinc-900/80 border border-transparent'
        )}
        onClick={onPlay}
      >
        <div
          className={cn(
            'w-8 h-8 rounded flex items-center justify-center shrink-0 transition-colors',
            isPlaying ? 'bg-cyan-600' : 'bg-zinc-800 group-hover:bg-zinc-700'
          )}
        >
          <Play
            className={cn(
              'w-4 h-4',
              isPlaying ? 'text-white' : 'text-zinc-500'
            )}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-zinc-200 font-mono truncate">
            {item.fileName}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
              {item.shotTypeLabel}
            </span>
            <span className="text-xs text-zinc-600">
              {item.duration.toFixed(1)}s
            </span>
          </div>
        </div>
      </div>

      {/* Video Player */}
      {isPlaying && (
        <div className="mt-2 ml-11 rounded-lg overflow-hidden bg-black">
          <video
            src={item.filePath}
            className="w-full max-h-80"
            controls
            autoPlay
            muted
          />
        </div>
      )}
    </div>
  );
}
