'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sun,
  FileText,
  MessageCircle,
  Clock,
  BrainCircuit,
  Settings,
  UserRound,
  PenLine,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import UserBadge from './UserBadge';

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

const navItems: NavItem[] = [
  { id: 'today', label: '今日', href: '/', icon: <Sun className="w-[18px] h-[18px]" /> },
  { id: 'records', label: '记录', href: '/records', icon: <FileText className="w-[18px] h-[18px]" /> },
  { id: 'chat', label: '对话', href: '/chat', icon: <MessageCircle className="w-[18px] h-[18px]" /> },
  { id: 'insights', label: '认识', href: '/insights', icon: <BrainCircuit className="w-[18px] h-[18px]" /> },
  { id: 'timeline', label: '时间线', href: '/timeline', icon: <Clock className="w-[18px] h-[18px]" /> },
];

export default function Sidebar() {
  const pathname = usePathname();
  const isCoCreate = pathname.startsWith('/cocreate');

  if (isCoCreate) return null;

  const isActive = (href: string, exact = false) => {
    if (href === '/') return pathname === '/';
    if (href === '/insights' && pathname.startsWith('/topics')) return true;
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <aside
      className="
        fixed left-0 top-0 bottom-0 z-40
        hidden md:flex flex-col
        bg-[var(--color-bg-sidebar)] border-r border-[var(--color-border-light)]
        select-none
      "
      style={{ width: 'var(--sidebar-width)' }}
    >
      {/* Brand Header */}
      <div className="px-6 py-5 border-b border-[var(--color-border-light)]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2DD4A8] to-[#0D9373] flex items-center justify-center shadow-sm">
            <Sparkles className="w-[18px] h-[18px] text-white" />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold text-[var(--color-text-strong)] tracking-tight leading-tight">
              InnerOS
            </h1>
            <p className="text-[11px] text-[var(--color-text-muted)] leading-tight mt-0.5">
              从记录中看见自己
            </p>
          </div>
        </div>
      </div>

      {/* Quick Record Button */}
      <div className="px-4 pt-4 pb-2">
        <Link
          href="/?compose=true"
          className="
            w-full flex items-center justify-center gap-2
            px-4 py-2.5 rounded-xl
            bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]
            text-white text-[13px] font-medium
            transition-all duration-200
            hover:shadow-md hover:shadow-[rgba(45,212,168,0.2)]
            active:scale-[0.98]
          "
        >
          <PenLine className="w-4 h-4" />
          <span>快速记录</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`
                group flex items-center gap-3 px-3 py-2.5 rounded-xl
                text-[13px] font-medium
                transition-all duration-200 relative
                ${active
                  ? 'bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
                }
              `}
            >
              {/* Active indicator bar */}
              {active && (
                <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-[var(--color-primary)] animate-scale-in" />
              )}

              <span className={`
                transition-colors duration-200
                ${active ? 'text-[var(--color-primary-dark)]' : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)]'}
              `}>
                {item.icon}
              </span>

              <span>{item.label}</span>

              {item.badge && item.badge > 0 && (
                <span className="
                  ml-auto text-[10px] font-bold
                  bg-[var(--color-primary)] text-white
                  px-1.5 py-0.5 rounded-full min-w-[18px] text-center
                ">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Settings & User */}
      <div className="border-t border-[var(--color-border-light)] px-3 py-3">
        <Link
          href="/settings"
          className={`
            flex items-center gap-3 px-3 py-2.5 rounded-xl
            text-[13px] font-medium
            transition-all duration-200
            ${isActive('/settings', true)
              ? 'bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
            }
          `}
        >
          <Settings className="w-[18px] h-[18px]" />
          <span>设置</span>
        </Link>
        <Link
          href="/settings/profile"
          className={`
            flex items-center gap-3 px-3 py-2.5 rounded-xl
            text-[13px] font-medium
            transition-all duration-200
            ${isActive('/settings/profile')
              ? 'bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
            }
          `}
        >
          <UserRound className="w-[18px] h-[18px]" />
          <span>个人信息</span>
        </Link>
      </div>

      <div className="px-3 pb-3">
        <Link
          href="/cocreate"
          id="sidebar-cocreate-btn"
          className="forest-portal-card"
        >
          <span className="forest-portal-card__image" aria-hidden="true" />
          <span className="forest-portal-card__shade" aria-hidden="true" />
          <span className="forest-portal-card__content">
            <span className="forest-portal-card__title">
              <strong>林间世界</strong>
              <ArrowUpRight size={15} strokeWidth={1.7} />
            </span>
            <small>由你的经历慢慢长成</small>
          </span>
        </Link>
      </div>

      {/* User Avatar */}
      <div className="px-4 pb-4">
        <UserBadge />
      </div>
    </aside>
  );
}
