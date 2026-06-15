'use client';

import { useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import type { Memo, SharedMemoryDraft, WorldObject, WorldObjectType } from '@/types';
import { placeObject } from '@/lib/game/world-state';

interface CoWritePanelProps {
  memos: Memo[];
  authorizedMemoIds: string[];
  onClose: () => void;
  onObjectPlaced: (object: WorldObject) => void;
  onJourneyEvent: (text: string, memoIds: string[]) => void;
}

type Step = 'material' | 'question' | 'write_one' | 'write_two' | 'reveal' | 'carrier' | 'confirm' | 'done';
type LayoutDecision = 'side_by_side' | 'intersect' | 'gap' | 'withdraw';

const QUESTIONS = [
  '你最记得哪个瞬间？',
  '当时有什么没有说出口？',
  '你希望以后怎样记得这件事？',
];

const CARRIERS: Array<{ type: WorldObjectType; name: string; meaning: string }> = [
  { type: 'bench', name: '长椅', meaning: '两种版本并存' },
  { type: 'sign', name: '双面路牌', meaning: '我们记得不一样' },
  { type: 'lamp', name: '灯笼', meaning: '共同确认的一句话' },
  { type: 'frame', name: '里程碑', meaning: '一段阶段性经历' },
  { type: 'bottle', name: '木箱', meaning: '暂时封存' },
];

export default function CoWritePanel({
  memos,
  authorizedMemoIds,
  onClose,
  onObjectPlaced,
  onJourneyEvent,
}: CoWritePanelProps) {
  const availableMemos = useMemo(
    () => memos.filter((memo) => authorizedMemoIds.includes(memo.id)),
    [authorizedMemoIds, memos],
  );
  const [step, setStep] = useState<Step>('material');
  const [memoId, setMemoId] = useState(availableMemos[0]?.id ?? '');
  const [question, setQuestion] = useState(QUESTIONS[0]);
  const [customQuestion, setCustomQuestion] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [draft, setDraft] = useState<SharedMemoryDraft | null>(null);
  const [playerOneText, setPlayerOneText] = useState('');
  const [playerTwoText, setPlayerTwoText] = useState('');
  const [decision, setDecision] = useState<LayoutDecision>('side_by_side');
  const [jointText, setJointText] = useState('');
  const [objectType, setObjectType] = useState<WorldObjectType>('bench');
  const [confirmOne, setConfirmOne] = useState(false);
  const [confirmTwo, setConfirmTwo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedMemo = availableMemos.find((memo) => memo.id === memoId);
  const finalQuestion = customQuestion.trim() || question;

  const startDraft = async () => {
    setError('');
    const response = await fetch('/api/game/cowrite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memoId }),
    });
    if (!response.ok) {
      setError('这次共同制作暂时无法开始。');
      return;
    }
    const data = await response.json() as { session: { id: string }; draft: SharedMemoryDraft };
    setSessionId(data.session.id);
    setDraft(data.draft);
    setStep('question');
  };

  const saveDraft = async (updates: Partial<SharedMemoryDraft>) => {
    if (!draft || !sessionId) return false;
    const response = await fetch('/api/game/cowrite', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draftId: draft.id, sessionId, updates }),
    });
    if (!response.ok) {
      setError('文字仍保留在当前页面，但暂时没有保存成功。');
      return false;
    }
    return true;
  };

  const finish = async () => {
    if (!confirmOne || !confirmTwo) return;
    setSaving(true);
    const saveDecision = decision === 'intersect' ? 'joint' : decision === 'withdraw' ? 'discard' : 'separate';
    const saved = await saveDraft({
      playerOneText,
      playerTwoText: decision === 'withdraw' ? undefined : playerTwoText,
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
          ? `你：${playerOneText}`
          : `你：${playerOneText}\n同行者：${playerTwoText}`,
      decision === 'gap' ? '我们记得不一样。' : '',
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
    onJourneyEvent(`在工坊放下了「${CARRIERS.find((carrier) => carrier.type === objectType)?.name}」`, [memoId]);
    setStep('done');
    setSaving(false);
  };

  return (
    <div className="game-focus-layer" role="dialog" aria-label="共居工坊">
      <section className="workshop-panel">
        <header>
          <div>
            <p className="game-kicker">共居工坊 · 双面工作台</p>
            <h2>让差异决定怎样存在</h2>
          </div>
          <button type="button" className="game-icon-button" onClick={onClose} aria-label="离开工坊"><X size={17} /></button>
        </header>

        <div className="workshop-progress">
          {['材料', '问题', '背对书写', '同时翻开', '选择载体', '共同放置'].map((label, index) => (
            <span key={label} className={index <= stepIndex(step) ? 'is-active' : ''}>{label}</span>
          ))}
        </div>

        {step === 'material' && (
          <div className="workshop-step">
            <p>从行囊中放上一段双方获准查看的记忆。</p>
            <div className="workshop-memory-list">
              {availableMemos.map((memo) => (
                <button key={memo.id} type="button" className={memoId === memo.id ? 'is-selected' : ''} onClick={() => setMemoId(memo.id)}>
                  <strong>{memo.ai_title || memo.plain_text.slice(0, 35) || '未命名记录'}</strong>
                  <small>{new Date(memo.created_at).toLocaleDateString('zh-CN')}</small>
                </button>
              ))}
              {availableMemos.length === 0 && <p>行囊里还没有可以放上工作台的记忆。</p>}
            </div>
            {selectedMemo && <blockquote>“{selectedMemo.plain_text.slice(0, 150)}”</blockquote>}
            {error && <p className="fireside-error">{error}</p>}
            <button type="button" className="workshop-primary" disabled={!memoId} onClick={() => void startDraft()}>放上工作台</button>
          </div>
        )}

        {step === 'question' && (
          <div className="workshop-step">
            <p>选择一个具体问题。双方也可以跳过预设，自己写。</p>
            <div className="workshop-question-list">
              {QUESTIONS.map((item) => (
                <button key={item} type="button" className={question === item && !customQuestion ? 'is-selected' : ''} onClick={() => { setQuestion(item); setCustomQuestion(''); }}>{item}</button>
              ))}
            </div>
            <input value={customQuestion} onChange={(event) => setCustomQuestion(event.target.value)} placeholder="或者写下你们自己的问题" />
            <button type="button" className="workshop-primary" onClick={() => setStep('write_one')}>开始背对书写</button>
          </div>
        )}

        {step === 'write_one' && (
          <WritingFace label="Player 1" question={finalQuestion} value={playerOneText} onChange={setPlayerOneText} onNext={async () => {
            if (await saveDraft({ playerOneText })) setStep('write_two');
          }} />
        )}

        {step === 'write_two' && (
          <WritingFace label="Player 2" question={finalQuestion} value={playerTwoText} onChange={setPlayerTwoText} onNext={async () => {
            if (await saveDraft({ playerTwoText })) setStep('reveal');
          }} />
        )}

        {step === 'reveal' && (
          <div className="workshop-step">
            <p>两块木牌同时翻开。系统不会替你们总结共识。</p>
            <div className={`workshop-boards decision-${decision}`}>
              <article><small>Player 1</small><p>{playerOneText}</p></article>
              <article><small>Player 2</small><p>{playerTwoText}</p></article>
            </div>
            <div className="workshop-decisions">
              <button type="button" className={decision === 'side_by_side' ? 'is-selected' : ''} onClick={() => setDecision('side_by_side')}>并排</button>
              <button type="button" className={decision === 'intersect' ? 'is-selected' : ''} onClick={() => setDecision('intersect')}>相交</button>
              <button type="button" className={decision === 'gap' ? 'is-selected' : ''} onClick={() => setDecision('gap')}>留缝</button>
              <button type="button" className={decision === 'withdraw' ? 'is-selected' : ''} onClick={() => setDecision('withdraw')}>收回一面</button>
            </div>
            {decision === 'intersect' && <textarea value={jointText} onChange={(event) => setJointText(event.target.value)} rows={3} placeholder="选择共同词，再共同确认一句话……" />}
            <button type="button" className="workshop-primary" disabled={decision === 'intersect' && !jointText.trim()} onClick={() => setStep('carrier')}>决定它以什么形式留下</button>
          </div>
        )}

        {step === 'carrier' && (
          <div className="workshop-step">
            <p>物件只表达保存方式，不代表关系质量。</p>
            <div className="workshop-carriers">
              {CARRIERS.map((carrier) => (
                <button key={carrier.name} type="button" className={objectType === carrier.type ? 'is-selected' : ''} onClick={() => setObjectType(carrier.type)}>
                  <strong>{carrier.name}</strong><span>{carrier.meaning}</span>
                </button>
              ))}
            </div>
            <button type="button" className="workshop-primary" onClick={() => setStep('confirm')}>搬到地图边缘</button>
          </div>
        )}

        {step === 'confirm' && (
          <div className="workshop-step workshop-confirm">
            <p>两个角色分别站在物件两侧。双方都确认后，物件才会进入世界。</p>
            <div>
              <button type="button" className={confirmOne ? 'is-confirmed' : ''} onClick={() => setConfirmOne((value) => !value)}>
                <Check size={18} /> Player 1 {confirmOne ? '已确认' : '站到左侧'}
              </button>
              <span>{CARRIERS.find((carrier) => carrier.type === objectType)?.name}</span>
              <button type="button" className={confirmTwo ? 'is-confirmed' : ''} onClick={() => setConfirmTwo((value) => !value)}>
                <Check size={18} /> Player 2 {confirmTwo ? '已确认' : '站到右侧'}
              </button>
            </div>
            {error && <p className="fireside-error">{error}</p>}
            <button type="button" className="workshop-primary" disabled={!confirmOne || !confirmTwo || saving} onClick={() => void finish()}>
              {saving ? '正在共同放置……' : '共同放置'}
            </button>
          </div>
        )}

        {step === 'done' && (
          <div className="workshop-step workshop-done">
            <Check size={28} />
            <h3>世界里多了一处可以回访的痕迹</h3>
            <p>靠近它，可以再次看到来源记忆和双方保留的文字。</p>
            <button type="button" className="workshop-primary" onClick={onClose}>回到地图</button>
          </div>
        )}
      </section>
    </div>
  );
}

function WritingFace({
  label,
  question,
  value,
  onChange,
  onNext,
}: {
  label: string;
  question: string;
  value: string;
  onChange: (value: string) => void;
  onNext: () => void | Promise<void>;
}) {
  return (
    <div className="workshop-step workshop-writing">
      <p className="game-kicker">现在只有 {label} 看得见这一面</p>
      <h3>{question}</h3>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={7} autoFocus placeholder="写下自己的版本。另一面现在仍然扣着。" />
      <button type="button" className="workshop-primary" disabled={!value.trim()} onClick={() => void onNext()}>扣好木牌，交给下一位</button>
    </div>
  );
}

function stepIndex(step: Step): number {
  const map: Record<Step, number> = {
    material: 0,
    question: 1,
    write_one: 2,
    write_two: 2,
    reveal: 3,
    carrier: 4,
    confirm: 5,
    done: 5,
  };
  return map[step];
}
