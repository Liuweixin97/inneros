'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CompanionType, PlayerCharacter, WorldObject, WorldObjectType } from '@/types';
import { resolveMovement } from '@/lib/game/collisions';
import {
  GAME_ACTION_POINTS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type GameActionId,
} from '@/lib/game/map';

interface PixelWorldCanvasProps {
  playerX: number;
  playerY: number;
  playerChar: PlayerCharacter;
  secondPlayerChar: PlayerCharacter;
  objects: WorldObject[];
  companionType: CompanionType;
  reducedMotion: boolean;
  onPlayerMove: (x: number, y: number) => void;
  onOpenMemo: (memoId: string, objectId: string) => void;
  onEnterCabin: () => void;
  onEnterBench: () => void;
  onEnterFireside: () => void;
  onEnterCoWrite: () => void;
  onEnterPond: () => void;
  onCanvasFailure: () => void;
}

type Direction = 'down' | 'left' | 'right' | 'up';
type NearbyAction = GameActionId | null;

const SPEED = 3;
const INTERACT_RADIUS = 42;
const MOVEMENT_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
]);
const keys: Record<string, boolean> = {};

const CHARACTER_DIRECTIONS: Record<Direction, number> = {
  down: 0,
  left: 1,
  right: 2,
  up: 3,
};

const OBJECT_CELLS: Record<WorldObjectType, [number, number]> = {
  memory_plant: [0, 0],
  letter: [2, 0],
  lamp: [3, 0],
  bench: [0, 1],
  sign: [1, 1],
  bottle: [2, 1],
  windchime: [3, 1],
  frame: [0, 2],
  empty_pot: [1, 2],
};

export default function PixelWorldCanvas({
  playerX,
  playerY,
  playerChar,
  secondPlayerChar,
  objects,
  companionType,
  reducedMotion,
  onPlayerMove,
  onOpenMemo,
  onEnterCabin,
  onEnterBench,
  onEnterFireside,
  onEnterCoWrite,
  onEnterPond,
  onCanvasFailure,
}: PixelWorldCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef({ x: playerX, y: playerY, direction: 'down' as Direction });
  const secondRef = useRef({ x: playerX + 28, y: playerY + 12, direction: 'down' as Direction });
  const nearbyObjectRef = useRef<WorldObject | null>(null);
  const nearbyActionRef = useRef<NearbyAction>(null);
  const lastSyncRef = useRef(0);
  const imagesRef = useRef<{
    map?: HTMLImageElement;
    characters?: HTMLImageElement;
    objects?: HTMLImageElement;
    companion?: HTMLImageElement;
  }>({});
  const [nearbyObject, setNearbyObject] = useState<WorldObject | null>(null);
  const [nearbyAction, setNearbyAction] = useState<NearbyAction>(null);
  const [mobilePlayer, setMobilePlayer] = useState<1 | 2>(1);
  const [joystick, setJoystick] = useState({
    active: false,
    startX: 0,
    startY: 0,
    dx: 0,
    dy: 0,
  });

  useEffect(() => {
    playerRef.current.x = playerX;
    playerRef.current.y = playerY;
  }, [playerX, playerY]);

  useEffect(() => {
    const entries = [
      ['map', '/game/twilight-world-map-v3.png'],
      ['characters', '/game/twilight-character-atlas-cutout.png'],
      ['objects', '/game/twilight-object-atlas-cutout.png'],
      ['companion', '/game/forest-companion.png'],
    ] as const;
    let cancelled = false;
    entries.forEach(([key, src]) => {
      const image = new Image();
      image.decoding = 'async';
      image.src = src;
      image.onload = () => {
        if (!cancelled) imagesRef.current[key] = image;
      };
      image.onerror = onCanvasFailure;
    });
    return () => {
      cancelled = true;
    };
  }, [onCanvasFailure]);

  const triggerInteraction = useCallback(() => {
    const object = nearbyObjectRef.current;
    const action = nearbyActionRef.current;
    if (object) {
      const memoId = object.sourceMemoIds[0];
      if (memoId) onOpenMemo(memoId, object.id);
      return;
    }
    if (action === 'cabin') onEnterCabin();
    if (action === 'bench') onEnterBench();
    if (action === 'fireside') onEnterFireside();
    if (action === 'workshop') onEnterCoWrite();
    if (action === 'pond') onEnterPond();
  }, [onEnterBench, onEnterCabin, onEnterCoWrite, onEnterFireside, onEnterPond, onOpenMemo]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (MOVEMENT_KEYS.has(event.code) || ['KeyE', 'Enter', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
      keys[event.code] = true;
      if (!event.repeat && ['KeyE', 'Enter', 'Space'].includes(event.code)) {
        triggerInteraction();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      keys[event.code] = false;
    };
    const onBlur = () => Object.keys(keys).forEach((key) => { keys[key] = false; });
    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      onBlur();
    };
  }, [triggerInteraction]);

  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(container.clientWidth * dpr);
      canvas.height = Math.round(container.clientHeight * dpr);
      canvas.style.width = `${container.clientWidth}px`;
      canvas.style.height = `${container.clientHeight}px`;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    let frame = 0;
    let previous = performance.now();

    const loop = (now: number) => {
      const delta = Math.min((now - previous) / 16.67, 2);
      previous = now;
      updateMovement(playerRef.current, false, companionType, mobilePlayer, delta);
      if (companionType === 'human_local') {
        updateMovement(secondRef.current, true, companionType, mobilePlayer, delta);
      } else if (companionType === 'llm') {
        secondRef.current.x += (playerRef.current.x + 24 - secondRef.current.x) * 0.035;
        secondRef.current.y += (playerRef.current.y + 12 - secondRef.current.y) * 0.035;
      }

      const object = findNearbyObject(objects, playerRef.current.x, playerRef.current.y);
      if (object?.id !== nearbyObjectRef.current?.id) {
        nearbyObjectRef.current = object;
        setNearbyObject(object);
      }
      const action = findNearbyAction(
        playerRef.current.x,
        playerRef.current.y,
        companionType,
        secondRef.current.x,
        secondRef.current.y,
      );
      if (action !== nearbyActionRef.current) {
        nearbyActionRef.current = action;
        setNearbyAction(action);
      }

      if (now - lastSyncRef.current > 140) {
        lastSyncRef.current = now;
        onPlayerMove(playerRef.current.x, playerRef.current.y);
      }

      drawScene(
        canvasRef.current,
        imagesRef.current,
        playerRef.current,
        secondRef.current,
        playerChar,
        secondPlayerChar,
        objects,
        companionType,
        nearbyObjectRef.current,
        nearbyActionRef.current,
        reducedMotion,
        now,
      );
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [
    companionType,
    mobilePlayer,
    objects,
    onPlayerMove,
    playerChar,
    reducedMotion,
    secondPlayerChar,
  ]);

  const handleTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    setJoystick({ active: true, startX: touch.clientX, startY: touch.clientY, dx: 0, dy: 0 });
  };
  const handleTouchMove = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    const dx = touch.clientX - joystick.startX;
    const dy = touch.clientY - joystick.startY;
    const length = Math.hypot(dx, dy);
    const scale = length > 30 ? 30 / length : 1;
    keys.TouchLeft = dx < -8;
    keys.TouchRight = dx > 8;
    keys.TouchUp = dy < -8;
    keys.TouchDown = dy > 8;
    setJoystick((current) => ({ ...current, dx: dx * scale, dy: dy * scale }));
  };
  const handleTouchEnd = () => {
    keys.TouchLeft = keys.TouchRight = keys.TouchUp = keys.TouchDown = false;
    setJoystick({ active: false, startX: 0, startY: 0, dx: 0, dy: 0 });
  };

  const interactionLabel = nearbyObject
    ? '靠近，看看这段记忆'
    : nearbyAction === 'cabin'
      ? '走上门廊'
      : nearbyAction === 'bench'
        ? '在长椅上坐下'
        : nearbyAction === 'fireside'
      ? '坐下来，和同行者谈谈'
      : nearbyAction === 'workshop'
        ? '进入共写小屋'
        : nearbyAction === 'pond'
          ? '到池边坐一会儿'
          : '';

  return (
    <div ref={containerRef} className="game-world-stage">
      <canvas
        ref={canvasRef}
        className="game-canvas-layer"
        tabIndex={0}
        aria-label="林间世界地图。使用 WASD 移动，E 键互动。"
        onClick={(event) => {
          event.currentTarget.focus();
          if (nearbyObjectRef.current || nearbyActionRef.current) triggerInteraction();
        }}
      />

      {interactionLabel && (
        <button type="button" className="game-context-prompt" onClick={triggerInteraction}>
          <kbd>E</kbd>
          <span>{interactionLabel}</span>
        </button>
      )}

      <div className="game-mobile-controls md:hidden">
        {companionType === 'human_local' && (
          <div className="game-player-switch">
            {[1, 2].map((player) => (
              <button
                key={player}
                type="button"
                className={mobilePlayer === player ? 'is-active' : ''}
                onClick={() => setMobilePlayer(player as 1 | 2)}
              >
                P{player}
              </button>
            ))}
          </div>
        )}
        <div
          className="virtual-joystick-base"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="virtual-joystick-thumb"
            style={{ transform: `translate(calc(-50% + ${joystick.dx}px), calc(-50% + ${joystick.dy}px))` }}
          />
        </div>
      </div>

      {(nearbyObject || nearbyAction) && (
        <button type="button" className="game-mobile-interact md:hidden" onClick={triggerInteraction}>
          互动
        </button>
      )}
    </div>
  );
}

function updateMovement(
  player: { x: number; y: number; direction: Direction },
  second: boolean,
  companionType: CompanionType,
  mobilePlayer: 1 | 2,
  delta: number,
) {
  const touchForThisPlayer = companionType !== 'human_local'
    ? !second
    : second ? mobilePlayer === 2 : mobilePlayer === 1;
  const useArrows = second || companionType !== 'human_local';
  const left = second ? keys.ArrowLeft : keys.KeyA || (useArrows && keys.ArrowLeft);
  const right = second ? keys.ArrowRight : keys.KeyD || (useArrows && keys.ArrowRight);
  const up = second ? keys.ArrowUp : keys.KeyW || (useArrows && keys.ArrowUp);
  const down = second ? keys.ArrowDown : keys.KeyS || (useArrows && keys.ArrowDown);
  const dx = (left || (touchForThisPlayer && keys.TouchLeft) ? -1 : 0)
    + (right || (touchForThisPlayer && keys.TouchRight) ? 1 : 0);
  const dy = (up || (touchForThisPlayer && keys.TouchUp) ? -1 : 0)
    + (down || (touchForThisPlayer && keys.TouchDown) ? 1 : 0);
  if (!dx && !dy) return;
  const length = Math.hypot(dx, dy);
  const normalizedX = dx / length;
  const normalizedY = dy / length;
  player.direction = Math.abs(normalizedX) > Math.abs(normalizedY)
    ? normalizedX > 0 ? 'right' : 'left'
    : normalizedY > 0 ? 'down' : 'up';
  const next = resolveMovement(
    player.x,
    player.y,
    player.x + normalizedX * SPEED * delta,
    player.y + normalizedY * SPEED * delta,
  );
  player.x = next.x;
  player.y = next.y;
}

function findNearbyObject(objects: WorldObject[], x: number, y: number): WorldObject | null {
  let closest: WorldObject | null = null;
  let distance = INTERACT_RADIUS;
  for (const object of objects) {
    if (object.hidden) continue;
    const nextDistance = Math.hypot(object.x - x, object.y - y);
    if (nextDistance < distance) {
      distance = nextDistance;
      closest = object;
    }
  }
  return closest;
}

function findNearbyAction(
  x: number,
  y: number,
  companionType: CompanionType,
  secondX: number,
  secondY: number,
): NearbyAction {
  const cabin = GAME_ACTION_POINTS.cabin;
  if (Math.hypot(cabin.x - x, cabin.y - y) < cabin.radius) return 'cabin';

  const bench = GAME_ACTION_POINTS.bench;
  if (Math.hypot(bench.x - x, bench.y - y) < bench.radius) return 'bench';

  const fireside = GAME_ACTION_POINTS.fireside;
  if (Math.hypot(fireside.x - x, fireside.y - y) < fireside.radius) return 'fireside';

  const workshop = GAME_ACTION_POINTS.workshop;
  const nearWorkshop = Math.hypot(workshop.x - x, workshop.y - y) < workshop.radius;
  const secondNearWorkshop = Math.hypot(workshop.x - secondX, workshop.y - secondY) < workshop.radius + 12;
  if (nearWorkshop && (companionType !== 'human_local' || secondNearWorkshop)) return 'workshop';

  const pond = GAME_ACTION_POINTS.pond;
  if (Math.hypot(pond.x - x, pond.y - y) < pond.radius) return 'pond';
  return null;
}

function drawScene(
  canvas: HTMLCanvasElement | null,
  images: { map?: HTMLImageElement; characters?: HTMLImageElement; objects?: HTMLImageElement; companion?: HTMLImageElement },
  player: { x: number; y: number; direction: Direction },
  second: { x: number; y: number; direction: Direction },
  playerChar: PlayerCharacter,
  secondPlayerChar: PlayerCharacter,
  objects: WorldObject[],
  companionType: CompanionType,
  nearbyObject: WorldObject | null,
  nearbyAction: NearbyAction,
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

  const map = images.map;
  if (!map?.complete) {
    context.fillStyle = '#071b1d';
    context.fillRect(0, 0, width, height);
    return;
  }

  const scale = Math.max(width / WORLD_WIDTH, height / WORLD_HEIGHT);
  const renderWidth = WORLD_WIDTH * scale;
  const renderHeight = WORLD_HEIGHT * scale;
  const offsetX = (width - renderWidth) / 2;
  const offsetY = (height - renderHeight) / 2;
  const toScreen = (x: number, y: number) => ({
    x: offsetX + x * scale,
    y: offsetY + y * scale,
  });

  context.drawImage(map, offsetX, offsetY, renderWidth, renderHeight);

  objects.forEach((object) => {
    if (object.hidden || !images.objects?.complete) return;
    const point = toScreen(object.x, object.y);
    drawObjectSprite(context, images.objects, object.type, point.x, point.y, scale, object.id === nearbyObject?.id, now, reducedMotion);
  });

  if (companionType === 'human_local' && images.characters?.complete) {
    const point = toScreen(second.x, second.y);
    drawCharacterSprite(context, images.characters, secondPlayerChar.id === 'wanderer' ? 0 : 1, second.direction, point.x, point.y, scale, now, reducedMotion);
  } else if (companionType === 'llm' && images.companion?.complete) {
    const point = toScreen(second.x, second.y);
    const size = 34 * scale;
    context.save();
    context.shadowColor = 'rgba(255, 207, 92, 0.62)';
    context.shadowBlur = 12 * scale;
    context.drawImage(images.companion, point.x - size / 2, point.y - size, size, size);
    context.restore();
  }

  if (images.characters?.complete) {
    const point = toScreen(player.x, player.y);
    drawCharacterSprite(context, images.characters, playerChar.id === 'wanderer' ? 0 : 1, player.direction, point.x, point.y, scale, now, reducedMotion);
  }

  if (nearbyAction) {
    const actionPoint = GAME_ACTION_POINTS[nearbyAction];
    const target = toScreen(actionPoint.x, actionPoint.y);
    context.save();
    context.strokeStyle = 'rgba(255, 210, 128, 0.8)';
    context.lineWidth = Math.max(2, 1.5 * scale);
    context.setLineDash([6 * scale, 5 * scale]);
    context.beginPath();
    context.ellipse(target.x, target.y, 35 * scale, 18 * scale, 0, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  const journeyMarks = objects.filter((object) => object.userConfirmed).slice(-5);
  journeyMarks.forEach((object) => {
    const mark = toScreen(object.x - 12, object.y + 8);
    context.save();
    context.fillStyle = 'rgba(230, 205, 150, 0.3)';
    context.beginPath();
    context.ellipse(mark.x, mark.y, 3 * scale, 5 * scale, -0.4, 0, Math.PI * 2);
    context.fill();
    context.restore();
  });
}

function drawCharacterSprite(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  row: number,
  direction: Direction,
  x: number,
  y: number,
  scale: number,
  now: number,
  reducedMotion: boolean,
) {
  const bob = reducedMotion ? 0 : Math.sin(now / 145) * 1.2 * scale;
  const sourceWidth = image.naturalWidth / 4;
  const sourceHeight = image.naturalHeight / 2;
  const column = CHARACTER_DIRECTIONS[direction];
  const cropX = column * sourceWidth + sourceWidth * 0.17;
  const cropY = row * sourceHeight + sourceHeight * 0.08;
  const cropWidth = sourceWidth * 0.66;
  const cropHeight = sourceHeight * 0.8;
  const height = 64 * scale;
  const width = 44 * scale;
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
}

function drawObjectSprite(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  type: WorldObjectType,
  x: number,
  y: number,
  scale: number,
  active: boolean,
  now: number,
  reducedMotion: boolean,
) {
  const [column, row] = OBJECT_CELLS[type] ?? OBJECT_CELLS.memory_plant;
  const size = (type === 'bench' || type === 'frame' ? 44 : 32) * scale;
  if (active) {
    context.save();
    context.fillStyle = `rgba(255, 210, 128, ${reducedMotion ? 0.15 : 0.12 + Math.sin(now / 260) * 0.04})`;
    context.beginPath();
    context.ellipse(x, y, size * 0.65, size * 0.3, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
  drawAtlasCell(context, image, column, row, 4, 3, x, y, size, size);
}

function drawAtlasCell(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  column: number,
  row: number,
  columns: number,
  rows: number,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const sourceWidth = image.naturalWidth / columns;
  const sourceHeight = image.naturalHeight / rows;
  context.drawImage(
    image,
    column * sourceWidth,
    row * sourceHeight,
    sourceWidth,
    sourceHeight,
    x - width / 2,
    y - height,
    width,
    height,
  );
}
