# 2026-05-08 全栈优化评审：进度同步版

## 1. 目的

本文档用于跟踪 RV-Insights 全栈优化项的**当前开发状态**，目标是：
- 明确哪些已经完成、哪些只做了一半、哪些还未开始
- 作为下次启动时的继续开发入口
- 避免重复处理已经落地的问题

---

## 2. 当前基线

- 分支：`base/pipeline-v0`
- 最新已纳入提交的功能提交：`b4717c7e`
- 最新文档同步状态：当前工作树已更新本文档；若创建提交，建议使用 `docs(improve): 同步 Codex Pipeline 真实运行验证状态`
- 当前工作树 Electron 包版本：`@rv-insights/electron@0.0.42`
- 同步日期：`2026-05-10`

说明：
- 本文档只记录功能 / 工程项状态
- 每完成一个阶段，先更新本文档，再继续下一阶段
- 当前已知无关工作树状态：`README.en.md` 已删除、`.DS_Store` 未跟踪；不要纳入本阶段提交，除非用户另行确认

### 当前开发游标

- 当前已完成到：Pipeline `developer` / `reviewer` Codex 两阶段节点执行接入、Codex 渠道 UI / `settings.json` 持久化硬化，以及 SDK / CLI 真实 smoke 与 macOS arm64 打包路径验证。
- 当前最新功能提交：`b4717c7e` `feat(pipeline): 接入 Codex 节点执行`。
- 当前文档同步状态：本文档已更新到 Codex Pipeline 渠道配置硬化后；提交后以最新 `docs(improve)` 提交为准。
- 当前 Electron 版本：`@rv-insights/electron@0.0.42`（工作树）。
- 当前开发运行状态：本次已用 `bun run dev` 启动 Electron 开发模式，Vite 为 `http://localhost:5173/`，Electron 进程 PID `76207`，日志在 `/tmp/rv-insights-dev.log`；下次重新开机或进程退出后需重新启动。
- 下次直接继续：优先收口提交；若继续硬化，建议只做 CLI 长任务 abort / 进程树清理测试，或评估是否需要持久化 Codex `thread_id` 并用 `resumeThread()` 续接。
- 下次第二优先级：如暂不继续 Pipeline Codex 硬化，再回到 `agent-orchestrator.ts` 完成信号薄包装 / 集中化评估；已有 orchestrator 级 mock adapter 行为测试，仍需保持完成回调、副作用和持久化顺序不变。
- 下次不要做：不要处理既有无关 `README.en.md` 删除或 `.DS_Store`；不要改变 Pipeline LangGraph 阶段顺序；不要把 `explorer` / `planner` / `tester` 迁到 Codex；不要移动 Teams、IPC、权限分派、SDK 消息持久化调用时机、session-not-found 恢复副作用、queueMessage 注入 / append 顺序或未覆盖的执行链路。

### 2026-05-10 状态复核（Codex Pipeline 接入后）

- 工作树：存在既有无关状态 `README.en.md` 删除和未跟踪 `.DS_Store`；不要纳入本阶段提交。
- 功能代码：Pipeline `developer` / `reviewer` 已完成 Codex CLI 与 Codex SDK 两阶段接入，当前默认走 `@openai/codex-sdk`，保留 `RV_PIPELINE_CODEX_BACKEND=cli` 强制 CLI 后端。
- 文档状态：本文档已重新标注当前开发游标、已完成 / 部分完成 / 未完成列表和下次启动提示词。
- 下一步优先级：先做 Pipeline Codex 接入硬化；完成后再回到 `agent-orchestrator.ts` 完成信号薄包装 / 集中化评估，或转向 `feishu-bridge.ts` 拆分、IPC 输入验证等独立阶段。

### 2026-05-10 状态复核（Codex 渠道配置硬化后）

- 工作树：仍存在既有无关状态 `README.en.md` 删除和未跟踪 `.DS_Store`；不要纳入本阶段提交。
- 功能代码：`pipelineCodexChannelId` 已接入 `settings.json`，设置页 `模型配置` 可选择 `本机 Codex auth / CODEX_API_KEY` 或启用的 OpenAI/custom 渠道。
- 路由边界：`developer` / `reviewer` 继续走 Codex，`explorer` / `planner` / `tester` 继续走 Claude；LangGraph 阶段顺序未改。
- 兼容边界：主进程优先读取 settings 中的 Codex 渠道；旧配置字段缺失时保留 `RV_PIPELINE_CODEX_CHANNEL_ID` fallback；`pipelineCodexChannelId: null` 表示显式使用本机 Codex auth / `CODEX_API_KEY`，不会回退旧 env。
- 校验边界：启动前 preflight 会拒绝不存在、禁用或非 OpenAI/custom 的 Pipeline Codex 渠道；runner 仍保留非 OpenAI/custom 和 disabled 渠道显式报错。
- 已做不触发模型调用的路径验证：当前平台 `@openai/codex-darwin-arm64` binary 存在、可执行，`--version` 返回 `codex-cli 0.130.0`；`electron-builder.yml` 仍包含 Codex SDK / CLI 主包和平台 binary 包。
- 代码审查：第一轮发现显式本机 auth 仍回退旧 env、disabled 渠道主进程未拒绝、编辑渠道后设置残留的问题；修复后复审通过。
- 未完成：真实 Codex 账号 / `CODEX_API_KEY` 模型调用验证、CLI fallback 实机运行验证、打包产物内 native binary 启动验证、Codex 会话隔离 / 长任务进程清理策略评估。

### 2026-05-10 状态复核（部署运行后）

- 本次已部署运行当前项目：`bun run dev` 启动成功，Vite 监听 `http://localhost:5173/`，Electron 进程为 PID `76207`，开发日志写入 `/tmp/rv-insights-dev.log`。
- 启动前发现本地 Electron 依赖产物不完整：`node_modules/.bun/electron@39.8.9/node_modules/electron/path.txt` 缺失，导致 `Electron failed to install correctly`。已在 `node_modules` 范围内重跑 Electron install，`bunx electron --version` 返回 `v39.8.9`。
- 启动日志显示运行时初始化、IPC 注册、更新 IPC 注册、系统托盘、工作区监听、快速任务窗口和全局快捷键均完成。
- 仍需注意：Electron console 中出现 `sandboxed_renderer.bundle.js` 与 DevTools Autofill 相关报错，当前不阻塞主进程启动；若后续做 UI 真实交互验证，应顺手确认渲染端是否有实际功能异常。
- 本次只记录部署状态，不改变业务代码，也不处理 `README.en.md` 删除和 `.DS_Store`。

### 2026-05-10 状态复核（真实运行与打包验证后）

- 工作树：仍存在既有无关状态 `README.en.md` 删除和未跟踪 `.DS_Store`；不要纳入本阶段提交。`apps/electron/out/` 是本阶段打包验证生成的本地产物，也不应纳入提交。
- 真实运行：已在临时工作区用本机 Codex auth 跑通 `CodexSdkPipelineNodeRunner` reviewer smoke，返回符合 schema 的结构化 JSON。
- CLI fallback：已用 `RV_PIPELINE_CODEX_BACKEND=cli` 跑通 `CodexCliPipelineNodeRunner` reviewer smoke，确认 `codex exec` 后端可用。
- 渠道注入：已通过 `settings.json` + mock Codex client 验证 OpenAI/custom 渠道会注入 `apiKey`、`baseUrl`、`model`；未使用真实 OpenAI/custom 密钥触发外部调用，避免泄露或消耗用户额度。
- 拒绝路径：missing / disabled / 非 OpenAI/custom Codex 渠道在 preflight 返回 settings 引导错误，runner 层也会在创建 Codex client 前拒绝。
- 打包路径：`CSC_IDENTITY_AUTO_DISCOVERY=false bun run --filter='@rv-insights/electron' dist:fast` 已成功生成 `apps/electron/out/RV-Insights-0.0.42-arm64.dmg`；包内 `@openai/codex-sdk`、`@openai/codex` 与 `@openai/codex-darwin-arm64` native binary 均存在，native binary 可执行且 `--version` 返回 `codex-cli 0.130.0`。
- 会话隔离：当前 SDK backend 每次 `runNode()` 新建 Codex thread，具备调用级隔离但不持久化 Codex `thread_id`；本阶段已额外过滤子进程环境中的宿主 `CODEX_THREAD_ID`，避免外层 Codex 会话 ID 泄入 Pipeline Codex 节点。
- 清理与恢复：CLI backend 具备 `AbortSignal` + session runner abort 基础清理，但未强制 kill 进程树；Pipeline 失败恢复仍是运行中节点失败落 `node_failed`，重启后的 running 会话落 `recovery_failed`，waiting_human 通过 checkpoint 恢复。
- Electron 版本：本阶段因代码硬化递增到 `@rv-insights/electron@0.0.42`，`bun.lock` 已同步。

### 最新功能提交状态

第七阶段 D queueMessage 消息构造纯函数边界、完成信号测试切口与 Pipeline Codex 节点执行接入已通过独立提交落地：

- `42cceeda` `refactor(agent): 拆分 SDK 消息持久化边界`
- `efa806e3` `docs(improve): 同步 SDK 消息持久化提交基线`
- `45a7ad62` `refactor(agent): 拆分上下文回填边界`
- `e4d43c72` `refactor(agent): 拆分错误消息构造边界`
- `76004751` `refactor(agent): 拆分会话恢复边界`
- `ea4d988b` `refactor(agent): 拆分队列消息构造边界`
- `bcef4e29` `test(agent): 锁定完成信号行为`
- `b4717c7e` `feat(pipeline): 接入 Codex 节点执行`

当前总览：
- 已完成：凭证竞态、secret 暴露收口、标题敏感日志清理、AgentView 会话级订阅收敛、Provider 超时、全局搜索流式化、`ipc.ts` 高耦合 handlers 拆分、`agent-orchestrator.ts` queueMessage 构造在内的已落地子边界拆分、完成信号 mock adapter 行为测试与重复完成信号修复、Pipeline `developer` / `reviewer` Codex SDK 默认后端与 CLI fallback 接入、Pipeline Codex 渠道 UI / 本地配置持久化、Codex SDK / CLI smoke、macOS arm64 打包产物 native binary 路径验证。
- 部分完成：`safeStorage` 降级告警可视化、`ipc.ts` 基础/工具类 handlers 拆分、`agent-orchestrator.ts` 渐进拆分、Codex 运行韧性硬化。
- 未完成：Codex 持久 `thread_id` 续接策略、CLI 长任务进程树清理测试，`agent-orchestrator.ts` 完成信号薄包装 / 集中化评估，`feishu-bridge.ts` 拆分、Chat 自动重试、索引缓存、IPC 输入验证、质量 CI、Lint / Format、版本递增校验、测试基线补强、JSONL 轮转、搜索体验统一、恢复策略统一。

当前 Pipeline Codex 接入状态：
- `developer` / `reviewer` 默认走 `CodexSdkPipelineNodeRunner`，内部调用 `@openai/codex-sdk`。
- 保留 `CodexCliPipelineNodeRunner`，可通过 `RV_PIPELINE_CODEX_BACKEND=cli` 强制使用 `codex exec --json --output-schema --output-last-message`。
- `RoutedPipelineNodeRunner` 负责分流：`developer` / `reviewer` 走 Codex，`explorer` / `planner` / `tester` 继续走 Claude Agent SDK 兼容链路；LangGraph 阶段顺序未改。
- `meta.channelId` 仍只代表 Claude 节点渠道；Codex 默认使用本机 Codex auth / `CODEX_API_KEY`。
- `settings.json` 中的 `pipelineCodexChannelId` 可指定 OpenAI/custom 渠道给 Codex；旧配置字段缺失时保留 `RV_PIPELINE_CODEX_CHANNEL_ID` 兼容 fallback；`null` 表示显式使用本机 Codex auth；非 OpenAI/custom 或 disabled 渠道会显式报错。
- Electron 依赖已加入 `@openai/codex-sdk@0.130.0` 和 `@openai/codex@0.130.0`；主进程 esbuild external 与 electron-builder files 已包含 Codex SDK / CLI 和平台 binary 包。
- 已完成验证：Pipeline / Codex / settings / preflight 相关测试 `64 pass / 0 fail`、Electron `typecheck`、`build:main`、`git diff --check`；SDK backend 本机 Codex auth smoke、CLI fallback smoke、OpenAI/custom 注入 mock smoke、非法渠道拒绝 smoke、`dist:fast` 打包与包内 native binary 可执行性验证。
- 仍可继续硬化：如需要跨节点 / 跨重启保留 Codex 对话上下文，可设计 Codex `thread_id` 持久化与 `resumeThread()` 续接；如需要更强停止保证，可补 CLI 长任务 abort / 进程树清理测试。

上一个 Agent 拆分阶段状态：
- 已完成主执行循环剩余职责评估，并将可拆边界写入 `tasks/todo.md`。
- 7A 已新增 `context-rehydration.ts`，抽离 `extractSDKToolSummary()` 与基于 SDKMessage[] 构建 context prompt 的纯函数。
- `agent-orchestrator.ts` 中 `buildContextPrompt()` 已保留为薄包装，只负责读取 `getAgentSessionSDKMessages()`、注入配置目录名、日志与返回 prompt。
- 7B 已新增 `agent-error-message.ts`，抽离 TypedError、catch 普通错误 / prompt_too_long、retry exhausted 的 SDK assistant error message 构造纯函数。
- `agent-orchestrator.ts` 中 preflight、assistant TypedError、catch 错误、retry exhausted 分支只替换对象构造，append / callbacks / retry_failed 事件顺序未移动。
- 7C 已新增 `session-recovery.ts`，抽离 session-not-found 判定与恢复 patch 纯函数。
- `agent-orchestrator.ts` 中 session-not-found 分支只替换无副作用判定 / patch 构造；`updateAgentSessionMeta()`、`persistSDKMessages()`、accumulator 清理和 retry `break/continue` 仍在原位置。
- 7D 已新增 `queued-message.ts`，抽离 `queueMessage()` 的 SDK input 与本地持久化消息构造纯函数。
- `agent-orchestrator.ts` 中 `queueMessage()` 只替换对象构造；`interrupt`、`adapter.sendQueuedMessage()`、`appendSDKMessages()`、adapter 失败删除 uuid 的顺序未移动。
- 已补回归测试覆盖空字符串 `presetUuid` 仍按旧语义回退自动生成 uuid。
- 已新增 `completion-signal.test.ts`，用 mock adapter + 临时配置目录锁定完成信号分支。
- 覆盖完成信号：并发拒绝、preflight channel_not_found、正常 result、assistant TypedError 不可重试、assistant 可重试 TypedError 耗尽、用户中止、catch 不可重试错误、catch 可重试错误耗尽、session-not-found retry 不提前 complete。
- 已修复 catch 不可重试错误完成后继续 retry loop、catch / assistant 可重试错误耗尽时可能重复完成的问题；retry exhausted 前会先 flush 已累积 SDKMessage。
- 未移动 Teams、IPC、权限分派、SDK 消息持久化调用时机、queueMessage 持久化语义或 session-not-found 恢复副作用。

当前不要纳入提交：
- `.DS_Store`
- `README.en.md` 删除
- `apps/electron/out/`

已完成验证：
- `bun test apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts apps/electron/src/main/lib/pipeline-node-runner.test.ts apps/electron/src/main/lib/pipeline-graph.test.ts apps/electron/src/main/lib/pipeline-service.test.ts apps/electron/src/main/lib/pipeline-record-builder.test.ts apps/electron/src/main/lib/settings-service.test.ts apps/electron/src/renderer/components/pipeline/pipeline-preflight.test.ts apps/electron/src/renderer/components/settings/pipeline-codex-channel-settings.test.ts apps/electron/src/renderer/atoms/pipeline-atoms.test.ts`：64 pass / 0 fail
- `bun run --filter='@rv-insights/electron' typecheck`：通过
- `bun run --filter='@rv-insights/electron' build:main`：通过
- `CSC_IDENTITY_AUTO_DISCOVERY=false bun run --filter='@rv-insights/electron' dist:fast`：通过，生成 `apps/electron/out/RV-Insights-0.0.42-arm64.dmg`
- 包内 Codex native binary：`apps/electron/out/mac-arm64/RV-Insights.app/Contents/Resources/app/node_modules/@openai/codex-darwin-arm64/vendor/aarch64-apple-darwin/codex/codex --version` 返回 `codex-cli 0.130.0`
- `git diff --check`：通过

上一个 Agent 完成信号阶段验证：
- `bun test apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts apps/electron/src/main/lib/agent-orchestrator/queued-message.test.ts apps/electron/src/main/lib/agent-orchestrator/session-recovery.test.ts apps/electron/src/main/lib/agent-orchestrator/agent-error-message.test.ts apps/electron/src/main/lib/agent-orchestrator/context-rehydration.test.ts`：30 pass / 0 fail / 98 expect
- `bun run --filter='@rv-insights/electron' typecheck`：通过
- `bun run --filter='@rv-insights/electron' build:main`：通过
- `git diff --check`：通过

### 下次启动快速接力

1. 先复核 `tasks/lessons.md`、`tasks/todo.md` 和本文档，确认 `b4717c7e` Codex Pipeline 接入提交已在当前分支。
2. Pipeline Codex 渠道选择 UI / 本地配置持久化、SDK / CLI smoke、打包产物 native binary 验证已在工作树完成；下次优先收口提交，注意排除 `README.en.md` 删除、`.DS_Store` 和 `apps/electron/out/`。
3. 若继续 Codex 硬化，优先补 CLI 长任务 abort / 进程树清理测试，或评估是否需要 Codex `thread_id` 持久化与 `resumeThread()` 续接。
4. 若不做 Codex 硬化，再回到 `agent-orchestrator.ts` 完成信号薄包装 / 集中化评估；已有 mock adapter 行为测试，下一步仍需保持所有 `onComplete()` opts 与持久化前置条件不变。
5. OpenAI/custom 渠道注入已通过 mock client 验证；若要做真实外部渠道模型调用，应使用专门测试密钥和临时配置目录，避免污染用户正式配置。
6. 每完成独立阶段仍需执行：
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
| `ea4d988b` | `agent-orchestrator.ts` 渐进拆分第七阶段 D | 部分完成 | 已新增 `queued-message.ts`，抽离 queueMessage SDK input 与本地持久化消息构造纯函数边界 |
| `bcef4e29` | `agent-orchestrator.ts` 完成信号测试切口 | 部分完成 | 已新增 `completion-signal.test.ts`，锁定完成信号分支，并修复 catch / retry exhausted 重复完成风险 |
| `eb87453a` | README 架构文档完善 | 已完成 | 已补充项目定位、模块职责、核心流程图、数据存储、开发命令与贡献说明 |
| `b4717c7e` | Pipeline Codex 节点执行接入 | 部分完成 | `developer` / `reviewer` 默认走 `@openai/codex-sdk`，保留 CLI fallback；渠道 UI / 本地配置硬化、真实 smoke 与打包路径验证已在工作树完成，持久 thread 续接和进程树清理策略仍可继续评估 |

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

- [~] Pipeline `developer` / `reviewer` Codex 节点执行
  现状：代码接入、渠道 UI / 本地配置持久化、真实 smoke、打包产物路径验证和自动化验证已完成；运行韧性仍可继续硬化。
  已完成：
  `developer` / `reviewer` 默认走 `@openai/codex-sdk`，`explorer` / `planner` / `tester` 继续走 Claude Agent SDK 兼容链路。
  已保留 CLI fallback，可通过 `RV_PIPELINE_CODEX_BACKEND=cli` 使用 `codex exec --json --output-schema --output-last-message`。
  已明确认证边界：`meta.channelId` 只代表 Claude 渠道；Codex 默认使用本机 Codex auth / `CODEX_API_KEY`，可通过 `settings.json` 的 `pipelineCodexChannelId` 指向 OpenAI/custom 渠道；旧配置字段缺失时保留 `RV_PIPELINE_CODEX_CHANNEL_ID` fallback，显式本机 auth 不回退旧 env。
  已拒绝非 OpenAI/custom 渠道传入 Codex 节点，避免 Anthropic / DeepSeek / Kimi 等渠道被静默误用。
  已更新依赖、esbuild external、electron-builder files 和平台 optional binary 包范围。
  已补测试覆盖 CLI 参数、SDK 结果归一化、非法 JSON、路由分流、默认本机 Codex auth、显式本机 auth 不回退旧 env、settings 优先 / env fallback、OpenAI/custom 渠道注入、非 OpenAI/custom 与 disabled 渠道拒绝。
  已新增设置 UI：`模型配置` 页可选择 `本机 Codex auth / CODEX_API_KEY` 或启用的 OpenAI/custom 渠道，删除 / 禁用 / 编辑为不兼容渠道时会清理失效选择。
  已做不触发模型调用的路径验证：当前平台 Codex binary 存在、可执行，`codex-cli 0.130.0` 可启动；打包配置仍包含 Codex SDK / CLI 主包和平台 binary 包。
  已完成真实运行验证：本机 Codex auth 下 SDK backend reviewer smoke 成功返回结构化 JSON；`RV_PIPELINE_CODEX_BACKEND=cli` 下 CLI fallback reviewer smoke 成功返回结构化 JSON。
  已完成渠道注入验证：`settings.json` 中的 OpenAI/custom Codex 渠道能注入 `apiKey`、`baseUrl`、`model` 到 Codex SDK；missing / disabled / 非 OpenAI/custom 渠道在 preflight 和 runner 层均被拒绝。
  已完成打包验证：`dist:fast` 生成 macOS arm64 DMG，包内 Codex SDK / CLI 主包和 `@openai/codex-darwin-arm64` native binary 均存在，binary 可执行且返回 `codex-cli 0.130.0`。
  已完成最小会话隔离硬化：Codex 子进程环境过滤宿主 `CODEX_THREAD_ID`，避免外层 Codex 会话 ID 泄入 Pipeline Codex 节点。
  代码审查第一轮发现本机 auth / disabled 渠道 / 编辑后残留三个边界问题，已修复并复审通过。
  未完成：
  尚未设计 Codex `thread_id` 持久化与 `resumeThread()` 续接；当前是每次 `runNode()` 新建 thread 的调用级隔离。
  尚未补 CLI 长任务进程树清理测试；当前依赖 `AbortSignal` 和 runner `abort()` 清理直接子进程。
  关键文件：
  `apps/electron/src/main/lib/codex-pipeline-node-runner.ts`
  `apps/electron/src/main/lib/pipeline-node-router.ts`
  `apps/electron/src/main/lib/pipeline-node-runner.ts`
  `apps/electron/src/main/lib/pipeline-service.ts`
  `apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts`
  `apps/electron/src/main/lib/pipeline-codex-settings.ts`
  `apps/electron/src/renderer/components/settings/ChannelSettings.tsx`
  建议：
  下一阶段优先收口提交；如继续 Codex 硬化，只评估 `thread_id` 续接或 CLI 长任务清理，暂不改变 LangGraph 阶段顺序。

- [~] `agent-orchestrator.ts` 渐进拆分
  现状：部分完成（完成信号测试切口已完成；下一阶段可在现有行为测试保护下评估完成信号薄包装 / 集中化）。
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
  queueMessage 消息构造纯函数边界已抽离到 `apps/electron/src/main/lib/agent-orchestrator/queued-message.ts`。
  `queueMessage()` 仍保留在 `agent-orchestrator.ts` 中作为执行链路，继续在原位置执行防重记录、软中断、adapter 注入、注入成功后 append 和失败删除 uuid。
  完成信号 mock adapter 行为测试已新增到 `apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts`。
  已锁定并发拒绝、preflight channel_not_found、正常 result、assistant TypedError 不可重试、assistant 可重试 TypedError 耗尽、用户中止、catch 不可重试错误、catch 可重试错误耗尽、session-not-found retry 不提前 complete。
  已修复 catch 不可重试错误完成后继续进入后续 attempts 的问题，避免重复 `onError()` / `onComplete()`。
  已修复 catch / assistant 可重试错误耗尽时先走普通错误完成、再走 retry exhausted 完成的风险；现在耗尽后统一跳到 retry exhausted 分支，且进入该分支前先 flush 已累积 SDKMessage。
  已抽离 `createQueuedUserMessageInput()` 与 `createPersistedQueuedUserMessage()`，覆盖 preset uuid 优先、未传 preset 自动生成、空字符串 preset 按旧语义回退自动生成、`priority: 'now'`、`session_id` 和 `_createdAt`。
  已补充最小测试覆盖 task 状态追踪、Watchdog idle 检查、inbox 优先、summary fallback、resume query replay 过滤、compact_boundary 持久化与会话失活停止。
  已补充权限分派测试覆盖 bypassPermissions 前置守卫、AskUser 不受模式影响、plan 模式允许/拒绝策略、ExitPlan approve / deny / 动态切换语义、auto 委托、Write 大内容保护、Bash allowlist 边界和 `.context` Markdown 路径边界。
  已补充 SDK 消息持久化测试覆盖 replay、`user tool_result`、SDK 内部 user 文本、`compact_boundary`、普通 system、result duration、已有 `_createdAt` 不覆盖和 assistant `_channelModelId` 不原地修改。
  已补充上下文回填测试覆盖空历史、排除当前用户消息、最多 20 条、文本筛选、工具摘要、session_info 和摘要长度上限。
  已补充错误消息构造测试覆盖 TypedError metadata / 文本格式、prompt_too_long 固定文案、普通 catch 错误和 retry exhausted。
  已补充会话恢复测试覆盖 error message / stderr 识别、非命中不误判和恢复 patch 语义。
  已补充 queueMessage 构造测试覆盖 preset uuid 优先、自动生成 uuid、空字符串 preset 回退、priority 固定 `now`、SDK input `session_id`、持久化消息 `_createdAt`。
  已补充完成信号行为测试覆盖 `callbacks.onComplete()` opts、完成前持久化状态、retry exhausted 单次完成和 session-not-found retry 不提前完成。
  未完成：
  主执行循环中完成信号薄包装 / 集中化仍未抽离。
  第七阶段后续计划：
  在现有 completion-signal 行为测试保护下，评估是否只抽完成信号薄包装；不要迁移 Teams、IPC、权限分派、错误恢复或 queueMessage 执行链路。
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
  `apps/electron/src/main/lib/agent-orchestrator/queued-message.ts`
  `apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts`
  建议：
  下一阶段进入完成信号薄包装 / 集中化评估，继续保持 adapter 注入、持久化、错误恢复和完成回调顺序不变。

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

Pipeline Codex 阶段提交收口；如继续硬化，优先补 CLI 长任务 abort / 进程树清理测试。

原因：
- `developer` / `reviewer` 的 Codex SDK / CLI 双后端已经接通，Codex 渠道 UI / `settings.json` 持久化也已落地并通过自动化测试。
- 本机 Codex auth 下 SDK backend 和 CLI fallback 已完成 reviewer smoke，均返回符合 schema 的结构化 JSON。
- OpenAI/custom 渠道注入已通过 mock Codex client 验证，避免在文档验证阶段泄露或消耗真实渠道密钥。
- macOS arm64 `dist:fast` 已验证包内 Codex SDK / CLI 主包和 native binary 路径、权限、启动行为。
- 当前剩余 Codex 硬化点已经从接入正确性转为运行韧性：持久 `thread_id` 续接是否必要，以及 CLI 长任务停止时是否需要进程树清理。

### 建议切分顺序

1. 先收口当前工作树提交，排除 `README.en.md` 删除、`.DS_Store` 和 `apps/electron/out/`。
2. 如继续 Codex 韧性硬化，先补 CLI 长任务 abort 测试，再决定是否实现进程树清理。
3. 如产品需要跨节点 / 跨重启保留 Codex 对话上下文，再设计 Codex `thread_id` 持久化与 `resumeThread()` 续接。
4. 若不继续 Codex 硬化，回到 `agent-orchestrator.ts` 完成信号薄包装 / 集中化评估。

### 起点文件

- `apps/electron/src/main/lib/codex-pipeline-node-runner.ts`
- `apps/electron/src/main/lib/pipeline-node-router.ts`
- `apps/electron/src/main/lib/pipeline-service.ts`
- `apps/electron/src/main/lib/pipeline-codex-settings.ts`
- `apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts`
- `apps/electron/src/main/lib/pipeline-node-runner.test.ts`
- `apps/electron/src/renderer/atoms/pipeline-atoms.ts`
- `apps/electron/src/renderer/components/settings/ChannelSettings.tsx`
- `apps/electron/src/renderer/components/pipeline/pipeline-preflight.ts`
- `apps/electron/electron-builder.yml`

### 下次启动提示词

```text
请先阅读并严格按最新进度继续开发，不要重复已完成项：

1. /Users/zq/Desktop/ai-projs/posp/RV-Insights/AGENTS.md
2. /Users/zq/Desktop/ai-projs/posp/RV-Insights/tasks/lessons.md
3. /Users/zq/Desktop/ai-projs/posp/RV-Insights/tasks/todo.md
4. /Users/zq/Desktop/ai-projs/posp/RV-Insights/improve/2026-05-08-full-stack-optimization-review.md

当前状态：
- 最新功能提交：b4717c7e feat(pipeline): 接入 Codex 节点执行
- 文档同步状态：当前工作树中的 improve/2026-05-08-full-stack-optimization-review.md 已更新；若已提交，以最新 docs(improve) 提交为准
- 当前 Electron 版本：@rv-insights/electron@0.0.42（工作树）
- 既有无关工作树状态：README.en.md 删除、.DS_Store 未跟踪；打包产物 apps/electron/out/ 也不要纳入提交

已完成：
- Pipeline developer/reviewer Codex 两阶段接入已完成并提交。
- 默认后端是 @openai/codex-sdk；RV_PIPELINE_CODEX_BACKEND=cli 可切回 codex exec CLI。
- explorer/planner/tester 仍走 Claude Agent SDK 兼容链路，LangGraph 阶段顺序未改。
- meta.channelId 只代表 Claude 渠道；Codex 默认使用本机 Codex auth / CODEX_API_KEY。
- settings.json 的 pipelineCodexChannelId 可指定 OpenAI/custom 渠道；字段缺失时保留 RV_PIPELINE_CODEX_CHANNEL_ID fallback；null 表示显式本机 Codex auth；非 OpenAI/custom 或 disabled 渠道必须显式报错。

请继续下一阶段：Pipeline Codex 阶段提交收口；如继续硬化，优先做 CLI 长任务 abort / 进程树清理测试。

本阶段范围：
1. 当前 SDK backend 本机 Codex auth smoke、CLI fallback smoke、OpenAI/custom 注入 mock smoke、非法渠道拒绝和 macOS arm64 打包路径验证都已完成。
2. 当前已新增最小隔离硬化：Codex 子进程环境过滤宿主 CODEX_THREAD_ID。
3. 如继续 Codex 硬化，不要改变 LangGraph 阶段顺序，不要把 explorer/planner/tester 迁到 Codex。
4. 完成前运行相关 Pipeline 测试、`bun run --filter='@rv-insights/electron' typecheck`、`bun run --filter='@rv-insights/electron' build:main`、`git diff --check`，递增受影响包 patch 版本，更新进度文档。

如果暂不做 Codex 硬化，再回到 `agent-orchestrator.ts` 完成信号薄包装 / 集中化评估；已有 completion-signal 行为测试，不能移动 Teams、IPC、权限分派、SDK 消息持久化调用时机、session-not-found 恢复副作用或 queueMessage 注入 / append 顺序。
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
  `EnvironmentBuilder`、`RetryableErrorClassifier`、`TeamsCoordinator` 状态 / prompt 边界、`TeamsCoordinator.runResumeQuery()`、`PermissionToolDispatcher`、SDK 消息持久化纯函数边界、上下文回填纯函数边界、错误 SDKMessage 构造纯函数边界、session-not-found 恢复纯函数边界、queueMessage 消息构造纯函数边界、完成信号行为测试切口
- Pipeline `developer` / `reviewer` Codex 节点执行基础接入：
  默认 `@openai/codex-sdk`、CLI fallback、路由分流、结构化输出解析、OpenAI/custom 渠道注入与非法渠道拒绝
- Pipeline Codex 渠道 UI / 本地配置持久化：
  `pipelineCodexChannelId`、设置页选择、本机 Codex auth 默认、显式本机 auth 不回退旧 env、settings 优先 / env fallback、启动前 preflight
- Pipeline Codex 真实运行与打包路径验证：
  SDK backend 本机 Codex auth smoke、CLI fallback smoke、OpenAI/custom 注入 mock smoke、非法渠道拒绝 smoke、macOS arm64 `dist:fast` 与包内 native binary 可执行性验证

### 部分完成

- `safeStorage` 降级告警可视化
  已有告警和标记，未有替代加密方案
- `ipc.ts` 拆分
  关键高耦合 handlers 已完成；`chat`、`environment`、`installer`、`proxy`、`memory`、`chat tool`、`system prompt`、`github release` 等基础/工具类 handlers 仍留在主文件，后续按收益单独评估
- `agent-orchestrator.ts` 渐进拆分
  已提交 SDK 环境、重试分类、Teams 状态 / prompt / resume query 执行边界、权限工具分派边界、SDK 消息持久化纯函数边界、上下文回填纯函数边界、错误 SDKMessage 构造纯函数边界、session-not-found 恢复纯函数边界、queueMessage 消息构造纯函数边界、完成信号行为测试切口；完成信号薄包装 / 集中化仍待评估
- Codex 运行韧性硬化
  当前每次 `runNode()` 新建 Codex thread，具备调用级隔离；已过滤宿主 `CODEX_THREAD_ID`；持久 `thread_id` 续接和 CLI 进程树清理仍待按产品需要评估

### 未完成

- Pipeline Codex 持久 `thread_id` 续接策略
- Pipeline Codex CLI 长任务进程树清理测试
- `agent-orchestrator.ts` 后续阶段：完成信号薄包装 / 集中化评估
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
