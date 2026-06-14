'use client';

import { EmotionType, EMOTION_COLORS } from '@/types';

interface EmotionBadgeProps {
  emotion: EmotionType;
  size?: 'sm' | 'md';
}

// Direct hex colors for emotion dots (not dependent on Tailwind class generation)
const EMOTION_DOT_COLORS: Record<EmotionType, string> = {
  '平静': '#2563EB',
  '有力量': '#059669',
  '焦虑': '#D97706',
  '低落': '#7C3AED',
  '迷茫': '#4F46E5',
  '被认可': '#E11D48',
  '愤怒': '#DC2626',
  '喜悦': '#CA8A04',
};

export default function EmotionBadge({ emotion, size = 'sm' }: EmotionBadgeProps) {
  const colors = EMOTION_COLORS[emotion];
  if (!colors) return null;

  const dotColor = EMOTION_DOT_COLORS[emotion];
  const sizeClasses = size === 'sm'
    ? 'text-[11px] px-2 py-0.5 gap-1'
    : 'text-xs px-2.5 py-1 gap-1.5';

  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';

  return (
    <span
      className={`emotion-badge inline-flex items-center rounded-full font-medium ${colors.bg} ${colors.text} ${colors.border} ${sizeClasses}`}
    >
      <span
        className={`${dotSize} rounded-full shrink-0`}
        style={{ backgroundColor: dotColor }}
      />
      {emotion}
    </span>
  );
}
