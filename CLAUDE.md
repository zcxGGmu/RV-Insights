# RV-Insights

> RISC-V 开源贡献智能分析平台 — AI 辅助的 RISC-V 社区贡献工作流

## 技术栈

- 后端：FastAPI + LangGraph + Motor (MongoDB) + psycopg3 (PostgreSQL) + Redis
- 前端：Vue 3 + TypeScript + Vite + Pinia + TailwindCSS + Radix Vue
- AI：Claude SDK（执行类 Agent）+ OpenAI SDK（推理类 Agent），LangGraph 编排
- 基础设施：Docker Compose + Nginx 反向代理

## 会话恢复顺序

新会话开始时，按以下顺序读取上下文：

1. `tasks/progress.md` — 当前 Sprint 状态、已完成任务、tech debt
2. `tasks/mvp-tasks.md` — 完整任务清单、Sprint 规划、依赖关系
3. `tasks/conventions.md` — 编码规范、命名约定、DoD
4. `tasks/lessons.md` — 历史教训，避免重复踩坑
5. `git log --oneline -20` — 最近提交，了解代码变更

## 关键约束

- Human-in-the-Loop：Pipeline 每个阶段转换必须人工确认
- 成本熔断：$10/case 上限，$50/hour 上限
- 文件大小：400 行软限制，800 行绝对上限
- RBAC：2 角色（admin / user），详见 `tasks/api-contracts.md`
- API 响应格式：统一 `{code, msg, data}` 包装（仅 task-service 和 ToolUniverse 例外）
- 分支：`mvp/omo`

## 本地开发

```bash
# 1. 启动基础设施
docker compose up -d

# 2. 后端
cp backend/.env.template backend/.env  # 填入 API key
cd backend && pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000

# 3. 前端
cd web-console && pnpm install
pnpm dev
```

## 端口分配

| 服务 | 端口 |
|------|------|
| Nginx | 80 |
| Backend (FastAPI) | 8000 |
| MongoDB | 27017 |
| PostgreSQL | 5432 |
| Redis | 6379 |

## 文件索引

| 文件 | 用途 |
|------|------|
| `tasks/design.md` | 系统设计方案（v1 Pipeline + v4 变更摘要，含矛盾清单） |
| `tasks/chat-architecture.md` | Chat 模式后端架构（ChatRunner、数据模型、System Prompt 规范） |
| `tasks/mvp-tasks.md` | MVP 任务清单 v4（Sprint 0-9） |
| `tasks/conventions.md` | 开发规范（命名、格式、测试、日志、DoD） |
| `tasks/api-contracts.md` | 全量 API 类型契约（14 个模块） |
| `tasks/error-codes.md` | 业务错误码目录（1xxx-9xxx 全模块） |
| `tasks/sse-protocol.md` | SSE 事件协议规范（Chat / Pipeline / Notification） |
| `tasks/migration-map.md` | ScienceClaw → RV-Insights 文件迁移映射 |
| `tasks/progress.md` | Sprint 进度追踪 + tech debt |
| `tasks/lessons.md` | 经验教训记录 |
| `docs/openapi.yaml` | OpenAPI 3.0 规范 |

## 验证命令

```bash
# 后端
cd backend && python -m pytest tests/ -v
cd backend && ruff check app/
cd backend && mypy app/

# 前端
cd web-console && npx vue-tsc --noEmit
cd web-console && pnpm build
```
