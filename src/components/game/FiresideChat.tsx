'use client';

import { useMemo, useRef, useState } from 'react';
import { BookOpen, Check, ChevronDown, Pause, Send, X } from 'lucide-react';
import type { CompanionType, DialogueMode, GameWorld, Memo } from '@/types';
import {
  sendCompanionMessage,
  type CompanionMessage,
} from '@/lib/game/world-state';
import FireRings from './FireRings';

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
  { id: 'listen', label: '听我说', description: '少问一点，先听你说完' },
  { id: 'ask', label: '问我一点', description: '一次只问一个具体问题' },
  { id: 'organize', label: '一起整理', description: '分开事实、当时判断与现在看法' },
  { id: 'silent', label: '只陪我坐着', description: '不追问，也不要求留下什么' },
];

const MAX_AUTHORIZED_MEMOS = 5;

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
  const [messages, setMessages] = useState<CompanionMessage[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showMemoryPicker, setShowMemoryPicker] = useState(false);
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
    setInput('');
    setError('');
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const userMessage: CompanionMessage = { role: 'user', content: text };
    const history = [...messages, userMessage];
    setMessages(history);
    let streamed = '';
    setMessages((current) => [...current, { role: 'assistant', content: '' }]);

    const result = await sendCompanionMessage({
      message: text,
      worldId: world.id,
      sessionId: sessionId || undefined,
      location: 'fireside',
      dialogueMode,
      authorizedMemoIds,
      conversationHistory: messages,
      recentUserAction: authorizedMemos.length > 0
        ? `带来了 ${authorizedMemos.length} 段自己选择的记录`
        : '在篝火边坐下',
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
        setError('同行者现在听得见，但暂时说不了话。你写下的内容仍留在这里。');
      }
    }
    setLoading(false);
    abortRef.current = null;
  };

  const close = () => {
    abortRef.current?.abort();
    onClose();
  };

  return (
    <div className="game-focus-layer" role="dialog" aria-label="篝火对话">
      <div className="fireside-panel">
        <header className="fireside-header">
          <div>
            <p className="game-kicker">篝火地 · 一起说</p>
            <h2>同行者坐在火光的另一边</h2>
          </div>
          <div className="flex items-center gap-2">
            {/* 邀请 / 结束 AI 同行者 */}
            <button
              type="button"
              className="game-hud-btn text-[11px] px-2 py-1"
              style={{
                background: companionType === 'llm'
                  ? 'rgba(255,155,61,0.2)'
                  : 'rgba(255,243,196,0.08)',
                borderColor: companionType === 'llm'
                  ? 'rgba(255,155,61,0.5)'
                  : 'rgba(255,243,196,0.15)',
                color: companionType === 'llm' ? '#FF9B3D' : 'var(--game-hud-muted)',
              }}
              onClick={() => onCompanionTypeChange(companionType === 'llm' ? 'none' : 'llm')}
              title={companionType === 'llm' ? '结束 AI 同行，独自漫游' : '邀请 AI 同行者'}
            >
              {companionType === 'llm' ? '✦ AI 同行中' : '+ 邀请同行'}
            </button>
            <button type="button" className="game-icon-button" onClick={close} aria-label="离开篝火">
              <X size={17} />
            </button>
          </div>
        </header>

        <div className="fireside-modes" aria-label="选择对话方式">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={dialogueMode === mode.id ? 'is-active' : ''}
              onClick={() => onDialogueModeChange(mode.id)}
              title={mode.description}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <section className={`fireside-memory-context ${showMemoryPicker ? 'is-open' : ''}`}>
          <button
            type="button"
            className="fireside-memory-summary"
            aria-expanded={showMemoryPicker}
            onClick={() => setShowMemoryPicker((value) => !value)}
          >
            <span className="fireside-memory-summary__icon" aria-hidden="true">
              <BookOpen size={15} />
            </span>
            <span className="fireside-memory-summary__copy">
              <strong>
                {authorizedMemos.length > 0
                  ? `已带入 ${authorizedMemos.length} 段记忆`
                  : '带一段记忆到火边'}
              </strong>
              <small>
                {authorizedMemos.length > 0
                  ? '同行者只会看到你本次选择的内容'
                  : '可选。也可以不带记录，直接说此刻的事'}
              </small>
            </span>
            <span className="fireside-memory-summary__action">
              {authorizedMemos.length > 0 ? '调整' : '选择'}
              <ChevronDown size={14} aria-hidden="true" />
            </span>
          </button>

          {!showMemoryPicker && authorizedMemos.length > 0 && (
            <div className="fireside-memory-chips" aria-label="本次带入的记忆">
              {authorizedMemos.map((memo) => (
                <span key={memo.id}>{memo.ai_title || memo.plain_text.slice(0, 20) || '未命名记录'}</span>
              ))}
            </div>
          )}

          {showMemoryPicker && (
            <div className="fireside-memory-picker">
              <div className="fireside-memory-picker__header">
                <div>
                  <strong>选择本次愿意谈到的记忆</strong>
                  <small>最多 {MAX_AUTHORIZED_MEMOS} 段，仅用于本次篝火对话</small>
                </div>
                <span>{authorizedMemoIds.length} / {MAX_AUTHORIZED_MEMOS}</span>
              </div>

              <div className="fireside-memory-picker__list">
                {pickerMemos.map((memo) => {
                  const checked = authorizedMemoIds.includes(memo.id);
                  const disabled = !checked && authorizedMemoIds.length >= MAX_AUTHORIZED_MEMOS;
                  return (
                    <label key={memo.id} className={`${checked ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleMemo(memo.id)}
                      />
                      <span className="fireside-memory-check" aria-hidden="true">
                        {checked && <Check size={13} />}
                      </span>
                      <span className="fireside-memory-copy">
                        <strong>{memo.ai_title || memo.plain_text.slice(0, 28) || '未命名记录'}</strong>
                        <small>
                          {new Date(memo.created_at).toLocaleDateString('zh-CN')}
                          {memo.plain_text ? ` · ${memo.plain_text.slice(0, 42)}` : ''}
                        </small>
                      </span>
                    </label>
                  );
                })}
                {memos.length === 0 && <p>这里还没有可带到火边的记录。</p>}
              </div>

              <div className="fireside-memory-picker__footer">
                {authorizedMemoIds.length > 0 ? (
                  <button type="button" onClick={() => onAuthorizeMemos([])}>
                    清空选择
                  </button>
                ) : <span />}
                <button type="button" className="is-primary" onClick={() => setShowMemoryPicker(false)}>
                  {authorizedMemoIds.length > 0 ? '带到火边' : '不带记录，直接开始'}
                </button>
              </div>
            </div>
          )}
        </section>

        {!showMemoryPicker && (
          <>
            {dialogueMode === 'organize' && authorizedMemos.length > 0 ? (
              <FireRings
                memos={authorizedMemos}
                onSave={(text, memoIds) => onSaveJourneyEvent('fireside_note', text, memoIds)}
              />
            ) : (
            <>
            <div className="fireside-messages" aria-live="polite">
              {messages.length === 0 ? (
                <div className="fireside-empty">
                  <p>
                    {dialogueMode === 'silent'
                      ? '火焰轻轻响着。你不需要先说什么。'
                      : '你可以从刚刚遇见的那段记忆开始，也可以只说此刻想到的事。'}
                  </p>
                </div>
              ) : messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`fireside-message ${message.role}`}>
                  <span>{message.role === 'user' ? '你' : '同行者'}</span>
                  <p>{message.content || (loading ? '……' : '')}</p>
                  {message.isInference && <small>这是同行者的推测，不是原记录中的事实。</small>}
                </div>
              ))}
              {error && <p className="fireside-error">{error}</p>}
            </div>

            <footer className="fireside-composer">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={dialogueMode === 'silent' ? '想说时再写……' : '在火边说一点……'}
                rows={2}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
              />
              {loading ? (
                <button type="button" onClick={() => abortRef.current?.abort()} aria-label="停止回应">
                  <Pause size={17} />
                </button>
              ) : (
                <button type="button" onClick={() => void send()} disabled={!input.trim()} aria-label="发送">
                  <Send size={17} />
                </button>
              )}
            </footer>
            </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
