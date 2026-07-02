'use client';

import type { Memo, WorldObject } from '@/types';
import {
  ForestSceneLayer,
  ForestScenePanel,
  SceneEmpty,
  SceneSection,
  formatMemoExcerpt,
  formatMemoTitle,
} from './ForestScenePrimitives';

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
    <ForestSceneLayer tone="object" align="center" label="世界物件来源">
      <ForestScenePanel
        tone="object"
        size="md"
        kicker="可回访物件 · 证据层"
        title="这里保留了什么"
        subtitle="物件不是结论，它只是一次你确认过的保存方式。"
        onClose={onClose}
      >
        {object.annotation ? (
          <SceneSection title="留下的文字" caption="来自工坊、火边或记忆花园的用户确认。">
            <pre className="forest-object-note">{object.annotation}</pre>
          </SceneSection>
        ) : (
          <SceneEmpty title="这里还没有注释" body="这个物件只保留了来源关系，没有额外解释。" />
        )}

        <SceneSection title="来源记忆" caption="回到原文，而不是只看生成结果。">
          {sources.length > 0 ? (
            <div className="forest-source-list">
              {sources.map((memo) => (
                <article key={memo.id}>
                  <strong>{formatMemoTitle(memo)}</strong>
                  <p>{formatMemoExcerpt(memo, 140)}</p>
                </article>
              ))}
            </div>
          ) : (
            <SceneEmpty title="来源暂时不可见" body="可能是游客态、权限变化，或这段来源记录已被隐藏。" />
          )}
        </SceneSection>
      </ForestScenePanel>
    </ForestSceneLayer>
  );
}
