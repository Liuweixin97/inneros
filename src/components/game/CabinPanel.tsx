'use client';

import { ArrowLeft, Compass, Footprints, Settings } from 'lucide-react';
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

interface CabinPanelProps {
  events: JourneyEvent[];
  memos: Memo[];
  onOpenSettings: () => void;
  onExit: () => void;
  onClose: () => void;
}

const EVENT_LABELS: Record<JourneyEvent['type'], string> = {
  carried_memory: '带走一段记忆',
  left_annotation: '为过去补一句',
  named_path: '命名一条小径',
  separated_path: '拆开一组线索',
  fireside_note: '火边纸条',
  left_question: '留下问题',
  pond_release: '池边放下',
  placed_object: '地图新痕迹',
};

export default function CabinPanel({
  events,
  memos,
  onOpenSettings,
  onExit,
  onClose,
}: CabinPanelProps) {
  const route = buildRouteHint(memos.length, events);
  const recentEvents = events.slice(-4).reverse();
  const arrivalMemo = memos[0] ?? null;

  return (
    <ForestSceneLayer tone="porch" align="start" label="亮灯木屋">
      <ForestScenePanel
        tone="porch"
        size="md"
        kicker="亮灯木屋 · 门廊"
        title="先决定今晚从哪里开始"
        subtitle="木屋不分析你，只把路线摆出来。离开林间世界，也从这里回到 InnerOS。"
        onClose={onClose}
        footer={(
          <>
            <SceneButton variant="quiet" onClick={onOpenSettings}>
              <Settings size={15} />
              设置外观
            </SceneButton>
            <SceneButton variant="secondary" onClick={onClose}>继续走走</SceneButton>
            <SceneButton variant="primary" onClick={onExit}>
              <ArrowLeft size={15} />
              回到 InnerOS
            </SceneButton>
          </>
        )}
      >
        <SceneSection title="门廊纸条" caption={arrivalMemo ? '来自最近一段记录' : '今天还没有材料'}>
          {arrivalMemo ? (
            <blockquote className="forest-porch-note">
              <strong>{formatMemoTitle(arrivalMemo)}</strong>
              <p>{arrivalMemo.ai_summary || formatMemoExcerpt(arrivalMemo, 116)}</p>
            </blockquote>
          ) : (
            <SceneEmpty
              title="今晚的林间还很安静"
              body="可以先回到 InnerOS 写一条真实记录，再来花园看看它会长成什么。"
            />
          )}
        </SceneSection>

        <div className="forest-scene-split">
          <SceneSection title="今日路线" caption={route.reason}>
            <div className="forest-route-card">
              <span><Compass size={16} /></span>
              <h3>{route.title}</h3>
              <p>{route.body}</p>
              <ol>
                {route.steps.map((step) => <li key={step}>{step}</li>)}
              </ol>
            </div>
          </SceneSection>

          <SceneSection title="旅程回声" caption="只记录你亲自留下的动作。">
            {recentEvents.length > 0 ? (
              <div className="forest-event-list">
                {recentEvents.map((event) => (
                  <article key={event.id}>
                    <small>{EVENT_LABELS[event.type]}</small>
                    <p>{event.text}</p>
                  </article>
                ))}
              </div>
            ) : (
              <SceneEmpty
                title="还没有足迹"
                body="靠近记忆、带走一段、放下一个问题，都会成为这里的回声。"
              />
            )}
          </SceneSection>
        </div>

        <div className="forest-porch-mapline" aria-hidden="true">
          <Footprints size={16} />
          <span />
        </div>
      </ForestScenePanel>
    </ForestSceneLayer>
  );
}

function buildRouteHint(memoCount: number, events: JourneyEvent[]) {
  const hasCarried = events.some((event) => event.type === 'carried_memory');
  const hasFire = events.some((event) => event.type === 'fireside_note' || event.type === 'left_question');
  const hasTrail = events.some((event) => event.type === 'named_path' || event.type === 'separated_path');
  const hasPlaced = events.some((event) => event.type === 'placed_object');

  if (memoCount === 0) {
    return {
      title: '先写一条真实记录',
      body: '林间世界不会凭空生成故事。它只把已经写下的东西变成可以回访的线索。',
      reason: '没有材料时，最好的入口在主应用。',
      steps: ['回到 InnerOS 写一条 Memo', '再来记忆花园看它出现', '不用急着解释它'],
    };
  }
  if (!hasCarried) {
    return {
      title: '从记忆花园带走一段',
      body: '带走不是收藏价值，而是承认这一段今天愿意被看见。',
      reason: '花园是所有闭环的起点。',
      steps: ['靠近一株植物或一盏灯', '读完后放进行囊', '再决定去火边、池边或小径'],
    };
  }
  if (!hasFire) {
    return {
      title: '去火边把说法放清楚',
      body: '火边只处理一件事：把原记录和此刻的说法放到同一张纸上。',
      reason: '你已经有材料，可以开始整理。',
      steps: ['选择是否邀请苔灯', '一次只谈一段材料', '离开前留下一句话或问题'],
    };
  }
  if (!hasTrail) {
    return {
      title: '去循光小径确认关系',
      body: '相似不等于有关。小径只在你确认后留下名字。',
      reason: '已经有火边回声，可以看它是否和别的记忆同路。',
      steps: ['选两到三段纸条', '判断是不是同一条路', '给确认过的关系命名'],
    };
  }
  if (!hasPlaced) {
    return {
      title: '去工坊留下一个形状',
      body: '如果旧记录和现在的你有差异，工坊让差异并排存在。',
      reason: '已经有线索，可以把它做成可回访的物件。',
      steps: ['选一段旧记录', '写下现在回应', '决定并排、相交、留缝或收回'],
    };
  }
  return {
    title: '今天可以收束了',
    body: '去中庭写作台把今天确认的一句话写回 InnerOS，或去池边放下一点不必解释的东西。',
    reason: '林间已经有足迹，适合收束。',
    steps: ['写成一条新记录', '或把材料从行囊移出', '从木屋回到 InnerOS'],
  };
}
