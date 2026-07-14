import type { ForestNodeId } from './types';

export interface ForestSceneDefinition {
  id: ForestNodeId;
  name: string;
  purpose: string;
  emptySummary: string;
  sparseSummary: string;
}

export const FOREST_SCENES: readonly ForestSceneDefinition[] = [
  {
    id: 'lantern-cabin',
    name: '此刻灯屋',
    purpose: '查看近期记录中出现的感受与阶段状态，不把频次当成诊断。',
    emptySummary: '这个时间窗口里还没有可供回看的感受记录。',
    sparseSummary: '目前只有少量感受记录，先保留线索，不急着概括此刻。',
  },
  {
    id: 'year-ring-path',
    name: '年轮小径',
    purpose: '沿时间查看记录密度与内容标记的变化，只呈现先后和频次。',
    emptySummary: '这个时间窗口里还没有形成可见的记录年轮。',
    sparseSummary: '目前只有少量时间点，能够回看发生过什么，暂不概括变化趋势。',
  },
  {
    id: 'echo-hearth',
    name: '回声火塘',
    purpose: '查看人物与项目在记录中的出现和同篇共现，不推断关系性质或他人动机。',
    emptySummary: '这个时间窗口里还没有人物或项目场景可供对照。',
    sparseSummary: '目前只有少量场景回声，只呈现它们在记录中的出现情况。',
  },
  {
    id: 'twin-shadow-pond',
    name: '双影潭',
    purpose: '并列查看有证据的更新、反驳与张力候选；没有两侧证据时不制造矛盾。',
    emptySummary: '现有记录里还看不到足够扎实的两面证据，这本身也是结果。',
    sparseSummary: '目前只看到一两处可能的张力，先把两边证据并列，不替你选边。',
  },
  {
    id: 'root-court',
    name: '根系庭',
    purpose: '回看系统整理出的信念、偏好、模式、约束与状态候选。',
    emptySummary: '这个时间窗口里还没有带原始证据的根系候选。',
    sparseSummary: '目前只有少量根系候选；它们是待核对的整理结果，不是用户事实。',
  },
  {
    id: 'windwatch-terrace',
    name: '候风台',
    purpose: '并列查看目标、项目与行动候选，不预测下一步。',
    emptySummary: '这个时间窗口里还没有可展示的方向线索。',
    sparseSummary: '目前只有少量方向线索，先并列展示，不判断优先级。',
  },
] as const;

export const FOREST_NODE_ORDER = FOREST_SCENES.map((scene) => scene.id);

export function getForestScene(id: ForestNodeId): ForestSceneDefinition {
  const scene = FOREST_SCENES.find((item) => item.id === id);
  if (!scene) throw new Error(`未知林间节点: ${id}`);
  return scene;
}
