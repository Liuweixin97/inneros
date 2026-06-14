'use client';

import React, { useState } from 'react';
import type { CompanionType } from '@/types';
import { CHARACTER_PRESETS } from '@/lib/game/sprite';

interface CharacterSelectProps {
  onConfirm: (charId: string, companionType: CompanionType) => void;
}

const COMPANION_OPTIONS: Array<{
  type: CompanionType;
  label: string;
  desc: string;
  icon: string;
}> = [
  { type: 'none', label: '一个人走走', desc: '安静独自探索世界', icon: '🌿' },
  { type: 'human_local', label: '和身边的人一起', desc: '同屏双人，共同探索和共写', icon: '🤝' },
  { type: 'llm', label: '让一个 AI 伙伴同行', desc: '它可以陪你走、听你说，也可以安静地待在一旁', icon: '✨' },
];

export default function CharacterSelect({ onConfirm }: CharacterSelectProps) {
  const [selectedChar, setSelectedChar] = useState(CHARACTER_PRESETS[0].id);
  const [selectedCompanion, setSelectedCompanion] = useState<CompanionType>('none');
  const [step, setStep] = useState<'mode' | 'character'>('mode');

  const handleConfirm = () => {
    onConfirm(selectedChar, selectedCompanion);
  };

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center z-20 animate-pixel-fade-in"
      style={{
        background: 'linear-gradient(180deg, #2D4A1A 0%, #4A7C2F 60%, #7DB85A 100%)',
      }}
    >
      {/* 木屋前景 */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
        <svg viewBox="0 0 800 120" className="w-full" style={{ height: 120 }}>
          {/* 木屋轮廓 */}
          <rect x="320" y="40" width="160" height="80" fill="#4A2E0A" rx="2" />
          <polygon points="280,40 400,0 520,40" fill="#6B3F1A" />
          {/* 门 */}
          <rect x="370" y="80" width="40" height="40" fill="#2C1810" rx="2" />
          {/* 窗 */}
          <rect x="330" y="55" width="35" height="25" fill="#5B9BD5" rx="1" />
          <rect x="435" y="55" width="35" height="25" fill="#5B9BD5" rx="1" />
          {/* 灯光 */}
          <rect x="330" y="55" width="35" height="25" fill="rgba(255,243,196,0.5)" rx="1" />
          <rect x="435" y="55" width="35" height="25" fill="rgba(255,243,196,0.5)" rx="1" />
          {/* 地面 */}
          <rect x="0" y="100" width="800" height="20" fill="#2D5016" />
          {/* 树 */}
          <polygon points="60,100 90,30 120,100" fill="#2D5016" />
          <polygon points="40,100 70,50 100,100" fill="#3A6B1F" />
          <polygon points="650,100 680,30 710,100" fill="#2D5016" />
          <polygon points="680,100 710,50 740,100" fill="#3A6B1F" />
        </svg>
      </div>

      {/* 主内容 */}
      <div className="relative z-10 w-full max-w-md px-6">

        {/* 步骤 1：选择同行方式 */}
        {step === 'mode' && (
          <div className="flex flex-col gap-6 animate-fade-in-up">
            <div className="text-center">
              <p className="text-[17px]" style={{ color: '#FFF8E7' }}>木屋门口，三条路</p>
              <p className="text-[12px] mt-1" style={{ color: 'rgba(255,248,231,0.5)' }}>
                以后可以在木屋内切换
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {COMPANION_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  id={`companion-${opt.type}`}
                  onClick={() => setSelectedCompanion(opt.type)}
                  className="w-full text-left px-5 py-4 rounded-xl transition-all duration-200"
                  style={{
                    background: selectedCompanion === opt.type
                      ? 'rgba(125,184,90,0.3)'
                      : 'rgba(20,12,5,0.6)',
                    border: `2px solid ${selectedCompanion === opt.type ? 'var(--game-green-light)' : 'rgba(255,243,196,0.15)'}`,
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{opt.icon}</span>
                    <div>
                      <p className="text-[14px] font-medium" style={{ color: '#FFF8E7' }}>
                        {opt.label}
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,248,231,0.55)' }}>
                        {opt.desc}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => setStep('character')}
              className="w-full py-3 rounded-xl text-[14px] font-medium transition-all"
              style={{
                background: 'var(--game-green-mid)',
                color: 'white',
                border: '2px solid var(--game-green-deep)',
              }}
            >
              继续 →
            </button>
          </div>
        )}

        {/* 步骤 2：选择角色外观 */}
        {step === 'character' && (
          <div className="flex flex-col gap-6 animate-fade-in-up">
            <div className="text-center">
              <p className="text-[17px]" style={{ color: '#FFF8E7' }}>你想以哪个样子走进去？</p>
              <p className="text-[12px] mt-1" style={{ color: 'rgba(255,248,231,0.5)' }}>
                只是一个外观，不绑定性格
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {CHARACTER_PRESETS.map((char) => (
                <button
                  key={char.id}
                  id={`char-${char.id}`}
                  onClick={() => setSelectedChar(char.id)}
                  className="flex flex-col items-center gap-2 py-4 rounded-xl transition-all"
                  style={{
                    background: selectedChar === char.id
                      ? 'rgba(125,184,90,0.3)'
                      : 'rgba(20,12,5,0.6)',
                    border: `2px solid ${selectedChar === char.id ? 'var(--game-green-light)' : 'rgba(255,243,196,0.15)'}`,
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  {/* 角色色块预览 */}
                  <div className="flex flex-col items-center gap-0.5">
                    <div
                      className="w-7 h-7 rounded-full border-2 border-white/20"
                      style={{ background: char.colorSkin }}
                    />
                    <div className="flex gap-1">
                      <div
                        className="w-2.5 h-2.5 rounded-sm"
                        style={{ background: char.colorHair }}
                        title="发色"
                      />
                      <div
                        className="w-2.5 h-2.5 rounded-sm"
                        style={{ background: char.colorOutfit }}
                        title="服装"
                      />
                    </div>
                  </div>
                  <span className="text-[11px]" style={{ color: '#FFF8E7' }}>
                    {char.displayName}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('mode')}
                className="flex-1 py-3 rounded-xl text-[13px] transition-all"
                style={{
                  background: 'rgba(255,243,196,0.08)',
                  border: '1px solid rgba(255,243,196,0.2)',
                  color: 'rgba(255,248,231,0.7)',
                }}
              >
                ← 返回
              </button>
              <button
                id="start-explore-btn"
                onClick={handleConfirm}
                className="flex-[2] py-3 rounded-xl text-[14px] font-medium transition-all"
                style={{
                  background: 'var(--game-green-mid)',
                  color: 'white',
                  border: '2px solid var(--game-green-deep)',
                }}
              >
                走进去
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
