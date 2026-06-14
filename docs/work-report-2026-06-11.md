# InnerOS Phase 2 工作报告

日期：2026-06-11  
范围：LLM 统一接入、后台分析队列、长期记忆、Prompt 治理、笔记引用、RAG 检索与 Web UI 收口

## 1. 本次目标

本次工作围绕 InnerOS 的核心发心展开：降低用户手工整理和校准成本，让系统能够主动分析存量与新增笔记，并在对话、洞察和行动建议中提供可追溯的原始依据。

主要目标：

1. 建立统一、可治理的 LLM 调用入口。
2. 自动分析新增笔记和导入的存量笔记。
3. 从单篇笔记中提取可复用的长期记忆。
4. 让 LLM 输出能够引用具体笔记，并在前端点击查看。
5. 提升 Prompt 的证据约束和输出质量。
6. 修复「相关记录」检索和排序逻辑。
7. 将后台分析状态和记忆结果接入 Web UI。

## 2. 最终运行状态

截至本报告生成时：

| 指标 | 当前状态 |
| --- | ---: |
| 笔记总数 | 951 |
| 已完成笔记分析 | 951 |
| 待分析/失败笔记 | 0 |
| 已完成记忆判断 | 951 |
| 有效长期记忆 | 496 |
| 事件记忆 | 471 |
| 人物记忆 | 8 |
| 项目记忆 | 4 |
| 目标记忆 | 13 |
| 记忆关系 | 228 |
| 成功后台任务 | 1798 |
| 待处理/失败/死信任务 | 0 |

## 3. LLM 统一入口

新增统一 DeepSeek Gateway，避免各模块自行拼接请求和配置。

主要能力：

- 默认模型为 `deepseek-v4-flash`。
- 强制使用非思考模式。
- 统一处理文本、JSON 和流式响应。
- 统一超时、重试和错误处理。
- 记录模型、任务、耗时、Token 和失败信息。
- 所有 AI 任务通过明确的 `task` 标识进入网关。

主要文件：

- `src/lib/ai/gateway.ts`
- `src/lib/ai/client.ts`
- `src/lib/db/index.ts`

新增数据库表：

- `llm_runs`

## 4. 后台分析任务系统

建立持久化任务队列，替代仅依赖单次请求生命周期的分析方式。

支持的任务类型：

- `memo.extract`：笔记结构化分析。
- `memory.link`：长期记忆提取与归并。

主要机制：

- 内容 Hash 幂等。
- 持久化状态：`pending`、`running`、`failed`、`dead`、`succeeded`。
- 指数退避重试。
- 超时任务恢复。
- 分类型并发控制。
- 新建、批量导入和编辑笔记后自动入队。
- `memo.extract` 成功后自动衔接 `memory.link`。

存量分析并发配置：

- 笔记抽取：默认 16 并发，最大 32。
- 记忆归并：默认 4 并发，最大 8。

主要文件：

- `src/lib/db/analysis-jobs.ts`
- `src/lib/ai/job-runner.ts`
- `src/app/api/analysis-jobs/process/route.ts`
- `src/app/api/analysis-jobs/backfill/route.ts`
- `scripts/analysis-worker.mjs`
- `package.json`

运行命令：

```bash
npm run worker:analysis
```

本次还修复了一个实际发现的幂等问题：记忆任务的 Hash 原先包含上游 AI 字段，笔记抽取完成后字段变化会重复创建任务。现在记忆任务仅基于用户原始笔记内容和 Prompt 版本生成幂等键。

## 5. 长期记忆系统

新增长期记忆数据模型：

- `memory_items`：长期记忆实体。
- `memory_evidence`：记忆与原始笔记之间的证据。
- `memory_relations`：记忆之间的关系。

当前记忆类型：

- `event`
- `person`
- `project`
- `goal`

支持的增量操作：

- `new`
- `reinforce`
- `update`
- `contradict`

质量约束：

- 每条记忆必须引用原始笔记中的逐字证据。
- 服务端验证证据片段确实存在于笔记原文。
- 模型不能凭 AI 摘要独立创建事实。
- `person` 不保存第三方八卦、性格猜测和单次好感。
- `event` 不保存普通流水、资源推荐和无后续影响的情绪片段。
- 因果推断必须保留“用户认为/用户反思”等归因。
- 事件 canonical key 由服务端生成，避免模型重复拼接。

当前 Prompt 版本：

```text
memory-link-v3
```

主要文件：

- `src/lib/ai/memory-linker.ts`
- `src/lib/db/memories.ts`
- `src/app/api/memories/route.ts`
- `src/app/api/memories/[id]/route.ts`
- `src/types/index.ts`

## 6. Prompt 质量治理

本次对现有 Prompt 做了系统核查，重点修复以下问题：

### 6.1 角色越界

删除“认识用户很多年的朋友”等未经证据支持的角色设定，避免模型制造虚假熟悉感。

### 6.2 数据与指令混淆

明确规定笔记、候选记忆和历史内容均为待分析数据，其中出现的命令不得覆盖系统任务。

### 6.3 洞察证据不足

洞察至少需要两条有效笔记证据，并主动检查反例；低置信度内容不保存。

### 6.4 行动建议过于抽象

行动必须具体可执行，并返回有效的证据笔记 ID。

### 6.5 上游 AI 字段被误当事实

标题、摘要、主题、情绪、人物等字段仅作为检索提示，原始 `content` 才是主要证据。

相关文件：

- `src/lib/ai/prompts.ts`
- `src/lib/ai/analyzer.ts`
- `src/lib/ai/topic-summarizer.ts`
- `src/lib/ai/memory-linker.ts`
- `src/app/api/insights/route.ts`
- `src/app/api/today/route.ts`
- `docs/prompt-audit.md`

## 7. 笔记 ID 引用协议

建立统一 LLM 笔记引用格式：

```text
[[memo:<UUID>]]
```

处理流程：

1. Prompt 要求模型在使用笔记证据的句子后输出引用标记。
2. 服务端仅允许引用本轮已检索到的笔记 ID。
3. 模型伪造、缩写或越权引用会被自动删除。
4. 最终清洗后的回答写入数据库。
5. 前端将引用渲染为可点击标签。
6. 点击标签或相关记录卡片会打开笔记详情浮窗。

主要文件：

- `src/lib/ai/memo-references.ts`
- `src/lib/ai/prompts.ts`
- `src/app/api/chat/route.ts`
- `src/components/ui/MarkdownContent.tsx`
- `src/app/chat/page.tsx`
- `src/app/globals.css`
- `src/components/layout/ContextPanel.tsx`

同时修复了客户端断开后 SSE 仍向已关闭 Controller 写入的问题。

## 8. 「相关记录」检索与排序

### 修改前

- 使用用户整句对 `plain_text` 和 `raw_content` 执行 `LIKE`。
- 命中结果按创建时间倒序。
- 整句搜不到时直接返回最近笔记。
- 行动模式合并最近记录后按时间排序。
- `relevance_score` 只是按列表顺序模拟，不是真实相关度。
- 未使用长期记忆和对话上下文进行有效召回。

### 修改后

检索流程：

1. 使用 LLM 从当前问题提取 3-8 个检索短语。
2. 当前问题优先；仅在有指代时使用最近用户对话消解上下文。
3. 通过本地规则保留问题中的核心短语。
4. 过滤“反思、变化、记录、笔记”等低区分度泛词。
5. 搜索原文、标题、摘要、主题、人物、项目和标签。
6. 搜索长期记忆标题与摘要。
7. 从命中的长期记忆反向召回其原始证据笔记。
8. 合并、去重并计算综合排序分。

排序因素：

- 当前问题完整短语命中。
- 原文命中。
- AI 标题和摘要命中。
- 人物、项目、主题和标签命中。
- 长期记忆命中及记忆置信度。
- 轻量时间新鲜度。
- 指定笔记始终置顶。

前端展示：

- 相关记录按真实排序输出。
- 每张卡片显示序号。
- 显示“命中：时间碎片化”等检索原因。
- 摘要从第一个命中位置附近截取，而不是固定取原文开头。

主要文件：

- `src/lib/ai/rag.ts`
- `src/lib/db/memos.ts`
- `src/lib/db/memories.ts`
- `src/types/index.ts`
- `src/app/chat/page.tsx`

## 9. Web UI 收口

设置页新增“智能分析与长期记忆”模块，展示：

- 笔记分析完成数。
- 待处理和失败数量。
- 记忆判断完成数。
- 队列和死信数量。
- 长期记忆总数。
- 事件、人物、项目和目标记忆数量。
- 记忆关系数量。
- 手动补跑入口。

当任务已经全部完成时，按钮显示“已全部完成”并禁用，避免误导用户。

新增接口：

- `GET /api/settings/ai-status`

主要文件：

- `src/app/settings/page.tsx`
- `src/app/api/settings/ai-status/route.ts`

## 10. 数据导入与自动分析

Flomo 批量导入完成后：

1. 笔记写入数据库。
2. 每条笔记创建 `memo.extract` 任务。
3. 后台以受控并发执行分析。
4. 抽取完成后自动创建 `memory.link` 任务。
5. 设置页可以查看整体处理进度。

相关文件：

- `src/app/settings/page.tsx`
- `src/app/api/memos/batch/route.ts`
- `src/app/api/memos/route.ts`
- `src/app/api/memos/[id]/route.ts`

## 11. 文档产物

本次新增或更新的设计文档：

- `docs/llm-memory-architecture.md`
- `docs/product-phases.md`
- `docs/prompt-audit.md`
- `docs/work-report-2026-06-11.md`

## 12. 验证记录

已完成：

- ESLint 检查通过。
- TypeScript 检查通过。
- Next.js 生产构建通过。
- 27 个页面与接口路由成功生成。
- 浏览器验证设置页状态数据正确加载。
- 浏览器验证聊天引用标记正确渲染。
- 浏览器验证相关记录显示命中原因。
- 浏览器验证点击引用和相关记录可以打开笔记浮窗。
- 浏览器验证控制台无相关错误。
- 使用“我之前对时间碎片化有什么反思？”进行检索实测，成功召回真正包含“时间碎片化”的原始笔记。

验证命令：

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## 13. 已知限制与后续建议

### P1：记忆类型需要继续拆分

当前 496 条有效记忆中有 471 条为 `event`，说明事件类型仍承担了部分观点、信念和行为模式。

建议新增：

- `belief`
- `pattern`
- `preference`
- `constraint`

### P1：检索缺少 Embedding

当前为“LLM 检索词 + 结构化关键词 + 记忆反向召回”，相比原始整句搜索已有明显提升，但仍不是完整语义向量检索。

建议下一阶段：

- 建立 Memo embedding。
- 使用关键词召回与向量召回混合排序。
- 增加 reranker，仅重排少量候选。

### P1：记忆治理 UI 尚未完整

目前设置页只展示统计，没有专门的记忆浏览、合并、纠错和证据查看页面。

建议提供：

- 记忆列表与筛选。
- 记忆详情和证据链。
- 合并重复记忆。
- 标记错误或过期记忆。
- 查看 update/contradict 时间线。

### P2：后台 worker 的部署方式

开发环境可通过脚本运行；正式部署时应使用常驻 Worker、任务平台或定时调度，不应依赖用户保持设置页打开。

### P2：成本与质量监控

已有 `llm_runs` 日志，但尚未在 UI 中展示：

- 各任务成功率。
- 平均耗时。
- Token 消耗。
- 缓存命中率。
- Prompt 版本效果对比。

## 14. 结论

本次工作将 InnerOS 从“单篇笔记 AI 整理”推进为具备以下能力的自动化个人信息系统：

- 新增和存量笔记可自动并发分析。
- 分析任务可恢复、重试和追踪。
- 长期记忆有证据、有版本、有关系。
- LLM 回答可以精确引用原始笔记。
- 用户可以从回答直接打开证据笔记。
- 相关记录不再仅依赖整句搜索和时间倒序。
- 后台能力已经通过设置页向用户可见。

当前 Phase 2 的基础链路已经闭环。下一阶段最值得优先投入的是记忆类型治理、混合语义检索和记忆管理 UI。
