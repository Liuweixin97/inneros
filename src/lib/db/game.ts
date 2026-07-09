import { v4 as uuidv4 } from 'uuid';
import type {
  GameWorld,
  GameWorldSettings,
  WorldObject,
  WorldObjectType,
  CompanionSession,
  CompanionType,
  DialogueMode,
  GameSeason,
  GamePondEntry,
  GameWeeklyReview,
} from '@/types';
import { DEFAULT_OWNER_USER_ID, getDb } from './index';

// ---- 内部解析 ----

function parseWorld(row: Record<string, unknown>): GameWorld {
  return {
    id: row.id as string,
    ownerUserId: (row.owner_user_id || row.user_id || DEFAULT_OWNER_USER_ID) as string,
    displayName: row.display_name as string,
    createdAt: row.created_at as string,
    lastVisitedAt: row.last_visited_at as string,
    season: row.season as GameSeason,
    playerX: row.player_x as number,
    playerY: row.player_y as number,
    settings: JSON.parse(row.settings as string) as GameWorldSettings,
  };
}

function parseJsonArray(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function parseWorldObject(row: Record<string, unknown>): WorldObject {
  return {
    id: row.id as string,
    worldId: row.world_id as string,
    type: row.type as WorldObjectType,
    x: row.x as number,
    y: row.y as number,
    layer: row.layer as number,
    sourceMemoIds: parseJsonArray(row.source_memo_ids),
    sourceSessionId: row.source_session_id as string | undefined,
    userConfirmed: Boolean(row.user_confirmed),
    hidden: Boolean(row.hidden),
    annotation: row.annotation as string | undefined,
    metadata: parseJsonObject(row.metadata),
    createdAt: row.created_at as string,
  };
}

function parseCompanionSession(row: Record<string, unknown>): CompanionSession {
  return {
    id: row.id as string,
    worldId: row.world_id as string,
    companionType: row.companion_type as CompanionType,
    dialogueMode: row.dialogue_mode as DialogueMode,
    authorizedMemoIds: parseJsonArray(row.authorized_memo_ids),
    startedAt: row.started_at as string,
    endedAt: row.ended_at as string | undefined,
  };
}

function parsePondEntry(row: Record<string, unknown>): GamePondEntry {
  return {
    id: row.id as string,
    worldId: row.world_id as string,
    userId: row.user_id as string,
    content: row.content as string,
    createdAt: row.created_at as string,
  };
}

function parseWeeklyReview(row: Record<string, unknown>): GameWeeklyReview {
  return {
    id: row.id as string,
    worldId: row.world_id as string,
    userId: row.user_id as string,
    gains: row.gains as string,
    struggles: row.struggles as string,
    nextFocus: row.next_focus as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ---- GameWorld CRUD ----

export function getOrCreateWorld(ownerUserId = DEFAULT_OWNER_USER_ID): GameWorld {
  const db = getDb();
  const existing = db
    .prepare(`
      SELECT * FROM game_worlds
      WHERE owner_user_id = @ownerUserId
         OR user_id = @ownerUserId
         OR (@ownerUserId = @defaultOwnerUserId AND owner_user_id = 'local')
      ORDER BY last_visited_at DESC
      LIMIT 1
    `)
    .get({ ownerUserId, defaultOwnerUserId: DEFAULT_OWNER_USER_ID }) as Record<string, unknown> | undefined;

  if (existing) {
    if (existing.owner_user_id !== ownerUserId || existing.user_id !== ownerUserId) {
      db.prepare('UPDATE game_worlds SET owner_user_id = ?, user_id = ? WHERE id = ?')
        .run(ownerUserId, ownerUserId, existing.id);
      const updated = db.prepare('SELECT * FROM game_worlds WHERE id = ?').get(existing.id) as Record<string, unknown>;
      return parseWorld(updated);
    }
    return parseWorld(existing);
  }

  const now = new Date().toISOString();
  const id = uuidv4();
  db.prepare(`
    INSERT INTO game_worlds (id, owner_user_id, user_id, display_name, created_at, last_visited_at, season, player_x, player_y, settings)
    VALUES (?, ?, ?, '林间世界', ?, ?, 'spring', 345, 245, '{"muted":false,"reducedMotion":false}')
  `).run(id, ownerUserId, ownerUserId, now, now);

  const row = db.prepare('SELECT * FROM game_worlds WHERE id = ?').get(id) as Record<string, unknown>;
  return parseWorld(row);
}

export function updateWorldVisit(worldId: string, playerX: number, playerY: number): void {
  const db = getDb();
  db.prepare(`
    UPDATE game_worlds SET last_visited_at = ?, player_x = ?, player_y = ? WHERE id = ?
  `).run(new Date().toISOString(), playerX, playerY, worldId);
}

export function updateWorldSettings(worldId: string, settings: Partial<GameWorldSettings>): GameWorld | null {
  const db = getDb();
  const row = db.prepare('SELECT settings FROM game_worlds WHERE id = ?').get(worldId) as Record<string, unknown> | undefined;
  if (!row) return null;
  const current = JSON.parse(row.settings as string) as GameWorldSettings;
  const next = { ...current, ...settings };
  db.prepare('UPDATE game_worlds SET settings = ? WHERE id = ?').run(JSON.stringify(next), worldId);
  const updated = db.prepare('SELECT * FROM game_worlds WHERE id = ?').get(worldId) as Record<string, unknown>;
  return parseWorld(updated);
}

export function updateWorldSeason(worldId: string, season: GameSeason): void {
  const db = getDb();
  db.prepare('UPDATE game_worlds SET season = ? WHERE id = ?').run(season, worldId);
}

// ---- WorldObject CRUD ----

export function getWorldObjects(worldId: string): WorldObject[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM world_objects WHERE world_id = ? AND hidden = 0 ORDER BY created_at ASC')
    .all(worldId) as Record<string, unknown>[];
  return rows.map(parseWorldObject);
}

export function createWorldObject(input: {
  worldId: string;
  type: WorldObjectType;
  x: number;
  y: number;
  layer?: number;
  sourceMemoIds?: string[];
  sourceSessionId?: string;
  userConfirmed?: boolean;
  annotation?: string;
  metadata?: Record<string, unknown>;
}): WorldObject {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO world_objects
      (id, world_id, type, x, y, layer, source_memo_ids, source_session_id,
       user_confirmed, hidden, annotation, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
  `).run(
    id,
    input.worldId,
    input.type,
    input.x,
    input.y,
    input.layer ?? 1,
    JSON.stringify(input.sourceMemoIds ?? []),
    input.sourceSessionId ?? null,
    input.userConfirmed ? 1 : 0,
    input.annotation ?? null,
    JSON.stringify(input.metadata ?? {}),
    now,
  );
  const row = db.prepare('SELECT * FROM world_objects WHERE id = ?').get(id) as Record<string, unknown>;
  return parseWorldObject(row);
}

export function updateWorldObject(
  id: string,
  updates: Partial<Pick<WorldObject, 'x' | 'y' | 'hidden' | 'annotation' | 'userConfirmed'>>,
  worldId?: string,
): WorldObject | null {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM world_objects WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) return null;
  if (worldId && existing.world_id !== worldId) return null;

  const sets: string[] = [];
  const params: unknown[] = [];

  if ('x' in updates) { sets.push('x = ?'); params.push(updates.x); }
  if ('y' in updates) { sets.push('y = ?'); params.push(updates.y); }
  if ('hidden' in updates) { sets.push('hidden = ?'); params.push(updates.hidden ? 1 : 0); }
  if ('annotation' in updates) { sets.push('annotation = ?'); params.push(updates.annotation ?? null); }
  if ('userConfirmed' in updates) { sets.push('user_confirmed = ?'); params.push(updates.userConfirmed ? 1 : 0); }

  if (sets.length > 0) {
    params.push(id);
    db.prepare(`UPDATE world_objects SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }

  const row = db.prepare('SELECT * FROM world_objects WHERE id = ?').get(id) as Record<string, unknown>;
  return parseWorldObject(row);
}

export function hideWorldObject(id: string): void {
  const db = getDb();
  db.prepare('UPDATE world_objects SET hidden = 1 WHERE id = ?').run(id);
}

export function hideWorldObjectForWorld(id: string, worldId: string): boolean {
  const db = getDb();
  const result = db.prepare('UPDATE world_objects SET hidden = 1 WHERE id = ? AND world_id = ?').run(id, worldId);
  return result.changes > 0;
}

// ---- CompanionSession CRUD ----

export function createCompanionSession(input: {
  worldId: string;
  companionType: CompanionType;
  dialogueMode?: DialogueMode;
  authorizedMemoIds?: string[];
}): CompanionSession {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO companion_sessions (id, world_id, companion_type, dialogue_mode, authorized_memo_ids, started_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.worldId,
    input.companionType,
    input.dialogueMode ?? 'listen',
    JSON.stringify(input.authorizedMemoIds ?? []),
    now,
  );
  const row = db.prepare('SELECT * FROM companion_sessions WHERE id = ?').get(id) as Record<string, unknown>;
  return parseCompanionSession(row);
}

export function endCompanionSession(sessionId: string): void {
  const db = getDb();
  db.prepare('UPDATE companion_sessions SET ended_at = ? WHERE id = ?').run(new Date().toISOString(), sessionId);
}

export function updateSessionDialogueMode(sessionId: string, mode: DialogueMode): void {
  const db = getDb();
  db.prepare('UPDATE companion_sessions SET dialogue_mode = ? WHERE id = ?').run(mode, sessionId);
}

export function updateSessionAuthorizedMemos(sessionId: string, memoIds: string[]): void {
  const db = getDb();
  db.prepare('UPDATE companion_sessions SET authorized_memo_ids = ? WHERE id = ?').run(JSON.stringify(memoIds), sessionId);
}

export function getCompanionSession(sessionId: string): CompanionSession | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM companion_sessions WHERE id = ?').get(sessionId) as Record<string, unknown> | undefined;
  return row ? parseCompanionSession(row) : null;
}

export function getCompanionSessionForWorld(sessionId: string, worldId: string): CompanionSession | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM companion_sessions WHERE id = ? AND world_id = ?')
    .get(sessionId, worldId) as Record<string, unknown> | undefined;
  return row ? parseCompanionSession(row) : null;
}

// ---- Pond entries ----

export function createPondEntry(input: {
  worldId: string;
  userId: string;
  content: string;
}): GamePondEntry {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO game_pond_entries (id, world_id, user_id, content, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, input.worldId, input.userId, input.content, now);
  const row = db.prepare('SELECT * FROM game_pond_entries WHERE id = ?').get(id) as Record<string, unknown>;
  return parsePondEntry(row);
}

export function getPondEntries(userId: string, limit = 30): GamePondEntry[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM game_pond_entries
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(userId, Math.max(1, Math.min(limit, 100))) as Record<string, unknown>[];
  return rows.map(parsePondEntry);
}

// ---- Weekly reviews ----

export function createWeeklyReview(input: {
  worldId: string;
  userId: string;
  gains: string;
  struggles: string;
  nextFocus: string;
}): GameWeeklyReview {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO game_weekly_reviews (id, world_id, user_id, gains, struggles, next_focus, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.worldId,
    input.userId,
    input.gains,
    input.struggles,
    input.nextFocus,
    now,
    now,
  );
  const row = db.prepare('SELECT * FROM game_weekly_reviews WHERE id = ?').get(id) as Record<string, unknown>;
  return parseWeeklyReview(row);
}

export function getWeeklyReviews(userId: string, limit = 12): GameWeeklyReview[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM game_weekly_reviews
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(userId, Math.max(1, Math.min(limit, 52))) as Record<string, unknown>[];
  return rows.map(parseWeeklyReview);
}
