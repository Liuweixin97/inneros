'use client';

import { useEffect, useState } from 'react';
import { X, Calendar, FileText, Loader2, AlertCircle } from 'lucide-react';
import type { Memo } from '@/types';
import { useAppStore } from '@/lib/store/app';

interface EvidenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  evidenceMemoIds: string[];
  insightTitle: string;
}

export default function EvidenceDrawer({
  isOpen,
  onClose,
  evidenceMemoIds,
  insightTitle,
}: EvidenceDrawerProps) {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setSelectedMemo } = useAppStore();

  useEffect(() => {
    if (!isOpen || evidenceMemoIds.length === 0) {
      setMemos([]);
      return;
    }

    const fetchMemos = async () => {
      setLoading(true);
      setError('');
      try {
        const results = await Promise.all(
          evidenceMemoIds.map(async (id) => {
            const res = await fetch(`/api/memos/${id}`);
            if (!res.ok) throw new Error(`无法获取笔记 ${id}`);
            return res.json() as Promise<Memo>;
          })
        );
        setMemos(results);
      } catch (err) {
        console.error('Error fetching evidence memos:', err);
        setError('有些相关记录暂时无法打开');
      } finally {
        setLoading(false);
      }
    };

    fetchMemos();
  }, [isOpen, evidenceMemoIds]);

  if (!isOpen) return null;

  const handleMemoClick = (memo: Memo) => {
    setSelectedMemo(memo);
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/20 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[460px] bg-[var(--color-bg-sidebar)] border-l border-[var(--color-border-light)] flex flex-col shadow-2xl animate-slide-in"
      >
        {/* Header */}
        <header className="px-6 py-5 border-b border-[var(--color-border-light)] flex items-center justify-between bg-[var(--color-bg-card)]">
          <div>
            <h2 className="text-[16px] font-semibold text-[var(--color-text-strong)] leading-snug">
              相关记录
            </h2>
            <p className="text-[12px] text-[var(--color-text-muted)] truncate max-w-[320px] mt-0.5">
              关于「{insightTitle}」
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
            type="button"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
 
        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-[var(--color-text-secondary)]">
              <Loader2 className="h-7 w-7 animate-spin text-[var(--color-primary)] mb-3" />
              <p className="text-sm">正在加载相关记录...</p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] p-4 text-center text-sm text-[var(--color-danger-text)] flex flex-col items-center justify-center">
              <AlertCircle className="mb-2 h-6 w-6 text-[var(--color-danger-text)]" />
              <p>{error}</p>
            </div>
          ) : memos.length === 0 ? (
            <div className="text-center py-16 text-[var(--color-text-muted)]">
              <FileText className="mx-auto h-8 w-8 mb-3 opacity-60" />
              <p className="text-sm">没有找到相关记录</p>
            </div>
          ) : (
            <div className="space-y-3">
              {memos.map((memo) => (
                <article
                  key={memo.id}
                  onClick={() => handleMemoClick(memo)}
                  className="p-4 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-bg-card)] hover:border-[var(--color-primary)] hover:shadow-sm transition-all duration-200 cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-2 text-xs text-[var(--color-text-muted)]">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(memo.created_at)}
                    </span>
                    {memo.ai_category && (
                      <span className="px-1.5 py-0.5 rounded bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] font-medium scale-95">
                        {memo.ai_category}
                      </span>
                    )}
                  </div>

                  <h4 className="text-[14px] font-semibold text-[var(--color-text-strong)] group-hover:text-[var(--color-primary-dark)] transition-colors line-clamp-1 mb-1">
                    {memo.ai_title || memo.plain_text.slice(0, 20) || '未命名笔记'}
                  </h4>

                  <p className="text-[13px] text-[var(--color-text-secondary)] line-clamp-3 leading-relaxed">
                    {memo.plain_text}
                  </p>

                  {memo.original_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {memo.original_tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-[11px] text-[var(--color-primary-dark)] bg-[var(--color-primary-light)] px-2 py-0.5 rounded-full"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
