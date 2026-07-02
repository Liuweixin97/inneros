'use client';

import { useMemo, useRef, useState } from 'react';
import { Check, Lamp, Pause, Send } from 'lucide-react';
import type { CompanionType, DialogueMode, GameWorld, Memo } from '@/types';
import {
  sendCompanionMessage,
  type CompanionMessage,
} from '@/lib/game/world-state';
import {
  ForestSceneLayer,
  ForestScenePanel,
  SceneButton,
  SceneEmpty,
  SceneMemoCard,
  SceneProgress,
  SceneSection,
  formatMemoExcerpt,
  formatMemoTitle,
} from './ForestScenePrimitives';

interface FiresideChatProps {
  world: GameWorld;
  memos: Memo[];
  authorizedMemoIds: string[];
  dialogueMode: DialogueMode;
  onDialogueModeChange: (mode: DialogueMode) => void;
  onAuthorizeMemos: (ids: string[]) => void;
  companionType: CompanionType;
  onCompanionTypeChange: (t: CompanionType) => void;
  onClose: () => void;
  onSaveJourneyEvent: (type: 'fireside_note' | 'left_question', text: string, memoIds: string[]) => void;
}

const MODES: Array<{ id: DialogueMode; label: string; description: string }> = [
  { id: 'listen', label: '听我说', description: '少问一点，先听你说完。' },
  { id: 'ask', label: '问我一点', description: '一次只问一个具体问题。' },
  { id: 'organize', label: '一起整理', description: '分开事实、判断和现在看法。' },
  { id: 'silent', label: '只陪我坐着', description: '可以不回应，也不要求留下什么。' },
];

const MAX_AUTHORIZED_MEMOS = 3;

type Step = 'material' | 'mode' | 'talk' | 'keep';

export default function FiresideChat({
  world,
  memos,
  authorizedMemoIds,
  dialogueMode,
  onDialogueModeChange,
  onAuthorizeMemos,
  companionType,
  onCompanionTypeChange,
  onClose,
  onSaveJourneyEvent,
}: FiresideChatProps) {
  const [step, setStep] = useState<Step>('material');
  const [messages, setMessages] = useState<CompanionMessage[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [localNote, setLocalNote] = useState('');
  const [keepText, setKeepText] = useState('');
  const [keepType, setKeepType] = useState<'fireside_note' | 'left_question'>('fireside_note');
  const [savedKeepText, setSavedKeepText] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const authorizedMemos = useMemo(
    () => memos.filter((memo) => authorizedMemoIds.includes(memo.id)),
    [authorizedMemoIds, memos],
  );
  const pickerMemos = useMemo(() => {
    const selected = memos.filter((memo) => authorizedMemoIds.includes(memo.id));
    const unselected = memos.filter((memo) => !authorizedMemoIds.includes(memo.id));
    return [...selected, ...unselected].slice(0, 12);
  }, [authorizedMemoIds, memos]);

  const toggleMemo = (memoId: string) => {
    const checked = authorizedMemoIds.includes(memoId);
    if (checked) {
      onAuthorizeMemos(authorizedMemoIds.filter((id) => id !== memoId));
      return;
    }
    if (authorizedMemoIds.length >= MAX_AUTHORIZED_MEMOS) return;
    onAuthorizeMemos([...authorizedMemoIds, memoId]);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    if (companionType !== 'llm') {
      setLocalNote(text);
      setKeepType('fireside_note');
      setKeepText(text);
      setInput('');
      setStep('keep');
      return;
    }

    setInput('');
    setError('');
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const userMessage: CompanionMessage = { role: 'user', content: text };
    setMessages((current) => [...current, userMessage, { role: 'assistant', content: '' }]);
    let streamed = '';

    const result = await sendCompanionMessage({
      message: text,
      worldId: world.id,
      sessionId: sessionId || undefined,
      location: 'fireside',
      dialogueMode,
      authorizedMemoIds,
      conversationHistory: messages,
      recentUserAction: authorizedMemos.length > 0
        ? `用户明确带来了 ${authorizedMemos.length} 段记录`
        : '用户没有带入记录，只在火边说此刻的事',
      signal: controller.signal,
      onChunk: (chunk) => {
        streamed += chunk;
        setMessages((current) => current.map((message, index) => (
          index === current.length - 1 ? { ...message, content: streamed } : message
        )));
      },
    });

    if (result) {
      setSessionId(result.sessionId);
      setMessages((current) => current.map((message, index) => (
        index === current.length - 1 ? result.message : message
      )));
    } else {
      setMessages((current) => current.slice(0, -1));
      if (!controller.signal.aborted) {
        setError('苔灯暂时说不了话。你写下的内容没有丢，可以改为本地纸条。');
      }
    }
    setLoading(false);
    abortRef.current = null;
  };

  const close = () => {
    abortRef.current?.abort();
    onClose();
  };

  const saveKeep = () => {
    const text = keepText.trim();
    if (!text) return;
    onSaveJourneyEvent(keepType, text, authorizedMemoIds);
    setSavedKeepText(text);
    setKeepText('');
  };

  const progress = step === 'material' ? 0 : step === 'mode' ? 1 : step === 'talk' ? 2 : 3;
  const materialLabel = authorizedMemos.length > 0
    ? `已带入 ${authorizedMemos.length} 段记忆`
    : '没有带材料，也可以直接说此刻';
  const companionLabel = companionType === 'llm'
    ? '苔灯只看见本次带入的材料'
    : '当前不会请求 AI';

  return (
    <ForestSceneLayer tone="fire" align="end" label="篝火地">
      <ForestScenePanel
        tone="fire"
        size="wide"
        kicker="篝火地 · 放清楚"
        title="把一段材料和此刻的说法放到同一张纸上"
        subtitle={`${materialLabel}。${companionLabel}。`}
        onClose={close}
        footer={(
          <>
            <SceneButton variant="quiet" onClick={close}>离开火边</SceneButton>
            {step === 'material' && <SceneButton variant="primary" onClick={() => setStep('mode')}>确定材料</SceneButton>}
            {step === 'mode' && <SceneButton variant="primary" onClick={() => setStep('talk')}>坐到火边</SceneButton>}
            {step === 'talk' && <SceneButton variant="secondary" onClick={() => setStep('keep')}>收束一句</SceneButton>}
            {step === 'keep' && <SceneButton variant="primary" onClick={close}>回到地图</SceneButton>}
          </>
        )}
      >
        <SceneProgress steps={['材料', '谈法', '对话', '收束']} current={progress} />

        {step === 'material' && (
          <SceneSection title="选择本次愿意谈到的记忆" caption={`最多 ${MAX_AUTHORIZED_MEMOS} 段。苔灯不会看到未选择的记录。`}>
            {pickerMemos.length > 0 ? (
              <div className="forest-memo-picker">
                {pickerMemos.map((memo) => {
                  const selected = authorizedMemoIds.includes(memo.id);
                  const disabled = !selected && authorizedMemoIds.length >= MAX_AUTHORIZED_MEMOS;
                  return (
                    <SceneMemoCard
                      key={memo.id}
                      memo={memo}
                      selected={selected}
                      disabled={disabled}
                      onClick={() => toggleMemo(memo.id)}
                      action={selected ? <Check size={14} /> : null}
                    />
                  );
                })}
              </div>
            ) : (
              <SceneEmpty
                title="还没有可带来的记录"
                body="可以不带材料坐下。火边会只处理你此刻写下的话。"
              />
            )}
          </SceneSection>
        )}

        {step === 'mode' && (
          <div className="forest-scene-split">
            <SceneSection title="选择今晚的火候" caption="选择影响苔灯回应方式，不影响记录权限。">
              <div className="forest-mode-grid">
                {MODES.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    className={dialogueMode === mode.id ? 'is-selected' : ''}
                    onClick={() => onDialogueModeChange(mode.id)}
                  >
                    <strong>{mode.label}</strong>
                    <small>{mode.description}</small>
                  </button>
                ))}
              </div>
            </SceneSection>
            <SceneSection title="是否邀请苔灯" caption="不邀请时，所有输入只保存成本次旅程回声。">
              <div className="forest-lantern-toggle">
                <Lamp size={24} />
                <span>
                  <strong>{companionType === 'llm' ? '苔灯在火边' : '苔灯在远处'}</strong>
                  <small>{companionLabel}</small>
                </span>
                <SceneButton
                  variant={companionType === 'llm' ? 'secondary' : 'primary'}
                  onClick={() => onCompanionTypeChange(companionType === 'llm' ? 'none' : 'llm')}
                >
                  {companionType === 'llm' ? '遣散' : '邀请'}
                </SceneButton>
              </div>
              {authorizedMemos.length > 0 && (
                <div className="forest-material-chips">
                  {authorizedMemos.map((memo) => <span key={memo.id}>{formatMemoTitle(memo)}</span>)}
                </div>
              )}
            </SceneSection>
          </div>
        )}

        {step === 'talk' && (
          <div className="forest-fire-talk">
            <SceneSection title="材料在左边" caption="对话只围绕这些材料，或只围绕你此刻写下的话。">
              {authorizedMemos.length > 0 ? (
                <div className="forest-material-stack">
                  {authorizedMemos.map((memo) => (
                    <article key={memo.id}>
                      <strong>{formatMemoTitle(memo)}</strong>
                      <p>{formatMemoExcerpt(memo, 90)}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <SceneEmpty title="没有带入材料" body="这会是一场只关于此刻的火边记录。" />
              )}
            </SceneSection>

            <SceneSection title={companionType === 'llm' ? '火边对话' : '本地纸条'} caption={companionType === 'llm' ? 'Enter 发送，Shift+Enter 换行。' : '不会请求 AI，会直接留下为火边纸条。'}>
              {companionType === 'llm' ? (
                <div className="forest-message-list" aria-live="polite">
                  {messages.length === 0 ? (
                    <p>
                      {dialogueMode === 'organize'
                        ? '可以从一件具体发生过的事开始。'
                        : dialogueMode === 'silent'
                          ? '火还亮着。想说时再说。'
                          : '你可以从刚刚遇见的那段记忆开始。'}
                    </p>
                  ) : messages.map((message, index) => (
                    <article key={`${message.role}-${index}`} className={message.role === 'user' ? 'is-user' : ''}>
                      <small>{message.role === 'user' ? '你' : '苔灯'}</small>
                      <p>{message.content || (loading ? '...' : '')}</p>
                      {message.isInference && <em>这是苔灯的推测，不是原记录中的事实。</em>}
                    </article>
                  ))}
                </div>
              ) : (
                <textarea
                  value={localNote}
                  onChange={(event) => setLocalNote(event.target.value)}
                  rows={9}
                  placeholder="只写下你愿意确认的一句话。"
                />
              )}

              {companionType === 'llm' ? (
                <footer className="forest-composer">
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    rows={2}
                    placeholder="在火边说一点..."
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void send();
                      }
                    }}
                  />
                  {loading ? (
                    <button type="button" onClick={() => abortRef.current?.abort()} aria-label="停止回应">
                      <Pause size={16} />
                    </button>
                  ) : (
                    <button type="button" onClick={() => void send()} disabled={!input.trim()} aria-label="发送">
                      <Send size={16} />
                    </button>
                  )}
                </footer>
              ) : (
                <div className="forest-inline-actions">
                  <SceneButton
                    variant="primary"
                    disabled={!localNote.trim()}
                    onClick={() => {
                      setKeepType('fireside_note');
                      setKeepText(localNote.trim());
                      setLocalNote('');
                      setStep('keep');
                    }}
                  >
                    带去收束
                  </SceneButton>
                  <SceneButton variant="secondary" onClick={() => onCompanionTypeChange('llm')}>邀请苔灯回应</SceneButton>
                </div>
              )}
              {error && <p className="forest-scene-error">{error}</p>}
            </SceneSection>
          </div>
        )}

        {step === 'keep' && (
          <div className="forest-scene-split">
            <SceneSection title="离开前留下一句" caption="这会成为本次旅程回声，不覆盖原记录。">
              <div className="forest-choice-row">
                <SceneButton variant={keepType === 'fireside_note' ? 'primary' : 'quiet'} onClick={() => setKeepType('fireside_note')}>一句话</SceneButton>
                <SceneButton variant={keepType === 'left_question' ? 'primary' : 'quiet'} onClick={() => setKeepType('left_question')}>一个问题</SceneButton>
              </div>
              <textarea
                value={keepText}
                onChange={(event) => setKeepText(event.target.value)}
                rows={7}
                placeholder={keepType === 'left_question' ? '把还没有回答的问题折成纸鸟...' : '只写下你愿意确认的一句话...'}
              />
              <div className="forest-inline-actions">
                <SceneButton variant="primary" disabled={!keepText.trim()} onClick={saveKeep}>留在火边</SceneButton>
              </div>
              {savedKeepText && <p className="forest-scene-success">已留下：{savedKeepText}</p>}
            </SceneSection>
            <SceneSection title="本场边界" caption="火边不替你判断人生，只保存你确认过的说法。">
              <ul className="forest-boundary-list">
                <li>带入材料最多三段。</li>
                <li>苔灯回应会标记推测，不作为事实。</li>
                <li>真正写回长期记录，请去中庭写作台。</li>
              </ul>
            </SceneSection>
          </div>
        )}
      </ForestScenePanel>
    </ForestSceneLayer>
  );
}
