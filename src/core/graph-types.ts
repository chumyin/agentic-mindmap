export type MindmapNodeKind =
  | 'topic'
  | 'subtopic'
  | 'task'
  | 'question'
  | 'risk'
  | 'note'

export type MindmapNodeStatus = 'active' | 'draft' | 'archived'

export type MindmapArtifactKind = 'outline' | 'brief' | 'summary'

export type MindmapActorType = 'user' | 'agent' | 'system'

export interface MindmapNodeMeta {
  source?: MindmapActorType
  confidence?: number
  tags?: string[]
}

export interface MindmapNode {
  id: string
  kind: MindmapNodeKind
  title: string
  body?: string
  parentId: string | null
  children: string[]
  status: MindmapNodeStatus
  meta?: MindmapNodeMeta
}

export interface MindmapSelection {
  focusedNodeId: string | null
  selectedNodeIds: string[]
}

export interface MindmapArtifact {
  id: string
  kind: MindmapArtifactKind
  title: string
  content: string
  sourceNodeId: string
}

export interface MindmapGraph {
  version: '0.1'
  rootNodeId: string
  nodes: Record<string, MindmapNode>
  artifacts: Record<string, MindmapArtifact>
  selection: MindmapSelection
}

export interface CreateNodeInput {
  id: string
  parentId: string
  kind: MindmapNodeKind
  title: string
  body?: string
  status?: MindmapNodeStatus
  meta?: MindmapNodeMeta
}

export type UpdateNodePatch = Partial<
  Pick<MindmapNode, 'kind' | 'title' | 'body' | 'status' | 'meta'>
>

export type GraphEdit =
  | {
      type: 'create_node'
      node: CreateNodeInput
    }
  | {
      type: 'update_node'
      nodeId: string
      patch: UpdateNodePatch
    }
  | {
      type: 'delete_node'
      nodeId: string
    }
  | {
      type: 'reorder_children'
      parentId: string
      childIds: string[]
    }
  | {
      type: 'set_selection'
      selection: MindmapSelection
    }
  | {
      type: 'attach_artifact'
      artifact: MindmapArtifact
    }

export interface OperationRecord {
  id: string
  type: string
  actor: {
    type: MindmapActorType
    id: string
  }
  summary: string
  createdAt: string
  patches: GraphEdit[]
}
