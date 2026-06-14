'use client';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

const SIZE_MAP = {
  sm: { spinner: 16, border: 2 },
  md: { spinner: 28, border: 3 },
  lg: { spinner: 40, border: 3 },
};

export default function LoadingSpinner({ size = 'md', text }: LoadingSpinnerProps) {
  const { spinner, border } = SIZE_MAP[size];

  return (
    <div className="flex flex-col items-center justify-center gap-2.5">
      <div
        className="rounded-full animate-spin"
        style={{
          width: spinner,
          height: spinner,
          border: `${border}px solid var(--color-border-light)`,
          borderTopColor: 'var(--color-primary)',
          animationDuration: '0.7s',
        }}
      />
      {text && (
        <span
          className="text-[13px] font-medium animate-pulse-soft"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {text}
        </span>
      )}
    </div>
  );
}
