'use client';

import { useRouter } from 'next/navigation';
import GameShell from '@/components/game/GameShell';

export default function CoCreatePage() {
  const router = useRouter();

  return <GameShell onExit={() => router.push('/')} />;
}
