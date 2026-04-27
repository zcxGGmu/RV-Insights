# RV-Insights MVP 阶段任务清单（v2 — 对标 ScienceClaw）

> 目标：构建 AI 驱动的多 Agent 平台，面向 RISC-V 开源贡献场景。
> 参考项目：ScienceClaw（Vue 3 + Vite + TailwindCSS 前端，FastAPI + LangGraph 后端，MongoDB）
> 预计周期：6 个 Sprint（每 Sprint 1 周），共 6 周
> 版本：v2 — 基于 ScienceClaw 架构对标分析重构

---

## 架构对标决策（Oracle 分析结论）

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 前端状态管理 | 保留 Pinia，迁移 ScienceClaw 组件时适配 | 已有 caseStore/authStore 可用，Pinia 提供 devtools/HMR/$reset |
| SSE 后端 | 保留 Redis Pub/Sub + Stream | 已实现，支持多节点 pipeline 解耦 + Last-Event-ID 重连恢复 |
| SSE 客户端 | 采用 ScienceClaw 的 `@microsoft/fetch-event-source` | 支持 auth headers、自动重连、指数退避 |
| 后端框架 | 保持 raw LangGraph + 双 SDK 适配器 | `deepagents` 库与双 SDK + human gates 不兼容 |
| 前端迁移策略 | 组件级迁移（非整页迁移），保留 CaseDetailPage 三栏布局 | 避免 ChatPage 1300 行单体迁移风险 |
| 前端 UI 原语 | 引入 reka-ui（ScienceClaw 同款） | 无头组件库，与现有 Tailwind 兼容 |

## 从 ScienceClaw 迁移清单（更新版）

### 前端直接迁移（复制 + 适配）

| ScienceClaw 源文件 | RV-Insights 目标 | 适配工作 |
|---------------------|------------------|----------|
| `api/client.ts` | `api/client.ts` | 已完成（Sprint 0），需升级 SSE 为 fetch-event-source |
| `composables/useAuth.ts` | `composables/useAuth.ts` | 已完成，保留 JWT 实现 |
| `composables/useTheme.ts` | `composables/useTheme.ts` | 直接复用 |
| `composables/useI18n.ts` | `composables/useI18n.ts` | 直接复用 |
| `components/ui/*` (dialog/popover/select) | `components/ui/*` | 引入 reka-ui，复制原语 |
| `components/login/*` | `views/LoginPage.vue` | 已完成，可参考美化 |
| `components/LeftPanel.vue` | `views/CaseListPage.vue` | 已适配为 CaseListPanel |
| `components/ChatMessage.vue` | `components/AgentEventLog.vue` | 需重构：提取 markdown 渲染逻辑 |
| `components/ProcessMessage.vue` | `components/pipeline/ProcessGroup.vue` | **新增**：Agent 执行过程分组 |
| `components/StepMessage.vue` | `components/pipeline/StepMessage.vue` | **新增**：步骤消息展示 |
| `components/ActivityPanel.vue` | `components/pipeline/ActivityPanel.vue` | **新增**：思考+工具执行时间线 |
| `components/ToolUse.vue` | `components/pipeline/ToolCallView.vue` | **新增**：工具调用可视化 |
| `components/toolViews/ShellToolView.vue` | `components/toolViews/ShellToolView.vue` | 直接复用 |
| `components/toolViews/FileToolView.vue` | `components/toolViews/FileToolView.vue` | 直接复用 |
| `components/toolViews/SearchToolView.vue` | `components/toolViews/SearchToolView.vue` | 直接复用 |
| `components/MarkdownEnhancements.vue` | `components/MarkdownEnhancements.vue` | 直接复用（代码高亮 + mermaid） |
| `components/ui/MonacoEditor.vue` | `components/ui/MonacoEditor.vue` | 直接复用 |
| `components/ui/Toast.vue` | `components/ui/Toast.vue` | 直接复用 |
| `components/ui/CustomDialog.vue` | `components/ui/CustomDialog.vue` | 直接复用 |
| `components/ui/LoadingIndicator.vue` | `components/ui/LoadingIndicator.vue` | 直接复用 |
| `components/settings/SettingsDialog.vue` | `components/settings/SettingsDialog.vue` | 裁剪：仅保留通用/账户/主题 |
| `components/UserMenu.vue` | `components/UserMenu.vue` | 直接复用 |
| `components/LanguageSelector.vue` | `components/LanguageSelector.vue` | 直接复用 |
| `assets/theme.css` + `global.css` | `assets/` | 已完成 |
| `locales/zh.ts` + `en.ts` | `locales/` | 扩展 RV-Insights 专有词条 |
| `constants/tool.ts` | `constants/tool.ts` | **新增**：工具名→图标/组件映射 |
| `utils/toast.ts` | `utils/toast.ts` | 直接复用 |
| `utils/eventBus.ts` | `utils/eventBus.ts` | 直接复用（mitt） |
| `utils/dom.ts` | `utils/dom.ts` | 直接复用 |
| `utils/time.ts` | `utils/time.ts` | 直接复用 |
| `utils/markdownFormatter.ts` | `utils/markdownFormatter.ts` | 直接复用 |

### 后端模式复用（参考实现，重新编写）

| ScienceClaw 模式 | RV-Insights 实现 | 差异 |
|-------------------|------------------|------|
| SSE: asyncio.Queue → EventSourceResponse | SSE: Redis Pub/Sub → EventSourceResponse | 保留 Redis 方案 |
| Motor MongoDB 异步操作 | 已实现 | 无差异 |
| JWT auth with refresh token | 已实现 | ScienceClaw 用 session token，我们用 JWT |
| FastAPI lifespan hooks | 已实现 | 无差异 |
| SSEMonitoringMiddleware（工具调用拦截） | **新增**：Agent 事件中间件 | 适配到 Redis 发布 |
| ToolResultOffloadMiddleware（大结果卸载） | **新增**：产物管理器 | 适配到 ArtifactManager |
| ApiResponse 包装器 `{code, msg, data}` | **新增**：统一响应格式 | 当前直接返回 data |
| deepagents agent.astream() | LangGraph graph.astream() | 不同框架，相同流式模式 |

---

## Sprint 划分

### Sprint 0：项目初始化（Day 1-2）✅ 已完成

> 验收通过：docker compose up 全部服务健康，OpenAPI schema 可访问。

（详见 progress.md Sprint 0 记录）

---

### Sprint 1：认证 + 数据层（Week 1）✅ 已完成

> 验收通过：curl 测试所有 CRUD 端点通过；前端登录后可看到案例列表（Mock 数据）。

（详见 progress.md Sprint 1 记录）

---

### Sprint 2：Pipeline 引擎 + 案例详情页（Week 2）✅ 已完成

> 验收通过：Pipeline 启动 → SSE 收到事件 → 审核 → Pipeline 前进；前端案例详情页显示 Pipeline 状态。

（详见 progress.md Sprint 2 记录）

---

### Sprint 3：ScienceClaw 前端迁移 + Explorer Agent（Week 3）

> 目标：迁移 ScienceClaw 核心前端组件，实现 Explorer Agent 真实 LLM 调用，完成首次端到端联调。
> 验收标准：启动 Pipeline → Explorer 运行（真实 Claude API）→ 前端实时显示 Agent 思考/工具调用过程 → 暂停等待审核 → 审核通过。
> 关键变化：本 Sprint 前半段专注 ScienceClaw 组件迁移，后半段做集成。

#### 前端：ScienceClaw 组件迁移（Day 1-3）

- [ ] 前端：引入 reka-ui + lucide-vue-next 依赖 `~0.5h`
  - 依赖：package.json
  - 产出：`npm install reka-ui lucide-vue-next`，验证构建通过

- [ ] 前端：迁移 UI 原语（dialog/popover/select/toast）从 ScienceClaw `~2h`
  - 源：`ScienceClaw/frontend/src/components/ui/`
  - 产出：`components/ui/dialog/`, `components/ui/popover/`, `components/ui/select/`, `Toast.vue`, `CustomDialog.vue`, `LoadingIndicator.vue`

- [ ] 前端：迁移 utils 工具集 `~1h`
  - 源：`ScienceClaw/frontend/src/utils/`
  - 产出：`utils/toast.ts`, `utils/eventBus.ts`, `utils/dom.ts`, `utils/time.ts`, `utils/markdownFormatter.ts`

- [ ] 前端：升级 SSE 客户端为 `@microsoft/fetch-event-source` `~2h`
  - 源：`ScienceClaw/frontend/src/api/client.ts` 的 `createSSEConnection()`
  - 产出：`api/client.ts` 中 SSE 部分重写，支持 auth headers + 自动重连 + 指数退避
  - 关键：保留 Redis Last-Event-ID 重连协议

- [ ] 前端：迁移 MarkdownEnhancements 组件 `~1.5h`
  - 源：`ScienceClaw/frontend/src/components/MarkdownEnhancements.vue`
  - 产出：代码高亮（highlight.js）+ mermaid 图表 + KaTeX 数学公式渲染

- [ ] 前端：迁移 ActivityPanel（Agent 执行时间线）`~3h`
  - 源：`ScienceClaw/frontend/src/components/ActivityPanel.vue`
  - 产出：`components/pipeline/ActivityPanel.vue` — 思考过程 + 工具调用时间线
  - 适配：ScienceClaw 的 session events → RV-Insights 的 pipeline events

- [ ] 前端：迁移 ProcessMessage + StepMessage 模式 `~2.5h`
  - 源：`ScienceClaw/frontend/src/components/ProcessMessage.vue` + `StepMessage.vue`
  - 产出：`components/pipeline/ProcessGroup.vue` + `StepMessage.vue`
  - 适配：Agent 执行过程分组展示（thinking → tool_call → tool_result → output）

- [ ] 前端：迁移 ToolUse + toolViews 系统 `~3h`
  - 源：`ScienceClaw/frontend/src/components/ToolUse.vue` + `toolViews/` + `constants/tool.ts`
  - 产出：`components/pipeline/ToolCallView.vue` + `components/toolViews/ShellToolView.vue` + `FileToolView.vue` + `SearchToolView.vue`
  - 新增：`constants/tool.ts` 工具名→图标/组件映射（适配 Claude SDK 工具名：Read/Write/Edit/Bash/Grep/Glob/WebSearch）

- [ ] 前端：迁移 MonacoEditor 组件 `~1h`
  - 源：`ScienceClaw/frontend/src/components/ui/MonacoEditor.vue`
  - 产出：Monaco Editor 封装，用于后续 DiffViewer

- [ ] 前端：迁移 UserMenu + LanguageSelector `~1h`
  - 源：`ScienceClaw/frontend/src/components/UserMenu.vue` + `LanguageSelector.vue`
  - 产出：用户下拉菜单 + 语言切换器

- [ ] 前端：迁移 i18n 框架 + 中英文翻译 `~1.5h`
  - 源：`ScienceClaw/frontend/src/locales/`
  - 产出：vue-i18n 配置 + zh/en 翻译文件（扩展 RV-Insights 专有词条：pipeline/review/explore 等）

- [ ] 前端：重构 AgentEventLog 基于迁移组件 `~3h`
  - 依赖：ActivityPanel + ProcessGroup + StepMessage + ToolCallView + MarkdownEnhancements
  - 产出：重写 AgentEventLog，使用 ScienceClaw 的组件模式替代当前简单列表渲染
  - 关键：保留 8 种事件类型支持，但渲染质量对标 ScienceClaw

- [ ] 前端：移除 Mock API 层，接入真实后端 `~2h`
  - 依赖：SSE 客户端升级
  - 产出：`VITE_USE_MOCK=false`，所有请求走真实后端

**前端工时估算：~24h**

#### 后端：Explorer Agent 实现（Day 2-5，与前端并行）

- [ ] 后端：ClaudeAgentAdapter 实现 `~4h`
  - 依赖：Sprint 2 EventPublisher
  - 产出：Claude Agent SDK 封装，支持：
    - 子进程模型 + asyncio.timeout 超时控制
    - graceful cancel（SIGTERM → wait → SIGKILL）
    - AsyncIterator[AgentEvent] 流式事件输出
    - 工具白名单 + 权限模式配置

- [ ] 后端：Explorer Agent System Prompt `~2h`
  - 依赖：design.md §5.12 EXPLORER_SYSTEM_PROMPT
  - 产出：`prompts/explorer.py`，定义探索目标、三路并行策略、输出 JSON 格式约束

- [ ] 后端：explore_node 真实实现（替换 stub）`~4h`
  - 依赖：ClaudeAgentAdapter + Explorer Prompt + EventPublisher
  - 产出：LangGraph explore 节点调用 Claude Agent SDK，流式发布事件到 Redis，解析输出为 ExplorationResult

- [ ] 后端：parse_agent_output 三层解析 `~2h`
  - 依赖：explore_node
  - 产出：JSON 直接解析 → Markdown 代码块提取 → 宽松 JSON 清理，最多重试 2 次

- [ ] 后端：verify_exploration_claims 幻觉验证 `~2.5h`
  - 依赖：explore_node
  - 产出：URL 可达性验证、文件路径安全检查、ISA 扩展名对照已知列表

- [ ] 后端：PatchworkClient（Patchwork API 集成）`~2h`
  - 依赖：config.py
  - 产出：Patchwork REST API 客户端，支持补丁列表查询、长期未处理补丁发现

- [ ] 后端：explore_node 内事件发布（stage_change + agent_output）`~1.5h`
  - 依赖：explore_node + EventPublisher
  - 产出：Explorer 执行过程中实时发布 thinking/tool_call/tool_result/output 事件

- [ ] 后端：统一 API 响应格式 `~1h`
  - 产出：`ApiResponse` 包装器 `{code: 0, msg: "ok", data: ...}`，对标 ScienceClaw

**后端工时估算：~19h**

#### 联调验收（Day 5）

- [ ] 联调：登录 → 创建案例 → 启动 Pipeline → 实时看到 Explorer 执行 → 审核 `~3h`
  - 验证：SSE 事件实时渲染（thinking/tool_call/output），审核操作生效
  - 验证：AgentEventLog 渲染质量对标 ScienceClaw ActivityPanel

**Sprint 3 总工时估算：~46h（2 人并行约 1 周）**

---

### Sprint 4：Planner + Developer Agent + DiffViewer（Week 4）

> 目标：完成 Planner 和 Developer Agent，实现 3 阶段 MVP Pipeline 端到端，前端完成代码差异查看。
> 验收标准：Explore → 审核通过 → Plan → 审核通过 → Develop → 输出补丁文件 → 前端 DiffViewer 展示。

#### 后端任务

- [ ] 后端：OpenAIAgentAdapter 实现 `~3h`
  - 依赖：ClaudeAgentAdapter（参考实现）
  - 产出：OpenAI Agents SDK 封装，支持 Handoff + Guardrails + 事件回调 + AsyncIterator[AgentEvent]

- [ ] 后端：Planner Agent（Handoff + Guardrails）`~4h`
  - 依赖：OpenAIAgentAdapter + ExplorationResult
  - 产出：Planner 主 Agent + dev_planner/test_planner 子 Agent，InputGuardrail 验证探索结果完整性

- [ ] 后端：plan_node 实现（替换 stub）`~3h`
  - 依赖：Planner Agent + StateGraph
  - 产出：LangGraph plan 节点，输出 ExecutionPlan（任务分解 + 依赖关系 + 风险评估）

- [ ] 后端：Developer Agent System Prompt `~2h`
  - 依赖：design.md §5.12
  - 产出：`prompts/developer.py`，定义开发规范、Write/Edit/Bash 工具使用、输出格式

- [ ] 后端：develop_node 实现（替换 stub）`~5h`
  - 依赖：ClaudeAgentAdapter + Developer Prompt
  - 产出：LangGraph develop 节点，执行代码开发，输出 DevelopmentResult + 补丁文件

- [ ] 后端：ArtifactManager 产物存储 `~2.5h`
  - 依赖：Case 模型 + MongoDB
  - 产出：产物 CRUD（save/load/cleanup），支持按 case_id + stage + round 查询
  - 目录结构：`/data/artifacts/{case_id}/{stage}/round_{n}/`

- [ ] 后端：develop_node 内事件发布 `~1.5h`
  - 依赖：develop_node + EventPublisher
  - 产出：开发过程实时事件（file_edit, bash_exec, thinking, output）

- [ ] 验收：Explore → Plan → Develop 全流程 `~2h`
  - 验证：3 阶段顺序执行，每阶段产物正确存储，审核门禁正常工作

**后端工时估算：~23h**

#### 前端任务

- [ ] 前端：ExecutionPlanView 组件（开发方案树形展示）`~4h`
  - 产出：树形任务列表，显示任务名/优先级/预估时间/依赖关系

- [ ] 前端：DiffViewer 组件（Monaco Editor unified diff）`~5h`
  - 依赖：MonacoEditor 组件（Sprint 3 已迁移）
  - 产出：基于 Monaco Editor 的 diff 查看器，支持 unified/side-by-side 切换

- [ ] 前端：补丁文件查看器 `~2h`
  - 依赖：DiffViewer + FileToolView
  - 产出：补丁文件列表 + 单文件 diff 展示，支持文件树导航

- [ ] 前端：ContributionCard 组件（探索结果展示）`~2.5h`
  - 产出：贡献机会卡片，显示标题/类型/置信度/影响范围/证据摘要

- [ ] 前端：EvidenceChain 组件（证据链展示）`~1.5h`
  - 产出：证据链可视化，每条证据可展开查看详情

- [ ] 前端：IterationBadge + CostSummary `~2h`
  - 产出：迭代轮次徽章 + 按阶段/按模型的 token 用量和成本统计

- [ ] 联调：完整 3 阶段 Pipeline 端到端 `~3h`
  - 验证：Explore → Plan → Develop 全流程，UI 实时更新，产物正确展示

**前端工时估算：~20h**

**Sprint 4 总工时估算：~43h**

---

### Sprint 5：Review + Test Agent + 迭代循环（Week 5）

> 目标：完成 Review 和 Test Agent，实现 Develop ↔ Review 迭代循环，达成完整 5 阶段 Pipeline。
> 验收标准：Develop → Review → 驳回 → 修复 → Review → 通过 → Test；迭代循环正常收敛。

#### 后端任务

- [ ] 后端：Reviewer Agent（Codex + Handoff 三子 Agent）`~5h`
  - 依赖：OpenAIAgentAdapter
  - 产出：Reviewer 主 Agent + SecurityReviewer/CorrectnessReviewer/StyleReviewer 子 Agent

- [ ] 后端：review_node 实现（替换 stub，确定性工具 + LLM 双轨）`~4h`
  - 依赖：Reviewer Agent + StateGraph
  - 产出：先跑 checkpatch.pl，再跑 LLM 审核，合并结果到 ReviewVerdict

- [ ] 后端：run_deterministic_checks（checkpatch.pl 集成）`~3h`
  - 产出：checkpatch.pl 子进程调用，输出解析为结构化 findings

- [ ] 后端：Develop ↔ Review 迭代循环验证 `~2h`
  - 依赖：review_node + develop_node + route_review_decision（已实现）
  - 产出：验证 Review 驳回 → Develop 修复 → Review 复审流程，最多 3 轮

- [ ] 后端：escalate_node 实现 `~1.5h`
  - 产出：迭代超限时暂停 Pipeline，通知人工介入

- [ ] 后端：Tester Agent System Prompt + test_node 实现（替换 stub）`~4h`
  - 依赖：ClaudeAgentAdapter
  - 产出：LangGraph test 节点，执行编译验证（MVP 不含 QEMU），输出 TestResult

- [ ] 验收：Develop → Review → 驳回 → 修复 → Review → 通过 → Test `~2h`

**后端工时估算：~21.5h**

#### 前端任务

- [ ] 前端：ReviewFindingsView 组件（审核发现列表）`~3h`
  - 产出：按严重级别分组的 findings 列表

- [ ] 前端：DiffViewer 行内 finding 高亮 `~3h`
  - 产出：在 diff 视图中对应行高亮显示 finding，hover 显示详情

- [ ] 前端：TestResultSummary + TestLogViewer `~3h`
  - 产出：测试结果摘要卡片 + 测试日志查看器（ANSI 颜色渲染）

- [ ] 前端：迭代历史时间线 `~3h`
  - 产出：时间线组件，展示每轮 Develop → Review 过程

- [ ] 前端：Settings 对话框迁移（裁剪版）`~2h`
  - 源：ScienceClaw settings/
  - 产出：通用设置 + 账户设置 + 主题设置（裁剪掉 IM/Task/Model 等不需要的）

- [ ] 联调：完整 5 阶段 Pipeline `~3h`

**前端工时估算：~17h**

**Sprint 5 总工时估算：~38.5h**

---

### Sprint 6：集成测试 + 部署 + 收尾（Week 6）

> 目标：补充测试覆盖，完善错误处理，优化部署配置，产出可交付版本。
> 验收标准：`docker compose up` → 完整功能可用，测试通过，文档完善。

#### 后端测试

- [ ] 后端：单元测试 — route functions（route_human_decision, route_review_decision）`~3h`
- [ ] 后端：单元测试 — data contracts（Pydantic 模型序列化/反序列化/校验）`~2h`
- [ ] 后端：单元测试 — adapters（ClaudeAgentAdapter, OpenAIAgentAdapter mock 测试）`~2h`
- [ ] 后端：集成测试 — Pipeline flow with testcontainers `~5h`
  - 产出：使用 testcontainers 的端到端 Pipeline 测试

#### 前端收尾

- [ ] 前端：错误处理完善（useErrorHandler）`~2h`
- [ ] 前端：响应式适配（Tablet/Mobile 基础支持）`~3h`
- [ ] 前端：国际化完善（中英文全覆盖）`~1.5h`

#### 部署与文档

- [ ] Docker Compose 生产配置优化 `~2h`
- [ ] Nginx SSE 配置验证 `~1h`
- [ ] 端到端冒烟测试脚本 `~3h`
- [ ] README + 部署文档 `~2h`
- [ ] 验收：docker compose up → 完整功能可用 `~2h`

**Sprint 6 总工时估算：~28.5h**

---

## 工时汇总

| Sprint | 后端 | 前端 | 合计 | 状态 |
|--------|------|------|------|------|
| Sprint 0 | ~10h | ~3.5h | ~19h | ✅ 已完成 |
| Sprint 1 | ~19h | ~15h | ~34h | ✅ 已完成 |
| Sprint 2 | ~23h | ~23.5h | ~46.5h | ✅ 已完成 |
| Sprint 3 | ~19h | ~24h | ~46h | 🔲 待开始 |
| Sprint 4 | ~23h | ~20h | ~43h | 🔲 待开始 |
| Sprint 5 | ~21.5h | ~17h | ~38.5h | 🔲 待开始 |
| Sprint 6 | ~14h | ~8.5h | ~28.5h | 🔲 待开始 |
| **总计** | **~129.5h** | **~111.5h** | **~255.5h** | — |

---

## 关键里程碑

| 里程碑 | 时间 | 交付物 | 验收标准 |
|--------|------|--------|----------|
| M0 | Sprint 0 末 ✅ | 项目骨架 + Docker 环境 | `docker compose up` 全绿 |
| M1 | Sprint 2 末 ✅ | Pipeline 引擎 + 案例 UI | SSE 事件流通，审核操作可用 |
| M2 | Sprint 3 末 | ScienceClaw UI 对标 + Explorer E2E | 前端渲染质量对标 ScienceClaw |
| M3 | Sprint 4 末 | 3 阶段 MVP + DiffViewer | Explore → Plan → Develop 端到端 |
| M4 | Sprint 5 末 | 5 阶段完整版 + 迭代循环 | Review 迭代 + Test 收敛正常 |
| M5 | Sprint 6 末 | 可部署版本 | 测试通过，冒烟测试绿灯 |

---

## 风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| Claude Agent SDK Beta 不稳定 | 高 | 中 | Sprint 3 优先验证，准备降级方案 |
| ScienceClaw 组件迁移兼容性 | 中 | 中 | reka-ui 版本锁定，逐组件迁移+验证 |
| SSE 事件丢失 | 中 | 中 | Redis Stream + Last-Event-ID（已实现） |
| LLM 输出格式不稳定 | 中 | 高 | parse_agent_output 三层解析 |
| Develop ↔ Review 不收敛 | 中 | 中 | 加权收敛检测 + 3 轮上限 + escalate |

---

## 技术决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| Pipeline 引擎 | LangGraph + AsyncPostgresSaver | 原生 interrupt/resume |
| 事件流 | Redis Pub/Sub + SSE | 优于 ScienceClaw 的 asyncio.Queue |
| Agent 框架 | Claude SDK + OpenAI SDK 混用 | 不采用 deepagents |
| 前端框架 | Vue 3 + Pinia + reka-ui | 保留 Pinia，引入 reka-ui 对标 ScienceClaw |
| 前端迁移 | 组件级迁移 | 避免 ChatPage 单体迁移风险 |
| 数据库 | MongoDB + PostgreSQL | 灵活 schema + LangGraph 官方推荐 |
