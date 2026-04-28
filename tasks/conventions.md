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

## 13. 测试约定

### 后端

- 测试文件：`backend/tests/test_{module}.py`
- 框架：pytest + pytest-asyncio + httpx（`AsyncClient`）
- 公共 fixture 放 `backend/tests/conftest.py`
- 工厂函数放 `backend/tests/factories.py`（如需要）
- 命名：`test_{action}_{scenario}` 或 `test_{action}_{scenario}_{expected}`

### 前端

- 测试文件：与源文件同目录，命名 `{Component}.spec.ts` 或 `{composable}.spec.ts`
- 框架：vitest + @vue/test-utils（Sprint 7 配置）
- 命名：`describe('{Component}')` + `it('should {behavior}')`

### Mock 策略

- 单元测试：可 mock 外部服务（LLM API、第三方 HTTP）
- 集成测试：必须连接真实数据库（MongoDB、PostgreSQL、Redis）
- 前端 API 层测试：使用 MSW 或手动 mock axios

### 覆盖率

- MVP 阶段目标：70%（与 mvp-tasks.md Sprint 7 一致）
- 核心路径（auth、pipeline state machine、SSE 推送）要求 > 85%

## 14. 日志约定

### 后端

- 使用 structlog，绑定上下文字段：`request_id`、`user_id`、`case_id`、`session_id`
- 日志级别：
  - `DEBUG`：开发调试信息（生产环境关闭）
  - `INFO`：正常业务流程（请求处理、Pipeline 阶段转换）
  - `WARNING`：异常但可恢复（重试、降级）
  - `ERROR`：需要关注的错误（未捕获异常、外部服务不可用）
- 禁止在日志中输出：token、密码、API key、用户敏感信息

### 前端

- 开发环境使用 `console.warn` / `console.error`（不使用 `console.log`）
- 生产构建通过 Vite 插件移除所有 console 语句

## 15. 环境变量约定

- 命名：`UPPER_SNAKE_CASE`，按域分组（APP_、MONGODB_、JWT_、ANTHROPIC_ 等）
- 必填项清单：参见 `backend/.env.template`
- 本地开发：`cp backend/.env.template backend/.env` 后填入实际值
- 敏感变量（API key、JWT secret）禁止提交到 git，仅通过 `.env` 或环境注入
- Docker Compose 中通过 `env_file` 引用，不在 `docker-compose.yml` 中硬编码

## 16. Definition of Done (DoD)

每个任务标记完成前，必须满足：

- [ ] 代码通过 `ruff check` + `mypy`（后端）/ `vue-tsc --noEmit`（前端）
- [ ] 核心逻辑有单元测试且测试通过
- [ ] API 变更已同步更新 `tasks/api-contracts.md`
- [ ] SSE 事件变更已同步更新 `tasks/sse-protocol.md`
- [ ] 无硬编码凭据（API key、密码、token）
- [ ] commit message 符合 conventional commits 格式
- [ ] 相关文档已更新（conventions / progress / lessons）
- [ ] 文件不超过 800 行绝对上限
