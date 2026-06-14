'use client';

import React, { useState } from 'react';
import type { Memo, WorldObject } from '@/types';

interface MemoEncounterProps {
  memo: Memo;
  worldObject: WorldObject | null;
  authorizedMemoIds: string[];
  onAuthorize: (id: string) => void;
  onSaveAnnotation: (annotation: string) => Promise<boolean>;
  onClose: () => void;
  onOpenFireside: () => void;
}

export default function MemoEncounter({
  memo,
  worldObject,
  authorizedMemoIds,
  onAuthorize,
  onSaveAnnotation,
  onClose,
  onOpenFireside,
}: MemoEncounterProps) {
  const [annotation, setAnnotation] = useState(worldObject?.annotation ?? '');
  const [showAnnotationInput, setShowAnnotationInput] = useState(false);
  const [annotationSaved, setAnnotationSaved] = useState(false);

  const isAuthorized = authorizedMemoIds.includes(memo.id);
  const date = new Date(memo.created_at);
  const dateStr = `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`;

  const [saveError, setSaveError] = useState('');

  const handleSaveAnnotation = async () => {
    if (!annotation.trim()) return;
    setSaveError('');
    const saved = await onSaveAnnotation(annotation.trim());
    if (saved) {
      setAnnotationSaved(true);
      setTimeout(() => setShowAnnotationInput(false), 800);
    } else {
      setSaveError('这句话暂时没有保存成功。');
    }
  };

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 z-30"
        style={{ background: 'rgba(30,18,8,0.55)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 羊皮纸弹层 */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 w-full max-w-lg mx-4 animate-place-bounce"
        role="dialog"
        aria-label="记忆阅读"
      >
        <div className="memo-parchment rounded-lg overflow-hidden">
          {/* 顶部装饰条 */}
          <div
            className="h-2"
            style={{ background: 'linear-gradient(90deg, #C4A882, #E8D9B5, #C4A882)' }}
          />

          <div className="p-6">
            {/* 日期 + 标题行 */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[11px] tracking-widest uppercase" style={{ color: '#8B6340' }}>
                  {dateStr}
                </p>
                {memo.ai_title && (
                  <h3 className="text-[15px] font-medium mt-1" style={{ color: '#3B2E2A' }}>
                    {memo.ai_title}
                  </h3>
                )}
              </div>
              <button
                onClick={onClose}
                className="text-[18px] leading-none opacity-40 hover:opacity-70 transition-opacity"
                style={{ color: '#3B2E2A' }}
                aria-label="关闭"
              >
                ✕
              </button>
            </div>

            {/* Memo 正文（只读） */}
            <div
              className="text-[14px] leading-[1.9] mb-5 max-h-60 overflow-y-auto"
              style={{ color: '#3B2E2A', fontFamily: 'var(--font-sans)' }}
            >
              <p className="whitespace-pre-wrap">{memo.plain_text}</p>
            </div>

            {/* 标签 */}
            {memo.original_tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {memo.original_tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] px-2 py-0.5 rounded-full"
                    style={{
                      background: 'rgba(139,99,64,0.1)',
                      border: '1px solid rgba(139,99,64,0.25)',
                      color: '#8B6340',
                    }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* 今日注释（与原文分离） */}
            {!showAnnotationInput && !annotationSaved && (
              <button
                onClick={() => setShowAnnotationInput(true)}
                className="text-[12px] underline underline-offset-2 opacity-50 hover:opacity-80 transition-opacity"
                style={{ color: '#6B3F1A' }}
              >
                + 留一句今天的话（不覆盖原文）
              </button>
            )}

            {showAnnotationInput && !annotationSaved && (
              <div className="mt-2">
                <textarea
                  value={annotation}
                  onChange={(e) => setAnnotation(e.target.value)}
                  placeholder="今天看到这里，想说……"
                  autoFocus
                  rows={2}
                  className="w-full text-[13px] leading-relaxed resize-none outline-none"
                  style={{
                    background: 'rgba(139,99,64,0.05)',
                    border: '1px dashed rgba(139,99,64,0.35)',
                    borderRadius: 6,
                    padding: '8px 12px',
                    color: '#3B2E2A',
                    fontFamily: 'var(--font-sans)',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setShowAnnotationInput(false);
                  }}
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleSaveAnnotation}
                    className="text-[12px] px-3 py-1 rounded"
                    style={{
                      background: 'var(--game-green-mid)',
                      color: 'white',
                    }}
                  >
                    留下
                  </button>
                  <button
                    onClick={() => setShowAnnotationInput(false)}
                    className="text-[12px] px-3 py-1 rounded opacity-60"
                    style={{ color: '#6B3F1A' }}
                  >
                    取消
                  </button>
                </div>
                {saveError && <p className="mt-2 text-[11px] text-red-700">{saveError}</p>}
              </div>
            )}

            {annotationSaved && (
              <p className="text-[12px] opacity-60" style={{ color: '#6B3F1A' }}>
                ✓ 已留下今天的话
              </p>
            )}

            {/* 操作按钮 */}
            <div
              className="flex gap-2 mt-5 pt-4"
              style={{ borderTop: '1px solid rgba(139,99,64,0.2)' }}
            >
              <button
                id="memo-encounter-close"
                onClick={onClose}
                className="flex-1 py-2 rounded text-[12px] transition-all"
                style={{
                  background: 'rgba(139,99,64,0.08)',
                  border: '1px solid rgba(139,99,64,0.2)',
                  color: '#8B6340',
                }}
              >
                今天不看
              </button>

              {!isAuthorized && (
                <button
                  id="memo-encounter-authorize"
                  onClick={() => onAuthorize(memo.id)}
                  className="flex-1 py-2 rounded text-[12px] transition-all"
                  style={{
                    background: 'rgba(74,124,47,0.12)',
                    border: '1px solid rgba(74,124,47,0.3)',
                    color: 'var(--game-green-mid)',
                  }}
                >
                  带到篝火边
                </button>
              )}

              {isAuthorized && (
                <button
                  id="memo-encounter-fireside"
                  onClick={onOpenFireside}
                  className="flex-1 py-2 rounded text-[12px] transition-all"
                  style={{
                    background: 'rgba(255,155,61,0.15)',
                    border: '1px solid rgba(255,155,61,0.35)',
                    color: '#FF9B3D',
                  }}
                >
                  🔥 去篝火边谈谈
                </button>
              )}
            </div>
          </div>

          {/* 底部装饰条 */}
          <div
            className="h-1"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(139,99,64,0.3), transparent)' }}
          />
        </div>
      </div>
    </>
  );
}
