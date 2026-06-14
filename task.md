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
- [ ] `Sidebar.tsx` — 改名「林间世界」+ 视觉微调
- [ ] `cocreate/layout.tsx` — 更新 metadata
- [ ] `types/index.ts` — 追加游戏专属类型
- [ ] `globals.css` — 追加游戏 CSS 变量与像素动画
- [ ] `lib/db/index.ts` — 新增 game_worlds / world_objects / companion_sessions / shared_memory_drafts 表
- [ ] `lib/db/game.ts` — 游戏数据 CRUD
- [ ] `api/game/world/route.ts` — 世界状态 API
- [ ] `api/game/memos/route.ts` — 游戏用 Memo 查询 API
- [ ] git commit: feat(game): phase0 skeleton + types + db

### Phase 1：GameShell + 过场 + HUD + 设置
- [ ] `components/game/GameShell.tsx`
- [ ] `components/game/GamePortal.tsx`
- [ ] `components/game/WorldHUD.tsx`
- [ ] `components/game/GameSettings.tsx`
- [ ] `cocreate/page.tsx`
- [ ] git commit: feat(game): phase1 shell + portal + HUD

### Phase 2：地图 + 角色 + 碰撞
- [ ] `lib/game/map.ts`
- [ ] `lib/game/collisions.ts`
- [ ] `lib/game/sprite.ts`
- [ ] `components/game/PixelWorldCanvas.tsx`
- [ ] `components/game/CharacterSelect.tsx`
- [ ] git commit: feat(game): phase2 canvas map + character

### Phase 3：Memo 世界对象
- [ ] `lib/game/memo-mapper.ts`
- [ ] `lib/game/world-state.ts`
- [ ] `components/game/WorldObject.tsx`
- [ ] `components/game/MemoEncounter.tsx`
- [ ] git commit: feat(game): phase3 memo world objects

### Phase 4：AI 同行者 + 共写
- [ ] `lib/game/companion-prompt.ts`
- [ ] `api/game/companion/route.ts`
- [ ] `components/game/FiresideChat.tsx`
- [ ] `components/game/CoWritePanel.tsx`
- [ ] git commit: feat(game): phase4 AI companion + co-write

### Phase 5：打磨 + 降级
- [ ] 空状态处理
- [ ] Canvas 初始化失败降级（图文地图）
- [ ] 减少动态模式
- [ ] git commit: feat(game): phase5 polish + fallback
