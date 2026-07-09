'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { CompanionType } from '@/types';
import { CHARACTER_PRESETS } from '@/lib/game/sprite';

interface CharacterSelectProps {
  onConfirm: (
    charId: string,
    companionType: CompanionType,
  ) => void;
}

const CHARACTER_ART: Record<string, string> = {
  wanderer: '/game/lantern-keeper.png',
  drifter: '/game/seed-keeper.png',
};

export default function CharacterSelect({ onConfirm }: CharacterSelectProps) {
  const [selectedChar, setSelectedChar] = useState(CHARACTER_PRESETS[0].id);

  return (
    <section className="forest-arrival">
      <Image
        src="/game/forest-portal-entry.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="forest-arrival__image"
      />
      <div className="forest-arrival__shade" aria-hidden="true" />

      <div className="forest-arrival__panel">
        <p className="forest-arrival__place">木屋门前</p>
        <h1>选一个此刻的样子</h1>
        <p className="forest-arrival__description">
          这里只决定你在世界里的外观。独处、问灯、放下或归档，都可以进门以后再决定。
        </p>

        <div className="forest-arrival__characters" aria-label="角色外观">
          {CHARACTER_PRESETS.map((character) => {
            const selected = selectedChar === character.id;
            return (
              <button
                key={character.id}
                type="button"
                aria-pressed={selected}
                className={selected ? 'is-selected' : ''}
                onClick={() => setSelectedChar(character.id)}
              >
                <span className="forest-arrival__portrait">
                  <Image
                    src={CHARACTER_ART[character.id]}
                    alt=""
                    width={88}
                    height={88}
                  />
                </span>
                <span>{character.displayName}</span>
              </button>
            );
          })}
        </div>

        <button
          id="start-explore-btn"
          type="button"
          className="forest-arrival__continue"
          onClick={() => onConfirm(selectedChar, 'none')}
        >
          走进世界
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}
