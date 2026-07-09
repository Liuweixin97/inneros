'use client';

import { useState } from 'react';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BrainCircuit } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    const response = await fetch(`/api/auth/${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username, password }),
    });
    const data = await response.json().catch(() => ({}));
    setSubmitting(false);
    if (!response.ok) {
      setError(data.error || '登录失败');
      return;
    }
    router.replace(searchParams.get('next') || '/');
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm border border-[var(--color-border-light)] bg-[var(--color-bg-card)] rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)] text-white flex items-center justify-center">
            <BrainCircuit size={20} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-text-strong)]">InnerOS</h1>
            <p className="text-xs text-[var(--color-text-muted)]">{mode === 'login' ? '登录你的账户' : '创建新账户'}</p>
          </div>
        </div>

        {mode === 'register' && (
          <label className="block mb-3">
            <span className="block text-xs text-[var(--color-text-muted)] mb-1">昵称</span>
            <input value={name} onChange={(event) => setName(event.target.value)} className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-transparent outline-none focus:border-[var(--color-primary)]" />
          </label>
        )}
        <label className="block mb-3">
          <span className="block text-xs text-[var(--color-text-muted)] mb-1">账户名</span>
          <input
            value={username}
            autoComplete="username"
            onChange={(event) => setUsername(event.target.value.trim().toLowerCase())}
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-transparent outline-none focus:border-[var(--color-primary)]"
          />
        </label>
        <label className="block mb-4">
          <span className="block text-xs text-[var(--color-text-muted)] mb-1">密码</span>
          <input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-transparent outline-none focus:border-[var(--color-primary)]" />
        </label>

        {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

        <button disabled={submitting} className="w-full rounded-lg bg-[var(--color-primary)] text-white py-2.5 text-sm font-medium disabled:opacity-60">
          {submitting ? '处理中...' : mode === 'login' ? '登录' : '注册'}
        </button>

        <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="w-full mt-3 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
          {mode === 'login' ? '没有账户？注册' : '已有账户？登录'}
        </button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
