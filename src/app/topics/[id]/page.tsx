'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Hash, Trash2 } from 'lucide-react';
import MemoCard from '@/components/memo/MemoCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import MarkdownContent from '@/components/ui/MarkdownContent';
import { useAppStore } from '@/lib/store/app';
import type { Memo, Topic } from '@/types';

const STATUS_LABEL: Record<Topic['status'], string> = {
  active: '最近仍在关注',
  dormant: '最近较少提到',
  resolved: '已有阶段性答案',
};

export default function TopicDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { setSelectedMemo } = useAppStore();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/topics/${params.id}`).then(async (response) => {
      if (!response.ok) throw new Error('not found');
      return response.json();
    }).then((data) => { setTopic(data.topic); setMemos(data.memos); }).catch(() => router.push('/insights?tab=topics')).finally(() => setLoading(false));
  }, [params.id, router]);

  const remove = async () => {
    if (!window.confirm('确定删除这个主题吗？笔记本身不会被删除。')) return;
    const response = await fetch(`/api/topics/${params.id}`, { method: 'DELETE' });
    if (response.ok) router.push('/insights?tab=topics');
  };

  if (loading) return <div className="py-24"><LoadingSpinner text="加载主题" /></div>;
  if (!topic) return null;

  return (
    <div className="min-h-full px-5 py-6 md:px-8 md:py-8 animate-fade-in">
      <div className="mx-auto max-w-[980px]">
        <Link href="/insights?tab=topics" className="mb-5 inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary-dark)]"><ArrowLeft className="h-4 w-4" />返回认识</Link>
        <header className="mb-8 rounded-3xl border border-[var(--color-border-light)] bg-[var(--color-bg-card)] p-6">
          <div className="mb-4 flex items-start justify-between gap-4"><div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]"><Hash className="h-6 w-6" /></span><div><p className="text-sm text-[var(--color-text-muted)]">持续关注</p><h1 className="text-2xl font-semibold text-[var(--color-text-strong)]">{topic.name}</h1></div></div><button className="btn-ghost text-[var(--color-danger-text)]" type="button" onClick={remove}><Trash2 className="h-4 w-4" />删除</button></div>
          <div className="max-w-3xl text-sm leading-relaxed text-[var(--color-text-secondary)]">
            <MarkdownContent content={topic.summary || topic.description || '暂无主题摘要。'} />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-[var(--color-bg-secondary)] p-4"><p className="text-xs text-[var(--color-text-muted)]">相关记录</p><p className="text-xl font-semibold">{topic.memo_count}</p></div><div className="rounded-2xl bg-[var(--color-bg-secondary)] p-4"><p className="text-xs text-[var(--color-text-muted)]">近况</p><p className="text-base font-semibold">{STATUS_LABEL[topic.status]}</p></div><div className="rounded-2xl bg-[var(--color-bg-secondary)] p-4"><p className="text-xs text-[var(--color-text-muted)]">待继续的问题</p><p className="text-xl font-semibold">{topic.key_questions.length}</p></div></div>
        </header>
        <section className="grid gap-3 md:grid-cols-2">{memos.map((memo) => <MemoCard key={memo.id} memo={memo} onClick={setSelectedMemo} />)}</section>
      </div>
    </div>
  );
}
