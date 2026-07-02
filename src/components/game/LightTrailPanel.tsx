'use client';

import { useMemo, useState } from 'react';
import { Check, GitBranch, MoveHorizontal } from 'lucide-react';
import type { Memo } from '@/types';
import {
  ForestSceneLayer,
  ForestScenePanel,
  SceneButton,
  SceneEmpty,
  SceneMemoCard,
  SceneProgress,
  SceneSection,
  formatMemoTitle,
} from './ForestScenePrimitives';

interface LightTrailPanelProps {
  memos: Memo[];
  suggested?: boolean;
  onConfirm: (name: string, memoIds: string[]) => void;
  onSeparate: (memoIds: string[]) => void;
  onClose: () => void;
}

type Step = 'select' | 'judge' | 'name' | 'done';
type Decision = 'pending' | 'related' | 'unrelated';

export default function LightTrailPanel({
  memos,
  suggested = false,
  onConfirm,
  onSeparate,
  onClose,
}: LightTrailPanelProps) {
  const suggestedMemos = useMemo(() => chooseTrailMemos(memos), [memos]);
  const [selectedIds, setSelectedIds] = useState(() => suggestedMemos.map((memo) => memo.id).slice(0, 3));
  const [step, setStep] = useState<Step>('select');
  const [decision, setDecision] = useState<Decision>('pending');
  const [name, setName] = useState('');
  const selectedMemos = useMemo(
    () => selectedIds.map((id) => memos.find((memo) => memo.id === id)).filter((memo): memo is Memo => Boolean(memo)),
    [memos, selectedIds],
  );
  const connection = useMemo(() => findConnection(selectedMemos), [selectedMemos]);

  const toggleMemo = (memoId: string) => {
    setSelectedIds((current) => {
      if (current.includes(memoId)) return current.filter((id) => id !== memoId);
      if (current.length >= 3) return current;
      return [...current, memoId];
    });
  };

  const confirmTrail = () => {
    onConfirm(name.trim() || '尚未命名的小径', selectedIds);
    setStep('done');
  };

  const progress = step === 'select' ? 0 : step === 'judge' ? 1 : step === 'name' ? 2 : 3;

  return (
    <ForestSceneLayer tone="trail" align="center" label="循光小径">
      <ForestScenePanel
        tone="trail"
        size="wide"
        kicker="循光小径 · 关系确认"
        title={suggested ? '苔灯只能提出候选，关系必须由你确认' : '看看这些纸条是不是同一条路'}
        subtitle="相似、高频、同一天出现，都不等于真正有关。这里的核心动作是确认或拆开。"
        onClose={onClose}
        footer={(
          <>
            <SceneButton variant="quiet" onClick={onClose}>离开小径</SceneButton>
            {step === 'select' && (
              <SceneButton variant="primary" disabled={selectedIds.length < 2} onClick={() => setStep('judge')}>
                看看是否同路
              </SceneButton>
            )}
            {step === 'name' && (
              <SceneButton variant="primary" onClick={confirmTrail}>
                <GitBranch size={15} />
                把这条路留下
              </SceneButton>
            )}
            {step === 'done' && <SceneButton variant="primary" onClick={onClose}>回到地图</SceneButton>}
          </>
        )}
      >
        <SceneProgress steps={['选纸条', '判断关系', '命名', '留下']} current={progress} />

        {memos.length < 2 ? (
          <SceneEmpty
            title="光路还没有形成"
            body="至少需要两段普通记录。这里不会凭空生成关系。"
            action={<SceneButton variant="primary" onClick={onClose}>回到花园</SceneButton>}
          />
        ) : step === 'select' ? (
          <SceneSection title="选择两到三段纸条" caption="最多三段。少一点，判断会更清楚。">
            <div className="forest-trail-picker">
              {memos.slice(0, 12).map((memo) => (
                <SceneMemoCard
                  key={memo.id}
                  memo={memo}
                  selected={selectedIds.includes(memo.id)}
                  disabled={!selectedIds.includes(memo.id) && selectedIds.length >= 3}
                  onClick={() => toggleMemo(memo.id)}
                  action={selectedIds.includes(memo.id) ? <Check size={14} /> : null}
                />
              ))}
            </div>
          </SceneSection>
        ) : (
          <>
            <div className={`forest-trail-board ${decision === 'unrelated' ? 'is-separated' : ''}`}>
              {selectedMemos.map((memo, index) => (
                <article key={memo.id} style={{ transform: `rotate(${[-1.1, 0.8, -0.4][index] ?? 0}deg)` }}>
                  <small>{formatMemoTitle(memo)}</small>
                  <blockquote>{memo.plain_text.replace(/\s+/g, ' ').slice(0, 132) || '这段记忆没有留下文字'}</blockquote>
                </article>
              ))}
              <span aria-hidden="true"><MoveHorizontal size={18} /></span>
            </div>

            {step === 'judge' && (
              <SceneSection title="你觉得它们像同一条路吗？" caption={connection}>
                <div className="forest-choice-row">
                  <SceneButton variant="primary" onClick={() => { setDecision('related'); setStep('name'); }}>
                    放在一起
                  </SceneButton>
                  <SceneButton
                    variant="secondary"
                    onClick={() => {
                      setDecision('unrelated');
                      onSeparate(selectedIds);
                      setStep('done');
                    }}
                  >
                    分开放回去
                  </SceneButton>
                </div>
              </SceneSection>
            )}

            {step === 'name' && (
              <SceneSection title="给确认过的关系命名" caption="名字只服务下次识别，不需要漂亮。">
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="例如：身体先知道、迟迟没拆小的事"
                />
              </SceneSection>
            )}

            {step === 'done' && (
              <SceneEmpty
                title={decision === 'unrelated' ? '光路已经散开' : '小径已经留下'}
                body={decision === 'unrelated'
                  ? '你拆开了一个看似相关的组合。这也是有效判断。'
                  : '下次回到木屋时，这条小径会作为旅程回声出现。'}
              />
            )}
          </>
        )}
      </ForestScenePanel>
    </ForestSceneLayer>
  );
}

function chooseTrailMemos(memos: Memo[]): Memo[] {
  if (memos.length <= 3) return memos;
  const scored = memos.map((memo, index) => ({
    memo,
    score: (memo.ai_summary ? 3 : 0)
      + (memo.ai_topics?.length ?? 0) * 2
      + (memo.ai_emotions?.length ?? 0)
      + Math.max(0, 3 - index),
  }));
  return scored.sort((a, b) => b.score - a.score).slice(0, 3).map((item) => item.memo);
}

function findConnection(memos: Memo[]): string {
  const tokens = new Map<string, number>();
  memos.forEach((memo) => {
    [...memo.original_tags, ...(memo.ai_topics ?? []), ...(memo.ai_people ?? []), ...(memo.ai_projects ?? [])].forEach((token) => {
      const normalized = token.trim();
      if (normalized) tokens.set(normalized, (tokens.get(normalized) ?? 0) + 1);
    });
  });
  const shared = [...tokens.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  if (shared) return `可见线索：这几段都碰到「${shared}」。这只是线索，不是结论。`;
  const summaries = memos.map((memo) => memo.ai_summary).filter(Boolean);
  if (summaries.length >= 2) return '可见线索：它们都像是在描述近期状态，但语义并不完全相同。';
  return '可见线索：它们被你同时带到这里。除此之外，还不能确定什么。';
}
