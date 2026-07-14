'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { SessionIdentity } from '@/lib/session';

const UserContext = createContext<SessionIdentity | null>(null);

export function UserProvider({ user, children }: { user: SessionIdentity | null; children: ReactNode }) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useCurrentUser(): SessionIdentity | null {
  return useContext(UserContext);
}
