'use client';

import { useMemo, useRef, useState } from 'react';
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
  const [started, setStarted] = useState(false);
  const [showMemoryPicker, setShowMemoryPicker] = useState(true);
  const [localNote, setLocalNote] = useState('');
  const [leaveNote, setLeaveNote] = useState('');
  const [leaveType, setLeaveType] = useState<'fireside_note' | 'left_question'>('fireside_note');
  const [localSaved, setLocalSaved] = useState(false);
  const [pinnedNotes, setPinnedNotes] = useState<Array<{ id: string; type: 'fireside_note' | 'left_question'; text: string }>>([]);
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
      onSaveJourneyEvent('fireside_note', text, authorizedMemoIds);
      setInput('');
      setLocalSaved(true);
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
        setError('苔灯现在听得见，但暂时说不了话。你写下的内容仍留在这里。');
      }
    }
    setLoading(false);
    abortRef.current = null;
  };

  const close = () => {
    abortRef.current?.abort();
    onClose();
  };

  const savePinnedNote = (type: 'fireside_note' | 'left_question', text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSaveJourneyEvent(type, trimmed, authorizedMemoIds);
    setPinnedNotes((current) => [...current, { id: crypto.randomUUID(), type, text: trimmed }].slice(-3));
  };

  const saveLocalNote = () => {
    const text = localNote.trim();
    if (!text) return;
    savePinnedNote('fireside_note', text);
    setLocalNote('');
    setLocalSaved(true);
  };

  const saveLeaveNote = () => {
    savePinnedNote(leaveType, leaveNote);
    setLeaveNote('');
  };

  const companionStatus = loading
    ? '苔灯在想，火光短了一下。'
    : companionType === 'llm'
      ? authorizedMemos.length > 0
        ? `苔灯只看见你带来的 ${authorizedMemos.length} 段记忆。`
        : '苔灯在听，但还没有翻看任何记录。'
      : '苔灯停在远处。这里不会请求 AI。';

  return (
    <div className="game-focus-layer game-focus-layer--fireside" role="dialog" aria-label="篝火对话">
      <div className="fireside-panel">
        <header className="fireside-header">
          <div>
            <p className="game-kicker">篝火地 · 一起说</p>
            <h2>{companionType === 'llm' ? '苔灯在火光的另一边亮着' : '火光的另一边暂时空着'}</h2>
          </div>
          <div className="flex items-center gap-2">
            {/* 邀请或遣散苔灯 */}
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
              title={companionType === 'llm' ? '遣散苔灯，独自漫游' : '邀请苔灯'}
            >
              {companionType === 'llm' ? '苔灯同行中' : '+ 邀请苔灯'}
            </button>
            <button type="button" className="game-icon-button" onClick={close} aria-label="离开篝火">
              <X size={17} />
            </button>
          </div>
        </header>

        {!started ? (
          <section className="fireside-setup">
            <p className="game-kicker">先定下今晚的火候</p>
            <div className="fireside-modes" aria-label="选择对话方式">
              {MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  className={dialogueMode === mode.id ? 'is-active' : ''}
                  onClick={() => onDialogueModeChange(mode.id)}
                  title={mode.description}
                >
                  <strong>{mode.label}</strong>
                  <span>{mode.description}</span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <div className="fireside-fixed-mode">
            <span>{MODES.find((mode) => mode.id === dialogueMode)?.label}</span>
            <p>{companionStatus}</p>
          </div>
        )}

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
                  ? '苔灯只会看到你本次选择的内容'
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

        {!started && (
          <button type="button" className="fireside-start" onClick={() => {
            setStarted(true);
            setShowMemoryPicker(false);
          }}>
            坐到火边
          </button>
        )}

        <div className="fireside-body">
          {started && companionType !== 'llm' && !showMemoryPicker ? (
            <section className="fireside-local-note">
              <p className="game-kicker">独自坐着</p>
              <h3>这张纸不会交给苔灯</h3>
              <p>
                你可以只把此刻的说法放在火边。它会成为本次旅程回声，但不会请求 AI。
              </p>
              {authorizedMemos.length > 0 && (
                <div className="fireside-local-note__materials">
                  {authorizedMemos.map((memo) => (
                    <span key={memo.id}>{memo.ai_title || memo.plain_text.slice(0, 20) || '未命名记录'}</span>
                  ))}
                </div>
              )}
              <textarea
                value={localNote}
                onChange={(event) => {
                  setLocalNote(event.target.value);
                  setLocalSaved(false);
                }}
                rows={6}
                placeholder="只写下你愿意确认的一句话……"
              />
              <div className="fireside-local-note__actions">
                <button type="button" disabled={!localNote.trim()} onClick={saveLocalNote}>
                  放在火边
                </button>
                <button type="button" onClick={() => onCompanionTypeChange('llm')}>
                  邀请苔灯回应
                </button>
              </div>
              {localSaved && <small>已放在本次旅程回声里。</small>}
            </section>
          ) : started && !showMemoryPicker && (
            <>
              <div className="fireside-messages" aria-live="polite">
                {messages.length === 0 ? (
                  <div className="fireside-empty">
                    <p>
                      {dialogueMode === 'silent'
                        ? '火焰轻轻响着。你不需要先说什么。'
                        : dialogueMode === 'organize'
                          ? '可以从一件具体发生过的事开始。苔灯会陪你区分当时发生了什么、当时怎样感受，以及现在怎么看。'
                        : '你可以从刚刚遇见的那段记忆开始，也可以只说此刻想到的事。'}
                    </p>
                  </div>
                ) : messages.map((message, index) => (
                  <div key={`${message.role}-${index}`} className={`fireside-message ${message.role}`}>
                    <span>{message.role === 'user' ? '你' : '苔灯'}</span>
                    <p>{message.content || (loading ? '……' : '')}</p>
                    {message.isInference && <small>这是苔灯的推测，不是原记录中的事实。</small>}
                  </div>
                ))}
                {error && <p className="fireside-error">{error}</p>}
              </div>

              <footer className="fireside-composer">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={
                    dialogueMode === 'silent'
                      ? '想说时再写……'
                      : dialogueMode === 'organize'
                        ? '先说一件具体发生过的事……'
                        : '在火边说一点……'
                  }
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
        </div>

        {started && (
          <aside className="fireside-keepsake">
            <div>
              <p className="game-kicker">想留在火边的纸条</p>
              <div className="fireside-keepsake__types">
                <button type="button" className={leaveType === 'fireside_note' ? 'is-selected' : ''} onClick={() => setLeaveType('fireside_note')}>一句话</button>
                <button type="button" className={leaveType === 'left_question' ? 'is-selected' : ''} onClick={() => setLeaveType('left_question')}>一个问题</button>
              </div>
            </div>
            <textarea
              value={leaveNote}
              onChange={(event) => setLeaveNote(event.target.value)}
              rows={2}
              placeholder={leaveType === 'left_question' ? '把还没有回答的问题折成纸鸟……' : '只写下你愿意确认的一句话……'}
            />
            <button type="button" disabled={!leaveNote.trim()} onClick={saveLeaveNote}>留在火边</button>
            {pinnedNotes.length > 0 && (
              <div className="fireside-keepsake__notes">
                {pinnedNotes.map((note) => <span key={note.id}>{note.type === 'left_question' ? '问' : '记'} · {note.text}</span>)}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
