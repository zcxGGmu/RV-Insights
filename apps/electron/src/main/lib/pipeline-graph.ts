import { randomUUID } from 'node:crypto'
import {
  Annotation,
  Command,
  END,
  INTERRUPT,
  interrupt,
  isInterrupted,
  MemorySaver,
  START,
  StateGraph,
} from '@langchain/langgraph'
import type {
  BaseCheckpointSaver,
} from '@langchain/langgraph'
import type {
  PipelineGateRequest,
  PipelineGateResponse,
  PipelineNodeKind,
  PipelineSessionStatus,
  PipelineStateSnapshot,
} from '@rv-insights/shared'
import type {
  PipelineNodeExecutionContext,
  PipelineNodeExecutionResult,
} from './pipeline-node-runner'

type PipelineGraphState = PipelineStateSnapshot & {
  userInput: string
  latestOutput?: string
  latestSummary?: string
  latestIssues?: string[]
  feedback?: string
}

const PipelineGraphAnnotation = Annotation.Root({
  sessionId: Annotation<string>,
  userInput: Annotation<string>,
  currentNode: Annotation<PipelineNodeKind>,
  status: Annotation<PipelineSessionStatus>,
  reviewIteration: Annotation<number>,
  lastApprovedNode: Annotation<PipelineNodeKind | undefined>,
  pendingGate: Annotation<PipelineGateRequest | null>,
  updatedAt: Annotation<number>,
  latestOutput: Annotation<string | undefined>,
  latestSummary: Annotation<string | undefined>,
  latestIssues: Annotation<string[] | undefined>,
  feedback: Annotation<string | undefined>,
})

export interface CreatePipelineGraphOptions {
  runNode: (
    node: PipelineNodeKind,
    context: PipelineNodeExecutionContext,
  ) => Promise<PipelineNodeExecutionResult>
  checkpointer?: BaseCheckpointSaver
  getSignal?: (sessionId: string) => AbortSignal | undefined
}

export interface PipelineGraphInvokeInput {
  sessionId: string
  userInput: string
}

export interface PipelineGraphResumeInput {
  sessionId: string
  response: PipelineGateResponse
}

export interface PipelineGraphRunResult {
  state: PipelineStateSnapshot
  interrupted?: PipelineGateRequest
}

function now(): number {
  return Date.now()
}

function buildContext(state: PipelineGraphState): PipelineNodeExecutionContext {
  return {
    sessionId: state.sessionId,
    userInput: state.userInput,
    currentNode: state.currentNode,
    reviewIteration: state.reviewIteration,
    lastApprovedNode: state.lastApprovedNode,
    feedback: state.feedback,
  }
}

function buildStateSnapshot(state: PipelineGraphState): PipelineStateSnapshot {
  return {
    sessionId: state.sessionId,
    currentNode: state.currentNode,
    status: state.status,
    reviewIteration: state.reviewIteration,
    lastApprovedNode: state.lastApprovedNode,
    pendingGate: state.pendingGate,
    updatedAt: state.updatedAt,
  }
}

function createGateRequest(
  state: PipelineGraphState,
  node: PipelineNodeKind,
): PipelineGateRequest {
  return {
    gateId: randomUUID(),
    sessionId: state.sessionId,
    node,
    title: `${node} 节点待审核`,
    summary: state.latestSummary,
    feedbackHint: node === 'reviewer'
      ? '可填写 reviewer 反馈后回到 developer'
      : '可填写反馈后重跑当前节点',
    iteration: state.reviewIteration,
    createdAt: now(),
  }
}

function createWorkerNode(
  node: PipelineNodeKind,
  runNode: CreatePipelineGraphOptions['runNode'],
  getSignal: CreatePipelineGraphOptions['getSignal'],
): (state: PipelineGraphState) => Promise<Record<string, unknown> | Command> {
  return async (state) => {
    const result = await runNode(node, {
      ...buildContext(state),
      signal: getSignal?.(state.sessionId),
    })
    const timestamp = now()

    if (node === 'reviewer') {
      if (result.approved === false) {
        return new Command({
          goto: 'developer',
          update: {
            currentNode: 'developer',
            reviewIteration: state.reviewIteration + 1,
            latestOutput: result.output,
            latestSummary: result.summary,
            latestIssues: result.issues,
            status: 'running',
            updatedAt: timestamp,
          },
        })
      }

      return new Command({
        goto: 'gate_reviewer',
        update: {
          currentNode: 'reviewer',
          latestOutput: result.output,
          latestSummary: result.summary,
          latestIssues: result.issues,
          status: 'waiting_human',
          updatedAt: timestamp,
        },
      })
    }

    return {
      currentNode: node,
      latestOutput: result.output,
      latestSummary: result.summary,
      latestIssues: result.issues,
      status: 'running',
      updatedAt: timestamp,
    }
  }
}

function createGateNode(
  node: PipelineNodeKind,
  nextNode: PipelineNodeKind | typeof END,
): (state: PipelineGraphState) => Command {
  return (state) => {
    const request = createGateRequest(state, node)
    const response = interrupt<PipelineGateRequest, PipelineGateResponse>(request)
    const timestamp = now()

    if (response.action === 'approve') {
      if (nextNode === END) {
        return new Command({
          goto: END,
          update: {
            currentNode: node,
            lastApprovedNode: node,
            status: 'completed',
            updatedAt: timestamp,
          },
        })
      }

      return new Command({
        goto: nextNode,
        update: {
          currentNode: nextNode,
          lastApprovedNode: node,
          feedback: undefined,
          status: 'running',
          updatedAt: timestamp,
        },
      })
    }

    if (node === 'reviewer' && response.action === 'reject_with_feedback') {
      return new Command({
        goto: 'developer',
        update: {
          currentNode: 'developer',
          feedback: response.feedback,
          reviewIteration: state.reviewIteration + 1,
          status: 'running',
          updatedAt: timestamp,
        },
      })
    }

    return new Command({
      goto: node,
      update: {
        currentNode: node,
        feedback: response.feedback,
        status: 'running',
        updatedAt: timestamp,
      },
    })
  }
}

function graphConfig(sessionId: string) {
  return {
    configurable: {
      thread_id: sessionId,
    },
    recursionLimit: 25,
  }
}

export function createPipelineGraph(options: CreatePipelineGraphOptions) {
  const builder = new StateGraph(PipelineGraphAnnotation)
    .addNode('explorer', createWorkerNode('explorer', options.runNode, options.getSignal))
    .addNode('gate_explorer', createGateNode('explorer', 'planner'), {
      ends: ['explorer', 'planner'],
    })
    .addNode('planner', createWorkerNode('planner', options.runNode, options.getSignal))
    .addNode('gate_planner', createGateNode('planner', 'developer'), {
      ends: ['planner', 'developer'],
    })
    .addNode('developer', createWorkerNode('developer', options.runNode, options.getSignal))
    .addNode('reviewer', createWorkerNode('reviewer', options.runNode, options.getSignal), {
      ends: ['developer', 'gate_reviewer'],
    })
    .addNode('gate_reviewer', createGateNode('reviewer', 'tester'), {
      ends: ['developer', 'reviewer', 'tester'],
    })
    .addNode('tester', createWorkerNode('tester', options.runNode, options.getSignal))
    .addNode('gate_tester', createGateNode('tester', END), {
      ends: ['tester', END],
    })
    .addEdge(START, 'explorer')
    .addEdge('explorer', 'gate_explorer')
    .addEdge('planner', 'gate_planner')
    .addEdge('developer', 'reviewer')
    .addEdge('tester', 'gate_tester')
    .addEdge('gate_explorer', 'planner')
    .addEdge('gate_planner', 'developer')

  const graph = builder.compile({
    checkpointer: options.checkpointer ?? new MemorySaver(),
  })

  async function getSnapshot(sessionId: string): Promise<PipelineStateSnapshot> {
    const snapshot = await graph.getState(graphConfig(sessionId))
    const values = snapshot.values as PipelineGraphState
    return buildStateSnapshot(values)
  }

  async function extractResult(
    sessionId: string,
    raw: unknown,
  ): Promise<PipelineGraphRunResult> {
    const state = await getSnapshot(sessionId)
    const interrupted = isInterrupted<PipelineGateRequest>(raw)
      ? raw[INTERRUPT]?.[0]?.value
      : undefined

    if (interrupted) {
      return { state, interrupted }
    }

    const snapshot = await graph.getState(graphConfig(sessionId))
    const gate = snapshot.tasks.flatMap((task) => task.interrupts).find(Boolean)?.value as PipelineGateRequest | undefined
    return {
      state,
      interrupted: gate,
    }
  }

  return {
    async invoke(input: PipelineGraphInvokeInput): Promise<PipelineGraphRunResult> {
      const initialState: PipelineGraphState = {
        sessionId: input.sessionId,
        userInput: input.userInput,
        currentNode: 'explorer',
        status: 'running',
        reviewIteration: 0,
        pendingGate: null,
        updatedAt: now(),
      }

      const result = await graph.invoke(initialState, graphConfig(input.sessionId))
      return extractResult(input.sessionId, result)
    },

    async resume(input: PipelineGraphResumeInput): Promise<PipelineGraphRunResult> {
      const result = await graph.invoke(
        new Command({ resume: input.response }),
        graphConfig(input.sessionId),
      )
      return extractResult(input.sessionId, result)
    },

    getState(sessionId: string): Promise<PipelineStateSnapshot> {
      return getSnapshot(sessionId)
    },
  }
}
