'use client';

import { ArrowLeft, Flame, Flower2, GitBranch, Home, Settings, Sprout, Trees, Waves } from 'lucide-react';
import type { CompanionType, GamePhase, GameWorld, Memo } from '@/types';
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
  onRemoveFromBag: (memoId: string) => void;
  onOpenFireside: () => void;
  onOpenSettings: () => void;
  onExit: () => void;
}

export default function WorldHUD({
  phase,
  companionType,
  playerX,
  playerY,
  memos,
  bagMemoIds,
  onRemoveFromBag,
  onOpenFireside,
  onOpenSettings,
  onExit,
}: WorldHUDProps) {
  const locationId = getPlayerLocation(playerX, playerY);
  const region = locationId ? getRegion(locationId) : null;
  const RegionIcon = region?.id === 'cabin'
    ? Home
    : region?.id === 'garden'
      ? Flower2
      : region?.id === 'fireside'
        ? Flame
        : region?.id === 'pond'
          ? Waves
          : region?.id === 'reflection_table'
            ? GitBranch
            : Trees;

  return (
    <div className={`game-hud ${phase === 'pond' ? 'is-quiet' : ''}`}>
      {/* 左上：区域标识 */}
      <div className="game-hud-identity">
        <span className="game-hud-mark">
          <RegionIcon size={18} strokeWidth={1.7} />
        </span>
        <span>
          <strong style={{ color: region?.color ?? 'var(--game-warm-light)' }}>
            {region?.name ?? '林间世界'}
          </strong>
          <small>{region?.subtitle ?? '从入林长椅开始'}</small>
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
        <button type="button" onClick={onOpenSettings} aria-label="打开林间设置">
          <Settings size={17} strokeWidth={1.7} />
        </button>
        <button type="button" onClick={onExit}>
          <ArrowLeft size={16} strokeWidth={1.7} />
          <span>离开林间</span>
        </button>
      </div>

      {/* 底部路径提示（桌面端） */}
      <div className="game-control-legend">
        <span><Trees size={12} /> 入林长椅</span>
        <span><Sprout size={12} /> 记忆花园</span>
        <span><GitBranch size={12} /> 观照桌</span>
        <span><Home size={12} /> 亮灯木屋</span>
      </div>

      <BagHUD
        memos={memos}
        memoIds={bagMemoIds}
        onRemove={onRemoveFromBag}
        onOpenFireside={onOpenFireside}
        companionInvited={companionType === 'llm'}
      />
    </div>
  );
}
