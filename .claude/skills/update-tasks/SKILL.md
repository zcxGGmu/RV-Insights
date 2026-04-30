---
name: update-tasks
description: 维护并更新项目 tasks/ 文档，使其与当前代码和进度保持一致。
---

# /update-tasks

用于维护更新 `./tasks/` 下的关键文件，保证其为最新状态、与实现一致。

## 执行目标

1. 对齐当前事实来源：代码实现、最近提交、当前 Sprint 状态。
2. 更新任务看板与进度文档，避免“代码已变更但任务文档未同步”。
3. 记录新增教训，防止重复踩坑。

## 必读顺序

1. `tasks/progress.md`
2. `tasks/mvp-tasks.md`
3. `tasks/conventions.md`
4. `tasks/lessons.md`
5. 最近提交（`git log --oneline -20`）

## 更新范围（按需）

- 必更：
  - `tasks/progress.md`
  - `tasks/mvp-tasks.md`
  - `tasks/lessons.md`（有新教训时）
- 若本次实现涉及以下领域则同步：
  - Chat 架构变更 → `tasks/chat-architecture.md`
  - SSE 事件变更 → `tasks/sse-protocol.md`
  - API 契约变更 → `tasks/api-contracts.md`
  - 错误码新增/调整 → `tasks/error-codes.md`

## 操作要求

- 仅写入有事实依据的变更，不做推测。
- `mvp-tasks.md` 中已完成项标记为 `[x]`，并补充产出/偏差说明。
- 在 `progress.md` 中更新当前 Sprint 摘要、风险与 tech debt。
- 若用户在会话中纠正过方法，补充到 `lessons.md`（规则 + 场景）。

## 输出格式

执行后请输出：

1. 已更新文件列表
2. 每个文件的关键变更（1-3 条）
3. 当前进度结论（当前阶段 + 下一步建议）
4. 若有未决项，列出阻塞信息
