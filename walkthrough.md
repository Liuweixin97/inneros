# InnerOS MVP 交付文档

InnerOS 是一个本地优先的第二大脑 Web 工作台，基于 Next.js 16、React 19、TypeScript、SQLite 和 OpenAI-compatible AI API 构建。本次续开发恢复了前序 AI 截断造成的源码损坏，并补齐 MVP 所需页面、API 路由和数据闭环。

## 本次完成范围

### 核心页面

- `/` 今日页：快速记录、最近记录、统计与快捷入口。
- `/records` 记录页：笔记列表、搜索、分类/情绪/标签筛选、新建记录、右侧详情抽屉。
- `/chat` 对话页：对话历史、回溯/行动模式、SSE 流式回答、引用依据栏。
- `/topics` 主题页：主题列表、搜索、计数、时间范围。
- `/topics/[id]` 主题详情页：主题概览、关联笔记、删除主题。
- `/timeline` 时间线页：按月/周聚合回看笔记。
- `/insights` 洞察页：生成洞察、反馈准确性、保存为准则、删除洞察。
- `/settings` 设置页：数据库统计、AI 环境变量提示、亮/暗色切换、JSON 导出、清除数据。

### API 路由

- `GET/POST /api/memos`
- `GET/PUT/DELETE /api/memos/[id]`
- `GET/POST /api/conversations`
- `GET/DELETE /api/conversations/[id]`
- `POST /api/chat`
- `POST /api/analyze`
- `GET /api/topics`
- `GET/DELETE /api/topics/[id]`
- `GET/POST /api/insights`
- `GET/PATCH/DELETE /api/insights/[id]`
- `GET /api/stats`
- `GET /api/export`
- `POST /api/clear-data`
- `GET /api/settings/ai-config`
- `POST /api/settings/clear-data`

### 数据层

- SQLite 初始化、建表、WAL 和外键开启。
- Memo CRUD、筛选、统计。
- Conversation 与 Message 持久化。
- Insight CRUD、反馈与保存准则状态。
- Topic 查询、删除，以及从已分析笔记的 `ai_topics` 自动重建主题计数和时间范围。

### AI 能力

- OpenAI-compatible 客户端，支持非流式和流式聊天补全。
- Memo 自动结构化分析：标题、摘要、分类、主题、情绪、人物、项目、行动项、关键问题。
- RAG 对话：检索相关笔记作为上下文，并返回引用。
- 洞察生成：基于最近 30 条笔记生成反复问题、方法论、情绪周期、优势、风险模式和成长证据。

## 修复的截断问题

前序开发中以下文件被截断并以字符串残片形式写入，已重建为正常源码：

- `src/components/layout/ContextPanel.tsx`
- `src/components/memo/MemoDetail.tsx`
- `src/components/memo/MemoFilters.tsx`
- `src/app/records/page.tsx`
- `src/app/chat/page.tsx`
- `src/app/topics/page.tsx`
- `src/app/topics/[id]/page.tsx`
- `src/app/timeline/page.tsx`
- `src/app/insights/page.tsx`
- `src/app/settings/page.tsx`
- `src/app/api/insights/route.ts`
- `walkthrough.md`

同时补齐了缺失的动态路由：

- `src/app/api/memos/[id]/route.ts`
- `src/app/api/conversations/[id]/route.ts`
- `src/app/api/topics/[id]/route.ts`
- `src/app/api/insights/[id]/route.ts`

## 运行方式

```bash
npm install
npm run dev
```

默认开发地址：`http://localhost:3000`

AI 功能需要在 `.env.local` 中配置：

```bash
AI_BASE_URL=https://api.deepseek.com
AI_API_KEY=your_api_key
AI_MODEL=deepseek-v4-flash
```

如果不配置 `AI_API_KEY`，普通记录、筛选、时间线、导出等本地功能可用，但自动分析、洞察生成和 AI 对话会返回配置错误。

## 验证结果

已执行并通过：

```bash
npm run lint
npm run build
```

生产构建结果包含 21 个 App Router 页面/路由，所有页面完成静态生成或动态路由注册。

## 已知取舍

- MVP 使用 SQLite 单文件数据库，适合本地优先验证；后续可迁移 PostgreSQL/pgvector。
- 主题表目前从已分析笔记重建，优先保证计数准确；主题摘要等高级字段后续可通过单独主题分析任务生成。
- 设置页展示服务端 AI 环境变量状态，运行时修改 `.env.local` 后仍需重启开发服务。
