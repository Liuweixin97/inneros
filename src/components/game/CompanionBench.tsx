'use client';

import { Lamp, Moon, Users } from 'lucide-react';
import type { CompanionType } from '@/types';
import {
  ForestSceneLayer,
  ForestScenePanel,
  SceneButton,
  SceneSection,
} from './ForestScenePrimitives';

interface CompanionBenchProps {
  companionType: CompanionType;
  onChange: (type: CompanionType) => void;
  onClose: () => void;
}

const OPTIONS: Array<{
  id: CompanionType;
  title: string;
  body: string;
  boundary: string;
  Icon: typeof Moon;
}> = [
  {
    id: 'none',
    title: '一个人走',
    body: '不调用 AI，不读取行囊。适合只想在地图里走走。',
    boundary: '所有场景仍可打开，但苔灯不会回应。',
    Icon: Moon,
  },
  {
    id: 'llm',
    title: '邀请苔灯',
    body: '苔灯可以在火边回应，也会跟随角色移动。',
    boundary: '它只看见你本次明确放进行囊的记录。',
    Icon: Lamp,
  },
  {
    id: 'human_local',
    title: '同屏双人',
    body: '两名角色在同一张地图上移动，适合共居工坊。',
    boundary: '工坊需要双方靠近后才开启；AI 不自动读取另一方内容。',
    Icon: Users,
  },
];

export default function CompanionBench({
  companionType,
  onChange,
  onClose,
}: CompanionBenchProps) {
  return (
    <ForestSceneLayer tone="bench" align="bottom" label="门前长椅">
      <ForestScenePanel
        tone="bench"
        size="md"
        kicker="门前长椅 · 同行边界"
        title="先说清楚今天谁和你一起走"
        subtitle="长椅只决定陪伴方式，不改变任何记录权限。"
        onClose={onClose}
        footer={(
          <>
            <SceneButton variant="quiet" onClick={onClose}>不改了</SceneButton>
            <SceneButton variant="primary" onClick={onClose}>回到地图</SceneButton>
          </>
        )}
      >
        <div className="forest-companion-grid">
          {OPTIONS.map(({ id, title, body, boundary, Icon }) => (
            <button
              key={id}
              type="button"
              className={`forest-companion-option ${companionType === id ? 'is-selected' : ''}`}
              onClick={() => onChange(id)}
            >
              <Icon size={20} strokeWidth={1.8} />
              <span>
                <strong>{title}</strong>
                <small>{body}</small>
              </span>
              <em>{boundary}</em>
            </button>
          ))}
        </div>

        <SceneSection title="产品边界" caption="陪伴不是授权，授权只发生在你把记忆放进行囊时。">
          <ul className="forest-boundary-list">
            <li>一个人走：所有互动本地完成，不请求 AI。</li>
            <li>苔灯同行：火边对话只使用本次选择的行囊内容。</li>
            <li>同屏双人：只是同一设备上的共同操作，不创建第二个云端账户。</li>
          </ul>
        </SceneSection>
      </ForestScenePanel>
    </ForestSceneLayer>
  );
}
