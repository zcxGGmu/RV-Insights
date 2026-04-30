# SSE 事件协议契约

> 本文档定义 RV-Insights 两条 SSE 流的完整事件协议，对标 ScienceClaw 并扩展 Pipeline 模式事件。
> 所有开发必须严格遵循此协议，前后端共用此文档作为唯一事实来源。

## 概览

| 流 | 端点 | 方法 | 用途 |
|---|---|---|---|
| Chat 流 | `POST /api/v1/sessions/{id}/chat` | POST | 对话模式：流式 Agent 执行事件 |
| Pipeline 流 | `GET /api/v1/cases/{id}/events` | GET | Pipeline 模式：五阶段执行事件 |
| 通知流 | `GET /api/v1/sessions/notifications` | GET | 全局会话生命周期通知 |

---

## 一、Chat 模式事件（14 种）

### 1. `message`

完整的助手/用户消息（非流式场景或 IM 转发）。

```typescript
{
  event_id: string;      // shortuuid
  timestamp: number;     // unix seconds
  content: string;       // 完整消息文本
  role: "user" | "assistant";
  attachments: string[]; // file_id 列表
}
```

### 2. `message_chunk`

逐 token 流式输出。前端累积拼接，直到收到 `message_chunk_done`。

```typescript
{
  event_id: string;
  timestamp: number;
  content: string;       // 单个 token/chunk
  role: "assistant";
}
```

### 3. `message_chunk_done`

标记一轮流式输出结束。后端将累积 chunks 持久化为一条 `message` 事件。

```typescript
{
  event_id: string;
  timestamp: number;
}
```

### 4. `tool`

工具调用生命周期，每次调用发两次（calling → called）。

```typescript
{
  event_id: string;
  timestamp: number;
  tool_call_id: string;
  name: string;                    // 归一化显示名
  status: "calling" | "called";
  function: string;                // LLM 原始函数名
  args: Record<string, any>;       // 仅 calling 时发送
  content?: any;                   // 仅 called 时：工具返回值
  duration_ms?: number;            // 仅 called 时
  tool_meta?: {
    icon: string;
    category: "search" | "filesystem" | "execution" | "network" | "data" | "skill" | "system" | "custom";
    description: string;
    sandbox?: boolean;
  };
}
```

### 5. `step`

计划步骤状态变更。

```typescript
{
  event_id: string;
  timestamp: number;
  status: "pending" | "running" | "completed" | "failed";
  id: string;
  description: string;
  tools?: ToolEventData[];         // 前端关联填充
}
```

### 6. `plan`

Agent 生成或更新执行计划。

```typescript
{
  event_id: string;
  timestamp: number;
  steps: Array<{
    event_id: string;
    timestamp: number;
    status: "pending" | "running" | "completed" | "failed";
    id: string;
    description: string;
    tools: ToolEventData[];
  }>;
}
```

### 7. `thinking`

LLM 推理/思维链内容。

```typescript
{
  event_id: string;
  timestamp: number;
  content: string;
}
```

### 8. `title`

首条用户消息后自动生成的会话标题。

```typescript
{
  event_id: string;
  timestamp: number;
  title: string;
}
```

### 9. `error`

执行失败或用户中止。

```typescript
{
  event_id: string;
  timestamp: number;
  error: string;
}
```

### 10. `done`

一轮执行结束（始终是最后一个事件）。

```typescript
{
  event_id: string;
  timestamp: number;
  statistics?: {
    total_duration_ms?: number;
    tool_call_count?: number;
    input_tokens?: number;
    output_tokens?: number;
    token_count?: number;
  };
  round_files?: Array<{
    file_id: string;
    filename: string;
    relative_path: string;
    size: number;
    upload_date: string;
    file_url: string;
    category: "output" | "research_data";
  }>;
  interrupted?: boolean;           // 孤儿会话强制关闭
}
```

### 11. `skill_save_prompt`

执行完成后检测到新 Skill 未保存。

```typescript
{
  event_id: string;
  timestamp: number;
  skill_name: string;
}
```

### 12. `tool_save_prompt`

执行完成后检测到新 Tool 未保存。

```typescript
{
  event_id: string;
  timestamp: number;
  tool_name: string;
}
```

### 13. `statistics`

独立的统计事件（可选，done 中也携带）。

```typescript
{
  event_id: string;
  timestamp: number;
  total_duration_ms?: number;
  tool_call_count?: number;
  input_tokens?: number;
  output_tokens?: number;
  token_count?: number;
}
```

### 14. `wait`

预留事件（未来用于人工确认等场景）。

```typescript
{
  event_id: string;
  timestamp: number;
}
```

---

## 二、Pipeline 模式事件（8 种）

Pipeline 使用 Redis Pub/Sub + Stream，通过 `GET /api/v1/cases/{id}/events` SSE 端点推送。

> **命名映射**：后端 `EventType` 枚举名 → 协议文档名
> `stage_change` → `stage_change` | `agent_output` → `agent_output` | `review_request` → `human_gate`
> `cost_update` → `cost_update` | `completed` → `pipeline_done` | `error` → `pipeline_error`
> `iteration_update` → `iteration_update` | `heartbeat` → 心跳（见第五节）

### 1. `stage_change`

阶段切换。

```typescript
{
  case_id: string;
  stage: "explore" | "plan" | "develop" | "review" | "test";
  status: "started" | "completed" | "failed" | "skipped" | "resumed";
  message?: string;                  // 可选的上下文消息
  timestamp: number;
}
```

### 2. `agent_output`

Agent 节点输出。`type` 字段区分子类型：

**结果类型**（阶段完成时发送）：

```typescript
{
  case_id: string;
  stage: string;
  type: "exploration_result" | "execution_plan" | "development_result" | "review_verdict" | "test_result";
  data: Record<string, any>;       // 结构因 type 而异
  timestamp: number;
}
```

**过程类型**（执行中实时发送）：

```typescript
// thinking — Agent 正在思考
{
  case_id: string;
  type: "thinking";
  content: string;
  timestamp: number;
}

// tool_call — Agent 调用工具
{
  case_id: string;
  type: "tool_call";
  tool_name: string;
  args: Record<string, any>;
  timestamp: number;
}

// tool_result — 工具返回结果
{
  case_id: string;
  type: "tool_result";
  tool_name: string;
  result: string;
  timestamp: number;
}
```

### 3. `human_gate`

需要人工审核。

```typescript
{
  case_id: string;
  stage: string;
  gate_type: "review_required" | "approval_required";
  summary: string;
  timestamp: number;
}
```

### 4. `cost_update`

成本累计更新。

```typescript
{
  case_id: string;
  total_cost: number;
  budget_remaining: number;
  timestamp: number;
}
```

### 5. `pipeline_done`

Pipeline 执行完成。

```typescript
{
  case_id: string;
  final_status: "completed" | "abandoned";
  total_cost: number;
  duration_ms: number;
  timestamp: number;
}
```

### 6. `pipeline_error`

Pipeline 执行异常。

```typescript
{
  case_id: string;
  stage: string;
  error: string;
  recoverable: boolean;
  timestamp: number;
}
```

### 7. `iteration_update`

Develop↔Review 迭代循环状态更新。

```typescript
{
  case_id: string;
  iteration: number;              // 当前迭代次数
  max_iterations: number;         // 最大迭代次数（默认 3）
  timestamp: number;
}
```

### 8. `heartbeat`

保活心跳，每 15 秒发送（见第五节）。不含 data payload。

---

## 三、通知流

端点：`GET /api/v1/sessions/notifications`

基于内存 Pub/Sub，按 user_id 过滤。

### 1. `session_created`

```typescript
{
  session_id: string;
  user_id: string;
  timestamp: number;
}
```

### 2. `session_updated`

```typescript
{
  session_id: string;
  user_id: string;
  timestamp: number;
  source?: string;
  session_event?: {                // 可选：嵌入的 Chat 事件（跨 tab/IM 转发）
    event: string;
    data: any;
  };
}
```

---

## 四、前端 SSE 客户端规范

### 库选择

使用 `@microsoft/fetch-event-source`（非原生 EventSource），支持 POST + 自定义 headers。

### 连接配置

```typescript
{
  method: "POST" | "GET",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${jwt_token}`
  },
  openWhenHidden: true,            // tab 隐藏时保持连接
  body: JSON.stringify(chatRequest) // 仅 POST
}
```

### 取消机制

返回 `AbortController.abort()` 函数，组件卸载时调用。

### 去重

维护 `Set<string>` 记录已处理的 `event_id`，静默丢弃重复事件。

### 重连协议

**不使用标准 Last-Event-ID / retry 机制**，采用自定义游标重连：

1. 前端记录最后收到的 `event_id`
2. 页面加载/导航时，`GET /sessions/{id}` 获取完整会话事件列表，本地回放
3. 若会话状态为 RUNNING/PENDING，调用 `chat('', [], true)` 传入最后 `event_id` 重连
4. 后端检测重连：从会话事件列表中回放游标之后的事件，然后接入实时队列
5. 过期检测：最后事件时间戳超过 15 分钟，前端调用 `stopSession()` 而非重连
6. 孤儿检测：后端无对应 Agent 任务时，立即发送 `done(interrupted=true)`

### 超时

- 前端：10 分钟无事件 → 强制关闭连接
- 后端：600 秒 `asyncio.wait_for` 队列超时 → SSE 生成器退出
- 后端队列哨兵：`None` 推入队列 → 生成器退出

### 错误处理

| 场景 | 处理 |
|------|------|
| 401 | 触发 `refreshAuthToken()`，1 秒后重试 |
| Token 刷新 | 队列化防止并发刷新 |
| onerror | 记录日志 → 调用 onError 回调 → throw 阻止自动重试 |
| 组件卸载 | `_unmounted = true`，所有异步回调检查此标志 |
| 通知流断开 | 3 秒后自动重连（error 时 5 秒） |
| 后端慢消费者 | 队列满（256）时丢弃 |

---

## 五、Pipeline SSE 特殊处理

Pipeline 模式使用 `GET` + `Last-Event-ID` 标准重连：

```
GET /api/v1/cases/{id}/events
Headers:
  Authorization: Bearer <jwt>
  Last-Event-ID: <last_id>         // 可选，断线重连
```

- 心跳：每 15 秒发送 `:heartbeat\n\n`
- Redis Stream 持久化：事件写入 `case:{id}:events` Stream，支持 `Last-Event-ID` 回放
- 超时：300 秒无新事件 → 关闭连接
