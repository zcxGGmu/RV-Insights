# RV-Insights 项目设计方案

> **版本**: v1.0  
> **日期**: 2026-04-25  
> **状态**: 初稿  
> **作者**: RV-Insights Team

---

## v4 变更摘要（2026-04-28 追加）

> 本设计文档基于 v1.0 Pipeline-only 架构编写。v4（`mvp-tasks.md`）引入了 Chat + Pipeline 双模式架构，以下为关键变更。
> **Chat 模式后端架构详见 `tasks/chat-architecture.md`**（本文档不覆盖 Chat 后端设计）。

### 架构变更

- **双模式**：Chat 模式（通用对话 + 工具调用）与 Pipeline 模式（5 阶段 RISC-V 贡献流水线）并存
- **Chat 后端**：`ChatRunner` + `asyncio.Queue` SSE 推送，独立于 LangGraph Pipeline → 详见 `tasks/chat-architecture.md`
- **Pipeline 后端**：保持 LangGraph StateGraph，使用 Redis Pub/Sub 推送事件

### 前端路由变更

| 原设计（v1） | 现状（v4） | 说明 |
|-------------|-----------|------|
| `/` → DashboardView | `/` → HomePage（Chat 欢迎页） | 首页改为 Chat 入口 |
| 无 | `/chat/:id` → ChatPage | 新增 Chat 对话页 |
| `/cases` → CaseListView | `/cases` → CaseListView | 保持不变 |
| `/cases/:id` → CaseDetailView | `/cases/:id` → CaseDetailView | 保持不变 |
| `/knowledge` → KnowledgeView | 延后至 Phase 2 | MVP 不实现 |
| `/metrics` → MetricsView | `/statistics` → StatisticsPage | 重命名 |

### RBAC 简化

- v1 设计 3 角色（admin / reviewer / viewer）→ v4 简化为 2 角色（admin / user）
- 详见 5.11 节（已更新）

### 已知 v1/v4 矛盾清单

> ⚠️ 以下正文段落仍保留 v1 内容，阅读时以本表为准，不要按正文实现。

| 正文位置 | v1 内容（已过时） | v4 现状 | 权威来源 |
|----------|-------------------|---------|----------|
| 1.6 MVP 范围 | 8 周、max 2 轮审核、编译验证、无 Chat | 10 Sprint、max 3 轮、含 QEMU、双模式 | `mvp-tasks.md` |
| 4.2 目录结构 | `components/chat/AgentEventLog.vue` 等 v1 布局 | `components/shared/ActivityPanel.vue` 等 v4 布局 | `migration-map.md` |
| 4.3 路由设计 | `/` → Dashboard, `/knowledge`, `/metrics` | 见上方路由变更表 | `mvp-tasks.md` |
| 4.4+ 组件设计 | Pipeline-only 组件（无 ChatBox/SessionPanel 等） | Chat + Pipeline 双模式组件 | `migration-map.md` |
| 5.2 PipelineState | `max_review_iterations=3`（与 1.6 的 "max 2 轮" 矛盾） | 以代码为准：3 轮 | `design.md` 5.2 节 |
| 5.8 API 端点表 | `/api/v1/reviews/*`, `/api/v1/knowledge/*` | review 合并到 cases，knowledge 延后 Phase 2 | `api-contracts.md` |
| 5.11 RBAC | 原 3 角色（admin/reviewer/viewer） | 已更新为 2 角色（admin/user） | 5.11 节已修正 |
| 附录 C Gantt | Phase 1 起始 2026-05-01 | Sprint 0-2 已于 2026-04-25 完成 | `progress.md` |

### 章节有效性

| 章节 | 状态 |
|------|------|
| 1. 项目定位 | ✅ 有效（1.6 MVP 范围以 `mvp-tasks.md` 为准） |
| 2. 系统架构 | ✅ 有效（补充 Chat 模式，详见 `chat-architecture.md`） |
| 3. SDK 选型 | ✅ 有效 |
| 4.1 前端技术栈 | ✅ 有效 |
| 4.2 目录结构 | ⚠️ 过时 → 以 `migration-map.md` 为准 |
| 4.3 路由设计 | ⚠️ 过时 → 见上方路由变更表 |
| 4.4+ 组件设计 | ⚠️ 部分过时 → Chat 组件见 `migration-map.md` |
| 5.1-5.10 后端设计 | ✅ 有效（仅 Pipeline 模式，Chat 见 `chat-architecture.md`） |
| 5.11 认证鉴权 | ✅ 已更新为 2 角色 |
| 6. 数据库设计 | ✅ 有效（补充 `chat_sessions` 集合，schema 见 `chat-architecture.md`） |
| 7. 部署方案 | ✅ 有效 |
| 8. 测试策略 | ✅ 有效（补充 Chat 测试策略见 `conventions.md` 13 节） |

---

## 目录

- [1. 项目概述与目标](#1-项目概述与目标)
  - [1.1 项目定位](#11-项目定位)
  - [1.2 核心流程](#12-核心流程)
  - [1.3 设计原则](#13-设计原则)
  - [1.4 非目标](#14-非目标)
  - [1.5 用户故事与使用场景](#15-用户故事与使用场景)
  - [1.6 MVP 范围定义](#16-mvp-范围定义)
  - [1.7 与现有工具对比](#17-与现有工具对比)
- [2. 系统架构设计](#2-系统架构设计)
  - [2.1 整体架构图](#21-整体架构图)
  - [2.2 前后端分层架构](#22-前后端分层架构)
  - [2.3 Agent Pipeline 流程图](#23-agent-pipeline-流程图)
  - [2.4 数据流图](#24-数据流图)
  - [2.5 跨 SDK 通信机制](#25-跨-sdk-通信机制)
  - [2.6 跨 SDK 适配器层](#26-跨-sdk-适配器层)
  - [2.7 产物存储架构](#27-产物存储架构)
  - [2.8 SSE 事件总线](#28-sse-事件总线)
- [3. SDK 选型分析与依据](#3-sdk-选型分析与依据)
  - [3.1 Claude Agent SDK 架构解析](#31-claude-agent-sdk-架构解析)
  - [3.2 OpenAI Agents SDK 架构解析](#32-openai-agents-sdk-架构解析)
  - [3.3 两个 SDK 本质差异对比](#33-两个-sdk-本质差异对比)
  - [3.4 混合使用方案](#34-混合使用方案)
  - [3.5 各 Agent 阶段 SDK 分配](#35-各-agent-阶段-sdk-分配)
  - [3.6 选型决策总结](#36-选型决策总结)
  - [3.7 成本估算对比](#37-成本估算对比)
  - [3.8 SDK 版本锁定与兼容性策略](#38-sdk-版本锁定与兼容性策略)
  - [3.9 技术风险与缓解](#39-技术风险与缓解)
- [4. 前端设计方案](#4-前端设计方案)
  - [4.1 技术栈选型](#41-技术栈选型)
  - [4.2 项目目录结构](#42-项目目录结构)
  - [4.3 页面路由设计](#43-页面路由设计)
  - [4.4 核心组件设计](#44-核心组件设计)
  - [4.5 状态管理](#45-状态管理)
  - [4.6 SSE 实时通信方案](#46-sse-实时通信方案)
  - [4.7 类型定义与后端对齐](#47-类型定义与后端对齐)
  - [4.8 CaseDetailView 页面布局](#48-casedetailview-页面布局)
  - [4.9 响应式设计策略](#49-响应式设计策略)
  - [4.10 国际化 (i18n)](#410-国际化-i18n)
  - [4.11 无障碍设计 (Accessibility)](#411-无障碍设计-accessibility)
  - [4.12 前端错误处理](#412-前端错误处理)
- [5. 后端设计方案](#5-后端设计方案)
  - [5.1 FastAPI + LangGraph 架构](#51-fastapi--langgraph-架构)
  - [5.2 LangGraph StateGraph 状态机](#52-langgraph-stategraph-状态机)
  - [5.3 各 Agent 节点详细设计](#53-各-agent-节点详细设计)
  - [5.4 Human-in-the-Loop 审批门](#54-human-in-the-loop-审批门)
  - [5.5 Develop ↔ Review 迭代循环](#55-develop--review-迭代循环)
  - [5.6 数据源接入设计](#56-数据源接入设计)
  - [5.7 Agent 间数据契约](#57-agent-间数据契约)
  - [5.8 API 接口设计](#58-api-接口设计)
  - [5.9 错误处理与重试策略](#59-错误处理与重试策略)
  - [5.10 并发控制与资源调度](#510-并发控制与资源调度)
  - [5.11 认证鉴权设计](#511-认证鉴权设计)
  - [5.12 Agent System Prompt 工程](#512-agent-system-prompt-工程)
  - [5.13 日志与可观测性](#513-日志与可观测性)
  - [5.14 FastAPI 应用初始化](#514-fastapi-应用初始化)
  - [5.15 结构化输出与解析容错](#515-结构化输出与解析容错)
- [6. 数据库设计](#6-数据库设计)
  - [6.1 MongoDB 集合设计](#61-mongodb-集合设计)
  - [6.2 PostgreSQL (LangGraph Checkpointer)](#62-postgresql-langgraph-checkpointer)
  - [6.3 索引设计](#63-索引设计)
  - [6.4 数据生命周期管理](#64-数据生命周期管理)
  - [6.5 备份策略](#65-备份策略)
- [7. 部署方案](#7-部署方案)
  - [7.1 Docker Compose 服务编排](#71-docker-compose-服务编排)
  - [7.2 Nginx 反向代理](#72-nginx-反向代理)
  - [7.3 环境变量管理](#73-环境变量管理)
  - [7.4 Backend Dockerfile](#74-backend-dockerfile)
  - [7.5 监控与告警](#75-监控与告警)
- [8. 测试方案](#8-测试方案)
  - [8.1 单元测试](#81-单元测试)
  - [8.2 集成测试](#82-集成测试)
  - [8.3 E2E 测试](#83-e2e-测试)
  - [8.4 Agent 质量评估](#84-agent-质量评估)
  - [8.5 CI/CD 集成](#85-cicd-集成)
  - [8.6 性能测试](#86-性能测试)
  - [8.7 安全测试](#87-安全测试)
  - [8.8 Agent Prompt 回归测试](#88-agent-prompt-回归测试)
- [9. 安全设计方案](#9-安全设计方案)
  - [9.1 威胁模型](#91-威胁模型)
  - [9.2 Agent 沙箱安全](#92-agent-沙箱安全)
  - [9.3 Prompt 注入防护](#93-prompt-注入防护)
  - [9.4 API 安全](#94-api-安全)
- [10. 可观测性与监控](#10-可观测性与监控)
  - [10.1 监控架构](#101-监控架构)
  - [10.2 关键仪表盘](#102-关键仪表盘)
  - [10.3 告警规则](#103-告警规则)

---

## 1. 项目概述与目标

### 1.1 项目定位

RV-Insights 是一个面向 RISC-V 开源软件生态的 **LLM 驱动多 Agent 贡献平台**。平台通过多个专业化 AI Agent 的协作，自动化完成从贡献点发现、方案规划、代码开发、代码审核到测试验证的完整开源贡献流程。

目标用户包括：
- RISC-V 生态开发者：希望高效参与上游贡献但受限于时间和经验
- 研究团队：需要系统性地向 RISC-V 工具链提交补丁
- 开源社区维护者：需要自动化工具辅助补丁质量把控

目标代码库覆盖：
- Linux 内核 RISC-V 架构（`arch/riscv/`）
- QEMU RISC-V 目标（`target/riscv/`）
- OpenSBI（`riscv-software-src/opensbi`）
- GCC RISC-V 后端（`gcc/config/riscv/`）
- LLVM RISC-V 后端（`llvm/lib/Target/RISCV/`）

### 1.2 核心流程

平台采用 **五阶段 Agent Pipeline** 架构，每个阶段由专业化 Agent 驱动，阶段之间设置人工审核门禁（Human-in-the-Loop Gate）：

```mermaid
flowchart TD
    START([用户输入/自动发现]) --> EXPLORE[🔍 探索 Agent<br/>Claude Agent SDK]
    EXPLORE --> GATE1{👤 人工审核<br/>探索结果}
    GATE1 -->|通过| PLAN[📋 规划 Agent<br/>OpenAI Agents SDK]
    GATE1 -->|驳回| EXPLORE
    PLAN --> GATE2{👤 人工审核<br/>开发方案}
    GATE2 -->|通过| DEVELOP[💻 开发 Agent<br/>Claude Agent SDK]
    GATE2 -->|驳回| PLAN
    DEVELOP --> REVIEW[🔎 审核 Agent<br/>OpenAI Agents SDK]
    REVIEW -->|发现问题| DEVELOP
    REVIEW -->|审核通过| GATE3{👤 人工审核<br/>代码产物}
    GATE3 -->|通过| TEST[🧪 测试 Agent<br/>Claude Agent SDK]
    GATE3 -->|驳回| DEVELOP
    TEST --> GATE4{👤 人工审核<br/>测试结果}
    GATE4 -->|通过| DONE([✅ 贡献完成<br/>生成补丁/PR])
    GATE4 -->|驳回| DEVELOP
```

关键特性：
- **Develop ↔ Review 迭代循环**：开发 Agent 和审核 Agent 进行多轮迭代，审核 Agent 报出问题后开发 Agent 修复，最多迭代 3 轮
- **人工审核门禁**：每个阶段输出后暂停，等待人工确认后才进入下一阶段
- **双 SDK 混合驱动**：执行密集型阶段（探索/开发/测试）使用 Claude Agent SDK，推理判断型阶段（规划/审核）使用 OpenAI Agents SDK

### 1.3 设计原则

| 编号 | 原则 | 说明 |
|------|------|------|
| P1 | **Human-in-the-Loop** | 每个阶段输出必须经人工审核确认，AI 不得自主推进到下一阶段 |
| P2 | **Evidence-First** | 所有 Agent 决策必须附带证据链（代码引用、邮件链接、测试日志） |
| P3 | **Minimal Blast Radius** | 每次贡献聚焦单一变更，避免大范围修改 |
| P4 | **Recoverable** | 任何阶段失败均可回退到上一阶段重新执行 |
| P5 | **Auditable** | 全流程操作日志可追溯，支持事后审计 |
| P6 | **SDK Best-of-Both** | 根据任务特性选择最合适的 SDK，而非强制统一 |
| P7 | **Progressive Automation** | 初期以人工审核为主，随着信任度提升逐步放宽自动化程度 |

### 1.4 非目标

- **不是通用 AI 编程助手**：专注 RISC-V 生态贡献，不处理任意编程任务
- **不自动提交补丁**：最终提交动作始终由人工执行
- **不替代 maintainer 审核**：平台审核是预审，不替代上游社区的正式 review
- **不处理硬件设计**：仅覆盖软件层面（内核、工具链、固件、模拟器）

### 1.5 用户故事与使用场景

#### 场景 1：ISA 扩展支持（典型贡献）

> 作为 RISC-V 生态开发者，我希望平台能自动发现新批准但尚未在 Linux 内核中实现的 ISA 扩展，并生成符合上游标准的补丁。

```
触发: 用户输入 "检查最近 Ratified 的 RISC-V 扩展是否已有内核支持"
→ Explorer: 对比 riscv-isa-manual 与 arch/riscv/kernel/cpufeature.c
→ 发现 Zicfiss (Shadow Stack) 已 Ratified 但内核无支持
→ Planner: 设计 hwcap 注册 + cpufeature 检测 + Kconfig 选项
→ Developer: 生成补丁 (3 files, ~120 lines)
→ Reviewer: checkpatch.pl 通过, 无安全问题, commit message 格式正确
→ Tester: QEMU 启动验证 /proc/cpuinfo 显示新扩展
→ 输出: git format-patch 格式补丁 + cover letter
```

#### 场景 2：Bug 修复（社区驱动）

> 作为研究团队成员，我在邮件列表中看到一个 RISC-V 向量扩展的 QEMU 模拟 bug 报告，希望平台辅助修复。

```
触发: 用户粘贴邮件列表链接
→ Explorer: 解析邮件线程, 定位 target/riscv/vector_helper.c 中的问题
→ Planner: 设计最小修复方案 + 回归测试
→ Developer: 修复整数溢出 (1 file, ~5 lines)
→ Reviewer: 确认修复正确, 无副作用
→ Tester: 运行 riscv-tests 向量测试套件
→ 输出: 补丁 + Reported-by/Fixes tag
```

#### 场景 3：代码清理（自主发现）

> 平台定期扫描 RISC-V 代码库，自动发现可改进的代码质量问题。

```
触发: 定时任务 (每周)
→ Explorer: 运行 checkpatch.pl, 扫描 TODO/FIXME, 检查废弃 API 使用
→ 发现 arch/riscv/mm/ 中 3 处使用了已废弃的 pte_offset_kernel()
→ Planner: 设计迁移到 pte_offset_kernel_fixmap() 的方案
→ Developer: 批量替换 + 验证编译
→ Reviewer: 确认语义等价
→ Tester: 编译通过 + 启动测试
→ 输出: cleanup 补丁
```

### 1.6 MVP 范围定义

**Phase 1 — MVP（8 周）**：

| 范围 | 包含 | 不包含 |
|------|------|--------|
| 目标仓库 | Linux 内核 `arch/riscv/` | QEMU, GCC, LLVM, OpenSBI |
| 贡献类型 | ISA 扩展支持, 代码清理 | Bug 修复, 性能优化 |
| 探索方式 | 用户输入 + Patchwork API | 邮件列表自动爬取 |
| 审核迭代 | 最多 2 轮 | 3 轮 + 升级机制 |
| 测试环境 | 编译验证 | QEMU 运行时测试 |
| 前端 | 案例列表 + 详情 + 审核 | 仪表盘, 知识库, 指标 |
| 部署 | Docker Compose 单机 | K8s, 多节点 |

**Phase 2 — 完整版（+8 周）**：扩展到全部目标仓库、全部贡献类型、QEMU 测试环境、完整前端。

**Phase 3 — 生产级（+4 周）**：监控告警、安全加固、性能优化、文档完善。

### 1.7 与现有工具对比

| 维度 | SWE-Agent | Aider | OpenDevin | RV-Insights |
|------|-----------|-------|-----------|-------------|
| 定位 | 通用 Issue 修复 | 交互式编程助手 | 通用 AI 开发平台 | RISC-V 专项贡献 |
| Agent 数量 | 单 Agent | 单 Agent | 多 Agent | 5 Agent Pipeline |
| 领域知识 | 无 | 无 | 无 | RISC-V 生态深度集成 |
| 贡献发现 | 需人工指定 Issue | 需人工指定 | 需人工指定 | 自主探索 + 人工输入 |
| 审核机制 | 无 | 无 | 基础 | 多轮迭代审核 |
| 测试验证 | 运行已有测试 | 无 | 基础沙箱 | QEMU + 交叉编译环境 |
| 人工介入 | 事后检查 | 实时交互 | 事后检查 | 阶段性门禁审核 |
| SDK 架构 | 自研 | 自研 | 自研 | Claude + OpenAI 双 SDK |

---

## 2. 系统架构设计

### 2.1 整体架构图

系统采用四层架构：用户交互层 → 编排层 → Agent 能力层 → 工具基础设施层。

```mermaid
graph TD
    subgraph 用户交互层
        WEB[Web Console<br/>Vue 3 + Vite]
        API_CLIENT[API Client<br/>REST + SSE]
    end

    subgraph 编排层
        GATEWAY[FastAPI Gateway<br/>认证 / 路由 / SSE]
        LANGGRAPH[LangGraph StateGraph<br/>Pipeline 状态机]
        CHECKPOINT[AsyncPostgresSaver<br/>持久化检查点]
    end

    subgraph Agent能力层
        subgraph Claude Agent SDK
            EXPLORE_A[Explorer Agent<br/>Read/Grep/WebSearch]
            DEVELOP_A[Developer Agent<br/>Write/Edit/Bash]
            TEST_A[Tester Agent<br/>Bash/Sandbox]
        end
        subgraph OpenAI Agents SDK
            PLAN_A[Planner Agent<br/>Guardrails/Handoff]
            REVIEW_A[Reviewer Agent<br/>Codex/Handoff]
        end
    end

    subgraph 工具基础设施层
        PATCHWORK[Patchwork API<br/>补丁追踪]
        MAIL[邮件列表<br/>lore.kernel.org]
        GITHUB[GitHub API<br/>OpenSBI/riscv-tests]
        SANDBOX[QEMU Sandbox<br/>交叉编译/测试]
        MONGO[(MongoDB<br/>业务数据)]
        PG[(PostgreSQL<br/>LangGraph 检查点)]
        REDIS[(Redis<br/>缓存/队列)]
    end

    WEB --> API_CLIENT
    API_CLIENT --> GATEWAY
    GATEWAY --> LANGGRAPH
    LANGGRAPH --> CHECKPOINT
    LANGGRAPH --> EXPLORE_A
    LANGGRAPH --> PLAN_A
    LANGGRAPH --> DEVELOP_A
    LANGGRAPH --> REVIEW_A
    LANGGRAPH --> TEST_A
    EXPLORE_A --> PATCHWORK
    EXPLORE_A --> MAIL
    EXPLORE_A --> GITHUB
    DEVELOP_A --> SANDBOX
    TEST_A --> SANDBOX
    GATEWAY --> MONGO
    CHECKPOINT --> PG
    GATEWAY --> REDIS
```

### 2.2 前后端分层架构

```mermaid
graph LR
    subgraph Browser
        VUE[Vue 3 SPA]
    end

    subgraph Nginx
        STATIC[静态资源]
        PROXY[反向代理]
    end

    subgraph Backend
        FASTAPI[FastAPI<br/>Port 8000]
        SSE_EP[SSE Endpoint<br/>/api/v1/cases/:id/events]
        REST_EP[REST Endpoints<br/>/api/v1/*]
    end

    subgraph Engine
        LG[LangGraph Engine]
        CLAUDE_SDK[Claude Agent SDK]
        OPENAI_SDK[OpenAI Agents SDK]
    end

    subgraph Storage
        MDB[(MongoDB)]
        PDB[(PostgreSQL)]
        RDB[(Redis)]
    end

    VUE -->|HTTP/SSE| STATIC
    STATIC --> PROXY
    PROXY -->|/api/*| FASTAPI
    FASTAPI --> SSE_EP
    FASTAPI --> REST_EP
    REST_EP --> MDB
    SSE_EP --> LG
    LG --> CLAUDE_SDK
    LG --> OPENAI_SDK
    LG --> PDB
    FASTAPI --> RDB
```

### 2.3 Agent Pipeline 流程图

以下状态图展示了一个贡献案例（Case）在 Pipeline 中的完整生命周期：

```mermaid
stateDiagram-v2
    [*] --> Created: 创建案例

    Created --> Exploring: 启动探索

    state Exploring {
        [*] --> ScanMailingList: 扫描邮件列表
        ScanMailingList --> AnalyzeCodebase: 分析代码库
        AnalyzeCodebase --> VerifyFeasibility: 验证可行性
        VerifyFeasibility --> [*]
    }

    Exploring --> PendingExploreReview: 探索完成
    PendingExploreReview --> Exploring: 驳回(修改后重试)
    PendingExploreReview --> Planning: 通过

    state Planning {
        [*] --> DesignDevPlan: 设计开发方案
        DesignDevPlan --> DesignTestPlan: 设计测试方案
        DesignTestPlan --> ValidatePlan: 验证方案完整性
        ValidatePlan --> [*]
    }

    Planning --> PendingPlanReview: 规划完成
    PendingPlanReview --> Planning: 驳回(修改后重试)
    PendingPlanReview --> Developing: 通过

    state DevReviewLoop {
        [*] --> Coding: 代码开发
        Coding --> Reviewing: 提交审核
        Reviewing --> Coding: 发现问题(≤3轮)
        Reviewing --> [*]: 审核通过
    }

    Developing --> DevReviewLoop
    DevReviewLoop --> PendingCodeReview: 审核通过
    PendingCodeReview --> Developing: 驳回
    PendingCodeReview --> Testing: 通过

    state Testing {
        [*] --> SetupEnv: 搭建测试环境
        SetupEnv --> RunTests: 执行测试
        RunTests --> CollectResults: 收集结果
        CollectResults --> [*]
    }

    Testing --> PendingTestReview: 测试完成
    PendingTestReview --> Developing: 驳回(需修复)
    PendingTestReview --> Completed: 通过

    Completed --> [*]: 生成补丁/PR

    PendingExploreReview --> Abandoned: 放弃
    PendingPlanReview --> Abandoned: 放弃
    PendingCodeReview --> Abandoned: 放弃
    PendingTestReview --> Abandoned: 放弃
    Abandoned --> [*]
```

### 2.4 数据流图

展示各 Agent 之间的数据契约流转：

```mermaid
sequenceDiagram
    participant U as 用户
    participant E as Explorer<br/>(Claude SDK)
    participant P as Planner<br/>(OpenAI SDK)
    participant D as Developer<br/>(Claude SDK)
    participant R as Reviewer<br/>(OpenAI SDK)
    participant T as Tester<br/>(Claude SDK)

    U->>E: InputContext<br/>(用户提示 + 目标仓库)
    activate E
    E->>E: 扫描 Patchwork API
    E->>E: 分析代码库 (Read/Grep/Glob)
    E->>E: 验证可行性
    E-->>U: ExplorationResult<br/>(贡献点 + 证据链)
    deactivate E

    U->>P: ExplorationResult (审核通过)
    activate P
    P->>P: 设计开发方案 (Guardrails 验证)
    P->>P: 设计测试方案
    P-->>U: ExecutionPlan<br/>(开发步骤 + 测试用例)
    deactivate P

    U->>D: ExecutionPlan (审核通过)
    activate D

    loop Develop ↔ Review (最多3轮)
        D->>D: 代码开发 (Write/Edit/Bash)
        D-->>R: DevelopmentResult<br/>(补丁 + 变更说明)
        activate R
        R->>R: 安全审核 (Handoff → SecurityReviewer)
        R->>R: 正确性审核 (Handoff → CorrectnessReviewer)
        R->>R: 风格审核 (Handoff → StyleReviewer)
        R-->>D: ReviewVerdict<br/>(通过/驳回 + findings)
        deactivate R
    end

    D-->>U: DevelopmentResult (审核通过)
    deactivate D

    U->>T: DevelopmentResult + ExecutionPlan (审核通过)
    activate T
    T->>T: 搭建 QEMU 环境
    T->>T: 交叉编译
    T->>T: 执行测试套件
    T-->>U: TestResult<br/>(通过/失败 + 日志)
    deactivate T

    U->>U: 最终确认 → 生成补丁
```

### 2.5 跨 SDK 通信机制

Claude Agent SDK 和 OpenAI Agents SDK 运行在同一 Python 进程中，通过 LangGraph StateGraph 的共享状态进行通信。两个 SDK 不直接交互，而是通过 Pydantic 模型序列化/反序列化传递数据：

```
Explorer (Claude SDK)
    ↓ 输出 ExplorationResult → JSON → 写入 StateGraph state
    ↓
LangGraph StateGraph (中介)
    ↓ 读取 state → 反序列化为 ExplorationResult → 传入 Planner
    ↓
Planner (OpenAI SDK)
```

通信协议：
- **数据格式**：Pydantic v2 模型，JSON 序列化
- **传递方式**：LangGraph `state["stage_outputs"]` 字典
- **类型安全**：每个 Agent 节点函数声明输入/输出类型
- **大文件处理**：补丁文件、测试日志等大型产物存储在文件系统，state 中仅保存路径引用

### 2.6 跨 SDK 适配器层

为统一两个 SDK 的调用接口，设计 AgentAdapter 抽象层：

```python
from abc import ABC, abstractmethod
from typing import Any, AsyncIterator
from pydantic import BaseModel

class AgentEvent(BaseModel):
    """Agent 执行过程中的事件"""
    event_type: str  # "thinking" | "tool_call" | "tool_result" | "output" | "error"
    data: dict[str, Any]

class AgentAdapter(ABC):
    """跨 SDK Agent 适配器基类

    注意：两个 SDK 的执行模型存在本质差异：
    - Claude Agent SDK：子进程模型，每次 query() 启动独立运行时
    - OpenAI Agents SDK：库原生模型，在当前进程内执行

    适配器层统一了外部接口（AsyncIterator[AgentEvent]），
    但内部实现需要分别处理进程管理和异步调用。
    """

    @abstractmethod
    async def execute(
        self,
        prompt: str,
        context: dict[str, Any],
        working_dir: str | None = None,
    ) -> AsyncIterator[AgentEvent]:
        """执行 Agent 任务，流式返回事件"""
        ...

    @abstractmethod
    async def cancel(self) -> None:
        """取消正在执行的任务"""
        ...


class ClaudeAgentAdapter(AgentAdapter):
    """Claude Agent SDK 适配器 — 子进程模型

    重要：Claude Agent SDK 基于 Claude Code 架构，每次 query() 调用
    启动一个独立子进程。这意味着：
    - 不能共享进程内状态，需通过文件系统或 stdin/stdout 传递数据
    - 资源管理需要进程级控制（信号、PID 追踪、超时）
    - cancel() 需要发送 SIGTERM 到子进程
    """

    def __init__(
        self,
        allowed_tools: list[str],
        permission_mode: str = "acceptEdits",
        max_turns: int = 50,
        timeout_seconds: int = 1800,  # 30 分钟超时
    ):
        self.allowed_tools = allowed_tools
        self.permission_mode = permission_mode
        self.max_turns = max_turns
        self.timeout_seconds = timeout_seconds
        self._current_process: asyncio.subprocess.Process | None = None

    async def execute(self, prompt, context, working_dir=None):
        import asyncio
        from claude_agent_sdk import query, ClaudeAgentOptions

        options = ClaudeAgentOptions(
            cwd=working_dir,
            allowed_tools=self.allowed_tools,
            permission_mode=self.permission_mode,
            max_turns=self.max_turns,
        )

        try:
            async with asyncio.timeout(self.timeout_seconds):
                async for message in query(prompt=prompt, options=options):
                    yield AgentEvent(
                        event_type=self._map_event_type(message),
                        data=self._extract_data(message),
                    )
        except asyncio.TimeoutError:
            yield AgentEvent(
                event_type="error",
                data={"message": f"Agent 执行超时 ({self.timeout_seconds}s)", "recoverable": True},
            )
        except Exception as e:
            yield AgentEvent(
                event_type="error",
                data={"message": str(e), "recoverable": False},
            )

    async def cancel(self):
        """通过信号终止子进程"""
        if self._current_process and self._current_process.returncode is None:
            self._current_process.terminate()
            try:
                await asyncio.wait_for(self._current_process.wait(), timeout=5)
            except asyncio.TimeoutError:
                self._current_process.kill()

    @staticmethod
    def _map_event_type(message) -> str:
        # 根据 Claude Agent SDK 消息类型映射
        msg_type = getattr(message, "type", "unknown")
        return {
            "assistant": "thinking",
            "tool_use": "tool_call",
            "tool_result": "tool_result",
            "result": "output",
        }.get(msg_type, "output")

    @staticmethod
    def _extract_data(message) -> dict:
        return {
            "type": getattr(message, "type", "unknown"),
            "content": getattr(message, "content", str(message)),
        }


class OpenAIAgentAdapter(AgentAdapter):
    """OpenAI Agents SDK 适配器 — 用于 Planner / Reviewer"""

    def __init__(self, agent_config: dict):
        self.agent_config = agent_config

    async def execute(self, prompt, context, working_dir=None):
        from agents import Agent, Runner
        agent = Agent(**self.agent_config)
        result = await Runner.run(agent, prompt)
        yield AgentEvent(
            event_type="output",
            data={"content": result.final_output},
        )

    async def cancel(self):
        pass  # OpenAI SDK 通过 Runner 管理取消
```

### 2.7 产物存储架构

Agent 产物（补丁文件、测试日志、编译产物）的存储策略：

```mermaid
graph TD
    subgraph Agent产物
        PATCH[补丁文件<br/>.patch / .diff]
        LOG[测试日志<br/>.log / .txt]
        BUILD[编译产物<br/>.o / vmlinux]
        REPORT[审核报告<br/>.json]
    end

    subgraph 存储层
        FS[本地文件系统<br/>/data/artifacts/{case_id}/]
        MONGO_REF[MongoDB<br/>路径引用]
    end

    PATCH --> FS
    LOG --> FS
    BUILD --> FS
    REPORT --> FS
    FS --> MONGO_REF
```

**存储规则**：
- 小型结构化数据（< 64KB）：直接嵌入 MongoDB 文档（如 ReviewVerdict JSON）
- 中型文本数据（64KB - 10MB）：存储到文件系统，MongoDB 保存路径引用
- 大型二进制数据（> 10MB）：存储到文件系统，设置 TTL 自动清理（30 天）

**目录结构**：
```
/data/artifacts/
├── case_20260425_001/
│   ├── explore/
│   │   └── exploration_report.json
│   ├── plan/
│   │   └── execution_plan.json
│   ├── develop/
│   │   ├── round_1/
│   │   │   ├── 0001-Add-Zicfiss-support.patch
│   │   │   └── changes.json
│   │   └── round_2/
│   │       ├── 0001-Add-Zicfiss-support-v2.patch
│   │       └── changes.json
│   ├── review/
│   │   ├── round_1_verdict.json
│   │   └── round_2_verdict.json
│   └── test/
│       ├── build.log
│       ├── test_output.log
│       └── test_result.json
```

**产物管理器**：

```python
import aiofiles
from pathlib import Path

class ArtifactManager:
    """Agent 产物管理器"""

    def __init__(self, base_dir: str = "/data/artifacts"):
        self.base_dir = Path(base_dir)

    def get_case_dir(self, case_id: str, stage: str, round_num: int | None = None) -> Path:
        path = self.base_dir / case_id / stage
        if round_num is not None:
            path = path / f"round_{round_num}"
        path.mkdir(parents=True, exist_ok=True)
        return path

    async def save_artifact(
        self, case_id: str, stage: str, filename: str, content: str | bytes,
        round_num: int | None = None,
    ) -> str:
        """保存产物并返回相对路径"""
        dir_path = self.get_case_dir(case_id, stage, round_num)
        file_path = dir_path / filename
        mode = "wb" if isinstance(content, bytes) else "w"
        async with aiofiles.open(file_path, mode) as f:
            await f.write(content)
        return str(file_path.relative_to(self.base_dir))

    async def load_artifact(self, relative_path: str) -> str:
        """根据相对路径加载产物"""
        file_path = self.base_dir / relative_path
        async with aiofiles.open(file_path, "r") as f:
            return await f.read()

    async def cleanup_case(self, case_id: str, keep_final: bool = True):
        """清理案例产物（可选保留最终版本）"""
        import shutil
        case_dir = self.base_dir / case_id
        if not keep_final:
            shutil.rmtree(case_dir, ignore_errors=True)
        else:
            # 仅保留最后一轮的产物
            for stage_dir in case_dir.iterdir():
                if stage_dir.is_dir():
                    rounds = sorted(stage_dir.glob("round_*"))
                    for old_round in rounds[:-1]:
                        shutil.rmtree(old_round)
```

### 2.8 SSE 事件总线

LangGraph 节点函数是异步函数，返回状态更新，不原生向外部消费者发射流式事件。需要一个 Pub/Sub 层桥接 Agent 执行事件到 SSE 端点。

```mermaid
sequenceDiagram
    participant LG as LangGraph Node
    participant R as Redis Pub/Sub
    participant SSE as FastAPI SSE Endpoint
    participant C as Vue 3 Client

    LG->>R: PUBLISH case:{id}:events {event_json}
    R-->>SSE: Message (subscription)
    SSE-->>C: SSE event (data: event_json)

    Note over LG,R: Agent 节点内部发布事件
    Note over R,SSE: SSE 端点订阅 Redis 频道
    Note over SSE,C: 客户端通过 EventSource 接收
```

**事件发布器**（Agent 节点内部使用）：

```python
import redis.asyncio as aioredis
from pydantic import BaseModel
from datetime import datetime

class PipelineEvent(BaseModel):
    """Pipeline 事件（通过 Redis Pub/Sub 传递）"""
    seq: int                    # 单调递增序列号（用于重连恢复）
    case_id: str
    event_type: str             # stage_change | agent_output | review_request | ...
    data: dict
    timestamp: str

class EventPublisher:
    """Agent 事件发布器 — 桥接 LangGraph 节点到 SSE"""

    def __init__(self, redis: aioredis.Redis):
        self.redis = redis
        self._seq_counters: dict[str, int] = {}

    async def publish(self, case_id: str, event_type: str, data: dict):
        seq = self._seq_counters.get(case_id, 0) + 1
        self._seq_counters[case_id] = seq

        event = PipelineEvent(
            seq=seq,
            case_id=case_id,
            event_type=event_type,
            data=data,
            timestamp=datetime.utcnow().isoformat(),
        )
        # 发布到 Redis 频道
        await self.redis.publish(f"case:{case_id}:events", event.model_dump_json())
        # 同时写入 Redis Stream（用于重连恢复）
        await self.redis.xadd(
            f"case:{case_id}:stream",
            {"event": event.model_dump_json()},
            maxlen=500,  # 保留最近 500 条事件
        )

    async def get_events_since(self, case_id: str, last_seq: int) -> list[PipelineEvent]:
        """重连时恢复丢失的事件"""
        raw = await self.redis.xrange(f"case:{case_id}:stream")
        events = [PipelineEvent.model_validate_json(r[1]["event"]) for r in raw]
        return [e for e in events if e.seq > last_seq]
```

**SSE 端点（消费侧）**：

```python
# route/cases.py
from sse_starlette.sse import EventSourceResponse

@router.get("/api/v1/cases/{case_id}/events")
async def case_events(
    case_id: str,
    last_event_id: int | None = Header(None, alias="Last-Event-ID"),
    user: User = Depends(get_current_user),
):
    """SSE 事件流 — 订阅 Redis Pub/Sub + 重连恢复"""
    publisher: EventPublisher = request.app.state.event_publisher

    async def event_generator():
        # 1. 重连恢复：发送断连期间丢失的事件
        if last_event_id is not None:
            missed = await publisher.get_events_since(case_id, last_event_id)
            for event in missed:
                yield {"id": str(event.seq), "event": event.event_type, "data": event.model_dump_json()}

        # 2. 实时订阅
        pubsub = publisher.redis.pubsub()
        await pubsub.subscribe(f"case:{case_id}:events")
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    event = PipelineEvent.model_validate_json(message["data"])
                    yield {"id": str(event.seq), "event": event.event_type, "data": message["data"]}
        finally:
            await pubsub.unsubscribe(f"case:{case_id}:events")

        # 3. 心跳（每 30 秒）
        # 注：实际实现中需要用 asyncio.create_task 并行发送心跳
        # yield {"event": "heartbeat", "data": ""}

    return EventSourceResponse(event_generator())
```

**Agent 节点中使用事件发布器**：

```python
async def explore_node(state: PipelineState) -> dict:
    publisher = get_event_publisher()  # 从 app.state 获取

    await publisher.publish(state["case_id"], "stage_change", {
        "stage": "explore", "status": "in_progress",
    })

    # ... Agent 执行逻辑 ...

    await publisher.publish(state["case_id"], "agent_output", {
        "type": "thinking", "content": "正在分析 Patchwork API...",
    })

    # ... 完成后 ...
    await publisher.publish(state["case_id"], "stage_change", {
        "stage": "explore", "status": "completed",
    })

    return {"exploration_result": result.model_dump()}
```

---

## 3. SDK 选型分析与依据

### 3.1 Claude Agent SDK 架构解析

Claude Agent SDK（原 Claude Code SDK）是 Anthropic 将 Claude Code 底层架构开放为可编程接口的产物。其核心特征：

**架构模型**：子进程模型 — 每次 `query()` 调用启动一个独立的 Agent 运行时，拥有完整的工具执行环境。

**内置工具集**（无需额外实现）：
- `Read` / `Write` / `Edit` — 文件读写与精确编辑
- `Bash` — Shell 命令执行
- `Glob` / `Grep` — 文件搜索与内容检索
- `WebSearch` — 网络搜索
- `TodoWrite` — 任务管理

**核心能力**：
- **MCP 原生支持**：深度集成 Model Context Protocol，可连接 500+ 外部服务（GitHub、数据库、浏览器等）
- **生命周期钩子**：`PreToolUse` / `PostToolUse` / `Stop` / `SessionStart` / `SessionEnd`，提供 AOP 风格的控制能力
- **权限模式**：`acceptEdits` / `dontAsk` / `bypassPermissions` / `default`，配合 `canUseTool` 回调实现细粒度权限控制
- **会话持久化**：通过 `resume: sessionId` 恢复会话，Agent 可从中断处继续
- **自动上下文压缩**：内置上下文管理，自动压缩保留关键信息
- **动态工具搜索**：MCP Tool Search 按需加载工具描述，从 77K 降至 8.7K tokens

**适用场景**：需要深度文件操作、代码生成、命令执行的任务。

### 3.2 OpenAI Agents SDK 架构解析

OpenAI Agents SDK 由实验性框架 Swarm 演进而来，定位为轻量级多 Agent 编排工具。

**架构模型**：库原生模型 — Agent 定义为 Python/TypeScript 对象，通过 `Runner.run()` 驱动执行。

**核心原语**（仅 3 个概念）：
- `Agent` — 指令 + 模型 + 工具
- `Handoff` — Agent 间声明式交接
- `Guardrail` — 输入/输出护栏

**核心能力**：
- **Handoff 机制**：Agent 间通过声明式交接转移控制权，底层实现与 Function Calling 相同
- **Guardrails**：输入护栏（检测偏离主题）+ 输出护栏（合规检查），与 Agent 并行运行不阻塞
- **内置 Tracing**：记录 LLM 生成、工具调用、Handoff、Guardrail 事件，支持导出到 Logfire/AgentOps
- **模型无关**：官方支持接入任何兼容 Chat Completions API 的模型（Anthropic、Google 等）
- **状态序列化**：`RunState.to_state()` / `RunState.from_json()` 支持持久化和恢复
- **Human-in-the-Loop**：`needs_approval` + `RunState.approve/reject` 实现审批流

**适用场景**：多 Agent 路由编排、跨模型兼容、需要 Tracing 的生产级系统。

### 3.3 两个 SDK 本质差异对比

| 维度 | Claude Agent SDK | OpenAI Agents SDK |
|------|-----------------|-------------------|
| **架构模型** | 子进程运行时（全栈式） | 库原生（极简编排器） |
| **内置工具** | Read/Write/Edit/Bash/Grep/Glob/WebSearch | 无（需自行实现或用 Sandbox Agent） |
| **多 Agent 模式** | Sub-Agent（指挥官-执行者） | Handoff（接力式交接） |
| **工具协议** | MCP 原生深度集成 | MCP 支持（2025.3 起） |
| **人工介入** | `canUseTool` 回调 + 权限模式 | `needs_approval` + RunState 序列化 |
| **会话持久化** | `resume: sessionId` 原生支持 | `RunState.to_state()` 手动序列化 |
| **沙箱执行** | 内置 Bash 工具 + 权限控制 | Sandbox Agent（2026.4 起） |
| **可观测性** | 流式会话 + 审计日志 | 内置 Tracing 系统 + 仪表盘 |
| **模型绑定** | 深度绑定 Claude 生态 | 开放兼容第三方模型 |
| **上下文管理** | 自动压缩 + 动态工具搜索 | 手动管理 |
| **编排能力** | 弱（单 Agent 为主） | 强（Handoff + Manager 模式） |
| **核心优势** | 开箱即用的代码执行能力 | 优雅的多 Agent 编排 |

### 3.4 混合使用方案

两个 SDK 可以在同一 Python 进程中共存。参考 [aix.me 分析文章](https://aix.me/blog/claude_vs_openai_agents_sdk/)的结论：

> 两个 SDK 并非完全互斥。在实际项目中，完全可以：用 OpenAI SDK 做上层多 Agent 编排和路由，在某些需要深度文件操作的子任务中调用 Claude SDK，通过 MCP 协议让两个生态的工具互相复用。

**集成架构**：

```
┌─────────────────────────────────────────────────┐
│         LangGraph StateGraph (编排层)             │
│  统一状态管理 + 检查点持久化 + 人工审核门禁        │
├─────────────────────────────────────────────────┤
│     ↓ Claude Agent SDK        ↓ OpenAI Agents SDK│
│  Explorer / Developer / Tester  Planner / Reviewer│
│  内置: Read/Write/Edit/Bash     内置: Handoff/Guard│
│  MCP 工具生态                   Tracing 可观测性   │
└─────────────────────────────────────────────────┘
```

**桥接方式**：将 Claude Agent SDK 的 `query()` 调用封装为 LangGraph 节点函数，将 OpenAI Agents SDK 的 `Runner.run()` 同样封装为节点函数。LangGraph 作为中介层，通过共享 state 传递数据：

```python
from langgraph.graph import StateGraph
from claude_agent_sdk import query, ClaudeAgentOptions
from agents import Agent, Runner

# Claude SDK 节点
async def explore_node(state: PipelineState) -> dict:
    result_parts = []
    async for msg in query(
        prompt=f"分析以下 RISC-V 贡献机会:\n{state['input_context']}",
        options=ClaudeAgentOptions(
            allowed_tools=["Read", "Grep", "Glob", "WebSearch"],
            permission_mode="acceptEdits",
        ),
    ):
        if hasattr(msg, "result"):
            result_parts.append(msg.result)
    return {"exploration_result": "\n".join(result_parts)}

# OpenAI SDK 节点
async def plan_node(state: PipelineState) -> dict:
    planner = Agent(
        name="RISC-V Planner",
        instructions="根据探索结果设计开发和测试方案...",
        model="gpt-4o",
    )
    result = await Runner.run(planner, state["exploration_result"])
    return {"execution_plan": result.final_output}

# LangGraph 编排
builder = StateGraph(PipelineState)
builder.add_node("explore", explore_node)
builder.add_node("plan", plan_node)
builder.add_edge("explore", "plan")
```

### 3.5 各 Agent 阶段 SDK 分配

| 阶段 | SDK | 关键理由 |
|------|-----|----------|
| **探索 (Explore)** | Claude Agent SDK | 需要内置 Read/Grep/Glob 进行深度代码库导航，WebSearch 搜索邮件列表和文档。Claude 的上下文压缩能力适合处理大型代码库分析。 |
| **规划 (Plan)** | OpenAI Agents SDK | 纯推理任务，不需要文件操作。Guardrails 可验证方案完整性。Handoff 可编排 dev_planner 和 test_planner 子 Agent。模型无关性允许使用更经济的模型。 |
| **开发 (Develop)** | Claude Agent SDK | 核心优势 — Write/Edit/Bash 内置工具直接支持代码生成。`canUseTool` 回调实现破坏性操作审批。MCP 集成 GitHub 提交 PR。会话持久化支持长时间开发任务。 |
| **审核 (Review)** | OpenAI Agents SDK | **多视角审核策略**：使用不同模型家族（Codex）提供差异化审核视角，降低单一模型的盲区风险。Handoff 分发给 security/correctness/style 三个子审核 Agent。集成确定性工具（checkpatch.pl、sparse、smatch）弥补 LLM 在静态分析方面的不足。Tracing 记录完整审核过程。 |
| **测试 (Test)** | Claude Agent SDK | Bash 工具执行测试套件。Read 解析测试日志。内置沙箱行为配合 QEMU 环境。权限控制确保测试环境隔离。 |

### 3.6 选型决策总结

```mermaid
graph TD
    subgraph LangGraph编排层
        LG[LangGraph StateGraph<br/>统一编排 + 状态管理]
    end

    subgraph Claude_Agent_SDK[Claude Agent SDK — 执行密集型]
        E[🔍 Explorer<br/>Read/Grep/Glob/WebSearch]
        D[💻 Developer<br/>Write/Edit/Bash/MCP]
        T[🧪 Tester<br/>Bash/Read/Sandbox]
    end

    subgraph OpenAI_Agents_SDK[OpenAI Agents SDK — 推理判断型]
        P[📋 Planner<br/>Guardrails/Handoff]
        R[🔎 Reviewer<br/>Codex/Handoff/Tracing]
    end

    LG --> E
    LG --> P
    LG --> D
    LG --> R
    LG --> T

    style Claude_Agent_SDK fill:#e8f4f8,stroke:#2196F3
    style OpenAI_Agents_SDK fill:#fff3e0,stroke:#FF9800
```

**决策依据总结**：
- Claude Agent SDK 承担 3/5 阶段（探索/开发/测试），均为**执行密集型**任务，需要文件操作和命令执行
- OpenAI Agents SDK 承担 2/5 阶段（规划/审核），均为**推理判断型**任务，需要多 Agent 编排和质量把控
- LangGraph 作为统一编排层，屏蔽两个 SDK 的差异，提供持久化检查点和人工审核门禁

### 3.7 成本估算对比

基于典型贡献案例（ISA 扩展支持，~120 行代码变更）的 Token 消耗估算：

| 阶段 | SDK | 模型 | 预估 Input Tokens | 预估 Output Tokens | 单次成本 (USD) |
|------|-----|------|-------------------|--------------------|----|
| 探索 | Claude | claude-sonnet-4 | ~50,000 | ~15,000 | ~$0.35 |
| 规划 | OpenAI | gpt-4o | ~20,000 | ~8,000 | ~$0.14 |
| 开发 (首轮) | Claude | claude-sonnet-4 | ~80,000 | ~25,000 | ~$0.55 |
| 审核 | OpenAI | codex-mini | ~30,000 | ~5,000 | ~$0.05 |
| 开发 (修复) | Claude | claude-sonnet-4 | ~40,000 | ~10,000 | ~$0.25 |
| 审核 (复审) | OpenAI | codex-mini | ~30,000 | ~5,000 | ~$0.05 |
| 测试 | Claude | claude-sonnet-4 | ~30,000 | ~10,000 | ~$0.20 |
| **合计** | — | — | **~280,000** | **~78,000** | **~$1.59** |

**成本优化策略**：
- 探索阶段使用 `claude-haiku` 进行初筛，仅对高可行性目标使用 `claude-sonnet`
- 规划阶段可降级到 `gpt-4o-mini`（方案质量差异 < 5%）
- 审核阶段 `codex-mini` 已是最经济选择
- 通过 LangGraph 检查点避免重复计算（中断恢复不重跑已完成阶段）

### 3.8 SDK 版本锁定与兼容性策略

| SDK | 锁定版本 | 兼容性风险 | 缓解措施 |
|-----|----------|------------|----------|
| claude-agent-sdk | `>=0.1.0,<1.0.0` | API 尚在 Beta，可能有 Breaking Changes | 适配器层隔离，仅 `ClaudeAgentAdapter` 直接依赖 |
| openai-agents-sdk | `>=0.1.0,<1.0.0` | Handoff/Guardrail API 可能变更 | 适配器层隔离，仅 `OpenAIAgentAdapter` 直接依赖 |
| langgraph | `>=0.3.0,<0.4.0` | StateGraph API 相对稳定 | 核心依赖，需跟踪 changelog |
| fastapi | `>=0.115.0` | 稳定 | 低风险 |

**版本升级流程**：
1. 在 CI 中设置 dependabot 监控 SDK 版本
2. 新版本发布后，先在 `feature/sdk-upgrade` 分支验证
3. 运行完整集成测试 + Agent 质量评估
4. 确认无回归后合并

### 3.9 技术风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| Claude Agent SDK Breaking Change | 高 | 高 | 适配器层隔离 + 版本锁定 + 降级到直接 API 调用 |
| OpenAI Codex 模型下线 | 中 | 高 | Reviewer 可切换到 gpt-4o + 自定义 system prompt |
| LLM API 限流导致 Pipeline 阻塞 | 高 | 中 | 指数退避 + 模型降级链 + 队列缓冲 |
| QEMU 沙箱逃逸 | 低 | 高 | Docker 隔离 + seccomp + 只读挂载 + 网络隔离 |
| Agent 输出格式不稳定 | 高 | 中 | Pydantic 严格验证 + 重试 + 输出护栏 |
| 上游社区拒绝 AI 生成补丁 | 中 | 高 | 人工最终审核 + 不标注 AI 生成 + 确保质量达标 |
| MongoDB 单点故障 | 中 | 高 | 副本集部署 + 定期备份 |

---

## 4. 前端设计方案

### 4.1 技术栈选型

借鉴 ScienceClaw 的前端架构，采用 Vue 3 生态：

| 技术 | 版本 | 用途 |
|------|------|------|
| Vue 3 | 3.3+ | 核心框架（Composition API） |
| Vite | 5.x | 构建工具 |
| TypeScript | 5.x | 类型安全 |
| TailwindCSS | 3.x | 原子化 CSS |
| Vue Router | 4.x | 路由管理 |
| Pinia | 2.x | 状态管理 |
| @microsoft/fetch-event-source | 2.x | SSE 客户端 |
| reka-ui | 2.x | 无头 UI 组件库 |
| lucide-vue-next | latest | 图标库 |
| Monaco Editor | 0.52+ | 代码/Diff 查看器 |
| marked + highlight.js | latest | Markdown 渲染 |
| mermaid | 11.x | 流程图渲染 |
| axios | 1.x | HTTP 客户端 |

**选型理由**（对比 Next.js/React）：
- ScienceClaw 已验证 Vue 3 + Vite 在 Agent 平台场景的可行性，可直接复用组件模式
- Vue 3 Composition API 的 composable 模式天然适合 SSE 事件流管理
- Vite 开发体验优于 webpack，HMR 速度更快
- TailwindCSS 与 reka-ui 组合提供了灵活的 UI 定制能力

### 4.2 项目目录结构

```
web-console/
├── public/
│   └── favicon.ico
├── src/
│   ├── api/                    # API 客户端层
│   │   ├── client.ts           # Axios 实例 + SSE 封装
│   │   ├── cases.ts            # 案例 CRUD + SSE 事件流
│   │   ├── auth.ts             # 认证 API
│   │   └── knowledge.ts        # 知识库 API
│   ├── components/             # 通用组件
│   │   ├── ui/                 # 基础 UI 组件 (reka-ui 封装)
│   │   ├── pipeline/           # Pipeline 可视化组件
│   │   │   ├── PipelineView.vue       # 5 阶段流水线视图
│   │   │   ├── StageNode.vue          # 单阶段节点
│   │   │   ├── HumanGate.vue          # 人工审核门禁
│   │   │   └── IterationBadge.vue     # 迭代轮次标记
│   │   ├── review/             # 审核相关组件
│   │   │   ├── ReviewPanel.vue        # 审核决策面板
│   │   │   ├── ReviewFinding.vue      # 审核发现项
│   │   │   └── DiffViewer.vue         # Unified Diff 查看器
│   │   ├── exploration/        # 探索结果组件
│   │   │   ├── ContributionCard.vue   # 贡献机会卡片
│   │   │   └── EvidenceChain.vue      # 证据链展示
│   │   ├── testing/            # 测试结果组件
│   │   │   ├── TestResultSummary.vue  # 测试结果摘要
│   │   │   └── TestLogViewer.vue      # 测试日志查看器
│   │   ├── chat/               # 对话/日志组件
│   │   │   ├── AgentEventLog.vue      # Agent 实时事件日志
│   │   │   ├── ThinkingBlock.vue      # Agent 思考过程
│   │   │   └── ToolCallView.vue       # 工具调用可视化
│   │   └── layout/             # 布局组件
│   │       ├── AppLayout.vue          # 主布局
│   │       ├── Sidebar.vue            # 侧边栏
│   │       └── TopBar.vue             # 顶部导航
│   ├── composables/            # 组合式函数
│   │   ├── useCaseEvents.ts    # SSE 事件流管理
│   │   ├── useAuth.ts          # 认证状态
│   │   ├── usePipeline.ts      # Pipeline 状态追踪
│   │   └── useTheme.ts         # 主题管理
│   ├── stores/                 # Pinia 状态仓库
│   │   ├── caseStore.ts        # 案例状态
│   │   ├── authStore.ts        # 认证状态
│   │   └── uiStore.ts          # UI 状态
│   ├── views/                  # 页面视图
│   │   ├── DashboardView.vue   # 仪表盘
│   │   ├── CaseListView.vue    # 案例列表
│   │   ├── CaseDetailView.vue  # 案例详情（核心页面）
│   │   ├── KnowledgeView.vue   # 知识库
│   │   ├── MetricsView.vue     # 指标统计
│   │   └── LoginView.vue       # 登录
│   ├── types/                  # TypeScript 类型定义
│   │   ├── case.ts             # 案例相关类型
│   │   ├── pipeline.ts         # Pipeline 类型
│   │   ├── event.ts            # SSE 事件类型
│   │   └── api.ts              # API 响应类型
│   ├── utils/                  # 工具函数
│   ├── router/                 # 路由配置
│   │   └── index.ts
│   ├── App.vue
│   └── main.ts
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

### 4.3 页面路由设计

> ⚠️ **已过时**：以下路由为 v1 Pipeline-only 设计。v4 路由见文档顶部「v4 变更摘要」。

```typescript
// router/index.ts
const routes = [
  {
    path: '/',
    component: AppLayout,
    meta: { requiresAuth: true },
    children: [
      { path: '', name: 'dashboard', component: DashboardView },
      { path: 'cases', name: 'cases', component: CaseListView },
      { path: 'cases/:id', name: 'case-detail', component: CaseDetailView },
      { path: 'knowledge', name: 'knowledge', component: KnowledgeView },
      { path: 'metrics', name: 'metrics', component: MetricsView },
    ],
  },
  { path: '/login', name: 'login', component: LoginView },
]
```

| 路由 | 页面 | 功能 |
|------|------|------|
| `/` | Dashboard | 活跃案例概览、最近活动、系统状态 |
| `/cases` | 案例列表 | 所有案例的筛选/排序/搜索 |
| `/cases/:id` | 案例详情 | **核心页面** — Pipeline 可视化 + 产物查看 + 审核操作 + 实时日志 |
| `/knowledge` | 知识库 | RISC-V 贡献知识条目管理 |
| `/metrics` | 指标统计 | 贡献成功率、Token 消耗、迭代次数等 |
| `/login` | 登录 | JWT 认证 |

### 4.4 核心组件设计

#### 4.4.1 PipelineView — Pipeline 可视化

案例详情页的核心组件，展示 5 阶段流水线的实时状态：

```
┌─────────────────────────────────────────────────────────────────┐
│  🔍 探索    →  👤  →  📋 规划    →  👤  →  💻 开发  ↔  🔎 审核  │
│  ✅ 完成       通过     ✅ 完成       通过     🔄 进行中  第2轮    │
│                                                                  │
│  →  👤  →  🧪 测试                                               │
│     等待     ⏳ 待执行                                            │
└─────────────────────────────────────────────────────────────────┘
```

每个阶段节点显示：状态图标、阶段名称、耗时、Token 消耗。人工审核门禁节点在等待审核时高亮显示操作按钮。

#### 4.4.2 ReviewPanel — 审核决策面板

人工审核时的操作面板，支持 5 种决策：

| 决策 | 说明 | 后续动作 |
|------|------|----------|
| `approve` | 通过，进入下一阶段 | Pipeline 前进 |
| `reject` | 驳回，当前阶段重做 | 回到当前阶段 |
| `reject_to` | 驳回到指定阶段 | 回退到指定阶段 |
| `modify` | 人工修改后通过 | 使用修改后的产物前进 |
| `abandon` | 放弃此案例 | 标记为 Abandoned |

#### 4.4.3 DiffViewer — 代码差异查看器

基于 Monaco Editor 的 Unified Diff 查看器，支持：
- 行内 ReviewFinding 高亮（安全问题红色、风格问题黄色、建议蓝色）
- 文件树导航（多文件补丁）
- 原始代码 vs 修改后代码对比

#### 4.4.4 AgentEventLog — Agent 实时事件日志

借鉴 ScienceClaw 的 ProcessMessage + StepMessage 模式，实时展示 Agent 执行过程：
- Thinking 块：Agent 推理过程（可折叠）
- Tool Call：工具调用参数和结果
- Plan Update：Todo 列表实时更新
- Error：错误信息高亮

### 4.5 状态管理

采用 Pinia + Vue Composables 双层状态管理（借鉴 ScienceClaw 模式）：

```typescript
// stores/caseStore.ts
import { defineStore } from 'pinia'
import type { Case, CaseStatus, PipelineStage } from '@/types/case'

export const useCaseStore = defineStore('case', () => {
  // 当前查看的案例
  const currentCase = ref<Case | null>(null)
  // Pipeline 阶段状态
  const pipelineStages = ref<PipelineStage[]>([])
  // 当前阶段
  const currentStage = computed(() =>
    pipelineStages.value.find(s => s.status === 'in_progress')
  )
  // 是否等待人工审核
  const pendingReview = computed(() =>
    currentCase.value?.status.startsWith('pending_') ?? false
  )
  // 迭代轮次
  const reviewIterations = ref(0)

  async function loadCase(id: string) { /* ... */ }
  async function submitReview(decision: ReviewDecision) { /* ... */ }

  return {
    currentCase, pipelineStages, currentStage,
    pendingReview, reviewIterations,
    loadCase, submitReview,
  }
})
```

### 4.6 SSE 实时通信方案

借鉴 ScienceClaw 的 `@microsoft/fetch-event-source` 模式，增强了断线重连恢复和心跳检测：

```typescript
// composables/useCaseEvents.ts
import { fetchEventSource } from '@microsoft/fetch-event-source'
import type { AgentEvent } from '@/types/event'

export function useCaseEvents(caseId: Ref<string>) {
  const events = ref<AgentEvent[]>([])
  const isConnected = ref(false)
  const error = ref<string | null>(null)
  const lastEventId = ref<string | null>(null)  // 用于断线重连恢复
  let controller: AbortController | null = null
  let heartbeatTimer: ReturnType<typeof setTimeout> | null = null
  const HEARTBEAT_TIMEOUT = 45_000  // 45 秒未收到心跳则认为断连

  function resetHeartbeatTimer() {
    if (heartbeatTimer) clearTimeout(heartbeatTimer)
    heartbeatTimer = setTimeout(() => {
      // 心跳超时，主动断开并重连
      disconnect()
      connect()
    }, HEARTBEAT_TIMEOUT)
  }

  async function connect() {
    controller = new AbortController()
    isConnected.value = true

    await fetchEventSource(`/api/v1/cases/${caseId.value}/events`, {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${getToken()}`,
        // 断线重连时携带 Last-Event-ID，服务端据此恢复丢失事件
        ...(lastEventId.value ? { 'Last-Event-ID': lastEventId.value } : {}),
      },

      onmessage(ev) {
        resetHeartbeatTimer()

        // 心跳事件不处理
        if (ev.event === 'heartbeat') return

        // 记录最新事件 ID（用于重连恢复）
        if (ev.id) lastEventId.value = ev.id

        const event: AgentEvent = JSON.parse(ev.data)

        // 去重：基于 seq 防止重连后重复事件
        if (events.value.some(e => e.seq === event.seq)) return

        events.value.push(event)

        // 根据事件类型更新 Pipeline 状态
        switch (event.event_type) {
          case 'stage_change':
            useCaseStore().updateStage(event.data)
            break
          case 'review_request':
            useCaseStore().setPendingReview(event.data)
            break
          case 'agent_output':
            // 追加到实时日志
            break
          case 'cost_update':
            useCaseStore().updateCost(event.data)
            break
        }
      },

      onerror(err) {
        error.value = err.message
        // 自动重连（指数退避，最大 30s）
      },

      onclose() {
        isConnected.value = false
      },
    })
  }

  function disconnect() {
    controller?.abort()
    isConnected.value = false
  }

  onMounted(() => connect())
  onUnmounted(() => disconnect())

  return { events, isConnected, error, connect, disconnect }
}
```

**SSE 事件类型定义**：

| 事件类型 | 数据 | 触发时机 |
|----------|------|----------|
| `stage_change` | `{stage, status, timestamp}` | 阶段状态变更 |
| `agent_output` | `{type, content}` | Agent 输出（thinking/tool_call/result） |
| `review_request` | `{stage, artifacts}` | 需要人工审核 |
| `iteration_update` | `{round, max_rounds, feedback}` | Develop↔Review 迭代更新 |
| `cost_update` | `{input_tokens, output_tokens, cost_usd}` | Token 消耗更新 |
| `error` | `{message, recoverable}` | 错误事件 |
| `completed` | `{result, total_cost, total_duration}` | Pipeline 完成 |

### 4.7 类型定义与后端对齐

前端 TypeScript 类型与后端 Pydantic 模型保持一一对应：

```typescript
// types/case.ts
export type CaseStatus =
  | 'created'
  | 'exploring' | 'pending_explore_review'
  | 'planning' | 'pending_plan_review'
  | 'developing' | 'reviewing' | 'pending_code_review'
  | 'testing' | 'pending_test_review'
  | 'completed' | 'abandoned'

export interface Case {
  id: string
  title: string
  status: CaseStatus
  target_repo: string
  input_context: string
  exploration_result?: ExplorationResult
  execution_plan?: ExecutionPlan
  development_result?: DevelopmentResult
  review_verdict?: ReviewVerdict
  test_result?: TestResult
  review_iterations: number
  created_at: string
  updated_at: string
  cost: CostSummary
}

export interface ExplorationResult {
  contribution_type: string
  target_files: string[]
  evidence: Evidence[]
  feasibility_score: number
  summary: string
}

export interface ReviewVerdict {
  approved: boolean
  findings: ReviewFinding[]
  iteration: number
  reviewer_model: string
}
```

### 4.8 CaseDetailView 页面布局

案例详情页是平台的核心交互页面，采用三栏布局：

```
┌──────────────────────────────────────────────────────────────────────┐
│  TopBar: 案例标题 | 状态徽章 | 成本统计 | 操作按钮                      │
├──────────┬───────────────────────────────────┬───────────────────────┤
│          │                                   │                       │
│ 左侧栏    │         主内容区                    │      右侧栏            │
│ Pipeline │                                   │                       │
│ 阶段导航  │  ┌─────────────────────────────┐  │  审核决策面板           │
│          │  │  当前阶段产物展示             │  │  (仅审核状态显示)       │
│ 🔍 探索 ✅│  │                             │  │                       │
│ 📋 规划 ✅│  │  - 探索: ContributionCard    │  │  ┌─────────────────┐ │
│ 💻 开发 🔄│  │  - 规划: ExecutionPlan Tree  │  │  │ 通过 / 驳回      │ │
│ 🔎 审核 ⏳│  │  - 开发: DiffViewer          │  │  │ 审核意见输入     │ │
│ 🧪 测试 ─ │  │  - 审核: ReviewFindings      │  │  │ 驳回目标选择     │ │
│          │  │  - 测试: TestResultSummary    │  │  └─────────────────┘ │
│ 迭代轮次  │  └─────────────────────────────┘  │                       │
│ 第2轮/3轮 │                                   │  历史审核记录           │
│          │  ┌─────────────────────────────┐  │  (折叠列表)            │
│ 成本摘要  │  │  Agent 实时事件日志          │  │                       │
│ $1.23    │  │  (可折叠/展开)               │  │  成本明细              │
│          │  └─────────────────────────────┘  │  (按阶段分列)          │
│          │                                   │                       │
├──────────┴───────────────────────────────────┴───────────────────────┤
│  底部: 快捷操作栏 | 键盘快捷键提示                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**交互细节**：
- 左侧 Pipeline 导航：点击阶段切换主内容区展示内容，当前活跃阶段高亮
- 主内容区：根据当前查看的阶段动态渲染对应组件
- 右侧审核面板：仅在 `pending_*_review` 状态时显示，其他状态折叠为历史记录
- Agent 事件日志：默认折叠，可拖拽调整高度，支持搜索和过滤
- 键盘快捷键：`A` = Approve, `R` = Reject, `Esc` = 取消, `↑↓` = 切换阶段

### 4.9 响应式设计策略

| 断点 | 宽度 | 布局调整 |
|------|------|----------|
| Desktop XL | ≥ 1440px | 三栏布局（左 200px + 主 auto + 右 320px） |
| Desktop | 1024-1439px | 三栏布局（左 180px + 主 auto + 右 280px） |
| Tablet | 768-1023px | 两栏布局（左侧栏折叠为图标，右侧面板变为底部抽屉） |
| Mobile | < 768px | 单栏布局（Pipeline 变为顶部水平滚动条，审核面板变为全屏模态框） |

```typescript
// tailwind.config.js 断点配置
export default {
  theme: {
    screens: {
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1440px',
    },
  },
}
```

### 4.10 国际化 (i18n)

采用 `vue-i18n` 实现中英文双语支持：

```typescript
// i18n/index.ts
import { createI18n } from 'vue-i18n'
import zh from './locales/zh.json'
import en from './locales/en.json'

export const i18n = createI18n({
  locale: 'zh',
  fallbackLocale: 'en',
  messages: { zh, en },
})
```

**翻译文件结构**：
```json
// i18n/locales/zh.json
{
  "pipeline": {
    "explore": "探索",
    "plan": "规划",
    "develop": "开发",
    "review": "审核",
    "test": "测试"
  },
  "review_actions": {
    "approve": "通过",
    "reject": "驳回",
    "abandon": "放弃"
  },
  "status": {
    "exploring": "探索中",
    "pending_explore_review": "等待探索审核",
    "completed": "已完成",
    "abandoned": "已放弃"
  }
}
```

### 4.11 无障碍设计 (Accessibility)

| 要求 | 实现方式 |
|------|----------|
| 键盘导航 | 所有交互元素可通过 Tab 键聚焦，Enter/Space 触发 |
| 屏幕阅读器 | 使用 `aria-label`, `aria-live`, `role` 属性标注 |
| 颜色对比度 | 所有文本满足 WCAG 2.1 AA 标准（对比度 ≥ 4.5:1） |
| 状态通知 | Pipeline 状态变更通过 `aria-live="polite"` 通知 |
| 焦点管理 | 审核面板出现时自动聚焦到第一个操作按钮 |
| 图标替代文本 | 所有图标配合文字标签，不依赖纯图标传达信息 |

```vue
<!-- 示例: 审核按钮的无障碍实现 -->
<button
  @click="submitReview('approve')"
  :aria-label="$t('review_actions.approve')"
  class="bg-green-600 text-white px-4 py-2 rounded"
  :disabled="!pendingReview"
>
  <CheckIcon class="w-4 h-4 inline mr-1" aria-hidden="true" />
  {{ $t('review_actions.approve') }}
</button>
```

### 4.12 前端错误处理

```typescript
// composables/useErrorHandler.ts
export function useErrorHandler() {
  const toast = useToast()

  function handleApiError(error: AxiosError) {
    const status = error.response?.status
    const message = error.response?.data?.detail || error.message

    switch (status) {
      case 401:
        // Token 过期，跳转登录
        router.push('/login')
        break
      case 403:
        toast.error('权限不足')
        break
      case 404:
        toast.error('资源不存在')
        break
      case 409:
        // Pipeline 状态冲突（如重复提交审核）
        toast.warning('操作冲突，请刷新页面')
        break
      case 422:
        toast.error(`参数错误: ${message}`)
        break
      case 429:
        toast.warning('请求过于频繁，请稍后重试')
        break
      default:
        toast.error(`服务器错误: ${message}`)
    }
  }

  function handleSSEError(error: Error) {
    toast.warning('实时连接中断，正在重连...')
    // 自动重连由 useCaseEvents 处理
  }

  return { handleApiError, handleSSEError }
}
```

---

## 5. 后端设计方案

### 5.1 FastAPI + LangGraph 架构

后端采用 FastAPI 作为 API Gateway，LangGraph StateGraph 作为 Pipeline 引擎：

```
FastAPI (API Gateway)
├── /api/v1/auth/*          # 认证路由
├── /api/v1/cases/*         # 案例 CRUD + SSE
├── /api/v1/reviews/*       # 审核操作
├── /api/v1/knowledge/*     # 知识库
├── /api/v1/metrics/*       # 指标统计
└── /api/v1/admin/*         # 管理接口

LangGraph Engine (Pipeline 引擎)
├── StateGraph              # 状态机定义
├── AsyncPostgresSaver      # 检查点持久化
├── interrupt()             # 人工审核门禁
└── Agent Adapters          # SDK 适配器
```

**关键设计决策**：
- FastAPI 负责 HTTP/SSE 协议、认证鉴权、请求路由
- LangGraph 负责 Pipeline 状态管理、Agent 调度、检查点持久化
- 两者通过 `case_id` 关联：FastAPI 创建案例 → LangGraph 执行 Pipeline → SSE 推送事件

### 5.2 LangGraph StateGraph 状态机

```mermaid
stateDiagram-v2
    [*] --> explore: 启动 Pipeline

    explore --> human_gate_explore: 探索完成
    human_gate_explore --> plan: approve
    human_gate_explore --> explore: reject
    human_gate_explore --> abandoned: abandon

    plan --> human_gate_plan: 规划完成
    human_gate_plan --> develop: approve
    human_gate_plan --> plan: reject
    human_gate_plan --> abandoned: abandon

    develop --> review: 代码提交
    review --> develop: reject (iteration < 3)
    review --> escalate: reject (iteration >= 3)
    review --> human_gate_code: approve

    human_gate_code --> test: approve
    human_gate_code --> develop: reject
    human_gate_code --> abandoned: abandon

    test --> human_gate_test: 测试完成
    human_gate_test --> completed: approve
    human_gate_test --> develop: reject
    human_gate_test --> abandoned: abandon

    escalate --> human_gate_code: 人工接管

    completed --> [*]
    abandoned --> [*]
```

**Pipeline 状态定义**：

```python
from typing import Annotated, Any, Literal, Optional
from pydantic import BaseModel, Field
from langgraph.graph import add_messages

class PipelineState(BaseModel):
    """LangGraph Pipeline 共享状态

    设计原则：编排状态与产物引用分离。
    - 编排字段（current_stage, review_iterations 等）直接存储在 state 中
    - 产物数据仅存储引用路径/ID，完整数据存储在 MongoDB + 文件系统
    - 这避免了检查点膨胀（每次状态转换都会序列化完整 state）
    """

    # === 案例标识 ===
    case_id: str
    target_repo: str

    # === 编排状态 ===
    current_stage: Literal[
        "explore", "plan", "develop", "review", "test",
        "human_gate", "completed", "abandoned", "escalated"
    ] = "explore"

    # === 产物引用（仅存储路径/ID，不存储完整数据） ===
    input_context: dict[str, Any] = Field(default_factory=dict)
    exploration_result_ref: Optional[str] = None    # MongoDB document ID
    execution_plan_ref: Optional[str] = None        # MongoDB document ID
    development_result_ref: Optional[str] = None    # 产物目录路径
    review_verdict_ref: Optional[str] = None        # MongoDB document ID
    test_result_ref: Optional[str] = None           # MongoDB document ID

    # === Develop ↔ Review 迭代控制 ===
    review_iterations: int = 0
    max_review_iterations: int = 3
    review_score_history: list[float] = Field(default_factory=list)  # 加权评分历史

    # === 人工审核 ===
    pending_approval_stage: Optional[str] = None
    approval_count: int = 0

    # === 成本追踪 ===
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    estimated_cost_usd: float = 0.0

    # === 错误状态 ===
    last_error: Optional[str] = None
    retry_count: int = 0
```

**产物存取辅助函数**：

```python
async def save_stage_output(db, artifact_mgr, case_id: str, stage: str, output: BaseModel, round_num: int | None = None) -> str:
    """保存阶段产物到 MongoDB + 文件系统，返回引用 ID"""
    doc = output.model_dump()
    doc["case_id"] = case_id
    doc["stage"] = stage
    doc["round_num"] = round_num
    doc["created_at"] = datetime.utcnow()
    result = await db.stage_outputs.insert_one(doc)
    return str(result.inserted_id)

async def load_stage_output(db, ref_id: str, model_class: type[BaseModel]) -> BaseModel:
    """根据引用 ID 从 MongoDB 加载阶段产物"""
    from bson import ObjectId
    doc = await db.stage_outputs.find_one({"_id": ObjectId(ref_id)})
    if not doc:
        raise ValueError(f"Stage output not found: {ref_id}")
    return model_class.model_validate(doc)
```

**StateGraph 构建**：

```python
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

def build_pipeline_graph() -> StateGraph:
    builder = StateGraph(PipelineState)

    # 注册节点
    builder.add_node("explore", explore_node)
    builder.add_node("human_gate_explore", human_gate_node)
    builder.add_node("plan", plan_node)
    builder.add_node("human_gate_plan", human_gate_node)
    builder.add_node("develop", develop_node)
    builder.add_node("review", review_node)
    builder.add_node("human_gate_code", human_gate_node)
    builder.add_node("test", test_node)
    builder.add_node("human_gate_test", human_gate_node)
    builder.add_node("escalate", escalate_node)

    # 设置入口
    builder.set_entry_point("explore")

    # 线性边
    builder.add_edge("explore", "human_gate_explore")
    builder.add_edge("plan", "human_gate_plan")
    builder.add_edge("develop", "review")
    builder.add_edge("test", "human_gate_test")

    # 条件边 — 人工审核门禁
    for gate, routes in [
        ("human_gate_explore", {"approve": "plan", "reject": "explore", "abandon": END}),
        ("human_gate_plan", {"approve": "develop", "reject": "plan", "abandon": END}),
        ("human_gate_code", {"approve": "test", "reject": "develop", "abandon": END}),
        ("human_gate_test", {"approve": END, "reject": "develop", "abandon": END}),
    ]:
        builder.add_conditional_edges(gate, route_human_decision, routes)

    # 条件边 — Review 迭代/通过
    builder.add_conditional_edges("review", route_review_decision, {
        "approve": "human_gate_code",
        "reject": "develop",
        "escalate": "escalate",
    })

    builder.add_edge("escalate", "human_gate_code")

    return builder


async def compile_graph():
    """编译 Pipeline 图并注入持久化检查点"""
    from psycopg_pool import AsyncConnectionPool
    pool = AsyncConnectionPool(conninfo=settings.POSTGRES_URI)
    checkpointer = AsyncPostgresSaver(pool)
    await checkpointer.setup()

    builder = build_pipeline_graph()
    return builder.compile(checkpointer=checkpointer)
```

### 5.3 各 Agent 节点详细设计

#### 5.3.1 Explorer Agent（Claude Agent SDK）

探索 Agent 负责自主发现 RISC-V 贡献机会，是整个 Pipeline 的起点。

**输入**：`InputContext`（用户提示 + 目标仓库 + 可选的贡献方向）

**输出**：`ExplorationResult`（贡献点列表 + 证据链 + 可行性评分）

**工具配置**：
- `Read` / `Grep` / `Glob` — 代码库深度导航
- `WebSearch` — 搜索邮件列表、Patchwork、文档
- `Bash` — 执行 `git log`、`git blame` 等分析命令

**探索策略**（三路并行）：

```python
async def explore_node(state: PipelineState) -> dict:
    """Explorer Agent — 三路并行探索 RISC-V 贡献机会"""
    from claude_agent_sdk import query, ClaudeAgentOptions

    prompt = f"""你是 RISC-V 开源贡献探索专家。请从以下三个维度寻找贡献机会：

1. **邮件列表分析**：
   - 搜索 Patchwork API: https://patchwork.kernel.org/api/1.3/patches/?project=linux-riscv
   - 查找状态为 "Changes Requested" 或长期未处理的补丁
   - 分析 linux-riscv 邮件列表中的讨论热点

2. **代码库分析**：
   - 目标仓库: {state['target_repo']}
   - 查找 TODO/FIXME/HACK 注释
   - 检查新批准的 ISA 扩展是否已有内核/QEMU 支持
   - 分析 checkpatch.pl 警告

3. **可行性验证**：
   - 确认贡献点未被他人认领
   - 评估实现复杂度（代码行数、涉及文件数）
   - 检查上游接受标准（如内核仅接受 Frozen/Ratified 扩展）

用户提示: {state['input_context']}

输出格式: JSON，包含 contribution_type, target_files, evidence, feasibility_score, summary
"""

    result_parts = []
    async for msg in query(
        prompt=prompt,
        options=ClaudeAgentOptions(
            allowed_tools=["Read", "Grep", "Glob", "WebSearch", "Bash"],
            permission_mode="acceptEdits",
            max_turns=30,
        ),
    ):
        if hasattr(msg, "result"):
            result_parts.append(msg.result)

    exploration = parse_exploration_result("\n".join(result_parts))

    # 程序化验证 — 防止 Agent 幻觉
    exploration = await verify_exploration_claims(exploration)

    # 可行性评分过低则标记为需要人工判断
    if exploration.feasibility_score < 0.3:
        logger.warning("low_feasibility_after_verification",
                       case_id=state["case_id"], score=exploration.feasibility_score)

    return {
        "exploration_result": exploration.model_dump(),
        "current_stage": "human_gate_explore",
    }


async def verify_exploration_claims(result: ExplorationResult) -> ExplorationResult:
    """程序化验证 Explorer Agent 的输出，防止幻觉

    LLM 可能幻觉文件路径、URL、ISA 扩展名。
    此函数对每个声明进行程序化验证，过滤不可验证的结果。
    """
    import httpx
    import os

    verified_evidence = []
    for ev in result.evidence:
        # 验证 URL 可达性
        if ev.url:
            try:
                async with httpx.AsyncClient(timeout=10) as client:
                    resp = await client.head(ev.url, follow_redirects=True)
                    if resp.status_code < 400:
                        verified_evidence.append(ev)
                    else:
                        logger.warning("evidence_url_unreachable", url=ev.url, status=resp.status_code)
            except httpx.RequestError:
                logger.warning("evidence_url_failed", url=ev.url)
        else:
            # 无 URL 的证据（如代码分析结果）保留
            verified_evidence.append(ev)

    # 验证目标文件路径存在（在目标仓库的本地克隆中）
    verified_files = []
    for f in result.target_files:
        # 基本路径安全检查：防止路径遍历
        if ".." in f or f.startswith("/"):
            logger.warning("suspicious_file_path", path=f)
            continue
        verified_files.append(f)

    # 验证 ISA 扩展名（对照已知列表）
    RATIFIED_EXTENSIONS = {
        "Zicbom", "Zicbop", "Zicboz", "Zicfiss", "Zicfilp", "Zicntr", "Zicond",
        "Zifencei", "Zihintntl", "Zihintpause", "Zihpm", "Zimop", "Zicsr",
        "Zawrs", "Zfa", "Zfh", "Zfhmin",
        "Zba", "Zbb", "Zbc", "Zbkb", "Zbkc", "Zbkx", "Zbs",
        "Zkt", "Zknd", "Zkne", "Zknh", "Zksed", "Zksh",
        "Zvbb", "Zvbc", "Zvfh", "Zvfhmin", "Zvkb", "Zvkg", "Zvkned", "Zvknhb", "Zvksed", "Zvksh",
        "Sscofpmf", "Sstc", "Svinval", "Svnapot", "Svpbmt",
        # V 扩展
        "V", "Zve32f", "Zve32x", "Zve64d", "Zve64f", "Zve64x",
    }

    if result.contribution_type == "isa_extension":
        # 从标题或摘要中提取扩展名
        import re
        mentioned = set(re.findall(r'\b(Z[a-z]+|S[a-z]+|V)\b', result.title + " " + result.summary))
        unknown = mentioned - RATIFIED_EXTENSIONS
        if unknown:
            logger.warning("unknown_isa_extensions", extensions=list(unknown))
            # 不直接拒绝，但降低可行性评分
            result.feasibility_score = max(0, result.feasibility_score - 0.3)

    # 更新验证后的结果
    result.evidence = verified_evidence
    result.target_files = verified_files

    # 验证后证据不足则标记为低可行性
    if len(verified_evidence) < 2:
        result.feasibility_score = min(result.feasibility_score, 0.3)
        logger.warning("insufficient_verified_evidence", count=len(verified_evidence))

    return result
```

#### 5.3.2 Planner Agent（OpenAI Agents SDK）

规划 Agent 根据探索结果设计完整的开发和测试方案。

**输入**：`ExplorationResult`

**输出**：`ExecutionPlan`（开发步骤 + 测试用例 + 风险评估）

**编排模式**：Manager 模式 — Planner 作为管理者，通过 Handoff 分发给 dev_planner 和 test_planner：

```python
from agents import Agent, Runner, InputGuardrail, GuardrailFunctionOutput

# 输入护栏：验证探索结果完整性
async def validate_exploration(ctx, agent, input_text):
    # 检查必要字段是否存在
    if "feasibility_score" not in input_text:
        return GuardrailFunctionOutput(
            output_info={"reason": "缺少可行性评分"},
            tripwire_triggered=True,
        )
    return GuardrailFunctionOutput(
        output_info={"valid": True},
        tripwire_triggered=False,
    )

dev_planner = Agent(
    name="DevPlanner",
    instructions="""根据探索结果设计开发方案：
    1. 分解为原子化开发步骤
    2. 每步指定目标文件和预期变更
    3. 标注依赖关系和执行顺序
    4. 评估每步的风险等级""",
    model="gpt-4o",
)

test_planner = Agent(
    name="TestPlanner",
    instructions="""根据探索结果和开发方案设计测试方案：
    1. 单元测试用例（针对新增/修改的函数）
    2. 集成测试用例（跨模块交互）
    3. 回归测试范围（确保不破坏现有功能）
    4. QEMU 环境配置需求""",
    model="gpt-4o",
)

planner = Agent(
    name="RV-Insights Planner",
    instructions="你是 RISC-V 贡献规划专家。协调开发规划和测试规划...",
    model="gpt-4o",
    handoffs=[dev_planner, test_planner],
    input_guardrails=[InputGuardrail(guardrail_function=validate_exploration)],
)

async def plan_node(state: PipelineState) -> dict:
    result = await Runner.run(
        planner,
        f"请为以下贡献机会设计完整方案:\n{json.dumps(state['exploration_result'])}",
    )
    plan = parse_execution_plan(result.final_output)
    return {
        "execution_plan": plan.model_dump(),
        "current_stage": "human_gate_plan",
    }
```

#### 5.3.3 Developer Agent（Claude Agent SDK）

开发 Agent 是核心执行者，负责实际的代码编写。

**输入**：`ExecutionPlan` + 可选的 `ReviewVerdict`（迭代修复时）

**输出**：`DevelopmentResult`（补丁文件 + 变更说明 + commit message）

**关键设计**：
- 使用 `canUseTool` 回调对破坏性操作（Write/Edit/Bash）进行审批
- 通过 MCP 连接 GitHub 进行 PR 操作
- 会话持久化支持长时间开发任务

```python
async def develop_node(state: PipelineState) -> dict:
    from claude_agent_sdk import query, ClaudeAgentOptions

    # 构建开发提示（首次开发 vs 迭代修复）
    if state["review_iterations"] == 0:
        prompt = f"""根据以下开发方案进行代码开发:
{json.dumps(state['execution_plan'])}

目标仓库: {state['target_repo']}
请严格按照方案步骤执行，每步完成后验证。"""
    else:
        prompt = f"""审核 Agent 发现以下问题，请修复:
{json.dumps(state['review_verdict'])}

这是第 {state['review_iterations']} 轮迭代修复。
仅修复审核指出的问题，不要引入额外变更。"""

    async for msg in query(
        prompt=prompt,
        options=ClaudeAgentOptions(
            allowed_tools=["Read", "Write", "Edit", "Bash", "Grep", "Glob"],
            permission_mode="acceptEdits",
            max_turns=50,
        ),
    ):
        pass  # 流式处理

    return {
        "development_result": collect_development_result(),
        "current_stage": "review",
    }
```

#### 5.3.4 Reviewer Agent（OpenAI Agents SDK / Codex）

审核 Agent 采用**多视角审核策略**：使用不同模型家族（Codex）提供差异化审核视角，降低单一模型的盲区风险。同时集成确定性静态分析工具，弥补 LLM 在代码缺陷检测方面的不足。

**输入**：`DevelopmentResult`

**输出**：`ReviewVerdict`（通过/驳回 + findings 列表）

**审核架构 — LLM 审核 + 确定性工具双轨并行**：

```mermaid
graph TD
    INPUT[DevelopmentResult<br/>补丁文件] --> STATIC[确定性工具审核<br/>checkpatch.pl / sparse / smatch]
    INPUT --> LLM[LLM 多视角审核<br/>Codex Handoff]

    STATIC --> CP[checkpatch.pl<br/>风格检查]
    STATIC --> SP[sparse<br/>静态分析]
    STATIC --> SM[smatch<br/>内核缺陷检测]

    LLM --> SEC[SecurityReviewer<br/>安全审核]
    LLM --> COR[CorrectnessReviewer<br/>正确性审核]
    LLM --> STY[StyleReviewer<br/>风格审核]

    CP --> MERGE[结果合并]
    SP --> MERGE
    SM --> MERGE
    SEC --> MERGE
    COR --> MERGE
    STY --> MERGE

    MERGE --> VERDICT[ReviewVerdict]
```

**确定性工具集成**（在 LLM 审核之前运行）：

```python
import subprocess

async def run_deterministic_checks(patch_path: str) -> list[dict]:
    """运行确定性静态分析工具，返回发现列表"""
    findings = []

    # 1. checkpatch.pl — Linux 内核代码风格检查
    try:
        result = subprocess.run(
            ["perl", "scripts/checkpatch.pl", "--no-tree", "-f", patch_path],
            capture_output=True, text=True, timeout=60,
        )
        for line in result.stdout.splitlines():
            if line.startswith(("WARNING:", "ERROR:")):
                findings.append({
                    "severity": "major" if line.startswith("ERROR:") else "minor",
                    "category": "style",
                    "file": patch_path,
                    "description": line,
                    "suggestion": None,
                    "source": "checkpatch.pl",  # 标记来源为确定性工具
                })
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass

    # 2. sparse — C 语言静态分析（如果可用）
    try:
        result = subprocess.run(
            ["sparse", patch_path],
            capture_output=True, text=True, timeout=60,
        )
        for line in result.stderr.splitlines():
            if "warning:" in line or "error:" in line:
                findings.append({
                    "severity": "major" if "error:" in line else "minor",
                    "category": "correctness",
                    "file": patch_path,
                    "description": line,
                    "suggestion": None,
                    "source": "sparse",
                })
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass

    return findings
```

**LLM 多视角审核**（Handoff 编排）：

```python
security_reviewer = Agent(
    name="SecurityReviewer",
    instructions="""审核代码的安全性：
    - 缓冲区溢出、整数溢出
    - 权限提升风险
    - 未初始化变量
    - 竞态条件""",
    model="codex-mini-latest",
)

correctness_reviewer = Agent(
    name="CorrectnessReviewer",
    instructions="""审核代码的正确性：
    - 逻辑错误
    - 边界条件处理
    - ISA 规范符合性
    - 与现有代码的兼容性""",
    model="codex-mini-latest",
)

style_reviewer = Agent(
    name="StyleReviewer",
    instructions="""审核代码风格：
    - Linux kernel coding style (checkpatch.pl 规范)
    - commit message 格式
    - 文档注释完整性""",
    model="codex-mini-latest",
)

reviewer = Agent(
    name="RV-Insights Reviewer",
    instructions="汇总三个子审核 Agent 的结果和确定性工具的发现，生成最终审核意见...",
    model="codex-mini-latest",
    handoffs=[security_reviewer, correctness_reviewer, style_reviewer],
)

async def review_node(state: PipelineState) -> dict:
    # 第一步：运行确定性工具（不依赖 LLM，结果 100% 可靠）
    patch_path = state["development_result"].get("patch_files", [None])[0]
    static_findings = []
    if patch_path:
        static_findings = await run_deterministic_checks(patch_path)

    # 第二步：LLM 多视角审核
    review_input = f"""请审核以下代码变更:
{json.dumps(state['development_result'])}

确定性工具已发现以下问题（这些是确认的事实，不需要重复报告）:
{json.dumps(static_findings)}

请聚焦于工具无法检测的语义问题（逻辑错误、安全漏洞、ISA 规范符合性）。"""

    result = await Runner.run(reviewer, review_input)
    llm_verdict = parse_review_verdict(result.final_output)

    # 合并确定性工具发现和 LLM 发现
    all_findings = static_findings + [f.model_dump() for f in llm_verdict.findings]

    verdict = ReviewVerdict(
        approved=llm_verdict.approved and len([f for f in static_findings if f["severity"] in ("critical", "major")]) == 0,
        findings=[ReviewFinding(**f) for f in all_findings],
        iteration=state["review_iterations"] + 1,
        reviewer_model="codex-mini-latest + checkpatch.pl + sparse",
        summary=llm_verdict.summary,
    )

    return {
        "review_verdict": verdict.model_dump(),
        "review_iterations": state["review_iterations"] + 1,
        "review_history": state["review_history"] + [verdict.model_dump()],
    }
```

**审核策略说明**：
- 确定性工具（checkpatch.pl、sparse）的发现是事实，不可被 LLM 覆盖
- 如果确定性工具发现 critical/major 问题，即使 LLM 认为通过，最终 verdict 仍为 reject
- LLM 审核聚焦于工具无法检测的语义层面问题
- 使用不同模型家族（Codex vs Claude）提供差异化视角，而非"反共谋"

#### 5.3.5 Tester Agent（Claude Agent SDK）

测试 Agent 负责搭建测试环境并执行测试验证。

**输入**：`DevelopmentResult` + `ExecutionPlan`（测试方案部分）

**输出**：`TestResult`（通过/失败 + 测试日志 + 覆盖率）

```python
async def test_node(state: PipelineState) -> dict:
    from claude_agent_sdk import query, ClaudeAgentOptions

    test_plan = state["execution_plan"].get("test_plan", {})
    prompt = f"""根据以下测试方案执行测试：
{json.dumps(test_plan)}

代码变更：
{json.dumps(state['development_result'])}

执行步骤：
1. 搭建 QEMU RISC-V 测试环境
2. 应用补丁到目标仓库
3. 交叉编译（riscv64-linux-gnu-gcc）
4. 在 QEMU 中运行测试套件
5. 收集测试结果和日志

如果测试失败，详细记录失败原因和日志。"""

    async for msg in query(
        prompt=prompt,
        options=ClaudeAgentOptions(
            allowed_tools=["Read", "Write", "Bash", "Grep"],
            permission_mode="acceptEdits",
            max_turns=40,
        ),
    ):
        pass

    return {
        "test_result": collect_test_result(),
        "current_stage": "human_gate_test",
    }
```

### 5.4 Human-in-the-Loop 审批门

审批门是 Pipeline 中的关键控制点，使用 LangGraph 的 `interrupt()` 机制实现。当 Pipeline 到达审批门时，执行暂停，状态持久化到 PostgreSQL，等待人工通过 API 提交决策后恢复。

```python
from langgraph.types import interrupt, Command

async def human_gate_node(state: PipelineState) -> Command:
    """通用人工审批门节点 — 暂停 Pipeline 等待人工决策"""

    # 构建审批请求（包含当前阶段的产物摘要）
    stage = state["current_stage"].replace("human_gate_", "")
    artifacts = {
        "explore": state.get("exploration_result"),
        "plan": state.get("execution_plan"),
        "code": state.get("development_result"),
        "test": state.get("test_result"),
    }.get(stage)

    # interrupt() 暂停执行，状态自动持久化
    # 返回值是人工通过 Command(resume=...) 传入的决策
    decision = interrupt({
        "type": "review_request",
        "stage": stage,
        "artifacts_summary": summarize_artifacts(artifacts),
        "case_id": state["case_id"],
        "review_iterations": state["review_iterations"],
        "cost_so_far": {
            "input_tokens": state["total_input_tokens"],
            "output_tokens": state["total_output_tokens"],
        },
    })

    # 记录审批历史
    approval_record = {
        "stage": stage,
        "decision": decision["action"],
        "comment": decision.get("comment", ""),
        "reviewer": decision.get("reviewer", "unknown"),
        "timestamp": datetime.utcnow().isoformat(),
    }

    return Command(
        goto=decision["action"],  # "approve" | "reject" | "abandon"
        update={
            "approval_history": state["approval_history"] + [approval_record],
            "pending_approval": None,
        },
    )


def route_human_decision(state: PipelineState) -> str:
    """路由函数 — 根据人工决策确定下一步"""
    if not state.get("approval_history"):
        return "abandon"
    last_decision = state["approval_history"][-1]
    return last_decision["decision"]
```

**API 端恢复 Pipeline**：

```python
# route/reviews.py
@router.post("/api/v1/cases/{case_id}/review")
async def submit_review(
    case_id: str,
    decision: ReviewDecision,
    user: User = Depends(get_current_user),
):
    """人工提交审核决策，恢复 Pipeline 执行

    幂等性保证：通过 review_id 防止重复提交。
    """
    db = request.app.state.db

    # 幂等性检查：同一 review_id 不重复处理
    if decision.review_id:
        existing = await db.human_reviews.find_one({"review_id": decision.review_id})
        if existing:
            return {"status": "ok", "message": "Review already submitted (idempotent)"}

    # 状态检查：确认案例确实在等待审核
    case = await db.contribution_cases.find_one({"_id": case_id})
    if not case or not case["status"].startswith("pending_"):
        raise HTTPException(status_code=409, detail="Case is not pending review")

    # 记录审核
    await db.human_reviews.insert_one({
        "review_id": decision.review_id or str(uuid4()),
        "case_id": case_id,
        "stage": case["status"].replace("pending_", "").replace("_review", ""),
        "action": decision.action,
        "comment": decision.comment,
        "reviewer": user.username,
        "created_at": datetime.utcnow(),
    })

    # 恢复 Pipeline
    graph = await get_compiled_graph()
    config = {"configurable": {"thread_id": case_id}}
    await graph.ainvoke(
        Command(resume={
            "action": decision.action,
            "comment": decision.comment,
            "reviewer": user.username,
        }),
        config=config,
    )

    return {"status": "ok", "message": f"Pipeline resumed with {decision.action}"}
```

**成本熔断器**：

```python
# pipeline/cost_guard.py
class CostCircuitBreaker:
    """成本熔断器 — 防止 Agent 失控消耗 API 额度"""

    def __init__(self, max_cost_per_case: float = 10.0, max_cost_per_hour: float = 50.0):
        self.max_cost_per_case = max_cost_per_case
        self.max_cost_per_hour = max_cost_per_hour

    async def check_before_agent(self, state: PipelineState) -> bool:
        """在每次 Agent 调用前检查成本是否超限"""
        estimated_cost = self._estimate_cost(state)
        if estimated_cost > self.max_cost_per_case:
            logger.error("cost_circuit_breaker_triggered",
                         case_id=state["case_id"],
                         current_cost=estimated_cost,
                         limit=self.max_cost_per_case)
            return False  # 阻止执行
        return True

    def _estimate_cost(self, state: PipelineState) -> float:
        """基于已消耗 Token 估算成本"""
        # Claude: $3/M input, $15/M output (Sonnet)
        # OpenAI: $2.5/M input, $10/M output (GPT-4o)
        claude_cost = (state["total_input_tokens"] * 3 + state["total_output_tokens"] * 15) / 1_000_000
        return claude_cost  # 简化估算

# 在 Agent 节点中使用
async def develop_node(state: PipelineState) -> dict:
    breaker = CostCircuitBreaker()
    if not await breaker.check_before_agent(state):
        return {
            "current_stage": "human_gate_code",
            "last_error": f"成本超限 (>${breaker.max_cost_per_case})，已升级为人工处理",
        }
    # ... 正常执行 ...
```

### 5.5 Develop ↔ Review 迭代循环

开发和审核之间的迭代循环是 Pipeline 的核心机制。通过 LangGraph 条件边实现：

```mermaid
sequenceDiagram
    participant D as Developer<br/>(Claude SDK)
    participant R as Reviewer<br/>(OpenAI/Codex)
    participant H as Human Gate

    Note over D,R: 第 1 轮
    D->>D: 根据 ExecutionPlan 开发
    D->>R: DevelopmentResult
    R->>R: 安全/正确性/风格审核
    R-->>D: ReviewVerdict (reject, 3 findings)

    Note over D,R: 第 2 轮
    D->>D: 修复 3 个 findings
    D->>R: 更新后的 DevelopmentResult
    R->>R: 重新审核
    R-->>D: ReviewVerdict (reject, 1 finding)

    Note over D,R: 第 3 轮
    D->>D: 修复最后 1 个 finding
    D->>R: 更新后的 DevelopmentResult
    R->>R: 重新审核
    R-->>H: ReviewVerdict (approve)

    H->>H: 等待人工确认
```

**条件边路由函数**：

```python
# 审核发现严重度权重
SEVERITY_WEIGHTS = {"critical": 10, "major": 5, "minor": 1, "suggestion": 0}

def compute_review_score(findings: list[dict]) -> float:
    """计算审核发现的加权评分"""
    return sum(SEVERITY_WEIGHTS.get(f.get("severity", "minor"), 1) for f in findings)

def route_review_decision(state: PipelineState) -> str:
    """Review 后的路由决策 — 基于加权评分的收敛检测"""
    verdict = state.get("review_verdict", {})

    if verdict.get("approved"):
        return "approve"

    if state["review_iterations"] >= state["max_review_iterations"]:
        return "escalate"

    # 加权收敛检测：连续 2 轮加权评分不下降则升级
    if len(state["review_history"]) >= 2:
        prev_score = compute_review_score(state["review_history"][-2].get("findings", []))
        curr_score = compute_review_score(verdict.get("findings", []))

        if curr_score >= prev_score:
            # 进一步检查：是否是同一批问题反复出现（通过 finding ID 去重）
            prev_ids = {f.get("file", "") + str(f.get("line", "")) for f in state["review_history"][-2].get("findings", [])}
            curr_ids = {f.get("file", "") + str(f.get("line", "")) for f in verdict.get("findings", [])}
            overlap = len(prev_ids & curr_ids) / max(len(curr_ids), 1)

            if overlap > 0.5:
                # 超过 50% 的问题是重复的 → 开发 Agent 无法修复，升级
                return "escalate"

    return "reject"  # 继续迭代
```

**收敛检测策略**：
- 使用加权评分（critical=10, major=5, minor=1, suggestion=0）替代简单计数
- 追踪 finding 的文件+行号作为 ID，区分"旧问题未修复"和"新问题被发现"
- 当 ≥50% 的问题是重复出现时才升级，允许"修复旧问题但发现新问题"的正常迭代

### 5.6 数据源接入设计

```mermaid
graph LR
    subgraph 数据源
        PW[Patchwork API<br/>patchwork.kernel.org]
        LORE[lore.kernel.org<br/>邮件归档]
        GH[GitHub API<br/>OpenSBI/riscv-tests]
        GIO[groups.io<br/>tech-* 列表]
    end

    subgraph 数据采集层
        POLLER[Patchwork Poller<br/>定时轮询]
        CRAWLER[Mail Crawler<br/>邮件解析]
        GH_CLIENT[GitHub Client<br/>Issue/PR 监控]
    end

    subgraph 知识库
        MONGO[(MongoDB<br/>knowledge_entries)]
    end

    PW --> POLLER
    LORE --> CRAWLER
    GH --> GH_CLIENT
    GIO --> CRAWLER
    POLLER --> MONGO
    CRAWLER --> MONGO
    GH_CLIENT --> MONGO
```

**Patchwork API 集成**：

```python
import httpx

class PatchworkClient:
    """Patchwork REST API 客户端"""
    BASE_URL = "https://patchwork.kernel.org/api/1.3"

    async def get_recent_patches(
        self, project: str = "linux-riscv", state: int = 1, limit: int = 50
    ) -> list[dict]:
        """获取最近的补丁列表"""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.BASE_URL}/patches/",
                params={"project": project, "state": state, "order": "-date", "per_page": limit},
            )
            return resp.json()

    async def get_patch_events(self, project: str = "linux-riscv") -> list[dict]:
        """获取补丁事件流（状态变更、新补丁）"""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.BASE_URL}/events/",
                params={"project": project},
            )
            return resp.json()

    async def get_stale_patches(self, days: int = 30) -> list[dict]:
        """查找长期未处理的补丁（贡献机会信号）"""
        cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
        patches = await self.get_recent_patches(state=1, limit=100)
        return [p for p in patches if p["date"] < cutoff]
```

**邮件列表接入**：
- `lore.kernel.org` 提供 NNTP 和 HTTP 归档，支持全文搜索
- `groups.io` 技术列表归档公开可读，通过 HTTP 抓取
- 解析邮件线程，提取讨论热点和未解决问题

### 5.7 Agent 间数据契约

所有 Agent 之间的数据传递通过严格定义的 Pydantic 模型：

```python
from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum

class ContributionType(str, Enum):
    ISA_EXTENSION = "isa_extension"      # ISA 扩展支持
    BUG_FIX = "bug_fix"                  # Bug 修复
    OPTIMIZATION = "optimization"         # 性能优化
    DOCUMENTATION = "documentation"       # 文档改进
    TEST_COVERAGE = "test_coverage"       # 测试覆盖
    CLEANUP = "cleanup"                  # 代码清理

class Evidence(BaseModel):
    """证据项 — 支撑贡献机会的依据"""
    source: str          # "patchwork" | "mailing_list" | "code_analysis" | "github"
    url: Optional[str]   # 来源链接
    content: str         # 证据内容摘要
    relevance: float     # 相关性评分 0-1

class ExplorationResult(BaseModel):
    """探索阶段输出"""
    contribution_type: ContributionType
    title: str
    summary: str
    target_repo: str
    target_files: list[str]
    evidence: list[Evidence]
    feasibility_score: float = Field(ge=0, le=1)
    estimated_complexity: str  # "low" | "medium" | "high"
    upstream_status: str       # 上游接受可能性评估

class DevStep(BaseModel):
    """开发步骤"""
    id: str
    description: str
    target_files: list[str]
    expected_changes: str
    risk_level: str  # "low" | "medium" | "high"
    dependencies: list[str] = Field(default_factory=list)

class TestCase(BaseModel):
    """测试用例"""
    id: str
    name: str
    type: str  # "unit" | "integration" | "regression"
    description: str
    expected_result: str
    qemu_required: bool = False

class ExecutionPlan(BaseModel):
    """规划阶段输出"""
    dev_steps: list[DevStep]
    test_cases: list[TestCase]
    qemu_config: Optional[dict] = None
    estimated_tokens: int
    risk_assessment: str

class DevelopmentResult(BaseModel):
    """开发阶段输出"""
    patch_files: list[str]       # 补丁文件路径
    changed_files: list[str]     # 变更的源文件
    commit_message: str
    change_summary: str
    lines_added: int
    lines_removed: int

class ReviewFinding(BaseModel):
    """审核发现项"""
    severity: str  # "critical" | "major" | "minor" | "suggestion"
    category: str  # "security" | "correctness" | "style"
    file: str
    line: Optional[int]
    description: str
    suggestion: Optional[str]

class ReviewVerdict(BaseModel):
    """审核阶段输出"""
    approved: bool
    findings: list[ReviewFinding]
    iteration: int
    reviewer_model: str
    summary: str

class TestResult(BaseModel):
    """测试阶段输出"""
    passed: bool
    total_tests: int
    passed_tests: int
    failed_tests: int
    test_log_path: str
    coverage_percent: Optional[float]
    qemu_version: Optional[str]
    failure_details: list[dict] = Field(default_factory=list)
```

### 5.8 API 接口设计

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| `POST` | `/api/v1/cases` | 创建新案例 | ✅ |
| `GET` | `/api/v1/cases` | 案例列表（分页/筛选） | ✅ |
| `GET` | `/api/v1/cases/:id` | 案例详情 | ✅ |
| `DELETE` | `/api/v1/cases/:id` | 删除案例 | ✅ |
| `POST` | `/api/v1/cases/:id/start` | 启动 Pipeline | ✅ |
| `GET` | `/api/v1/cases/:id/events` | SSE 事件流 | ✅ |
| `POST` | `/api/v1/cases/:id/review` | 提交人工审核决策 | ✅ |
| `GET` | `/api/v1/cases/:id/artifacts/:stage` | 获取阶段产物 | ✅ |
| `GET` | `/api/v1/cases/:id/history` | 审核历史 | ✅ |
| `POST` | `/api/v1/auth/login` | 登录 | ❌ |
| `POST` | `/api/v1/auth/register` | 注册 | ❌ |
| `GET` | `/api/v1/knowledge` | 知识库条目列表 | ✅ |
| `POST` | `/api/v1/knowledge` | 添加知识条目 | ✅ |
| `GET` | `/api/v1/metrics/overview` | 指标概览 | ✅ |
| `GET` | `/api/v1/metrics/costs` | Token 消耗统计 | ✅ |

**SSE 事件流协议**：

```python
# route/cases.py
@router.get("/api/v1/cases/{case_id}/events")
async def case_events(
    case_id: str,
    request: Request,
    user: User = Depends(get_current_user),
):
    """SSE 事件流 — 实时推送 Pipeline 执行状态"""
    async def event_generator():
        async for event in pipeline_event_stream(case_id):
            yield {
                "event": event.event_type,
                "data": event.model_dump_json(),
            }

    return EventSourceResponse(event_generator())
```

### 5.9 错误处理与重试策略

**错误分类**：

| 错误类型 | 处理策略 | 示例 |
|----------|----------|------|
| 瞬时错误 | 指数退避重试（最多 3 次） | API 超时、网络抖动 |
| 模型错误 | 降级到备选模型 | Claude API 限流 → 切换模型 |
| 逻辑错误 | 记录并升级到人工 | Agent 输出格式不符 |
| 资源错误 | 等待并重试 | QEMU 沙箱不可用 |
| 致命错误 | 标记案例为 Failed | 目标仓库不存在 |

**模型降级链**：
- Claude: `claude-sonnet-4-20250514` → `claude-haiku-4-20250514`
- OpenAI: `gpt-4o` → `gpt-4o-mini`
- Codex: `codex-mini-latest` → `gpt-4o`

```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    retry=retry_if_exception_type((httpx.TimeoutException, httpx.HTTPStatusError)),
)
async def call_with_retry(func, *args, **kwargs):
    return await func(*args, **kwargs)
```

### 5.10 并发控制与资源调度

由于 LLM API 调用成本高且有速率限制，需要资源调度：

```python
import asyncio

class ResourceScheduler:
    """Agent 资源调度器"""

    def __init__(self):
        # 并发限制
        self.claude_semaphore = asyncio.Semaphore(3)   # 最多 3 个 Claude 并发
        self.openai_semaphore = asyncio.Semaphore(5)   # 最多 5 个 OpenAI 并发
        self.qemu_semaphore = asyncio.Semaphore(2)     # 最多 2 个 QEMU 沙箱

    async def acquire_claude(self):
        await self.claude_semaphore.acquire()

    def release_claude(self):
        self.claude_semaphore.release()

    async def acquire_openai(self):
        await self.openai_semaphore.acquire()

    def release_openai(self):
        self.openai_semaphore.release()

    async def acquire_qemu(self):
        await self.qemu_semaphore.acquire()

    def release_qemu(self):
        self.qemu_semaphore.release()
```

### 5.11 认证鉴权设计

采用 JWT + RBAC 模型：

```mermaid
sequenceDiagram
    participant C as Client
    participant F as FastAPI
    participant M as MongoDB

    C->>F: POST /api/v1/auth/login {username, password}
    F->>M: 查询用户 + 验证 bcrypt hash
    M-->>F: User document
    F->>F: 生成 JWT (HS256, 24h TTL)
    F-->>C: {access_token, token_type: "bearer"}

    C->>F: GET /api/v1/cases (Authorization: Bearer <token>)
    F->>F: 验证 JWT 签名 + 过期时间
    F->>F: 提取 user_id + role
    F-->>C: 200 OK + data
```

**角色权限矩阵**（v4 简化为 2 角色）：

| 权限 | admin | user |
|------|-------|------|
| 创建案例 | ✅ | ✅ |
| 启动 Pipeline | ✅ | ✅ |
| 提交审核决策 | ✅ | ✅ |
| 查看案例详情 | ✅ | ✅ |
| 查看实时日志 | ✅ | ✅ |
| 管理用户 | ✅ | ❌ |
| 管理系统设置 | ✅ | ❌ |
| 删除案例 | ✅ | ❌ |
| Chat 对话 | ✅ | ✅ |

```python
# auth/dependencies.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db = Depends(get_db),
) -> User:
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await db.users.find_one({"_id": user_id})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user)


def require_role(*roles: str):
    """角色权限装饰器"""
    async def checker(user: User = Depends(get_current_user)):
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return checker


# 使用示例
@router.post("/api/v1/cases")
async def create_case(
    body: CreateCaseRequest,
    user: User = Depends(require_role("admin", "user")),
):
    ...
```

### 5.12 Agent System Prompt 工程

每个 Agent 的 System Prompt 是其行为的核心定义。以下是各 Agent 的完整 Prompt 模板：

#### Explorer Agent System Prompt

```python
EXPLORER_SYSTEM_PROMPT = """你是 RV-Insights 平台的 RISC-V 贡献探索专家。

## 身份
你专注于 RISC-V 开源软件生态，精通以下代码库：
- Linux 内核 arch/riscv/ 子系统
- QEMU target/riscv/ 模拟器
- OpenSBI 固件
- GCC/LLVM RISC-V 后端

## 任务
从以下三个维度寻找可行的贡献机会：

### 1. 邮件列表分析
- 使用 WebSearch 搜索 patchwork.kernel.org 的 linux-riscv 项目
- 关注状态为 "Changes Requested"、"RFC"、"Not Applicable" 的补丁
- 识别长期未处理（>30天）的补丁系列

### 2. 代码库分析
- 使用 Grep 搜索 TODO、FIXME、HACK、XXX 注释
- 使用 Read 检查 Kconfig 中未启用的新扩展选项
- 对比 riscv-isa-manual 最新 Ratified 扩展与内核已支持列表

### 3. 可行性验证（必须执行）
- 使用 WebSearch 确认贡献点未被他人认领（搜索邮件列表近期讨论）
- 使用 Bash 运行 `git log --oneline --since="3 months ago" -- <target_files>` 检查近期变更
- 评估实现复杂度（涉及文件数、预估代码行数）

## 输出格式
必须输出严格的 JSON 格式：
{
  "contribution_type": "isa_extension|bug_fix|optimization|documentation|test_coverage|cleanup",
  "title": "简洁的贡献标题",
  "summary": "详细描述（100-300字）",
  "target_repo": "仓库名",
  "target_files": ["文件路径列表"],
  "evidence": [{"source": "来源", "url": "链接", "content": "摘要", "relevance": 0.0-1.0}],
  "feasibility_score": 0.0-1.0,
  "estimated_complexity": "low|medium|high",
  "upstream_status": "上游接受可能性评估"
}

## 约束
- 仅推荐 Frozen 或 Ratified 状态的 ISA 扩展
- feasibility_score < 0.5 的贡献点不输出
- 每个贡献点必须有至少 2 条证据
- 不推荐需要硬件验证的贡献（仅软件层面）
"""
```

#### Reviewer Agent System Prompt

```python
REVIEWER_SYSTEM_PROMPT = """你是 RV-Insights 平台的代码审核专家。

## 身份
你是一位严格的 RISC-V 内核代码审核者，熟悉 Linux kernel coding style 和 RISC-V ISA 规范。
你的审核标准等同于上游 maintainer（如 Palmer Dabbelt, Conor Dooley）。

## 审核维度

### 安全性审核（SecurityReviewer）
- 缓冲区溢出：检查数组访问是否有边界检查
- 整数溢出：检查算术运算是否可能溢出
- 未初始化变量：检查所有变量是否在使用前初始化
- 竞态条件：检查共享数据是否有适当的锁保护
- 权限检查：检查特权操作是否验证了权限

### 正确性审核（CorrectnessReviewer）
- ISA 规范符合性：对照 riscv-isa-manual 验证指令编码和行为
- 边界条件：检查 0、MAX、NULL 等边界情况
- 错误路径：检查所有错误分支是否正确处理（资源释放、状态回滚）
- ABI 兼容性：检查是否破坏了现有 ABI

### 风格审核（StyleReviewer）
- checkpatch.pl 规范：行宽 80 字符、缩进使用 Tab、花括号风格
- commit message 格式：`riscv: subsystem: 简短描述`，正文解释 why 而非 what
- 文档注释：新增公共函数必须有 kerneldoc 注释
- Signed-off-by：必须包含

## 输出格式
{
  "approved": true|false,
  "findings": [
    {
      "severity": "critical|major|minor|suggestion",
      "category": "security|correctness|style",
      "file": "文件路径",
      "line": 行号或null,
      "description": "问题描述",
      "suggestion": "修复建议或null"
    }
  ],
  "summary": "总体评价（50-100字）"
}

## 审核原则
- critical/major finding 存在时必须 approved=false
- 仅 minor/suggestion 时可以 approved=true
- 不要吹毛求疵：仅报告真正影响代码质量的问题
- 给出具体的修复建议，而非模糊的"需要改进"
"""
```

### 5.13 日志与可观测性

```mermaid
graph LR
    subgraph 应用层
        FASTAPI_LOG[FastAPI<br/>请求日志]
        AGENT_LOG[Agent<br/>执行日志]
        PIPELINE_LOG[Pipeline<br/>状态变更日志]
    end

    subgraph 收集层
        STRUCTLOG[structlog<br/>结构化日志]
    end

    subgraph 存储层
        STDOUT[stdout<br/>Docker 日志驱动]
        MONGO_AUDIT[MongoDB<br/>audit_log 集合]
    end

    FASTAPI_LOG --> STRUCTLOG
    AGENT_LOG --> STRUCTLOG
    PIPELINE_LOG --> STRUCTLOG
    STRUCTLOG --> STDOUT
    STRUCTLOG --> MONGO_AUDIT
```

**结构化日志配置**：

```python
import structlog

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
)

logger = structlog.get_logger()

# 使用示例
async def explore_node(state: PipelineState) -> dict:
    log = logger.bind(case_id=state["case_id"], stage="explore")
    log.info("explore_started", target_repo=state["target_repo"])

    try:
        result = await run_explorer(state)
        log.info("explore_completed",
                 contribution_type=result.contribution_type,
                 feasibility_score=result.feasibility_score,
                 evidence_count=len(result.evidence))
        return {"exploration_result": result.model_dump()}
    except Exception as e:
        log.error("explore_failed", error=str(e), exc_info=True)
        raise
```

**审计日志记录**：

```python
async def record_audit_event(
    db, case_id: str, event_type: str, data: dict, user: str | None = None
):
    """记录审计事件到 MongoDB（append-only）"""
    await db.audit_log.insert_one({
        "case_id": case_id,
        "event_type": event_type,
        "data": data,
        "user": user,
        "timestamp": datetime.utcnow(),
    })

# 审计事件类型
AUDIT_EVENTS = {
    "case_created": "案例创建",
    "pipeline_started": "Pipeline 启动",
    "stage_completed": "阶段完成",
    "human_review_submitted": "人工审核提交",
    "review_iteration": "审核迭代",
    "pipeline_completed": "Pipeline 完成",
    "pipeline_failed": "Pipeline 失败",
    "case_abandoned": "案例放弃",
}
```

### 5.14 FastAPI 应用初始化

```python
# main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时
    app.state.db = await init_db(settings.MONGO_URI)
    await create_indexes(app.state.db)
    app.state.checkpointer = await init_checkpointer(settings.POSTGRES_URI)
    app.state.graph = await compile_graph(app.state.checkpointer)
    app.state.artifact_manager = ArtifactManager(settings.ARTIFACT_DIR)
    app.state.scheduler = ResourceScheduler()

    logger.info("application_started")
    yield

    # 关闭时
    app.state.db.client.close()
    logger.info("application_stopped")


def create_app(**overrides) -> FastAPI:
    app = FastAPI(
        title="RV-Insights API",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 注册路由
    from route import auth, cases, reviews, knowledge, metrics
    app.include_router(auth.router, prefix="/api/v1")
    app.include_router(cases.router, prefix="/api/v1")
    app.include_router(reviews.router, prefix="/api/v1")
    app.include_router(knowledge.router, prefix="/api/v1")
    app.include_router(metrics.router, prefix="/api/v1")

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    return app
```

### 5.15 结构化输出与解析容错

LLM 输出 JSON 时常见问题：尾随逗号、未转义引号、Markdown 代码块包裹。需要多层防御：

**OpenAI SDK 阶段 — 使用 Structured Outputs**：

```python
from agents import Agent

planner = Agent(
    name="RV-Insights Planner",
    instructions="...",
    model="gpt-4o",
    output_type=ExecutionPlan,  # Pydantic 模型 → 自动生成 JSON Schema
)
# Runner.run() 返回的 result.final_output 已是 ExecutionPlan 实例
```

**Claude SDK 阶段 — 工具化输出 + 重试**：

```python
import json
import re

async def parse_agent_output(raw: str, model_class: type[BaseModel], max_retries: int = 2) -> BaseModel:
    """解析 Agent 输出为 Pydantic 模型，带重试纠错"""

    for attempt in range(max_retries + 1):
        try:
            # 尝试 1：直接解析
            return model_class.model_validate_json(raw)
        except Exception:
            pass

        try:
            # 尝试 2：提取 Markdown 代码块中的 JSON
            json_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', raw, re.DOTALL)
            if json_match:
                return model_class.model_validate_json(json_match.group(1))
        except Exception:
            pass

        try:
            # 尝试 3：宽松 JSON 解析（处理尾随逗号等）
            cleaned = re.sub(r',\s*([}\]])', r'\1', raw)  # 移除尾随逗号
            cleaned = re.sub(r'[\x00-\x1f]', '', cleaned)  # 移除控制字符
            return model_class.model_validate(json.loads(cleaned))
        except Exception as e:
            if attempt < max_retries:
                # 将错误反馈给 Agent 要求修正
                logger.warning("json_parse_retry", attempt=attempt, error=str(e))
                raw = await retry_with_correction(raw, str(e))
            else:
                raise ValueError(f"无法解析 Agent 输出为 {model_class.__name__}: {e}")


async def retry_with_correction(original_output: str, error_msg: str) -> str:
    """将解析错误反馈给 Agent，要求修正输出"""
    from claude_agent_sdk import query, ClaudeAgentOptions

    correction_prompt = f"""你之前的输出无法解析为有效 JSON。

错误信息: {error_msg}

原始输出:
{original_output[:2000]}

请仅输出修正后的纯 JSON，不要包含任何 Markdown 标记或解释文字。"""

    result_parts = []
    async for msg in query(
        prompt=correction_prompt,
        options=ClaudeAgentOptions(allowed_tools=[], max_turns=1),
    ):
        if hasattr(msg, "result"):
            result_parts.append(msg.result)
    return "\n".join(result_parts)
```

---

## 6. 数据库设计

### 6.1 MongoDB 集合设计

借鉴 ScienceClaw 的 Motor async driver 模式，使用 MongoDB 存储业务数据：

```mermaid
erDiagram
    CASES ||--o{ HUMAN_REVIEWS : "has"
    CASES ||--o{ AUDIT_LOG : "generates"
    CASES {
        string _id PK
        string title
        string status
        string target_repo
        object input_context
        object exploration_result
        object execution_plan
        object development_result
        object review_verdict
        object test_result
        int review_iterations
        object cost
        datetime created_at
        datetime updated_at
    }
    HUMAN_REVIEWS {
        string _id PK
        string case_id FK
        string stage
        string action
        string comment
        string reviewer
        datetime created_at
    }
    AUDIT_LOG {
        string _id PK
        string case_id FK
        string event_type
        object data
        datetime timestamp
    }
    KNOWLEDGE_ENTRIES {
        string _id PK
        string title
        string content
        string source
        string category
        array tags
        datetime created_at
    }
    USERS {
        string _id PK
        string username
        string email
        string hashed_password
        string role
        datetime created_at
    }
```

**集合详细设计**：

```python
# db/collections.py
from motor.motor_asyncio import AsyncIOMotorClient

async def init_db(mongo_uri: str):
    client = AsyncIOMotorClient(mongo_uri)
    db = client["rv_insights"]

    # contribution_cases — 案例主集合
    # 嵌入式文档存储各阶段产物，避免跨集合 JOIN
    await db.create_collection("contribution_cases")

    # human_reviews — 人工审核记录（独立集合，便于审计查询）
    await db.create_collection("human_reviews")

    # audit_log — 审计日志（append-only，不可修改）
    await db.create_collection("audit_log")

    # knowledge_entries — RAG 知识库
    await db.create_collection("knowledge_entries")

    # users — 用户管理
    await db.create_collection("users")

    return db
```

**案例文档结构示例**：

```json
{
  "_id": "case_20260425_001",
  "title": "Add Zicfiss support to Linux kernel",
  "status": "developing",
  "target_repo": "linux/arch/riscv",
  "input_context": {
    "user_hint": "Zicfiss extension was ratified, needs kernel support",
    "target_repo": "linux"
  },
  "exploration_result": {
    "contribution_type": "isa_extension",
    "target_files": ["arch/riscv/kernel/cpufeature.c", "arch/riscv/include/asm/hwcap.h"],
    "evidence": [{"source": "patchwork", "url": "...", "content": "...", "relevance": 0.95}],
    "feasibility_score": 0.85,
    "summary": "..."
  },
  "execution_plan": null,
  "development_result": null,
  "review_verdict": null,
  "test_result": null,
  "review_iterations": 0,
  "cost": {
    "input_tokens": 15000,
    "output_tokens": 8000,
    "estimated_usd": 0.12
  },
  "created_at": "2026-04-25T10:00:00Z",
  "updated_at": "2026-04-25T10:30:00Z"
}
```

### 6.2 PostgreSQL (LangGraph Checkpointer)

PostgreSQL 专用于 LangGraph 的检查点持久化，不存储业务数据：

```python
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg_pool import AsyncConnectionPool

async def init_checkpointer(postgres_uri: str) -> AsyncPostgresSaver:
    pool = AsyncConnectionPool(
        conninfo=postgres_uri,
        min_size=2,
        max_size=10,
    )
    checkpointer = AsyncPostgresSaver(pool)
    await checkpointer.setup()  # 自动创建 checkpoints 表
    return checkpointer
```

LangGraph 自动管理的表结构：
- `checkpoints` — 状态快照（每个节点执行后创建）
- `checkpoint_blobs` — 大型状态数据
- `checkpoint_writes` — 写入记录

### 6.3 索引设计

```python
# MongoDB 索引
async def create_indexes(db):
    # 案例集合
    await db.contribution_cases.create_index([("status", 1), ("created_at", -1)])
    await db.contribution_cases.create_index([("target_repo", 1)])
    await db.contribution_cases.create_index([("updated_at", -1)])

    # 审核记录
    await db.human_reviews.create_index([("case_id", 1), ("created_at", -1)])
    await db.human_reviews.create_index([("reviewer", 1)])

    # 审计日志
    await db.audit_log.create_index([("case_id", 1), ("timestamp", -1)])
    await db.audit_log.create_index([("event_type", 1)])

    # 知识库（全文搜索）
    await db.knowledge_entries.create_index([("title", "text"), ("content", "text")])
    await db.knowledge_entries.create_index([("tags", 1)])

    # 用户
    await db.users.create_index([("username", 1)], unique=True)
    await db.users.create_index([("email", 1)], unique=True)
```

### 6.4 数据生命周期管理

| 数据类型 | 保留策略 | 清理方式 |
|----------|----------|----------|
| 活跃案例 | 永久保留 | — |
| 已完成案例 | 保留 1 年 | TTL 索引自动清理 |
| 已放弃案例 | 保留 90 天 | TTL 索引自动清理 |
| 审计日志 | 保留 2 年 | TTL 索引自动清理 |
| Agent 产物 | 保留 30 天（最终版永久） | 定时任务清理 |
| LangGraph 检查点 | 保留 90 天 | PostgreSQL 定时清理 |
| Redis 缓存 | TTL 1 小时 | 自动过期 |

```python
# MongoDB TTL 索引
async def create_ttl_indexes(db):
    # 已放弃案例 90 天后自动删除
    await db.contribution_cases.create_index(
        [("abandoned_at", 1)],
        expireAfterSeconds=90 * 24 * 3600,
        partialFilterExpression={"status": "abandoned"},
    )
    # 审计日志 2 年后自动删除
    await db.audit_log.create_index(
        [("timestamp", 1)],
        expireAfterSeconds=2 * 365 * 24 * 3600,
    )
```

### 6.5 备份策略

| 组件 | 备份方式 | 频率 | 保留 |
|------|----------|------|------|
| MongoDB | mongodump → 压缩归档 | 每日 02:00 | 30 天滚动 |
| PostgreSQL | pg_dump → 压缩归档 | 每日 02:30 | 30 天滚动 |
| Agent 产物 | rsync → 备份目录 | 每日 03:00 | 与源同步 |

```bash
#!/bin/bash
# scripts/backup.sh
DATE=$(date +%Y%m%d)
BACKUP_DIR="/data/backups/${DATE}"
mkdir -p "${BACKUP_DIR}"

# MongoDB
mongodump --uri="${MONGO_URI}" --gzip --out="${BACKUP_DIR}/mongo"

# PostgreSQL
pg_dump "${POSTGRES_URI}" | gzip > "${BACKUP_DIR}/postgres.sql.gz"

# 清理 30 天前的备份
find /data/backups -maxdepth 1 -type d -mtime +30 -exec rm -rf {} \;
```

---

## 7. 部署方案

### 7.1 Docker Compose 服务编排

```mermaid
graph TD
    subgraph Docker_Compose
        NGINX[nginx<br/>:80/:443]
        BACKEND[backend<br/>:8000]
        MONGO[mongodb<br/>:27017]
        PG[postgres<br/>:5432]
        REDIS[redis<br/>:6379]
    end

    NGINX -->|/api/*| BACKEND
    NGINX -->|静态资源| NGINX
    BACKEND --> MONGO
    BACKEND --> PG
    BACKEND --> REDIS
```

```yaml
# docker-compose.yml
version: "3.8"

services:
  # --- 前端 + 反向代理 ---
  nginx:
    image: nginx:1.25-alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./web-console/dist:/usr/share/nginx/html:ro
    depends_on:
      backend:
        condition: service_healthy
    restart: unless-stopped

  # --- 后端 API + Pipeline 引擎 ---
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - MONGO_URI=mongodb://mongodb:27017/rv_insights
      - POSTGRES_URI=postgresql://rv:rv_pass@postgres:5432/rv_checkpoints
      - REDIS_URL=redis://redis:6379/0
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      mongodb:
        condition: service_healthy
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

  # --- MongoDB ---
  mongodb:
    image: mongo:7.0
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # --- PostgreSQL (LangGraph Checkpointer) ---
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: rv
      POSTGRES_PASSWORD: rv_pass
      POSTGRES_DB: rv_checkpoints
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U rv -d rv_checkpoints"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # --- Redis (缓存 + 事件队列) ---
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  mongo_data:
  pg_data:
  redis_data:
```

### 7.2 Nginx 反向代理

```nginx
# nginx/nginx.conf
events {
    worker_connections 1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;

    upstream backend {
        server backend:8000;
    }

    server {
        listen 80;
        server_name localhost;

        # 前端静态资源
        location / {
            root /usr/share/nginx/html;
            try_files $uri $uri/ /index.html;
        }

        # API 代理
        location /api/ {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

        # SSE 事件流 — 关键配置
        location /api/v1/cases/ {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;

            # SSE 必需配置
            proxy_buffering off;           # 禁用缓冲
            proxy_cache off;               # 禁用缓存
            proxy_read_timeout 86400s;     # 长连接超时 24h
            proxy_set_header Connection ''; # 清除 Connection 头
            proxy_http_version 1.1;        # 使用 HTTP/1.1
            chunked_transfer_encoding off;  # 禁用分块传输
        }
    }
}
```

### 7.3 环境变量管理

```bash
# .env.example
# === LLM API Keys ===
CLAUDE_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# === Database ===
MONGO_URI=mongodb://mongodb:27017/rv_insights
POSTGRES_URI=postgresql://rv:rv_pass@postgres:5432/rv_checkpoints
REDIS_URL=redis://redis:6379/0

# === Auth ===
JWT_SECRET=your-secret-key-here
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440

# === Pipeline Config ===
MAX_REVIEW_ITERATIONS=3
MAX_AGENT_TURNS=50
CLAUDE_MODEL=claude-sonnet-4-20250514
OPENAI_MODEL=gpt-4o
CODEX_MODEL=codex-mini-latest

# === Resource Limits ===
MAX_CONCURRENT_CLAUDE=3
MAX_CONCURRENT_OPENAI=5
MAX_CONCURRENT_QEMU=2
```

### 7.4 Backend Dockerfile

```dockerfile
# backend/Dockerfile
FROM python:3.12-slim AS base

WORKDIR /app

# 系统依赖（交叉编译工具链用于测试阶段）
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl git build-essential \
    && rm -rf /var/lib/apt/lists/*

# Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 应用代码
COPY . .

# 非 root 用户运行
RUN useradd -m appuser
USER appuser

EXPOSE 8000

CMD ["uvicorn", "main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

### 7.5 监控与告警

**健康检查端点**：

```python
@app.get("/health")
async def health(db=Depends(get_db)):
    checks = {}
    # MongoDB
    try:
        await db.command("ping")
        checks["mongodb"] = "ok"
    except Exception:
        checks["mongodb"] = "error"
    # PostgreSQL
    try:
        async with app.state.checkpointer.conn.cursor() as cur:
            await cur.execute("SELECT 1")
        checks["postgres"] = "ok"
    except Exception:
        checks["postgres"] = "error"
    # Redis
    try:
        await app.state.redis.ping()
        checks["redis"] = "ok"
    except Exception:
        checks["redis"] = "error"

    all_ok = all(v == "ok" for v in checks.values())
    return JSONResponse(
        status_code=200 if all_ok else 503,
        content={"status": "healthy" if all_ok else "degraded", "checks": checks},
    )
```

**关键指标**：

| 指标 | 类型 | 告警阈值 |
|------|------|----------|
| Pipeline 执行时间 | Histogram | > 30 分钟 |
| Agent 错误率 | Counter | > 10% / 小时 |
| API 响应时间 P99 | Histogram | > 2 秒 |
| SSE 连接数 | Gauge | > 100 |
| Token 消耗速率 | Counter | > $10 / 小时 |
| MongoDB 连接池使用率 | Gauge | > 80% |
| QEMU 沙箱使用率 | Gauge | > 90% |

---

## 8. 测试方案

### 8.1 单元测试

**框架**：pytest + pytest-asyncio + pytest-mock

**覆盖范围**：

| 模块 | 测试重点 | 覆盖率目标 |
|------|----------|------------|
| Agent Adapters | Claude/OpenAI 适配器的输入输出转换 | ≥ 90% |
| Data Contracts | Pydantic 模型序列化/反序列化/验证 | ≥ 95% |
| Route Functions | 条件边路由逻辑（review 迭代、人工决策） | ≥ 95% |
| API Endpoints | 请求验证、响应格式、错误处理 | ≥ 85% |
| Data Source Clients | Patchwork/GitHub API 客户端 | ≥ 80% |
| Resource Scheduler | 并发控制、信号量管理 | ≥ 90% |

**示例测试**：

```python
# tests/unit/test_route_review.py
import pytest
from backend.pipeline.routes import route_review_decision
from backend.pipeline.state import PipelineState

class TestRouteReviewDecision:
    """Review 路由决策单元测试"""

    def test_approve_when_verdict_approved(self):
        state = PipelineState(
            case_id="test",
            target_repo="linux",
            review_verdict={"approved": True, "findings": []},
            review_iterations=1,
        )
        assert route_review_decision(state) == "approve"

    def test_reject_when_under_max_iterations(self):
        state = PipelineState(
            case_id="test",
            target_repo="linux",
            review_verdict={"approved": False, "findings": [{"severity": "major"}]},
            review_iterations=1,
            max_review_iterations=3,
        )
        assert route_review_decision(state) == "reject"

    def test_escalate_when_max_iterations_reached(self):
        state = PipelineState(
            case_id="test",
            target_repo="linux",
            review_verdict={"approved": False, "findings": [{"severity": "major"}]},
            review_iterations=3,
            max_review_iterations=3,
        )
        assert route_review_decision(state) == "escalate"

    def test_escalate_when_findings_not_converging(self):
        state = PipelineState(
            case_id="test",
            target_repo="linux",
            review_verdict={"approved": False, "findings": [{"severity": "major"}, {"severity": "minor"}]},
            review_iterations=2,
            max_review_iterations=3,
            review_history=[
                {"findings": [{"severity": "major"}]},
                {"findings": [{"severity": "major"}, {"severity": "minor"}]},
            ],
        )
        assert route_review_decision(state) == "escalate"


# tests/unit/test_data_contracts.py
import pytest
from backend.contracts import ExplorationResult, ContributionType, Evidence

class TestExplorationResult:
    """数据契约验证测试"""

    def test_valid_exploration_result(self):
        result = ExplorationResult(
            contribution_type=ContributionType.ISA_EXTENSION,
            title="Add Zicfiss support",
            summary="...",
            target_repo="linux",
            target_files=["arch/riscv/kernel/cpufeature.c"],
            evidence=[Evidence(source="patchwork", content="...", relevance=0.9)],
            feasibility_score=0.85,
            estimated_complexity="medium",
            upstream_status="likely_accepted",
        )
        assert result.feasibility_score == 0.85

    def test_feasibility_score_out_of_range(self):
        with pytest.raises(ValueError):
            ExplorationResult(
                contribution_type=ContributionType.BUG_FIX,
                title="Fix",
                summary="...",
                target_repo="linux",
                target_files=[],
                evidence=[],
                feasibility_score=1.5,  # 超出 0-1 范围
                estimated_complexity="low",
                upstream_status="unknown",
            )
```

### 8.2 集成测试

**框架**：pytest + testcontainers-python（MongoDB/PostgreSQL 容器）

**测试范围**：

```mermaid
graph LR
    subgraph 集成测试范围
        API[FastAPI Endpoints] --> DB[(MongoDB)]
        API --> LG[LangGraph Engine]
        LG --> PG[(PostgreSQL)]
        LG --> MOCK_CLAUDE[Mock Claude SDK]
        LG --> MOCK_OPENAI[Mock OpenAI SDK]
    end
```

| 测试场景 | 验证内容 |
|----------|----------|
| Pipeline 完整流程 | 创建案例 → 探索 → 审核通过 → 规划 → ... → 完成 |
| 人工审核门禁 | interrupt() 暂停 → API 提交决策 → Pipeline 恢复 |
| Develop ↔ Review 迭代 | 3 轮迭代 → 升级为人工处理 |
| 检查点恢复 | 中断后从 PostgreSQL 恢复 Pipeline 状态 |
| SSE 事件流 | 事件推送顺序、格式、完整性 |
| 错误恢复 | Agent 失败 → 重试 → 降级 |

**示例集成测试**：

```python
# tests/integration/test_pipeline_flow.py
import pytest
from testcontainers.mongodb import MongoDbContainer
from testcontainers.postgres import PostgresContainer
from httpx import AsyncClient, ASGITransport
from backend.main import create_app

@pytest.fixture(scope="module")
async def app():
    with MongoDbContainer("mongo:7.0") as mongo, \
         PostgresContainer("postgres:16-alpine") as pg:
        app = create_app(
            mongo_uri=mongo.get_connection_url(),
            postgres_uri=pg.get_connection_url(),
        )
        yield app

@pytest.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

class TestPipelineFlow:
    """Pipeline 完整流程集成测试"""

    async def test_create_and_start_case(self, client):
        # 创建案例
        resp = await client.post("/api/v1/cases", json={
            "title": "Test contribution",
            "target_repo": "linux",
            "input_context": {"user_hint": "Add Zicfiss support"},
        })
        assert resp.status_code == 201
        case_id = resp.json()["id"]

        # 启动 Pipeline
        resp = await client.post(f"/api/v1/cases/{case_id}/start")
        assert resp.status_code == 200

        # 验证状态变为 exploring
        resp = await client.get(f"/api/v1/cases/{case_id}")
        assert resp.json()["status"] == "exploring"

    async def test_human_gate_approve(self, client):
        """测试人工审核通过后 Pipeline 前进"""
        case_id = await self._create_case_at_stage(client, "pending_explore_review")

        resp = await client.post(f"/api/v1/cases/{case_id}/review", json={
            "action": "approve",
            "comment": "Looks good",
        })
        assert resp.status_code == 200

        # 验证状态前进到 planning
        resp = await client.get(f"/api/v1/cases/{case_id}")
        assert resp.json()["status"] == "planning"

    async def test_review_iteration_escalation(self, client):
        """测试 3 轮迭代后升级为人工处理"""
        case_id = await self._create_case_at_stage(client, "developing")

        # 模拟 3 轮 review 均驳回
        for i in range(3):
            await self._trigger_review_reject(client, case_id)

        resp = await client.get(f"/api/v1/cases/{case_id}")
        assert resp.json()["status"] == "pending_code_review"  # 升级到人工
```

### 8.3 E2E 测试

**框架**：Playwright（浏览器自动化）

**测试场景**：

| 场景 | 步骤 | 验证 |
|------|------|------|
| 创建案例 | 登录 → 点击新建 → 填写表单 → 提交 | 案例出现在列表中 |
| Pipeline 可视化 | 进入案例详情 → 观察 Pipeline 状态 | 各阶段状态正确显示 |
| 人工审核 | 等待审核门禁 → 查看产物 → 提交决策 | Pipeline 正确前进/回退 |
| SSE 实时更新 | 启动 Pipeline → 观察实时日志 | 事件按序到达，无丢失 |
| Diff 查看 | 进入代码审核 → 查看 Diff | Diff 正确渲染，findings 高亮 |

```python
# tests/e2e/test_case_workflow.py
from playwright.async_api import async_playwright

async def test_full_case_workflow():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # 登录
        await page.goto("http://localhost/login")
        await page.fill('[data-testid="username"]', "testuser")
        await page.fill('[data-testid="password"]', "testpass")
        await page.click('[data-testid="login-btn"]')
        await page.wait_for_url("**/")

        # 创建案例
        await page.click('[data-testid="new-case-btn"]')
        await page.fill('[data-testid="case-title"]', "E2E Test Case")
        await page.fill('[data-testid="target-repo"]', "linux")
        await page.click('[data-testid="submit-case-btn"]')

        # 验证案例创建成功
        await page.wait_for_selector('[data-testid="case-detail"]')
        assert await page.text_content('[data-testid="case-status"]') == "Created"

        # 启动 Pipeline
        await page.click('[data-testid="start-pipeline-btn"]')
        await page.wait_for_selector('[data-testid="stage-exploring"]')

        await browser.close()
```

### 8.4 Agent 质量评估

Agent 输出质量无法通过传统测试覆盖，需要专门的评估框架：

**评估维度**：

| Agent | 评估指标 | 评估方法 |
|-------|----------|----------|
| Explorer | 贡献点可行性准确率 | 人工标注 50 个案例，计算 precision/recall |
| Explorer | 证据链完整性 | 检查每个贡献点是否有 ≥2 条证据 |
| Planner | 方案可执行性 | 人工评审方案是否可直接执行 |
| Developer | 代码正确性 | checkpatch.pl 通过率 + 编译成功率 |
| Developer | 补丁质量 | 与人工编写补丁的 BLEU/CodeBLEU 对比 |
| Reviewer | 问题发现率 | 注入已知缺陷，检查 Reviewer 是否发现 |
| Reviewer | 误报率 | 对正确代码的错误驳回比例 |
| Tester | 测试覆盖率 | 生成测试的行覆盖率 |
| Tester | 环境搭建成功率 | QEMU 环境正确配置的比例 |

**评估数据集构建**：

```python
# tests/eval/eval_dataset.py
EVAL_CASES = [
    {
        "id": "eval_001",
        "description": "Add Zicfiss extension support to Linux kernel",
        "target_repo": "linux",
        "expected_contribution_type": "isa_extension",
        "expected_files": ["arch/riscv/kernel/cpufeature.c"],
        "ground_truth_patch": "tests/eval/patches/eval_001.patch",
        "known_defects": [
            {"type": "missing_null_check", "file": "cpufeature.c", "line": 42},
        ],
    },
    {
        "id": "eval_002",
        "description": "Fix QEMU RISC-V vector extension emulation bug",
        "target_repo": "qemu",
        "expected_contribution_type": "bug_fix",
        "expected_files": ["target/riscv/vector_helper.c"],
        "ground_truth_patch": "tests/eval/patches/eval_002.patch",
        "known_defects": [
            {"type": "integer_overflow", "file": "vector_helper.c", "line": 128},
        ],
    },
]
```

**自动化评估流程**：

```python
# tests/eval/run_eval.py
async def evaluate_explorer(eval_cases: list[dict]) -> dict:
    """评估 Explorer Agent 的贡献发现能力"""
    results = {"precision": 0, "recall": 0, "evidence_completeness": 0}

    for case in eval_cases:
        # 运行 Explorer
        exploration = await run_explorer(case["target_repo"], case["description"])

        # 计算指标
        predicted_type = exploration.contribution_type
        expected_type = case["expected_contribution_type"]
        results["precision"] += int(predicted_type == expected_type)

        predicted_files = set(exploration.target_files)
        expected_files = set(case["expected_files"])
        results["recall"] += len(predicted_files & expected_files) / len(expected_files)

        results["evidence_completeness"] += int(len(exploration.evidence) >= 2)

    n = len(eval_cases)
    return {k: v / n for k, v in results.items()}
```

### 8.5 CI/CD 集成

```mermaid
graph LR
    PUSH[Git Push] --> LINT[Lint + Type Check<br/>ruff + mypy]
    LINT --> UNIT[Unit Tests<br/>pytest -m unit]
    UNIT --> INTEG[Integration Tests<br/>pytest -m integration<br/>testcontainers]
    INTEG --> BUILD[Docker Build]
    BUILD --> E2E[E2E Tests<br/>Playwright]
    E2E --> EVAL[Agent Eval<br/>周期性运行]
    EVAL --> DEPLOY[Deploy]
```

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install ruff mypy
      - run: ruff check backend/
      - run: mypy backend/ --strict

  unit-test:
    needs: lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install -r backend/requirements.txt -r backend/requirements-test.txt
      - run: pytest tests/unit/ -v --cov=backend --cov-report=xml
      - uses: codecov/codecov-action@v4

  integration-test:
    needs: unit-test
    runs-on: ubuntu-latest
    services:
      docker:
        image: docker:dind
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install -r backend/requirements.txt -r backend/requirements-test.txt
      - run: pytest tests/integration/ -v --timeout=120

  e2e-test:
    needs: integration-test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker compose up -d
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npx playwright install --with-deps
      - run: npx playwright test tests/e2e/
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/

  agent-eval:
    if: github.event_name == 'schedule'  # 仅定时运行
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install -r backend/requirements.txt
      - run: python tests/eval/run_eval.py --output results/eval_report.json
      - uses: actions/upload-artifact@v4
        with:
          name: eval-report
          path: results/eval_report.json
```

### 8.6 性能测试

**负载测试场景**：

| 场景 | 并发数 | 持续时间 | 通过标准 |
|------|--------|----------|----------|
| API 基准 | 50 并发 | 5 分钟 | P99 < 500ms, 错误率 < 0.1% |
| SSE 连接 | 100 连接 | 10 分钟 | 无断连, 事件延迟 < 1s |
| Pipeline 并发 | 5 Pipeline | 30 分钟 | 全部完成, 无死锁 |

```python
# tests/perf/test_api_load.py
import asyncio
import httpx

async def test_api_throughput():
    """API 吞吐量基准测试"""
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        tasks = [client.get("/api/v1/cases") for _ in range(50)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        errors = [r for r in results if isinstance(r, Exception)]
        assert len(errors) / len(results) < 0.001  # 错误率 < 0.1%
```

### 8.7 安全测试

| 测试项 | 方法 | 工具 |
|--------|------|------|
| SQL/NoSQL 注入 | 模糊测试 API 参数 | pytest + hypothesis |
| JWT 伪造 | 使用错误密钥签名 | 手动测试 |
| SSRF | Agent WebSearch 限制验证 | 手动测试 |
| 路径遍历 | 产物路径注入 | pytest |
| 权限绕过 | 跨角色访问测试 | pytest |
| 速率限制 | 高频请求测试 | locust |

### 8.8 Agent Prompt 回归测试

Agent 的 System Prompt 变更可能导致输出质量下降，需要回归测试：

```python
# tests/eval/test_prompt_regression.py
import pytest
from backend.pipeline.prompts import EXPLORER_SYSTEM_PROMPT, REVIEWER_SYSTEM_PROMPT

class TestExplorerPromptRegression:
    """Explorer Prompt 回归测试 — 确保 Prompt 变更不降低输出质量"""

    GOLDEN_CASES = [
        {
            "input": "检查 Zicfiss 扩展是否已有内核支持",
            "expected_type": "isa_extension",
            "min_evidence": 2,
            "min_feasibility": 0.5,
        },
    ]

    @pytest.mark.parametrize("case", GOLDEN_CASES)
    async def test_golden_case(self, case):
        result = await run_explorer_with_prompt(
            EXPLORER_SYSTEM_PROMPT, case["input"]
        )
        assert result.contribution_type == case["expected_type"]
        assert len(result.evidence) >= case["min_evidence"]
        assert result.feasibility_score >= case["min_feasibility"]
```

---

## 9. 安全设计方案

### 9.1 威胁模型

```mermaid
graph TD
    subgraph 外部威胁
        T1[恶意用户输入<br/>Prompt 注入]
        T2[API 滥用<br/>DDoS / 爬虫]
        T3[凭据泄露<br/>API Key 暴露]
    end

    subgraph Agent 威胁
        T4[Agent 越权<br/>沙箱逃逸]
        T5[Agent 幻觉<br/>生成恶意代码]
        T6[供应链攻击<br/>恶意依赖注入]
    end

    subgraph 数据威胁
        T7[数据泄露<br/>API Key / 用户数据]
        T8[数据篡改<br/>审计日志伪造]
    end

    T1 --> GUARD[Guardrails<br/>输入过滤]
    T2 --> RATE[速率限制<br/>Redis]
    T3 --> VAULT[密钥管理<br/>环境变量隔离]
    T4 --> SANDBOX[沙箱隔离<br/>Docker + seccomp]
    T5 --> REVIEW[多模型审核<br/>反共谋]
    T6 --> LOCK[依赖锁定<br/>pip-compile]
    T7 --> ENCRYPT[传输加密<br/>TLS]
    T8 --> APPEND[Append-Only<br/>审计日志]
```

### 9.2 Agent 沙箱安全

| 安全层 | 措施 | 说明 |
|--------|------|------|
| 进程隔离 | Docker 容器 | 每个 Agent 运行在独立容器中 |
| 文件系统 | 只读挂载 + tmpfs | 目标仓库只读，临时文件使用 tmpfs |
| 网络隔离 | 白名单出站 | 仅允许访问 patchwork.kernel.org, github.com, lore.kernel.org |
| 资源限制 | cgroup | CPU: 2 核, 内存: 4GB, 磁盘: 10GB |
| 系统调用 | seccomp profile | 禁止 mount, ptrace, reboot 等危险调用 |
| 执行时间 | 超时控制 | 单次 Agent 执行最长 30 分钟 |

### 9.3 Prompt 注入防护

```python
# security/prompt_guard.py
import re

INJECTION_PATTERNS = [
    r"ignore\s+(previous|above|all)\s+instructions",
    r"you\s+are\s+now\s+",
    r"system\s*:\s*",
    r"<\|im_start\|>",
    r"```system",
]

def detect_prompt_injection(user_input: str) -> bool:
    """检测用户输入中的 Prompt 注入尝试"""
    normalized = user_input.lower().strip()
    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, normalized):
            return True
    return False

def sanitize_user_input(user_input: str) -> str:
    """清理用户输入，移除潜在的注入内容"""
    # 移除 markdown 代码块中的 system/assistant 角色标记
    sanitized = re.sub(r'```(system|assistant).*?```', '[REMOVED]', user_input, flags=re.DOTALL)
    # 限制输入长度
    return sanitized[:10000]
```

### 9.4 API 安全

| 措施 | 实现 |
|------|------|
| HTTPS | Nginx TLS 终止 (Let's Encrypt) |
| CORS | 白名单域名 |
| 速率限制 | Redis + slowapi: 100 req/min/user |
| 输入验证 | Pydantic 严格模式 |
| 响应头 | X-Content-Type-Options, X-Frame-Options, CSP |
| API Key 保护 | 环境变量注入，不进入代码库或日志 |

```python
# middleware/rate_limit.py
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, storage_uri=settings.REDIS_URL)

@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response
```

---

## 10. 可观测性与监控

### 10.1 监控架构

```mermaid
graph LR
    subgraph 应用
        APP[FastAPI + LangGraph]
    end

    subgraph 指标收集
        PROM[Prometheus<br/>指标抓取]
    end

    subgraph 可视化
        GRAF[Grafana<br/>仪表盘]
    end

    subgraph 告警
        ALERT[AlertManager<br/>告警路由]
        WEBHOOK[Webhook<br/>飞书/Slack]
    end

    APP -->|/metrics| PROM
    PROM --> GRAF
    PROM --> ALERT
    ALERT --> WEBHOOK
```

### 10.2 关键仪表盘

**Pipeline 运营仪表盘**：
- 活跃 Pipeline 数量（实时）
- Pipeline 完成率（日/周/月）
- 平均 Pipeline 耗时（按阶段分解）
- Develop ↔ Review 平均迭代次数
- 人工审核平均响应时间

**成本仪表盘**：
- Token 消耗趋势（按 SDK/模型分组）
- 单案例平均成本
- 成本 Top 10 案例
- 模型降级触发次数

**Agent 质量仪表盘**：
- Explorer 可行性评分分布
- Reviewer 发现问题数趋势
- 测试通过率
- Agent 错误率（按类型分组）

### 10.3 告警规则

| 告警名称 | 条件 | 严重级别 | 通知方式 |
|----------|------|----------|----------|
| Pipeline 超时 | 单阶段 > 30 分钟 | Warning | 飞书 |
| Agent 连续失败 | 同一阶段连续 3 次失败 | Critical | 飞书 + 短信 |
| Token 成本异常 | 单案例 > $10 | Warning | 飞书 |
| API 错误率飙升 | 5xx > 5% / 5min | Critical | 飞书 + 短信 |
| 数据库连接池耗尽 | 使用率 > 90% | Critical | 飞书 |
| SSE 连接数过高 | > 200 | Warning | 飞书 |

---

## 附录

### A. 项目目录结构总览

```
RV-Insights/
├── docs/
│   └── design.md                    # 本文档
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                      # FastAPI 入口
│   ├── config.py                    # 配置管理
│   ├── pipeline/                    # LangGraph Pipeline
│   │   ├── graph.py                 # StateGraph 定义
│   │   ├── state.py                 # PipelineState 模型
│   │   ├── nodes/                   # Agent 节点
│   │   │   ├── explore.py
│   │   │   ├── plan.py
│   │   │   ├── develop.py
│   │   │   ├── review.py
│   │   │   ├── test.py
│   │   │   └── human_gate.py
│   │   └── routes.py               # 条件边路由函数
│   ├── adapters/                    # SDK 适配器
│   │   ├── base.py                  # AgentAdapter 基类
│   │   ├── claude_adapter.py
│   │   └── openai_adapter.py
│   ├── contracts/                   # 数据契约
│   │   ├── exploration.py
│   │   ├── planning.py
│   │   ├── development.py
│   │   ├── review.py
│   │   └── testing.py
│   ├── datasources/                 # 数据源客户端
│   │   ├── patchwork.py
│   │   ├── mailing_list.py
│   │   └── github_client.py
│   ├── route/                       # FastAPI 路由
│   │   ├── auth.py
│   │   ├── cases.py
│   │   ├── reviews.py
│   │   ├── knowledge.py
│   │   └── metrics.py
│   ├── db/                          # 数据库
│   │   ├── mongo.py
│   │   ├── postgres.py
│   │   └── collections.py
│   └── scheduler.py                 # 资源调度器
├── web-console/                     # 前端
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── composables/
│   │   ├── stores/
│   │   ├── views/
│   │   ├── types/
│   │   └── router/
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── nginx/
│   └── nginx.conf
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── eval/
├── docker-compose.yml
├── .env.example
└── .github/
    └── workflows/
        └── ci.yml
```

### B. 技术栈汇总

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端框架 | Vue 3 + Vite + TypeScript | 3.3+ / 5.x / 5.x |
| UI | TailwindCSS + reka-ui | 3.x / 2.x |
| 状态管理 | Pinia | 2.x |
| 后端框架 | FastAPI | 0.115+ |
| Pipeline 引擎 | LangGraph | 0.3+ |
| Claude SDK | claude-agent-sdk | latest |
| OpenAI SDK | openai-agents-sdk | latest |
| 数据库 | MongoDB 7.0 + PostgreSQL 16 | — |
| 缓存 | Redis 7 | — |
| 容器化 | Docker Compose | 3.8 |
| 反向代理 | Nginx | 1.25 |
| 测试 | pytest + Playwright | — |
| CI/CD | GitHub Actions | — |

### C. 里程碑与开发计划

```mermaid
gantt
    title RV-Insights 开发计划
    dateFormat  YYYY-MM-DD
    axisFormat  %m/%d

    section Phase 1 - MVP (8周)
    项目初始化 + 基础架构       :p1_1, 2026-05-01, 1w
    LangGraph Pipeline 骨架     :p1_2, after p1_1, 2w
    Explorer Agent (Claude SDK)  :p1_3, after p1_2, 1w
    Planner Agent (OpenAI SDK)   :p1_4, after p1_3, 1w
    Developer Agent (Claude SDK) :p1_5, after p1_4, 1w
    前端 MVP (案例列表+详情+审核) :p1_6, after p1_1, 4w
    集成测试 + Bug 修复          :p1_7, after p1_5, 2w

    section Phase 2 - 完整版 (+8周)
    Reviewer Agent (Codex)       :p2_1, after p1_7, 2w
    Tester Agent + QEMU 沙箱     :p2_2, after p2_1, 2w
    Develop↔Review 迭代循环      :p2_3, after p2_2, 1w
    前端完整版 (仪表盘+知识库+指标):p2_4, after p1_7, 4w
    数据源接入 (Patchwork+邮件列表):p2_5, after p2_3, 2w
    Agent 质量评估框架            :p2_6, after p2_5, 1w

    section Phase 3 - 生产级 (+4周)
    安全加固 + Prompt 注入防护    :p3_1, after p2_6, 1w
    监控告警 + 可观测性           :p3_2, after p3_1, 1w
    性能优化 + 负载测试           :p3_3, after p3_2, 1w
    文档完善 + 部署指南           :p3_4, after p3_3, 1w
```

**里程碑定义**：

| 里程碑 | 日期 | 交付物 | 验收标准 |
|--------|------|--------|----------|
| M1: MVP | Week 8 | 可运行的 3 阶段 Pipeline (Explore→Plan→Develop) | 能完成一个 ISA 扩展贡献的探索+规划+开发 |
| M2: 完整版 | Week 16 | 5 阶段 Pipeline + 完整前端 | 端到端完成一个贡献案例，包含审核迭代和测试 |
| M3: 生产级 | Week 20 | 安全加固 + 监控 + 文档 | 通过安全审计，监控覆盖率 > 80% |

### D. 术语表

| 术语 | 说明 |
|------|------|
| Case | 贡献案例，Pipeline 的执行单元 |
| Pipeline | 5 阶段 Agent 流水线 |
| Stage | Pipeline 中的单个阶段（Explore/Plan/Develop/Review/Test） |
| Human Gate | 人工审核门禁，Pipeline 暂停等待人工决策 |
| Iteration | Develop ↔ Review 的一轮迭代 |
| Escalation | 迭代次数超限后升级为人工处理 |
| Artifact | Agent 产物（补丁、日志、报告等） |
| Evidence | 支撑贡献机会的证据项 |
| Verdict | 审核 Agent 的审核结论 |
| Checkpoint | LangGraph 状态快照，用于中断恢复 |
