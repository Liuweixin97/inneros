export type ReferenceType = 'memo' | 'memory' | 'principle';

const KNOWLEDGE_REFERENCE_PATTERN = /\[\[(memo|memory|principle):([a-zA-Z0-9-]+)\]\]/g;
const UNKNOWN_WIKI_REFERENCE_PATTERN = /\[\[(?!(?:memo|memory|principle):)[a-zA-Z_][a-zA-Z0-9_-]*(?::[a-zA-Z0-9-]+)?\]\]/g;
const MIN_REFERENCE_PREFIX_LENGTH = 6;

export interface NormalizedKnowledgeReferences {
  content: string;
  referencedKeys: string[];
}

export function memoReference(memoId: string): string {
  return `[[memo:${memoId}]]`;
}

export function sanitizeMemoReferences(
  content: string,
  allowedReferences: Iterable<string>,
): string {
  return normalizeKnowledgeReferences(content, allowedReferences).content;
}

export function normalizeKnowledgeReferences(
  content: string,
  allowedReferences: Iterable<string>,
): NormalizedKnowledgeReferences {
  const allowed = [...new Set(allowedReferences)];
  const referencedKeys: string[] = [];
  const normalized = content
    .replace(
      KNOWLEDGE_REFERENCE_PATTERN,
      (marker, type: ReferenceType, id: string) => (
        resolveReferenceKey(type, id, allowed, referencedKeys) || ''
      )
    )
    .replace(UNKNOWN_WIKI_REFERENCE_PATTERN, '');

  return { content: normalized, referencedKeys };
}

function resolveReferenceKey(
  type: ReferenceType,
  id: string,
  allowed: string[],
  referencedKeys: string[],
): string | null {
  const requestedKey = `${type}:${id}`;
  let resolvedKey = allowed.includes(requestedKey) ? requestedKey : null;

  if (!resolvedKey && id.length >= MIN_REFERENCE_PREFIX_LENGTH) {
    const matches = allowed.filter((key) => key.startsWith(requestedKey));
    if (matches.length === 1) resolvedKey = matches[0];
  }

  if (!resolvedKey) return null;
  if (!referencedKeys.includes(resolvedKey)) referencedKeys.push(resolvedKey);
  const separatorIndex = resolvedKey.indexOf(':');
  return `[[${resolvedKey.slice(0, separatorIndex)}:${resolvedKey.slice(separatorIndex + 1)}]]`;
}

export function extractMemoReferenceIds(content: string): string[] {
  const ids: string[] = [];
  for (const match of content.matchAll(KNOWLEDGE_REFERENCE_PATTERN)) {
    if (match[1] === 'memo' && !ids.includes(match[2])) ids.push(match[2]);
  }
  return ids;
}
