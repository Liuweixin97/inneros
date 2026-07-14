import 'server-only';

import { getDb } from '@/lib/db';
import { FOREST_NODE_ORDER, getForestScene } from './scenes';
import type {
  ForestAtlas,
  ForestDataState,
  ForestDayOption,
  ForestEvidence,
  ForestNode,
  ForestNodeId,
  ForestObservation,
  ForestVisualization,
  ForestWindowRequest,
} from './types';

interface MemoSignalRow {
  id: string;
  ai_title: string | null;
  ai_summary: string | null;
  plain_text: string;
  created_at: string;
  analysis_status: string;
  ai_emotions: string;
  ai_topics: string;
  ai_people: string;
  ai_projects: string;
  ai_actions: string;
  ai_key_questions: string;
}

interface MemoryRow {
  id: string;
  type: string;
  title: string;
  summary: string;
  status: string;
  confidence: number;
  last_confirmed_at: string;
}

interface MemoryEvidenceRow {
  memory_id: string;
  memo_id: string;
  relation: 'introduced' | 'supports' | 'contradicts' | 'updates';
  excerpt: string;
}

interface InsightRow {
  id: string;
  title: string;
  content: string;
  type: string;
  evidence_memo_ids: string;
}

interface ParsedMemo extends Omit<MemoSignalRow,
  'ai_emotions' | 'ai_topics' | 'ai_people' | 'ai_projects' | 'ai_actions' | 'ai_key_questions'> {
  emotions: string[];
  topics: string[];
  people: string[];
  projects: string[];
  actions: string[];
  questions: string[];
}

interface BuildForestAtlasInput {
  userId: string;
  requestedWindow?: ForestWindowRequest;
  now?: Date;
}

const AUTO_WINDOWS: readonly ForestDayOption[] = [30, 90, 180, 365];
const AUTO_TARGET_MEMOS = 30;
const EVIDENCE_LIMIT = 4;

function parseArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function parseMemo(row: MemoSignalRow): ParsedMemo {
  return {
    ...row,
    emotions: parseArray(row.ai_emotions),
    topics: parseArray(row.ai_topics),
    people: parseArray(row.ai_people),
    projects: parseArray(row.ai_projects),
    actions: parseArray(row.ai_actions),
    questions: parseArray(row.ai_key_questions),
  };
}

function cutoff(now: Date, days: number): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

function countMemos(userId: string, from: string, to: string): number {
  const row = getDb().prepare(`
    SELECT COUNT(*) AS count
    FROM memos
    WHERE user_id = ? AND privacy_level = 'normal'
      AND created_at >= ? AND created_at <= ?
  `).get(userId, from, to) as { count: number };
  return row.count;
}

function resolveWindow(
  userId: string,
  requested: ForestWindowRequest,
  now: Date,
): { actualDays: ForestDayOption; memoCount: number; expanded: boolean } {
  if (requested !== 'auto') {
    return {
      actualDays: requested,
      memoCount: countMemos(userId, cutoff(now, requested), now.toISOString()),
      expanded: false,
    };
  }
  for (const days of AUTO_WINDOWS) {
    const memoCount = countMemos(userId, cutoff(now, days), now.toISOString());
    if (memoCount >= AUTO_TARGET_MEMOS || days === 365) {
      return { actualDays: days, memoCount, expanded: days > AUTO_WINDOWS[0] };
    }
  }
  return { actualDays: 365, memoCount: 0, expanded: true };
}

function loadMemos(userId: string, from: string, to: string): ParsedMemo[] {
  const rows = getDb().prepare(`
    SELECT id, ai_title, ai_summary, plain_text, created_at, analysis_status,
           ai_emotions, ai_topics, ai_people, ai_projects, ai_actions, ai_key_questions
    FROM memos
    WHERE user_id = ? AND privacy_level = 'normal'
      AND created_at >= ? AND created_at <= ?
    ORDER BY created_at DESC
  `).all(userId, from, to) as MemoSignalRow[];
  return rows.map(parseMemo);
}

function loadMemories(userId: string): MemoryRow[] {
  return getDb().prepare(`
    SELECT id, type, title, summary, status, confidence, last_confirmed_at
    FROM memory_items
    WHERE user_id = ? AND status != 'superseded'
    ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'dormant' THEN 1 ELSE 2 END,
             last_confirmed_at DESC, confidence DESC
    LIMIT 240
  `).all(userId) as MemoryRow[];
}

function loadMemoryEvidence(userId: string, from: string, to: string): MemoryEvidenceRow[] {
  return getDb().prepare(`
    SELECT me.memory_id, me.memo_id, me.relation, me.excerpt
    FROM memory_evidence me
    JOIN memory_items mi ON mi.id = me.memory_id
    JOIN memos m ON m.id = me.memo_id
    WHERE mi.user_id = ? AND m.user_id = ? AND m.privacy_level = 'normal'
      AND m.created_at >= ? AND m.created_at <= ?
    ORDER BY me.created_at DESC
  `).all(userId, userId, from, to) as MemoryEvidenceRow[];
}

function loadInsights(userId: string): InsightRow[] {
  return getDb().prepare(`
    SELECT id, title, content, type, evidence_memo_ids
    FROM insights
    WHERE user_id = ? AND COALESCE(user_feedback, '') != 'hidden'
    ORDER BY created_at DESC
    LIMIT 80
  `).all(userId) as InsightRow[];
}

function dataState(sampleSize: number): ForestDataState {
  if (sampleSize === 0) return 'empty';
  if (sampleSize < 4) return 'sparse';
  return 'ready';
}

function compact(value: string, length = 180): string {
  const normalized = value.replace(/\s+/gu, ' ').trim();
  return normalized.length > length ? `${normalized.slice(0, length)}…` : normalized;
}

function toEvidence(memo: ParsedMemo): ForestEvidence {
  return {
    memoId: memo.id,
    title: memo.ai_title || compact(memo.plain_text, 28) || '未命名记录',
    recordedAt: memo.created_at,
    snippet: compact(memo.ai_summary || memo.plain_text),
  };
}

function evidenceFor(ids: string[], memoById: Map<string, ParsedMemo>): ForestEvidence[] {
  return [...new Set(ids)].flatMap((id) => {
    const memo = memoById.get(id);
    return memo ? [toEvidence(memo)] : [];
  }).slice(0, EVIDENCE_LIMIT);
}

function collectCounts(
  memos: ParsedMemo[],
  select: (memo: ParsedMemo) => string[],
): Array<{ label: string; count: number; latestAt: string; evidenceMemoIds: string[] }> {
  const map = new Map<string, { count: number; latestAt: string; ids: string[] }>();
  for (const memo of memos) {
    for (const rawLabel of new Set(select(memo))) {
      const label = rawLabel.trim();
      if (!label) continue;
      const current = map.get(label) ?? { count: 0, latestAt: memo.created_at, ids: [] };
      current.count += 1;
      if (memo.created_at > current.latestAt) current.latestAt = memo.created_at;
      if (current.ids.length < 6) current.ids.push(memo.id);
      map.set(label, current);
    }
  }
  return [...map.entries()]
    .map(([label, value]) => ({
      label,
      count: value.count,
      latestAt: value.latestAt,
      evidenceMemoIds: value.ids,
    }))
    .sort((a, b) => b.count - a.count || b.latestAt.localeCompare(a.latestAt));
}

function observation(
  id: string,
  kind: ForestObservation['kind'],
  label: string,
  detail: string,
  count: number,
  evidenceMemoIds: string[],
): ForestObservation {
  return { id, kind, label, detail, count, evidenceMemoIds: [...new Set(evidenceMemoIds)].slice(0, 6) };
}

function makeNode(input: {
  id: ForestNodeId;
  sampleSize: number;
  summary: string;
  observations: ForestObservation[];
  evidenceIds: string[];
  visualization: ForestVisualization;
  memoById: Map<string, ParsedMemo>;
}): ForestNode {
  const scene = getForestScene(input.id);
  const state = dataState(input.sampleSize);
  return {
    id: input.id,
    name: scene.name,
    purpose: scene.purpose,
    sampleSize: input.sampleSize,
    dataState: state,
    summary: state === 'empty' ? scene.emptySummary : state === 'sparse' ? scene.sparseSummary : input.summary,
    observations: input.observations.slice(0, 5),
    evidence: evidenceFor(input.evidenceIds, input.memoById),
    connections: [],
    visualization: input.visualization,
  };
}

function buildLanternNode(
  memos: ParsedMemo[],
  memories: MemoryRow[],
  memoryEvidence: Map<string, MemoryEvidenceRow[]>,
  memoById: Map<string, ParsedMemo>,
  splitAt: string,
): ForestNode {
  const emotionMemos = memos.filter((memo) => memo.emotions.length > 0);
  const emotions = collectCounts(emotionMemos, (memo) => memo.emotions).slice(0, 6).map((item) => {
    const earlierCount = item.evidenceMemoIds.filter((id) => (memoById.get(id)?.created_at ?? '') < splitAt).length;
    return {
      label: item.label,
      count: item.count,
      earlierCount,
      laterCount: item.count - earlierCount,
      share: emotionMemos.length > 0 ? item.count / emotionMemos.length : 0,
      evidenceMemoIds: item.evidenceMemoIds,
    };
  });
  const stateMemories = memories.filter((item) => item.type === 'state' && item.status === 'active')
    .filter((item) => (memoryEvidence.get(item.id)?.length ?? 0) > 0)
    .slice(0, 2);
  const observations: ForestObservation[] = emotions.slice(0, 3).map((item, index) => observation(
    `emotion-${index}`,
    'memo-signal',
    item.label,
    `在 ${item.count} 条记录的情绪标签中出现；这是记录标记，不是状态诊断。`,
    item.count,
    item.evidenceMemoIds,
  ));
  for (const item of stateMemories) {
    const ids = memoryEvidence.get(item.id)?.map((row) => row.memo_id) ?? [];
    observations.push(observation(`state-${item.id}`, 'memory-candidate', item.title, compact(item.summary), ids.length, ids));
  }
  const top = emotions[0];
  return makeNode({
    id: 'lantern-cabin',
    sampleSize: emotionMemos.length,
    summary: top
      ? `在 ${emotionMemos.length} 条含情绪标记的记录里，“${top.label}”出现最多；它描述这个窗口中的记录分布，不代表完整的你。`
      : '',
    observations,
    evidenceIds: observations.flatMap((item) => item.evidenceMemoIds),
    visualization: { kind: 'emotion-lanterns', periodSplitAt: splitAt, emotions },
    memoById,
  });
}

function timeKey(date: string, granularity: 'week' | 'month'): string {
  const value = new Date(date);
  if (granularity === 'month') return value.toISOString().slice(0, 7);
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() - day + 1);
  return value.toISOString().slice(0, 10);
}

function buildYearNode(memos: ParsedMemo[], memoById: Map<string, ParsedMemo>, actualDays: number): ForestNode {
  const granularity = actualDays <= 90 ? 'week' as const : 'month' as const;
  const ringMap = new Map<string, { ids: string[]; emotion: number; topic: number }>();
  for (const memo of memos) {
    const key = timeKey(memo.created_at, granularity);
    const current = ringMap.get(key) ?? { ids: [], emotion: 0, topic: 0 };
    current.ids.push(memo.id);
    if (memo.emotions.length > 0) current.emotion += 1;
    if (memo.topics.length > 0) current.topic += 1;
    ringMap.set(key, current);
  }
  const rings = [...ringMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({
    key,
    label: granularity === 'week' ? `${key.slice(5)} 周` : key,
    memoCount: value.ids.length,
    emotionMemoCount: value.emotion,
    topicMemoCount: value.topic,
    evidenceMemoIds: value.ids.slice(0, 6),
  }));
  const topicCounts = collectCounts(memos, (memo) => memo.topics).filter((item) => item.count >= 2).slice(0, 6);
  const recurringTopics = topicCounts.map((item) => {
    const dates = item.evidenceMemoIds.map((id) => memoById.get(id)?.created_at ?? '').filter(Boolean).sort();
    return { ...item, firstAt: dates[0] ?? item.latestAt };
  });
  const observations = recurringTopics.slice(0, 4).map((item, index) => observation(
    `topic-${index}`,
    'memo-signal',
    item.label,
    `分布在 ${new Set(item.evidenceMemoIds.map((id) => timeKey(memoById.get(id)?.created_at ?? '', granularity))).size} 个时间段。`,
    item.count,
    item.evidenceMemoIds,
  ));
  return makeNode({
    id: 'year-ring-path',
    sampleSize: rings.length,
    summary: recurringTopics[0]
      ? `“${recurringTopics[0].label}”在这个窗口里跨 ${rings.length} 个时间段留下记录，可沿日期查看措辞如何变化。`
      : `这个窗口的记录分布在 ${rings.length} 个时间段，尚没有重复至少两次的主题。`,
    observations,
    evidenceIds: observations.flatMap((item) => item.evidenceMemoIds).concat(rings.flatMap((ring) => ring.evidenceMemoIds)),
    visualization: { kind: 'year-rings', granularity, rings, recurringTopics },
    memoById,
  });
}

function buildEchoNode(memos: ParsedMemo[], memoById: Map<string, ParsedMemo>): ForestNode {
  const people = collectCounts(memos, (memo) => memo.people).map((item) => ({ ...item, entityType: 'person' as const }));
  const projects = collectCounts(memos, (memo) => memo.projects).map((item) => ({ ...item, entityType: 'project' as const }));
  const entities = [...people, ...projects].sort((a, b) => b.count - a.count).slice(0, 10);
  const pairMap = new Map<string, { labels: [string, string]; ids: string[] }>();
  for (const memo of memos) {
    const labels = [...new Set([...memo.people, ...memo.projects])].slice(0, 8);
    for (let i = 0; i < labels.length; i += 1) {
      for (let j = i + 1; j < labels.length; j += 1) {
        const sorted = [labels[i], labels[j]].sort() as [string, string];
        const key = sorted.join('\u0000');
        const current = pairMap.get(key) ?? { labels: sorted, ids: [] };
        current.ids.push(memo.id);
        pairMap.set(key, current);
      }
    }
  }
  const coAppearances = [...pairMap.values()].filter((item) => item.ids.length >= 2)
    .sort((a, b) => b.ids.length - a.ids.length).slice(0, 6)
    .map((item) => ({ labels: item.labels, count: item.ids.length, evidenceMemoIds: item.ids.slice(0, 6) }));
  const observations = entities.slice(0, 4).map((item, index) => observation(
    `entity-${index}`,
    'memo-signal',
    item.label,
    `作为${item.entityType === 'person' ? '人物' : '项目'}标记出现在 ${item.count} 条记录里；只表示同篇出现。`,
    item.count,
    item.evidenceMemoIds,
  ));
  if (coAppearances[0]) observations.push(observation(
    'co-appearance-0',
    'memo-signal',
    `${coAppearances[0].labels[0]} × ${coAppearances[0].labels[1]}`,
    `在 ${coAppearances[0].count} 条记录中同时出现，不代表因果或关系性质。`,
    coAppearances[0].count,
    coAppearances[0].evidenceMemoIds,
  ));
  return makeNode({
    id: 'echo-hearth',
    sampleSize: memos.filter((memo) => memo.people.length + memo.projects.length > 0).length,
    summary: entities[0]
      ? `“${entities[0].label}”是这个窗口里出现较多的场景标记；可展开原文，看你在不同记录中如何描述它。`
      : '',
    observations,
    evidenceIds: observations.flatMap((item) => item.evidenceMemoIds),
    visualization: { kind: 'echo-clusters', entities, coAppearances },
    memoById,
  });
}

function buildTwinNode(
  memories: MemoryRow[],
  evidenceRows: MemoryEvidenceRow[],
  insights: InsightRow[],
  memoById: Map<string, ParsedMemo>,
): ForestNode {
  const memoryById = new Map(memories.map((item) => [item.id, item]));
  const grouped = new Map<string, MemoryEvidenceRow[]>();
  for (const row of evidenceRows) grouped.set(row.memory_id, [...(grouped.get(row.memory_id) ?? []), row]);
  const tensions: Array<{
    left: string;
    right: string;
    commonGround: string;
    source: 'memory-update' | 'memory-contradiction' | 'risk-candidate';
    evidenceMemoIds: string[];
  }> = [];
  for (const [memoryId, rows] of grouped) {
    const memory = memoryById.get(memoryId);
    if (!memory) continue;
    const base = rows.filter((row) => row.relation === 'introduced' || row.relation === 'supports');
    const changed = rows.filter((row) => row.relation === 'contradicts' || row.relation === 'updates');
    if (base.length === 0 || changed.length === 0) continue;
    const change = changed[0];
    tensions.push({
      left: memory.title,
      right: compact(change.excerpt, 90),
      commonGround: '同一项长期整理同时有原有证据和更新证据，适合并列核对。',
      source: change.relation === 'contradicts' ? 'memory-contradiction' : 'memory-update',
      evidenceMemoIds: [...base.map((row) => row.memo_id), ...changed.map((row) => row.memo_id)].slice(0, 6),
    });
  }
  const riskInsights = insights.filter((item) => item.type === 'risk_pattern').slice(0, 2);
  const observations = tensions.slice(0, 3).map((item, index) => observation(
    `tension-${index}`,
    'memory-candidate',
    item.left,
    item.commonGround,
    item.evidenceMemoIds.length,
    item.evidenceMemoIds,
  ));
  for (const insight of riskInsights) {
    const ids = parseArray(insight.evidence_memo_ids).filter((id) => memoById.has(id));
    if (ids.length === 0) continue;
    observations.push(observation(`risk-${insight.id}`, 'insight-candidate', insight.title, compact(insight.content), ids.length, ids));
  }
  return makeNode({
    id: 'twin-shadow-pond',
    sampleSize: tensions.length,
    summary: tensions[0]
      ? `“${tensions[0].left}”同时带着原有与更新证据；这里只把两边摆在一起，不替你判断哪边更真实。`
      : '',
    observations,
    evidenceIds: observations.flatMap((item) => item.evidenceMemoIds),
    visualization: { kind: 'twin-ripples', tensions: tensions.slice(0, 4) },
    memoById,
  });
}

function buildRootNode(
  memories: MemoryRow[],
  memoryEvidence: Map<string, MemoryEvidenceRow[]>,
  memoById: Map<string, ParsedMemo>,
): ForestNode {
  const allowed = new Set(['belief', 'pattern', 'preference', 'constraint', 'state']);
  const candidates = memories.filter((item) => allowed.has(item.type) && item.status === 'active')
    .map((item) => ({ item, evidence: memoryEvidence.get(item.id) ?? [] }))
    .filter(({ evidence }) => evidence.length > 0)
    .sort((a, b) => b.evidence.length - a.evidence.length || b.item.confidence - a.item.confidence)
    .slice(0, 8);
  const roots = candidates.map(({ item, evidence }) => ({
    id: item.id,
    memoryType: item.type as 'belief' | 'pattern' | 'preference' | 'constraint' | 'state',
    title: item.title,
    status: item.status,
    confidence: item.confidence,
    lastConfirmedAt: item.last_confirmed_at,
    evidenceMemoIds: evidence.map((row) => row.memo_id).slice(0, 8),
  }));
  const links = [] as Array<{ sourceId: string; targetId: string; sharedMemoCount: number; evidenceMemoIds: string[] }>;
  for (let i = 0; i < roots.length; i += 1) {
    for (let j = i + 1; j < roots.length; j += 1) {
      const second = new Set(roots[j].evidenceMemoIds);
      const shared = roots[i].evidenceMemoIds.filter((id) => second.has(id));
      if (shared.length > 0) links.push({ sourceId: roots[i].id, targetId: roots[j].id, sharedMemoCount: shared.length, evidenceMemoIds: shared });
    }
  }
  const observations = roots.slice(0, 5).map((root, index) => observation(
    `root-${index}`,
    'memory-candidate',
    root.title,
    `由 ${root.evidenceMemoIds.length} 条窗口内证据支撑的${root.memoryType === 'belief' ? '信念' : root.memoryType === 'state' ? '状态' : '长期'}候选，仍需用户核对。`,
    root.evidenceMemoIds.length,
    root.evidenceMemoIds,
  ));
  return makeNode({
    id: 'root-court',
    sampleSize: roots.length,
    summary: roots[0]
      ? `“${roots[0].title}”连接到较多窗口内证据；它是长期记忆候选，不自动等同于你确认的准则。`
      : '',
    observations,
    evidenceIds: observations.flatMap((item) => item.evidenceMemoIds),
    visualization: { kind: 'root-network', roots, links: links.sort((a, b) => b.sharedMemoCount - a.sharedMemoCount).slice(0, 8) },
    memoById,
  });
}

function buildWindNode(
  memos: ParsedMemo[],
  memories: MemoryRow[],
  memoryEvidence: Map<string, MemoryEvidenceRow[]>,
  memoById: Map<string, ParsedMemo>,
): ForestNode {
  const memoryDirections = memories.filter((item) => ['goal', 'project'].includes(item.type))
    .map((item) => ({ item, ids: (memoryEvidence.get(item.id) ?? []).map((row) => row.memo_id) }))
    .filter(({ ids }) => ids.length > 0)
    .slice(0, 6)
    .map(({ item, ids }) => ({
      id: item.id,
      directionType: item.type as 'goal' | 'project',
      label: item.title,
      count: ids.length,
      status: item.status,
      latestAt: item.last_confirmed_at,
      evidenceMemoIds: ids.slice(0, 6),
    }));
  const actions = collectCounts(memos, (memo) => memo.actions).slice(0, 4).map((item, index) => ({
    id: `action-${index}`,
    directionType: 'action' as const,
    label: item.label,
    count: item.count,
    status: 'candidate',
    latestAt: item.latestAt,
    evidenceMemoIds: item.evidenceMemoIds,
  }));
  const directions = [...memoryDirections, ...actions].sort((a, b) => b.count - a.count).slice(0, 8);
  const seenQuestions = new Set<string>();
  const openQuestions = memos.flatMap((memo) => memo.questions.map((text) => ({ text, recordedAt: memo.created_at, memoId: memo.id })))
    .filter((item) => {
      const key = item.text.replace(/\s+/gu, '');
      if (!key || seenQuestions.has(key)) return false;
      seenQuestions.add(key);
      return true;
    }).slice(0, 5);
  const observations = directions.slice(0, 4).map((item, index) => observation(
    `direction-${index}`,
    item.directionType === 'action' ? 'memo-signal' : 'memory-candidate',
    item.label,
    item.directionType === 'action'
      ? `出现在记录中的行动候选，不代表已承诺或已完成。`
      : `${item.directionType === 'goal' ? '目标' : '项目'}候选 · ${item.status === 'active' ? '活跃' : '沉静'}。`,
    item.count,
    item.evidenceMemoIds,
  ));
  return makeNode({
    id: 'windwatch-terrace',
    sampleSize: directions.length + openQuestions.length,
    summary: directions[0]
      ? `“${directions[0].label}”连接到较多方向证据；这里不排优先级，只提示值得继续观察的风向。`
      : openQuestions[0] ? `最近留下的问题“${compact(openQuestions[0].text, 50)}”可以作为一枚观察标记。` : '',
    observations,
    evidenceIds: observations.flatMap((item) => item.evidenceMemoIds).concat(openQuestions.map((item) => item.memoId)),
    visualization: { kind: 'wind-compass', directions, openQuestions },
    memoById,
  });
}

function connectNodes(nodes: ForestNode[]): ForestNode[] {
  const evidenceByNode = new Map(nodes.map((node) => [node.id, new Set(node.evidence.map((item) => item.memoId))]));
  return nodes.map((node) => {
    const source = evidenceByNode.get(node.id)!;
    const connections = nodes.flatMap((target) => {
      if (target.id === node.id) return [];
      const shared = [...source].filter((id) => evidenceByNode.get(target.id)?.has(id));
      if (shared.length === 0) return [];
      return [{
        toNodeId: target.id,
        sharedMemoCount: shared.length,
        evidenceMemoIds: shared.slice(0, 5),
        note: `${shared.length} 条原始记录也在「${target.name}」形成线索。`,
      }];
    }).sort((a, b) => b.sharedMemoCount - a.sharedMemoCount).slice(0, 2);
    return { ...node, connections };
  });
}

export function buildForestAtlas({
  userId,
  requestedWindow = 'auto',
  now = new Date(),
}: BuildForestAtlasInput): ForestAtlas {
  const resolved = resolveWindow(userId, requestedWindow, now);
  const from = cutoff(now, resolved.actualDays);
  const to = now.toISOString();
  const memos = loadMemos(userId, from, to);
  const memoById = new Map(memos.map((memo) => [memo.id, memo]));
  const memories = loadMemories(userId);
  const memoryEvidenceRows = loadMemoryEvidence(userId, from, to);
  const memoryEvidence = new Map<string, MemoryEvidenceRow[]>();
  for (const row of memoryEvidenceRows) {
    memoryEvidence.set(row.memory_id, [...(memoryEvidence.get(row.memory_id) ?? []), row]);
  }
  const insights = loadInsights(userId);
  const splitAt = new Date(now.getTime() - resolved.actualDays * 86_400_000 / 2).toISOString();

  const nodes = connectNodes([
    buildLanternNode(memos, memories, memoryEvidence, memoById, splitAt),
    buildYearNode(memos, memoById, resolved.actualDays),
    buildEchoNode(memos, memoById),
    buildTwinNode(memories, memoryEvidenceRows, insights, memoById),
    buildRootNode(memories, memoryEvidence, memoById),
    buildWindNode(memos, memories, memoryEvidence, memoById),
  ]).sort((a, b) => FOREST_NODE_ORDER.indexOf(a.id) - FOREST_NODE_ORDER.indexOf(b.id));

  const latestMemoAt = memos[0]?.created_at ?? null;
  const daysSinceLatest = latestMemoAt
    ? Math.max(0, Math.floor((now.getTime() - new Date(latestMemoAt).getTime()) / 86_400_000))
    : null;
  const windowMemoIds = new Set(memos.map((memo) => memo.id));
  const relevantInsightCount = insights.filter((item) => parseArray(item.evidence_memo_ids).some((id) => windowMemoIds.has(id))).length;

  return {
    version: 'forest-atlas-v1',
    generatedAt: now.toISOString(),
    window: {
      requested: requestedWindow,
      actualDays: resolved.actualDays,
      from,
      to,
      targetMemoCount: AUTO_TARGET_MEMOS,
      memoCount: memos.length,
      expanded: resolved.expanded,
    },
    freshness: {
      latestMemoAt,
      daysSinceLatest,
      state: daysSinceLatest === null ? 'empty' : daysSinceLatest <= 7 ? 'fresh' : daysSinceLatest <= 30 ? 'quiet' : 'stale',
    },
    coverage: {
      memoCount: memos.length,
      analyzedMemoCount: memos.filter((memo) => memo.analysis_status === 'done').length,
      emotionMemoCount: memos.filter((memo) => memo.emotions.length > 0).length,
      topicMemoCount: memos.filter((memo) => memo.topics.length > 0).length,
      peopleMemoCount: memos.filter((memo) => memo.people.length > 0).length,
      projectMemoCount: memos.filter((memo) => memo.projects.length > 0).length,
      actionMemoCount: memos.filter((memo) => memo.actions.length > 0).length,
      questionMemoCount: memos.filter((memo) => memo.questions.length > 0).length,
      memoryCandidateCount: new Set(memoryEvidenceRows.map((row) => row.memory_id)).size,
      insightCandidateCount: relevantInsightCount,
    },
    nodes,
  };
}
