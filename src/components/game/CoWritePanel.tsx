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

type Step = 'material' | 'question' | 'write_now' | 'reveal' | 'carrier' | 'confirm' | 'done';
type LayoutDecision = 'side_by_side' | 'intersect' | 'gap' | 'withdraw';

const QUESTIONS = [
  '你最记得哪个瞬间？',
  '当时有什么没有说出口？',
  '你希望以后怎样记得这件事？',
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
  const availableMemos = useMemo(
    () => {
      const carried = memos.filter((memo) => authorizedMemoIds.includes(memo.id));
      return carried.length > 0 ? carried : memos.slice(0, 8);
    },
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
    setPlayerOneText(selectedMemo?.plain_text.replace(/\s+/g, ' ').slice(0, 300) ?? '');
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
          ? `过去的我：${playerOneText}`
          : `过去的我：${playerOneText}\n现在的我：${playerTwoText}`,
      decision === 'gap' ? '两个时间版本没有被强行合并。' : '',
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
    onJourneyEvent(`在工坊放下了一次今昔对照：${CARRIERS.find((carrier) => carrier.type === objectType)?.name}`, [memoId]);
    setStep('done');
    setSaving(false);
  };

  return (
    <div className="game-focus-layer game-focus-layer--workshop" role="dialog" aria-label="共居工坊">
      <section className="workshop-panel">
        <header>
          <div>
            <p className="game-kicker">共居工坊 · 今昔工作台</p>
            <h2>让过去的我和现在的我坐在一起</h2>
          </div>
          <button type="button" className="game-icon-button" onClick={onClose} aria-label="离开工坊"><X size={17} /></button>
        </header>

        <div className="workshop-progress">
          {['旧记录', '问题', '现在回应', '翻开对照', '选择载体', '放进世界'].map((label, index) => (
            <span key={label} className={index <= stepIndex(step) ? 'is-active' : ''}>{label}</span>
          ))}
        </div>

        {step === 'material' && (
          <div className="workshop-step">
            <p>选一条旧记录。它负责代表过去的你，不需要另一个人同屏参与。</p>
            <div className="workshop-memory-list">
              {availableMemos.map((memo) => (
                <button key={memo.id} type="button" className={memoId === memo.id ? 'is-selected' : ''} onClick={() => setMemoId(memo.id)}>
                  <strong>{memo.ai_title || memo.plain_text.slice(0, 35) || '未命名记录'}</strong>
                  <small>{new Date(memo.created_at).toLocaleDateString('zh-CN')}</small>
                </button>
              ))}
              {availableMemos.length === 0 && (
                <div className="workshop-empty-material">
                  <p>还没有可以放上工作台的记录。</p>
                  <small>先在 InnerOS 写下一段真实记录，再回来和过去的自己对照。</small>
                  <button type="button" onClick={onClose}>回到地图找材料</button>
                </div>
              )}
            </div>
            {selectedMemo && <blockquote>“{selectedMemo.plain_text.slice(0, 150)}”</blockquote>}
            {error && <p className="fireside-error">{error}</p>}
            <button type="button" className="workshop-primary" disabled={!memoId} onClick={() => void startDraft()}>放上工作台</button>
          </div>
        )}

        {step === 'question' && (
          <div className="workshop-step">
            <p>选一个问题，让现在的你回应过去那段记录。</p>
            <div className="workshop-question-list">
              {QUESTIONS.map((item) => (
                <button key={item} type="button" className={question === item && !customQuestion ? 'is-selected' : ''} onClick={() => { setQuestion(item); setCustomQuestion(''); }}>{item}</button>
              ))}
            </div>
            <input value={customQuestion} onChange={(event) => setCustomQuestion(event.target.value)} placeholder="或者写下你们自己的问题" />
            <button type="button" className="workshop-primary" onClick={() => setStep('write_now')}>现在回应</button>
          </div>
        )}

        {step === 'write_now' && (
          <WritingFace label="现在的我" question={finalQuestion} pastText={playerOneText} value={playerTwoText} onChange={setPlayerTwoText} onNext={async () => {
            if (await saveDraft({ playerTwoText })) setStep('reveal');
          }} />
        )}

        {step === 'reveal' && (
          <div className="workshop-step">
            <p>两块木牌同时翻开。系统不会替你总结哪个版本更正确。</p>
            <div className={`workshop-boards decision-${decision}`}>
              <article><small>过去的我</small><p>{playerOneText}</p></article>
              <article><small>现在的我</small><p>{playerTwoText}</p></article>
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
            <p>确认之后，它会成为地图里一处可以回访的时间痕迹。</p>
            <div>
              <span>{CARRIERS.find((carrier) => carrier.type === objectType)?.name}</span>
            </div>
            {error && <p className="fireside-error">{error}</p>}
            <button type="button" className="workshop-primary" disabled={saving} onClick={() => void finish()}>
              {saving ? '正在放置……' : '放进世界'}
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
  pastText,
  value,
  onChange,
  onNext,
}: {
  label: string;
  question: string;
  pastText: string;
  value: string;
  onChange: (value: string) => void;
  onNext: () => void | Promise<void>;
}) {
  return (
    <div className="workshop-step workshop-writing">
      <p className="game-kicker">{label}</p>
      <h3>{question}</h3>
      <blockquote>过去的我写过：{pastText}</blockquote>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={7} autoFocus placeholder="现在的你怎么回应同一个问题？" />
      <button type="button" className="workshop-primary" disabled={!value.trim()} onClick={() => void onNext()}>翻开对照</button>
    </div>
  );
}

function stepIndex(step: Step): number {
  const map: Record<Step, number> = {
    material: 0,
    question: 1,
    write_now: 2,
    reveal: 3,
    carrier: 4,
    confirm: 5,
    done: 5,
  };
  return map[step];
}
