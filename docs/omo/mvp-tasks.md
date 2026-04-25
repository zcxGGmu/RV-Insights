# RV-Insights MVP 阶段任务清单

> 目标：构建 AI 驱动的多 Agent 平台，面向 RISC-V 开源贡献场景。
> 参考项目：ScienceClaw（Vue 3 + Vite + TailwindCSS 前端，FastAPI + LangGraph 后端，MongoDB）
> 预计周期：6 个 Sprint（每 Sprint 1 周），共 6 周

---

## 开发策略

### 前后端并行开发

前后端并行推进，通过 API 契约解耦，最大化开发效率。

**为什么并行？**

1. 前端可大量复用 ScienceClaw 组件（100+ .vue 文件），改造工作量可预估
2. 后端需要从零搭建，但遵循 ScienceClaw 已验证的模式（FastAPI + Motor + SSE queue）
3. 两端依赖的唯一交集是 API 接口，契约先行即可解耦

**怎么并行？**

1. **API 契约先行**：Sprint 0 定义完整 OpenAPI schema，前后端共同评审确认
2. **前端 Mock 驱动**：前端基于 OpenAPI schema 构建 Mock API 层，不依赖后端即可开发全部 UI
3. **后端按 Schema 实现**：后端严格按 OpenAPI schema 实现端点，保证接口一致性
4. **联调窗口**：Sprint 3 开始联调，前端移除 Mock 接入真实后端

**联调时间点**

| Sprint | 前端 | 后端 | 联调状态 |
|--------|------|------|----------|
| 0 | 脚手架 + 配置复制 | 项目骨架 + 基础设施 | 无需联调 |
| 1 | 认证 UI + 案例列表（Mock） | 认证 + 数据层 | 无需联调 |
| 2 | 案例详情 + Pipeline UI（Mock） | Pipeline 引擎 + SSE | 无需联调 |
| 3 | 移除 Mock，接入真实 API | Explorer Agent | **首次联调** |
| 4 | Planner/Developer UI | Planner + Developer Agent | 持续联调 |
| 5-6 | Review/Test UI + 收尾 | Review + Test Agent | 全面联调 |

### 从 ScienceClaw 复用清单

**前端复用（直接复制 + 适配）：**
- `api/client.ts`：SSE + axios 封装，改 baseURL 即可
- `composables/useAuth.ts`：JWT 认证逻辑，几乎无需改动
- `composables/useTheme.ts`：主题切换，直接复用
- `composables/useI18n.ts`：国际化框架，直接复用
- `components/ui/*`：shadcn-vue 原语（dialog, popover, select, toast 等），直接复用
- `components/login/*`：登录/注册表单，微调字段即可
- `components/LeftPanel.vue`：适配为 CaseListPanel（session → case）
- `components/ChatMessage.vue`：适配为 AgentEventLog（聊天消息 → Agent 事件）
- `components/MarkdownEnhancements.vue`：代码高亮 + mermaid，直接复用
- `components/settings/*`：设置页面，直接复用
- `assets/theme.css` + `global.css`：样式基础，直接复用
- `locales/*`：国际化文件，扩展 RV-Insights 专有词条

**后端模式复用（参考实现，重新编写）：**
- SSE queue-based streaming 模式
- Motor MongoDB 异步操作模式
- JWT auth with refresh token 模式
- FastAPI lifespan hooks 模式

---

## Sprint 划分

### Sprint 0：项目初始化（Day 1-2）

> 目标：搭建完整开发环境，所有服务可启动，API 契约定义完成。
> 验收标准：`docker compose up` 全部服务健康，OpenAPI schema 文件可访问。

#### 后端初始化

- [ ] 初始化 monorepo 结构（`backend/` + `web-console/` + `docker-compose.yml`）`~1h`
  - 依赖：无
  - 产出：目录结构 + .gitignore + pyproject.toml + package.json
- [ ] 后端：FastAPI 项目骨架（main.py, config.py, Dockerfile）`~2h`
  - 依赖：monorepo 结构
  - 产出：可启动的 FastAPI 服务，`/health` 端点返回 200
- [ ] 后端：MongoDB + Motor 连接 + 健康检查 `~1.5h`
  - 依赖：FastAPI 骨架
  - 产出：`/health` 包含 MongoDB 连接状态
- [ ] 后端：PostgreSQL + LangGraph AsyncPostgresSaver 连接 `~2h`
  - 依赖：FastAPI 骨架
  - 产出：LangGraph checkpointer 初始化成功，`/health` 包含 PG 状态
- [ ] 后端：Redis 连接 `~1h`
  - 依赖：FastAPI 骨架
  - 产出：Redis ping 成功，`/health` 包含 Redis 状态

#### 前端初始化

- [ ] 前端：从 ScienceClaw 复制 Vite + TailwindCSS + TypeScript 配置 `~1h`
  - 依赖：monorepo 结构
  - 产出：`npm run dev` 可启动空白页面
- [ ] 前端：复制 shadcn-vue UI 原语（dialog, popover, select, toast 等）`~1h`
  - 依赖：Vite 配置
  - 产出：UI 组件可正常渲染
- [ ] 前端：复制 theme.css + global.css `~0.5h`
  - 依赖：Vite 配置
  - 产出：主题样式生效
- [ ] 前端：复制 api/client.ts（SSE + axios 封装）`~1h`
  - 依赖：Vite 配置
  - 产出：修改 baseURL，axios 实例可用

#### 基础设施

- [ ] Docker Compose：5 服务（nginx, backend, mongodb, postgres, redis）`~3h`
  - 依赖：后端 Dockerfile + 前端构建
  - 产出：`docker compose up -d` 全部容器 healthy
- [ ] 定义 API 契约：OpenAPI schema for all MVP endpoints `~4h`
  - 依赖：无（可与其他任务并行）
  - 产出：`docs/openapi.yaml`，覆盖认证、案例 CRUD、Pipeline 控制、SSE 事件
- [ ] 验收：docker compose up 全部服务健康 `~1h`
  - 依赖：以上全部
  - 验证：5 个容器全部 healthy，`/health` 返回所有依赖状态 OK

**Sprint 0 工时估算：~19h（2 人并行约 1.5 天）**

---

### Sprint 1：认证 + 数据层（Week 1）

> 目标：完成用户认证体系和案例数据层，前端完成认证 UI 和案例列表。
> 验收标准：curl 测试所有 CRUD 端点通过；前端登录后可看到案例列表（Mock 数据）。

#### 后端任务

- [ ] 后端：User 模型 + MongoDB 集合 + 索引 `~2h`
  - 依赖：Sprint 0 MongoDB 连接
  - 产出：User 集合，email 唯一索引，created_at 索引
- [ ] 后端：JWT 认证（login/register/refresh/logout）`~4h`
  - 依赖：User 模型
  - 产出：4 个认证端点，access_token + refresh_token 双 token 机制
- [ ] 后端：RBAC 中间件（admin/reviewer/viewer）`~2h`
  - 依赖：JWT 认证
  - 产出：`require_role()` 依赖注入，角色校验装饰器
- [ ] 后端：Case 模型 + CRUD API（create/list/get/delete）`~4h`
  - 依赖：JWT 认证 + MongoDB 连接
  - 产出：Case 集合，4 个 CRUD 端点，分页 + 过滤
- [ ] 后端：Case 状态机枚举（CaseStatus）`~1h`
  - 依赖：Case 模型
  - 产出：`CaseStatus` 枚举（draft, exploring, planning, developing, reviewing, testing, completed, failed, abandoned）
- [ ] 后端：Pydantic 数据契约 `~3h`
  - 依赖：OpenAPI schema
  - 产出：ExplorationResult, ExecutionPlan, DevelopmentResult, ReviewVerdict, TestResult 五个核心模型
- [ ] 后端：ArtifactManager（产物存储）`~2h`
  - 依赖：Case 模型 + MongoDB
  - 产出：产物 CRUD，支持按 case_id + stage 查询
- [ ] 验收：curl 测试所有 CRUD 端点 `~1h`
  - 依赖：以上全部
  - 验证：注册 → 登录 → 创建案例 → 列表 → 详情 → 删除，全部 200/201

**后端工时估算：~19h**

#### 前端任务（并行）

- [ ] 前端：复制并适配 LoginPage + LoginForm + RegisterForm `~2h`
  - 依赖：Sprint 0 前端配置
  - 产出：登录/注册页面可渲染，表单校验正常
- [ ] 前端：复制并适配 useAuth composable `~1.5h`
  - 依赖：api/client.ts
  - 产出：login/register/logout/refreshToken 方法，token 持久化
- [ ] 前端：路由配置（/, /login, /cases, /cases/:id）`~1h`
  - 依赖：useAuth
  - 产出：vue-router 配置，未登录重定向 /login，登录后重定向 /cases
- [ ] 前端：复制并适配 MainLayout（LeftPanel → CaseListPanel）`~2h`
  - 依赖：路由配置
  - 产出：左侧面板 + 右侧内容区的主布局
- [ ] 前端：CaseListPanel 组件（从 LeftPanel 适配，session → case）`~3h`
  - 依赖：MainLayout
  - 产出：案例列表，支持搜索/过滤/排序，状态标签
- [ ] 前端：CaseItem 组件（从 SessionItem 适配）`~1.5h`
  - 依赖：CaseListPanel
  - 产出：单个案例卡片，显示标题/状态/时间/仓库
- [ ] 前端：Mock API 层（返回假数据，匹配 OpenAPI schema）`~3h`
  - 依赖：OpenAPI schema + api/client.ts
  - 产出：所有 MVP 端点的 Mock 实现，可通过环境变量切换 Mock/Real
- [ ] 验收：登录 → 看到案例列表（Mock 数据）`~1h`
  - 依赖：以上全部
  - 验证：登录流程完整，案例列表渲染 Mock 数据，路由跳转正常

**前端工时估算：~15h**

---

### Sprint 2：Pipeline 引擎 + 案例详情页（Week 2）

> 目标：后端完成 LangGraph Pipeline 引擎和 SSE 事件流；前端完成案例详情页和 Pipeline 可视化。
> 验收标准：启动 Pipeline → SSE 收到 stage_change 事件 → 提交审核 → Pipeline 前进；前端案例详情页显示 Pipeline 状态（Mock 数据）。

#### 后端任务

- [ ] 后端：PipelineState Pydantic 模型 `~2h`
  - 依赖：Sprint 1 数据契约
  - 产出：完整的 Pipeline 状态模型，包含 current_stage, iteration_count, artifacts, cost_tracker
- [ ] 后端：LangGraph StateGraph 骨架（5 节点 + 条件边）`~4h`
  - 依赖：PipelineState + PostgresSaver
  - 产出：StateGraph 定义，5 个 stub 节点，条件边路由逻辑
- [ ] 后端：human_gate_node（interrupt() 实现）`~2h`
  - 依赖：StateGraph 骨架
  - 产出：Pipeline 在 human gate 暂停，等待外部 resume
- [ ] 后端：route_human_decision 路由函数 `~1.5h`
  - 依赖：human_gate_node
  - 产出：根据 approve/reject/abandon 决策路由到下一节点或终止
- [ ] 后端：route_review_decision 路由函数（加权收敛检测）`~2h`
  - 依赖：StateGraph 骨架
  - 产出：Review 通过 → Test，驳回 → Develop（带迭代计数），超限 → escalate
- [ ] 后端：POST /cases/:id/start 端点（启动 Pipeline）`~2h`
  - 依赖：StateGraph + Case CRUD
  - 产出：创建 LangGraph thread，异步启动 Pipeline，返回 thread_id
- [ ] 后端：POST /cases/:id/review 端点（幂等审核提交）`~2h`
  - 依赖：human_gate_node
  - 产出：幂等审核提交，resume Pipeline，防重复提交
- [ ] 后端：EventPublisher（Redis Pub/Sub）`~2h`
  - 依赖：Redis 连接
  - 产出：publish_event() 方法，事件序列化 + channel 管理
- [ ] 后端：GET /cases/:id/events SSE 端点（Redis 订阅 + Stream 重连）`~3h`
  - 依赖：EventPublisher + Redis
  - 产出：SSE 端点，支持 Last-Event-ID 重连，心跳保活
- [ ] 后端：CostCircuitBreaker `~1.5h`
  - 依赖：PipelineState
  - 产出：按 case 级别的成本熔断，超阈值自动暂停 Pipeline
- [ ] 验收：启动 Pipeline → SSE 收到事件 → 审核 → Pipeline 前进 `~1h`
  - 依赖：以上全部
  - 验证：curl 启动 Pipeline，wscat 监听 SSE，提交审核，观察状态流转

**后端工时估算：~23h**

#### 前端任务（并行）

- [ ] 前端：CaseDetailView 页面骨架（三栏布局）`~3h`
  - 依赖：Sprint 1 路由配置
  - 产出：左栏（Pipeline 视图）+ 中栏（Agent 事件日志）+ 右栏（产物/审核面板）
- [ ] 前端：PipelineView 组件（5 阶段流水线可视化）`~4h`
  - 依赖：CaseDetailView
  - 产出：垂直/水平流水线图，阶段间连线，当前阶段高亮
- [ ] 前端：StageNode 组件（单阶段节点）`~2h`
  - 依赖：PipelineView
  - 产出：状态图标 + 阶段名称 + 耗时 + 进度指示
- [ ] 前端：HumanGate 组件（审核门禁节点）`~2h`
  - 依赖：PipelineView
  - 产出：门禁节点特殊样式，等待审核时脉冲动画
- [ ] 前端：ReviewPanel 组件（审核决策面板）`~3h`
  - 依赖：CaseDetailView
  - 产出：approve/reject/abandon 三按钮，reject 需填写原因，确认弹窗
- [ ] 前端：useCaseEvents composable（SSE 事件流管理）`~3h`
  - 依赖：api/client.ts
  - 产出：SSE 连接管理，Last-Event-ID 重连，事件分发，自动重连
- [ ] 前端：usePipeline composable（Pipeline 状态追踪）`~2h`
  - 依赖：useCaseEvents
  - 产出：从事件流提取 Pipeline 状态，阶段转换动画触发
- [ ] 前端：Pinia caseStore（案例状态管理）`~2h`
  - 依赖：usePipeline + useCaseEvents
  - 产出：案例详情 + Pipeline 状态 + 事件列表的集中管理
- [ ] 前端：类型定义（case.ts, pipeline.ts, event.ts）`~1.5h`
  - 依赖：OpenAPI schema
  - 产出：TypeScript 类型定义，与 OpenAPI schema 一致
- [ ] 验收：案例详情页显示 Pipeline 状态（Mock 数据）`~1h`
  - 依赖：以上全部
  - 验证：点击案例 → 详情页渲染 → Pipeline 可视化 → Mock 事件流播放

**前端工时估算：~23.5h**

---

### Sprint 3：Explorer Agent + 前后端联调（Week 3）

> 目标：后端完成 Explorer Agent，前端移除 Mock 接入真实后端，首次端到端联调。
> 验收标准：启动 Pipeline → Explorer 运行 → 输出 ExplorationResult → 暂停等待审核；前端实时显示 Agent 执行过程。

#### 后端任务

- [ ] 后端：ClaudeAgentAdapter（子进程模型 + 超时 + 取消）`~4h`
  - 依赖：Sprint 2 EventPublisher
  - 产出：Claude SDK 封装，支持超时中断、graceful cancel、事件回调
- [ ] 后端：Explorer Agent System Prompt `~3h`
  - 依赖：Pydantic 数据契约（ExplorationResult）
  - 产出：System prompt 文件，定义探索目标、输出格式、工具使用规范
- [ ] 后端：explore_node 实现（Claude SDK query）`~4h`
  - 依赖：ClaudeAgentAdapter + Explorer Prompt
  - 产出：LangGraph explore 节点，调用 Claude Agent，解析输出到 ExplorationResult
- [ ] 后端：verify_exploration_claims（幻觉验证）`~3h`
  - 依赖：explore_node + PatchworkClient
  - 产出：对 Explorer 输出的关键声明进行事实核查（文件存在性、代码引用准确性）
- [ ] 后端：parse_agent_output（结构化输出解析 + 重试）`~2h`
  - 依赖：explore_node
  - 产出：三层解析策略（JSON 直接解析 → 正则提取 → LLM 修复），最多重试 2 次
- [ ] 后端：PatchworkClient（Patchwork API 集成）`~3h`
  - 依赖：config.py
  - 产出：Patchwork API 客户端，支持仓库搜索、文件读取、commit 历史查询
- [ ] 后端：explore_node 内事件发布（stage_change, agent_output）`~2h`
  - 依赖：explore_node + EventPublisher
  - 产出：Explorer 执行过程中实时发布事件（thinking, tool_call, tool_result, output）
- [ ] 验收：启动 Pipeline → Explorer 运行 → 输出结果 → 暂停审核 `~2h`
  - 依赖：以上全部
  - 验证：完整 Explorer 阶段执行，ExplorationResult 存入 MongoDB，SSE 事件完整

**后端工时估算：~23h**

#### 前端任务（联调开始）

- [ ] 前端：移除 Mock API，接入真实后端 `~2h`
  - 依赖：后端 Sprint 1-2 端点就绪
  - 产出：环境变量切换到真实 API，所有请求走真实后端
- [ ] 前端：AgentEventLog 组件（从 ChatMessage 适配，实时事件日志）`~4h`
  - 依赖：useCaseEvents + CaseDetailView
  - 产出：实时事件流展示，支持 thinking/tool_call/output 三种事件类型
- [ ] 前端：ThinkingBlock 组件（Agent 思考过程，可折叠）`~2h`
  - 依赖：AgentEventLog
  - 产出：可折叠的思考过程块，默认折叠，点击展开
- [ ] 前端：ToolCallView 组件（工具调用可视化）`~2.5h`
  - 依赖：AgentEventLog
  - 产出：工具名称 + 参数 + 结果的结构化展示，代码块语法高亮
- [ ] 前端：ContributionCard 组件（探索结果展示）`~3h`
  - 依赖：CaseDetailView
  - 产出：贡献机会卡片，显示标题/类型/置信度/影响范围/证据摘要
- [ ] 前端：EvidenceChain 组件（证据链展示）`~2h`
  - 依赖：ContributionCard
  - 产出：证据链可视化，每条证据可展开查看详情
- [ ] 前端：复制并适配 MarkdownEnhancements（代码高亮 + mermaid）`~1.5h`
  - 依赖：Sprint 0 前端配置
  - 产出：Markdown 渲染增强，支持代码高亮和 mermaid 图表
- [ ] 联调：登录 → 创建案例 → 启动 Pipeline → 实时看到 Explorer 执行 → 审核 `~3h`
  - 依赖：前后端全部就绪
  - 验证：完整用户流程，SSE 事件实时渲染，审核操作生效
- [ ] 验收：端到端 Explorer 阶段可用 `~1h`
  - 依赖：联调通过
  - 验证：无 console 错误，事件不丢失，审核后 Pipeline 状态正确更新

**前端工时估算：~21h**

---

### Sprint 4：Planner + Developer Agent（Week 4）

> 目标：完成 Planner 和 Developer Agent，实现 3 阶段 MVP Pipeline 端到端。
> 验收标准：Explore → 审核通过 → Plan → 审核通过 → Develop → 输出补丁文件。

#### 后端任务

- [ ] 后端：OpenAIAgentAdapter `~3h`
  - 依赖：ClaudeAgentAdapter（参考实现）
  - 产出：OpenAI Agents SDK 封装，支持 Handoff + Guardrails + 事件回调
- [ ] 后端：Planner Agent（OpenAI SDK, Handoff + Guardrails）`~4h`
  - 依赖：OpenAIAgentAdapter + ExplorationResult
  - 产出：Planner Agent 定义，含 System Prompt、Guardrails（范围检查、可行性检查）
- [ ] 后端：plan_node 实现 `~3h`
  - 依赖：Planner Agent + StateGraph
  - 产出：LangGraph plan 节点，输出 ExecutionPlan，含任务分解 + 依赖关系 + 风险评估
- [ ] 后端：Developer Agent System Prompt `~3h`
  - 依赖：ExecutionPlan 数据契约
  - 产出：System prompt，定义开发规范、工具使用（Write/Edit/Bash）、输出格式
- [ ] 后端：develop_node 实现（Claude SDK, Write/Edit/Bash）`~5h`
  - 依赖：ClaudeAgentAdapter + Developer Prompt
  - 产出：LangGraph develop 节点，执行开发任务，输出 DevelopmentResult + 补丁文件
- [ ] 后端：develop_node 内事件发布 `~1.5h`
  - 依赖：develop_node + EventPublisher
  - 产出：开发过程实时事件（file_edit, bash_exec, thinking, output）
- [ ] 验收：Explore → Plan → Develop 全流程 `~2h`
  - 依赖：以上全部
  - 验证：3 阶段顺序执行，每阶段产物正确存储，审核门禁正常工作

**后端工时估算：~21.5h**

#### 前端任务

- [ ] 前端：ExecutionPlanView 组件（开发方案树形展示）`~4h`
  - 依赖：CaseDetailView
  - 产出：树形任务列表，显示任务名/优先级/预估时间/依赖关系，可展开子任务
- [ ] 前端：DiffViewer 组件（Monaco Editor unified diff）`~5h`
  - 依赖：CaseDetailView
  - 产出：基于 Monaco Editor 的 diff 查看器，支持 unified/side-by-side 切换
- [ ] 前端：补丁文件查看器（从 FileToolView 适配）`~2h`
  - 依赖：DiffViewer
  - 产出：补丁文件列表 + 单文件 diff 展示，支持文件树导航
- [ ] 前端：迭代轮次标记（IterationBadge）`~1h`
  - 依赖：PipelineView
  - 产出：当前迭代轮次徽章，显示在 Pipeline 视图和详情页
- [ ] 前端：成本统计显示（CostSummary）`~2h`
  - 依赖：caseStore
  - 产出：按阶段/按模型的 token 用量和成本统计，实时更新
- [ ] 联调：完整 3 阶段 Pipeline 端到端 `~3h`
  - 依赖：前后端全部就绪
  - 验证：Explore → Plan → Develop 全流程，UI 实时更新，产物正确展示
- [ ] 验收：Explore → Plan → Develop 全流程可用 `~1h`
  - 依赖：联调通过
  - 验证：3 阶段 MVP 功能完整，无阻塞性 bug

**前端工时估算：~18h**

---

### Sprint 5：Review + Test Agent + 迭代循环（Week 5）

> 目标：完成 Review 和 Test Agent，实现 Develop ↔ Review 迭代循环，达成完整 5 阶段 Pipeline。
> 验收标准：Develop → Review → 驳回 → 修复 → Review → 通过 → Test；迭代循环正常收敛。

#### 后端任务

- [ ] 后端：Reviewer Agent（Codex + Handoff 三子 Agent）`~5h`
  - 依赖：OpenAIAgentAdapter
  - 产出：Reviewer 主 Agent + 三个子 Agent（style_checker, logic_reviewer, security_auditor），Handoff 协调
- [ ] 后端：review_node 实现（确定性工具 + LLM 双轨）`~4h`
  - 依赖：Reviewer Agent + StateGraph
  - 产出：先跑确定性检查（checkpatch.pl），再跑 LLM 审核，合并结果到 ReviewVerdict
- [ ] 后端：run_deterministic_checks（checkpatch.pl 集成）`~3h`
  - 依赖：review_node
  - 产出：checkpatch.pl 子进程调用，输出解析为结构化 findings
- [ ] 后端：Develop ↔ Review 迭代循环（条件边 + 收敛检测）`~3h`
  - 依赖：review_node + develop_node + route_review_decision
  - 产出：Review 驳回 → 回到 Develop（携带 findings），最多 3 轮迭代，超限升级
- [ ] 后端：escalate_node（升级人工处理）`~1.5h`
  - 依赖：迭代循环
  - 产出：迭代超限时暂停 Pipeline，通知人工介入，记录升级原因
- [ ] 后端：Tester Agent System Prompt `~2h`
  - 依赖：DevelopmentResult 数据契约
  - 产出：System prompt，定义测试策略（编译验证为主，MVP 不含 QEMU）
- [ ] 后端：test_node 实现（编译验证）`~3h`
  - 依赖：ClaudeAgentAdapter + Tester Prompt
  - 产出：LangGraph test 节点，执行编译验证，输出 TestResult
- [ ] 验收：Develop → Review → 驳回 → 修复 → Review → 通过 → Test `~2h`
  - 依赖：以上全部
  - 验证：迭代循环正常工作，收敛检测准确，Test 阶段输出正确

**后端工时估算：~23.5h**

#### 前端任务

- [ ] 前端：ReviewFindingsView 组件（审核发现列表）`~3h`
  - 依赖：CaseDetailView
  - 产出：按严重级别分组的 findings 列表，每条 finding 显示类型/位置/描述/建议
- [ ] 前端：DiffViewer 行内 finding 高亮 `~3h`
  - 依赖：DiffViewer + ReviewFindingsView
  - 产出：在 diff 视图中，对应行高亮显示 finding，hover 显示详情
- [ ] 前端：TestResultSummary 组件 `~2h`
  - 依赖：CaseDetailView
  - 产出：测试结果摘要卡片，显示通过/失败/跳过数量，编译状态
- [ ] 前端：TestLogViewer 组件 `~2h`
  - 依赖：TestResultSummary
  - 产出：测试日志查看器，支持 ANSI 颜色渲染，可搜索/过滤
- [ ] 前端：迭代历史时间线 `~3h`
  - 依赖：usePipeline + caseStore
  - 产出：时间线组件，展示每轮迭代的 Develop → Review 过程，可点击查看历史产物
- [ ] 联调：完整 5 阶段 Pipeline `~3h`
  - 依赖：前后端全部就绪
  - 验证：5 阶段顺序执行 + 迭代循环 + 所有 UI 组件正确渲染
- [ ] 验收：端到端 5 阶段 + 迭代循环可用 `~1h`
  - 依赖：联调通过
  - 验证：完整 Pipeline 功能，迭代历史可追溯，无阻塞性 bug

**前端工时估算：~17h**

---

### Sprint 6：集成测试 + 部署 + 收尾（Week 6）

> 目标：补充测试覆盖，完善错误处理，优化部署配置，产出可交付版本。
> 验收标准：`docker compose up` → 完整功能可用，测试通过，文档完善。

#### 后端测试

- [ ] 后端：单元测试 - route functions `~3h`
  - 依赖：Sprint 2-5 所有 route functions
  - 产出：route_human_decision, route_review_decision 的参数化测试
- [ ] 后端：单元测试 - data contracts `~2h`
  - 依赖：Sprint 1 Pydantic 模型
  - 产出：所有 Pydantic 模型的序列化/反序列化/校验测试
- [ ] 后端：单元测试 - adapters `~2h`
  - 依赖：Sprint 3-4 Agent Adapters
  - 产出：ClaudeAgentAdapter, OpenAIAgentAdapter 的 mock 测试
- [ ] 后端：集成测试 - Pipeline flow with testcontainers `~5h`
  - 依赖：完整 Pipeline
  - 产出：使用 testcontainers 的端到端 Pipeline 测试，覆盖正常流程 + 迭代 + 升级

#### 前端收尾

- [ ] 前端：错误处理完善（useErrorHandler）`~3h`
  - 依赖：所有前端组件
  - 产出：全局错误处理 composable，API 错误 toast，SSE 断连提示，网络异常重试
- [ ] 前端：响应式适配（Tablet/Mobile 基础支持）`~3h`
  - 依赖：所有前端页面
  - 产出：Tablet 下三栏变两栏，Mobile 下单栏 + 底部导航
- [ ] 前端：国际化（中英文）`~2h`
  - 依赖：locales 文件
  - 产出：所有 UI 文案中英文双语，语言切换功能

#### 部署与文档

- [ ] Docker Compose 生产配置优化 `~2h`
  - 依赖：Sprint 0 Docker Compose
  - 产出：资源限制、日志配置、健康检查间隔、重启策略
- [ ] Nginx SSE 配置验证 `~1h`
  - 依赖：Docker Compose
  - 产出：proxy_buffering off, chunked_transfer_encoding on, 超时配置
- [ ] 端到端冒烟测试 `~3h`
  - 依赖：全部功能
  - 产出：创建案例 → 完整 Pipeline → 生成补丁的自动化脚本
- [ ] README + 部署文档 `~2h`
  - 依赖：全部功能
  - 产出：README.md（项目介绍 + 快速开始），DEPLOY.md（部署指南）
- [ ] 验收：docker compose up → 完整功能可用 `~2h`
  - 依赖：以上全部
  - 验证：全新环境 docker compose up，冒烟测试通过，文档准确

**Sprint 6 工时估算：~30h**

---

## 工时汇总

| Sprint | 后端 | 前端 | 合计 |
|--------|------|------|------|
| Sprint 0 | ~10h | ~3.5h | ~19h（含基础设施 5.5h） |
| Sprint 1 | ~19h | ~15h | ~34h |
| Sprint 2 | ~23h | ~23.5h | ~46.5h |
| Sprint 3 | ~23h | ~21h | ~44h |
| Sprint 4 | ~21.5h | ~18h | ~39.5h |
| Sprint 5 | ~23.5h | ~17h | ~40.5h |
| Sprint 6 | ~12h | ~8h | ~30h（含部署 10h） |
| **总计** | **~132h** | **~106h** | **~253.5h** |

> 按每人每周 35h 有效工时计算，2 人团队（1 后端 + 1 前端）约 4 周可完成。
> 考虑联调、bug 修复等不可预见开销，预留 50% buffer，实际约 6 周。

---

## 关键里程碑

| 里程碑 | 时间 | 交付物 | 验收标准 |
|--------|------|--------|----------|
| M0 | Sprint 0 末 | 项目骨架 + Docker 环境 + API 契约 | `docker compose up` 全绿，OpenAPI schema 可访问 |
| M1 | Sprint 2 末 | Pipeline 引擎 + 案例 UI | SSE 事件流通，审核操作可用，Pipeline 状态可视化 |
| M2 | Sprint 4 末 | 3 阶段 MVP | Explore → Plan → Develop 端到端，补丁文件可查看 |
| M3 | Sprint 5 末 | 5 阶段完整版 | 含 Review 迭代循环 + Test，收敛检测正常 |
| M4 | Sprint 6 末 | 可部署版本 | 测试通过，冒烟测试绿灯，文档完善 |

### 里程碑依赖关系

```
M0 ──→ M1 ──→ M2 ──→ M3 ──→ M4
 │      │      │      │
 │      │      │      └─ Review/Test Agent 依赖 M2 的 Agent 基础设施
 │      │      └─ Explorer/Planner/Developer 依赖 M1 的 Pipeline 引擎
 │      └─ Pipeline 引擎依赖 M0 的基础设施（LangGraph + Redis + SSE）
 └─ 所有后续工作依赖 M0 的项目骨架和 API 契约
```

---

## 风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| Claude Agent SDK Beta 不稳定 | 高 | 中 | Sprint 3 优先验证 SDK 可用性，准备降级方案：直接调用 Claude API + 手动工具循环 |
| SSE 事件丢失 | 中 | 中 | Sprint 2 实现 Redis Stream + Last-Event-ID 重连机制，事件持久化到 MongoDB 作为兜底 |
| LLM 输出格式不稳定 | 中 | 高 | Sprint 3 实现 parse_agent_output 三层解析（JSON → 正则 → LLM 修复），加 structured output 约束 |
| QEMU 测试环境复杂 | 低 | 高 | MVP 仅做编译验证，QEMU 运行时测试推迟到 Phase 2 |
| LangGraph interrupt/resume 边界情况 | 中 | 中 | Sprint 2 编写充分的 Pipeline 状态机测试，覆盖异常路径（超时、取消、重复提交） |
| 前后端联调接口不一致 | 中 | 低 | API 契约先行 + OpenAPI schema 自动校验，前端 Mock 严格匹配 schema |
| MongoDB 查询性能（大量事件） | 低 | 低 | 事件主要走 Redis Stream，MongoDB 仅做持久化归档，按 case_id 分片 |

---

## 每日站会检查点

每个 Sprint 按 Day 1-2 / Day 3-4 / Day 5 的节奏推进。

### Sprint 0（Day 1-2）

| 天 | 后端 | 前端 | 检查点 |
|----|------|------|--------|
| Day 1 | monorepo + FastAPI 骨架 + MongoDB/PG/Redis 连接 | Vite 配置 + shadcn-vue + 样式复制 | 后端 `/health` 返回 200 |
| Day 2 | Docker Compose + API 契约定义 | api/client.ts 复制 + 验收 | `docker compose up` 全绿 |

### Sprint 1（Week 1）

| 天 | 后端 | 前端 | 检查点 |
|----|------|------|--------|
| Day 1-2 | User 模型 + JWT 认证 + RBAC | LoginPage + useAuth + 路由 | 后端认证端点可用 |
| Day 3-4 | Case CRUD + 状态机 + 数据契约 | MainLayout + CaseListPanel + CaseItem | Case CRUD curl 测试通过 |
| Day 5 | ArtifactManager + 验收 | Mock API 层 + 验收 | 前后端各自验收通过 |

### Sprint 2（Week 2）

| 天 | 后端 | 前端 | 检查点 |
|----|------|------|--------|
| Day 1-2 | PipelineState + StateGraph + human_gate | CaseDetailView + PipelineView + StageNode | StateGraph 可编译运行 |
| Day 3-4 | 路由函数 + start/review 端点 + EventPublisher | HumanGate + ReviewPanel + useCaseEvents | SSE 端点可连接 |
| Day 5 | SSE 端点 + CostBreaker + 验收 | usePipeline + caseStore + 类型定义 + 验收 | Pipeline 启动 → 事件 → 审核 |

### Sprint 3（Week 3）

| 天 | 后端 | 前端 | 检查点 |
|----|------|------|--------|
| Day 1-2 | ClaudeAdapter + Explorer Prompt + explore_node | 移除 Mock + AgentEventLog + ThinkingBlock | Explorer 可独立运行 |
| Day 3-4 | 幻觉验证 + 输出解析 + PatchworkClient | ToolCallView + ContributionCard + EvidenceChain | Explorer 输出结构化结果 |
| Day 5 | 事件发布 + 验收 | MarkdownEnhancements + 联调 + 验收 | **首次端到端联调通过** |

### Sprint 4（Week 4）

| 天 | 后端 | 前端 | 检查点 |
|----|------|------|--------|
| Day 1-2 | OpenAIAdapter + Planner Agent + plan_node | ExecutionPlanView + DiffViewer | Planner 可独立运行 |
| Day 3-4 | Developer Prompt + develop_node + 事件发布 | 补丁查看器 + IterationBadge + CostSummary | Developer 输出补丁 |
| Day 5 | 验收 | 联调 + 验收 | **3 阶段 MVP 端到端** |

### Sprint 5（Week 5）

| 天 | 后端 | 前端 | 检查点 |
|----|------|------|--------|
| Day 1-2 | Reviewer Agent + review_node + checkpatch | ReviewFindingsView + DiffViewer 行内高亮 | Review 可独立运行 |
| Day 3-4 | 迭代循环 + escalate + Tester + test_node | TestResultSummary + TestLogViewer + 迭代时间线 | 迭代循环正常收敛 |
| Day 5 | 验收 | 联调 + 验收 | **5 阶段完整 Pipeline** |

### Sprint 6（Week 6）

| 天 | 后端 | 前端 | 检查点 |
|----|------|------|--------|
| Day 1-2 | 单元测试（routes + contracts + adapters） | 错误处理 + 响应式适配 | 测试覆盖率达标 |
| Day 3-4 | 集成测试（testcontainers） | 国际化 | 集成测试通过 |
| Day 5 | Docker 优化 + Nginx SSE + 冒烟测试 + 文档 | 冒烟测试配合 + 文档 | **可部署版本交付** |

---

## 技术决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| Pipeline 引擎 | LangGraph + AsyncPostgresSaver | 原生支持 interrupt/resume，checkpoint 持久化，条件边路由 |
| 事件流 | Redis Pub/Sub + SSE | 低延迟推送，Last-Event-ID 支持重连，ScienceClaw 已验证此模式 |
| Agent 框架 | Claude SDK + OpenAI Agents SDK 混用 | Explorer/Developer 用 Claude（代码能力强），Planner/Reviewer 用 OpenAI（Handoff + Guardrails） |
| 前端框架 | Vue 3 + Vite + TailwindCSS | 与 ScienceClaw 一致，最大化组件复用 |
| 数据库 | MongoDB（业务数据）+ PostgreSQL（LangGraph checkpoint） | MongoDB 灵活 schema 适合 Agent 产物，PG 是 LangGraph 官方推荐 |
| 测试策略 | MVP 仅编译验证 | QEMU 环境搭建复杂，MVP 阶段聚焦核心流程，运行时测试推迟 |

