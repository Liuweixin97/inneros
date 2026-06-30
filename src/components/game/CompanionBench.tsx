'use client';

import { Lamp, Moon, Users, X } from 'lucide-react';
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
    <div className="game-focus-layer game-focus-layer--soft" role="dialog" aria-label="选择同行方式">
      <section className="companion-bench">
        <header>
          <div>
            <p className="game-kicker">门前长椅</p>
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
          <button
            type="button"
            className={companionType === 'human_local' ? 'is-selected' : ''}
            onClick={() => {
              onChange('human_local');
              onClose();
            }}
          >
            <Users size={20} />
            <strong>开启同屏双人</strong>
            <span>两名角色在同一块屏幕里行走。</span>
          </button>
        </div>

        <aside className="companion-bench__ledger">
          <p className="game-kicker">同行边界</p>
          <ul>
            <li>一个人走：不会调用 AI，也不会读取行囊。</li>
            <li>苔灯同行：只看你本次放进行囊的记录。</li>
            <li>同屏双人：工坊需要双方靠近后才会开启。</li>
          </ul>
        </aside>
      </section>
    </div>
  );
}
