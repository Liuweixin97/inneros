/**
 * 林间世界 — SVG 像素角色动画
 *
 * MVP 使用 SVG 手绘风角色（非 sprite sheet 图片资产），
 * 每个方向有简单的行走帧动画（通过 CSS 实现）。
 */

import type { PlayerCharacter } from '@/types';

// 默认角色预设（6–8 个）
export const CHARACTER_PRESETS: PlayerCharacter[] = [
  {
    id: 'wanderer',
    displayName: '漫游者',
    colorSkin: '#F5CBA7',
    colorHair: '#5D3A1A',
    colorOutfit: '#7DB85A',
  },
  {
    id: 'drifter',
    displayName: '旅人',
    colorSkin: '#FADBD8',
    colorHair: '#1A1A2E',
    colorOutfit: '#5B9BD5',
  },
  {
    id: 'hermit',
    displayName: '隐者',
    colorSkin: '#D4AC0D',
    colorHair: '#7B3F00',
    colorOutfit: '#A0622A',
  },
  {
    id: 'dreamer',
    displayName: '梦者',
    colorSkin: '#E8DAEF',
    colorHair: '#76448A',
    colorOutfit: '#FFC4D0',
  },
  {
    id: 'keeper',
    displayName: '守者',
    colorSkin: '#A9CCE3',
    colorHair: '#2E4057',
    colorOutfit: '#2E4057',
  },
  {
    id: 'ember',
    displayName: '余烬',
    colorSkin: '#F9CBA5',
    colorHair: '#E74C3C',
    colorOutfit: '#E67E22',
  },
];

export function getDefaultCharacter(): PlayerCharacter {
  return CHARACTER_PRESETS[0];
}

export function getCharacterById(id: string): PlayerCharacter {
  return CHARACTER_PRESETS.find((c) => c.id === id) ?? CHARACTER_PRESETS[0];
}

// 动画帧配置
export interface SpriteFrame {
  // 手绘 SVG 用 CSS transform 模拟帧
  bodyOffsetY: number;  // 身体上下偏移（行走）
  armAngle: number;     // 手臂摆动角度（度）
  legAngle: number;     // 腿部摆动角度
}

// 4 帧行走动画
export const WALK_FRAMES: SpriteFrame[] = [
  { bodyOffsetY: 0,  armAngle:  12, legAngle: -12 },
  { bodyOffsetY: -1, armAngle:   4, legAngle:  -4 },
  { bodyOffsetY: 0,  armAngle: -12, legAngle:  12 },
  { bodyOffsetY: -1, armAngle:  -4, legAngle:   4 },
];

// 站立帧
export const IDLE_FRAME: SpriteFrame = {
  bodyOffsetY: 0,
  armAngle: 0,
  legAngle: 0,
};

/**
 * 生成角色 SVG 字符串（可内嵌到 Canvas 或作为 img src）
 * 尺寸约 16×24 单位，可通过外部 scale 控制
 */
export function generateCharacterSVG(
  character: PlayerCharacter,
  frame: SpriteFrame = IDLE_FRAME,
  direction: 'up' | 'down' | 'left' | 'right' = 'down',
  size = 32,
): string {
  const { colorSkin, colorHair, colorOutfit } = character;

  // 根据方向决定是否镜像
  const flip = direction === 'left' ? 'scale(-1,1) translate(-32,0)' : '';

  // 帧偏移
  const bodyY = frame.bodyOffsetY;
  const armA = frame.armAngle;
  const legA = frame.legAngle;

  // 简化的像素风 SVG 角色（16×24 基础网格，渲染为 32px 时 2x 缩放）
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size * 1.5}" viewBox="0 0 16 24" shape-rendering="crispEdges">
  <g transform="${flip}">
    <!-- 头发 -->
    <rect x="4" y="${2 + bodyY}" width="8" height="3" fill="${colorHair}" />
    <!-- 脸 -->
    <rect x="4" y="${5 + bodyY}" width="8" height="6" fill="${colorSkin}" />
    <!-- 眼睛 -->
    ${direction !== 'up' ? `
    <rect x="5" y="${7 + bodyY}" width="2" height="1" fill="#3B2E2A" />
    <rect x="9" y="${7 + bodyY}" width="2" height="1" fill="#3B2E2A" />
    ` : ''}
    <!-- 身体 -->
    <rect x="4" y="${11 + bodyY}" width="8" height="7" fill="${colorOutfit}" />
    <!-- 左臂 -->
    <g transform="rotate(${-armA}, 4, ${13 + bodyY})">
      <rect x="1" y="${11 + bodyY}" width="3" height="5" fill="${colorOutfit}" />
    </g>
    <!-- 右臂 -->
    <g transform="rotate(${armA}, 12, ${13 + bodyY})">
      <rect x="12" y="${11 + bodyY}" width="3" height="5" fill="${colorOutfit}" />
    </g>
    <!-- 左腿 -->
    <g transform="rotate(${legA}, 6, ${18 + bodyY})">
      <rect x="4" y="${18 + bodyY}" width="4" height="5" fill="${colorSkin}" />
    </g>
    <!-- 右腿 -->
    <g transform="rotate(${-legA}, 10, ${18 + bodyY})">
      <rect x="8" y="${18 + bodyY}" width="4" height="5" fill="${colorSkin}" />
    </g>
  </g>
</svg>`;
}

/**
 * SVG 字符串转 data URL（用于 Canvas drawImage）
 */
export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * 根据时间戳获取行走帧索引
 */
export function getWalkFrameIndex(timestamp: number, fps = 8): number {
  return Math.floor((timestamp / 1000) * fps) % WALK_FRAMES.length;
}
