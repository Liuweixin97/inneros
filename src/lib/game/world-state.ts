/**
 * 林间世界 — 世界状态管理（客户端 + 服务端同步）
 *
 * 采用 API-first 方案（SQLite）。
 * 失败时不阻止用户离开，在内存中保留未同步状态。
 */

import type {
  GameWorld,
  WorldObject,
  WorldObjectType,
  CompanionType,
  DialogueMode,
  CompanionSession,
  GameWorldSettings,
  MapLocation,
} from '@/types';
import { suggestPlacementPosition } from './memo-mapper';

interface WorldStateCache {
  world: GameWorld | null;
  objects: WorldObject[];
  session: CompanionSession | null;
  pendingSync: boolean;
}

// 内存缓存（避免频繁 API 请求）
let cache: WorldStateCache = {
  world: null,
  objects: [],
  session: null,
  pendingSync: false,
};

// ---- 世界加载 ----

export async function loadWorld(): Promise<{ world: GameWorld; objects: WorldObject[] }> {
  try {
    const res = await fetch('/api/game/world');
    if (!res.ok) throw new Error('API error');
    const data = await res.json() as { world: GameWorld; objects: WorldObject[] };
    cache.world = data.world;
    cache.objects = data.objects;
    cache.pendingSync = false;
    return data;
  } catch (error) {
    console.warn('[world-state] 加载世界状态失败，使用缓存', error);
    if (cache.world) {
      return { world: cache.world, objects: cache.objects };
    }
    throw error;
  }
}

// ---- 玩家位置同步（防抖，每 3 秒最多一次）----

let positionSyncTimer: ReturnType<typeof setTimeout> | null = null;

export function syncPlayerPosition(worldId: string, x: number, y: number): void {
  if (cache.world) {
    cache.world = { ...cache.world, playerX: x, playerY: y };
  }

  if (positionSyncTimer) clearTimeout(positionSyncTimer);
  positionSyncTimer = setTimeout(async () => {
    try {
      await fetch('/api/game/world', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerX: x, playerY: y }),
      });
    } catch {
      // 位置同步失败不影响游戏体验
    }
  }, 3000);
}

// ---- 设置更新 ----

export async function updateSettings(settings: Partial<GameWorldSettings>): Promise<void> {
  if (cache.world) {
    cache.world = {
      ...cache.world,
      settings: { ...cache.world.settings, ...settings },
    };
  }
  try {
    await fetch('/api/game/world', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings }),
    });
  } catch (error) {
    console.warn('[world-state] 设置同步失败', error);
  }
}

// ---- 世界对象操作 ----

export async function placeObject(input: {
  type: WorldObjectType;
  location?: MapLocation;
  x?: number;
  y?: number;
  sourceMemoIds?: string[];
  sourceSessionId?: string;
  annotation?: string;
  userConfirmed?: boolean;
}): Promise<WorldObject | null> {
  const pos = (input.x !== undefined && input.y !== undefined)
    ? { x: input.x, y: input.y }
    : suggestPlacementPosition(input.location ?? 'garden', input.type);

  try {
    const res = await fetch('/api/game/world', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'place_object',
        object: {
          type: input.type,
          x: pos.x,
          y: pos.y,
          layer: 1,
          sourceMemoIds: input.sourceMemoIds ?? [],
          sourceSessionId: input.sourceSessionId,
          annotation: input.annotation,
          userConfirmed: input.userConfirmed ?? false,
          metadata: {},
        },
      }),
    });
    if (!res.ok) throw new Error('API error');
    const data = await res.json() as { object: WorldObject };
    cache.objects = [...cache.objects, data.object];
    return data.object;
  } catch (error) {
    console.error('[world-state] 放置物件失败', error);
    return null;
  }
}

export async function hideObject(objectId: string): Promise<void> {
  cache.objects = cache.objects.filter((o) => o.id !== objectId);
  try {
    await fetch('/api/game/world', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'hide_object', objectId }),
    });
  } catch (error) {
    console.warn('[world-state] 隐藏物件失败', error);
  }
}

export async function annotateObject(objectId: string, annotation: string): Promise<void> {
  cache.objects = cache.objects.map((o) =>
    o.id === objectId ? { ...o, annotation } : o,
  );
  try {
    await fetch('/api/game/world', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_object',
        objectId,
        updates: { annotation },
      }),
    });
  } catch (error) {
    console.warn('[world-state] 注释物件失败', error);
  }
}

// ---- Memo 加载 ----

export async function loadGameMemos(
  mode: 'recent' | 'selected' = 'recent',
  selectedIds?: string[],
) {
  const url = mode === 'selected' && selectedIds?.length
    ? `/api/game/memos?ids=${selectedIds.join(',')}`
    : '/api/game/memos?limit=20';

  const res = await fetch(url);
  if (!res.ok) throw new Error('无法加载 Memo');
  return res.json();
}

// ---- 同行者会话 ----

export async function startCompanionSession(input: {
  worldId: string;
  companionType: CompanionType;
  dialogueMode?: DialogueMode;
  authorizedMemoIds?: string[];
}): Promise<CompanionSession | null> {
  try {
    const res = await fetch('/api/game/world', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'start_session',
        session: input,
      }),
    });
    if (!res.ok) throw new Error('API error');
    // Note: session creation is handled server-side via companion API
    return null;
  } catch {
    return null;
  }
}

// ---- AI 同行者对话 ----

export interface CompanionMessage {
  role: 'user' | 'assistant';
  content: string;
  isInference?: boolean;
  suggestedActions?: string[];
}

export async function sendCompanionMessage(input: {
  message: string;
  sessionId?: string;
  location: string;
  dialogueMode: DialogueMode;
  authorizedMemoIds?: string[];
  conversationHistory?: CompanionMessage[];
  recentUserAction?: string;
  onChunk?: (text: string) => void;
}): Promise<CompanionMessage | null> {
  try {
    const res = await fetch('/api/game/companion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: input.message,
        sessionId: input.sessionId,
        location: input.location,
        dialogueMode: input.dialogueMode,
        authorizedMemoIds: input.authorizedMemoIds ?? [],
        conversationHistory: input.conversationHistory?.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        recentUserAction: input.recentUserAction,
      }),
    });

    if (!res.ok || !res.body) throw new Error('同行者无响应');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalMessage: CompanionMessage | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(line.slice(6)) as Record<string, unknown>;
          if (event.type === 'chunk' && typeof event.content === 'string') {
            input.onChunk?.(event.content);
          } else if (event.type === 'done' && typeof event.text === 'string') {
            finalMessage = {
              role: 'assistant',
              content: event.text,
              isInference: Boolean(event.isInference),
              suggestedActions: Array.isArray(event.suggestedActions)
                ? event.suggestedActions as string[]
                : [],
            };
          }
        } catch {
          // ignore malformed SSE lines
        }
      }
    }

    return finalMessage;
  } catch (error) {
    console.error('[world-state] 同行者消息发送失败', error);
    return null;
  }
}

// ---- 缓存访问器 ----

export function getCachedWorld(): GameWorld | null {
  return cache.world;
}

export function getCachedObjects(): WorldObject[] {
  return cache.objects;
}

export function clearCache(): void {
  cache = {
    world: null,
    objects: [],
    session: null,
    pendingSync: false,
  };
}
