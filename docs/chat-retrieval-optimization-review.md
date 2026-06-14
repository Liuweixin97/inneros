# 对话笔记召回优化评审

**日期**：2026-06-12  
**问题核心**：对于准确查找困难的问题，缺乏有效的上下文；跨多 Memo 的综合问题处理能力不足

---

## 一、当前检索链路分析

### 1.1 整体流程
```
用户问题
  ↓
chat/route.ts → 获取最近 20 条对话历史（5 条用户消息）
  ↓
generateRAGResponse(query, history)
  ↓
searchRelevantMemos(query, history, limit=16)
  ├─ buildRetrievalPlan(query, recentUserContext)  // 仅取最近 4 条用户消息
  │   └─ rag.query 任务解析：exactTerms, semanticTerms, intent, timeScope
  ├─ searchMemosByTerms()        // LIKE 模糊查询
  ├─ searchMemosByEmbedding()    // 向量相似性
  ├─ searchMemoryEvidenceByTerms() // 记忆库关键词
  ├─ getRecentActionMemos()      // 最近行动类笔记（仅 action/current）
  └─ getCurrentMemoryEvidence()  // 当前状态记忆
  ↓
rerankResults() → 重排（Rerank API 或 LLM 重排）
  ↓
buildContext(results) → 拼接上下文（16k 字符预算）
  ↓
generateRAGResponse() → LLM 流式回答
```

---

## 二、主要问题诊断

### 问题 1：准确查找困难时缺乏降级策略

**症状**：
- 用户问"我什么时候开始头疼"，LLM 回答"没找到相关记录"
- 实际笔记里有"最近头晕"、"颈椎不适"等表述，但都没被召回

**根本原因**：
1. **检索规划过度依赖 LLM**
   - `buildRetrievalPlan()` 调用 `rag.query` 任务，生成 `exactTerms/semanticTerms`
   - 如果该任务失败或规划不准，后续搜索就走偏
   - 本地回退 `fallbackPlan()` 太简单，只做正则 + 本地二元语法切割

2. **多源检索的分值融合不合理**
   - `searchMemosByTerms()` 得分主要靠 term 匹配数量和类型（entity > exact > semantic）
   - `searchMemosByEmbedding()` 得分是 `7 + similarity * 18`，引入后加权 `* 0.38`
   - 当 term 匹配和语义相似都不高时，两个来源都给出低分，最终结果空或质量差

3. **信息不足时没有"宽松搜索"策略**
   - 不管检索到几条结果，都直接用最多 16 条送入 LLM
   - 如果排名前 16 名的都不够相关，LLM 基于这些信息生成的答案就不准确
   - 缺少"如果前 N 条结果分数都太低，就扩大搜索范围"的逻辑

4. **时间范围过严格**
   - 对 `action/current` 类型的查询，有 400 天的时间门槛
   - 用户问"我历史上有没有这个问题"时可能被误判为 current，导致漏掉老记录

**影响**：对于表述多样、缺乏标准关键词的个人记录，检索成功率低。

---

### 问题 2：跨多 Memo 的综合问题无法有效处理

**症状**：
- 用户问"我最近在项目 X 上遇到的主要阻力是什么"
- LLM 分别返回"时间压力""与 Y 沟通困难"等孤立的笔记引用，但没有综合视角
- 或者因为相关笔记分散在多个 memo，被去重或排序后反而被截断

**根本原因**：

1. **检索阶段没有"话题聚类"**
   - `searchMemosByTerms()` 和 `searchMemosByEmbedding()` 都是单 memo 排序
   - 没有"同一话题下的相关 memo 分组"逻辑
   - 当需要 5-8 条相关 memo 才能完整回答时，可能因单条 memo 得分不高而被排出前 16

2. **去重机制过激**
   - `deduplicateResults()` 按"标准化内容"去重，防止相同 memo 内容重复出现
   - 但对于同一话题的不同侧面（例如"项目 X 的成本""项目 X 的时间压力"），两条独立 memo 内容不同但都有价值
   - 如果这两条 memo 的标题相似或摘要相近，可能被误认为重复而丢掉一条

3. **上下文构建是线性拼接**
   - `buildContext()` 只是按分数从高到低排列
   - 多个相关 memo 之间没有"概念连接"或"对比/因果关系"说明
   - LLM 看到的是平铺的证据，而不是"哪几条 memo 是同一事件的不同角度"

4. **记忆库搜索范围太窄**
   - `searchMemoryEvidenceByTerms()` 只根据 term 查记忆库中的证据
   - 如果某个话题的核心记忆没有被打上相关标签，就无法通过记忆库扫出相关 memo
   - 缺少"从已知 memo 出发，扩展到相关的其他 memo"的能力

5. **Intent 判断不考虑"综合"问题**
   - 当前 intent 只有：fact, person, list, timeline, change, pattern, action, general
   - 没有"synthesis"或"cross-memo-analysis"的 intent 类型
   - 导致跨 memo 综合问题被当作 general，使用通用的检索排序，而不是针对性的聚类排序

**影响**：复杂问题（特别是需要多个角度理解的问题）的回答质量低，显得上下文"碎片化"。

---

### 问题 3：对话历史信息利用不足

**症状**：
- 在一个对话中，先问"我的项目 X 怎么样"，后问"这个阻力还存在吗"
- 第二个问题中的"这个"指的是前一个回答中的某个 memo，但 LLM 检索时没有充分利用会话上下文
- 导致要么重复前面的 memo，要么找到错误的相关记录

**根本原因**：

1. **buildRetrievalPlan 用的上下文太少**
   - 仅取 `recentUserContext = conversationHistory.filter(m => m.role === 'user').slice(-4)`
   - 没有引入 assistant 的历史回答和引用的 memo ID
   - 对话摘要未被传入，所以对"对话主题"没有认知

2. **focusedMemoId 机制不完整**
   - `generateRAGResponse()` 接受 `focusedMemoId?` 参数，但 chat/route.ts 没有自动填充
   - 用户必须手动点击某个 memo 才会设置，否则检索不知道当前对话在讨论哪个 memo

3. **Conversation summary 存在但未被充分利用**
   - DB 层存有 `conversation.summary` 和 `conversation.title`，但 RAG 流程没有引用
   - 即使 summary 包含"我和 Y 讨论项目 X"，buildRetrievalPlan 也不知道这信息

**影响**：对话式多轮交互效果打折，后续问句容易"跑题"或重复。

---

### 问题 4：语义检索的有效范围有限

**症状**：
- 问"我如何看待失败"，embedding 检索很难命中"挫折记录""项目没完成"等表述
- 或者通过 embedding 找到不相关的情绪记录，分值虚高

**根本原因**：

1. **Embedding 维度和模型基于通用数据**
   - 用的是阿里云通用 text-embedding-v4，1024 维
   - 个人的私密表述习惯、术语、缩写等可能被压成通用向量空间中的"无意义方向"

2. **Chunk 划分不适合对话式检索**
   - memo_chunks 是固定大小切割的
   - 对于篇幅小的 memo（个人笔记的多数），可能整个 memo 只成为一个 chunk
   - 当问题只匹配 memo 的一部分主题时，整 chunk 的相似度虚高

3. **Query embedding 与 memo 的表述习惯不对齐**
   - 用户自然问题（口语化、带疑问词）与笔记原文（记录式、叙述式）的语义距离大

**影响**：embedding 召回的准确率和覆盖率都不理想，特别是对个性化表述。

---

## 三、优化方案

### 方案 A：增强检索规划与降级策略（优先级 ★★★★★）

**目标**：提高"表述多样、难精准定位"的问题的检索成功率

**改动点**：

#### A1. 扩展检索规划输入
**文件**：`src/lib/ai/rag.ts` - `buildRetrievalPlan()`

改动：
- 签名改为 `buildRetrievalPlan(query, conversationHistory, conversationSummary?, previousCitations?)`
- 在 prompt 中增加上下文：
  ```
  当前对话摘要（如果存在）: {conversationSummary}
  
  此前在当前对话中引用过的笔记 (最近 3 条):
  - 笔记 ID: xxx, 标题: yyy, 主要人物: zzz
  
  用户最近 8 条消息（按时间顺序）:
  [保留对话主题线索]
  ```
- LLM 输出增加：`referenced_memo_ids: [] // 此前引用过的 memo，应优先保留`

**效果**：
- 指代消解更准
- 对话连续性更好
- LLM 可输出"这次应该复用哪些前面的 memo"

#### A2. 实现两阶段降级搜索
**文件**：`src/lib/ai/rag.ts` - `searchRelevantMemos()`

改动：
```typescript
// 阶段 1：精准搜索（现有逻辑）
const rigidResults = performPreciseSearch(query, plan, 60);

// 阶段 2：如果结果太少或质量不高，触发宽松搜索
if (rigidResults.filter(r => r.score >= 10).length < 3 || rigidResults.length === 0) {
  const relaxedPlan = fallbackToRelaxedPlan(query, plan);
  const relaxedResults = performRelaxedSearch(query, relaxedPlan, 60);
  // 合并两个结果，降级结果加小幅权重
  results = mergeDiffQualityResults(rigidResults, relaxedResults);
}

// 阶段 3：检查是否有话题聚类机会
const clustered = clusterByTopic(results, plan);
results = selectFromClusters(clustered, 16);
```

**宽松搜索的特点**：
- 扩大时间范围（如果原来是 current 或 recent，改成 all）
- 降低 term 匹配的要求（semantic_terms 加权更少）
- 增加向量相似性的权重
- 不做 rerank，直接基于原始分值

**话题聚类的特点**：
- 同组 memo 共享 people/projects/topics，优先保留
- 分组内可有最多 3 条 memo
- 确保前 16 条结论中，话题覆盖更广

#### A3. 改进时间范围判断
**文件**：`src/lib/ai/rag.ts` - `inferTimeScope()`

改动：
- 不仅看 query 中的时间词汇
- 也看 `conversationHistory` 中是否有明确的时间指代
- 对跟进问题（如"这个""那时候""现在对比""还是"），假设与前一个问题同时间范围
- 保守起见，除非问题明确说"最近"，否则 default 用 all

---

### 方案 B：跨 Memo 综合能力增强（优先级 ★★★★☆）

**目标**：对需要多个 memo 才能完整回答的问题，改善上下文的"内聚性"和"逻辑性"

**改动点**：

#### B1. 在检索规划中加入"综合问题"intent
**文件**：`src/lib/ai/rag.ts` - `buildRetrievalPlan()`

改动：
- Intent 类型增加 `synthesis`
- 检测逻辑：
  ```
  if (query.includes('最主要的') 
      || query.includes('综合来看') 
      || /跨.*(话题|项目|人物|领域)/g.test(query)
      || plan.people.length >= 2 || plan.projects.length >= 2) {
    intent = 'synthesis';
  }
  ```
- 返回 `groupByEntity: true // 告诉后续按人/项目/话题分组`

#### B2. 实现话题/人物/项目的分组检索
**文件**：`src/lib/ai/rag.ts` - `searchRelevantMemos()`

改动：
```typescript
// 如果是 synthesis intent，改用分组策略
if (plan.intent === 'synthesis') {
  const groups = {
    byPeople: {} as Record<string, RetrievedMemo[]>,
    byProject: {} as Record<string, RetrievedMemo[]>,
    byTopic: {} as Record<string, RetrievedMemo[]>,
  };
  
  // 为每个 person/project/topic 分别做搜索
  for (const person of plan.people) {
    groups.byPeople[person] = searchMemosByTerms(
      `${query} ${person}`, 
      [{ value: person, kind: 'entity' }], 
      8
    );
  }
  
  // 聚合、去重、排序
  const aggregated = aggregateGroupedResults(groups, limit: 16);
  results = aggregated;
}
```

#### B3. 改进 buildContext 的结构性
**文件**：`src/lib/ai/rag.ts` - `buildContext()`

改动：
```typescript
// 当结果超过 6 条时，按来源和逻辑分组呈现
if (results.length > 6) {
  const grouped = groupByContextType(results);
  // "直接证据"(focused, query) 优先
  // "关联证据"(memory) 次之
  // "语义相关"(vector) 最后
  return buildGroupedContext(grouped);
}
```

新的上下文格式：
```
【核心问题相关的直接记录】
笔记 ID: xxx
...

【相关的其他角度】
笔记 ID: yyy (与上面涉及同一人物 X)
...

【参考的长期记忆】
（记忆库中关于 X 的历史观察）
```

#### B4. 增强去重逻辑
**文件**：`src/lib/ai/rag.ts` - `deduplicateResults()`

改动：
- 不只对内容完全相同的去重
- 引入"概念去重"：如果两条 memo 的标题/摘要实际上是同一事件的不同时态（"做项目"vs"项目完成""项目失败"），但表述不同，则在综合问题下保留两条（而不是去重一条）
- 引入"临界值"：只有当两条记录内容相似度 > 0.95 且时间距离 < 1 天时才去重（现在是更激进地 normalize 后去重）

---

### 方案 C：对话历史信息充分利用（优先级 ★★★☆☆）

**目标**：在多轮对话中保持上下文连贯，减少重复和跑题

**改动点**：

#### C1. 自动传递 focusedMemoId
**文件**：`src/app/api/chat/route.ts`

改动：
```typescript
// 从前一个 assistant 消息的 citations 中提取
let focusedMemoId = body.memo_id; // 用户显式指定的
if (!focusedMemoId && convData?.messages) {
  const lastAssistantMsg = convData.messages.findLast(m => m.role === 'assistant');
  if (lastAssistantMsg?.citations?.length > 0) {
    // 取得分最高的 memo 作为 focused
    focusedMemoId = lastAssistantMsg.citations[0].memo_id;
  }
}

// 传给 RAG
const rag = await generateRAGResponse(
  query, history, 'unified', focusedMemoId, body.thinking ? 'enabled' : 'disabled'
);
```

**效果**：
- 用户不需要手动点击，自动继续上个话题
- 即使切换话题，也能通过新问题的 intent 准确切换

#### C2. 在检索规划中融入会话摘要
**文件**：`src/lib/ai/rag.ts` - `buildRetrievalPlan()`

改动：
```typescript
async function buildRetrievalPlan(
  query: string,
  conversationHistory: Array<{role: string; content: string}>,
  conversationSummary?: string,  // 新参数
) {
  // 如果有 summary，加入 prompt context
  const summaryContext = conversationSummary 
    ? `当前对话主题：${conversationSummary}\n\n`
    : '';
  
  const recentUserContext = [...];
  
  const completion = await complete({
    messages: [
      {
        role: 'system',
        content: `...原有 prompt...\n\n${summaryContext}...`,
      },
      ...
    ],
  });
}
```

#### C3. 提前生成或更新对话摘要
**文件**：`src/lib/ai/conversation-summarizer.ts` - 改进 `summarizeConversation()`

改动：
- 不仅在特定消息数时生成摘要，而是 eager：每 5 条消息就更新一次
- 摘要格式改为：`{主题/人物概览}；{最新状态或问题}`，这样可直接塞入检索规划

---

### 方案 D：增强语义检索的个性化（优先级 ★★☆☆☆）

**目标**：让 embedding 检索更贴合个人笔记的表述习惯

**改动点**：

#### D1. Query 正规化
**文件**：`src/lib/ai/rag.ts` - `searchRelevantMemos()`

改动：
```typescript
// 在生成 query embedding 前，进行"去修饰"处理
const normalizedRetrievalQuery = normalizeQueryForEmbedding(retrievalQuery);
// 移除"我""怎么""是什么""有什么"等高频修饰词
// 改 "我最近怎么看待失败" → "失败 意义 看法"

const queryEmbedding = isEmbeddingEnabled()
  ? await createEmbedding(normalizedRetrievalQuery)
  : null;
```

#### D2. 增加反向检索
**文件**：`src/lib/db/memos.ts` - 扩展 searchMemosByEmbedding()`

改动：
- 对每个 memo 的 ai_title + ai_summary 也生成 embedding
- 用 query embedding 同时与 memo_chunks 和 memo_metadata_embeddings 做相似性计算
- 提高 memo metadata（标题、摘要、标签）匹配中等相似度（0.5-0.7）的结果权重

#### D3. 引入查询扩展
**文件**：`src/lib/ai/rag.ts` - 可选

改动（仅当 embedding 结果 < 5 条时）：
```typescript
if (embeddingResults.length < 5 && isEmbeddingEnabled()) {
  // 让 LLM 生成 3-5 个同义表述
  const expansions = await expandQuerySemantics(retrievalQuery);
  
  for (const expansion of expansions) {
    const expandedEmbedding = await createEmbedding(expansion);
    const moreResults = await searchMemosByEmbedding(expandedEmbedding, 8, 0.30);
    embeddingResults.push(...moreResults);
  }
  
  // 去重、重新排序
  embeddingResults = deduplicateResults(embeddingResults)
    .sort((a, b) => b.score - a.score);
}
```

---

## 四、实施路线图

### 第 1 阶段（1-2 周）：快速胜利
主要改动：**方案 A1 + A2 + C1**

- 扩展 buildRetrievalPlan 的输入参数，引入对话摘要和前次引用
- 实现两阶段降级搜索（精准 → 宽松）
- 自动填充 focusedMemoId

**预期效果**：
- 检索召回率 +15-20% （特别是对表述多样的问题）
- 对话内重复引用率 -30%
- 实现难度：中等，不需要大的数据结构改动

### 第 2 阶段（2-3 周）：关键功能完善
主要改动：**方案 B1 + B2 + B3**

- 新增 synthesis intent，分组检索策略
- 改进 buildContext 的结构化输出
- 完善去重逻辑

**预期效果**：
- 跨多 memo 问题的回答质量 +25-35%
- 对话复杂度提升，能处理"综合对比""关联分析"等问题
- 实现难度：中等偏高，需要调整 context 结构

### 第 3 阶段（可选，1-2 周）：精细调优
主要改动：**方案 C2 + D1 + D2**

- 会话摘要融入检索规划
- Query 正规化和反向 embedding 检索
- 考虑查询扩展（仅当效果不理想时）

**预期效果**：
- 语义检索精度 +10-15%
- 对话连贯性进一步改善
- 实现难度：低到中等

---

## 五、关键度量指标

建议添加以下可观测的指标来评估优化效果：

### 检索阶段
- `retrieval_success_rate`: 检索是否返回 > 0 条结果
- `top_result_relevance`: 前 3 条结果的相关性评分（0-100）
- `multi_memo_hit_rate`: 需要 > 2 条 memo 的问题，是否都被召回

### 对话阶段
- `cross_turn_reference_rate`: 当前回答中引用前一轮 memo 的比例
- `duplicate_reference_rate`: 同一 memo 在短期内被重复引用的比例

### LLM 响应质量
- `answer_completeness`: "需要多个角度"的问题，LLM 是否涵盖了主要角度
- `context_utilization`: LLM 引用并使用的上下文比例（vs 忽视的）

---

## 六、可选的更长期改进

1. **Fine-tune embedding 模型**：基于用户笔记库的标注数据，微调文本编码器
2. **构建显式的 memo 关联图**：人工或 LLM 标注"这两条 memo 是同一事件的不同侧面"，在检索时利用图关系
3. **引入用户反馈循环**：用户标记"这个检索结果不相关"或"应该找到的但没找到"，用于模型优化
4. **多语言和方言支持**：对用户混用中文、英文、方言的笔记库，改进检索

---

## 七、总结

现有检索系统的核心优势：
- 多源融合（term + embedding + memory + recent）
- 结构化规划（intent 判断、term 生成）
- 灵活的 rerank 机制

主要不足：
- 缺乏降级和扩展机制，对"难以精准表述"的问题效果差
- 缺少话题/人物/项目维度的分组和聚类，跨 memo 综合能力弱
- 对话历史利用不充分，多轮对话容易偏离或重复

**优先实施方案 A（检索规划 + 降级策略）** 能最快提升核心问题的解决率，预期投入产出比最高。后续可根据效果和用户反馈，选择性地推进方案 B/C。
