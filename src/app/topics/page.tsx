'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Hash, Search, RefreshCw } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import type { Topic } from '@/types';

function formatDate(value: string) {
  if (!value) return '暂无';
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(new Date(value));
}

const STATUS_LABEL: Record<Topic['status'], string> = {
  active: '最近活跃',
  dormant: '暂时沉静',
  resolved: '已有答案',
};

export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setError('');
    fetch('/api/topics', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('主题加载失败');
        return response.json() as Promise<Topic[]>;
      })
      .then(setTopics)
      .catch((loadError) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : '主题加载失败');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError('');
    try {
      const response = await fetch('/api/topics', { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '主题更新失败');
      if (data.topics) {
        setTopics(data.topics);
      }
    } catch (analyzeError) {
      setError(analyzeError instanceof Error ? analyzeError.message : '主题更新失败');
    } finally {
      setAnalyzing(false);
    }
  };

  const filtered = useMemo(() => topics.filter((topic) => topic.name.toLowerCase().includes(query.toLowerCase())), [topics, query]);

  return (
    <div className="min-h-full px-5 py-6 md:px-8 md:py-8 animate-fade-in">
      <div className="mx-auto max-w-[1000px]">
        <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div><h1 className="text-2xl font-semibold text-[var(--color-text-strong)]">主题</h1><p className="mt-1 text-sm text-[var(--color-text-secondary)]">看看自己长期在意什么，以及想法如何变化。</p></div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="btn-primary py-2.5 px-4 rounded-xl text-sm justify-center"
              type="button"
            >
              <RefreshCw className={`h-4 w-4 ${analyzing ? 'animate-spin' : ''}`} />
              {analyzing ? '整理中...' : '更新主题'}
            </button>
            <label className="relative w-full md:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" /><input className="input-base pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索主题" /></label>
          </div>
        </header>

        {error && <div className="mb-5 rounded-xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-3 text-sm text-[var(--color-danger-text)]" role="alert">{error}</div>}

        {loading ? <div className="py-20"><LoadingSpinner text="加载主题" /></div> : filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-card)] py-16 text-center"><Hash className="mx-auto mb-3 h-8 w-8 text-[var(--color-text-muted)]" /><p className="font-medium">还没有形成主题</p><p className="text-sm text-[var(--color-text-muted)]">继续记录，反复出现的关注点会慢慢聚在一起。</p></div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{filtered.map((topic) => <Link href={`/topics/${topic.id}`} key={topic.id} className="card p-5"><div className="mb-4 flex items-center justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]"><Hash className="h-5 w-5" /></div><span className="rounded-full bg-[var(--color-bg-secondary)] px-2 py-1 text-xs text-[var(--color-text-muted)]">{STATUS_LABEL[topic.status]}</span></div><h2 className="text-lg font-semibold text-[var(--color-text-strong)]">{topic.name}</h2><p className="mt-2 line-clamp-3 text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-line">{topic.summary || topic.description || '继续记录后，这里会出现更多线索。'}</p><div className="mt-5 flex items-center justify-between text-xs text-[var(--color-text-muted)]"><span>{topic.memo_count} 条记录</span><span>{formatDate(topic.first_seen_at)} - {formatDate(topic.last_seen_at)}</span></div></Link>)}</div>}
      </div>
    </div>
  );
}
