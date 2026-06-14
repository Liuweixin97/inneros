'use client';

import { create } from 'zustand';
import type { Memo, MemoFilters, AppStats } from '@/types';

interface AppState {
  // Theme
  darkMode: boolean;
  initializeTheme: () => void;
  toggleDarkMode: () => void;

  // Sidebar
  contextPanelOpen: boolean;
  toggleContextPanel: () => void;

  // Selected memo (for context panel)
  selectedMemo: Memo | null;
  setSelectedMemo: (memo: Memo | null) => void;

  // Memos
  memos: Memo[];
  memosLoading: boolean;
  memoFilters: MemoFilters;
  setMemos: (memos: Memo[]) => void;
  setMemosLoading: (loading: boolean) => void;
  setMemoFilters: (filters: MemoFilters) => void;

  // Stats
  stats: AppStats | null;
  setStats: (stats: AppStats) => void;

  // Compose
  composeOpen: boolean;
  setComposeOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  darkMode: false,
  initializeTheme: () => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem('inneros-theme');
    const darkMode = saved
      ? saved === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', darkMode);
    set({ darkMode });
  },
  toggleDarkMode: () => set((state) => {
    const newMode = !state.darkMode;
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', newMode);
      window.localStorage.setItem('inneros-theme', newMode ? 'dark' : 'light');
    }
    return { darkMode: newMode };
  }),

  contextPanelOpen: true,
  toggleContextPanel: () => set((state) => ({ contextPanelOpen: !state.contextPanelOpen })),

  selectedMemo: null,
  setSelectedMemo: (memo) => set({ selectedMemo: memo }),

  memos: [],
  memosLoading: false,
  memoFilters: {},
  setMemos: (memos) => set({ memos }),
  setMemosLoading: (loading) => set({ memosLoading: loading }),
  setMemoFilters: (filters) => set({ memoFilters: filters }),

  stats: null,
  setStats: (stats) => set({ stats }),

  composeOpen: false,
  setComposeOpen: (open) => set({ composeOpen: open }),
}));
