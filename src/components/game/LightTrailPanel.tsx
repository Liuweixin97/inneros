'use client';

import { useMemo, useState } from 'react';
import { Lamp, MoveHorizontal, X } from 'lucide-react';
import type { Memo } from '@/types';

interface LightTrailPanelProps {
  memos: Memo[];
  suggested?: boolean;
  onConfirm: (name: string, memoIds: string[]) => void;
  onClose: () => void;
}

export default function LightTrailPanel({ memos, suggested = false, onConfirm, onClose }: LightTrailPanelProps) {
  const [decision, setDecision] = useState<'pending' | 'related' | 'unrelated'>('pending');
  const [name, setName] = useState('');
  const trailMemos = useMemo(() => chooseTrailMemos(memos), [memos]);
  const connection = useMemo(() => findConnection(trailMemos), [trailMemos]);

  if (trailMemos.length < 2) {
    return (
      <div className="game-focus-layer game-focus-layer--trail game-focus-layer--soft" role="dialog" aria-label="循光寻迹">
        <section className="light-trail-panel">
          <header>
            <div>
              <p className="game-kicker">苔灯 · 照见</p>
              <h2>光路还没有形成</h2>
            </div>
            <button type="button" className="game-icon-button" onClick={onClose} aria-label="离开光路">
              <X size={17} />
            </button>
          </header>
          <div className="light-trail-empty">
            <Lamp size={22} />
            <p>还需要至少两段普通记录。这里不会凭空生成关系。</p>
            <button type="button" className="light-trail-primary" onClick={onClose}>回到花园</button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="game-focus-layer game-focus-layer--trail game-focus-layer--soft" role="dialog" aria-label="循光寻迹">
      <section className="light-trail-panel">
        <header>
          <div>
            <p className="game-kicker">苔灯 · 照见</p>
            <h2>{suggested ? '苔灯带来一组可能有关的纸条' : '看看行囊里的纸条是否同路'}</h2>
          </div>
          <button type="button" className="game-icon-button" onClick={onClose} aria-label="离开光路">
            <X size={17} />
          </button>
        </header>

        <p className="light-trail-claim">{connection}</p>

        <div className={`light-trail-board ${decision === 'unrelated' ? 'is-separated' : ''}`}>
          {trailMemos.map((memo, index) => (
            <article key={memo.id} style={{ transform: `rotate(${[-1.5, 1.2, -0.6][index] ?? 0}deg)` }}>
              <small>{memo.ai_title || `纸条 ${index + 1}`}</small>
              <blockquote>
                {memo.plain_text.replace(/\s+/g, ' ').slice(0, 130) || '这段记忆没有留下文字'}
              </blockquote>
            </article>
          ))}
          <span aria-hidden="true"><MoveHorizontal size={18} /></span>
        </div>

        {decision === 'pending' && (
          <div className="light-trail-question">
            <h3>你觉得它们像同一条路吗？</h3>
            <p>苔灯只有提议权。真正有关，必须由你确认。</p>
            <div>
              <button type="button" onClick={() => setDecision('related')}>放在一起</button>
              <button type="button" onClick={() => setDecision('unrelated')}>分开放回去</button>
            </div>
          </div>
        )}

        {decision === 'related' && (
          <div className="light-trail-name">
            <p>给这条路一个你下次还能认出的名字。</p>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：身体先知道、迟迟没拆小的事" />
            <button type="button" className="light-trail-primary" onClick={() => onConfirm(name.trim() || '尚未命名的小径', trailMemos.map((memo) => memo.id))}>
              把这条路留下
            </button>
          </div>
        )}

        {decision === 'unrelated' && (
          <div className="light-trail-name">
            <p>已分开放回去。高频、相似或同一天出现，不等于真正有关。</p>
            <button type="button" className="light-trail-primary" onClick={onClose}>让光路散开</button>
          </div>
        )}
      </section>
    </div>
  );
}

function chooseTrailMemos(memos: Memo[]): Memo[] {
  if (memos.length <= 3) return memos;
  const scored = memos.map((memo, index) => ({
    memo,
    score: (memo.ai_summary ? 3 : 0)
      + (memo.ai_topics?.length ?? 0) * 2
      + (memo.ai_emotions?.length ?? 0)
      + Math.max(0, 3 - index),
  }));
  return scored.sort((a, b) => b.score - a.score).slice(0, 3).map((item) => item.memo);
}

function findConnection(memos: Memo[]): string {
  const tokens = new Map<string, number>();
  memos.forEach((memo) => {
    [...memo.original_tags, ...(memo.ai_topics ?? []), ...(memo.ai_people ?? []), ...(memo.ai_projects ?? [])].forEach((token) => {
      const normalized = token.trim();
      if (normalized) tokens.set(normalized, (tokens.get(normalized) ?? 0) + 1);
    });
  });
  const shared = [...tokens.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  if (shared) return `我注意到这几段都碰到「${shared}」。这只是线索，不是结论。`;
  const summaries = memos.map((memo) => memo.ai_summary).filter(Boolean);
  if (summaries.length >= 2) return '它们的语义不完全一样，但都像是在描述同一段近期状态。';
  return '它们被你同时带到这里。除此之外，我还不能确定什么。';
}
