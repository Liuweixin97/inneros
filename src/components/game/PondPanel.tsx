'use client';

import { useEffect, useMemo, useState } from 'react';
import { PackageOpen } from 'lucide-react';
import type { JourneyEvent, Memo } from '@/types';
import {
  ForestSceneLayer,
  ForestScenePanel,
  SceneButton,
  SceneEmpty,
  SceneSection,
  formatMemoExcerpt,
  formatMemoTitle,
} from './ForestScenePrimitives';

interface PondPanelProps {
  memos: Memo[];
  bagMemoIds: string[];
  events: JourneyEvent[];
  onRemoveFromBag: (memoId: string) => void;
  onJourneyEvent: (text: string, memoIds: string[]) => void;
  onClose: () => void;
}

const POND_BOTTLE_KEY = 'inneros-pond-bottle-v4';
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
  const [mode, setMode] = useState<'sit' | 'bottle' | 'bag'>('sit');
  const [note, setNote] = useState('');
  const [released, setReleased] = useState(false);
  const [returnedBottle, setReturnedBottle] = useState<PondBottle | null>(null);
  const carried = useMemo(
    () => bagMemoIds.map((id) => memos.find((memo) => memo.id === id)).filter((memo): memo is Memo => Boolean(memo)),
    [bagMemoIds, memos],
  );
  const reflection = useMemo(() => {
    const event = [...events].reverse().find((item) => (
      item.type === 'fireside_note' || item.type === 'left_question' || item.type === 'named_path' || item.type === 'separated_path'
    ));
    if (event) return event.text;
    const memo = memos.find((item) => item.plain_text.trim());
    return memo ? formatMemoExcerpt(memo, 86) : '';
  }, [events, memos]);

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    try {
      const raw = window.localStorage.getItem(POND_BOTTLE_KEY);
      if (raw) {
        const bottle = JSON.parse(raw) as PondBottle;
        if (new Date(bottle.unlockAt).getTime() <= Date.now()) {
          setReturnedBottle(bottle);
          setMode('bottle');
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
    setNote('');
  };

  const sinkReturnedBottle = () => {
    window.localStorage.removeItem(POND_BOTTLE_KEY);
    setReturnedBottle(null);
  };

  return (
    <ForestSceneLayer tone="water" align="center" label="静水池塘">
      <ForestScenePanel
        tone="water"
        size="lg"
        kicker="静水池塘 · 不必解释"
        title="这里不调用 AI，只允许你放下一点"
        subtitle="池塘不是洞察页。它只负责暂停、释放、移出行囊。"
        onClose={onClose}
        footer={(
          <>
            <SceneButton variant={mode === 'sit' ? 'primary' : 'quiet'} onClick={() => setMode('sit')}>坐一会儿</SceneButton>
            <SceneButton variant={mode === 'bottle' ? 'primary' : 'quiet'} onClick={() => setMode('bottle')}>漂流瓶</SceneButton>
            <SceneButton variant={mode === 'bag' ? 'primary' : 'quiet'} onClick={() => setMode('bag')}>放下行囊</SceneButton>
          </>
        )}
      >
        <div className="forest-pond-layout">
          <div className="forest-pond-water" aria-live="polite">
            <span />
            <strong>{seconds > 120 ? '水面慢下来了' : '先不用解释'}</strong>
            <small>停留 {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</small>
            {reflection && <blockquote>{reflection}</blockquote>}
          </div>

          {mode === 'sit' && (
            <SceneSection title="停留规则" caption="这个场景不会读你的记录，也不会把沉默解释成结论。">
              <ul className="forest-boundary-list">
                <li>停留本身就是动作，不需要完成任务。</li>
                <li>水面只显示你已经留下过的旅程回声。</li>
                <li>想写新的确认，请去中庭写作台；想谈，请去火边。</li>
              </ul>
            </SceneSection>
          )}

          {mode === 'bottle' && (
            <SceneSection title="写给三天后的自己" caption="漂流瓶存在本机 localStorage，不进入 AI 分析。">
              {returnedBottle ? (
                <article className="forest-returned-bottle">
                  <small>水面漂回一只旧瓶</small>
                  <p>{returnedBottle.text}</p>
                  <SceneButton variant="secondary" onClick={sinkReturnedBottle}>读完，让它沉下去</SceneButton>
                </article>
              ) : (
                <>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={7}
                    placeholder="写给三天后的自己。这里不会请求 AI，也不会替你总结。"
                  />
                  <div className="forest-inline-actions">
                    <SceneButton variant="primary" disabled={!note.trim()} onClick={releaseNote}>投入漂流瓶</SceneButton>
                  </div>
                  {released && <p className="forest-scene-success">瓶子已经漂远。三天后再回到池边时，它会浮上来。</p>}
                </>
              )}
            </SceneSection>
          )}

          {mode === 'bag' && (
            <SceneSection title="从本次行囊移出" caption="这不会删除原记录，只是让它离开本次旅程材料。">
              {carried.length > 0 ? (
                <div className="forest-release-list">
                  {carried.map((memo) => (
                    <article key={memo.id}>
                      <span>
                        <strong>{formatMemoTitle(memo)}</strong>
                        <small>{formatMemoExcerpt(memo, 72)}</small>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          onRemoveFromBag(memo.id);
                          onJourneyEvent(`暂时放下「${formatMemoTitle(memo)}」`, [memo.id]);
                        }}
                      >
                        <PackageOpen size={14} />
                        移出
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <SceneEmpty
                  title="行囊里没有材料"
                  body="如果你在花园里带走一段记忆，它会出现在这里。"
                />
              )}
            </SceneSection>
          )}
        </div>
      </ForestScenePanel>
    </ForestSceneLayer>
  );
}
