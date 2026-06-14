'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import { Bot, Brain, ChevronDown, Clock3, Loader2, Plus, Send, Target, Trash2, Menu, MessageSquare, BookOpen, Search } from 'lucide-react';
import type { ChatMessage, Conversation } from '@/types';
import MarkdownContent from '@/components/ui/MarkdownContent';
import { useAppStore } from '@/lib/store/app';

function nowMessage(role: ChatMessage['role'], content: string, conversationId: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    conversation_id: conversationId,
    role,
    content,
    reasoning_content: '',
    citations: [],
    source_type: null,
    created_at: new Date().toISOString()
  };
}

const PROMPT_SUGGESTIONS: Array<{ title: string; text: string; icon: React.ReactNode }> = [
  {
    title: '最近什么在反复出现',
    text: '回看我最近的记录，有什么问题、感受或选择在反复出现？请指出证据和可能的反例。',
    icon: <Clock3 className="h-4 w-4 text-[var(--color-primary-dark)]" />,
  },
  {
    title: '一个想法怎样变化',
    text: '找出我最近变化最明显的一个想法，告诉我它从什么变成了什么，哪些记录支持这个判断。',
    icon: <BookOpen className="h-4 w-4 text-purple-500" />,
  },
  {
    title: '找到真正的阻力',
    text: '综合最近的记录，判断我真正想推进的是什么、卡在哪里。信息不足时只问我一个关键问题。',
    icon: <Search className="h-4 w-4 text-blue-500" />,
  },
  {
    title: '选择今天的一步',
    text: '先看清目标、阻力和现实约束，再给我一个今天能开始、低成本且能验证判断的下一步。',
    icon: <Target className="h-4 w-4 text-rose-500" />,
  },
];

function ReasoningDetails({
  content,
  streaming,
}: {
  content: string;
  streaming: boolean;
}) {
  const [open, setOpen] = useState(streaming);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!streaming || !open) return;
    const panel = contentRef.current;
    if (panel) panel.scrollTop = panel.scrollHeight;
  }, [content, open, streaming]);

  return (
    <details
      className="group/reasoning border-b border-[var(--color-border-light)] text-xs text-[var(--color-text-secondary)]"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-4 py-2 font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] [&::-webkit-details-marker]:hidden">
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]">
          {streaming ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
        </span>
        <span>{streaming ? '正在梳理思路' : '查看思考过程'}</span>
        <ChevronDown className="ml-auto h-3.5 w-3.5 transition-transform duration-200 group-open/reasoning:rotate-180" />
      </summary>
      <div
        ref={contentRef}
        className="max-h-36 overflow-y-auto whitespace-pre-wrap px-4 pb-3 pl-11 leading-6 text-[var(--color-text-muted)]"
      >
        {content}
      </div>
    </details>
  );
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [prefilledMemoId, setPrefilledMemoId] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [recentBaselineDays, setRecentBaselineDays] = useState<number | null>(null);

  const messagePanelRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { setSelectedMemo } = useAppStore();

  const loadConversations = useCallback(async () => {
    const response = await fetch('/api/conversations');
    if (response.ok) setConversations(await response.json());
  }, []);

  useEffect(() => {
    loadConversations();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [loadConversations]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prompt = params.get('prompt');
    if (prompt) setInput(prompt);
  }, []);

  const [prefilledInsightId, setPrefilledInsightId] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    // Handle memo query param
    const memoId = params.get('memo');
    if (memoId && memoId !== prefilledMemoId) {
      fetch(`/api/memos/${memoId}`)
        .then(async (response) => {
          if (!response.ok) return null;
          return response.json();
        })
        .then((memo) => {
          if (!memo) return;
          setPrefilledMemoId(memoId);
          if (!params.get('prompt')) {
            setInput(`请基于这条笔记帮我回看一下：${memo.ai_title || memo.plain_text.slice(0, 32)}`);
          }
        })
        .catch(() => undefined);
    }

    // Handle insight query param
    const insightId = params.get('insight');
    if (insightId && insightId !== prefilledInsightId) {
      fetch(`/api/insights/${insightId}`)
        .then(async (response) => {
          if (!response.ok) return null;
          return response.json();
        })
        .then((insight) => {
          if (!insight) return;
          setPrefilledInsightId(insightId);
          setInput(`关于你帮我提炼的洞察【${insight.title}】，我想深入聊聊。你提到：“${insight.content}”。我们应该怎么理解或改善这一情况？`);
        })
        .catch(() => undefined);
    }
  }, [prefilledMemoId, prefilledInsightId]);

  const openConversation = async (id: string) => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setLoading(false);

    const response = await fetch(`/api/conversations/${id}`);
    if (!response.ok) return;
    const data = await response.json();
    setConversationId(id);
    setMessages(data.messages);
  };

  const newConversation = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setLoading(false);

    setConversationId('');
    setMessages([]);
    setInput('');
  };

  const deleteConversation = async (id: string) => {
    if (!window.confirm('确定要删除此对话吗？此操作不可逆。')) return;

    if (conversationId === id) {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    }

    const response = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
    if (!response.ok) return;
    setConversations(conversations.filter((item) => item.id !== id));
    if (conversationId === id) newConversation();
  };

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const optimisticConversationId = conversationId || 'pending';
    setInput('');
    setLoading(true);
    setRecentBaselineDays(null);

    const userMsg = nowMessage('user', text, optimisticConversationId);
    const assistantMsg = nowMessage('assistant', '', optimisticConversationId);

    setMessages((current) => [...current, userMsg, assistantMsg]);
    requestAnimationFrame(() => {
      const panel = messagePanelRef.current;
      if (panel) panel.scrollTo({ top: panel.scrollHeight, behavior: 'smooth' });
    });

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversation_id: conversationId || undefined,
          mode: 'unified',
          memo_id: prefilledMemoId || undefined,
          thinking: thinkingEnabled,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `对话请求失败（HTTP ${response.status}）`);
      }
      if (!response.body) throw new Error('对话服务未返回响应流');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalConversationId = conversationId;
      let streamError = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';
        for (const event of events) {
          const line = event.split('\n').find((item) => item.startsWith('data: '));
          if (!line) continue;

          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'citation') {
              const citationsList = data.citations ?? [];
              setMessages((current) =>
                current.map((msg, index) =>
                  index === current.length - 1
                    ? { ...msg, citations: citationsList }
                    : msg
                )
              );
            }
            if (data.type === 'content') {
              setMessages((current) =>
                current.map((msg, index) =>
                  index === current.length - 1
                    ? { ...msg, content: msg.content + data.content }
                    : msg
                )
              );
            }
            if (data.type === 'reasoning') {
              setMessages((current) =>
                current.map((msg, index) =>
                  index === current.length - 1
                    ? {
                        ...msg,
                        reasoning_content: msg.reasoning_content + data.content,
                      }
                    : msg
                )
              );
            }
            if (data.type === 'replace') {
              setMessages((current) =>
                current.map((msg, index) =>
                  index === current.length - 1
                    ? { ...msg, content: data.content }
                    : msg
                )
              );
            }
            if (data.type === 'done') {
              finalConversationId = data.conversation_id;
              setConversationId(data.conversation_id);
              if (typeof data.recent_baseline_days === 'number') {
                setRecentBaselineDays(data.recent_baseline_days);
              }

              if (data.message_id) {
                setMessages((current) =>
                  current.map((msg, index) =>
                    index === current.length - 1
                      ? { ...msg, id: data.message_id }
                      : msg
                  )
                );
              }
            }
            if (data.type === 'error') {
              streamError = data.error || '生成回答时发生错误，请重试';
              setMessages((current) =>
                current.map((msg, index) =>
                  index === current.length - 1
                    ? { ...msg, content: streamError }
                    : msg
                )
              );
            }
          } catch (e) {
            console.error('SSE JSON parse failed:', e);
          }
        }
      }

      if (streamError) throw new Error(streamError);

      if (finalConversationId) {
        setMessages((current) =>
          current.map((msg) =>
            msg.conversation_id === 'pending'
              ? { ...msg, conversation_id: finalConversationId }
              : msg
          )
        );
        loadConversations();
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Chat fetch aborted');
        return;
      }
      setMessages((current) =>
        current.map((msg, index) =>
          index === current.length - 1
            ? {
                ...msg,
                content:
                  err instanceof Error
                    ? `对话生成失败：${err.message}`
                    : '对话生成失败，请稍后重试。',
              }
            : msg
        )
      );
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setLoading(false);
    }
  };

  const handleCitationClick = async (memoId: string) => {
    try {
      const response = await fetch(`/api/memos/${memoId}`);
      if (!response.ok) return;
      const memo = await response.json();
      if (memo) setSelectedMemo(memo);
    } catch (e) {
      console.error('Failed to load memo detail:', e);
    }
  };

  return (
    <div className="no-parent-scroll flex h-full w-full min-h-0 overflow-hidden animate-fade-in bg-[var(--color-bg-page)]">
      {/* Left History Sidebar */}
      <aside
        className={`
          flex flex-col border-r border-[var(--color-border-light)] bg-[var(--color-bg-sidebar)]
          transition-all duration-300 ease-in-out shrink-0 overflow-hidden
          ${isHistoryOpen ? 'w-72 opacity-100' : 'w-0 opacity-0'}
        `}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border-light)] shrink-0">
          <h2 className="text-sm font-semibold text-[var(--color-text-strong)] flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[var(--color-primary)]" />
            对话历史
          </h2>
          <button
            onClick={newConversation}
            className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
            title="新对话"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {conversations.length === 0 ? (
            <div className="text-center py-10 text-xs text-[var(--color-text-muted)]">
              暂无对话历史
            </div>
          ) : (
            conversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => openConversation(conversation.id)}
                className={`
                  group flex items-start justify-between rounded-xl px-3 py-2.5 text-left text-sm cursor-pointer transition
                  ${conversationId === conversation.id
                    ? 'bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] font-medium shadow-xs'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
                  }
                `}
              >
                <div className="min-w-0 flex-1 pr-2">
                  <p className="line-clamp-1 text-[13px] font-medium">{conversation.title}</p>
                  {conversation.summary ? (
                    <p className="mt-0.5 line-clamp-1 text-[11px] font-normal text-[var(--color-text-muted)]">
                      {conversation.summary}
                    </p>
                  ) : conversation.summary_status === 'generating' ? (
                    <p className="mt-0.5 text-[11px] font-normal text-[var(--color-text-muted)]">正在整理...</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteConversation(conversation.id);
                  }}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 text-[var(--color-text-muted)] hover:text-red-500 transition-all shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex min-w-0 flex-1 flex-col h-full bg-[var(--color-bg-page)] relative">
        <header className="flex items-center justify-between border-b border-[var(--color-border-light)] px-5 py-3 shrink-0 bg-[var(--color-bg-card)]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsHistoryOpen(!isHistoryOpen)}
              className="p-2 -ml-1 rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
              title={isHistoryOpen ? "收起侧栏" : "展开侧栏"}
            >
              <Menu className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-base font-semibold text-[var(--color-text-strong)] flex items-center gap-1.5">
                和 InnerOS 聊聊
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--color-primary)]" />}
              </h1>
              <p className="text-[11px] text-[var(--color-text-muted)] hidden sm:block">
                回看记录，理解当下，需要时再找到下一步。
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={newConversation}
              className="hidden sm:inline-flex btn-secondary py-1.5 px-3 rounded-lg text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> 新对话
            </button>
          </div>
        </header>

        {/* Message Panel */}
        <div ref={messagePanelRef} className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto max-w-3xl space-y-6">
            {messages.length === 0 ? (
              <div className="mx-auto mt-12 max-w-lg text-center animate-fade-in-up">
                <div className="w-16 h-16 rounded-3xl bg-[var(--color-primary-light)] flex items-center justify-center mx-auto mb-4 shadow-xs">
                  <Bot className="h-8 w-8 text-[var(--color-primary)] animate-float" />
                </div>
                <h2 className="text-lg font-semibold text-[var(--color-text-strong)]">
                  和你的第二大脑对话
                </h2>
                <p className="mt-2 text-sm text-[var(--color-text-secondary)] leading-relaxed">
                  回看过去的记录，理清现在的想法，找到接下来的一步。
                </p>

                {prefilledMemoId && (
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--color-primary-light)] px-4 py-1.5 text-xs text-[var(--color-primary-dark)]">
                    <BookOpen className="h-3.5 w-3.5" />
                    正在聊这条记录
                  </div>
                )}

                {/* Prompt Suggestion Cards */}
                <div className="mt-10 grid gap-3 sm:grid-cols-2 text-left">
                  {PROMPT_SUGGESTIONS.map((suggestion, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setInput(suggestion.text);
                        send(suggestion.text);
                      }}
                      className="group cursor-pointer rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-bg-card)] p-4 shadow-xs hover:shadow-md hover:border-[var(--color-primary)] transition-all duration-200"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-secondary)] group-hover:bg-[var(--color-primary-light)] flex items-center justify-center shrink-0 transition-colors">
                          {suggestion.icon}
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-[var(--color-text-strong)] group-hover:text-[var(--color-primary-dark)] transition-colors">
                            {suggestion.title}
                          </h4>
                          <p className="mt-1 text-[11px] text-[var(--color-text-muted)] line-clamp-2 leading-normal">
                            {suggestion.text}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message, messageIndex) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}
                >
                  <div className={`flex gap-3 max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Avatar */}
                    <div className="shrink-0">
                      {message.role === 'user' ? (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] flex items-center justify-center text-white text-xs font-bold shadow-xs">
                          W
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border-light)] flex items-center justify-center text-[var(--color-primary-dark)] shadow-xs">
                          <Bot className="w-4.5 h-4.5" />
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 flex-1 min-w-0">
                      {/* Bubble */}
                      <div
                        className={`
                          overflow-hidden rounded-2xl text-[14px] leading-7 shadow-xs
                          ${message.role === 'user'
                            ? 'bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] px-4 py-3 text-white rounded-tr-none'
                            : 'bg-[var(--color-bg-card)] border border-[var(--color-border-light)] text-[var(--color-text-primary)] rounded-tl-none'
                          }
                        `}
                      >
                        {message.role === 'assistant' ? (
                          <>
                            {message.reasoning_content && (
                              <ReasoningDetails
                                content={message.reasoning_content}
                                streaming={loading && messageIndex === messages.length - 1 && !message.content}
                              />
                            )}
                            <div className="px-4 py-3">
                              {!message.content && loading ? (
                                <span className="inline-flex items-center gap-2 text-[var(--color-text-secondary)]">
                                  <Loader2 className="h-4 w-4 animate-spin text-[var(--color-primary)]" />
                                  {message.reasoning_content ? '正在组织回答...' : '正在回复...'}
                                </span>
                              ) : (
                                <MarkdownContent
                                  content={message.content}
                                  memoReferences={message.citations}
                                  onMemoReference={handleCitationClick}
                                />
                              )}
                            </div>
                          </>
                        ) : (
                          <span className="whitespace-pre-wrap">{message.content}</span>
                        )}
                      </div>

                      {/* Inline Citations - Horizontal scrollable block */}
                      {message.role === 'assistant' && message.citations && message.citations.length > 0 && (
                        <div className="w-full pl-1 animate-fade-in-up overflow-hidden">
                          <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)] font-medium mb-1.5">
                            <BookOpen className="h-3 w-3 text-[var(--color-primary-dark)]" />
                            <span>参考了这些记录 ({message.citations.length})</span>
                          </div>

                          {/* Horizontal scroll container (strictly prevents stretching/wrapping) */}
                          <div className="flex overflow-x-auto gap-3 pb-2 w-full max-w-full scrollbar-thin scroll-smooth select-none">
                            {message.citations.map((citation, index) => (
                              <div
                                key={`${citation.memo_id}-${index}`}
                                onClick={() => handleCitationClick(citation.memo_id)}
                                className="
                                  w-64 shrink-0 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-bg-card)] p-3
                                  cursor-pointer hover:border-[var(--color-primary)] hover:shadow-xs transition-all duration-200
                                "
                              >
                                <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border-light)] pb-1.5 mb-1.5">
                                  <h5 className="min-w-0 truncate text-[12px] font-semibold text-[var(--color-text-strong)]">
                                    {citation.memo_title || '未命名记录'}
                                  </h5>
                                  <span className="text-[9px] font-semibold bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] px-1.5 py-0.5 rounded-full">相关记录</span>
                                </div>
                                <p className="mb-1 text-[10px] text-[var(--color-text-muted)]">
                                  {new Date(citation.memo_date).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })}
                                </p>
                                <p className="text-[11px] leading-normal text-[var(--color-text-secondary)] line-clamp-3">
                                  {citation.relevant_snippet}
                                </p>
                                {citation.retrieval_reason && (
                                  <p className="mt-2 truncate text-[10px] text-[var(--color-primary-dark)]">
                                    {index + 1}. {citation.retrieval_reason}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer Input */}
        <footer className="border-t border-[var(--color-border-light)] p-4 shrink-0 bg-[var(--color-bg-card)]">
          {/* Context range indicator (Q2-B) */}
          {recentBaselineDays !== null && !loading && (
            <div className="mx-auto max-w-3xl mb-2 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-0.5 text-[10px] text-[var(--color-text-muted)] border border-[var(--color-border-light)]">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                本次回答参考了最近 {recentBaselineDays} 天的状态
              </span>
            </div>
          )}

          <div className="mx-auto max-w-3xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-2 shadow-xs focus-within:border-[var(--color-primary)] focus-within:shadow-sm transition-all">
            <div className="flex items-end gap-1.5">
              <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                const nativeEvent = event.nativeEvent as KeyboardEvent;
                if (event.key === 'Enter' && !event.shiftKey && !nativeEvent.isComposing) {
                  event.preventDefault();
                  send();
                }
              }}
              placeholder="问问过去的自己，或一起想清楚下一步…（Enter 发送）"
              className="min-h-[44px] max-h-36 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none leading-relaxed placeholder:text-[var(--color-text-muted)]"
              />
              <button
                type="button"
                role="switch"
                aria-checked={thinkingEnabled}
                aria-label={thinkingEnabled ? '关闭深度思考' : '开启深度思考'}
                onClick={() => setThinkingEnabled((enabled) => !enabled)}
                disabled={loading}
                className={`group relative flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-all ${
                  thinkingEnabled
                    ? 'bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] shadow-[inset_0_0_0_1px_var(--color-primary)]'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-secondary)]'
                } disabled:cursor-not-allowed disabled:opacity-50`}
                title="深度思考会展示推理过程，响应时间更长"
              >
                <Brain className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">思考</span>
                <span className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  thinkingEnabled ? 'bg-[var(--color-primary-dark)]' : 'bg-[var(--color-border-strong)]'
                }`} />
              </button>
              <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              className="flex h-10 w-10 shrink-0 self-end items-center justify-center rounded-full bg-[var(--color-primary)] p-0 text-white shadow-sm transition hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:bg-[var(--color-border)] disabled:text-[var(--color-text-muted)] disabled:shadow-none"
              type="button"
              aria-label="发送消息"
              title="发送"
              >
                {loading ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Send className="h-[18px] w-[18px] stroke-[2.2]" />}
              </button>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
