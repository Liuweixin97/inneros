import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const guestUserId = process.env.GUEST_USER_ID || 'guest';
const retentionHours = Number(process.env.GUEST_DATA_RETENTION_HOURS || 24);
const safeRetentionHours = Number.isFinite(retentionHours) && retentionHours >= 1 ? retentionHours : 24;
const cutoff = new Date(Date.now() - safeRetentionHours * 60 * 60 * 1000).toISOString();
const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), '.data', 'inneros.db');
const sampleMemoIds = ['guest-sample-001', 'guest-sample-002'];

if (!fs.existsSync(dbPath)) {
  console.log(JSON.stringify({ ok: true, skipped: true, reason: 'database_not_found', dbPath }, null, 2));
  process.exit(0);
}

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

function tableExists(table) {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
  return Boolean(row);
}

function columnNames(table) {
  if (!tableExists(table)) return new Set();
  return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name));
}

const columnsByTable = new Map();
function hasColumns(table, names) {
  if (!columnsByTable.has(table)) columnsByTable.set(table, columnNames(table));
  const columns = columnsByTable.get(table);
  return names.every((name) => columns.has(name));
}

function deleteWhere(summary, table, where, params) {
  if (!tableExists(table)) return;
  const result = db.prepare(`DELETE FROM ${table} WHERE ${where}`).run(params);
  summary[table] = (summary[table] || 0) + result.changes;
}

function deleteUserRows(summary, table, timeColumn = 'created_at') {
  if (!hasColumns(table, ['user_id', timeColumn])) return;
  deleteWhere(summary, table, 'user_id = @guestUserId AND ' + timeColumn + ' < @cutoff', {
    guestUserId,
    cutoff,
  });
}

function deleteOldGuestWorldRows(summary, table) {
  if (!tableExists(table) || !tableExists('game_worlds')) return;
  deleteWhere(summary, table, `
    world_id IN (
      SELECT id FROM game_worlds
      WHERE COALESCE(NULLIF(user_id, ''), owner_user_id) = @guestUserId
        AND last_visited_at < @cutoff
    )
  `, { guestUserId, cutoff });
}

const cleanup = db.transaction(() => {
  const summary = {};
  const params = {
    guestUserId,
    cutoff,
    sampleA: sampleMemoIds[0],
    sampleB: sampleMemoIds[1],
  };

  if (tableExists('memory_rebuild_proposals') && tableExists('memory_rebuild_runs')) {
    deleteWhere(summary, 'memory_rebuild_proposals', `
      run_id IN (
        SELECT id FROM memory_rebuild_runs
        WHERE user_id = @guestUserId AND created_at < @cutoff
      )
    `, params);
  }

  if (tableExists('memory_relations') && tableExists('memory_items')) {
    deleteWhere(summary, 'memory_relations', `
      source_memory_id IN (
        SELECT id FROM memory_items
        WHERE user_id = @guestUserId AND created_at < @cutoff
      )
      OR target_memory_id IN (
        SELECT id FROM memory_items
        WHERE user_id = @guestUserId AND created_at < @cutoff
      )
    `, params);
  }

  if (tableExists('memory_evidence') && tableExists('memory_items')) {
    deleteWhere(summary, 'memory_evidence', `
      memory_id IN (
        SELECT id FROM memory_items
        WHERE user_id = @guestUserId AND created_at < @cutoff
      )
      OR memo_id IN (
        SELECT id FROM memos
        WHERE user_id = @guestUserId
          AND created_at < @cutoff
          AND id NOT IN (@sampleA, @sampleB)
      )
    `, params);
  }

  if (tableExists('memo_chunks') && tableExists('memos')) {
    deleteWhere(summary, 'memo_chunks', `
      memo_id IN (
        SELECT id FROM memos
        WHERE user_id = @guestUserId
          AND created_at < @cutoff
          AND id NOT IN (@sampleA, @sampleB)
      )
    `, params);
  }

  deleteUserRows(summary, 'analysis_jobs', 'created_at');
  deleteUserRows(summary, 'llm_runs', 'created_at');
  deleteUserRows(summary, 'ai_cache', 'created_at');
  deleteUserRows(summary, 'retrieval_runs', 'created_at');
  deleteUserRows(summary, 'memory_rebuild_runs', 'created_at');
  deleteUserRows(summary, 'memory_items', 'created_at');
  deleteUserRows(summary, 'insights', 'created_at');
  deleteUserRows(summary, 'topics', 'updated_at');
  deleteUserRows(summary, 'conversations', 'updated_at');
  deleteUserRows(summary, 'game_pond_entries', 'created_at');
  deleteUserRows(summary, 'game_weekly_reviews', 'created_at');

  deleteOldGuestWorldRows(summary, 'companion_sessions');
  deleteOldGuestWorldRows(summary, 'world_objects');
  if (hasColumns('game_worlds', ['user_id', 'owner_user_id', 'last_visited_at'])) {
    deleteWhere(summary, 'game_worlds', `
      COALESCE(NULLIF(user_id, ''), owner_user_id) = @guestUserId
      AND last_visited_at < @cutoff
    `, params);
  }

  if (hasColumns('memos', ['user_id', 'created_at'])) {
    deleteWhere(summary, 'memos', `
      user_id = @guestUserId
      AND created_at < @cutoff
      AND id NOT IN (@sampleA, @sampleB)
    `, params);
  }

  return summary;
});

const summary = cleanup();
console.log(JSON.stringify({
  ok: true,
  guestUserId,
  retentionHours: safeRetentionHours,
  cutoff,
  deleted: summary,
}, null, 2));
