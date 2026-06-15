'use client';

import { useMemo, useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import type { Memo } from '@/types';

type RingId = 'fact' | 'then' | 'now';

interface FireLine {
  id: string;
  text: string;
  ring: RingId;
  inferred: boolean;
}

interface FireRingsProps {
  memos: Memo[];
  onSave: (text: string, memoIds: string[]) => void;
}

const RINGS: Array<{ id: RingId; title: string; description: string }> = [
  { id: 'fact', title: '内圈 · 发生过的事实', description: '时间、行为、说过的话' },
  { id: 'then', title: '中圈 · 当时的感受', description: '当时的判断与身体感受' },
  { id: 'now', title: '外圈 · 现在的理解', description: '今天的看法与未解决问题' },
];

export default function FireRings({ memos, onSave }: FireRingsProps) {
  const initialLines = useMemo(() => buildInitialLines(memos), [memos]);
  const [lines, setLines] = useState<FireLine[]>(initialLines);
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState(false);

  const addLine = () => {
    if (!draft.trim()) return;
    setLines((current) => [...current, {
      id: crypto.randomUUID(),
      text: draft.trim(),
      ring: 'now',
      inferred: false,
    }]);
    setDraft('');
  };

  const save = () => {
    const text = RINGS.map((ring) => {
      const content = lines.filter((line) => line.ring === ring.id).map((line) => line.text).join('；');
      return content ? `${ring.title.replace(/^[^·]+· /, '')}：${content}` : '';
    }).filter(Boolean).join('\n');
    onSave(text, memos.map((memo) => memo.id));
    setSaved(true);
  };

  return (
    <section className="fire-rings">
      <div className="fire-rings__orbit" aria-hidden="true">
        <span className="ring ring--outer" />
        <span className="ring ring--middle" />
        <span className="ring ring--inner" />
        <i />
      </div>

      <div className="fire-rings__columns">
        {RINGS.map((ring) => (
          <article key={ring.id}>
            <header>
              <strong>{ring.title}</strong>
              <small>{ring.description}</small>
            </header>
            <div>
              {lines.filter((line) => line.ring === ring.id).map((line) => (
                <div key={line.id} className="fire-line">
                  <textarea
                    value={line.text}
                    onChange={(event) => setLines((current) => current.map((item) => (
                      item.id === line.id ? { ...item, text: event.target.value, inferred: false } : item
                    )))}
                    rows={2}
                  />
                  {line.inferred && <small>苔灯推测</small>}
                  <select
                    value={line.ring}
                    onChange={(event) => setLines((current) => current.map((item) => (
                      item.id === line.id ? { ...item, ring: event.target.value as RingId } : item
                    )))}
                    aria-label="移动短句到其他火圈"
                  >
                    {RINGS.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}
                  </select>
                  <button type="button" onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))} aria-label="删除短句">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="fire-rings__add">
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="再放入一句自己的话……" />
        <button type="button" onClick={addLine}><Plus size={15} />加入外圈</button>
      </div>

      <button type="button" className="fire-rings__save" disabled={saved || lines.length === 0} onClick={save}>
        <Check size={15} />
        {saved ? '火边札记已确认' : '确认这张火边札记'}
      </button>
    </section>
  );
}

function buildInitialLines(memos: Memo[]): FireLine[] {
  return memos.flatMap((memo, index) => {
    const source = memo.ai_summary || memo.plain_text;
    const text = source.replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!text) return [];
    return [{
      id: `${memo.id}-${index}`,
      text,
      ring: index === 0 ? 'fact' : index === 1 ? 'then' : 'now',
      inferred: Boolean(memo.ai_summary),
    } satisfies FireLine];
  });
}
