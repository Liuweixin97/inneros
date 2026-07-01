'use client';

import { Armchair, ArrowLeft, Flame, Flower2, Hammer, Home, Settings, Trees, Waves } from 'lucide-react';
import type { CompanionType, GamePhase, GameWorld, JourneyEvent, Memo, MapLocation } from '@/types';
import { getPlayerLocation, getRegion } from '@/lib/game/map';
import BagHUD from './BagHUD';

interface WorldHUDProps {
  world: GameWorld | null;
  phase: GamePhase;
  companionType: CompanionType;
  playerX: number;
  playerY: number;
  memos: Memo[];
  bagMemoIds: string[];
  events: JourneyEvent[];
  onRemoveFromBag: (memoId: string) => void;
  onOpenFireside: () => void;
  onOpenLightTrail: () => void;
  onOpenSettings: () => void;
  onExit: () => void;
  panelOpen?: boolean;
}

export default function WorldHUD({
  phase,
  companionType,
  playerX,
  playerY,
  memos,
  bagMemoIds,
  events,
  onRemoveFromBag,
  onOpenFireside,
  onOpenLightTrail,
  onOpenSettings,
  onExit,
  panelOpen = false,
}: WorldHUDProps) {
  const locationId = getPlayerLocation(playerX, playerY);
  const region = locationId ? getRegion(locationId) : null;
  const RegionIcon = region?.id === 'cabin'
    ? Home
    : region?.id === 'bench'
      ? Armchair
    : region?.id === 'garden'
      ? Flower2
      : region?.id === 'fireside'
        ? Flame
        : region?.id === 'pond'
          ? Waves
          : region?.id === 'workshop'
            ? Hammer
            : Trees;
  const guide = getPlaceGuide(region?.id ?? null, bagMemoIds.length, events);

  return (
    <div className={`game-hud ${phase === 'pond' ? 'is-quiet' : ''} ${panelOpen ? 'has-panel-open' : ''}`}>
      {/* 左上：区域标识 */}
      <div className="game-hud-identity">
        <span className="game-hud-mark">
          <RegionIcon size={18} strokeWidth={1.7} />
        </span>
        <span>
          <strong style={{ color: region?.color ?? 'var(--game-warm-light)' }}>
            {region?.name ?? '林间世界'}
          </strong>
          <small>{region?.subtitle ?? '独自漫游'}</small>
        </span>
      </div>

      {/* AI 伴侣徽章（仅 llm 模式显示） */}
      {companionType === 'llm' && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2"
          style={{
            background: 'rgba(255,155,61,0.18)',
            border: '1px solid rgba(255,155,61,0.4)',
            borderRadius: 20,
            padding: '3px 12px',
            fontSize: 11,
            color: '#FF9B3D',
            backdropFilter: 'blur(6px)',
            pointerEvents: 'none',
          }}
        >
          苔灯陪在附近
        </div>
      )}

      {/* 右上：操作按钮 */}
      <div className="game-hud-actions">
        <button type="button" onClick={onOpenSettings} aria-label="打开游戏设置">
          <Settings size={17} strokeWidth={1.7} />
        </button>
        <button type="button" onClick={onExit}>
          <ArrowLeft size={16} strokeWidth={1.7} />
          <span>回到 InnerOS</span>
        </button>
      </div>

      {/* 底部操控说明（桌面端） */}
      <div className="game-control-legend">
        <span><kbd>WASD</kbd> 移动</span>
        <span><kbd>E</kbd> 互动</span>
        <span><kbd>Q</kbd> 行囊</span>
        <span><kbd>Esc</kbd> 设置</span>
      </div>

      <section className="game-world-brief" aria-label="当前地点的工作流">
        <p className="game-kicker">今日闭环</p>
        <h3>{guide.title}</h3>
        <p>{guide.body}</p>
        <div>
          <span>{memos.length} 段近期记录</span>
          <span>{bagMemoIds.length} 段在行囊</span>
          <span>{events.length} 次旅程回声</span>
        </div>
        {guide.action === 'trail' && (
          <button type="button" disabled={memos.length < 2} onClick={onOpenLightTrail}>
            {bagMemoIds.length >= 2 ? '循光命名一条路' : '让苔灯提出一组候选'}
          </button>
        )}
        {guide.action === 'fireside' && (
          <button type="button" onClick={onOpenFireside}>去火边整理一句话</button>
        )}
      </section>

      <BagHUD
        memos={memos}
        memoIds={bagMemoIds}
        onRemove={onRemoveFromBag}
        onOpenFireside={onOpenFireside}
        companionInvited={companionType === 'llm'}
        onOpenLightTrail={onOpenLightTrail}
      />
    </div>
  );
}

function getPlaceGuide(location: MapLocation | null, bagCount: number, events: JourneyEvent[]) {
  const hasQuestion = events.some((event) => event.type === 'left_question');
  if (location === 'garden') {
    return {
      title: '花园负责让记忆现身',
      body: '走近一段近期记录，读完后只带走今天愿意再看一眼的部分。',
      action: null,
    };
  }
  if (location === 'bench') {
    return {
      title: '长椅只决定怎样同行',
      body: '一个人、同屏双人、或邀请苔灯。选择同行方式不等于开放全部笔记。',
      action: null,
    };
  }
  if (location === 'fireside') {
    return {
      title: '火边把此刻说法放到光里',
      body: bagCount > 0 ? '你已经带了材料，可以独自写一句，也可以让苔灯只看行囊。' : '没有材料也可以坐下；有材料时，回应会更贴近真实记录。',
      action: 'fireside' as const,
    };
  }
  if (location === 'pond') {
    return {
      title: '池塘负责放下，不负责解释',
      body: '这里不会调用 AI。可以移出行囊、写临时漂流瓶，或看本次旅程的倒影。',
      action: null,
    };
  }
  if (location === 'workshop') {
    return {
      title: '工坊让两个版本并存',
      body: '它不合成正确答案，只让差异以并排、相交、留缝或收回的方式留下。',
      action: null,
    };
  }
  if (location === 'forest') {
    return {
      title: '小径只在你确认后留下',
      body: bagCount >= 2 ? '先看行囊里的纸条是否同路。' : '没有准备材料也可以来，苔灯会先提出一组候选，但是否有关由你判断。',
      action: 'trail' as const,
    };
  }
  return {
    title: hasQuestion ? '今天已有一个问题在木屋等你' : '先从一段真实记录开始',
    body: '林间世界不是建议机器；它把你写过、带过、确认过的东西摆回你面前。',
    action: null,
  };
}
