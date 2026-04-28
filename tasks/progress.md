# RV-Insights MVP 开发进度

> 此文件为持久化进度追踪，每次开发会话启动时先读取此文件以恢复上下文。
> 每完成一个功能点并提交后，更新此文件。

**最后验证**: 2026-04-28 | pytest 13/13 passed (test_chat_and_auth) | app import OK

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
| ArtifactManager 未实现 | Pipeline 产物无法持久化 | Sprint 6 |
| 前端 Mock API 与真实 API 响应格式不一致 | Mock 用裸 JSON，真实用 `{code, msg, data}` 包装 | Sprint 3 统一 |
| OpenAPI 有重复的 `/api/v1/cases` path key | YAML 解析不报错但只保留最后一个 | Sprint 3 修复 |

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

## 当前 Sprint: Sprint 3（共享基础设施 + 对话模式基础）✅ 完成

## 当前状态: Sprint 3 全部完成，准备进入 Sprint 4

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
| 3.1 | 引入 reka-ui + lucide + simplebar + marked + highlight.js + dompurify + katex + mermaid + mitt + vue-i18n + monaco-editor | 🔲 待开始 | - | ~1h |
| 3.2 | 迁移 UI 原语（Dialog/Popover/Select/Toast/SimpleBar） | 🔲 待开始 | - | ~2h |
| 3.3 | 迁移 utils 工具集（toast/eventBus/dom/time/markdownFormatter） | 🔲 待开始 | - | ~1.5h |
| 3.4 | 升级 SSE 客户端为统一封装（auth headers + 自动重连 + AbortController） | 🔲 待开始 | - | ~2.5h |
| 3.5 | 迁移 MarkdownEnhancements（代码高亮 + mermaid + KaTeX + DOMPurify） | 🔲 待开始 | - | ~2h |
| 3.6 | 迁移 ActivityPanel（思考+工具执行时间线） | 🔲 待开始 | - | ~3h |
| 3.7 | 迁移 ProcessGroup + StepMessage | 🔲 待开始 | - | ~2h |
| 3.8 | 迁移 ToolCallView + toolViews + constants/tool.ts | 🔲 待开始 | - | ~2.5h |
| 3.9 | 迁移 MonacoEditor + i18n 框架 + 中英文翻译 | 🔲 待开始 | - | ~2.5h |

### 前端：对话模式页面

| # | 任务 | 状态 | 提交 | 备注 |
|---|------|------|------|------|
| 3.10 | HomePage 迁移（欢迎页 + 快捷提示 + ChatBox） | 🔲 待开始 | - | ~3h |
| 3.11 | ChatBox 组件迁移（文本输入 + 文件附件 + 发送/停止） | 🔲 待开始 | - | ~2.5h |
| 3.12 | ChatMessage 组件迁移（Markdown + 代码高亮 + 打字机效果） | 🔲 待开始 | - | ~3h |
| 3.13 | ChatPage 拆分迁移（SSE 事件处理提取为 composable） | 🔲 待开始 | - | ~5h，关键任务 |
| 3.14 | SessionPanel 迁移（会话列表 + 时间分组 + pin/rename/delete） | 🔲 待开始 | - | ~3h |
| 3.15 | SuggestedQuestions 组件 | 🔲 待开始 | - | ~0.5h |
| 3.16 | useChatSession composable（SSE 连接 + 事件分发 + 消息累积） | 🔲 待开始 | - | ~3h |
| 3.17 | useSessionGrouping + useSessionNotifications + usePendingChat | 🔲 待开始 | - | ~2h |
| 3.18 | chatStore (Pinia) | 🔲 待开始 | - | ~1.5h |
| 3.19 | api/chat.ts + 路由更新（/ → HomePage, /chat/:id → ChatPage） | 🔲 待开始 | - | ~2h |

### 后端：对话模式服务

| # | 任务 | 状态 | 提交 | 备注 |
|---|------|------|------|------|
| 3.20 | ChatSession/ChatMessage/ChatEvent Pydantic 模型 | ✅ 完成 | - | ~1.5h |
| 3.21 | chat_sessions MongoDB 集合 + 索引 | ✅ 完成 | - | ~1h |
| 3.22 | Chat Session CRUD API（PUT/GET/DELETE/PATCH） | ✅ 完成 | - | ~3h |
| 3.23 | RISC-V 专家对话 System Prompt | 🔲 待开始 | - | ~2h |
| 3.24 | ChatRunner 流式执行器（asyncio.Queue → LLM astream → SSE） | 🔲 待开始 | - | ~5h，关键任务 |
| 3.25 | POST /sessions/:id/chat SSE + POST /sessions/:id/stop | 🔲 待开始 | - | ~3h |
| 3.26 | GET /sessions/notifications SSE 端点 | 🔲 待开始 | - | ~1.5h |
| 3.27 | Auth 补充端点（change-password, change-fullname, me, status） | ✅ 完成 | - | ~1h |

### 联调

| # | 任务 | 状态 | 提交 | 备注 |
|---|------|------|------|------|
| 3.28 | HomePage → 输入问题 → ChatPage 流式响应 → 多轮对话 | 🔲 待开始 | - | ~3h，阻塞于前后端完成 |

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
