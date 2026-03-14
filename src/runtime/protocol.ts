import type { MindmapNodeKind } from '../core/graph-types'
import type {
  MindmapCommandPlan,
  MindmapCommandToolCall,
  MindmapCommandToolName,
  MindmapIntentType,
  MindmapSessionSummary,
} from './session-types'

export const MINDMAP_PROTOCOL_VERSION = '0.1'
export const MINDMAP_GRAPH_VERSION = '0.1'

export const MINDMAP_SUPPORTED_INTENTS = [
  'expand_branch',
  'summarize_branch',
  'create_outline',
] as const

export const MINDMAP_SUPPORTED_ACTOR_TYPES = ['user', 'agent', 'system'] as const
export const MINDMAP_SUPPORTED_NODE_KINDS = [
  'topic',
  'subtopic',
  'task',
  'question',
  'risk',
  'note',
] as const
export const MINDMAP_SUPPORTED_EDIT_TYPES = [
  'create_node',
  'update_node',
  'delete_node',
  'reorder_children',
  'set_selection',
  'attach_artifact',
] as const
export const MINDMAP_SUPPORTED_ARTIFACT_KINDS = [
  'outline',
  'brief',
  'summary',
] as const
export const MINDMAP_SUPPORTED_COMMAND_TOOLS = [
  'generate_map',
  'rename_node',
  'add_child_node',
  'delete_node',
  'run_intent',
] as const
export const MINDMAP_REPLAY_MODE = 'best_effort_current_state'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function expectNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Expected "${fieldName}" to be a non-empty string.`)
  }

  return value
}

function expectOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'string') {
    throw new Error(`Expected "${fieldName}" to be a string when provided.`)
  }

  return value
}

export function isMindmapIntentType(value: unknown): value is MindmapIntentType {
  return (
    value === 'expand_branch' ||
    value === 'summarize_branch' ||
    value === 'create_outline'
  )
}

export function isMindmapNodeKind(value: unknown): value is MindmapNodeKind {
  return MINDMAP_SUPPORTED_NODE_KINDS.includes(value as MindmapNodeKind)
}

export function isMindmapCommandToolName(
  value: unknown,
): value is MindmapCommandToolName {
  return MINDMAP_SUPPORTED_COMMAND_TOOLS.includes(value as MindmapCommandToolName)
}

function validateCommandToolCall(
  value: unknown,
  index: number,
): MindmapCommandToolCall {
  if (!isRecord(value)) {
    throw new Error(`Expected "plan.toolCalls[${index}]" to be an object.`)
  }

  const fieldPrefix = `plan.toolCalls[${index}]`
  const toolName = value.toolName

  if (!isMindmapCommandToolName(toolName)) {
    throw new Error(`Unsupported command tool "${String(toolName)}".`)
  }

  const argumentsValue = value.arguments

  if (!isRecord(argumentsValue)) {
    throw new Error(`Expected "${fieldPrefix}.arguments" to be an object.`)
  }

  const id = expectNonEmptyString(value.id, `${fieldPrefix}.id`)

  switch (toolName) {
    case 'generate_map':
      expectNonEmptyString(argumentsValue.prompt, `${fieldPrefix}.arguments.prompt`)
      break
    case 'rename_node':
      expectNonEmptyString(argumentsValue.nodeId, `${fieldPrefix}.arguments.nodeId`)
      expectNonEmptyString(argumentsValue.title, `${fieldPrefix}.arguments.title`)
      break
    case 'add_child_node': {
      expectNonEmptyString(argumentsValue.parentId, `${fieldPrefix}.arguments.parentId`)
      expectNonEmptyString(argumentsValue.title, `${fieldPrefix}.arguments.title`)

      if (
        argumentsValue.kind !== undefined &&
        !isMindmapNodeKind(argumentsValue.kind)
      ) {
        throw new Error(`Unsupported node kind "${String(argumentsValue.kind)}".`)
      }

      break
    }
    case 'delete_node':
      expectNonEmptyString(argumentsValue.nodeId, `${fieldPrefix}.arguments.nodeId`)
      break
    case 'run_intent':
      if (!isMindmapIntentType(argumentsValue.intent)) {
        throw new Error(
          `Expected "${fieldPrefix}.arguments.intent" to be one of expand_branch, summarize_branch, or create_outline.`,
        )
      }

      expectNonEmptyString(
        argumentsValue.targetNodeId,
        `${fieldPrefix}.arguments.targetNodeId`,
      )
      expectOptionalString(
        argumentsValue.instruction,
        `${fieldPrefix}.arguments.instruction`,
      )
      break
  }

  return {
    id,
    toolName,
    arguments: argumentsValue,
  }
}

export function validateMindmapCommandPlan(value: unknown): MindmapCommandPlan {
  if (!isRecord(value)) {
    throw new Error('Expected "plan" to be an object.')
  }

  if (!isRecord(value.target)) {
    throw new Error('Expected "plan.target" to be an object.')
  }

  if (!Array.isArray(value.toolCalls) || value.toolCalls.length === 0) {
    throw new Error('Expected "plan.toolCalls" to be a non-empty array.')
  }

  const nodeId = value.target.nodeId
  const nodeTitle = value.target.nodeTitle

  if (nodeId !== null && typeof nodeId !== 'string') {
    throw new Error('Expected "plan.target.nodeId" to be a string or null.')
  }

  if (nodeTitle !== null && typeof nodeTitle !== 'string') {
    throw new Error('Expected "plan.target.nodeTitle" to be a string or null.')
  }

  return {
    input: expectNonEmptyString(value.input, 'plan.input'),
    summary: expectNonEmptyString(value.summary, 'plan.summary'),
    target: {
      sessionId: expectNonEmptyString(value.target.sessionId, 'plan.target.sessionId'),
      nodeId: nodeId ?? null,
      nodeTitle: nodeTitle ?? null,
    },
    toolCalls: value.toolCalls.map((toolCall, index) =>
      validateCommandToolCall(toolCall, index),
    ),
  }
}

export function createMindmapProtocolDescription(input: { rootDir: string }) {
  return {
    protocolVersion: MINDMAP_PROTOCOL_VERSION,
    graphVersion: MINDMAP_GRAPH_VERSION,
    runtimeMode: 'local-file-backed',
    auth: 'none',
    providerModes: ['mock'],
    supportedIntents: [...MINDMAP_SUPPORTED_INTENTS],
    supportedActorTypes: [...MINDMAP_SUPPORTED_ACTOR_TYPES],
    supportedNodeKinds: [...MINDMAP_SUPPORTED_NODE_KINDS],
    supportedEditTypes: [...MINDMAP_SUPPORTED_EDIT_TYPES],
    supportedArtifactKinds: [...MINDMAP_SUPPORTED_ARTIFACT_KINDS],
    supportedCommandTools: [...MINDMAP_SUPPORTED_COMMAND_TOOLS],
    planningContract: {
      previewBeforeExecute: true,
      acceptsSelectionContext: true,
      supportsCompoundCommands: true,
      supportsPlanApply: true,
      planApplyAtomic: true,
    },
    replayContract: {
      mode: MINDMAP_REPLAY_MODE,
      reappliesStoredSelection: true,
      reusesCurrentSessionGraph: true,
    },
    commandExamples: [
      {
        input: 'Rename this node to Priority goals',
        mode: 'plan',
      },
      {
        input: 'Create an outline for this branch',
        mode: 'execute',
      },
      {
        input:
          'Rename this node to Priority goals and add child node called Success metrics',
        mode: 'execute',
      },
    ],
    sessionSummaryFields: [
      'id',
      'createdAt',
      'updatedAt',
      'rootTitle',
      'nodeCount',
      'artifactCount',
      'historyCount',
      'commandRunCount',
    ],
    commandRunFields: [
      'id',
      'input',
      'actorId',
      'createdAt',
      'selection',
      'replayOfCommandRunId',
      'status',
      'completedToolCalls',
      'plan',
      'error',
    ],
    routes: [
      { method: 'GET', path: '/api/mindmap/health' },
      { method: 'GET', path: '/api/mindmap/describe' },
      { method: 'GET', path: '/api/mindmap/session' },
      { method: 'POST', path: '/api/mindmap/session' },
      { method: 'GET', path: '/api/mindmap/session/:id' },
      { method: 'GET', path: '/api/mindmap/session/:id/command' },
      { method: 'POST', path: '/api/mindmap/session/:id/command' },
      { method: 'POST', path: '/api/mindmap/session/:id/command/apply' },
      { method: 'GET', path: '/api/mindmap/session/:id/command/:commandRunId' },
      {
        method: 'POST',
        path: '/api/mindmap/session/:id/command/:commandRunId/replay',
      },
      { method: 'POST', path: '/api/mindmap/session/:id/generate' },
      { method: 'POST', path: '/api/mindmap/session/:id/edit' },
      { method: 'POST', path: '/api/mindmap/session/:id/intent' },
      { method: 'GET', path: '/api/mindmap/session/:id/export' },
    ],
    cliCommands: [
      'session create',
      'session show',
      'session list',
      'command',
      'command apply',
      'command list',
      'command show',
      'command replay',
      'generate',
      'edit',
      'act',
      'export',
      'describe',
      'serve',
    ],
    rootDir: input.rootDir,
  }
}

export function summarizeSession(input: {
  id: string
  createdAt: string
  updatedAt: string
  graph: {
    rootNodeId: string
    nodes: Record<string, { title: string }>
    artifacts: Record<string, unknown>
  }
  history: unknown[]
  commandRuns?: unknown[]
}): MindmapSessionSummary {
  return {
    id: input.id,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    rootTitle: input.graph.nodes[input.graph.rootNodeId]?.title ?? 'Untitled map',
    nodeCount: Object.keys(input.graph.nodes).length,
    artifactCount: Object.keys(input.graph.artifacts).length,
    historyCount: input.history.length,
    commandRunCount: input.commandRuns?.length ?? 0,
  }
}
