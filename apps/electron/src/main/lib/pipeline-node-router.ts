import type {
  PipelineNodeKind,
  PipelineStreamEvent,
} from '@rv-insights/shared'
import {
  CodexCliPipelineNodeRunner,
  CodexSdkPipelineNodeRunner,
  isCodexPipelineNode,
  type CodexPipelineBackend,
} from './codex-pipeline-node-runner'
import {
  ClaudePipelineNodeRunner,
  type PipelineNodeExecutionContext,
  type PipelineNodeExecutionResult,
  type PipelineNodeRunner,
} from './pipeline-node-runner'

export interface RoutedPipelineNodeRunnerOptions {
  channelId?: string
  claudeChannelId?: string
  codexChannelId?: string
  workspaceId?: string
  onEvent?: (event: PipelineStreamEvent) => void
  codexBackend?: CodexPipelineBackend
  claudeRunner?: PipelineNodeRunner
  codexRunner?: PipelineNodeRunner
}

export class RoutedPipelineNodeRunner implements PipelineNodeRunner {
  private readonly claudeRunner: PipelineNodeRunner
  private readonly codexRunner: PipelineNodeRunner

  constructor(options: RoutedPipelineNodeRunnerOptions) {
    const claudeChannelId = options.claudeChannelId ?? options.channelId
    this.claudeRunner = options.claudeRunner ?? new ClaudePipelineNodeRunner({
      channelId: claudeChannelId,
      workspaceId: options.workspaceId,
      onEvent: options.onEvent,
    })
    this.codexRunner = options.codexRunner ?? (
      options.codexBackend === 'cli'
        ? new CodexCliPipelineNodeRunner({
          channelId: options.codexChannelId,
          workspaceId: options.workspaceId,
          onEvent: options.onEvent,
        })
        : new CodexSdkPipelineNodeRunner({
          channelId: options.codexChannelId,
          workspaceId: options.workspaceId,
          onEvent: options.onEvent,
        })
    )
  }

  abort(sessionId: string): void {
    this.claudeRunner.abort?.(sessionId)
    this.codexRunner.abort?.(sessionId)
  }

  runNode(
    node: PipelineNodeKind,
    context: PipelineNodeExecutionContext,
  ): Promise<PipelineNodeExecutionResult> {
    if (isCodexPipelineNode(node)) {
      return this.codexRunner.runNode(node, context)
    }

    return this.claudeRunner.runNode(node, context)
  }
}
