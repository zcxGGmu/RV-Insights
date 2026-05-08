# 2026-05-08 全栈优化评审：当前主线校正版

## 1. 背景与复核基线

本文档是对 RV-Insights 全栈优化项的**当前主线校正版**，目标不是保留一次性的历史审查快照，而是形成一份可持续执行的路线图。

本次复核范围覆盖：
- 主进程服务层
- 渲染进程状态与交互
- 共享 Provider/网络层
- 工程化与安全边界

本次复核基线：
- 分支：`base/pipeline-v0`
- 最新已验证提交：`bc0813bb`
- 复核时间：`2026-05-08 19:13:48 +0800`

阅读方式：
- `已完成`：当前主线已修复，不应继续作为当前阶段待办
- `部分完成`：方向成立，但当前只解决了一部分
- `待处理`：仍应进入当前路线图
- `新增风险`：旧版文档未充分覆盖，但当前代码里已较明确暴露

---

## 2. 已完成或应从当前待办移除的结论

### 2.1 `process.env` 凭证竞态已修复

**状态**：已完成

**当前实现**：
- `apps/electron/src/main/lib/agent-orchestrator.ts:404-457`
- `apps/electron/src/main/lib/agent-orchestrator.ts:860-863`

`AgentOrchestrator` 现在通过 `buildSdkEnv()` 构造隔离环境，并在发送路径里明确说明**不再把凭证写回全局 `process.env`**。旧版文档里“P0 必须立即修复”的表述已经过期。

**文档调整建议**：
- 从当前 P0 待办中移除
- 改为“已完成加固项”，仅保留回归检查清单

---

### 2.2 `useGlobalAgentListeners` 高频刷新与 `unstable_batchedUpdates` 残留已处理

**状态**：已完成

**当前实现**：
- `apps/electron/src/renderer/hooks/useGlobalAgentListeners.ts:356-377`
- `apps/electron/src/renderer/hooks/agent-session-refresh-controller.ts`

当前主线已通过 `agent-session-refresh-controller` 收敛未知会话事件、标题更新和完成态后的刷新路径；`unstable_batchedUpdates` 也已移除。旧版文档中的 `4.5` 和 `5.4` 不应继续出现在当前优先级表。

---

### 2.3 `AgentView` 会话级订阅优化已在当前范围落地

**状态**：已完成（`AgentView` 范围）

**当前实现**：
- `apps/electron/src/renderer/atoms/agent-atoms.ts`
- `apps/electron/src/renderer/components/agent/AgentView.tsx`

`AgentView` 已改为通过按 `sessionId` 派生的 atoms 读取流式状态、草稿、路径、附加目录和 live messages。旧版文档中的 `3.3` 作为“AgentView 当前阻塞问题”已经过期。

**保留意见**：
- 可以把这一条调整为“该模式可继续推广到其他重组件，但不再是当前 AgentView 的阻塞项”

---

### 2.4 “Agent 没有搜索/没有恢复提示”不再准确

**状态**：结论过期

**当前实现**：
- 全局搜索：`apps/electron/src/renderer/components/app-shell/SearchDialog.tsx:1-10, 196-214`
- Agent 错误态重试：`apps/electron/src/renderer/components/agent/AgentView.tsx:1133-1210`
- 错误消息操作：`apps/electron/src/renderer/components/agent/AgentMessages.tsx:568-586`

项目现在已经具备：
- 全局搜索对 Agent/Chat/Pipeline 的统一入口
- Agent 错误态的“重试”和“在新会话中重试”入口

真正仍待优化的不是“有没有”，而是：
- 搜索实现成本高
- Agent 缺少更贴近当前上下文的专属检索入口
- 自动 resume 策略仍不统一

---

### 2.5 “仓库没有 GitHub workflows”不准确

**状态**：结论过期

**当前实现**：
- `.github/workflows/deploy-pages.yml`

仓库已经存在 GitHub Actions 工作流。当前缺的不是“有没有 workflow”，而是**缺少代码质量 CI**，例如 typecheck、test、build、版本 gate。

---

## 3. 当前应前置的新风险

### 3.1 解密后凭证不应离开主进程

**状态**：待处理

**风险等级**：P1

**当前暴露面**：
- 渠道 API Key：`apps/electron/src/main/ipc.ts:342-347`，`apps/electron/src/preload/index.ts:902`
- 飞书 Bot Secret：`apps/electron/src/main/ipc.ts:2387-2392`，`apps/electron/src/preload/index.ts:1744`
- 钉钉 Bot Secret：`apps/electron/src/main/ipc.ts:2568-2573`，`apps/electron/src/preload/index.ts:1842`

旧版文档只覆盖了 `channel:decrypt-key`，范围过窄。当前问题应上升为统一原则：

**原则**：
- 任何解密后的凭证都不应回传渲染层
- 渲染层最多只拿到脱敏展示值
- 真正需要明文的场景应留在主进程内执行

**建议动作**：
- 删除或废弃所有 `getDecrypted*Secret` / `DECRYPT_KEY` 直出接口
- 设置页改为显示脱敏值
- 若确实需要复制明文，使用主进程受控的一次性动作而不是“读取后返回”

---

### 3.2 标题生成链路存在无条件日志与隐私泄漏风险

**状态**：待处理

**风险等级**：P1

**当前实现**：
- `packages/core/src/providers/sse-reader.ts:220-258`
- `apps/electron/src/main/lib/agent-orchestrator.ts:613-642`
- `apps/electron/src/main/lib/chat-service.ts:588-600`

当前标题生成链路会无条件输出：
- 请求 URL
- `bodyPreview`
- 响应状态
- 响应体预览
- 解析后的标题
- 用户消息片段

这比旧版文档里的 `[FLASH-DEBUG]` 更接近当前真实风险，因为它会直接进入生产日志并携带用户输入片段。

**建议动作**：
- 默认移除这些日志
- 若保留调试能力，仅在 `DEV` 或显式 debug flag 下启用
- 禁止日志输出请求体、响应体和用户正文预览

---

### 3.3 全局搜索的同步全文扫描是当前更热的性能热点

**状态**：待处理

**风险等级**：P1/P2 之间，建议按 P1 观察

**当前实现**：
- 搜索入口：`apps/electron/src/renderer/components/app-shell/SearchDialog.tsx:204-214`
- Chat 搜索：`apps/electron/src/main/lib/conversation-manager.ts:406-436`
- Agent 搜索：`apps/electron/src/main/lib/agent-session-manager.ts:1053-1110`

现在的全局搜索会直接并发触发：
- `searchConversationMessages(searchQuery)`
- `searchAgentSessionMessages(searchQuery)`

两条路径都仍是：
- `readFileSync`
- `split('\n')`
- `JSON.parse`
- 逐会话线性扫描

相比索引 JSON 的全量读写，这条路径更容易在真实使用里先卡住主线程。

**建议动作**：
- 优先把全文搜索从同步全量扫描改成分页/流式/后台索引
- 在做索引缓存前，先把搜索热点单独立项
- 如果短期不做倒排索引，至少改为异步扫描与结果分页

---

### 3.4 Provider 层统一超时控制仍缺失，尤其是 `fetchTitle()`

**状态**：待处理

**风险等级**：P2

**当前实现**：
- `packages/core/src/providers/sse-reader.ts:62-71`
- `packages/core/src/providers/sse-reader.ts:216-258`

`streamSSE()` 虽然支持外部传入 `signal`，但没有统一绝对超时；`fetchTitle()` 更是没有 `signal` 和超时保护。文档里“各 Provider 适配器补 timeout”的表述过散，真正的统一落点应该是共享网络层。

**建议动作**：
- 在 `sse-reader.ts` 统一实现绝对超时
- `streamSSE()` 与 `fetchTitle()` 都纳入同一超时策略
- 适配器只关心协议，不各自重复实现超时

---

## 4. 仍然成立的结构性改进

### 4.1 `ipc.ts` 巨型注册函数拆分

**状态**：待处理

**优先级**：P1

**现状**：
- `apps/electron/src/main/ipc.ts` 共 `2716` 行

这个问题仍然成立，而且收益明确：
- 减少单文件认知负担
- 为输入校验和错误包装留出中间层
- 更容易为单组 handler 写测试

**补充建议**：
- 不要一次性机械拆文件
- 先按高变更频率模块拆：`channel`、`agent`、`pipeline`、`settings`
- 同步引入共享 `createHandler()` 风格的包装层

---

### 4.2 `agent-orchestrator.ts` / `sendMessage()` 继续拆分，但应从小协作者开始

**状态**：待处理

**优先级**：P1

**现状**：
- `apps/electron/src/main/lib/agent-orchestrator.ts` 共 `2153` 行

问题仍然成立，但旧版文档里“一步提炼完整通用 `RetryPolicy`”过于乐观。更合理的拆分顺序是：
- 先提 `EnvironmentBuilder`
- 再提 `RetryableErrorClassifier` / `BackoffPolicy`
- 再提 `TeamsCoordinator`
- 最后收口 `PermissionGate`

这样可以降低一次重构过深导致的回归风险。

---

### 4.3 `feishu-bridge.ts` 仍明显超出可维护阈值

**状态**：待处理

**优先级**：P1

**现状**：
- `apps/electron/src/main/lib/feishu-bridge.ts` 共 `1952` 行

拆分建议仍然成立，尤其适合按以下边界切：
- 生命周期与连接管理
- 消息路由
- 回复构建
- 绑定存储
- 通知策略

---

### 4.4 Chat 自动重试值得做，但不应强行复用 Agent 整套重试器

**状态**：待处理

**优先级**：P2

问题本身成立：`chat-service.ts` 当前失败即报错，缺少 429 / 5xx 的自动退避。

但建议应调整为：
- 复用小粒度公共件：`backoff`、`retryable error classifier`
- 不直接复用 Agent 的 SDK session / watchdog / auto-resume 重试框架

---

### 4.5 索引缓存值得做，但要先拆掉“读路径带写副作用”

**状态**：待处理

**优先级**：P2

**当前实现**：
- `conversation-manager.ts` 的索引读取仍是每次读盘：`36-62`
- `channel-manager.ts` 的 `listChannels()` 读取后可能自动补 DeepSeek 预设并写盘：`112-138`

因此缓存不是不能做，而是前提要先整理读写语义：
- 读 API 应尽量无副作用
- bootstrap 预设注入应从 `list()` 中拆出来
- 再引入缓存和防抖 flush

---

### 4.6 IPC 输入验证体系仍是长期必要项

**状态**：待处理

**优先级**：P2/P3

这个方向没有过期，但建议从高风险入口优先落地：
- 文件系统路径
- 工作区配置
- 凭证相关操作
- 触发外部进程/网络的入口

不建议一上来为 `ipc.ts` 的全部 handler 同步补 Zod。

---

### 4.7 `safeStorage` 降级告警仍需要

**状态**：待处理

**优先级**：P2/P3

**当前实现**：
- `apps/electron/src/main/lib/channel-manager.ts:75-99`

当前在加密不可用时只写 `console.warn`，用户仍然无感知。这个问题仍成立。

---

## 5. UX 结论的当前表述

### 5.1 搜索问题应改写为“检索体验与实现不统一”

旧表述“Agent 缺少会话搜索”不准确。更准确的当前问题是：
- 已有全局搜索，但缺少 Agent 视角下更贴近当前工作区/当前会话的检索入口
- 全局搜索与各模式内部搜索的覆盖面不一致
- 搜索实现成本高，性能隐患明显

**建议动作**：
- 后续将“检索能力统一”单列为一项体验/性能联合优化

---

### 5.2 恢复问题应改写为“自动恢复策略不统一”

旧表述“流式输出中断后无恢复提示”不准确。更准确的当前问题是：
- 已经有显式重试入口
- 但 Chat / Agent / Pipeline 的恢复策略不统一
- Agent 的自动 resume 仍偏内部能力，没有形成稳定的用户心智

**建议动作**：
- 区分“手动重试”“同会话恢复”“新会话续做”三种语义
- 统一错误态文案与行为

---

## 6. 工程化现状与建议

### 6.1 缺少的是代码质量 CI，不是 workflow 本身

**状态**：待处理

**优先级**：P2

仓库已有 Pages 部署工作流，但仍缺：
- `bun run typecheck`
- `bun test`
- 必要 build
- 包版本递增 gate
- 可选的 diff / formatting gate

---

### 6.2 Lint / Format 统一配置仍空缺

**状态**：待处理

**优先级**：P2

当前仓库未见 ESLint / Prettier / Biome 的显式配置文件，这条建议仍成立。

---

### 6.3 版本递增规则需要自动化守卫

**状态**：待处理

**优先级**：P2

仓库约定“受影响包必须递增 patch 版本”，但现在仍主要靠人工执行。建议纳入 CI 校验。

---

### 6.4 测试覆盖建议应改写为“缺口清单”，不要写死数量

**状态**：待处理

**优先级**：P2

旧版文档里写死“除 Pipeline 相关的 62 个测试外”已经很快过期。更合理的写法是按子系统列缺口：
- Agent 主服务
- Chat 主服务
- 渠道/配置
- IPC handlers
- 搜索与索引性能路径

---

## 7. 当前优先级总览

| 优先级 | 事项 | 状态 | 说明 |
|--------|------|------|------|
| **P1** | 解密后凭证禁止回传渲染层 | 待处理 | 统一覆盖 Channel / Feishu / DingTalk |
| **P1** | 标题生成链路无条件日志清理 | 待处理 | 当前真实的隐私与日志污染风险 |
| **P1** | `ipc.ts` 拆分 | 待处理 | 2716 行，继续增长成本过高 |
| **P1** | `agent-orchestrator.ts` 渐进拆分 | 待处理 | 2153 行，先拆小协作者 |
| **P1** | `feishu-bridge.ts` 拆分 | 待处理 | 1952 行，职责过载 |
| **P1/P2** | 全局搜索同步全文扫描优化 | 待处理 | 比索引缓存更接近当前热点 |
| **P2** | Provider 统一绝对超时 | 待处理 | 优先落在 `sse-reader.ts` |
| **P2** | Chat 自动重试 | 待处理 | 复用小粒度 backoff 组件即可 |
| **P2** | 代码质量 CI | 待处理 | workflow 已有，但质量 gate 缺失 |
| **P2** | Lint / Format 统一配置 | 待处理 | 规范靠人工维护 |
| **P2** | 版本递增自动化校验 | 待处理 | 目前仍主要依赖人工 |
| **P2/P3** | 索引缓存 | 待处理 | 先拆读写副作用，再谈缓存 |
| **P2/P3** | `safeStorage` 降级告警 | 待处理 | 用户当前无感知 |
| **P2/P3** | IPC 输入验证 | 待处理 | 建议从高风险 handler 先行 |
| **已完成** | `process.env` 凭证竞态 | 已完成 | 不应继续放在当前 P0 |
| **已完成** | `useGlobalAgentListeners` 刷新防抖 | 已完成 | 已由刷新控制器收敛 |
| **已完成** | `AgentView` 会话级订阅优化 | 已完成 | 当前范围已落地 |

---

## 8. 推荐执行顺序

### Phase 1：先收安全与日志边界

1. 删除标题生成链路中的请求/响应预览日志
2. 收口所有“解密后凭证” IPC / preload 直出接口
3. 为 Provider 共享请求层补统一超时

### Phase 2：先打性能热点，而不是先做泛化缓存

1. 优化 Chat / Agent 全局搜索的同步全文扫描
2. 评估是否需要事件合并或 IPC batching
3. 清理 `channel-manager` 读路径副作用后，再推进索引缓存

### Phase 3：做结构性拆分

1. `ipc.ts`
2. `agent-orchestrator.ts`
3. `feishu-bridge.ts`

### Phase 4：补工程化护栏

1. 代码质量 CI
2. Lint / Format 配置
3. 版本递增 gate
4. 关键子系统测试基线

---

## 9. 与已有 Pipeline 文档的关系

本文档仍保持与现有 Pipeline 文档互补：
- Pipeline 专项可靠性、记录、状态恢复，继续放在 `pipeline-next-improvement-roadmap.md`
- 本文档只覆盖 Chat / Agent / 通用基础设施 / 工程化 / 安全边界

---

## 10. 本次校正结论

这份文档当前最需要的不是继续加条目，而是持续维护**状态准确性**。后续更新时应遵循以下规则：

1. 先回查当前主线实现，再决定是否保留旧问题。
2. 优先级表必须带 `状态`，避免已修复问题继续占据当前阶段。
3. 体验类问题要区分“完全缺失”和“已有能力但实现/入口不理想”。
4. 安全类问题按能力边界建模，不只修单个通道名义上的入口。
