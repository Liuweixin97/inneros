'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';

interface GamePortalProps {
  onComplete: () => void;
}

export default function GamePortal({ onComplete }: GamePortalProps) {
  const [opening, setOpening] = useState(false);
  const [titleVisible, setTitleVisible] = useState(false);
  const [subtitleVisible, setSubtitleVisible] = useState(false);
  const [buttonVisible, setButtonVisible] = useState(false);

  // 逐步显示文字
  useEffect(() => {
    const t1 = setTimeout(() => setTitleVisible(true), 300);
    const t2 = setTimeout(() => setSubtitleVisible(true), 1000);
    const t3 = setTimeout(() => setButtonVisible(true), 1600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

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
        <h1
          style={{
            opacity: titleVisible ? 1 : 0,
            transform: titleVisible ? 'translateY(0)' : 'translateY(12px)',
            transition: 'opacity 0.8s ease, transform 0.8s ease',
          }}
        >
          林间世界
        </h1>
        <p
          style={{
            opacity: subtitleVisible ? 1 : 0,
            transform: subtitleVisible ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 0.9s ease 0.1s, transform 0.9s ease 0.1s',
          }}
        >
          有些事情写下来以后，还可以有一个地方继续住着。
        </p>
        <button
          type="button"
          onClick={enterWorld}
          disabled={opening}
          style={{
            opacity: buttonVisible ? 1 : 0,
            transform: buttonVisible ? 'translateY(0)' : 'translateY(6px)',
            transition: 'opacity 0.5s ease, transform 0.5s ease, background 180ms ease, border-color 180ms ease',
          }}
        >
          <span>{opening ? '正在走向长椅' : '走到入林长椅'}</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>

      <p className="forest-entry__hint">先坐下选择今天怎么走，再去花园带一段记忆。也可以什么都不处理。</p>
    </section>
  );
}
