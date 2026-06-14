'use client';

import React, { useState, useEffect } from 'react';

interface GamePortalProps {
  onComplete: () => void;
}

export default function GamePortal({ onComplete }: GamePortalProps) {
  const [phase, setPhase] = useState<'door' | 'opening' | 'done'>('door');

  // 3 步过场：显示门 → 开门动画 → 完成
  const handlePushDoor = () => {
    setPhase('opening');
    setTimeout(() => {
      setPhase('done');
      setTimeout(onComplete, 300);
    }, 900);
  };

  // 支持跳过（再次点击）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        if (phase === 'door') handlePushDoor();
        else if (phase === 'opening') {
          setPhase('done');
          onComplete();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center z-20"
      style={{
        background: 'linear-gradient(180deg, #1A2A0A 0%, #2D4A1A 40%, #4A7C2F 100%)',
      }}
    >
      {/* 星星背景 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {STARS.map((s, i) => (
          <div
            key={i}
            className="absolute rounded-full animate-pulse-soft"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.size,
              height: s.size,
              background: '#FFF8E7',
              opacity: s.opacity,
              animationDelay: `${s.delay}s`,
            }}
          />
        ))}
      </div>

      {/* 前景树轮廓 */}
      <div className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none">
        <svg viewBox="0 0 800 160" className="w-full h-full" preserveAspectRatio="none">
          {TREE_SHAPES.map((tree, i) => (
            <polygon key={i} points={tree} fill="#1A2A0A" />
          ))}
        </svg>
      </div>

      {/* 主内容 */}
      <div
        className="relative z-10 flex flex-col items-center gap-8"
        style={{
          opacity: phase === 'done' ? 0 : 1,
          transition: 'opacity 0.3s ease',
        }}
      >
        {/* 文案 */}
        <div className="text-center animate-fade-in">
          <p
            className="text-[17px] leading-relaxed"
            style={{ color: 'var(--game-hud-muted)', letterSpacing: '0.05em' }}
          >
            有些事情写下来以后，
          </p>
          <p
            className="text-[17px] leading-relaxed"
            style={{ color: '#FFF8E7', letterSpacing: '0.05em' }}
          >
            还可以有一个地方继续住着。
          </p>
        </div>

        {/* 像素木门 SVG */}
        <div
          className="portal-door animate-portal-pulse"
          onClick={handlePushDoor}
          role="button"
          tabIndex={0}
          aria-label="推门进去"
          onKeyDown={(e) => e.key === 'Enter' && handlePushDoor()}
        >
          <div className="portal-door-glow" />
          <PixelDoorSVG opening={phase === 'opening'} />
        </div>

        {/* 按钮 */}
        {phase === 'door' && (
          <button
            onClick={handlePushDoor}
            className="game-hud-btn animate-fade-in"
            style={{
              background: 'rgba(180, 220, 120, 0.15)',
              borderColor: 'rgba(180, 220, 120, 0.4)',
              color: '#CCFF88',
              fontSize: '14px',
              padding: '8px 24px',
              animationDelay: '0.5s',
            }}
          >
            推门进去
          </button>
        )}

        {phase === 'opening' && (
          <p className="text-sm animate-pulse-soft" style={{ color: 'var(--game-hud-muted)' }}>
            世界正在打开……
          </p>
        )}
      </div>
    </div>
  );
}

// 手绘像素木门 SVG
function PixelDoorSVG({ opening }: { opening: boolean }) {
  return (
    <svg
      width="120"
      height="160"
      viewBox="0 0 120 160"
      style={{
        shapeRendering: 'crispEdges',
        transform: opening ? 'perspective(400px) rotateY(-40deg)' : 'none',
        transition: 'transform 0.9s cubic-bezier(0.4, 0, 0.2, 1)',
        transformOrigin: 'left center',
      }}
    >
      {/* 门框 */}
      <rect x="0" y="0" width="120" height="160" fill="#4A2E0A" rx="4" />
      {/* 门板 */}
      <rect x="6" y="6" width="108" height="154" fill="#8B4513" rx="2" />
      {/* 木纹 */}
      <rect x="6" y="6" width="108" height="4" fill="#A0622A" />
      <rect x="6" y="55" width="108" height="4" fill="#A0622A" />
      <rect x="6" y="105" width="108" height="4" fill="#A0622A" />
      {/* 门窗 */}
      <rect x="20" y="18" width="80" height="30" fill="#5B9BD5" rx="2" />
      <rect x="20" y="18" width="80" height="30" fill="rgba(255,255,255,0.1)" rx="2" />
      {/* 门窗十字格 */}
      <line x1="60" y1="18" x2="60" y2="48" stroke="#4A2E0A" strokeWidth="2" />
      <line x1="20" y1="33" x2="100" y2="33" stroke="#4A2E0A" strokeWidth="2" />
      {/* 窗内灯光 */}
      <rect x="22" y="20" width="36" height="12" fill="rgba(255,243,196,0.4)" rx="1" />
      <rect x="62" y="20" width="36" height="12" fill="rgba(255,243,196,0.4)" rx="1" />
      {/* 门把手 */}
      <circle cx="86" cy="88" r="5" fill="#FFD700" />
      <circle cx="86" cy="88" r="3" fill="#E6C200" />
    </svg>
  );
}

// 背景星星数据
const STARS = Array.from({ length: 30 }, (_, i) => ({
  x: Math.random() * 100,
  y: Math.random() * 50,
  size: Math.random() < 0.3 ? 3 : 2,
  opacity: 0.4 + Math.random() * 0.5,
  delay: Math.random() * 3,
}));

// 树轮廓形状
const TREE_SHAPES = [
  '0,160 60,80 120,160',
  '80,160 150,60 220,160',
  '180,160 240,90 300,160',
  '280,160 330,70 380,160',
  '350,160 410,50 470,160',
  '440,160 500,85 560,160',
  '520,160 580,65 640,160',
  '610,160 670,80 730,160',
  '690,160 760,55 800,160',
];
