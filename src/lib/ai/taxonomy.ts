import type { EmotionType } from '@/types';

const EMOTION_WORDS: EmotionType[] = ['平静', '有力量', '焦虑', '低落', '迷茫', '被认可', '愤怒', '喜悦'];

const TOPIC_STOP_WORDS = new Set([
  ...EMOTION_WORDS,
  '自我认知',
  '行动',
  '目标明确',
  '状态',
  '感受',
  '观察',
  '方法论',
  '日记',
  '任务',
  '资料',
  '项目',
]);

const VAGUE_ACTION_PATTERNS = [
  /努力/,
  /全力/,
  /尽量/,
  /逐渐/,
  /充满能量/,
  /提升自己/,
  /提升效率/,
  /十足把握/,
  /找到一个方法/,
  /想办法/,
  /放手去做/,
  /想到什么就做什么/,
  /执行.*计划$/,
  /停止思考/,
  /^(准备|开始)?学习$/,
];

const CONCRETE_ACTION_PATTERNS = [
  /写/,
  /读/,
  /联系/,
  /发送/,
  /提交/,
  /报名/,
  /预约/,
  /咨询/,
  /购买/,
  /记录/,
  /列出/,
  /标注/,
  /比较/,
  /询问/,
  /设置/,
  /拆解/,
  /整理/,
  /制定/,
  /完成/,
  /搜索/,
  /试用/,
  /复习/,
  /练习/,
  /参加/,
  /选择/,
  /开始/,
  /学习/,
  /去/,
];

export function sanitizeTopics(topics: string[]): string[] {
  return [...new Set(
    topics
      .map((topic) => topic.trim())
      .filter((topic) => topic.length >= 2 && topic.length <= 12)
      .filter((topic) => !TOPIC_STOP_WORDS.has(topic)),
  )].slice(0, 3);
}

export function isConcreteAction(action: string): boolean {
  const text = action.trim();
  if (text.length < 4 || text.length > 80) return false;
  if (VAGUE_ACTION_PATTERNS.some((pattern) => pattern.test(text))) return false;
  return CONCRETE_ACTION_PATTERNS.some((pattern) => pattern.test(text));
}
