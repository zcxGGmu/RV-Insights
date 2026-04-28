# 开发规范

> RV-Insights 项目开发规范，所有代码必须遵循。

## 1. API 路由命名

```
/api/v1/{resource}                    # 集合
/api/v1/{resource}/{id}               # 单个资源
/api/v1/{resource}/{id}/{action}      # 动作
/api/v1/{resource}/{id}/{sub-resource} # 子资源
```

- 资源名用复数小写：`sessions`, `cases`, `models`, `skills`, `tools`
- 动作用动词：`chat`, `stop`, `share`, `pin`, `upload`
- 查询参数用 snake_case：`time_range`, `page_size`, `model_config_id`

## 2. MongoDB 集合命名

- snake_case 复数名词：`chat_sessions`, `model_configs`, `user_memories`
- 子功能加域前缀：`im_bindings`, `im_system_settings`
- 索引命名：`idx_{collection}_{field}`，复合索引：`idx_{collection}_{field1}_{field2}`

## 3. Pydantic 模型命名

```python
# 创建请求
class CreateSessionRequest(BaseModel): ...

# 更新请求
class UpdateModelRequest(BaseModel): ...

# 数据库文档
class SessionInDB(BaseModel): ...

# API 响应
class SessionOut(BaseModel): ...

# 内部传输
class SessionData(BaseModel): ...
```

- 请求模型：`{Action}{Resource}Request`
- 响应模型：`{Resource}Out` 或 `{Resource}Data`
- 数据库模型：`{Resource}InDB`
- 枚举：`{Resource}Status`，值用 UPPER_SNAKE_CASE

## 4. Vue 组件命名

- 页面组件：`{Name}Page.vue`（PascalCase），放 `views/`
- 功能组件：`{Feature}{Name}.vue`，放 `components/{feature}/`
- 共享组件：放 `components/shared/` 或 `components/ui/`
- 文件名与组件名一致，始终 PascalCase

## 5. Composables 命名

```typescript
// 文件名：use{Feature}.ts
// 导出函数名：use{Feature}
export function useChatSession() { ... }
export function useSessionGrouping() { ... }
```

- 一个文件一个 composable
- 返回值用解构对象，不用数组
- 内部状态用 `ref()` / `reactive()`，不暴露原始 ref 的 `.value`

## 6. API 响应格式

### 主服务（FastAPI）

```python
def ok(data: Any = None, msg: str = "ok") -> dict:
    return {"code": 0, "msg": msg, "data": data}

def err(code: int, msg: str) -> dict:
    return {"code": code, "msg": msg, "data": None}
```

业务错误码规划：

| 范围 | 模块 |
|------|------|
| 1xxx | Auth |
| 2xxx | Sessions |
| 3xxx | Cases / Pipeline |
| 4xxx | Models |
| 5xxx | Skills / Tools |
| 6xxx | Tasks / Webhooks |
| 7xxx | IM |
| 8xxx | Statistics |
| 9xxx | System |

### task-service

裸 JSON 返回，HTTP 状态码表示成功/失败。

### ToolUniverse

裸 JSON 返回。

## 7. 错误处理

### 后端

```python
from fastapi import HTTPException

# 业务错误：用 ApiResponse 包装
return ok() / err(code, msg)

# 系统错误：用 HTTPException
raise HTTPException(status_code=500, detail="Internal error")

# 认证错误：401
raise HTTPException(status_code=401, detail="Not authenticated")

# 权限错误：403
raise HTTPException(status_code=403, detail="Insufficient permissions")
```

### 前端

```typescript
try {
  const { data } = await api.post<ApiResponse<T>>(url, body)
  if (data.code !== 0) {
    toast.error(data.msg)
    return
  }
  return data.data
} catch (error) {
  if (error.response?.status === 401) {
    await refreshToken()
    // retry
  }
  toast.error('网络错误')
}
```

## 8. 前端状态管理

### 决策：Pinia stores（非 ScienceClaw 的 composable 单例模式）

RV-Insights 已有 `authStore` 和 `caseStore`，继续使用 Pinia：

```typescript
// stores/{feature}.ts
export const useChatStore = defineStore('chat', () => {
  const sessions = ref<ListSessionItem[]>([])
  const currentSessionId = ref<string | null>(null)

  async function loadSessions() { ... }

  return { sessions, currentSessionId, loadSessions }
})
```

- 每个功能域一个 store
- 使用 Setup Store 语法（`defineStore('name', () => { ... })`）
- UI 状态用 composable（`useRightPanel`, `useSettingsDialog`）
- 服务端数据用 Pinia store

## 9. CSS / 样式规范

- 使用 TailwindCSS utility classes，不写自定义 CSS
- 颜色使用 CSS 变量（`theme.css` 中定义）
- 响应式：`sm:` / `md:` / `lg:` 断点
- 暗色模式：通过 `dark:` 前缀

## 10. Git 提交规范

```
<type>(<scope>): <subject>

Sprint: N | Task: 任务描述
```

- type: `feat` / `fix` / `refactor` / `test` / `docs` / `chore` / `perf`
- scope: `backend` / `frontend` / `infra` / `api` / `pipeline`
- subject: 祈使句，首字母小写，不加句号

## 11. 文件大小限制

- Vue 组件：< 400 行（超过则拆分为子组件 + composable）
- Python 模块：< 400 行（超过则拆分为子模块）
- TypeScript 文件：< 400 行
- 绝对上限：800 行

## 12. 安全规范

- 所有用户输入必须验证（Pydantic 自动处理后端，前端用 zod 或手动校验）
- API 密钥等敏感字段响应时脱敏为 `"********"`
- JWT token 存 localStorage，refresh token 存 httpOnly cookie（如可行）
- SSE 连接必须携带 Authorization header
- 文件下载路径必须白名单校验
- IM webhook URL 必须 HTTPS
