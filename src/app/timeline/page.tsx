'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock } from 'lucide-react';
import MemoCard from '@/components/memo/MemoCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useAppStore } from '@/lib/store/app';
import type { Memo } from '@/types';

type GroupBy = 'month' | 'week';

function keyFor(date: Date, groupBy: GroupBy) {
  if (groupBy === 'month') return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  return start.toISOString().slice(0, 10);
}

function labelFor(key: string, groupBy: GroupBy) {
  if (groupBy === 'month') {
    const [year, month] = key.split('-');
    return `${year}年${Number(month)}月`;
  }
  return `始于 ${key}`;
}

export default function TimelinePage() {
  const { setSelectedMemo } = useAppStore();
  const [memos, setMemos] = useState<Memo[]>([]);
  const [groupBy, setGroupBy] = useState<GroupBy>('month');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/memos?limit=200').then((response) => response.json()).then((data) => setMemos(data.memos ?? [])).finally(() => setLoading(false));
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, Memo[]>();
    memos.forEach((memo) => {
      const key = keyFor(new Date(memo.created_at), groupBy);
      map.set(key, [...(map.get(key) ?? []), memo]);
    });
    return [...map.entries()].map(([key, items]) => ({ key, items })).sort((a, b) => b.key.localeCompare(a.key));
  }, [memos, groupBy]);

  return (
    <div className="min-h-full px-5 py-6 md:px-8 md:py-8 animate-fade-in">
      <div className="mx-auto max-w-[980px]">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div><h1 className="text-2xl font-semibold text-[var(--color-text-strong)]">时间线</h1><p className="mt-1 text-sm text-[var(--color-text-secondary)]">沿着时间，看看自己经历了什么、改变了什么。</p></div>
          <div className="rounded-xl bg-[var(--color-bg-secondary)] p-1">{(['month', 'week'] as GroupBy[]).map((item) => <button key={item} type="button" onClick={() => setGroupBy(item)} className={`rounded-lg px-3 py-1.5 text-sm ${groupBy === item ? 'bg-[var(--color-bg-card)] text-[var(--color-primary-dark)] shadow-sm' : 'text-[var(--color-text-secondary)]'}`}>{item === 'month' ? '月' : '周'}</button>)}</div>
        </header>
        {loading ? <div className="py-20"><LoadingSpinner text="加载时间线" /></div> : groups.length === 0 ? <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-card)] py-16 text-center"><Clock className="mx-auto mb-3 h-8 w-8 text-[var(--color-text-muted)]" /><p className="font-medium">暂无时间线</p></div> : <div className="space-y-8">{groups.map((group) => <section key={group.key} className="grid gap-4 md:grid-cols-[180px_1fr]"><div className="sticky top-6 h-fit"><div className="flex items-center gap-2 text-lg font-semibold"><CalendarDays className="h-5 w-5 text-[var(--color-primary)]" />{labelFor(group.key, groupBy)}</div><p className="mt-1 text-sm text-[var(--color-text-muted)]">{group.items.length} 条记录</p></div><div className="grid gap-3 border-l border-[var(--color-border-light)] pl-5">{group.items.map((memo) => <MemoCard key={memo.id} memo={memo} onClick={setSelectedMemo} />)}</div></section>)}</div>}
      </div>
    </div>
  );
}
