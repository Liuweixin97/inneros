// ============================================================
// InnerOS - Core Type Definitions
// ============================================================

// --- Memo (核心实体) ---

export type MemoCategory =
  | '方法论'
  | '感受'
  | '观察'
  | '项目'
  | '日记'
  | '摘录'
  | '任务'
  | '资料';

export type EmotionType =
  | '平静'
  | '有力量'
  | '焦虑'
  | '低落'
  | '迷茫'
  | '被认可'
  | '愤怒'
  | '喜悦';

export interface Memo {
  id: string;
  user_id?: string;
  raw_content: string;
  plain_text: string;
  created_at: string;
  updated_at: string;
  source: 'manual' | 'flomo' | 'markdown' | 'txt';

  // 用户原始标签
  original_tags: string[];

  // AI 生成字段
  ai_title: string | null;
  ai_summary: string | null;
  ai_category: MemoCategory | null;
  ai_topics: string[];
  ai_emotions: EmotionType[];
  ai_people: string[];
  ai_projects: string[];
  ai_actions: string[];
  ai_key_questions: string[];

  // 向量嵌入 (JSON string of number[])
  embedding: string | null;

  // 状态
  analysis_status: 'pending' | 'analyzing' | 'done' | 'failed';
  privacy_level: 'normal' | 'private' | 'hidden';
}

export interface MemoCreateInput {
  user_id?: string;
  content: string;
  tags?: string[];
  source?: Memo['source'];
  created_at?: string;
  ai_title?: string | null;
}

export interface MemoFilters {
  userId?: string;
  query?: string;
  tag?: string;
  category?: MemoCategory;
  emotion?: EmotionType;
  topic?: string;
  dateFrom?: string;
  dateTo?: string;
  analysisStatus?: Memo['analysis_status'];
  privacyLevel?: Memo['privacy_level'];
  limit?: number;
  offset?: number;
}

// --- Topic (主题) ---

export interface Topic {
  id: string;
  name: string;
  description: string | null;
  memo_count: number;
  first_seen_at: string;
  last_seen_at: string;
  summary: string | null;
  key_questions: string[];
  stable_insights: string[];
  related_people: string[];
  related_projects: string[];
  status: 'active' | 'dormant' | 'resolved';
  created_at: string;
  updated_at: string;
}

// --- Conversation (对话) ---

export type ConversationMode = 'unified' | 'retrospect' | 'action';

export interface Conversation {
  id: string;
  title: string;
  summary: string | null;
  summary_status: 'pending' | 'generating' | 'done' | 'failed';
  summarized_message_count: number;
  summary_updated_at: string | null;
  mode: ConversationMode;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export type SourceType = 'from_notes' | 'inference' | 'suggestion' | 'uncertain';

export interface Citation {
  reference_type?: 'memo' | 'memory' | 'principle';
  reference_id?: string;
  memo_id: string;
  memo_title: string | null;
  memo_date: string;
  relevant_snippet: string;
  relevance_score: number;
  retrieval_reason?: string;
  matched_terms?: string[];
  evidence_memo_ids?: string[];
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning_content: string;
  citations: Citation[];
  source_type: SourceType | null;
  created_at: string;
}

// --- Insight (洞察) ---

export type InsightType =
  | 'recurring_question'
  | 'methodology'
  | 'emotion_cycle'
  | 'strength'
  | 'risk_pattern'
  | 'growth_evidence';

export type InsightFeedback = 'accurate' | 'somewhat' | 'inaccurate' | 'hidden';

export interface Insight {
  id: string;
  title: string;
  content: string;
  type: InsightType;
  confidence: 'high' | 'medium' | 'low';
  evidence_memo_ids: string[];
  created_at: string;
  user_feedback: InsightFeedback | null;
  saved_as_principle: boolean;
}

// --- App State ---

export interface AppStats {
  total_memos: number;
  total_topics: number;
  total_conversations: number;
  total_insights: number;
  recent_memos: Memo[];
  top_tags: { name: string; count: number }[];
  recent_topics: string[];
  today_memo_count: number;
  this_week_memo_count: number;
}

// --- Today Digest ---

export interface TodayFocus {
  topic_id: string | null;
  name: string;
  memo_count: number;
  last_seen_at: string;
  reason: string;
  source_memo_ids: string[];
}

export interface TodayQuestion {
  id: string;
  question: string;
  memo_id: string;
  memo_title: string;
  memo_date: string;
  reason: string;
}

export interface TodayAction {
  key: string;
  text: string;
  memo_id: string;
  memo_title: string;
  memo_date: string;
  status: 'open' | 'completed' | 'dismissed';
  reason: string;
}

export interface TodayEmotionWeek {
  week_label: string;
  week_start: string;
  counts: Partial<Record<EmotionType, number>>;
}

export interface TodayEmotion {
  dominant: EmotionType | null;
  distribution: Array<{
    emotion: EmotionType;
    count: number;
    previous_count: number;
  }>;
  weekly_trend: TodayEmotionWeek[];
  observation: string | null;
  confidence: 'high' | 'medium' | 'low' | null;
  evidence_memo_ids: string[];
  source: 'ai' | 'statistics';
  sample_size: number;
  previous_sample_size: number;
  period_days: number;
}

export interface TodayStateAnchor {
  state: { title: string; summary: string; last_confirmed_at: string } | null;
  goal: { title: string; summary: string; last_confirmed_at: string } | null;
}

export interface TodayDigest {
  generated_at: string;
  focus: TodayFocus[];
  questions: TodayQuestion[];
  actions: TodayAction[];
  emotion: TodayEmotion;
  completed_today: number;
  state_anchor: TodayStateAnchor;
  context: {
    recent_memo_count: number;
    analyzed_memo_count: number;
    pending_analysis_count: number;
    lookback_days: number;
  };
}

// --- Long-term Memory ---

export type MemoryType =
  | 'event'
  | 'person'
  | 'project'
  | 'goal'
  | 'state'
  | 'belief'
  | 'pattern'
  | 'preference'
  | 'constraint';
export type MemoryStatus = 'active' | 'dormant' | 'resolved' | 'superseded';
export type MemoryEvidenceRelation = 'introduced' | 'supports' | 'contradicts' | 'updates';

export interface MemoryItem {
  id: string;
  type: MemoryType;
  canonical_key: string;
  title: string;
  summary: string;
  status: MemoryStatus;
  confidence: number;
  first_seen_at: string;
  last_confirmed_at: string;
  supersedes_id: string | null;
  model_version: string;
  prompt_version: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  evidence_count: number;
}

export interface MemoryEvidence {
  id: string;
  memory_id: string;
  memo_id: string;
  relation: MemoryEvidenceRelation;
  excerpt: string;
  confidence: number;
  created_at: string;
}

export interface MemoryRelation {
  id: string;
  source_memory_id: string;
  target_memory_id: string;
  relation_type: string;
  confidence: number;
  evidence_memo_id: string;
  created_at: string;
}

// --- AI Config ---

export interface AIConfig {
  provider: 'deepseek' | 'openai' | 'custom';
  base_url: string;
  api_key: string;
  model: string;
  temperature: number;
  max_tokens: number;
}

// --- Emotion color mapping ---

export const EMOTION_COLORS: Record<EmotionType, { bg: string; text: string; border: string }> = {
  '平静': { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
  '有力量': { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  '焦虑': { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
  '低落': { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
  '迷茫': { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200' },
  '被认可': { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200' },
  '愤怒': { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
  '喜悦': { bg: 'bg-yellow-50', text: 'text-yellow-600', border: 'border-yellow-200' },
};

export const EMOTION_COLORS_DARK: Record<EmotionType, { bg: string; text: string; border: string }> = {
  '平静': { bg: 'bg-blue-950/40', text: 'text-blue-400', border: 'border-blue-800' },
  '有力量': { bg: 'bg-emerald-950/40', text: 'text-emerald-400', border: 'border-emerald-800' },
  '焦虑': { bg: 'bg-amber-950/40', text: 'text-amber-400', border: 'border-amber-800' },
  '低落': { bg: 'bg-purple-950/40', text: 'text-purple-400', border: 'border-purple-800' },
  '迷茫': { bg: 'bg-indigo-950/40', text: 'text-indigo-400', border: 'border-indigo-800' },
  '被认可': { bg: 'bg-rose-950/40', text: 'text-rose-400', border: 'border-rose-800' },
  '愤怒': { bg: 'bg-red-950/40', text: 'text-red-400', border: 'border-red-800' },
  '喜悦': { bg: 'bg-yellow-950/40', text: 'text-yellow-400', border: 'border-yellow-800' },
};

export const CATEGORY_ICONS: Record<MemoCategory, string> = {
  '方法论': '📐',
  '感受': '💭',
  '观察': '👁️',
  '项目': '🚀',
  '日记': '📖',
  '摘录': '📌',
  '任务': '✅',
  '资料': '📁',
};

// --- Navigation ---

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  href: string;
  badge?: number;
}

// ============================================================
// 林间世界 — 游戏模式类型定义
// ============================================================

export type GameSeason = 'spring' | 'summer' | 'autumn' | 'winter';
export type CompanionType = 'none' | 'human_local' | 'llm';
export type DialogueMode = 'listen' | 'ask' | 'organize' | 'silent';
export type JourneyEventType =
  | 'carried_memory'
  | 'left_annotation'
  | 'named_path'
  | 'fireside_note'
  | 'left_question'
  | 'pond_release'
  | 'placed_object';

export interface JourneyEvent {
  id: string;
  type: JourneyEventType;
  text: string;
  sourceMemoIds: string[];
  createdAt: string;
}

export type WorldObjectType =
  | 'memory_plant'
  | 'letter'
  | 'lamp'
  | 'bench'
  | 'sign'
  | 'bottle'
  | 'windchime'
  | 'frame'
  | 'empty_pot';

export interface GameWorldSettings {
  muted: boolean;
  reducedMotion: boolean;
}

export interface GameWorld {
  id: string;
  ownerUserId: string;
  displayName: string;
  createdAt: string;
  lastVisitedAt: string;
  season: GameSeason;
  playerX: number;
  playerY: number;
  settings: GameWorldSettings;
}

export interface WorldObject {
  id: string;
  worldId: string;
  type: WorldObjectType;
  x: number;
  y: number;
  layer: number;
  sourceMemoIds: string[];
  sourceSessionId?: string;
  userConfirmed: boolean;
  hidden: boolean;
  annotation?: string; // 用户今日注释，与 Memo 原文分离
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CompanionSession {
  id: string;
  worldId: string;
  companionType: CompanionType;
  dialogueMode: DialogueMode;
  authorizedMemoIds: string[];
  startedAt: string;
  endedAt?: string;
}

export interface SharedMemoryDraft {
  id: string;
  sessionId: string;
  memoId?: string;
  playerOneText?: string;
  playerTwoText?: string;
  jointText?: string;
  saveDecision: 'pending' | 'separate' | 'joint' | 'discard';
}

export type CompanionResponseIntent =
  | 'reflect'
  | 'ask'
  | 'summarize'
  | 'stay_silent'
  | 'offer_action';

export interface CompanionResponse {
  text: string;
  intent: CompanionResponseIntent;
  sourceMemoIds: string[];
  isInference: boolean;
  suggestedActions?: Array<'continue' | 'pause' | 'place_object' | 'open_memo'>;
}

// 地图区域标识
export type MapLocation =
  | 'cabin'       // 亮灯木屋
  | 'bench'       // 门前长椅
  | 'garden'      // 记忆花园
  | 'fireside'    // 篝火地
  | 'pond'        // 静水池塘
  | 'workshop'    // 共居工坊
  | 'forest'      // 记忆林
  | 'hillside';   // 山坡/远望台（P1）

// 游戏状态机
export type GamePhase =
  | 'portal'        // 传送门过场
  | 'character_select'  // 角色 & 模式选择
  | 'explore'       // 自由探索
  | 'memo_encounter' // Memo 阅读弹层
  | 'fireside_chat'  // 篝火对话
  | 'co_write'      // 共同书写
  | 'pond'          // 静水池塘
  | 'settings';     // 游戏内设置

export interface PlayerCharacter {
  id: string;
  displayName: string;
  colorSkin: string;  // CSS 颜色，用于 SVG 角色
  colorHair: string;
  colorOutfit: string;
}

// 玩家状态
export interface PlayerState {
  x: number;
  y: number;
  direction: 'up' | 'down' | 'left' | 'right';
  moving: boolean;
  character: PlayerCharacter;
}
