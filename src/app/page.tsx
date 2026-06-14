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
  Send,
  Sparkles,
  Underline,
  X,
} from 'lucide-react';
import type { EmotionType, TodayDigest, TodayEmotionWeek } from '@/types';

const TREND_COLORS = ['#27c89b', '#7c6ee6', '#f4ad55', '#e76f83'];

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
      <div className="mx-auto max-w-[980px] px-5 py-7 md:px-8 md:py-10">
        <header className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-[13px] text-[var(--color-text-muted)]">{formatDate()}</p>
            <h1 className="text-[28px] font-semibold tracking-tight text-[var(--color-text-strong)] md:text-[34px]">
              {getGreeting()}，炜鑫
            </h1>
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
          <div className="grid gap-4 md:grid-cols-[1.45fr_0.75fr]">
            <div className="skeleton h-[330px] rounded-3xl" />
            <div className="skeleton h-[330px] rounded-3xl" />
          </div>
        ) : digest ? (
          <main className="grid gap-4 md:grid-cols-[1.45fr_0.75fr]">
            <section
              className="relative flex min-h-[400px] flex-col overflow-hidden rounded-3xl border p-6 text-white shadow-[var(--shadow-lg)] md:p-8"
              style={{
                backgroundColor: '#111827',
                borderColor: 'rgba(255,255,255,0.08)',
              }}
            >
              <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-[var(--color-primary)] opacity-10 blur-3xl" />
              <div className="relative flex items-center gap-2 text-[12px] font-medium text-white/60">
                <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
                最近的你
              </div>

              {primaryFocus ? (
                <div className="relative flex flex-1 flex-col justify-between pt-8">
                  <div>
                    <p className="text-sm text-white/50">反复回到</p>
                    <h2 className="mt-2 max-w-[620px] text-[30px] font-medium leading-[1.35] tracking-tight md:text-[38px]">
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
                    <div className="mt-6 flex gap-3">
                      {stateAnchor.state && (
                        <div className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 backdrop-blur-sm">
                          <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-white/35">当前状态</p>
                          <p className="line-clamp-1 text-[12px] font-medium leading-snug text-white/85">{stateAnchor.state.title}</p>
                          <p className="mt-0.5 line-clamp-2 text-[10px] leading-normal text-white/45">{stateAnchor.state.summary}</p>
                        </div>
                      )}
                      {stateAnchor.goal && (
                        <div className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 backdrop-blur-sm">
                          <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-white/35">当前目标</p>
                          <p className="line-clamp-1 text-[12px] font-medium leading-snug text-white/85">{stateAnchor.goal.title}</p>
                          <p className="mt-0.5 line-clamp-2 text-[10px] leading-normal text-white/45">{stateAnchor.goal.summary}</p>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mt-8 border-t border-white/10 pt-5">
                    <p className="mb-2 text-[11px] text-white/40">值得继续问自己</p>
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

            <aside className="flex min-h-[360px] flex-col gap-4">
              <section className="card flex-1 p-5">
                <div className="mb-4 flex items-center gap-2 text-[12px] font-medium text-[var(--color-text-muted)]">
                  <Activity className="h-4 w-4 text-[var(--color-primary-dark)]" />
                  情绪走向
                </div>
                {dominantEmotion && digest.emotion.weekly_trend.length > 0 ? (
                  <div>
                    <div className="mb-4 flex items-baseline gap-2">
                      <h2 className="text-[20px] font-semibold text-[var(--color-text-strong)]">
                        {dominantEmotion.emotion}
                      </h2>
                      <span className="text-[11px] text-[var(--color-text-muted)]">
                        近 {digest.emotion.period_days} 天最多
                      </span>
                    </div>

                    <EmotionTrendChart
                      weeks={digest.emotion.weekly_trend}
                      topEmotions={digest.emotion.distribution.slice(0, 4).map((item) => item.emotion)}
                    />

                    <Link href={`/records?emotion=${encodeURIComponent(dominantEmotion.emotion)}`} className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary-dark)]">
                      看看这些记录 <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-[var(--color-text-muted)]">最近的记录里还没有明显的感受线索。</p>
                )}
              </section>

              <section className="rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-bg-card)] p-4">
                <div className="mb-2 flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
                  <Check className="h-3.5 w-3.5" />
                  如果今天想往前一步
                </div>
                {primaryAction ? (
                  <div>
                    <Link href={`/chat?prompt=${encodeURIComponent(`请基于我的历史记录，继续推演这个下一步：${primaryAction.text}`)}`} className="group flex items-end justify-between gap-3">
                      <p key={primaryAction.key} className="line-clamp-3 animate-fade-in text-[13px] font-medium leading-5 text-[var(--color-text-strong)]">{primaryAction.text}</p>
                      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-text-muted)] group-hover:text-[var(--color-primary-dark)]" />
                    </Link>
                    <CarouselDots count={digest.actions.length} active={actionIndex} onChange={setActionIndex} />
                  </div>
                ) : (
                  <Link href="/chat?prompt=%E8%AF%B7%E7%BB%BC%E5%90%88%E6%88%91%E6%9C%80%E8%BF%91%E7%9A%84%E8%AE%B0%E5%BD%95%EF%BC%8C%E5%85%88%E5%88%A4%E6%96%AD%E6%88%91%E7%9C%9F%E6%AD%A3%E6%83%B3%E6%8E%A8%E8%BF%9B%E7%9A%84%E6%98%AF%E4%BB%80%E4%B9%88%E3%80%81%E5%8D%A1%E5%9C%A8%E5%93%AA%E9%87%8C%E3%80%81%E6%9C%89%E4%BB%80%E4%B9%88%E7%8E%B0%E5%AE%9E%E7%BA%A6%E6%9D%9F%EF%BC%8C%E5%86%8D%E7%BB%99%E6%88%91%E4%B8%80%E4%B8%AA%E6%9C%80%E5%80%BC%E5%BE%97%E5%81%9A%E7%9A%84%E4%B8%8B%E4%B8%80%E6%AD%A5%E3%80%82%E5%A6%82%E6%9E%9C%E4%BF%A1%E6%81%AF%E4%B8%8D%E8%B6%B3%EF%BC%8C%E5%85%88%E9%97%AE%E6%88%91%E4%B8%80%E4%B8%AA%E5%85%B3%E9%94%AE%E9%97%AE%E9%A2%98%E3%80%82" className="inline-flex items-center gap-1 text-[12px] text-[var(--color-primary-dark)]">
                    从最近的记录里想一步 <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </section>
            </aside>
          </main>
        ) : null}

        <section className="mt-4 rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-bg-card)] p-4 shadow-[var(--shadow-sm)]">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-1.5 h-4 w-4 shrink-0 text-[var(--color-primary-dark)]" />
            <div className="min-w-0 flex-1">
              {composerFocused && (
                <div className="mb-2 flex items-center gap-1 border-b border-[var(--color-border-light)] pb-2">
                  <FormatButton label="加粗" onClick={() => applyFormat('bold')}><Bold className="h-3.5 w-3.5" /></FormatButton>
                  <FormatButton label="斜体" onClick={() => applyFormat('italic')}><Italic className="h-3.5 w-3.5" /></FormatButton>
                  <FormatButton label="下划线" onClick={() => applyFormat('underline')}><Underline className="h-3.5 w-3.5" /></FormatButton>
                  <FormatButton label="列表" onClick={() => applyFormat('insertUnorderedList')}><List className="h-3.5 w-3.5" /></FormatButton>
                </div>
              )}
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
              className={`w-full bg-transparent text-sm leading-6 text-[var(--color-text-primary)] outline-none transition-[min-height] duration-200 empty:before:pointer-events-none empty:before:text-[var(--color-text-muted)] empty:before:content-[attr(data-placeholder)] [&_b]:font-semibold [&_i]:italic [&_li]:ml-5 [&_li]:list-disc [&_u]:underline ${
                composerFocused ? 'min-h-[96px]' : 'min-h-[28px]'
              }`}
            />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {saved && <span className="text-xs text-[var(--color-primary-dark)]">已保存</span>}
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary)] text-white shadow-sm transition hover:brightness-105 disabled:bg-[var(--color-border)] disabled:text-[var(--color-text-muted)]"
                type="button"
                disabled={!content.trim() || saving}
                onClick={saveMemo}
                aria-label="发送记录"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function EmotionTrendChart({
  weeks,
  topEmotions,
}: {
  weeks: TodayEmotionWeek[];
  topEmotions: EmotionType[];
}) {
  const width = 100;
  const height = 60;
  const paddingTop = 6;
  const paddingBottom = 16;
  const chartHeight = height - paddingTop - paddingBottom;
  const globalMax = Math.max(
    1,
    ...topEmotions.flatMap((emotion) => weeks.map((week) => week.counts[emotion] ?? 0)),
  );
  const toX = (weekIndex: number) => (
    weeks.length <= 1 ? width / 2 : weekIndex / (weeks.length - 1) * width
  );
  const toY = (count: number) => paddingTop + chartHeight - count / globalMax * chartHeight;
  const buildPoints = (emotion: EmotionType) => weeks
    .map((week, index) => `${toX(index).toFixed(1)},${toY(week.counts[emotion] ?? 0).toFixed(1)}`)
    .join(' ');

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full overflow-visible text-[var(--color-text-muted)]"
        style={{ height: '80px' }}
        role="img"
        aria-label="过去六周情绪趋势折线图"
      >
        <line
          x1="0"
          y1={paddingTop + chartHeight}
          x2={width}
          y2={paddingTop + chartHeight}
          stroke="currentColor"
          strokeWidth="0.3"
          opacity="0.15"
        />
        {weeks.map((week, index) => (
          <text
            key={week.week_start}
            x={toX(index)}
            y={height - 2}
            textAnchor="middle"
            fontSize="4"
            fill="currentColor"
            opacity="0.55"
          >
            {week.week_label}
          </text>
        ))}
        {topEmotions.map((emotion, colorIndex) => {
          if (!weeks.some((week) => (week.counts[emotion] ?? 0) > 0)) return null;
          return (
            <polyline
              key={emotion}
              points={buildPoints(emotion)}
              fill="none"
              stroke={TREND_COLORS[colorIndex] ?? '#999'}
              strokeWidth="1.2"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity="0.85"
            />
          );
        })}
        {topEmotions.flatMap((emotion, colorIndex) => weeks.map((week, index) => {
          const count = week.counts[emotion] ?? 0;
          if (count === 0) return null;
          return (
            <circle
              key={`${emotion}-${week.week_start}`}
              cx={toX(index)}
              cy={toY(count)}
              r="1.4"
              fill={TREND_COLORS[colorIndex] ?? '#999'}
              opacity="0.9"
            />
          );
        }))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {topEmotions.map((emotion, colorIndex) => {
          if (!weeks.some((week) => (week.counts[emotion] ?? 0) > 0)) return null;
          return (
            <div key={emotion} className="flex items-center gap-1">
              <span
                className="inline-block h-1.5 w-3 rounded-full"
                style={{ backgroundColor: TREND_COLORS[colorIndex] ?? '#999' }}
              />
              <span className="text-[10px] text-[var(--color-text-muted)]">{emotion}</span>
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
