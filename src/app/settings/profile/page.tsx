'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Loader2, Shield, UserRound } from 'lucide-react';

interface ProfileUser {
  id: string;
  name: string;
  username: string;
  isGuest?: boolean;
}

export default function ProfilePage() {
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/auth/me')
      .then((response) => response.json())
      .then((data) => {
        const nextUser = data.user as ProfileUser;
        setUser(nextUser);
        setName(nextUser.name ?? '');
        setUsername(nextUser.username ?? '');
      })
      .catch(() => setError('无法读取账户信息'))
      .finally(() => setLoading(false));
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (password && password !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }
    setSaving(true);
    const response = await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        username,
        password: password || undefined,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error || '保存失败');
    } else {
      setUser(data.user);
      setPassword('');
      setConfirmPassword('');
      setMessage('账户信息已更新');
    }
    setSaving(false);
  };

  return (
    <div className="min-h-full animate-fade-in px-5 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-[720px]">
        <Link href="/settings" className="mb-5 inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary-dark)]">
          <ArrowLeft className="h-4 w-4" />
          返回设置
        </Link>

        <header className="mb-7">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[var(--color-primary-dark)]">
            <UserRound className="h-4 w-4" />
            账户
          </div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-strong)]">个人信息</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            InnerOS 只使用账户名登录。这里可以维护显示名、账户名和密码。
          </p>
        </header>

        {loading ? (
          <section className="card p-6 text-sm text-[var(--color-text-muted)]">正在读取账户信息…</section>
        ) : user?.isGuest ? (
          <section className="card p-6">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]">
              <Shield className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-semibold text-[var(--color-text-strong)]">游客账户不能维护个人资料</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
              游客态用于试用示例空间，不会写入你的私人记录。注册或登录后，个人信息和林间世界数据会进入你的账户。
            </p>
            <Link href="/login" className="btn-primary mt-5 w-fit px-4 py-2 text-sm">登录或注册</Link>
          </section>
        ) : (
          <form onSubmit={save} className="card space-y-5 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">显示名</span>
                <input className="input-base" value={name} onChange={(event) => setName(event.target.value)} required />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">账户名</span>
                <input className="input-base" value={username} onChange={(event) => setUsername(event.target.value.toLowerCase())} pattern="[a-z0-9_-]{3,32}" required />
                <small className="mt-1 block text-[10px] text-[var(--color-text-muted)]">3-32 位，小写字母、数字、下划线或连字符。</small>
              </label>
            </div>

            <div className="border-t border-[var(--color-border-light)] pt-5">
              <h2 className="text-sm font-semibold text-[var(--color-text-strong)]">重设密码</h2>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">不需要修改时留空。新密码至少 8 位。</p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <input className="input-base" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="新密码" minLength={8} />
                <input className="input-base" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="再次输入新密码" minLength={8} />
              </div>
            </div>

            {error && <p className="rounded-[var(--radius-md)] border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger-text)]">{error}</p>}
            {message && (
              <p className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary-light)] px-3 py-2 text-sm text-[var(--color-primary-dark)]">
                <Check className="h-4 w-4" />
                {message}
              </p>
            )}

            <button className="btn-primary px-4 py-2 text-sm" type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              保存修改
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
