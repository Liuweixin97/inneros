'use client';

import { Search, X } from 'lucide-react';
import type { EmotionType, MemoCategory, MemoFilters as MemoFiltersType } from '@/types';

interface MemoFiltersProps {
  filters: MemoFiltersType;
  onFilterChange: (filters: MemoFiltersType) => void;
  availableTags?: string[];
}

const CATEGORIES: MemoCategory[] = ['方法论', '感受', '观察', '项目', '日记', '摘录', '任务', '资料'];
const EMOTIONS: EmotionType[] = ['平静', '有力量', '焦虑', '低落', '迷茫', '被认可', '愤怒', '喜悦'];

export default function MemoFilters({ filters, onFilterChange, availableTags = [] }: MemoFiltersProps) {
  const update = (patch: Partial<MemoFiltersType>) => onFilterChange({ ...filters, ...patch, offset: 0 });
  const hasActive = Boolean(filters.query || filters.category || filters.emotion || filters.tag || filters.dateFrom || filters.dateTo);

  return (
    <div className="rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-bg-card)] p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            value={filters.query ?? ''}
            onChange={(event) => update({ query: event.target.value || undefined })}
            placeholder="搜索内容、标题或原文"
            className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-input)] pl-9 pr-3 text-sm outline-none transition focus:border-[var(--color-primary)]"
          />
        </label>
        <select className="h-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 text-sm" value={filters.category ?? ''} onChange={(event) => update({ category: (event.target.value || undefined) as MemoCategory | undefined })}>
          <option value="">全部分类</option>
          {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
        <select className="h-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 text-sm" value={filters.emotion ?? ''} onChange={(event) => update({ emotion: (event.target.value || undefined) as EmotionType | undefined })}>
          <option value="">全部情绪</option>
          {EMOTIONS.map((emotion) => <option key={emotion} value={emotion}>{emotion}</option>)}
        </select>
        {hasActive && (
          <button className="btn-ghost h-10 px-3 text-sm" type="button" onClick={() => onFilterChange({})}>
            <X className="h-4 w-4" />
            清除
          </button>
        )}
      </div>

      {availableTags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {availableTags.slice(0, 16).map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => update({ tag: filters.tag === tag ? undefined : tag })}
              className={`rounded-full border px-2.5 py-1 text-xs transition ${filters.tag === tag ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]' : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]'}`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
