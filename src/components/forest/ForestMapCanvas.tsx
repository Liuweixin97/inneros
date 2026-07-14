'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ForestNodeId } from '@/lib/forest/types';
import {
  findNearbyForestNode,
  FOREST_WORLD_HEIGHT,
  FOREST_WORLD_NODES,
  FOREST_WORLD_WIDTH,
  resolveForestMovement,
} from '@/lib/forest/world';
import styles from './ForestWorld.module.css';

type Direction = 'down' | 'left' | 'right' | 'up';

interface ForestMapCanvasProps {
  initialX: number;
  initialY: number;
  characterId: 'wanderer' | 'drifter';
  targetNodeId: ForestNodeId | null;
  interactionDisabled: boolean;
  reducedMotion: boolean;
  nodeNames: Record<ForestNodeId, string>;
  onPlayerMove: (x: number, y: number) => void;
  onNearbyNodeChange: (id: ForestNodeId | null) => void;
  onEnterNode: (id: ForestNodeId) => void;
  onCanvasFailure: () => void;
}

const MOVEMENT_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
]);
const SPEED = 3;
const DIRECTION_COLUMN: Record<Direction, number> = { down: 0, left: 1, right: 2, up: 3 };

export default function ForestMapCanvas({
  initialX,
  initialY,
  characterId,
  targetNodeId,
  interactionDisabled,
  reducedMotion,
  nodeNames,
  onPlayerMove,
  onNearbyNodeChange,
  onEnterNode,
  onCanvasFailure,
}: ForestMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const touchVectorRef = useRef({ x: 0, y: 0 });
  const playerRef = useRef({ x: initialX, y: initialY, direction: 'down' as Direction, moving: false });
  const nearbyRef = useRef<ForestNodeId | null>(null);
  const lastSyncRef = useRef(0);
  const imagesRef = useRef<{ map?: HTMLImageElement; character?: HTMLImageElement }>({});
  const [nearbyNodeId, setNearbyNodeId] = useState<ForestNodeId | null>(null);
  const [joystick, setJoystick] = useState({ active: false, startX: 0, startY: 0, dx: 0, dy: 0 });

  useEffect(() => {
    playerRef.current.x = initialX;
    playerRef.current.y = initialY;
  }, [initialX, initialY]);

  useEffect(() => {
    let cancelled = false;
    const entries = [
      ['map', '/game/twilight-world-map-v3.png'],
      ['character', '/game/twilight-character-atlas-cutout.png'],
    ] as const;
    for (const [key, source] of entries) {
      const image = new window.Image();
      image.decoding = 'async';
      image.src = source;
      image.onload = () => {
        if (!cancelled) imagesRef.current[key] = image;
      };
      image.onerror = onCanvasFailure;
    }
    return () => { cancelled = true; };
  }, [onCanvasFailure]);

  const triggerInteraction = useCallback(() => {
    if (!interactionDisabled && nearbyRef.current) onEnterNode(nearbyRef.current);
  }, [interactionDisabled, onEnterNode]);

  useEffect(() => {
    const clearKeys = () => {
      keysRef.current = {};
      touchVectorRef.current = { x: 0, y: 0 };
    };
    const keyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, [contenteditable="true"]')) return;
      if (MOVEMENT_KEYS.has(event.code) || ['KeyE', 'Enter', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
      if (interactionDisabled) return;
      keysRef.current[event.code] = true;
      if (!event.repeat && ['KeyE', 'Enter', 'Space'].includes(event.code)) triggerInteraction();
    };
    const keyUp = (event: KeyboardEvent) => { keysRef.current[event.code] = false; };
    window.addEventListener('keydown', keyDown, { passive: false });
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', clearKeys);
    return () => {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', clearKeys);
      clearKeys();
    };
  }, [interactionDisabled, triggerInteraction]);

  useEffect(() => {
    if (!interactionDisabled) return;
    keysRef.current = {};
    touchVectorRef.current = { x: 0, y: 0 };
  }, [interactionDisabled]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(container.clientWidth * dpr);
      canvas.height = Math.round(container.clientHeight * dpr);
      canvas.style.width = `${container.clientWidth}px`;
      canvas.style.height = `${container.clientHeight}px`;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let frame = 0;
    let previous = performance.now();
    const loop = (now: number) => {
      const delta = Math.min((now - previous) / 16.67, 2);
      previous = now;
      updatePlayer(playerRef.current, keysRef.current, touchVectorRef.current, delta, interactionDisabled);

      const nearby = findNearbyForestNode(playerRef.current.x, playerRef.current.y);
      if (nearby !== nearbyRef.current) {
        nearbyRef.current = nearby;
        setNearbyNodeId(nearby);
        onNearbyNodeChange(nearby);
      }
      if (playerRef.current.moving && now - lastSyncRef.current >= 160) {
        lastSyncRef.current = now;
        onPlayerMove(playerRef.current.x, playerRef.current.y);
      }
      drawForest(
        canvasRef.current,
        imagesRef.current,
        playerRef.current,
        characterId,
        targetNodeId,
        nearby,
        reducedMotion,
        now,
      );
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [characterId, interactionDisabled, onNearbyNodeChange, onPlayerMove, reducedMotion, targetNodeId]);

  const touchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    setJoystick({ active: true, startX: touch.clientX, startY: touch.clientY, dx: 0, dy: 0 });
  };
  const touchMove = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    const rawX = touch.clientX - joystick.startX;
    const rawY = touch.clientY - joystick.startY;
    const length = Math.hypot(rawX, rawY);
    const scale = length > 30 ? 30 / length : 1;
    const dx = rawX * scale;
    const dy = rawY * scale;
    touchVectorRef.current = { x: dx / 30, y: dy / 30 };
    setJoystick((current) => ({ ...current, dx, dy }));
  };
  const touchEnd = () => {
    touchVectorRef.current = { x: 0, y: 0 };
    setJoystick({ active: false, startX: 0, startY: 0, dx: 0, dy: 0 });
  };

  return (
    <div ref={containerRef} className={styles.canvasStage}>
      <canvas
        ref={canvasRef}
        className={styles.mapCanvas}
        tabIndex={0}
        aria-label="林间世界地图。使用 WASD 或方向键移动，靠近地点后按 E 查看。"
        onClick={(event) => event.currentTarget.focus()}
      />
      <span className={styles.srOnly} aria-live="polite">
        {nearbyNodeId ? `已靠近${nodeNames[nearbyNodeId]}，按 E 查看。` : '正在林间行走。'}
      </span>
      <div
        className={styles.joystick}
        data-active={joystick.active}
        onTouchStart={touchStart}
        onTouchMove={touchMove}
        onTouchEnd={touchEnd}
        onTouchCancel={touchEnd}
        aria-hidden="true"
      >
        <span style={{ transform: `translate(calc(-50% + ${joystick.dx}px), calc(-50% + ${joystick.dy}px))` }} />
      </div>
      {nearbyNodeId && !interactionDisabled ? (
        <button type="button" className={styles.contextPrompt} onClick={triggerInteraction}>
          <kbd>E</kbd>
          <span>查看 {nodeNames[nearbyNodeId]}</span>
        </button>
      ) : null}
    </div>
  );
}

function updatePlayer(
  player: { x: number; y: number; direction: Direction; moving: boolean },
  keys: Record<string, boolean>,
  touch: { x: number; y: number },
  delta: number,
  disabled: boolean,
) {
  if (disabled) {
    player.moving = false;
    return;
  }
  const keyboardX = (keys.KeyA || keys.ArrowLeft ? -1 : 0) + (keys.KeyD || keys.ArrowRight ? 1 : 0);
  const keyboardY = (keys.KeyW || keys.ArrowUp ? -1 : 0) + (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const dx = keyboardX || touch.x;
  const dy = keyboardY || touch.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.08) {
    player.moving = false;
    return;
  }
  const x = dx / Math.max(1, length);
  const y = dy / Math.max(1, length);
  player.direction = Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : (y > 0 ? 'down' : 'up');
  const next = resolveForestMovement(player.x, player.y, player.x + x * SPEED * delta, player.y + y * SPEED * delta);
  player.moving = next.x !== player.x || next.y !== player.y;
  player.x = next.x;
  player.y = next.y;
}

function drawForest(
  canvas: HTMLCanvasElement | null,
  images: { map?: HTMLImageElement; character?: HTMLImageElement },
  player: { x: number; y: number; direction: Direction; moving: boolean },
  characterId: 'wanderer' | 'drifter',
  targetNodeId: ForestNodeId | null,
  nearbyNodeId: ForestNodeId | null,
  reducedMotion: boolean,
  now: number,
) {
  if (!canvas) return;
  const context = canvas.getContext('2d');
  if (!context) return;
  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);
  context.imageSmoothingEnabled = false;
  if (!images.map?.complete) {
    context.fillStyle = '#061314';
    context.fillRect(0, 0, width, height);
    return;
  }
  const scale = Math.max(width / FOREST_WORLD_WIDTH, height / FOREST_WORLD_HEIGHT);
  const renderWidth = FOREST_WORLD_WIDTH * scale;
  const renderHeight = FOREST_WORLD_HEIGHT * scale;
  const offsetX = (width - renderWidth) / 2;
  const offsetY = (height - renderHeight) / 2;
  const toScreen = (x: number, y: number) => ({ x: offsetX + x * scale, y: offsetY + y * scale });
  context.drawImage(images.map, offsetX, offsetY, renderWidth, renderHeight);

  if (targetNodeId) {
    const target = FOREST_WORLD_NODES[targetNodeId];
    const start = toScreen(player.x, player.y);
    const end = toScreen(target.x, target.y);
    context.save();
    context.strokeStyle = 'rgba(237, 193, 105, 0.4)';
    context.lineWidth = Math.max(1.5, scale);
    context.setLineDash([5 * scale, 8 * scale]);
    context.beginPath();
    context.moveTo(start.x, start.y - 8 * scale);
    context.quadraticCurveTo((start.x + end.x) / 2, Math.min(start.y, end.y) - 20 * scale, end.x, end.y);
    context.stroke();
    context.restore();
  }

  const activeNodeId = nearbyNodeId ?? targetNodeId;
  if (activeNodeId) {
    const node = FOREST_WORLD_NODES[activeNodeId];
    const point = toScreen(node.x, node.y);
    context.save();
    context.strokeStyle = activeNodeId === nearbyNodeId ? 'rgba(246, 207, 126, 0.9)' : 'rgba(246, 207, 126, 0.46)';
    context.lineWidth = Math.max(1.5, scale);
    context.beginPath();
    context.ellipse(point.x, point.y, 24 * scale, 12 * scale, 0, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  if (images.character?.complete) {
    const point = toScreen(player.x, player.y);
    drawCharacter(context, images.character, characterId === 'wanderer' ? 0 : 1, player, point.x, point.y, scale, reducedMotion, now);
  }
}

function drawCharacter(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  row: number,
  player: { direction: Direction; moving: boolean },
  x: number,
  y: number,
  scale: number,
  reducedMotion: boolean,
  now: number,
) {
  const sourceWidth = image.naturalWidth / 4;
  const sourceHeight = image.naturalHeight / 2;
  const column = DIRECTION_COLUMN[player.direction];
  const cropX = column * sourceWidth + sourceWidth * 0.17;
  const cropY = row * sourceHeight + sourceHeight * 0.08;
  const cropWidth = sourceWidth * 0.66;
  const cropHeight = sourceHeight * 0.8;
  const bob = !reducedMotion && player.moving ? Math.sin(now / 95) * 1.5 * scale : 0;
  const height = 64 * scale;
  const width = 44 * scale;
  context.save();
  context.shadowColor = 'rgba(0, 0, 0, 0.55)';
  context.shadowBlur = 6 * scale;
  context.drawImage(
    image,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    x - width / 2,
    y + bob - height,
    width,
    height,
  );
  context.restore();
}
