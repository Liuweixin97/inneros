/**
 * 林间世界 — 地图数据与区域定义
 *
 * MVP 采用逻辑坐标系，Canvas 渲染时缩放到实际尺寸。
 * 世界坐标：800 × 450 单位（每单位 = 1 游戏像素）
 * Tile 大小：16 × 16 单位
 */

import type { MapLocation } from '@/types';

export const WORLD_WIDTH = 800;
export const WORLD_HEIGHT = 450;
export const TILE_SIZE = 16;

export type GameActionId = 'cabin' | 'bench' | 'fireside' | 'workshop' | 'pond';

export interface GameActionPoint {
  id: GameActionId;
  x: number;
  y: number;
  radius: number;
}

// 互动点使用可行走的地标边缘坐标，HUD 区域仍使用地标中心。
export const GAME_ACTION_POINTS: Record<GameActionId, GameActionPoint> = {
  cabin: { id: 'cabin', x: 332, y: 222, radius: 44 },
  bench: { id: 'bench', x: 165, y: 326, radius: 48 },
  fireside: { id: 'fireside', x: 650, y: 170, radius: 54 },
  workshop: { id: 'workshop', x: 590, y: 335, radius: 52 },
  pond: { id: 'pond', x: 380, y: 285, radius: 52 },
};

// 地图区域定义：中心点 + 半径（椭圆触发区）
export interface MapRegion {
  id: MapLocation;
  name: string;
  subtitle: string;
  cx: number;   // 区域中心 x
  cy: number;   // 区域中心 y
  rx: number;   // 触发半径 x（椭圆）
  ry: number;   // 触发半径 y（椭圆）
  color: string; // 区域代表色（CSS）
  icon: string;  // 区域图标（emoji）
}

export const MAP_REGIONS: MapRegion[] = [
  {
    id: 'cabin',
    name: '亮灯木屋',
    subtitle: '归处',
    cx: 270,
    cy: 220,
    rx: 80,
    ry: 55,
    color: '#A0622A',
    icon: 'cabin',
  },
  {
    id: 'garden',
    name: '记忆花园',
    subtitle: '曾经发生过',
    cx: 480,
    cy: 145,
    rx: 75,
    ry: 50,
    color: '#7DB85A',
    icon: 'garden',
  },
  {
    id: 'fireside',
    name: '篝火地',
    subtitle: '一起说',
    cx: 650,
    cy: 170,
    rx: 70,
    ry: 55,
    color: '#FF9B3D',
    icon: 'fireside',
  },
  {
    id: 'pond',
    name: '静水池塘',
    subtitle: '不必回答',
    cx: 380,
    cy: 340,
    rx: 105,
    ry: 60,
    color: '#5B9BD5',
    icon: 'pond',
  },
  {
    id: 'workshop',
    name: '共居工坊',
    subtitle: '一起留下',
    cx: 665,
    cy: 335,
    rx: 75,
    ry: 65,
    color: '#C4A882',
    icon: 'workshop',
  },
  {
    id: 'forest',
    name: '林间小径',
    subtitle: '慢慢走',
    cx: 110,
    cy: 105,
    rx: 90,
    ry: 70,
    color: '#4A7C2F',
    icon: 'forest',
  },
];

// 地图路径（连接区域的小路）
export interface MapPath {
  fromId: MapLocation;
  toId: MapLocation;
  waypoints?: [number, number][];
}

export const MAP_PATHS: MapPath[] = [
  { fromId: 'cabin', toId: 'garden' },
  { fromId: 'cabin', toId: 'fireside' },
  { fromId: 'cabin', toId: 'pond' },
  { fromId: 'cabin', toId: 'workshop' },
  { fromId: 'cabin', toId: 'forest' },
  { fromId: 'garden', toId: 'forest' },
  { fromId: 'fireside', toId: 'workshop' },
];

// 地图装饰物（树木、草地、石头等静态元素）
export interface MapDecor {
  type: 'tree' | 'bush' | 'rock' | 'grass' | 'flower' | 'water_lily';
  x: number;
  y: number;
  scale?: number;
}

// 预置装饰物（固定，不来自 Memo）
export const MAP_DECORS: MapDecor[] = [
  // 森林区域的树木
  { type: 'tree', x: 80, y: 120 },
  { type: 'tree', x: 130, y: 90 },
  { type: 'tree', x: 100, y: 200 },
  { type: 'tree', x: 180, y: 130 },
  { type: 'tree', x: 220, y: 100 },
  { type: 'tree', x: 60, y: 230 },
  // 花园区域的花草
  { type: 'flower', x: 150, y: 360 },
  { type: 'flower', x: 220, y: 420 },
  { type: 'bush', x: 170, y: 430 },
  { type: 'bush', x: 240, y: 350 },
  // 池塘周围
  { type: 'water_lily', x: 380, y: 510 },
  { type: 'water_lily', x: 420, y: 520 },
  { type: 'rock', x: 340, y: 490 },
  // 木屋周围
  { type: 'bush', x: 340, y: 280 },
  { type: 'flower', x: 460, y: 260 },
  // 工坊周围
  { type: 'rock', x: 560, y: 160 },
  { type: 'bush', x: 680, y: 180 },
  // 散落
  { type: 'grass', x: 300, y: 200 },
  { type: 'grass', x: 500, y: 350 },
  { type: 'rock', x: 480, y: 180 },
  { type: 'tree', x: 720, y: 300 },
  { type: 'tree', x: 750, y: 400 },
];

// 判断玩家是否在某区域内（椭圆碰撞）
export function getPlayerLocation(playerX: number, playerY: number): MapLocation | null {
  for (const region of MAP_REGIONS) {
    const dx = (playerX - region.cx) / region.rx;
    const dy = (playerY - region.cy) / region.ry;
    if (dx * dx + dy * dy <= 1) {
      return region.id;
    }
  }
  return null;
}

// 获取区域信息
export function getRegion(id: MapLocation): MapRegion | undefined {
  return MAP_REGIONS.find((r) => r.id === id);
}

// 两区域中心点距离
export function regionDistance(aId: MapLocation, bId: MapLocation): number {
  const a = getRegion(aId);
  const b = getRegion(bId);
  if (!a || !b) return Infinity;
  return Math.hypot(a.cx - b.cx, a.cy - b.cy);
}

// 世界坐标转 Canvas 像素（支持视口偏移和缩放）
export function worldToCanvas(
  worldX: number,
  worldY: number,
  scale: number,
  viewportX: number,
  viewportY: number,
): [number, number] {
  return [
    (worldX - viewportX) * scale,
    (worldY - viewportY) * scale,
  ];
}

// Canvas 像素转世界坐标
export function canvasToWorld(
  canvasX: number,
  canvasY: number,
  scale: number,
  viewportX: number,
  viewportY: number,
): [number, number] {
  return [
    canvasX / scale + viewportX,
    canvasY / scale + viewportY,
  ];
}

// 计算视口（保持玩家居中，但限制在地图边界内）
export function calculateViewport(
  playerX: number,
  playerY: number,
  canvasWidth: number,
  canvasHeight: number,
  scale: number,
): { viewX: number; viewY: number } {
  const viewW = canvasWidth / scale;
  const viewH = canvasHeight / scale;

  let viewX = playerX - viewW / 2;
  let viewY = playerY - viewH / 2;

  // 限制在地图边界
  viewX = Math.max(0, Math.min(WORLD_WIDTH - viewW, viewX));
  viewY = Math.max(0, Math.min(WORLD_HEIGHT - viewH, viewY));

  return { viewX, viewY };
}
