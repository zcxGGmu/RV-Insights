# RV-Insights MVP 开发进度

> 此文件为持久化进度追踪，每次开发会话启动时先读取此文件以恢复上下文。
> 每完成一个功能点并提交后，更新此文件。

## 项目信息

- **分支**: `mvp/omo`
- **参考项目**: `/home/zq/work-space/repo/ai-projs/posp/ScienceClaw`
- **设计文档**: `tasks/design.md`
- **任务清单**: `tasks/mvp-tasks.md`（v4 — 完全对标 ScienceClaw + 五阶段 Pipeline）
- **API 契约**: `docs/openapi.yaml`
- **SSE 协议**: `tasks/sse-protocol.md`
- **类型契约**: `tasks/api-contracts.md`
- **迁移映射**: `tasks/migration-map.md`
- **开发规范**: `tasks/conventions.md`
- **经验教训**: `tasks/lessons.md`

## 快速命令

```bash
# 后端
cd backend && pip install -r requirements.txt
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

## 当前 Sprint: Sprint 3（共享基础设施 + 对话模式基础）

## 当前状态: 待开始

### 架构对标决策（v4 — 完全对标 ScienceClaw + Pipeline 双模式）

**核心变更（v3 → v4）**：从"对标 ScienceClaw 核心功能"升级为"完全对标 ScienceClaw 全部功能（含 IM）"。
Sprint 从 7 个扩展为 10 个（Sprint 0-9），总工时从 ~299h 增至 ~411h。

新增模块：
- Skills 系统（CRUD + 热加载 + RISC-V 专用 Skills）
- External Tools 系统（CRUD + 热加载）
- ToolUniverse（RISC-V 工具宇宙 — list/get/run/categories）
- Scheduled Tasks（Celery 微服务 + NLP 调度解析）
- Webhooks（CRUD + test）
- IM 集成（Lark bind/unbind + WeChat bridge + system settings）
- Statistics 增强（每模型成本、趋势图表、货币切换）
- Settings 完整 8 tab（Account/General/Models/Personalization/Tasks/Statistics/Notifications/IM）
- 前端新增页面：SkillsPage, SkillDetailPage, ToolsPage, ToolDetailPage, ScienceToolDetail, TasksPage

### 下一步行动（Sprint 3 优先级排序）

**前端 Day 1-2 — 共享组件迁移：**
1. 引入 reka-ui + lucide-vue-next + simplebar-vue + marked + highlight.js + dompurify + katex + mermaid + mitt + vue-i18n + monaco-editor
2. 迁移 UI 原语 + utils + SSE 客户端升级
3. 迁移 MarkdownEnhancements + ActivityPanel + ProcessGroup/StepMessage
4. 迁移 ToolCallView + toolViews + MonacoEditor + i18n

**前端 Day 2-4 — 对话模式页面：**
5. HomePage（欢迎页 + ChatBox）
6. ChatPage（拆分迁移，SSE 事件处理提取为 useChatSession composable）
7. ChatBox + ChatMessage + SessionPanel + SessionItem + SuggestedQuestions
8. chatStore + api/chat.ts + 路由更新

**后端 Day 2-5 — 对话模式服务：**
9. ChatSession MongoDB 模型 + CRUD API
10. RISC-V 专家对话 System Prompt
11. ChatRunner 流式执行器（asyncio.Queue 模式）
12. POST /sessions/:id/chat SSE + stop + notifications
13. Auth 补充端点

**联调 Day 5：**
- HomePage → 输入问题 → ChatPage 流式响应 → 多轮对话

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
- `tasks/sse-protocol.md` — SSE 相关开发
- `tasks/api-contracts.md` — 前后端接口开发
- `tasks/migration-map.md` — 迁移 ScienceClaw 组件
- `tasks/design.md` — 架构决策回查（1600 行，按章节查，不要全读）
