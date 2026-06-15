'use client';

import { useEffect, useState } from 'react';
import { Backpack, Flame, Leaf, X } from 'lucide-react';
import type { Memo } from '@/types';

interface BagHUDProps {
  memos: Memo[];
  memoIds: string[];
  onRemove: (memoId: string) => void;
  onOpenFireside: () => void;
}

export default function BagHUD({
  memos,
  memoIds,
  onRemove,
  onOpenFireside,
}: BagHUDProps) {
  const [open, setOpen] = useState(false);
  const carried = memoIds
    .map((id) => memos.find((memo) => memo.id === id))
    .filter((memo): memo is Memo => Boolean(memo));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'KeyQ' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const target = event.target as HTMLElement | null;
        if (target?.matches('input, textarea, [contenteditable="true"]')) return;
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className={`game-bag ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="game-bag__trigger"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Backpack size={17} />
        <span>行囊</span>
        <small>{memoIds.length}/3</small>
        <kbd>Q</kbd>
      </button>

      {open && (
        <div className="game-bag__panel">
          <header>
            <div>
              <strong>今天带在身上的</strong>
              <span>只是愿意同行一段，不代表它更重要。</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="收起行囊">
              <X size={15} />
            </button>
          </header>

          <div className="game-bag__slots">
            {[0, 1, 2].map((index) => {
              const memo = carried[index];
              return memo ? (
                <article key={memo.id}>
                  <span className="game-bag__slot-icon"><Leaf size={14} /></span>
                  <div>
                    <strong>{memo.ai_title || memo.plain_text.slice(0, 24) || '未命名记录'}</strong>
                    <small>{new Date(memo.created_at).toLocaleDateString('zh-CN')}</small>
                  </div>
                  <button type="button" onClick={() => onRemove(memo.id)}>放回</button>
                </article>
              ) : (
                <div key={index} className="game-bag__empty">
                  <span>{index + 1}</span>
                  <small>空着</small>
                </div>
              );
            })}
          </div>

          {carried.length > 0 && (
            <button
              type="button"
              className="game-bag__fireside"
              onClick={() => {
                setOpen(false);
                onOpenFireside();
              }}
            >
              <Flame size={15} />
              带到篝火边
            </button>
          )}
        </div>
      )}
    </div>
  );
}
