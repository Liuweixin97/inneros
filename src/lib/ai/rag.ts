// ============================================================
// InnerOS - RAG (Retrieval-Augmented Generation)
// ============================================================

import { chatCompletionEventStream } from '@/lib/ai/client';
import type { LLMStreamEvent, LLMThinkingMode } from '@/lib/ai/gateway';
import { complete } from '@/lib/ai/gateway';
import { randomUUID } from 'crypto';
import {
  createEmbedding,
  isEmbeddingEnabled,
  isRerankEnabled,
  rerankDocuments,
} from '@/lib/ai/retrieval-provider';
import {
  buildSystemPromptWithPersonaAndContext,
  getModePrompt,
} from '@/lib/ai/prompts';
import type { Memo, Citation, ConversationMode } from '@/types';
import type {
  MemoSearchTerm,
  RankedMemoSearchResult,
} from '@/lib/db/memos';

type RetrievalSource = 'query' | 'memory' | 'vector' | 'state' | 'focused' | 'recent_baseline';
type RetrievalIntent =
  | 'fact'
  | 'person'
  | 'list'
  | 'timeline'
  | 'change'
  | 'pattern'
  | 'action'
  | 'general';
type RetrievalTimeScope = 'current' | 'recent' | 'all';

interface RetrievedMemo extends RankedMemoSearchResult {
  source: RetrievalSource;
  contextSnippet?: string;
}

interface RetrievalPlan {
  intent: RetrievalIntent;
  resolvedQuery: string;
  exactTerms: string[];
  semanticTerms: string[];
  people: string[];
  projects: string[];
  topics: string[];
  exhaustive: boolean;
  timeScope: RetrievalTimeScope;
}

// --- Context Builder ---

function findBestPassage(text: string, terms: string[], maxLength: number): string {
  const normalizedText = text.toLowerCase();
  const positions = terms
    .map((term) => normalizedText.indexOf(term.toLowerCase()))
    .filter((position) => position >= 0);
  const anchor = positions.length > 0 ? Math.min(...positions) : 0;
  const before = Math.floor(maxLength * 0.35);
  const start = Math.max(0, anchor - before);
  const end = Math.min(text.length, start + maxLength);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

function findRerankPassage(
  memo: Memo,
  matchedTerms: string[],
): string {
  return findBestPassage(memo.plain_text, matchedTerms, 140);
}

export function buildContext(results: RetrievedMemo[]): string {
  if (results.length === 0) {
    return '（没有找到相关的笔记记录）';
  }

  const sections: string[] = [];
  let usedCharacters = 0;
  const contextCharacterBudget = 16_000;
  for (const { memo, matchedTerms, contextSnippet } of results) {
    const date = new Date(memo.created_at).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const title = memo.ai_title || '无标题';
    const aiIndex = [
      memo.ai_summary ? `摘要: ${memo.ai_summary}` : '',
      memo.ai_topics?.length > 0 ? `主题: ${memo.ai_topics.join(', ')}` : '',
      memo.ai_actions?.length > 0 ? `行动项: ${memo.ai_actions.join('；')}` : '',
    ].filter(Boolean);

    const section = `标题: ${title}
ID: ${memo.id}
日期: ${date}
${aiIndex.length > 0 ? `AI 检索索引（非直接证据）: ${aiIndex.join('；')}` : ''}
相关原文片段（直接证据）: ${contextSnippet || findBestPassage(memo.plain_text, matchedTerms, 720)}`;
    if (sections.length > 0 && usedCharacters + section.length > contextCharacterBudget) break;
    sections.push(section);
    usedCharacters += section.length;
  }
  return sections.join('\n\n---\n\n');
}

// --- Citation Builder ---

/**
 * 从检索到的 Memo 中构建引用列表
 */
function buildRelevantSnippet(memo: Memo, terms: string[]): string {
  return findBestPassage(memo.plain_text, terms, 180);
}

export function buildCitations(results: RetrievedMemo[]): Citation[] {
  const maxScore = Math.max(1, ...results.map((item) => item.score));
  return results.map(({ memo, score, matchedTerms, source, contextSnippet }) => ({
    memo_id: memo.id,
    memo_title: memo.ai_title || null,
    memo_date: memo.created_at,
    relevant_snippet: contextSnippet?.slice(0, 180) || buildRelevantSnippet(memo, matchedTerms),
    relevance_score: Number((score / maxScore).toFixed(3)),
    matched_terms: matchedTerms,
    retrieval_reason: source === 'focused'
      ? '当前指定笔记'
      : source === 'state'
        ? `当前状态证据${matchedTerms.length > 0 ? `：${matchedTerms.slice(0, 2).join('、')}` : ''}`
      : source === 'memory'
        ? `长期记忆证据${matchedTerms.length > 0 ? `：${matchedTerms.slice(0, 3).join('、')}` : ''}`
      : source === 'vector'
        ? '语义相关记录'
      : source === 'recent_baseline'
        ? '近期状态背景'
      : matchedTerms.length > 0
        ? `命中：${matchedTerms.slice(0, 3).join('、')}`
        : '与当前问题相关',
  }));
}

// --- Memo Search ---

/**
 * 搜索与查询相关的 Memo（基于关键词的全文搜索）
 */
const GENERIC_SEARCH_TERMS = new Set([
  '反思', '变化', '记录', '笔记', '之前', '过去', '最近', '事情', '问题', '想法', '感受',
  '名字', '人物', '内容', '情况', '经历', '相关', '信息', '方面', '一些', '哪些',
]);

function fallbackSearchTerms(query: string): string[] {
  const corePhrase = query
    .replace(/我之前|我过去|我最近|请帮我|帮我|回看|看看|关于|对于|有什么|有哪些|是什么|怎么样|怎么|如何|为什么|反思|变化|记录|笔记|[？?！!，,。；;：:\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return [...new Set([
    ...(corePhrase.length >= 2 && corePhrase.length <= 24 ? [corePhrase] : []),
    ...query
    .replace(/[？?！!，,。；;：:\n]/g, ' ')
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2 && term.length <= 24),
  ].filter((term) => !GENERIC_SEARCH_TERMS.has(term)))]
    .slice(0, 8);
}

function uniqueTerms(values: unknown, limit: number): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => (
      value.length >= 2
      && value.length <= 24
      && !GENERIC_SEARCH_TERMS.has(value)
    )))]
    .slice(0, limit);
}

function localQueryTerms(query: string): string[] {
  const normalized = query
    .replace(/我什么时候开始意识到|我什么时候|什么时候|我有哪些记录是在说|有哪些记录是在说|我有哪些|有哪些/g, '')
    .replace(/[^\u4e00-\u9fff]/g, '');
  const ignored = new Set([
    '什么', '开始', '意识', '哪些', '记录', '笔记', '事情', '怎么', '如何',
    '为什么', '之前', '过去', '现在', '目前', '发生', '变化', '相关',
  ]);
  const terms: string[] = [];
  for (let index = 0; index < normalized.length - 1; index += 1) {
    const term = normalized.slice(index, index + 2);
    if (!ignored.has(term)) terms.push(term);
  }
  return [...new Set(terms)].slice(0, 10);
}

function inferFallbackIntent(query: string): RetrievalIntent {
  if (/谁|哪个人|人物/.test(query)) return 'person';
  if (/我.*(?:问题|风险|害怕|恐惧|担心|困境|阻力|挑战).*(?:什么|哪些)|我.*(?:经历|面对).*(?:问题|风险|困境|挑战)/.test(query)) {
    return 'general';
  }
  if (/哪些|列出|都有谁|有谁|全部|所有/.test(query)) return 'list';
  if (/变化|改变|以前.*现在|从前.*现在/.test(query)) return 'change';
  if (/反复|总是|规律|模式/.test(query)) return 'pattern';
  if (/时间线|过程|什么时候|先后/.test(query)) return 'timeline';
  if (/下一步|怎么办|行动|推进/.test(query)) return 'action';
  if (/是什么|为什么|怎么/.test(query)) return 'fact';
  return 'general';
}

function inferTimeScope(query: string): RetrievalTimeScope {
  if (/现在|当前|目前|眼下|今天|最近最|接下来/.test(query)) return 'current';
  if (/最近|近期|这段时间|本周|这个月|今年/.test(query)) return 'recent';
  return 'all';
}

function fallbackPlan(query: string): RetrievalPlan {
  return {
    intent: inferFallbackIntent(query),
    resolvedQuery: query,
    exactTerms: fallbackSearchTerms(query),
    semanticTerms: localQueryTerms(query),
    people: [],
    projects: [],
    topics: [],
    exhaustive: /哪些|列出|都有谁|有谁|全部|所有/.test(query),
    timeScope: inferTimeScope(query),
  };
}

async function buildRetrievalPlan(
  query: string,
  conversationHistory: { role: string; content: string }[],
): Promise<RetrievalPlan> {
  const recentUserContext = conversationHistory
    .filter((message) => message.role === 'user')
    .slice(-4)
    .map((message) => message.content.slice(0, 300));
  try {
    const completion = await complete({
      task: 'rag.query',
      temperature: 0,
      maxTokens: 500,
      json: true,
      messages: [
        {
          role: 'system',
          content: `你是个人笔记检索规划器。把问题转换为结构化检索计划，不要回答问题。
当前问题优先；仅在当前问题含“这件事、之前、他/她、那个项目”等指代时，使用对话上下文消解指代。
规则：
	1. intent 只能是 fact|person|list|timeline|change|pattern|action|general。
	   list 只用于列举具体记录、人物、项目、事件或实体；“我经历了什么问题、我害怕什么、有哪些风险/阻力/困境”属于跨记录综合，应使用 general，不是 list。
	2. resolved_query 是消解指代后的独立问题；没有指代时保持当前问题原意，不扩写成答案。
	3. time_scope 只能是 current|recent|all。“现在、当前、接下来”是 current，“最近、近期、今年”是 recent，其余为 all。
	4. exact_terms 是用户原话中的关键短语或可靠的指代消解结果，应保留动作与对象关系，例如“养过猫”而不只是“猫”。
	5. semantic_terms 是笔记里可能出现的同义表达，最多 8 个；不能输出“名字、人物、内容、记录、事情、问题”等泛词。
	   中文查询应优先补充笔记中更可能出现的紧凑短语和语序变体，例如“期待比较低”补充“低期待、没有预期、不抱期待”，“没有做成”补充“失败、未完成”。
	6. people/projects/topics 只放明确实体，不猜测。
	7. exhaustive 仅在用户要求“哪些、全部、列出、都有谁”等尽可能完整的结果时为 true。
	严格输出 JSON：
	{"intent":"fact","resolved_query":"独立问题","time_scope":"all","exact_terms":[],"semantic_terms":[],"people":[],"projects":[],"topics":[],"exhaustive":false}`,
        },
        {
          role: 'user',
          content: JSON.stringify({ current_query: query, recent_user_context: recentUserContext }),
        },
      ],
    });
    const parsed = JSON.parse(completion.content) as Record<string, unknown>;
    const validIntents: RetrievalIntent[] = [
      'fact', 'person', 'list', 'timeline', 'change', 'pattern', 'action', 'general',
    ];
    let intent = validIntents.includes(parsed.intent as RetrievalIntent)
      ? parsed.intent as RetrievalIntent
      : inferFallbackIntent(query);
    if (/什么时候|何时|最早|先后顺序|时间线/.test(query)) intent = 'timeline';
    if (/我.*(?:问题|风险|害怕|恐惧|担心|困境|阻力|挑战).*(?:什么|哪些)|我.*(?:经历|面对).*(?:问题|风险|困境|挑战)/.test(query)) {
      intent = 'general';
    }
    let resolvedQuery = typeof parsed.resolved_query === 'string'
      && parsed.resolved_query.trim().length >= 2
      && parsed.resolved_query.trim().length <= 200
      ? parsed.resolved_query.trim()
      : query;
    const hasReference = /这件事|这个|那个|上述|前面|他|她|它/.test(query);
    const latestUserContext = recentUserContext.at(-1);
    if (hasReference && latestUserContext && resolvedQuery === query) {
      resolvedQuery = `${latestUserContext}；继续追问：${query}`;
    }
    const validTimeScopes: RetrievalTimeScope[] = ['current', 'recent', 'all'];
    let timeScope = validTimeScopes.includes(parsed.time_scope as RetrievalTimeScope)
      ? parsed.time_scope as RetrievalTimeScope
      : inferTimeScope(query);
    if (['change', 'timeline'].includes(intent) && !/最近|近期|本周|这个月/.test(query)) {
      timeScope = 'all';
    }
    return {
      intent,
      resolvedQuery,
      exactTerms: uniqueTerms([
        ...fallbackSearchTerms(resolvedQuery),
        ...uniqueTerms(parsed.exact_terms, 8),
      ], 10),
      semanticTerms: uniqueTerms([
        ...localQueryTerms(resolvedQuery),
        ...uniqueTerms(parsed.semantic_terms, 8),
      ], 12),
      people: uniqueTerms(parsed.people, 6),
      projects: uniqueTerms(parsed.projects, 6),
      topics: uniqueTerms(parsed.topics, 6),
      exhaustive: /哪些记录|哪些笔记|列出|都有谁|有谁|全部|所有/.test(query),
      timeScope,
    };
  } catch (error) {
    console.warn('[RAG] 检索规划失败，使用本地回退:', error);
    return fallbackPlan(query);
  }
}

function toSearchTerms(plan: RetrievalPlan): MemoSearchTerm[] {
  return [
    ...plan.exactTerms.map((value) => ({ value, kind: 'exact' as const })),
    ...plan.people.map((value) => ({ value, kind: 'entity' as const })),
    ...plan.projects.map((value) => ({ value, kind: 'entity' as const })),
    ...plan.topics.map((value) => ({ value, kind: 'entity' as const })),
    ...plan.semanticTerms.map((value) => ({ value, kind: 'semantic' as const })),
  ];
}

function normalizeForDedup(value: string): string {
  return value
    .toLowerCase()
    .replace(/^(#[^\s\n#]+[\s\n]*)+/, '')
    .replace(/[\s`*_#>「」『』“”"'，。！？、；：,.!?;:()[\]（）-]/g, '');
}

function deduplicateResults(results: RetrievedMemo[]): RetrievedMemo[] {
  const seenTexts = new Set<string>();
  const seenTitleSummaries = new Set<string>();
  return results.filter((result) => {
    const textKey = normalizeForDedup(result.memo.plain_text);
    const titleSummaryKey = normalizeForDedup(
      `${result.memo.ai_title || ''}|${result.memo.ai_summary || ''}`,
    );
    if (textKey.length >= 20 && seenTexts.has(textKey)) return false;
    if (titleSummaryKey.length >= 20 && seenTitleSummaries.has(titleSummaryKey)) return false;
    if (textKey.length >= 20) seenTexts.add(textKey);
    if (titleSummaryKey.length >= 20) seenTitleSummaries.add(titleSummaryKey);
    return true;
  });
}

function minimumScore(plan: RetrievalPlan): number {
  const hasEntity = plan.people.length + plan.projects.length > 0;
  if (hasEntity) return 8;
  if (plan.semanticTerms.length > 0) return 2;
  return 5;
}

function addIntentScore(plan: RetrievalPlan, result: RetrievedMemo): RetrievedMemo {
  if (plan.timeScope === 'all') return result;
  const ageDays = Math.max(
    0,
    (Date.now() - new Date(result.memo.created_at).getTime()) / 86_400_000,
  );
  const halfLife = plan.timeScope === 'current' ? 120 : 240;
  const recencyBonus = 16 * Math.exp(-ageDays / halfLife);
  const stalePenalty = plan.timeScope === 'current' && ageDays > 540 ? 8 : 0;
  return {
    ...result,
    score: result.score + recencyBonus - stalePenalty,
  };
}

function attachContextSnippet(
  result: RetrievedMemo,
): RetrievedMemo {
  return {
    ...result,
    contextSnippet: result.matchedChunk
      ? result.matchedChunk.slice(0, 1000)
      : findBestPassage(result.memo.plain_text, result.matchedTerms, 650),
  };
}

function shouldRerank(plan: RetrievalPlan, results: RetrievedMemo[]): boolean {
  if (results.length === 0) return false;
  if (results.length < 4) return false;
  if (results.some((result) => result.source === 'vector')) return true;
  if (plan.exhaustive || plan.intent === 'list') return true;
  if (['change', 'pattern', 'timeline', 'general'].includes(plan.intent)) return true;
  const top = results[0]?.score ?? 0;
  const fourth = results[3]?.score ?? 0;
  return top > 0 && fourth / top >= 0.72;
}

function buildRerankCandidates(
  plan: RetrievalPlan,
  results: RetrievedMemo[],
): RetrievedMemo[] {
  const directConceptCandidates = results
    .filter((result) => hasStrongConceptMatch(plan, result))
    .sort((a, b) => (
      queryBigramCoverage(plan, b) - queryBigramCoverage(plan, a)
      || b.score - a.score
    ))
    .slice(0, 6);
  const lexicalCandidates = results
    .filter((result) => result.source === 'query')
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  const semanticCandidates = results
    .filter((result) => result.source === 'vector')
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  const temporalCandidates = ['change', 'timeline', 'pattern'].includes(plan.intent)
    ? [
      ...[...results].sort((a, b) => a.memo.created_at.localeCompare(b.memo.created_at)).slice(0, 4),
      ...[...results].sort((a, b) => b.memo.created_at.localeCompare(a.memo.created_at)).slice(0, 4),
    ]
    : [];
  return deduplicateResults([
    ...directConceptCandidates,
    ...lexicalCandidates,
    ...semanticCandidates,
    ...temporalCandidates,
    ...results,
  ]).slice(0, 36);
}

function isEvidenceListQuery(query: string): boolean {
  return /哪些记录|哪些笔记|哪些内容|有哪些记录|有哪些笔记|有哪些内容/.test(query);
}

function normalizeConcept(value: string): string {
  return value
    .toLowerCase()
    .replace(/从|到|转向|转为|先|再|只|靠|需要|应该|不能|不要|不再|比|更|的|了|过/g, '')
    .replace(/[\s，。！？、；：,.!?;:()[\]（）"'“”‘’-]/g, '');
}

function queryBigramCoverage(plan: RetrievalPlan, item: RetrievedMemo): number {
  const query = plan.resolvedQuery.replace(/[^\u4e00-\u9fff]/g, '');
  const genericBigrams = new Set([
    '什么', '时候', '开始', '意识', '哪些', '怎么', '如何', '为什么',
    '之前', '过去', '现在', '目前', '记录', '笔记', '事情', '发生',
  ]);
  const bigrams = new Set<string>();
  for (let index = 0; index < query.length - 1; index += 1) {
    const bigram = query.slice(index, index + 2);
    if (!genericBigrams.has(bigram)) bigrams.add(bigram);
  }
  const haystack = `${item.memo.ai_title || ''} ${item.memo.ai_summary || ''}`;
  return [...bigrams].filter((bigram) => haystack.includes(bigram)).length;
}

function hasStrongConceptMatch(plan: RetrievalPlan, item: RetrievedMemo): boolean {
  const haystack = normalizeConcept([
    item.memo.ai_title || '',
    item.memo.ai_summary || '',
    item.matchedChunk || '',
  ].join(' '));
  const phraseMatch = [...plan.exactTerms, ...plan.semanticTerms].some((term) => {
    const concept = normalizeConcept(term);
    return concept.length >= 4 && haystack.includes(concept);
  });
  const topicCoverage = plan.topics.filter((topic) => (
    normalizeConcept(topic).length >= 2
    && haystack.includes(normalizeConcept(topic))
  )).length;
  return phraseMatch
    || (plan.topics.length >= 2 && topicCoverage >= 2)
    || queryBigramCoverage(plan, item) >= 3;
}

function conceptCoverage(plan: RetrievalPlan, item: RetrievedMemo): number {
  const haystack = normalizeConcept([
    item.memo.ai_title || '',
    item.memo.ai_summary || '',
    item.matchedChunk || '',
  ].join(' '));
  return plan.topics.filter((topic) => (
    normalizeConcept(topic).length >= 2
    && haystack.includes(normalizeConcept(topic))
  )).length;
}

function diversifyTemporalEvidence(
  plan: RetrievalPlan,
  results: RetrievedMemo[],
  limit: number,
): RetrievedMemo[] {
  if (!['change', 'timeline', 'pattern'].includes(plan.intent) || results.length <= 3) {
    return results.slice(0, limit);
  }
  const chronological = [...results].sort(
    (a, b) => a.memo.created_at.localeCompare(b.memo.created_at),
  );
  const selected = new Map<string, RetrievedMemo>();
  const add = (item: RetrievedMemo | undefined) => {
    if (item) selected.set(item.memo.id, item);
  };
  add(chronological[0]);
  add(chronological[chronological.length - 1]);
  add(chronological[Math.floor((chronological.length - 1) / 2)]);
  for (const item of results) {
    add(item);
    if (selected.size >= limit) break;
  }
  return [...selected.values()].slice(0, limit);
}

function selectFinalEvidence(
  plan: RetrievalPlan,
  results: RetrievedMemo[],
  limit: number,
): RetrievedMemo[] {
  const temporal = diversifyTemporalEvidence(plan, results, limit);
  if (plan.intent !== 'action' || plan.timeScope !== 'current') return temporal;
  const currentState = temporal
    .filter((item) => item.source === 'state')
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  return deduplicateResults([...currentState, ...temporal]).slice(0, limit);
}

async function rerankResults(
  query: string,
  plan: RetrievalPlan,
  results: RetrievedMemo[],
  limit: number,
): Promise<RetrievedMemo[]> {
  if (!shouldRerank(plan, results)) return results.slice(0, limit);
  const candidates = buildRerankCandidates(plan, results);
  const highConfidenceVectorEvidence = candidates
    .filter((item) => (
      (item.vectorSimilarity || 0) >= 0.68
      || hasStrongConceptMatch(plan, item)
      || (
        isEvidenceListQuery(plan.resolvedQuery)
        && item.source === 'query'
        && item.matchedTerms.some((term) => term.replace(/\s+/g, '').length >= 3)
      )
    ))
    .sort((a, b) => (
      Number(hasStrongConceptMatch(plan, b)) - Number(hasStrongConceptMatch(plan, a))
      || conceptCoverage(plan, b) - conceptCoverage(plan, a)
      || queryBigramCoverage(plan, b) - queryBigramCoverage(plan, a)
      || (b.vectorSimilarity || 0) - (a.vectorSimilarity || 0)
      || b.score - a.score
    ))
    .slice(0, 2);
  if (isRerankEnabled()) {
    try {
      const ranked = await rerankDocuments(
        query,
        candidates.map(({ memo, matchedTerms, matchedChunk }) => [
          `标题：${memo.ai_title || ''}`,
          `日期：${memo.created_at.slice(0, 10)}`,
          `摘要：${memo.ai_summary || ''}`,
          `人物：${memo.ai_people.join('、')}`,
          `项目：${memo.ai_projects.join('、')}`,
          `主题：${memo.ai_topics.join('、')}`,
          `原文：${matchedChunk || findRerankPassage(memo, matchedTerms)}`,
        ].join('\n')),
        Math.min(limit, 18),
      );
      const reranked = ranked.flatMap(({ index, relevanceScore }, rank) => {
        const candidate = candidates[index];
        if (!candidate) return [];
        return [{
          ...candidate,
          score: candidate.score + relevanceScore * 16 + (18 - rank),
        }];
      });
      if (reranked.length > 0) {
        return selectFinalEvidence(
          plan,
          deduplicateResults([...highConfidenceVectorEvidence, ...reranked, ...candidates]),
          limit,
        );
      }
    } catch (error) {
      console.warn('[RAG] 专用重排失败，回退 DeepSeek 重排:', error);
    }
  }
  try {
    const completion = await complete({
      task: 'rag.rerank',
      temperature: 0,
      maxTokens: 800,
      json: true,
      messages: [
        {
          role: 'system',
          content: `你是个人笔记检索重排器。只判断候选笔记是否能直接帮助回答当前问题。
优先原文直接证据；AI 标题摘要只用于导航。排除只因泛词命中、主题相邻但不能回答、以及内容重复的候选。
	对于 list 查询，必须验证问题中的主体、动作和对象关系。例如“我养过哪些猫”不能选择只出现猫、看猫或撸猫的记录；没有直接证据时返回空数组。
对于 change/pattern/timeline，优先覆盖不同时间与可能的反例。
只能返回输入中的 ID，最多返回 18 个。宁可保留有合理相关性的候选供回答模型判断，也不要只留下少数表面最相似的记录。严格输出 JSON：{"ids":["候选ID"]}。`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            query,
            intent: plan.intent,
            exhaustive: plan.exhaustive,
            candidates: candidates.map(({ memo, matchedTerms, matchedChunk }) => ({
              id: memo.id,
              date: memo.created_at.slice(0, 10),
              title: memo.ai_title || '',
              summary: memo.ai_summary || '',
              people: memo.ai_people,
              projects: memo.ai_projects,
              topics: memo.ai_topics,
              matched_terms: matchedTerms,
              excerpt: matchedChunk || findRerankPassage(memo, matchedTerms),
            })),
          }),
        },
      ],
    });
    const parsed = JSON.parse(completion.content) as { ids?: unknown[] };
    const byId = new Map(candidates.map((item) => [item.memo.id, item]));
    const reranked = Array.isArray(parsed.ids)
      ? parsed.ids.flatMap((id, index) => {
        if (typeof id !== 'string') return [];
        const candidate = byId.get(id);
        return candidate ? [{ ...candidate, score: candidate.score + (18 - index) }] : [];
      })
      : [];
    if (reranked.length === 0) {
      return selectFinalEvidence(plan, candidates, limit);
    }
    return selectFinalEvidence(
      plan,
      deduplicateResults([...highConfidenceVectorEvidence, ...reranked, ...candidates]),
      limit,
    );
  } catch (error) {
    console.warn('[RAG] 重排失败，使用本地排序:', error);
    return selectFinalEvidence(plan, results, limit);
  }
}

function passesTimeGate(plan: RetrievalPlan, result: RetrievedMemo): boolean {
  if (plan.timeScope !== 'current') return true;
  if (!['action', 'general', 'fact'].includes(plan.intent)) return true;
  const ageDays = Math.max(
    0,
    (Date.now() - new Date(result.memo.created_at).getTime()) / 86_400_000,
  );
  return ageDays <= 400;
}

async function recordRetrievalRun(input: {
  query: string;
  plan: RetrievalPlan;
  candidateCount: number;
  results: RetrievedMemo[];
  startedAt: number;
}): Promise<void> {
  try {
    const { getDb } = await import('@/lib/db');
    getDb().prepare(`
      INSERT INTO retrieval_runs (
        id, query, resolved_query, intent, plan, candidate_count,
        result_count, results, latency_ms, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      input.query,
      input.plan.resolvedQuery,
      input.plan.intent,
      JSON.stringify(input.plan),
      input.candidateCount,
      input.results.length,
      JSON.stringify(input.results.map((item) => ({
        memo_id: item.memo.id,
        title: item.memo.ai_title,
        date: item.memo.created_at.slice(0, 10),
        source: item.source,
        score: Number(item.score.toFixed(3)),
        vector_similarity: item.vectorSimilarity ?? null,
        matched_chunk_index: item.matchedChunkIndex ?? null,
      }))),
      Date.now() - input.startedAt,
      new Date().toISOString(),
    );
  } catch (error) {
    console.warn('[RAG] 检索日志写入失败:', error);
  }
}

export async function searchRelevantMemos(
  query: string,
  conversationHistory: { role: string; content: string }[],
  limit: number = 16,
  userId?: string,
): Promise<RetrievedMemo[]> {
  const startedAt = Date.now();
  const {
    getMemoById,
    getRecentActionMemos,
    searchMemosByEmbedding,
    searchMemosByTerms,
  } = await import('@/lib/db/memos');
  const {
    getCurrentMemoryEvidence,
    searchMemoryEvidenceByTerms,
  } = await import('@/lib/db/memories');
  const plan = await buildRetrievalPlan(query, conversationHistory);
  const retrievalQuery = plan.resolvedQuery || query;
  const queryEmbedding = isEmbeddingEnabled()
    ? await createEmbedding(retrievalQuery).catch((error) => {
      console.warn('[RAG] 查询向量生成失败，继续使用本地召回:', error);
      return null;
    })
    : null;
  const searchTerms = toSearchTerms(plan);
  const termValues = searchTerms.map((term) => term.value);
  const candidateLimit = plan.exhaustive ? 90 : 60;
  const resultLimit = plan.exhaustive ? Math.max(limit, 18) : limit;
  const directResults = searchMemosByTerms(retrievalQuery, searchTerms, candidateLimit, userId)
    .map((result) => ({ ...result, source: 'query' as const }));
  const merged = new Map<string, RetrievedMemo>(
    directResults.map((result) => [result.memo.id, result]),
  );
  if (queryEmbedding) {
    for (const vectorMatch of searchMemosByEmbedding(queryEmbedding, candidateLimit, 0.32, userId)) {
      const existing = merged.get(vectorMatch.memo.id);
      if (existing) {
        existing.score += Math.min(9, vectorMatch.score * 0.38);
        existing.matchedChunk = vectorMatch.matchedChunk;
        existing.matchedChunkIndex = vectorMatch.matchedChunkIndex;
        existing.matchedChunkStart = vectorMatch.matchedChunkStart;
        existing.vectorSimilarity = vectorMatch.vectorSimilarity;
        continue;
      }
      merged.set(vectorMatch.memo.id, {
        ...vectorMatch,
        source: 'vector',
      });
    }
  }
  for (const memoryMatch of searchMemoryEvidenceByTerms(termValues, candidateLimit, userId)) {
    const existing = merged.get(memoryMatch.memoId);
    if (existing) {
      existing.score += Math.min(8, memoryMatch.score * 0.45);
      existing.matchedTerms = [...new Set([...existing.matchedTerms, ...memoryMatch.matchedTerms])];
      continue;
    }
    const memo = getMemoById(memoryMatch.memoId);
    if (!memo || memo.privacy_level !== 'normal') continue;
    merged.set(memo.id, {
      memo,
      score: memoryMatch.score * 0.45 + 3,
      matchedTerms: memoryMatch.matchedTerms,
      source: 'memory',
    });
  }
  if (plan.intent === 'action' && plan.timeScope === 'current') {
    for (const stateMemo of getRecentActionMemos(24, 400, userId)) {
      const existing = merged.get(stateMemo.memo.id);
      if (existing) {
        existing.score += Math.min(10, stateMemo.score * 0.3);
        existing.matchedTerms = [...new Set([...existing.matchedTerms, ...stateMemo.matchedTerms])];
        continue;
      }
      merged.set(stateMemo.memo.id, { ...stateMemo, source: 'state' });
    }
    for (const stateMemory of getCurrentMemoryEvidence(16, 400, userId)) {
      const existing = merged.get(stateMemory.memoId);
      if (existing) {
        existing.score += Math.min(12, stateMemory.score * 0.35);
        existing.matchedTerms = [...new Set([...existing.matchedTerms, ...stateMemory.matchedTerms])];
        continue;
      }
      const memo = getMemoById(stateMemory.memoId);
      if (!memo || memo.privacy_level !== 'normal') continue;
      merged.set(memo.id, {
        memo,
        score: stateMemory.score,
        matchedTerms: stateMemory.matchedTerms,
        source: 'state',
      });
    }
  }
  const ranked = [...merged.values()]
    .filter((item) => passesTimeGate(plan, item))
    .filter((item) => item.score >= minimumScore(plan))
    .map((item) => addIntentScore(plan, item))
    .sort((a, b) => b.score - a.score || b.memo.created_at.localeCompare(a.memo.created_at))
    .slice(0, candidateLimit);
  const deduplicated = deduplicateResults(ranked);
  const reranked = await rerankResults(retrievalQuery, plan, deduplicated, resultLimit);
  const results = reranked.map((item) => attachContextSnippet(item));
  await recordRetrievalRun({
    query,
    plan,
    candidateCount: deduplicated.length,
    results,
    startedAt,
  });
  return results;
}

// --- Persona Anchor Builder ---

/**
 * 从 memories 库中提取 active 状态的用户记忆，生成个性锚点文本。
 * 优先选取 belief / preference / pattern / goal / state 类型，最多 8 条。
 * 保留真实 memory ID，始终存在于 System Prompt 中（不占 memo 上下文配额）。
 */
interface ContextReferenceResult {
  text: string;
  citations: Citation[];
}

async function buildPersonaAnchor(userId?: string): Promise<ContextReferenceResult> {
  try {
    const { getMemories } = await import('@/lib/db/memories');
    const { memories } = getMemories({ status: 'active', limit: 40, userId });
    // 优先选取人格相关类型
    const PERSONA_TYPES = new Set(['belief', 'preference', 'pattern', 'state', 'goal', 'constraint']);
    const sorted = memories
      .filter((m) => PERSONA_TYPES.has(m.type))
      .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
      .slice(0, 8);
    if (sorted.length === 0) return { text: '', citations: [] };
    const lines = sorted.map((m) => {
      const typeLabel: Record<string, string> = {
        belief: '信念', preference: '偏好', pattern: '规律', state: '当前状态',
        goal: '目标', constraint: '约束',
      };
      const label = typeLabel[m.type] ?? m.type;
      return `ID: ${m.id} | [${label}] ${m.title}：${m.summary}`;
    });
    const raw = lines.join('\n');
    return {
      text: raw,
      citations: sorted.map((memory) => ({
        reference_type: 'memory',
        reference_id: memory.id,
        memo_id: memory.id,
        memo_title: memory.title,
        memo_date: memory.last_confirmed_at,
        relevant_snippet: memory.summary,
        relevance_score: memory.confidence,
        retrieval_reason: '长期记忆 / 个性锚点',
      })),
    };
  } catch (err) {
    console.warn('[RAG] buildPersonaAnchor 失败:', err);
    return { text: '', citations: [] };
  }
}

async function buildPrinciplesContext(userId?: string): Promise<ContextReferenceResult> {
  try {
    const { getInsights } = await import('@/lib/db/insights');
    const principles = getInsights(userId).filter((insight) => insight.saved_as_principle);
    return {
      text: principles
        .map((principle) => `ID: ${principle.id} | 【${principle.title}】：${principle.content}`)
        .join('\n'),
      citations: principles.map((principle) => ({
        reference_type: 'principle',
        reference_id: principle.id,
        memo_id: principle.id,
        memo_title: principle.title,
        memo_date: principle.created_at,
        relevant_snippet: principle.content,
        relevance_score: principle.confidence === 'high'
          ? 1
          : principle.confidence === 'medium' ? 0.7 : 0.4,
        retrieval_reason: '用户保存的准则',
        evidence_memo_ids: principle.evidence_memo_ids,
      })),
    };
  } catch (err) {
    console.error('[RAG] 准则注入失败:', err);
    return { text: '', citations: [] };
  }
}

// --- Recent Baseline Builder ---

/**
 * 获取最近 14 天内 3-5 条笔记的轻量摘要，提供「当下感」基线。
 * 仅返回标题 + 一句摘要 + 日期，不含全文（控制 token 成本）。
 * 已在主检索中出现的 memo 会被过滤，避免重复。
 */
interface RecentBaselineResult {
  text: string;
  memos: Memo[];
}

async function getRecentBaselineMemos(
  alreadyRetrievedIds: Set<string>,
  userId?: string,
  limit = 5,
): Promise<RecentBaselineResult> {
  try {
    const { getMemos } = await import('@/lib/db/memos');
    const cutoff = new Date(Date.now() - 14 * 86_400_000).toISOString();
    const { memos } = getMemos({
      dateFrom: cutoff,
      analysisStatus: 'done',
      userId,
      limit: 20,
    });
    const recent = memos
      .filter((m) => m.privacy_level === 'normal' && !alreadyRetrievedIds.has(m.id))
      .slice(0, limit);
    if (recent.length === 0) return { text: '', memos: [] };
    const lines = recent.map((m) => {
      const date = new Date(m.created_at).toLocaleDateString('zh-CN', {
        month: '2-digit', day: '2-digit',
      });
      const summary = m.ai_summary || m.plain_text.slice(0, 60);
      return `ID: ${m.id} | [${date}] ${m.ai_title || '无标题'}：${summary}`;
    });
    return {
      text: lines.join('\n'),
      memos: recent,
    };
  } catch (err) {
    console.warn('[RAG] getRecentBaselineMemos 失败:', err);
    return { text: '', memos: [] };
  }
}

// --- Expanded Search (Low Coverage Fallback) ---

/**
 * 当主检索命中少于 threshold 条时，触发扩展召回：
 * 1. 从最活跃的 3 个主题各取 1 条代表性笔记（最近 90 天）
 * 2. 从 insights 表取最近 3 条洞察的压缩摘要
 * 结果以轻量格式追加到主上下文末尾。
 */
async function expandSearchIfLowCoverage(
  alreadyRetrievedIds: Set<string>,
  userId: string | undefined,
  threshold = 5,
  currentCount: number,
): Promise<string> {
  if (currentCount >= threshold) return '';
  const parts: string[] = [];
  try {
    // Part 1: 最活跃主题的代表笔记
    const { getTopics, getMemosForTopicName } = await import('@/lib/db/topics');
    const allTopics = getTopics(userId);
    const cutoff90 = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const activeTopics = allTopics
      .filter((t) => t.last_seen_at >= cutoff90)
      .sort((a, b) => b.memo_count - a.memo_count)
      .slice(0, 3);
    const topicLines: string[] = [];
    for (const topic of activeTopics) {
      const topicMemos = getMemosForTopicName(topic.name, 5, userId);
      const candidate = topicMemos.find((m: { id: string }) => !alreadyRetrievedIds.has(m.id));
      if (candidate) {
        const date = new Date((candidate as { created_at: string }).created_at).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
        const summary = (candidate as { ai_summary?: string; plain_text?: string }).ai_summary
          || ((candidate as { plain_text?: string }).plain_text || '').slice(0, 60);
        topicLines.push(`[主题:${topic.name}][${date}] ${(candidate as { ai_title?: string }).ai_title || '无标题'}：${summary}`);
      }
    }
    if (topicLines.length > 0) {
      parts.push(`活跃主题代表记录（补充背景）：\n${topicLines.join('\n')}`);
    }
  } catch (err) {
    console.warn('[RAG] expandSearch topics 失败:', err);
  }
  try {
    // Part 2: 最近洞察摘要
    const { getInsights } = await import('@/lib/db/insights');
    const insights = getInsights().slice(0, 3);
    if (insights.length > 0) {
      const insightLines = insights.map((i) => `[洞察] ${i.title}：${i.content.slice(0, 80)}`);
      parts.push(`近期自动洞察摘要（补充模式）：\n${insightLines.join('\n')}`);
    }
  } catch (err) {
    console.warn('[RAG] expandSearch insights 失败:', err);
  }
  return parts.join('\n\n');
}

// --- RAG Response Generator ---

export interface RAGResponse {
  stream: ReadableStream<LLMStreamEvent>;
  citations: Citation[];
  recentBaselineDays: number | null;
}

/**
 * 生成 RAG 增强的 AI 响应（三层上下文版本）
 *
 * 发心校准：每次调用前，记住 InnerOS 的核心是让用户「看见自己」，
 * 而不是给出建议。这里组装的上下文应该帮助 LLM 成为镜子，而非顾问。
 *
 * Layer 1: 个性锚点（Persona Anchor）— 用户是谁
 * Layer 2: 主检索（Main Retrieval）— 相关性最高的笔记
 * Layer 3a: 最近基线（Recent Baseline）— 当下感，最近 14 天
 * Layer 3b: 扩展召回（Expanded Search）— 命中 < 5 时触发
 */
export async function generateRAGResponse(
  query: string,
  conversationHistory: { role: string; content: string }[],
  mode: ConversationMode,
  focusedMemoId?: string,
  thinking: LLMThinkingMode = 'disabled',
  userId?: string,
): Promise<RAGResponse> {
  // 1. 搜索相关 Memo
  let retrievedMemos = await searchRelevantMemos(
    query,
    conversationHistory,
    16,
    userId,
  );
  if (focusedMemoId) {
    const { getMemoById } = await import('@/lib/db/memos');
    const focusedMemo = await getMemoById(focusedMemoId);
    if (focusedMemo?.privacy_level === 'normal' && (!userId || focusedMemo.user_id === userId)) {
      const withoutDuplicate = retrievedMemos.filter((item) => item.memo.id !== focusedMemo.id);
      retrievedMemos = [{
        memo: focusedMemo,
        score: 100,
        matchedTerms: [],
        source: 'focused',
      }, ...withoutDuplicate.slice(0, 15)];
    }
  }

  // 2. 构建引用
  const citations = buildCitations(retrievedMemos);

  // 3. 构建主检索上下文
  const mainContext = buildContext(retrievedMemos);
  const retrievedIds = new Set(retrievedMemos.map((item) => item.memo.id));

  // 4. Layer 1: 个性锚点（并发获取，不阻塞主流程）
  const personaAnchorPromise = buildPersonaAnchor(userId);

  // 5. Layer 3a: 最近基线（过去 14 天，不与主检索重复）
  const recentBaselinePromise = getRecentBaselineMemos(retrievedIds, userId, 5);

  // 6. Layer 3b: 扩展召回（命中 < 5 条时激活，threshold=5 为激进模式）
  const expandedSearchPromise = expandSearchIfLowCoverage(retrievedIds, userId, 5, retrievedMemos.length);

  const principlesPromise = buildPrinciplesContext(userId);

  const [personaAnchorResult, recentBaselineResult, expandedSearch, principlesResult] = await Promise.all([
    personaAnchorPromise,
    recentBaselinePromise,
    expandedSearchPromise,
    principlesPromise,
  ]);

  const personaAnchor = personaAnchorResult.text;
  const recentBaseline = recentBaselineResult.text;
  const recentBaselineMemos = recentBaselineResult.memos;

  // Append recent baseline memos to citations list so they are not sanitized
  // and the client can look up their titles.
  if (recentBaselineMemos && recentBaselineMemos.length > 0) {
    const recentRetrieved = recentBaselineMemos.map((m) => ({
      memo: m,
      score: 50,
      matchedTerms: [] as string[],
      source: 'recent_baseline' as const,
      contextSnippet: m.ai_summary || m.plain_text.slice(0, 180),
    }));
    citations.push(...buildCitations(recentRetrieved));
  }
  citations.push(...personaAnchorResult.citations, ...principlesResult.citations);

  // 7. 合并主上下文和扩展召回
  const fullMainContext = expandedSearch
    ? `${mainContext}\n\n---\n\n${expandedSearch}`
    : mainContext;

  // 8. 准则张力提示（镜子模式：指出用户行为与准则的张力，而非评判）
  const principlesTension = principlesResult.text;

  // 9. 组装系统提示词（三层上下文版本）
  const modePrompt = getModePrompt(mode);
  const systemPrompt = buildSystemPromptWithPersonaAndContext(
    modePrompt,
    fullMainContext,
    personaAnchor,
    recentBaseline,
    principlesTension,
  );

  // 10. 计算最近基线的天数范围（供 UI 展示）
  const recentBaselineDays = recentBaseline.trim() ? 14 : null;

  // 11. 组装消息（system + 历史对话 + 当前查询）
  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: query },
  ];

  // 12. 调用流式 AI
  const stream = await chatCompletionEventStream(messages, {
    task: 'chat.respond',
    user_id: userId,
    max_tokens: thinking === 'enabled' ? 8192 : 4096,
    thinking,
  });

  return { stream, citations, recentBaselineDays };
}
