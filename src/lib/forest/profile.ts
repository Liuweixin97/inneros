import 'server-only';

import { getDb } from '@/lib/db';
import { FOREST_DAY_OPTIONS } from './types';
import type {
  ForestNodeId,
  ForestProfile,
  ForestTaskChoice,
  ForestWindowRequest,
} from './types';

const DEFAULT_X = 365;
const DEFAULT_Y = 235;
const NODE_IDS = new Set<ForestNodeId>([
  'lantern-cabin',
  'year-ring-path',
  'echo-hearth',
  'twin-shadow-pond',
  'root-court',
  'windwatch-terrace',
]);

interface ForestProfileRow {
  player_x: number;
  player_y: number;
  character_id: string;
  active_window: string;
  visited_node_ids: string;
  task_choices: string;
  updated_at: string;
}

export interface ForestProfileUpdates {
  playerX?: number;
  playerY?: number;
  characterId?: 'wanderer' | 'drifter';
  activeWindow?: ForestWindowRequest;
  visitedNodeIds?: ForestNodeId[];
  taskChoices?: Partial<Record<ForestNodeId, ForestTaskChoice>>;
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function isWindow(value: unknown): value is ForestWindowRequest {
  return value === 'auto' || FOREST_DAY_OPTIONS.includes(value as (typeof FOREST_DAY_OPTIONS)[number]);
}

function sanitizeVisited(value: unknown): ForestNodeId[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is ForestNodeId => (
    typeof item === 'string' && NODE_IDS.has(item as ForestNodeId)
  )))];
}

function sanitizeChoices(value: unknown): Partial<Record<ForestNodeId, ForestTaskChoice>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Partial<Record<ForestNodeId, ForestTaskChoice>> = {};
  for (const [key, rawChoice] of Object.entries(value)) {
    if (!NODE_IDS.has(key as ForestNodeId) || !rawChoice || typeof rawChoice !== 'object' || Array.isArray(rawChoice)) continue;
    const choice = rawChoice as Record<string, unknown>;
    if (typeof choice.observationId !== 'string' || typeof choice.label !== 'string') continue;
    result[key as ForestNodeId] = {
      observationId: choice.observationId.slice(0, 120),
      label: choice.label.trim().slice(0, 120),
      updatedAt: typeof choice.updatedAt === 'string' ? choice.updatedAt : new Date().toISOString(),
    };
  }
  return result;
}

function defaultProfile(persistent: boolean): ForestProfile {
  return {
    playerX: DEFAULT_X,
    playerY: DEFAULT_Y,
    characterId: 'wanderer',
    activeWindow: 'auto',
    visitedNodeIds: [],
    taskChoices: {},
    updatedAt: null,
    persistent,
  };
}

function parseProfile(row: ForestProfileRow, persistent: boolean): ForestProfile {
  const activeWindow = row.active_window === 'auto' ? 'auto' : Number(row.active_window);
  return {
    playerX: Number.isFinite(row.player_x) ? row.player_x : DEFAULT_X,
    playerY: Number.isFinite(row.player_y) ? row.player_y : DEFAULT_Y,
    characterId: row.character_id === 'drifter' ? 'drifter' : 'wanderer',
    activeWindow: isWindow(activeWindow) ? activeWindow : 'auto',
    visitedNodeIds: sanitizeVisited(parseJson<unknown>(row.visited_node_ids, [])),
    taskChoices: sanitizeChoices(parseJson<unknown>(row.task_choices, {})),
    updatedAt: row.updated_at,
    persistent,
  };
}

export function getForestProfile(userId: string, options: { persistent: boolean }): ForestProfile {
  if (!options.persistent) return defaultProfile(false);
  const db = getDb();
  const existing = db.prepare(`
    SELECT player_x, player_y, character_id, active_window,
           visited_node_ids, task_choices, updated_at
    FROM forest_profiles
    WHERE user_id = ?
  `).get(userId) as ForestProfileRow | undefined;
  if (existing) return parseProfile(existing, true);

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO forest_profiles (
      user_id, player_x, player_y, character_id, active_window,
      visited_node_ids, task_choices, updated_at
    ) VALUES (?, ?, ?, 'wanderer', 'auto', '[]', '{}', ?)
  `).run(userId, DEFAULT_X, DEFAULT_Y, now);
  return { ...defaultProfile(true), updatedAt: now };
}

export function updateForestProfile(userId: string, updates: ForestProfileUpdates): ForestProfile {
  const current = getForestProfile(userId, { persistent: true });
  const next: ForestProfile = {
    ...current,
    ...(typeof updates.playerX === 'number' && Number.isFinite(updates.playerX)
      ? { playerX: Math.max(8, Math.min(792, updates.playerX)) }
      : {}),
    ...(typeof updates.playerY === 'number' && Number.isFinite(updates.playerY)
      ? { playerY: Math.max(8, Math.min(442, updates.playerY)) }
      : {}),
    ...(updates.characterId ? { characterId: updates.characterId } : {}),
    ...(updates.activeWindow && isWindow(updates.activeWindow) ? { activeWindow: updates.activeWindow } : {}),
    ...(updates.visitedNodeIds ? { visitedNodeIds: sanitizeVisited(updates.visitedNodeIds) } : {}),
    ...(updates.taskChoices ? { taskChoices: sanitizeChoices(updates.taskChoices) } : {}),
    updatedAt: new Date().toISOString(),
    persistent: true,
  };

  getDb().prepare(`
    UPDATE forest_profiles
    SET player_x = ?, player_y = ?, character_id = ?, active_window = ?,
        visited_node_ids = ?, task_choices = ?, updated_at = ?
    WHERE user_id = ?
  `).run(
    next.playerX,
    next.playerY,
    next.characterId,
    String(next.activeWindow),
    JSON.stringify(next.visitedNodeIds),
    JSON.stringify(next.taskChoices),
    next.updatedAt,
    userId,
  );
  return next;
}
