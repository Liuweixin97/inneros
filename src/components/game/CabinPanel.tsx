'use client';

import { ArrowLeft, Lightbulb, Mail, Settings, X } from 'lucide-react';
import type { JourneyEvent, Memo } from '@/types';

interface CabinPanelProps {
  events: JourneyEvent[];
  memos: Memo[];
  onOpenSettings: () => void;
  onExit: () => void;
  onClose: () => void;
}

const EVENT_LABELS: Record<JourneyEvent['type'], string> = {
  carried_memory: '你今天带走了',
  left_annotation: '你为过去补了一句',
  named_path: '你为一条小径起了名字',
  fireside_note: '你在火边写下了',
  left_question: '你留下了一个问题',
  placed_object: '你们共同留下了',
};

export default function CabinPanel({
  events,
  memos,
  onOpenSettings,
  onExit,
  onClose,
}: CabinPanelProps) {
  const recentEvents = events.slice(-3).reverse();
  const lastQuestion = [...events].reverse().find((event) => event.type === 'left_question');
  const repeatedTopic = findRepeatedTopic(memos);

  return (
    <div className="game-focus-layer game-focus-layer--soft" role="dialog" aria-label="亮灯木屋">
      <section className="cabin-panel">
        <header>
          <div>
            <p className="game-kicker">亮灯木屋 · 此刻的锚点</p>
            <h2>我今天带着什么来到这里？</h2>
          </div>
          <button type="button" className="game-icon-button" onClick={onClose} aria-label="离开门廊">
            <X size={17} />
          </button>
        </header>

        <div className="cabin-panel__grid">
          <article className="cabin-panel__window">
            <span className="cabin-panel__icon"><Lightbulb size={18} /></span>
            <div>
              <small>窗边的线索</small>
              <strong>{repeatedTopic ? `你最近反复写到「${repeatedTopic}」` : '窗边今晚很安静'}</strong>
              <p>{lastQuestion?.text ?? '这里不会替你总结，只展示你亲自留下的线索。'}</p>
            </div>
          </article>

          <article className="cabin-panel__mailbox">
            <span className="cabin-panel__icon"><Mail size={18} /></span>
            <div>
              <small>信箱</small>
              <strong>{lastQuestion ? '一只纸鸟在等你' : '没有催促你的来信'}</strong>
              <p>{lastQuestion?.text ?? '只有你主动留下的问题，才会在这里出现。'}</p>
            </div>
          </article>
        </div>

        <section className="cabin-echo">
          <div>
            <p className="game-kicker">旅程回声</p>
            <h3>这里只记录真实发生过的事</h3>
          </div>
          {recentEvents.length > 0 ? (
            <div className="cabin-echo__list">
              {recentEvents.map((event) => (
                <article key={event.id}>
                  <small>{EVENT_LABELS[event.type]}</small>
                  <p>{event.text}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="cabin-echo__empty">今天还没有留下变化。直接出去走走也可以。</p>
          )}
        </section>

        <footer>
          <button type="button" onClick={onOpenSettings}>
            <Settings size={15} />
            设置外观
          </button>
          <button type="button" onClick={onClose}>再走一会儿</button>
          <button type="button" className="is-exit" onClick={onExit}>
            <ArrowLeft size={15} />
            回到 InnerOS
          </button>
        </footer>
      </section>
    </div>
  );
}

function findRepeatedTopic(memos: Memo[]): string | null {
  const counts = new Map<string, number>();
  memos.slice(0, 8).forEach((memo) => {
    [...(memo.ai_topics ?? []), ...memo.original_tags].forEach((topic) => {
      const normalized = topic.trim();
      if (normalized) counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    });
  });
  let result: string | null = null;
  let max = 1;
  counts.forEach((count, topic) => {
    if (count > max) {
      max = count;
      result = topic;
    }
  });
  return result;
}
