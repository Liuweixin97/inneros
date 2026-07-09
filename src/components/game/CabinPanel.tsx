'use client';

import { ArrowLeft, HelpCircle, Lightbulb, Settings, X } from 'lucide-react';
import type { JourneyEvent, WorldObject } from '@/types';

interface CabinPanelProps {
  events: JourneyEvent[];
  objects: WorldObject[];
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
  placed_object: '你亲手留下了',
  saved_observation: '你在观照桌保存了',
};

export default function CabinPanel({
  events,
  objects,
  onOpenSettings,
  onExit,
  onClose,
}: CabinPanelProps) {
  const confirmedObservations = objects
    .filter((object) => object.userConfirmed && object.metadata?.kind === 'observation')
    .slice(-4)
    .reverse();
  const recentEvents = events
    .filter((event) => ['left_annotation', 'fireside_note', 'left_question', 'saved_observation'].includes(event.type))
    .slice(-3)
    .reverse();
  const lastQuestion = [...events].reverse().find((event) => event.type === 'left_question');
  const lastObservation = confirmedObservations[0];

  return (
    <div className="game-focus-layer game-focus-layer--soft" role="dialog" aria-label="亮灯木屋">
      <section className="cabin-panel">
        <header>
          <div>
            <p className="game-kicker">亮灯木屋 · 我看见了什么</p>
            <h2>这里只放你确认留下的东西</h2>
          </div>
          <button type="button" className="game-icon-button" onClick={onClose} aria-label="离开亮灯木屋">
            <X size={17} />
          </button>
        </header>

        <div className="cabin-panel__grid">
          <article className="cabin-panel__window">
            <span className="cabin-panel__icon"><Lightbulb size={18} /></span>
            <div>
              <small>今日木牌</small>
              <strong>{lastObservation?.annotation ?? '还没有钉上木牌'}</strong>
              <p>{lastObservation ? '这是你在观照桌亲自保存的看法。' : '去记忆花园或观照桌，留下你愿意确认的一句话。'}</p>
            </div>
          </article>

          <article className="cabin-panel__mailbox">
            <span className="cabin-panel__icon"><HelpCircle size={18} /></span>
            <div>
              <small>未回答的问题</small>
              <strong>{lastQuestion ? '这里有一个你留下的问题' : '没有留下问题'}</strong>
              <p>{lastQuestion?.text ?? '只有你主动留下的问题，才会在这里出现。'}</p>
            </div>
          </article>
        </div>

        <section className="cabin-echo">
          <div>
            <p className="game-kicker">旅程回声</p>
            <h3>这里只记录真实发生过的事</h3>
          </div>
          {recentEvents.length > 0 || confirmedObservations.length > 0 ? (
            <div className="cabin-echo__list">
              {confirmedObservations.map((object) => (
                <article key={object.id}>
                  <small>{String(object.metadata.relationLabel ?? '已保存')}</small>
                  <p>{object.annotation ?? '没有补充文字'}</p>
                </article>
              ))}
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
            离开林间
          </button>
        </footer>
      </section>
    </div>
  );
}
