'use client';

import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-full items-center justify-center px-5 py-12">
      <div className="max-w-md text-center">
        <p className="text-sm font-medium text-[var(--color-primary-dark)]">页面暂时不可用</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--color-text-strong)]">刚才的操作没有完成</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">你的数据不会因此丢失。可以重新加载当前页面；如果问题持续，请稍后再试。</p>
        <button type="button" onClick={reset} className="btn-primary mt-6 inline-flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          重新加载
        </button>
      </div>
    </main>
  );
}
