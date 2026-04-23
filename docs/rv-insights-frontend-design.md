# RV-Insights Web Console 前端实现方案

> 版本：v1.0  
> 日期：2026-04-23  
> 关联文档：[rv-insights-design.md](./rv-insights-design.md) v2.2  
> 定位：RV-Insights 平台的 Web Console 前端设计，作为 CLI 入口的并行交互界面，服务于后 MVP 阶段

---

## 目录

1. [设计概述](#1-设计概述)
2. [技术栈选型](#2-技术栈选型)
3. [架构设计](#3-架构设计)
4. [项目目录结构](#4-项目目录结构)
5. [类型定义](#5-类型定义)
6. [页面路由设计](#6-页面路由设计)
7. [核心组件设计](#7-核心组件设计)
8. [API 集成](#8-api-集成)
9. [状态管理](#9-状态管理)
10. [实时通信（SSE）](#10-实时通信sse)
11. [关键交互设计](#11-关键交互设计)
12. [后端对接映射](#12-后端对接映射)
13. [部署方案](#13-部署方案)
14. [实施阶段](#14-实施阶段)

---

## 1. 设计概述

### 1.1 目标

Web Console 是 RV-Insights 平台的人工审核与监控入口，面向两类用户：

- **审核者**：在每个 Agent 阶段完成后进行人工审批（探索、规划、开发、测试）
- **运维者**：监控系统健康、成本消耗、Agent 性能、审计日志

### 1.2 设计原则

1. **状态机可视化**：流水线进度必须一目了然，当前状态、已完成阶段、待审核节点清晰可辨
2. **实时性优先**：Agent 执行日志、状态变更、审核通知通过 SSE 实时推送，无需刷新
3. **深度嵌入审核**：审核意见（ReviewFinding）必须能关联到具体代码行（file_path + line_range）
4. **产物可查看**：patch/diff、测试日志、审计日志必须可直接在界面中浏览，无需下载
5. **成本透明**：每个案例的 token 消耗、API 成本在界面中实时可见
6. **响应式设计**：桌面端为主，平板端兼容（审核者可能在多种设备上操作）

### 1.3 非目标

- 不替代 CLI 入口——CLI 仍是开发者的首选，Web Console 面向审核和监控场景
- 不在前端实现复杂的权限管理——依赖后端 JWT + RBAC，前端仅做菜单级权限控制
- 不实现代码编辑——patch 查看只读，修改通过驳回给开发 Agent 完成
- 不覆盖移动端——审核操作在手机上体验差，最小支持到平板尺寸

---

## 2. 技术栈选型

| 层级 | 技术 | 版本 | 选型理由 |
|------|------|------|---------|
| 框架 | Next.js | 15.x (App Router) | 全栈 React 框架，App Router 支持服务端组件与流式传输，与 FastAPI 后端天然配合 |
| 语言 | TypeScript | 5.7+ | 严格类型，与后端 Pydantic 模型对齐，减少运行时错误 |
| UI 库 | React | 19.x | 并发特性（useTransition、useDeferredValue）优化高频 SSE 更新 |
| 样式 | Tailwind CSS | 4.x | 原子化 CSS，无需维护大量自定义样式文件 |
| 组件库 | shadcn/ui | 2.x | 基于 Radix UI + Tailwind，可完全定制，不引入锁定 |
| 表格 | TanStack Table | 8.x | 案例列表、审计日志需要复杂表格（排序、过滤、分页、行展开） |
| 服务端状态 | TanStack Query | 5.x | 缓存、重试、去重、后台刷新，完美适配 REST API |
| 客户端状态 | Zustand | 5.x | 轻量级，无样板代码，适合全局 UI 状态（侧边栏、主题、通知） |
| 实时通信 | EventSource | 原生 API | SSE 是后端原生支持的协议，无需额外库 |
| 图表 | Tremor | 4.x | 基于 Tailwind 的图表库，风格与 shadcn/ui 一致 |
| Diff 查看 | react-diff-viewer-continued | 4.x | 支持 unified diff 高亮、行号、折叠，内核 patch 查看必需 |
| 代码高亮 | Shiki | 3.x | 服务端渲染高亮，支持 C/ASM/DTS 等内核代码语言 |
| 表单 | React Hook Form + Zod | 7.x + 3.x | 创建案例表单、审核决策表单需要严格的 schema 校验 |
| 通知 | Sonner | 1.x | Toast 通知，与 shadcn/ui 风格一致 |
| 图标 | Lucide React | 0.x | 与 shadcn/ui 默认图标集一致 |
| 构建输出 | Static Export | - | Next.js 静态导出为纯前端产物，通过 Nginx 托管，API 请求反向代理到 FastAPI |

### 2.1 为什么不选其他方案

- **为什么不用 Vue/Svelte**：团队技术栈已围绕 React（Claude Code 官方也基于 React），统一栈降低认知成本
- **为什么不用 Redux/MobX**：Zustand 足够轻量，TanStack Query 已覆盖服务端状态，无需重型状态机
- **为什么不用 WebSocket**：后端已设计为 SSE（`EventSourceResponse`），SSE 在 HTTP/1.1 上自动支持、自动重连，无需额外协议握手
- **为什么不用 Monaco Editor**：patch 查看是只读的，Monaco 过重，react-diff-viewer 足够轻量且专为 diff 优化

---

## 3. 架构设计

### 3.1 前后端交互拓扑

```
┌─────────────────────────────────────────────────────────────┐
│                        浏览器 (Browser)                       │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Next.js SPA  │  │ EventSource  │  │ Browser Notif.   │  │
│  │ (Static)     │  │ (SSE)        │  │ (Web Push API)   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────┘  │
└─────────┼──────────────────┼────────────────────────────────┘
          │                  │
          │ HTTPS            │ HTTPS (text/event-stream)
          ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                      Nginx / CDN                             │
│         (静态资源托管 + API 反向代理 + SSE 透传)               │
└─────────┬──────────────────┬────────────────────────────────┘
          │                  │
          ▼                  ▼
┌──────────────────┐  ┌──────────────────────────────────────┐
│  Next.js Static  │  │  FastAPI Gateway                     │
│  Export (out/)   │  │  (REST API + SSE EventSourceResponse)│
└──────────────────┘  └──────────────────────────────────────┘
```

### 3.2 数据流设计

```
                          REST API (GET/POST)
         ┌──────────────────────────────────────────┐
         │                                          │
         ▼                                          ▼
┌─────────────────┐                    ┌──────────────────────┐
│ TanStack Query  │◀───── 缓存 ───────▶│  FastAPI Gateway     │
│ (QueryClient)   │                    │  (Server State)      │
└────────┬────────┘                    └──────────────────────┘
         │
         │ 派生状态（selector）
         ▼
┌─────────────────┐
│ Zustand Store   │  ◀──── 用户交互（审核决策、筛选条件）
│ (UI State)      │
└────────┬────────┘
         │
         │ SSE 事件推送
         ▼
┌─────────────────┐
│ EventSource     │  ◀──── 实时状态变更、Agent 日志、审核通知
│ (useCaseEvents) │
└─────────────────┘
```

### 3.3 核心设计决策

**静态导出 vs SSR**：

Next.js 采用 **Static Export** 模式（`output: 'export'`）。理由：
1. 前端无 SEO 需求（内部工具，需认证）
2. FastAPI 已提供完整 API，无需 Next.js API Routes 做 BFF
3. 静态产物可部署到任意 CDN/Nginx，与 FastAPI 解耦
4. SSE 通过原生 EventSource 直连 FastAPI Gateway，不经过 Next.js 服务端

---

## 4. 项目目录结构

```
web/                                      # 前端项目根目录
├── app/                                  # Next.js App Router (Static Export)
│   ├── (dashboard)/                      # 主布局路由组（共享侧边栏 + 顶部栏）
│   │   ├── cases/
│   │   │   ├── page.tsx                  # 案例列表页 (/cases)
│   │   │   └── [caseId]/
│   │   │       └── page.tsx              # 案例详情页 (/cases/:caseId)
│   │   ├── reviews/
│   │   │   └── page.tsx                  # 审核中心 (/reviews)
│   │   ├── audit/
│   │   │   └── page.tsx                  # 审计日志 (/audit)
│   │   ├── knowledge/
│   │   │   └── page.tsx                  # 知识库搜索 (/knowledge)
│   │   ├── metrics/
│   │   │   └── page.tsx                  # 系统监控 (/metrics)
│   │   ├── layout.tsx                    # Dashboard 共享布局
│   │   └── page.tsx                      # Dashboard 首页 (/)
│   ├── login/
│   │   └── page.tsx                      # 登录页 (/login)
│   ├── layout.tsx                        # 根布局（Provider 注入）
│   └── globals.css                       # 全局样式 + Tailwind 指令
│
├── components/                           # React 组件（按领域组织）
│   ├── ui/                               # shadcn/ui 基础组件（自动生成）
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── table.tsx
│   │   ├── tabs.tsx
│   │   ├── badge.tsx
│   │   ├── toast.tsx
│   │   ├── sonner.tsx
│   │   └── ...
│   ├── layout/                           # 布局组件
│   │   ├── sidebar.tsx                   # 侧边栏导航
│   │   ├── topbar.tsx                    # 顶部栏（用户信息、通知）
│   │   ├── breadcrumb.tsx                # 面包屑
│   │   └── mobile-nav.tsx                # 移动端导航抽屉
│   ├── pipeline/                         # 流水线可视化
│   │   ├── pipeline-diagram.tsx          # 状态机可视化图
│   │   ├── phase-card.tsx                # 单阶段卡片
│   │   ├── phase-status-badge.tsx        # 阶段状态徽章
│   │   └── iteration-timeline.tsx        # 开发-审核迭代时间线
│   ├── case/                             # 案例相关组件
│   │   ├── case-list-table.tsx           # 案例列表表格
│   │   ├── case-filter-bar.tsx           # 案例筛选栏
│   │   ├── case-detail-header.tsx        # 案例详情头部（标题、状态、成本）
│   │   ├── case-artifacts-panel.tsx      # 产物面板（patch、日志）
│   │   └── case-create-dialog.tsx        # 创建案例弹窗
│   ├── review/                           # 审核相关组件
│   │   ├── review-panel.tsx              # 审核决策面板
│   │   ├── review-decision-form.tsx      # 审核决策表单
│   │   ├── finding-card.tsx              # 单条审核发现卡片
│   │   └── findings-list.tsx             # 审核发现列表
│   ├── diff/                             # Diff/Patch 查看器
│   │   ├── patch-viewer.tsx              # Patch 查看器（主组件）
│   │   ├── diff-hunk.tsx                 # 单个 diff hunk
│   │   └── line-comment.tsx              # 行内评论（关联 ReviewFinding）
│   ├── exploration/                      # 探索结果展示
│   │   ├── exploration-result-card.tsx   # 探索结果卡片
│   │   └── evidence-list.tsx             # 证据链列表
│   ├── planning/                         # 规划方案展示
│   │   ├── execution-plan-card.tsx       # 执行计划卡片
│   │   ├── dev-plan-steps.tsx            # 开发步骤列表
│   │   └── test-plan-cases.tsx           # 测试用例列表
│   ├── testing/                          # 测试结果展示
│   │   ├── test-result-summary.tsx       # 测试结果摘要
│   │   ├── test-case-result-item.tsx     # 单条测试结果
│   │   └── test-log-viewer.tsx           # 测试日志查看器
│   ├── audit/                            # 审计日志
│   │   ├── audit-timeline.tsx            # 审计时间线
│   │   └── audit-entry-card.tsx          # 单条审计记录卡片
│   ├── metrics/                          # 系统监控
│   │   ├── cost-chart.tsx                # 成本趋势图
│   │   ├── token-usage-chart.tsx         # Token 消耗图
│   │   ├── agent-performance-chart.tsx   # Agent 性能图
│   │   └── system-health-cards.tsx       # 系统健康状态卡片
│   └── knowledge/                        # 知识库
│       ├── search-input.tsx              # 搜索输入框
│       └── knowledge-result-card.tsx     # 搜索结果卡片
│
├── hooks/                                # 自定义 Hooks
│   ├── use-case-events.ts                # SSE 事件流 Hook
│   ├── use-case-detail.ts                # 案例详情查询 Hook
│   ├── use-cases-list.ts                 # 案例列表查询 Hook
│   ├── use-pending-reviews.ts            # 待审核列表查询 Hook
│   ├── use-review-submit.ts              # 提交审核决策 Mutation Hook
│   ├── use-audit-log.ts                  # 审计日志查询 Hook
│   ├── use-knowledge-search.ts           # 知识库搜索 Hook
│   ├── use-system-metrics.ts             # 系统指标查询 Hook
│   └── use-auth.ts                       # 认证状态 Hook
│
├── lib/                                  # 工具函数与客户端
│   ├── api-client.ts                     # 统一 API Client（fetch 封装）
│   ├── query-client.ts                   # TanStack Query Client 配置
│   ├── sse-client.ts                     # SSE 连接管理器
│   ├── auth.ts                           # JWT Token 管理（localStorage）
│   ├── utils.ts                          # 通用工具函数
│   └── constants.ts                      # 常量（API_BASE_URL、STATUS_MAP 等）
│
├── stores/                               # Zustand 状态库
│   ├── auth-store.ts                     # 认证状态
│   ├── ui-store.ts                       # UI 状态（侧边栏展开、主题）
│   └── notification-store.ts             # 通知状态
│
├── types/                                # TypeScript 类型定义
│   ├── api.ts                            # API 请求/响应类型
│   ├── models.ts                         # 领域模型类型（与后端 Pydantic 对齐）
│   └── enums.ts                          # 枚举类型
│
├── public/                               # 静态资源
│
├── next.config.ts                        # Next.js 配置（output: 'export'）
├── tailwind.config.ts                    # Tailwind 配置
├── tsconfig.json                         # TypeScript 配置
├── components.json                       # shadcn/ui 配置
└── package.json
```

---

## 5. 类型定义

类型定义必须与后端 Pydantic 模型严格对齐，通过共享 OpenAPI Schema 或手动同步。

```typescript
// types/enums.ts

export enum CaseStatus {
  CREATED = 'created',
  EXPLORING = 'exploring',
  EXPLORE_DONE = 'explore_done',
  HUMAN_REVIEW_EXPLORE = 'human_review_explore',
  PLANNING = 'planning',
  PLAN_DONE = 'plan_done',
  HUMAN_REVIEW_PLAN = 'human_review_plan',
  DEVELOPING = 'developing',
  REVIEWING = 'reviewing',
  DEV_REVIEW_ITERATING = 'dev_review_iterating',
  HUMAN_REVIEW_DEV = 'human_review_dev',
  TESTING = 'testing',
  HUMAN_REVIEW_TEST = 'human_review_test',
  READY_FOR_UPSTREAM = 'ready_for_upstream',
  ABANDONED = 'abandoned',
  ESCALATED = 'escalated',
}

export enum HumanDecision {
  APPROVE = 'approve',
  REJECT = 'reject',
  REJECT_TO_PHASE = 'reject_to',
  ABANDON = 'abandon',
  MODIFY = 'modify',
}

export enum ReviewSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info',
}

export enum ReviewCategory {
  CORRECTNESS = 'correctness',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  STYLE = 'style',
  ISA_COMPLIANCE = 'isa_compliance',
}

export enum TestCaseType {
  BUILD = 'build',
  UNIT = 'unit',
  INTEGRATION = 'integration',
  PERFORMANCE = 'performance',
  BOOT = 'boot',
}

export enum InputSource {
  USER = 'user',
  MAILING_LIST = 'mailing_list',
  ISSUE_TRACKER = 'issue_tracker',
  CODE_SCAN = 'code_scan',
  CI_FAILURE = 'ci_failure',
}

export enum NotificationChannel {
  WEBHOOK = 'webhook',
  EMAIL = 'email',
  SSE = 'sse',
  CLI_POLL = 'cli_poll',
}
```

```typescript
// types/models.ts

export interface EvidenceItem {
  type: 'mailing_list_url' | 'commit_hash' | 'issue_url' | 'code_snippet';
  url?: string;
  content: string;
  relevance: number; // 0.0 - 1.0
}

export interface ExplorationResult {
  opportunity_id: string;
  title: string;
  source: InputSource;
  description: string;
  feasibility_score: number;
  evidence: EvidenceItem[];
  affected_files: string[];
  affected_subsystem: string;
  risk_level: 'low' | 'medium' | 'high';
  estimated_loc: number;
  upstream_status: 'no_existing_work' | 'wip_by_others' | 'stale_attempt';
  community_receptiveness: 'likely_accept' | 'needs_discussion' | 'controversial';
}

export interface DevStep {
  order: number;
  description: string;
  target_files: string[];
  depends_on: number[];
  reference_docs: string[];
  estimated_loc: number;
}

export interface DevPlan {
  steps: DevStep[];
  coding_style_notes: string;
  commit_message_template: string;
  total_estimated_loc: number;
}

export interface TestCase {
  id: string;
  type: TestCaseType;
  description: string;
  command: string;
  expected_outcome: string;
  timeout_seconds: number;
  environment: 'host' | 'qemu_rv64' | 'qemu_rv32' | 'cross_compile';
}

export interface TestPlan {
  cases: TestCase[];
  environment_setup: string[];
  required_tools: string[];
  qemu_config?: Record<string, unknown>;
  pass_criteria: string;
}

export interface RiskAssessment {
  affected_subsystems: string[];
  regression_risk: 'low' | 'medium' | 'high';
  security_impact: boolean;
  abi_impact: boolean;
  community_acceptance: 'high' | 'medium' | 'low';
  rollback_strategy: string;
}

export interface ExecutionPlan {
  opportunity_id: string;
  dev_plan: DevPlan;
  test_plan: TestPlan;
  risk_assessment: RiskAssessment;
  estimated_complexity: 'trivial' | 'small' | 'medium' | 'large';
  estimated_iterations: number;
}

export interface ChangedFile {
  path: string;
  change_type: 'modified' | 'added' | 'deleted';
  lines_added: number;
  lines_removed: number;
  diff_summary: string;
}

export interface BuildResult {
  success: boolean;
  command: string;
  output: string;
  warnings: string[];
  errors: string[];
}

export interface DevelopmentResult {
  patch: string;
  changed_files: ChangedFile[];
  build_result: BuildResult;
  commit_message: string;
  summary: string;
  iterations: number;
  review_verdict?: ReviewVerdict;
  escalated: boolean;
  escalation_reason?: string;
}

export interface ReviewFinding {
  id: string;
  severity: ReviewSeverity;
  category: ReviewCategory;
  file_path: string;
  line_range: [number, number];
  description: string;
  suggestion: string;
  auto_fixable: boolean;
  reference?: string;
}

export interface ReviewVerdict {
  approved: boolean;
  findings: ReviewFinding[];
  critical_count: number;
  high_count: number;
  iteration: number;
  summary: string;
  confidence: number;
}

export interface TestCaseResult {
  case_id: string;
  passed: boolean;
  output: string;
  duration_seconds: number;
  log_path?: string;
}

export interface TestResult {
  overall_passed: boolean;
  case_results: TestCaseResult[];
  pass_rate: number;
  total_duration_seconds: number;
  environment_info: Record<string, unknown>;
  log_archive_path: string;
}

export interface HumanReview {
  case_id: string;
  phase: string;
  reviewer: string;
  decision: HumanDecision;
  comments: string;
  reject_to_phase?: string;
  timestamp: string; // ISO 8601
}

export interface AuditEntry {
  timestamp: string;
  phase: string;
  action: string;
  agent: string;
  sdk: 'claude_agent_sdk' | 'openai_agents_sdk' | 'human';
  model?: string;
  input_summary: string;
  output_summary: string;
  tool_calls: Array<Record<string, unknown>>;
  tokens_used: number;
  cost_usd: number;
  duration_ms: number;
}

export interface InputContext {
  source: InputSource;
  raw_content: string;
  repo_url: string;
  target_branch: string;
  user_hint?: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  metadata: Record<string, unknown>;
}

export interface ContributionCase {
  id: string;
  status: CaseStatus;
  created_at: string;
  updated_at: string;
  input_context: InputContext;
  repo_url: string;
  target_branch: string;
  exploration_result?: ExplorationResult;
  execution_plan?: ExecutionPlan;
  development_result?: DevelopmentResult;
  review_history: ReviewVerdict[];
  test_result?: TestResult;
  human_reviews: HumanReview[];
  audit_trail: AuditEntry[];
}
```

```typescript
// types/api.ts

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  has_next: boolean;
}

export interface CreateCaseRequest {
  source: InputSource;
  raw_content: string;
  repo_url: string;
  target_branch?: string;
  user_hint?: string;
  priority?: string;
  metadata?: Record<string, unknown>;
}

export interface CaseResponse extends ApiResponse<ContributionCase> {}
export interface CaseListResponse extends ApiResponse<ContributionCase[]> {}
export interface CaseDetailResponse extends ApiResponse<ContributionCase> {}

export interface PendingReviewsResponse extends ApiResponse<Array<{
  case_id: string;
  phase: string;
  summary: string;
  artifacts_url: string;
  created_at: string;
}>> {}

export interface SubmitReviewRequest {
  decision: HumanDecision;
  comments: string;
  reject_to_phase?: string;
}

export interface ReviewResponse extends ApiResponse<HumanReview> {}

export interface KnowledgeSearchResponse extends ApiResponse<Array<{
  id: string;
  category: string;
  title: string;
  content: string;
  relevance_score: number;
}>> {}

export interface SystemMetricsResponse extends ApiResponse<{
  cases_total: number;
  cases_by_status: Record<string, number>;
  total_cost_usd: number;
  total_tokens: number;
  agent_invocations: Record<string, number>;
  avg_review_wait_time_seconds: number;
}> {}

export interface HealthCheckResponse extends ApiResponse<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: Record<string, { status: string; latency_ms: number }>;
}> {}

export interface SSEEvent {
  type: 'status_change' | 'agent_output' | 'review_request' | 'cost_update' | 'error';
  case_id: string;
  timestamp: string;
  payload: Record<string, unknown>;
}
```

---

## 6. 页面路由设计

| 路由 | 页面 | 说明 | 数据来源 |
|------|------|------|---------|
| `/login` | 登录页 | JWT Token 输入（MVP 静态 token） | `POST /api/v1/auth/token`（预留） |
| `/` | Dashboard | 全局概览：案例统计、待审核提醒、实时活动、成本 | `GET /api/v1/cases`, `GET /api/v1/reviews/pending`, `GET /api/v1/system/metrics` |
| `/cases` | 案例列表 | 表格/卡片视图，状态筛选，分页 | `GET /api/v1/cases` |
| `/cases/:caseId` | 案例详情 | 流水线状态机 + 阶段产物 + 审核面板 | `GET /api/v1/cases/:caseId`, SSE `/api/v1/cases/:caseId/events` |
| `/reviews` | 审核中心 | 待审核队列、审核历史、批量操作 | `GET /api/v1/reviews/pending`, `POST /api/v1/reviews/:caseId/:phase` |
| `/audit` | 审计日志 | 时间线视图、按案例/Agent 筛选 | `GET /api/v1/cases/:caseId/audit`（扩展 API） |
| `/knowledge` | 知识库 | 语义搜索、结果展示 | `GET /api/v1/knowledge/search` |
| `/metrics` | 系统监控 | Agent 性能、成本趋势、资源使用 | `GET /api/v1/system/metrics`, `GET /api/v1/system/health` |

### 6.1 案例详情页布局

```
┌─────────────────────────────────────────────────────────────────┐
│ 案例标题 │ 状态徽章 │ 成本 $7.05 │ 创建时间 │ 操作按钮 ...        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Pipeline 状态机可视化                         │  │
│  │  [探索]──▶[规划]──▶[开发⇄审核]──▶[测试]──▶[就绪]         │  │
│  │    ✓        ✓        🔄 迭代 2/5       ⏳                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌────────────────────────────┐  ┌──────────────────────────┐  │
│  │      阶段产物 Tab          │  │     审核/操作面板         │  │
│  │  ────────────────────────  │  │  ──────────────────────  │  │
│  │  [探索] [规划] [开发] ...  │  │  当前阶段：开发审核       │  │
│  │                            │  │  ──────────────────────  │  │
│  │  内容区域（Diff 查看器等）   │  │  [通过] [驳回] [放弃]    │  │
│  │                            │  │  评论输入框               │  │
│  │                            │  │  驳回到阶段：下拉选择      │  │
│  └────────────────────────────┘  └──────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              实时 Agent 输出日志 (SSE)                     │  │
│  │  [2025-04-23 10:23:01] 开发Agent: 正在读取 arch/riscv/...  │  │
│  │  [2025-04-23 10:23:15] 开发Agent: 执行 make 检查...        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. 核心组件设计

### 7.1 PipelineDiagram（流水线状态机可视化）

```typescript
// components/pipeline/pipeline-diagram.tsx

interface PipelineDiagramProps {
  currentStatus: CaseStatus;
  reviewHistory: ReviewVerdict[];
  humanReviews: HumanReview[];
}

const PIPELINE_PHASES = [
  { status: CaseStatus.EXPLORING, label: '探索', icon: Search },
  { status: CaseStatus.PLANNING, label: '规划', icon: Map },
  { status: CaseStatus.DEVELOPING, label: '开发', icon: Code },
  { status: CaseStatus.REVIEWING, label: '审核', icon: ShieldCheck },
  { status: CaseStatus.TESTING, label: '测试', icon: FlaskConical },
  { status: CaseStatus.READY_FOR_UPSTREAM, label: '就绪', icon: Send },
] as const;

export function PipelineDiagram({ currentStatus, reviewHistory, humanReviews }: PipelineDiagramProps) {
  // 计算每个阶段的完成状态
  // 如果当前处于 DEV_REVIEW_ITERATING，显示迭代计数
  //  human_review 节点用不同颜色区分（等待审核 = 黄色闪烁）
}
```

**设计要点**：
- 横向步骤条，每个阶段包含 Agent 执行节点 + 人工审核节点
- 已完成：绿色实线连接
- 进行中：蓝色脉冲动画
- 待审核：黄色闪烁徽章，附带"需要审核"提示
- 迭代闭环：开发→审核之间的回环箭头，标注迭代次数
- 驳回路径：虚线箭头回退到目标阶段

### 7.2 PatchViewer（Patch/Diff 查看器）

```typescript
// components/diff/patch-viewer.tsx

interface PatchViewerProps {
  patch: string;
  findings?: ReviewFinding[];
  onLineClick?: (filePath: string, lineNumber: number) => void;
}

export function PatchViewer({ patch, findings, onLineClick }: PatchViewerProps) {
  // 使用 react-diff-viewer-continued 渲染 unified diff
  // 将 ReviewFinding 映射到对应代码行，高亮显示
  // 点击行号可触发 onLineClick（用于审核意见定位）
}
```

**设计要点**：
- 支持 unified diff 格式（内核 patch 标准格式）
- 新增行绿色背景，删除行红色背景，上下文行灰色背景
- ReviewFinding 关联行高亮（severity 颜色：critical=红，high=橙，medium=黄）
- 行内悬浮显示 finding 描述和 suggestion
- 文件列表侧边栏，支持快速跳转

### 7.3 ReviewPanel（审核决策面板）

```typescript
// components/review/review-panel.tsx

interface ReviewPanelProps {
  caseId: string;
  phase: string;
  currentStatus: CaseStatus;
  onDecisionSubmitted: () => void;
}

export function ReviewPanel({ caseId, phase, currentStatus, onDecisionSubmitted }: ReviewPanelProps) {
  // 表单字段：decision（radio）、comments（textarea）、reject_to_phase（select）
  // 使用 React Hook Form + Zod 校验
  // 提交后调用 submitReviewMutation，成功后 toast 通知 + onDecisionSubmitted()
}
```

**设计要点**：
- 决策选项：通过 / 驳回并重做 / 驳回到指定阶段 / 附带修改意见通过 / 放弃
- 驳回时必须选择目标阶段（下拉框：explore / plan / dev / test）
- 评论框支持 Markdown 预览
- 提交后禁用按钮，防止重复提交
- 操作不可逆，二次确认弹窗

### 7.4 CaseEventsLog（实时事件日志）

```typescript
// components/case/case-events-log.tsx

interface CaseEventsLogProps {
  caseId: string;
}

export function CaseEventsLog({ caseId }: CaseEventsLogProps) {
  const events = useCaseEvents(caseId); // SSE Hook
  const scrollRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部（用户可手动暂停）
  useEffect(() => {
    if (scrollRef.current && autoScroll) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  // 按 event.type 渲染不同样式
}
```

**设计要点**：
- SSE 实时追加日志，无需刷新
- 不同 event type 不同颜色（agent_output=白，status_change=蓝，error=红）
- 支持暂停/恢复自动滚动
- 支持按 Agent 过滤（只看开发 Agent 日志）
- 最大保留 1000 条，超出时提示"日志已截断，请查看完整日志文件"

---

## 8. API 集成

### 8.1 API Client

```typescript
// lib/api-client.ts

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new ApiError(response.status, await response.text());
    }

    return response.json();
  }

  get<T>(endpoint: string) {
    return this.request<T>('GET', endpoint);
  }

  post<T>(endpoint: string, body: unknown) {
    return this.request<T>('POST', endpoint, body);
  }
}

export const apiClient = new ApiClient();
```

### 8.2 TanStack Query Hooks

```typescript
// hooks/use-cases-list.ts

import { useQuery } from '@tanstack/react-query';

export function useCasesList(status?: string, page = 1, limit = 20) {
  return useQuery({
    queryKey: ['cases', status, page, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      params.set('page', String(page));
      params.set('limit', String(limit));
      const res = await apiClient.get<CaseListResponse>(`/cases?${params}`);
      return res.data;
    },
    staleTime: 10_000, // 10 秒内视为新鲜
  });
}

// hooks/use-case-detail.ts

export function useCaseDetail(caseId: string) {
  return useQuery({
    queryKey: ['case', caseId],
    queryFn: async () => {
      const res = await apiClient.get<CaseDetailResponse>(`/cases/${caseId}`);
      return res.data;
    },
    staleTime: 5_000,
    refetchInterval: (query) => {
      // 如果案例处于运行中状态，每 5 秒轮询兜底（SSE 可能断开）
      const data = query.state.data;
      if (data && isRunningStatus(data.status)) {
        return 5_000;
      }
      return false;
    },
  });
}

// hooks/use-review-submit.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useReviewSubmit(caseId: string, phase: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SubmitReviewRequest) => {
      const res = await apiClient.post<ReviewResponse>(
        `/reviews/${caseId}/${phase}`,
        data
      );
      return res.data;
    },
    onSuccess: () => {
      // 使相关缓存失效，触发重新获取
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['pending-reviews'] });
    },
  });
}
```

### 8.3 SSE Hook

```typescript
// hooks/use-case-events.ts

import { useEffect, useRef, useState } from 'react';

export function useCaseEvents(caseId: string) {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('rv_token');
    const es = new EventSource(
      `${API_BASE_URL}/cases/${caseId}/events?token=${token}`
    );
    esRef.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (e) => {
      try {
        const event: SSEEvent = JSON.parse(e.data);
        setEvents((prev) => [...prev, event]);
      } catch {
        // 忽略非 JSON 消息
      }
    };

    es.onerror = () => {
      setConnected(false);
      // 3 秒后自动重连（EventSource 默认自动重连，此处仅更新 UI 状态）
    };

    return () => {
      es.close();
    };
  }, [caseId]);

  return { events, connected };
}
```

---

## 9. 状态管理

### 9.1 Zustand Store 设计

```typescript
// stores/auth-store.ts

import { create } from 'zustand';

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  setToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  isAuthenticated: false,
  setToken: (token) => {
    localStorage.setItem('rv_token', token);
    apiClient.setToken(token);
    set({ token, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('rv_token');
    apiClient.setToken('');
    set({ token: null, isAuthenticated: false });
  },
}));

// stores/ui-store.ts

interface UIState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'system';
  activeCaseId: string | null;
  toggleSidebar: () => void;
  setTheme: (theme: UIState['theme']) => void;
  setActiveCaseId: (id: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  theme: 'system',
  activeCaseId: null,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setTheme: (theme) => set({ theme }),
  setActiveCaseId: (id) => set({ activeCaseId: id }),
}));

// stores/notification-store.ts

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  caseId?: string;
  timestamp: string;
}

interface NotificationState {
  notifications: Notification[];
  addNotification: (n: Omit<Notification, 'id' | 'timestamp'>) => void;
  dismissNotification: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  addNotification: (n) =>
    set((s) => ({
      notifications: [
        { ...n, id: crypto.randomUUID(), timestamp: new Date().toISOString() },
        ...s.notifications,
      ].slice(0, 50), // 最多保留 50 条
    })),
  dismissNotification: (id) =>
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
    })),
  clearAll: () => set({ notifications: [] }),
}));
```

### 9.2 与 TanStack Query 的分工

| 状态类型 | 管理工具 | 示例 |
|---------|---------|------|
| 服务端状态 | TanStack Query | 案例列表、案例详情、审核队列、系统指标 |
| 全局 UI 状态 | Zustand | 侧边栏展开、主题、当前活跃案例、通知 |
| 局部表单状态 | React useState | 审核决策表单、创建案例表单、筛选条件 |
| 派生状态 | useMemo / selector | 案例统计计算、过滤后的列表 |

---

## 10. 实时通信（SSE）

### 10.1 事件类型与处理

| SSE Event Type | 触发场景 | 前端处理 |
|---------------|---------|---------|
| `status_change` | 案例状态机流转 | 更新 PipelineDiagram、刷新案例详情缓存、播放提示音 |
| `agent_output` | Agent 产生新的日志/输出 | 追加到 CaseEventsLog、如果当前在别的页面则生成 Toast |
| `review_request` | 案例进入人工审核节点 | 全局通知弹窗、浏览器通知 API、侧边栏待审核计数 +1 |
| `cost_update` | Agent 调用产生新的成本 | 更新案例详情头部的成本显示、Dashboard 成本卡片 |
| `error` | Agent 执行错误或系统异常 | 全局 Toast 告警、案例状态显示异常标记 |

### 10.2 连接管理策略

1. **案例详情页**：打开时建立 SSE 连接，离开时关闭（单案例事件流）
2. **Dashboard**：建立全局 SSE 连接（预留全局事件流 API，或轮询 `pending-reviews`）
3. **自动重连**：EventSource 原生支持自动重连，额外添加连接状态指示器（顶部栏小圆点）
4. **断线提示**：SSE 断开超过 10 秒，显示"实时连接中断，正在重连..."横幅

### 10.3 浏览器通知

```typescript
// lib/notifications.ts

export function requestNotificationPermission() {
  if ('Notification' in window) {
    Notification.requestPermission();
  }
}

export function sendBrowserNotification(title: string, body: string, caseId?: string) {
  if (Notification.permission === 'granted') {
    const notification = new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: caseId,
    });
    notification.onclick = () => {
      window.focus();
      if (caseId) {
        window.location.href = `/cases/${caseId}`;
      }
    };
  }
}
```

---

## 11. 关键交互设计

### 11.1 人工审核工作流

```
1. 审核者收到通知（SSE review_request + 浏览器通知）
2. 点击通知 → 跳转到 /cases/:caseId
3. 页面自动定位到当前待审核阶段（Tab 自动切换）
4. 审核者阅读阶段产物（探索报告 / 规划方案 / Diff / 测试报告）
5. 在 ReviewPanel 中做出决策：
   - 通过：输入评论（可选）→ 提交 → 案例自动进入下一阶段
   - 驳回：选择驳回原因 → 选择是否回退到特定阶段 → 提交 → 案例回退
   - 附带修改意见通过：输入具体修改意见 → 提交 → 案例进入下一阶段但标记修改意见
   - 放弃：二次确认 → 案例状态变为 ABANDONED
6. 提交后显示 Toast 成功提示，自动刷新案例状态
```

### 11.2 探索结果查看

- 证据链（EvidenceItem）以卡片列表展示
- `mailing_list_url` / `issue_url` 类型显示为可点击外链
- `code_snippet` 类型使用 Shiki 代码高亮
- `relevance` 以进度条可视化（0-1 映射到 0%-100%）
- `feasibility_score` 以环形图展示

### 11.3 规划方案查看

- 开发步骤（DevStep）以垂直时间线展示
- 依赖关系以箭头连接可视化
- 测试用例以表格展示，含命令可复制到剪贴板
- 风险评估以雷达图展示多维度风险

### 11.4 开发与审核迭代查看

- 每次迭代以折叠面板展示（迭代 1、迭代 2...）
- 展开后显示该轮次的：patch diff、findings 列表、审核判定
- 最新迭代默认展开，历史迭代折叠
- `escalated=true` 时显示红色警告横幅"已达到最大迭代次数，需人工深度介入"

### 11.5 测试报告查看

- 整体通过/失败以大型徽章展示
- 单条测试用例结果以表格展示（通过=绿勾，失败=红叉）
- 失败的测试用例可点击展开查看完整输出日志
- 日志查看器支持搜索、自动换行、下载

---

## 12. 后端对接映射

### 12.1 API 端点映射

| 前端需求 | 前端 Hook | 后端 API | HTTP 方法 |
|---------|----------|---------|----------|
| 获取案例列表 | `useCasesList` | `/api/v1/cases` | GET |
| 获取案例详情 | `useCaseDetail` | `/api/v1/cases/{case_id}` | GET |
| 创建案例 | `useCreateCase` | `/api/v1/cases` | POST |
| 案例实时事件 | `useCaseEvents` | `/api/v1/cases/{case_id}/events` | SSE |
| 获取待审核列表 | `usePendingReviews` | `/api/v1/reviews/pending` | GET |
| 提交审核决策 | `useReviewSubmit` | `/api/v1/reviews/{case_id}/{phase}` | POST |
| 搜索知识库 | `useKnowledgeSearch` | `/api/v1/knowledge/search` | GET |
| 获取系统指标 | `useSystemMetrics` | `/api/v1/system/metrics` | GET |
| 健康检查 | `useHealthCheck` | `/api/v1/system/health` | GET |

### 12.2 数据模型字段映射

前端 TypeScript 接口字段名与后端 Pydantic 模型完全一致，通过如下方式保持同步：

1. **手动对齐**：每次后端模型变更时，同步更新 `types/models.ts`
2. **OpenAPI 生成（推荐）**：后端 FastAPI 自动生成 `/openapi.json`，前端使用 `openapi-typescript` 生成类型文件

```bash
# 类型同步脚本（package.json scripts）
"types:sync": "openapi-typescript http://localhost:8000/openapi.json -o types/api-generated.ts"
```

### 12.3 状态机映射

| 后端 CaseStatus | 前端显示文本 | PipelineDiagram 样式 | 可操作面板 |
|----------------|------------|---------------------|----------|
| `created` | 已创建 | 灰色起点 | 无 |
| `exploring` | 探索中 | 蓝色脉冲（探索节点） | CaseEventsLog |
| `explore_done` | 探索完成 | 探索节点绿色 | 无（等待审核） |
| `human_review_explore` | 待审核（探索） | 探索审核节点黄色闪烁 | ReviewPanel |
| `planning` | 规划中 | 蓝色脉冲（规划节点） | CaseEventsLog |
| `plan_done` | 规划完成 | 规划节点绿色 | 无（等待审核） |
| `human_review_plan` | 待审核（规划） | 规划审核节点黄色闪烁 | ReviewPanel |
| `developing` | 开发中 | 蓝色脉冲（开发节点） | CaseEventsLog |
| `reviewing` | 审核中 | 蓝色脉冲（审核节点） | CaseEventsLog |
| `dev_review_iterating` | 迭代中 | 开发-审核回环蓝色脉冲 | CaseEventsLog + IterationTimeline |
| `human_review_dev` | 待审核（开发） | 开发审核节点黄色闪烁 | ReviewPanel + PatchViewer |
| `testing` | 测试中 | 蓝色脉冲（测试节点） | CaseEventsLog + TestResult |
| `human_review_test` | 待审核（测试） | 测试审核节点黄色闪烁 | ReviewPanel + TestLogViewer |
| `ready_for_upstream` | 就绪 | 全部节点绿色，终点发光 | PatchViewer + 提交命令展示 |
| `abandoned` | 已放弃 | 全部节点灰色，终点红叉 | 只读 |
| `escalated` | 已升级 | 当前节点橙色警告 | ReviewPanel（需深度介入） |

---

## 13. 部署方案

### 13.1 构建输出

Next.js 配置为 **Static Export**：

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  distDir: 'dist',
  images: {
    unoptimized: true, // 静态导出不支持图片优化
  },
};

export default nextConfig;
```

构建产物为纯静态文件（HTML/CSS/JS），无需 Node.js 运行时。

### 13.2 Docker 集成

在现有 `docker-compose.yml` 中新增 `web-console` 服务：

```yaml
# docker-compose.yml 新增服务
services:
  web-console:
    build: ./web
    ports:
      - "3000:80"
    depends_on:
      - api-gateway
    environment:
      - NEXT_PUBLIC_API_URL=/api/v1  # Nginx 反向代理路径

  # Nginx 反向代理（新增或合并到现有网关）
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./web/dist:/usr/share/nginx/html:ro
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - api-gateway
      - web-console
```

```nginx
# nginx.conf 关键配置
server {
    listen 80;
    server_name localhost;

    # 静态资源（Next.js 导出产物）
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri.html $uri/index.html /index.html;
    }

    # API 反向代理到 FastAPI
    location /api/v1/ {
        proxy_pass http://api-gateway:8000/api/v1/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        # SSE 支持
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

### 13.3 环境变量

| 变量名 | 说明 | 示例 |
|-------|------|------|
| `NEXT_PUBLIC_API_URL` | API 基础路径（浏览器端） | `/api/v1` |
| `NEXT_PUBLIC_APP_NAME` | 应用名称 | `RV-Insights` |
| `NEXT_PUBLIC_SSE_RETRY_INTERVAL` | SSE 重连间隔（毫秒） | `3000` |

**注意**：所有 `NEXT_PUBLIC_` 前缀的变量在构建时固化，运行时无法更改。API URL 建议始终使用相对路径 `/api/v1`，由 Nginx 反向代理处理。

---

## 14. 实施阶段

### Phase 1：基础框架搭建（1 周）

- [ ] 初始化 Next.js 15 + TypeScript + Tailwind CSS v4 项目
- [ ] 配置 shadcn/ui 组件库
- [ ] 搭建项目目录结构（app/、components/、hooks/、lib/、stores/、types/）
- [ ] 配置 TanStack Query Provider、Zustand Provider
- [ ] 实现 API Client（含 JWT 认证头注入）
- [ ] 实现登录页（JWT Token 输入）
- [ ] 实现 Dashboard 基础布局（Sidebar + Topbar）

### Phase 2：案例管理模块（1.5 周）

- [ ] 实现 `types/models.ts` 和 `types/api.ts`（与后端 Pydantic 模型对齐）
- [ ] 实现案例列表页（`useCasesList` + TanStack Table）
- [ ] 实现案例创建弹窗（React Hook Form + Zod）
- [ ] 实现案例详情页基础布局
- [ ] 实现 `PipelineDiagram` 组件（状态机可视化）
- [ ] 实现 `CaseEventsLog` 组件（SSE 实时日志）
- [ ] 实现 `useCaseEvents` SSE Hook

### Phase 3：审核中心模块（1.5 周）

- [ ] 实现审核中心页面（`usePendingReviews`）
- [ ] 实现 `ReviewPanel` 组件（决策表单）
- [ ] 实现 `FindingCard` 和 `FindingsList` 组件
- [ ] 实现 `PatchViewer` 组件（react-diff-viewer-continued 集成）
- [ ] 实现行内 finding 高亮与悬浮提示
- [ ] 实现浏览器通知（`requestNotificationPermission` + `sendBrowserNotification`）
- [ ] 实现全局 Toast 通知（Sonner）

### Phase 4：产物展示模块（1 周）

- [ ] 实现探索结果展示（`ExplorationResultCard` + `EvidenceList`）
- [ ] 实现规划方案展示（`ExecutionPlanCard` + `DevPlanSteps` + `TestPlanCases`）
- [ ] 实现开发-审核迭代时间线（`IterationTimeline`）
- [ ] 实现测试结果展示（`TestResultSummary` + `TestLogViewer`）
- [ ] 实现审计日志时间线（`AuditTimeline`）

### Phase 5：系统监控与知识库（1 周）

- [ ] 实现系统监控页（`SystemHealthCards` + Tremor 图表）
- [ ] 实现成本/Token 消耗图表
- [ ] 实现 Agent 性能图表
- [ ] 实现知识库搜索页（`KnowledgeSearch` + `KnowledgeResultCard`）

### Phase 6：集成与部署（0.5 周）

- [ ] 与后端 FastAPI 联调（端到端测试）
- [ ] 编写 `Dockerfile` 和更新 `docker-compose.yml`
- [ ] 编写 Nginx 反向代理配置
- [ ] 编写前端 README（环境变量、构建命令、开发流程）
- [ ] 代码审查（code-reviewer agent）

**总计预估工时：~6.5 周**

---

## 附录 A：前端与后端的版本同步策略

| 场景 | 同步方式 | 负责人 |
|------|---------|--------|
| 后端新增 API | 前端同步新增 Hook 和类型 | 前端开发者 |
| 后端 Pydantic 模型变更 | 运行 `types:sync` 脚本或手动更新 | 前端开发者 |
| 后端状态机新增状态 | 同步更新 `PIPELINE_PHASES` 和状态样式映射 | 前端开发者 |
| 前端需要新 API | 在后端设计文档中提交 API 设计，双方确认后实现 | 前后端共同 |

## 附录 B：性能预算

| 指标 | 目标值 | 测量方式 |
|------|--------|---------|
| 首屏加载时间 (FCP) | < 1.5s | Lighthouse |
| 可交互时间 (TTI) | < 3s | Lighthouse |
| 案例列表首屏渲染 | < 500ms | React Profiler |
| SSE 延迟（事件产生到 UI 更新） | < 100ms | 自定义打点 |
| 构建产物大小 | < 500KB (gzip) | `next build` 输出 |
| 运行时内存占用 | < 50MB | Chrome DevTools |

## 附录 C：浏览器兼容性

| 浏览器 | 最低版本 | 说明 |
|--------|---------|------|
| Chrome | 120+ | 完全支持 |
| Firefox | 121+ | 完全支持 |
| Safari | 17+ | 完全支持（SSE 和 CSS Container Queries） |
| Edge | 120+ | 完全支持 |
