'use client';

import { useState } from 'react';
import { Eye, PackageOpen, Waves, X } from 'lucide-react';
import type { JourneyEvent, Memo } from '@/types';

interface PondPanelProps {
  memos: Memo[];
  bagMemoIds: string[];
  events: JourneyEvent[];
  onRemoveFromBag: (memoId: string) => void;
  onClose: () => void;
}

type PondMode = 'choose' | 'sit' | 'release' | 'reflection';

export default function PondPanel({
  memos,
  bagMemoIds,
  events,
  onRemoveFromBag,
  onClose,
}: PondPanelProps) {
  const [mode, setMode] = useState<PondMode>('choose');
  const [note, setNote] = useState('');
  const [released, setReleased] = useState(false);
  const carried = bagMemoIds
    .map((id) => memos.find((memo) => memo.id === id))
    .filter((memo): memo is Memo => Boolean(memo));
  const reflections = events
    .filter((event) => ['fireside_note', 'named_path', 'placed_object'].includes(event.type))
    .slice(-4)
    .reverse();

  const releaseNote = () => {
    if (!note.trim()) return;
    sessionStorage.setItem('inneros-pond-note-v2', note.trim());
    setReleased(true);
  };

  return (
    <div className="pond-focus-layer" role="dialog" aria-label="静水池塘">
      <section className="pond-panel-v2">
        <header>
          <div>
            <p className="game-kicker">静水池塘 · 不必回答</p>
            <h2>{mode === 'sit' ? '水面很安静' : '有哪些东西，我还不想解释？'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="离开池塘"><X size={17} /></button>
        </header>

        <div className="pond-lantern-off">
          <span />
          <p>苔灯已经熄灯，并停在远处。这里的文字不会发送给 AI。</p>
        </div>

        {mode === 'choose' && (
          <div className="pond-choices">
            <button type="button" onClick={() => setMode('sit')}>
              <Waves size={20} />
              <strong>坐一会儿</strong>
              <span>不输入，不计时，也不产生任何内容。</span>
            </button>
            <button type="button" onClick={() => setMode('release')}>
              <PackageOpen size={20} />
              <strong>放下一件东西</strong>
              <span>移出行囊，或写进只属于本次会话的漂流瓶。</span>
            </button>
            <button type="button" onClick={() => setMode('reflection')}>
              <Eye size={20} />
              <strong>看看倒影</strong>
              <span>只看本次由你主动确认过的话。</span>
            </button>
          </div>
        )}

        {mode === 'sit' && (
          <div className="pond-sit">
            <div className="pond-ripples" aria-hidden="true"><i /><i /><i /></div>
            <p>不用解释，也不用表现。</p>
            <button type="button" onClick={onClose}>坐够了，回到岸上</button>
          </div>
        )}

        {mode === 'release' && (
          <div className="pond-release">
            <p>它不会被分析，也不会被留下。只是暂时不必拿在手里。</p>
            {carried.length > 0 && (
              <div className="pond-release__bag">
                {carried.map((memo) => (
                  <article key={memo.id}>
                    <span>
                      <strong>{memo.ai_title || memo.plain_text.slice(0, 30) || '未命名记录'}</strong>
                      <small>从本次行囊移出，不删除原记录</small>
                    </span>
                    <button type="button" onClick={() => onRemoveFromBag(memo.id)}>暂时放下</button>
                  </article>
                ))}
              </div>
            )}
            {!released ? (
              <>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} placeholder="写一点临时的话，也可以什么都不写……" />
                <div className="pond-release__actions">
                  <button type="button" disabled={!note.trim()} onClick={releaseNote}>投入漂流瓶</button>
                  <button type="button" onClick={onClose}>什么也不留下</button>
                </div>
              </>
            ) : (
              <div className="pond-release__done">
                <p>瓶子漂远了。关闭这次林间世界后，这段文字会自动消失。</p>
                <button type="button" onClick={onClose}>回到岸上</button>
              </div>
            )}
          </div>
        )}

        {mode === 'reflection' && (
          <div className="pond-reflection">
            {reflections.length > 0 ? reflections.map((event) => (
              <article key={event.id}>
                <p>{event.text}</p>
                <button
                  type="button"
                  onClick={(e) => e.currentTarget.closest('article')?.classList.add('is-dispersed')}
                >
                  让它在水面散开
                </button>
              </article>
            )) : (
              <p className="pond-reflection__empty">水面没有替你生成任何话。</p>
            )}
            <button type="button" className="pond-back" onClick={() => setMode('choose')}>回到池边</button>
          </div>
        )}

        {mode !== 'choose' && mode !== 'sit' && mode !== 'reflection' ? null : (
          mode !== 'choose' && <button type="button" className="pond-back" onClick={() => setMode('choose')}>换一种方式</button>
        )}
      </section>
    </div>
  );
}
