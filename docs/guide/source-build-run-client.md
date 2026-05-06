# RV-Insights 从源码部署、构建并启动客户端指南

> 适用对象：第一次从源码运行 RV-Insights 的新人
>
> 适用范围：Linux、macOS、Windows
>
> 本文只覆盖“从源码拉取仓库、安装依赖、构建并启动 Electron 客户端”的完整流程，不覆盖渠道配置、打包发布、CI/CD。

---

## 1. 先理解两种启动方式

在开始之前，先区分 RV-Insights 的两种常用启动方式：

| 启动方式 | 命令 | 适合什么场景 | 是否依赖 Vite dev server |
|---|---|---|---|
| 首次验证启动 | `bun run electron:start` | 第一次确认项目能否正常构建和打开客户端 | 否 |
| 开发热重载 | `bun run dev` | 日常开发、改代码后实时预览 | 是，默认占用 `5173` |

**推荐顺序：**

1. 第一次运行项目时，先用 `bun run electron:start`
2. 确认客户端能正常打开后，再使用 `bun run dev`

这样做的原因很简单：`electron:start` 直接加载本地构建产物，更适合验证“项目能否跑起来”；`bun run dev` 依赖本地开发服务器，如果 `5173` 端口被其他项目占用，会先卡在开发环境问题上。

---

## 2. 从源码运行后，数据会写到哪里

从源码启动 RV-Insights 时，应用会把本地数据写到**开发模式目录**，而不是正式版目录：

- Linux / macOS：`~/.rv-insights-dev/`
- Windows：`%USERPROFILE%\.rv-insights-dev\`

这个目录里会保存：

- 渠道配置
- 对话记录
- Agent 会话
- 工作区
- 设置
- 附件

如果你只是做源码调试，看到这个目录是正常现象。

---

## 3. 通用前置条件

三个平台都需要满足以下条件：

### 3.1 必须有图形桌面环境

RV-Insights 是 Electron 桌面应用，不是纯命令行程序。

- Linux 需要本地桌面会话（X11 / Wayland）
- macOS 需要在图形桌面中运行
- Windows 需要在原生桌面环境中运行

如果你是在纯 SSH 终端、无 GUI 的服务器、或者不完整的远程桌面环境中执行，客户端通常无法正常弹出。

### 3.2 安装 Git

你需要 Git 来克隆仓库。

- Linux：用发行版包管理器安装
- macOS：推荐安装 Xcode Command Line Tools
- Windows：安装 Git for Windows

安装完成后，验证：

```bash
git --version
```

### 3.3 安装 Bun

本项目使用 **Bun** 作为运行时和包管理器，不使用 npm / pnpm / yarn 作为主流程。

安装完成后，验证：

```bash
bun --version
```

### 3.4 预留网络和磁盘空间

第一次执行 `bun install` 会下载整个 workspace 依赖和 Electron 相关包，耗时与网络环境有关。建议：

- 使用稳定网络
- 预留至少数 GB 的可用磁盘空间

---

## 4. Linux：从源码构建并启动

下面以常见 Linux 桌面环境为目标说明。

### 4.1 安装系统基础工具

至少需要：

- `git`
- `curl`
- `unzip`

`unzip` 很重要，因为 Bun 官方安装脚本依赖它。

Ubuntu / Debian 可以执行：

```bash
sudo apt update
sudo apt install -y git curl unzip
```

Fedora 可以执行：

```bash
sudo dnf install -y git curl unzip
```

Arch Linux 可以执行：

```bash
sudo pacman -Sy --needed git curl unzip
```

### 4.2 安装 Bun

根据 Bun 官方安装文档，Linux / macOS 的推荐命令是：

```bash
curl -fsSL https://bun.com/install | bash
```

安装完成后，如果当前 shell 还找不到 `bun`，把 Bun 加到 `PATH`：

```bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
```

如果你使用 `zsh`，建议把这两行写入 `~/.zshrc`；如果使用 `bash`，写入 `~/.bashrc`。

重新加载配置后验证：

```bash
bun --version
```

### 4.3 克隆仓库

```bash
git clone https://github.com/ErlichLiu/RV-Insights.git
cd RV-Insights
```

### 4.4 安装依赖

```bash
bun install
```

安装完成后，建议确认 Electron 应用依赖和 Agent SDK 的平台子包已经落到 `apps/electron/node_modules`：

```bash
ls apps/electron/node_modules/@anthropic-ai/claude-agent-sdk*
```

如果这里完全没有对应目录，后续 Agent 能力可能不可用。

### 4.5 推荐先做一次类型检查

```bash
bun run typecheck
```

这一步不是强制，但非常推荐。它能帮助你在启动前就发现明显的 TypeScript 问题。

### 4.6 构建 Electron 客户端

```bash
bun run electron:build
```

构建成功后，关键产物会出现在：

- `apps/electron/dist/main.cjs`
- `apps/electron/dist/preload.cjs`
- `apps/electron/dist/file-preview-preload.cjs`
- `apps/electron/dist/renderer/index.html`

### 4.7 启动客户端

```bash
bun run electron:start
```

**注意：**

- 这条命令会先构建，再启动 Electron
- 终端会持续占用，这是正常现象
- 不要第一次就直接用 `bunx electron .`
- 也不要第一次就先用 `bun run dev`

### 4.8 如何判断 Linux 启动成功

满足以下几点，基本就说明首启成功：

1. 终端中能看到运行时初始化日志
2. 图形桌面里弹出标题为 `RV-Insights` 的主窗口
3. 主窗口不是空白白屏
4. 本地出现 `~/.rv-insights-dev/` 目录

### 4.9 Linux 开发模式

确认首启成功后，再进入热重载开发模式：

```bash
bun run dev
```

如果你想手动拆开调试，可以在两个终端里分别执行：

终端 1：

```bash
cd apps/electron
bun run dev:vite
```

终端 2：

```bash
cd apps/electron
bun run dev:electron
```

如果你使用 `tmux`，也可以尝试：

```bash
cd apps/electron
bun run dev:split
```

---

## 5. macOS：从源码构建并启动

### 5.1 安装 Xcode Command Line Tools

macOS 新人最常见的缺失是命令行工具链。推荐先执行：

```bash
xcode-select --install
```

安装完成后，验证 Git：

```bash
git --version
```

### 5.2 安装 Bun

根据 Bun 官方文档，macOS 推荐安装方式也是：

```bash
curl -fsSL https://bun.com/install | bash
```

如果安装后 `bun` 仍不可用，把 Bun 加到 `PATH`：

```bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
```

如果你使用：

- `zsh`：写入 `~/.zshrc`
- `bash`：写入 `~/.bashrc`

重新打开终端后验证：

```bash
bun --version
```

### 5.3 克隆仓库

```bash
git clone https://github.com/ErlichLiu/RV-Insights.git
cd RV-Insights
```

### 5.4 安装依赖

```bash
bun install
```

建议确认 Agent SDK 平台子包已经按你的机器架构安装：

```bash
ls apps/electron/node_modules/@anthropic-ai/claude-agent-sdk*
```

常见情况：

- Apple Silicon：通常会看到 `darwin-arm64`
- Intel Mac：通常会看到 `darwin-x64`

### 5.5 类型检查

```bash
bun run typecheck
```

### 5.6 构建客户端

```bash
bun run electron:build
```

### 5.7 启动客户端

```bash
bun run electron:start
```

### 5.8 如何判断 macOS 启动成功

满足以下几点即可认为启动成功：

1. Dock 中出现 RV-Insights
2. 桌面弹出标题为 `RV-Insights` 的主窗口
3. 终端中能看到运行时初始化和 IPC 注册日志
4. 用户目录下出现 `~/.rv-insights-dev/`

### 5.9 macOS 开发模式

```bash
bun run dev
```

如果你想分开调试，也可以在两个终端标签页中执行：

终端 1：

```bash
cd apps/electron
bun run dev:vite
```

终端 2：

```bash
cd apps/electron
bun run dev:electron
```

如果你使用 `tmux`、iTerm2 或 Terminal.app，也可以尝试：

```bash
cd apps/electron
bun run dev:split
```

---

## 6. Windows：从源码构建并启动

**强烈建议：在原生 PowerShell 中执行，不要把第一次启动流程建立在 WSL 上。**

原因是 RV-Insights 是桌面 GUI 应用，源码运行时还涉及平台相关的 Electron / Agent SDK 子包。第一次验证建议走原生 Windows 终端。

### 6.1 安装 Git

先安装 Git for Windows。安装完成后，重新打开 PowerShell，验证：

```powershell
git --version
```

### 6.2 安装 Bun

根据 Bun 官方文档，Windows 推荐安装命令是：

```powershell
powershell -c "irm bun.sh/install.ps1|iex"
```

Windows 需要至少 **Windows 10 version 1809** 或更新版本。

### 6.3 如果安装后 `bun` 仍不可用

先验证 Bun 二进制是否已经存在：

```powershell
& "$env:USERPROFILE\.bun\bin\bun" --version
```

如果这个命令能执行，但直接输入 `bun --version` 仍提示未识别，那么说明 PATH 没配好。根据 Bun 官方文档，可以执行：

```powershell
[System.Environment]::SetEnvironmentVariable(
  "Path",
  [System.Environment]::GetEnvironmentVariable("Path", "User") + ";$env:USERPROFILE\.bun\bin",
  [System.EnvironmentVariableTarget]::User
)
```

然后**关闭并重新打开 PowerShell**，再验证：

```powershell
bun --version
```

### 6.4 克隆仓库

```powershell
git clone https://github.com/ErlichLiu/RV-Insights.git
Set-Location RV-Insights
```

### 6.5 安装依赖

```powershell
bun install
```

建议安装后检查 Agent SDK 相关目录是否存在：

```powershell
Get-ChildItem .\apps\electron\node_modules\@anthropic-ai\claude-agent-sdk*
```

### 6.6 类型检查

```powershell
bun run typecheck
```

### 6.7 构建客户端

```powershell
bun run electron:build
```

### 6.8 启动客户端

```powershell
bun run electron:start
```

### 6.9 如何判断 Windows 启动成功

满足以下几点即可判断成功：

1. 桌面弹出标题为 `RV-Insights` 的窗口
2. PowerShell 中持续输出 Electron 运行日志
3. 用户目录下出现 `%USERPROFILE%\.rv-insights-dev\`

### 6.10 Windows 开发模式

```powershell
bun run dev
```

如果你想手动拆开调试，不要使用 `dev:split`。在 Windows 上推荐开两个 PowerShell 窗口：

窗口 1：

```powershell
Set-Location apps/electron
bun run dev:vite
```

窗口 2：

```powershell
Set-Location apps/electron
bun run dev:electron
```

---

## 7. 启动成功后的统一验证方法

无论你使用哪个平台，都建议做一次最小验证。

### 7.1 看客户端窗口

确认：

- 主窗口标题是 `RV-Insights`
- 不是白屏
- 不是只有一个小的快速任务窗口

### 7.2 看构建产物是否存在

Linux / macOS：

```bash
test -f apps/electron/dist/main.cjs
test -f apps/electron/dist/renderer/index.html
```

Windows：

```powershell
Test-Path .\apps\electron\dist\main.cjs
Test-Path .\apps\electron\dist\renderer\index.html
```

如果这些文件不存在，优先重新执行：

```bash
bun run electron:build
```

Windows 下对应命令是：

```powershell
bun run electron:build
```

### 7.3 看开发模式配置目录

源码运行后，以下目录应该被创建：

- Linux / macOS：`~/.rv-insights-dev/`
- Windows：`%USERPROFILE%\.rv-insights-dev\`

### 7.4 看首启日志

你应该能在前台终端里看到类似信息：

- 运行时初始化完成
- Node / Bun / Git 检测成功
- IPC 处理器注册完成
- System tray created

---

## 8. 常见问题与排查

### 8.1 `bun: command not found` / `bun` 不是内部或外部命令

说明 Bun 没装好，或者 PATH 没生效。

排查顺序：

1. 先执行 `bun --version`
2. 如果失败，确认 Bun 是否实际安装成功
3. 检查 `~/.bun/bin` 或 `%USERPROFILE%\.bun\bin`
4. 把 Bun 路径加入 PATH
5. 重开终端

### 8.2 `bun run dev` 报 `Port 5173 is already in use`

这是**开发模式**问题，不是 `electron:start` 的问题。

处理方式：

- 首次启动优先用 `bun run electron:start`
- 如果要用 `bun run dev`，先释放 `5173`

Linux：

```bash
ss -ltnp '( sport = :5173 )'
```

或：

```bash
lsof -iTCP:5173 -sTCP:LISTEN -n -P
```

macOS：

```bash
lsof -iTCP:5173 -sTCP:LISTEN -n -P
```

Windows：

```powershell
netstat -ano | findstr :5173
```

### 8.3 `Cannot find module '@anthropic-ai/claude-agent-sdk'`

优先检查：

1. 是否执行过 `bun install`
2. `apps/electron/node_modules/@anthropic-ai/` 下是否有 SDK 主包和平台子包
3. 是否在错误的平台环境中运行（例如 Windows 用户在 WSL 中做 GUI 首启）

### 8.4 构建成功，但客户端还是白屏

优先按这个顺序排查：

1. 重新执行 `bun run electron:build`
2. 确认 `apps/electron/dist/renderer/index.html` 存在
3. 使用 `bun run electron:start` 启动，而不是手工直接执行 `bunx electron .`
4. 确认你看到的是主窗口，不是快速任务小窗

### 8.5 Linux 下命令执行了，但桌面没有窗口

常见原因：

- 当前不是图形桌面会话
- 你在纯 SSH 环境里执行
- Electron 依赖的系统图形库不完整

优先建议：

1. 先确认自己是在本地图形桌面里执行
2. 重新前台运行 `bun run electron:start`，直接观察终端日志
3. 如果日志提示缺少 GTK / NSS / GBM 等系统库，再按你的发行版补库

### 8.6 Windows 下第一次运行不建议直接用 WSL

WSL 更适合命令行和后端开发，不适合作为第一次验证 Electron GUI 的主路径。建议：

- 第一次源码启动：原生 PowerShell
- 后续如果你非常清楚自己的图形链路，再自行尝试 WSL / WSLg

---

## 9. 常用命令速查

在仓库根目录执行：

```bash
# 安装依赖
bun install

# 全量类型检查
bun run typecheck

# 构建 Electron 客户端
bun run electron:build

# 启动客户端（推荐首次使用）
bun run electron:start

# 热重载开发
bun run dev
```

在 `apps/electron` 目录执行：

```bash
# 只启动 Vite
bun run dev:vite

# 只启动 Electron 开发链路
bun run dev:electron

# macOS / Linux 的辅助分屏脚本
bun run dev:split
```

---

## 10. 建议的首次上手路径

如果你完全是第一次跑 RV-Insights，建议按下面的最短路径走：

1. 安装 Git 和 Bun
2. 克隆仓库
3. 执行 `bun install`
4. 执行 `bun run typecheck`
5. 执行 `bun run electron:build`
6. 执行 `bun run electron:start`
7. 确认出现 `RV-Insights` 主窗口
8. 只有在你准备开始改代码时，再执行 `bun run dev`

这样成功率最高，也最容易定位问题。
