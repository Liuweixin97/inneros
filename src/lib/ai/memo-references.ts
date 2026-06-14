const MEMO_REFERENCE_PATTERN = /\[\[memo:([a-zA-Z0-9-]+)\]\]/g;

export function memoReference(memoId: string): string {
  return `[[memo:${memoId}]]`;
}

export function sanitizeMemoReferences(content: string, allowedMemoIds: Iterable<string>): string {
  const allowed = new Set(allowedMemoIds);
  return content.replace(MEMO_REFERENCE_PATTERN, (marker, memoId: string) => (
    allowed.has(memoId) ? marker : ''
  ));
}

export function extractMemoReferenceIds(content: string): string[] {
  const ids: string[] = [];
  for (const match of content.matchAll(MEMO_REFERENCE_PATTERN)) {
    if (!ids.includes(match[1])) ids.push(match[1]);
  }
  return ids;
}
