# InnerOS 产品简介与开源报告

## 产品简介

InnerOS 是一个面向个人记忆、自我观察和长期反思的 AI 应用。它帮助用户记录日常想法、情绪、摘录和对话，并通过主题、时间线、认识页与「林间世界」重新组织这些内容。

InnerOS 的核心目标不是让 AI 替用户给建议，而是帮助用户看见最近的自己。AI 会参与标题生成、情绪识别、主题整理、记忆检索和陪伴式对话，但原始记录始终被保留，AI 分析只是辅助层。

在线体验：  
[https://inneros.flowork.com.cn/](https://inneros.flowork.com.cn/)

GitHub 开源仓库：  
[https://github.com/Liuweixin97/inneros](https://github.com/Liuweixin97/inneros)

## 核心功能

- 记录日常想法、情绪、摘录和事件
- 支持账户登录、注册、游客体验和个人资料维护
- 自动生成标题、情绪标签、主题和洞察
- 通过时间线和主题页回看长期变化
- 基于个人记录进行 AI 对话和检索
- 通过像素风「林间世界」以更柔和的方式回看记忆
- 支持 Docker 与 GitHub Actions 自部署

## 开源说明

InnerOS 已作为开源项目发布，采用 MIT License。项目当前是一个可运行的早期产品原型，包含前端界面、账户系统、SQLite 数据层、AI 分析链路、RAG 检索、林间世界和 CI/CD 部署配置。

开源后，项目希望和更多对个人知识管理、AI 记忆系统、本地优先应用、情绪记录和游戏化交互感兴趣的开发者一起迭代。

## 技术栈

- Next.js 16
- React 19
- TypeScript
- SQLite / better-sqlite3
- Canvas
- DeepSeek API
- DashScope Embedding / Rerank
- Docker / GitHub Actions

## 当前状态

项目已完成基础产品闭环，并已上线可体验版本。后续重点包括：完善导入导出、增强数据隐私控制、优化 AI 成本和缓存、补充测试、继续打磨林间世界的交互体验。
