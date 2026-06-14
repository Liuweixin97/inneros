import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '林间世界 · InnerOS',
  description: '一片由你的经历慢慢长成的像素世界，等你回来走走。',
};

export default function CoCreateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}
