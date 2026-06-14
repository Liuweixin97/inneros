'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';

interface GamePortalProps {
  onComplete: () => void;
}

export default function GamePortal({ onComplete }: GamePortalProps) {
  const [opening, setOpening] = useState(false);

  const enterWorld = useCallback(() => {
    if (opening) return;
    setOpening(true);
    window.setTimeout(onComplete, 850);
  }, [onComplete, opening]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        enterWorld();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enterWorld]);

  return (
    <section className={`forest-entry ${opening ? 'is-opening' : ''}`}>
      <Image
        src="/game/forest-portal-entry.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="forest-entry__image"
      />
      <div className="forest-entry__vignette" aria-hidden="true" />

      <div className="forest-entry__copy">
        <h1>林间世界</h1>
        <p>有些事情写下来以后，还可以有一个地方继续住着。</p>
        <button type="button" onClick={enterWorld} disabled={opening}>
          <span>{opening ? '门后的光正在靠近' : '推门进去'}</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>

      <p className="forest-entry__hint">这里没有任务。想说话时说，想安静时就走一会儿。</p>
    </section>
  );
}
