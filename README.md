# InnerOS

InnerOS 是一个面向个人记忆的本地应用。它把日常记录、摘录、感受和对话保存下来，再以两种方式重新呈现：一个清晰的记忆管理系统，以及一个可漫游的像素风「林间世界」。

项目的发心是「看见自己」。AI 不替用户定义人生意义，不把记录改写成结论，也不制造成长压力。它只在被邀请时陪伴、提问、整理线索，并明确区分原始记录与推测。

## 当前状态

- 个人记录、主题、时间线、认识分析等 InnerOS Core 功能已接入本地 SQLite。
- 林间世界 V2 已进入可漫游版本，包含亮灯木屋、记忆花园、篝火地、静水池塘、循光寻迹、共居工坊等场景。
- 记忆花园支持从一条记忆切换到下一条记忆。
- 篝火地的四种模式均为 LLM 对话：听我说、问我一点、一起整理、只陪我坐着。
- 苔灯作为 AI 同行者出现，可在林间世界中跟随玩家。
- 游戏 UI 已统一为偏星露谷感的像素木框、羊皮纸、暖色 HUD 风格。
- 本地开发默认使用 webpack dev server，避开当前项目中出现过的 Turbopack 卡死问题。

## 产品结构

### InnerOS Core

InnerOS Core 负责保存和组织用户的真实记录。

- **今日记录**：快速写下想法、事件、摘录、情绪或任务。
- **原始记录优先**：原文始终保留，AI 生成内容不会覆盖原始事实。
- **AI 分析层**：后台可生成主题、情绪、核心问题、稳定见解和可回看的线索。
- **时间线与认识页**：帮助用户按时间和主题重新遇见自己的记录。
- **检索与上下文**：对话时可以基于已授权记录进行更准确的回应。

### 林间世界

林间世界把记忆转成一个可漫游的小型地图。它不是任务型游戏，而是一个安静地回到自己记录里的空间。

- **亮灯木屋**：进入世界的起点，也是回到主应用的地方。
- **记忆花园**：Memo 会映射成风铃、小灯、信件、植物等物件。靠近后可打开羊皮纸阅读层，也可以继续切换下一条记忆。
- **篝火地**：和苔灯进行对话。四种模式都走 LLM：倾听、追问、整理、静默陪伴。
- **静水池塘**：写下不想被分析的内容，作为漂流瓶释放。
- **循光寻迹**：从记忆碎片中找到线索，逐步点亮路径。
- **共居工坊**：支持围绕共同记忆进行共写、整理和确认。
- **AI 同行者苔灯**：可被邀请同行，跟随玩家移动，并在需要时进入对话。

## 技术栈

- **Next.js 16.2.7**，App Router
- **React 19**
- **TypeScript**
- **Tailwind CSS v4 + Vanilla CSS**
- **SQLite / better-sqlite3**
- **Zustand**
- **Canvas**，用于林间世界地图、角色和交互渲染
- **React Markdown / Remark GFM**
- **DeepSeek API**，用于篝火与苔灯对话
- **DashScope Embedding / Rerank**，用于语义检索和重排

## 本地运行

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

在项目根目录创建 `.env.local`：

```bash
# LLM
AI_BASE_URL=https://api.deepseek.com
AI_API_KEY=your_deepseek_api_key
AI_MODEL=deepseek-v4-flash

# Embedding / Rerank
DASHSCOPE_API_KEY=your_dashscope_api_key
EMBEDDING_PROVIDER=dashscope
EMBEDDING_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
EMBEDDING_MODEL=text-embedding-v4
EMBEDDING_DIMENSIONS=1024
RERANK_PROVIDER=dashscope
RERANK_BASE_URL=https://dashscope.aliyuncs.com/api/v1/services/rerank/text-rerank/text-rerank
RERANK_MODEL=qwen3-vl-rerank

# Local database
DATABASE_PATH=.data/inneros.db
```

### 3. 启动开发服务器

```bash
npm run dev
```

默认地址：

```bash
http://localhost:3000
```

当前 `npm run dev` 会执行 `next dev --webpack`。这是有意选择：在本项目近期开发中，Turbopack 曾出现 `next-server` 高 CPU 卡死，webpack dev server 更稳定。

每次启动前会自动运行：

```bash
node scripts/kill-dev-server.mjs
```

它会清理占用 `3000` 端口的旧 dev server，避免坏进程导致页面无响应。

### 4. 可选命令

```bash
# 手动清理旧 dev server
npm run dev:kill

# 使用 Turbopack 进行对比测试
npm run dev:turbo

# 类型检查
npx tsc --noEmit

# 代码检查
npm run lint

# 生产构建
npm run build

# 后台分析 worker
npm run worker:analysis
```

## 开发注意

- Next.js 16 的行为和旧版本不同，改框架配置前需要查看 `node_modules/next/dist/docs/`。
- 页面内 Next.js dev indicator 已关闭：`devIndicators: false`。
- `better-sqlite3` 通过 `serverExternalPackages` 外置。
- `.data/` 是本地数据库目录，不应该提交。
- AI 生成内容必须和用户原始记录分层展示，避免把推测伪装成事实。

## 文档

- [林间世界 V2 任务拆解](docs/forest-world-v2-tasks.md)
- [本地 dev server 说明](docs/dev-server.md)
- [LLM 记忆架构](docs/llm-memory-architecture.md)
- [检索优化总结](docs/retrieval-optimization-summary.md)

## 项目原则

InnerOS 默认把用户数据放在本地，避免不必要的追踪和外部依赖。系统可以帮助用户重新遇见记录，但不替用户决定什么重要。最终留下什么、删除什么、相信什么，都由用户自己决定。

