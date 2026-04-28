# 经验教训

> 开发过程中的经验教训记录。每次纠正或发现重要模式后更新此文件。
> 格式：日期 + 类别 + 教训 + 原因 + 如何避免

## 模板

```
### YYYY-MM-DD | 类别

**教训**：简述发生了什么

**原因**：为什么会发生

**如何避免**：未来如何防止
```

## Sprint 0-2 回顾

### 2026-04-20 | 数据层

**教训**：Motor cursor 不支持直接 `list()` 调用，需要 `to_list(length=None)`

**原因**：Motor 的 AsyncIOMotorCursor 与 PyMongo 的 Cursor API 不完全一致

**如何避免**：Motor 查询结果始终用 `await cursor.to_list(length=None)` 或 `async for doc in cursor`

### 2026-04-20 | 前端

**教训**：ScienceClaw 用 `user.name`，RV-Insights 用 `user.username`，直接复制组件会导致显示空白

**原因**：两个项目的 User 模型字段命名不同

**如何避免**：迁移 ScienceClaw 组件时，必须对照 `tasks/api-contracts.md` 中的 AuthUser 类型调整字段名

---

## Sprint 3+（开发中填充）

### 2026-04-28 | API 设计

**教训**：OpenAPI spec 中 `/api/v1/cases` 路径出现重复 key（GET 列表和 POST 创建写在不同位置），导致 Swagger UI 只显示其中一个

**原因**：YAML 中同一层级的重复 key 会被静默覆盖，不会报错

**如何避免**：同一路径的所有 HTTP 方法必须写在同一个 path 对象下；CI 中加 OpenAPI lint 检查

### 2026-04-28 | 前端

**教训**：Mock API 返回裸 JSON，但真实后端返回 `{code, msg, data}` 包装格式，导致前端对接时大量组件报错

**原因**：Mock 数据未遵循 `conventions.md` 中定义的统一响应格式

**如何避免**：Mock API 必须使用 `ok()` / `err()` 包装函数，与真实 API 保持一致；前端 API 层统一解包

### 2026-04-28 | 架构

**教训**：ArtifactManager（产物管理）原计划 Sprint 2 实现，但因依赖完整 Pipeline 流程（需要真实 Agent 产出文件），被延期到 Sprint 6

**原因**：产物管理需要 Develop/Test Agent 实际生成 patch、测试报告等文件，Sprint 2 时这些 Agent 尚未实现

**如何避免**：任务规划时识别"需要上游产出"的依赖关系，将此类任务排在依赖项完成之后

### 2026-04-28 | 工程化

**教训**：`web-console/src/` 下的 `.js` 编译产物被误提交到 git，尽管 `.gitignore` 中有 `web-console/src/**/*.js` 规则

**原因**：这些 `.js` 文件在 `.gitignore` 规则添加之前就已被 git 追踪，gitignore 不会影响已追踪的文件

**如何避免**：添加 gitignore 规则后，必须执行 `git rm --cached` 移除已追踪的文件；新项目初始化时先配好 gitignore 再首次提交
