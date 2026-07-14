import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db';

export type LLMTask =
  | 'memo.extract'
  | 'topic.summarize'
  | 'conversation.summarize'
  | 'insight.generate'
  | 'today.next-action'
  | 'today.digest'
  | 'rag.query'
  | 'rag.rerank'
  | 'chat.respond'
  | 'memory.link'
  | 'memory.reconcile'
  | 'action.infer-outcome'
  | 'profile.consolidate'
  | 'forest.reflect';

export interface LLMMessage {
  role: string;
  content: string;
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
}

export interface LLMCompletion {
  id: string | null;
  content: string;
  model: string;
  finishReason: string | null;
  usage: LLMUsage | null;
}

export type LLMThinkingMode = 'enabled' | 'disabled';

export interface LLMStreamEvent {
  type: 'reasoning' | 'content';
  content: string;
}

interface CompletionRequest {
  task: LLMTask;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  userId?: string;
  signal?: AbortSignal;
  thinking?: LLMThinkingMode;
  reasoningEffort?: 'high' | 'max';
}

interface GatewayConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
}

type ProviderUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
};

const DEFAULT_MODEL = 'deepseek-v4-flash';
const DEFAULT_TIMEOUT_MS = 90_000;
const DEFAULT_TIME_ZONE = 'Asia/Shanghai';

function getConfig(): GatewayConfig {
  const baseUrl = process.env.AI_BASE_URL || 'https://api.deepseek.com';
  const apiKey = process.env.AI_API_KEY || '';
  const model = process.env.AI_MODEL || DEFAULT_MODEL;
  const timeoutMs = Number(process.env.AI_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);

  if (!apiKey) {
    throw new Error('AI_API_KEY 环境变量未设置。请在 .env.local 中配置。');
  }

  return {
    baseUrl,
    apiKey,
    model,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS,
  };
}

function getChatCompletionsUrl(baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, '');
  const apiBaseUrl = normalizedBaseUrl.endsWith('/v1')
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}/v1`;
  return `${apiBaseUrl}/chat/completions`;
}

function buildRuntimeContext(now = new Date()): string {
  const timeZone = process.env.AI_TIME_ZONE || DEFAULT_TIME_ZONE;
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => (
    parts.find((part) => part.type === type)?.value || ''
  );
  const date = `${value('year')}-${value('month')}-${value('day')}`;
  const weekday = value('weekday');

  return `<runtime_context>
当前日期：${date}（${weekday}）
当前时区：${timeZone}
默认语言与地区：中国大陆简体中文
时间解释规则：
- “今天、昨天、明天、最近、本周”等相对时间，必须以上述日期和时区为基准。
- 笔记中的日期是事件或记录发生时间，不等于当前日期。
- 涉及日期先后、距今时长、是否过期时，应按明确日期计算；信息不足时不要猜测。
- 运行时上下文只提供时间与地区基准，不代表用户经历、偏好或外部世界事实。
</runtime_context>`;
}

function withRuntimeContext(messages: LLMMessage[]): LLMMessage[] {
  const context = buildRuntimeContext();
  const firstSystemIndex = messages.findIndex((message) => message.role === 'system');
  if (firstSystemIndex < 0) {
    return [{ role: 'system', content: context }, ...messages];
  }
  return messages.map((message, index) => (
    index === firstSystemIndex
      ? { ...message, content: `${context}\n\n${message.content}` }
      : message
  ));
}

function toUsage(usage?: ProviderUsage): LLMUsage | null {
  if (!usage) return null;
  return {
    promptTokens: usage.prompt_tokens ?? 0,
    completionTokens: usage.completion_tokens ?? 0,
    totalTokens: usage.total_tokens ?? 0,
    cacheHitTokens: usage.prompt_cache_hit_tokens ?? 0,
    cacheMissTokens: usage.prompt_cache_miss_tokens ?? 0,
  };
}

function recordRun(input: {
  runId: string;
  task: LLMTask;
  model: string;
  status: 'succeeded' | 'failed';
  startedAt: number;
  usage?: LLMUsage | null;
  error?: unknown;
  thinking?: LLMThinkingMode;
  userId?: string;
}) {
  try {
    // Keep observability best-effort so a logging failure never breaks the AI feature.
    const usage = input.usage;
    getDb().prepare(`
      INSERT INTO llm_runs (
        id, user_id, task, model, thinking_mode, status, latency_ms,
        prompt_tokens, completion_tokens, total_tokens,
        cache_hit_tokens, cache_miss_tokens, error_message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.runId,
      input.userId || 'liuweixin',
      input.task,
      input.model,
      input.thinking ?? 'disabled',
      input.status,
      Date.now() - input.startedAt,
      usage?.promptTokens ?? null,
      usage?.completionTokens ?? null,
      usage?.totalTokens ?? null,
      usage?.cacheHitTokens ?? null,
      usage?.cacheMissTokens ?? null,
      input.error instanceof Error ? input.error.message.slice(0, 1000) : null,
      new Date().toISOString(),
    );
  } catch (error) {
    console.warn('[LLM Gateway] 调用日志写入失败:', error);
  }
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  baseDelay = 1000,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429 || response.status >= 500) {
        const retryAfter = response.headers.get('retry-after');
        const parsedRetryAfter = retryAfter ? Number.parseInt(retryAfter, 10) : Number.NaN;
        const delay = Number.isFinite(parsedRetryAfter)
          ? parsedRetryAfter * 1000
          : baseDelay * 2 ** attempt;
        lastError = new Error(`AI API 请求失败: ${response.status} ${response.statusText}`);
        if (attempt < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        break;
      }

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`AI API 请求失败: ${response.status} ${response.statusText}\n${errorBody}`);
      }
      return response;
    } catch (error) {
      lastError = error as Error;
      if (error instanceof TypeError && error.message.includes('fetch') && attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, baseDelay * 2 ** attempt));
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error('AI API 请求失败：已达到最大重试次数');
}

function createRequestBody(request: CompletionRequest, config: GatewayConfig, stream: boolean) {
  const thinking = request.thinking ?? 'disabled';
  return {
    model: config.model,
    messages: withRuntimeContext(request.messages),
    stream,
    ...(thinking === 'disabled' ? { temperature: request.temperature ?? 0.7 } : {}),
    max_tokens: request.maxTokens ?? 4096,
    thinking: { type: thinking },
    ...(thinking === 'enabled'
      ? { reasoning_effort: request.reasoningEffort ?? 'high' }
      : {}),
    ...(request.json ? { response_format: { type: 'json_object' } } : {}),
    ...(request.userId ? { user_id: request.userId } : {}),
  };
}

function createSignal(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  return signal
    ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
    : AbortSignal.timeout(timeoutMs);
}

export async function complete(request: CompletionRequest): Promise<LLMCompletion> {
  const config = getConfig();
  const runId = uuidv4();
  const startedAt = Date.now();

  try {
    const response = await fetchWithRetry(
      getChatCompletionsUrl(config.baseUrl),
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createRequestBody(request, config, false)),
        signal: createSignal(request.signal, config.timeoutMs),
      },
    );
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.length === 0) {
      throw new Error(`AI API 返回了空或无效的响应: ${JSON.stringify(data).slice(0, 300)}`);
    }

    const result: LLMCompletion = {
      id: typeof data.id === 'string' ? data.id : null,
      content,
      model: typeof data.model === 'string' ? data.model : config.model,
      finishReason: typeof data?.choices?.[0]?.finish_reason === 'string'
        ? data.choices[0].finish_reason
        : null,
      usage: toUsage(data.usage),
    };
    recordRun({
      runId,
      task: request.task,
      model: result.model,
      status: 'succeeded',
      startedAt,
      usage: result.usage,
      thinking: request.thinking,
      userId: request.userId,
    });
    return result;
  } catch (error) {
    recordRun({
      runId,
      task: request.task,
      model: config.model,
      status: 'failed',
      startedAt,
      error,
      thinking: request.thinking,
      userId: request.userId,
    });
    throw error;
  }
}

export async function completeText(request: CompletionRequest): Promise<string> {
  return (await complete(request)).content;
}

export async function streamText(request: CompletionRequest): Promise<ReadableStream<string>> {
  const eventStream = await streamEvents(request);
  const reader = eventStream.getReader();
  return new ReadableStream<string>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      if (value.type === 'content') controller.enqueue(value.content);
    },
    async cancel() {
      await reader.cancel();
    },
  });
}

export async function streamEvents(
  request: CompletionRequest,
): Promise<ReadableStream<LLMStreamEvent>> {
  const config = getConfig();
  const runId = uuidv4();
  const startedAt = Date.now();

  try {
    const response = await fetchWithRetry(
      getChatCompletionsUrl(config.baseUrl),
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createRequestBody(request, config, true)),
        signal: createSignal(request.signal, config.timeoutMs),
      },
    );
    const reader = response.body?.getReader();
    if (!reader) throw new Error('AI API 未返回响应流');

    const decoder = new TextDecoder();
    let buffer = '';
    let finished = false;

    const finish = (status: 'succeeded' | 'failed', error?: unknown) => {
      if (finished) return;
      finished = true;
      recordRun({
        runId,
        task: request.task,
        model: config.model,
        status,
        startedAt,
        error,
        thinking: request.thinking,
        userId: request.userId,
      });
    };

    return new ReadableStream<LLMStreamEvent>({
      async pull(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              processSSEBuffer(buffer, controller);
              finish('succeeded');
              controller.close();
              return;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith(':')) continue;
              if (trimmed === 'data: [DONE]') {
                finish('succeeded');
                controller.close();
                return;
              }
              if (!trimmed.startsWith('data: ')) continue;

              const parsed = JSON.parse(trimmed.slice(6));
              if (parsed?.error) {
                throw new Error(parsed.error.message || parsed.error.type || 'AI API 流式响应失败');
              }
              enqueueDelta(parsed?.choices?.[0]?.delta, controller);
            }
          }
        } catch (error) {
          finish('failed', error);
          controller.error(error);
          await reader.cancel();
        }
      },
      async cancel() {
        finish('failed', new Error('流式响应被调用方取消'));
        await reader.cancel();
      },
    });
  } catch (error) {
    recordRun({
      runId,
      task: request.task,
      model: config.model,
      status: 'failed',
      startedAt,
      error,
      thinking: request.thinking,
      userId: request.userId,
    });
    throw error;
  }
}

function processSSEBuffer(
  buffer: string,
  controller: ReadableStreamDefaultController<LLMStreamEvent>,
) {
  for (const line of buffer.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data: ') || trimmed === 'data: [DONE]') continue;
    const parsed = JSON.parse(trimmed.slice(6));
    enqueueDelta(parsed?.choices?.[0]?.delta, controller);
  }
}

function enqueueDelta(
  delta: { reasoning_content?: unknown; content?: unknown } | undefined,
  controller: ReadableStreamDefaultController<LLMStreamEvent>,
) {
  const reasoning = delta?.reasoning_content;
  if (typeof reasoning === 'string' && reasoning) {
    controller.enqueue({ type: 'reasoning', content: reasoning });
  }
  const content = delta?.content;
  if (typeof content === 'string' && content) {
    controller.enqueue({ type: 'content', content });
  }
}
