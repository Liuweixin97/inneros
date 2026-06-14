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

export default function WorldHUD({
  companionType,
  playerX,
  playerY,
  onOpenSettings,
  onExit,
}: WorldHUDProps) {
  const locationId = getPlayerLocation(playerX, playerY);
  const region = locationId ? getRegion(locationId) : null;

  return (
    <div className="game-hud">
      {/* 左上：区域标识 */}
      <div className="game-hud-identity">
        <span className="game-hud-mark">
          {region ? (
            <span style={{ fontSize: 18, lineHeight: 1 }}>{region.icon}</span>
          ) : (
            <Trees size={18} strokeWidth={1.7} />
          )}
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
          ✦ AI 同行者陪在附近
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
        <span><kbd>Esc</kbd> 设置</span>
      </div>
    </div>
  );
}
