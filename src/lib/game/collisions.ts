/**
 * 林间世界 — 碰撞检测
 *
 * 采用简单矩形障碍 + 地图边界碰撞。
 * MVP 阶段不做复杂 tile 碰撞，用逻辑区域边界控制可达性。
 */

import { WORLD_WIDTH, WORLD_HEIGHT } from './map';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// 静态障碍列表（大树、建筑等不可穿越区域）
// 格式：{ x, y, w, h } 世界坐标
export const STATIC_OBSTACLES: Rect[] = [
  { x: 130, y: 70, w: 190, h: 135 }, // 木屋
  { x: 618, y: 110, w: 65, h: 40 }, // 篝火核心
  { x: 615, y: 275, w: 145, h: 130 }, // 共写小屋
  { x: 280, y: 295, w: 210, h: 105 }, // 池塘
  { x: 430, y: 220, w: 105, h: 42 }, // 中央木桌
];

// 角色碰撞体（以角色中心计算，半径约 8 单位）
const PLAYER_RADIUS = 8;

/**
 * 检查移动后的位置是否合法
 * 返回实际可移动到的位置（若碰撞则保持原位置的该轴）
 */
export function resolveMovement(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): { x: number; y: number } {
  // 地图边界限制
  const clampedX = Math.max(PLAYER_RADIUS, Math.min(WORLD_WIDTH - PLAYER_RADIUS, toX));
  const clampedY = Math.max(PLAYER_RADIUS, Math.min(WORLD_HEIGHT - PLAYER_RADIUS, toY));

  // 逐轴检测碰撞（先试 X，再试 Y，避免卡墙角）
  let resolvedX = clampedX;
  let resolvedY = fromY;

  // 尝试 X 轴移动
  if (!collidesWithObstacles(clampedX, fromY)) {
    resolvedX = clampedX;
  } else {
    resolvedX = fromX;
  }

  // 尝试 Y 轴移动
  if (!collidesWithObstacles(resolvedX, clampedY)) {
    resolvedY = clampedY;
  } else {
    resolvedY = fromY;
  }

  return { x: resolvedX, y: resolvedY };
}

function collidesWithObstacles(px: number, py: number): boolean {
  for (const obs of STATIC_OBSTACLES) {
    // 圆形角色与矩形障碍的 AABB 碰撞
    const closestX = Math.max(obs.x, Math.min(px, obs.x + obs.w));
    const closestY = Math.max(obs.y, Math.min(py, obs.y + obs.h));
    const distX = px - closestX;
    const distY = py - closestY;
    if (distX * distX + distY * distY < PLAYER_RADIUS * PLAYER_RADIUS) {
      return true;
    }
  }
  return false;
}

/**
 * 检查两点之间是否有障碍（用于 AI 同行者路径判断）
 */
export function hasLineOfSight(
  x1: number, y1: number,
  x2: number, y2: number,
  steps = 10,
): boolean {
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = x1 + (x2 - x1) * t;
    const cy = y1 + (y2 - y1) * t;
    if (collidesWithObstacles(cx, cy)) return false;
  }
  return true;
}

/**
 * 检查某点是否在地图内且无障碍
 */
export function isWalkable(x: number, y: number): boolean {
  if (x < PLAYER_RADIUS || x > WORLD_WIDTH - PLAYER_RADIUS) return false;
  if (y < PLAYER_RADIUS || y > WORLD_HEIGHT - PLAYER_RADIUS) return false;
  return !collidesWithObstacles(x, y);
}

/**
 * 计算两点距离
 */
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}
