# 2026-05-08 全栈优化评审：进度同步版

## 1. 目的

本文档用于跟踪 RV-Insights 全栈优化项的**当前开发状态**，目标是：
- 明确哪些已经完成、哪些只做了一半、哪些还未开始
- 作为下次启动时的继续开发入口
- 避免重复处理已经落地的问题

---

## 2. 当前基线

- 分支：`base/pipeline-v0`
- 最新已纳入进度同步的功能提交：`85c92dec`
- 同步日期：`2026-05-08`

说明：
- 本文档只记录功能 / 工程项状态
- 每完成一个阶段，先更新本文档，再继续下一阶段

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

- [ ] `ipc.ts` 巨型注册函数拆分
  现状：未完成。
  关键文件：
  `apps/electron/src/main/ipc.ts`
  建议：
  先按高变更模块拆 `channel`、`agent`、`settings`、`pipeline`。

- [ ] `agent-orchestrator.ts` 渐进拆分
  现状：未完成。
  关键文件：
  `apps/electron/src/main/lib/agent-orchestrator.ts`
  建议：
  从 `EnvironmentBuilder`、`RetryableErrorClassifier`、`TeamsCoordinator` 这类小协作者开始拆。

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

`ipc.ts` 拆分

原因：
- 这是当前剩余项里性价比最高的结构性改造
- 会直接降低后续做 IPC 输入校验、设置页扩展和主进程维护的成本
- 拆完后再做 `agent-orchestrator.ts` 和 `feishu-bridge.ts`，上下文更干净

### 建议切分顺序

1. 拆 `channel` handlers
2. 拆 `settings` handlers
3. 拆 `agent` handlers
4. 最后拆 `pipeline` / 机器人相关 handlers

### 起点文件

- `apps/electron/src/main/ipc.ts`
- 可新建目录：
  `apps/electron/src/main/ipc/`

建议第一批文件：
- `index.ts`
- `channel-handlers.ts`
- `settings-handlers.ts`
- `agent-handlers.ts`

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

### 部分完成

- `safeStorage` 降级告警可视化
  已有告警和标记，未有替代加密方案

### 未完成

- `ipc.ts` 拆分
- `agent-orchestrator.ts` 渐进拆分
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
