'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LogIn, LogOut } from 'lucide-react';

interface MeResponse {
  user: {
    name: string;
    username: string;
    isGuest?: boolean;
  } | null;
}

export default function UserBadge() {
  const [user, setUser] = useState<MeResponse['user']>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((response) => response.json())
      .then((data: MeResponse) => setUser(data.user))
      .catch(() => setUser(null));
  }, []);

  const name = user?.name || '游客';
  const username = user?.username || 'guest';
  const isGuest = user?.isGuest !== false;

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <div className="flex items-center gap-3 px-2 py-2">
      <div className="
        w-8 h-8 rounded-full
        bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)]
        flex items-center justify-center
        text-white text-xs font-bold
      ">
        {name.slice(0, 1).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-[var(--color-text-primary)] truncate">
          {name}
        </p>
        <p className="text-[10px] text-[var(--color-text-muted)] truncate">
          @{username}
        </p>
      </div>
      {isGuest ? (
        <Link href="/login" className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)]" title="登录">
          <LogIn size={16} />
        </Link>
      ) : (
        <button type="button" onClick={logout} className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)]" title="退出">
          <LogOut size={16} />
        </button>
      )}
    </div>
  );
}
