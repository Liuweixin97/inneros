# InnerOS MVP 开发任务清单

## Phase 1: 项目基础 & 设计系统
- [x] 创建 Next.js 项目 + 安装依赖
- [x] 类型定义 (`types/index.ts`)
- [x] 设计令牌 & 全局样式 (`globals.css`)
- [x] 根布局 (`layout.tsx`)
- [x] 左侧导航 (`Sidebar.tsx`)
- [x] 移动端底部导航 (`MobileNav.tsx`)
- [ ] 右侧上下文栏 (`ContextPanel.tsx`)

## Phase 2: 数据层
- [x] SQLite 数据库初始化 (`lib/db/index.ts`)
- [x] Memo 数据操作 (`lib/db/memos.ts`)
- [/] 主题数据操作 (`lib/db/topics.ts`) — 子代理构建中
- [x] 对话数据操作 (`lib/db/conversations.ts`)
- [/] 洞察数据操作 (`lib/db/insights.ts`) — 子代理构建中
- [x] Zustand 状态管理 (`lib/store/`)
- [x] API 路由 (memos, stats, analyze, chat, conversations, export)
- [/] API 路由 (memos/[id], conversations/[id], topics, insights) — 子代理构建中

## Phase 3: 核心页面
- [x] 今日页 (/)
- [/] 记录页 (/records) — 子代理构建中
- [/] 对话页 (/chat) — 子代理构建中
- [/] 设置页 (/settings) — 子代理构建中

## Phase 4: AI 集成
- [x] DeepSeek API 客户端 (`lib/ai/client.ts`)
- [x] Prompt 模板 (`lib/ai/prompts.ts`)
- [x] RAG 检索 (`lib/ai/rag.ts`)
- [x] 自动结构化分析 (`lib/ai/analyzer.ts`)
- [x] 流式对话 API

## Phase 5: 高级页面
- [/] 主题列表页 (/topics) — 子代理构建中
- [/] 主题详情页 (/topics/[id]) — 子代理构建中
- [/] 时间线页 (/timeline) — 子代理构建中
- [/] 洞察页 (/insights) — 子代理构建中

## Phase 6: 打磨
- [ ] 页面切换动画
- [ ] Memo 卡片交互效果
- [ ] 骨架屏加载
- [ ] 暗色模式
- [ ] 移动端适配测试
- [ ] 最终编译验证
