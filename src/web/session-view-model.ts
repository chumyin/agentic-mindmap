import { useEffect, useMemo, useState } from 'react'
import {
  applyGraphEdits,
  attachArtifact,
  createChildNode,
  createGraph,
  deleteNode,
  setSelection,
  updateNode,
} from '../core/graph'
import type {
  GraphEdit,
  MindmapArtifact,
  MindmapGraph,
  MindmapNode,
  MindmapSelection,
  OperationRecord,
} from '../core/graph-types'
import { createMockProvider } from '../runtime/mock-provider'
import type { MindmapSession } from '../runtime/session-types'

const STORAGE_KEY = 'agentic-mindmap/browser-session'

function makeId(prefix: string): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${prefix}_${globalThis.crypto.randomUUID()}`
  }

  return `${prefix}_${Math.random().toString(16).slice(2)}`
}

function nowIso(): string {
  return new Date().toISOString()
}

function createOperationRecord(input: {
  type: string
  actorType: 'user' | 'agent' | 'system'
  actorId: string
  summary: string
  patches: GraphEdit[]
}): OperationRecord {
  return {
    id: makeId('op'),
    type: input.type,
    actor: {
      type: input.actorType,
      id: input.actorId,
    },
    summary: input.summary,
    createdAt: nowIso(),
    patches: input.patches,
  }
}

function appendHistory(
  session: MindmapSession,
  entry: OperationRecord,
): MindmapSession {
  return {
    ...session,
    updatedAt: nowIso(),
    history: [...session.history, entry],
  }
}

function createBrowserSession(): MindmapSession {
  const createdAt = nowIso()

  return {
    id: makeId('web'),
    createdAt,
    updatedAt: createdAt,
    graph: createGraph('Untitled map'),
    history: [],
    provider: {
      mode: 'mock',
    },
  }
}

function loadStoredSession(): MindmapSession {
  if (typeof window === 'undefined') {
    return createBrowserSession()
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    return createBrowserSession()
  }

  try {
    return JSON.parse(raw) as MindmapSession
  } catch {
    return createBrowserSession()
  }
}

function storeSession(session: MindmapSession) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

function getSelectedNode(graph: MindmapGraph): MindmapNode | null {
  return graph.nodes[graph.selection.focusedNodeId ?? ''] ?? null
}

function findLatestArtifact(graph: MindmapGraph): MindmapArtifact | null {
  const artifacts = Object.values(graph.artifacts)
  return artifacts.at(-1) ?? null
}

function countNewNodesUnderParent(graph: MindmapGraph, parentId: string): number {
  const parent = graph.nodes[parentId]

  if (!parent) {
    return 0
  }

  return parent.children.filter((childId) => {
    const child = graph.nodes[childId]
    return child?.title.startsWith('New node')
  }).length
}

function nextSelection(nodeId: string): MindmapSelection {
  return {
    focusedNodeId: nodeId,
    selectedNodeIds: [nodeId],
  }
}

export function useSessionViewModel() {
  const provider = useMemo(() => createMockProvider(), [])
  const [session, setSession] = useState<MindmapSession>(() => loadStoredSession())

  useEffect(() => {
    storeSession(session)
  }, [session])

  const selectedNode = getSelectedNode(session.graph)
  const latestArtifact = findLatestArtifact(session.graph)

  async function generateFromPrompt(prompt: string) {
    const trimmedPrompt = prompt.trim()

    if (!trimmedPrompt) {
      return
    }

    const baseGraph = createGraph(trimmedPrompt)
    const generation = await provider.generateInitialMap({
      prompt: trimmedPrompt,
      rootNodeId: baseGraph.rootNodeId,
    })
    const graph = setSelection(
      applyGraphEdits(baseGraph, generation.edits),
      nextSelection(baseGraph.rootNodeId),
    )
    const nextSession = appendHistory(
      {
        ...session,
        graph,
      },
      createOperationRecord({
        type: 'generate_map',
        actorType: 'agent',
        actorId: 'browser-user',
        summary: generation.summary,
        patches: generation.edits,
      }),
    )

    setSession(nextSession)
  }

  function selectNode(nodeId: string) {
    const graph = setSelection(session.graph, nextSelection(nodeId))
    setSession({
      ...session,
      updatedAt: nowIso(),
      graph,
    })
  }

  function renameSelectedNode(title: string) {
    if (!selectedNode) {
      return
    }

    const graph = updateNode(session.graph, selectedNode.id, { title })
    const nextSession = appendHistory(
      {
        ...session,
        graph,
      },
      createOperationRecord({
        type: 'manual_edit',
        actorType: 'user',
        actorId: 'browser-user',
        summary: `Renamed node to "${title}".`,
        patches: [
          {
            type: 'update_node',
            nodeId: selectedNode.id,
            patch: { title },
          },
        ],
      }),
    )

    setSession(nextSession)
  }

  function addChildNode() {
    if (!selectedNode) {
      return
    }

    const nextIndex = countNewNodesUnderParent(session.graph, selectedNode.id) + 1
    const title = `New node ${nextIndex}`
    const node = {
      id: makeId('n'),
      parentId: selectedNode.id,
      kind: 'note' as const,
      title,
    }
    const graph = createChildNode(session.graph, node)
    const nextSession = appendHistory(
      {
        ...session,
        graph,
      },
      createOperationRecord({
        type: 'manual_edit',
        actorType: 'user',
        actorId: 'browser-user',
        summary: `Added child node "${title}".`,
        patches: [
          {
            type: 'create_node',
            node,
          },
        ],
      }),
    )

    setSession(nextSession)
  }

  function deleteSelectedNode() {
    if (!selectedNode || selectedNode.parentId === null) {
      return
    }

    const graph = deleteNode(session.graph, selectedNode.id)
    const nextSession = appendHistory(
      {
        ...session,
        graph,
      },
      createOperationRecord({
        type: 'manual_edit',
        actorType: 'user',
        actorId: 'browser-user',
        summary: `Deleted node "${selectedNode.title}".`,
        patches: [
          {
            type: 'delete_node',
            nodeId: selectedNode.id,
          },
        ],
      }),
    )

    setSession(nextSession)
  }

  async function expandSelectedBranch(instruction: string) {
    if (!selectedNode) {
      return
    }

    const result = await provider.expandBranch({
      graph: session.graph,
      targetNodeId: selectedNode.id,
      instruction,
    })
    const graph = applyGraphEdits(session.graph, result.edits)
    const nextSession = appendHistory(
      {
        ...session,
        graph,
      },
      createOperationRecord({
        type: 'expand_branch',
        actorType: 'agent',
        actorId: 'browser-user',
        summary: result.summary,
        patches: result.edits,
      }),
    )

    setSession(nextSession)
  }

  async function createOutline() {
    const artifactResult = await provider.createOutline({
      graph: session.graph,
      targetNodeId: session.graph.rootNodeId,
    })
    const graph = attachArtifact(session.graph, artifactResult.artifact)
    const nextSession = appendHistory(
      {
        ...session,
        graph,
      },
      createOperationRecord({
        type: 'create_outline',
        actorType: 'agent',
        actorId: 'browser-user',
        summary: artifactResult.summary,
        patches: [
          {
            type: 'attach_artifact',
            artifact: artifactResult.artifact,
          },
        ],
      }),
    )

    setSession(nextSession)
  }

  function resetSession() {
    const freshSession = createBrowserSession()
    setSession(freshSession)
  }

  return {
    session,
    selectedNode,
    latestArtifact,
    generateFromPrompt,
    selectNode,
    renameSelectedNode,
    addChildNode,
    deleteSelectedNode,
    expandSelectedBranch,
    createOutline,
    resetSession,
  }
}
