'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Check, ChevronDown, Pause, Send, X } from 'lucide-react';
import type { CompanionType, DialogueMode, GameWorld, Memo } from '@/types';
import {
  sendCompanionMessage,
  type CompanionMessage,
} from '@/lib/game/world-state';

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

const MAX_AUTHORIZED_MEMOS = 3;

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
  const [ending, setEnding] = useState(false);
  const [endingText, setEndingText] = useState('');
  const [endingType, setEndingType] = useState<'fireside_note' | 'left_question' | 'nothing'>('nothing');
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevModeRef = useRef(dialogueMode);

  const authorizedMemos = useMemo(
    () => memos.filter((memo) => authorizedMemoIds.includes(memo.id)),
    [authorizedMemoIds, memos],
  );
  const pickerMemos = useMemo(() => {
    const selected = memos.filter((memo) => authorizedMemoIds.includes(memo.id));
    const unselected = memos.filter((memo) => !authorizedMemoIds.includes(memo.id));
    return [...selected, ...unselected].slice(0, 12);
  }, [authorizedMemoIds, memos]);

  // 自动邀请苔灯
  useEffect(() => {
    if (companionType !== 'llm') {
      onCompanionTypeChange('llm');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 新消息时自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 对话模式切换时追加系统提示
  useEffect(() => {
    if (prevModeRef.current !== dialogueMode && messages.length > 0) {
      const modeLabel = MODES.find((m) => m.id === dialogueMode)?.label ?? dialogueMode;
      setMessages((current) => [
        ...current,
        {
          role: 'assistant' as const,
          content: `（切换到「${modeLabel}」模式）`,
          isInference: false,
        },
      ]);
    }
    prevModeRef.current = dialogueMode;
  }, [dialogueMode, messages.length]);

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
    if (authorizedMemoIds.length < 1) {
      setError('请先选择 1-3 段本次愿意带入的记忆。');
      setShowMemoryPicker(true);
      return;
    }
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
        : '在苔灯火边坐下',
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
        setError('苔灯现在听得见，但暂时说不了话。你写下的内容仍留在这里。');
      }
    }
    setLoading(false);
    abortRef.current = null;
  };

  const close = () => {
    abortRef.current?.abort();
    if (messages.length > 0 && !ending) {
      setEnding(true);
      return;
    }
    onClose();
  };

  const hasMemories = authorizedMemoIds.length > 0;
  const isReady = hasMemories;

  return (
    <div className="game-focus-layer" role="dialog" aria-label="苔灯火边">
      <div className="fireside-panel">
        <header className="fireside-header">
          <div>
            <p className="game-kicker">苔灯火边 · 仅基于你本次带入的记忆</p>
            <h2>苔灯在火光的另一边亮着</h2>
          </div>
          <div className="flex items-center gap-2">
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
                  : '先带一段记忆到火边'}
              </strong>
              <small>
                {authorizedMemos.length > 0
                  ? '苔灯只会看到你本次选择的内容'
                  : '火边不会读取你没有明确带入的记录'}
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
                  {authorizedMemoIds.length > 0 ? '带到火边' : '先回去选择'}
                </button>
              </div>
            </div>
          )}
        </section>

        <div className="fireside-body">
          {ending ? (
            <section className="fireside-ending">
              <p>离开前，可以留下一句话、一个问题，或什么也不留下。</p>
              <div>
                <button type="button" className={endingType === 'fireside_note' ? 'is-selected' : ''} onClick={() => setEndingType('fireside_note')}>留下一句话</button>
                <button type="button" className={endingType === 'left_question' ? 'is-selected' : ''} onClick={() => setEndingType('left_question')}>留下一个问题</button>
                <button type="button" className={endingType === 'nothing' ? 'is-selected' : ''} onClick={() => setEndingType('nothing')}>什么也不留下</button>
              </div>
              {endingType !== 'nothing' && (
                <textarea value={endingText} onChange={(event) => setEndingText(event.target.value)} rows={4} placeholder={endingType === 'left_question' ? '把还没有回答的问题折成纸鸟……' : '只写下你愿意确认的一句话……'} />
              )}
              <button
                type="button"
                className="fireside-ending__leave"
                disabled={endingType !== 'nothing' && !endingText.trim()}
                onClick={() => {
                  if (endingType !== 'nothing') {
                    onSaveJourneyEvent(endingType, endingText.trim(), authorizedMemoIds);
                  }
                  onClose();
                }}
              >
                离开火边
              </button>
            </section>
          ) : !showMemoryPicker && (
            <>
              <div className="fireside-messages" aria-live="polite">
                {messages.length === 0 ? (
                  <div className="fireside-empty">
                    {!isReady ? (
                      <div className="fireside-guide-steps">
                        <div
                          className={`fireside-guide-step ${hasMemories ? 'is-done' : ''}`}
                          onClick={() => setShowMemoryPicker(true)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === 'Enter' && setShowMemoryPicker(true)}
                        >
                          <span className="fireside-guide-step__num">{hasMemories ? '✓' : '1'}</span>
                          <span className="fireside-guide-step__text">
                            <strong>带一段记忆到火边</strong>
                            <small>苔灯不会打开你没有授权的内容</small>
                          </span>
                        </div>
                        <div className="fireside-guide-step" style={{ opacity: hasMemories ? 1 : 0.4 }}>
                          <span className="fireside-guide-step__num">2</span>
                          <span className="fireside-guide-step__text">
                            <strong>在火边说一点</strong>
                            <small>从记忆开始，也可以只说此刻想到的事</small>
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p>
                        {dialogueMode === 'silent'
                          ? '火焰轻轻响着。你不需要先说什么。'
                          : dialogueMode === 'organize'
                            ? '可以从一件具体发生过的事开始。苔灯会陪你区分当时发生了什么、当时怎样感受，以及现在怎么看。'
                            : '你可以从刚刚遇见的那段记忆开始，也可以只说此刻想到的事。'}
                      </p>
                    )}
                  </div>
                ) : messages.map((message, index) => (
                  <div key={`${message.role}-${index}`} className={`fireside-message ${message.role} fireside-message-enter`}>
                    <span>{message.role === 'user' ? '你' : '苔灯'}</span>
                    {message.role === 'assistant' && loading && index === messages.length - 1 && !message.content ? (
                      <div className="typing-indicator">
                        <span />
                        <span />
                        <span />
                      </div>
                    ) : (
                      <p>{message.content || ''}</p>
                    )}
                    {message.isInference && <small>这是苔灯的推测，不是原记录中的事实。</small>}
                  </div>
                ))}
                <div ref={messagesEndRef} />
                {error && <p className="fireside-error">{error}</p>}
              </div>

              <footer className="fireside-composer">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={
                    !isReady
                      ? '先选择一段记忆，再开始对话……'
                      : dialogueMode === 'silent'
                        ? '想说时再写……'
                        : dialogueMode === 'organize'
                          ? '先说一件具体发生过的事……'
                          : '在火边说一点……'
                  }
                  rows={2}
                  disabled={!isReady}
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
                  <button type="button" onClick={() => void send()} disabled={!input.trim() || !isReady} aria-label="发送">
                    <Send size={17} />
                  </button>
                )}
              </footer>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
