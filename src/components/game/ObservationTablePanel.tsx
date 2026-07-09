'use client';

import { useMemo, useState } from 'react';
import { Check, Circle, Clock3, Link2, X } from 'lucide-react';
import type { Memo, WorldObject } from '@/types';
import { placeObject } from '@/lib/game/world-state';

interface ObservationTablePanelProps {
  memos: Memo[];
  bagMemoIds: string[];
  onClose: () => void;
  onObjectPlaced: (object: WorldObject) => void;
  onJourneyEvent: (text: string, memoIds: string[]) => void;
}

type RelationChoice = 'related' | 'unrelated' | 'later';

const RELATION_CHOICES: Array<{
  id: RelationChoice;
  label: string;
  description: string;
}> = [
  { id: 'related', label: '有关', description: '它们像是在说同一件事' },
  { id: 'unrelated', label: '暂时无关', description: '先不强行连起来' },
  { id: 'later', label: '以后再看', description: '我还没有准备好判断' },
];

const RELATION_LABELS: Record<RelationChoice, string> = {
  related: '有关',
  unrelated: '暂时无关',
  later: '以后再看',
};

export default function ObservationTablePanel({
  memos,
  bagMemoIds,
  onClose,
  onObjectPlaced,
  onJourneyEvent,
}: ObservationTablePanelProps) {
  const carried = useMemo(() => (
    bagMemoIds
      .map((id) => memos.find((memo) => memo.id === id))
      .filter((memo): memo is Memo => Boolean(memo))
      .slice(0, 3)
  ), [bagMemoIds, memos]);
  const [relation, setRelation] = useState<RelationChoice>('related');
  const [opinion, setOpinion] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const signals = useMemo(() => collectSignals(carried), [carried]);
  const canSave = carried.length > 0 && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const fallbackText = relation === 'related'
      ? '我看见这些记忆之间可能有关系。'
      : relation === 'unrelated'
        ? '我决定今天不把它们连起来。'
        : '我把它们留到以后再看。';
    const text = opinion.trim() || fallbackText;
    const created = await placeObject({
      type: relation === 'related' ? 'frame' : relation === 'later' ? 'lamp' : 'sign',
      location: 'reflection_table',
      sourceMemoIds: carried.map((memo) => memo.id),
      annotation: text,
      userConfirmed: true,
      metadata: {
        kind: 'observation',
        relation,
        relationLabel: RELATION_LABELS[relation],
        topics: signals.topics,
        emotions: signals.emotions,
        questions: signals.questions,
      },
    });
    setSaving(false);
    if (!created) return;
    onObjectPlaced(created);
    onJourneyEvent(`在观照桌留下：${RELATION_LABELS[relation]}。${text}`, carried.map((memo) => memo.id));
    setSaved(true);
  };

  return (
    <div className="game-focus-layer game-focus-layer--soft" role="dialog" aria-label="观照桌">
      <section className="reflection-table-panel">
        <header>
          <div>
            <p className="game-kicker">观照桌 · 单人关系观察</p>
            <h2>这些记忆之间，今天看见了什么？</h2>
          </div>
          <button type="button" className="game-icon-button" onClick={onClose} aria-label="离开观照桌">
            <X size={17} />
          </button>
        </header>

        {carried.length === 0 ? (
          <div className="reflection-table-empty">
            <Circle size={22} />
            <h3>桌面现在是空的</h3>
            <p>先去记忆花园打开一段记录，选择“带在身上”。观照桌只看你本次亲手带来的 1-3 段记忆。</p>
            <button type="button" onClick={onClose}>回到地图</button>
          </div>
        ) : saved ? (
          <div className="reflection-table-saved">
            <Check size={24} />
            <h3>这句话已经放进亮灯木屋</h3>
            <p>它不是 AI 结论，只是你今天亲自确认过的看法。</p>
            <button type="button" onClick={onClose}>回到地图</button>
          </div>
        ) : (
          <>
            <div className="reflection-table-grid">
              <section className="reflection-table-memos">
                <p className="game-kicker">本次带入</p>
                {carried.map((memo) => (
                  <article key={memo.id}>
                    <small>{new Date(memo.created_at).toLocaleDateString('zh-CN')}</small>
                    <strong>{memo.ai_title || memo.plain_text.slice(0, 28) || '未命名记录'}</strong>
                    <p>{memo.plain_text.slice(0, 90)}{memo.plain_text.length > 90 ? '…' : ''}</p>
                  </article>
                ))}
              </section>

              <section className="reflection-table-signals">
                <p className="game-kicker">桌面线索</p>
                <SignalGroup title="重复主题" items={signals.topics} empty="没有明显重复主题" />
                <SignalGroup title="情绪痕迹" items={signals.emotions} empty="没有可读情绪标签" />
                <SignalGroup title="问题线索" items={signals.questions} empty="没有明确问题线索" />
              </section>
            </div>

            <section className="reflection-table-decision">
              <p className="game-kicker">你的判断</p>
              <div className="reflection-table-relation">
                {RELATION_CHOICES.map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    className={relation === choice.id ? 'is-selected' : ''}
                    onClick={() => setRelation(choice.id)}
                  >
                    {choice.id === 'related' ? <Link2 size={16} /> : choice.id === 'later' ? <Clock3 size={16} /> : <Circle size={16} />}
                    <strong>{choice.label}</strong>
                    <span>{choice.description}</span>
                  </button>
                ))}
              </div>
              <textarea
                value={opinion}
                onChange={(event) => setOpinion(event.target.value)}
                rows={4}
                placeholder="写下你愿意确认的一句话。也可以留空，只保存这次判断。"
              />
              <button type="button" className="reflection-table-primary" disabled={!canSave} onClick={() => void save()}>
                {saving ? '正在保存…' : '保存我的看法'}
              </button>
            </section>
          </>
        )}
      </section>
    </div>
  );
}

function SignalGroup({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="reflection-table-signal-group">
      <strong>{title}</strong>
      {items.length > 0 ? (
        <div>
          {items.map((item) => <span key={item}>{item}</span>)}
        </div>
      ) : (
        <small>{empty}</small>
      )}
    </div>
  );
}

function collectSignals(memos: Memo[]): { topics: string[]; emotions: string[]; questions: string[] } {
  const topicCounts = new Map<string, number>();
  const emotionCounts = new Map<string, number>();
  const questions: string[] = [];

  memos.forEach((memo) => {
    [...(memo.ai_topics ?? []), ...(memo.original_tags ?? [])].forEach((topic) => {
      const normalized = topic.trim();
      if (normalized) topicCounts.set(normalized, (topicCounts.get(normalized) ?? 0) + 1);
    });
    (memo.ai_emotions ?? []).forEach((emotion) => {
      const normalized = emotion.trim();
      if (normalized) emotionCounts.set(normalized, (emotionCounts.get(normalized) ?? 0) + 1);
    });
    (memo.ai_key_questions ?? []).forEach((question) => {
      const normalized = question.trim();
      if (normalized && !questions.includes(normalized)) questions.push(normalized);
    });
  });

  const rank = (map: Map<string, number>) => [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'))
    .map(([value]) => value)
    .slice(0, 5);

  return {
    topics: rank(topicCounts),
    emotions: rank(emotionCounts),
    questions: questions.slice(0, 4),
  };
}
