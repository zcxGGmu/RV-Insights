# RV-Insights MVP 开发进度

> 此文件为持久化进度追踪，每次开发会话启动时先读取此文件以恢复上下文。
> 每完成一个功能点并提交后，更新此文件。

## 项目信息

- **分支**: `mvp/omo`
- **参考项目**: `/home/zq/work-space/repo/ai-projs/posp/ScienceClaw`
- **设计文档**: `tasks/design.md`
- **任务清单**: `tasks/mvp-tasks.md`
- **API 契约**: `docs/openapi.yaml`

## 当前 Sprint: Sprint 0（项目初始化）

## 当前状态: Sprint 0 完成

---

## Sprint 0：项目初始化

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
| 0.8 | shadcn-vue UI 原语复制 | 🔲 待开始 | - | Sprint 1 前置 |
| 0.9 | theme.css + global.css | 🔲 待开始 | - | Sprint 1 前置 |
| 0.10 | api/client.ts 复制 | 🔲 待开始 | - | Sprint 1 前置 |
| 0.11 | Docker Compose 5 服务 | ✅ 完成 | Sprint 0 commit | nginx, backend, mongodb, postgres, redis |
| 0.12 | 验收：测试通过 | ✅ 完成 | Sprint 0 commit | pytest 2/2 passed, vite build OK |

---

## Sprint 1：认证 + 数据层

### 后端

| # | 任务 | 状态 | 提交 | 备注 |
|---|------|------|------|------|
| 1.1 | User 模型 + MongoDB 集合 | 🔲 待开始 | - | |
| 1.2 | JWT 认证 (login/register/refresh/logout) | 🔲 待开始 | - | |
| 1.3 | RBAC 中间件 | 🔲 待开始 | - | |
| 1.4 | Case 模型 + CRUD API | 🔲 待开始 | - | |
| 1.5 | Case 状态机枚举 | 🔲 待开始 | - | |
| 1.6 | Pydantic 数据契约 | 🔲 待开始 | - | |
| 1.7 | ArtifactManager | 🔲 待开始 | - | |

### 前端

| # | 任务 | 状态 | 提交 | 备注 |
|---|------|------|------|------|
| 1.8 | LoginPage + LoginForm | 🔲 待开始 | - | |
| 1.9 | useAuth composable | 🔲 待开始 | - | |
| 1.10 | 路由配置 | 🔲 待开始 | - | |
| 1.11 | MainLayout + CaseListPanel | 🔲 待开始 | - | |
| 1.12 | Mock API 层 | 🔲 待开始 | - | |

---

## Sprint 2-6: 见 tasks/mvp-tasks.md

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
1. 读取此文件确认当前进度
2. 读取最近 git log 确认最后提交
3. 从"进行中"的任务继续
