// Compatibility facade. New AI features should import from `gateway.ts` directly.
import {
  completeText,
  streamText,
  streamEvents,
  type LLMMessage,
  type LLMTask,
  type LLMThinkingMode,
} from '@/lib/ai/gateway';

interface ChatCompletionOptions {
  temperature?: number;
  max_tokens?: number;
  json?: boolean;
  thinking?: LLMThinkingMode;
  task?: LLMTask;
  user_id?: string;
  signal?: AbortSignal;
}

export async function chatCompletion(
  messages: LLMMessage[],
  options?: ChatCompletionOptions,
): Promise<string> {
  return completeText({
    task: options?.task ?? 'chat.respond',
    messages,
    temperature: options?.temperature,
    maxTokens: options?.max_tokens,
    json: options?.json,
    userId: options?.user_id,
    signal: options?.signal,
    thinking: options?.thinking,
  });
}

export async function chatCompletionStream(
  messages: LLMMessage[],
  options?: ChatCompletionOptions,
): Promise<ReadableStream<string>> {
  return streamText({
    task: options?.task ?? 'chat.respond',
    messages,
    temperature: options?.temperature,
    maxTokens: options?.max_tokens,
    userId: options?.user_id,
    signal: options?.signal,
    thinking: options?.thinking,
  });
}

export async function chatCompletionEventStream(
  messages: LLMMessage[],
  options?: ChatCompletionOptions,
) {
  return streamEvents({
    task: options?.task ?? 'chat.respond',
    messages,
    temperature: options?.temperature,
    maxTokens: options?.max_tokens,
    userId: options?.user_id,
    signal: options?.signal,
    thinking: options?.thinking,
  });
}
