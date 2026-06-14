# InnerOS - 个人记忆操作系统与林间世界

> **「让真实经历被保留、被重新遇见，并在需要时获得适度陪伴。」**

InnerOS 不是替用户总结人生，也不是一个带有成长压力、任务奖励的游戏。它的发心是让记忆以自然的方式重现。AI 不替用户定义意义、不强迫成长，只在被邀请时倾听、提问或协助整理。最终留下什么，始终由用户决定。

---

## 🌟 核心板块

### 1. 记忆管理 (InnerOS Core)
- **原始记录存储**：保存用户记录的每一次感悟、摘录、日记或任务（Memos）。
- **来源与分层**：清晰分割「原始记录」、「今日补充」与「AI 推测」，保证原始真相不被 AI 生成的推论覆盖。
- **智能分析**：后台工作线程自动完成分类、情绪提取、核心提问、稳定见解等整理动作，由用户自主决定是否查看或隐藏。

### 2. 林间世界 (Co-creation World / The Inner Wilds)
通过像素风的二维微型地图，让记忆转化为可漫游、可回访、随时间变化的私人世界。
- **亮灯木屋 (Cabin)**：进入世界的起点，也是推门返回 InnerOS 的归处。
- **记忆花园 (Garden)**：用户的 Memo 根据类型被映射为风铃、小灯、信件、植物等记忆物件。玩家靠近并按 `E` 即可开启羊皮纸阅读层。
- **篝火地 (Fireside)**：在此处主动邀请 AI 伴侣同行，或坐下进行篝火长谈。支持「听我说」、「问我一点」、「一起整理」、「只陪我坐着」等多种对话陪伴模式。
- **静水池塘 (Pond)**：静默留字处。心事将作为漂流瓶封存在池塘，不对 AI 开放，不作分析，体现完全的静默与绝对的隐私。
- **共居工坊 (Workshop)**：提供本地双人共写模式，让两位漫游者在同一个世界中共同漫步、记录和对话。

---

## 🛠️ 技术栈与依赖

### 核心框架
- **Next.js 16.2** (App Router)
- **React 19 & React DOM 19**
- **Zustand** (轻量化客户端状态管理)
- **SQLite (better-sqlite3)** (本地轻量化嵌入式数据库)

### 渲染与动画
- **HTML5 Canvas API** (用于像素地图绘制、动态寻路、角色动画渲染)
- **Tailwind CSS v4 & Vanilla CSS** (毛玻璃效果、拟木/羊皮纸质感物理框体、像素风 UI 样式)
- **React Markdown & Remark GFM** (支持 Memo 与 AI 对话中的富文本 Markdown 解析)

### AI 基础设施
- **DeepSeek API** (用于篝火伴侣的对话大模型)
- **Alibaba Cloud DashScope (通义千问)** (用于 Rerank 和 1024 维度的 text-embedding 向量模型)

---

## 🚀 快速开始

### 1. 配置环境变量
在项目根目录创建 `.env.local` 文件，配置如下参数：
```bash
# AI 引擎（DeepSeek）
AI_BASE_URL=https://api.deepseek.com
AI_API_KEY=your_deepseek_api_key
AI_MODEL=deepseek-v4-flash

# 检索与向量引擎（阿里云 DashScope）
DASHSCOPE_API_KEY=your_dashscope_api_key
EMBEDDING_PROVIDER=dashscope
EMBEDDING_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
EMBEDDING_MODEL=text-embedding-v4
EMBEDDING_DIMENSIONS=1024
RERANK_PROVIDER=dashscope
RERANK_BASE_URL=https://dashscope.aliyuncs.com/api/v1/services/rerank/text-rerank/text-rerank
RERANK_MODEL=qwen3-vl-rerank

# SQLite 本地数据库路径
DATABASE_PATH=.data/inneros.db
```

### 2. 安装依赖
```bash
npm install
```

### 3. 运行项目
启动开发服务器：
```bash
# 开发环境启动（默认运行在 3010 端口）
npm run dev -- -p 3010

# 或在生成环境构建运行
npm run build
npm start -- -p 3010
```

打开 `http://localhost:3010` 即可开始探索。

### 4. 启动后台分析 Worker（可选）
如果您需要实时更新新 Memo 的 AI 智能整理与分析，可以单独开启 Worker 进程：
```bash
npm run worker:analysis
```

---

## 📄 开源说明
InnerOS 始终坚持**数据隐私第一**与**无压力的个人空间**设定。默认不集成任何追踪统计服务，数据全部保存在您本地的 SQLite 数据库文件中。
