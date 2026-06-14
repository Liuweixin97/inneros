'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store/app';

export default function ThemeInitializer() {
  const initializeTheme = useAppStore((state) => state.initializeTheme);

  useEffect(() => {
    initializeTheme();
  }, [initializeTheme]);

  return null;
}
