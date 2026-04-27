# RV-Insights vs ScienceClaw — 前端实现差距分析报告

> **生成日期**: 2026-04-27  
> **对比范围**: 前端代码（Vue 3 + TypeScript + Vite）

---

## 目录

- [一、概览对比](#一概览对比)
- [二、SSE 实时通信差距](#二sse-实时通信差距)
- [三、UI 组件丰富度差距](#三ui-组件丰富度差距)
- [四、代码展示能力差距](#四代码展示能力差距)
- [五、沙箱与终端体验差距](#五沙箱与终端体验差距)
- [六、页面与路由差距](#六页面与路由差距)
- [七、依赖生态差距](#七依赖生态差距)
- [八、迁移建议](#八迁移建议)

---

## 一、概览对比

| 维度 | RV-Insights | ScienceClaw | 差距等级 |
|------|-------------|-------------|---------|
| **技术栈** | Vue 3 + Vite + TS + Pinia + Tailwind | Vue 3 + Vite + TS + Tailwind | 基本一致 |
| **页面数量** | 4 个页面 | 14 个页面 | 🔴 大 |
| **SSE 事件类型** | 5 种 | 13+ 种 | 🔴 大 |
| **流式输出** | 无（事件级推送） | Token-by-token 打字机效果 | 🔴 大 |
| **代码编辑器** | 无 | Monaco Editor（多语言） | 🔴 大 |
| **语法高亮** | 无 | highlight.js | 🟠 中 |
| **沙箱终端** | 无 | xterm.js | 🔴 大 |
| **远程桌面** | 无 | noVNC | 🔴 大 |
| **消息渲染** | 基础文本 | Markdown + KaTeX + Mermaid + DOMPurify | 🟠 中 |
| **设置系统** | 无 | 12 个设置组件 | 🟠 中 |

**结论**：两者技术栈完全一致（Vue 3 生态），但 ScienceClaw 在前端功能深度和组件丰富度上远超 RV-Insights。RV-Insights 当前前端是**面向 Pipeline 审批的专用 UI**，ScienceClaw 是**面向通用 AI Agent 交互的完整工作台**。

---

## 二、SSE 实时通信差距

### RV-Insights 实现

```
api/client.ts ──→ composables/useCaseEvents.ts ──→ CaseDetailPage.vue
     ↑                                              ↓
  @microsoft/fetch-event-source              AgentEventLog.vue
```

**特点**：
- 5 个事件类型：`stage_change` / `agent_output` / `review_request` / `error` / `completed`
- `agent_output` 内部再分 `thinking` / `tool_call` / `tool_result`，但统一走一个事件类型
- 无 token 流式输出，事件到达即完整渲染
- Mock 模式下 `setInterval` 每 800ms 推送一个预设事件
- **断线后不会自动重连**
- 连接状态通过左侧栏小圆点展示（绿色 = Live / 灰色 = Disconnected）

### ScienceClaw 实现

```
api/client.ts ──→ ChatPage.vue ──→ 事件分发器
     ↑                                ├──→ ChatMessage (message_chunk)
  createSSEConnection<T>()            ├──→ ActivityPanel (thinking/tool/plan)
  ├── 401 自动 refresh token          └──→ SandboxPreview (sandbox tool)
  ├── AbortController 取消
  └── 10min 超时自动断连
```

**特点**：
- 13+ 个独立事件类型：`message` / `message_chunk` / `message_chunk_done` / `tool` / `step` / `thinking` / `plan` / `done` / `error` / `title` / `wait` / `skill_save_prompt` / `tool_save_prompt`
- **Token-by-token 流式输出**：`message_chunk` 事件逐 token 追加到 assistant 消息，实现打字机效果
- **断线重连**：恢复 session 时检测 RUNNING 状态，自动重连 SSE
- **Token 刷新**：401 时自动 refresh token 并重连
- **超时控制**：10 分钟无事件自动断连
- **混合策略**：SSE 实时推送 + 关键事件触发 HTTP 重新拉取数据（两者相同）

### 核心差距

| 能力 | RV-Insights | ScienceClaw |
|------|-------------|-------------|
| 事件粒度 | 粗（5 类型，agent_output 内部分类） | 细（13+ 独立类型） |
| 流式输出 | ❌ 无 | ✅ Token-by-token 打字机 |
| 自动重连 | ❌ 无 | ✅ 检测 RUNNING 状态自动重连 |
| Token 刷新 | ❌ 无 | ✅ 401 自动 refresh + 重连 |
| 超时控制 | ❌ 无 | ✅ 10min 无事件自动断连 |

**影响**：RV-Insights 的 SSE 只能做"阶段级"状态同步，无法展示 Agent 思考过程；ScienceClaw 的 SSE 可以实时展示 Agent 的每一个 token、每一次工具调用、每一个计划更新。

---

## 三、UI 组件丰富度差距

### RV-Insights 组件清单

```
views/
  ├── LoginPage.vue          # 登录/注册双 Tab
  ├── MainLayout.vue         # 侧边栏 + 路由出口
  ├── CaseListPage.vue       # 列表 + 筛选 + 分页 + 新建弹窗
  └── CaseDetailPage.vue     # 三栏布局：Pipeline | Events | Review

components/
  ├── AgentEventLog.vue      # 事件日志（7 种事件图标+颜色）
  ├── CaseStatusBadge.vue    # 状态徽章（12 种颜色映射）
  └── pipeline/
      ├── PipelineView.vue   # 5 阶段流水线容器
      ├── StageNode.vue      # 单个阶段节点（5 状态 + 动画）
      └── ReviewPanel.vue    # 审核面板（Approve/Reject/Abandon）
```

**共 9 个业务组件**，功能聚焦在 Pipeline 审批流程。

### ScienceClaw 组件清单

```
pages/ (14 个页面)
  ├── ChatPage.vue           # 核心聊天页面（SSE 分发中心）
  ├── HomePage.vue           # 首页
  ├── LoginPage.vue          # 登录
  ├── SharePage.vue          # 会话分享
  ├── TasksPage.vue          # 任务管理
  ├── TasksListPage.vue      # 任务列表
  ├── TaskConfigPage.vue     # 任务配置
  ├── ToolsPage.vue          # 工具市场
  ├── ToolDetailPage.vue     # 工具详情
  ├── SkillsPage.vue         # 技能市场
  ├── SkillDetailPage.vue    # 技能详情
  ├── ScienceToolDetail.vue  # 科研工具详情
  ├── MainLayout.vue         # 主布局
  └── ShareLayout.vue        # 分享页布局

components/ (38+ 个组件)
  ├── ChatMessage.vue        # 消息渲染（Markdown + KaTeX + Mermaid + hljs + DOMPurify）
  ├── ActivityPanel.vue      # Cursor 风格三段式：Thinking + Plan + Tools
  ├── MarkdownEnhancements.vue  # 图片 Lightbox + 代码全屏 + 文字选中菜单
  ├── SuggestedQuestions.vue    # AI 建议问题
  ├── PlanPanel.vue             # 任务计划面板
  ├── MoleculeViewer.vue        # 3Dmol.js 3D 分子可视化
  ├── SandboxPreview.vue        # 沙箱预览（Terminal + Browser 双 Tab）
  ├── SandboxTerminal.vue       # xterm.js 终端模拟器
  ├── VNCViewer.vue             # noVNC 远程桌面
  ├── TakeOverView.vue          # VNC 全屏接管模式
  ├── FileViewer.vue            # 文件查看器
  ├── FileToolView.vue          # 文件工具视图（Monaco 渲染）
  ├── ShellToolView.vue         # Shell 执行结果展示
  ├── BrowserToolView.vue       # 浏览器截图 + VNC 实时
  ├── SearchToolView.vue        # 搜索结果结构化展示
  └── settings/ (12 个设置组件)
      ├── ModelSettings.vue
      ├── AccountSettings.vue
      ├── ProfileSettings.vue
      ├── PersonalizationSettings.vue
      ├── TaskSettings.vue
      ├── TokenStatistics.vue
      ├── WeChatBotSettings.vue
      ├── LarkBindingSettings.vue
      ├── IMSettings.vue
      ├── NotificationSettings.vue
      ├── GeneralSettings.vue
      └── ChangePassword.vue
```

**共 50+ 个业务组件**，覆盖聊天、任务、工具、技能、设置、沙箱等完整工作台。

### 核心差距组件

#### 1. ActivityPanel（Cursor 风格推理面板）

ScienceClaw 的 `ActivityPanel.vue` 是其前端最大亮点，实现 Cursor IDE 风格的三段式 Agent 交互面板：

```
┌─────────────────────────────────────┐
│  🤔 Thinking                        │  ← 实时追加的思考过程
│  正在分析 arch/riscv/kernel/...     │
├─────────────────────────────────────┤
│  📋 To-dos (2/5)                    │  ← 计划进度条
│  [=====>    ] 40%                   │
├─────────────────────────────────────┤
│  🔧 Tools                            │  ← 工具调用时间线
│  ├─ bash (calling...)               │
│  ├─ read_file (called • 1.2s)       │
│  └─ grep (called • 0.8s)            │
│     [展开 Input / Output]           │
└─────────────────────────────────────┘
```

RV-Insights 的 `AgentEventLog.vue` 是线性事件列表，无结构化分组和实时进度展示。

#### 2. MarkdownEnhancements（富媒体增强）

ScienceClaw 的 `MarkdownEnhancements.vue` 提供：
- **图片 Lightbox**：点击放大、拖拽、滚轮缩放
- **代码块全屏**：点击全屏查看代码
- **文字选中浮动菜单**：选中文字后弹出复制/搜索/翻译按钮
- **XSS 防护**：DOMPurify 过滤危险内容

RV-Insights 无任何富媒体增强，事件 body 直接 `<pre>` 渲染。

#### 3. SandboxPreview（沙箱预览）

ScienceClaw 在 ActivityPanel 底部嵌入沙箱预览，自动检测 sandbox 工具并切换 Terminal/Browser tab：
- Terminal tab：展示 xterm.js 终端输出
- Browser tab：展示 noVNC 浏览器实时画面

RV-Insights 完全无沙箱相关 UI。

---

## 四、代码展示能力差距

### RV-Insights

当前代码展示极为基础：

```vue
<!-- AgentEventLog.vue -->
<pre class="font-mono text-xs">{{ JSON.stringify(event.data, null, 2) }}</pre>
```

- 无语法高亮（无 Shiki / Prism / highlight.js）
- 无 diff 视图（DevelopmentResult 有 `patch_files` 字段，但前端未渲染）
- 无代码编辑器（无 Monaco Editor）
- 事件数据直接 JSON 序列化展示

### ScienceClaw

```
MonacoEditor.vue ──→ 多语言支持（JS/TS/HTML/CSS/Python/Java/Go/Markdown/JSON）
     ├── 根据文件扩展名自动推断语言
     ├── readOnly / editable 模式切换
     ├── minimap、wordWrap、lineNumbers 配置
     └── automaticLayout 自适应容器

ChatMessage.vue ──→ marked + highlight.js 代码高亮
     ├── 支持行号显示
     ├── 代码块复制按钮
     └── 代码块全屏查看
```

**注意**：ScienceClaw 当前只有**单文件查看模式**，没有 Monaco Diff Editor。如果 RV-Insights 需要代码 diff 展示（review 阶段的 patch 对比），这是一个**差异化机会**。

### 差距总结

| 能力 | RV-Insights | ScienceClaw |
|------|-------------|-------------|
| 语法高亮 | ❌ 无 | ✅ highlight.js |
| 代码编辑器 | ❌ 无 | ✅ Monaco Editor |
| Diff 视图 | ❌ 无 | ❌ 无（差异化机会） |
| 代码全屏 | ❌ 无 | ✅ MarkdownEnhancements |
| 代码复制 | ❌ 无 | ✅ ChatMessage 内置 |

---

## 五、沙箱与终端体验差距

### RV-Insights

- **无沙箱 UI 组件**
- Tester Agent 的设计依赖 QEMU 交叉编译环境，但前端无任何终端/远程桌面组件
- 测试日志计划通过 `TestLogViewer` 展示（design.md 提及但未实现）

### ScienceClaw

| 组件 | 技术 | 功能 |
|------|------|------|
| **SandboxTerminal.vue** | `@xterm/xterm` + `@xterm/addon-fit` | 只读终端展示 AI 执行的命令和输出，彩色 ANSI，超 50 行自动截断 |
| **VNCViewer.vue** | `@novnc/novnc` (RFB 协议) | 远程桌面，支持 viewOnly 和交互模式，自动缩放 |
| **TakeOverView.vue** | noVNC 全屏 | VNC 全屏接管模式，覆盖整个视口，支持 `?vnc=1` 路由直接进入 |
| **BrowserToolView.vue** | iframe + VNC | 实时模式嵌入 VNC 浏览器，历史模式展示截图，"Take Over" 按钮一键全屏 |

**RV-Insights 可借鉴**：为 Tester Agent 提供沙箱终端组件（展示交叉编译日志、QEMU 启动输出），可选 VNC 组件（查看 QEMU 图形界面）。

---

## 六、页面与路由差距

### RV-Insights 路由

```typescript
const routes = [
  { path: '/login', component: LoginPage },
  {
    path: '/',
    component: MainLayout,
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/cases' },
      { path: 'cases', component: CaseListPage },
      { path: 'cases/:id', component: CaseDetailPage },
    ],
  },
]
```

**4 个页面**：Login → CaseList → CaseDetail（核心）

design.md 规划了但未实现的页面：
- DashboardView（仪表盘）
- KnowledgeView（知识库）
- MetricsView（指标统计）

### ScienceClaw 路由

```typescript
// 14 个页面，覆盖完整 AI 工作台
pages: [
  ChatPage, HomePage, LoginPage, SharePage,
  TasksPage, TasksListPage, TaskConfigPage,
  ToolsPage, ToolDetailPage, SkillsPage, SkillDetailPage,
  ScienceToolDetail, MainLayout, ShareLayout
]
```

**关键页面 RV-Insights 可以借鉴**：
- **TasksPage / TasksListPage**：任务调度管理（对应 RV-Insights 的定时扫描 RISC-V 动态）
- **SharePage**：会话分享（对应 RV-Insights 的案例分享）
- **Settings 系统**：12 个设置组件（模型选择、Token 统计、IM 绑定等）

---

## 七、依赖生态差距

### RV-Insights package.json

```json
{
  "dependencies": {
    "@microsoft/fetch-event-source": "^2.0.1",
    "@vueuse/core": "^10.9.0",
    "axios": "^1.6.8",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "lucide-vue-next": "^0.378.0",
    "pinia": "^2.1.7",
    "radix-vue": "^1.7.4",      // ← 已引入但未使用
    "tailwind-merge": "^2.3.0",
    "vue": "^3.4.21",
    "vue-router": "^4.3.0"
  }
}
```

**特性**：精简，仅覆盖基础 UI + SSE + HTTP。`radix-vue` 已引入但组件中未使用（可能是预留）。

### ScienceClaw package.json（关键差异依赖）

```json
{
  "dependencies": {
    "@microsoft/fetch-event-source": "^2.0.1",
    "@novnc/novnc": "^1.4.0",           // ← VNC 远程桌面
    "@xterm/xterm": "^5.3.0",           // ← 终端模拟器
    "@xterm/addon-fit": "^0.8.0",
    "monaco-editor": "^0.47.0",         // ← 代码编辑器
    "highlight.js": "^11.9.0",          // ← 语法高亮
    "katex": "^0.16.9",                 // ← 数学公式
    "mermaid": "^10.8.0",               // ← 流程图
    "marked": "^12.0.0",                // ← Markdown 渲染
    "dompurify": "^3.0.8",              // ← XSS 防护
    "mitt": "^3.0.1",                   // ← 事件总线
    "reka-ui": "...",                   // ← UI 原语
    "lucide-vue-next": "...",
    "vue": "^3.4.21",
    "vue-router": "^4.3.0",
    "vue-i18n": "^9.9.0"                // ← 国际化
  }
}
```

**特性**：完整覆盖代码编辑、终端、远程桌面、数学公式、流程图、XSS 防护、国际化。

### 依赖差距表

| 依赖 | RV-Insights | ScienceClaw | 用途 |
|------|:-----------:|:-----------:|------|
| `monaco-editor` | ❌ | ✅ | 代码编辑 |
| `@novnc/novnc` | ❌ | ✅ | 远程桌面 |
| `@xterm/xterm` | ❌ | ✅ | 终端模拟 |
| `highlight.js` | ❌ | ✅ | 语法高亮 |
| `katex` | ❌ | ✅ | 数学公式 |
| `mermaid` | ❌ | ✅ | 流程图 |
| `marked` | ❌ | ✅ | Markdown |
| `dompurify` | ❌ | ✅ | XSS 防护 |
| `mitt` | ❌ | ✅ | 事件总线 |
| `vue-i18n` | ❌ | ✅ | 国际化 |
| `radix-vue` | ✅(未使用) | ✅ | UI 原语 |
| `@vueuse/core` | ✅ | ❓ | 组合式工具 |

---

## 八、迁移建议

### 立即行动（1-2 周）

1. **增强 SSE 事件协议**
   - 参考 ScienceClaw 的 13 种事件类型，扩展 RV-Insights 的 `EventType`
   - 新增：`message_chunk`（token 流式）、`thinking`（思考过程独立事件）、`tool`（工具调用独立事件）、`plan`（计划更新）
   - 前端 `AgentEventLog.vue` 增加打字机效果（`message_chunk` 逐字追加）

2. **引入语法高亮**
   - 安装 `highlight.js`，为 tool_call/tool_result 中的代码片段添加语法高亮
   - 低成本，高收益

3. **利用已引入的 radix-vue**
   - 将 NewCase 弹窗迁移到 `Dialog` 组件
   - ReviewPanel 的 Abandon 确认迁移到 `AlertDialog`
   - CaseListPage 的筛选器使用 `Select` / `Popover`

### 短期目标（2-4 周）

4. **引入 Monaco Editor**
   - 封装 `MonacoEditor.vue`（参考 ScienceClaw 实现）
   - 用于展示 DevelopmentResult 的 patch 文件
   - **差异化点**：实现 Monaco Diff Editor（ScienceClaw 没有），用于 review 阶段的 patch 对比

5. **升级 ActivityPanel**
   - 将 `AgentEventLog.vue` 从线性列表升级为 Cursor 风格三段式面板
   - Thinking 区域：实时追加 Agent 思考过程
   - Plan 区域：展示当前 todo 进度
   - Tools 区域：工具调用时间线（可展开 Input/Output）

6. **增加沙箱终端组件**
   - 安装 `@xterm/xterm`，封装 `SandboxTerminal.vue`
   - 用于 Tester Agent 的编译日志、QEMU 启动输出展示
   - 可选：noVNC 组件（如果 QEMU 需要图形界面）

### 中期目标（1-2 个月）

7. **丰富消息渲染**
   - 安装 `marked` + `dompurify`，支持 Markdown 渲染 + XSS 防护
   - 安装 `katex`，支持数学公式（RISC-V 规范中有大量公式）
   - 安装 `mermaid`，支持流程图渲染

8. **补齐 design.md 规划页面**
   - DashboardView：活跃案例概览、系统状态
   - KnowledgeView：RISC-V 知识库管理
   - MetricsView：Token 消耗、成功率统计

9. **设置系统**
   - ModelSettings：LLM 模型选择、参数配置
   - TokenStatistics：成本统计（参考 ScienceClaw 的 TokenStatistics 组件）

### 长期目标（可选）

10. **国际化**
    - 安装 `vue-i18n`，实现中英文切换（design.md 4.10 已规划）

11. **会话分享**
    - SharePage：通过 URL 分享案例详情（参考 ScienceClaw 的 SharePage）

---

## 附录：组件映射参考

| RV-Insights 组件 | ScienceClaw 参考组件 | 差距 |
|-----------------|---------------------|------|
| `AgentEventLog.vue` | `ActivityPanel.vue` | ScienceClaw 是结构化三段式面板，RV-Insights 是线性列表 |
| `CaseDetailPage.vue` | `ChatPage.vue` | ScienceClaw 有沙箱预览、流式输出、工具时间线 |
| `ReviewPanel.vue` | `ActivityPanel.vue` (Tools 区域) | ScienceClaw 工具调用可展开 Input/Output |
| — | `MonacoEditor.vue` | RV-Insights 无代码编辑器 |
| — | `SandboxTerminal.vue` | RV-Insights 无终端组件 |
| — | `VNCViewer.vue` | RV-Insights 无远程桌面 |
| — | `MarkdownEnhancements.vue` | RV-Insights 无富媒体增强 |
| — | `Settings/` (12 个) | RV-Insights 无设置系统 |

---

> **总结**：RV-Insights 前端是**功能完整的 Pipeline 审批 UI**，但距离 ScienceClaw 的**通用 AI Agent 工作台**还有较大差距。最大短板在 SSE 事件粒度（无法展示 Agent 思考过程）、代码展示能力（无编辑器/高亮/diff）、以及沙箱终端体验。建议优先补齐 SSE 协议扩展 + Monaco Editor + xterm.js 终端，这三个组件可以立即提升用户体验。
