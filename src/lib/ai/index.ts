// ============================================================
// InnerOS - AI Module Barrel Export
// ============================================================

export { chatCompletion, chatCompletionEventStream, chatCompletionStream } from './client';
export {
  complete,
  completeText,
  streamText,
  streamEvents,
} from './gateway';
export type {
  LLMCompletion,
  LLMMessage,
  LLMTask,
  LLMUsage,
  LLMStreamEvent,
  LLMThinkingMode,
} from './gateway';
export {
  SYSTEM_PROMPT,
  RETROSPECT_PROMPT,
  ACTION_PROMPT,
  ANALYZE_MEMO_PROMPT,
  INSIGHT_PROMPT,
  buildSystemPromptWithContext,
  getModePrompt,
} from './prompts';
export { analyzeMemo, analyzeMemos } from './analyzer';
export type { AnalysisResult } from './analyzer';
export {
  buildContext,
  buildCitations,
  searchRelevantMemos,
  generateRAGResponse,
} from './rag';
export type { RAGResponse } from './rag';
export {
  createEmbedding,
  createEmbeddings,
  getEmbeddingDimensions,
  getEmbeddingVersion,
  isEmbeddingEnabled,
  isRerankEnabled,
  rerankDocuments,
} from './retrieval-provider';
