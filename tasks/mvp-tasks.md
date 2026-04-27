# RV-Insights MVP 阶段任务清单（v3 — 双模式：对话 + Pipeline）

> 目标：构建 AI 驱动的多 Agent 平台，面向 RISC-V 开源贡献场景。
> 双模式：① ScienceClaw 同款对话交互（RISC-V 专家 Q&A）② 五阶段 Agent Pipeline（自动化贡献）
> 参考项目：ScienceClaw（Vue 3 + Vite + TailwindCSS 前端，FastAPI + deepagents 后端，MongoDB）
> 预计周期：7 个 Sprint（每 Sprint 1 周），共 7 周
> 版本：v3 — 新增对话交互模式，对标 ScienceClaw 完整功能

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
│  │  LeftPanel (会话列表)│    │  PipelineView (流水线)      │  │
│  │  ActivityPanel     │    │  ReviewPanel (审核)          │  │
│  │  ChatBox (输入)    │    │  DiffViewer (代码差异)       │  │
│  └──────────────────┘    └────────────────────────────┘  │
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

### 架构对标决策（v3 更新）

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 前端状态管理 | 保留 Pinia | 已有 caseStore/authStore，新增 chatStore |
| SSE 后端（Pipeline） | Redis Pub/Sub + Stream | 多节点 pipeline 解耦 + Last-Event-ID 重连 |
| SSE 后端（Chat） | asyncio.Queue → EventSourceResponse | 对标 ScienceClaw，单会话无需 Redis |
| SSE 客户端 | `@microsoft/fetch-event-source` | 统一 auth headers + 自动重连 |
| Pipeline 引擎 | raw LangGraph + 双 SDK | `deepagents` 与 human gates 不兼容 |
| Chat 引擎 | LangChain ChatModel 直接调用 | 无需 LangGraph 编排，简单直接 |
| UI 组件库 | reka-ui | 对标 ScienceClaw |
| 前端迁移 | 组件级迁移 | ChatPage 拆分迁移，不整页复制 |

---

## 从 ScienceClaw 迁移清单（v3 — 含对话组件）

### 前端直接迁移（复制 + 适配）

| ScienceClaw 源文件 | RV-Insights 目标 | 适配工作 |
|---------------------|------------------|----------|
| **对话核心组件** | | |
| `pages/HomePage.vue` | `views/HomePage.vue` | **新增**：欢迎页 + 快捷提示 + ChatBox |
| `pages/ChatPage.vue` | `views/ChatPage.vue` | **新增**：拆分迁移，提取 SSE 事件处理为 composable |
| `components/ChatBox.vue` | `components/chat/ChatBox.vue` | **新增**：对话输入框 + 文件附件 + 模型选择 |
| `components/ChatMessage.vue` | `components/chat/ChatMessage.vue` | **新增**：消息渲染（markdown + 代码 + mermaid） |
| `components/SuggestedQuestions.vue` | `components/chat/SuggestedQuestions.vue` | **新增**：推荐问题 |
| `components/LeftPanel.vue` | `components/chat/SessionPanel.vue` | **新增**：会话列表侧边栏（与 CaseListPanel 并列） |
| `components/SessionItem.vue` | `components/chat/SessionItem.vue` | **新增**：会话列表项（pin/rename/delete） |
| `components/ActivityPanel.vue` | `components/shared/ActivityPanel.vue` | **新增**：思考+工具时间线（Chat 和 Pipeline 共用） |
| `components/ProcessMessage.vue` | `components/shared/ProcessGroup.vue` | **新增**：执行过程分组 |
| `components/StepMessage.vue` | `components/shared/StepMessage.vue` | **新增**：步骤消息 |
| `components/ToolUse.vue` | `components/shared/ToolCallView.vue` | **新增**：工具调用可视化 |
| `components/SimpleBar.vue` | `components/ui/SimpleBar.vue` | **新增**：自定义滚动条 |
| **对话 composables** | | |
| `composables/useSessionNotifications.ts` | `composables/useSessionNotifications.ts` | **新增**：会话通知 SSE |
| `composables/useSessionGrouping.ts` | `composables/useSessionGrouping.ts` | **新增**：会话时间分组 |
| `composables/usePendingChat.ts` | `composables/usePendingChat.ts` | **新增**：跨页消息传递 |
| `composables/useMessageGrouper.ts` | `composables/useMessageGrouper.ts` | **新增**：消息分组（process+step） |
| `composables/useRightPanel.ts` | `composables/useRightPanel.ts` | **新增**：右侧面板状态 |
| **对话 API** | | |
| `api/agent.ts` | `api/chat.ts` | **新增**：Session CRUD + chatWithSession SSE |
| **工具视图** | | |
| `components/toolViews/ShellToolView.vue` | `components/toolViews/ShellToolView.vue` | 直接复用 |
| `components/toolViews/FileToolView.vue` | `components/toolViews/FileToolView.vue` | 直接复用 |
| `components/toolViews/SearchToolView.vue` | `components/toolViews/SearchToolView.vue` | 直接复用 |
| **已迁移（v2 计划）** | | |
| `api/client.ts` | `api/client.ts` | 已完成，需升级 SSE |
| `composables/useAuth.ts` | `composables/useAuth.ts` | 已完成 |
| `composables/useTheme.ts` | `composables/useTheme.ts` | 直接复用 |
| `components/ui/*` | `components/ui/*` | 引入 reka-ui |
| `components/MarkdownEnhancements.vue` | `components/MarkdownEnhancements.vue` | 直接复用 |
| `components/ui/MonacoEditor.vue` | `components/ui/MonacoEditor.vue` | 直接复用 |
| `components/settings/*` | `components/settings/*` | 裁剪版 |
| `components/UserMenu.vue` | `components/UserMenu.vue` | 直接复用 |
| `assets/theme.css` + `global.css` | `assets/` | 已完成 |
| `locales/*` | `locales/` | 扩展 RV-Insights 词条 |
| `constants/tool.ts` | `constants/tool.ts` | 工具映射 |
| `utils/*` | `utils/*` | 直接复用 |

### 后端新增（对话模式）

| 模块 | 说明 |
|------|------|
| `api/chat.py` | **新增**：Chat Session CRUD + SSE 对话端点 |
| `services/chat_service.py` | **新增**：LLM 调用 + 工具执行 + 流式响应 |
| `services/chat_runner.py` | **新增**：SSE 流式执行器（asyncio.Queue 模式，对标 ScienceClaw runner.py） |
| `models/chat_schemas.py` | **新增**：ChatSession, ChatMessage, ChatEvent Pydantic 模型 |
| `prompts/chat_system.py` | **新增**：RISC-V 专家对话 System Prompt |
| MongoDB `chat_sessions` 集合 | **新增**：对话会话存储（events 内嵌） |

---

## Sprint 划分

### Sprint 0-2：✅ 已完成

（详见 progress.md）

---

### Sprint 3：ScienceClaw 前端迁移 + 对话模式基础（Week 3）

> 目标：迁移 ScienceClaw 核心 UI 组件 + 共享基础设施，搭建对话模式骨架（前后端）。
> 验收标准：① 对话模式可用：HomePage → 输入问题 → ChatPage 流式响应 → 多轮对话；② 共享组件（ActivityPanel/ToolCallView/Markdown）就绪。
> 策略：先建对话模式（复用 ScienceClaw 最多），再在 Sprint 4+ 用共享组件增强 Pipeline 模式。

#### 前端：共享组件迁移（Day 1-2）

- [ ] 前端：引入 reka-ui + lucide-vue-next + simplebar-vue 依赖 `~0.5h`
- [ ] 前端：迁移 UI 原语（dialog/popover/select/toast/SimpleBar）`~2h`
  - 源：`ScienceClaw/frontend/src/components/ui/`
- [ ] 前端：迁移 utils 工具集（toast/eventBus/dom/time/markdownFormatter）`~1h`
- [ ] 前端：升级 SSE 客户端为 `@microsoft/fetch-event-source` `~2h`
  - 产出：统一 SSE 封装，Chat 和 Pipeline 共用
- [ ] 前端：迁移 MarkdownEnhancements（代码高亮 + mermaid + KaTeX）`~1.5h`
- [ ] 前端：迁移 ActivityPanel（思考+工具执行时间线）`~3h`
  - 产出：`components/shared/ActivityPanel.vue`，Chat 和 Pipeline 共用
- [ ] 前端：迁移 ProcessGroup + StepMessage `~2.5h`
  - 产出：`components/shared/ProcessGroup.vue` + `StepMessage.vue`
- [ ] 前端：迁移 ToolCallView + toolViews + constants/tool.ts `~3h`
  - 产出：工具调用可视化 + Shell/File/Search 视图 + 工具映射常量
- [ ] 前端：迁移 MonacoEditor + UserMenu + LanguageSelector `~1.5h`
- [ ] 前端：迁移 i18n 框架 + 中英文翻译 `~1.5h`

**共享组件工时：~19h**

#### 前端：对话模式页面（Day 2-4）

- [ ] 前端：HomePage 迁移（欢迎页 + 快捷提示 + ChatBox）`~3h`
  - 源：`ScienceClaw/frontend/src/pages/HomePage.vue`
  - 产出：`views/HomePage.vue`，欢迎语 + 快捷 prompt 卡片 + 底部 ChatBox
- [ ] 前端：ChatBox 组件迁移（对话输入框）`~2h`
  - 源：`ScienceClaw/frontend/src/components/ChatBox.vue`
  - 产出：`components/chat/ChatBox.vue`，支持文本输入 + 文件附件 + 发送/停止
- [ ] 前端：ChatMessage 组件迁移（消息渲染）`~2.5h`
  - 源：`ScienceClaw/frontend/src/components/ChatMessage.vue`
  - 产出：`components/chat/ChatMessage.vue`，Markdown + 代码高亮 + 逐 token 打字机效果
- [ ] 前端：ChatPage 拆分迁移 `~5h`
  - 源：`ScienceClaw/frontend/src/pages/ChatPage.vue`（1300 行）
  - 产出：`views/ChatPage.vue` + `composables/useChatSession.ts`
  - 关键：SSE 事件处理提取为 composable，不做 1:1 复制
  - 支持事件类型：message_chunk, tool, step, thinking, plan, done, error, title
- [ ] 前端：SessionPanel 迁移（会话列表侧边栏）`~3h`
  - 源：`ScienceClaw/frontend/src/components/LeftPanel.vue` + `SessionItem.vue`
  - 产出：`components/chat/SessionPanel.vue` + `SessionItem.vue`
  - 功能：会话列表 + 时间分组 + pin/rename/delete + 搜索
- [ ] 前端：SuggestedQuestions 组件 `~1h`
- [ ] 前端：useChatSession composable（SSE 事件处理核心）`~3h`
  - 产出：管理 SSE 连接、事件分发、消息累积、工具调用追踪、停止/重连
- [ ] 前端：useSessionGrouping + useSessionNotifications + usePendingChat `~2h`
- [ ] 前端：chatStore (Pinia) `~1.5h`
  - 产出：会话列表 + 当前会话 + 消息列表 + 连接状态
- [ ] 前端：api/chat.ts（Session CRUD + chatWithSession SSE）`~1.5h`
- [ ] 前端：路由更新 `~1h`
  - 新增：`/` → HomePage, `/chat/:id` → ChatPage
  - 调整：`/cases` 和 `/cases/:id` 保持不变
  - 主布局：左侧导航切换 Chat / Pipeline 两个模式

**对话模式前端工时：~25.5h**

#### 后端：对话模式服务（Day 2-5，与前端并行）

- [ ] 后端：ChatSession MongoDB 模型 + 集合 `~2h`
  - 产出：`chat_sessions` 集合，字段：session_id, user_id, title, status, events[], model, created_at, updated_at, pinned, is_shared, latest_message
  - 索引：user_id + updated_at, status, is_shared
- [ ] 后端：Chat Session CRUD API `~3h`
  - 产出：PUT /sessions（创建）, GET /sessions（列表）, GET /sessions/:id, DELETE /sessions/:id, PATCH /sessions/:id/pin, PATCH /sessions/:id/title
- [ ] 后端：RISC-V 专家对话 System Prompt `~2h`
  - 产出：`prompts/chat_system.py`
- [ ] 后端：ChatRunner 流式执行器 `~5h`
  - 对标：`ScienceClaw/backend/deepagent/runner.py`
  - 模式：asyncio.Queue → background worker → LLM astream() → SSE events
  - 事件类型：message_chunk, tool, step, thinking, plan, done, error, title
- [ ] 后端：POST /sessions/:id/chat SSE 端点 `~3h`
- [ ] 后端：POST /sessions/:id/stop 端点 `~1h`
- [ ] 后端：Session 通知 SSE 端点 `~1.5h`

**后端对话模式工时：~17.5h**

#### 联调验收（Day 5）

- [ ] 联调：HomePage → 输入问题 → ChatPage 流式响应 → 多轮对话 `~3h`

**Sprint 3 总工时估算：~65h（2 人并行约 1.5 周）**

---

### Sprint 4：Explorer Agent + Pipeline UI 增强（Week 4-5 前半）

> 目标：Explorer Agent 真实 LLM 调用 + 用共享组件增强 Pipeline UI。
> 验收标准：Pipeline 启动 → Explorer 运行 → 前端实时显示 → 审核通过。

#### 后端

- [ ] 后端：ClaudeAgentAdapter `~4h`
- [ ] 后端：Explorer Prompt + explore_node 真实实现 `~6h`
- [ ] 后端：parse_agent_output + verify_exploration_claims `~4.5h`
- [ ] 后端：PatchworkClient `~2h`
- [ ] 后端：explore_node 事件发布 + 统一 ApiResponse `~2.5h`

**后端工时：~19h**

#### 前端

- [ ] 前端：重构 AgentEventLog 基于共享组件 `~3h`
- [ ] 前端：移除 Pipeline Mock API `~2h`
- [ ] 前端：ContributionCard + EvidenceChain `~3.5h`
- [ ] 前端：CostSummary `~1.5h`
- [ ] 联调 `~3h`

**前端工时：~13h**

**Sprint 4 总工时估算：~32h**

---

### Sprint 5：Planner + Developer + DiffViewer（Week 5 后半-6 前半）

> 验收标准：Explore → Plan → Develop 端到端。

#### 后端

- [ ] 后端：OpenAIAgentAdapter `~3h`
- [ ] 后端：Planner Agent + plan_node `~6h`
- [ ] 后端：Developer Agent + develop_node `~6h`
- [ ] 后端：ArtifactManager `~2.5h`
- [ ] 后端：develop_node 事件发布 `~1.5h`
- [ ] 验收 `~2h`

**后端工时：~21h**

#### 前端

- [ ] 前端：ExecutionPlanView `~4h`
- [ ] 前端：DiffViewer（Monaco）`~5h`
- [ ] 前端：补丁文件查看器 + IterationBadge `~3h`
- [ ] 联调 `~3h`

**前端工时：~15h**

**Sprint 5 总工时估算：~36h**

---

### Sprint 6：Review + Test + 迭代循环（Week 6 后半-7 前半）

> 验收标准：完整 5 阶段 Pipeline + Develop ↔ Review 迭代。

#### 后端

- [ ] 后端：Reviewer Agent + review_node（确定性+LLM 双轨）`~8h`
- [ ] 后端：checkpatch.pl 集成 `~3h`
- [ ] 后端：迭代循环验证 + escalate_node `~3.5h`
- [ ] 后端：Tester Agent + test_node `~4h`
- [ ] 验收 `~2h`

**后端工时：~20.5h**

#### 前端

- [ ] 前端：ReviewFindingsView + DiffViewer 行内高亮 `~6h`
- [ ] 前端：TestResultSummary + TestLogViewer `~3h`
- [ ] 前端：迭代历史时间线 `~3h`
- [ ] 联调 `~3h`

**前端工时：~15h**

**Sprint 6 总工时估算：~35.5h**

---

### Sprint 7：测试 + 部署 + 收尾（Week 7 后半）

> 验收标准：`docker compose up` → 对话 + Pipeline 双模式均可用。

- [ ] 后端：单元测试（routes + contracts + adapters + chat_runner）`~7h`
- [ ] 后端：集成测试（Pipeline + Chat with testcontainers）`~5h`
- [ ] 前端：错误处理 + 响应式 + i18n 完善 + Settings 迁移 `~8.5h`
- [ ] 部署：Docker 优化 + Nginx 双 SSE 路径 + 冒烟测试 + 文档 `~10.5h`

**Sprint 7 总工时估算：~31h**

---

## 工时汇总

| Sprint | 后端 | 前端 | 合计 | 状态 |
|--------|------|------|------|------|
| Sprint 0 | ~10h | ~3.5h | ~19h | ✅ 已完成 |
| Sprint 1 | ~19h | ~15h | ~34h | ✅ 已完成 |
| Sprint 2 | ~23h | ~23.5h | ~46.5h | ✅ 已完成 |
| Sprint 3 | ~17.5h | ~44.5h | ~65h | 🔲 待开始 |
| Sprint 4 | ~19h | ~13h | ~32h | 🔲 待开始 |
| Sprint 5 | ~21h | ~15h | ~36h | 🔲 待开始 |
| Sprint 6 | ~20.5h | ~15h | ~35.5h | 🔲 待开始 |
| Sprint 7 | ~12h | ~19h | ~31h | 🔲 待开始 |
| **总计** | **~142h** | **~148.5h** | **~299h** | — |

---

## 关键里程碑

| 里程碑 | 时间 | 交付物 | 验收标准 |
|--------|------|--------|----------|
| M0 | Sprint 0 ✅ | 项目骨架 | `docker compose up` 全绿 |
| M1 | Sprint 2 ✅ | Pipeline 引擎 + 案例 UI | SSE 事件流通 |
| M2 | Sprint 3 | **对话模式可用** + 共享组件 | 多轮对话流式响应，对标 ScienceClaw |
| M3 | Sprint 4 | Explorer E2E | Explorer 真实运行 |
| M4 | Sprint 5 | 3 阶段 MVP | Explore → Plan → Develop |
| M5 | Sprint 6 | 5 阶段完整 Pipeline | Review 迭代 + Test |
| M6 | Sprint 7 | 可部署版本（双模式） | 对话 + Pipeline 均可用 |

---

## 风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| Sprint 3 工时超预期（65h） | 高 | 中 | 允许延长 2-3 天，共享组件优先 |
| Claude Agent SDK 不稳定 | 高 | 中 | Sprint 4 优先验证，准备降级方案 |
| ChatPage 1300 行迁移复杂 | 中 | 中 | 拆分为 composable，不 1:1 复制 |
| Chat 和 Pipeline SSE 冲突 | 中 | 低 | 独立 SSE 端点，共享客户端封装 |
| 对话模式 LLM 成本 | 中 | 中 | 默认 gpt-4o-mini，可切换 |

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
