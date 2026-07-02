# InnerOS

InnerOS 是一个面向个人记忆、自我观察和长期反思的开源应用。它把日常笔记、摘录、情绪、对话和 AI 生成的分析分层保存，再通过清晰的信息管理界面和一个可漫游的像素风「林间世界」重新呈现给用户。

这个项目的核心不是让 AI 替用户给出建议，也不是把生活记录加工成标准答案。InnerOS 更关心一件事：帮助用户看见最近的自己。系统会整理线索、保留证据、提出问题、生成可回看的结构，但最终什么重要、什么值得相信、什么应该被删除，都由用户自己决定。

## 项目愿景

很多记录工具擅长保存内容，却不擅长让人重新遇见内容；很多 AI 产品擅长给答案，却容易把用户复杂的真实经验压缩成一句建议。InnerOS 尝试走另一条路：

- 保存原始记录，不让 AI 覆盖真实表达。
- 把 AI 分析作为附加层，而不是事实本身。
- 让用户通过时间线、主题、认识页和林间世界重新看见自己的变化。
- 在必要时使用大语言模型进行整理、追问和陪伴，但避免制造成长焦虑。
- 默认尊重本地数据和个人边界，减少不必要的外部依赖。

一句话概括：InnerOS 是一个「个人记忆操作系统」的早期原型。

## 主要功能

### 记录与记忆管理

- **今日记录**：快速写下想法、事件、摘录、情绪、任务或任意片段。
- **多账户管理**：支持账户名注册、登录、退出、个人信息维护和密码重设。
- **游客访问**：允许用户在不登录的情况下体验核心路径。
- **记录列表与详情**：查看、筛选、编辑和回看历史记录。
- **主题聚合**：根据记录内容形成主题线索，帮助用户发现反复出现的问题和关注点。
- **时间线**：按时间顺序回看自己在不同阶段留下的内容。
- **认识页**：沉淀 AI 生成的洞察，并保留对应证据来源。

### AI 日记与分析层

InnerOS 的 AI 能力围绕「整理」而不是「替用户决策」设计。

- **自动标题**：为记录生成更容易回看的标题。
- **情绪标签**：识别记录中的情绪状态，方便后续回看。
- **主题与关键词**：抽取内容线索，形成检索和聚合基础。
- **稳定洞察**：从多条记录中提炼可以被证据支持的观察。
- **RAG 对话**：对话时可以基于用户授权的记录检索上下文。
- **缓存与归档**：AI 生成结果进入数据库，避免每次打开页面都重复消耗 token。

项目原则是：AI 输出必须和用户原文分层展示。原始记录永远是第一层，AI 只是解释层、整理层和索引层。

### 林间世界

林间世界是 InnerOS 的可视化记忆空间。它不是传统意义上的任务游戏，而是一个让用户以更柔和的方式回到自己记录里的场景。

当前地图包含：

- **亮灯木屋**：世界入口，也是返回主应用的地方。
- **记忆花园**：把 Memo 映射成风铃、小灯、信件、植物等物件，靠近后可以阅读对应记忆。
- **篝火长椅**：和 AI 同行者「苔灯」对话，支持倾听、追问、整理和静默陪伴。
- **静水池塘**：写下不想被分析的内容，把它作为漂流瓶放下。
- **循光寻迹**：从记忆碎片中找到线索，逐步点亮路径。
- **共居工坊**：围绕共同记忆进行共写、整理和确认。
- **中间写作台**：作为从地图回到记录动作的中心节点。

林间世界的产品目标是降低回看记录的心理阻力。用户不需要面对一个冷冰冰的数据面板，也不需要被 AI 推着完成任务；用户可以在空间里走动、靠近、阅读、放下、回应。

### 对话与检索

- 基于用户记录进行上下文检索。
- 支持会话摘要，降低长对话成本。
- 支持 embedding 与 rerank，提高检索相关性。
- 对话内容与记忆引用分离，便于追踪 AI 回答依据。

## 技术栈

- **Next.js 16**，App Router
- **React 19**
- **TypeScript**
- **Tailwind CSS v4**
- **Vanilla CSS**，用于复杂产品界面和林间世界视觉层
- **SQLite / better-sqlite3**
- **Zustand**
- **Canvas**，用于林间世界地图、角色和交互渲染
- **bcryptjs / jose**，用于账户认证和会话
- **React Markdown / Remark GFM**
- **DeepSeek API**，用于对话、标题、情绪和整理类任务
- **DashScope Embedding / Rerank**，用于语义检索和重排
- **Docker / Docker Compose**
- **GitHub Actions**，用于 CI/CD

## 目录结构

```text
src/
  app/                 Next.js 页面与 API 路由
  components/          业务组件、布局组件、林间世界组件
  lib/
    ai/                LLM、RAG、分析任务、提示词
    db/                SQLite 数据访问层
    game/              林间世界状态、地图、碰撞和记忆映射
    import/            外部记录导入与去重
    store/             前端状态管理
  types/               共享类型

docs/                  产品文档、技术方案和阶段报告
scripts/               开发辅助脚本和分析 worker
public/                静态资源
.github/workflows/     GitHub Actions CI/CD
```

## 本地运行

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

在项目根目录创建 `.env.local`：

```bash
# Auth
AUTH_SECRET=replace_with_a_random_32_char_secret

# Database
DATABASE_PATH=.data/inneros.db

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
```

如果只想浏览 UI，可以先不配置 AI key；涉及 AI 分析、对话、embedding 和 rerank 的功能会依赖对应服务。

### 3. 启动开发服务器

```bash
npm run dev
```

默认地址：

```bash
http://localhost:3000
```

当前 `npm run dev` 使用 webpack dev server：

```bash
next dev --webpack
```

这是项目当前的保守选择。此前开发中 Turbopack 曾出现 `next-server` 高 CPU 卡死，webpack dev server 在这个项目里更稳定。

### 4. 常用命令

```bash
# 清理占用 3000 端口的旧 dev server
npm run dev:kill

# 启动开发环境
npm run dev

# 使用 Turbopack 对比测试
npm run dev:turbo

# 代码检查
npm run lint

# 生产构建
npm run build

# 启动生产服务
npm run start

# 运行后台分析 worker
npm run worker:analysis

# Flomo 导入去重测试
npm run test:flomo-import

# 检索评估
npm run test:retrieval
```

## Docker 部署

项目包含 `Dockerfile` 和 `docker-compose.yml`。基础流程：

```bash
docker compose up -d --build
```

生产环境建议：

- 使用强随机 `AUTH_SECRET`。
- 将数据库目录挂载到持久化路径。
- 不要把 `.env.local`、`.data/`、数据库文件和密钥提交到仓库。
- 在反向代理层配置 HTTPS。
- 为 AI API key 设置最小权限和用量监控。

## GitHub Actions CI/CD

仓库包含 GitHub Actions 工作流，用于：

- 安装依赖
- 运行 lint
- 运行生产构建
- 构建 Docker 镜像
- 推送镜像
- 上传 compose 文件
- 远程部署到服务器

如果你 fork 后需要使用自己的服务器部署，需要在 GitHub Repository Secrets 中配置对应的镜像仓库、SSH 主机、用户名、私钥和环境变量。请不要复用任何个人密钥或生产 token。

## 数据与隐私

InnerOS 处理的是高度个人化的数据，因此默认设计遵循以下原则：

- 原始记录优先保存，AI 分析不能覆盖原文。
- AI 生成内容应当可追踪、可删除、可重新生成。
- 用户数据默认进入本地 SQLite 或自托管数据库。
- 不把私密记录发送给未配置或未授权的第三方服务。
- 对话、分析、embedding 和 rerank 都应被视为敏感链路。

当前项目仍处于早期阶段。如果用于真实长期记录，请自行评估数据备份、访问控制、服务器安全和第三方 AI 服务的数据政策。

## 产品原则

InnerOS 的很多实现选择来自几个产品原则：

1. **不替用户下结论**
   AI 可以帮助用户整理证据和提出问题，但不能把推测包装成事实。

2. **降低回看压力**
   记录不应该只堆在列表里。林间世界用空间化方式降低重新打开旧内容的阻力。

3. **保留复杂性**
   人的生活记录往往矛盾、重复、犹豫。系统不应该过早把它们压缩成单一标签。

4. **让 AI 成为安静工具**
   AI 的价值在于增强回看、检索和整理，而不是制造更多噪音。

5. **本地优先，自主可控**
   用户应该能理解自己的数据在哪里，哪些内容会被发送到外部模型。

## 当前状态

InnerOS 目前是一个可运行的早期产品原型，已经包含核心记录、多账户、AI 分析、RAG 对话、林间世界和自部署链路。它还不是一个成熟商业产品，仍然需要在以下方面继续完善：

- 更完整的导入导出能力
- 更精细的权限与数据清除机制
- 更稳健的分析任务队列
- 更系统的端到端测试
- 更完善的无障碍支持
- 更多可配置的模型供应商
- 林间世界中更多闭环玩法和长期反馈

## 文档

- [林间世界 V2 任务拆解](docs/forest-world-v2-tasks.md)
- [游戏模式下一阶段 PRD](docs/game-mode-next-phase-prd.md)
- [LLM 记忆架构](docs/llm-memory-architecture.md)
- [检索优化总结](docs/retrieval-optimization-summary.md)
- [本地 dev server 说明](docs/dev-server.md)
- [提示词审计](docs/prompt-audit.md)

## 贡献

欢迎围绕以下方向提交 issue 或 pull request：

- 产品体验和信息架构优化
- 林间世界的交互、视觉和玩法设计
- AI 分析链路的成本、缓存和质量优化
- 本地优先的数据结构与迁移方案
- 多模型供应商支持
- 测试、部署和安全加固
- 文档、示例数据和上手教程

提交代码前请至少运行：

```bash
npm run lint
npm run build
```

## License

MIT License. See [LICENSE](LICENSE).
