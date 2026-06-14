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
  }>;
  onMemoReference?: (memoId: string) => void;
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
}: MarkdownContentProps) {
  const normalizedContent = /<\/?(?:p|div|strong|b|em|i|u|ul|ol|li|br)\b/i.test(content)
    ? htmlToMarkdown(content)
    : content;
  const references = new Map(memoReferences.map((reference) => [
    reference.memo_id,
    reference.memo_title || '未命名记录',
  ]));
  const contentWithReferences = normalizedContent.replace(
    /\[\[memo:([a-zA-Z0-9-]+)\]\]/g,
    (_, memoId: string) => `[${references.get(memoId) || '相关记录'}](memo:${memoId})`,
  );

  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => {
          if (url.startsWith('memo:')) return url;
          return /^(https?:\/\/|mailto:|\/|#)/i.test(url) ? url : '';
        }}
        components={{
          a: ({ href = '', children }) => {
            if (href.startsWith('memo:')) {
              const memoId = href.slice(5);
              return (
                <button
                  type="button"
                  className="memo-reference"
                  onClick={() => onMemoReference?.(memoId)}
                  title={references.get(memoId)}
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
        {contentWithReferences}
      </ReactMarkdown>
    </div>
  );
}
