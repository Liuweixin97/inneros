import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-full items-center justify-center px-5 py-12">
      <div className="max-w-md text-center">
        <p className="text-sm font-medium text-[var(--color-primary-dark)]">404</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--color-text-strong)]">这里没有内容</h1>
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">页面可能已移动或删除。</p>
        <Link href="/" className="btn-primary mt-6 inline-flex">返回今日</Link>
      </div>
    </main>
  );
}
