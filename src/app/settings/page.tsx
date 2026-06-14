'use client';

import { useEffect, useState } from 'react';
import { BrainCircuit, Database, Download, Moon, RefreshCw, Settings as SettingsIcon, Sun, Trash2, Upload } from 'lucide-react';
import { useAppStore } from '@/lib/store/app';
import type { MemoCreateInput } from '@/types';

interface DbStats {
  total_memos: number;
  total_topics: number;
  total_conversations: number;
  total_insights: number;
}

interface AiConfig {
  base_url: string;
  model: string;
  api_key_masked: string;
}

interface AiStatus {
  analysis: {
    memos_total: number;
    memos_pending: number;
    memos_analyzing: number;
    memos_failed: number;
    memos_done: number;
    memos_memory_processed: number;
    jobs_pending: number;
    jobs_running: number;
    jobs_failed: number;
    jobs_dead: number;
  };
  memories: {
    total: number;
    event: number;
    person: number;
    project: number;
    goal: number;
    state: number;
    belief: number;
    pattern: number;
    preference: number;
    constraint: number;
    relations: number;
  };
  llm_usage: Record<string, {
    runs: number;
    total_tokens: number;
    avg_prompt_tokens: number;
    avg_completion_tokens: number;
  }>;
}

export default function SettingsPage() {
  const { darkMode, toggleDarkMode } = useAppStore();
  const [stats, setStats] = useState<DbStats | null>(null);
  const [aiConfig, setAiConfig] = useState<AiConfig | null>(null);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [processingAnalysis, setProcessingAnalysis] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const load = async () => {
    setLoading(true);
    const [statsResponse, aiStatusResponse] = await Promise.all([
      fetch('/api/stats'),
      fetch('/api/settings/ai-status'),
    ]);
    if (statsResponse.ok) {
      const data = await statsResponse.json();
      setStats({ total_memos: data.total_memos ?? 0, total_topics: data.total_topics ?? 0, total_conversations: data.total_conversations ?? 0, total_insights: data.total_insights ?? 0 });
    }
    if (aiStatusResponse.ok) setAiStatus(await aiStatusResponse.json());
    setLoading(false);
  };

  useEffect(() => {
    load();
    fetch('/api/settings/ai-config')
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((config) => {
        if (config) setAiConfig(config);
      })
      .catch(() => undefined);
  }, []);

  const clearData = async () => {
    if (confirmText !== 'CLEAR') return;
    setClearing(true);
    const response = await fetch('/api/settings/clear-data', { method: 'POST' });
    if (response.ok) {
      setConfirmText('');
      await load();
    }
    setClearing(false);
  };

  const exportData = () => {
    window.location.href = '/api/export';
  };

  const processAnalysisBatch = async () => {
    setProcessingAnalysis(true);
    try {
      await fetch('/api/analysis-jobs/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enqueue_limit: 200,
          extract_limit: 100,
          extract_concurrency: 16,
          memory_limit: 100,
          memory_concurrency: 4,
        }),
      });
      await load();
    } finally {
      setProcessingAnalysis(false);
    }
  };

  // Flomo Import States
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0); // 0 to 100
  const [importStatusText, setImportStatusText] = useState('');
  const [importStats, setImportStats] = useState<{
    total: number;
    success: number;
    skipped: number;
  } | null>(null);
  const needsAnalysis = Boolean(aiStatus && (
    aiStatus.analysis.memos_done < aiStatus.analysis.memos_total
    || aiStatus.analysis.memos_memory_processed < aiStatus.analysis.memos_done
    || aiStatus.analysis.jobs_pending > 0
    || aiStatus.analysis.jobs_failed > 0
    || aiStatus.analysis.jobs_dead > 0
  ));

  const handleFlomoImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportProgress(0);
    setImportStats(null);
    setImportStatusText('正在读取文件...');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          throw new Error('文件内容为空');
        }

        setImportStatusText('正在解析 HTML 结构...');
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        const memoNodes = doc.querySelectorAll('.memo');

        if (memoNodes.length === 0) {
          throw new Error('未在文件中找到有效的 memo 数据，请检查文件格式是否为 Flomo 导出的 HTML 文件');
        }

        setImportStatusText(`解析完成，共发现 ${memoNodes.length} 条笔记。准备导入...`);
        
        // Helper to convert HTML node to Markdown
        const convertNodeToMarkdown = (node: Node): string => {
          if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent || '';
          }
          if (node.nodeType !== Node.ELEMENT_NODE) {
            return '';
          }
          
          const el = node as HTMLElement;
          const tagName = el.tagName.toUpperCase();
          
          let childrenMarkdown = '';
          el.childNodes.forEach((child) => {
            childrenMarkdown += convertNodeToMarkdown(child);
          });

          switch (tagName) {
            case 'STRONG':
            case 'B':
              return `**${childrenMarkdown}**`;
            case 'EM':
            case 'I':
              return `*${childrenMarkdown}*`;
            case 'U':
              return `<u>${childrenMarkdown}</u>`;
            case 'STRIKE':
            case 'S':
            case 'DEL':
              return `~~${childrenMarkdown}~~`;
            case 'CODE':
              return `\`${childrenMarkdown}\``;
            case 'A': {
              const href = el.getAttribute('href') || '';
              return `[${childrenMarkdown}](${href})`;
            }
            case 'P':
            case 'DIV':
              return childrenMarkdown.trim() ? `${childrenMarkdown.trim()}\n\n` : '';
            case 'BR':
              return '\n\n';
            case 'LI':
              return `${childrenMarkdown.trim()}\n`;
            case 'UL': {
              let listContent = '';
              el.childNodes.forEach((child) => {
                if (child.nodeType === Node.ELEMENT_NODE && (child as HTMLElement).tagName.toUpperCase() === 'LI') {
                  const itemText = convertNodeToMarkdown(child).trim();
                  if (itemText) listContent += `- ${itemText}\n`;
                }
              });
              return listContent ? `${listContent}\n\n` : '';
            }
            case 'OL': {
              let listContent = '';
              let index = 1;
              el.childNodes.forEach((child) => {
                if (child.nodeType === Node.ELEMENT_NODE && (child as HTMLElement).tagName.toUpperCase() === 'LI') {
                  const itemText = convertNodeToMarkdown(child).trim();
                  if (itemText) {
                    listContent += `${index}. ${itemText}\n`;
                    index++;
                  }
                }
              });
              return listContent ? `${listContent}\n\n` : '';
            }
            case 'H1':
              return childrenMarkdown.trim() ? `# ${childrenMarkdown.trim()}\n\n` : '';
            case 'H2':
              return childrenMarkdown.trim() ? `## ${childrenMarkdown.trim()}\n\n` : '';
            case 'H3':
              return childrenMarkdown.trim() ? `### ${childrenMarkdown.trim()}\n\n` : '';
            case 'H4':
              return childrenMarkdown.trim() ? `#### ${childrenMarkdown.trim()}\n\n` : '';
            case 'H5':
              return childrenMarkdown.trim() ? `##### ${childrenMarkdown.trim()}\n\n` : '';
            case 'H6':
              return childrenMarkdown.trim() ? `###### ${childrenMarkdown.trim()}\n\n` : '';
            default:
              return childrenMarkdown;
          }
        };

        const parsedMemos: MemoCreateInput[] = [];

        memoNodes.forEach((node) => {
          const timeEl = node.querySelector('.time');
          const contentEl = node.querySelector('.content') as HTMLElement;
          if (!contentEl) return;

          let createdAt = new Date().toISOString();
          if (timeEl && timeEl.textContent) {
            const timeStr = timeEl.textContent.trim();
            const parsedDate = new Date(timeStr.replace(/-/g, '/'));
            if (!isNaN(parsedDate.getTime())) {
              createdAt = parsedDate.toISOString();
            }
          }

          // Convert content node to Markdown
          let markdownContent = '';
          contentEl.childNodes.forEach((child) => {
            markdownContent += convertNodeToMarkdown(child);
          });
          markdownContent = markdownContent.trim().replace(/\n{3,}/g, '\n\n');

          // Extract tags (with slash support) from parsed Markdown content
          const tags: string[] = [];
          const tagMatches = markdownContent.match(/#([a-zA-Z0-9_\u4e00-\u9fa5/.-]+)/g);
          if (tagMatches) {
            tagMatches.forEach((m) => {
              const name = m.slice(1).trim();
              if (name) {
                let cleaned = name;
                while (cleaned && /[./-]$/.test(cleaned)) {
                  cleaned = cleaned.slice(0, -1);
                }
                if (cleaned) {
                  tags.push(cleaned);
                }
              }
            });
          }

          // Extract title (the first bold element)
          const strongEl = contentEl.querySelector('strong, b');
          const title = strongEl ? strongEl.textContent?.trim() || null : null;

          parsedMemos.push({
            content: markdownContent,
            created_at: createdAt,
            tags: [...new Set(tags)],
            source: 'flomo',
            ai_title: title,
          });
        });

        // Sort by time ascending
        parsedMemos.sort(
          (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime(),
        );

        const totalMemos = parsedMemos.length;
        let successCount = 0;
        let skippedCount = 0;
        let processedCount = 0;
        const chunkSize = 100;

        for (let i = 0; i < totalMemos; i += chunkSize) {
          const chunk = parsedMemos.slice(i, i + chunkSize);
          const currentBatchNum = Math.floor(i / chunkSize) + 1;
          const totalBatches = Math.ceil(totalMemos / chunkSize);

          setImportStatusText(`正在导入第 ${currentBatchNum}/${totalBatches} 批笔记...`);

          const response = await fetch('/api/memos/batch', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ memos: chunk }),
          });

          if (!response.ok) {
            throw new Error(`批次 ${currentBatchNum} 导入失败`);
          }

          const result = (await response.json()) as {
            count: number;
            skippedCount: number;
          };
          successCount += result.count;
          skippedCount += result.skippedCount;
          processedCount += chunk.length;
          setImportProgress(Math.round((processedCount / totalMemos) * 100));
        }

        setImportStatusText('导入完成，正在更新统计数据...');
        setImportStats({
          total: totalMemos,
          success: successCount,
          skipped: skippedCount,
        });
        await load(); // reload stats
      } catch (err) {
        console.error(err);
        setImportStatusText(`导入失败: ${err instanceof Error ? err.message : '未知错误'}`);
      } finally {
        setImporting(false);
        // Clear input value so file input can trigger change event again with same file
        event.target.value = '';
      }
    };
    reader.onerror = () => {
      setImportStatusText('读取文件失败');
      setImporting(false);
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-full px-5 py-6 md:px-8 md:py-8 animate-fade-in">
      <div className="mx-auto max-w-[900px]">
        <header className="mb-8"><h1 className="text-2xl font-semibold text-[var(--color-text-strong)]">设置</h1><p className="mt-1 text-sm text-[var(--color-text-secondary)]">管理数据、外观和智能整理服务。</p></header>

        <div className="space-y-5">
          <section className="card p-5">
            <div className="mb-4 flex items-center gap-2"><Database className="h-5 w-5 text-[var(--color-primary)]" /><h2 className="font-semibold text-[var(--color-text-strong)]">本地数据库</h2><button className="btn-ghost ml-auto px-2 py-1 text-xs" type="button" onClick={load}><RefreshCw className="h-3.5 w-3.5" />刷新</button></div>
            <div className="grid gap-3 sm:grid-cols-4">{[['笔记', stats?.total_memos], ['主题', stats?.total_topics], ['对话', stats?.total_conversations], ['洞察', stats?.total_insights]].map(([label, value]) => <div key={label} className="rounded-2xl bg-[var(--color-bg-secondary)] p-4"><p className="text-xs text-[var(--color-text-muted)]">{label}</p><p className="mt-1 text-2xl font-semibold">{loading ? '-' : value}</p></div>)}</div>
          </section>

          <section className="card p-5">
            <div className="mb-4 flex items-center gap-2"><SettingsIcon className="h-5 w-5 text-[var(--color-primary)]" /><h2 className="font-semibold text-[var(--color-text-strong)]">AI 配置</h2></div>
            <div className="grid gap-3 text-sm text-[var(--color-text-secondary)] md:grid-cols-3"><div className="rounded-2xl bg-[var(--color-bg-secondary)] p-4"><p className="text-xs text-[var(--color-text-muted)]">Base URL</p><p className="mt-1 break-all">{aiConfig?.base_url ?? '读取中'}</p></div><div className="rounded-2xl bg-[var(--color-bg-secondary)] p-4"><p className="text-xs text-[var(--color-text-muted)]">Model</p><p className="mt-1">{aiConfig?.model ?? '读取中'}</p></div><div className="rounded-2xl bg-[var(--color-bg-secondary)] p-4"><p className="text-xs text-[var(--color-text-muted)]">API Key</p><p className="mt-1">{aiConfig?.api_key_masked ?? '读取中'}</p></div></div>
            <p className="mt-3 text-xs leading-6 text-[var(--color-text-muted)]">当前 AI 客户端从服务端环境变量读取配置。修改 `.env.local` 后重启开发服务即可生效。</p>
          </section>

          <section className="card p-5">
            <div className="mb-4 flex items-center gap-2">
              <BrainCircuit className="h-5 w-5 text-[var(--color-primary)]" />
              <h2 className="font-semibold text-[var(--color-text-strong)]">智能分析与长期记忆</h2>
              <button className="btn-ghost ml-auto px-2 py-1 text-xs" type="button" onClick={load}>
                <RefreshCw className="h-3.5 w-3.5" />刷新
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-[var(--color-bg-secondary)] p-4">
                <p className="text-xs text-[var(--color-text-muted)]">笔记分析</p>
                <p className="mt-1 text-xl font-semibold">{aiStatus ? `${aiStatus.analysis.memos_done}/${aiStatus.analysis.memos_total}` : '-'}</p>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  待处理 {aiStatus?.analysis.memos_pending ?? 0} · 失败 {aiStatus?.analysis.memos_failed ?? 0}
                </p>
              </div>
              <div className="rounded-2xl bg-[var(--color-bg-secondary)] p-4">
                <p className="text-xs text-[var(--color-text-muted)]">记忆判断</p>
                <p className="mt-1 text-xl font-semibold">{aiStatus ? `${aiStatus.analysis.memos_memory_processed}/${aiStatus.analysis.memos_done}` : '-'}</p>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  队列 {aiStatus?.analysis.jobs_pending ?? 0} · 死信 {aiStatus?.analysis.jobs_dead ?? 0}
                </p>
              </div>
              <div className="rounded-2xl bg-[var(--color-bg-secondary)] p-4">
                <p className="text-xs text-[var(--color-text-muted)]">长期记忆</p>
                <p className="mt-1 text-xl font-semibold">{aiStatus?.memories.total ?? '-'}</p>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  经历 {aiStatus?.memories.event ?? 0} · 近况 {aiStatus?.memories.state ?? 0} · 信念 {aiStatus?.memories.belief ?? 0} · 模式 {aiStatus?.memories.pattern ?? 0}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                className="btn-secondary"
                type="button"
                onClick={processAnalysisBatch}
                disabled={processingAnalysis || !needsAnalysis}
              >
                <RefreshCw className={`h-4 w-4 ${processingAnalysis ? 'animate-spin' : ''}`} />
                {processingAnalysis ? '正在处理一批…' : needsAnalysis ? '检查并补齐一批' : '已全部完成'}
              </button>
              <p className="text-xs leading-5 text-[var(--color-text-muted)]">
                新增与导入笔记会自动进入后台分析；此按钮用于补跑中断任务。当前共有 {aiStatus?.memories.relations ?? 0} 条记忆关系。
              </p>
            </div>
            <div className="mt-4 rounded-2xl border border-[var(--color-border-light)] px-4 py-3 text-xs text-[var(--color-text-secondary)]">
              记忆链路历史平均输入 {aiStatus?.llm_usage?.['memory.link']?.avg_prompt_tokens?.toLocaleString() ?? '-'} Token/次。
              新版会先本地过滤低价值笔记，并将候选记忆压缩到 12 条；后续调用可在这里观察实际降幅。
            </div>
          </section>

          <section className="card p-5">
            <div className="mb-4 flex items-center gap-2">{darkMode ? <Moon className="h-5 w-5 text-[var(--color-primary)]" /> : <Sun className="h-5 w-5 text-[var(--color-primary)]" />}<h2 className="font-semibold text-[var(--color-text-strong)]">显示</h2></div>
            <button className="btn-secondary" type="button" onClick={toggleDarkMode}>{darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}{darkMode ? '切换到亮色' : '切换到暗色'}</button>
          </section>

          <section className="card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Upload className="h-5 w-5 text-[var(--color-primary)]" />
              <h2 className="font-semibold text-[var(--color-text-strong)]">从 Flomo 导入</h2>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              支持导入从 Flomo 导出的 HTML 格式笔记文件。系统会自动解析时间、标签和 Markdown 排版，并识别已导入或文件内重复的笔记。
            </p>
            
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <label className={`btn-primary cursor-pointer flex items-center gap-2 ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Upload className="h-4 w-4" />
                  选择 HTML 文件
                  <input
                    type="file"
                    accept=".html"
                    className="hidden"
                    onChange={handleFlomoImport}
                    disabled={importing}
                  />
                </label>
                {importing && (
                  <span className="text-xs text-[var(--color-text-muted)] animate-pulse">
                    请勿关闭或刷新页面
                  </span>
                )}
              </div>

              {importStatusText && (
                <div className="rounded-2xl bg-[var(--color-bg-secondary)] p-4 text-sm">
                  <p className="font-medium text-[var(--color-text-strong)] mb-2">
                    {importStatusText}
                  </p>
                  
                  {(importing || importProgress > 0) && (
                    <div className="w-full bg-[var(--color-border-light)] rounded-full h-2">
                      <div
                        className="bg-[var(--color-primary)] h-2 rounded-full transition-all duration-300"
                        style={{ width: `${importProgress}%` }}
                      />
                    </div>
                  )}

                  {importProgress > 0 && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-1.5 text-right">
                      进度: {importProgress}%
                    </p>
                  )}

                  {importStats && (
                    <p className="mt-1.5 text-xs font-medium text-[var(--color-success-text)]">
                      共识别 {importStats.total} 条，新增 {importStats.success} 条，跳过重复 {importStats.skipped} 条。
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>

          <section className="card p-5">
            <div className="mb-4 flex items-center gap-2"><Download className="h-5 w-5 text-[var(--color-primary)]" /><h2 className="font-semibold text-[var(--color-text-strong)]">导出与清除</h2></div>
            <div className="flex flex-wrap gap-3"><button className="btn-primary" type="button" onClick={exportData}><Download className="h-4 w-4" />导出 JSON</button></div>
            <div className="mt-5 rounded-2xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] p-4"><h3 className="font-medium text-[var(--color-danger-text)]">清除所有数据</h3><p className="mt-1 text-sm text-[var(--color-danger-text)]">这会删除笔记、主题、对话和洞察。请输入 CLEAR 后执行。</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input className="h-10 rounded-xl border border-[var(--color-danger-border)] bg-[var(--color-bg-card)] px-3 text-sm text-[var(--color-text-primary)] outline-none" value={confirmText} onChange={(event) => setConfirmText(event.target.value)} placeholder="CLEAR" /><button className="btn-secondary border-[var(--color-danger-border)] text-[var(--color-danger-text)]" type="button" disabled={confirmText !== 'CLEAR' || clearing} onClick={clearData}>{clearing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}清除数据</button></div></div>
          </section>
        </div>
      </div>
    </div>
  );
}
