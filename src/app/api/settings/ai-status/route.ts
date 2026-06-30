import { NextResponse } from 'next/server';
import { getAnalysisBackfillStats } from '@/lib/db/analysis-jobs';
import { getDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (user.isGuest) return NextResponse.json({ error: '游客只读' }, { status: 403 });
  const db = getDb();
  const analysis = getAnalysisBackfillStats(user.id);
  const memoryRows = db.prepare(`
    SELECT type, COUNT(*) AS count
    FROM memory_items
    WHERE status != 'superseded'
      AND user_id = ?
    GROUP BY type
  `).all(user.id) as Array<{ type: string; count: number }>;
  const { relations } = db.prepare(
    `SELECT COUNT(*) AS relations
     FROM memory_relations r
     JOIN memory_items m ON m.id = r.source_memory_id
     WHERE m.user_id = ?`,
  ).get(user.id) as { relations: number };
  const usage = db.prepare(`
    SELECT task,
      COUNT(*) AS runs,
      COALESCE(SUM(total_tokens), 0) AS total_tokens,
      COALESCE(ROUND(AVG(prompt_tokens)), 0) AS avg_prompt_tokens,
      COALESCE(ROUND(AVG(completion_tokens)), 0) AS avg_completion_tokens
    FROM llm_runs
    WHERE status = 'succeeded'
      AND user_id = ?
    GROUP BY task
  `).all(user.id) as Array<{
    task: string;
    runs: number;
    total_tokens: number;
    avg_prompt_tokens: number;
    avg_completion_tokens: number;
  }>;
  const memories = Object.fromEntries(memoryRows.map((row) => [row.type, Number(row.count)]));
  return NextResponse.json({
    analysis,
    memories: {
      total: Object.values(memories).reduce((sum, count) => sum + count, 0),
      event: memories.event || 0,
      person: memories.person || 0,
      project: memories.project || 0,
      goal: memories.goal || 0,
      state: memories.state || 0,
      belief: memories.belief || 0,
      pattern: memories.pattern || 0,
      preference: memories.preference || 0,
      constraint: memories.constraint || 0,
      relations: Number(relations) || 0,
    },
    llm_usage: Object.fromEntries(usage.map((row) => [row.task, {
      runs: Number(row.runs) || 0,
      total_tokens: Number(row.total_tokens) || 0,
      avg_prompt_tokens: Number(row.avg_prompt_tokens) || 0,
      avg_completion_tokens: Number(row.avg_completion_tokens) || 0,
    }])),
  });
}
