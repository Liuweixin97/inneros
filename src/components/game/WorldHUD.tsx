'use client';

import { ArrowLeft, Settings, Trees } from 'lucide-react';
import type { CompanionType, GamePhase, GameWorld } from '@/types';
import { getPlayerLocation, getRegion } from '@/lib/game/map';

interface WorldHUDProps {
  world: GameWorld | null;
  phase: GamePhase;
  companionType: CompanionType;
  playerX: number;
  playerY: number;
  onOpenSettings: () => void;
  onExit: () => void;
}

const COMPANION_LABELS: Record<CompanionType, string> = {
  none: '自由漫游',
  human_local: '与身边的人同行',
  llm: '同行者在附近',
};

export default function WorldHUD({
  companionType,
  playerX,
  playerY,
  onOpenSettings,
  onExit,
}: WorldHUDProps) {
  const location = getRegion(getPlayerLocation(playerX, playerY) ?? 'cabin');

  return (
    <div className="game-hud">
      <div className="game-hud-identity">
        <span className="game-hud-mark"><Trees size={18} strokeWidth={1.7} /></span>
        <span>
          <strong>{location?.name ?? '林间世界'}</strong>
          <small>{COMPANION_LABELS[companionType]}</small>
        </span>
      </div>

      <div className="game-hud-actions">
        <button type="button" onClick={onOpenSettings} aria-label="打开游戏设置">
          <Settings size={17} strokeWidth={1.7} />
        </button>
        <button type="button" onClick={onExit}>
          <ArrowLeft size={16} strokeWidth={1.7} />
          <span>回到 InnerOS</span>
        </button>
      </div>

      <div className="game-control-legend">
        <span><kbd>WASD</kbd> 移动</span>
        <span><kbd>E</kbd> 互动</span>
      </div>
    </div>
  );
}
