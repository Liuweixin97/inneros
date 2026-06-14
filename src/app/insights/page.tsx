'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  BrainCircuit,
  Check,
  Clock3,
  EyeOff,
  Flame,
  Hash,
  Lightbulb,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import EvidenceDrawer from '@/components/insight/EvidenceDrawer';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import MarkdownContent from '@/components/ui/MarkdownContent';
import type {
  Insight,
  InsightType,
  MemoryEvidence,
  MemoryItem,
  MemoryType,
  Topic,
} from '@/types';

type Section = 'topics' | 'insights' | 'principles' | 'memories';

const SECTIONS: Array<{ id: Section; label: string; description: string }> = [
  { id: 'topics', label: '主题', description: '长期反复关注的方向' },
  { id: 'memories', label: '记忆', description: '未来判断需要知道的事实' },
  { id: 'insights', label: '洞察', description: '跨记录出现的规律与变化' },
  { id: 'principles', label: '准则', description: '愿意带入未来的判断' },
];

const TYPE_LABEL: Record<InsightType, string> = {
  recurring_question: '反复问题',
  methodology: '方法论',
  emotion_cycle: '情绪周期',
  strength: '优势',
  risk_pattern: '风险模式',
  growth_evidence: '成长证据',
};

const TYPE_ICON: Record<InsightType, React.ReactNode> = {
  recurring_question: <RefreshCw className="h-3.5 w-3.5" />,
  methodology: <Lightbulb className="h-3.5 w-3.5" />,
  emotion_cycle: <Flame className="h-3.5 w-3.5" />,
  strength: <Shield className="h-3.5 w-3.5" />,
  risk_pattern: <EyeOff className="h-3.5 w-3.5" />,
  growth_evidence: <Check className="h-3.5 w-3.5" />,
};

const MEMORY_LABEL: Record<MemoryType, string> = {
  event: '经历',
  person: '人物',
  project: '项目',
  goal: '目标',
  state: '近况',
  belief: '信念',
  pattern: '模式',
  preference: '偏好',
  constraint: '约束',
};

const MEMORY_ICON: Record<MemoryType, React.ReactNode> = {
  event: <Clock3 className="h-4 w-4" />,
  person: <UserRound className="h-4 w-4" />,
  project: <BookOpen className="h-4 w-4" />,
  goal: <Sparkles className="h-4 w-4" />,
  state: <Flame className="h-4 w-4" />,
  belief: <Lightbulb className="h-4 w-4" />,
  pattern: <RefreshCw className="h-4 w-4" />,
  preference: <Check className="h-4 w-4" />,
  constraint: <Shield className="h-4 w-4" />,
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
    .format(new Date(value));
}

export default function KnowledgePage() {
  const router = useRouter();
  const [section, setSection] = useState<Section>('topics');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [memoryTotal, setMemoryTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [memoryType, setMemoryType] = useState<MemoryType | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [showAddPrinciple, setShowAddPrinciple] = useState(false);
  const [principleTitle, setPrincipleTitle] = useState('');
  const [principleContent, setPrincipleContent] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMemoIds, setDrawerMemoIds] = useState<string[]>([]);
  const [drawerTitle, setDrawerTitle] = useState('');

  const load = async () => {
    setLoading(true);
    const [topicResponse, insightResponse, memoryResponse] = await Promise.all([
      fetch('/api/topics'),
      fetch('/api/insights'),
      fetch('/api/memories?status=active&limit=60'),
    ]);
    if (topicResponse.ok) setTopics(await topicResponse.json());
    if (insightResponse.ok) setInsights(await insightResponse.json());
    if (memoryResponse.ok) {
      const data = await memoryResponse.json();
      setMemories(data.memories ?? []);
      setMemoryTotal(data.total ?? 0);
    }
    setLoading(false);
  };

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab') as Section | null;
    if (tab && SECTIONS.some((item) => item.id === tab)) setSection(tab);
    load();
  }, []);

  const changeSection = (next: Section) => {
    setSection(next);
    setQuery('');
    window.history.replaceState(null, '', `/insights?tab=${next}`);
  };

  const filteredTopics = useMemo(() => topics.filter((topic) => (
    `${topic.name} ${topic.summary || ''}`.toLowerCase().includes(query.toLowerCase())
  )), [topics, query]);

  const filteredInsights = useMemo(() => insights.filter((insight) => {
    const inSection = section === 'principles' ? insight.saved_as_principle : !insight.saved_as_principle;
    return inSection
      && insight.user_feedback !== 'hidden'
      && `${insight.title} ${insight.content}`.toLowerCase().includes(query.toLowerCase());
  }), [insights, query, section]);

  const filteredMemories = useMemo(() => memories.filter((memory) => (
    (memoryType === 'all' || memory.type === memoryType)
    && `${memory.title} ${memory.summary}`.toLowerCase().includes(query.toLowerCase())
  )), [memories, memoryType, query]);

  const generateInsights = async () => {
    setWorking(true);
    setError('');
    const response = await fetch('/api/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeRange: '30d' }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) setError(data.error || '暂时没有形成新的洞察');
    await load();
    setWorking(false);
  };

  const updateTopics = async () => {
    setWorking(true);
    setError('');
    const response = await fetch('/api/topics', { method: 'POST' });
    if (!response.ok) setError('主题整理失败');
    await load();
    setWorking(false);
  };

  const patchInsight = async (id: string, body: Partial<Insight>) => {
    const response = await fetch(`/api/insights/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) return;
    const updated = await response.json();
    setInsights((current) => current.map((item) => item.id === id ? updated : item));
  };

  const removeInsight = async (id: string) => {
    if (!window.confirm('确定删除这条内容吗？')) return;
    const response = await fetch(`/api/insights/${id}`, { method: 'DELETE' });
    if (response.ok) setInsights((current) => current.filter((item) => item.id !== id));
  };

  const createPrinciple = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!principleTitle.trim() || !principleContent.trim()) return;
    setWorking(true);
    const response = await fetch('/api/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: principleTitle.trim(),
        content: principleContent.trim(),
        saved_as_principle: true,
      }),
    });
    if (response.ok) {
      setPrincipleTitle('');
      setPrincipleContent('');
      setShowAddPrinciple(false);
      await load();
    }
    setWorking(false);
  };

  const openEvidence = (title: string, memoIds: string[]) => {
    setDrawerTitle(title);
    setDrawerMemoIds(memoIds);
    setDrawerOpen(true);
  };

  const openMemoryEvidence = async (memory: MemoryItem) => {
    const response = await fetch(`/api/memories/${memory.id}`);
    if (!response.ok) return;
    const data = await response.json() as { evidence: MemoryEvidence[] };
    openEvidence(memory.title, [...new Set(data.evidence.map((item) => item.memo_id))]);
  };

  const sectionCount = (id: Section) => {
    if (id === 'topics') return topics.length;
    if (id === 'memories') return memoryTotal;
    if (id === 'principles') return insights.filter((item) => item.saved_as_principle).length;
    return insights.filter((item) => !item.saved_as_principle).length;
  };

  return (
    <div className="min-h-full animate-fade-in px-5 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-[1080px]">
        <header className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[var(--color-primary-dark)]">
              <BrainCircuit className="h-4 w-4" />
              从记录到认识
            </div>
            <h1 className="text-2xl font-semibold text-[var(--color-text-strong)]">认识自己</h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-secondary)]">
              主题聚拢关注，记忆保留事实，洞察解释规律，准则只留下你愿意带入未来的判断。
            </p>
          </div>
          <div className="flex gap-2">
            {section === 'topics' && (
              <button className="btn-primary px-4 py-2 text-xs" type="button" onClick={updateTopics} disabled={working}>
                <RefreshCw className={`h-4 w-4 ${working ? 'animate-spin' : ''}`} />
                更新主题
              </button>
            )}
            {section === 'insights' && (
              <button className="btn-primary px-4 py-2 text-xs" type="button" onClick={generateInsights} disabled={working}>
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                看看新发现
              </button>
            )}
            {section === 'principles' && (
              <button className="btn-primary px-4 py-2 text-xs" type="button" onClick={() => setShowAddPrinciple(true)}>
                <Plus className="h-4 w-4" />
                新增准则
              </button>
            )}
          </div>
        </header>

        <div className="mb-6 grid gap-2 rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-bg-card)] p-2 sm:grid-cols-4">
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => changeSection(item.id)}
              className={`rounded-xl px-3 py-3 text-left transition ${
                section === item.id
                  ? 'bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]'
                  : 'hover:bg-[var(--color-bg-hover)]'
              }`}
            >
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>{item.label}</span>
                <span className="text-xs font-normal opacity-65">{sectionCount(item.id)}</span>
              </div>
              <p className="mt-0.5 text-[10px] opacity-65">{item.description}</p>
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-5 flex items-center justify-between rounded-xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-3 text-sm text-[var(--color-danger-text)]">
            <span>{error}</span>
            <button type="button" onClick={() => setError('')}><X className="h-4 w-4" /></button>
          </div>
        )}

        {showAddPrinciple && (
          <form onSubmit={createPrinciple} className="card mb-5 space-y-3 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">新增一条自己的准则</h2>
              <button type="button" onClick={() => setShowAddPrinciple(false)}><X className="h-4 w-4" /></button>
            </div>
            <input className="input-base" value={principleTitle} onChange={(event) => setPrincipleTitle(event.target.value)} placeholder="准则标题" />
            <textarea className="input-base min-h-24 resize-none" value={principleContent} onChange={(event) => setPrincipleContent(event.target.value)} placeholder="它在什么情境下适用？边界是什么？" />
            <div className="flex justify-end">
              <button className="btn-primary px-4 py-2 text-xs" type="submit" disabled={working}>保存</button>
            </div>
          </form>
        )}

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input className="input-base pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`搜索${SECTIONS.find((item) => item.id === section)?.label}`} />
          </label>
          {section === 'memories' && (
            <div className="flex max-w-full gap-1 overflow-x-auto">
              {(['all', ...Object.keys(MEMORY_LABEL)] as Array<MemoryType | 'all'>).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setMemoryType(type)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${
                    memoryType === type
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]'
                      : 'border-[var(--color-border)]'
                  }`}
                >
                  {type === 'all' ? '全部' : MEMORY_LABEL[type]}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="py-20"><LoadingSpinner text="正在整理" /></div>
        ) : section === 'topics' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTopics.map((topic) => (
              <Link href={`/topics/${topic.id}`} key={topic.id} className="card p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="mb-4 flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]"><Hash className="h-5 w-5" /></span>
                  <span className="text-xs text-[var(--color-text-muted)]">{topic.memo_count} 条记录</span>
                </div>
                <h2 className="font-semibold text-[var(--color-text-strong)]">{topic.name}</h2>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--color-text-secondary)]">{topic.summary || topic.description || '继续记录后，这里会出现更多线索。'}</p>
                <p className="mt-4 text-xs text-[var(--color-text-muted)]">最近出现于 {formatDate(topic.last_seen_at)}</p>
              </Link>
            ))}
          </div>
        ) : section === 'memories' ? (
          <>
            <p className="mb-4 text-xs text-[var(--color-text-muted)]">
              先展示最近确认的 60 条；搜索和类型筛选用于快速缩小范围。
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {filteredMemories.map((memory) => (
              <button key={memory.id} type="button" onClick={() => openMemoryEvidence(memory)} className="card p-5 text-left transition hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:shadow-md">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary-light)] px-2.5 py-1 text-xs font-medium text-[var(--color-primary-dark)]">
                    {MEMORY_ICON[memory.type]} {MEMORY_LABEL[memory.type]}
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)]">{memory.evidence_count} 条依据</span>
                </div>
                <h2 className="font-semibold text-[var(--color-text-strong)]">{memory.title}</h2>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--color-text-secondary)]">{memory.summary}</p>
                <div className="mt-4 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                  <span>{Math.round(memory.confidence * 100)}% 可信度</span>
                  <span>确认于 {formatDate(memory.last_confirmed_at)}</span>
                </div>
              </button>
              ))}
            </div>
          </>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredInsights.map((insight) => (
              <article key={insight.id} className="card flex flex-col justify-between p-5">
                <div>
                  <div className="mb-3 flex items-start justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary-light)] px-2.5 py-1 text-xs font-medium text-[var(--color-primary-dark)]">
                      {TYPE_ICON[insight.type]} {section === 'principles' ? '我的准则' : TYPE_LABEL[insight.type]}
                    </span>
                    <button type="button" onClick={() => removeInsight(insight.id)} className="text-[var(--color-text-muted)] hover:text-[var(--color-danger-text)]"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <h2 className="text-[17px] font-semibold text-[var(--color-text-strong)]">{insight.title}</h2>
                  <MarkdownContent content={insight.content} className="mt-2 text-[13px] text-[var(--color-text-secondary)]" />
                </div>
                <footer className="mt-5 flex items-center justify-between border-t border-[var(--color-border-light)] pt-3">
                  <div className="flex gap-2">
                    {insight.evidence_memo_ids.length > 0 && (
                      <button className="btn-ghost px-2 py-1 text-xs" type="button" onClick={() => openEvidence(insight.title, insight.evidence_memo_ids)}>
                        {insight.evidence_memo_ids.length} 条依据
                      </button>
                    )}
                    <button className="btn-ghost px-2 py-1 text-xs" type="button" onClick={() => router.push(`/chat?insight=${insight.id}`)}>
                      <MessageSquare className="h-3.5 w-3.5" />聊聊
                    </button>
                  </div>
                  <button className="text-xs font-medium text-[var(--color-primary-dark)]" type="button" onClick={() => patchInsight(insight.id, { saved_as_principle: !insight.saved_as_principle })}>
                    {insight.saved_as_principle ? '移出准则' : '保存为准则'}
                  </button>
                </footer>
              </article>
            ))}
          </div>
        )}

        {!loading && (
          (section === 'topics' && filteredTopics.length === 0)
          || (section === 'memories' && filteredMemories.length === 0)
          || ((section === 'insights' || section === 'principles') && filteredInsights.length === 0)
        ) && (
          <div className="rounded-2xl border border-dashed border-[var(--color-border)] py-16 text-center text-sm text-[var(--color-text-muted)]">
            这里还没有可展示的内容。
          </div>
        )}

        <EvidenceDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          evidenceMemoIds={drawerMemoIds}
          insightTitle={drawerTitle}
        />
      </div>
    </div>
  );
}
