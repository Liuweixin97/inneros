import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '林间世界 · InnerOS',
  description: '从六种观察视角，非线性地回看自己的记录、变化与线索。',
};

export default function ForestLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-[#061516]">
      {children}
    </div>
  );
}
