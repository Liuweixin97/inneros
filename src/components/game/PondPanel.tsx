'use client';

import { useEffect, useMemo, useState } from 'react';
import { PackageOpen, X } from 'lucide-react';
import type { JourneyEvent, Memo } from '@/types';

interface PondPanelProps {
  memos: Memo[];
  bagMemoIds: string[];
  events: JourneyEvent[];
  onRemoveFromBag: (memoId: string) => void;
  onJourneyEvent: (text: string, memoIds: string[]) => void;
  onClose: () => void;
}

const POND_BOTTLE_KEY = 'inneros-pond-bottle-v3';
const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

interface PondBottle {
  text: string;
  createdAt: string;
  unlockAt: string;
}

export default function PondPanel({
  memos,
  bagMemoIds,
  events,
  onRemoveFromBag,
  onJourneyEvent,
  onClose,
}: PondPanelProps) {
  const [seconds, setSeconds] = useState(0);
  const [writing, setWriting] = useState(false);
  const [note, setNote] = useState('');
  const [released, setReleased] = useState(false);
  const [returnedBottle, setReturnedBottle] = useState<PondBottle | null>(null);
  const [showReturnedBottle, setShowReturnedBottle] = useState(false);
  const carried = bagMemoIds
    .map((id) => memos.find((memo) => memo.id === id))
    .filter((memo): memo is Memo => Boolean(memo));
  const oldReflection = useMemo(() => {
    const eventReflection = [...events].reverse().find((event) => (
      event.type === 'fireside_note' || event.type === 'left_question' || event.type === 'named_path'
    ));
    if (eventReflection) return eventReflection.text;
    const memo = [...memos].reverse().find((item) => item.plain_text.trim());
    return memo ? `来自你的记录：${memo.plain_text.replace(/\s+/g, ' ').slice(0, 72)}` : '';
  }, [events, memos]);

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    try {
      const raw = window.localStorage.getItem(POND_BOTTLE_KEY);
      if (raw) {
        const bottle = JSON.parse(raw) as PondBottle;
        if (new Date(bottle.unlockAt).getTime() <= Date.now()) {
          setReturnedBottle(bottle);
          setShowReturnedBottle(true);
        }
      }
    } catch {
      window.localStorage.removeItem(POND_BOTTLE_KEY);
    }
    return () => window.clearInterval(timer);
  }, []);

  const releaseNote = () => {
    const text = note.trim();
    if (!text) return;
    const now = new Date();
    const bottle: PondBottle = {
      text,
      createdAt: now.toISOString(),
      unlockAt: new Date(now.getTime() + THREE_DAYS).toISOString(),
    };
    window.localStorage.setItem(POND_BOTTLE_KEY, JSON.stringify(bottle));
    onJourneyEvent('把一句话投向三天后的自己', []);
    setReleased(true);
    setWriting(false);
    setNote('');
  };

  const sinkReturnedBottle = () => {
    window.localStorage.removeItem(POND_BOTTLE_KEY);
    setReturnedBottle(null);
    setShowReturnedBottle(false);
  };

  return (
    <div className="pond-focus-layer pond-focus-layer--immersive" role="dialog" aria-label="静水池塘">
      <section className="pond-panel-v2">
        <header>
          <div>
            <p className="game-kicker">静水池塘 · 苔灯熄灯</p>
            <h2>进入这里，本身就是坐一会儿</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="离开池塘"><X size={17} /></button>
        </header>

        <div className={`pond-water ${seconds > 120 ? 'is-settled' : ''}`}>
          <div className="pond-ripples" aria-hidden="true"><i /><i /><i /></div>
          <p>不用解释，也不用表现。</p>
          <small>{seconds > 120 ? '水面已经慢下来。' : `已经在池边停留 ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`}</small>
          {oldReflection && (
            <blockquote className="pond-floating-reflection">
              {oldReflection}
            </blockquote>
          )}
          {showReturnedBottle && returnedBottle && (
            <article className="pond-returned-bottle">
              <span>水面漂回一只旧瓶</span>
              <p>{returnedBottle.text}</p>
              <button type="button" onClick={sinkReturnedBottle}>读完，让它沉下去</button>
            </article>
          )}
        </div>

        <div className="pond-lantern-off">
          <span />
          <p>这里不会调用 AI。水面只映出你写过、带过、放下过的东西。</p>
        </div>

        <aside className="pond-corner">
          {!writing ? (
            <button type="button" onClick={() => setWriting(true)}>
              写点什么
            </button>
          ) : (
            <div className="pond-corner__sheet">
              <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} placeholder="写给三天后的自己……" />
              <div>
                <button type="button" disabled={!note.trim()} onClick={releaseNote}>投入漂流瓶</button>
                <button type="button" onClick={() => setWriting(false)}>收起</button>
              </div>
            </div>
          )}
          {released && <small>瓶子漂远了，三天后会回到水面。</small>}
        </aside>

        {carried.length > 0 && (
          <div className="pond-release__bag">
            {carried.map((memo) => (
              <article key={memo.id}>
                <span>
                  <strong>{memo.ai_title || memo.plain_text.slice(0, 30) || '未命名记录'}</strong>
                  <small>从本次行囊移出，不删除原记录</small>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onRemoveFromBag(memo.id);
                    onJourneyEvent(`暂时放下「${memo.ai_title || memo.plain_text.slice(0, 20) || '一段记忆'}」`, [memo.id]);
                  }}
                >
                  <PackageOpen size={14} />
                  暂时放下
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
