'use client';

import { useMemo, useState } from 'react';
import { Footprints, Lamp, X } from 'lucide-react';
import type { Memo } from '@/types';

interface LightTrailPanelProps {
  memos: Memo[];
  onConfirm: (name: string, memoIds: string[]) => void;
  onClose: () => void;
}

export default function LightTrailPanel({ memos, onConfirm, onClose }: LightTrailPanelProps) {
  const [step, setStep] = useState(0);
  const [decision, setDecision] = useState<'pending' | 'related' | 'unrelated'>('pending');
  const [name, setName] = useState('');
  const connection = useMemo(() => findConnection(memos), [memos]);

  return (
    <div className="game-focus-layer game-focus-layer--soft" role="dialog" aria-label="循光寻迹">
      <section className="light-trail-panel">
        <header>
          <div>
            <p className="game-kicker">苔灯 · 照见</p>
            <h2>循着一条很淡的光走走</h2>
          </div>
          <button type="button" className="game-icon-button" onClick={onClose} aria-label="离开光路">
            <X size={17} />
          </button>
        </header>

        <div className="light-trail-map" aria-hidden="true">
          {memos.map((memo, index) => (
            <div key={memo.id} className={`light-trail-node ${index <= step ? 'is-lit' : ''}`}>
              <span><Lamp size={15} /></span>
              {index < memos.length - 1 && <i />}
            </div>
          ))}
        </div>

        {decision === 'pending' && (
          <>
            <article className="light-trail-excerpt">
              <small>{step + 1} / {memos.length}</small>
              <blockquote>
                “{memos[step]?.plain_text.replace(/\s+/g, ' ').slice(0, 100) || '这段记忆没有留下文字'}”
              </blockquote>
            </article>

            {step < memos.length - 1 ? (
              <button type="button" className="light-trail-primary" onClick={() => setStep((value) => value + 1)}>
                <Footprints size={16} />
                沿着光再走一步
              </button>
            ) : (
              <div className="light-trail-question">
                <p>{connection}</p>
                <h3>你觉得它们像同一条路吗？</h3>
                <div>
                  <button type="button" onClick={() => setDecision('related')}>像同一条路</button>
                  <button type="button" onClick={() => setDecision('unrelated')}>我觉得无关</button>
                </div>
              </div>
            )}
          </>
        )}

        {decision === 'related' && (
          <div className="light-trail-name">
            <p>苔灯只有提议权。这条路叫什么，由你决定。</p>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="给这条小径起个名字，也可以暂不命名" />
            <button type="button" className="light-trail-primary" onClick={() => onConfirm(name.trim() || '尚未命名的小径', memos.map((memo) => memo.id))}>
              把这条路留下
            </button>
          </div>
        )}

        {decision === 'unrelated' && (
          <div className="light-trail-name">
            <p>你的判断会被保留。高频或相似，不等于真正有关。</p>
            <button type="button" className="light-trail-primary" onClick={onClose}>让光路散开</button>
          </div>
        )}
      </section>
    </div>
  );
}

function findConnection(memos: Memo[]): string {
  const tokens = new Map<string, number>();
  memos.forEach((memo) => {
    [...memo.original_tags, ...(memo.ai_topics ?? []), ...(memo.ai_people ?? [])].forEach((token) => {
      if (token.trim()) tokens.set(token, (tokens.get(token) ?? 0) + 1);
    });
  });
  const shared = [...tokens.entries()].sort((a, b) => b[1] - a[1]).find(([, count]) => count > 1)?.[0];
  return shared
    ? `我注意到，它们可能都和「${shared}」有关。这只是一个角度。`
    : '我注意到它们被你同时带在身上。除此之外，我还不能确定什么。';
}
