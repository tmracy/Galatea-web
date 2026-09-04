# Galatea Web

Galatea 语音 AI 伴侣的前端。Vue 3 + Vite，单页三栏布局：左侧人设管理、中间 Live2D 舞台 / 生产力 Agent / 情绪陪伴三种模式切换、右侧对话面板。

后端为独立仓库的 Flask 服务（`Galatea`），本仓库只负责界面与接口调用。后端未启动时会自动回退到内置 mock，UI 仍可完整演示。

在线体验：[https://galateaagent.com/](https://galateaagent.com/)

## 功能

- **陪伴对话**：文本 + 语音输入，SSE 流式回复，逐句合成逐句播放。
- **Live2D 形象**：基于 `oh-my-live2d`，通过 Web Audio 分析 TTS 音频响度做实时嘴型同步（lipSync）。
- **语音**：输入优先用浏览器 Web Speech API（Chrome/Edge 中文识别），不支持时可走后端 ASR；输出优先用后端克隆音色，失败时回退浏览器 SpeechSynthesis。
- **音色克隆**：上传一段参考音频，后端生成个人音色。
- **人设（Skill）管理**：上传带 frontmatter 的 `skill.md` 定义角色，前端解析 `name` / `description` 并展示、切换。
- **生产力 Agent**：上传整个文件夹作为工作区，下发自然语言任务，产出文件可直接下载。
- **情绪陪伴**：独立的情绪对话通道，与主聊天历史隔离。

## 快速开始

需要 Node.js 18+。

```bash
npm install
cp .env.example .env   # 按需修改
npm run dev            # http://localhost:5173
```

构建与本地预览：

```bash
npm run build
npm run preview
```

## 生产部署

`npm run build` 得到 `dist/`，用 nginx 等静态服务器托管，并把 `/api`、`/agent`、`/emotion` 反代到后端。不要设 `VITE_API_BASE`（相对路径 + 反代，避免跨域）。

同机部署时，安全组只放行前端端口（如 80），不要把后端端口对公网开放。

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `VITE_API_BASE` | 后端绝对地址。留空则用相对路径，走 Vite 代理。生产部署或跨域时填写。 |
| `VITE_PROXY_TARGET` | Vite dev 代理目标，默认 `http://127.0.0.1:8001`，需与后端监听端口一致。 |
| `VITE_USE_MOCK` | 设为 `1` 时强制走 mock，完全不请求后端。 |

开发态下 `/api`、`/agent`、`/emotion` 三个前缀由 `vite.config.js` 代理到后端，因此前端代码里统一使用相对路径。

## 后端接口

前端调用的接口集中在 `src/api/index.js`，与后端 `entry/server.py` 一一对应：

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| POST | `/api/chat` | 一次性对话 |
| POST | `/api/chat/stream` | 流式对话（SSE，逐句推送） |
| POST | `/api/asr` | 语音转文字（multipart） |
| POST | `/api/tts` | 文本转语音，返回 base64 音频 |
| POST | `/api/clone` | 上传参考音频克隆音色（multipart） |
| POST | `/api/upload` | 归档当前对话：落盘、清空短期记忆、返回 `greeting`；长期记忆后台提炼 |
| GET / POST | `/api/skills` | 人设列表 / 上传人设 |
| POST | `/api/auth/check`、`/register`、`/login` | 会话注册登录 |
| POST | `/agent/upload`、`/agent/simple`、`/agent/clear` | 生产力 Agent 上传、执行、清空 |
| GET | `/agent/download` | 下载 Agent 产出文件 |
| POST | `/emotion/chat`、`/emotion/clear` | 情绪对话、清空 |

后端统一响应约定：`{ code: 0, ... }` 表示成功，`{ code: 1, info }` 表示失败。

## 目录结构

```
src/
├── App.vue                 # 三栏布局与模式切换
├── main.js
├── style.css               # 全局样式与设计变量
├── api/
│   ├── index.js            # 全部后端接口 + mock 回退
│   └── mock.js             # 离线演示数据
├── components/
│   ├── ChatPanel.vue       # 对话列表、输入、流式渲染、飞字、新窗口
│   ├── MessageBubble.vue   # 消息气泡与等待陪白
│   ├── Live2DStage.vue     # Live2D 画布与嘴型同步
│   ├── SkillSidebar.vue    # 人设列表与上传
│   ├── VoiceCloneModal.vue # 音色克隆弹窗
│   ├── AgentPanel.vue      # 生产力 Agent
│   ├── EmotionPanel.vue    # 情绪陪伴
│   ├── UserGuide.vue       # 可翻页使用手册
│   └── LoginGate.vue       # 注册 / 登录
├── composables/
│   ├── useAuth.js          # 会话登录态
│   └── useVoice.js         # 语音输入输出与 lipSync
└── utils/frontmatter.js    # skill.md frontmatter 解析
```

## 说明

- Live2D 模型默认从 jsDelivr CDN 加载公开示例模型，离线环境需自行替换为本地模型路径（见 `src/components/Live2DStage.vue`）。
- Live2D 画布不能用 `display: none` 隐藏，否则纹理会丢失；模式切换用的是 `visibility`。
- 浏览器语音识别仅在 Chromium 系浏览器可用，Safari / Firefox 请依赖后端 ASR。

## 技术栈

Vue 3（Composition API，`<script setup>`）、Vite 6、marked、oh-my-live2d。无状态管理库，跨组件状态用模块级 `ref` 共享。

## 更新记录

前后端功能点变更记在这里，新的写在最上面。

- **2026-08-29（前端 / 后端）新窗口开场**：开新对话时  先落盘并清空短期记忆，根据上一窗生成 `greeting` 后立刻返回；前端拿到开场白再切新窗口。长期记忆提炼改到后台，不再挡住切窗。开场白失败则用默认问候。
- **2026-08-29（前端）发送飞字**：用户发送后，句子从输入框逐字飞入右侧用户气泡（起飞间隔约 200ms）；请求并行发出。飞完后才出等待陪白；回复先到则打断飞字并填上整句。超过约 40 字只飞前面一段，其余落地后一次性出现。系统「减少动效」时跳过飞字。
- **2026-08-28（前端）陪伴等待**：首包到达前，助手气泡用「我在听… / 让我想想…」分阶陪白盖住 5–30 秒空窗；请求仍立刻发出，不做打字机延迟。
- **2026-08-27（前端）使用指南**：界面内加入可翻页的使用手册。登录页可先阅读；登录后首次会自动打开，也可点舞台右上角书本或左侧「使用指南」。
- **2026-08-27（后端）记忆路由**：长期记忆检索不再只根据用户当前 query。默认取最近 6 条对话，与当前 query 一并交给记忆路由，再决定是否检索、如何检索长期记忆。

## License

MIT
