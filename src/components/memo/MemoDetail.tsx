'use client';

import { Calendar, Edit3, MessageCircle, RefreshCw, Sparkles, Trash2, X, Loader2 } from 'lucide-react';
import type { Memo } from '@/types';
import { CATEGORY_ICONS } from '@/types';
import EmotionBadge from '@/components/ui/EmotionBadge';
import TagBadge from '@/components/ui/TagBadge';
import MarkdownContent from '@/components/ui/MarkdownContent';

interface MemoDetailProps {
  memo: Memo;
  onClose: () => void;
  onEdit?: (memo: Memo) => void;
  onAskAI?: (memo: Memo) => void;
  onAnalyze?: (memo: Memo) => void | Promise<void>;
  onDelete?: (memo: Memo) => void | Promise<void>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function MemoDetail({ memo, onClose, onEdit, onAskAI, onAnalyze, onDelete }: MemoDetailProps) {
  const isAnalyzing = memo.analysis_status === 'analyzing';
  const statusLabel = {
    pending: '待整理',
    analyzing: '整理中',
    done: '已整理',
    failed: '整理失败',
  }[memo.analysis_status];

  return (
    <section className="flex max-h-[88vh] w-[min(960px,calc(100vw-32px))] flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-xl animate-scale-in">
      <header className="flex items-start justify-between gap-4 border-b border-[var(--color-border-light)] px-5 py-4">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <span>笔记详情</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary-light)] px-2 py-0.5 text-[var(--color-primary-dark)]">
              {isAnalyzing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              {statusLabel}
            </span>
          </div>
          <h2 className="line-clamp-2 text-lg font-semibold leading-snug text-[var(--color-text-strong)]">{memo.ai_title || '未命名记录'}</h2>
        </div>
        <button type="button" className="btn-ghost p-2" onClick={onClose} aria-label="关闭详情">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[minmax(0,1fr)_320px]">
        <main className="min-w-0 px-5 py-5">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(memo.created_at)}
            {memo.ai_category && <span className="rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5">{CATEGORY_ICONS[memo.ai_category]} {memo.ai_category}</span>}
          </div>

          <article className="rounded-2xl bg-[var(--color-bg-secondary)] p-4 md:p-5">
            <MarkdownContent content={memo.raw_content || memo.plain_text} />
          </article>

          {memo.ai_summary && <section className="mt-5"><h3 className="mb-2 text-sm font-semibold">内容摘要</h3><MarkdownContent content={memo.ai_summary} className="text-[var(--color-text-secondary)]" /></section>}
          {memo.ai_actions.length > 0 && <section className="mt-5"><h3 className="mb-2 text-sm font-semibold">下一步</h3><ul className="space-y-2">{memo.ai_actions.map((item) => <li key={item} className="rounded-xl border border-[var(--color-border-light)] px-3 py-2"><MarkdownContent content={item} className="text-sm text-[var(--color-text-secondary)]" /></li>)}</ul></section>}
          {memo.ai_key_questions.length > 0 && <section className="mt-5"><h3 className="mb-2 text-sm font-semibold">继续想想</h3><ul className="space-y-2">{memo.ai_key_questions.map((item) => <li key={item} className="rounded-xl border border-[var(--color-border-light)] px-3 py-2"><MarkdownContent content={item} className="text-sm text-[var(--color-text-secondary)]" /></li>)}</ul></section>}
        </main>

        <aside className="space-y-5 border-t border-[var(--color-border-light)] bg-[var(--color-bg-sidebar)] px-5 py-5 md:border-l md:border-t-0">
          <section className="rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-bg-card)] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-text-strong)]">
              {isAnalyzing ? (
                <Loader2 className="h-4 w-4 text-[var(--color-primary)] animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
              )}
              智能整理
            </div>
            <p className="text-sm text-[var(--color-text-secondary)]">{statusLabel}</p>
            <div className="mt-4 grid gap-2">
              <button className="btn-primary w-full justify-center text-sm" type="button" onClick={() => onAskAI?.(memo)}><MessageCircle className="h-4 w-4" />聊聊这条记录</button>
              <button className="btn-secondary w-full justify-center text-sm" type="button" disabled={isAnalyzing} onClick={() => onAnalyze?.(memo)}><RefreshCw className={`h-4 w-4 ${isAnalyzing ? 'animate-spin' : ''}`} />{memo.analysis_status === 'done' ? '重新整理' : '整理记录'}</button>
            </div>
          </section>

          {memo.original_tags.length > 0 && <section><h3 className="mb-2 text-sm font-semibold">我的原始标签</h3><div className="flex flex-wrap gap-2">{memo.original_tags.map((tag) => <TagBadge key={tag} tag={tag} />)}</div></section>}
          {memo.ai_topics.length > 0 && <section><h3 className="mb-2 text-sm font-semibold">相关主题</h3><div className="flex flex-wrap gap-2">{memo.ai_topics.map((topic) => <span key={topic} className="rounded-full bg-[var(--color-primary-light)] px-2.5 py-1 text-xs font-medium text-[var(--color-primary-dark)]">{topic}</span>)}</div></section>}
          {memo.ai_emotions.length > 0 && <section><h3 className="mb-2 text-sm font-semibold">记录里的感受</h3><div className="flex flex-wrap gap-2">{memo.ai_emotions.map((emotion) => <EmotionBadge key={emotion} emotion={emotion} size="md" />)}</div></section>}
          {!memo.ai_summary && memo.analysis_status !== 'done' && (
            <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 text-sm leading-6 text-[var(--color-text-muted)]">
              整理后，这里会出现摘要、主题和可以继续思考的问题。
            </div>
          )}
        </aside>
      </div>

      <footer className="flex flex-col gap-3 border-t border-[var(--color-border-light)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <span />
        <div className="flex flex-wrap gap-2">
          {onEdit && <button className="btn-secondary text-sm" type="button" onClick={() => onEdit(memo)}><Edit3 className="h-4 w-4" />编辑</button>}
          <button className="btn-ghost text-sm text-[var(--color-danger-text)]" type="button" onClick={() => onDelete?.(memo)}><Trash2 className="h-4 w-4" />删除</button>
          <button className="btn-secondary text-sm" type="button" onClick={onClose}><X className="h-4 w-4" />关闭</button>
        </div>
      </footer>
    </section>
  );
}
