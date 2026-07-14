'use client';

import { usePathname, useRouter } from 'next/navigation';
import MemoDetail from '@/components/memo/MemoDetail';
import { useAppStore } from '@/lib/store/app';
import type { Memo } from '@/types';

export default function ContextPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const { selectedMemo, setSelectedMemo, contextPanelOpen, memos, setMemos, stats, setStats } = useAppStore();

  if (pathname.startsWith('/forest') || pathname === '/login') return null;
  if (!selectedMemo || !contextPanelOpen) return null;

  const closeDetail = () => {
    setSelectedMemo(null);
    if (pathname === '/records') {
      router.replace('/records', { scroll: false });
    }
  };

  const replaceMemo = (memo: Memo) => {
    setSelectedMemo(memo);
    setMemos(memos.map((item) => (item.id === memo.id ? memo : item)));
  };

  const handleAnalyze = async (memo: Memo) => {
    replaceMemo({ ...memo, analysis_status: 'analyzing' });
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memo_id: memo.id }),
    });
    if (!response.ok) {
      replaceMemo({ ...memo, analysis_status: 'failed' });
      return;
    }
    const data = await response.json();
    if (data.memo) replaceMemo(data.memo);
  };

  const handleDelete = async (memo: Memo) => {
    if (!window.confirm('确定要删除这条笔记吗？')) return;
    const response = await fetch(`/api/memos/${memo.id}`, { method: 'DELETE' });
    if (!response.ok) return;
    setMemos(memos.filter((item) => item.id !== memo.id));
    closeDetail();
    if (stats) {
      setStats({
        ...stats,
        total_memos: Math.max(0, stats.total_memos - 1),
        recent_memos: stats.recent_memos.filter((item) => item.id !== memo.id),
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeDetail();
      }}
    >
      <div className="relative z-10">
      <MemoDetail
        memo={selectedMemo}
        onClose={closeDetail}
        onAskAI={(memo) => {
          closeDetail();
          router.push(`/chat?memo=${memo.id}`);
        }}
        onAnalyze={handleAnalyze}
        onDelete={handleDelete}
      />
      </div>
    </div>
  );
}
