# InnerOS｜LLM 第二大脑笔记 Web 工作台 — 实现计划

## 概述

基于 PRD 构建一个全新的 InnerOS Web 应用。核心理念：**帮助用户从长期碎片化笔记中看见自己、理解自己，并在必要时将思考转化为行动**。

---

## PRD 微调说明

> [!IMPORTANT]
> 以下是对原始 PRD 的关键调整，请确认是否同意。

### 调整 1：技术栈选择
- **采用 Next.js 15 + React 19 + TypeScript**，与 PRD 一致
- **使用 Tailwind CSS v4 + shadcn/ui**，与 PRD 一致（用户明确指定）
- **状态管理：Zustand**，轻量且适合本项目规模
- **数据存储：MVP 阶段使用 SQLite（via better-sqlite3）**，替代 PostgreSQL
  - 理由：零配置、单文件、本地优先，完美契合「隐私第一」原则
  - 后续可迁移至 PostgreSQL + pgvector
- **向量搜索：MVP 阶段使用内存中余弦相似度**，后续可接入 pgvector
- **AI SDK：直接封装 OpenAI 兼容 API**，支持 OpenAI / Gemini / 本地模型

### 调整 2：MVP 导航精简
原 PRD 有 10 个一级导航，MVP 阶段精简为 **7 个**：

| 保留 | 说明 |
|------|------|
| ✅ 今日 | 每日入口，核心页面 |
| ✅ 记录 | Memo 流，核心页面 |
| ✅ 对话 | AI 对话，核心页面 |
| ✅ 主题 | 自动聚合主题空间 |
| ✅ 时间线 | 时间维度回看 |
| ✅ 洞察 | AI 提炼的稳定认知 |
| ✅ 设置 | 导入/模型/隐私设置 |

| 延后 | 理由 |
|------|------|
| ⏳ 项目 | P2 功能，依赖主题系统成熟 |
| ⏳ 人物 | P2 功能，隐私设计复杂 |
| ⏳ 资料库 | MVP 先在设置中处理导入 |

### 调整 3：AI 对话模式精简
MVP 先实现 **2 种对话模式**（回溯 + 行动），复盘和洞察模式延后到主题/洞察页面内嵌实现。

### 调整 4：色彩方案微调
PRD 的绿色主色（#35C986）偏鲜艳，微调为更沉稳的青绿色系：
- 主色：`#2DD4A8`（柔和青绿）
- 深主色：`#0D9373`
- 配合 `#FAFAF8` 暖白背景，营造「个人书房」感

---

## 项目结构

```
inneros/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # 根布局（左侧导航 + 右侧上下文栏）
│   │   ├── page.tsx                  # 今日页 (/)
│   │   ├── globals.css               # 全局样式 + 设计令牌
│   │   ├── records/
│   │   │   └── page.tsx              # 记录页
│   │   ├── chat/
│   │   │   └── page.tsx              # 对话页
│   │   ├── topics/
│   │   │   ├── page.tsx              # 主题列表页
│   │   │   └── [id]/
│   │   │       └── page.tsx          # 主题详情页
│   │   ├── timeline/
│   │   │   └── page.tsx              # 时间线页
│   │   ├── insights/
│   │   │   └── page.tsx              # 洞察页
│   │   ├── settings/
│   │   │   └── page.tsx              # 设置页（含导入）
│   │   └── api/
│   │       ├── memos/
│   │       │   └── route.ts          # Memo CRUD
│   │       ├── import/
│   │       │   └── route.ts          # 数据导入
│   │       ├── chat/
│   │       │   └── route.ts          # AI 对话
│   │       ├── topics/
│   │       │   └── route.ts          # 主题 API
│   │       ├── insights/
│   │       │   └── route.ts          # 洞察 API
│   │       ├── analyze/
│   │       │   └── route.ts          # AI 自动结构化
│   │       ├── search/
│   │       │   └── route.ts          # 语义搜索
│   │       └── export/
│   │           └── route.ts          # 数据导出
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx           # 左侧导航栏
│   │   │   ├── ContextPanel.tsx      # 右侧上下文栏
│   │   │   └── MobileNav.tsx         # 移动端底部导航
│   │   ├── memo/
│   │   │   ├── MemoCard.tsx          # Memo 卡片组件
│   │   │   ├── MemoDetail.tsx        # Memo 详情视图
│   │   │   ├── MemoEditor.tsx        # 快速记录编辑器
│   │   │   └── MemoFilters.tsx       # 筛选工具栏
│   │   ├── chat/
│   │   │   ├── ChatBubble.tsx        # 对话气泡
│   │   │   ├── ChatInput.tsx         # 输入框 + 快捷问题
│   │   │   ├── CitationCard.tsx      # 来源引用卡片
│   │   │   └── ChatHistory.tsx       # 历史对话列表
│   │   ├── topic/
│   │   │   ├── TopicCard.tsx         # 主题卡片
│   │   │   └── TopicTimeline.tsx     # 主题内时间线
│   │   ├── insight/
│   │   │   ├── InsightCard.tsx       # 洞察卡片
│   │   │   └── InsightFeedback.tsx   # 洞察反馈按钮
│   │   ├── timeline/
│   │   │   └── TimelineView.tsx      # 时间线视图组件
│   │   └── ui/
│   │       ├── EmotionBadge.tsx      # 情绪标签
│   │       ├── TagBadge.tsx          # 标签徽章
│   │       ├── SearchBar.tsx         # 搜索栏
│   │       └── LoadingSpinner.tsx    # 加载动画
│   ├── lib/
│   │   ├── db/
│   │   │   ├── index.ts             # 数据库初始化 & 迁移
│   │   │   ├── memos.ts             # Memo 数据操作
│   │   │   ├── topics.ts            # 主题数据操作
│   │   │   ├── insights.ts          # 洞察数据操作
│   │   │   └── conversations.ts     # 对话数据操作
│   │   ├── ai/
│   │   │   ├── client.ts            # AI API 客户端（OpenAI 兼容）
│   │   │   ├── embeddings.ts        # 嵌入向量生成
│   │   │   ├── analyzer.ts          # 自动结构化分析器
│   │   │   ├── prompts.ts           # Prompt 模板管理
│   │   │   └── rag.ts               # RAG 检索增强生成
│   │   ├── parsers/
│   │   │   ├── flomo.ts             # Flomo HTML 解析器
│   │   │   └── markdown.ts          # Markdown 解析器
│   │   ├── store/
│   │   │   ├── app.ts               # 全局应用状态
│   │   │   ├── memos.ts             # Memo 状态
│   │   │   └── chat.ts              # 对话状态
│   │   └── utils/
│   │       ├── date.ts              # 日期工具函数
│   │       ├── text.ts              # 文本处理
│   │       └── export.ts            # 导出工具
│   └── types/
│       └── index.ts                  # 全局类型定义
├── public/
│   └── fonts/                        # 本地字体文件（可选）
├── .data/                            # SQLite 数据库文件存放
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── next.config.ts
```

---

## 数据模型

### Memo（核心实体）

```typescript
interface Memo {
  id: string;                    // UUID
  raw_content: string;           // 原始内容（不可修改）
  plain_text: string;            // 纯文本版本
  created_at: string;            // 原始创建时间
  updated_at: string;            // 最后更新时间
  imported_at: string;           // 导入时间
  source: 'flomo' | 'markdown' | 'manual' | 'txt';
  source_id?: string;            // 原始源 ID（用于去重）

  // 用户原始标签
  original_tags: string[];

  // AI 生成字段（可编辑）
  ai_title?: string;
  ai_summary?: string;
  ai_category?: MemoCategory;
  ai_topics?: string[];          // 关联主题名
  ai_emotions?: EmotionType[];
  ai_people?: string[];
  ai_projects?: string[];
  ai_actions?: string[];         // 可行动事项
  ai_key_questions?: string[];   // 关键问题

  // 向量嵌入
  embedding?: number[];

  // 状态
  analysis_status: 'pending' | 'analyzing' | 'done' | 'failed';
  privacy_level: 'normal' | 'private' | 'hidden';
}

type MemoCategory = '方法论' | '感受' | '观察' | '项目' | '日记' | '摘录' | '任务' | '资料';
type EmotionType = '平静' | '有力量' | '焦虑' | '低落' | '迷茫' | '被认可' | '愤怒' | '喜悦';
```

### Topic（主题）

```typescript
interface Topic {
  id: string;
  name: string;
  description?: string;
  memo_count: number;
  first_seen_at: string;
  last_seen_at: string;
  summary?: string;
  key_questions?: string[];
  stable_insights?: string[];
  related_people?: string[];
  related_projects?: string[];
  emotion_trend?: { date: string; emotion: EmotionType }[];
  status: 'active' | 'dormant' | 'resolved';
}
```

### Conversation（对话）

```typescript
interface Conversation {
  id: string;
  title: string;
  mode: 'retrospect' | 'action';  // MVP 两种模式
  messages: ChatMessage[];
  referenced_memo_ids: string[];
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  source_type?: 'from_notes' | 'inference' | 'suggestion' | 'uncertain';
  created_at: string;
}

interface Citation {
  memo_id: string;
  memo_title?: string;
  memo_date: string;
  relevant_snippet: string;
  relevance_score: number;
}
```

### Insight（洞察）

```typescript
interface Insight {
  id: string;
  title: string;
  content: string;
  type: 'recurring_question' | 'methodology' | 'emotion_cycle' |
        'strength' | 'risk_pattern' | 'growth_evidence';
  confidence: 'high' | 'medium' | 'low';
  evidence_memo_ids: string[];
  created_at: string;
  user_feedback?: 'accurate' | 'somewhat' | 'inaccurate' | 'hidden';
  saved_as_principle: boolean;
}
```

---

## API 设计

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/memos` | 获取 Memo 列表（支持筛选、分页） |
| POST | `/api/memos` | 创建新 Memo |
| PUT | `/api/memos/[id]` | 更新 Memo |
| DELETE | `/api/memos/[id]` | 删除 Memo |
| POST | `/api/import` | 导入文件（flomo HTML / Markdown / TXT） |
| POST | `/api/chat` | AI 对话（流式响应） |
| GET | `/api/topics` | 获取主题列表 |
| GET | `/api/topics/[id]` | 获取主题详情 |
| POST | `/api/analyze` | 触发 AI 结构化分析 |
| POST | `/api/search` | 语义搜索 |
| GET | `/api/insights` | 获取洞察列表 |
| POST | `/api/insights/[id]/feedback` | 洞察反馈 |
| GET | `/api/export` | 导出全部数据 |
| GET | `/api/stats` | 获取统计数据（今日页用） |

---

## 分阶段实现计划

### Phase 1：项目基础 & 设计系统 🏗️

#### [NEW] 项目初始化
- 使用 `create-next-app` 创建 Next.js 15 项目
- 配置 TypeScript、Tailwind CSS v4、ESLint
- 安装核心依赖：`better-sqlite3`、`zustand`、`lucide-react`、`uuid`

#### [NEW] [globals.css](file:///Users/liuweixin/.gemini/antigravity/scratch/inneros/src/app/globals.css)
- 完整的 CSS 设计令牌系统
- 色彩系统：主色（青绿）、背景色（暖白/暗色）、文本色、情绪辅助色
- 字体系统：PingFang SC / system-ui 回退链
- 间距、圆角、阴影、动画关键帧
- 暗色/亮色模式变量

#### [NEW] [layout.tsx](file:///Users/liuweixin/.gemini/antigravity/scratch/inneros/src/app/layout.tsx)
- 三栏布局骨架：左导航(240px) + 主内容区(自适应) + 右上下文栏(320px, 可折叠)
- 响应式断点处理

#### [NEW] [Sidebar.tsx](file:///Users/liuweixin/.gemini/antigravity/scratch/inneros/src/components/layout/Sidebar.tsx)
- 品牌标识 + 7 个导航项
- 活跃状态指示
- 底部用户信息 + 设置入口
- Active Topics 快捷标签区

#### [NEW] [ContextPanel.tsx](file:///Users/liuweixin/.gemini/antigravity/scratch/inneros/src/components/layout/ContextPanel.tsx)
- 可折叠的右侧面板
- 根据当前页面/选中内容动态显示上下文

---

### Phase 2：数据层 & 导入 💾

#### [NEW] [src/lib/db/index.ts](file:///Users/liuweixin/.gemini/antigravity/scratch/inneros/src/lib/db/index.ts)
- SQLite 数据库初始化
- 自动建表 & 迁移
- 表结构：memos, topics, conversations, messages, insights

#### [NEW] [src/lib/parsers/flomo.ts](file:///Users/liuweixin/.gemini/antigravity/scratch/inneros/src/lib/parsers/flomo.ts)
- 完整的 Flomo HTML 解析器
- 提取：Memo 内容、时间、标签、图片引用、音频引用
- HTML 清理 & 纯文本转换
- 去重机制（基于内容 hash + 时间戳）

#### [NEW] [src/lib/db/memos.ts](file:///Users/liuweixin/.gemini/antigravity/scratch/inneros/src/lib/db/memos.ts)
- Memo CRUD 操作
- 复杂筛选：时间范围、标签、主题、情绪、分类、搜索关键词
- 分页支持
- 批量操作

#### [NEW] API Routes: `/api/memos`, `/api/import`

---

### Phase 3：核心页面 📱

#### [NEW] 今日页 (`/`)
- 问候语 + AI 状态摘要
- 快速记录输入框（视觉中心位置）
- 今日 Memo 列表
- 最近 7 天高频主题
- 今日建议回顾（旧笔记推荐）
- 最近沉淀的方法论

#### [NEW] 记录页 (`/records`)
- 顶部筛选工具栏：搜索、时间范围、标签、主题、情绪、分类
- 卡片流布局（支持时间倒序 / 主题聚合切换）
- Memo 卡片组件：时间、标签、AI 标题、摘要、情绪标签、操作按钮
- 点击卡片 → 右侧面板显示详情
- 批量选择 + 批量操作

#### [NEW] 对话页 (`/chat`)
- 左侧：对话历史列表 + 新建对话
- 中间：聊天窗口 + 输入框
- 右侧：引用笔记面板 + 推荐追问
- 快捷问题按钮
- 来源引用卡片（含 Memo 时间、标签、片段、跳转）
- 防幻觉标签：「来自笔记」「系统推断」「建议」「需要确认」

#### [NEW] 设置页 (`/settings`)
- 数据导入区（拖拽上传 + 解析预览 + 导入报告）
- AI 模型设置（API Key、模型选择、回答风格）
- 隐私设置
- 数据导出 & 清除
- 系统信息

---

### Phase 4：AI 能力集成 🤖

#### [NEW] [src/lib/ai/client.ts](file:///Users/liuweixin/.gemini/antigravity/scratch/inneros/src/lib/ai/client.ts)
- OpenAI 兼容 API 客户端
- 支持 OpenAI / Gemini / 自定义端点
- 流式响应支持
- 错误处理 & 重试

#### [NEW] [src/lib/ai/analyzer.ts](file:///Users/liuweixin/.gemini/antigravity/scratch/inneros/src/lib/ai/analyzer.ts)
- 自动结构化分析：标题、摘要、分类、主题、情绪、人物、项目、行动项
- 批量分析队列
- 关联旧笔记识别

#### [NEW] [src/lib/ai/rag.ts](file:///Users/liuweixin/.gemini/antigravity/scratch/inneros/src/lib/ai/rag.ts)
- RAG 检索管道：向量检索 + 关键词检索 + 时间过滤
- 混合排序
- 来源引用生成
- 上下文窗口管理

#### [NEW] [src/lib/ai/prompts.ts](file:///Users/liuweixin/.gemini/antigravity/scratch/inneros/src/lib/ai/prompts.ts)
- 系统 Prompt：第二大脑人设（温和、不催促、基于用户笔记）
- 回溯模式 Prompt
- 行动模式 Prompt
- 自动分析 Prompt
- 洞察生成 Prompt

---

### Phase 5：高级页面 🌟

#### [NEW] 主题页 (`/topics` + `/topics/[id]`)
- 主题列表：卡片网格，每张含主题名、Memo 数、时间范围、情绪趋势小图
- 主题详情页：
  - 顶部：名称、摘要、时间范围、Memo 数、情绪趋势
  - Tab：总览 / 时间线 / 关键笔记 / 洞察 / 行动
  - 右侧：高频关键词、相关人物/项目

#### [NEW] 时间线页 (`/timeline`)
- 视图切换：日 / 周 / 月
- 横向时间轴 + 卡片瀑布流
- 重要节点高亮（观点转折、项目启动、方法论形成）
- 月度复盘生成按钮

#### [NEW] 洞察页 (`/insights`)
- 洞察卡片网格：
  - 反复出现的问题
  - 已验证的方法论
  - 情绪周期
  - 成长证据
  - 风险模式
- 每条洞察：标题、解释、证据来源、反馈按钮
- 本周洞察摘要

---

### Phase 6：输出 & 打磨 ✨

#### 写作与输出
- 选择笔记/主题/时间段 → 生成输出
- 输出类型：周复盘、月复盘、方法论文档
- 追问式修改（更简短、更真诚、更像我）
- Markdown 导出

#### 交互打磨
- 页面切换动画
- Memo 卡片 hover 效果（轻微上浮 + 边框变色）
- 选中状态（左侧主色竖线）
- 骨架屏加载
- Toast 通知

#### 隐私增强
- 安全显示模式（模糊敏感内容）
- 人物名称脱敏

---

## 设计系统详情

### 色彩令牌

```css
/* 亮色模式 */
--color-primary: #2DD4A8;        /* 青绿主色 */
--color-primary-dark: #0D9373;   /* 深主色 */
--color-primary-light: #ECFDF5;  /* 浅主色背景 */

--color-bg-page: #FAFAF8;        /* 页面暖白背景 */
--color-bg-card: #FFFFFF;        /* 卡片白色背景 */
--color-bg-secondary: #F5F5F0;   /* 二级背景 */
--color-bg-sidebar: #F8F8F5;     /* 侧边栏背景 */

--color-text-primary: #1F2328;   /* 主文本 */
--color-text-secondary: #6B7280; /* 次级文本 */
--color-text-muted: #9CA3AF;     /* 弱提示文本 */

/* 情绪色 */
--color-emotion-calm: #DBEAFE;     /* 平静：浅蓝 */
--color-emotion-power: #D1FAE5;    /* 有力量：浅绿 */
--color-emotion-anxiety: #FEF3C7;  /* 焦虑：浅琥珀 */
--color-emotion-down: #EDE9FE;     /* 低落：浅紫 */
--color-emotion-confused: #E0E7FF; /* 迷茫：浅雾蓝 */

/* 暗色模式 */
--color-bg-page-dark: #111315;
--color-bg-card-dark: #1A1D21;
--color-bg-sidebar-dark: #0D0F12;
```

### 字体系统

```css
--font-sans: 'PingFang SC', 'Microsoft YaHei UI', system-ui, -apple-system, sans-serif;
--font-mono: 'SF Mono', 'Fira Code', monospace;

/* 字号阶梯 */
--text-page-title: 28px / 36px;   /* 页面标题 */
--text-section: 20px / 28px;      /* 模块标题 */
--text-card-title: 16px / 24px;   /* 卡片标题 */
--text-body: 15px / 26px;         /* 正文 */
--text-memo: 15px / 28px;         /* Memo 内容（更宽松行高） */
--text-caption: 13px / 20px;      /* 辅助说明 */
--text-tiny: 11px / 16px;         /* 极小标注 */
```

### 组件圆角 & 阴影

```css
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 16px;
--radius-xl: 20px;

--shadow-card: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02);
--shadow-card-hover: 0 4px 12px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.03);
--shadow-float: 0 8px 24px rgba(0,0,0,0.08);
```

---

## 用户审核事项

> [!WARNING]
> 请确认以下决策：

1. **是否同意使用 SQLite 替代 PostgreSQL？** SQLite 更适合单用户本地部署场景，零配置。
2. **是否同意 MVP 阶段精简导航为 7 项？** 延后项目页、人物页、资料库页。
3. **MVP 是否先做亮色模式？** 暗色模式可作为 Phase 6 或后续迭代。
4. **AI API Key 由用户自行提供？** 即系统不内置 AI 额度，用户配置自己的 OpenAI/Gemini Key。
5. **你有 Flomo 的导出 HTML 文件可以测试吗？** 如果有，请提供样本结构以便精准适配解析器。

## 开放问题

> [!IMPORTANT]
> 以下问题可能影响实现细节：

1. **部署方式偏好？** Vercel / Railway / 纯本地 `npm run dev`？这影响 SQLite vs PostgreSQL 的选择（Vercel 无法持久化 SQLite 文件）。
2. **移动端适配的优先级？** MVP 是否需要响应式设计，还是先专注桌面端？
3. **对话流式输出？** AI 回答是否需要打字机效果（流式 SSE），还是等待完整回答？

---

## 验证计划

### 构建验证
```bash
npm run build    # 确保 TypeScript 编译通过、无构建错误
npm run lint     # ESLint 检查
```

### 功能验证
- [ ] 成功导入 Flomo HTML 文件
- [ ] Memo 列表正确展示、筛选、搜索
- [ ] 快速记录功能正常
- [ ] AI 对话能基于笔记回答并展示来源
- [ ] 主题自动聚合正确
- [ ] 时间线按月展示
- [ ] 洞察页展示 AI 提炼内容
- [ ] 数据导出为 JSON/Markdown
- [ ] 暗色模式切换

### UI/UX 验证
- [ ] 整体视觉温暖、克制、有呼吸感
- [ ] Memo 阅读体验舒适（行高、最大宽度）
- [ ] 三栏布局大屏下清晰
- [ ] 右侧上下文栏可折叠
- [ ] 页面无「后台系统感」
- [ ] 卡片交互流畅（hover、选中、引用标记）
