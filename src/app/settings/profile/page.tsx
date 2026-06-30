'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Save, UserRound } from 'lucide-react';

interface UserState {
  name: string;
  username: string;
}

export default function ProfileSettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserState>({ name: '', username: '' });
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((response) => response.json())
      .then((data) => {
        if (!data.user || data.user.isGuest) {
          router.replace('/login');
          return;
        }
        setUser({ name: data.user.name, username: data.user.username });
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    const response = await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...user, password }),
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setError(data.error || '保存失败');
      return;
    }
    setPassword('');
    setMessage('已保存');
    router.refresh();
  }

  return (
    <main className="max-w-2xl mx-auto px-5 py-8">
      <div className="mb-7">
        <h1 className="text-2xl font-semibold text-[var(--color-text-strong)]">个人信息</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">维护账户名、显示名称和登录密码。</p>
      </div>

      <form onSubmit={save} className="space-y-5">
        <section className="border border-[var(--color-border-light)] bg-[var(--color-bg-card)] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <UserRound size={18} />
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">账户资料</h2>
          </div>
          <label className="block mb-4">
            <span className="block text-xs text-[var(--color-text-muted)] mb-1">显示名称</span>
            <input value={user.name} onChange={(event) => setUser({ ...user, name: event.target.value })} className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-transparent outline-none focus:border-[var(--color-primary)]" />
          </label>
          <label className="block">
            <span className="block text-xs text-[var(--color-text-muted)] mb-1">账户名</span>
            <input value={user.username} onChange={(event) => setUser({ ...user, username: event.target.value })} className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-transparent outline-none focus:border-[var(--color-primary)]" />
          </label>
        </section>

        <section className="border border-[var(--color-border-light)] bg-[var(--color-bg-card)] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound size={18} />
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">重设密码</h2>
          </div>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="留空则不修改" className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-transparent outline-none focus:border-[var(--color-primary)]" />
        </section>

        {message && <p className="text-sm text-[var(--color-primary-dark)]">{message}</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}

        <button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] text-white px-4 py-2 text-sm font-medium disabled:opacity-60">
          <Save size={16} />
          {saving ? '保存中...' : '保存'}
        </button>
      </form>
    </main>
  );
}

