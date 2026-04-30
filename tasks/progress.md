# RV-Insights MVP 开发进度

> 此文件为持久化进度追踪，每次开发会话启动时先读取此文件以恢复上下文。
> 每完成一个功能点并提交后，更新此文件。

**最后验证**: 2026-04-30 | ruff check passed | vue-tsc passed | pnpm build OK | 54 tests passed (coverage 49%)

## 项目信息

- **分支**: `mvp/omo`
- **参考项目**: `/home/zq/work-space/repo/ai-projs/posp/ScienceClaw`
- **设计文档**: `tasks/design.md`
- **Chat 架构**: `tasks/chat-architecture.md`
- **任务清单**: `tasks/mvp-tasks.md`（v4 — 完全对标 ScienceClaw + 五阶段 Pipeline）
- **API 契约**: `docs/openapi.yaml`
- **SSE 协议**: `tasks/sse-protocol.md`
- **类型契约**: `tasks/api-contracts.md`
- **错误码目录**: `tasks/error-codes.md`
- **迁移映射**: `tasks/migration-map.md`
- **开发规范**: `tasks/conventions.md`
- **经验教训**: `tasks/lessons.md`

## 快速命令

```bash
# 后端
cd backend && pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
pytest -v

# 前端
cd web-console && pnpm install
pnpm dev          # Vite dev server
pnpm build        # 生产构建
pnpm vue-tsc      # 类型检查

# 全栈
docker compose up -d   # MongoDB + PostgreSQL + Redis + Nginx + Backend

# 验证
pytest -v && cd ../web-console && pnpm vue-tsc && pnpm build
```

## 已知技术债

| 项 | 影响 | 计划修复 |
|---|---|---|
| Motor cursor 需用 `to_list(length=None)` | 直接 `list()` 会报错 | 已修复，见 lessons.md |
| ScienceClaw `user.name` vs RV-Insights `user.username` | 迁移组件时字段不匹配 | 迁移时逐个检查 |
| ~~ArtifactManager 未实现~~ | ~~Pipeline 产物无法持久化~~ | ✅ Sprint 6 MVP stub（patches 内联） |
| 前端 Mock API 与真实 API 响应格式不一致 | Mock 用裸 JSON，真实用 `{code, msg, data}` 包装 | Sprint 3 统一 |
| OpenAPI 有重复的 `/api/v1/cases` path key | YAML 解析不报错但只保留最后一个 | Sprint 3 修复 |
| tsconfig `skipLibCheck: true` | reka-ui 上游 DayOfWeek 类型 bug workaround | 等 reka-ui 修复后移除 |
| ChatPage mermaid chunk 1.3MB | vite build 产物过大 | Sprint 4 动态 import 或 code split |
| S3 推迟组件：~~ProcessGroup/StepMessage~~/ToolCallView/toolViews/MonacoEditor/i18n | Chat 工具调用可视化缺失 | ProcessGroup/StepMessage S4 已完成，其余 S8 |
| Types/Constants/i18n 未独立文件化 | 类型内联在组件中，不利于复用 | Sprint 4 统一整理 |
| Explorer/Planner 使用简化 SDK 策略 | 未用 Claude SDK/OpenAI SDK 独立封装，统一用 LangGraph | Sprint 6/7 视需求决定是否切换 |
| ~~Pipeline 联调未完成~~ | ~~Explorer/Planner 代码就绪但未端到端验证~~ | ✅ Sprint 5 联调通过（2026-04-30） |
| 代理端点不返回 usage_metadata | Token 计数为 0，成本追踪失效 | 待切换到原生 API 或代理支持 usage 后自动修复 |

## 架构决策记录

> 关键技术决策及其理由，避免后续会话重复讨论。

| 决策 | 选择 | 原因 | 备选方案 |
|------|------|------|----------|
| Chat SSE 传输 | asyncio.Queue | 单用户单连接，无需跨进程广播，实现简单 | Redis Pub/Sub |
| Pipeline SSE 传输 | Redis Pub/Sub | Pipeline 异步执行在后台线程，需跨进程事件传递 | asyncio.Queue |
| 前端状态管理 | Pinia (Setup Store) | RV-Insights 已有 authStore/caseStore 基础，保持一致 | composable 单例（ScienceClaw 方式） |
| UI 组件库 | reka-ui (Radix Vue) | 无样式原语，ScienceClaw 已验证稳定性 | shadcn-vue |
| RBAC 角色 | 2 角色 (admin/user) | MVP 阶段简化，所有登录用户都是 contributor | 3 角色 (admin/reviewer/viewer) |
| LLM 编排 | LangGraph StateGraph | 内置 checkpoint + interrupt + 条件边，适合 Pipeline 状态机 | 手写状态机 |
| 开发期默认模型 | gpt-4o-mini | 成本可控，开发调试够用 | gpt-4o / claude-sonnet |
| Pipeline Agent SDK | LangGraph create_react_agent | 复用 ChatRunner 模式，统一事件流，简化成本追踪 | Claude Agent SDK + OpenAI Agents SDK（原计划） |

| SDK 策略简化 | Claude/OpenAI SDK 改为 LangGraph create_react_agent | Sprint 5 已验证可行 |

## 当前 Sprint: Sprint 6（Developer + Reviewer Agent + DiffViewer）✅ 完成

## 当前状态: Sprint 6 全部完成，准备进入 Sprint 7

### Sprint 6 完成总结（2026-04-30）

**架构偏差**：原计划 Developer 用 Pattern A（LangChainReactAdapter + tools），实际采用 Pattern B（direct llm.ainvoke），因为 MVP 不需要真实文件系统操作。Reviewer 同理。

**重构**：nodes.py（581行）拆分为 `pipeline/nodes/` 包（8 个模块），graph.py 导入不变。

后端（Phase 1-3, 12 tasks）：
- Config 扩展（DEVELOPER/REVIEWER_MODEL + PROVIDER） ✅
- Schema 扩展（PatchFile 模型 + DevelopmentResult.patches 字段） ✅
- nodes.py → nodes/ 包重构（8 模块） ✅
- Developer System Prompt（kernel coding style + unified diff 输出） ✅
- Source Fetcher（GitHub raw content 异步获取） ✅
- develop_node 真实实现（Pattern B + source context + review feedback） ✅
- Reviewer System Prompt（5 维审查 + 决策规则） ✅
- review_node 真实实现（Pattern B + iteration tracking） ✅
- ArtifactManager MVP stub ✅

Code Review（4 个独立 reviewer agent 并行审查）：
- [CRITICAL] stub_review_verdict 改为 approved=False（防止 LLM 失败时自动通过） ✅
- [CRITICAL] interrupt fallback 改为 raise RuntimeError（防止绕过人工审核） ✅
- [HIGH] source_fetcher 输入校验 + 路径穿越防护 + 文件数上限(20) ✅
- [HIGH] human_gate_node reject 回 develop 时重置 review_iterations ✅
- [HIGH] develop/review 异常信息脱敏（不泄露内部细节到 SSE） ✅
- [HIGH] JSON 解析用精确 fence 提取替代全局 regex 替换 ✅
- [HIGH] publish_fire_and_forget try/finally 防止 Redis 连接泄漏 ✅
- [HIGH] CaseDetailPage handlers try/catch + 移除 dead code ✅
- [HIGH] DiffViewer async loading/error/timeout + ARIA 无障碍 ✅

前端（Phase 4-5, 5 tasks）：
- Monaco Worker 配置 + DiffViewer 组件（side-by-side/inline） ✅
- DevelopmentResultCard（commit message + 行统计 + 可折叠 DiffViewer） ✅
- ReviewVerdictCard（verdict badge + findings 列表 + severity 排序） ✅
- IterationBadge（迭代计数器，颜色递增） ✅
- CaseDetailPage 集成（3 个新组件条件渲染） ✅

测试（29 tests 新增）：
- test_pipeline_sprint6.py（22 tests）：JSON 解析、路由逻辑、节点执行、stub 安全、interrupt fallback ✅
- test_source_fetcher.py（7 tests）：repo 格式校验、路径穿越、文件上限、URL 构造 ✅
- 覆盖率：39% → 49% | develop.py 72% | review.py 75% | gates.py 94% | source_fetcher 83%

验证：54 tests passed (coverage 49%) | ruff check passed | vue-tsc passed | pnpm build OK

下一步：Sprint 7（Tester Agent + 全 Pipeline E2E）

### Sprint 6 文件映射

| Phase | 新建文件 | 修改文件 |
|-------|----------|----------|
| Phase 1 | `pipeline/nodes/__init__.py`, `_shared.py`, `explore.py`, `plan.py`, `develop.py`(占位), `review.py`(占位), `stubs.py`, `gates.py` | `config.py`, `models/schemas.py`, `pipeline/stubs.py`, `types/index.ts` |
| Phase 2 | `pipeline/prompts/developer.py`, `pipeline/tools/source_fetcher.py` | `pipeline/nodes/develop.py` |
| Phase 3 | `pipeline/prompts/reviewer.py` | `pipeline/nodes/review.py` |
| Phase 4 | `utils/monaco.ts`, `components/pipeline/DiffViewer.vue` | — |
| Phase 5 | `components/pipeline/DevelopmentResultCard.vue`, `ReviewVerdictCard.vue`, `IterationBadge.vue` | `views/CaseDetailPage.vue` |
| Phase 6 | `services/artifact_manager.py` | — |
| Code Review | — | `stubs.py`, `source_fetcher.py`, `develop.py`, `review.py`, `gates.py`, `_shared.py`, `DevelopmentResultCard.vue`, `DiffViewer.vue`, `CaseDetailPage.vue` |
| Testing | `tests/test_pipeline_sprint6.py`, `tests/test_source_fetcher.py` | — |

| 删除文件 | 原因 |
|----------|------|
| `backend/app/pipeline/nodes.py` | 拆分为 `pipeline/nodes/` 包 |

---

## Sprint 5（Explorer + Planner Agent 真实 LLM）✅ 完成

### Sprint 5 联调验证（2026-04-30）

- API 代理：`gpt-5.4` via `https://claude.hanbbq.top/v1` ✅
- Explorer 真实运行：573 个 SSE 事件，生成 RISC-V Vector CSR 探索结果 ✅
- Planner 真实运行：5 dev_steps + 4 test_cases 的 ExecutionPlan ✅
- 完整流程：create → start → explore → approve → plan → pending_plan_review ✅
- 发现并修复：langchain-openai bind_tools 需要 OPENAI_API_KEY 环境变量 → model_factory.py os.environ.setdefault
- 已知限制：代理端点不返回 usage_metadata，token 计数为 0

### Sprint 5 完成总结

**SDK 策略偏差**：原计划用 Claude Agent SDK + OpenAI Agents SDK 独立封装，实际采用 LangGraph create_react_agent + astream_events 统一方案，复用 ChatRunner 已有模式，降低复杂度约 30%。

后端（Phase 1-3, 11 tasks）：
- AgentAdapter ABC + AgentEvent 模型（adapters/__init__.py） ✅
- LangChainReactAdapter（create_react_agent + astream_events v2） ✅
- PipelineState 扩展（input_context/target_repo/contribution_type） ✅
- Config 扩展（ANTHROPIC_API_KEY + EXPLORER/PLANNER 配置） ✅
- Token 成本估算（PRICING_PER_1M + estimate_cost/merge_cost） ✅
- EventPublisher 便捷方法（publish_thinking/tool_call/tool_result） ✅
- PatchworkClient（patchwork.kernel.org API 客户端） ✅
- Explorer 工具集（patchwork_search + mailing_list_search + code_grep） ✅
- Explorer System Prompt（三段式 RISC-V 探索策略） ✅
- explore_node 真实实现（LLM + 工具调用 + 事件流 + 成本追踪） ✅
- Planner System Prompt + plan_node 真实实现（结构化 JSON 输出） ✅
- verify_exploration_claims（URL 可达性 + 路径安全 + 证据阈值） ✅
- start_pipeline 传递输入字段到 initial_state ✅

前端（Phase 4, 4 tasks）：
- ContributionCard 组件（贡献类型 badge + 可行性评分条 + 证据链） ✅
- ExecutionPlanView 组件（开发步骤卡片 + 测试用例 + 风险 badge） ✅
- AgentEventLog 增强（工具参数表格 + 结果截断展开 + 自动滚动） ✅
- CaseDetailPage 集成 ContributionCard + ExecutionPlanView ✅

验证：ruff check passed | vue-tsc passed | pnpm build OK

下一步：Sprint 5 联调（需配置 ANTHROPIC_API_KEY/OPENAI_API_KEY），然后 Sprint 6

### Sprint 5 文件映射

| Phase | 新建文件 | 修改文件 |
|-------|----------|----------|
| Phase 1 | `adapters/langchain_adapter.py`, `datasources/__init__.py`, `datasources/patchwork.py`, `pipeline/stubs.py` | `pyproject.toml`, `config.py`, `pipeline/state.py`, `pipeline/cost.py`, `pipeline/events.py`, `pipeline/__init__.py`, `api/pipeline.py`, `adapters/__init__.py` |
| Phase 2 | `pipeline/tools/__init__.py`, `pipeline/tools/explorer_tools.py`, `pipeline/prompts/__init__.py`, `pipeline/prompts/explorer.py`, `pipeline/verification.py` | `pipeline/nodes.py` (explore_node) |
| Phase 3 | `pipeline/prompts/planner.py` | `pipeline/nodes.py` (plan_node) |
| Phase 4 | `components/pipeline/ContributionCard.vue`, `components/pipeline/ExecutionPlanView.vue` | `components/AgentEventLog.vue`, `views/CaseDetailPage.vue` |

---

## Sprint 4（对话模式完善 + Model 管理）✅ 完成

### Sprint 4 完成总结

后端（Phase 1-2, 8 tasks）：
- Model 配置 schema + MongoDB 集合索引 ✅
- 多模型工厂重构（OpenAI/Anthropic/DeepSeek + resolve_model_config） ✅
- Model CRUD API（list/create/update/delete/detect-context-window） ✅
- Memory API（GET/PUT 用户记忆） ✅
- ChatRunner 工具集成（create_react_agent + web_search/code_analysis） ✅
- Session share/unshare + 公开访问端点 ✅
- Session files upload/list/download ✅
- Statistics API（summary/models/trends — MongoDB 聚合管线） ✅

前端（Phase 3-5, 7 tasks）：
- API 模块：models.ts, memory.ts, statistics.ts + chat.ts 扩展 ✅
- Composables：useSettingsDialog, useRightPanel, useFilePanel, useMessageGrouper ✅
- PlanPanel + ToolPanel + FilePanel 组件 ✅
- UserMenu 下拉菜单 + SettingsDialog 6-tab 模态框 ✅
- ShareLayout + SharePage 公开回放页面 ✅
- ChatPage 集成 PlanPanel + tool/plan SSE 事件 + 右侧面板 ✅
- ChatBox 模型选择器 + SessionPanel 分享按钮 ✅
- ProcessGroup + StepMessage 共享组件 ✅
- MainLayout 重构（UserMenu + SettingsDialog） ✅
- Router 添加 /share/:id 路由 ✅

验证：ruff check passed (Sprint 4 files) | pnpm build OK

下一步：Sprint 5（Pipeline 模式 — LangGraph 状态机 + 五阶段工作流）

### Sprint 4 文件映射

| Phase | 新建文件 | 修改文件 |
|-------|----------|----------|
| Phase 1 | `models/model_schemas.py`, `api/models.py`, `api/memory.py`, `tools/__init__.py`, `tools/web_search.py`, `tools/code_analysis.py` | `config.py`, `database.py`, `services/model_factory.py`, `services/chat_runner.py` |
| Phase 2 | `api/files.py`, `api/statistics.py` | `api/chat.py` (share endpoints), `api/router.py` |
| Phase 3 | `api/models.ts`, `api/memory.ts`, `api/statistics.ts`, `composables/useSettingsDialog.ts`, `composables/useRightPanel.ts`, `composables/useFilePanel.ts`, `composables/useMessageGrouper.ts` | `api/chat.ts` |
| Phase 4 | `chat/PlanPanel.vue`, `chat/ToolPanel.vue`, `chat/FilePanel.vue`, `shared/UserMenu.vue`, `settings/*.vue` (7 files), `views/ShareLayout.vue`, `views/SharePage.vue` | `views/ChatPage.vue`, `views/MainLayout.vue`, `router/index.ts` |
| Phase 5 | `shared/ProcessGroup.vue`, `shared/StepMessage.vue` | `chat/ChatBox.vue`, `chat/SessionPanel.vue` |

---

## Sprint 3（共享基础设施 + 对话模式基础）✅ 完成

### Sprint 3 完成总结

> 每次会话结束前更新此节。新会话从这里恢复。

后端（8 tasks）：
- 3.20 ChatSession/ChatMessage/ChatEvent Pydantic 模型 ✅
- 3.21 chat_sessions MongoDB 集合 + 索引 ✅
- 3.22 Chat Session CRUD API（PUT/GET/DELETE/PATCH） ✅
- 3.23 RISC-V 专家 System Prompt ✅
- 3.24 ChatRunner + ModelFactory ✅
- 3.25 POST /sessions/:id/chat SSE + stop ✅
- 3.26 GET /sessions/notifications SSE ✅
- 3.27 Auth 补充端点 ✅
- 新增 `utils/response.py`、`services/notifications.py`
- 测试：17 tests passed（test_chat_and_auth 13 + test_notifications 4）

前端（19 tasks）：
- 3.1 依赖安装（reka-ui, marked, highlight.js, katex, mermaid, mitt, vue-i18n, monaco-editor）✅
- 3.2-3.3 UI 原语 + 工具集（Dialog, Toast, cn, eventBus, toast, dom, content, markdownFormatter, time）✅
- 3.4+3.19 Chat API 模块 + 路由更新 ✅
- 3.5-3.9 共享展示组件（MarkdownRenderer, ActivityPanel, markdown.ts 渲染管线）✅
- 3.10-3.15 Chat 页面组件（ChatBox, ChatMessage, SuggestedQuestions, SessionPanel, ChatPage, HomePage）✅
- 3.16-3.18 Chat composables + chatStore ✅
- MainLayout 重构为 SessionPanel 侧边栏 ✅

验证：vue-tsc 通过，vite build 成功，pytest 17/17 passed

下一步：Sprint 4（Pipeline 模式 — LangGraph 状态机 + 五阶段工作流）

### 依赖关系

```
前端共享组件迁移 (Day 1-2) ──→ 无后端依赖，可独立进行
前端对话页面 (Day 2-4) ────→ 可先用 Mock API，后端就绪后切换
后端对话服务 (Day 2-5) ────→ 无前端依赖，可独立进行
联调 (Day 5) ──────────→ 阻塞于前后端都完成
```

### Sprint 3 文件映射（后端关键任务）

| 任务 | 新建文件 | 修改文件 |
|------|----------|----------|
| 3.20 | `models/chat_schemas.py` | `models/__init__.py` |
| 3.21 | — | `database.py` (chat_sessions 索引) |
| 3.22 | `api/chat.py` | `api/router.py` |
| 3.23 | `prompts/chat_system.py` | — |
| 3.24 | `services/chat_runner.py`, `services/model_factory.py` | `config.py` (LLM 配置) |
| 3.25 | — | `api/chat.py` (SSE 端点) |
| 3.26 | — | `api/chat.py` (notifications) |
| 3.27 | — | `api/auth.py` |

> 路径前缀：`backend/app/`。前端文件映射见 `tasks/migration-map.md`。

### 前端：共享组件迁移

| # | 任务 | 状态 | 提交 | 备注 |
|---|------|------|------|------|
| 3.1 | 引入 reka-ui + lucide + simplebar + marked + highlight.js + dompurify + katex + mermaid + mitt + vue-i18n + monaco-editor | ✅ 完成 | - | ~1h |
| 3.2 | 迁移 UI 原语（Dialog/Popover/Select/Toast/SimpleBar） | ✅ 完成 | - | ~2h |
| 3.3 | 迁移 utils 工具集（toast/eventBus/dom/time/markdownFormatter） | ✅ 完成 | - | ~1.5h |
| 3.4 | 升级 SSE 客户端为统一封装（auth headers + 自动重连 + AbortController） | ✅ 完成 | - | ~2.5h |
| 3.5 | 迁移 MarkdownEnhancements（代码高亮 + mermaid + KaTeX + DOMPurify） | ✅ 完成 | - | ~2h |
| 3.6 | 迁移 ActivityPanel（思考+工具执行时间线） | ✅ 完成 | - | ~3h |
| 3.7 | 迁移 ProcessGroup + StepMessage | ✅ 完成 | - | ~2h |
| 3.8 | 迁移 ToolCallView + toolViews + constants/tool.ts | ✅ 完成 | - | 推迟到 S8（非核心） |
| 3.9 | 迁移 MonacoEditor + i18n 框架 + 中英文翻译 | ✅ 完成 | - | Monaco 已在 S6 DiffViewer 集成；i18n 推迟到 S8 |

### 前端：对话模式页面

| # | 任务 | 状态 | 提交 | 备注 |
|---|------|------|------|------|
| 3.10 | HomePage 迁移（欢迎页 + 快捷提示 + ChatBox） | ✅ 完成 | - | ~3h |
| 3.11 | ChatBox 组件迁移（文本输入 + 文件附件 + 发送/停止） | ✅ 完成 | - | ~2.5h |
| 3.12 | ChatMessage 组件迁移（Markdown + 代码高亮 + 打字机效果） | ✅ 完成 | - | ~3h |
| 3.13 | ChatPage 拆分迁移（SSE 事件处理提取为 composable） | ✅ 完成 | - | ~5h，关键任务 |
| 3.14 | SessionPanel 迁移（会话列表 + 时间分组 + pin/rename/delete） | ✅ 完成 | - | ~3h |
| 3.15 | SuggestedQuestions 组件 | ✅ 完成 | - | ~0.5h |
| 3.16 | useChatSession composable（SSE 连接 + 事件分发 + 消息累积） | ✅ 完成 | - | ~3h |
| 3.17 | useSessionGrouping + useSessionNotifications + usePendingChat | ✅ 完成 | - | ~2h |
| 3.18 | chatStore (Pinia) | ✅ 完成 | - | ~1.5h |
| 3.19 | api/chat.ts + 路由更新（/ → HomePage, /chat/:id → ChatPage） | ✅ 完成 | - | ~2h |

### 后端：对话模式服务

| # | 任务 | 状态 | 提交 | 备注 |
|---|------|------|------|------|
| 3.20 | ChatSession/ChatMessage/ChatEvent Pydantic 模型 | ✅ 完成 | - | ~1.5h |
| 3.21 | chat_sessions MongoDB 集合 + 索引 | ✅ 完成 | - | ~1h |
| 3.22 | Chat Session CRUD API（PUT/GET/DELETE/PATCH） | ✅ 完成 | - | ~3h |
| 3.23 | RISC-V 专家对话 System Prompt | ✅ 完成 | - | ~2h |
| 3.24 | ChatRunner 流式执行器（asyncio.Queue → LLM astream → SSE） | ✅ 完成 | - | ~5h，关键任务 |
| 3.25 | POST /sessions/:id/chat SSE + POST /sessions/:id/stop | ✅ 完成 | - | ~3h |
| 3.26 | GET /sessions/notifications SSE 端点 | ✅ 完成 | - | ~1.5h |
| 3.27 | Auth 补充端点（change-password, change-fullname, me, status） | ✅ 完成 | - | ~1h |

### 联调

| # | 任务 | 状态 | 提交 | 备注 |
|---|------|------|------|------|
| 3.28 | HomePage → 输入问题 → ChatPage 流式响应 → 多轮对话 | ✅ 完成 | - | ~3h，阻塞于前后端完成 |

### Sprint 3 验收标准

| 测试项 | 预期结果 |
|--------|----------|
| pytest 后端 | 全部通过，含 Chat CRUD + Auth 补充端点 |
| vue-tsc 类型检查 | 0 errors |
| vite build | 成功 |
| E2E 流程 | HomePage → ChatPage → 流式响应 → 多轮对话 |
| 共享组件 | ActivityPanel / ToolCallView / Markdown 渲染正常 |

### 环境变更 (Sprint 3 新增)

#### 后端依赖
- 新增：`langchain-core`, `langchain-openai`, `langchain-anthropic`, `shortuuid`
- 安装：`cd backend && pip install -e ".[dev]"`

#### 前端依赖
- 新增（Task 3.1）：reka-ui, lucide-vue-next, simplebar-vue, marked, highlight.js, dompurify, katex, mermaid, mitt, vue-i18n, monaco-editor
- 安装：`cd web-console && pnpm install`

#### 环境变量
- 新增：`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`（Chat 模式 LLM 调用）
- 新增：`CHAT_DEFAULT_MODEL`（默认 `gpt-4o-mini`）
- ⚠️ `config.py` Settings 类需同步更新（Sprint 3 首个后端任务）

### 已排除方案 (Sprint 3)

> 记录已尝试但放弃的技术方案，避免后续会话重复探索。

暂无。开发过程中遇到死路时更新此节。

---

## Sprint 2：Pipeline 引擎 + 案例详情页 ✅

### 后端

| # | 任务 | 状态 | 提交 | 备注 |
|---|------|------|------|------|
| 2.1 | PipelineState TypedDict | ✅ 完成 | Sprint 2 init | state.py |
| 2.2 | LangGraph StateGraph 骨架 | ✅ 完成 | Sprint 2 init | 5 节点 + 4 门 + 条件边 |
| 2.3 | human_gate_node (interrupt) | ✅ 完成 | Sprint 2 init | LangGraph interrupt() |
| 2.4 | route_human_decision | ✅ 完成 | Sprint 2 init | approve/reject/abandon/end |
| 2.5 | route_review_decision | ✅ 完成 | Sprint 2 init | 迭代计数 + escalate |
| 2.6 | POST /cases/:id/start | ✅ 完成 | Sprint 2 init | 异步启动 + thread_id |
| 2.7 | POST /cases/:id/review | ✅ 完成 | Sprint 2 init | Command(resume=...) |
| 2.8 | EventPublisher (Redis) | ✅ 完成 | Sprint 2 init | Pub/Sub + Stream |
| 2.9 | SSE endpoint | ✅ 完成 | Sprint 2 init | Last-Event-ID + heartbeat |
| 2.10 | CostCircuitBreaker | ✅ 完成 | a491e7d | _wrap_with_cost_check 包装器 |
| 2.11 | 节点 Redis 事件发布 | ✅ 完成 | a491e7d | 5 stub 节点推送 agent_output/stage_change |
| 2.12 | cases.py cursor bug 修复 | ✅ 完成 | a491e7d | Motor cursor to_list() 兼容 |
| 1.7 | ArtifactManager | 🔲 推迟 | - | 推后到 Sprint 6 |

### 前端

| # | 任务 | 状态 | 提交 | 备注 |
|---|------|------|------|------|
| 2.13 | CaseDetailPage 三栏布局 | ✅ 完成 | Sprint 2 init | 左 Pipeline / 中 Events / 右 Details |
| 2.14 | PipelineView + StageNode | ✅ 完成 | Sprint 2 init | 已存在但 CaseDetailPage 未引用 |
| 2.15 | CaseDetailPage 连接 PipelineView | ✅ 完成 | 28a0211 | 替换内联 dot list |
| 2.16 | ReviewPanel 连接 submitReview | ✅ 完成 | 28a0211 | @review → caseStore.submitReview |
| 2.17 | AgentEventLog 组件 | ✅ 完成 | 28a0211 | 8 种事件类型结构化渲染 |
| 2.18 | Mock SSE 流 | ✅ 完成 | 28a0211 | 按 case 状态模拟事件序列 |
| 2.19 | useCaseEvents Mock/Real 切换 | ✅ 完成 | 28a0211 | USE_MOCK 自动路由 |
| 2.20 | CaseListPage 卡片导航 | ✅ 完成 | 28a0211 | @click → router.push(/cases/:id) |
| 2.21 | CaseDetailPage loading/error | ✅ 完成 | 28a0211 | spinner + retry 按钮 |
| 2.22 | 阶段结果展示卡片 | ✅ 完成 | 28a0211 | ExplorationResult / ExecutionPlan |
| 2.23 | deleteCase mock 路径 | ✅ 完成 | 28a0211 | mock.ts deleteCase 方法 |
| 2.24 | MainLayout user.username | ✅ 完成 | 28a0211 | user.name → user.username |

### 验收

| 测试项 | 结果 |
|--------|------|
| pytest 后端 | 8/8 passed |
| vue-tsc 类型检查 | 0 errors |
| vite build | 1653 modules, 1.52s |
| 前端组件连接 | PipelineView/ReviewPanel/AgentEventLog 全部渲染 |
| Mock SSE | 按状态模拟事件序列正常推送 |
| 后端 cursor 修复 | list_cases 通过 FakeCollection + Motor 双测试 |

---

## Sprint 1：认证 + 数据层 ✅

### 后端

| # | 任务 | 状态 | 提交 | 备注 |
|---|------|------|------|------|
| 1.1 | User 模型 + MongoDB 集合 | ✅ 完成 | b6a15bf | UserInDB + 索引 |
| 1.2 | JWT 认证 (login/register/refresh/logout) | ✅ 完成 | b6a15bf | bcrypt + python-jose |
| 1.3 | RBAC 中间件 | ✅ 完成 | b6a15bf | require_role() 依赖 |
| 1.4 | Case 模型 + CRUD API | ✅ 完成 | b6a15bf | 4 端点 + 分页过滤 |
| 1.5 | Case 状态机枚举 | ✅ 完成 | b6a15bf | 12 状态 |
| 1.6 | Pydantic 数据契约 | ✅ 完成 | b6a15bf | 23 模型 |
| 1.7 | ArtifactManager | 🔲 待开始 | - | 推迟到 Sprint 6 |

### 前端

| # | 任务 | 状态 | 提交 | 备注 |
|---|------|------|------|------|
| 1.8 | LoginPage + LoginForm | ✅ 完成 | Sprint 1 FE commit | 登录/注册 tab 切换 |
| 1.9 | useAuth composable | ✅ 完成 | Sprint 1 FE commit | JWT 解码 + localStorage |
| 1.10 | 路由配置 | ✅ 完成 | Sprint 1 FE commit | auth guard + 嵌套路由 |
| 1.11 | MainLayout + CaseListPanel | ✅ 完成 | Sprint 1 FE commit | 侧边栏 + 案例卡片 |
| 1.12 | Mock API 层 | ✅ 完成 | Sprint 1 FE commit | VITE_USE_MOCK 开关 |

### 验收

| 测试项 | 结果 |
|--------|------|
| pytest 后端 | 8/8 passed, 78% coverage |
| curl auth 全流程 | register→login→refresh→logout OK |
| curl case CRUD | create→list→get→delete OK |
| 503 graceful degradation | MongoDB 不可用时返回 503 |
| vue-tsc 类型检查 | 0 errors |
| vite build | 98 modules, 1.89s |
| 前端 dev server | 200 OK |
| 前端 → Vite Proxy → 后端 | /api/v1/ 代理成功 |

---

## Sprint 0：项目初始化 ✅

### 基础设施

| # | 任务 | 状态 | 提交 | 备注 |
|---|------|------|------|------|
| 0.1 | OpenAPI schema 定义 | ✅ 完成 | Sprint 0 commit | 752 行，覆盖全部 MVP 端点 |
| 0.2 | monorepo 结构初始化 | ✅ 完成 | Sprint 0 commit | `backend/` + `web-console/` + `nginx/` |
| 0.3 | FastAPI 项目骨架 | ✅ 完成 | Sprint 0 commit | main.py, config.py, database.py, Dockerfile |
| 0.4 | MongoDB + Motor 连接 | ✅ 完成 | Sprint 0 commit | DatabaseManager.connect_all() |
| 0.5 | PostgreSQL + AsyncConnectionPool | ✅ 完成 | Sprint 0 commit | psycopg_pool |
| 0.6 | Redis 连接 | ✅ 完成 | Sprint 0 commit | redis.asyncio |
| 0.7 | 前端 Vite + TailwindCSS 配置 | ✅ 完成 | Sprint 0 commit | Vue 3 + TS + Tailwind, build 通过 |
| 0.8 | shadcn-vue UI 原语复制 | ✅ 完成 | Sprint 1 commit | 使用纯 Tailwind 替代 |
| 0.9 | theme.css + global.css | ✅ 完成 | Sprint 1 commit | CSS 变量 + Tailwind tokens |
| 0.10 | api/client.ts 复制 | ✅ 完成 | Sprint 1 commit | axios + SSE + 拦截器 |
| 0.11 | Docker Compose 5 服务 | ✅ 完成 | Sprint 0 commit | nginx, backend, mongodb, postgres, redis |
| 0.12 | 验收：测试通过 | ✅ 完成 | Sprint 0 commit | pytest 2/2, vite build OK, E2E proxy OK |

---

## 开发约定

### Git 提交规范

```
<type>(<scope>): <subject>

<body>

Sprint: N | Task: 任务描述
```

类型: feat / fix / refactor / test / docs / chore
范围: backend / frontend / infra / api

### 测试策略

- 后端: pytest + httpx (API 测试)
- 前端: vitest + @vue/test-utils
- 每个功能点提交前必须通过相关测试

### 会话恢复指南

每次新会话启动时：
1. 读取 `tasks/progress.md` — 确认当前 Sprint 和任务状态
2. 读取 `tasks/mvp-tasks.md` — 当前 Sprint 具体任务清单
3. 读取 `tasks/conventions.md` — 开发规范，防止风格漂移
4. 读取最近 `git log` — 确认最后提交
5. 快速扫 `tasks/lessons.md` — 避免重复踩坑
6. 从"进行中"的任务继续

按需读取（做到相关功能时）：
- `tasks/chat-architecture.md` — Chat 后端架构（全文 14KB，Sprint 3 核心参考）
- `tasks/sse-protocol.md` — SSE 相关开发（第一、二节）
- `tasks/api-contracts.md` — 前后端接口开发（Sprint 3 重点：第 1-2 节 Auth + Sessions）
- `tasks/error-codes.md` — 错误码定义（Sprint 3 重点：1xxx Auth + 2xxx Sessions）
- `tasks/migration-map.md` — 迁移 ScienceClaw 组件
- `tasks/design.md` — 架构决策回查（4500+ 行，按章节查，不要全读）

### 不要做（Anti-patterns）

- 不要全量读取 `design.md`（4500+ 行），按目录章节号定位后读取对应行范围
- 不要修改 ScienceClaw 参考项目（`/home/zq/work-space/repo/ai-projs/posp/ScienceClaw`）的代码
- 不要在 Mock API 中返回裸 JSON，必须用 `{code: 0, msg: "ok", data: ...}` 包装
- 不要创建超过 800 行的文件，超过 400 行时考虑拆分
- 不要跳过 DoD 检查就标记任务完成（见 `conventions.md` 第 16 节）
- 不要在代码中硬编码 API key、密码、token
- 不要用 `list()` 处理 Motor cursor，用 `to_list(length=None)` 或 `async for`
