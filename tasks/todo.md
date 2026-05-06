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
