'use client';

import { X } from 'lucide-react';

interface TagBadgeProps {
  tag: string;
  removable?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  active?: boolean;
}

export default function TagBadge({ tag, removable, onClick, onRemove, active }: TagBadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-full text-[12px] font-medium
        transition-all cursor-default select-none
        ${active
          ? 'text-[var(--color-primary-dark)] border border-[var(--color-primary)]'
          : 'text-[var(--color-text-secondary)] border border-[var(--color-border)]'
        }
        ${onClick ? 'cursor-pointer hover:border-[var(--color-primary)] hover:text-[var(--color-primary-dark)]' : ''}
        ${removable ? 'pl-2 pr-1 py-0.5' : 'px-2 py-0.5'}
      `}
      style={{
        backgroundColor: active ? 'var(--color-primary-light)' : 'var(--color-bg-card)',
      }}
      onClick={onClick}
    >
      <span className="opacity-60">#</span>
      {tag}
      {removable && (
        <button
          type="button"
          className="
            ml-0.5 p-0.5 rounded-full
            text-[var(--color-text-muted)]
            hover:text-[var(--color-text-primary)]
            hover:bg-[var(--color-bg-hover)]
            transition-colors
          "
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          aria-label={`移除标签 ${tag}`}
        >
          <X size={10} strokeWidth={2.5} />
        </button>
      )}
    </span>
  );
}
