'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sun, FileText, MessageCircle, BrainCircuit, User } from 'lucide-react';

const tabs = [
  { id: 'today', label: '今日', href: '/', icon: Sun },
  { id: 'records', label: '记录', href: '/records', icon: FileText },
  { id: 'chat', label: '对话', href: '/chat', icon: MessageCircle },
  { id: 'insights', label: '认识', href: '/insights', icon: BrainCircuit },
  { id: 'me', label: '我的', href: '/settings', icon: User },
];

export default function MobileNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    if (href === '/insights' && pathname.startsWith('/topics')) return true;
    return pathname.startsWith(href);
  };

  return (
    <nav className="
      fixed bottom-0 left-0 right-0 z-50
      md:hidden
      bg-[var(--color-bg-card)] border-t border-[var(--color-border-light)]
      px-2 pb-[env(safe-area-inset-bottom)]
      glass
    ">
      <div className="flex items-center justify-around">
        {tabs.map(tab => {
          const active = isActive(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`
                flex flex-col items-center gap-0.5 py-2 px-3 min-w-[56px]
                transition-colors duration-200
                ${active
                  ? 'text-[var(--color-primary-dark)]'
                  : 'text-[var(--color-text-muted)]'
                }
              `}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${active ? 'stroke-[2.5px]' : ''}`} />
                {active && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--color-primary)]" />
                )}
              </div>
              <span className={`text-[10px] ${active ? 'font-semibold' : 'font-medium'}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
