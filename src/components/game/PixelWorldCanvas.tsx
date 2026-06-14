'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import type { WorldObject, Memo, CompanionType, PlayerCharacter } from '@/types';
import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  MAP_REGIONS,
  MAP_PATHS,
  MAP_DECORS,
  getPlayerLocation,
  worldToCanvas,
  calculateViewport,
} from '@/lib/game/map';
import { resolveMovement } from '@/lib/game/collisions';
import {
  CHARACTER_PRESETS,
  WALK_FRAMES,
  IDLE_FRAME,
  generateCharacterSVG,
  svgToDataUrl,
  getWalkFrameIndex,
} from '@/lib/game/sprite';
import type { MapLocation } from '@/types';

interface PixelWorldCanvasProps {
  playerX: number;
  playerY: number;
  playerChar: PlayerCharacter;
  objects: WorldObject[];
  memos: Memo[];
  companionType: CompanionType;
  reducedMotion: boolean;
  onPlayerMove: (x: number, y: number) => void;
  onOpenMemo: (memoId: string) => void;
  onEnterFireside: () => void;
  onEnterCoWrite: () => void;
}

// 按键状态
const KEYS: Record<string, boolean> = {};
const SPEED = 2.5; // 每帧移动速度（世界单位）
const INTERACT_RADIUS = 40; // 互动触发距离

export default function PixelWorldCanvas({
  playerX,
  playerY,
  playerChar,
  objects,
  memos,
  companionType,
  reducedMotion,
  onPlayerMove,
  onOpenMemo,
  onEnterFireside,
  onEnterCoWrite,
}: PixelWorldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerXRef = useRef(playerX);
  const playerYRef = useRef(playerY);
  const directionRef = useRef<'up' | 'down' | 'left' | 'right'>('down');
  const animFrameRef = useRef<number>(0);
  const lastMoveTime = useRef(0);

  // 当前所在区域
  const [currentLocation, setCurrentLocation] = useState<MapLocation | null>(null);
  // 靠近的互动对象
  const [nearbyObject, setNearbyObject] = useState<WorldObject | null>(null);
  // 靠近的区域（篝火/工坊）
  const [nearbyAction, setNearbyAction] = useState<'fireside' | 'workshop' | null>(null);

  // 更新 ref
  useEffect(() => { playerXRef.current = playerX; }, [playerX]);
  useEffect(() => { playerYRef.current = playerY; }, [playerY]);

  // 预渲染角色 SVG 为 Image
  const charImages = useRef<Map<string, HTMLImageElement>>(new Map());

  const getCharImage = useCallback((charId: string, dir: string, frameIdx: number) => {
    const key = `${charId}-${dir}-${frameIdx}`;
    if (charImages.current.has(key)) return charImages.current.get(key)!;

    const char = CHARACTER_PRESETS.find((c) => c.id === charId) ?? CHARACTER_PRESETS[0];
    const frame = frameIdx >= 0 ? WALK_FRAMES[frameIdx % WALK_FRAMES.length] : IDLE_FRAME;
    const svg = generateCharacterSVG(char, frame, dir as 'up' | 'down' | 'left' | 'right', 32);
    const url = svgToDataUrl(svg);
    const img = new Image();
    img.src = url;
    charImages.current.set(key, img);
    return img;
  }, []);

  // Canvas 绘制主循环
  const draw = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // 视口缩放（保持 800×600 世界坐标在屏幕内）
    const scale = Math.min(W / WORLD_WIDTH, H / WORLD_HEIGHT);
    const px = playerXRef.current;
    const py = playerYRef.current;
    const { viewX, viewY } = calculateViewport(px, py, W, H, scale);

    const tw = ([wx, wy]: [number, number]) =>
      worldToCanvas(wx, wy, scale, viewX, viewY) as [number, number];

    ctx.clearRect(0, 0, W, H);

    // ---- 1. 天空渐变背景 ----
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, '#87CEEB');
    skyGrad.addColorStop(1, '#C8E8A0');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // ---- 2. 草地 ----
    const groundY = worldToCanvas(0, WORLD_HEIGHT * 0.6, scale, viewX, viewY)[1];
    const groundGrad = ctx.createLinearGradient(0, groundY, 0, H);
    groundGrad.addColorStop(0, '#7DB85A');
    groundGrad.addColorStop(1, '#4A7C2F');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundY, W, H - groundY);

    // 上方草地也补一块
    ctx.fillStyle = '#B5D99C';
    ctx.fillRect(0, 0, W, groundY);

    // ---- 3. 地图路径 ----
    ctx.strokeStyle = 'rgba(139,99,64,0.35)';
    ctx.lineWidth = scale * 12;
    ctx.lineCap = 'round';
    ctx.setLineDash([scale * 8, scale * 6]);

    for (const path of MAP_PATHS) {
      const fromRegion = MAP_REGIONS.find((r) => r.id === path.fromId);
      const toRegion = MAP_REGIONS.find((r) => r.id === path.toId);
      if (!fromRegion || !toRegion) continue;
      const [fx, fy] = tw([fromRegion.cx, fromRegion.cy]);
      const [tx, ty] = tw([toRegion.cx, toRegion.cy]);
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // ---- 4. 区域地面色 ----
    for (const region of MAP_REGIONS) {
      const [cx, cy] = tw([region.cx, region.cy]);
      const rx = region.rx * scale;
      const ry = region.ry * scale;

      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = region.color;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ---- 5. 装饰物 ----
    for (const decor of MAP_DECORS) {
      const [dx, dy] = tw([decor.x, decor.y]);
      const decorScale = (decor.scale ?? 1) * scale;

      // 根据类型绘制简单形状
      switch (decor.type) {
        case 'tree':
          drawTree(ctx, dx, dy, decorScale, timestamp, reducedMotion);
          break;
        case 'bush':
          drawBush(ctx, dx, dy, decorScale);
          break;
        case 'rock':
          drawRock(ctx, dx, dy, decorScale);
          break;
        case 'flower':
          drawFlower(ctx, dx, dy, decorScale, timestamp, reducedMotion);
          break;
        case 'grass':
          drawGrass(ctx, dx, dy, decorScale);
          break;
        case 'water_lily':
          drawWaterLily(ctx, dx, dy, decorScale);
          break;
      }
    }

    // ---- 6. 世界建筑（木屋/工坊/篝火） ----
    drawCabin(ctx, tw([400, 300]), scale);
    drawFireside(ctx, tw([600, 400]), scale, timestamp, reducedMotion);
    drawWorkshop(ctx, tw([620, 200]), scale);
    drawPond(ctx, tw([400, 500]), scale, timestamp, reducedMotion);

    // ---- 7. 世界对象（Memo 植物等） ----
    for (const obj of objects) {
      if (obj.hidden) continue;
      const [ox, oy] = tw([obj.x, obj.y]);
      drawWorldObject(ctx, obj, ox, oy, scale, timestamp, reducedMotion);
    }

    // ---- 8. 区域标签 ----
    const loc = getPlayerLocation(px, py);
    for (const region of MAP_REGIONS) {
      const [rx, ry] = tw([region.cx, region.cy - region.ry - 8]);
      const opacity = region.id === loc ? 0.9 : 0.4;

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = '#1A2A0A';
      ctx.font = `${Math.round(10 * scale)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(region.name, rx, ry);
      ctx.restore();
    }

    // ---- 9. 玩家角色 ----
    const moving = Object.values(KEYS).some(Boolean);
    const frameIdx = moving && !reducedMotion ? getWalkFrameIndex(timestamp) : -1;
    const dir = directionRef.current;
    const charImg = getCharImage(playerChar.id, dir, frameIdx);
    const charW = 32 * scale;
    const charH = 48 * scale;
    const [charX, charY] = tw([px, py]);
    ctx.drawImage(charImg, charX - charW / 2, charY - charH, charW, charH);

    // ---- 10. 互动提示（E 键） ----
    if (nearbyObject || nearbyAction) {
      const [hx, hy] = tw([px, py]);
      ctx.fillStyle = 'rgba(255,243,196,0.95)';
      ctx.strokeStyle = '#A0622A';
      ctx.lineWidth = 1.5;
      const text = nearbyObject ? '按 E 靠近' : nearbyAction === 'fireside' ? '按 E 坐下谈谈' : '按 E 进入工坊';
      const textW = ctx.measureText(text).width + 16;
      const bx = hx - textW / 2;
      const by = hy - charH - 8;
      roundRect(ctx, bx, by - 18, textW, 20, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#3B2E2A';
      ctx.font = `${Math.round(11 * scale)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(text, hx, by - 4);
    }
  }, [objects, memos, playerChar, reducedMotion, nearbyObject, nearbyAction, getCharImage]);

  // 游戏循环
  useEffect(() => {
    let animId: number;

    const gameLoop = (timestamp: number) => {
      // 移动处理
      const dx = (KEYS['ArrowLeft'] || KEYS['KeyA'] ? -1 : 0) + (KEYS['ArrowRight'] || KEYS['KeyD'] ? 1 : 0);
      const dy = (KEYS['ArrowUp'] || KEYS['KeyW'] ? -1 : 0) + (KEYS['ArrowDown'] || KEYS['KeyS'] ? 1 : 0);

      if (dx !== 0 || dy !== 0) {
        const len = Math.sqrt(dx * dx + dy * dy);
        const ndx = dx / len;
        const ndy = dy / len;

        // 更新方向
        if (Math.abs(ndx) > Math.abs(ndy)) {
          directionRef.current = ndx > 0 ? 'right' : 'left';
        } else {
          directionRef.current = ndy > 0 ? 'down' : 'up';
        }

        const nx = playerXRef.current + ndx * SPEED;
        const ny = playerYRef.current + ndy * SPEED;
        const resolved = resolveMovement(playerXRef.current, playerYRef.current, nx, ny);

        if (resolved.x !== playerXRef.current || resolved.y !== playerYRef.current) {
          playerXRef.current = resolved.x;
          playerYRef.current = resolved.y;
          lastMoveTime.current = timestamp;
          onPlayerMove(resolved.x, resolved.y);
        }
      }

      // 检测附近对象和区域
      const px = playerXRef.current;
      const py = playerYRef.current;

      let closest: WorldObject | null = null;
      let closestDist = INTERACT_RADIUS;
      for (const obj of objects) {
        if (obj.hidden) continue;
        const d = Math.hypot(obj.x - px, obj.y - py);
        if (d < closestDist) {
          closestDist = d;
          closest = obj;
        }
      }
      setNearbyObject(closest);

      // 检测篝火 / 工坊
      const firesideDist = Math.hypot(600 - px, 400 - py);
      const workshopDist = Math.hypot(620 - px, 200 - py);
      if (firesideDist < 50) setNearbyAction('fireside');
      else if (workshopDist < 50) setNearbyAction('workshop');
      else setNearbyAction(null);

      // 更新区域
      setCurrentLocation(getPlayerLocation(px, py));

      draw(timestamp);
      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw, objects, onPlayerMove]);

  // 键盘事件
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      KEYS[e.code] = true;
      // E/Enter/Space → 互动
      if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') {
        if (nearbyObject) {
          const memoId = nearbyObject.sourceMemoIds[0];
          if (memoId) onOpenMemo(memoId);
        } else if (nearbyAction === 'fireside') {
          onEnterFireside();
        } else if (nearbyAction === 'workshop') {
          onEnterCoWrite();
        }
      }
    };
    const up = (e: KeyboardEvent) => { KEYS[e.code] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [nearbyObject, nearbyAction, onOpenMemo, onEnterFireside, onEnterCoWrite]);

  // Canvas 尺寸自适应
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // 移动端虚拟摇杆（简化版）
  const [joystick, setJoystick] = useState<{ active: boolean; startX: number; startY: number; dx: number; dy: number }>({
    active: false, startX: 0, startY: 0, dx: 0, dy: 0,
  });

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setJoystick({ active: true, startX: touch.clientX, startY: touch.clientY, dx: 0, dy: 0 });
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!joystick.active) return;
    const touch = e.touches[0];
    const dx = touch.clientX - joystick.startX;
    const dy = touch.clientY - joystick.startY;
    const maxR = 30;
    const len = Math.sqrt(dx * dx + dy * dy);
    const scale = len > maxR ? maxR / len : 1;
    KEYS['ArrowLeft'] = dx < -8;
    KEYS['ArrowRight'] = dx > 8;
    KEYS['ArrowUp'] = dy < -8;
    KEYS['ArrowDown'] = dy > 8;
    setJoystick((j) => ({ ...j, dx: dx * scale, dy: dy * scale }));
  };
  const handleTouchEnd = () => {
    KEYS['ArrowLeft'] = KEYS['ArrowRight'] = KEYS['ArrowUp'] = KEYS['ArrowDown'] = false;
    setJoystick({ active: false, startX: 0, startY: 0, dx: 0, dy: 0 });
  };

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        className="game-canvas-layer"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => {
          // 点击互动（桌面端点击触发）
          if (nearbyObject) {
            const memoId = nearbyObject.sourceMemoIds[0];
            if (memoId) onOpenMemo(memoId);
          } else if (nearbyAction === 'fireside') {
            onEnterFireside();
          } else if (nearbyAction === 'workshop') {
            onEnterCoWrite();
          }
        }}
      />

      {/* 移动端虚拟摇杆 */}
      <div className="absolute bottom-8 left-8 md:hidden">
        <div
          className="virtual-joystick-base"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="virtual-joystick-thumb"
            style={{
              transform: `translate(calc(-50% + ${joystick.dx}px), calc(-50% + ${joystick.dy}px))`,
            }}
          />
        </div>
      </div>

      {/* 移动端互动按钮 */}
      {(nearbyObject || nearbyAction) && (
        <button
          className="absolute bottom-8 right-8 md:hidden game-hud-btn"
          onClick={() => {
            if (nearbyObject) {
              const memoId = nearbyObject.sourceMemoIds[0];
              if (memoId) onOpenMemo(memoId);
            } else if (nearbyAction === 'fireside') {
              onEnterFireside();
            } else if (nearbyAction === 'workshop') {
              onEnterCoWrite();
            }
          }}
        >
          互动
        </button>
      )}
    </div>
  );
}

// ---- Canvas 绘制函数 ----

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, ts: number, reduced: boolean) {
  const sway = reduced ? 0 : Math.sin(ts / 2000 + x * 0.01) * 1.5;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((sway * Math.PI) / 180);
  // 树干
  ctx.fillStyle = '#6B3F1A';
  ctx.fillRect(-3 * scale, -8 * scale, 6 * scale, 20 * scale);
  // 树冠（3 层）
  ctx.fillStyle = '#2D5016';
  ctx.beginPath(); ctx.ellipse(0, -24 * scale, 14 * scale, 12 * scale, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3A6B1F';
  ctx.beginPath(); ctx.ellipse(0, -32 * scale, 11 * scale, 10 * scale, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4A7C2F';
  ctx.beginPath(); ctx.ellipse(0, -40 * scale, 8 * scale, 8 * scale, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawBush(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.fillStyle = '#4A7C2F';
  ctx.beginPath(); ctx.ellipse(x, y, 10 * scale, 7 * scale, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7DB85A';
  ctx.beginPath(); ctx.ellipse(x - 5 * scale, y - 2 * scale, 6 * scale, 5 * scale, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + 5 * scale, y - 2 * scale, 6 * scale, 5 * scale, 0, 0, Math.PI * 2); ctx.fill();
}

function drawRock(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.fillStyle = '#7A7D6F';
  ctx.beginPath(); ctx.ellipse(x, y, 8 * scale, 5 * scale, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#9DA09B';
  ctx.beginPath(); ctx.ellipse(x - 2 * scale, y - 1 * scale, 5 * scale, 3 * scale, 0, 0, Math.PI * 2); ctx.fill();
}

function drawFlower(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, ts: number, reduced: boolean) {
  const sway = reduced ? 0 : Math.sin(ts / 1500 + x * 0.02) * 3;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((sway * Math.PI) / 180);
  // 茎
  ctx.strokeStyle = '#4A7C2F';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -10 * scale); ctx.stroke();
  // 花
  ctx.fillStyle = '#FFB3C6';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * 3 * scale, -10 * scale + Math.sin(a) * 3 * scale, 3 * scale, 2 * scale, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#FFD700';
  ctx.beginPath(); ctx.arc(0, -10 * scale, 2 * scale, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawGrass(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.strokeStyle = '#7DB85A';
  ctx.lineWidth = 1.5 * scale;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * 3 * scale, y);
    ctx.quadraticCurveTo(x + i * 3 * scale + 2 * scale, y - 5 * scale, x + i * 3 * scale, y - 8 * scale);
    ctx.stroke();
  }
}

function drawWaterLily(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.fillStyle = 'rgba(91,155,213,0.3)';
  ctx.beginPath(); ctx.ellipse(x, y, 8 * scale, 5 * scale, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4A7C2F';
  ctx.beginPath(); ctx.ellipse(x, y, 6 * scale, 3.5 * scale, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#FFD700';
  ctx.beginPath(); ctx.arc(x, y - 1 * scale, 2 * scale, 0, Math.PI * 2); ctx.fill();
}

function drawCabin(ctx: CanvasRenderingContext2D, [x, y]: [number, number], scale: number) {
  const w = 80 * scale, h = 60 * scale;
  // 墙体
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(x - w / 2, y - h, w, h);
  // 屋顶
  ctx.fillStyle = '#4A2E0A';
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - 8 * scale, y - h);
  ctx.lineTo(x, y - h - 30 * scale);
  ctx.lineTo(x + w / 2 + 8 * scale, y - h);
  ctx.closePath();
  ctx.fill();
  // 窗户
  ctx.fillStyle = 'rgba(255,243,196,0.7)';
  ctx.fillRect(x - w / 2 + 10 * scale, y - h + 12 * scale, 18 * scale, 14 * scale);
  ctx.fillRect(x + w / 2 - 28 * scale, y - h + 12 * scale, 18 * scale, 14 * scale);
  // 门
  ctx.fillStyle = '#4A2E0A';
  ctx.fillRect(x - 10 * scale, y - 24 * scale, 20 * scale, 24 * scale);
  // 烟囱
  ctx.fillStyle = '#6B3F1A';
  ctx.fillRect(x + 15 * scale, y - h - 36 * scale, 10 * scale, 20 * scale);
  // 烟
  ctx.strokeStyle = 'rgba(200,200,200,0.3)';
  ctx.lineWidth = 3 * scale;
  ctx.beginPath();
  ctx.moveTo(x + 20 * scale, y - h - 36 * scale);
  ctx.quadraticCurveTo(x + 30 * scale, y - h - 50 * scale, x + 25 * scale, y - h - 60 * scale);
  ctx.stroke();
}

function drawFireside(ctx: CanvasRenderingContext2D, [x, y]: [number, number], scale: number, ts: number, reduced: boolean) {
  // 石圈
  ctx.fillStyle = '#7A7D6F';
  ctx.beginPath(); ctx.ellipse(x, y, 20 * scale, 14 * scale, 0, 0, Math.PI * 2); ctx.fill();
  // 木柴
  ctx.strokeStyle = '#6B3F1A';
  ctx.lineWidth = 4 * scale;
  ctx.beginPath(); ctx.moveTo(x - 10 * scale, y); ctx.lineTo(x + 10 * scale, y - 4 * scale); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 10 * scale, y); ctx.lineTo(x - 10 * scale, y - 4 * scale); ctx.stroke();
  // 火焰
  if (!reduced) {
    const flicker = Math.sin(ts / 100) * 0.1 + 1;
    ctx.save();
    ctx.translate(x, y - 8 * scale);
    ctx.scale(flicker, flicker);
    // 外火
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 12 * scale);
    grad.addColorStop(0, 'rgba(255,200,50,0.9)');
    grad.addColorStop(0.5, 'rgba(255,100,20,0.6)');
    grad.addColorStop(1, 'rgba(255,50,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, -4 * scale, 6 * scale, 12 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else {
    ctx.fillStyle = '#FF9B3D';
    ctx.beginPath(); ctx.ellipse(x, y - 12 * scale, 5 * scale, 8 * scale, 0, 0, Math.PI * 2); ctx.fill();
  }
}

function drawWorkshop(ctx: CanvasRenderingContext2D, [x, y]: [number, number], scale: number) {
  const w = 60 * scale, h = 50 * scale;
  ctx.fillStyle = '#A0622A';
  ctx.fillRect(x - w / 2, y - h, w, h);
  ctx.fillStyle = '#6B3F1A';
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - 5 * scale, y - h);
  ctx.lineTo(x, y - h - 22 * scale);
  ctx.lineTo(x + w / 2 + 5 * scale, y - h);
  ctx.closePath();
  ctx.fill();
  // 工作台轮廓
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(x - 20 * scale, y - 18 * scale, 40 * scale, 10 * scale);
}

function drawPond(ctx: CanvasRenderingContext2D, [x, y]: [number, number], scale: number, ts: number, reduced: boolean) {
  // 水面
  const waterGrad = ctx.createRadialGradient(x, y, 0, x, y, 70 * scale);
  waterGrad.addColorStop(0, 'rgba(91,155,213,0.7)');
  waterGrad.addColorStop(1, 'rgba(91,155,213,0.3)');
  ctx.fillStyle = waterGrad;
  ctx.beginPath();
  ctx.ellipse(x, y, 70 * scale, 45 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // 波纹（减少动态时不显示）
  if (!reduced) {
    const rippleOpacity = (Math.sin(ts / 800) + 1) / 4;
    ctx.strokeStyle = `rgba(168,212,245,${rippleOpacity})`;
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.ellipse(x, y, 40 * scale, 25 * scale, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 反光
  ctx.fillStyle = 'rgba(168,212,245,0.25)';
  ctx.beginPath();
  ctx.ellipse(x - 15 * scale, y - 8 * scale, 18 * scale, 8 * scale, -0.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawWorldObject(
  ctx: CanvasRenderingContext2D,
  obj: WorldObject,
  x: number,
  y: number,
  scale: number,
  ts: number,
  reduced: boolean,
) {
  switch (obj.type) {
    case 'memory_plant':
      drawMemoryPlant(ctx, x, y, scale, ts, reduced, obj.userConfirmed);
      break;
    case 'letter':
      drawLetter(ctx, x, y, scale);
      break;
    case 'lamp':
      drawLamp(ctx, x, y, scale, ts, reduced);
      break;
    case 'windchime':
      drawWindchime(ctx, x, y, scale, ts, reduced);
      break;
    case 'bench':
      drawBenchObject(ctx, x, y, scale);
      break;
    case 'bottle':
      drawBottle(ctx, x, y, scale, ts, reduced);
      break;
    case 'empty_pot':
      drawEmptyPot(ctx, x, y, scale);
      break;
    default:
      // 通用小植物
      drawMemoryPlant(ctx, x, y, scale, ts, reduced, false);
  }
}

function drawMemoryPlant(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, ts: number, reduced: boolean, confirmed: boolean) {
  const sway = reduced ? 0 : Math.sin(ts / 2500 + x * 0.01) * 4;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((sway * Math.PI) / 180);
  // 茎
  ctx.strokeStyle = '#4A7C2F';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -16 * scale); ctx.stroke();
  // 叶子
  ctx.fillStyle = confirmed ? '#7DB85A' : '#B5D99C';
  ctx.beginPath(); ctx.ellipse(-5 * scale, -8 * scale, 5 * scale, 3 * scale, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(5 * scale, -11 * scale, 5 * scale, 3 * scale, 0.5, 0, Math.PI * 2); ctx.fill();
  // 嫩芽
  ctx.fillStyle = confirmed ? '#4A7C2F' : '#7DB85A';
  ctx.beginPath(); ctx.arc(0, -16 * scale, 3 * scale, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawLetter(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.fillStyle = '#FDF6E3';
  ctx.strokeStyle = '#C4A882';
  ctx.lineWidth = 1.5 * scale;
  const w = 16 * scale, h = 12 * scale;
  roundRect(ctx, x - w / 2, y - h, w, h, 2);
  ctx.fill(); ctx.stroke();
  // 封口线
  ctx.strokeStyle = '#E8D9B5';
  ctx.lineWidth = 1 * scale;
  ctx.beginPath(); ctx.moveTo(x - w / 2, y - h); ctx.lineTo(x, y - h / 2); ctx.lineTo(x + w / 2, y - h); ctx.stroke();
}

function drawLamp(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, ts: number, reduced: boolean) {
  const glow = reduced ? 0.6 : 0.5 + Math.sin(ts / 1500) * 0.2;
  // 灯光光晕
  const lampGrad = ctx.createRadialGradient(x, y - 14 * scale, 0, x, y - 14 * scale, 12 * scale);
  lampGrad.addColorStop(0, `rgba(255,243,196,${glow})`);
  lampGrad.addColorStop(1, 'rgba(255,243,196,0)');
  ctx.fillStyle = lampGrad;
  ctx.beginPath(); ctx.arc(x, y - 14 * scale, 12 * scale, 0, Math.PI * 2); ctx.fill();
  // 灯体
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(x - 1.5 * scale, y - 18 * scale, 3 * scale, 10 * scale);
  ctx.fillStyle = 'rgba(255,243,196,0.9)';
  ctx.beginPath(); ctx.arc(x, y - 18 * scale, 5 * scale, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#A0622A';
  ctx.lineWidth = 1.5 * scale;
  ctx.stroke();
}

function drawWindchime(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, ts: number, reduced: boolean) {
  const sway = reduced ? 0 : Math.sin(ts / 1200 + x * 0.01) * 6;
  ctx.save();
  ctx.translate(x, y - 8 * scale);
  ctx.rotate((sway * Math.PI) / 180);
  // 横杆
  ctx.fillStyle = '#A0622A';
  ctx.fillRect(-10 * scale, -16 * scale, 20 * scale, 2 * scale);
  // 细线 + 铃铛
  for (let i = -1; i <= 1; i++) {
    ctx.strokeStyle = '#C4A882';
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.moveTo(i * 6 * scale, -14 * scale);
    ctx.lineTo(i * 6 * scale, -5 * scale);
    ctx.stroke();
    ctx.fillStyle = '#FFD700';
    ctx.beginPath(); ctx.arc(i * 6 * scale, -4 * scale, 2 * scale, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawBenchObject(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.fillStyle = '#8B4513';
  // 座面
  ctx.fillRect(x - 14 * scale, y - 8 * scale, 28 * scale, 4 * scale);
  // 腿
  ctx.fillRect(x - 12 * scale, y - 4 * scale, 4 * scale, 6 * scale);
  ctx.fillRect(x + 8 * scale, y - 4 * scale, 4 * scale, 6 * scale);
  // 靠背
  ctx.fillStyle = '#A0622A';
  ctx.fillRect(x - 14 * scale, y - 16 * scale, 28 * scale, 3 * scale);
}

function drawBottle(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, ts: number, reduced: boolean) {
  const rock = reduced ? 0 : Math.sin(ts / 3000) * 4;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rock * Math.PI) / 180);
  ctx.fillStyle = 'rgba(91,155,213,0.7)';
  ctx.strokeStyle = '#5B9BD5';
  ctx.lineWidth = 1.5 * scale;
  // 瓶身
  roundRect(ctx, -4 * scale, -14 * scale, 8 * scale, 12 * scale, 2);
  ctx.fill(); ctx.stroke();
  // 瓶颈
  ctx.fillStyle = 'rgba(91,155,213,0.5)';
  ctx.fillRect(-2 * scale, -18 * scale, 4 * scale, 5 * scale);
  // 木塞
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(-2.5 * scale, -20 * scale, 5 * scale, 4 * scale);
  // 纸条
  ctx.fillStyle = 'rgba(255,243,196,0.7)';
  ctx.fillRect(-2 * scale, -11 * scale, 4 * scale, 6 * scale);
  ctx.restore();
}

function drawEmptyPot(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.fillStyle = '#8B6340';
  ctx.strokeStyle = '#6B3F1A';
  ctx.lineWidth = 1.5 * scale;
  roundRect(ctx, x - 8 * scale, y - 12 * scale, 16 * scale, 12 * scale, 2);
  ctx.fill(); ctx.stroke();
  // 盆沿
  ctx.fillStyle = '#A07040';
  ctx.fillRect(x - 10 * scale, y - 13 * scale, 20 * scale, 3 * scale);
  // 土
  ctx.fillStyle = '#5C3D11';
  ctx.beginPath(); ctx.ellipse(x, y - 4 * scale, 7 * scale, 3 * scale, 0, 0, Math.PI * 2); ctx.fill();
}
