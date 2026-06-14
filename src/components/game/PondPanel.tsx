'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface PondPanelProps {
  onClose: () => void;
}

const POND_PROMPTS = [
  '在这里你不需要说话。',
  '水面很安静。',
  '想坐多久都可以。',
  '不用解释，也不用表现。',
  '这一刻可以只是你自己。',
];

export default function PondPanel({ onClose }: PondPanelProps) {
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);
  // useState 初始函数只在首次渲染调用，避免每次渲染都调用 Math.random()
  const [prompt] = useState(() => POND_PROMPTS[Math.floor(Math.random() * POND_PROMPTS.length)]);

  const handleSave = () => {
    if (!note.trim()) return;
    // 只保存在本地 sessionStorage，不发给 AI，不进 DB（体现「静默」原则）
    try {
      const existing = JSON.parse(sessionStorage.getItem('pond-notes') ?? '[]') as string[];
      sessionStorage.setItem('pond-notes', JSON.stringify([...existing, note.trim()]));
    } catch {
      // ignore
    }
    setSaved(true);
  };

  return (
    <>
      <div
        className="absolute inset-0 z-30"
        style={{ background: 'rgba(10,20,40,0.65)', backdropFilter: 'blur(3px)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 w-full max-w-sm mx-4"
        role="dialog"
        aria-label="静水池塘"
      >
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: 'linear-gradient(160deg, rgba(10,25,50,0.97), rgba(15,35,60,0.97))',
            border: '1px solid rgba(100,180,220,0.2)',
            boxShadow: '0 0 40px rgba(80,160,220,0.12)',
          }}
        >
          <div className="p-7">
            {/* 装饰：水波 */}
            <div className="flex justify-center mb-5 gap-1 opacity-40" aria-hidden="true">
              {[20, 28, 36, 28, 20].map((w, i) => (
                <div
                  key={i}
                  className="rounded-full"
                  style={{
                    width: w,
                    height: 3,
                    background: 'rgba(100,200,240,0.6)',
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </div>

            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-[10px] tracking-widest mb-1" style={{ color: 'rgba(100,200,240,0.5)' }}>
                  静水池塘
                </p>
                <p className="text-[15px] leading-relaxed" style={{ color: 'rgba(180,220,240,0.9)' }}>
                  {prompt}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="opacity-30 hover:opacity-60 transition-opacity mt-0.5"
                style={{ color: 'rgba(180,220,240,0.8)' }}
                aria-label="离开"
              >
                <X size={16} />
              </button>
            </div>

            {!saved ? (
              <div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="想写什么就写，或者就这样坐着……"
                  rows={3}
                  className="w-full text-[13px] leading-relaxed resize-none outline-none rounded-lg"
                  style={{
                    background: 'rgba(100,180,220,0.06)',
                    border: '1px solid rgba(100,180,220,0.15)',
                    padding: '10px 14px',
                    color: 'rgba(180,220,240,0.85)',
                    fontFamily: 'var(--font-sans)',
                  }}
                />
                <div className="flex gap-2 mt-3">
                  {note.trim() && (
                    <button
                      type="button"
                      onClick={handleSave}
                      className="flex-1 py-2 rounded-lg text-[12px] transition-all"
                      style={{
                        background: 'rgba(100,180,220,0.15)',
                        border: '1px solid rgba(100,180,220,0.3)',
                        color: 'rgba(180,220,240,0.9)',
                      }}
                    >
                      留在这里
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2 rounded-lg text-[12px] transition-all"
                    style={{
                      background: 'rgba(100,180,220,0.05)',
                      border: '1px solid rgba(100,180,220,0.1)',
                      color: 'rgba(140,180,210,0.6)',
                    }}
                  >
                    {note.trim() ? '不留，走了' : '就坐一会儿，走了'}
                  </button>
                </div>
                <p className="text-[10px] mt-3 text-center opacity-40" style={{ color: 'rgba(140,180,210,0.8)' }}>
                  这里写下的不会进入 AI 对话
                </p>
              </div>
            ) : (
              <div className="text-center py-2">
                <p className="text-[14px] mb-1" style={{ color: 'rgba(180,220,240,0.9)' }}>
                  留下了。
                </p>
                <p className="text-[12px] opacity-50" style={{ color: 'rgba(140,180,210,0.8)' }}>
                  只有你知道这里有什么。
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-4 text-[12px] underline underline-offset-2 opacity-50 hover:opacity-80 transition-opacity"
                  style={{ color: 'rgba(140,180,210,0.8)' }}
                >
                  回到世界
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
