# 启动 RV-Insights 客户端

- [x] 复习项目约束、README 和脚本，确认标准启动方式
- [x] 检查并补齐本机运行环境（重点是 Bun / Electron 所需前提）
- [x] 启动 RV-Insights Electron 客户端
- [x] 修复“用户看不到主页”的启动可见性问题
- [x] 重新验证主页对用户可见

## Review

- 已通过 `npm install -g bun` 安装 Bun，当前版本 `1.3.13`
- 已执行 `bun install` 同步 workspace 依赖
- 已定位根因：`start` 路径把“未打包”误判成“必须使用 dev server”，导致主页隐藏；同时硬编码 `5173` 还可能误连到其他项目的 Vite 页面
- 已新增启动加载器测试：`bun test apps/electron/src/main/lib/renderer-loader.test.ts`，结果 `4 pass`
- 已通过环境变量显式区分开发态和普通启动态，`electron:start` 现在直接加载本地构建页面
- 已执行 `bun run --filter='@rv-insights/electron' typecheck`，结果通过
- 已执行 `bun run electron:build`，结果通过
- 已在后台启动客户端：`bun run electron:start`
- 当前运行中进程：`96898`（启动脚本）、`96900`（bunx 包装进程）、`97108`（Electron/Node 进程）
- 启动日志：`/tmp/rv-insights-start.log`
- X11 窗口确认：存在标题为 `RV-Insights` 的主窗口，尺寸 `1400x900`

---

# 编写源码部署与启动指南

- [x] 梳理 README、脚本与现有 docs 结构，确认需要补充完整指南
- [x] 明确文档目标读者与说明粒度
- [x] 在 `docs/guide/` 下创建详细 Markdown 指南
- [x] 校验文档中的命令、路径与当前仓库一致

## Review

- 已确认目标读者为“完全第一次从源码跑 RV-Insights 的新人”
- 已新增文档：`docs/guide/source-build-run-client.md`
- 文档覆盖 Linux / macOS / Windows 三个平台
- 已校验文档中的核心脚本与仓库现状一致：`bun run dev`、`bun run electron:build`、`bun run electron:start`、`apps/electron` 下的 `dev:vite` / `dev:electron` / `dev:split`
- 已把首次启动推荐路径、开发模式差异、`5173` 端口冲突排查、`.rv-insights-dev` 配置目录说明写入文档

---

# 设计 RISC-V Pipeline 并平替 Chat

- [x] 复习现有 chat/agent 架构、pipeline 方案文档与项目 lessons
- [x] 明确 pipeline 平替 chat 的边界、兼容要求与人工审核节奏
- [x] 提出 2-3 个可落地集成方案并给出推荐方案
- [x] 输出设计说明并等待人工确认
- [x] 设计获批后写入 `docs/pipeline/` 并补充详细实施计划

## Review

- 已复习 `tasks/lessons.md`、`docs/pipeline/rv-pipeline-development-plan.md`
- 已确认当前 Electron 主线仍是 `chat + agent`，`pipeline` 仅存在于 `web-console` 原型，不可直接复用到 React/Electron 主应用
- 已确认后续输出文档统一放在 `docs/pipeline/`，不使用 skill 默认的 `docs/plans/`
- 已确认首版目标：优先打通 `explorer -> planner -> developer -> reviewer -> tester` 编排、人审停顿、Developer/Reviewer 迭代闭环
- 已确认首版外部探索采用最小可用集成，LangGraph 负责节点编排
- 已确认首版 5 个节点统一采用 `Claude Agent SDK`，不再引入 OpenAI Agents SDK / Codex Reviewer 实现
- 已完成 3 套集成方案对比，推荐“独立 pipeline 域 + 复用现有 agent 底座能力”
- 已完成并获得确认的设计分段：
- `mode / tab / session`
- `LangGraph 编排与人工审核`
- `类型、IPC 与持久化`
- `前端 PipelineView 与交互路径`
- `错误处理、恢复策略、测试与首版边界`
- 已输出设计文档：`docs/pipeline/2026-05-06-rv-pipeline-design.md`
- 已输出实施计划：`docs/pipeline/2026-05-06-rv-pipeline-implementation-plan.md`
- 已补记 lesson：文档输出路径一旦被用户指定，后续同类文档必须统一跟随该目录

---

# RV Pipeline 开发执行跟踪

- [x] 完成需求澄清与方案确认
- [x] 输出设计文档 `docs/pipeline/2026-05-06-rv-pipeline-design.md`
- [x] 输出实施计划 `docs/pipeline/2026-05-06-rv-pipeline-implementation-plan.md`
- [ ] 调研并锁定 LangGraph / `@langchain/core` 版本
- [ ] 新增 pipeline shared 类型、状态工具与基础测试
- [ ] 新增 pipeline session manager 与 JSONL 持久化
- [ ] 新增 pipeline human gate 服务与恢复逻辑
- [ ] 新增 Claude 节点执行适配层与 LangGraph graph 骨架
- [ ] 新增 pipeline checkpointer 与 pipeline service
- [ ] 打通 pipeline IPC 与 preload API
- [ ] 新增 renderer `pipeline-atoms` 与全局 listeners
- [ ] 完成 `AppMode` / `TabType` 从 chat 切到 pipeline
- [ ] 完成 `PipelineView`、阶段轨、记录流、人审卡片 UI
- [ ] 完成主链路联调：`explorer -> planner -> developer -> reviewer -> tester`
- [ ] 完成 Developer / Reviewer 驳回后迭代闭环联调
- [ ] 完成中断恢复与重启恢复验证
- [ ] 完成自动化测试、typecheck 与手工验收
- [ ] 评估并在获批后同步 `README.md` / `README.en.md` / `AGENTS.md`

## 开发进度结论

- 当前已完成：设计和实施计划
- 当前未完成：代码实现、联调、测试、文档同步
