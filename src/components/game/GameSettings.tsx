'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import type { GameWorld } from '@/types';
import { CHARACTER_PRESETS } from '@/lib/game/sprite';
import { updateSettings } from '@/lib/game/world-state';

interface GameSettingsProps {
  world: GameWorld | null;
  reducedMotion: boolean;
  onReducedMotionChange: (v: boolean) => void;
  currentCharId: string;
  onCharacterChange: (charId: string) => void;
  onExit: () => void;
  onClose: () => void;
}

type FontScale = 'normal' | 'large';

const CHARACTER_ART: Record<string, string> = {
  wanderer: '/game/lantern-keeper.png',
  drifter: '/game/seed-keeper.png',
};

export default function GameSettings({
  world,
  reducedMotion,
  onReducedMotionChange,
  currentCharId,
  onCharacterChange,
  onExit,
  onClose,
}: GameSettingsProps) {
  const [fontScale, setFontScale] = useState<FontScale>('normal');

  useEffect(() => {
    document.documentElement.setAttribute('data-font-scale', fontScale);
  }, [fontScale]);

  const handleReducedMotion = async (v: boolean) => {
    onReducedMotionChange(v);
    if (world) await updateSettings({ reducedMotion: v });
  };

  return (
    <>
      <div
        className="absolute inset-0 z-30 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 w-[380px] max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-label="林间设置"
      >
        <div className="chat-woodframe rounded-lg p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[16px] font-medium" style={{ color: 'var(--game-warm-light)' }}>
              🌲 林间世界 · 设置
            </h2>
            <button onClick={onClose} className="game-hud-btn text-xs px-2 py-1" aria-label="关闭设置">
              ✕
            </button>
          </div>

          <div className="flex flex-col gap-6">
            {/* 角色外观 */}
            <section>
              <p className="text-[11px] mb-3 tracking-wider" style={{ color: 'var(--game-hud-muted)' }}>
                外观
              </p>
              <div className="grid grid-cols-2 gap-2">
                {CHARACTER_PRESETS.map((char) => {
                  const selected = char.id === currentCharId;
                  return (
                    <button
                      key={char.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onCharacterChange(char.id)}
                      className="flex flex-col items-center gap-1.5 rounded-lg py-2 px-1 transition-all"
                      style={{
                        background: selected ? 'rgba(255,210,128,0.18)' : 'rgba(255,243,196,0.05)',
                        border: selected ? '1px solid rgba(255,210,128,0.5)' : '1px solid rgba(255,243,196,0.1)',
                      }}
                    >
                      <span
                        className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center"
                        style={{ background: `linear-gradient(145deg, ${char.colorHair}, ${char.colorOutfit})` }}
                      >
                        <Image src={CHARACTER_ART[char.id]} alt="" width={40} height={40} className="object-cover" />
                      </span>
                      <span className="text-[11px]" style={{ color: selected ? 'var(--game-warm-light)' : 'var(--game-hud-muted)' }}>
                        {char.displayName}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <div style={{ height: 1, background: 'rgba(255,243,196,0.08)' }} />

            {/* 文字大小 */}
            <section>
              <p className="text-[11px] mb-3 tracking-wider" style={{ color: 'var(--game-hud-muted)' }}>
                文字大小
              </p>
              <div className="flex gap-2">
                {(['normal', 'large'] as FontScale[]).map((size) => (
                  <button
                    key={size}
                    type="button"
                    aria-pressed={fontScale === size}
                    onClick={() => setFontScale(size)}
                    className="flex-1 py-2 rounded-lg text-[12px] transition-all"
                    style={{
                      background: fontScale === size ? 'rgba(255,210,128,0.18)' : 'rgba(255,243,196,0.05)',
                      border: fontScale === size ? '1px solid rgba(255,210,128,0.5)' : '1px solid rgba(255,243,196,0.1)',
                      color: fontScale === size ? 'var(--game-warm-light)' : 'var(--game-hud-muted)',
                    }}
                  >
                    {size === 'normal' ? '标准' : '大字'}
                  </button>
                ))}
              </div>
            </section>

            <div style={{ height: 1, background: 'rgba(255,243,196,0.08)' }} />

            {/* 减少动态 */}
            <section>
              <SettingRow
                label="减少动态效果"
                description="关闭粒子、摇摆和频繁动画"
                checked={reducedMotion}
                onChange={handleReducedMotion}
                id="setting-reduced-motion"
              />
            </section>

            <div style={{ height: 1, background: 'rgba(255,243,196,0.08)' }} />

            {/* 操控说明 */}
            <section>
              <p className="text-[11px] mb-2.5" style={{ color: 'var(--game-hud-muted)' }}>操控方式</p>
              <div className="flex flex-col gap-1.5 text-[11px]" style={{ color: 'var(--game-hud-muted)' }}>
                {[['移动', '方向键 / 触控摇杆'], ['互动', 'E / Enter / Space'], ['此菜单', 'Esc'], ['移动端', '左下摇杆 / 右下互动']].map(([l, k]) => (
                  <div key={l} className="flex justify-between"><span>{l}</span><span>{k}</span></div>
                ))}
              </div>
            </section>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <button
              id="game-exit-to-inneros"
              onClick={onExit}
              className="w-full py-2.5 rounded-lg text-[13px] font-medium transition-all"
              style={{ background: 'rgba(255,243,196,0.08)', border: '1px solid rgba(255,243,196,0.2)', color: 'var(--game-warm-light)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,243,196,0.15)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,243,196,0.08)'; }}
            >
              离开林间
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

function SettingRow({ label, description, checked, onChange, id }: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void; id: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-[13px] font-medium cursor-pointer" style={{ color: 'var(--game-warm-light)' }}>{label}</label>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--game-hud-muted)' }}>{description}</p>
      </div>
      <button
        id={id} role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className="shrink-0 relative mt-0.5"
        style={{ width: 36, height: 20, borderRadius: 10, background: checked ? 'var(--game-green-light)' : 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', transition: 'background 0.2s ease', cursor: 'pointer' }}
      >
        <span style={{ position: 'absolute', top: 2, left: checked ? 18 : 2, width: 14, height: 14, borderRadius: '50%', background: 'white', transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
      </button>
    </div>
  );
}
