# 2026-05-08 全栈优化评审：进度同步版

## 1. 目的

本文档用于跟踪 RV-Insights 全栈优化项的**当前开发状态**，目标是：
- 明确哪些已经完成、哪些只做了一半、哪些还未开始
- 作为下次启动时的继续开发入口
- 避免重复处理已经落地的问题

---

## 2. 当前基线

- 分支：`base/pipeline-v0`
- 最新已纳入提交的功能提交：`76004751`
- 最新文档基线同步提交：当前 `docs(improve)` 提交（以 `git log --oneline -1` 为准）
- 当前已提交 Electron 包版本：`@rv-insights/electron@0.0.37`
- 同步日期：`2026-05-09`

说明：
- 本文档只记录功能 / 工程项状态
- 每完成一个阶段，先更新本文档，再继续下一阶段
- 当前已知未跟踪文件：`.DS_Store`，不要纳入提交

### 最新功能提交状态

第七阶段 C session-not-found 恢复纯函数边界已通过独立提交落地：

- `42cceeda` `refactor(agent): 拆分 SDK 消息持久化边界`
- `efa806e3` `docs(improve): 同步 SDK 消息持久化提交基线`
- `45a7ad62` `refactor(agent): 拆分上下文回填边界`
- `e4d43c72` `refactor(agent): 拆分错误消息构造边界`
- `76004751` `refactor(agent): 拆分会话恢复边界`

当前总览：
- 已完成：凭证竞态、secret 暴露收口、标题敏感日志清理、AgentView 会话级订阅收敛、Provider 超时、全局搜索流式化、`ipc.ts` 高耦合 handlers 拆分、`agent-orchestrator.ts` 会话恢复在内的已落地子边界拆分。
- 部分完成：`safeStorage` 降级告警可视化、`ipc.ts` 基础/工具类 handlers 拆分、`agent-orchestrator.ts` 渐进拆分。
- 未完成：`agent-orchestrator.ts` queueMessage 构造与完成信号后续拆分评估，`feishu-bridge.ts` 拆分、Chat 自动重试、索引缓存、IPC 输入验证、质量 CI、Lint / Format、版本递增校验、测试基线补强、JSONL 轮转、搜索体验统一、恢复策略统一。

当前第七阶段状态：
- 已完成主执行循环剩余职责评估，并将可拆边界写入 `tasks/todo.md`。
- 7A 已新增 `context-rehydration.ts`，抽离 `extractSDKToolSummary()` 与基于 SDKMessage[] 构建 context prompt 的纯函数。
- `agent-orchestrator.ts` 中 `buildContextPrompt()` 已保留为薄包装，只负责读取 `getAgentSessionSDKMessages()`、注入配置目录名、日志与返回 prompt。
- 7B 已新增 `agent-error-message.ts`，抽离 TypedError、catch 普通错误 / prompt_too_long、retry exhausted 的 SDK assistant error message 构造纯函数。
- `agent-orchestrator.ts` 中 preflight、assistant TypedError、catch 错误、retry exhausted 分支只替换对象构造，append / callbacks / retry_failed 事件顺序未移动。
- 7C 已新增 `session-recovery.ts`，抽离 session-not-found 判定与恢复 patch 纯函数。
- `agent-orchestrator.ts` 中 session-not-found 分支只替换无副作用判定 / patch 构造；`updateAgentSessionMeta()`、`persistSDKMessages()`、accumulator 清理和 retry `break/continue` 仍在原位置。
- 未移动 Teams、重试、IPC、权限分派、SDK 消息持久化调用时机、queueMessage 持久化语义或完成信号。

当前不要纳入提交：
- `.DS_Store`

已完成验证：
- `bun test apps/electron/src/main/lib/agent-orchestrator/session-recovery.test.ts apps/electron/src/main/lib/agent-orchestrator/agent-error-message.test.ts apps/electron/src/main/lib/agent-orchestrator/context-rehydration.test.ts`：16 pass / 0 fail / 36 expect
- `bun run --filter='@rv-insights/electron' typecheck`：通过
- `bun run --filter='@rv-insights/electron' build:main`：通过
- `git diff --check`：通过

### 下次启动快速接力

1. 先复核 `tasks/lessons.md`、`tasks/todo.md` 和本文档，确认第七阶段 C 会话恢复边界提交已在当前分支。
2. 继续第七阶段 D：`queueMessage()` 消息构造纯函数边界。
3. 本阶段只抽排队消息 SDK input / 持久化消息构造；`interrupt`、`adapter.sendQueuedMessage()`、`appendSDKMessages()` 的顺序保持不变，继续维持“adapter 注入成功后才 append 用户消息”的现有语义。
4. 继续保持不移动 Teams、重试、IPC、权限分派、SDK 消息持久化调用时机、queueMessage 持久化语义或完成信号。
5. 每完成独立阶段仍需执行：
   `bun run --filter='@rv-insights/electron' typecheck`、
   `bun run --filter='@rv-insights/electron' build:main`、
   `git diff --check`，
   并递增 `apps/electron/package.json` patch 版本、更新本文档、创建独立提交。

---

## 3. 最近已完成进展

| 提交 | 主题 | 状态 | 结果 |
|------|------|------|------|
| `617182e0` | 凭证竞态与旧调试代码清理 | 已完成 | `process.env` 凭证竞态修复，旧调试残留清理 |
| `bc0813bb` | Agent 会话级订阅与刷新控制 | 已完成 | `AgentView` 会话级订阅收敛，`useGlobalAgentListeners` 高频刷新收口 |
| `0966f8f0` | 标题日志与 secret 暴露收口 | 已完成 | 渲染层明文 secret 回填移除，标题生成敏感日志清理 |
| `65b55efe` | Provider 请求层统一超时 | 已完成 | `streamSSE()` / `fetchTitle()` 已统一接入绝对超时 |
| `ed922257` | 全局消息搜索流式化 | 已完成 | Chat / Agent 搜索改为逐行流式扫描，去掉整文件同步扫描热点 |
| `85c92dec` | `safeStorage` 降级告警可视化 | 部分完成 | 已有用户可见告警和“未加密”标记，但还没有替代加密方案 |
| `b8b83dc3` | `ipc.ts` 拆分第一阶段（channel） | 部分完成 | 已新增 `ipc/channel-handlers.ts` 并迁移 `CHANNEL_IPC_CHANNELS` 注册，`ipc.ts` 先完成首个高频模块收口 |
| `0efb2156` | `ipc.ts` 拆分第二阶段（settings） | 部分完成 | 已新增 `ipc/settings-handlers.ts` 并迁移 `USER_PROFILE` / `SETTINGS` / `APP_ICON` 注册，`ipc.ts` settings 逻辑已独立收口 |
| `e5e9abbb` | `ipc.ts` 拆分第三阶段（agent） | 部分完成 | 已新增 `ipc/agent-handlers.ts` 并迁移 `AGENT_IPC_CHANNELS` 注册，`ipc.ts` 中 agent 逻辑已独立收口 |
| `04d0de59` | 文档基线同步 | 已完成 | 已将第三阶段提交状态同步进优化文档，作为第四阶段开发前基线 |
| `953ce3c6` | `ipc.ts` 拆分第四阶段 A（pipeline） | 部分完成 | 已新增 `ipc/pipeline-handlers.ts` 并迁移 `PIPELINE_IPC_CHANNELS` 注册，机器人相关 handlers 仍留在 `ipc.ts` |
| `37460087` | `ipc.ts` 拆分第四阶段 B（机器人） | 部分完成 | 已新增 `ipc/bot-hub-handlers.ts` 与 `ipc/quick-task-handlers.ts`，迁移 Feishu / DingTalk / WeChat / QuickTask 注册逻辑 |
| `78597ccc` | `agent-orchestrator.ts` 渐进拆分第一阶段 | 部分完成 | 已新增 `agent-orchestrator/sdk-environment.ts`，迁移 SDK env 构建与 CLI 路径解析，并补最小测试 |
| `addd254f` | `agent-orchestrator.ts` 渐进拆分第二阶段 | 部分完成 | 已新增 `agent-orchestrator/retryable-error-classifier.ts`，迁移自动重试错误分类，并补纯函数测试 |
| `5919394e` | `agent-orchestrator.ts` 渐进拆分第三阶段 | 部分完成 | 已新增 `agent-orchestrator/teams-coordinator.ts`，抽离 Teams 状态追踪、Watchdog idle 判断与 resume prompt 构建 |
| `089fc890` | `agent-orchestrator.ts` 渐进拆分第四阶段 | 部分完成 | `TeamsCoordinator` 已接管二次 resume query 的 options 构造、SDK message 遍历、replay 过滤与可持久化消息收集 |
| `37aaacaa` | 文档基线同步 | 已完成 | 已将最新优化进度同步进本文档，作为第五阶段开发前基线 |
| `2bca24d1` | `agent-orchestrator.ts` 渐进拆分第五阶段 | 部分完成 | 已新增 `PermissionToolDispatcher`，抽离 canUseTool 权限分派边界，并收紧 Plan Bash / MCP / Markdown 写入边界 |
| `7ac26084` | 文档基线同步 | 已完成 | 已将 PermissionToolDispatcher 提交号和下一阶段入口同步进本文档 |
| `ef055d64` | 文档基线同步 | 已完成 | 已将 SDK 消息持久化边界接力状态同步进本文档 |
| `42cceeda` | `agent-orchestrator.ts` 渐进拆分第六阶段 | 部分完成 | 已新增 `sdk-message-persistence.ts`，抽离 SDK message 筛选、累积准备、时间戳 / duration metadata 纯函数边界 |
| `45a7ad62` | `agent-orchestrator.ts` 渐进拆分第七阶段 A | 部分完成 | 已新增 `context-rehydration.ts`，抽离上下文回填 prompt 构造与工具摘要纯函数边界 |
| `e4d43c72` | `agent-orchestrator.ts` 渐进拆分第七阶段 B | 部分完成 | 已新增 `agent-error-message.ts`，抽离错误 SDKMessage 构造纯函数边界 |
| `76004751` | `agent-orchestrator.ts` 渐进拆分第七阶段 C | 部分完成 | 已新增 `session-recovery.ts`，抽离 session-not-found 判定与恢复 patch 纯函数边界 |

---

## 4. 进度看板

### P1 结构与边界

- [x] `process.env` 凭证竞态修复
  现状：已完成。

- [x] 解密后凭证不再回传渲染层
  现状：已完成。
  结果：
  Channel / Feishu / DingTalk 的解密后 secret 直出接口已移除，设置页不再回显明文。

- [x] 标题生成链路敏感日志清理
  现状：已完成。
  结果：
  请求体、响应体、用户片段和标题结果日志已删除。

- [x] `AgentView` 会话级订阅优化
  现状：已完成。
  结果：
  当前 `AgentView` 已不再是订阅放大热点。

- [~] `ipc.ts` 巨型注册函数拆分
  现状：部分完成（第四阶段 B 已完成，关键高耦合模块已抽离）。
  已完成：
  `channel` handlers 已抽离到 `apps/electron/src/main/ipc/channel-handlers.ts`，`registerIpcHandlers()` 改为调用 `registerChannelIpcHandlers()`。
  `settings` handlers 已抽离到 `apps/electron/src/main/ipc/settings-handlers.ts`，`registerIpcHandlers()` 改为调用 `registerSettingsIpcHandlers()`。
  `agent` handlers 已抽离到 `apps/electron/src/main/ipc/agent-handlers.ts`，`registerIpcHandlers()` 改为调用 `registerAgentIpcHandlers()`。
  `pipeline` handlers 已抽离到 `apps/electron/src/main/ipc/pipeline-handlers.ts`，`registerIpcHandlers()` 改为调用 `registerPipelineIpcHandlers()`。
  Feishu / DingTalk / WeChat handlers 已抽离到 `apps/electron/src/main/ipc/bot-hub-handlers.ts`，`registerIpcHandlers()` 改为调用 `registerBotHubIpcHandlers()`。
  QuickTask handlers 已抽离到 `apps/electron/src/main/ipc/quick-task-handlers.ts`，`registerIpcHandlers()` 改为调用 `registerQuickTaskIpcHandlers()`。
  未完成：
  `chat`、`environment`、`installer`、`proxy`、`memory`、`chat tool`、`system prompt`、`github release` 等基础/工具类 handlers 仍在 `ipc.ts`，是否继续拆分可作为后续独立阶段评估。
  关键文件：
  `apps/electron/src/main/ipc.ts`
  建议：
  本轮先停止在第四阶段 B，转入下一个 P1 高收益目标前保持最小影响面。

- [~] `agent-orchestrator.ts` 渐进拆分
  现状：部分完成（第七阶段 C session-not-found 恢复纯函数边界已完成；下一阶段建议抽 `queueMessage()` 消息构造纯函数）。
  已完成：
  SDK 环境变量构建与 CLI binary 路径解析已抽离到 `apps/electron/src/main/lib/agent-orchestrator/sdk-environment.ts`。
  已补充最小测试覆盖普通 Provider、Kimi Coding、代理、Windows Shell 与 CLI fallback 路径。
  自动重试错误分类已抽离到 `apps/electron/src/main/lib/agent-orchestrator/retryable-error-classifier.ts`。
  已补充最小测试覆盖 retryable / non-retryable TypedError code、HTTP 429 / 5xx / 4xx、`context_management` 与瞬时网络错误。
  Agent Teams 状态追踪、Watchdog idle 判断与 resume prompt 构建已抽离到 `apps/electron/src/main/lib/agent-orchestrator/teams-coordinator.ts`。
  Agent Teams 二次 resume query 的 options 构造、SDK message 遍历、replay 过滤与可持久化消息收集已抽离到 `TeamsCoordinator.runResumeQuery()`。
  `canUseTool` 权限分派已抽离到 `apps/electron/src/main/lib/agent-orchestrator/permission-tool-dispatcher.ts`，覆盖共享前置守卫、plan / auto / bypassPermissions / AskUser / ExitPlan 分派。
  Plan 模式 Bash 策略已从 blocklist 改为明确只读 allowlist，拒绝 CR/LF、quote、backslash、glob / brace expansion、`$` 变量展开、管道、命令串联、命令替换、普通重定向、解释器执行、下载写文件和危险 git / rg / find 参数等高风险写操作。
  Plan 模式 Git Bash 只保留 `git status`、`git rev-parse`、`git ls-files`；`git diff/log/show/grep` 暂不在 Plan Bash allowlist 中，避免 external diff / textconv / pager 风险。
  Plan 模式不再无条件放行 `mcp__*` 工具，仅保留显式 allowlist 中的 MCP 资源读取工具。
  Plan 模式 `Write/Edit` Markdown 写入范围已限制到当前 Agent cwd 的 `.context` 目录下，并增加 raw `..`、首尾空白 / 换行、realpath、symlink、broken symlink、hardlink 逃逸校验。
  `EnterPlanMode` 会同步切入 `plan` 权限策略；运行中动态切换到 `plan` 时会同步 `PermissionToolDispatcher` 的 plan 状态，确保后续普通工具和 `ExitPlanMode` 都走正确策略。
  `stopAll()` 会同步清理新增的 `sessionPermissionDispatchers`，避免应用退出 / 全量中止后残留 stale dispatcher 引用。
  SDK 消息持久化纯函数边界已抽离到 `apps/electron/src/main/lib/agent-orchestrator/sdk-message-persistence.ts`。
  `persistSDKMessages()` 已保留在 `agent-orchestrator.ts` 中作为薄包装，继续在原有 result、正常结束、重试、session-not-found、用户中止和错误路径调用。
  已抽离 `shouldPersistSdkMessage()`、`shouldAccumulateSdkMessage()`、`prepareSdkMessageForAccumulation()`、`prepareSdkMessagesForPersistence()` 与 `withPersistenceMetadata()`，覆盖 replay 过滤、`user tool_result` 保留、SDK 内部 user 文本过滤、`compact_boundary` 保留、普通 system 过滤、result duration、已有 `_createdAt` 不覆盖、assistant `_channelModelId` 复制注入。
  上下文回填纯函数边界已抽离到 `apps/electron/src/main/lib/agent-orchestrator/context-rehydration.ts`。
  `buildContextPrompt()` 已保留在 `agent-orchestrator.ts` 中作为薄包装，继续在原位置读取 SDK JSONL、调用纯函数、记录日志并返回 prompt。
  已抽离 `extractSDKToolSummary()` 与 `buildContextPromptFromSDKMessages()`，覆盖空历史、排除最后一条当前用户消息、最近 20 条历史、user / assistant 文本筛选、assistant 工具摘要、session_info 注入和非文本消息跳过。
  错误 SDKMessage 构造纯函数边界已抽离到 `apps/electron/src/main/lib/agent-orchestrator/agent-error-message.ts`。
  preflight、assistant TypedError、catch 普通错误 / prompt_too_long、retry exhausted 分支仍在原位置调用 `appendSDKMessages()` 与 callbacks，只把对象字面量替换为纯函数返回值。
  已抽离 `formatTypedErrorContent()`、`createTypedErrorSDKMessage()`、`createCatchErrorSDKMessage()` 与 `createRetryExhaustedSDKMessage()`，覆盖 TypedError metadata、无标题文本格式、prompt_too_long 专用文案、普通 catch 错误和 retry exhausted 文案。
  session-not-found 恢复纯函数边界已抽离到 `apps/electron/src/main/lib/agent-orchestrator/session-recovery.ts`。
  `prepareSessionNotFoundRecovery()` 仍保留在 `agent-orchestrator.ts` 中作为副作用薄包装，继续在原位置清理 `sdkSessionId`、flush 累积消息、清理 accumulator 并返回 retry reason。
  已抽离 `isSessionNotFoundError()` 与 `createSessionNotFoundRecoveryPatch()`，覆盖 error message / stderr 识别、非 session-not-found 不误判、`resumeSessionId` 清空与上下文回填 prompt 写回。
  已补充最小测试覆盖 task 状态追踪、Watchdog idle 检查、inbox 优先、summary fallback、resume query replay 过滤、compact_boundary 持久化与会话失活停止。
  已补充权限分派测试覆盖 bypassPermissions 前置守卫、AskUser 不受模式影响、plan 模式允许/拒绝策略、ExitPlan approve / deny / 动态切换语义、auto 委托、Write 大内容保护、Bash allowlist 边界和 `.context` Markdown 路径边界。
  已补充 SDK 消息持久化测试覆盖 replay、`user tool_result`、SDK 内部 user 文本、`compact_boundary`、普通 system、result duration、已有 `_createdAt` 不覆盖和 assistant `_channelModelId` 不原地修改。
  已补充上下文回填测试覆盖空历史、排除当前用户消息、最多 20 条、文本筛选、工具摘要、session_info 和摘要长度上限。
  已补充错误消息构造测试覆盖 TypedError metadata / 文本格式、prompt_too_long 固定文案、普通 catch 错误和 retry exhausted。
  已补充会话恢复测试覆盖 error message / stderr 识别、非命中不误判和恢复 patch 语义。
  未完成：
  主执行循环中 queueMessage 持久化语义和完成信号等近执行链路仍在 `agent-orchestrator.ts`。
  第七阶段后续计划：
  先抽 `queueMessage()` 消息构造纯函数与测试，再评估完成信号测试切口。
  关键文件：
  `apps/electron/src/main/lib/agent-orchestrator.ts`
  `apps/electron/src/main/lib/agent-orchestrator/sdk-environment.ts`
  `apps/electron/src/main/lib/agent-orchestrator/retryable-error-classifier.ts`
  `apps/electron/src/main/lib/agent-orchestrator/teams-coordinator.ts`
  `apps/electron/src/main/lib/agent-orchestrator/permission-tool-dispatcher.ts`
  `apps/electron/src/main/lib/agent-orchestrator/sdk-message-persistence.ts`
  `apps/electron/src/main/lib/agent-orchestrator/context-rehydration.ts`
  `apps/electron/src/main/lib/agent-orchestrator/agent-error-message.ts`
  `apps/electron/src/main/lib/agent-orchestrator/session-recovery.ts`
  建议：
  下一阶段进入 `queueMessage()` 消息构造纯函数边界，继续保持 adapter 注入、持久化和错误回滚顺序不变。

- [ ] `feishu-bridge.ts` 拆分
  现状：未完成。
  关键文件：
  `apps/electron/src/main/lib/feishu-bridge.ts`
  建议：
  优先拆生命周期、消息路由、回复构建、绑定存储、通知策略。

### P2 性能与工程化

- [x] Provider 统一绝对超时
  现状：已完成。

- [x] 全局搜索同步全文扫描热点收敛
  现状：已完成第一阶段。
  说明：
  底层扫描已流式化，但倒排索引、搜索分页 UI、跨模式统一检索体验还没做。

- [ ] Chat 自动重试
  现状：未完成。
  关键文件：
  `apps/electron/src/main/lib/chat-service.ts`

- [ ] 索引缓存
  现状：未完成。
  前置条件：
  先去掉 `listChannels()` 这类读路径写副作用，再做缓存与防抖 flush。

- [ ] IPC 输入验证体系
  现状：未完成。
  建议：
  从高风险 handler 开始，而不是一次性覆盖整个 `ipc.ts`。

- [ ] 代码质量 CI
  现状：未完成。
  说明：
  仓库已有 Pages workflow，但还没有 typecheck/test/build/version gate 的 CI。

- [ ] Lint / Format 统一配置
  现状：未完成。

- [ ] 版本递增自动化校验
  现状：未完成。

- [ ] 测试基线补强
  现状：未完成。
  优先缺口：
  `agent-orchestrator.ts`、`chat-service.ts`、`channel-manager.ts`、IPC handlers。

### P2 / P3 安全与长期稳定性

- [~] `safeStorage` 降级告警
  现状：部分完成。
  已完成：
  用户可见 toast、内联告警、渠道“未加密”标记。
  未完成：
  Linux / 无 keyring 环境下的替代加密方案。

- [ ] JSONL 文件上限 / 轮转 / 分页读取
  现状：未完成。

- [ ] 搜索体验统一
  现状：未完成。
  说明：
  底层扫描已优化，但“跨模式一致检索模型”和“Agent 专属入口”还没做。

- [ ] 恢复策略统一
  现状：未完成。
  说明：
  Chat / Agent / Pipeline 的恢复语义仍未统一。

---

## 5. 下次继续开发入口

### 当前推荐的下一个阶段

`agent-orchestrator.ts` 渐进拆分第七阶段 D（queueMessage 消息构造纯函数）

原因：
- `agent-orchestrator.ts` 已抽离 SDK 环境准备、重试错误分类、Teams 状态 / prompt / resume query 执行边界、PermissionToolDispatcher 权限分派边界、SDK 消息持久化、上下文回填、错误消息构造和 session-not-found 恢复纯函数边界
- `queueMessage()` 仍同时构造 SDK queued message input、调用 adapter 注入、构造本地持久化用户消息、append JSONL 与失败时删除防重 uuid
- 下一阶段应只抽 SDK input / 持久化消息构造纯函数，不移动 `interrupt()`、`adapter.sendQueuedMessage()`、`appendSDKMessages()` 顺序或失败回滚语义

### 建议切分顺序

1. 新增 `queued-message.test.ts`，覆盖 preset uuid 优先、自动生成 uuid、priority 固定 `now`、SDK input `session_id`、持久化消息 `_createdAt`
2. 抽 `createQueuedMessageInput()` 与 `createPersistedQueuedUserMessage()` 纯函数
3. 在 `agent-orchestrator.ts` 原 `queueMessage()` 中接入纯函数，adapter 注入成功后才 append 用户消息的语义保持不变

### 起点文件

- `apps/electron/src/main/lib/agent-orchestrator.ts`
- `apps/electron/src/main/lib/agent-orchestrator/session-recovery.ts`
- `apps/electron/src/main/lib/agent-orchestrator/agent-error-message.ts`
- `apps/electron/src/main/lib/agent-orchestrator/context-rehydration.ts`

### 下次启动提示词

```text
请先阅读并严格按最新进度继续开发，不要重复已完成项：

1. /Users/zq/Desktop/ai-projs/posp/RV-Insights/AGENTS.md
2. /Users/zq/Desktop/ai-projs/posp/RV-Insights/tasks/lessons.md
3. /Users/zq/Desktop/ai-projs/posp/RV-Insights/tasks/todo.md
4. /Users/zq/Desktop/ai-projs/posp/RV-Insights/improve/2026-05-08-full-stack-optimization-review.md

当前状态：
- 最新功能提交：76004751 refactor(agent): 拆分会话恢复边界
- 最新文档同步提交：以 `git log --oneline -1` 为准（本次 docs(improve) 同步提交）
- 当前 Electron 版本：@rv-insights/electron@0.0.37
- `.DS_Store` 仍可能是未跟踪文件，不要纳入提交

请继续第七阶段 D：`agent-orchestrator.ts` queueMessage 消息构造纯函数边界。

本阶段范围：
1. 只抽 `queueMessage()` 的 SDK input / 本地持久化消息构造纯函数，不迁移 adapter 注入、append 或失败回滚顺序。
2. 覆盖 preset uuid 优先、自动生成 uuid、priority 固定 `now`、SDK input `session_id`、持久化消息 `_createdAt`。
3. 不移动 Teams、重试、IPC、权限分派、SDK 消息持久化调用时机、session-not-found 恢复副作用或完成信号。
4. 继续保持小步提交：补测试、运行 `typecheck` / `build:main` / `git diff --check`，递增受影响包 patch 版本，更新优化文档并创建独立 commit。
```

---

## 6. 已完成 / 部分完成 / 未完成 汇总

### 已完成

- 凭证竞态修复
- 渲染层 secret 暴露收口
- 标题生成敏感日志清理
- `AgentView` 会话级订阅收敛
- `useGlobalAgentListeners` 刷新防抖
- Provider 统一绝对超时
- Chat / Agent 全局搜索流式化
- `ipc.ts` 高耦合 handlers 拆分：
  `channel`、`settings`、`agent`、`pipeline`、`bot-hub`、`quick-task`
- `agent-orchestrator.ts` 已完成的已提交子边界：
  `EnvironmentBuilder`、`RetryableErrorClassifier`、`TeamsCoordinator` 状态 / prompt 边界、`TeamsCoordinator.runResumeQuery()`、`PermissionToolDispatcher`、SDK 消息持久化纯函数边界、上下文回填纯函数边界、错误 SDKMessage 构造纯函数边界、session-not-found 恢复纯函数边界

### 部分完成

- `safeStorage` 降级告警可视化
  已有告警和标记，未有替代加密方案
- `ipc.ts` 拆分
  关键高耦合 handlers 已完成；`chat`、`environment`、`installer`、`proxy`、`memory`、`chat tool`、`system prompt`、`github release` 等基础/工具类 handlers 仍留在主文件，后续按收益单独评估
- `agent-orchestrator.ts` 渐进拆分
  已提交 SDK 环境、重试分类、Teams 状态 / prompt / resume query 执行边界、权限工具分派边界、SDK 消息持久化纯函数边界、上下文回填纯函数边界、错误 SDKMessage 构造纯函数边界、session-not-found 恢复纯函数边界；queueMessage 和完成信号仍待后续拆分评估

### 未完成

- `agent-orchestrator.ts` 后续阶段：queueMessage 构造、完成信号测试切口
- `feishu-bridge.ts` 拆分
- Chat 自动重试
- 索引缓存
- IPC 输入验证
- 代码质量 CI
- Lint / Format 统一配置
- 版本递增自动化校验
- 测试基线补强
- JSONL 文件上限 / 轮转
- 搜索体验统一
- 恢复策略统一

---

## 7. 文档维护规则

后续每完成一个阶段，请同步更新本文档：

1. 把已完成项从“未完成”移到“已完成/部分完成”
2. 在“最近已完成进展”中追加提交号和主题
3. 更新“当前推荐的下一个阶段”
4. 不要保留已经过期的行号、风险描述和优先级
