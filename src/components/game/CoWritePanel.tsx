'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type {
  CompanionType,
  Memo,
  SharedMemoryDraft,
  WorldObject,
  WorldObjectType,
} from '@/types';
import { CO_OBJECT_TEMPLATES } from '@/lib/game/memo-mapper';
import { placeObject } from '@/lib/game/world-state';

interface CoWritePanelProps {
  companionType: CompanionType;
  memos: Memo[];
  authorizedMemoIds: string[];
  onClose: () => void;
  onObjectPlaced: (object: WorldObject) => void;
}

type Step = 'memory' | 'player_one' | 'player_two' | 'decision' | 'object' | 'done';

export default function CoWritePanel({
  companionType,
  memos,
  authorizedMemoIds,
  onClose,
  onObjectPlaced,
}: CoWritePanelProps) {
  const availableMemos = useMemo(
    () => companionType === 'human_local'
      ? memos.filter((memo) => authorizedMemoIds.includes(memo.id))
      : memos,
    [authorizedMemoIds, companionType, memos],
  );
  const [step, setStep] = useState<Step>('memory');
  const [memoId, setMemoId] = useState(availableMemos[0]?.id ?? '');
  const [sessionId, setSessionId] = useState('');
  const [draft, setDraft] = useState<SharedMemoryDraft | null>(null);
  const [playerOneText, setPlayerOneText] = useState('');
  const [playerTwoText, setPlayerTwoText] = useState('');
  const [jointText, setJointText] = useState('');
  const [decision, setDecision] = useState<'separate' | 'joint'>('separate');
  const [objectType, setObjectType] = useState<WorldObjectType>('bench');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedMemo = availableMemos.find((memo) => memo.id === memoId);
  const secondWriter = companionType === 'human_local' ? '身边的人' : '另一个视角';

  const startDraft = async () => {
    setError('');
    const response = await fetch('/api/game/cowrite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memoId: memoId || undefined }),
    });
    if (!response.ok) {
      setError('这次共写暂时无法开始。');
      return;
    }
    const data = await response.json() as {
      session: { id: string };
      draft: SharedMemoryDraft;
    };
    setSessionId(data.session.id);
    setDraft(data.draft);
    setStep('player_one');
  };

  const saveDraft = async (
    updates: Partial<Pick<
      SharedMemoryDraft,
      'playerOneText' | 'playerTwoText' | 'jointText' | 'saveDecision'
    >>,
  ) => {
    if (!draft || !sessionId) return false;
    const response = await fetch('/api/game/cowrite', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draftId: draft.id, sessionId, updates }),
    });
    if (!response.ok) {
      setError('文字还留在当前页面，但暂时没有保存成功。');
      return false;
    }
    const data = await response.json() as { draft: SharedMemoryDraft };
    setDraft(data.draft);
    return true;
  };

  const finish = async () => {
    if (!draft) return;
    setSaving(true);
    setError('');
    const saved = await saveDraft({
      playerOneText,
      playerTwoText,
      jointText: decision === 'joint' ? jointText : undefined,
      saveDecision: decision,
    });
    if (!saved) {
      setSaving(false);
      return;
    }
    const annotation = decision === 'joint'
      ? jointText.trim()
      : `你：${playerOneText.trim()}\n${secondWriter}：${playerTwoText.trim()}`;
    const object = await placeObject({
      type: objectType,
      location: 'workshop',
      sourceMemoIds: memoId ? [memoId] : [],
      sourceSessionId: sessionId,
      annotation,
      userConfirmed: true,
    });
    if (!object) {
      setError('共同文字已经保存，但物件暂时没能放进世界。');
      setSaving(false);
      return;
    }
    onObjectPlaced(object);
    setStep('done');
    setSaving(false);
  };

  const discardAndClose = async () => {
    const hasWriting = playerOneText.trim() || playerTwoText.trim() || jointText.trim();
    if (hasWriting && step !== 'done' && !window.confirm('这次还没有完成。确定放下当前共写并离开吗？')) {
      return;
    }
    if (draft && sessionId) {
      await saveDraft({ saveDecision: 'discard' });
    }
    onClose();
  };

  return (
    <div className="game-focus-layer" role="dialog" aria-label="共居工坊">
      <div className="cowrite-panel">
        <header>
          <div>
            <p className="game-kicker">共居工坊 · 一起留下</p>
            <h2>让两种记得并排存在</h2>
          </div>
          <button type="button" className="game-icon-button" onClick={() => void discardAndClose()} aria-label="离开工坊">
            <X size={17} />
          </button>
        </header>

        {step === 'memory' && (
          <section>
            <p className="cowrite-intro">
              先选择这次愿意共同看见的经历。未选择的记录不会进入本次共写。
            </p>
            <div className="cowrite-memory-list">
              {availableMemos.slice(0, 12).map((memo) => (
                <label key={memo.id} className={memoId === memo.id ? 'is-selected' : ''}>
                  <input
                    type="radio"
                    name="cowrite-memo"
                    value={memo.id}
                    checked={memoId === memo.id}
                    onChange={() => setMemoId(memo.id)}
                  />
                  <span>
                    <strong>{memo.ai_title || memo.plain_text.slice(0, 32) || '未命名记录'}</strong>
                    <small>{new Date(memo.created_at).toLocaleDateString('zh-CN')}</small>
                  </span>
                </label>
              ))}
              {availableMemos.length === 0 && (
                <div className="cowrite-empty">
                  <p>这次没有共享任何记录。</p>
                  <span>可以先回到世界，在角色选择时明确勾选愿意分享的内容。</span>
                </div>
              )}
            </div>
            {selectedMemo && <blockquote>{selectedMemo.plain_text.slice(0, 180)}</blockquote>}
            {error && <p className="fireside-error">{error}</p>}
            <button type="button" className="cowrite-primary" disabled={!memoId} onClick={() => void startDraft()}>
              共同走近这段经历
            </button>
          </section>
        )}

        {step === 'player_one' && (
          <WriteStep
            title="你最记得哪个具体瞬间？"
            label="你"
            value={playerOneText}
            onChange={setPlayerOneText}
            onNext={async () => {
              if (await saveDraft({ playerOneText })) setStep('player_two');
            }}
          />
        )}

        {step === 'player_two' && (
          <WriteStep
            title="有什么是当时没来得及说的？"
            label={secondWriter}
            value={playerTwoText}
            onChange={setPlayerTwoText}
            onNext={async () => {
              if (await saveDraft({ playerTwoText })) setStep('decision');
            }}
          />
        )}

        {step === 'decision' && (
          <section>
            <p className="cowrite-intro">你们不需要记得一样。</p>
            <div className="cowrite-two-voices">
              <article><span>你</span><p>{playerOneText}</p></article>
              <article><span>{secondWriter}</span><p>{playerTwoText}</p></article>
            </div>
            <div className="cowrite-decisions">
              <button type="button" className={decision === 'separate' ? 'is-selected' : ''} onClick={() => setDecision('separate')}>
                保留两种版本
              </button>
              <button type="button" className={decision === 'joint' ? 'is-selected' : ''} onClick={() => setDecision('joint')}>
                一起写一句
              </button>
            </div>
            {decision === 'joint' && (
              <textarea
                value={jointText}
                onChange={(event) => setJointText(event.target.value)}
                placeholder="这句话需要由你们共同确认……"
                rows={3}
              />
            )}
            <button
              type="button"
              className="cowrite-primary"
              disabled={decision === 'joint' && !jointText.trim()}
              onClick={() => setStep('object')}
            >
              选择留下的物件
            </button>
          </section>
        )}

        {step === 'object' && (
          <section>
            <p className="cowrite-intro">物件只是一处可回访的痕迹，不代表这段经历的价值。</p>
            <div className="cowrite-object-grid">
              {CO_OBJECT_TEMPLATES.map((template) => (
                <button
                  key={template.type}
                  type="button"
                  className={objectType === template.type ? 'is-selected' : ''}
                  onClick={() => setObjectType(template.type)}
                >
                  <strong>{template.name}</strong>
                  <span>{template.description}</span>
                </button>
              ))}
            </div>
            {error && <p className="fireside-error">{error}</p>}
            <button type="button" className="cowrite-primary" disabled={saving} onClick={() => void finish()}>
              {saving ? '正在放进世界……' : '确认放置'}
            </button>
          </section>
        )}

        {step === 'done' && (
          <section className="cowrite-done">
            <span>✦</span>
            <h3>世界里多了一处共同痕迹</h3>
            <p>它保留了两种视角，也能追溯到这次共同选择的记录。</p>
            <button type="button" className="cowrite-primary" onClick={onClose}>回到世界看看</button>
          </section>
        )}
      </div>
    </div>
  );
}

function WriteStep({
  title,
  label,
  value,
  onChange,
  onNext,
}: {
  title: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onNext: () => void | Promise<void>;
}) {
  return (
    <section>
      <p className="game-kicker">现在由 {label} 执笔</p>
      <h3 className="cowrite-question">{title}</h3>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="写下具体发生过的事，或当时真实的感受……"
        rows={6}
        autoFocus
      />
      <button type="button" className="cowrite-primary" disabled={!value.trim()} onClick={() => void onNext()}>
        交给下一位
      </button>
    </section>
  );
}
