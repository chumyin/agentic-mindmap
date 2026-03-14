import type { GraphEdit, MindmapArtifact, MindmapGraph, OperationRecord } from '../core/graph-types'

export interface MindmapSession {
  id: string
  createdAt: string
  updatedAt: string
  graph: MindmapGraph
  history: OperationRecord[]
  provider: {
    mode: 'mock'
  }
}

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
  summary?: string
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
