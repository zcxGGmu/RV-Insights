# Chat 模式后端架构设计

> Sprint 3-4 核心参考文档。定义 Chat 模式的后端执行模型、数据模型、SSE 事件生成流程。
> Sprint 4 新增：工具集成（web_search/code_analysis）、多模型工厂、Memory 注入、Plan 追踪。
> 对标 ScienceClaw `deepagent/runner.py` + `route/sessions.py`，适配 RV-Insights 技术栈。

---

## 1. 整体执行模型

```
POST /api/v1/sessions/{id}/chat
  │
  ▼
[FastAPI endpoint]
  │  创建 asyncio.Queue
  │  spawn asyncio.Task → _chat_background_worker()
  │
  ├──▶ EventSourceResponse ◀── queue.get() ── SSE 推送到客户端
  │
  └──▶ _chat_background_worker()
         │  持久化用户消息 → session.events
         │  首条消息 → 异步生成标题（title 事件）
         │
         ▼
       ChatRunner.astream(session, query, attachments)
         │  构建历史消息 → 计算 token 预算
         │  注入 System Prompt + Memory
         │  调用 LLM astream()
         │
         ├── stream_mode="messages" → message_chunk / thinking 事件
         ├── stream_mode="updates"  → tool (calling/called) / plan / step 事件
         │
         ▼
       事件映射 → 持久化到 session.events → queue.put_nowait()
         │
         ▼
       完成：发送 done 事件（含 statistics）→ queue.put(None) 哨兵
```

### 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 执行模型 | asyncio.Task + Queue | 解耦 Agent 执行与 HTTP 连接，支持断线重连 |
| LLM 调用 | LangChain ChatModel.astream() | 统一 OpenAI/Anthropic/DeepSeek 接口 |
| Agent 框架 | LangGraph ReAct Agent | 内置工具调用循环、流式输出、中间件支持 |
| 事件持久化 | 内嵌在 session.events[] | 单文档查询，重连时直接回放 |
| 取消机制 | 协作式取消（session._is_cancelled 标志） | Agent 每次迭代检查，优雅退出 |

---

## 2. 数据模型（Pydantic）

### 2.1 ChatSession

```python
class SessionStatus(str, Enum):
    PENDING = "pending"       # 已创建，未开始对话
    RUNNING = "running"       # Agent 正在执行
    COMPLETED = "completed"   # 空闲，可接受新消息

class ChatSessionInDB(BaseModel):
    session_id: str           # shortuuid，主键
    user_id: str
    title: Optional[str] = None
    status: SessionStatus = SessionStatus.PENDING
    mode: str = "chat"
    model_config_id: Optional[str] = None
    events: list[ChatEvent] = []
    pinned: bool = False
    is_shared: bool = False
    latest_message: Optional[str] = None
    latest_message_at: Optional[float] = None  # unix timestamp
    unread_message_count: int = 0
    source: Optional[Literal["wechat", "lark"]] = None
    created_at: datetime
    updated_at: datetime
```

### 2.2 ChatEvent

所有事件统一存储为 `ChatEvent`，`type` 字段区分类型：

```python
class ChatEvent(BaseModel):
    event_id: str             # shortuuid
    timestamp: float          # unix seconds
    type: str                 # "message" | "message_chunk" | "tool" | "thinking" | ...
    data: dict[str, Any]      # 类型特定的载荷，结构见 sse-protocol.md
```

### 2.3 ChatMessage（逻辑视图，非独立集合）

消息从 `events[]` 中提取，不单独存储：

```python
class ChatMessage(BaseModel):
    """从 events 中重建的消息视图，用于历史构建"""
    event_id: str
    role: Literal["user", "assistant"]
    content: str
    attachments: list[str] = []
    tool_calls: list[ToolCallRecord] = []
    timestamp: float

class ToolCallRecord(BaseModel):
    tool_call_id: str
    name: str
    args: dict[str, Any]
    result: Optional[Any] = None
    duration_ms: Optional[int] = None
```

---

## 3. ChatRunner 生命周期

### 3.1 状态转换

```
PENDING ──(首次 POST /chat)──▶ RUNNING ──(done 事件)──▶ COMPLETED
                                  │                         │
                                  │◀──(再次 POST /chat)─────┘
                                  │
                              (POST /stop)
                                  │
                                  ▼
                              COMPLETED (interrupted=true)
```

### 3.2 核心类

```python
class ChatRunner:
    """单次对话执行器，每次 POST /chat 创建一个实例"""

    def __init__(
        self,
        session: ChatSessionInDB,
        model_config: ModelConfig,
        task_settings: TaskSettings,
        memory_content: Optional[str] = None,
    ): ...

    async def astream(
        self,
        query: str,
        attachments: list[str],
        language: str = "zh",
    ) -> AsyncGenerator[dict, None]:
        """
        执行流程：
        1. 构建历史消息（_build_history_messages）
        2. 注入 System Prompt（RISC-V 专家 + Memory）
        3. 创建 LangGraph ReAct Agent
        4. 调用 agent.astream()，双流模式
        5. yield 结构化事件 dict
        """
        ...

    def cancel(self) -> None:
        """协作式取消，设置标志位"""
        self._is_cancelled = True
```

### 3.3 执行超时

| 参数 | 默认值 | 来源 |
|------|--------|------|
| agent_stream_timeout | 10800s (3h) | TaskSettings |
| 单次 LLM 调用超时 | 120s | httpx 客户端 |
| SSE 队列读取超时 | 600s | 后端 asyncio.wait_for |
| 前端无事件超时 | 600s (10min) | 前端 SSE 客户端 |

---

## 4. LLM 调用模式

### 4.1 Model Factory

```python
class ModelFactory:
    """根据 ModelConfig 创建 LangChain ChatModel 实例"""

    @staticmethod
    def create(config: ModelConfig, task_settings: TaskSettings) -> BaseChatModel:
        """
        支持 provider:
        - "openai"     → ChatOpenAI (含 DeepSeek 等兼容 API)
        - "anthropic"  → ChatAnthropic
        根据 config.base_url / api_key / model_name 构建
        """
        ...
```

### 4.2 Agent 组装

```python
def create_chat_agent(
    model: BaseChatModel,
    tools: list[BaseTool],
    system_prompt: str,
) -> CompiledGraph:
    """
    使用 LangGraph create_react_agent() 创建 ReAct Agent。
    stream_mode=["messages", "updates"] 双流输出。
    """
    ...
```

### 4.3 双流处理

| 流模式 | 产出 | 映射到 SSE 事件 |
|--------|------|-----------------|
| `messages` | 逐 token AIMessage chunk | `message_chunk` |
| `messages` | reasoning_content chunk | `thinking` |
| `updates` | AIMessage with tool_calls | `tool` (status=calling) |
| `updates` | ToolMessage (tool result) | `tool` (status=called) |
| `updates` | 最终 AIMessage | `message_chunk_done` |

---

## 5. 工具执行模型

### 5.1 工具注册

Chat 模式可用工具分三类：

| 类别 | 工具 | 执行方式 | Sprint |
|------|------|----------|--------|
| 内置 | `web_search` | 异步 HTTP 调用 | S3 |
| 内置 | `code_analysis` | 本地代码分析 | S4 |
| 外部 | 用户自定义 Tools | 文件系统加载 | S8 |
| Skill | RISC-V 专用 Skills | 文件系统加载 | S8 |

### 5.2 执行流程

```
LangGraph ReAct Loop:
  1. LLM 决定调用工具 → AIMessage(tool_calls=[...])
  2. 发送 tool 事件 (status="calling", name, args)
  3. LangGraph 自动执行工具函数（同步，在 asyncio executor 中）
  4. 工具返回 ToolMessage
  5. 发送 tool 事件 (status="called", content, duration_ms)
  6. LLM 继续推理或结束
```

### 5.3 工具结果截断

大型工具结果需要截断以避免 token 爆炸：

| 场景 | 阈值 | 处理 |
|------|------|------|
| 工具返回值 | > 3000 chars | 写入文件，返回摘要 + 文件路径 |
| 历史中的工具结果 | > 2000 chars | 截断 + "...[truncated]" |
| 历史中的工具参数 | > 500 chars | 截断 |

---

## 6. 会话上下文管理

### 6.1 历史消息构建

从 `session.events[]` 重建 LangChain 消息列表：

```python
def _build_history_messages(
    events: list[ChatEvent],
    max_rounds: int,          # TaskSettings.max_history_rounds, default 10
    token_budget: int,        # 动态计算
) -> list[BaseMessage]:
    """
    三层截断保护：
    1. 单消息截断：assistant 3000 chars, tool result 2000 chars, tool args 500 chars
    2. 轮次限制：保留最近 N 轮（1 轮 = 1 user + 1 assistant 完整交互）
    3. Token 预算：从最旧轮次开始移除，直到总 token 数 < budget
    """
    ...
```

### 6.2 动态 Token 预算

```
token_budget = context_window × 0.85
             - output_reserve        # TaskSettings, default 16384
             - system_prompt_tokens  # 估算
             - tools_schema_tokens   # 估算
             - current_query_tokens  # 估算
             
minimum = 8000 tokens
```

Token 估算：`len(text) / 1.5`（CJK + English 混合场景的经验值）。

### 6.3 Memory 注入

```python
system_prompt = RISC_V_EXPERT_SYSTEM_PROMPT

# 注入用户记忆（如有）
if memory_content:
    system_prompt += f"\n\n## 用户偏好\n{memory_content[:4000]}"
```

---

## 7. 断线重连

### 7.1 重连流程

```
客户端断线 → 页面恢复/导航
  │
  ▼
GET /sessions/{id}  →  获取完整 events[]，本地回放
  │
  ▼
检查 session.status
  ├── COMPLETED → 回放完毕，不重连
  └── RUNNING   → POST /chat(message="", event_id=last_event_id)
                     │
                     ▼
                  后端检测 event_id 参数
                     ├── 有活跃 background task → 回放 cursor 之后的事件，接入实时队列
                     └── 无活跃 task（孤儿）→ 发送 done(interrupted=true)
```

### 7.2 孤儿会话恢复

| 场景 | 检测方式 | 处理 |
|------|----------|------|
| 后端重启 | startup 事件 | 批量标记 RUNNING → COMPLETED |
| 后端 OOM/crash | 重连时无活跃 task | 发送 done(interrupted=true) |
| 前端超时 | 15 分钟无事件 | 前端调用 POST /stop |

---

## 8. 成本追踪

### 8.1 Token 统计

每次 Agent 执行结束时，从 LLM 响应中提取 token 用量：

```python
# 提取优先级（兼容多 provider）：
# 1. msg.usage_metadata (LangChain 标准)
# 2. msg.response_metadata.token_usage (OpenAI)
# 3. msg.response_metadata.usage
# 4. msg.additional_kwargs.usage
```

### 8.2 Statistics 事件

```python
{
    "event": "statistics",
    "data": {
        "total_duration_ms": int,
        "tool_call_count": int,
        "input_tokens": int,
        "output_tokens": int,
        "token_count": int,       # input + output
    }
}
```

嵌入在 `done` 事件的 `statistics` 字段中，同时作为独立 `statistics` 事件发送。

### 8.3 持久化

统计数据持久化到 `session.events[]` 中的 `done` 事件，供 Statistics API 聚合查询。

---

## 9. 并发控制

| 约束 | 实现 |
|------|------|
| 同一 session 不允许并发执行 | 检查 session.status == RUNNING 时拒绝新请求 |
| 全局并发 Agent 数 | asyncio.Semaphore（可配置，默认 10） |
| 队列满保护 | queue.maxsize=256，满时丢弃旧事件 |

---

## 10. RISC-V 专家 System Prompt 规范

> 此节定义 Chat 模式 System Prompt 的内容方向和约束，实际 Prompt 文本在 `prompts/chat_system.py` 中实现。

### 10.1 角色定位

```
你是 RV-Insights，一个专注于 RISC-V 开源软件生态的 AI 技术专家。
你的职责是帮助开发者理解、分析和贡献 RISC-V 相关的开源项目。
```

- 定位：RISC-V 内核/工具链贡献专家，不是通用编程助手
- 拒绝范围外请求时，引导用户到正确的工具（如通用编程问 ChatGPT）
- 语言：跟随用户语言（中文问中文答，英文问英文答）

### 10.2 知识边界

| 领域 | 覆盖范围 | 深度 |
|------|----------|------|
| RISC-V ISA | RV32/64/128, 已批准扩展 (Ratified), 草案扩展 (Draft) | 深 — 能解释指令编码、CSR 布局 |
| Linux 内核 | `arch/riscv/` 子系统、设备树、KConfig | 深 — 能分析补丁、解释子系统交互 |
| QEMU | `target/riscv/` 模拟实现 | 中 — 能定位代码、解释执行流程 |
| GCC/LLVM | RISC-V 后端、内建函数、向量化 | 中 — 能解释编译选项、ABI |
| OpenSBI | 固件接口、SBI 调用规范 | 中 |
| 社区流程 | 邮件列表礼仪、补丁提交规范、maintainer 树 | 深 — 能指导完整贡献流程 |

### 10.3 可用工具

Chat 模式 Agent 可调用的工具（按 Sprint 逐步启用）：

| 工具 | 功能 | Sprint |
|------|------|--------|
| `web_search` | 搜索 RISC-V 规范、邮件列表、GitHub issues | S3 |
| `code_analysis` | 分析代码片段、解释函数逻辑 | S4 |
| 用户自定义 Tools | 通过 Tools 页面管理 | S8 |
| RISC-V Skills | 预置的 RISC-V 专用技能（ISA 查询、补丁格式化等） | S8 |

### 10.4 对话风格约束

- 技术深度：默认面向有经验的内核/工具链开发者，不解释基础概念（除非用户明确要求）
- 证据优先：引用具体代码路径、commit hash、邮件链接，不做无根据的断言
- 补丁规范：涉及代码建议时，遵循 Linux 内核编码风格（`Documentation/process/coding-style.rst`）
- 保守建议：对不确定的技术问题，明确标注不确定性，建议用户验证
- 不自动提交：任何涉及 git send-email / PR 的操作，只生成命令，不执行

### 10.5 Prompt 结构模板

```python
RISC_V_EXPERT_SYSTEM_PROMPT = """
# 角色
{角色定位}

# 知识范围
{知识边界描述}

# 行为准则
- 引用代码时给出文件路径和行号
- 建议补丁时遵循 Linux 内核编码风格
- 不确定时明确说明，不编造
- 跟随用户语言

# 可用工具
{工具描述，由 Agent 框架自动注入}

# 用户偏好
{从 Memory API 注入，可选}
"""
```

---

## 11. 文件结构

```
backend/app/
├── api/chat.py                    # SSE 端点 + Session CRUD
├── services/chat_runner.py        # ChatRunner 核心执行器
├── services/model_factory.py      # LLM 模型工厂
├── models/chat_schemas.py         # Pydantic 模型
├── prompts/chat_system.py         # RISC-V 专家 System Prompt
└── tools/                         # Chat 模式工具
    ├── web_search.py
    └── code_analysis.py
```
