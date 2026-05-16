# 2026-05-16 全客户端 UI 迭代开发跟踪清单

## 0. 使用说明

本文是 `2026-05-16-client-ui-visual-spec.md` 的工程执行清单，用于后续按阶段跟踪 RV-Insights 客户端 UI 优化进度。

参考规范：

- `improve/ui/2026-05-16-client-ui-visual-spec.md`
- `tasks/lessons.md`
- `tasks/todo.md`
- `AGENTS.md`

本清单只定义开发计划、进度、验收和风险控制。实际实现阶段仍需按仓库规则先检查 `git status`、保护已有用户改动、逐步验证并记录 Review。

## 1. 总原则

### 1.1 不变量

- 公开主入口仍为 `Pipeline | Agent`，旧 `chat` 只作为隐藏回退保持一致性。
- 状态管理继续使用 Jotai，不引入 Redux、Zustand 或新状态框架。
- 本地存储优先继续使用 JSON / JSONL / 配置文件，不引入本地数据库。
- UI 组件优先复用现有 Radix / shadcn 风格 primitive 和 Lucide 图标。
- 不新增 public API / IPC / shared type，除非对应阶段明确需要并单独评审。
- README / AGENTS 只有在用户明确允许后再修改。
- UI 优化不应改变 Agent / Pipeline 的业务语义、权限边界、远端写 gate 或本地文件安全策略。

### 1.2 迭代纪律

- 每个阶段开始前检查 `git status --short`，确认本轮只接管相关文件。
- 每个阶段开始前阅读本清单对应阶段和视觉规范相关章节。
- 每个阶段先做 before 审计，再实现，再做 after 验收。
- 每个阶段完成后更新本清单的状态、证据、截图路径和 Review。
- 非文档代码阶段完成后应单独提交，提交内容只包含该阶段相关文件。
- 涉及 `apps/electron` 运行时代码时，按仓库要求递增受影响 package patch 版本。
- 若阶段中发现原方案不成立，应停止并更新计划，不继续硬推。

### 1.3 状态标记

任务状态使用以下格式：

- `[ ]` 未开始
- `[~]` 进行中
- `[x]` 已完成
- `[!]` 阻塞，需要用户或前置问题处理
- `[-]` 取消或暂缓，并在 Review 中说明原因

Markdown checkbox 不原生支持 `[~]` / `[!]`，如工具不识别，可在任务文字前加状态标签，例如 `[BLOCKED]`。

### 1.4 验证分层

每个阶段按风险选择验证：

| 验证层级 | 适用范围 | 必做项 |
| --- | --- | --- |
| Static | 文档、CSS、轻量 class 调整 | `git diff --check` |
| Type | TSX / TS / Tailwind class 变更 | `bun run --filter='@rv-insights/electron' typecheck` |
| Focused | 组件行为、状态映射、交互逻辑 | 相关 `bun test <file>` 或手动路径 |
| Visual | 页面结构、主题、状态色、文本溢出 | Electron / Vite 实机截图 |
| A11y | icon-only、表单、Dialog、树、Tab | 键盘路径、aria、contrast |

## 2. 进度总览

### 2.1 当前开发状态快照

更新时间：2026-05-16 UI-1 完成并补充状态同步后

当前文档与阶段提交：

- Commit：`7bef500c984803525e9c7fac67d2c959271d2a1c`
- 提交标题：`docs(ui): 新增客户端 UI 视觉规范与迭代清单`
- 分支：`base/pipeline-v0-ui-enhancement`
- 范围：纯文档基线，未改运行时代码、README、AGENTS、public API、IPC 或 shared type。
- 进度同步提交：`da4d682f45dad606992603df32f9420e30ebfe23`（`docs(ui): 同步客户端 UI 开发进度状态`）。
- UI-0 提交：`61c263c80bf98169b64b40c6bddc79bc7873b8fd`（`docs(ui): 完成 UI-0 基线审计与截图`）。
- UI-1 提交：`20a90d3679147dd27c035d9c957546823924ac4b`（`feat(ui): 完成 UI-1 token 与 primitive 收敛`）。

已完成：

- [x] 新增并完善 `improve/ui/2026-05-16-client-ui-visual-spec.md`。
- [x] 新增 `improve/ui/2026-05-16-client-ui-implementation-checklist.md`。
- [x] 完成视觉规范、Design Token 契约、量化默认值、页面 wireframe、组件默认值、before / after 审计模板、截图基线命名、MVP 优先级和实现拆单建议。
- [x] 完成 UI-0 到 UI-7 的阶段化开发跟踪清单。
- [x] 已按阶段提交文档成果，commit 为 `7bef500c984803525e9c7fac67d2c959271d2a1c`。
- [x] 完成 UI-0 before 审计记录：`improve/ui/2026-05-16-client-ui-before-audit.md`。
- [x] 建立 `improve/ui/screenshots/` 截图基线，覆盖 Pipeline / Agent / Settings 的 light 与 dark 状态。
- [x] 完成 UI-1 Token 与 primitive 收敛：新增语义 token alias、Tailwind 映射、Card / Chip primitive，统一 Button / Badge / Dialog / Tooltip / Input / Select / 菜单 / Settings primitives 的基础视觉语言。

未完成：

- [ ] 真实客户端主界面视觉改造尚未开始；重启客户端后 Pipeline 主界面、左侧栏、阶段栏、任务输入区和阶段产物区不会出现明显 redesign。
- [ ] UI-2 AppShell / Sidebar / Tab 尚未开始。
- [ ] UI-3 Pipeline 工作台尚未开始。
- [ ] UI-4 Agent 阅读与交互尚未开始。
- [ ] UI-5 Settings 管理界面尚未开始。
- [ ] UI-6 Welcome / Chat 回退 / File Browser 尚未开始。
- [ ] UI-7 全局验收与收尾尚未开始。

当前注意事项：

- 当前工作区存在未提交临时文件：`improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`。本轮确认它对应仍在运行的 vim 进程，不是可以随手删除的残留；不要纳入提交。
- 当前工作区可能存在 `.DS_Store` 修改；它不是 UI 阶段成果，不要纳入 UI 提交，除非用户明确要求处理系统文件。
- `tasks/` 被 `.gitignore` 忽略，其中的 lessons / todo 为本地工作记录，不属于已提交文档基线。
- UI-1 只是 UI 基础层，不等同于用户可见的主界面优化；不要向用户暗示“全客户端 UI 已经有明显变化”。
- 下一阶段必须从 UI-2 AppShell / Sidebar / Tab 开始；不得跳过 UI-2 直接进入 Pipeline / Agent 页面结构大改。
- 用户截图中红框区域属于 UI-3 Pipeline 工作台范围；若要让该区域肉眼明显变化，需要先完成 UI-2，再进入 UI-3。

### 2.2 阶段进度表

| 阶段 | 名称 | 状态 | 主要范围 | 完成证据 |
| --- | --- | --- | --- | --- |
| UI-0 | 基线审计与截图准备 | [x] | before 审计、截图目录、验收矩阵 | commit `61c263c8` + `2026-05-16-client-ui-before-audit.md` + 6 张 baseline 截图 |
| UI-1 | Token 与 primitive 收敛 | [x] | CSS token、Button、Card、Badge、Dialog、Tooltip | commit `20a90d36` + typecheck + renderer build + 3 张 primitive 截图 |
| UI-2 | AppShell / Sidebar / Tab | [ ] | 三栏骨架、导航密度、多标签状态、右侧面板 | light / dark / 特殊主题截图 |
| UI-3 | Pipeline 工作台 | [ ] | StageRail、Records、Gate、失败 / 停止 / blocked 状态 | Pipeline 状态截图 + 键盘路径 |
| UI-4 | Agent 阅读与交互 | [ ] | Message、ToolActivity、Composer、Permission / AskUser / PlanMode | Agent 状态截图 + 后台权限路径 |
| UI-5 | Settings 管理界面 | [ ] | Settings primitives、渠道表单、Agent 配置、危险操作 | 表单错误 + danger dialog 截图 |
| UI-6 | Welcome / Chat 回退 / File Browser | [ ] | 空态、Chat 对齐、文件树和确认流 | 长尾页面截图 |
| UI-7 | 全局验收与收尾 | [ ] | 主题矩阵、a11y、回归、文档 Review | 总体验收记录 |

## 3. 阶段 UI-0：基线审计与截图准备

### 3.1 目标

建立可靠 before 基线，明确后续改动要解决的问题，避免 UI 优化变成主观调整。

### 3.2 范围

- 不改运行时代码。
- 可以新增截图目录、审计记录或文档补充。
- 只采集当前状态、问题、风险和验收样本。

### 3.3 任务清单

- [x] 检查 `git status --short`，确认开始前已有改动来源。
- [x] 阅读 `improve/ui/2026-05-16-client-ui-visual-spec.md` 第 2、4、9 章。
- [x] 确认截图目录约定：`improve/ui/screenshots/`。
- [x] 创建或准备 before 审计表，使用视觉规范 `9.10 Before / After 审计模板`。
- [x] 记录 Pipeline 当前状态：empty、running、gate、failed、stopped。
- [x] 记录 Agent 当前状态：empty、streaming、tool running、permission、PlanMode。
- [x] 记录 AppShell 当前状态：multi-tab、background running、blocked。
- [x] 记录 Settings 当前状态：channel form、validation error、danger dialog、update。
- [x] 记录 Welcome / Onboarding 当前状态：first run、config missing。
- [x] 记录 File Browser 当前状态：selected、hover、rename、delete confirm、empty folder。
- [x] 记录 Chat 回退当前状态：message list、composer、tool activity。
- [x] 按 P0 / P1 / P2 标注每个问题的影响等级。
- [x] 明确 UI-1 到 UI-6 的实际优先级是否需要调整。

### 3.4 验收标准

- [x] 每个主区域至少有一条 before 审计记录。
- [x] Pipeline、Agent、Settings 至少各有 light 和 dark 截图。
- [x] 所有 P0 / P1 问题都有涉及组件和验收方式。
- [x] 没有改动运行时代码。

### 3.5 验证

```bash
git diff --check
```

### 3.6 阶段 Review

- 状态：已完成，本阶段产物纳入 UI-0 单独提交。
- 完成日期：2026-05-16。
- 主要发现：Shell / MainArea / Sidebar surface 层级偏重；icon-only 按钮存在无可访问名称问题；Pipeline gate / review 状态色散落在页面组件；Agent 缺模型 blocked 态主动作分散；Settings 模型配置主次层级较乱；TutorialBanner 会遮挡核心工作区。
- P0 / P1 数量：P0 3 个，P1 6 个。
- 截图路径：`improve/ui/screenshots/ui0-before-pipeline-light-idle-desktop.png`、`ui0-before-pipeline-dark-idle-desktop.png`、`ui0-before-agent-light-empty-desktop.png`、`ui0-before-agent-dark-empty-desktop.png`、`ui0-before-settings-light-channel-form-desktop.png`、`ui0-before-settings-dark-channel-form-desktop.png`。
- 未覆盖状态：Pipeline running / gate / failed / stopped，Agent streaming / tool running / permission / PlanMode，Settings validation error / danger dialog / update，File Browser selected / hover / rename / delete confirm，Chat 回退 message list / composer / tool activity。
- 下一阶段调整：UI-1 仍优先做 token / primitive；UI-2 提前纳入 icon-only a11y 和 Tab / Sidebar indicator；UI-3 / UI-4 进入阶段时必须补真实状态截图 fixture。

## 4. 阶段 UI-1：Token 与 Primitive 收敛

### 4.1 目标

先统一最底层视觉语言，避免页面层重复写 class。此阶段完成后，按钮、卡片、状态、focus、dialog、tooltip 应该开始呈现同一系统感。

### 4.2 主要文件

- `apps/electron/src/renderer/styles/globals.css`
- `apps/electron/src/renderer/components/ui/button.tsx`
- `apps/electron/src/renderer/components/ui/`
- `apps/electron/src/renderer/components/settings/primitives/`
- 需要替换局部 class 的调用点

### 4.3 不包含

- 不重排 Pipeline / Agent 页面结构。
- 不改 IPC / preload / main 进程。
- 不引入新 UI 库。
- 不把特殊主题逻辑写进单个业务组件。

### 4.4 Token 任务

- [x] 对照视觉规范 `4.15 Design Token 契约`，列出现有 token 与缺失 token。
- [x] 增加或映射 surface token：app、panel、card、muted、elevated、modal。
- [x] 增加或映射 text token：primary、secondary、tertiary。
- [x] 增加或映射 border token：subtle、strong。
- [x] 增加或映射 focus ring token。
- [x] 增加或映射 status token 三件套：running / waiting / success / danger / neutral 的 bg、fg、border。
- [x] 增加或映射 radius token：control、card、panel。
- [x] 增加或映射 shadow token：card、panel、modal。
- [x] 增加或映射 motion token：fast、normal、slow。
- [x] 为 light、dark、ocean、forest、slate 等主题补 fallback。
- [x] 清理第一批裸 hex 或一次性颜色，迁移到 semantic token。

### 4.5 Primitive 任务

- [x] Button：统一 height、radius、focus-visible、disabled、loading 视觉。
- [x] Icon Button：统一 36px / 32px 尺寸，补 tooltip / `aria-label` 调用要求。
- [x] Card：统一 8px radius、padding、border / shadow 策略。
- [x] Badge：统一 soft background、icon + text、tabular numbers。
- [x] Dialog / AlertDialog：统一 16px radius、overlay、focus trap、motion。
- [x] Popover / Tooltip：统一 z-index、delay、字号、键盘触发。
- [x] Input / Textarea：统一 label、helper text、error、focus。
- [x] Notice / Banner：抽取或约定 running / waiting / failed / success 视觉。
- [x] Path / File / Model chip：建立可复用 class 或组件模式。

### 4.6 验收标准

- [x] 基础组件不再各自定义 radius / shadow / focus。
- [x] icon-only 按钮有明确 tooltip 和可访问名称策略。
- [x] 浅色、深色和至少一个特殊主题下 token 视觉不崩。
- [x] 没有新增裸 hex；如有，Review 中说明 token 化理由。
- [x] 不改变业务行为。

### 4.7 验证

```bash
bun run --filter='@rv-insights/electron' typecheck
git diff --check
```

截图建议：

- `improve/ui/screenshots/primitives-light-default-desktop.png`
- `improve/ui/screenshots/primitives-dark-default-desktop.png`
- `improve/ui/screenshots/primitives-ocean-status-desktop.png`

### 4.8 阶段 Review

- 状态：已完成，本阶段产物纳入 UI-1 单独提交。
- 完成日期：2026-05-16。
- 涉及文件：`globals.css`、`tailwind.config.js`、`components/ui/*` 基础 primitive、`components/settings/primitives/*`、`apps/electron/package.json`、`bun.lock`、primitive 截图。
- token 新增 / 映射：新增 surface / text / border / focus / status / radius / shadow / motion alias，并在 Tailwind 中暴露 `surface-*`、`text-*`、`status-*`、`rounded-card/control/panel`、`shadow-card/panel/modal`、`duration-fast/normal/slow/exit`。
- 裸色值清理：本阶段触达 primitive 已迁移到 semantic token；`globals.css` 中既有主题色、shell gradient、代码块和特殊主题覆盖仍保留，作为后续主题治理范围。
- 验证结果：`bun run --filter='@rv-insights/electron' typecheck` 通过；`bun run --filter='@rv-insights/electron' build:renderer` 通过，仅保留既有 chunk size warning；`bun install --frozen-lockfile --dry-run` 通过；`git diff --check` 通过。
- 截图路径：`improve/ui/screenshots/primitives-light-default-desktop.png`、`improve/ui/screenshots/primitives-dark-default-desktop.png`、`improve/ui/screenshots/primitives-ocean-status-desktop.png`。
- 残留风险：页面级 Pipeline / Agent / AppShell 仍有大量局部 class 和状态色，需要 UI-2 到 UI-4 按阶段迁移；本阶段未重排页面结构、未新增 IPC / public API / shared type。

## 5. 阶段 UI-2：AppShell / Sidebar / Tab

### 5.1 目标

统一桌面工作台骨架，让用户稳定识别当前模式、当前会话、当前 tab、后台运行和阻塞状态。

### 5.2 主要文件

- `apps/electron/src/renderer/components/app-shell/AppShell.tsx`
- `apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx`
- `apps/electron/src/renderer/components/pipeline/PipelineSidebar.tsx`
- `apps/electron/src/renderer/components/tabs/MainArea.tsx`
- `apps/electron/src/renderer/components/tabs/TabBar.tsx`
- `apps/electron/src/renderer/components/tabs/TabBarItem.tsx`
- `apps/electron/src/renderer/components/app-shell/RightSidePanel.tsx` 或同类文件

### 5.3 不包含

- 不改 Pipeline 内部 records / gate 实现。
- 不改 Agent message / composer 实现。
- 不新增 session 状态来源。

### 5.4 任务清单

- [ ] 对照视觉规范 `5.1 AppShell / Sidebar / Tab` 和 `5.8 页面级 Wireframe` 做 before 审计。
- [ ] 统一 LeftSidebar icon button 尺寸、hover、selected、focus。
- [ ] 统一 PipelineSidebar / 会话列表 item 高度、selected、running、blocked、failed indicator。
- [ ] ModeSwitcher 使用 primary token 或主题 token，不使用局部裸色。
- [ ] TabBar active tab 与 MainArea 层级连贯，非 active tab 降权。
- [ ] Tab running 使用细线或小点，不整块染色。
- [ ] Tab blocked 使用 amber indicator + tooltip。
- [ ] Tab failed 使用 danger indicator，并能定位对应会话或错误。
- [ ] Tab close button 有 `aria-label`，focus-visible 时可见。
- [ ] RightSidePanel 与 MainArea 使用同级 surface，不做嵌套装饰卡片。
- [ ] 窄窗口下优先收起右侧面板，再压缩 session sidebar。
- [ ] Toast / tooltip / dialog 不遮挡 gate 或 permission 主按钮。

### 5.5 验收标准

- [ ] 3 秒内能辨认当前处于 Pipeline 还是 Agent。
- [ ] 当前 session、当前 tab、后台运行状态可见。
- [ ] 多 tab、blocked、failed 状态在 light / dark 下可读。
- [ ] Sidebar / Tab keyboard focus 清楚可见。
- [ ] 无明显水平滚动或文本溢出。

### 5.6 验证

```bash
bun run --filter='@rv-insights/electron' typecheck
git diff --check
```

手动路径：

- [ ] 用键盘从 LeftSidebar 切换 Pipeline / Agent。
- [ ] 打开多个 tab，关闭其中一个 tab。
- [ ] 模拟或观察后台 running / blocked / failed indicator。
- [ ] 缩小窗口，检查右侧面板和主内容。

截图建议：

- `improve/ui/screenshots/appshell-light-multi-tab-desktop.png`
- `improve/ui/screenshots/appshell-dark-background-running-desktop.png`
- `improve/ui/screenshots/appshell-forest-blocked-desktop.png`

### 5.7 阶段 Review

- 状态：
- 完成日期：
- 涉及文件：
- 状态 indicator 改动：
- 键盘路径结果：
- 截图路径：
- 未覆盖窗口尺寸：

## 6. 阶段 UI-3：Pipeline 工作台

### 6.1 目标

把 Pipeline 从“记录查看器”强化为贡献工作流控制台。用户应能快速判断当前阶段、等待谁处理、失败原因和下一步恢复路径。

### 6.2 主要文件

- `apps/electron/src/renderer/components/pipeline/PipelineView.tsx`
- `apps/electron/src/renderer/components/pipeline/PipelineHeader.tsx`
- `apps/electron/src/renderer/components/pipeline/PipelineStageRail.tsx`
- `apps/electron/src/renderer/components/pipeline/PipelineRecords.tsx`
- `apps/electron/src/renderer/components/pipeline/PipelineGateCard.tsx`
- `apps/electron/src/renderer/components/pipeline/PipelineComposer.tsx`
- `apps/electron/src/renderer/atoms/pipeline-atoms.ts`，仅在必须修正 UI 状态派生时涉及

### 6.3 不包含

- 不改 LangGraph 编排。
- 不改主进程 Pipeline 业务状态。
- 不改远端写安全 gate 语义。
- 不新增 IPC，除非独立评审。

### 6.4 StageRail 任务

- [ ] 节点标签使用用户可读中文，不直接暴露 raw enum。
- [ ] 阶段状态统一映射 idle、running、waiting、blocked、success、failed、stopped。
- [ ] 连接线表达完成进度，失败和 waiting 视觉明确。
- [ ] 阶段可点击定位 records 时具备 focus ring 和 `aria-label`。
- [ ] 长阶段名或窄窗口下不溢出。

### 6.5 Records 任务

- [ ] 按阶段聚合或强化阶段标识。
- [ ] 区分 user input、node start、output、artifact、gate、error、stop / resume。
- [ ] live output 区分“节点已启动但模型暂未输出”和“已有模型输出”。
- [ ] 长日志默认折叠，产物和失败摘要默认展开。
- [ ] 路径、命令、耗时使用 monospace / tabular numbers。
- [ ] 复制、定位、打开产物等 icon-only 操作补 tooltip 和 `aria-label`。

### 6.6 Gate / Review 任务

- [ ] Gate 面板固定在右侧操作区优先展示。
- [ ] `plan_review` 展示计划摘要、风险、修改范围、Approve / Request changes。
- [ ] `document_review` 展示文档或测试证据、阻塞原因输入和通过条件。
- [ ] `submission_review` 展示本地 commit / 远端 PR 预览、风险确认和二次确认。
- [ ] `remote_write_confirmation` 使用高风险视觉，展示 remote、branch、commit、PR title。
- [ ] Approve、Reject、Rerun、Request changes 的视觉权重不同。
- [ ] 反馈输入有 label，不只靠 placeholder。

### 6.7 失败 / 停止 / 空态任务

- [ ] 失败卡片展示失败阶段、可读原因、最近输出摘要、详情折叠、恢复动作。
- [ ] 停止中按钮立即变为“正在停止...”。
- [ ] 已停止使用 neutral notice，不使用 failed 视觉。
- [ ] 无会话时提供“新建 Pipeline”主动作。
- [ ] 配置缺失时直接链接 Settings 对应 tab。

### 6.8 验收标准

- [ ] 用户 5 秒内能判断当前阶段、是否等待人工处理、失败下一步。
- [ ] Pipeline running / waiting / failed / stopped 状态语义一致。
- [ ] Gate 操作可键盘完成。
- [ ] 高风险 gate 不隐藏风险文本。
- [ ] 没有因为 UI 改动影响 Pipeline 状态推进。

### 6.9 验证

```bash
bun run --filter='@rv-insights/electron' typecheck
git diff --check
```

建议补充：

- [ ] 若有相关测试，运行 Pipeline renderer / atom 聚焦测试。
- [ ] 手动验证 start、stop、gate approve / reject、failed、resume。

截图建议：

- `improve/ui/screenshots/pipeline-light-empty-desktop.png`
- `improve/ui/screenshots/pipeline-light-running-desktop.png`
- `improve/ui/screenshots/pipeline-dark-gate-desktop.png`
- `improve/ui/screenshots/pipeline-dark-failed-desktop.png`
- `improve/ui/screenshots/pipeline-slate-stopped-desktop.png`

### 6.10 阶段 Review

- 状态：
- 完成日期：
- 涉及文件：
- Gate 类型覆盖：
- 手动路径结果：
- 截图路径：
- 未覆盖状态：
- 残留风险：

## 7. 阶段 UI-4：Agent 阅读与交互

### 7.1 目标

优化 Agent 长文本阅读、工具透明度、权限请求、AskUser、PlanMode 和输入区稳定性。用户应能清楚分辨“Agent 正在生成”“工具正在跑”“应用在等用户授权”。

### 7.2 主要文件

- `apps/electron/src/renderer/components/agent/AgentView.tsx`
- `apps/electron/src/renderer/components/agent/AgentHeader.tsx`
- `apps/electron/src/renderer/components/agent/AgentMessages.tsx`
- `apps/electron/src/renderer/components/agent/ToolActivityItem.tsx`
- `apps/electron/src/renderer/components/agent/PermissionBanner.tsx`
- `apps/electron/src/renderer/components/agent/AskUserBanner.tsx`
- `apps/electron/src/renderer/components/agent/WorkspaceSelector.tsx`
- `apps/electron/src/renderer/components/ai-elements/`
- `apps/electron/src/renderer/atoms/agent-atoms.ts`，仅在必须修正 UI 派生状态时涉及

### 7.3 不包含

- 不改 Agent SDK 编排。
- 不改权限服务语义。
- 不改主进程消息持久化。
- 不新增 provider 或模型配置。

### 7.4 Message 任务

- [ ] 用户消息和 Agent 消息角色区分克制但清晰。
- [ ] Agent 长回复阅读宽度稳定，代码块和表格可更宽。
- [ ] Reasoning / thinking 默认折叠，显示摘要和耗时。
- [ ] Markdown、CodeBlock、Mermaid、文件引用层级一致。
- [ ] 消息 action：复制、重试、继续、引用具备 tooltip 和 focus。
- [ ] 长模型名、路径、文件名有 truncate 和完整查看方式。

### 7.5 ToolActivity 任务

- [ ] 工具活动状态统一 running、success、warning、error、background。
- [ ] running 显示 spinner 和 elapsed time。
- [ ] 失败工具默认展开摘要，完整输出折叠。
- [ ] 工具输入输出中的路径、命令、文件名使用 monospace / chip。
- [ ] 后台任务有入口进入 BackgroundTasksPanel 或等价位置。

### 7.6 Composer 任务

- [ ] Composer 底部高度稳定，不因附件、建议、PlanMode 大幅跳动。
- [ ] 附件 chip 可读、可删除、可键盘操作。
- [ ] 发送 / 停止 / 附件 / 文件夹 / 思考模式 / 权限模式使用统一 icon button。
- [ ] disabled 状态说明原因，例如“请选择工作区”。
- [ ] sending 状态保留用户输入上下文，不丢失未发送附件。

### 7.7 Banner 任务

- [ ] Permission、AskUser、ExitPlanMode、PlanMode 统一为 banner 组件族或统一视觉语言。
- [ ] Permission 展示工具名、路径 / 命令摘要、风险级别和允许方式。
- [ ] AskUser 展示问题原文、回答输入和发送动作，不和普通 Composer 混淆。
- [ ] ExitPlanMode 展示计划摘要和“继续执行 / 修改计划”。
- [ ] 后台会话 permission 在 Sidebar / TabBar 有 amber indicator。
- [ ] Banner 有 `aria-live` 或等价可感知文本。

### 7.8 验收标准

- [ ] 用户能分清生成中、工具运行、权限等待、AskUser、PlanMode。
- [ ] 工具失败原因无需展开完整日志即可理解。
- [ ] Composer 在多状态切换时没有明显布局跳动。
- [ ] 后台权限请求不会丢失或不可发现。
- [ ] 不改变 Agent 事件流和持久化语义。

### 7.9 验证

```bash
bun run --filter='@rv-insights/electron' typecheck
git diff --check
```

手动路径：

- [ ] 发送普通 Agent 消息。
- [ ] 触发工具调用并观察 running / success。
- [ ] 触发工具失败并观察摘要。
- [ ] 触发 permission，切换到其他 tab，再切回处理。
- [ ] 触发 AskUser 并提交回答。
- [ ] 进入 / 退出 PlanMode。

截图建议：

- `improve/ui/screenshots/agent-light-empty-desktop.png`
- `improve/ui/screenshots/agent-light-streaming-desktop.png`
- `improve/ui/screenshots/agent-dark-tool-running-desktop.png`
- `improve/ui/screenshots/agent-ocean-permission-desktop.png`
- `improve/ui/screenshots/agent-ocean-planmode-desktop.png`

### 7.10 阶段 Review

- 状态：
- 完成日期：
- 涉及文件：
- Banner 类型覆盖：
- 手动路径结果：
- 截图路径：
- 未覆盖状态：
- 残留风险：

## 8. 阶段 UI-5：Settings 管理界面

### 8.1 目标

把 Settings 统一成高密度、稳定、可恢复的管理界面，减少卡片堆叠感，强化表单反馈和危险操作确认。

### 8.2 主要文件

- `apps/electron/src/renderer/components/settings/`
- `apps/electron/src/renderer/components/settings/primitives/`
- `apps/electron/src/renderer/atoms/settings-tab.ts`
- `apps/electron/src/renderer/atoms/theme.ts`
- 相关 UI primitive 调用点

### 8.3 不包含

- 不新增设置项，除非用户另行要求。
- 不改配置文件结构。
- 不改 channel-manager / settings-service 业务逻辑。
- 不新增 API Key 存储方案。

### 8.4 Dialog / Navigation 任务

- [ ] SettingsDialog 宽度、最大高度、scroll 容器稳定。
- [ ] 左侧导航固定宽度，当前 tab 高亮明确。
- [ ] tab 有问题状态时使用小状态点 + tooltip。
- [ ] Dialog title 只显示当前 tab，不堆过多说明。
- [ ] Esc / close / unsaved guard 行为清楚。

### 8.5 Primitive 任务

- [ ] SettingsSection 作为一级信息分组。
- [ ] SettingsCard 不再嵌套装饰卡片。
- [ ] SettingsRow 左侧 label + description，右侧 control；窄宽时可换行。
- [ ] Secret / API Key / Base URL / MCP command 有 label 和 helper text。
- [ ] 字段错误显示在字段附近。
- [ ] 保存中、测试中、成功、失败 inline feedback 一致。

### 8.6 Tab 任务

- [ ] General：用户档案、头像、基础设置层级清楚。
- [ ] Appearance：主题预览、系统跟随、密度选项即时可见。
- [ ] Channels：Provider、模型、API Key、Base URL、连接测试反馈就近展示。
- [ ] Agent：默认渠道、工作区、MCP、Skills 强调本地路径和来源。
- [ ] Feishu / Integrations：授权状态、同步目标、重新认证入口清楚。
- [ ] About / Update：版本、更新状态、下载进度、重启安装一致。

### 8.7 危险操作任务

- [ ] 删除渠道、重置配置、清空数据等进入 AlertDialog。
- [ ] AlertDialog 文案说明影响范围。
- [ ] cancel 作为默认安全焦点。
- [ ] destructive 操作 loading 时不能重复点击。
- [ ] API Key / token 不在截图、日志或 UI 默认层明文展示。

### 8.8 验收标准

- [ ] Settings 长内容滚动自然，导航仍清楚。
- [ ] 表单错误就近展示，用户输入不丢失。
- [ ] 危险操作有明确二次确认。
- [ ] light / dark / slate 下表单可读。
- [ ] 不改变配置存储结构。

### 8.9 验证

```bash
bun run --filter='@rv-insights/electron' typecheck
git diff --check
```

手动路径：

- [ ] 切换 Settings tab。
- [ ] 编辑渠道表单并触发连接测试失败。
- [ ] 保存外观设置。
- [ ] 打开危险删除确认并取消。
- [ ] 窄窗口检查 SettingsRow 换行。

截图建议：

- `improve/ui/screenshots/settings-light-channel-form-desktop.png`
- `improve/ui/screenshots/settings-dark-validation-error-desktop.png`
- `improve/ui/screenshots/settings-slate-danger-dialog-desktop.png`
- `improve/ui/screenshots/settings-slate-update-desktop.png`

### 8.10 阶段 Review

- 状态：
- 完成日期：
- 涉及文件：
- 表单覆盖：
- 危险操作覆盖：
- 验证结果：
- 截图路径：
- 残留风险：

## 9. 阶段 UI-6：Welcome / Chat 回退 / File Browser

### 9.1 目标

补齐长尾页面一致性，让首次使用、隐藏 Chat 回退和文件浏览器不再像不同历史时期的界面。

### 9.2 主要文件

- Welcome / Onboarding 相关 renderer 入口组件
- `apps/electron/src/renderer/components/chat/`
- `apps/electron/src/renderer/components/file-browser/FileBrowser.tsx`
- `apps/electron/src/renderer/components/ai-elements/`

### 9.3 不包含

- 不恢复 Chat 为公开主入口。
- 不改文件系统权限或主进程文件读写规则。
- 不新增 onboarding 业务流程。

### 9.4 Welcome / Onboarding 任务

- [ ] 第一屏聚焦完成环境、模型配置后开始 Pipeline / Agent。
- [ ] 空态最多 2 到 3 个直接动作。
- [ ] 环境检查失败时优先展示问题和修复入口。
- [ ] 不使用营销式 hero、大面积渐变或说明卡片堆叠。
- [ ] 新用户不配置所有高级功能也能开始最小可用流程。

### 9.5 Chat 回退任务

- [ ] ChatInput 对齐 Agent Composer 尺寸、边框、工具栏语言。
- [ ] ChatMessage 对齐 Agent message primitive。
- [ ] Chat 工具活动使用 Agent ToolActivity 状态色和折叠规则。
- [ ] parallel mode、thinking、system prompt 使用 secondary 控件。
- [ ] Chat 空态说明隐藏回退定位，但不贬低功能。

### 9.6 File Browser 任务

- [ ] 文件树行高 28px 到 32px，hover / selected / focus 清楚。
- [ ] tree / treeitem 语义清楚，键盘可展开折叠。
- [ ] 行内 actions 在 hover 和 focus-visible 时出现。
- [ ] Modified by Agent 使用 indicator + tooltip。
- [ ] path chip 使用 monospace，中间省略，hover 展示完整路径。
- [ ] DropZone 可拖入 / 不可拖入状态不同。
- [ ] 删除、重命名前展示完整路径并使用 AlertDialog。
- [ ] 大文件树滚动时行高稳定。

### 9.7 验收标准

- [ ] Welcome 到配置到创建 Pipeline 路径清楚。
- [ ] Chat 回退和 Agent 不再视觉割裂。
- [ ] File Browser 可键盘操作，删除 / 重命名有确认。
- [ ] 文件路径和长文件名不溢出。
- [ ] 不改变文件读写安全边界。

### 9.8 验证

```bash
bun run --filter='@rv-insights/electron' typecheck
git diff --check
```

手动路径：

- [ ] 首次或空状态进入 Welcome。
- [ ] 从 Welcome 进入 Settings / Pipeline / Agent。
- [ ] 打开 Chat 回退并发送或查看消息。
- [ ] File Browser 展开目录、选中文件、添加到上下文。
- [ ] File Browser 删除文件并取消。

截图建议：

- `improve/ui/screenshots/welcome-light-first-run-desktop.png`
- `improve/ui/screenshots/welcome-dark-config-missing-desktop.png`
- `improve/ui/screenshots/chat-slate-message-list-desktop.png`
- `improve/ui/screenshots/chat-slate-tool-activity-desktop.png`
- `improve/ui/screenshots/file-browser-forest-selected-desktop.png`
- `improve/ui/screenshots/file-browser-forest-delete-confirm-desktop.png`

### 9.9 阶段 Review

- 状态：
- 完成日期：
- 涉及文件：
- 长尾页面覆盖：
- 键盘路径结果：
- 截图路径：
- 残留风险：

## 10. 阶段 UI-7：全局验收与收尾

### 10.1 目标

验证全客户端 UI 优化作为一个整体成立，完成视觉、可访问性、类型、截图和文档收口。

### 10.2 任务清单

- [ ] 检查所有阶段 Review 是否填写。
- [ ] 检查所有 P0 问题是否关闭。
- [ ] 检查 P1 问题是否关闭或有明确暂缓原因。
- [ ] 检查 token 是否覆盖 light、dark、特殊主题 fallback。
- [ ] 检查没有新增未解释的裸 hex。
- [ ] 检查 icon-only 按钮是否有 tooltip 和 `aria-label`。
- [ ] 检查状态色是否都有 icon 或文本辅助。
- [ ] 检查 Dialog 是否有 title、focus trap、Esc / cancel 路径。
- [ ] 检查 File Browser、Sidebar、TabBar、Settings nav 的键盘路径。
- [ ] 检查 reduced motion 下主要动效可降级。
- [ ] 检查长文件名、长模型名、长 session title、长错误文本不溢出。
- [ ] 检查 Pipeline、Agent、Settings 在 light / dark 下截图齐全。
- [ ] 检查至少一个特殊主题下 AppShell、Pipeline、Agent、File Browser。
- [ ] 运行最终 typecheck。
- [ ] 运行 `git diff --check`。
- [ ] 若有行为测试改动，运行相关 focused tests。
- [ ] 更新本清单总览状态。
- [ ] 在 `tasks/todo.md` 追加最终 Review。
- [ ] 如用户允许，再考虑 README / AGENTS 是否需要同步 UI 状态说明。

### 10.3 总体验收命令

```bash
bun run --filter='@rv-insights/electron' typecheck
git diff --check
```

可选：

```bash
bun test
```

说明：若全量 `bun test` 仍受既有 Electron named export 测试环境问题影响，应在 Review 中明确区分既有失败和本轮 UI 改动风险。

### 10.4 截图矩阵

| 页面 | Light | Dark | 特殊主题 | 状态 |
| --- | --- | --- | --- | --- |
| Pipeline | [ ] | [ ] | [ ] | empty、running、gate、failed、stopped |
| Agent | [ ] | [ ] | [ ] | empty、streaming、tool running、permission、PlanMode |
| AppShell | [ ] | [ ] | [ ] | multi-tab、background running、blocked |
| Settings | [ ] | [ ] | [ ] | channel form、validation error、danger dialog、update |
| Welcome | [ ] | [ ] | [ ] | first run、config missing |
| File Browser | [ ] | [ ] | [ ] | selected、hover、rename、delete confirm、empty folder |
| Chat 回退 | [ ] | [ ] | [ ] | message list、composer、tool activity |

### 10.5 最终 Review

- 状态：
- 完成日期：
- 完成阶段：
- 未完成阶段：
- 验证命令：
- 截图目录：
- P0 / P1 残留：
- 已知风险：
- 后续建议：

## 11. Before / After 审计记录模板

每个具体改动开始前复制此模板。

| 字段 | 内容 |
| --- | --- |
| 页面 / 组件 |  |
| 当前问题 |  |
| 影响等级 | P0 / P1 / P2 |
| Before 截图 |  |
| 目标体验 |  |
| 方案摘要 |  |
| 涉及文件 |  |
| After 截图 |  |
| 验收方式 |  |
| 残留风险 |  |

## 12. 阶段提交建议

建议后续按阶段形成独立提交：

| 阶段 | 建议提交信息 |
| --- | --- |
| UI-0 | `docs(ui): 建立客户端 UI 基线审计` |
| UI-1 | `style(ui): 收敛客户端视觉 token 与基础组件` |
| UI-2 | `style(ui): 统一 AppShell 导航与标签状态` |
| UI-3 | `style(pipeline): 优化 Pipeline 工作台状态层级` |
| UI-4 | `style(agent): 优化 Agent 消息工具与交互状态` |
| UI-5 | `style(settings): 统一设置界面表单与危险操作` |
| UI-6 | `style(ui): 对齐 Welcome Chat 与 File Browser 体验` |
| UI-7 | `test(ui): 完成客户端 UI 视觉验收收口` |

提交边界：

- 每个提交只包含当前阶段相关文件。
- 不把截图或大型产物加入提交，除非团队明确希望保留截图基线。
- 不提交 `patch-work/**`。
- 不执行 push / PR，除非用户明确要求。

## 13. 风险登记

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| token 改动影响所有主题 | 高 | 先做 UI-0 截图，UI-1 每个主题抽样检查 |
| primitive 改动造成页面布局回归 | 高 | 小步修改，先改 variant，再逐页替换 |
| Pipeline / Agent 状态视觉和真实状态不一致 | 高 | 不改变状态来源，只改映射和展示；必要时补聚焦测试 |
| Settings 表单改造误伤保存逻辑 | 中 | 表单交互和存储逻辑分离，运行 focused 测试 |
| 截图包含 API Key / 本地隐私路径 | 高 | 截图前脱敏或使用测试配置 |
| 一次性重构过大难回滚 | 高 | 按 UI-1 到 UI-7 分阶段提交 |

## 14. 当前启动提示

后续从当前 UI 进度继续时建议按此顺序启动：

1. 阅读 `tasks/lessons.md`。
2. 阅读本清单和 `2026-05-16-client-ui-visual-spec.md`。
3. 执行 `git status --short`。
4. 如果看到 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`，先确认它是否为编辑器残留；不要把它纳入提交。
5. 如果看到 `.DS_Store` 修改，默认视为系统文件噪音；不要纳入 UI 阶段提交。
6. 确认当前阶段提交已存在：UI-0 `61c263c8`，UI-1 `20a90d36`。
7. 从 UI-2 AppShell / Sidebar / Tab 开始；先做 UI-2 before 审计，再实现，不跳到 UI-3。
8. UI-2 完成后再进入 UI-3 Pipeline 工作台；用户截图红框区域主要属于 UI-3 范围。
9. 每阶段完成后更新本清单、追加 Review、运行验证并单独提交。

### 14.1 下次启动提示词

```text
你正在 RV-Insights 仓库继续推进全客户端 UI 优化。

请先阅读并遵守：
- AGENTS.md
- tasks/lessons.md
- tasks/todo.md
- improve/ui/2026-05-16-client-ui-visual-spec.md
- improve/ui/2026-05-16-client-ui-implementation-checklist.md

当前进度：
1. UI 文档基线已完成并提交，commit 为 7bef500c984803525e9c7fac67d2c959271d2a1c，提交标题为 docs(ui): 新增客户端 UI 视觉规范与迭代清单。
2. UI-0「基线审计与截图准备」已完成并提交，commit 为 61c263c80bf98169b64b40c6bddc79bc7873b8fd，提交标题为 docs(ui): 完成 UI-0 基线审计与截图。
3. UI-1「Token 与 primitive 收敛」已完成并提交，commit 为 20a90d3679147dd27c035d9c957546823924ac4b，提交标题为 feat(ui): 完成 UI-1 token 与 primitive 收敛。
4. 已完成：UI-0、UI-1。未完成：UI-2、UI-3、UI-4、UI-5、UI-6、UI-7。
5. 重要澄清：UI-1 只完成 token、Tailwind 映射和基础 primitive 收敛，不是用户可见主界面 redesign；重启客户端后 Pipeline 主界面、左侧栏、阶段栏、任务输入区和阶段产物区基本不会明显变化。
6. 当前工作区可能存在未提交临时文件 improve/ui/.2026-05-16-client-ui-visual-spec.md.swp，以及 .DS_Store 修改；它们不是 UI 阶段成果，不要纳入提交，先确认来源并保护用户变更。

请从 UI-2「AppShell / Sidebar / Tab」开始：
1. 先执行 git status --short，保护已有用户变更。
2. 阅读 implementation checklist 的 UI-2 阶段和视觉规范 `5.1 AppShell / Sidebar / Tab`、`5.8 页面级 Wireframe`。
3. 先做 UI-2 before 审计，再实现 AppShell、LeftSidebar、PipelineSidebar、TabBar / TabBarItem、MainArea、RightSidePanel 的视觉和状态收敛。
4. 不要跳过 UI-2 直接进入 UI-3；用户截图红框内 Pipeline 主面板属于 UI-3，需在 UI-2 完成后再改。
5. 本轮仍遵守 Jotai、Radix/shadcn 风格组件、Lucide 图标、现有主题 token、本地 JSON/JSONL 存储的约束。
6. 不新增 public API / IPC / shared type，除非单独评审；不修改 README / AGENTS，除非用户明确允许。
7. UI-2 完成定义：当前模式、当前 session、当前 tab、后台 running / blocked / failed 状态可见；Sidebar / Tab keyboard focus 清楚；light / dark / 至少一个特殊主题下无明显溢出。
8. 验证：至少运行 bun run --filter='@rv-insights/electron' typecheck、git diff --check，并采集 UI-2 light / dark / 特殊主题截图。
9. 每完成一个阶段并通过该阶段验证后，立即更新 checklist 和 tasks/todo.md 的 Review，并单独提交该阶段成果；不执行 push / PR，除非用户明确要求。
```
