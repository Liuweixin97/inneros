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
  PenLine,
  Sparkles,
} from 'lucide-react';

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

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    if (href === '/insights' && pathname.startsWith('/topics')) return true;
    return pathname.startsWith(href);
  };

  const isCoCreate = pathname.startsWith('/cocreate');

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
            ${isActive('/settings')
              ? 'bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
            }
          `}
        >
          <Settings className="w-[18px] h-[18px]" />
          <span>设置</span>
        </Link>
      </div>

      {/* ✦ 林间世界 — 传送门入口（与普通导航有明显分隔） */}
      <div className="px-3 pb-3">
        {/* 分隔线 + 标签 */}
        <div className="flex items-center gap-2 mb-2 px-1">
          <div className="flex-1 h-px bg-[var(--color-border-light)]" />
          <span className="text-[10px] text-[var(--color-text-muted)] tracking-widest uppercase select-none">传送门</span>
          <div className="flex-1 h-px bg-[var(--color-border-light)]" />
        </div>

        <Link
          href="/cocreate"
          id="sidebar-cocreate-btn"
          className={`
            relative group flex items-center gap-2.5 w-full
            px-3 py-2.5 rounded-xl
            text-[13px] font-medium overflow-hidden
            transition-all duration-300
            ${isCoCreate
              ? 'text-white shadow-lg'
              : 'text-[var(--color-text-secondary)] hover:text-white'
            }
          `}
          style={{
            background: isCoCreate
              ? 'linear-gradient(135deg, #6ee7b7, #86efac, #fde68a, #fbcfe8)'
              : undefined,
          }}
        >
          {/* Animated warm forest border when not active */}
          {!isCoCreate && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{
                background: 'linear-gradient(135deg, #6ee7b7, #86efac, #fde68a, #fbcfe8)',
              }}
            />
          )}
          {/* inner bg to create border effect */}
          {!isCoCreate && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-[1.5px] rounded-[10px] bg-[var(--color-bg-sidebar)] group-hover:opacity-95 transition-all duration-300"
            />
          )}

          {/* Tree icon */}
          <span className="relative z-10 flex items-center justify-center w-[18px] h-[18px] shrink-0">
            <span
              className={`text-base leading-none transition-transform duration-300 group-hover:scale-110 ${isCoCreate ? 'animate-pulse-soft' : ''}`}
              style={{ fontSize: '16px' }}
            >
              🌲
            </span>
          </span>

          <span className="relative z-10 flex flex-col leading-tight">
            <span className="text-[13px] font-medium">林间世界</span>
            <span className="text-[10px] opacity-60 group-hover:opacity-80 transition-opacity">
              由你的经历慢慢长成
            </span>
          </span>

          {/* Sparkle */}
          <span
            className="relative z-10 ml-auto text-[10px] opacity-50 group-hover:opacity-100 transition-opacity duration-300 animate-pulse-soft"
            aria-hidden
          >
            ✦
          </span>
        </Link>
      </div>

      {/* User Avatar */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="
            w-8 h-8 rounded-full
            bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)]
            flex items-center justify-center
            text-white text-xs font-bold
          ">
            W
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium text-[var(--color-text-primary)] truncate">
              炜鑫
            </p>
            <p className="text-[10px] text-[var(--color-text-muted)] truncate">
              本地模式
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
