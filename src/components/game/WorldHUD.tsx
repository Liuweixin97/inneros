'use client';

import React from 'react';
import type { GameWorld, GamePhase, CompanionType } from '@/types';
import { getRegion, getPlayerLocation } from '@/lib/game/map';

interface WorldHUDProps {
  world: GameWorld | null;
  phase: GamePhase;
  companionType: CompanionType;
  onOpenSettings: () => void;
  onExit: () => void;
}

const SEASON_LABELS: Record<string, string> = {
  spring: '春',
  summer: '夏',
  autumn: '秋',
  winter: '冬',
};

const COMPANION_LABELS: Record<CompanionType, string> = {
  none: '',
  human_local: '与身边的人同行',
  llm: '同行者陪伴中',
};

export default function WorldHUD({
  world,
  phase,
  companionType,
  onOpenSettings,
  onExit,
}: WorldHUDProps) {
  const season = world?.season ?? 'spring';
  const seasonLabel = SEASON_LABELS[season] ?? '';
  const companionLabel = COMPANION_LABELS[companionType];

  return (
    <div className="game-hud">
      {/* 左上：世界名 + 季节 */}
      <div
        className="absolute top-4 left-4 flex flex-col gap-1"
        style={{ pointerEvents: 'none' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">🌲</span>
          <span
            className="text-[15px] font-medium"
            style={{ color: 'var(--game-hud-text)', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}
          >
            林间世界
          </span>
          {seasonLabel && (
            <span
              className="text-[11px] px-1.5 py-0.5 rounded"
              style={{
                background: 'var(--game-hud-bg)',
                color: 'var(--game-hud-muted)',
                border: '1px solid var(--game-hud-border)',
              }}
            >
              {seasonLabel}
            </span>
          )}
        </div>
        {companionLabel && (
          <span
            className="text-[11px]"
            style={{ color: 'var(--game-hud-muted)', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}
          >
            {companionLabel}
          </span>
        )}
      </div>

      {/* 右上：控制按钮 */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <button
          id="game-settings-btn"
          className="game-hud-btn"
          onClick={onOpenSettings}
          title="游戏设置 (Esc)"
          aria-label="打开游戏设置"
        >
          <SettingsIcon />
        </button>
        <button
          id="game-exit-btn"
          className="game-hud-btn"
          onClick={onExit}
          title="返回 InnerOS"
          aria-label="退出林间世界"
        >
          <span>返回 InnerOS</span>
        </button>
      </div>

      {/* 右下：操作提示 */}
      <div className="absolute bottom-4 right-4 flex flex-col items-end gap-1.5">
        <ControlHint />
      </div>
    </div>
  );
}

function ControlHint() {
  return (
    <div
      className="flex flex-col items-end gap-1 text-[10px]"
      style={{ color: 'var(--game-hud-muted)' }}
    >
      <span className="hidden md:block">WASD / 方向键 移动</span>
      <span className="hidden md:block">E / Enter 互动</span>
      <span className="hidden md:block">Esc 设置</span>
    </div>
  );
}

function SettingsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <circle cx="7" cy="7" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.93 2.93l1.06 1.06M10.01 10.01l1.06 1.06M2.93 11.07l1.06-1.06M10.01 3.99l1.06-1.06"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
