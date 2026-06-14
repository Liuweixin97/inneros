import { createHash } from 'crypto';

function normalizeCreatedAt(createdAt: string): string {
  const timestamp = new Date(createdAt).getTime();
  return Number.isNaN(timestamp) ? createdAt.trim() : new Date(timestamp).toISOString();
}

export function normalizeFlomoContent(content: string): string {
  return content
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function createFlomoFingerprint(content: string, createdAt: string): string {
  const canonicalValue = [
    'flomo',
    normalizeCreatedAt(createdAt),
    normalizeFlomoContent(content),
  ].join('\0');

  return createHash('sha256').update(canonicalValue).digest('hex');
}
