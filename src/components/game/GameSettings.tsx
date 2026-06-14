'use client';

import React from 'react';
import type { GameWorld } from '@/types';
import { updateSettings } from '@/lib/game/world-state';

interface GameSettingsProps {
  world: GameWorld | null;
  reducedMotion: boolean;
  onReducedMotionChange: (v: boolean) => void;
  onExit: () => void;
  onClose: () => void;
}

export default function GameSettings({
  world,
  reducedMotion,
  onReducedMotionChange,
  onExit,
  onClose,
}: GameSettingsProps) {
  const handleReducedMotion = async (v: boolean) => {
    onReducedMotionChange(v);
    if (world) {
      await updateSettings({ reducedMotion: v });
    }
  };

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 z-30 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 设置面板 */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 w-[340px]"
        role="dialog"
        aria-label="游戏设置"
      >
        <div className="chat-woodframe rounded-lg p-6">
          {/* 标题 */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[16px] font-medium" style={{ color: 'var(--game-warm-light)' }}>
              🌲 林间世界 · 设置
            </h2>
            <button
              onClick={onClose}
              className="game-hud-btn text-xs px-2 py-1"
              aria-label="关闭设置"
            >
              ✕
            </button>
          </div>

          {/* 设置项 */}
          <div className="flex flex-col gap-5">
            {/* 减少动态 */}
            <SettingRow
              label="减少动态效果"
              description="关闭粒子、摇摆和频繁动画"
              checked={reducedMotion}
              onChange={handleReducedMotion}
              id="setting-reduced-motion"
            />
          </div>

          {/* 控制说明 */}
          <div
            className="mt-6 pt-5 border-t"
            style={{ borderColor: 'rgba(255,243,196,0.1)' }}
          >
            <p className="text-[11px] mb-3" style={{ color: 'var(--game-hud-muted)' }}>
              操控方式
            </p>
            <div className="flex flex-col gap-1.5 text-[11px]" style={{ color: 'var(--game-hud-muted)' }}>
              <div className="flex justify-between">
                <span>移动</span>
                <span>WASD / 方向键</span>
              </div>
              <div className="flex justify-between">
                <span>互动</span>
                <span>E / Enter / Space</span>
              </div>
              <div className="flex justify-between">
                <span>打开此菜单</span>
                <span>Esc</span>
              </div>
              <div className="flex justify-between">
                <span>移动端</span>
                <span>左下摇杆 / 右下互动</span>
              </div>
            </div>
          </div>

          {/* 退出按钮 */}
          <div className="mt-6 flex flex-col gap-2">
            <button
              id="game-exit-to-inneros"
              onClick={onExit}
              className="w-full py-2.5 rounded-lg text-[13px] font-medium transition-all"
              style={{
                background: 'rgba(255,243,196,0.08)',
                border: '1px solid rgba(255,243,196,0.2)',
                color: 'var(--game-warm-light)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,243,196,0.15)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,243,196,0.08)';
              }}
            >
              返回 InnerOS
            </button>
            <p className="text-center text-[10px]" style={{ color: 'var(--game-hud-muted)' }}>
              这里会保持原样，等你愿意再回来。
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function SettingRow({
  label,
  description,
  checked,
  onChange,
  id,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-[13px] font-medium cursor-pointer" style={{ color: 'var(--game-warm-light)' }}>
          {label}
        </label>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--game-hud-muted)' }}>
          {description}
        </p>
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="shrink-0 relative mt-0.5"
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          background: checked ? 'var(--game-green-light)' : 'rgba(255,255,255,0.15)',
          border: '1px solid rgba(255,255,255,0.2)',
          transition: 'background 0.2s ease',
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 18 : 2,
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: 'white',
            transition: 'left 0.2s ease',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }}
        />
      </button>
    </div>
  );
}
