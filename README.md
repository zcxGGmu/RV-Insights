# RV-Insights

<video width="560" controls>
  <source src="https://img.erlich.fun/personal-blog/uPic/%E7%AE%80%E5%8D%95%E4%BB%8B%E7%BB%8D%20RV-Insights.mp4" type="video/mp4">
</video>

面向开源软件的 AI 辅助贡献平台，支持对话、Agent、Agent Teams **等能力**，本地优先、多供应商支持、完全开源。支持远程通过飞书机器人与 Agent 对话和交互，甚至把 RV-Insights Agent 拉进群组替你完成工作，跟同事实现 Agent 协作，让你用手机也可以处理很多必要的工作。

[English version README.md](./README.en.md)

### ✦ 核心能力

> **rv-pipeline** · RISC-V 开源贡献智能流水线 &nbsp;│&nbsp; **Agent** · 自主通用 Agent &nbsp;│&nbsp; **Agent Teams** · 多 Agent 协同 &nbsp;│&nbsp; **Skills & MCP** · 可扩展工具链
>
> **飞书远程** · 手机也能用 Agent &nbsp;│&nbsp; **记忆** · 跨会话理解你 &nbsp;│&nbsp; **多供应商** · Anthropic / OpenAI / Google / DeepSeek / MiniMax / Kimi / 智谱 &nbsp;│&nbsp; **本地优先** · 数据全在你手里

## RV-Insights 截图

### rv-pipeline 模式
rv-pipeline 是面向 RISC-V 开源软件贡献的智能流水线，由 5 个阶段节点组成：Explorer（探索贡献点）→ Planner（规划方案）→ Developer（代码开发）→ Reviewer（代码审查）→ Tester（测试验证）。每个节点输出后都会暂停等待人工审核，Developer 与 Reviewer 之间支持多轮迭代，直到审查通过。底层采用 LangGraph 编排引擎，5 个节点统一走 Claude Agent SDK 兼容链路。

![RV-Insights Chat Mode](https://img.erlich.fun/personal-blog/uPic/tBXRKI.png)

### Agent 模式
RV-Insights Agent 模式，通用 Agent 能力，支持 Cladue 全系列、Minimax M2.1、Kimi K2.5、智谱 GLM 等模型，支持第三方渠道。优雅、简洁、丝滑、确信的流式输出。

![RV-Insights Agent Mode](https://img.erlich.fun/personal-blog/uPic/3ZHWyA.png)

### Agent Teams
Agent Teams 或者 Agent 蜂群将会是 2026 年 Agent 主要的发展方向之一，RV-Insights 也已经支持 Agent Teams 能力，并且可以自动根据用户的任务复杂度自动组件 Agent Teams，实际测试可以将复杂任务的处理能力和效果提高至少 5% - 20%。当运行 Agent Teams 时你将在右侧看到具体的 Agent 的工作状态。（也可以通过自然语言主动要求使用 Agent Teams，并为每个 Agent 指定它的工作或研究范围）
![RV-Insights Agent Teams](https://img.erlich.fun/personal-blog/uPic/vNVpRu.png)

### Skill & MCP
RV-Insights Skills 和 MCP，默认内置 Brainstorming 和办公软件 Skill，支持通过对话就能自动帮助你寻找和安装 Skills。

![RV-Insights Default Skills and Mcp](https://img.erlich.fun/personal-blog/uPic/PNBOSt.png)

### 通过飞书远程使用 RV-Insights / 支持私聊和群组
RV-Insights 支持通过使用飞书机器人的方式来远程使用 RV-Insights Agent 能力，支持切换工作区（/workspace 命令），支持创建新会话（/new 命令），这样就可以实现类似截图中的效果，可以为不同的工作区先配置上（或直接通过 RV-Insights Agent 来帮你配置）对应的 Skills / MCP 以及文件附录等资源，即可远程也能让 RV-Insights Agent 帮你完成工作。譬如远程帮你进行调研，并将调研文件通过邮件或其他方式发送到同事的邮箱、远程合并 PR 或者修复紧急的 Bug 并推送上线等。

也支持将 RV-Insights Agent 拉进你的飞书群组，可以跟同事共享你积攒下来的 Skills 和 MCP 能力，利用本地的文件和飞书文档一起完成更智能的 Agent 协作，甚至可以直接用 RV-Insights Agent 来完成对外部用户的服务。

![RV-Insights Lark Demo](https://img.erlich.fun/personal-blog/uPic/nNu4wA.png)

实际的配置过程很简单，但我也知道这对于任何新手来说认知压力会比较大，但请相信我克服这种恐惧，3 分钟足够。

![RV-Insights Lark Config](https://img.erlich.fun/personal-blog/uPic/wTQisd.png)

![RV-Insights Lark Command](https://img.erlich.fun/personal-blog/uPic/tvzfZp.png)

### 记忆能力
RV-Insights 记忆功能，Chat 和 Agent 共享记忆，让 AI 真正了解你、记住你的偏好和习惯。
![RV-Insights memory settings](https://img.erlich.fun/personal-blog/uPic/94B0LN.png)

![RV-Insights memory dmeo](https://img.erlich.fun/personal-blog/uPic/Wi8QfB.png)


### RV-Insights 渠道配置功能

RV-Insights 全协议大模型渠道支持，支持国内外所有渠道模型，通过 Base URL + API KEY 配置。

![RV-Insights Mutili Provider Support](https://img.erlich.fun/personal-blog/uPic/uPPazd.png)

## 特性

- **rv-pipeline 智能流水线** — 面向 RISC-V 开源贡献的 5 阶段流水线（Explorer → Planner → Developer → Reviewer → Tester），LangGraph 编排，节点级人工审核
- **多供应商支持** — Anthropic、OpenAI、Google、DeepSeek、Moonshot、智谱 GLM、MiniMax、豆包、通义千问，以及任何 OpenAI 兼容端点
- **AI Agent 模式** — 基于 Claude Agent SDK 0.2.123 的自主通用 Agent，支持工作区隔离和权限管理
- **Agent Teams** — 多 Agent 协同工作，自动组建团队处理复杂任务，提升 5-20% 效果
- **远程全天候使用 RV-Insights** — 基于飞书/Lark 的机器人能力，实现远程使用 RV-Insights Agent，支持私聊和群组，搭配工作区的 Skill 和 MCP 实现远程工作
- **Skills & MCP** — 可扩展工具链，默认内置 Brainstorming 和办公软件 Skill，支持通过对话自动寻找和安装 Skills
- **流式输出 & 思考模式** — 实时流式响应，可视化扩展思考过程
- **丰富渲染** — Mermaid 图表、语法高亮代码块、Markdown、数学公式（KaTeX）
- **附件 & 文档解析** — 上传图片，解析 PDF/Office/文本文件内容到对话中
- **记忆功能** — rv-pipeline 和 Agent 共享记忆，AI 记住你的偏好、习惯和上下文，跨会话持续理解你
- **本地优先** — 所有数据存储在 `~/.rv-insights/`，JSON + JSONL 格式，无数据库，完全可移植
- **主题切换** — 亮色/暗色模式，跟随系统偏好
- **自动更新** — 内置 Electron Updater，自动检测和安装更新

## 快速开始

### 从源码安装

如果你希望从源码构建 RV-Insights，或者参与开发，请按以下步骤操作。

#### 环境要求

- **Bun** 1.2.5+（运行时和包管理器）
- **macOS** / **Windows** / **Linux**

#### 安装步骤

```bash
# 1. 克隆仓库
git clone https://github.com/ErlichLiu/RV-Insights.git
cd RV-Insights

# 2. 安装依赖（包含所有 workspace 包）
bun install

# 3. 开发模式启动（推荐，带热重载）
bun run dev

# 或构建生产版本后运行
bun run electron:build
bun run electron:start
```

#### 打包分发

```bash
cd apps/electron

# macOS
bun run dist:mac

# Windows
bun run dist:win

# Linux
bun run dist:linux

# 当前架构快速打包
bun run dist:fast
```

#### 常见问题

| 问题 | 解决 |
|------|------|
| `Cannot find module '@anthropic-ai/claude-agent-sdk'` | 确保 `bun install` 成功，且可选依赖已安装 |
| Agent 功能无法使用 | 检查对应平台的 SDK 子包是否存在，如 `node_modules/@anthropic-ai/claude-agent-sdk-darwin-arm64/` |
| 构建后白屏 | 确认 `dist/renderer/` 目录存在且包含 `index.html` |

## 配置指南

### 添加渠道

进入 **设置 > 模型配置**，点击 **添加渠道**，选择供应商并输入 API Key。RV-Insights 会自动填充正确的 API 地址。点击 **测试连接** 验证，然后 **获取模型** 加载可用模型列表。

### rv-pipeline 模式

rv-pipeline 当前复用 Agent 的默认渠道与工作区配置：
- **渠道**：先在 **设置 > 模型配置** 中添加一个 Anthropic 或兼容 Claude Agent SDK 的供应商渠道
- **默认配置**：再进入 **设置 > Agent 配置** 选择默认渠道和工作区，创建 Pipeline 会话时会复用这组设置

流水线运行时，5 个节点统一通过 Claude Agent SDK 兼容链路执行；每个节点输出后都会自动暂停，等待你在界面上审核确认后再进入下一阶段。

### Agent 模式

Agent 模式需要一个 **支持 Claude Agent SDK 的渠道**。添加后，进入 **设置 > Agent 配置** 选择默认渠道和模型（推荐 Claude Sonnet 4 / Opus 4）。底层使用 [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk)。

### 特殊供应商端点

MiniMax、Kimi（Moonshot）和智谱 GLM 使用专用 API 端点 — 选择供应商时会自动配置。三者均支持**编程会员**套餐的 API 访问：

| 供应商 | Chat 模式 | Agent 模式 | 备注 |
|--------|----------|-----------|------|
| MiniMax | `https://api.minimaxi.com/v1` | `https://api.minimaxi.com/anthropic` | 支持 MiniMax Pro 会员 |
| Kimi | `https://api.moonshot.cn/v1` | `https://api.moonshot.cn/anthropic` | 支持 Moonshot 开发者套餐 |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | `https://open.bigmodel.cn/api/anthropic` | 支持智谱开发者套餐 |

## 技术栈

- **运行时** — Bun 1.2.5+
- **桌面框架** — Electron 39.5.1
- **前端框架** — React 18.3.1
- **状态管理** — Jotai 2.17.1
- **UI 组件** — Radix UI
- **样式** — Tailwind CSS 3.4.17
- **富文本编辑器** — TipTap 3.19.0
- **代码高亮** — Shiki 3.22.0
- **构建工具** — Vite 6.0.3（渲染进程）+ esbuild 0.24.0+（主进程/预加载）
- **打包工具** — Electron Builder 25.1.8
- **语言** — TypeScript 5.0.0+
- **Agent SDK** — @anthropic-ai/claude-agent-sdk 0.2.123
- **编排引擎** — LangGraph
- **飞书 SDK** — @larksuiteoapi/node-sdk
