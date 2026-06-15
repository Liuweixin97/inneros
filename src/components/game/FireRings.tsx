'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Plus, X } from 'lucide-react';
import type { Memo } from '@/types';

type RingId = 'fact' | 'then' | 'now';

interface FireLine {
  id: string;
  text: string;
  ring: RingId;
  inferred: boolean;
  accepted: boolean;
}

interface FireRingsProps {
  memos: Memo[];
  onSave: (text: string, memoIds: string[]) => void;
}

const RINGS: Array<{ id: RingId; eyebrow: string; title: string; prompt: string }> = [
  { id: 'fact', eyebrow: '内圈', title: '发生过什么', prompt: '先只留下能从原记录中找到依据的事。' },
  { id: 'then', eyebrow: '中圈', title: '当时的我怎样感受', prompt: '这不是事实判断，只是当时真实存在的感受。' },
  { id: 'now', eyebrow: '外圈', title: '现在的我怎么看', prompt: '可以是一句新认识，也可以仍然只是一个问题。' },
];

export default function FireRings({ memos, onSave }: FireRingsProps) {
  const initialLines = useMemo(() => buildInitialLines(memos), [memos]);
  const [lines, setLines] = useState<FireLine[]>(initialLines);
  const [activeRing, setActiveRing] = useState<RingId>('fact');
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState(false);
  const activeIndex = RINGS.findIndex((ring) => ring.id === activeRing);
  const ring = RINGS[activeIndex];
  const visibleLines = lines.filter((line) => line.ring === activeRing);

  const addLine = () => {
    if (!draft.trim()) return;
    setLines((current) => [...current, {
      id: crypto.randomUUID(),
      text: draft.trim(),
      ring: activeRing,
      inferred: false,
      accepted: true,
    }]);
    setDraft('');
  };

  const moveLine = (id: string, direction: -1 | 1) => {
    setLines((current) => current.map((line) => {
      if (line.id !== id) return line;
      const index = RINGS.findIndex((item) => item.id === line.ring);
      const next = RINGS[Math.max(0, Math.min(RINGS.length - 1, index + direction))];
      return { ...line, ring: next.id };
    }));
  };

  const save = () => {
    const text = RINGS.map((item) => {
      const content = lines
        .filter((line) => line.ring === item.id && (!line.inferred || line.accepted))
        .map((line) => line.text)
        .join('；');
      return content ? `${item.title}：${content}` : '';
    }).filter(Boolean).join('\n');
    onSave(text, memos.map((memo) => memo.id));
    setSaved(true);
  };

  return (
    <section className="fire-reflection">
      <nav className="fire-reflection__rings" aria-label="三层火光">
        {RINGS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={activeRing === item.id ? 'is-active' : ''}
            onClick={() => setActiveRing(item.id)}
          >
            <span>{index + 1}</span>
            <small>{item.eyebrow}</small>
          </button>
        ))}
      </nav>

      <div className="fire-reflection__flame" aria-hidden="true">
        <span className={`is-ring-${activeIndex + 1}`} />
        <i />
      </div>

      <header className="fire-reflection__header">
        <p>{ring.eyebrow}</p>
        <h3>{ring.title}</h3>
        <span>{ring.prompt}</span>
      </header>

      <div className="fire-reflection__notes">
        {visibleLines.length > 0 ? visibleLines.map((line) => (
          <article key={line.id} className={line.inferred && !line.accepted ? 'is-unaccepted' : ''}>
            <textarea
              value={line.text}
              onChange={(event) => setLines((current) => current.map((item) => (
                item.id === line.id ? { ...item, text: event.target.value, inferred: false, accepted: true } : item
              )))}
              rows={3}
            />
            <footer>
              {line.inferred ? (
                <button
                  type="button"
                  className="fire-note__inference"
                  onClick={() => setLines((current) => current.map((item) => (
                    item.id === line.id ? { ...item, accepted: !item.accepted } : item
                  )))}
                >
                  {line.accepted ? '已由我确认' : '苔灯的一个角度 · 点此接纳'}
                </button>
              ) : <span>我的话</span>}
              <div>
                {activeIndex > 0 && <button type="button" onClick={() => moveLine(line.id, -1)}><ArrowLeft size={13} />更靠里</button>}
                {activeIndex < RINGS.length - 1 && <button type="button" onClick={() => moveLine(line.id, 1)}>更靠外<ArrowRight size={13} /></button>}
                <button type="button" onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))} aria-label="不留下这句"><X size={13} /></button>
              </div>
            </footer>
          </article>
        )) : (
          <p className="fire-reflection__empty">这一层还空着。空着也可以。</p>
        )}
      </div>

      <div className="fire-reflection__add">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addLine();
            }
          }}
          placeholder={`在「${ring.title}」里补一句自己的话`}
        />
        <button type="button" onClick={addLine} disabled={!draft.trim()}><Plus size={15} />放进这一圈</button>
      </div>

      <footer className="fire-reflection__footer">
        <p>不需要把三圈都填满。只有你确认过的话会被留下。</p>
        <button type="button" disabled={saved || lines.length === 0} onClick={save}>
          <Check size={15} />
          {saved ? '这张札记已留在火边' : '先这样放着'}
        </button>
      </footer>
    </section>
  );
}

function buildInitialLines(memos: Memo[]): FireLine[] {
  return memos.flatMap((memo, index) => {
    const original = memo.plain_text.replace(/\s+/g, ' ').trim().slice(0, 96);
    const lines: FireLine[] = original ? [{
      id: `${memo.id}-original`,
      text: original,
      ring: index === 0 ? 'fact' : 'then',
      inferred: false,
      accepted: true,
    }] : [];
    if (memo.ai_summary && index === memos.length - 1) {
      lines.push({
        id: `${memo.id}-inference`,
        text: memo.ai_summary.replace(/\s+/g, ' ').trim().slice(0, 96),
        ring: 'now',
        inferred: true,
        accepted: false,
      });
    }
    return lines;
  });
}
