# RV-Insights

Next-generation AI desktop app with integrated agents. Local-first, multi-provider, fully open source.

[中文](./README.md)

### ✦ Core Capabilities

> **rv-pipeline** · RISC-V open-source contribution pipeline &nbsp;│&nbsp; **Agent** · Autonomous general agent &nbsp;│&nbsp; **Agent Teams** · Multi-agent collaboration &nbsp;│&nbsp; **Skills & MCP** · Extensible toolchain
>
> **Lark Remote** · Use Agent from your phone &nbsp;│&nbsp; **Memory** · Understands you across sessions &nbsp;│&nbsp; **Multi-Provider** · Anthropic / OpenAI / Google / DeepSeek / MiniMax / Kimi / Zhipu &nbsp;│&nbsp; **Local-First** · Your data stays with you

![RV-Insights Poster](https://img.erlich.fun/personal-blog/uPic/pb.png)

The core vision of RV-Insights is not to replace any particular software. Currently, only the infrastructure of RV-Insights has been implemented. Going forward, RV-Insights will continue to build multi-agent collaboration (personal and team), agent connections with external services, Tools and Skills consolidation, and the ability to proactively provide software and suggestions based on user understanding and memory. RV-Insights is evolving rapidly with the help of VibeCoding tools. PRs are welcome!

## Screenshots

### rv-pipeline Mode
rv-pipeline is an intelligent pipeline for RISC-V open-source contributions, consisting of 5 stages: Explorer (discover contribution points) → Planner (design plan) → Developer (code development) → Reviewer (code review) → Tester (test verification). Each node pauses after output for human approval, and Developer ↔ Reviewer supports multi-round iteration until review passes. Powered by LangGraph for orchestration; Explorer / Planner / Developer / Tester use Claude Agent SDK, Reviewer uses OpenAI Agents SDK.

![RV-Insights Chat Mode](https://img.erlich.fun/personal-blog/uPic/tBXRKI.png)

### Agent Mode
Agent mode with general-purpose agent capabilities. Supports the full Claude series, MiniMax M2.1, Kimi K2.5, Zhipu GLM, and third-party channels. Elegant, clean, smooth, and confident streaming output.

![RV-Insights Agent Mode](https://img.erlich.fun/personal-blog/uPic/3ZHWyA.png)

### Agent Teams
Agent Teams (or Agent Swarm) is one of the major development directions for agents in 2026. RV-Insights already supports Agent Teams, which can automatically assemble teams based on task complexity. In practice, this improves complex task handling by at least 5%–20%. When running Agent Teams, you'll see each agent's working status on the right panel. (You can also request Agent Teams via natural language and assign each agent a specific work or research scope.)
![RV-Insights Agent Teams](https://img.erlich.fun/personal-blog/uPic/vNVpRu.png)

### Skill & MCP
Built-in Brainstorming and office suite Skills with MCP support. Automatically helps you find and install Skills through conversation.

![RV-Insights Default Skills and Mcp](https://img.erlich.fun/personal-blog/uPic/PNBOSt.png)

### Memory
Shared memory across Chat and Agent modes — AI truly understands you and remembers your preferences and habits.

![RV-Insights memory settings](https://img.erlich.fun/personal-blog/uPic/94B0LN.png)

![RV-Insights memory demo](https://img.erlich.fun/personal-blog/uPic/Wi8QfB.png)


### Channel Configuration

Full-protocol LLM channel support for all domestic and international providers, configured via Base URL + API Key.

![RV-Insights Mutili Provider Support](https://img.erlich.fun/personal-blog/uPic/uPPazd.png)

## Features

- **rv-pipeline** — 5-stage pipeline for RISC-V open-source contributions (Explorer → Planner → Developer → Reviewer → Tester), LangGraph orchestration with human-in-the-loop approval at each node
- **Multi-Provider Support** — Anthropic, OpenAI, Google, DeepSeek, MiniMax, Kimi, Zhipu GLM, and any OpenAI-compatible endpoint
- **AI Agent Mode** — Autonomous general agent powered by Claude Agent SDK
- **Agent Teams** — Multi-agent collaboration, auto-assemble teams for complex tasks, improving results by 5-20%
- **Remote via Lark** — Use RV-Insights Agent remotely via Feishu/Lark bot, supporting private chats and group chats
- **Skills & MCP** — Extensible toolchain with built-in Brainstorming and office suite Skills, auto-discover and install new Skills via conversation
- **Streaming & Thinking** — Real-time streaming output with extended thinking visualization
- **Rich Rendering** — Mermaid diagrams, syntax-highlighted code blocks, Markdown
- **Attachments & Documents** — Upload images and parse PDF/Office/text files in conversations
- **Memory** — Shared memory across rv-pipeline and Agent, AI remembers your preferences, habits, and context across sessions
- **Local-First** — All data stored locally in `~/.rv-insights/`, no database, fully portable
- **Themes** — Light and dark mode with system preference detection

## Getting Started

Download the latest release for your platform:

**[Download RV-Insights](https://github.com/ErlichLiu/RV-Insights/releases)**

## Configuration

### Adding a Channel

Go to **Settings > Channels**, click **Add Channel**, select a provider, and enter your API Key. RV-Insights will auto-fill the correct API endpoint. Click **Test Connection** to verify, then **Fetch Models** to load available models.

### rv-pipeline Mode

rv-pipeline requires two channels:
- **Claude channel** (for Explorer / Planner / Developer / Tester): Add an Anthropic or Claude Agent SDK-compatible provider channel
- **OpenAI channel** (for Reviewer): Add an OpenAI or OpenAI Agents SDK-compatible provider channel

Go to **Settings > rv-pipeline** to select the channels and models. During pipeline execution, each node will automatically pause after output, waiting for your on-screen approval before proceeding to the next stage.

### Agent Mode (Anthropic Only)

Agent mode requires an **Anthropic** channel. After adding one, go to **Settings > Agent** to select your Anthropic channel and preferred model (Claude Sonnet 4 / Opus 4 recommended). The agent uses [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk) under the hood.

### Special Provider Endpoints

MiniMax, Kimi (Moonshot), and Zhipu GLM use dedicated API endpoints — these are auto-configured when you select the provider. All three support their **programming membership plans** for API access:

| Provider | Chat Mode | Agent Mode | Note |
|----------|----------|----------|------|
| MiniMax | `https://api.minimaxi.com/v1` | `https://api.minimaxi.com/anthropic`| Supports MiniMax Pro membership |
| Kimi | `https://api.moonshot.cn/v1` | `https://api.moonshot.cn/anthropic`| Supports Moonshot developer plan |
| Zhipu GLM | `https://open.bigmodel.cn/api/paas/v4` | `https://open.bigmodel.cn/api/anthropic`| Supports Zhipu developer plan |

## Tech Stack

- **Runtime** — Bun
- **Framework** — Electron + React 18
- **State** — Jotai
- **Styling** — Tailwind CSS + shadcn/ui
- **Build** — Vite (renderer) + esbuild (main/preload)
- **Language** — TypeScript
- **Pipeline Orchestration** — LangGraph
- **Agent SDK** — Claude Agent SDK 0.2.120
- **Reviewer SDK** — OpenAI Agents SDK

## Credits

RV-Insights is built on the shoulders of these great projects:

- [Shiki](https://shiki.style/) — Syntax highlighting
- [Beautiful Mermaid](https://github.com/lukilabs/beautiful-mermaid) — Diagram rendering
- [Cherry Studio](https://github.com/CherryHQ/cherry-studio) — Inspiration for multi-provider desktop AI
- [Lobe Icons](https://github.com/lobehub/lobe-icons) — AI/LLM brand icon set
- [Craft Agents OSS](https://github.com/lukilabs/craft-agents-oss) — Agent SDK integration patterns
- [MemOS](https://memos.openmem.net) — Memory feature implementation

## Contributing

We welcome contributions to RV-Insights! Whether it's fixing bugs, adding features, or improving documentation, every contribution matters.

**PR Bounty Program** — RV-Insights currently offers a PR bounty program. Merged PRs automatically receive a generous bounty that can be used with Claude Code and similar products, helping you develop more effectively with AI-assisted tools. Simply leave your email address in the PR description when submitting.

![RV-Insights Given](https://img.erlich.fun/personal-blog/uPic/PR%20%E8%B5%A0%E9%87%91%201.png)


## Sponsorship (Recruiting)
The most meme-savvy yet spot-on hype organization of the AI era — amazed by its precise satire and piercing insights into this AI age. Search on WeChat Official Account: **葬 AI**

![葬 AI](https://img.erlich.fun/personal-blog/uPic/zang-ai.png)

## License

[MIT](./LICENSE)
