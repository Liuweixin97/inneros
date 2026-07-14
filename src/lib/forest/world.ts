import type { ForestNodeId } from './types';

export const FOREST_WORLD_WIDTH = 800;
export const FOREST_WORLD_HEIGHT = 450;
export const FOREST_PLAYER_START = { x: 365, y: 235 } as const;

export interface ForestWorldNode {
  id: ForestNodeId;
  x: number;
  y: number;
  radius: number;
  mapX: number;
  mapY: number;
}

export const FOREST_WORLD_NODES: Record<ForestNodeId, ForestWorldNode> = {
  'lantern-cabin': { id: 'lantern-cabin', x: 332, y: 222, radius: 44, mapX: 29, mapY: 43 },
  'year-ring-path': { id: 'year-ring-path', x: 165, y: 326, radius: 46, mapX: 22, mapY: 67 },
  'echo-hearth': { id: 'echo-hearth', x: 650, y: 170, radius: 52, mapX: 79, mapY: 40 },
  'twin-shadow-pond': { id: 'twin-shadow-pond', x: 380, y: 285, radius: 45, mapX: 45, mapY: 72 },
  'root-court': { id: 'root-court', x: 480, y: 145, radius: 46, mapX: 53, mapY: 34 },
  'windwatch-terrace': { id: 'windwatch-terrace', x: 590, y: 335, radius: 48, mapX: 81, mapY: 68 },
};

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const OBSTACLES: readonly Rect[] = [
  { x: 130, y: 70, width: 190, height: 135 },
  { x: 618, y: 110, width: 65, height: 40 },
  { x: 615, y: 275, width: 145, height: 130 },
  { x: 280, y: 295, width: 210, height: 105 },
  { x: 430, y: 220, width: 105, height: 42 },
];

const PLAYER_RADIUS = 8;

function collides(x: number, y: number): boolean {
  return OBSTACLES.some((obstacle) => {
    const closestX = Math.max(obstacle.x, Math.min(x, obstacle.x + obstacle.width));
    const closestY = Math.max(obstacle.y, Math.min(y, obstacle.y + obstacle.height));
    return (x - closestX) ** 2 + (y - closestY) ** 2 < PLAYER_RADIUS ** 2;
  });
}

export function isForestWalkable(x: number, y: number): boolean {
  return x >= PLAYER_RADIUS
    && x <= FOREST_WORLD_WIDTH - PLAYER_RADIUS
    && y >= PLAYER_RADIUS
    && y <= FOREST_WORLD_HEIGHT - PLAYER_RADIUS
    && !collides(x, y);
}

export function resolveForestMovement(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): { x: number; y: number } {
  const clampedX = Math.max(PLAYER_RADIUS, Math.min(FOREST_WORLD_WIDTH - PLAYER_RADIUS, toX));
  const clampedY = Math.max(PLAYER_RADIUS, Math.min(FOREST_WORLD_HEIGHT - PLAYER_RADIUS, toY));
  const x = collides(clampedX, fromY) ? fromX : clampedX;
  const y = collides(x, clampedY) ? fromY : clampedY;
  return { x, y };
}

export function findNearbyForestNode(x: number, y: number): ForestNodeId | null {
  let closest: { id: ForestNodeId; distance: number } | null = null;
  for (const node of Object.values(FOREST_WORLD_NODES)) {
    const distance = Math.hypot(node.x - x, node.y - y);
    if (distance <= node.radius && (!closest || distance < closest.distance)) {
      closest = { id: node.id, distance };
    }
  }
  return closest?.id ?? null;
}
