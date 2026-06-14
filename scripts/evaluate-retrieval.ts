import { searchRelevantMemos } from '../src/lib/ai/rag';

type EvaluationResult = Awaited<ReturnType<typeof searchRelevantMemos>>;

interface EvaluationCase {
  name: string;
  query: string;
  history?: Array<{ role: string; content: string }>;
  validate: (results: EvaluationResult) => string[];
}

function titles(results: EvaluationResult): string[] {
  return results.map((item) => item.memo.ai_title || '无标题');
}

function years(results: EvaluationResult): number[] {
  return [...new Set(results.map((item) => Number(item.memo.created_at.slice(0, 4))))];
}

const cases: EvaluationCase[] = [
  {
    name: '无答案枚举仍提供候选供 LLM 判断',
    query: '我养过哪些猫？',
    validate: (results) => results.length > 0
      ? []
      : ['高召回策略不应在本地层清空全部候选'],
  },
  {
    name: '无答案事实仍提供候选供 LLM 判断',
    query: '我获得过诺贝尔奖吗？',
    validate: (results) => results.length > 0
      ? []
      : ['高召回策略不应在本地层清空全部候选'],
  },
  {
    name: '行动转折召回直接证据',
    query: '我什么时候开始意识到恋爱不能只靠思考，要行动？',
    validate: (results) => {
      const actual = titles(results).slice(0, 5);
      return actual.some((title) => (
        title.includes('恋爱先行动再思考')
        || title.includes('从思考转向行动')
      ))
        ? []
        : [`前 5 条缺少直接证据：${actual.join('、')}`];
    },
  },
  {
    name: '变化问题覆盖早期和近期',
    query: '我对亲密关系的态度这几年发生了什么变化？',
    validate: (results) => {
      const actualYears = years(results);
      const errors: string[] = [];
      if (!actualYears.some((year) => year <= 2024)) errors.push('缺少 2024 年及以前的基线');
      if (!actualYears.some((year) => year >= 2026)) errors.push('缺少 2026 年近期状态');
      if (actualYears.length < 3) errors.push(`时间覆盖不足：${actualYears.join('、')}`);
      return errors;
    },
  },
  {
    name: '当前行动包含活跃目标',
    query: '我现在最值得推进的事情是什么？',
    validate: (results) => {
      const actual = titles(results);
      return actual.some((title) => title.includes('考研'))
        ? []
        : [`候选上下文缺少当前考研目标：${actual.join('、')}`];
    },
  },
  {
    name: '多轮指代继承上一问对象',
    query: '这件事里我反复担心什么？',
    history: [
      { role: 'user', content: '我和高智白的关系是怎样变化的？' },
      { role: 'assistant', content: '我们可以回看你和高智白关系的变化。' },
    ],
    validate: (results) => {
      const relevant = results.slice(0, 8).filter((item) => (
        `${item.memo.ai_title || ''} ${item.contextSnippet || ''}`.includes('高智白')
      ));
      return relevant.length >= 3
        ? []
        : [`前 8 条只有 ${relevant.length} 条明确关联高智白`];
    },
  },
  {
    name: '隐含语义召回低期待经验',
    query: '我有哪些记录是在说，期待越低反而表现越好？',
    validate: (results) => {
      const actual = titles(results).slice(0, 8);
      return actual.some((title) => title.includes('黄山') || title.includes('期待'))
        ? []
        : [`缺少低期待直接记录：${actual.join('、')}`];
    },
  },
  {
    name: '跨记录问题风险综合不被严格清空',
    query: '我经历的问题和风险是什么？我害怕什么？',
    validate: (results) => {
      const relevant = results.filter((item) => (
        /害怕|焦虑|风险|困境|无力|担心|恐惧|问题/.test(
          `${item.memo.ai_title || ''} ${item.memo.ai_summary || ''} ${item.contextSnippet || ''}`,
        )
      ));
      if (results.length < 8) return [`综合问题只召回 ${results.length} 条，覆盖不足`];
      return relevant.length >= 3
        ? []
        : [`相关问题/恐惧记录不足：${titles(results).slice(0, 8).join('、')}`];
    },
  },
];

async function main() {
  let failed = 0;
  for (const evaluation of cases) {
    const results = await searchRelevantMemos(
      evaluation.query,
      evaluation.history || [],
      16,
    );
    const errors = evaluation.validate(results);
    const status = errors.length === 0 ? 'PASS' : 'FAIL';
    console.log(`${status} ${evaluation.name}`);
    console.log(`  ${evaluation.query}`);
    console.log(`  ${results.length} 条：${titles(results).slice(0, 6).join('、') || '无'}`);
    for (const error of errors) console.log(`  - ${error}`);
    if (errors.length > 0) failed += 1;
  }
  console.log(`\n${cases.length - failed}/${cases.length} 项通过`);
  if (failed > 0) process.exitCode = 1;
}

void main();
