# ScienceClaw → RV-Insights 组件迁移映射

> 每个 ScienceClaw 前端文件的迁移目标、适配说明和 Sprint 归属。
> "直接复制" = 仅改 import 路径；"适配" = 需修改逻辑；"重写" = 仅参考结构。

## 页面组件（views/）

| ScienceClaw 源 | RV-Insights 目标 | Sprint | 策略 | 适配说明 |
|---|---|---|---|---|
| `pages/HomePage.vue` | `views/HomePage.vue` | S3 | 适配 | 替换品牌、SuggestedQuestions 改为 RISC-V 相关 |
| `pages/ChatPage.vue` | `views/ChatPage.vue` | S3 | 重写 | 1300 行拆分为 composable，移除 sandbox/VNC |
| `pages/LoginPage.vue` | `views/LoginPage.vue` | 已有 | — | 已实现，保持不变 |
| `pages/MainLayout.vue` | `views/MainLayout.vue` | S3 | 适配 | 已有基础版，添加双模式导航 + LeftPanel |
| `pages/ShareLayout.vue` | `views/ShareLayout.vue` | S4 | 直接复制 | 最小布局，无需改动 |
| `pages/SharePage.vue` | `views/SharePage.vue` | S4 | 适配 | 移除 sandbox 相关 |
| `pages/SkillsPage.vue` | `views/SkillsPage.vue` | S8 | 适配 | 改为 RISC-V Skills |
| `pages/SkillDetailPage.vue` | `views/SkillDetailPage.vue` | S8 | 适配 | 文件树 + 描述 |
| `pages/ToolsPage.vue` | `views/ToolsPage.vue` | S8 | 适配 | 双 tab：Science + External |
| `pages/ToolDetailPage.vue` | `views/ToolDetailPage.vue` | S8 | 直接复制 | |
| `pages/ScienceToolDetail.vue` | `views/ScienceToolDetail.vue` | S8 | 适配 | ToolUniverse 工具详情 |
| `pages/TasksPage.vue` | `views/TasksPage.vue` | S9 | 直接复制 | |
| `pages/TasksListPage.vue` | `views/TasksListPage.vue` | S9 | 直接复制 | |
| `pages/TaskConfigPage.vue` | `views/TaskConfigPage.vue` | S9 | 适配 | NLP 调度 + webhook |

## Chat 组件（components/chat/）

| ScienceClaw 源 | RV-Insights 目标 | Sprint | 策略 | 适配说明 |
|---|---|---|---|---|
| `ChatBox.vue` | `components/chat/ChatBox.vue` | S3 | 适配 | 移除 optimize panel，保留文件附件 |
| `ChatBoxFiles.vue` | `components/chat/ChatBoxFiles.vue` | S3 | 直接复制 | |
| `ChatMessage.vue` | `components/chat/ChatMessage.vue` | S3 | 适配 | 移除 sandbox 预览，保留 markdown |
| `SuggestedQuestions.vue` | `components/chat/SuggestedQuestions.vue` | S3 | 适配 | 改为 RISC-V 问题 |
| `PlanPanel.vue` | `components/chat/PlanPanel.vue` | S4 | 直接复制 | |
| `ProcessMessage.vue` | `components/chat/ProcessMessage.vue` | S3 | 直接复制 | |
| `StepMessage.vue` | `components/chat/StepMessage.vue` | S3 | 直接复制 | |
| `AttachmentsMessage.vue` | `components/chat/AttachmentsMessage.vue` | S4 | 直接复制 | |
| `RoundFilesPopover.vue` | `components/chat/RoundFilesPopover.vue` | S4 | 直接复制 | |

## 面板组件

| ScienceClaw 源 | RV-Insights 目标 | Sprint | 策略 | 适配说明 |
|---|---|---|---|---|
| `ActivityPanel.vue` | `components/shared/ActivityPanel.vue` | S3 | 适配 | 移除 sandbox tab，保留思考+工具时间线 |
| `LeftPanel.vue` | `components/shared/LeftPanel.vue` | S3 | 适配 | 添加 Pipeline/Chat 模式切换 |
| `SessionItem.vue` | `components/chat/SessionItem.vue` | S3 | 直接复制 | |
| `ToolPanel.vue` | `components/chat/ToolPanel.vue` | S4 | 适配 | 移除 sandbox |
| `ToolPanelContent.vue` | `components/chat/ToolPanelContent.vue` | S4 | 适配 | |
| `FilePanel.vue` | `components/chat/FilePanel.vue` | S4 | 适配 | 移除 sandbox 文件路径 |
| `FilePanelContent.vue` | `components/chat/FilePanelContent.vue` | S4 | 适配 | |
| `SessionFileList.vue` | `components/chat/SessionFileList.vue` | S4 | 直接复制 | |
| `SessionFileListContent.vue` | `components/chat/SessionFileListContent.vue` | S4 | 直接复制 | |

## 共享 UI 组件

| ScienceClaw 源 | RV-Insights 目标 | Sprint | 策略 | 适配说明 |
|---|---|---|---|---|
| `SimpleBar.vue` | `components/ui/SimpleBar.vue` | S3 | 直接复制 | |
| `MarkdownEnhancements.vue` | `components/shared/MarkdownEnhancements.vue` | S3 | 直接复制 | |
| `LanguageSelector.vue` | `components/shared/LanguageSelector.vue` | S9 | 直接复制 | |
| `UserMenu.vue` | `components/shared/UserMenu.vue` | S4 | 适配 | 调整菜单项 |
| `ToolUse.vue` | `components/chat/ToolUse.vue` | S3 | 适配 | 移除 sandbox 工具 |
| `ui/CustomDialog.vue` | `components/ui/CustomDialog.vue` | S3 | 直接复制 | |
| `ui/dialog/*` | `components/ui/dialog/*` | S3 | 直接复制 | reka-ui 原语 |
| `ui/popover/*` | `components/ui/popover/*` | S3 | 直接复制 | reka-ui 原语 |
| `ui/select/*` | `components/ui/select/*` | S3 | 直接复制 | reka-ui 原语 |
| `ui/Toast.vue` | `components/ui/Toast.vue` | S3 | 直接复制 | |
| `ui/LoadingIndicator.vue` | `components/ui/LoadingIndicator.vue` | S3 | 直接复制 | |
| `ui/MonacoEditor.vue` | `components/ui/MonacoEditor.vue` | S3 | 直接复制 | |
| `ui/ContextMenu.vue` | `components/ui/ContextMenu.vue` | S3 | 直接复制 | |

## Tool Views

| ScienceClaw 源 | RV-Insights 目标 | Sprint | 策略 | 适配说明 |
|---|---|---|---|---|
| `toolViews/ShellToolView.vue` | `components/toolViews/ShellToolView.vue` | S3 | 直接复制 | |
| `toolViews/FileToolView.vue` | `components/toolViews/FileToolView.vue` | S3 | 直接复制 | |
| `toolViews/SearchToolView.vue` | `components/toolViews/SearchToolView.vue` | S3 | 直接复制 | |
| `toolViews/BrowserToolView.vue` | — | — | 不迁移 | sandbox 专用 |
| `toolViews/McpToolView.vue` | — | — | 不迁移 | MCP 专用 |

## Settings 组件

| ScienceClaw 源 | RV-Insights 目标 | Sprint | 策略 | 适配说明 |
|---|---|---|---|---|
| `settings/SettingsDialog.vue` | `components/settings/SettingsDialog.vue` | S4 | 适配 | 8 tab 布局 |
| `settings/SettingsTabs.vue` | `components/settings/SettingsTabs.vue` | S4 | 适配 | |
| `settings/AccountSettings.vue` | `components/settings/AccountSettings.vue` | S8 | 直接复制 | |
| `settings/ChangePasswordDialog.vue` | `components/settings/ChangePasswordDialog.vue` | S8 | 直接复制 | |
| `settings/GeneralSettings.vue` | `components/settings/GeneralSettings.vue` | S4 | 适配 | |
| `settings/ModelSettings.vue` | `components/settings/ModelSettings.vue` | S8 | 直接复制 | |
| `settings/PersonalizationSettings.vue` | `components/settings/PersonalizationSettings.vue` | S8 | 适配 | |
| `settings/TokenStatistics.vue` | `components/settings/TokenStatistics.vue` | S8 | 适配 | 添加 Pipeline 成本 |
| `settings/TaskSettings.vue` | `components/settings/TaskSettings.vue` | S9 | 直接复制 | |
| `settings/NotificationSettings.vue` | `components/settings/NotificationSettings.vue` | S9 | 直接复制 | |
| `settings/LarkBindingSettings.vue` | `components/settings/LarkBindingSettings.vue` | S9 | 直接复制 | |
| `settings/WeChatClawBotSettings.vue` | `components/settings/WeChatSettings.vue` | S9 | 适配 | 重命名 |
| `settings/IMSystemSettings.vue` | `components/settings/IMSystemSettings.vue` | S9 | 直接复制 | |
| `settings/ProfileSettings.vue` | `components/settings/ProfileSettings.vue` | S4 | 直接复制 | |

## 不迁移的组件

| ScienceClaw 源 | 原因 |
|---|---|
| `SandboxPreview.vue` | RV-Insights 无 sandbox |
| `SandboxTerminal.vue` | RV-Insights 无 sandbox |
| `VNCViewer.vue` | RV-Insights 无 VNC |
| `TakeOverView.vue` | RV-Insights 无 VNC |
| `MoleculeViewer.vue` | 化学分子专用 |
| `HtmlViewer.vue` | sandbox HTML 预览 |
| `ImageViewer.vue` | 可后续按需添加 |
| `FileViewer.vue` | 可后续按需添加 |
| `FilePreviewModal.vue` | 可后续按需添加 |
| `filePreviews/*` | 可后续按需添加 |
| `icons/*` | 按需复制，不批量迁移 |

## Composables

| ScienceClaw 源 | RV-Insights 目标 | Sprint | 策略 | 适配说明 |
|---|---|---|---|---|
| `useAuth.ts` | `composables/useAuth.ts` | 已有 | — | 已实现 |
| `useChatSession.ts` | — | — | — | ScienceClaw 无此文件，RV-Insights 新建 |
| `useTheme.ts` | `composables/useTheme.ts` | S3 | 直接复制 | |
| `useDialog.ts` | `composables/useDialog.ts` | S3 | 直接复制 | |
| `useContextMenu.ts` | `composables/useContextMenu.ts` | S3 | 直接复制 | |
| `useLeftPanel.ts` | `composables/useLeftPanel.ts` | S3 | 直接复制 | |
| `useRightPanel.ts` | `composables/useRightPanel.ts` | S4 | 直接复制 | |
| `useFilePanel.ts` | `composables/useFilePanel.ts` | S4 | 直接复制 | |
| `useSessionFileList.ts` | `composables/useSessionFileList.ts` | S4 | 直接复制 | |
| `useSettingsDialog.ts` | `composables/useSettingsDialog.ts` | S4 | 直接复制 | |
| `useSessionGrouping.ts` | `composables/useSessionGrouping.ts` | S3 | 直接复制 | |
| `useSessionNotifications.ts` | `composables/useSessionNotifications.ts` | S3 | 适配 | 对接 Pinia store |
| `useSessionListUpdate.ts` | `composables/useSessionListUpdate.ts` | S3 | 适配 | 对接 Pinia store |
| `usePendingChat.ts` | `composables/usePendingChat.ts` | S3 | 直接复制 | |
| `useMessageGrouper.ts` | `composables/useMessageGrouper.ts` | S4 | 直接复制 | |
| `useResizeObserver.ts` | `composables/useResizeObserver.ts` | S3 | 直接复制 | |
| `useI18n.ts` | `composables/useI18n.ts` | S3 | 直接复制 | |
| `useTime.ts` | `composables/useTime.ts` | S3 | 直接复制 | |
| `useTool.ts` | `composables/useTool.ts` | S3 | 适配 | 移除 sandbox 工具 |

## API 客户端

| ScienceClaw 源 | RV-Insights 目标 | Sprint | 策略 | 适配说明 |
|---|---|---|---|---|
| `api/client.ts` | `api/client.ts` | S3 | 适配 | 已有基础版，升级 SSE 支持 |
| `api/agent.ts` | `api/chat.ts` | S3 | 适配 | 重命名 + 调整端点 |
| `api/auth.ts` | `api/auth.ts` | 已有 | 适配 | 添加 change-password 等 |
| `api/models.ts` | `api/models.ts` | S4 | 直接复制 | |
| `api/memory.ts` | `api/memory.ts` | S4 | 直接复制 | |
| `api/file.ts` | `api/file.ts` | S4 | 适配 | 移除 sandbox 路径 |
| `api/im.ts` | `api/im.ts` | S9 | 直接复制 | |
| `api/tasks.ts` | `api/tasks.ts` | S9 | 直接复制 | |
| `api/webhooks.ts` | `api/webhooks.ts` | S9 | 直接复制 | |
| `api/taskSettings.ts` | `api/taskSettings.ts` | S9 | 直接复制 | |
| `api/tooluniverse.ts` | `api/tooluniverse.ts` | S8 | 直接复制 | |

## Utils

| ScienceClaw 源 | RV-Insights 目标 | Sprint | 策略 |
|---|---|---|---|
| `utils/toast.ts` | `utils/toast.ts` | S3 | 直接复制 |
| `utils/eventBus.ts` | `utils/eventBus.ts` | S3 | 直接复制 |
| `utils/dom.ts` | `utils/dom.ts` | S3 | 直接复制 |
| `utils/time.ts` | `utils/time.ts` | S3 | 直接复制 |
| `utils/markdownFormatter.ts` | `utils/markdownFormatter.ts` | S3 | 直接复制 |
| `utils/content.ts` | `utils/content.ts` | S3 | 适配（移除 sandbox URL） |
| `utils/fileType.ts` | `utils/fileType.ts` | S4 | 直接复制 |
| `utils/auth.ts` | `utils/auth.ts` | S3 | 适配（字段名） |
| `utils/sandbox.ts` | — | — | 不迁移 |

## Types

| ScienceClaw 源 | RV-Insights 目标 | Sprint | 策略 |
|---|---|---|---|
| `types/event.ts` | `types/event.ts` | S3 | 适配（对照 sse-protocol.md） |
| `types/message.ts` | `types/message.ts` | S3 | 适配 |
| `types/response.ts` | `types/response.ts` | S3 | 适配（对照 api-contracts.md） |
| `types/panel.ts` | `types/panel.ts` | S3 | 直接复制 |
| `types/router.d.ts` | `types/router.d.ts` | S3 | 直接复制 |
| `types/select.ts` | `types/select.ts` | S3 | 直接复制 |

## Constants

| ScienceClaw 源 | RV-Insights 目标 | Sprint | 策略 |
|---|---|---|---|
| `constants/tool.ts` | `constants/tool.ts` | S3 | 适配（移除 sandbox 工具） |
| `constants/event.ts` | `constants/event.ts` | S3 | 直接复制 |

## i18n

| ScienceClaw 源 | RV-Insights 目标 | Sprint | 策略 |
|---|---|---|---|
| `locales/en.ts` | `locales/en.ts` | S3 | 适配（品牌 + RISC-V 术语） |
| `locales/zh.ts` | `locales/zh.ts` | S3 | 适配 |
| `locales/index.ts` | `locales/index.ts` | S3 | 直接复制 |

## 统计

| 类别 | 直接复制 | 适配 | 重写 | 不迁移 |
|------|---------|------|------|--------|
| 页面 | 4 | 8 | 1 | 0 |
| 组件 | 25 | 18 | 0 | 10 |
| Composables | 10 | 4 | 0 | 0 |
| API | 6 | 4 | 0 | 0 |
| Utils | 5 | 3 | 0 | 1 |
| Types | 3 | 3 | 0 | 0 |
| **合计** | **53** | **40** | **1** | **11** |
