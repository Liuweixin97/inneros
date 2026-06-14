'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownContentProps {
  content: string;
  className?: string;
  memoReferences?: Array<{
    memo_id: string;
    memo_title?: string | null;
    memo_date?: string;
    reference_type?: 'memo' | 'memory' | 'principle';
    reference_id?: string;
  }>;
  onMemoReference?: (memoId: string) => void;
  onKnowledgeReference?: (
    type: 'memo' | 'memory' | 'principle',
    id: string,
  ) => void;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function htmlToMarkdown(html: string): string {
  return decodeHtmlEntities(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, '**$2**')
    .replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, '*$2*')
    .replace(/<u>([\s\S]*?)<\/u>/gi, '$1')
    .replace(/<li>([\s\S]*?)<\/li>/gi, '- $1\n')
    .replace(/<\/?(ul|ol)[^>]*>/gi, '\n')
    .replace(/<(p|div)[^>]*>/gi, '')
    .replace(/<\/(p|div)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export default function MarkdownContent({
  content,
  className = '',
  memoReferences = [],
  onMemoReference,
  onKnowledgeReference,
}: MarkdownContentProps) {
  const normalizedContent = /<\/?(?:p|div|strong|b|em|i|u|ul|ol|li|br)\b/i.test(content)
    ? htmlToMarkdown(content)
    : content;
  const referenceEntries = memoReferences.map((reference) => {
    const type = reference.reference_type || 'memo';
    const id = reference.reference_id || reference.memo_id;
    return {
      key: `${type}:${id}`,
      title: reference.memo_title || '未命名来源',
    };
  });
  const references = new Map(referenceEntries.map(({ key, title }) => [key, title]));
  const contentWithReferences = normalizedContent.replace(
    /\[\[(memo|memory|principle):([a-zA-Z0-9-]+)\]\]/g,
    (_, type: 'memo' | 'memory' | 'principle', id: string) => {
      const requestedKey = `${type}:${id}`;
      const prefixMatches = id.length >= 6
        ? referenceEntries.filter(({ key }) => key.startsWith(requestedKey))
        : [];
      const resolvedKey = references.has(requestedKey)
        ? requestedKey
        : prefixMatches.length === 1 ? prefixMatches[0].key : null;
      if (!resolvedKey) return '';
      const resolvedId = resolvedKey.slice(resolvedKey.indexOf(':') + 1);
      return `[${references.get(resolvedKey)}](inneros-ref:${type}:${resolvedId})`;
    },
  );
  const displayContent = onKnowledgeReference || onMemoReference || memoReferences.length > 0
    ? contentWithReferences.replace(
      /\[\[(?!(?:memo|memory|principle):)[a-zA-Z_][a-zA-Z0-9_-]*(?::[a-zA-Z0-9-]+)?\]\]/g,
      '',
    )
    : contentWithReferences;

  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => {
          if (url.startsWith('inneros-ref:')) return url;
          return /^(https?:\/\/|mailto:|\/|#)/i.test(url) ? url : '';
        }}
        components={{
          a: ({ href = '', children }) => {
            if (href.startsWith('inneros-ref:')) {
              const [, type, id] = href.split(':') as [
                string,
                'memo' | 'memory' | 'principle',
                string,
              ];
              return (
                <button
                  type="button"
                  className={`memo-reference memo-reference--${type}`}
                  onClick={() => {
                    onKnowledgeReference?.(type, id);
                    if (type === 'memo') onMemoReference?.(id);
                  }}
                  title={references.get(`${type}:${id}`)}
                >
                  {children}
                </button>
              );
            }

            return (
              <a
                href={href}
                target={href.startsWith('http') ? '_blank' : undefined}
                rel={href.startsWith('http') ? 'noreferrer' : undefined}
              >
                {children}
              </a>
            );
          },
          img: ({ src, alt }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={alt || ''} loading="lazy" />
          ),
        }}
      >
        {displayContent}
      </ReactMarkdown>
    </div>
  );
}
