'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Loader2, Plus, RefreshCw } from 'lucide-react';
import MemoCard from '@/components/memo/MemoCard';
import MemoEditor from '@/components/memo/MemoEditor';
import MemoFilters from '@/components/memo/MemoFilters';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useAppStore } from '@/lib/store/app';
import type { Memo, MemoFilters as MemoFiltersType } from '@/types';

const PAGE_SIZE = 20;

interface MemosResponse {
  memos: Memo[];
  total: number;
}

export default function RecordsPage() {
  const { memos, setMemos, selectedMemo, setSelectedMemo } = useAppStore();
  const [filters, setFilters] = useState<MemoFiltersType>({ limit: PAGE_SIZE, offset: 0 });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [error, setError] = useState('');

  const availableTags = useMemo(() => {
    const tags = new Map<string, number>();
    memos.forEach((memo) => memo.original_tags.forEach((tag) => tags.set(tag, (tags.get(tag) ?? 0) + 1)));
    return [...tags.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
  }, [memos]);

  const fetchMemos = useCallback(async (nextFilters: MemoFiltersType, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError('');
    const params = new URLSearchParams();
    Object.entries(nextFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
    });
    try {
      const response = await fetch(`/api/memos?${params.toString()}`);
      if (!response.ok) throw new Error('获取记录失败');
      const data = (await response.json()) as MemosResponse;
      setMemos(append ? [...memos, ...data.memos] : data.memos);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取记录失败');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [memos, setMemos]);

  useEffect(() => {
    fetchMemos(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    const memoId = new URLSearchParams(window.location.search).get('id');
    if (!memoId || selectedMemo?.id === memoId) return;

    const loadedMemo = memos.find((memo) => memo.id === memoId);
    if (loadedMemo) {
      setSelectedMemo(loadedMemo);
      return;
    }

    fetch(`/api/memos/${memoId}`)
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<Memo>;
      })
      .then((memo) => {
        if (memo) setSelectedMemo(memo);
      })
      .catch(() => undefined);
  }, [memos, selectedMemo?.id, setSelectedMemo]);

  const handleSave = async (content: string, tags: string[]) => {
    const response = await fetch('/api/memos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, tags, source: 'manual' }),
    });
    if (!response.ok) {
      setError('保存失败，请稍后重试');
      return;
    }
    const memo = (await response.json()) as Memo;
    setEditorOpen(false);
    setMemos([memo, ...memos]);
    setSelectedMemo(memo);
  };

  const handleAnalyze = async (memo: Memo) => {
    const analyzingMemo: Memo = { ...memo, analysis_status: 'analyzing' };
    setMemos(memos.map((item) => (item.id === memo.id ? analyzingMemo : item)));
    if (selectedMemo?.id === memo.id) setSelectedMemo(analyzingMemo);
    const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memo_id: memo.id }) });
    if (response.ok) {
      const data = await response.json();
      if (data.memo) {
        setMemos(memos.map((item) => (item.id === memo.id ? data.memo : item)));
        if (selectedMemo?.id === memo.id) setSelectedMemo(data.memo);
      }
      return;
    }
    const failedMemo: Memo = { ...memo, analysis_status: 'failed' };
    setMemos(memos.map((item) => (item.id === memo.id ? failedMemo : item)));
    if (selectedMemo?.id === memo.id) setSelectedMemo(failedMemo);
    const data = await response.json().catch(() => ({}));
    setError(data.error || '整理失败，请稍后再试');
  };

  const hasMore = memos.length < total;

  return (
    <div className="min-h-full px-5 py-6 md:px-8 md:py-8 animate-fade-in">
      <div className="mx-auto max-w-[980px]">
        <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--color-text-strong)]">记录</h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">找回写过的事，也找回当时的自己。</p>
          </div>
          <button className="btn-primary" type="button" onClick={() => setEditorOpen(true)}>
            <Plus className="h-4 w-4" />
            新记录
          </button>
        </header>

        <MemoFilters filters={filters} onFilterChange={(next) => setFilters({ ...next, limit: PAGE_SIZE, offset: 0 })} availableTags={availableTags} />

        {error && (
          <div className="mt-4 rounded-xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-3 text-sm text-[var(--color-danger-text)]">
            {error}
          </div>
        )}

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between text-sm text-[var(--color-text-muted)]">
            <span>{total} 条记录</span>
            <button className="btn-ghost px-2 py-1 text-xs" type="button" onClick={() => fetchMemos(filters)}>
              <RefreshCw className="h-3.5 w-3.5" />刷新
            </button>
          </div>

          {loading ? (
            <div className="py-20"><LoadingSpinner text="加载记录" /></div>
          ) : memos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-card)] py-16 text-center">
              <FileText className="mx-auto mb-3 h-8 w-8 text-[var(--color-text-muted)]" />
              <p className="font-medium text-[var(--color-text-strong)]">还没有记录</p>
              <p className="text-sm text-[var(--color-text-muted)]">写下第一条笔记后，这里会成为你的可检索记忆流。</p>
            </div>
          ) : (
            <>
              {/* Mobile Layout: single column */}
              <div className="flex flex-col gap-3 md:hidden">
                {memos.map((memo) => (
                  <MemoCard key={memo.id} memo={memo} selected={selectedMemo?.id === memo.id} onClick={setSelectedMemo} onAnalyze={handleAnalyze} />
                ))}
              </div>

              {/* Desktop Layout: 2 flex columns to achieve masonry layout */}
              <div className="hidden md:grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-3">
                  {memos
                    .filter((_, idx) => idx % 2 === 0)
                    .map((memo) => (
                      <MemoCard key={memo.id} memo={memo} selected={selectedMemo?.id === memo.id} onClick={setSelectedMemo} onAnalyze={handleAnalyze} />
                    ))}
                </div>
                <div className="flex flex-col gap-3">
                  {memos
                    .filter((_, idx) => idx % 2 === 1)
                    .map((memo) => (
                      <MemoCard key={memo.id} memo={memo} selected={selectedMemo?.id === memo.id} onClick={setSelectedMemo} onAnalyze={handleAnalyze} />
                    ))}
                </div>
              </div>
            </>
          )}

          {hasMore && !loading && (
            <div className="mt-6 flex justify-center">
              <button className="btn-secondary" type="button" disabled={loadingMore} onClick={() => {
                const next = { ...filters, limit: PAGE_SIZE, offset: memos.length };
                fetchMemos(next, true);
              }}>
                {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                加载更多
              </button>
            </div>
          )}
        </section>
      </div>
      <MemoEditor open={editorOpen} onClose={() => setEditorOpen(false)} onSave={handleSave} />
    </div>
  );
}
