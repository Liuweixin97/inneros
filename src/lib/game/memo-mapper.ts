/**
 * 林间世界 — Memo → 世界对象映射规则
 *
 * 设计原则（来自 PRD §11）：
 * - 原始 Memo 是唯一事实源，世界对象是可视化索引层
 * - 植物大小不代表 Memo 价值
 * - 颜色不直接代表「正负情绪」
 * - 无内容时保留空地，不生成假记忆
 */

import type { Memo, WorldObjectType, WorldObject } from '@/types';
import { MAP_REGIONS } from './map';
import type { MapLocation } from '@/types';

export interface MappedObject {
  type: WorldObjectType;
  x: number;
  y: number;
  layer: number;
  sourceMemoIds: string[];
  userConfirmed: boolean;
  metadata: {
    hintText: string;     // 靠近时显示的轻提示（不是 Memo 全文）
    memoDate: string;     // 显示用日期
    memoTitle: string | null; // AI 标题（如有）
  };
}

/**
 * 将 Memo 列表映射为世界对象候选
 * （候选，不直接写入 DB，由 GameShell 确认后写入）
 */
export function mapMemosToWorldObjects(
  memos: Memo[],
  existingObjects: WorldObject[],
): MappedObject[] {
  if (memos.length === 0) return [];

  const existingMemoIds = new Set(
    existingObjects.flatMap((o) => o.sourceMemoIds),
  );

  // 只处理还没有对应世界对象的 Memo
  const newMemos = memos.filter((m) => !existingMemoIds.has(m.id));
  if (newMemos.length === 0) return [];

  // 记忆花园区域的可放置坐标（分散分布，不重叠）
  const gardenRegion = MAP_REGIONS.find((r) => r.id === 'garden')!;
  const placementGrid = generatePlacementGrid(
    gardenRegion.cx,
    gardenRegion.cy,
    gardenRegion.rx - 10,
    gardenRegion.ry - 10,
    newMemos.length,
  );

  return newMemos.map((memo, i) => {
    const pos = placementGrid[i] ?? { x: gardenRegion.cx, y: gardenRegion.cy };
    const type = selectObjectType(memo);
    const hintText = generateHintText(memo);

    return {
      type,
      x: pos.x,
      y: pos.y,
      layer: 1,
      sourceMemoIds: [memo.id],
      userConfirmed: false,
      metadata: {
        hintText,
        memoDate: memo.created_at.slice(0, 10),
        memoTitle: memo.ai_title,
      },
    };
  });
}

/**
 * 根据 Memo 特征选择世界对象类型
 * 注意：不用颜色或大小表示情绪正负，只按时间和来源区分形态
 */
function selectObjectType(memo: Memo): WorldObjectType {
  // 带有标签的 → 风铃
  if (memo.original_tags.length > 0) {
    return 'windchime';
  }
  // 较长的记录 → 信件
  if (memo.plain_text.length > 300) {
    return 'letter';
  }
  // 已整理过的短记录 → 小灯
  if (memo.ai_title && memo.analysis_status === 'done') {
    return 'lamp';
  }
  // 默认 → 植物（最基础、最自然的形态）
  return 'memory_plant';
}

/**
 * 生成靠近提示文案（不泄露 Memo 全文，只给一个温和的入口）
 */
function generateHintText(memo: Memo): string {
  const date = new Date(memo.created_at);
  const dateStr = `${date.getMonth() + 1}月${date.getDate()}日`;

  if (memo.ai_title) {
    return `你曾在 ${dateStr} 留下一些话：「${memo.ai_title}」`;
  }

  // 取纯文本前 30 字作为提示
  const preview = memo.plain_text.slice(0, 30).replace(/\n/g, ' ').trim();
  if (preview.length > 0) {
    return `你曾在 ${dateStr} 写道：「${preview}${memo.plain_text.length > 30 ? '……' : ''}」`;
  }

  return `你曾在 ${dateStr} 留下过一些话。`;
}

/**
 * 生成区域内分散的放置坐标网格（避免物件堆叠）
 */
function generatePlacementGrid(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  count: number,
): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];

  if (count <= 0) return positions;

  // 使用黄金角分布（fibonacci spiral）在椭圆内分散点
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i++) {
    const r = Math.sqrt((i + 0.5) / count);
    const theta = goldenAngle * i;
    positions.push({
      x: Math.round(cx + rx * r * Math.cos(theta)),
      y: Math.round(cy + ry * r * Math.sin(theta)),
    });
  }

  return positions;
}

/**
 * 根据地图区域和物件类型，推荐放置位置
 * 用于用户手动放置物件时的位置建议
 */
export function suggestPlacementPosition(
  location: MapLocation,
): { x: number; y: number } {
  const region = MAP_REGIONS.find((r) => r.id === location);
  if (!region) return { x: 400, y: 300 };

  // 在区域内随机偏移
  const offsetX = (Math.random() - 0.5) * region.rx * 1.2;
  const offsetY = (Math.random() - 0.5) * region.ry * 1.2;

  return {
    x: Math.round(region.cx + offsetX),
    y: Math.round(region.cy + offsetY),
  };
}

export const REFLECTION_OBJECT_TEMPLATES: Array<{
  type: WorldObjectType;
  name: string;
  description: string;
}> = [
  { type: 'sign', name: '木牌', description: '写下我今天看见的关系' },
  { type: 'frame', name: '纸框', description: '夹住一组暂时有关的记忆' },
  { type: 'lamp', name: '小灯', description: '标出以后再看的线索' },
  { type: 'bottle', name: '漂流瓶', description: '封存一段暂时不想打开的话' },
];
