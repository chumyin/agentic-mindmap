import type { MindmapSessionSummary } from './session-types'

export const MINDMAP_PROTOCOL_VERSION = '0.1'
export const MINDMAP_GRAPH_VERSION = '0.1'

export const MINDMAP_SUPPORTED_INTENTS = [
  'expand_branch',
  'summarize_branch',
  'create_outline',
] as const

export const MINDMAP_SUPPORTED_ACTOR_TYPES = ['user', 'agent', 'system'] as const
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

export function createMindmapProtocolDescription(input: { rootDir: string }) {
  return {
    protocolVersion: MINDMAP_PROTOCOL_VERSION,
    graphVersion: MINDMAP_GRAPH_VERSION,
    runtimeMode: 'local-file-backed',
    auth: 'none',
    providerModes: ['mock'],
    supportedIntents: [...MINDMAP_SUPPORTED_INTENTS],
    supportedActorTypes: [...MINDMAP_SUPPORTED_ACTOR_TYPES],
    supportedEditTypes: [...MINDMAP_SUPPORTED_EDIT_TYPES],
    supportedArtifactKinds: [...MINDMAP_SUPPORTED_ARTIFACT_KINDS],
    supportedCommandTools: [...MINDMAP_SUPPORTED_COMMAND_TOOLS],
    planningContract: {
      previewBeforeExecute: true,
      acceptsSelectionContext: true,
      supportsCompoundCommands: true,
      supportsPlanApply: true,
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
