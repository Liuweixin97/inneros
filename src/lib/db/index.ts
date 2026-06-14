import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dataDir = path.join(process.cwd(), '.data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'inneros.db');
  db = new Database(dbPath);

  // Enable WAL mode for better concurrent performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS memos (
      id TEXT PRIMARY KEY,
      raw_content TEXT NOT NULL,
      plain_text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      import_fingerprint TEXT,
      original_tags TEXT NOT NULL DEFAULT '[]',
      ai_title TEXT,
      ai_summary TEXT,
      ai_category TEXT,
      ai_topics TEXT NOT NULL DEFAULT '[]',
      ai_emotions TEXT NOT NULL DEFAULT '[]',
      ai_people TEXT NOT NULL DEFAULT '[]',
      ai_projects TEXT NOT NULL DEFAULT '[]',
      ai_actions TEXT NOT NULL DEFAULT '[]',
      ai_key_questions TEXT NOT NULL DEFAULT '[]',
      embedding TEXT,
      analysis_status TEXT NOT NULL DEFAULT 'pending',
      privacy_level TEXT NOT NULL DEFAULT 'normal'
    );

    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      memo_count INTEGER NOT NULL DEFAULT 0,
      first_seen_at TEXT,
      last_seen_at TEXT,
      summary TEXT,
      key_questions TEXT NOT NULL DEFAULT '[]',
      stable_insights TEXT NOT NULL DEFAULT '[]',
      related_people TEXT NOT NULL DEFAULT '[]',
      related_projects TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'retrospect',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      citations TEXT NOT NULL DEFAULT '[]',
      source_type TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS insights (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT NOT NULL,
      confidence TEXT NOT NULL DEFAULT 'medium',
      evidence_memo_ids TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      user_feedback TEXT,
      saved_as_principle INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS action_feedback (
      action_key TEXT PRIMARY KEY,
      action_text TEXT NOT NULL,
      source_memo_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (source_memo_id) REFERENCES memos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ai_cache (
      cache_key TEXT PRIMARY KEY,
      input_hash TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS llm_runs (
      id TEXT PRIMARY KEY,
      task TEXT NOT NULL,
      model TEXT NOT NULL,
      thinking_mode TEXT NOT NULL DEFAULT 'disabled',
      status TEXT NOT NULL,
      latency_ms INTEGER NOT NULL,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      total_tokens INTEGER,
      cache_hit_tokens INTEGER,
      cache_miss_tokens INTEGER,
      error_message TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS analysis_jobs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      idempotency_key TEXT NOT NULL UNIQUE,
      payload TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      run_after TEXT NOT NULL,
      locked_at TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS memory_items (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      canonical_key TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      confidence REAL NOT NULL DEFAULT 0.5,
      first_seen_at TEXT NOT NULL,
      last_confirmed_at TEXT NOT NULL,
      supersedes_id TEXT,
      model_version TEXT NOT NULL,
      prompt_version TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(type, canonical_key),
      FOREIGN KEY (supersedes_id) REFERENCES memory_items(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS memory_evidence (
      id TEXT PRIMARY KEY,
      memory_id TEXT NOT NULL,
      memo_id TEXT NOT NULL,
      relation TEXT NOT NULL,
      excerpt TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0.5,
      created_at TEXT NOT NULL,
      UNIQUE(memory_id, memo_id, relation),
      FOREIGN KEY (memory_id) REFERENCES memory_items(id) ON DELETE CASCADE,
      FOREIGN KEY (memo_id) REFERENCES memos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS memory_relations (
      id TEXT PRIMARY KEY,
      source_memory_id TEXT NOT NULL,
      target_memory_id TEXT NOT NULL,
      relation_type TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0.5,
      evidence_memo_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(source_memory_id, target_memory_id, relation_type, evidence_memo_id),
      FOREIGN KEY (source_memory_id) REFERENCES memory_items(id) ON DELETE CASCADE,
      FOREIGN KEY (target_memory_id) REFERENCES memory_items(id) ON DELETE CASCADE,
      FOREIGN KEY (evidence_memo_id) REFERENCES memos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS memo_chunks (
      id TEXT PRIMARY KEY,
      memo_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      start_offset INTEGER NOT NULL,
      end_offset INTEGER NOT NULL,
      content TEXT NOT NULL,
      embedding TEXT NOT NULL,
      embedding_version TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(memo_id, chunk_index, embedding_version),
      FOREIGN KEY (memo_id) REFERENCES memos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS retrieval_runs (
      id TEXT PRIMARY KEY,
      query TEXT NOT NULL,
      resolved_query TEXT NOT NULL,
      intent TEXT NOT NULL,
      plan TEXT NOT NULL,
      candidate_count INTEGER NOT NULL,
      result_count INTEGER NOT NULL,
      results TEXT NOT NULL,
      latency_ms INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memory_rebuild_runs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'previewing',
      prompt_version TEXT NOT NULL,
      memo_count INTEGER NOT NULL DEFAULT 0,
      proposal_count INTEGER NOT NULL DEFAULT 0,
      error_count INTEGER NOT NULL DEFAULT 0,
      snapshot TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      applied_at TEXT,
      rolled_back_at TEXT
    );

    CREATE TABLE IF NOT EXISTS memory_rebuild_proposals (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      memo_id TEXT NOT NULL,
      model_version TEXT NOT NULL,
      proposal TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'ready',
      error_message TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(run_id, memo_id),
      FOREIGN KEY (run_id) REFERENCES memory_rebuild_runs(id) ON DELETE CASCADE,
      FOREIGN KEY (memo_id) REFERENCES memos(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_memos_created_at ON memos(created_at);
    CREATE INDEX IF NOT EXISTS idx_memos_analysis_status ON memos(analysis_status);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_action_feedback_status ON action_feedback(status);
    CREATE INDEX IF NOT EXISTS idx_llm_runs_task_created_at ON llm_runs(task, created_at);
    CREATE INDEX IF NOT EXISTS idx_llm_runs_status_created_at ON llm_runs(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_analysis_jobs_ready ON analysis_jobs(status, run_after, created_at);
    CREATE INDEX IF NOT EXISTS idx_analysis_jobs_entity ON analysis_jobs(type, entity_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_memory_items_type_status ON memory_items(type, status, last_confirmed_at);
    CREATE INDEX IF NOT EXISTS idx_memory_evidence_memo ON memory_evidence(memo_id, relation);
    CREATE INDEX IF NOT EXISTS idx_memory_relations_source ON memory_relations(source_memory_id, relation_type);
    CREATE INDEX IF NOT EXISTS idx_memory_relations_target ON memory_relations(target_memory_id, relation_type);
    CREATE INDEX IF NOT EXISTS idx_memo_chunks_memo ON memo_chunks(memo_id, chunk_index);
    CREATE INDEX IF NOT EXISTS idx_memo_chunks_version ON memo_chunks(embedding_version);
    CREATE INDEX IF NOT EXISTS idx_retrieval_runs_created_at ON retrieval_runs(created_at);
    CREATE INDEX IF NOT EXISTS idx_memory_rebuild_proposals_run ON memory_rebuild_proposals(run_id, status);
  `);

  const memoColumns = db.prepare('PRAGMA table_info(memos)').all() as Array<{ name: string }>;
  const memoColumnNames = new Set(memoColumns.map((column) => column.name));
  if (!memoColumnNames.has('import_fingerprint')) {
    db.exec('ALTER TABLE memos ADD COLUMN import_fingerprint TEXT');
  }
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_memos_import_fingerprint
    ON memos(import_fingerprint)
    WHERE import_fingerprint IS NOT NULL
  `);

  const conversationColumns = db.prepare('PRAGMA table_info(conversations)').all() as Array<{ name: string }>;
  const conversationColumnNames = new Set(conversationColumns.map((column) => column.name));
  if (!conversationColumnNames.has('summary')) {
    db.exec('ALTER TABLE conversations ADD COLUMN summary TEXT');
  }
  if (!conversationColumnNames.has('summary_status')) {
    db.exec("ALTER TABLE conversations ADD COLUMN summary_status TEXT NOT NULL DEFAULT 'pending'");
  }
  if (!conversationColumnNames.has('summarized_message_count')) {
    db.exec('ALTER TABLE conversations ADD COLUMN summarized_message_count INTEGER NOT NULL DEFAULT 0');
  }
  if (!conversationColumnNames.has('summary_updated_at')) {
    db.exec('ALTER TABLE conversations ADD COLUMN summary_updated_at TEXT');
  }
  const messageColumns = db.prepare('PRAGMA table_info(messages)').all() as Array<{ name: string }>;
  const messageColumnNames = new Set(messageColumns.map((column) => column.name));
  if (!messageColumnNames.has('reasoning_content')) {
    db.exec("ALTER TABLE messages ADD COLUMN reasoning_content TEXT NOT NULL DEFAULT ''");
  }
  db.prepare("UPDATE conversations SET mode = 'unified' WHERE mode != 'unified'").run();
  db.prepare(`
    DELETE FROM memory_items
    WHERE NOT EXISTS (
      SELECT 1 FROM memory_evidence e WHERE e.memory_id = memory_items.id
    )
  `).run();

  // ---- 林间世界游戏表 ----
  db.exec(`
    CREATE TABLE IF NOT EXISTS game_worlds (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL DEFAULT 'local',
      display_name TEXT NOT NULL DEFAULT '林间世界',
      created_at TEXT NOT NULL,
      last_visited_at TEXT NOT NULL,
      season TEXT NOT NULL DEFAULT 'spring',
      player_x REAL NOT NULL DEFAULT 400,
      player_y REAL NOT NULL DEFAULT 300,
      settings TEXT NOT NULL DEFAULT '{"muted":false,"reducedMotion":false}'
    );

    CREATE TABLE IF NOT EXISTS world_objects (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'memory_plant',
      x REAL NOT NULL,
      y REAL NOT NULL,
      layer INTEGER NOT NULL DEFAULT 1,
      source_memo_ids TEXT NOT NULL DEFAULT '[]',
      source_session_id TEXT,
      user_confirmed INTEGER NOT NULL DEFAULT 0,
      hidden INTEGER NOT NULL DEFAULT 0,
      annotation TEXT,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      FOREIGN KEY (world_id) REFERENCES game_worlds(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS companion_sessions (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL,
      companion_type TEXT NOT NULL DEFAULT 'none',
      dialogue_mode TEXT NOT NULL DEFAULT 'listen',
      authorized_memo_ids TEXT NOT NULL DEFAULT '[]',
      started_at TEXT NOT NULL,
      ended_at TEXT,
      FOREIGN KEY (world_id) REFERENCES game_worlds(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS shared_memory_drafts (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      memo_id TEXT,
      player_one_text TEXT,
      player_two_text TEXT,
      joint_text TEXT,
      save_decision TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES companion_sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_world_objects_world_id ON world_objects(world_id, hidden);
    CREATE INDEX IF NOT EXISTS idx_companion_sessions_world ON companion_sessions(world_id, started_at);
    CREATE INDEX IF NOT EXISTS idx_shared_drafts_session ON shared_memory_drafts(session_id);
  `);

  return db;
}

// JSON array fields that need parse/stringify
export const MEMO_JSON_FIELDS = [
  'original_tags',
  'ai_topics',
  'ai_emotions',
  'ai_people',
  'ai_projects',
  'ai_actions',
  'ai_key_questions',
] as const;

export const TOPIC_JSON_FIELDS = [
  'key_questions',
  'stable_insights',
  'related_people',
  'related_projects',
] as const;

export const MESSAGE_JSON_FIELDS = ['citations'] as const;

export const INSIGHT_JSON_FIELDS = ['evidence_memo_ids'] as const;

/**
 * Parse JSON string fields in a row from the database.
 */
export function parseJsonFields<T extends Record<string, unknown>>(
  row: T,
  fields: readonly string[]
): T {
  const result = { ...row };
  for (const field of fields) {
    if (field in result && typeof result[field] === 'string') {
      try {
        (result as Record<string, unknown>)[field] = JSON.parse(result[field] as string);
      } catch {
        (result as Record<string, unknown>)[field] = [];
      }
    }
  }
  return result;
}

/**
 * Stringify JSON array fields for database insertion.
 */
export function stringifyJsonFields<T extends Record<string, unknown>>(
  data: T,
  fields: readonly string[]
): T {
  const result = { ...data };
  for (const field of fields) {
    if (field in result && Array.isArray(result[field])) {
      (result as Record<string, unknown>)[field] = JSON.stringify(result[field]);
    }
  }
  return result;
}
