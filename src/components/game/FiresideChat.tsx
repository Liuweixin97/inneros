'use client';

import { useMemo, useRef, useState } from 'react';
import { Pause, Send, X } from 'lucide-react';
import type { DialogueMode, GameWorld, Memo } from '@/types';
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
  onClose: () => void;
}

const MODES: Array<{ id: DialogueMode; label: string; description: string }> = [
  { id: 'listen', label: '听我说', description: '少问一点，先听你说完' },
  { id: 'ask', label: '问我一点', description: '一次只问一个具体问题' },
  { id: 'organize', label: '一起整理', description: '分开事实、当时判断与现在看法' },
  { id: 'silent', label: '只陪我坐着', description: '不追问，也不要求留下什么' },
];

export default function FiresideChat({
  world,
  memos,
  authorizedMemoIds,
  dialogueMode,
  onDialogueModeChange,
  onAuthorizeMemos,
  onClose,
}: FiresideChatProps) {
  const [messages, setMessages] = useState<CompanionMessage[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showMemoryPicker, setShowMemoryPicker] = useState(authorizedMemoIds.length === 0);
  const abortRef = useRef<AbortController | null>(null);

  const authorizedMemos = useMemo(
    () => memos.filter((memo) => authorizedMemoIds.includes(memo.id)),
    [authorizedMemoIds, memos],
  );

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
          <button type="button" className="game-icon-button" onClick={close} aria-label="离开篝火">
            <X size={17} />
          </button>
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

        <button
          type="button"
          className="fireside-memory-summary"
          onClick={() => setShowMemoryPicker((value) => !value)}
        >
          <span>
            {authorizedMemos.length > 0
              ? `只带入了你选择的 ${authorizedMemos.length} 段记录`
              : '这次还没有带入任何记录'}
          </span>
          <span>{showMemoryPicker ? '收起' : '选择'}</span>
        </button>

        {showMemoryPicker && (
          <div className="fireside-memory-picker">
            {memos.slice(0, 12).map((memo) => {
              const checked = authorizedMemoIds.includes(memo.id);
              return (
                <label key={memo.id}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const next = checked
                        ? authorizedMemoIds.filter((id) => id !== memo.id)
                        : [...authorizedMemoIds, memo.id].slice(-5);
                      onAuthorizeMemos(next);
                    }}
                  />
                  <span>
                    <strong>{memo.ai_title || memo.plain_text.slice(0, 28) || '未命名记录'}</strong>
                    <small>{new Date(memo.created_at).toLocaleDateString('zh-CN')}</small>
                  </span>
                </label>
              );
            })}
            {memos.length === 0 && <p>这里还没有可带到火边的记录。</p>}
          </div>
        )}

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
      </div>
    </div>
  );
}
