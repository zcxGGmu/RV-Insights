# RV-Insights MVP 阶段任务清单（v4 — 完全对标 ScienceClaw + 五阶段 Pipeline）

> 目标：构建 AI 驱动的多 Agent 平台，面向 RISC-V 开源贡献场景。
> 双模式：① ScienceClaw 同款对话交互（RISC-V 专家 Q&A）② 五阶段 Agent Pipeline（自动化贡献）
> 完全对标：ScienceClaw 全部前端功能（含 IM/Skills/Tools/ToolUniverse/Tasks/Statistics）
> 参考项目：ScienceClaw（Vue 3 + Vite + TailwindCSS 前端，FastAPI + deepagents 后端，MongoDB）
> 预计周期：10 个 Sprint（每 Sprint 1 周），共 10 周
> 版本：v4 — 完全对标 ScienceClaw，含 IM 集成

---

## 双模式架构设计

RV-Insights = **对话模式（Chat）** + **Pipeline 模式（Contribution）**

```
┌─────────────────────────────────────────────────────────┐
│                    RV-Insights 前端                       │
│                                                          │
│  ┌──────────────────┐    ┌────────────────────────────┐  │
│  │   Chat Mode       │    │   Pipeline Mode             │  │
│  │   (对标 ScienceClaw) │    │   (五阶段 Agent Pipeline)   │  │
│  │                    │    │                              │  │
│  │  HomePage (欢迎)   │    │  CaseListPage (案例列表)     │  │
│  │  ChatPage (对话)   │    │  CaseDetailPage (案例详情)   │  │
│  │  SharePage (分享)  │    │  PipelineView (流水线)      │  │
│  │  LeftPanel (会话)  │    │  ReviewPanel (审核)          │  │
│  │  ActivityPanel     │    │  DiffViewer (代码差异)       │  │
│  │  ChatBox (输入)    │    │  TestLogViewer (测试日志)    │  │
│  └──────────────────┘    └────────────────────────────┘  │
│                                                          │
│  共享页面：SkillsPage, ToolsPage, ScienceToolDetail,      │
│           TasksPage, Settings (8 tab)                     │
│                                                          │
│  共享组件：MarkdownEnhancements, ToolCallView, Toast,     │
│           MonacoEditor, Settings, UserMenu, i18n          │
├──────────────────────────────────────────────────────────┤
│                    RV-Insights 后端                       │
│                                                          │
│  ┌──────────────────┐    ┌────────────────────────────┐  │
│  │  Chat Service     │    │  Pipeline Engine             │  │
│  │  POST /chat/:id   │    │  LangGraph StateGraph        │  │
│  │  SSE 流式对话      │    │  5 节点 + 4 人工门禁          │  │
│  │  Session CRUD     │    │  Case CRUD + Review API      │  │
│  │  LLM 直接调用      │    │  Claude SDK + OpenAI SDK     │  │
│  └──────────────────┘    └────────────────────────────┘  │
│                                                          │
│  共享服务：Models, Statistics, Memory, Skills, Tools,      │
│           ToolUniverse, Tasks, Webhooks, IM, File          │
│                                                          │
│  共享基础设施：MongoDB, Redis (SSE), JWT Auth, EventPublisher │
└──────────────────────────────────────────────────────────┘
```

### 对话模式 vs Pipeline 模式

| 维度 | 对话模式 (Chat) | Pipeline 模式 (Contribution) |
|------|-----------------|------------------------------|
| 入口 | `/` (HomePage) → `/chat/:id` | `/cases` → `/cases/:id` |
| 交互 | 多轮自由对话，实时流式响应 | 阶段性执行，人工审核门禁 |
| 后端 | LLM 直接调用 + 工具（搜索/代码分析） | LangGraph 5 节点 + 双 SDK |
| SSE | `message_chunk` 逐 token 流式 | `stage_change` + `agent_output` 事件 |
| 会话管理 | Session（创建/对话/停止/分享/删除） | Case（创建/启动/审核/完成/放弃） |
| 数据存储 | `chat_sessions` 集合（events 内嵌） | `contribution_cases` 集合 + PostgreSQL 检查点 |
| 典型场景 | "解释 RISC-V V 扩展的 vsetvli 指令" | "为 Linux 内核添加 Zicfiss 扩展支持" |

### ScienceClaw 完全对标清单

以下为 ScienceClaw 全部功能模块，RV-Insights 必须全部实现：

| 模块 | ScienceClaw 功能 | RV-Insights Sprint | 适配说明 |
|------|-----------------|-------------------|----------|
| **Auth** | login/register/refresh/logout/change-password/change-fullname/me/status/check-default-password | S0-2 ✅ + S3 补充 | 已有基础，补充 change-password/fullname/me/status |
| **Sessions (Chat)** | CRUD/pin/title/stop/chat-SSE/share/files/upload/notifications | S3-S4 | 核心对话功能 |
| **Models** | list/create/update/delete/detect-context-window | S4 | 多模型管理 |
| **Statistics** | summary/models/trends/sessions | S4 + S8 增强 | Token 用量统计 |
| **Memory** | GET/PUT personalization | S4 | 用户记忆/偏好 |
| **Skills** | list/get/block/delete/files/read/save-from-session | S8 | RISC-V 专用 Skills |
| **Tools** | list/get/block/delete/read/save-from-session | S8 | 外部工具管理 |
| **ToolUniverse** | list/get/run/categories | S8 | RISC-V 工具宇宙 |
| **Science** | optimize_prompt | S8 | Prompt 优化 |
| **File** | download | S8 | 文件下载 |
| **Tasks** | CRUD/validate-schedule/runs | S9 | 定时任务 |
| **Webhooks** | CRUD/test | S9 | 通知 Webhook |
| **IM** | Lark bind/unbind/status + WeChat start/stop/status + system settings | S9 | IM 集成 |
| **Settings UI** | 8 tabs: Account/General/Models/Personalization/Tasks/Statistics/Notifications/IM | S4 + S8 + S9 | 完整设置面板 |
| **Pages** | Login/Home/Chat/Share/Skills/SkillDetail/Tools/ToolDetail/ScienceToolDetail/Tasks | S3-S9 | 全部页面 |

---

## 从 ScienceClaw 迁移清单（v4 — 完整功能对标）

### 前端直接迁移（复制 + 适配）

| ScienceClaw 源文件 | RV-Insights 目标 | Sprint | 适配工作 |
|---------------------|------------------|--------|----------|
| **对话核心组件** | | | |
| `pages/HomePage.vue` | `views/HomePage.vue` | S3 | 欢迎页 + 快捷提示 + ChatBox |
| `pages/ChatPage.vue` | `views/ChatPage.vue` | S3 | 拆分迁移，SSE 提取为 composable |
| `pages/SharePage.vue` | `views/SharePage.vue` | S4 | 公开分享回放 |
| `components/ChatBox.vue` | `components/chat/ChatBox.vue` | S3 | 输入框 + 文件附件 + 模型选择 |
| `components/ChatMessage.vue` | `components/chat/ChatMessage.vue` | S3 | Markdown + 代码 + KaTeX |
| `components/SuggestedQuestions.vue` | `components/chat/SuggestedQuestions.vue` | S3 | 推荐问题 |
| `components/LeftPanel.vue` | `components/chat/SessionPanel.vue` | S3 | 会话列表侧边栏 |
| `components/SessionItem.vue` | `components/chat/SessionItem.vue` | S3 | 会话列表项 |
| `components/ActivityPanel.vue` | `components/shared/ActivityPanel.vue` | S3 | 思考+工具时间线 |
| `components/ProcessMessage.vue` | `components/shared/ProcessGroup.vue` | S3 | 执行过程分组 |
| `components/StepMessage.vue` | `components/shared/StepMessage.vue` | S3 | 步骤消息 |
| `components/ToolUse.vue` | `components/shared/ToolCallView.vue` | S3 | 工具调用可视化 |
| `components/SimpleBar.vue` | `components/ui/SimpleBar.vue` | S3 | 自定义滚动条 |
| **面板组件** | | | |
| `components/PlanPanel.vue` | `components/chat/PlanPanel.vue` | S4 | 计划可视化 |
| `components/ToolPanel.vue` | `components/chat/ToolPanel.vue` | S4 | 工具详情面板 |
| `components/FilePanel.vue` | `components/chat/FilePanel.vue` | S4 | 文件预览面板 |
| `components/SessionFileList.vue` | `components/chat/SessionFileList.vue` | S4 | 会话文件列表 |
| **工具视图** | | | |
| `components/toolViews/ShellToolView.vue` | `components/toolViews/ShellToolView.vue` | S3 | 直接复用 |
| `components/toolViews/FileToolView.vue` | `components/toolViews/FileToolView.vue` | S3 | 直接复用 |
| `components/toolViews/SearchToolView.vue` | `components/toolViews/SearchToolView.vue` | S3 | 直接复用 |
| **Settings** | | | |
| `components/settings/SettingsDialog.vue` | `components/settings/SettingsDialog.vue` | S4 | 8 tab 设置面板 |
| `components/settings/ModelSettings.vue` | `components/settings/ModelSettings.vue` | S4+S8 | 模型管理 |
| `components/settings/TokenStatistics.vue` | `components/settings/TokenStatistics.vue` | S4+S8 | 用量统计 |
| `components/settings/PersonalizationSettings.vue` | `components/settings/PersonalizationSettings.vue` | S4 | 记忆编辑 |
| `components/settings/TaskSettings.vue` | `components/settings/TaskSettings.vue` | S9 | 任务设置 |
| `components/settings/NotificationSettings.vue` | `components/settings/NotificationSettings.vue` | S9 | Webhook 管理 |
| `components/settings/IMSystemSettings.vue` | `components/settings/IMSettings.vue` | S9 | IM 设置 |
| **Skills/Tools 页面** | | | |
| `pages/SkillsPage.vue` | `views/SkillsPage.vue` | S8 | Skills 库 |
| `pages/SkillDetailPage.vue` | `views/SkillDetailPage.vue` | S8 | Skill 文件浏览 |
| `pages/ToolsPage.vue` | `views/ToolsPage.vue` | S8 | Tools 库 |
| `pages/ToolDetailPage.vue` | `views/ToolDetailPage.vue` | S8 | Tool 详情 |
| `pages/ScienceToolDetail.vue` | `views/ScienceToolDetail.vue` | S8 | ToolUniverse 详情 |
| **Tasks 页面** | | | |
| `pages/TasksPage.vue` | `views/TasksPage.vue` | S9 | 定时任务管理 |
| **已迁移（v2 计划）** | | | |
| `api/client.ts` | `api/client.ts` | S0 ✅ | SSE 封装在 api/chat.ts |
| `composables/useAuth.ts` | `composables/useAuth.ts` | S1 ✅ | 已完成 |
| `composables/useTheme.ts` | `composables/useTheme.ts` | S0 ✅ | 直接复用 |
| `assets/theme.css` + `global.css` | `assets/` | S0 ✅ | 已完成 |
| **已迁移（S3 新增）** | | | |
| `pages/HomePage.vue` | `views/HomePage.vue` | S3 ✅ | RISC-V 品牌 + 快捷 prompt |
| `pages/ChatPage.vue` | `views/ChatPage.vue` | S3 ✅ | 1300→290 行重写 |
| `pages/MainLayout.vue` | `views/MainLayout.vue` | S3 ✅ | SessionPanel 侧边栏 |
| `ChatBox.vue` | `components/chat/ChatBox.vue` | S3 ✅ | 纯文本输入 |
| `ChatMessage.vue` | `components/chat/ChatMessage.vue` | S3 ✅ | MarkdownRenderer |
| `SuggestedQuestions.vue` | `components/chat/SuggestedQuestions.vue` | S3 ✅ | RISC-V 问题 |
| `LeftPanel.vue` + `SessionItem.vue` | `components/chat/SessionPanel.vue` | S3 ✅ | 合并为单文件 |
| `ActivityPanel.vue` | `components/shared/ActivityPanel.vue` | S3 ✅ | 思考+工具时间线 |
| `ui/dialog/*` | `components/ui/dialog/*` | S3 ✅ | reka-ui 原语 |
| `ui/Toast.vue` | `components/ui/toast/ToastContainer.vue` | S3 ✅ | CustomEvent 重写 |
| `api/agent.ts` | `api/chat.ts` | S3 ✅ | CRUD + SSE |
| `utils/*` (6 files) | `utils/*` | S3 ✅ | toast/eventBus/dom/time/content/markdownFormatter |
| `composables/*` (4 files) | `composables/*` | S3 ✅ | sessionGrouping/notifications/listUpdate/pendingChat |
| — (新建) | `stores/chat.ts` | S3 ✅ | Pinia store |
| — (新建) | `utils/markdown.ts` | S3 ✅ | 渲染管线 |
| — (新建) | `lib/utils.ts` | S3 ✅ | cn() |

### 后端新增模块（按 Sprint）

| 模块 | Sprint | 说明 |
|------|--------|------|
| `api/chat.py` + `services/chat_runner.py` | S3 ✅ | Chat Session CRUD + SSE 流式对话 |
| `models/chat_schemas.py` | S3 ✅ | ChatSession/ChatMessage/ChatEvent |
| `prompts/chat_system.py` | S3 ✅ | RISC-V 专家对话 System Prompt |
| `services/model_factory.py` | S3 ✅ | LLM 模型工厂 |
| `services/notifications.py` | S3 ✅ | in-memory pub/sub 通知总线 |
| `utils/response.py` | S3 ✅ | 统一响应包装 |
| `api/models.py` + `services/model_factory.py` | S4 | 多模型管理 + 工厂 |
| `api/memory.py` | S4 | 用户记忆/偏好 |
| `api/statistics.py` | S4+S8 | Token 用量统计 |
| `adapters/claude_adapter.py` | S5 | Claude Agent SDK 适配器 |
| `adapters/openai_adapter.py` | S5 | OpenAI Agents SDK 适配器 |
| `pipeline/prompts/*.py` | S5-S7 | 各阶段 Agent System Prompt |
| `pipeline/tools/*.py` | S5-S7 | 各阶段 Agent 工具集 |
| `services/artifact_manager.py` | S6 | 产物管理 |
| `services/sandbox_client.py` | S7 | Sandbox REST 客户端 |
| `api/skills.py` + `services/skill_loader.py` | S8 | Skills CRUD + 热加载 |
| `api/tools.py` + `services/tool_loader.py` | S8 | External Tools CRUD |
| `api/tooluniverse.py` | S8 | ToolUniverse API |
| `api/science.py` + `api/file.py` | S8 | Prompt 优化 + 文件下载 |
| `task-service/` | S9 | Celery 定时任务微服务 |
| `api/tasks.py` + `api/webhooks.py` | S9 | Tasks + Webhooks |
| `api/im.py` | S9 | IM 集成 (Lark/WeChat) |

---

## Sprint 划分

### Sprint 0-2：✅ 已完成

（详见 progress.md）

---

### Sprint 3：共享基础设施 + 对话模式基础（Week 3）

> 目标：迁移 ScienceClaw 核心 UI 组件 + 共享基础设施，搭建对话模式骨架（前后端）。
> 验收标准：① 对话模式可用：HomePage → 输入问题 → ChatPage 流式响应 → 多轮对话；② 共享组件（ActivityPanel/ToolCallView/Markdown）就绪。
> 策略：先建对话模式（复用 ScienceClaw 最多），再在后续 Sprint 用共享组件增强 Pipeline 模式。

#### 前端：共享组件迁移（Day 1-2）— 19h

- [x] 前端：引入 reka-ui + lucide-vue-next + simplebar-vue + marked + highlight.js + dompurify + katex + mermaid + mitt + vue-i18n + monaco-editor `~1h`
- [x] 前端：迁移 UI 原语（Dialog/Toast）+ 工具函数（cn）`~2h`
  - 产出：`components/ui/dialog/*`、`components/ui/toast/ToastContainer.vue`、`lib/utils.ts`
  - 偏差：Popover/Select/SimpleBar 推迟到 S4 按需迁移
- [x] 前端：迁移 utils 工具集（toast/eventBus/dom/time/content/markdownFormatter）`~1.5h`
- [x] 前端：SSE 客户端封装（POST-based chat + GET-based notifications）`~2.5h`
  - 产出：`api/chat.ts` 中 `connectChatSSE()` + `connectNotificationsSSE()`
  - 偏差：未抽为独立 SSE 模块，直接内联在 chat API 中
- [x] 前端：Markdown 渲染管线（marked + highlight.js + KaTeX + mermaid + DOMPurify）`~2h`
  - 产出：`utils/markdown.ts` + `styles/markdown.css` + `components/shared/MarkdownRenderer.vue`
  - 偏差：未迁移 MarkdownEnhancements 组件，改为 utility 函数 + 轻量 wrapper
- [x] 前端：迁移 ActivityPanel（思考+工具执行时间线）`~3h`
  - 产出：`components/shared/ActivityPanel.vue`，Chat 和 Pipeline 共用
- [x] 前端：迁移 ProcessGroup + StepMessage `~2h` — S4 完成
  - 产出：`components/shared/ProcessGroup.vue` + `StepMessage.vue`
- [ ] 前端：迁移 ToolCallView + toolViews + constants/tool.ts `~2.5h` — 推迟到 S4
  - 产出：工具调用可视化 + Shell/File/Search 视图 + 工具映射常量
- [ ] 前端：迁移 MonacoEditor + i18n 框架 + 中英文翻译 `~2.5h` — 推迟到 S4

#### 前端：对话模式页面（Day 2-4）— 25.5h

- [x] 前端：HomePage 迁移（欢迎页 + 快捷提示 + ChatBox）`~3h`
  - 产出：`views/HomePage.vue`，RISC-V 品牌 + 4 个快捷 prompt 卡片 + 底部 ChatBox
- [x] 前端：ChatBox 组件迁移（对话输入框）`~2.5h`
  - 产出：`components/chat/ChatBox.vue`，textarea + auto-resize + IME + Enter/Shift+Enter + send/stop
  - 偏差：移除文件附件功能，MVP 阶段仅支持纯文本
- [x] 前端：ChatMessage 组件迁移（消息渲染）`~3h`
  - 产出：`components/chat/ChatMessage.vue`，MarkdownRenderer + copy 按钮
  - 偏差：ScienceClaw 866 行拆分为 ~100 行组件 + markdown.ts utility
- [x] 前端：ChatPage 拆分迁移 `~5h`
  - 产出：`views/ChatPage.vue`（~290 行），SSE 事件处理内联（未提取 composable）
  - 偏差：ScienceClaw 1300 行 → 290 行，SSE 处理直接在 ChatPage 中而非 useChatSession composable
  - 支持事件类型：message_chunk, message_chunk_done, thinking, tool, done, error
- [x] 前端：SessionPanel 迁移（会话列表侧边栏）`~3h`
  - 产出：`components/chat/SessionPanel.vue`（~190 行）
  - 偏差：合并 LeftPanel + SessionItem 为单文件，未拆分 SessionItem
- [x] 前端：SuggestedQuestions 组件 `~0.5h`
- [x] 前端：useChatSession composable — 未单独创建，SSE 逻辑内联在 ChatPage `~0h`
  - 偏差：评估后认为 ChatPage 290 行可控，无需额外 composable 层
- [x] 前端：useSessionGrouping + useSessionNotifications + usePendingChat `~2h`
  - 产出：3 个 composable + useSessionListUpdate
- [x] 前端：chatStore (Pinia) `~1.5h`
  - 产出：`stores/chat.ts`，sessions + currentSession + loading + isStreaming + sortedSessions
  - 偏差：选择 Pinia store 而非 ScienceClaw 的 composable 单例模式，与现有 authStore/caseStore 保持一致
- [x] 前端：api/chat.ts（Session CRUD + chatWithSession SSE）+ 路由更新 `~2h`
  - 新增：`/` → HomePage, `/chat/:id` → ChatPage
  - 调整：`/cases` 和 `/cases/:id` 保持不变
  - 主布局：SessionPanel 侧边栏 + header + router-view

#### 后端：对话模式服务（Day 2-5，与前端并行）— 17.5h

- [x] 后端：ChatSession/ChatMessage/ChatEvent Pydantic 模型 `~1.5h`
  - 产出：`models/chat_schemas.py`
- [x] 后端：chat_sessions MongoDB 集合 + 索引 `~1h`
  - 字段：session_id, user_id, title, status, events[], model, created_at, updated_at, pinned, is_shared, latest_message
  - 索引：user_id + updated_at, status, is_shared
- [x] 后端：Chat Session CRUD API `~3h`
  - 产出：PUT /sessions（创建）, GET /sessions（列表）, GET /sessions/:id, DELETE /sessions/:id, PATCH /sessions/:id/pin, PATCH /sessions/:id/title
- [x] 后端：RISC-V 专家对话 System Prompt `~2h`
  - 产出：`prompts/chat_system.py`
- [x] 后端：ChatRunner 流式执行器 `~5h`
  - 产出：`services/chat_runner.py` + `services/model_factory.py`
  - 模式：asyncio.Queue → background worker → LLM astream() → SSE events
  - 事件类型：message_chunk, message_chunk_done, thinking, tool, done, error
- [x] 后端：POST /sessions/:id/chat SSE 端点 + POST /sessions/:id/stop `~3h`
- [x] 后端：GET /sessions/notifications SSE 端点 `~1.5h`
  - 产出：`services/notifications.py`（in-memory pub/sub bus）
- [x] 后端：Auth 补充端点：change-password, change-fullname, me, status `~1h`

#### 联调验收（Day 5）— 3h

- [ ] 联调：HomePage → 输入问题 → ChatPage 流式响应 → 多轮对话 `~3h` — 需后端部署后验证

**Sprint 3 实际完成：前端 19 tasks ✅ + 后端 8 tasks ✅ = 27 tasks，联调待 Sprint 4 初期验证**
**Sprint 3 推迟到 S4：ProcessGroup/StepMessage、ToolCallView/toolViews、MonacoEditor/i18n**

---

### Sprint 4：对话模式完善 + Model 管理（Week 4）

> 目标：Chat Mode 功能完善（工具调用、计划面板、文件面板、分享），Model CRUD，Statistics 基础。
> 验收标准：① 工具调用在 ActivityPanel 可见；② 模型切换生效；③ 会话分享可用；④ Statistics 页面显示用量。

#### 后端（20h）

- [x] 后端：ChatRunner 工具集成 — web_search, code_analysis `~4h`
  - 产出：`tools/__init__.py`, `tools/web_search.py`, `tools/code_analysis.py`
  - 使用 LangGraph `create_react_agent` + `astream_events(version="v2")`
- [x] 后端：ChatRunner Plan tracking middleware `~2h`
  - 产出：ChatRunner 检测 plan/step SSE 事件并发射
- [x] 后端：Model CRUD API — GET list, POST create, PUT update, DELETE, POST detect-context-window `~3h`
  - 产出：`api/models.py`，错误码 4001-4006
- [x] 后端：Model 配置模型 + 多模型工厂（OpenAI/Anthropic/DeepSeek）`~4h`
  - 产出：`models/model_schemas.py` + `services/model_factory.py` 重构
  - resolve_model_config() 从 DB 加载，verify_model_connection() 测试连接
- [x] 后端：Session share/unshare + shared 公开视图 `~2h`
  - 产出：`api/chat.py` 新增 3 个 share 端点
- [x] 后端：Session files + upload 端点 `~2h`
  - 产出：`api/files.py`，扩展名白名单 + 大小限制
- [x] 后端：Memory API — GET/PUT 用户记忆 `~1.5h`
  - 产出：`api/memory.py`，MongoDB `user_memories` 集合
- [x] 后端：Statistics API — summary/models/trends/sessions `~1.5h`
  - 产出：`api/statistics.py`，MongoDB 聚合管线

#### 前端（22h）

- [x] 前端：PlanPanel（多步骤计划可视化 + 进度）`~2.5h`
  - 产出：`components/chat/PlanPanel.vue`
- [x] 前端：ToolPanel + FilePanel + SessionFileList `~7h`
  - 产出：`components/chat/ToolPanel.vue`, `components/chat/FilePanel.vue`
- [x] 前端：SharePage + ShareLayout（公开分享回放）`~3h`
  - 产出：`views/ShareLayout.vue`, `views/SharePage.vue`
  - 路由：`/share/:id`（无 auth）
- [x] 前端：UserMenu（用户菜单 + Settings 触发）`~1h`
  - 产出：`components/shared/UserMenu.vue`
- [x] 前端：Settings 面板 — 6 个 tab: Account/General/Models/Personalization/Statistics/Notifications `~5h`
  - 产出：`components/settings/SettingsDialog.vue` + 6 个子组件
- [x] 前端：useSettingsDialog + useRightPanel + useFilePanel + useMessageGrouper composables `~2.5h`
  - 产出：4 个 composable 文件
- [x] 前端：api/models.ts + api/memory.ts + api/statistics.ts `~1h`

#### 集成收尾

- [x] 前端：ChatBox 模型选择器下拉 `~1h`
- [x] 前端：SessionPanel 分享/取消分享按钮 `~0.5h`
- [x] 前端：ProcessGroup + StepMessage 共享组件（S3 推迟项）`~1h`
- [x] 前端：ChatPage 集成 PlanPanel + tool/plan SSE 事件 + 右侧面板 `~2h`
- [x] 前端：MainLayout 重构（UserMenu + SettingsDialog）`~0.5h`

#### 联调（3h）

- [ ] 联调：Chat 工具调用 → ActivityPanel → PlanPanel → Statistics `~3h`

**Sprint 4 实际完成：后端 8 tasks ✅ + 前端 12 tasks ✅ = 20 tasks，联调待后端部署后验证**
**验证：ruff check passed (Sprint 4 files) | pnpm build OK**

---

### Sprint 5：Explorer + Planner Agent 真实 LLM（Week 5）

> 目标：Pipeline 前两阶段真实 LLM 调用。Explorer 使用 Claude Agent SDK，Planner 使用 OpenAI Agents SDK。
> 验收标准：Pipeline 启动 → Explorer 真实运行 → 人工审核通过 → Planner 生成方案 → 人工审核通过。

#### 后端（24h）

- [x] 后端：AgentAdapter 抽象基类 `~1h`
  - 产出：`adapters/__init__.py`（AgentEvent + AgentAdapter ABC）
- [x] 后端：LangChainReactAdapter（替代原计划的 Claude/OpenAI 独立 SDK 封装）`~4h`
  - 产出：`adapters/langchain_adapter.py`
  - 偏差：未使用 Claude Agent SDK / OpenAI Agents SDK，改用 LangGraph create_react_agent + astream_events，复用 ChatRunner 模式，降低复杂度
- [x] 后端：Explorer Prompt + Tools `~5h`
  - 产出：`pipeline/prompts/explorer.py` + `pipeline/tools/explorer_tools.py`
  - 工具：patchwork_search, mailing_list_search, code_grep
- [x] 后端：explore_node 真实实现 `~4h`
  - 替换 stub 为 LangChainReactAdapter 驱动的真实 LLM 调用
- [x] 后端：Planner Prompt + plan_node 真实实现 `~4.5h`
  - 产出：`pipeline/prompts/planner.py`
  - 使用 ChatOpenAI ainvoke + 结构化 JSON 输出
- [x] 后端：EventPublisher 扩展 — thinking/tool_call/tool_result 细粒度事件 `~1h`
- [x] 后端：PatchworkClient `~1h`
  - 产出：`datasources/patchwork.py`（httpx + tenacity retry）
- [x] 后端：PipelineState 扩展 + start_pipeline 输入传递 `~0.5h`
  - 新增 input_context/target_repo/contribution_type 字段
- [x] 后端：Token 成本估算 + merge_cost `~0.5h`
  - PRICING_PER_1M 定价表 + estimate_cost/merge_cost 函数
- [x] 后端：Config 扩展（ANTHROPIC_API_KEY + EXPLORER/PLANNER 配置）`~0.5h`
- [x] 后端：verify_exploration_claims 验证函数 `~1h`
  - 产出：`pipeline/verification.py`（URL 可达性 + 路径安全 + 证据阈值）

#### 前端（13h）

- [x] 前端：AgentEventLog 增强（工具参数表格 + 结果截断展开 + 自动滚动）`~3h`
- [x] 前端：ContributionCard（贡献类型 badge + 可行性评分 + 证据链）`~4h`
  - 产出：`components/pipeline/ContributionCard.vue`
- [x] 前端：ExecutionPlanView（开发步骤卡片 + 测试用例 + 风险 badge）`~4h`
  - 产出：`components/pipeline/ExecutionPlanView.vue`
- [x] 前端：CaseDetailPage 集成 ContributionCard + ExecutionPlanView `~2h`

#### 联调（3h）

- [x] 联调：Create case → Start → Explorer 真实运行 → Review → Planner 生成方案 `~3h`
  - 2026-04-30 验证通过：gpt-5.4 via 代理端点，Explorer 573 事件 + Planner 5 步骤
  - 修复：langchain-openai bind_tools 需 OPENAI_API_KEY 环境变量 → model_factory.py setdefault

**Sprint 5 总工时估算：~40h（实际 ~30h，SDK 策略简化节省了时间）**

---

### Sprint 6：Developer + Reviewer Agent + DiffViewer（Week 6）

> 目标：开发和审核阶段真实 LLM + 迭代循环。Monaco Diff Editor 展示补丁。
> 验收标准：Plan 通过 → Developer 生成补丁 → Reviewer 发现问题 → Developer 修复 → Reviewer 通过。

#### 后端（22h）

- [x] 后端：Developer Prompt + Tools `~5h`
  - 产出：`pipeline/prompts/developer.py` + `pipeline/tools/source_fetcher.py`（MVP 用 Pattern B，不需要 filesystem tools）
- [x] 后端：develop_node 真实实现 `~5h`
  - 产出：`pipeline/nodes/develop.py`（Pattern B direct llm.ainvoke）
- [x] 后端：Reviewer Prompt + Tools `~4h`
  - 产出：`pipeline/prompts/reviewer.py`（MVP 无独立 tools，checkpatch 延后到有 kernel build env）
- [x] 后端：review_node 真实实现（确定性+LLM 双轨）`~4h`
  - 产出：`pipeline/nodes/review.py`（Pattern B + route_review_decision 路由）
- [x] 后端：ArtifactManager `~2.5h`
  - 产出：`services/artifact_manager.py`（MVP stub，patches inline 存 MongoDB）
- [x] 后端：Develop↔Review 迭代循环验证 + escalate 逻辑 `~1.5h`
  - 额外：nodes.py 拆包为 `pipeline/nodes/` package（8 模块），code review 修复 2 CRITICAL + 5 HIGH

#### 前端（18h）

- [x] 前端：DiffViewer（Monaco Diff Editor，side-by-side + inline）`~5h`
  - 产出：`components/pipeline/DiffViewer.vue` + `utils/monaco.ts`
- [x] 前端：PatchFileList + ReviewFindingsView `~5h`
  - 产出：`DevelopmentResultCard.vue`（含可折叠文件列表 + DiffViewer）+ `ReviewVerdictCard.vue`
- [x] 前端：IterationBadge + IterationTimeline `~3h`
  - 产出：`IterationBadge.vue`（色彩编码迭代计数器）
- [x] 前端：CaseDetailPage 更新 — DiffViewer 集成 `~2h`
  - 右侧栏添加 DevelopmentResultCard + ReviewVerdictCard + IterationBadge
- [x] 前端：ReviewPanel 更新 — findings 行内高亮 `~3h`
  - ReviewVerdictCard 已包含 severity badges + category 颜色 + 文件位置

#### 联调（3h）

- [x] 联调：Plan 通过 → Developer 生成补丁 → DiffViewer → Reviewer 迭代 → 通过 `~3h`
  - code review 修复 4 HIGH（promise rejection、ARIA、dead code、async loading states）

**Sprint 6 总工时估算：~43h → 实际 ~28h（Pattern B 简化 + 不需要独立 tools）**

---

### Sprint 7：Tester Agent + 全 Pipeline E2E（Week 7）

> 目标：完整 5 阶段 Pipeline 端到端 + 测试覆盖。
> 验收标准：完整 Pipeline 从 Explore 到 Test 全部通过，测试覆盖率 70%+。

#### 后端（18h）

- [x] 后端：Tester Prompt + Tools `~4.5h`
  - 产出：`pipeline/prompts/tester.py`（Pattern B，无独立 tools）
  - 偏差：Pattern B（direct llm.ainvoke），不需要 bash_exec/qemu_boot tools
- [x] 后端：test_node 真实实现 `~4h`
- [ ] 后端：Sandbox REST 客户端 `~2h`（推迟，MVP 不需要真实 QEMU）
  - 产出：`services/sandbox_client.py`
- [x] 后端：集成测试 — 全 Pipeline (mocked LLM) `~4h`
  - 产出：test_pipeline_coverage.py（36 tests）+ test_pipeline_sprint7.py（16 tests）
- [ ] 后端：单元测试 — adapters + chat_runner + artifact_manager `~3.5h`（推迟到 Sprint 8）

#### 前端（14h）

- [x] 前端：TestResultSummary + TestLogViewer `~4.5h`
  - 产出：TestResultCard.vue（含 test case 列表 + 可折叠日志）
- [x] 前端：CompletionCard（补丁下载 + commit message）`~2h`
- [ ] 前端：错误处理 + 响应式 + loading states `~4.5h`（推迟到 Sprint 8）
- [ ] 前端：单元测试 — useChatSession, useCaseEvents `~3h`（推迟到 Sprint 8）

#### 联调（4h）

- [ ] 联调：完整 5 阶段 Pipeline E2E `~2.5h`
- [ ] 压力测试：并发 Pipeline + Chat `~1.5h`

**Sprint 7 总工时估算：~36h**

---

### Sprint 8：Skills + Tools + ToolUniverse + 完整 Settings（Week 8）

> 目标：ScienceClaw 二级功能对标 — Skills/Tools/ToolUniverse/完整 Settings。
> 验收标准：Skills 页面可用、ToolUniverse 可运行、Settings 8 tab 完整。

#### 后端（18h）

- [ ] 后端：Skills CRUD + 热加载 `~5h`
  - 产出：`api/skills.py` + `services/skill_loader.py`
- [ ] 后端：3 个 RISC-V 初始 Skill `~2h`
  - 产出：`skills/` 目录
- [ ] 后端：External Tools CRUD + 热加载 `~4h`
  - 产出：`api/tools.py` + `services/tool_loader.py`
- [ ] 后端：ToolUniverse API — list/get/run/categories `~3h`
  - 产出：`api/tooluniverse.py`
- [ ] 后端：optimize_prompt 端点 `~1h`
  - 产出：`api/science.py`
- [ ] 后端：文件下载端点 `~1h`
  - 产出：`api/file.py`
- [ ] 后端：Statistics 增强 — 每模型成本、趋势 `~2h`

#### 前端（20h）

- [ ] 前端：SkillsPage + SkillDetailPage `~5.5h`
- [ ] 前端：ToolsPage + ToolDetailPage `~4.5h`
- [ ] 前端：ScienceToolDetail（ToolUniverse 工具详情 + 参数表单 + 运行）`~2h`
- [ ] 前端：ModelSettings（Model CRUD + context window 检测）`~2h`
- [ ] 前端：TokenStatistics（用量图表 + 时间范围 + 货币切换）`~2.5h`
- [ ] 前端：AccountSettings + ChangePassword + PersonalizationSettings `~2.5h`
- [ ] 前端：api/skills.ts + api/tools.ts + api/tooluniverse.ts `~1h`

#### 联调（2h）

- [ ] 联调：Skill 创建 → 出现在 Chat 工具列表 → 对话中使用 `~2h`

**Sprint 8 总工时估算：~40h**

---

### Sprint 9：Scheduled Tasks + IM + 部署收尾（Week 9）

> 目标：最终 ScienceClaw 功能（定时任务、Webhooks、IM），生产部署，文档。
> 验收标准：`docker compose up` → 对话 + Pipeline 双模式 + 全部功能可用。

#### 后端（20h）

- [ ] 后端：Celery 定时任务微服务 `~4h`
  - 产出：`task-service/` 目录
- [ ] 后端：Tasks API — CRUD + validate-schedule + runs `~3h`
  - 产出：`api/tasks.py`
- [ ] 后端：Webhooks API — CRUD + test `~2h`
  - 产出：`api/webhooks.py`
- [ ] 后端：IM API — Lark bind/unbind/status + WeChat start/stop/status + system settings `~2h`
  - 产出：`api/im.py`
- [ ] 后端：会话通知 pub/sub 服务 `~1.5h`
  - 产出：`services/notification_service.py`
- [ ] 后端：安全加固 — rate limiting + input validation `~2h`
- [ ] 后端：Docker 优化 — multi-stage build + health checks `~2h`
- [ ] 后端：Nginx 双 SSE 路径 + OpenAPI 文档更新 `~2.5h`
- [ ] 后端：部署文档 + .env template `~1h`

#### 前端（16h）

- [ ] 前端：TasksPage（定时任务管理，三栏布局）`~3h`
- [ ] 前端：TaskConfigPage（任务配置 + NLP 调度输入）`~2.5h`
- [ ] 前端：TaskSettings + NotificationSettings `~2.5h`
- [ ] 前端：IMSettings（Lark/WeChat 绑定 UI）`~1.5h`
- [ ] 前端：LanguageSelector + i18n 全量翻译 `~2.5h`
- [ ] 前端：无障碍审计 + UI 动效 + 空状态 + error boundaries `~4h`

#### 部署联调（6h）

- [ ] 部署：Docker Compose 添加 task-service (Celery + Redis broker) `~1h`
- [ ] 冒烟测试：全流程 register → chat → pipeline → complete `~2h`
- [ ] 性能测试：10 并发 chat + 3 并发 pipeline `~1.5h`
- [ ] README 更新：setup guide + architecture diagram `~1.5h`

**Sprint 9 总工时估算：~42h**

---

## 工时汇总

| Sprint | 后端 | 前端 | 联调 | 合计 | 状态 |
|--------|------|------|------|------|------|
| Sprint 0 | ~10h | ~3.5h | ~5.5h | ~19h | ✅ 已完成 |
| Sprint 1 | ~19h | ~15h | — | ~34h | ✅ 已完成 |
| Sprint 2 | ~23h | ~23.5h | — | ~46.5h | ✅ 已完成 |
| Sprint 3 | ~17.5h | ~44.5h | ~3h | ~65h | 🔲 待开始 |
| Sprint 4 | ~20h | ~22h | ~3h | ~45h | 🔲 待开始 |
| Sprint 5 | ~24h | ~13h | ~3h | ~40h | ✅ 已完成 |
| Sprint 6 | ~22h | ~18h | ~3h | ~43h | ✅ 已完成 |
| Sprint 7 | ~18h | ~14h | ~4h | ~36h | ✅ 已完成 |
| Sprint 8 | ~18h | ~20h | ~2h | ~40h | 🔲 待开始 |
| Sprint 9 | ~20h | ~16h | ~6h | ~42h | 🔲 待开始 |
| **总计** | **~191.5h** | **~189.5h** | **~30h** | **~411h** | — |

---

## 关键里程碑

| 里程碑 | 时间 | 交付物 | 验收标准 |
|--------|------|--------|----------|
| M0 | Sprint 0 ✅ | 项目骨架 | `docker compose up` 全绿 |
| M1 | Sprint 2 ✅ | Pipeline 引擎 + 案例 UI | SSE 事件流通 |
| M2 | Sprint 3 | **对话模式 MVP** + 共享组件 | 多轮对话流式响应，对标 ScienceClaw |
| M3 | Sprint 4 | **对话模式完整** | 工具+计划+统计+分享+模型管理 |
| M4 | Sprint 5 | Explorer + Planner E2E | 真实 LLM Pipeline 前 2 阶段 |
| M5 | Sprint 6 | Dev + Review 迭代 | 补丁生成 + DiffViewer + 迭代循环 |
| M6 | Sprint 7 | 完整 5 阶段 Pipeline | 全 Pipeline E2E + 测试覆盖 70%+ |
| M7 | Sprint 8 | **ScienceClaw 功能对标** | Skills + Tools + ToolUniverse + Settings 8 tab |
| M8 | Sprint 9 | **生产就绪（全功能）** | Docker 部署 + Tasks + IM + 全功能可用 |

---

## 风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| Sprint 3 工时超预期（65h） | 高 | 中 | 共享组件从 ScienceClaw 复制+适配，前后端并行 |
| Claude Agent SDK 不稳定 | 高 | 中 | Sprint 5 优先验证，准备降级到 raw Anthropic API |
| ChatPage 1300 行迁移复杂 | 中 | 中 | 拆分为 composable，不 1:1 复制 |
| Chat 和 Pipeline SSE 冲突 | 中 | 低 | 独立 SSE 端点，共享客户端封装 |
| 对话模式 LLM 成本 | 中 | 中 | 默认 gpt-4o-mini，可切换 |
| OpenAI Agents SDK Breaking Changes | 中 | 低 | 适配器层隔离 + 版本锁定 |
| LLM 开发期成本 | 中 | 中 | 开发期用 gpt-4o-mini/claude-haiku，CostCircuitBreaker 已有 |
| IM 集成复杂度 | 中 | 中 | Sprint 9 实现 stub 级别，后续迭代完善 |
| QEMU 沙箱安全 | 高 | 低 | MVP 仅编译验证，完整沙箱 Phase 2 |

---

## 技术决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| 双模式架构 | Chat + Pipeline 独立路由和后端 | 职责分离 |
| Chat SSE | asyncio.Queue（对标 ScienceClaw） | 单会话无需 Redis |
| Pipeline SSE | Redis Pub/Sub | 多节点需要解耦 |
| Chat 存储 | MongoDB `chat_sessions`（events 内嵌） | 对标 ScienceClaw |
| Pipeline 存储 | MongoDB `contribution_cases` + PG 检查点 | LangGraph 需要 |
| 共享组件 | ActivityPanel/ToolCallView/Markdown | 双模式复用 |
| 路由 | `/` + `/chat/:id` / `/cases` + `/cases/:id` | 清晰分离 |
| UI 组件库 | reka-ui | 对标 ScienceClaw |
| 前端迁移 | 组件级迁移 | ChatPage 拆分迁移，不整页复制 |
| Agent SDK | Claude (explore/develop/test) + OpenAI (plan/review) | 各取所长 |
| 编排层 | LangGraph StateGraph | 统一状态管理 + 检查点 |
| 定时任务 | Celery + Redis broker | 对标 ScienceClaw task-service |
| IM 集成 | Lark + WeChat bridge | 完全对标 ScienceClaw |

---

## 依赖关系图

```
Sprint 0-2 ✅ (骨架 + Auth + Case + Pipeline 引擎)
    │
    ├──→ Sprint 3 (共享组件 + Chat 基础)
    │        │
    │        ├──→ Sprint 4 (Chat 完善 + Models + Statistics)
    │        │        │
    │        │        └──→ Sprint 5 (Explorer + Planner 真实 LLM)
    │        │                 │
    │        │                 └──→ Sprint 6 (Developer + Reviewer + DiffViewer)
    │        │                          │
    │        │                          └──→ Sprint 7 (Tester + 全 Pipeline E2E)
    │        │                                   │
    │        │                                   └──→ Sprint 8 (Skills + Tools + ToolUniverse)
    │        │                                            │
    │        │                                            └──→ Sprint 9 (Tasks + IM + 部署)
    │        │
    │        └──→ Sprint 8 (共享组件被 Skills/Tools 页面复用)
    │
    └──→ Sprint 4 (Model 管理被 Sprint 5 model_factory 依赖)
```

