'use client';

import { ArrowLeft, Footprints, Settings, X } from 'lucide-react';
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
  pond_release: '你在池边放下了',
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
  const route = buildRouteHint(memos.length, events);
  const arrivalMemo = memos[0] ?? null;
  const arrivalLine = arrivalMemo
    ? (arrivalMemo.ai_summary || arrivalMemo.plain_text.replace(/\s+/g, ' ').slice(0, 72))
    : '今晚的林间没有催促。先留下一段真实记录，再回来看看它会长成什么。';

  return (
    <div className="game-focus-layer game-focus-layer--porch" role="dialog" aria-label="亮灯木屋">
      <section className="cabin-panel">
        <header>
          <div>
            <p className="game-kicker">亮灯木屋 · 门廊</p>
            <h2>今晚带着什么来？</h2>
          </div>
          <button type="button" className="game-icon-button" onClick={onClose} aria-label="离开门廊">
            <X size={17} />
          </button>
        </header>

        <blockquote className="cabin-arrival">
          <span>{arrivalMemo ? '来自最近一段记录' : '门廊上的纸条'}</span>
          <p>{arrivalLine}</p>
        </blockquote>

        <section className="cabin-echo">
          <div>
            <p className="game-kicker">上次与这次的足迹</p>
            <h3>{lastQuestion ? '有一个问题还在门边等你' : '这里只记录你亲自留下的事'}</h3>
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
            <p className="cabin-echo__empty">还没有足迹。出门、靠近一段记忆、带走或放下，都算。</p>
          )}
        </section>

        <section className="cabin-route">
          <p className="game-kicker">今日路线</p>
          <span className="cabin-route__mark"><Footprints size={16} /></span>
          <h3>{route.title}</h3>
          <p>{route.body}</p>
          <ol>
            {route.steps.map((step) => <li key={step}>{step}</li>)}
          </ol>
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

function buildRouteHint(memoCount: number, events: JourneyEvent[]) {
  const hasCarried = events.some((event) => event.type === 'carried_memory');
  const hasFire = events.some((event) => event.type === 'fireside_note' || event.type === 'left_question');
  const hasWorkshop = events.some((event) => event.type === 'placed_object');

  if (memoCount === 0) {
    return {
      title: '今天可以先留下一段真实记录',
      body: '林间世界不生成故事，它只把你已经写下的东西变成可回访的线索。',
      steps: ['回到 InnerOS 写一条笔记', '再来花园看看它长成什么', '不用急着解释它'],
    };
  }
  if (!hasCarried) {
    return {
      title: '先在花园里带走一段记忆',
      body: '带走不是收藏价值，而是承认这一段今天愿意被看见。',
      steps: ['走近一株植物或一盏灯', '读完后带进行囊', '再选择去火边、池塘或工坊'],
    };
  }
  if (!hasFire) {
    return {
      title: '带着它去火边坐一会儿',
      body: '火边的目标不是得到建议，而是把此刻的说法和原记录放在一起看。',
      steps: ['可独自写一句本地纸条', '也可邀请苔灯只看行囊内容', '离开时留下一句话或一个问题'],
    };
  }
  if (!hasWorkshop) {
    return {
      title: '如果这段记忆牵涉另一个版本，可以去工坊',
      body: '工坊不追求统一答案，它让两个版本以并排、相交或留缝的方式留下。',
      steps: ['选择一个具体问题', '两面背对书写', '共同决定物件怎样放进地图'],
    };
  }
  return {
    title: '今天的林间已经有了回声',
    body: '可以去池边放下一点不必解释的东西，或回到地图看看新增的痕迹。',
    steps: ['查看旅程回声', '让水面散开一条确认过的话', '回到 InnerOS 继续日常'],
  };
}
