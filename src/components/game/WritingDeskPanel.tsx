'use client';

import { useMemo, useState } from 'react';
import { FilePlus2, Loader2 } from 'lucide-react';
import type { JourneyEvent, Memo } from '@/types';
import {
  ForestSceneLayer,
  ForestScenePanel,
  SceneButton,
  SceneEmpty,
  SceneSection,
  formatMemoExcerpt,
  formatMemoTitle,
} from './ForestScenePrimitives';

interface WritingDeskPanelProps {
  memos: Memo[];
  bagMemoIds: string[];
  events: JourneyEvent[];
  onMemoCreated: (memo: Memo) => void;
  onJourneyEvent: (text: string, memoIds: string[]) => void;
  onClose: () => void;
}

export default function WritingDeskPanel({
  memos,
  bagMemoIds,
  events,
  onMemoCreated,
  onJourneyEvent,
  onClose,
}: WritingDeskPanelProps) {
  const carried = useMemo(
    () => bagMemoIds.map((id) => memos.find((memo) => memo.id === id)).filter((memo): memo is Memo => Boolean(memo)),
    [bagMemoIds, memos],
  );
  const recentEvent = [...events].reverse()[0] ?? null;
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    const text = content.trim();
    if (!text || saving) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/memos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text,
          tags: ['InnerOS/林间世界'],
          source: 'manual',
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error || '这张纸暂时没有写进 InnerOS。');
      }
      const memo = await response.json() as Memo;
      onMemoCreated(memo);
      onJourneyEvent('在中庭写作台写下一段新的林间记录', [memo.id, ...carried.map((item) => item.id)]);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '这张纸暂时没有写进 InnerOS。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ForestSceneLayer tone="desk" align="center" label="中庭写作台">
      <ForestScenePanel
        tone="desk"
        size="lg"
        kicker="中庭写作台 · 写回现实"
        title="把刚刚看见的东西写成一条真实记录"
        subtitle="写作台不是 AI 总结器。它只把你愿意承认的一句话带回 InnerOS。"
        onClose={onClose}
        footer={(
          <>
            <SceneButton variant="quiet" onClick={onClose}>先不写</SceneButton>
            <SceneButton variant="primary" disabled={!content.trim() || saving || saved} onClick={() => void save()}>
              {saving ? <Loader2 size={15} className="forest-spin" /> : <FilePlus2 size={15} />}
              {saved ? '已写入 InnerOS' : '写成一条记录'}
            </SceneButton>
          </>
        )}
      >
        <div className="forest-scene-split forest-scene-split--desk">
          <SceneSection title="桌上的材料" caption="这些只是提醒，不会自动写进正文。">
            {carried.length > 0 ? (
              <div className="forest-desk-materials">
                {carried.map((memo) => (
                  <article key={memo.id}>
                    <strong>{formatMemoTitle(memo)}</strong>
                    <p>{formatMemoExcerpt(memo, 90)}</p>
                  </article>
                ))}
              </div>
            ) : (
              <SceneEmpty
                title="行囊里还没有材料"
                body="也可以直接写此刻的感受。写作台不要求你先完成任何任务。"
              />
            )}
            {recentEvent && (
              <blockquote className="forest-desk-event">
                <small>刚刚的旅程回声</small>
                {recentEvent.text}
              </blockquote>
            )}
          </SceneSection>

          <SceneSection title="今天确认的一句话" caption="这会成为一条新的 Memo，并进入正常 AI 分析队列。">
            <textarea
              value={content}
              onChange={(event) => {
                setContent(event.target.value);
                setSaved(false);
              }}
              rows={11}
              placeholder="例如：我发现这段记忆现在并不是要我立刻解决什么，而是提醒我先承认自己还在意。"
              autoFocus
            />
            {error && <p className="forest-scene-error">{error}</p>}
            {saved && <p className="forest-scene-success">已经写进 InnerOS。稍后它会和普通记录一样进入分析与花园映射。</p>}
          </SceneSection>
        </div>
      </ForestScenePanel>
    </ForestSceneLayer>
  );
}
