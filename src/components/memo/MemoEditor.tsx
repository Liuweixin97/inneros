'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send } from 'lucide-react';
import TagBadge from '@/components/ui/TagBadge';

interface MemoEditorProps {
  open: boolean;
  onClose: () => void;
  onSave: (content: string, tags: string[]) => void;
  initialContent?: string;
}

export default function MemoEditor({ open, onClose, onSave, initialContent = '' }: MemoEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setContent(initialContent);
      setTags([]);
      setTagInput('');
      // Focus textarea on next frame
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    }
  }, [open, initialContent]);

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 320) + 'px';
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [content, adjustTextareaHeight]);

  const handleAddTag = useCallback(() => {
    const cleaned = tagInput.trim().replace(/^#/, '');
    if (cleaned && !tags.includes(cleaned)) {
      setTags((prev) => [...prev, cleaned]);
    }
    setTagInput('');
  }, [tagInput, tags]);

  const handleRemoveTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const handleTagKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag();
    }
    if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  }, [handleAddTag, tagInput, tags.length]);

  const handleSave = useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed) return;
    onSave(trimmed, tags);
    setContent('');
    setTags([]);
  }, [content, tags, onSave]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.metaKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  }, [handleSave, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 animate-fade-in"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      />

      {/* Editor Card */}
      <div
        className="
          relative w-full max-w-[560px]
          rounded-[var(--radius-xl)]
          animate-scale-in
        "
        style={{
          backgroundColor: 'var(--color-bg-card)',
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid var(--color-border-light)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3.5 border-b"
          style={{ borderColor: 'var(--color-border-light)' }}
        >
          <h2
            className="text-[15px] font-semibold"
            style={{ color: 'var(--color-text-strong)' }}
          >
            ✍️ 写下此刻
          </h2>
          <button
            type="button"
            className="btn-ghost p-1.5 rounded-full"
            onClick={onClose}
            aria-label="关闭"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pt-4 pb-2">
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            className="input-base resize-none text-[15px] leading-[1.85] border-none bg-transparent p-0 focus:ring-0 focus:shadow-none"
            style={{
              minHeight: '120px',
              color: 'var(--color-text-primary)',
              outline: 'none',
              boxShadow: 'none',
            }}
            placeholder="写下一点真实的感受、观察或方法论……"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          {/* Tags area */}
          <div
            className="mt-3 pt-3 border-t"
            style={{ borderColor: 'var(--color-border-light)' }}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              {tags.map((tag) => (
                <TagBadge
                  key={tag}
                  tag={tag}
                  removable
                  onRemove={() => handleRemoveTag(tag)}
                />
              ))}
              <input
                ref={tagInputRef}
                type="text"
                className="
                  flex-1 min-w-[80px] text-[13px] py-1 px-1
                  bg-transparent border-none outline-none
                "
                style={{ color: 'var(--color-text-primary)' }}
                placeholder={tags.length === 0 ? '添加标签 (回车确认)' : '继续添加…'}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={handleAddTag}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-3 border-t"
          style={{ borderColor: 'var(--color-border-light)' }}
        >
          <span className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
            ⌘ Enter 快速保存
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary text-[13px] px-3.5 py-1.5"
              onClick={onClose}
            >
              取消
            </button>
            <button
              type="button"
              className="btn-primary text-[13px] px-4 py-1.5"
              disabled={!content.trim()}
              onClick={handleSave}
            >
              <Send size={14} />
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
