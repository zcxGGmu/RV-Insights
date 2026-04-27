# RV-Insights vs ScienceClaw — 项目差距分析报告

> **生成日期**: 2026-04-27  
> **对比基准**: RV-Insights (Sprint 0-2) vs ScienceClaw (生产级全栈 AI 平台)  
> **参考设计文档**: `./tasks/design.md`

---

## 目录

- [一、RV-Insights 当前现状](#一rv-insights-当前现状)
- [二、ScienceClaw 提供的参考能力](#二scienceclaw-提供的参考能力)
- [三、关键差距（按影响排序）](#三关键差距按影响排序)
  - [🔴 差距 1：Agent 执行引擎](#差距-1agent-执行引擎)
  - [🔴 差距 2：SDK 适配器层](#差距-2sdk-适配器层)
  - [🟠 差距 3：SSE 事件粒度不足](#差距-3sse-事件粒度不足)
  - [🟠 差距 4：Skill / 工具生态](#差距-4skill--工具生态)
  - [🟡 差距 5：沙箱与代码执行](#差距-5沙箱与代码执行)
  - [🟡 差距 6：数据源与搜索](#差距-6数据源与搜索)
- [四、可直接迁移的 ScienceClaw 模块](#四可直接迁移的-scienceclaw-模块)
- [五、下一步建议](#五下一步建议)
- [附录：参考代码库路径](#附录参考代码库路径)

---

## 一、RV-Insights 当前现状

项目已完成 **Sprint 0-2**（基础架构层），但 **Sprint 3+（核心 AI 能力）尚未开始**：

| 维度 | 状态 | 说明 |
|------|------|------|
| FastAPI + LangGraph 骨架 | ✅ 完成 | 完整的 Pipeline StateGraph、5 阶段节点、人工审批门、检查点持久化 |
| MongoDB + PostgreSQL + Redis | ✅ 完成 | 三数据库连接、索引、基础 CRUD |
| 前端 Vue3 + SSE | ✅ 完成 | 案例列表/详情、Pipeline 可视化、Agent 事件日志、审核面板 |
| JWT 认证 + RBAC | ✅ 完成 | 注册/登录/刷新、角色权限控制 |
| Docker Compose | ✅ 完成 | 5 服务编排（nginx/backend/mongo/postgres/redis） |
| **Agent 适配器层** | ❌ **未实现** | `adapters/` 目录为空，Claude/OpenAI SDK 未接入 |
| **真实 LLM 调用** | ❌ **未实现** | 5 个 Pipeline 节点均返回 hardcoded stub 数据 |
| **ArtifactManager** | ❌ **未实现** | 补丁/日志/编译产物存储方案仅存在于 design.md |
| **数据源集成** | ❌ **未实现** | Patchwork API、邮件列表、GitHub API 均未接入 |
| **RISC-V 领域工具** | ❌ **未实现** | 无 checkpatch.pl、QEMU 沙箱、交叉编译环境 |

**测试覆盖**：8 个测试通过，覆盖率 78%，涵盖 health、cases、auth 模块。

---

## 二、ScienceClaw 提供的参考能力

ScienceClaw 是一个**生产级全栈 AI 平台**，具备以下 RV-Insights 完全缺失的能力：

| ScienceClaw 特性 | 价值 | RV-Insights 当前状态 |
|-----------------|------|---------------------|
| **deepagent 引擎** | 基于 LangGraph 的 Agent 执行引擎，内置 SSE 流式中间件、工具结果自动卸载、诊断日志 | ❌ 无 Agent 引擎 |
| **Skill 系统** | SKILL.md 工作流文档，Agent 自动发现加载，支持用户自然语言创建技能 | ❌ 无技能系统 |
| **工具热加载** | drop-in Python 文件自动检测，无需重启 | ❌ 无动态工具加载 |
| **SSE 精细化协议** | 8+ 事件类型（thinking/plan_update/tool_call/tool_result/statistics/error），工具元数据注册 | ⚠️ 基础 SSE 实现，事件类型不够丰富 |
| **沙箱执行** | Docker 隔离容器 + noVNC 浏览器 + xterm 终端，前端有 VNC/终端组件 | ❌ 无沙箱 |
| **任务调度服务** | Celery + 自然语言转 crontab，独立微服务 | ❌ 无定时任务 |
| **IM 集成** | 飞书/Lark/微信双向集成，消息去重，进度流式推送 | ❌ 无 IM 集成 |
| **Token 统计** | 30+ 模型家族的精确成本估算，趋势分析，按会话拆分 | ❌ 无成本追踪 |
| **自托管搜索** | SearXNG + Crawl4AI，替代付费 Tavily/Serper | ⚠️ RV-Insights 仍依赖 Serper API |
| **多格式报告** | 内置 PDF/DOCX/PPTX/XLSX 生成技能 | ❌ 无报告生成 |
| **会话分享** | 通过 URL 分享会话结果 | ❌ 无分享功能 |

### ScienceClaw 架构概览

```
ScienceClaw/
├── backend/
│   ├── deepagent/           # Agent 引擎核心
│   │   ├── agent.py         # Agent 组装：system prompt + LLM + tools + skills + SSE 中间件
│   │   ├── runner.py        # SSE 流式执行器（tool call/result 拦截、token 追踪、计划更新）
│   │   ├── engine.py        # 多模型工厂（50+ 模型自动上下文窗口检测）
│   │   ├── tools.py         # 内置工具：web_search, web_crawl, propose_skill_save, eval_skill
│   │   ├── sse_protocol.py  # SSE 协议管理器（工具注册、图标、分类、元数据）
│   │   └── middleware.py    # SSEMonitoringMiddleware + ToolResultOffloadMiddleware
│   ├── route/               # 11 个 FastAPI 路由模块
│   │   ├── sessions.py      # Session CRUD + SSE chat + 文件管理 + skill/tool 管理
│   │   ├── chat.py          # 任务调用聊天 API + 自然语言转 crontab
│   │   ├── statistics.py    # Token 使用统计 + 30+ 模型成本估算
│   │   └── ...
│   ├── im/                  # IM 集成
│   │   └── orchestrator.py  # 飞书/Lark/微信消息编排、去重、流式推送
│   └── builtin_skills/      # 9 个内置技能
├── frontend/                # Vue 3 + Vite + Tailwind + Monaco Editor + xterm + noVNC
│   ├── src/pages/           # 14 个页面（Chat, Home, Tasks, Skills, Tools, Share...）
│   └── src/components/      # 38 个组件（VNC 查看器、沙箱终端、分子查看器...）
├── Skills/                  # 6 个用户可复用技能
├── Tools/                   # 用户可 drop-in 的工具目录
├── task-service/            # Celery 任务调度独立微服务
└── docker-compose.yml       # 10 服务编排（含 sandbox、searxng、websearch、celery）
```

---

## 三、关键差距（按影响排序）

### 🔴 差距 1：Agent 执行引擎（最大瓶颈）

| 维度 | RV-Insights | ScienceClaw |
|------|-------------|-------------|
| **当前状态** | Pipeline 节点返回 `{"status": "completed", "result": "stub"}`，无真实 LLM 调用 | `deepagent/runner.py` 提供完整的 SSE 流式执行器 |
| **核心能力** | 仅 LangGraph StateGraph 骨架，节点函数为空壳 | 拦截工具调用、追踪 token、管理上下文窗口、诊断日志 |
| **差距影响** | **没有 Agent 引擎，整个产品无法运行** | — |

**具体表现**：
- `backend/app/pipeline/nodes.py` 中 5 个节点（explore/plan/develop/review/test）均使用 `_stub_*()` 函数
- 无 system prompt 加载逻辑
- 无工具配置与调用链
- 无 token 消耗追踪

### 🔴 差距 2：SDK 适配器层

| 维度 | RV-Insights | ScienceClaw |
|------|-------------|-------------|
| **当前状态** | `adapters/` 目录完全为空 | 统一封装多模型后端（OpenAI/Anthropic/DeepSeek 等） |
| **设计文档** | design.md 定义了 `AgentAdapter` / `ClaudeAgentAdapter` / `OpenAIAgentAdapter` | `engine.py` 实现 `create_deep_agent()` + 自动上下文窗口检测 |
| **差距影响** | **无法接入 Claude Agent SDK 和 OpenAI Agents SDK** | — |

**具体表现**：
- 无 `claude-agent-sdk` 调用封装
- 无 `openai-agents-sdk` Runner 集成
- 无模型降级链（Claude Sonnet → Haiku，GPT-4o → GPT-4o-mini）
- 无进程级资源管理（Claude SDK 子进程模型）

### 🟠 差距 3：SSE 事件粒度不足

| 维度 | RV-Insights | ScienceClaw |
|------|-------------|-------------|
| **当前状态** | 5 个事件类型：`stage_change` / `agent_output` / `review_request` / `error` / `completed` | 8+ 事件类型 + 工具元数据注册 |
| **协议设计** | 基础 SSE，无工具调用详情 | `sse_protocol.py` 定义完整工具注册表（图标、分类、描述） |
| **差距影响** | 前端无法精细化展示 Agent 思考过程、工具调用详情、计划更新 | — |

**ScienceClaw 事件类型**：
- `thinking` — Agent 推理过程
- `plan_update` — Todo 列表实时更新
- `tool_call` — 工具调用参数
- `tool_result` — 工具执行结果
- `planning_message` — 计划阶段消息
- `statistics` — Token 消耗统计
- `error` — 错误信息
- `step_start` / `step_end` — 步骤边界

### 🟠 差距 4：Skill / 工具生态

| 维度 | RV-Insights | ScienceClaw |
|------|-------------|-------------|
| **当前状态** | 无技能系统，工具需硬编码 | 15 个内置技能 + 用户可创建技能 |
| **技能定义** | 仅 design.md 中的 system prompt 模板 | SKILL.md 工作流文档，Agent 自动发现加载 |
| **差距影响** | RISC-V 领域工作流无法复用和共享 | — |

**ScienceClaw Skill 示例**：
- `brainstorming` — 头脑风暴
- `deep-research` — 深度研究
- `read-github` — GitHub 仓库分析
- `pdf` / `docx` / `pptx` / `xlsx` — 多格式文档处理
- `tool-creator` / `skill-creator` — 元技能（创建新工具/技能）

**RV-Insights 可借鉴**：将 design.md 中的 Explorer/Reviewer/Planner 等 system prompt 封装为 SKILL.md，实现 RISC-V 专用技能（如 "分析 ISA 扩展兼容性"、"生成内核补丁"）。

### 🟡 差距 5：沙箱与代码执行

| 维度 | RV-Insights | ScienceClaw |
|------|-------------|-------------|
| **当前状态** | Tester Agent 依赖 QEMU 交叉编译，但无沙箱实现 | 完整 Docker 沙箱 + MCP 协议 + 前端 VNC/终端组件 |
| **安全隔离** | 无 | seccomp:unconfined, 8GB RAM, 4 CPUs, 只读挂载 |
| **差距影响** | 无法安全执行编译/测试，无前端环境查看能力 | — |

**ScienceClaw 沙箱能力**：
- 浏览器自动化（noVNC 前端组件）
- Shell 访问（xterm 前端组件）
- 文件操作（MCP 协议）
- 代码执行（Python/Node/Bash）

**RV-Insights 需求**：为 Tester Agent 提供 RISC-V 交叉编译 + QEMU 运行环境。

### 🟡 差距 6：数据源与搜索

| 维度 | RV-Insights | ScienceClaw |
|------|-------------|-------------|
| **当前状态** | Explorer Agent 设计使用 Patchwork/WebSearch，但未实现 | 自托管 SearXNG + Crawl4AI，零 API 费用 |
| **外部依赖** | Serper API（付费） | 完全自托管 |
| **差距影响** | 依赖 Serper API 有成本和稳定性风险 | — |

---

## 四、可直接迁移的 ScienceClaw 模块

| 优先级 | 模块 | 迁移难度 | 收益 | 对应 RV-Insights 文件 |
|--------|------|---------|------|----------------------|
| **P0** | **SSE 协议 + Runner** | 中 | 立即提升前端实时交互体验 | `backend/app/pipeline/events.py` |
| **P0** | **Agent 引擎封装** | 高 | 解锁真实 LLM 调用能力 | `backend/app/pipeline/nodes.py` + `adapters/` |
| **P1** | **Skill 系统** | 中 | 将 RISC-V 领域知识封装为可复用工作流 | 新增 `backend/app/skills/` |
| **P1** | **Token 统计** | 低 | 补充成本监控，design.md 已有规划 | `backend/app/pipeline/cost.py`（已有骨架） |
| **P2** | **沙箱架构** | 高 | 为 Tester Agent 提供安全执行环境 | 新增 `backend/app/sandbox/` + Docker 服务 |
| **P2** | **SearXNG 搜索** | 中 | 替代 Serper API，降低成本 | 新增 `backend/app/datasources/searxng.py` |
| **P3** | **任务调度** | 中 | 支持 RISC-V 动态信息定时采集 | 新增 `task-service/` 微服务 |
| **P3** | **IM 集成** | 高 | 可选，适合团队协作场景 | 新增 `backend/app/im/` |

### 迁移路径建议

```
Phase 1 (2-3 周):
  ├── 迁移 SSE 协议（sse_protocol.py → events.py）
  ├── 实现 Agent 引擎（engine.py + runner.py → adapters/ + nodes.py）
  └── 接入 Claude/OpenAI SDK（完成 Sprint 3 目标）

Phase 2 (2 周):
  ├── 引入 Skill 系统（builtin_skills/ → skills/）
  ├── 定义首批 RISC-V 技能（Explorer/Reviewer/Planner prompt → SKILL.md）
  └── 完善 Token 统计（statistics.py → cost.py）

Phase 3 (3-4 周):
  ├── 部署 SearXNG 替代 Serper（docker-compose.yml 扩展）
  ├── 构建 Tester 沙箱（sandbox 服务 + QEMU 工具链）
  └── 集成 Patchwork API（datasources/patchwork.py）

Phase 4 (可选):
  ├── 任务调度服务（task-service/）
  └── IM 集成（im/orchestrator.py）
```

---

## 五、下一步建议

### 立即行动项（本周）

1. **启动 Sprint 3**：实现 `ClaudeAgentAdapter` + `OpenAIAgentAdapter`
   - 参考 ScienceClaw `deepagent/engine.py` 统一多模型调用接口
   - 参考 design.md 2.6 节的适配器设计，但采用 ScienceClaw 的工厂模式

2. **对齐 SSE 协议**：
   - 将 ScienceClaw 的 `sse_protocol.py` 事件类型映射到 RV-Insights 的 `EventPublisher`
   - 前端 `AgentEventLog.vue` 增加 `thinking` / `tool_call` / `tool_result` 渲染

3. **定义首批 RISC-V Skills**：
   - 将 design.md 5.12 节的 `EXPLORER_SYSTEM_PROMPT` 封装为 `skills/explorer_riscv.md`
   - 将 `REVIEWER_SYSTEM_PROMPT` 封装为 `skills/reviewer_riscv.md`

### 中期目标（1 个月内）

4. **引入沙箱**：为 Tester Agent 配置 Docker 沙箱（交叉编译工具链 + QEMU）
   - 参考 ScienceClaw `docker-compose.yml` 中的 `sandbox` 服务
   - 前端增加终端/VNC 查看组件（可选，可用日志查看器替代）

5. **替换 Serper**：部署 SearXNG 替代实时搜索依赖
   - 新增 `searxng` + `websearch` 服务到 docker-compose.yml
   - 修改 `backend/app/datasources/` 接入自托管搜索

6. **完善 ArtifactManager**：
   - 实现 design.md 2.7 节的产物存储架构
   - 为补丁文件、测试日志、编译产物提供持久化存储

### 长期目标（2-3 个月）

7. **任务调度服务**：支持 RISC-V 动态信息定时采集（邮件列表、会议更新）
8. **Agent 质量评估**：建立 eval 数据集，参考 design.md 8.4 节的评估框架
9. **IM 集成**：飞书/Lark 推送审核通知和进度更新

---

## 附录：参考代码库路径

| 项目 | 路径 | 关键文件 |
|------|------|---------|
| **RV-Insights** | `/Users/zq/Desktop/ai-projs/posp/RV-Insights` | `backend/app/pipeline/`, `web-console/src/`, `tasks/design.md` |
| **ScienceClaw** | `/Users/zq/Desktop/ai-projs/harness/ScienceClaw` | `ScienceClaw/backend/deepagent/`, `ScienceClaw/frontend/src/`, `Skills/` |

### 关键对比文件映射

| RV-Insights 文件 | ScienceClaw 对应参考 |
|-----------------|---------------------|
| `backend/app/pipeline/events.py` | `ScienceClaw/backend/deepagent/sse_protocol.py` |
| `backend/app/pipeline/nodes.py` | `ScienceClaw/backend/deepagent/runner.py` |
| `backend/app/adapters/` (空) | `ScienceClaw/backend/deepagent/engine.py` |
| `backend/app/pipeline/cost.py` | `ScienceClaw/backend/route/statistics.py` |
| `web-console/src/components/AgentEventLog.vue` | `ScienceClaw/frontend/src/components/ActivityPanel.vue` |
| `docker-compose.yml` (5 服务) | `ScienceClaw/docker-compose.yml` (10 服务) |

---

> **总结**：RV-Insights 的**基础设施层（API、数据库、前端框架、Pipeline 状态机）已非常扎实**，但**核心 AI 层（Agent 引擎、LLM 调用、工具执行）完全空白**。ScienceClaw 正好补全了这部分，其 `deepagent/` 引擎、SSE 协议、Skill 系统是最值得优先迁移的三大模块。
