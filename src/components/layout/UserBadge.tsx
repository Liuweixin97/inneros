'use client';

import { useEffect, useState } from 'react';

interface MeResponse {
  user: {
    name: string;
    username: string;
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
    </div>
  );
}

