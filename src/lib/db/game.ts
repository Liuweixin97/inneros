import { v4 as uuidv4 } from 'uuid';
import type {
  GameWorld,
  GameWorldSettings,
  WorldObject,
  WorldObjectType,
  CompanionSession,
  CompanionType,
  DialogueMode,
  SharedMemoryDraft,
  GameSeason,
} from '@/types';
import { DEFAULT_OWNER_USER_ID, getDb } from './index';

// ---- 内部解析 ----

function parseWorld(row: Record<string, unknown>): GameWorld {
  return {
    id: row.id as string,
    ownerUserId: row.owner_user_id as string,
    displayName: row.display_name as string,
    createdAt: row.created_at as string,
    lastVisitedAt: row.last_visited_at as string,
    season: row.season as GameSeason,
    playerX: row.player_x as number,
    playerY: row.player_y as number,
    settings: JSON.parse(row.settings as string) as GameWorldSettings,
  };
}

function parseWorldObject(row: Record<string, unknown>): WorldObject {
  return {
    id: row.id as string,
    worldId: row.world_id as string,
    type: row.type as WorldObjectType,
    x: row.x as number,
    y: row.y as number,
    layer: row.layer as number,
    sourceMemoIds: JSON.parse(row.source_memo_ids as string) as string[],
    sourceSessionId: row.source_session_id as string | undefined,
    userConfirmed: Boolean(row.user_confirmed),
    hidden: Boolean(row.hidden),
    annotation: row.annotation as string | undefined,
    metadata: JSON.parse(row.metadata as string) as Record<string, unknown>,
    createdAt: row.created_at as string,
  };
}

function parseCompanionSession(row: Record<string, unknown>): CompanionSession {
  return {
    id: row.id as string,
    worldId: row.world_id as string,
    companionType: row.companion_type as CompanionType,
    dialogueMode: row.dialogue_mode as DialogueMode,
    authorizedMemoIds: JSON.parse(row.authorized_memo_ids as string) as string[],
    startedAt: row.started_at as string,
    endedAt: row.ended_at as string | undefined,
  };
}

function parseSharedDraft(row: Record<string, unknown>): SharedMemoryDraft {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    memoId: row.memo_id as string | undefined,
    playerOneText: row.player_one_text as string | undefined,
    playerTwoText: row.player_two_text as string | undefined,
    jointText: row.joint_text as string | undefined,
    saveDecision: row.save_decision as SharedMemoryDraft['saveDecision'],
  };
}

// ---- GameWorld CRUD ----

export function getOrCreateWorld(userId = DEFAULT_OWNER_USER_ID): GameWorld {
  const db = getDb();
  const existing = db
    .prepare('SELECT * FROM game_worlds WHERE user_id = ? ORDER BY last_visited_at DESC LIMIT 1')
    .get(userId) as Record<string, unknown> | undefined;

  if (existing) {
    return parseWorld(existing);
  }

  const now = new Date().toISOString();
  const id = uuidv4();
  db.prepare(`
    INSERT INTO game_worlds (id, owner_user_id, user_id, display_name, created_at, last_visited_at, season, player_x, player_y, settings)
    VALUES (?, ?, ?, '林间世界', ?, ?, 'spring', 345, 245, '{"muted":false,"reducedMotion":false}')
  `).run(id, userId, userId, now, now);

  const row = db.prepare('SELECT * FROM game_worlds WHERE id = ?').get(id) as Record<string, unknown>;
  return parseWorld(row);
}

export function updateWorldVisit(worldId: string, userId: string, playerX: number, playerY: number): void {
  const db = getDb();
  db.prepare(`
    UPDATE game_worlds SET last_visited_at = ?, player_x = ?, player_y = ? WHERE id = ? AND user_id = ?
  `).run(new Date().toISOString(), playerX, playerY, worldId, userId);
}

export function updateWorldSettings(worldId: string, userId: string, settings: Partial<GameWorldSettings>): GameWorld | null {
  const db = getDb();
  const row = db.prepare('SELECT settings FROM game_worlds WHERE id = ? AND user_id = ?').get(worldId, userId) as Record<string, unknown> | undefined;
  if (!row) return null;
  const current = JSON.parse(row.settings as string) as GameWorldSettings;
  const next = { ...current, ...settings };
  db.prepare('UPDATE game_worlds SET settings = ? WHERE id = ? AND user_id = ?').run(JSON.stringify(next), worldId, userId);
  const updated = db.prepare('SELECT * FROM game_worlds WHERE id = ? AND user_id = ?').get(worldId, userId) as Record<string, unknown>;
  return parseWorld(updated);
}

export function updateWorldSeason(worldId: string, userId: string, season: GameSeason): void {
  const db = getDb();
  db.prepare('UPDATE game_worlds SET season = ? WHERE id = ? AND user_id = ?').run(season, worldId, userId);
}

// ---- WorldObject CRUD ----

export function getWorldObjects(worldId: string, userId?: string): WorldObject[] {
  const db = getDb();
  const rows = db
    .prepare(`
      SELECT * FROM world_objects
      WHERE world_id = ? AND hidden = 0 ${userId ? 'AND user_id = ?' : ''}
      ORDER BY created_at ASC
    `)
    .all(...(userId ? [worldId, userId] : [worldId])) as Record<string, unknown>[];
  return rows.map(parseWorldObject);
}

export function createWorldObject(input: {
  worldId: string;
  userId: string;
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
      (id, world_id, user_id, type, x, y, layer, source_memo_ids, source_session_id,
       user_confirmed, hidden, annotation, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
  `).run(
    id,
    input.worldId,
    input.userId,
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
  userId: string,
  updates: Partial<Pick<WorldObject, 'x' | 'y' | 'hidden' | 'annotation' | 'userConfirmed'>>,
): WorldObject | null {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM world_objects WHERE id = ? AND user_id = ?').get(id, userId) as Record<string, unknown> | undefined;
  if (!existing) return null;

  const sets: string[] = [];
  const params: unknown[] = [];

  if ('x' in updates) { sets.push('x = ?'); params.push(updates.x); }
  if ('y' in updates) { sets.push('y = ?'); params.push(updates.y); }
  if ('hidden' in updates) { sets.push('hidden = ?'); params.push(updates.hidden ? 1 : 0); }
  if ('annotation' in updates) { sets.push('annotation = ?'); params.push(updates.annotation ?? null); }
  if ('userConfirmed' in updates) { sets.push('user_confirmed = ?'); params.push(updates.userConfirmed ? 1 : 0); }

  if (sets.length > 0) {
    params.push(id);
    params.push(userId);
    db.prepare(`UPDATE world_objects SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`).run(...params);
  }

  const row = db.prepare('SELECT * FROM world_objects WHERE id = ? AND user_id = ?').get(id, userId) as Record<string, unknown>;
  return parseWorldObject(row);
}

export function hideWorldObject(id: string, userId: string): void {
  const db = getDb();
  db.prepare('UPDATE world_objects SET hidden = 1 WHERE id = ? AND user_id = ?').run(id, userId);
}

// ---- CompanionSession CRUD ----

export function createCompanionSession(input: {
  worldId: string;
  userId: string;
  companionType: CompanionType;
  dialogueMode?: DialogueMode;
  authorizedMemoIds?: string[];
}): CompanionSession {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO companion_sessions (id, world_id, user_id, companion_type, dialogue_mode, authorized_memo_ids, started_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.worldId,
    input.userId,
    input.companionType,
    input.dialogueMode ?? 'listen',
    JSON.stringify(input.authorizedMemoIds ?? []),
    now,
  );
  const row = db.prepare('SELECT * FROM companion_sessions WHERE id = ?').get(id) as Record<string, unknown>;
  return parseCompanionSession(row);
}

export function endCompanionSession(sessionId: string, userId?: string): void {
  const db = getDb();
  db.prepare(`
    UPDATE companion_sessions SET ended_at = ?
    WHERE id = ? ${userId ? 'AND user_id = ?' : ''}
  `).run(...(userId ? [new Date().toISOString(), sessionId, userId] : [new Date().toISOString(), sessionId]));
}

export function updateSessionDialogueMode(sessionId: string, userId: string, mode: DialogueMode): void {
  const db = getDb();
  db.prepare('UPDATE companion_sessions SET dialogue_mode = ? WHERE id = ? AND user_id = ?').run(mode, sessionId, userId);
}

export function updateSessionAuthorizedMemos(sessionId: string, userId: string, memoIds: string[]): void {
  const db = getDb();
  db.prepare('UPDATE companion_sessions SET authorized_memo_ids = ? WHERE id = ? AND user_id = ?').run(JSON.stringify(memoIds), sessionId, userId);
}

export function getCompanionSession(sessionId: string, userId?: string): CompanionSession | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM companion_sessions
    WHERE id = ? ${userId ? 'AND user_id = ?' : ''}
  `).get(...(userId ? [sessionId, userId] : [sessionId])) as Record<string, unknown> | undefined;
  return row ? parseCompanionSession(row) : null;
}

// ---- SharedMemoryDraft CRUD ----

export function createSharedDraft(input: {
  userId: string;
  sessionId: string;
  memoId?: string;
}): SharedMemoryDraft {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO shared_memory_drafts (id, user_id, session_id, memo_id, save_decision, created_at)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `).run(id, input.userId, input.sessionId, input.memoId ?? null, now);
  const row = db.prepare('SELECT * FROM shared_memory_drafts WHERE id = ?').get(id) as Record<string, unknown>;
  return parseSharedDraft(row);
}

export function updateSharedDraft(
  id: string,
  userId: string,
  updates: Partial<Pick<SharedMemoryDraft, 'playerOneText' | 'playerTwoText' | 'jointText' | 'saveDecision'>>,
): SharedMemoryDraft | null {
  const db = getDb();
  const sets: string[] = [];
  const params: unknown[] = [];

  if ('playerOneText' in updates) { sets.push('player_one_text = ?'); params.push(updates.playerOneText ?? null); }
  if ('playerTwoText' in updates) { sets.push('player_two_text = ?'); params.push(updates.playerTwoText ?? null); }
  if ('jointText' in updates) { sets.push('joint_text = ?'); params.push(updates.jointText ?? null); }
  if ('saveDecision' in updates) { sets.push('save_decision = ?'); params.push(updates.saveDecision); }

  if (sets.length > 0) {
    params.push(id);
    params.push(userId);
    db.prepare(`UPDATE shared_memory_drafts SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`).run(...params);
  }

  const row = db.prepare('SELECT * FROM shared_memory_drafts WHERE id = ? AND user_id = ?').get(id, userId) as Record<string, unknown> | undefined;
  return row ? parseSharedDraft(row) : null;
}

export function getDraftsBySession(sessionId: string, userId?: string): SharedMemoryDraft[] {
  const db = getDb();
  const rows = db
    .prepare(`
      SELECT * FROM shared_memory_drafts
      WHERE session_id = ? ${userId ? 'AND user_id = ?' : ''}
      ORDER BY created_at ASC
    `)
    .all(...(userId ? [sessionId, userId] : [sessionId])) as Record<string, unknown>[];
  return rows.map(parseSharedDraft);
}

export function getSharedDraft(id: string, userId?: string): SharedMemoryDraft | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM shared_memory_drafts
    WHERE id = ? ${userId ? 'AND user_id = ?' : ''}
  `).get(...(userId ? [id, userId] : [id])) as Record<string, unknown> | undefined;
  return row ? parseSharedDraft(row) : null;
}
