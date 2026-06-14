const DEFAULT_EMBEDDING_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-v4';
const DEFAULT_EMBEDDING_DIMENSIONS = 1024;
const DEFAULT_RERANK_URL =
  'https://dashscope.aliyuncs.com/api/v1/services/rerank/text-rerank/text-rerank';
const DEFAULT_RERANK_MODEL = 'qwen3-vl-rerank';
const DEFAULT_TIMEOUT_MS = 12_000;

interface EmbeddingResponse {
  data?: Array<{ embedding?: number[]; index?: number }>;
}

interface RerankResponse {
  output?: {
    results?: Array<{
      index?: number;
      relevance_score?: number;
    }>;
  };
}

function getApiKey(): string {
  const apiKey = process.env.DASHSCOPE_API_KEY || '';
  if (!apiKey) throw new Error('DASHSCOPE_API_KEY 环境变量未设置');
  return apiKey;
}

function getTimeoutMs(): number {
  const value = Number(process.env.RETRIEVAL_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS;
}

function isProviderEnabled(provider: string | undefined): boolean {
  return provider === 'dashscope' && Boolean(process.env.DASHSCOPE_API_KEY);
}

export function isEmbeddingEnabled(): boolean {
  return isProviderEnabled(process.env.EMBEDDING_PROVIDER);
}

export function isRerankEnabled(): boolean {
  return isProviderEnabled(process.env.RERANK_PROVIDER);
}

export function getEmbeddingDimensions(): number {
  const value = Number(process.env.EMBEDDING_DIMENSIONS || DEFAULT_EMBEDDING_DIMENSIONS);
  return Number.isInteger(value) && value >= 64 && value <= 2048
    ? value
    : DEFAULT_EMBEDDING_DIMENSIONS;
}

export function getEmbeddingVersion(): string {
  return `memo-chunks-v2:${process.env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL}:${getEmbeddingDimensions()}`;
}

async function parseJsonResponse<T>(response: Response, label: string): Promise<T> {
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`${label} 请求失败: ${response.status} ${raw.slice(0, 500)}`);
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`${label} 返回了无效 JSON`);
  }
}

export async function createEmbeddings(
  inputs: string[],
  signal?: AbortSignal,
): Promise<number[][]> {
  if (!isEmbeddingEnabled()) throw new Error('Embedding Provider 未启用');
  const normalizedInputs = inputs.map((input) => input.trim()).filter(Boolean);
  if (normalizedInputs.length === 0) return [];

  const baseUrl = (process.env.EMBEDDING_BASE_URL || DEFAULT_EMBEDDING_BASE_URL)
    .replace(/\/+$/, '');
  const vectors: Array<number[] | undefined> = [];
  const providerBatchSize = 10;
  for (let start = 0; start < normalizedInputs.length; start += providerBatchSize) {
    const batch = normalizedInputs.slice(start, start + providerBatchSize);
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL,
        input: batch,
        dimensions: getEmbeddingDimensions(),
      }),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(getTimeoutMs())])
        : AbortSignal.timeout(getTimeoutMs()),
    });
    const data = await parseJsonResponse<EmbeddingResponse>(response, 'Embedding');
    vectors.push(...[...(data.data || [])]
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .map((item) => item.embedding));
  }
  if (
    vectors.length !== normalizedInputs.length
    || vectors.some((vector) => (
      !Array.isArray(vector)
      || vector.length !== getEmbeddingDimensions()
      || !vector.every(Number.isFinite)
    ))
  ) {
    throw new Error('Embedding 返回的向量数量或维度不正确');
  }
  return vectors as number[][];
}

export async function createEmbedding(
  input: string,
  signal?: AbortSignal,
): Promise<number[]> {
  const [embedding] = await createEmbeddings([input], signal);
  if (!embedding) throw new Error('Embedding 返回为空');
  return embedding;
}

export interface RerankResult {
  index: number;
  relevanceScore: number;
}

export async function rerankDocuments(
  query: string,
  documents: string[],
  topN: number,
  signal?: AbortSignal,
): Promise<RerankResult[]> {
  if (!isRerankEnabled()) throw new Error('Rerank Provider 未启用');
  if (documents.length === 0) return [];

  const response = await fetch(process.env.RERANK_BASE_URL || DEFAULT_RERANK_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.RERANK_MODEL || DEFAULT_RERANK_MODEL,
      input: { query, documents },
      parameters: {
        return_documents: false,
        top_n: Math.max(1, Math.min(topN, documents.length)),
      },
    }),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(getTimeoutMs())])
      : AbortSignal.timeout(getTimeoutMs()),
  });
  const data = await parseJsonResponse<RerankResponse>(response, 'Rerank');
  const results = data.output?.results || [];
  return results.flatMap((item) => (
    Number.isInteger(item.index) && typeof item.relevance_score === 'number'
      ? [{
        index: item.index as number,
        relevanceScore: item.relevance_score,
      }]
      : []
  ));
}
