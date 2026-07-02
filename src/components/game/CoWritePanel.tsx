'use client';

import { useMemo, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import type { Memo, SharedMemoryDraft, WorldObject, WorldObjectType } from '@/types';
import { placeObject } from '@/lib/game/world-state';
import {
  ForestSceneLayer,
  ForestScenePanel,
  SceneButton,
  SceneEmpty,
  SceneMemoCard,
  SceneProgress,
  SceneSection,
  formatMemoExcerpt,
} from './ForestScenePrimitives';

interface CoWritePanelProps {
  memos: Memo[];
  authorizedMemoIds: string[];
  onClose: () => void;
  onObjectPlaced: (object: WorldObject) => void;
  onJourneyEvent: (text: string, memoIds: string[]) => void;
}

type Step = 'material' | 'question' | 'write' | 'compare' | 'carrier' | 'done';
type LayoutDecision = 'side_by_side' | 'intersect' | 'gap' | 'withdraw';

const QUESTIONS = [
  '现在的我还同意这段话吗？',
  '当时有什么没有说出口？',
  '我希望以后怎样记得这件事？',
];

const CARRIERS: Array<{ type: WorldObjectType; name: string; meaning: string }> = [
  { type: 'bench', name: '长椅', meaning: '过去和现在并排坐着' },
  { type: 'sign', name: '双面路牌', meaning: '两个方向都是真的' },
  { type: 'lamp', name: '灯笼', meaning: '此刻愿意照亮的一句' },
  { type: 'frame', name: '里程碑', meaning: '承认一段阶段变化' },
  { type: 'bottle', name: '木箱', meaning: '暂时封存，不急着解释' },
];

export default function CoWritePanel({
  memos,
  authorizedMemoIds,
  onClose,
  onObjectPlaced,
  onJourneyEvent,
}: CoWritePanelProps) {
  const availableMemos = useMemo(() => {
    const carried = memos.filter((memo) => authorizedMemoIds.includes(memo.id));
    return carried.length > 0 ? carried : memos.slice(0, 10);
  }, [authorizedMemoIds, memos]);
  const [step, setStep] = useState<Step>('material');
  const [memoId, setMemoId] = useState(availableMemos[0]?.id ?? '');
  const [question, setQuestion] = useState(QUESTIONS[0]);
  const [customQuestion, setCustomQuestion] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [draft, setDraft] = useState<SharedMemoryDraft | null>(null);
  const [pastText, setPastText] = useState('');
  const [nowText, setNowText] = useState('');
  const [decision, setDecision] = useState<LayoutDecision>('side_by_side');
  const [jointText, setJointText] = useState('');
  const [objectType, setObjectType] = useState<WorldObjectType>('bench');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedMemo = availableMemos.find((memo) => memo.id === memoId);
  const finalQuestion = customQuestion.trim() || question;

  const startDraft = async () => {
    if (!memoId) return;
    setError('');
    try {
      const response = await fetch('/api/game/cowrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memoId }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error || '这次工作台暂时无法开始。');
      }
      const data = await response.json() as { session: { id: string }; draft: SharedMemoryDraft };
      setSessionId(data.session.id);
      setDraft(data.draft);
      setPastText(selectedMemo?.plain_text.replace(/\s+/g, ' ').slice(0, 420) ?? '');
      setStep('question');
    } catch (err) {
      setError(err instanceof Error ? err.message : '这次工作台暂时无法开始。');
    }
  };

  const saveDraft = async (updates: Partial<SharedMemoryDraft>) => {
    if (!draft || !sessionId) return false;
    try {
      const response = await fetch('/api/game/cowrite', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId: draft.id, sessionId, updates }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error || '文字仍保留在当前页面，但暂时没有保存成功。');
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : '文字仍保留在当前页面，但暂时没有保存成功。');
      return false;
    }
  };

  const finish = async () => {
    if (!memoId) return;
    setSaving(true);
    setError('');
    const saveDecision = decision === 'intersect' ? 'joint' : decision === 'withdraw' ? 'discard' : 'separate';
    const saved = await saveDraft({
      playerOneText: pastText,
      playerTwoText: decision === 'withdraw' ? undefined : nowText,
      jointText: decision === 'intersect' ? jointText : undefined,
      saveDecision,
    });
    if (!saved) {
      setSaving(false);
      return;
    }

    const annotation = [
      `问题：${finalQuestion}`,
      decision === 'intersect'
        ? `共同确认：${jointText}`
        : decision === 'withdraw'
          ? `过去的我：${pastText}`
          : `过去的我：${pastText}\n现在的我：${nowText}`,
      decision === 'gap' ? '两个时间版本没有被强行合并。' : '',
      `保存方式：${CARRIERS.find((carrier) => carrier.type === objectType)?.name}`,
    ].filter(Boolean).join('\n');

    const object = await placeObject({
      type: objectType,
      location: 'workshop',
      sourceMemoIds: [memoId],
      sourceSessionId: sessionId,
      annotation,
      userConfirmed: true,
    });
    if (!object) {
      setError('文字已经保存，但物件暂时没能放进世界。');
      setSaving(false);
      return;
    }
    onObjectPlaced(object);
    onJourneyEvent(`在工坊留下「${CARRIERS.find((carrier) => carrier.type === objectType)?.name}」`, [memoId]);
    setStep('done');
    setSaving(false);
  };

  return (
    <ForestSceneLayer tone="workshop" align="center" label="共居工坊">
      <ForestScenePanel
        tone="workshop"
        size="wide"
        kicker="共居工坊 · 今昔工作台"
        title="让过去的我和现在的我并排存在"
        subtitle="工坊不合成正确答案，只保存你亲自确认的关系形状。"
        onClose={onClose}
        footer={(
          <>
            <SceneButton variant="quiet" onClick={onClose}>离开工坊</SceneButton>
            {step === 'material' && <SceneButton variant="primary" disabled={!memoId} onClick={() => void startDraft()}>放上工作台</SceneButton>}
            {step === 'question' && <SceneButton variant="primary" onClick={() => setStep('write')}>现在回应</SceneButton>}
            {step === 'write' && <SceneButton variant="primary" disabled={!nowText.trim()} onClick={async () => { if (await saveDraft({ playerTwoText: nowText })) setStep('compare'); }}>翻开对照</SceneButton>}
            {step === 'compare' && <SceneButton variant="primary" disabled={decision === 'intersect' && !jointText.trim()} onClick={() => setStep('carrier')}>选择保存方式</SceneButton>}
            {step === 'carrier' && <SceneButton variant="primary" disabled={saving} onClick={() => void finish()}>{saving ? <Loader2 size={15} className="forest-spin" /> : null}放进世界</SceneButton>}
            {step === 'done' && <SceneButton variant="primary" onClick={onClose}>回到地图</SceneButton>}
          </>
        )}
      >
        <SceneProgress steps={['旧记录', '问题', '回应', '对照', '保存']} current={stepIndex(step)} />
        {error && <p className="forest-scene-error">{error}</p>}

        {step === 'material' && (
          <SceneSection title="选择一段旧记录" caption="它负责代表过去的你，不需要被 AI 重写。">
            {availableMemos.length > 0 ? (
              <div className="forest-memo-picker">
                {availableMemos.map((memo) => (
                  <SceneMemoCard
                    key={memo.id}
                    memo={memo}
                    selected={memoId === memo.id}
                    onClick={() => setMemoId(memo.id)}
                    action={memoId === memo.id ? <Check size={14} /> : null}
                  />
                ))}
              </div>
            ) : (
              <SceneEmpty
                title="还没有可以放上工作台的记录"
                body="先在 InnerOS 写下一段真实记录，再回来和过去的自己对照。"
              />
            )}
            {selectedMemo && <blockquote className="forest-past-quote">{formatMemoExcerpt(selectedMemo, 160)}</blockquote>}
          </SceneSection>
        )}

        {step === 'question' && (
          <SceneSection title="选一个问题" caption="问题越具体，今昔对照越清楚。">
            <div className="forest-mode-grid">
              {QUESTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={question === item && !customQuestion ? 'is-selected' : ''}
                  onClick={() => { setQuestion(item); setCustomQuestion(''); }}
                >
                  <strong>{item}</strong>
                </button>
              ))}
            </div>
            <input
              value={customQuestion}
              onChange={(event) => setCustomQuestion(event.target.value)}
              placeholder="或者写下你自己的问题"
            />
          </SceneSection>
        )}

        {step === 'write' && (
          <div className="forest-scene-split forest-workshop-write">
            <SceneSection title="过去的我" caption="只读，不改写。">
              <blockquote>{pastText}</blockquote>
            </SceneSection>
            <SceneSection title="现在的我" caption={finalQuestion}>
              <textarea
                value={nowText}
                onChange={(event) => setNowText(event.target.value)}
                rows={10}
                autoFocus
                placeholder="现在的你怎么回应同一个问题？"
              />
            </SceneSection>
          </div>
        )}

        {step === 'compare' && (
          <SceneSection title="选择它们的关系" caption="不用统一，也不用证明哪个版本更正确。">
            <div className={`forest-workshop-boards decision-${decision}`}>
              <article>
                <small>过去的我</small>
                <p>{pastText}</p>
              </article>
              {decision !== 'withdraw' && (
                <article>
                  <small>现在的我</small>
                  <p>{nowText}</p>
                </article>
              )}
            </div>
            <div className="forest-choice-row forest-choice-row--four">
              <SceneButton variant={decision === 'side_by_side' ? 'primary' : 'quiet'} onClick={() => setDecision('side_by_side')}>并排</SceneButton>
              <SceneButton variant={decision === 'intersect' ? 'primary' : 'quiet'} onClick={() => setDecision('intersect')}>相交</SceneButton>
              <SceneButton variant={decision === 'gap' ? 'primary' : 'quiet'} onClick={() => setDecision('gap')}>留缝</SceneButton>
              <SceneButton variant={decision === 'withdraw' ? 'primary' : 'quiet'} onClick={() => setDecision('withdraw')}>收回一面</SceneButton>
            </div>
            {decision === 'intersect' && (
              <textarea
                value={jointText}
                onChange={(event) => setJointText(event.target.value)}
                rows={4}
                placeholder="如果它们有共同词，请写成一句你愿意确认的话。"
              />
            )}
          </SceneSection>
        )}

        {step === 'carrier' && (
          <SceneSection title="选择一个地图物件" caption="物件只表达保存方式，不代表关系质量。">
            <div className="forest-carrier-grid">
              {CARRIERS.map((carrier) => (
                <button
                  key={carrier.name}
                  type="button"
                  className={objectType === carrier.type ? 'is-selected' : ''}
                  onClick={() => setObjectType(carrier.type)}
                >
                  <strong>{carrier.name}</strong>
                  <small>{carrier.meaning}</small>
                </button>
              ))}
            </div>
          </SceneSection>
        )}

        {step === 'done' && (
          <SceneEmpty
            title="世界里多了一处可以回访的痕迹"
            body="靠近它，可以再次看到来源记忆和你保留的今昔对照。"
            action={<Check size={26} />}
          />
        )}
      </ForestScenePanel>
    </ForestSceneLayer>
  );
}

function stepIndex(step: Step): number {
  const map: Record<Step, number> = {
    material: 0,
    question: 1,
    write: 2,
    compare: 3,
    carrier: 4,
    done: 4,
  };
  return map[step];
}
