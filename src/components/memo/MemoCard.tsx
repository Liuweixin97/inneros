'use client';

import { useMemo, useCallback, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { Memo } from '@/types';
import { CATEGORY_ICONS } from '@/types';
import EmotionBadge from '@/components/ui/EmotionBadge';
import TagBadge from '@/components/ui/TagBadge';

interface MemoCardProps {
  memo: Memo;
  selected?: boolean;
  compact?: boolean;
  onClick?: (memo: Memo) => void;
  onAnalyze?: (memo: Memo) => void;
}

// Source labels
const SOURCE_LABELS: Record<Memo['source'], string> = {
  manual: '手动记录',
  flomo: 'Flomo 导入',
  markdown: 'Markdown',
  txt: '文本导入',
};

const SOURCE_COLORS: Record<Memo['source'], string> = {
  manual: 'var(--color-primary)',
  flomo: '#F59E0B',
  markdown: '#6366F1',
  txt: '#8B5CF6',
};

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month}月${day}日 ${hours}:${minutes}`;
  } catch {
    return dateStr;
  }
}

export default function MemoCard({
  memo,
  selected = false,
  compact = false,
  onClick,
  onAnalyze,
}: MemoCardProps) {
  const title = useMemo(() => {
    if (memo.ai_title) return memo.ai_title;
    const text = memo.plain_text || memo.raw_content;
    return text.length > 20 ? text.slice(0, 20) + '…' : text;
  }, [memo.ai_title, memo.plain_text, memo.raw_content]);

  const contentPreview = useMemo(() => {
    let text = memo.plain_text || memo.raw_content;

    if (/<\/?[a-z][\s\S]*>/i.test(memo.raw_content)) {
      text = memo.raw_content
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li)>/gi, '\n')
        .replace(/<li[^>]*>/gi, '• ')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>');
    }

    // Clean up Flomo imports' redundant headers/tags in the card preview
    if (memo.source === 'flomo') {
      // 1. Strip leading tags (e.g. #感受) at the very start
      text = text.replace(/^(#[^\s\n#]+[\s\n]*)+/, '');
      // 2. Strip the first bold title (e.g. **Title**) at the start
      text = text.replace(/^(\*\*[^*]+\*\*[\s\n]*)+/, '');
    }

    // Strip general markdown formatting characters for a clean preview
    text = text
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/~~([^~]+)~~/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (memo.ai_title) return text;
    return text.length > 20 ? text.slice(20).trim() : '';
  }, [memo.ai_title, memo.plain_text, memo.raw_content, memo.source]);

  const hasLongContent = useMemo(() => {
    if (!contentPreview) return false;
    return contentPreview.length > 120 || contentPreview.includes('\n');
  }, [contentPreview]);

  const [expanded, setExpanded] = useState(false);

  const handleClick = useCallback(() => {
    onClick?.(memo);
  }, [onClick, memo]);

  const handleAnalyze = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onAnalyze?.(memo);
  }, [onAnalyze, memo]);

  return (
    <div
      className={`
        card card-accent group relative
        ${compact ? 'p-3' : 'p-4'}
        cursor-pointer
        ${selected ? 'active card-selected' : ''}
      `}
      onClick={handleClick}
      style={{
        transition: 'all var(--transition-normal)',
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
    >
      {/* Top: Date + Source badge */}
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-[12px]"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {formatDate(memo.created_at)}
        </span>
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
          style={{
            color: SOURCE_COLORS[memo.source],
            backgroundColor: `color-mix(in srgb, ${SOURCE_COLORS[memo.source]} 10%, transparent)`,
          }}
        >
          {SOURCE_LABELS[memo.source]}
        </span>
      </div>

      {/* Title */}
      <h3
        className={`font-semibold leading-snug mb-1.5 ${compact ? 'text-[14px]' : 'text-[15px]'}`}
        style={{ color: 'var(--color-text-strong)' }}
      >
        {title}
      </h3>

      {/* Content preview */}
      {contentPreview && (
        <div className="relative">
          <p
            className={`
              whitespace-pre-wrap text-[13px] leading-relaxed mb-2
              ${expanded ? '' : (compact ? 'line-clamp-2' : 'line-clamp-4')}
            `}
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {contentPreview}
          </p>
          {hasLongContent && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="text-xs font-medium text-[var(--color-primary-dark)] hover:text-[var(--color-primary)] mb-2.5 transition-colors inline-block"
              type="button"
            >
              {expanded ? '收起' : '展开全文'}
            </button>
          )}
        </div>
      )}

      {/* Tags */}
      {memo.original_tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {memo.original_tags.slice(0, compact ? 3 : 5).map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
          {memo.original_tags.length > (compact ? 3 : 5) && (
            <span
              className="text-[11px] px-1.5 py-0.5 rounded-full"
              style={{ color: 'var(--color-text-muted)' }}
            >
              +{memo.original_tags.length - (compact ? 3 : 5)}
            </span>
          )}
        </div>
      )}

      {/* Bottom: Emotions + Category + Actions */}
      {!compact && (
        <div className="flex items-center justify-between pt-1.5 border-t" style={{ borderColor: 'var(--color-border-light)' }}>
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {/* Emotions */}
            {memo.ai_emotions.slice(0, 2).map((emotion) => (
              <EmotionBadge key={emotion} emotion={emotion} size="sm" />
            ))}
            {/* Category */}
            {memo.ai_category && (
              <span
                className="text-[11px] px-1.5 py-0.5 rounded-full font-medium"
                style={{
                  color: 'var(--color-text-secondary)',
                  backgroundColor: 'var(--color-bg-secondary)',
                }}
              >
                {CATEGORY_ICONS[memo.ai_category]} {memo.ai_category}
              </span>
            )}
          </div>

          {onAnalyze && (
            <div
              className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
              style={{ transitionDuration: 'var(--transition-fast)' }}
            >
              <button
                type="button"
                className="btn-ghost gap-1 px-2 py-1 text-[12px]"
                onClick={handleAnalyze}
                disabled={memo.analysis_status === 'analyzing'}
                title={memo.analysis_status === 'done' ? '重新整理这条记录' : '整理这条记录'}
              >
                <RefreshCw size={13} className={memo.analysis_status === 'analyzing' ? 'animate-spin' : ''} />
                {memo.analysis_status === 'done' ? '重整' : '整理'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
