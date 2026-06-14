# InnerOS MVP 开发任务清单

## Phase 1–5: 主站（已完成基础框架）
- [x] 创建 Next.js 项目 + 安装依赖
- [x] 类型定义 (`types/index.ts`)
- [x] 设计令牌 & 全局样式 (`globals.css`)
- [x] 根布局 (`layout.tsx`)
- [x] 左侧导航 (`Sidebar.tsx`)
- [x] 移动端底部导航 (`MobileNav.tsx`)
- [x] SQLite 数据库初始化 (`lib/db/index.ts`)
- [x] Memo 数据操作 (`lib/db/memos.ts`)
- [x] 对话数据操作 (`lib/db/conversations.ts`)
- [x] Zustand 状态管理 (`lib/store/`)
- [x] API 路由 (memos, stats, analyze, chat, conversations, export)
- [x] 今日页 (/)
- [x] DeepSeek API 客户端 (`lib/ai/client.ts`)
- [x] Prompt 模板 (`lib/ai/prompts.ts`)
- [x] RAG 检索 (`lib/ai/rag.ts`)
- [x] 自动结构化分析 (`lib/ai/analyzer.ts`)
- [x] 流式对话 API

---

## 🌲 林间世界游戏模式（进行中）

### Phase 0：工程骨架 + 类型 + 样式 + API
- [x] task.md 更新
- [x] `Sidebar.tsx` — 改名「林间世界」+ 视觉微调 (已完成)
- [x] `cocreate/layout.tsx` — 更新 metadata (已完成)
- [x] `types/index.ts` — 追加游戏专属类型 (已完成)
- [x] `globals.css` — 追加游戏 CSS 变量与像素动画 (已完成)
- [x] `lib/db/index.ts` — 新增 game_worlds / world_objects / companion_sessions / shared_memory_drafts 表 (已完成)
- [x] `lib/db/game.ts` — 游戏数据 CRUD (已完成)
- [x] `api/game/world/route.ts` — 世界状态 API (已完成)
- [x] `api/game/memos/route.ts` — 游戏用 Memo 查询 API (已完成)
- [x] git commit: feat(game): phase0 skeleton + types + db

### Phase 1：GameShell + 过场 + HUD + 设置
- [x] `components/game/GameShell.tsx` (已完成，伴侣与共写使用占位 UI)
- [x] `components/game/GamePortal.tsx` (已完成)
- [x] `components/game/WorldHUD.tsx` (已完成)
- [x] `components/game/GameSettings.tsx` (已完成)
- [ ] `cocreate/page.tsx` — 游戏入口页面 (待创建)

### Phase 2：地图 + 角色 + 碰撞
- [x] `lib/game/map.ts` (已完成)
- [x] `lib/game/collisions.ts` (已完成)
- [x] `lib/game/sprite.ts` (已完成)
- [x] `components/game/PixelWorldCanvas.tsx` (已完成)
- [x] `components/game/CharacterSelect.tsx` (已完成)

### Phase 3：Memo 世界对象
- [x] `lib/game/memo-mapper.ts` (已完成)
- [x] `lib/game/world-state.ts` (已完成)
- [ ] `components/game/WorldObject.tsx` (已完成，渲染合并在 Canvas 中，需要的话可单独抽取)
- [x] `components/game/MemoEncounter.tsx` (已完成)

### Phase 4：AI 同行者 + 共写
- [x] `lib/game/companion-prompt.ts` (已完成)
- [x] `api/game/companion/route.ts` (已完成)
- [ ] `components/game/FiresideChat.tsx` (待实现，目前使用占位弹窗)
- [ ] `components/game/CoWritePanel.tsx` (待实现，目前使用占位弹窗)

### Phase 5：打磨 + 降级
- [ ] 声音与环境音效 (静音开关已留出，资产待引入)
- [ ] 空状态处理与 Canvas 初始化失败降级（图文地图）
- [ ] 减少动态模式完整适配
- [ ] 性能调优与双人联机/同屏共创演示数据对接
