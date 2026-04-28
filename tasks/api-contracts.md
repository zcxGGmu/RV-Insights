# 前后端 API 类型契约

> 本文档定义 RV-Insights 全部 API 模块的请求/响应类型，对标 ScienceClaw。
> 前后端开发必须严格遵循此契约，任何变更需同步更新此文档。

## 通用响应包装

所有主服务 API（除 task-service 和 tooluniverse 外）使用统一响应信封：

```typescript
interface ApiResponse<T> {
  code: number;    // 0 = 成功，非零 = 业务错误
  msg: string;     // "ok" 或错误描述
  data: T;
}
```

task-service 和 tooluniverse 端点返回裸 JSON（无包装）。

认证方式：`Authorization: Bearer <jwt_token>`

---

## 1. Auth 模块

### `POST /api/v1/auth/login`

```typescript
// Request
{ username: string; password: string }

// Response data
interface TokenResponse {
  user: AuthUser;
  access_token: string;
  refresh_token: string;
  token_type: "Bearer";
}
```

### `POST /api/v1/auth/register`

```typescript
// Request
{ fullname: string; email: string; password: string; username?: string }

// Response data: TokenResponse
```

### `GET /api/v1/auth/status`

```typescript
// Response data
{ authenticated: boolean; auth_provider: "local" | "none"; user?: AuthUser }
```

### `GET /api/v1/auth/me`

```typescript
// Response data
interface AuthUser {
  id: string;
  fullname: string;
  email: string;
  role: "user" | "admin";
  is_active: boolean;
  created_at: string;    // ISO
  updated_at: string;
  last_login_at?: string;
}
```

### `POST /api/v1/auth/refresh`

```typescript
// Request
{ refresh_token: string }

// Response data
{ access_token: string; token_type: "Bearer" }
```

### `POST /api/v1/auth/change-password`

```typescript
// Request
{ old_password: string; new_password: string }

// Response data
{ ok: true }
```

### `POST /api/v1/auth/change-fullname`

```typescript
// Request
{ fullname: string }

// Response data: AuthUser
```

### `POST /api/v1/auth/logout`

```typescript
// Response data
{ ok: true }
```

### `GET /api/v1/auth/check-default-password`

```typescript
// Response data
{ is_default: boolean; username?: string; password?: string }
```

---

## 2. Sessions 模块（Chat 对话）

### `PUT /api/v1/sessions`

```typescript
// Request
{ mode?: string; model_config_id?: string }

// Response data
{ session_id: string; mode: string }
```

### `GET /api/v1/sessions`

```typescript
// Response data
interface ListSessionData {
  sessions: ListSessionItem[];
}

interface ListSessionItem {
  session_id: string;
  title?: string;
  latest_message?: string;
  latest_message_at?: number;      // unix timestamp
  status: "pending" | "running" | "completed";
  unread_message_count: number;
  is_shared: boolean;
  mode: string;
  pinned: boolean;
  source?: "wechat" | "lark" | null;
}
```

### `GET /api/v1/sessions/{session_id}`

```typescript
// Response data
interface GetSessionData {
  session_id: string;
  title?: string;
  status: string;
  events: AgentSSEEvent[];
  is_shared: boolean;
  mode: string;
  model_config_id?: string;
}
```

### `GET /api/v1/sessions/shared/{session_id}`

无需认证。Response data: `GetSessionData`（无 model_config_id）。

### `DELETE /api/v1/sessions/{session_id}`

```typescript
// Response data
{ ok: true }
```

### `PATCH /api/v1/sessions/{session_id}/pin`

```typescript
// Request
{ pinned: boolean }

// Response data
{ session_id: string; pinned: boolean }
```

### `PATCH /api/v1/sessions/{session_id}/title`

```typescript
// Request
{ title: string }

// Response data
{ session_id: string; title: string }
```

### `POST /api/v1/sessions/{session_id}/clear_unread_message_count`

```typescript
// Response data
{ ok: true }
```

### `POST /api/v1/sessions/{session_id}/stop`

```typescript
// Response data
{ ok: true }
```

### `POST /api/v1/sessions/{session_id}/chat` (SSE)

```typescript
// Request
interface ChatRequest {
  message: string;
  timestamp?: number;
  event_id?: string;               // 重连游标
  attachments?: string[];
  language?: "zh" | "en";
  model_config_id?: string;
}

// Response: SSE 流（见 sse-protocol.md）
```

### `POST /api/v1/sessions/{session_id}/share`

```typescript
// Response data
{ session_id: string; is_shared: true }
```

### `DELETE /api/v1/sessions/{session_id}/share`

```typescript
// Response data
{ session_id: string; is_shared: false }
```

### `POST /api/v1/sessions/{session_id}/upload`

Multipart form: `file` 字段。

```typescript
// Response data
interface UploadedFile {
  file_id: string;
  filename: string;
  size: number;
  upload_date: string;
  content_type: string;
  file_url: string;
  metadata: { storage_path: string; session_id: string };
}
```

### `GET /api/v1/sessions/{session_id}/files`

```typescript
// Response data: SessionFile[]
interface SessionFile {
  file_id: string;
  filename: string;
  size: number;
  upload_date: string;
  content_type: string;
  file_url: string;
  category: "result" | "process";
  metadata: { storage_path: string; session_id: string };
}
```

### `GET /api/v1/sessions/notifications` (SSE)

见 `sse-protocol.md` 通知流部分。

---

## 3. Models 模块

### `GET /api/v1/models`

```typescript
// Response data: ModelConfig[]（api_key 脱敏为 "********"）
```

### `POST /api/v1/models`

```typescript
// Request
interface CreateModelRequest {
  name: string;
  provider?: string;               // default "openai"
  base_url?: string;
  api_key?: string;
  model_name: string;
  context_window?: number;         // 1024..10_000_000
}

// Response data: ModelConfig
```

### `POST /api/v1/models/detect-context-window`

```typescript
// Request
{ provider: string; base_url?: string; api_key?: string; model_name: string; model_id?: string }

// Response data
{ context_window: number; source: "local" | "api" }
```

### `PUT /api/v1/models/{model_id}`

```typescript
// Request
{ name?: string; base_url?: string; api_key?: string; model_name?: string; context_window?: number; is_active?: boolean }

// Response data
{ id: string }
```

### `DELETE /api/v1/models/{model_id}`

```typescript
// Response data
{ ok: true }
```

### ModelConfig 完整类型

```typescript
interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  base_url?: string;
  api_key?: string;
  model_name: string;
  context_window?: number;
  is_system: boolean;
  user_id?: string;
  is_active: boolean;
  created_at: number;              // unix timestamp
  updated_at: number;
}

---

## 4. Statistics 模块

所有端点接受查询参数 `time_range`: `"today"` | `"7days"` | `"30days"` | `"all"`（默认 `"7days"`）。

### `GET /api/v1/statistics/summary`

```typescript
// Response data（使用统一 ApiResponse<T> 包装）
interface SummaryResponse {
  total_cost_usd: number;
  total_cost_cny: number;
  total_sessions: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  avg_per_session: number;
  cost_trend: number;              // 百分比
  session_trend: number;
  token_trend: number;
  distribution: Array<{ label: string; value: number; percentage: number }>;
}
```

### `GET /api/v1/statistics/models`

```typescript
// Response
interface ModelsResponse {
  models: Array<{
    name: string;
    session_count: number;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    cost_usd: number;
    cost_cny: number;
  }>;
}
```

### `GET /api/v1/statistics/trends`

```typescript
// Response
interface TrendsResponse {
  daily: Array<{
    date: string;                  // "YYYY-MM-DD"
    sessions: number;
    tokens: number;
    cost_usd: number;
    cost_cny: number;
  }>;
}
```

### `GET /api/v1/statistics/sessions`

额外参数：`page`（默认 1）、`page_size`（默认 20，最大 100）。

```typescript
// Response
interface SessionsResponse {
  sessions: Array<{
    session_id: string;
    title: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    cost_usd: number;
    cost_cny: number;
    created_at: string;
    status: string;
  }>;
  total: number;
}
```

---

## 5. Memory 模块

### `GET /api/v1/memory`

```typescript
// Response data
{ content: string }
```

### `PUT /api/v1/memory`

```typescript
// Request
{ content: string }

// Response data
{ content: string }
```

---

## 6. Skills 模块

### `GET /api/v1/sessions/skills`

```typescript
// Response data: ExternalSkillItem[]
interface ExternalSkillItem {
  name: string;
  description: string;
  files: string[];
  blocked: boolean;
  builtin: boolean;
}
```

### `PUT /api/v1/sessions/skills/{skill_name}/block`

```typescript
// Request
{ blocked: boolean }

// Response data
{ skill_name: string; blocked: boolean }
```

### `DELETE /api/v1/sessions/skills/{skill_name}`

```typescript
// Response data
{ skill_name: string; deleted: true }
```

### `POST /api/v1/sessions/{session_id}/skills/save`

```typescript
// Request
{ skill_name: string }

// Response data
{ skill_name: string; saved: true }
```

### `GET /api/v1/sessions/skills/{skill_name}/files?path=`

```typescript
// Response data
Array<{ name: string; path: string; type: "directory" | "file" }>
```

### `POST /api/v1/sessions/skills/{skill_name}/read`

```typescript
// Request
{ file: string }

// Response data
{ file: string; content: string }
```

---

## 7. Tools 模块

### `GET /api/v1/sessions/tools`

```typescript
// Response data: ExternalToolItem[]
interface ExternalToolItem {
  name: string;
  description: string;
  file: string;
  blocked: boolean;
}
```

### `PUT /api/v1/sessions/tools/{tool_name}/block`

```typescript
// Request
{ blocked: boolean }

// Response data
{ tool_name: string; blocked: boolean }
```

### `DELETE /api/v1/sessions/tools/{tool_name}`

```typescript
// Response data
{ tool_name: string; deleted: true }
```

### `POST /api/v1/sessions/tools/{tool_name}/read`

```typescript
// Response data
{ file: string; content: string }
```

### `POST /api/v1/sessions/{session_id}/tools/save`

```typescript
// Request
{ tool_name: string; replaces?: string }

// Response data
{ tool_name: string; saved: true; replaced?: string }
```

---

## 8. ToolUniverse 模块

> 返回裸 JSON，无 ApiResponse 包装。

### `GET /api/v1/tooluniverse/tools?search=&category=&lang=en`

```typescript
// Response
interface TUToolList {
  tools: TUTool[];
  total: number;
  categories: string[];
}

interface TUTool {
  name: string;
  description: string;
  category: string;
  category_zh?: string;
  param_count: number;
  required_params: string[];
  has_examples: boolean;
  has_return_schema: boolean;
}
```

### `GET /api/v1/tooluniverse/tools/{tool_name}?lang=en`

```typescript
// Response
interface TUToolSpec {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, {
      type: string;
      description: string;
      required?: boolean;
      enum?: string[];
    }>;
    required?: string[];
  };
  test_examples: Record<string, any>[];
  return_schema: any;
  category: string;
  category_zh?: string;
  source_file: string;
}
```

### `POST /api/v1/tooluniverse/tools/{tool_name}/run`

```typescript
// Request
{ arguments: Record<string, any> }

// Response
{ success: boolean; result: any }
```

### `GET /api/v1/tooluniverse/categories?lang=en`

```typescript
// Response
{ categories: Array<{ name: string; name_zh?: string; count: number }> }
```

---

## 9. Tasks 模块（task-service 独立服务）

> 基础路径：`/task-service`，返回裸 JSON。

### `POST /task-service/tasks`

```typescript
// Request
interface TaskCreate {
  name: string;
  prompt: string;
  schedule_desc: string;
  crontab?: string;                // 从 schedule_desc 自动填充
  webhook?: string;
  webhook_ids?: string[];
  event_config?: string[];
  model_config_id?: string;
  status?: string;                 // default "enabled"
  user_id?: string;
}

// Response: TaskOut
```

### `GET /task-service/tasks`

```typescript
// Response: TaskOut[]
```

### `GET /task-service/tasks/{task_id}`

```typescript
// Response: TaskOut
```

### `PUT /task-service/tasks/{task_id}`

```typescript
// Request
interface TaskUpdate {
  name?: string;
  prompt?: string;
  schedule_desc?: string;
  crontab?: string;
  webhook?: string;
  webhook_ids?: string[];
  event_config?: string[];
  model_config_id?: string;
  status?: string;
  user_id?: string;
}

// Response: TaskOut
```

### `DELETE /task-service/tasks/{task_id}`

204 No Content。

### `GET /task-service/tasks/{task_id}/runs?limit=20&offset=0`

```typescript
// Response
interface TaskRunsPage {
  items: TaskRunOut[];
  total: number;
}
```

### `POST /task-service/tasks/validate-schedule`

```typescript
// Request
{ schedule_desc: string; model_config_id?: string }

// Response
{ valid: boolean; crontab: string; next_run: string }
```

### `POST /task-service/tasks/verify-webhook`

```typescript
// Request
{ webhook_url: string; task_name: string }

// Response
{ success: boolean; message: string }
```

### 共享类型

```typescript
interface TaskOut {
  id: string;
  name: string;
  prompt: string;
  schedule_desc: string;
  crontab: string;
  webhook?: string;
  webhook_ids: string[];
  event_config: string[];
  model_config_id?: string;
  status: string;
  created_at?: string;
  updated_at?: string;
  next_run?: string;
  total_runs: number;
  success_runs: number;
  success_rate: string;            // e.g. "95%"
  recent_runs: string[];           // 最近 7 次状态
}

interface TaskRunOut {
  id: string;
  task_id: string;
  status: "success" | "failed";
  chat_id?: string;
  start_time?: string;
  end_time?: string;
  result?: string;
  error?: string;
}
```

---

## 10. Webhooks 模块（task-service）

### `POST /task-service/webhooks`

```typescript
// Request
interface WebhookCreate {
  name: string;
  type: "feishu" | "dingtalk" | "wecom";
  url: string;
}

// Response: WebhookOut
```

### `GET /task-service/webhooks`

```typescript
// Response: WebhookOut[]
```

### `PUT /task-service/webhooks/{webhook_id}`

```typescript
// Request
interface WebhookUpdate {
  name?: string;
  type?: string;
  url?: string;
}

// Response: WebhookOut
```

### `DELETE /task-service/webhooks/{webhook_id}`

204 No Content。

### `POST /task-service/webhooks/{webhook_id}/test`

```typescript
// Response
{ success: boolean; message: string }
```

### WebhookOut 类型

```typescript
interface WebhookOut {
  id: string;
  name: string;
  type: "feishu" | "dingtalk" | "wecom";
  url: string;
  created_at?: string;
  updated_at?: string;
}
```

---

## 11. Task Settings 模块

### `GET /api/v1/task-settings`

```typescript
// Response data
interface TaskSettings {
  agent_stream_timeout: number;    // 60..21600, default 10800
  sandbox_exec_timeout: number;    // 30..1800, default 1200
  max_tokens: number;              // 1024..200000, default 8192
  output_reserve: number;          // 2048..65536, default 16384
  max_history_rounds: number;      // 1..30, default 10
  max_output_chars: number;        // 5000..100000, default 50000
}
```

### `PUT /api/v1/task-settings`

```typescript
// Request: Partial<TaskSettings>
// Response data: TaskSettings
```

---

## 12. IM 模块

### `POST /api/v1/im/bind/lark`

```typescript
// Request
{ lark_user_id: string; lark_union_id?: string }

// Response data
{ platform: string; platform_user_id: string; user_id: string; status: string }
```

### `DELETE /api/v1/im/bind/lark`

```typescript
// Response data
{ removed: boolean }
```

### `GET /api/v1/im/bind/lark/status`

```typescript
// Response data
interface LarkBindingStatus {
  bound: boolean;
  platform?: string;
  platform_user_id?: string;
  user_id?: string;
  status?: string;
  updated_at?: number;
}
```

### `GET /api/v1/im/settings`（admin only）

```typescript
// Response data
interface IMSystemSettings {
  im_enabled: boolean;
  im_response_timeout: number;     // 30..1800
  im_max_message_length: number;   // 500..20000
  lark_enabled: boolean;
  lark_app_id: string;
  has_lark_app_secret: boolean;
  lark_app_secret_masked: string;
  wechat_enabled: boolean;
  im_progress_mode: "text_multi" | "card_entity";
  im_progress_detail_level: "compact" | "detailed";
  im_progress_interval_ms: number; // 300..10000
  im_realtime_events: string[];
}
```

### `PUT /api/v1/im/settings`（admin only）

```typescript
// Request: Partial<IMSystemSettings>（lark_app_secret 为明文）
// Response data: IMSystemSettings
```

### `POST /api/v1/im/wechat/start`（admin only）

```typescript
// Response data: bridge start result
```

### `POST /api/v1/im/wechat/stop`（admin only）

```typescript
// Response data: bridge stop result
```

### `GET /api/v1/im/wechat/status?output_offset=0`（admin only）

```typescript
// Response data
interface WeChatBridgeStatus {
  status: string;
  is_running: boolean;
  is_logging_in: boolean;
  error: string | null;
  started_at: number | null;
  qr_content: string | null;
  qr_image: string | null;
  account_id: string | null;
  has_saved_token: boolean;
  output_total: number;
  output_offset: number;
  output: string[];
}
```

---

## 13. File 模块

### `GET /api/v1/file/download?path=...`

返回原始文件字节（`application/octet-stream`）。路径必须在允许前缀下。

---

## 14. Science 模块

### `POST /api/v1/science/optimize-prompt`

```typescript
// Request
{ prompt: string; language?: "zh" | "en" }

// Response data
{ optimized_prompt: string }
```
```
