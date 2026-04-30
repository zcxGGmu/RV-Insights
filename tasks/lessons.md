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

### 2026-04-28 | 后端

**教训**：本机 Python 3.9 不支持 `X | None` 类型注解语法和 `enum.StrEnum`，ruff auto-fix 会将 `Optional[X]` 转为 `X | None` 导致运行时 TypeError

**原因**：`X | None` 语法需要 Python 3.10+，`StrEnum` 需要 Python 3.11+。`from __future__ import annotations` 只延迟类型求值，但 Pydantic 在运行时仍需解析类型

**如何避免**：ruff check 时不要使用 `--fix` 自动修复 UP042/UP045 规则；Pydantic 模型中坚持使用 `Optional[X]` 和 `str, Enum` 基类

### 2026-04-28 | 前端依赖

**教训**：reka-ui 引用了 `@internationalized/date` 的 `DayOfWeek` 类型，但新版 `@internationalized/date` 已移除该类型，导致 vue-tsc 报错

**原因**：reka-ui 的 peer dependency 版本范围过宽，未锁定 `@internationalized/date` 的兼容版本

**如何避免**：遇到第三方库上游类型 bug 时，在 `tsconfig.json` 中添加 `"skipLibCheck": true` 作为 workaround；同时在 tech debt 中记录，等上游修复后移除

### 2026-04-28 | Git

**教训**：根目录 `.gitignore` 中的 `lib/` 规则会匹配所有层级的 `lib/` 目录，包括 `web-console/src/lib/`

**原因**：gitignore 的模式匹配是递归的，`lib/` 等同于 `**/lib/`

**如何避免**：当需要在被忽略模式下保留特定子路径时，使用 `!web-console/src/lib/` 否定规则；新增 `lib/` 类通用目录时先检查是否影响嵌套路径

### 2026-04-28 | 迁移策略

**教训**：ScienceClaw 的大型组件（ChatPage 1300 行、ChatMessage 866 行）不应 1:1 复制，而应拆分为小组件 + utility 函数

**原因**：大文件违反 400 行软限制，且包含大量 sandbox/VNC 等 RV-Insights 不需要的逻辑

**如何避免**：迁移前先分析源文件结构，识别可提取为 utility 的逻辑（如 markdown 渲染）、可内联的简单逻辑（如 SSE 处理 <300 行时）、需要删除的无关功能（sandbox）。目标是每个文件 200-400 行

### 2026-04-28 | 前端架构

**教训**：ScienceClaw 使用 composable 单例模式管理状态，但 RV-Insights 已有 Pinia store 基础（authStore/caseStore），混用两种模式会增加认知负担

**原因**：两种状态管理方式各有优劣，但在同一项目中应保持一致

**如何避免**：RV-Insights 统一使用 Pinia store 管理全局状态；composable 仅用于封装可复用的 UI 逻辑（如 useSessionGrouping）而非全局状态

### 2026-04-28 | 包管理

**教训**：项目使用 pnpm（有 pnpm-lock.yaml），但之前误用 npm 安装依赖会生成 package-lock.json 导致冲突

**原因**：未在开发初期检查 lockfile 类型来确定包管理器

**如何避免**：开发前检查项目根目录的 lockfile：`pnpm-lock.yaml` → pnpm，`package-lock.json` → npm，`yarn.lock` → yarn。RV-Insights web-console 使用 pnpm

---

## Sprint 4

### 2026-04-29 | 后端

**教训**：ruff `--fix` 自动修复会将 `Optional[X]` 转为 `X | None`，但 Python 3.9 不支持该语法。Sprint 4 新文件需要手动修复 ruff 报错而非用 `--fix`

**原因**：ruff UP045 规则默认启用，`--fix` 会自动应用不兼容当前 Python 版本的语法变更

**如何避免**：对 Sprint 4 新文件使用 `ruff check` 检查后手动修复，或在 `ruff.toml` 中禁用 UP045 规则

### 2026-04-29 | 前端

**教训**：Vue 模板中不能直接访问 `localStorage`，需要通过 `<script setup>` 中定义的函数间接调用

**原因**：Vue 模板的表达式上下文只包含组件实例上的属性和方法，不包含全局对象

**如何避免**：浏览器 API（localStorage, window, document）的调用封装为 script setup 中的函数

### 2026-04-29 | 前端

**教训**：lucide-vue-next 图标名称需要精确匹配，`LinkOff` 不存在应使用 `Link2Off`

**原因**：lucide 图标库的命名规则不完全直觉化，部分图标有数字后缀

**如何避免**：使用 lucide 图标前先在 `node_modules/lucide-vue-next` 中确认导出名称，或查阅 lucide.dev 官网

### 2026-04-29 | 架构

**教训**：LangGraph `create_react_agent` + `astream_events(version="v2")` 是集成工具调用的最简路径，自动处理 tool-calling loop

**原因**：手动实现 tool-calling loop 需要处理多轮 LLM 调用、工具执行、结果回传，代码量大且容易出错

**如何避免**：优先使用 LangGraph 的高级 API 而非手写循环；`astream_events` v2 提供细粒度事件（on_chat_model_stream, on_tool_start, on_tool_end）

---

## Sprint 5

### 2026-04-30 | 架构

**教训**：设计文档建议 Claude Agent SDK（子进程模型）+ OpenAI Agents SDK（库模型），但实际采用 LangGraph create_react_agent 统一方案更优

**原因**：Claude/OpenAI SDK 各有独立的事件模型和 API 风格，集成两套 SDK 会增加维护成本；而 LangGraph create_react_agent + astream_events 已在 ChatRunner 中验证过，可复用事件映射和成本追踪逻辑

**如何避免**：评估新 SDK 时，先检查现有基础设施是否已能满足需求；跨 SDK 统一适配层的复杂度往往超过预期

### 2026-04-30 | Pipeline

**教训**：PipelineState 缺少输入字段（input_context/target_repo/contribution_type），start_pipeline 也未传递 Case 的输入信息给 LangGraph state，导致 Agent 节点无法获取任务上下文

**原因**：Sprint 2 只实现了 Pipeline 骨架（stub 节点），stub 不需要真实输入；Sprint 5 替换为真实 LLM 时才暴露这个缺口

**如何避免**：即使是 stub 实现，也应保留完整的数据流通路径（输入 → state → 节点），避免后续集成时发现数据断链

### 2026-04-30 | 后端

**教训**：ruff N818 要求异常类名以 Error 结尾（`CostLimitExceeded` → `CostLimitExceededError`），rename 需要同步更新所有导出和引用

**原因**：PEP 8 命名约定，ruff 默认启用 N818 规则

**如何避免**：新建异常类时直接以 `Error` 结尾命名；rename 时用 grep 确认所有引用点（尤其是 `__init__.py` 的 `__all__` 导出）

### 2026-04-30 | 联调

**教训**：`langchain-openai` 的 `ChatOpenAI` 在 `bind_tools()` 内部会重新初始化 OpenAI client，此时会检查 `OPENAI_API_KEY` 环境变量，即使构造时已通过 `api_key` 参数传入

**原因**：langchain-openai 1.2.1 的 `bind_tools` 创建新 LLM 实例时，底层 `openai.AsyncClient` 的初始化逻辑会 fallback 到环境变量

**如何避免**：在 `create_chat_model` 中，传入 `api_key` 时同时调用 `os.environ.setdefault("OPENAI_API_KEY", api_key)`，确保环境变量可用；不要在 `.env` 中设置 `OPENAI_API_KEY`（会被 pydantic-settings 拒绝为 extra field）

### 2026-04-30 | 联调

**教训**：第三方 API 代理（如 `claude.hanbbq.top`）通常不返回 `usage_metadata`，导致 token 计数为 0、成本追踪失效

**原因**：代理转发时可能剥离了 OpenAI 响应中的 `usage` 字段

**如何避免**：成本追踪不能完全依赖 `usage_metadata`；可考虑 tiktoken 本地估算作为 fallback，或在切换到原生 API 后自动恢复

---

## Sprint 6 教训

### 2026-04-30 | 安全

**教训**：Stub/fallback 函数绝不能返回 `approved=True`。`_stub_review_verdict()` 默认 auto-approve，导致 LLM 失败或 JSON 解析失败时补丁被自动通过——直接绕过了 Review 安全关卡

**原因**：编写 stub 时只考虑了 happy path（"先通过，后面再实现"），忽略了 fallback 是失败路径，应该保守（fail-closed）

**如何避免**：所有安全相关的 stub/fallback 必须 fail-closed（拒绝/报错），不能 fail-open（通过/忽略）。同理，`interrupt()` 的 fallback 也不能 auto-approve，应 raise RuntimeError

### 2026-04-30 | 安全

**教训**：Pipeline 节点的 `except` 块不能把 `str(exc)` 直接发到前端（SSE / state）。Python 异常消息经常包含连接 URL、部分 API key、内部主机名

**原因**：开发时习惯性地 `f"Failed: {exc!s}"` 做错误消息，忘记这些消息会经 SSE 推送到浏览器

**如何避免**：异常处理统一用 `safe_msg = "…generic message…"` 对外，`logger.error(..., error=str(exc), exc_info=True)` 留在服务端日志

### 2026-04-30 | 后端

**教训**：用 `re.sub(r"```(?:json)?\s*", "", text)` 全局替换 Markdown fence 会破坏 JSON 内部的 diff 内容（如果 diff 本身包含 \`\`\`）。应改用精确提取（先尝试 raw JSON，再匹配最外层 fence）

**原因**：LLM 输出的 JSON 中 `diff_content` 字段可能包含 Markdown 代码块标记，全局 regex 会把它们也删掉，导致 JSON 值被截断

**如何避免**：解析 LLM JSON 输出时，优先 `json.loads(text.strip())`；失败后用 `re.search(r"```json\n(.*)\n```$", text, re.DOTALL)` 匹配最外层 fence，不要全局替换

### 2026-04-30 | 测试

**教训**：`unittest.mock.patch("app.pipeline.nodes.develop.create_chat_model")` 对 deferred import（函数体内 `from ... import`）无效——因为 `patch` 查找模块级属性时目标不存在。应 patch 原始模块 `"app.services.model_factory.create_chat_model"`

**原因**：`patch` 的 `get_original()` 在 `__enter__` 时检查 target module 的 `__dict__`，deferred import 只在函数调用时才注入

**如何避免**：当被 mock 的函数是 deferred import 时，patch 到源模块（`app.services.model_factory.create_chat_model`），而非消费模块（`app.pipeline.nodes.develop.create_chat_model`）

### 2026-04-30 | 前端

**教训**：`defineAsyncComponent(() => import('./Heavy.vue'))` 必须提供 `loadingComponent` / `errorComponent` / `timeout`，否则 Monaco 等大块（~2MB）加载失败时用户看到空白无反馈

**原因**：网络慢/CDN 超时/广告拦截都可能导致 chunk 加载失败，默认无任何 UI 反馈

**如何避免**：所有 `defineAsyncComponent` 必须用对象形式，至少提供 `loadingComponent` 和 `errorComponent`
