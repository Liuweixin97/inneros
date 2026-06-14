'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Bold,
  Check,
  ChevronRight,
  Activity,
  Italic,
  List,
  Loader2,
  RefreshCw,
  Sparkles,
  Underline,
  X,
} from 'lucide-react';
import type { TodayDigest, TodayEmotion } from '@/types';

const FEELING_COLORS = ['#27c89b', '#7c6ee6', '#f4ad55', '#e76f83'];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return '夜深了';
  if (hour < 12) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

function formatDate(): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date());
}

function relativeDate(dateString: string): string {
  const days = Math.floor((Date.now() - new Date(dateString).getTime()) / 86_400_000);
  if (days <= 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 7) return `${days} 天前`;
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(new Date(dateString));
}

function cleanAnchorTitle(value: string): string {
  return value.replace(/^(当前)?(状态|目标)\s*[：:]\s*/u, '').trim();
}

export default function TodayPage() {
  const [digest, setDigest] = useState<TodayDigest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [actionIndex, setActionIndex] = useState(0);
  const editorRef = useRef<HTMLDivElement>(null);

  const loadDigest = useCallback(async (refresh = false) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(refresh ? '/api/today?refresh=1' : '/api/today', { cache: 'no-store' });
      if (!response.ok) throw new Error('无法读取今天的内容');
      setDigest(await response.json());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '无法读取今天的内容');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDigest(); }, [loadDigest]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('compose') === 'true') {
      editorRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    if (!digest) return;
    setQuestionIndex(0);
    setActionIndex(0);
    const questionTimer = window.setInterval(() => {
      setQuestionIndex((current) => digest.questions.length > 1 ? (current + 1) % digest.questions.length : 0);
    }, 7000);
    const actionTimer = window.setInterval(() => {
      setActionIndex((current) => digest.actions.length > 1 ? (current + 1) % digest.actions.length : 0);
    }, 8200);
    return () => {
      window.clearInterval(questionTimer);
      window.clearInterval(actionTimer);
    };
  }, [digest]);

  const saveMemo = async () => {
    const html = editorRef.current?.innerHTML.trim() ?? '';
    const text = editorRef.current?.innerText.trim() ?? '';
    if (!text || saving) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/memos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: html, source: 'manual' }),
      });
      if (!response.ok) throw new Error('保存失败');
      await response.json();
      setContent('');
      if (editorRef.current) editorRef.current.innerHTML = '';
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2200);
      window.setTimeout(() => loadDigest(), 2500);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const primaryAction = digest?.actions[actionIndex] ?? null;
  const primaryFocus = digest?.focus[0] ?? null;
  const primaryQuestion = digest?.questions[questionIndex] ?? null;
  const dominantEmotion = digest?.emotion.distribution[0] ?? null;
  const stateAnchor = digest?.state_anchor ?? null;

  const applyFormat = (command: 'bold' | 'italic' | 'underline' | 'insertUnorderedList') => {
    editorRef.current?.focus();
    document.execCommand(command);
    setContent(editorRef.current?.innerText ?? '');
  };

  return (
    <div className="min-h-full animate-fade-in">
      <div className="mx-auto max-w-[1060px] px-4 py-5 sm:px-5 md:px-8 md:py-8">
        <header className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-[13px] text-[var(--color-text-muted)]">{formatDate()}</p>
            <h1 className="text-[28px] font-semibold tracking-tight text-[var(--color-text-strong)] md:text-[34px]">
              {getGreeting()}，炜鑫
            </h1>
            <p className="mt-1.5 text-[13px] text-[var(--color-text-secondary)]">
              先留下真实发生的，再看看最近的自己。
            </p>
          </div>
          <button className="btn-ghost px-2 py-1.5 text-xs" type="button" onClick={() => loadDigest(true)} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            更新
          </button>
        </header>

        {error && (
          <div className="mb-5 flex items-center justify-between rounded-xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-3 text-sm text-[var(--color-danger-text)]">
            <span>{error}</span>
            <button type="button" onClick={() => setError('')} aria-label="关闭"><X className="h-4 w-4" /></button>
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 lg:grid-cols-[1.45fr_0.75fr]">
            <div className="skeleton h-[370px] rounded-[28px]" />
            <div className="skeleton h-[370px] rounded-[28px]" />
          </div>
        ) : digest ? (
          <main className="grid items-start gap-4 lg:grid-cols-[1.45fr_0.75fr]">
            <section
              className="relative flex min-h-[390px] flex-col overflow-hidden rounded-[28px] border p-6 text-white shadow-[var(--shadow-lg)] md:p-8"
              style={{
                backgroundColor: '#111827',
                borderColor: 'rgba(255,255,255,0.08)',
              }}
            >
              <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-[var(--color-primary)] opacity-10 blur-3xl" />
              <div className="relative flex items-center gap-2 text-[12px] font-medium text-white/60">
                <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
                从最近 30 天的记录里看见
              </div>

              {primaryFocus ? (
                <div className="relative flex flex-1 flex-col justify-between pt-7">
                  <div>
                    <p className="text-sm text-white/45">你反复回到</p>
                    <h2 className="mt-2 max-w-[620px] text-[32px] font-medium leading-[1.25] tracking-tight md:text-[42px]">
                      {primaryFocus.name}
                    </h2>
                    <Link
                      href={primaryFocus.topic_id ? `/topics/${primaryFocus.topic_id}` : `/records?topic=${encodeURIComponent(primaryFocus.name)}`}
                      className="mt-4 inline-flex items-center gap-1.5 text-[12px] text-white/55 hover:text-white"
                    >
                      近 30 天写到 {primaryFocus.memo_count} 次 · 最近于 {relativeDate(primaryFocus.last_seen_at)}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                  {(stateAnchor?.state || stateAnchor?.goal) && (
                    <div className="mt-7">
                      <p className="mb-3 text-[10px] font-medium tracking-wide text-white/35">
                        此刻的线索
                      </p>
                      <div className={`grid gap-4 ${
                        stateAnchor.state && stateAnchor.goal
                          ? 'sm:grid-cols-2 sm:gap-8'
                          : ''
                      }`}>
                      {stateAnchor.state && (
                        <div className="min-w-0">
                          <p className="text-[10px] text-white/40">你正处在</p>
                          <p className="mt-1 line-clamp-2 text-[13px] font-medium leading-5 text-white/85">
                            {cleanAnchorTitle(stateAnchor.state.title)}
                          </p>
                        </div>
                      )}
                      {stateAnchor.goal && (
                        <div className="min-w-0">
                          <p className="text-[10px] text-white/40">你想靠近</p>
                          <p className="mt-1 line-clamp-2 text-[13px] font-medium leading-5 text-white/85">
                            {cleanAnchorTitle(stateAnchor.goal.title)}
                          </p>
                        </div>
                      )}
                      </div>
                    </div>
                  )}
                  <div className="mt-7 border-t border-white/10 pt-5">
                    <p className="mb-2 text-[11px] text-white/40">这件事还值得继续问</p>
                    {primaryQuestion ? (
                      <div>
                        <Link
                          href={`/chat?memo=${primaryQuestion.memo_id}&prompt=${encodeURIComponent(`我想继续想清楚这个问题：${primaryQuestion.question}`)}`}
                          className="group flex items-end justify-between gap-4"
                        >
                          <p key={primaryQuestion.id} className="max-w-[560px] animate-fade-in text-[17px] leading-7 text-white/90">{primaryQuestion.question}</p>
                          <ArrowRight className="mb-1 h-4 w-4 shrink-0 text-white/40 transition-transform group-hover:translate-x-1 group-hover:text-white" />
                        </Link>
                        <CarouselDots count={digest.questions.length} active={questionIndex} onChange={setQuestionIndex} dark />
                      </div>
                    ) : (
                      <p className="text-[15px] leading-7 text-white/70">这件事为什么会在最近反复出现？</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="relative flex flex-1 flex-col justify-between pt-8">
                  <div>
                    <h2 className="text-[25px] font-medium leading-[1.45] md:text-[30px]">
                      还没有足够的记录，看见最近的你
                    </h2>
                    <p className="mt-3 max-w-[480px] text-sm leading-6 text-white/55">
                      不急着得出结论。先留下真实发生的事、感受和想法。
                    </p>
                  </div>
                  <Link
                    href="/?compose=true"
                    className="mt-8 inline-flex w-fit items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white"
                  >
                    记下此刻 <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </section>

            <aside className="flex flex-col gap-4">
              <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-[var(--shadow-sm)]">
                <div className="mb-3 flex items-center gap-2 text-[12px] font-medium text-[var(--color-text-muted)]">
                  <Check className="h-4 w-4 text-[var(--color-primary-dark)]" />
                  今天只往前一步
                </div>
                {primaryAction ? (
                  <div>
                    <Link href={`/chat?prompt=${encodeURIComponent(`请基于我的历史记录，继续推演这个下一步：${primaryAction.text}`)}`} className="group block">
                      <p key={primaryAction.key} className="animate-fade-in text-[16px] font-medium leading-7 text-[var(--color-text-strong)]">{primaryAction.text}</p>
                      <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary-dark)]">
                        继续推演这一步
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                      </span>
                    </Link>
                    <CarouselDots count={digest.actions.length} active={actionIndex} onChange={setActionIndex} />
                  </div>
                ) : (
                  <Link href="/chat?prompt=%E8%AF%B7%E7%BB%BC%E5%90%88%E6%88%91%E6%9C%80%E8%BF%91%E7%9A%84%E8%AE%B0%E5%BD%95%EF%BC%8C%E5%85%88%E5%88%A4%E6%96%AD%E6%88%91%E7%9C%9F%E6%AD%A3%E6%83%B3%E6%8E%A8%E8%BF%9B%E7%9A%84%E6%98%AF%E4%BB%80%E4%B9%88%E3%80%81%E5%8D%A1%E5%9C%A8%E5%93%AA%E9%87%8C%E3%80%81%E6%9C%89%E4%BB%80%E4%B9%88%E7%8E%B0%E5%AE%9E%E7%BA%A6%E6%9D%9F%EF%BC%8C%E5%86%8D%E7%BB%99%E6%88%91%E4%B8%80%E4%B8%AA%E6%9C%80%E5%80%BC%E5%BE%97%E5%81%9A%E7%9A%84%E4%B8%8B%E4%B8%80%E6%AD%A5%E3%80%82%E5%A6%82%E6%9E%9C%E4%BF%A1%E6%81%AF%E4%B8%8D%E8%B6%B3%EF%BC%8C%E5%85%88%E9%97%AE%E6%88%91%E4%B8%80%E4%B8%AA%E5%85%B3%E9%94%AE%E9%97%AE%E9%A2%98%E3%80%82" className="inline-flex items-center gap-1 text-[13px] text-[var(--color-primary-dark)]">
                    从最近的记录里想一步 <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </section>

              <section className="rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-bg-card)] p-5">
                <div className="mb-3 flex items-center gap-2 text-[12px] font-medium text-[var(--color-text-muted)]">
                  <Activity className="h-4 w-4 text-[var(--color-primary-dark)]" />
                  近两周的感受线索
                </div>
                {dominantEmotion ? (
                  <div>
                    <div>
                      <h2 className="text-[20px] font-semibold leading-snug text-[var(--color-text-strong)]">
                        「{dominantEmotion.emotion}」出现得最多
                      </h2>
                      <p className="mt-1.5 text-[11px] leading-5 text-[var(--color-text-muted)]">
                        来自近 {digest.emotion.period_days} 天 {digest.emotion.sample_size} 条写下感受的记录
                      </p>
                    </div>

                    <FeelingComposition emotion={digest.emotion} />

                    <Link href={`/records?emotion=${encodeURIComponent(dominantEmotion.emotion)}`} className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary-dark)]">
                      回看相关记录 <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-[var(--color-text-muted)]">最近的记录里还没有明显的感受线索。</p>
                )}
              </section>
            </aside>
          </main>
        ) : null}

        <section className={`mt-5 border-t border-[var(--color-border)] pt-5 transition-colors ${
          composerFocused ? 'border-[var(--color-primary)]' : ''
        }`}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium text-[var(--color-primary-dark)]">记下此刻</p>
              <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">不用整理，先写真实发生的事和感受</p>
            </div>
            <span className="hidden text-[10px] text-[var(--color-text-muted)] sm:inline">⌘ / Ctrl + Enter 保存</span>
          </div>
          {composerFocused && (
            <div className="mb-2 flex items-center gap-1">
              <FormatButton label="加粗" onClick={() => applyFormat('bold')}><Bold className="h-3.5 w-3.5" /></FormatButton>
              <FormatButton label="斜体" onClick={() => applyFormat('italic')}><Italic className="h-3.5 w-3.5" /></FormatButton>
              <FormatButton label="下划线" onClick={() => applyFormat('underline')}><Underline className="h-3.5 w-3.5" /></FormatButton>
              <FormatButton label="列表" onClick={() => applyFormat('insertUnorderedList')}><List className="h-3.5 w-3.5" /></FormatButton>
            </div>
          )}
          <div className="flex items-end gap-3">
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              data-placeholder="此刻有什么值得留下？"
              onFocus={() => setComposerFocused(true)}
              onBlur={() => {
                if (!editorRef.current?.innerText.trim()) setComposerFocused(false);
              }}
              onInput={(event) => setContent(event.currentTarget.innerText)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  saveMemo();
                }
              }}
              className={`min-w-0 flex-1 bg-transparent text-[16px] leading-7 text-[var(--color-text-primary)] outline-none transition-[min-height] duration-200 empty:before:pointer-events-none empty:before:text-[var(--color-text-muted)] empty:before:content-[attr(data-placeholder)] [&_b]:font-semibold [&_i]:italic [&_li]:ml-5 [&_li]:list-disc [&_u]:underline ${
                composerFocused ? 'min-h-[92px]' : 'min-h-[32px]'
              }`}
            />
            <div className="flex shrink-0 items-center gap-2">
              {saved && <span className="text-xs text-[var(--color-primary-dark)]">已保存</span>}
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-text-strong)] text-[var(--color-bg-card)] transition hover:opacity-85 disabled:bg-[var(--color-bg-secondary)] disabled:text-[var(--color-text-muted)]"
                type="button"
                disabled={!content.trim() || saving}
                onClick={saveMemo}
                aria-label="保存记录"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function FeelingComposition({ emotion }: { emotion: TodayEmotion }) {
  const items = emotion.distribution.filter((item) => item.count > 0).slice(0, 4);
  return (
    <div className="mt-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {items.map((item, index) => {
          const currentRate = emotion.sample_size > 0 ? item.count / emotion.sample_size : 0;
          const previousRate = emotion.previous_sample_size > 0
            ? item.previous_count / emotion.previous_sample_size
            : null;
          const delta = previousRate === null ? null : Math.round((currentRate - previousRate) * 100);
          const comparison = delta === null
            ? '本期出现'
            : Math.abs(delta) < 5
              ? '和前期相近'
              : `较前期 ${delta > 0 ? '+' : '-'}${Math.abs(delta)} 个百分点`;
          return (
            <div key={item.emotion} className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: FEELING_COLORS[index] }}
                />
                <span className="truncate text-[12px] font-medium text-[var(--color-text-secondary)]">
                  {item.emotion}
                </span>
              </div>
              <p className="mt-1 text-[15px] font-semibold leading-none text-[var(--color-text-strong)]">
                {item.count}
                <span className="ml-1 text-[10px] font-normal text-[var(--color-text-muted)]">条记录</span>
              </p>
              <p className="mt-1.5 truncate text-[9px] text-[var(--color-text-muted)]">{comparison}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FormatButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-strong)]"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function CarouselDots({
  count,
  active,
  onChange,
  dark = false,
}: {
  count: number;
  active: number;
  onChange: (index: number) => void;
  dark?: boolean;
}) {
  if (count <= 1) return null;
  return (
    <div className="mt-3 flex items-center gap-1.5" aria-label="切换文案">
      {Array.from({ length: Math.min(count, 6) }, (_, index) => (
        <button
          key={index}
          type="button"
          onClick={() => onChange(index)}
          aria-label={`查看第 ${index + 1} 条`}
          className={`h-1.5 rounded-full transition-all ${
            active === index
              ? `w-5 ${dark ? 'bg-white/70' : 'bg-[var(--color-primary)]'}`
              : `w-1.5 ${dark ? 'bg-white/20 hover:bg-white/40' : 'bg-[var(--color-border-strong)]'}`
          }`}
        />
      ))}
    </div>
  );
}
