# 业务错误码目录

> 所有主服务 API 的业务错误码定义。错误码通过 `ApiResponse.code` 返回，`code=0` 表示成功。
> task-service 和 tooluniverse 使用 HTTP 状态码，不使用此错误码体系。
> 新增错误码时必须同步更新此文档。

---

## 错误码范围分配

| 范围 | 模块 | 负责 Sprint |
|------|------|-------------|
| 1xxx | Auth | S0-S3 |
| 2xxx | Sessions (Chat) | S3-S4 |
| 3xxx | Cases / Pipeline | S2-S7 |
| 4xxx | Models | S4 |
| 5xxx | Skills / Tools | S8 |
| 6xxx | Tasks / Webhooks | S9 |
| 7xxx | IM | S9 |
| 8xxx | Statistics | S4-S8 |
| 9xxx | System | 全局 |

---

## 1xxx — Auth

| Code | 常量名 | 含义 | HTTP Status |
|------|--------|------|-------------|
| 1001 | AUTH_INVALID_CREDENTIALS | 用户名或密码错误 | 200 |
| 1002 | AUTH_TOKEN_EXPIRED | access_token 已过期 | 401 |
| 1003 | AUTH_TOKEN_INVALID | token 格式无效或签名错误 | 401 |
| 1004 | AUTH_REFRESH_TOKEN_EXPIRED | refresh_token 已过期 | 401 |
| 1005 | AUTH_USER_DISABLED | 用户已被禁用 | 200 |
| 1006 | AUTH_USERNAME_EXISTS | 用户名已存在 | 200 |
| 1007 | AUTH_EMAIL_EXISTS | 邮箱已注册 | 200 |
| 1008 | AUTH_WRONG_OLD_PASSWORD | 修改密码时旧密码错误 | 200 |
| 1009 | AUTH_INSUFFICIENT_PERMISSION | 权限不足（非 admin 访问 admin 接口） | 403 |
| 1010 | AUTH_PASSWORD_TOO_WEAK | 密码不满足强度要求 | 200 |

## 2xxx — Sessions (Chat)

| Code | 常量名 | 含义 | HTTP Status |
|------|--------|------|-------------|
| 2001 | SESSION_NOT_FOUND | 会话不存在 | 200 |
| 2002 | SESSION_NOT_OWNED | 会话不属于当前用户 | 200 |
| 2003 | SESSION_ALREADY_RUNNING | 会话正在执行中，不能发起新请求 | 200 |
| 2004 | SESSION_TITLE_TOO_LONG | 标题超过 200 字符 | 200 |
| 2005 | SESSION_SHARE_DISABLED | 分享功能未启用 | 200 |
| 2006 | SESSION_FILE_TOO_LARGE | 上传文件超过大小限制 | 200 |
| 2007 | SESSION_FILE_TYPE_BLOCKED | 不允许的文件类型 | 200 |
| 2008 | SESSION_MESSAGE_EMPTY | 消息内容为空（非重连场景） | 200 |
| 2009 | SESSION_MODEL_NOT_CONFIGURED | 未配置可用模型 | 200 |

## 3xxx — Cases / Pipeline

| Code | 常量名 | 含义 | HTTP Status |
|------|--------|------|-------------|
| 3001 | CASE_NOT_FOUND | 案例不存在 | 200 |
| 3002 | CASE_NOT_OWNED | 案例不属于当前用户 | 200 |
| 3003 | CASE_INVALID_STATUS | 当前状态不允许此操作 | 200 |
| 3004 | CASE_ALREADY_RUNNING | Pipeline 正在执行中 | 200 |
| 3005 | CASE_REVIEW_INVALID | 审核决策无效（非 approve/reject/abandon） | 200 |
| 3006 | CASE_BUDGET_EXCEEDED | 成本超过预算上限（$10/case） | 200 |
| 3007 | CASE_MAX_ITERATIONS | 达到最大审核迭代次数 | 200 |
| 3008 | CASE_STAGE_MISMATCH | 审核阶段与当前 Pipeline 阶段不匹配 | 200 |

## 4xxx — Models

| Code | 常量名 | 含义 | HTTP Status |
|------|--------|------|-------------|
| 4001 | MODEL_NOT_FOUND | 模型配置不存在 | 200 |
| 4002 | MODEL_NAME_EXISTS | 模型名称已存在 | 200 |
| 4003 | MODEL_API_KEY_INVALID | API Key 验证失败 | 200 |
| 4004 | MODEL_CONTEXT_DETECT_FAILED | 无法自动检测 context window | 200 |
| 4005 | MODEL_IS_SYSTEM | 系统内置模型不可删除/修改 | 200 |
| 4006 | MODEL_IN_USE | 模型正在被活跃会话使用，不可删除 | 200 |

## 5xxx — Skills / Tools

| Code | 常量名 | 含义 | HTTP Status |
|------|--------|------|-------------|
| 5001 | SKILL_NOT_FOUND | Skill 不存在 | 200 |
| 5002 | SKILL_NAME_EXISTS | Skill 名称已存在 | 200 |
| 5003 | SKILL_LOAD_FAILED | Skill 加载/解析失败 | 200 |
| 5004 | SKILL_IS_BUILTIN | 内置 Skill 不可删除 | 200 |
| 5101 | TOOL_NOT_FOUND | Tool 不存在 | 200 |
| 5102 | TOOL_NAME_EXISTS | Tool 名称已存在 | 200 |
| 5103 | TOOL_LOAD_FAILED | Tool 加载/解析失败 | 200 |
| 5201 | TU_TOOL_NOT_FOUND | ToolUniverse 工具不存在 | 200 |
| 5202 | TU_TOOL_RUN_FAILED | ToolUniverse 工具执行失败 | 200 |
| 5203 | TU_TOOL_TIMEOUT | ToolUniverse 工具执行超时 | 200 |

## 6xxx — Tasks / Webhooks

| Code | 常量名 | 含义 | HTTP Status |
|------|--------|------|-------------|
| 6001 | TASK_NOT_FOUND | 定时任务不存在 | 200 |
| 6002 | TASK_SCHEDULE_INVALID | 调度表达式无效 | 200 |
| 6003 | TASK_NAME_EXISTS | 任务名称已存在 | 200 |
| 6004 | TASK_LIMIT_REACHED | 用户任务数达到上限 | 200 |
| 6101 | WEBHOOK_NOT_FOUND | Webhook 不存在 | 200 |
| 6102 | WEBHOOK_URL_INVALID | Webhook URL 格式无效或非 HTTPS | 200 |
| 6103 | WEBHOOK_TEST_FAILED | Webhook 测试发送失败 | 200 |

## 7xxx — IM

| Code | 常量名 | 含义 | HTTP Status |
|------|--------|------|-------------|
| 7001 | IM_NOT_ENABLED | IM 功能未启用 | 200 |
| 7002 | IM_LARK_BIND_FAILED | 飞书绑定失败 | 200 |
| 7003 | IM_LARK_ALREADY_BOUND | 飞书账号已绑定 | 200 |
| 7004 | IM_LARK_NOT_BOUND | 飞书账号未绑定 | 200 |
| 7005 | IM_WECHAT_START_FAILED | 微信桥启动失败 | 200 |
| 7006 | IM_WECHAT_ALREADY_RUNNING | 微信桥已在运行 | 200 |
| 7007 | IM_WECHAT_NOT_RUNNING | 微信桥未运行 | 200 |
| 7008 | IM_SETTINGS_INVALID | IM 设置参数无效 | 200 |

## 8xxx — Statistics

| Code | 常量名 | 含义 | HTTP Status |
|------|--------|------|-------------|
| 8001 | STATS_TIME_RANGE_INVALID | 时间范围参数无效 | 200 |
| 8002 | STATS_AGGREGATION_FAILED | 统计聚合查询失败 | 200 |

## 9xxx — System

| Code | 常量名 | 含义 | HTTP Status |
|------|--------|------|-------------|
| 9001 | SYSTEM_RATE_LIMITED | 请求频率超限 | 429 |
| 9002 | SYSTEM_MAINTENANCE | 系统维护中 | 200 |
| 9003 | SYSTEM_INTERNAL_ERROR | 内部错误（兜底） | 200 |
| 9004 | SYSTEM_FILE_NOT_FOUND | 文件下载路径不存在 | 200 |
| 9005 | SYSTEM_FILE_PATH_BLOCKED | 文件路径不在白名单内 | 200 |
| 9006 | SYSTEM_PROMPT_OPTIMIZE_FAILED | Prompt 优化失败 | 200 |

---

## 后端实现约定

```python
# backend/app/core/errors.py

class ErrorCode:
    # Auth
    AUTH_INVALID_CREDENTIALS = 1001
    AUTH_TOKEN_EXPIRED = 1002
    # ... 按上表定义

# 使用方式
from app.core.errors import ErrorCode
from app.core.response import err

return err(ErrorCode.SESSION_NOT_FOUND, "Session not found")
```
