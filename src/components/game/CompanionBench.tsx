'use client';

import { Lamp, Moon, X } from 'lucide-react';
import type { CompanionType } from '@/types';

interface CompanionBenchProps {
  companionType: CompanionType;
  onChange: (type: CompanionType) => void;
  onClose: () => void;
}

export default function CompanionBench({
  companionType,
  onChange,
  onClose,
}: CompanionBenchProps) {
  return (
    <div className="game-focus-layer game-focus-layer--soft" role="dialog" aria-label="入林长椅">
      <section className="companion-bench">
        <header>
          <div>
            <p className="game-kicker">入林长椅</p>
            <h2>今天想怎样走一走？</h2>
          </div>
          <button type="button" className="game-icon-button" onClick={onClose} aria-label="离开长椅">
            <X size={17} />
          </button>
        </header>

        <div className="companion-bench__choices">
          <button
            type="button"
            className={companionType === 'none' ? 'is-selected' : ''}
            onClick={() => {
              onChange('none');
              onClose();
            }}
          >
            <Moon size={20} />
            <strong>一个人走走</strong>
            <span>苔灯会回到火边安静等待。</span>
          </button>
          <button
            type="button"
            className={companionType === 'llm' ? 'is-selected' : ''}
            onClick={() => {
              onChange('llm');
              onClose();
            }}
          >
            <Lamp size={20} />
            <strong>邀请苔灯</strong>
            <span>它只看见你明确放进行囊的内容。</span>
          </button>
        </div>
      </section>
    </div>
  );
}
