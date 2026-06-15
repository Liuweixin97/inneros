'use client';

import { useMemo, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
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
  { id: 'fact', eyebrow: '', title: '发生过什么', prompt: '先只留下能从原记录中找到依据的事。' },
  { id: 'then', eyebrow: '', title: '当时的我怎样感受', prompt: '这不是事实判断，只是当时真实存在的感受。' },
  { id: 'now', eyebrow: '', title: '现在的我怎么看', prompt: '可以是一句新认识，也可以仍然只是一个问题。' },
];

export default function FireRings({ memos, onSave }: FireRingsProps) {
  const initialLines = useMemo(() => buildInitialLines(memos), [memos]);
  const [lines, setLines] = useState<FireLine[]>(initialLines);
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState(false);
  const visibleLines = lines.filter((line) => !line.inferred || line.accepted);

  const addLine = () => {
    if (!draft.trim()) return;
    setLines((current) => [...current, {
      id: crypto.randomUUID(),
      text: draft.trim(),
      ring: 'now',
      inferred: false,
      accepted: true,
    }]);
    setDraft('');
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
      <header className="fire-reflection__header">
        <h3>把此刻最想留下的几句话放在一起</h3>
        <span>不需要分类，也不需要把它整理完整。</span>
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
              <span>{line.inferred ? '我确认留下的角度' : '我的话'}</span>
              <div>
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
          placeholder="再补一句自己的话"
        />
        <button type="button" onClick={addLine} disabled={!draft.trim()}><Plus size={15} />放在一起</button>
      </div>

      <footer className="fire-reflection__footer">
        <p>删除或改写都不会影响原始记录。</p>
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
