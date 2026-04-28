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
