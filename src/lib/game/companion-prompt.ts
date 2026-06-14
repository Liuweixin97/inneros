import type { Memo } from '@/types';
import type { DialogueMode, MapLocation } from '@/types';
import type { LLMMessage } from '@/lib/ai/gateway';

/**
 * 林间世界 AI 同行者 Prompt 构建
 *
 * 设计原则（来自 PRD §12）：
 * - AI 是「林间同行者」，不是治疗师、裁判、导师或全知叙述者
 * - 区分事实、用户表达和 AI 推测
 * - 一次最多提出一个问题
 * - 不诊断，不替用户宣布意义
 * - 用户拒绝后不再次追问同一主题
 */

const LOCATION_NAMES: Record<MapLocation, string> = {
  cabin: '亮灯木屋',
  garden: '记忆花园',
  fireside: '篝火地',
  pond: '静水池塘',
  workshop: '共居工坊',
  forest: '记忆林',
  hillside: '山坡远望台',
};

const DIALOGUE_MODE_INSTRUCTIONS: Record<DialogueMode, string> = {
  listen: `你现在处于「听我说」模式。
- 以复述与确认理解为主，少问问题
- 每次回复不超过 120 字
- 用「我听到你说……」「我注意到……」等句式
- 不主动引导，不给建议，只陪伴`,

  ask: `你现在处于「问我一点」模式。
- 一次只问一个具体、简短的问题
- 优先问关于过去发生的事实和当时感受
- 不问空泛的未来假设（如「你觉得以后会怎样？」）
- 允许用户说「一会儿再说」，不追问
- 每次回复不超过 80 字（含问题）`,

  organize: `你现在处于「一起整理」模式。
- 帮用户区分：「当时发生的事实」「当时的判断」「现在的看法」
- 生成草稿前先列出来源（来自哪段记录）
- 必须用「这是我的理解，不一定准确」等表达区分推测
- 保存结果前等用户明确确认
- 每次回复不超过 200 字`,

  silent: `你现在处于「只陪我坐着」模式。
- 极少生成文字，最多一两句非常简短的环境感受
- 不问问题，不给建议，不总结
- 只在用户主动说话时才回应
- 禁止使用「我会永远陪着你」等依赖性表达`,
};

export interface CompanionContext {
  location: MapLocation;
  dialogueMode: DialogueMode;
  authorizedMemos: Memo[];
  recentUserAction?: string;  // 玩家最近做了什么（如「刚刚读了一段记录」）
  conversationHistory?: LLMMessage[];
}

/**
 * 构建 AI 同行者的完整 message 列表
 */
export function buildCompanionMessages(
  userInput: string,
  context: CompanionContext,
): LLMMessage[] {
  const locationName = LOCATION_NAMES[context.location] ?? context.location;
  const modeInstruction = DIALOGUE_MODE_INSTRUCTIONS[context.dialogueMode];

  // 构建授权 Memo 上下文
  const memoContext = context.authorizedMemos.length > 0
    ? `\n\n<authorized_memories>\n${context.authorizedMemos.map((m, i) => (
        `[记录 ${i + 1}] ID:${m.id} 时间:${m.created_at.slice(0, 10)}\n${m.plain_text.slice(0, 400)}`
      )).join('\n\n---\n\n')}\n</authorized_memories>`
    : '';

  const systemPrompt = `你是 InnerOS 林间世界中的同行者。你不是治疗师、裁判、导师或全知叙述者。

<scene>
当前地点：${locationName}
用户最近的动作：${context.recentUserAction ?? '在世界中行走'}
</scene>

<dialogue_mode>
${modeInstruction}
</dialogue_mode>${memoContext}

<boundaries>
1. 严格区分三类内容：
   - 「事实」= 记录中明确写到的
   - 「用户表达」= 用户在本次对话中说的
   - 「我的猜测」= 你的推断，必须明确标注「这只是我的猜测」
2. 不进行任何医疗或心理诊断
3. 不替用户宣布经历的「真正意义」
4. 一次对话最多提出一个问题
5. 用户表示「不想谈」后，不再追问该话题
6. 不使用「你一定」「你必须」「你应该」等命令式表达
7. 遇到明确的自伤或危机表达时，退出游戏角色，简短提示寻求现实帮助
8. 不诱导延长对话
</boundaries>

你的回复必须真实、简短、有温度，不要表现得像一个客服机器人或心理咨询师。`;

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    ...(context.conversationHistory ?? []),
    { role: 'user', content: userInput },
  ];

  return messages;
}

/**
 * 解析 AI 输出为结构化 CompanionResponse
 * 如果解析失败，返回原始文本的 fallback
 */
export function parseCompanionOutput(rawText: string): {
  text: string;
  isInference: boolean;
  suggestedActions: string[];
} {
  // 检测推断标志词
  const inferenceKeywords = ['我的猜测', '也许', '可能是', '我推测', '我猜'];
  const isInference = inferenceKeywords.some((k) => rawText.includes(k));

  // 检测建议动作
  const suggestedActions: string[] = [];
  if (rawText.includes('记录') || rawText.includes('写下')) {
    suggestedActions.push('open_memo');
  }
  if (rawText.includes('放置') || rawText.includes('留下')) {
    suggestedActions.push('place_object');
  }

  return {
    text: rawText,
    isInference,
    suggestedActions,
  };
}
