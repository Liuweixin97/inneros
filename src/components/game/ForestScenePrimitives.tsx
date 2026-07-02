'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { X } from 'lucide-react';
import type { Memo } from '@/types';

type SceneTone = 'porch' | 'bench' | 'fire' | 'water' | 'workshop' | 'trail' | 'desk' | 'object';
type SceneAlign = 'center' | 'start' | 'end' | 'bottom';
type PanelSize = 'sm' | 'md' | 'lg' | 'wide';

interface ForestSceneLayerProps {
  tone: SceneTone;
  align?: SceneAlign;
  label: string;
  children: ReactNode;
}

interface ForestScenePanelProps {
  tone: SceneTone;
  size?: PanelSize;
  kicker: string;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

interface SceneButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
}

export function ForestSceneLayer({
  tone,
  align = 'center',
  label,
  children,
}: ForestSceneLayerProps) {
  return (
    <div
      className={`forest-scene-layer forest-scene-layer--${tone} forest-scene-layer--${align}`}
      role="dialog"
      aria-label={label}
    >
      {children}
    </div>
  );
}

export function ForestScenePanel({
  tone,
  size = 'md',
  kicker,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: ForestScenePanelProps) {
  return (
    <section className={`forest-scene-panel forest-scene-panel--${tone} forest-scene-panel--${size}`}>
      <header className="forest-scene-panel__header">
        <div>
          <p className="forest-scene-kicker">{kicker}</p>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button type="button" className="forest-scene-close" onClick={onClose} aria-label="关闭场景">
          <X size={17} strokeWidth={1.8} />
        </button>
      </header>
      <div className="forest-scene-panel__body">{children}</div>
      {footer && <footer className="forest-scene-panel__footer">{footer}</footer>}
    </section>
  );
}

export function SceneButton({
  variant = 'secondary',
  className = '',
  children,
  type = 'button',
  ...props
}: SceneButtonProps) {
  return (
    <button
      type={type}
      className={`forest-scene-button forest-scene-button--${variant} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}

export function SceneSection({
  title,
  caption,
  children,
  className = '',
}: {
  title?: string;
  caption?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`forest-scene-section ${className}`.trim()}>
      {(title || caption) && (
        <div className="forest-scene-section__head">
          {title && <h3>{title}</h3>}
          {caption && <p>{caption}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

export function SceneMemoCard({
  memo,
  selected = false,
  disabled = false,
  onClick,
  action,
}: {
  memo: Memo;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  action?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`forest-memo-card ${selected ? 'is-selected' : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      <span>
        <strong>{formatMemoTitle(memo)}</strong>
        <small>{formatShortDate(memo.created_at)} · {formatMemoExcerpt(memo, 54)}</small>
      </span>
      {action}
    </button>
  );
}

export function SceneProgress({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <ol className="forest-scene-progress" aria-label="场景进度">
      {steps.map((step, index) => (
        <li key={step} className={index <= current ? 'is-active' : ''}>
          <span>{index + 1}</span>
          {step}
        </li>
      ))}
    </ol>
  );
}

export function SceneEmpty({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="forest-scene-empty">
      <strong>{title}</strong>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function formatMemoTitle(memo: Memo): string {
  return memo.ai_title || memo.plain_text.replace(/\s+/g, ' ').slice(0, 32) || '未命名记录';
}

export function formatMemoExcerpt(memo: Memo, limit = 96): string {
  const text = memo.plain_text.replace(/\s+/g, ' ').trim();
  if (!text) return '这段记录没有留下正文';
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

export function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未知日期';
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}
