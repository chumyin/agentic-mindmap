import type {
  GraphEdit,
  MindmapActorType,
  MindmapArtifact,
  MindmapGraph,
  MindmapSelection,
  OperationRecord,
} from '../core/graph-types'

export interface MindmapSession {
  id: string
  createdAt: string
  updatedAt: string
  graph: MindmapGraph
  history: OperationRecord[]
  commandRuns: MindmapCommandRun[]
  provider: {
    mode: 'mock'
  }
}

export interface MindmapSessionSummary {
  id: string
  createdAt: string
  updatedAt: string
  rootTitle: string
  nodeCount: number
  artifactCount: number
  historyCount: number
  commandRunCount: number
}

export type MindmapCommandToolName =
  | 'generate_map'
  | 'rename_node'
  | 'add_child_node'
  | 'delete_node'
  | 'run_intent'

export interface MindmapCommandToolCall {
  id: string
  toolName: MindmapCommandToolName
  arguments: Record<string, unknown>
}

export interface MindmapCommandPlan {
  input: string
  summary: string
  target: {
    sessionId: string
    nodeId: string | null
    nodeTitle: string | null
  }
  toolCalls: MindmapCommandToolCall[]
}

export type MindmapCommandRunStatus = 'executed' | 'failed'

export interface MindmapCommandRun {
  id: string
  input: string
  actorId: string
  createdAt: string
  selection: MindmapSelection
  replayOfCommandRunId?: string
  status: MindmapCommandRunStatus
  completedToolCalls: number
  plan: MindmapCommandPlan | null
  error?: string
}

export type MindmapCommandMode = 'plan' | 'execute'

export interface SessionStoreOptions {
  rootDir?: string
}

export interface GenerateMapInput {
  sessionId: string
  prompt: string
  actorId?: string
}

export type MindmapIntentType =
  | 'expand_branch'
  | 'summarize_branch'
  | 'create_outline'

export interface RunIntentInput {
  sessionId: string
  intent: MindmapIntentType
  targetNodeId: string
  instruction?: string
  actorId?: string
}

export interface ApplyManualEditsInput {
  sessionId: string
  edits: GraphEdit[]
  actorId?: string
  actorType?: MindmapActorType
  summary?: string
}

export interface PlanCommandInput {
  sessionId: string
  input: string
  actorId?: string
  selection?: MindmapSelection
}

export interface ApplyCommandPlanInput {
  sessionId: string
  plan: MindmapCommandPlan
  actorId?: string
  selection?: MindmapSelection
  replayOfCommandRunId?: string
}

export type ExecuteCommandInput = PlanCommandInput & {
  replayOfCommandRunId?: string
}

export interface ExecuteCommandResult {
  plan: MindmapCommandPlan
  session: MindmapSession
}

export interface ProviderEditResult {
  edits: GraphEdit[]
  summary: string
}

export interface ProviderArtifactResult {
  artifact: MindmapArtifact
  summary: string
}

export interface MindmapProvider {
  generateInitialMap(input: {
    prompt: string
    rootNodeId: string
  }): Promise<ProviderEditResult>
  expandBranch(input: {
    graph: MindmapGraph
    targetNodeId: string
    instruction?: string
  }): Promise<ProviderEditResult>
  summarizeBranch(input: {
    graph: MindmapGraph
    targetNodeId: string
  }): Promise<ProviderArtifactResult>
  createOutline(input: {
    graph: MindmapGraph
    targetNodeId: string
  }): Promise<ProviderArtifactResult>
}
