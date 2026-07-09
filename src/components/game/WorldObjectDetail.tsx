'use client';

import { X } from 'lucide-react';
import type { Memo, WorldObject } from '@/types';

export default function WorldObjectDetail({
  object,
  memos,
  onClose,
}: {
  object: WorldObject;
  memos: Memo[];
  onClose: () => void;
}) {
  const sources = memos.filter((memo) => object.sourceMemoIds.includes(memo.id));
  return (
    <div className="game-focus-layer game-focus-layer--soft" role="dialog" aria-label="世界物件来源">
      <section className="object-detail-panel">
        <header>
          <div><p className="game-kicker">可追溯的世界物件</p><h2>这里保留了什么</h2></div>
          <button type="button" className="game-icon-button" onClick={onClose}><X size={17} /></button>
        </header>
        {object.annotation && <pre>{object.annotation}</pre>}
        <div>
          <small>来源记忆</small>
          {sources.map((memo) => (
            <article key={memo.id}>
              <strong>{memo.ai_title || memo.plain_text.slice(0, 40) || '未命名记录'}</strong>
              <p>{memo.plain_text.slice(0, 140)}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
