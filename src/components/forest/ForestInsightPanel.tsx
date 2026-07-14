'use client';

import Link from 'next/link';
import { forwardRef, useState, type CSSProperties } from 'react';
import {
  ArrowRight,
  ExternalLink,
  GitCompareArrows,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  ForestAtlas,
  ForestNode,
  ForestNodeId,
  ForestTaskChoice,
  ForestVisualization,
} from '@/lib/forest/types';
import styles from './ForestWorld.module.css';

interface ForestInsightPanelProps {
  node: ForestNode | null;
  atlas: ForestAtlas;
  taskChoice?: ForestTaskChoice;
  persistent: boolean;
  onClose: () => void;
  onSelectNode: (id: ForestNodeId) => void;
  onChooseTask: (nodeId: ForestNodeId, observationId: string, label: string) => void;
}

interface AiReflection {
  observation: string;
  basis: string;
  counterpoint: string;
  question: string;
  evidenceMemoIds: string[];
  source: 'ai-inference';
  generatedAt: string;
  model: string;
}

const KIND_LABELS = {
  'memo-signal': '原始记录统计',
  'memory-candidate': '长期记忆候选',
  'insight-candidate': '既有洞察候选',
} as const;

const TASK_COPY: Record<ForestNodeId, { title: string; instruction: string }> = {
  'lantern-cabin': { title: '认出此刻', instruction: '选一句最接近你现在状态的观察。' },
  'year-ring-path': { title: '留一枚年轮标记', instruction: '选出一个你想继续留意的重复或变化。' },
  'echo-hearth': { title: '选一处回声', instruction: '选一个值得回到原始记录继续看的场景。' },
  'twin-shadow-pond': { title: '校准一组双影', instruction: '选出你愿意暂时承认、但不急着解决的拉扯。' },
  'root-court': { title: '认出一条根', instruction: '选一个曾真实支撑过你的候选线索。' },
  'windwatch-terrace': { title: '留一枚观察标记', instruction: '选一个接下来值得验证的方向，而不是立刻立目标。' },
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(value));
}

function Visualization({ visualization }: { visualization: ForestVisualization }) {
  switch (visualization.kind) {
    case 'emotion-lanterns': {
      const max = Math.max(1, ...visualization.emotions.map((item) => item.count));
      return visualization.emotions.length > 0 ? (
        <div className={styles.emotionRows}>
          {visualization.emotions.map((emotion) => (
            <div key={emotion.label} className={styles.emotionRow}>
              <span>{emotion.label}</span>
              <span className={styles.emotionTrack}>
                <span
                  className={styles.emotionFill}
                  style={{
                    '--fill': `${Math.max(6, emotion.count / max * 100)}%`,
                    '--split': `${emotion.count > 0 ? emotion.earlierCount / emotion.count * 100 : 0}%`,
                  } as CSSProperties}
                />
                <span
                  className={styles.emotionSplit}
                  style={{ '--split': `${emotion.count > 0 ? emotion.earlierCount / emotion.count * 100 : 0}%` } as CSSProperties}
                />
              </span>
              <span className={styles.mutedCount}>{emotion.count}</span>
            </div>
          ))}
        </div>
      ) : <p className={styles.emptyViz}>还没有足够的情绪标记可视化。</p>;
    }
    case 'year-rings': {
      const max = Math.max(1, ...visualization.rings.map((ring) => ring.memoCount));
      return visualization.rings.length > 0 ? (
        <>
          <div className={styles.ringRail}>
            {visualization.rings.map((ring) => (
              <div key={ring.key} className={styles.ringItem}>
                <span
                  className={styles.ringCircle}
                  style={{ '--ring-size': `${24 + ring.memoCount / max * 34}px` } as CSSProperties}
                >
                  {ring.memoCount}
                </span>
                <small>{ring.label}</small>
              </div>
            ))}
          </div>
          <div className={styles.topicRail}>
            {visualization.recurringTopics.map((topic) => (
              <span key={topic.label}>{topic.label} · {topic.count}</span>
            ))}
          </div>
        </>
      ) : <p className={styles.emptyViz}>还没有足够的时间点形成年轮。</p>;
    }
    case 'echo-clusters':
      return visualization.entities.length > 0 ? (
        <>
          <div className={styles.echoRows}>
            {visualization.entities.slice(0, 7).map((entity) => (
              <div key={`${entity.entityType}-${entity.label}`} className={styles.echoRow}>
                <span className={styles.nodeDot} />
                <span>{entity.label}</span>
                <span className={styles.mutedCount}>{entity.count}</span>
              </div>
            ))}
          </div>
          {visualization.coAppearances.slice(0, 3).map((pair) => (
            <p key={pair.labels.join('-')} className={styles.echoPair}>
              {pair.labels[0]} 与 {pair.labels[1]} 在 {pair.count} 条记录中同时出现
            </p>
          ))}
        </>
      ) : <p className={styles.emptyViz}>还没有人物或项目场景可供对照。</p>;
    case 'twin-ripples':
      return visualization.tensions.length > 0 ? (
        <div className={styles.tensionList}>
          {visualization.tensions.map((tension, index) => (
            <div key={`${tension.left}-${index}`} className={styles.tension}>
              <span className={styles.tensionSide}>{tension.left}</span>
              <GitCompareArrows className={styles.tensionBridge} size={16} />
              <span className={styles.tensionSide}>{tension.right}</span>
              <p className={styles.tensionNote}>{tension.commonGround}</p>
            </div>
          ))}
        </div>
      ) : <p className={styles.emptyViz}>没有两侧证据，就不把不同片段包装成“内在矛盾”。</p>;
    case 'root-network':
      return visualization.roots.length > 0 ? (
        <div className={styles.rootRows}>
          {visualization.roots.slice(0, 7).map((root) => (
            <div key={root.id} className={styles.rootRow}>
              <span className={styles.nodeDot} />
              <span>{root.title}</span>
              <span className={styles.mutedCount}>{root.evidenceMemoIds.length} 条</span>
            </div>
          ))}
        </div>
      ) : <p className={styles.emptyViz}>还没有带窗口内原始证据的根系候选。</p>;
    case 'wind-compass':
      return visualization.directions.length > 0 || visualization.openQuestions.length > 0 ? (
        <div className={styles.directionRows}>
          {visualization.directions.slice(0, 6).map((direction) => (
            <div key={direction.id} className={styles.directionRow}>
              <span className={styles.nodeDot} />
              <span>{direction.label}</span>
              <span className={styles.mutedCount}>{direction.directionType === 'action' ? '行动候选' : direction.status}</span>
            </div>
          ))}
          {visualization.openQuestions.slice(0, 2).map((question) => (
            <p key={question.memoId} className={styles.echoPair}>待观察：{question.text}</p>
          ))}
        </div>
      ) : <p className={styles.emptyViz}>还没有目标、项目、行动或开放问题线索。</p>;
  }
}

const ForestInsightPanel = forwardRef<HTMLElement, ForestInsightPanelProps>(function ForestInsightPanel(
  { node, atlas, taskChoice, persistent, onClose, onSelectNode, onChooseTask },
  ref,
) {
  const [reflection, setReflection] = useState<AiReflection | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const generateReflection = async () => {
    if (!node || aiLoading || node.evidence.length < 2) return;
    setAiLoading(true);
    setAiError('');
    try {
      const response = await fetch('/api/forest/reflections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: node.id,
          evidenceMemoIds: node.evidence.map((item) => item.memoId),
        }),
      });
      const payload = await response.json() as { reflection?: AiReflection; error?: string };
      if (!response.ok || !payload.reflection) throw new Error(payload.error || '暂时无法继续整理');
      setReflection(payload.reflection);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : '暂时无法继续整理');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <aside ref={ref} className={styles.panel} data-open={Boolean(node)} aria-hidden={!node}>
      {node ? (
        <div className={styles.panelScroll}>
          <header className={styles.panelHeader}>
            <div>
              <span className={styles.panelNumber}>
                {String(atlas.nodes.findIndex((item) => item.id === node.id) + 1).padStart(2, '0')} / 06
              </span>
              <h2>{node.name}</h2>
              <p className={styles.panelPurpose}>{node.purpose}</p>
            </div>
            <button type="button" className={styles.closeButton} onClick={onClose} aria-label="收起观察面板">
              <X size={16} />
            </button>
          </header>

          <p className={styles.summary}>{node.summary}</p>
          <p className={styles.provenance}>
            本地确定性汇总 · {atlas.window.actualDays} 天 · {atlas.coverage.memoCount} 条普通记录 · 不作因果判断
          </p>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}><span>这一处的形状</span><span>{node.dataState === 'ready' ? '可比较' : node.dataState === 'sparse' ? '线索较少' : '等待记录'}</span></h3>
            <div className={styles.visualization}>
              <Visualization visualization={node.visualization} />
            </div>
          </section>

          <section className={styles.taskSection}>
            <span className={styles.taskEyebrow}>这一处只做一件事</span>
            <h3>{TASK_COPY[node.id].title}</h3>
            <p className={styles.taskIntro}>{TASK_COPY[node.id].instruction}</p>
            {node.observations.length > 0 ? (
              <div className={styles.taskChoices}>
                {node.observations.slice(0, 3).map((observation) => {
                  const selected = taskChoice?.observationId === observation.id;
                  return (
                    <button
                      key={observation.id}
                      type="button"
                      className={styles.taskChoice}
                      data-selected={selected}
                      aria-pressed={selected}
                      onClick={() => onChooseTask(node.id, observation.id, observation.label)}
                    >
                      <span>{observation.label}</span>
                      <small>{selected ? '已留下标记' : '选择这条'}</small>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className={styles.emptyViz}>这一处还没有可靠候选。现在的任务只是知道：这里仍需更多真实记录。</p>
            )}
            {taskChoice ? (
              <p className={styles.taskSaved}>
                你的标记：{taskChoice.label} · {persistent ? '已保存到你的林间路线' : '正在保存'}
              </p>
            ) : null}
          </section>

          {node.observations.length > 0 ? (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>可核对的观察</h3>
              <div className={styles.observationList}>
                {node.observations.map((item, index) => (
                  <article key={item.id} className={styles.observationRow}>
                    <span className={styles.observationIndex}>{String(index + 1).padStart(2, '0')}</span>
                    <div>
                      <strong>{item.label}</strong>
                      <p>{item.detail}</p>
                      <span className={styles.observationKind}>{KIND_LABELS[item.kind]} · {item.count} 条证据</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>原始证据</h3>
            {node.evidence.length > 0 ? (
              <div className={styles.evidenceList}>
                {node.evidence.map((evidence) => (
                  <Link key={evidence.memoId} className={styles.evidenceLink} href={`/records?id=${evidence.memoId}`}>
                    <time>{formatDate(evidence.recordedAt)}</time>
                    <span>
                      <strong>{evidence.title}</strong>
                      <p>{evidence.snippet}</p>
                    </span>
                    <ExternalLink size={12} />
                  </Link>
                ))}
              </div>
            ) : <p className={styles.emptyViz}>这个窗口里还没有可展开的原始片段。</p>}
          </section>

          <section className={styles.aiArea}>
            <p className={styles.aiIntro}>
              DeepSeek 只在你点击后读取上面的证据，整理一种候选解释、一个反面与一个开放问题；结果不会自动写回长期记忆。
            </p>
            <button
              type="button"
              className={styles.aiButton}
              disabled={node.evidence.length < 2 || aiLoading}
              onClick={generateReflection}
            >
              <span>{aiLoading ? '正在沿线索整理…' : node.evidence.length < 2 ? '至少需要两条原始证据' : '沿这条线索再看一层'}</span>
              <Sparkles size={15} />
            </button>
            {aiError ? <p className={styles.errorText}>{aiError}</p> : null}
            {reflection ? (
              <article className={styles.aiResult}>
                <h3>{reflection.observation}</h3>
                <dl>
                  <div><dt>依据范围</dt><dd>{reflection.basis}</dd></div>
                  <div><dt>另一种可能</dt><dd>{reflection.counterpoint}</dd></div>
                  <div><dt>留给你的问题</dt><dd>{reflection.question}</dd></div>
                </dl>
                <p className={styles.aiMeta}>AI 推断 · {reflection.model} · 引用 {reflection.evidenceMemoIds.length} 条已授权记录</p>
              </article>
            ) : null}
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>顺着共享证据去看看</h3>
            {node.connections.length > 0 ? (
              <div className={styles.connectionList}>
                {node.connections.map((connection) => {
                  const target = atlas.nodes.find((item) => item.id === connection.toNodeId);
                  return target ? (
                    <button
                      key={connection.toNodeId}
                      type="button"
                      className={styles.connectionButton}
                      onClick={() => onSelectNode(connection.toNodeId)}
                    >
                      <span>
                        <strong>{target.name}</strong>
                        <span>{connection.note}</span>
                      </span>
                      <ArrowRight size={14} />
                    </button>
                  ) : null;
                })}
              </div>
            ) : <p className={styles.emptyViz}>当前证据还没有与其他地点形成可靠交叉；可以直接从地图选择另一种视角。</p>}
          </section>
        </div>
      ) : null}
    </aside>
  );
});

export default ForestInsightPanel;
