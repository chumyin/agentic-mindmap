import { useEffect, useState } from 'react'
import { setSelection } from '../core/graph'
import { createGraph } from '../core/graph'
import type {
  MindmapArtifact,
  MindmapGraph,
  MindmapNode,
  MindmapSelection,
} from '../core/graph-types'
import type { MindmapCommandPlan, MindmapSession } from '../runtime/session-types'
import {
  applyRemoteCommandPlan,
  applyRemoteEdits,
  createRemoteSession,
  generateRemoteMap,
  loadRemoteSession,
  planRemoteCommand,
  replayRemoteCommandRun,
  runRemoteCommand,
  runRemoteIntent,
} from './session-client'
import { syncMindmapApiBaseOverride } from './api-config'

const STORAGE_KEY = 'agentic-mindmap/browser-session-id'
const LEGACY_STORAGE_KEY = 'agentic-mindmap/browser-session'

function makePlaceholderSession(): MindmapSession {
  const createdAt = new Date().toISOString()

  return {
    id: 'connecting',
    createdAt,
    updatedAt: createdAt,
    graph: createGraph('Untitled map'),
    history: [],
    commandRuns: [],
    provider: {
      mode: 'mock',
    },
  }
}

function readStoredSessionId(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  const storedId = window.localStorage.getItem(STORAGE_KEY)
  if (storedId?.startsWith('sess_')) {
    return storedId
  }

  const legacyValue = window.localStorage.getItem(LEGACY_STORAGE_KEY)
  if (!legacyValue) {
    return null
  }

  if (legacyValue.startsWith('sess_')) {
    return legacyValue
  }

  try {
    const parsed = JSON.parse(legacyValue) as { id?: string }
    return parsed.id?.startsWith('sess_') ? parsed.id : null
  } catch {
    return null
  }
}

function storeSessionId(sessionId: string) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, sessionId)
  window.localStorage.removeItem(LEGACY_STORAGE_KEY)
}

function nextSelection(nodeId: string): MindmapSelection {
  return {
    focusedNodeId: nodeId,
    selectedNodeIds: [nodeId],
  }
}

function withSelection(session: MindmapSession, nodeId: string): MindmapSession {
  return {
    ...session,
    graph: setSelection(session.graph, nextSelection(nodeId)),
  }
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

export function useSessionViewModel() {
  const [session, setSession] = useState<MindmapSession | null>(null)
  const [commandPlan, setCommandPlan] = useState<MindmapCommandPlan | null>(null)
  const [plannedSelection, setPlannedSelection] = useState<MindmapSelection | null>(
    null,
  )
  const [commandError, setCommandError] = useState<string | null>(null)
  const [commandPhase, setCommandPhase] = useState<'idle' | 'planning' | 'executing'>(
    'idle',
  )

  useEffect(() => {
    let cancelled = false

    async function bootstrapSession() {
      syncMindmapApiBaseOverride()
      const storedId = readStoredSessionId()

      try {
        const loadedSession = storedId
          ? await loadRemoteSession(storedId)
          : await createRemoteSession()

        storeSessionId(loadedSession.id)

        if (!cancelled) {
          setSession(loadedSession)
        }
      } catch {
        const freshSession = await createRemoteSession()
        storeSessionId(freshSession.id)

        if (!cancelled) {
          setSession(freshSession)
        }
      }
    }

    void bootstrapSession()

    return () => {
      cancelled = true
    }
  }, [])

  const currentSession = session ?? makePlaceholderSession()
  const selectedNode = getSelectedNode(currentSession.graph)
  const latestArtifact = findLatestArtifact(currentSession.graph)

  async function generateFromPrompt(prompt: string) {
    const trimmedPrompt = prompt.trim()

    if (!session || !trimmedPrompt) {
      return
    }

    const nextSession = await generateRemoteMap({
      sessionId: session.id,
      prompt: trimmedPrompt,
      actorId: 'browser-user',
    })

    setCommandPlan(null)
    setPlannedSelection(null)
    setCommandError(null)
    setCommandPhase('idle')
    setSession(nextSession)
  }

  function selectNode(nodeId: string) {
    setSession((current) => (current ? withSelection(current, nodeId) : current))
  }

  async function renameSelectedNode(title: string) {
    if (!session || !selectedNode) {
      return
    }

    const nextSession = await applyRemoteEdits({
      sessionId: session.id,
      edits: [
        {
          type: 'update_node',
          nodeId: selectedNode.id,
          patch: { title },
        },
      ],
      actorId: 'browser-user',
      summary: `Renamed node to "${title}".`,
    })

    setCommandPlan(null)
    setPlannedSelection(null)
    setCommandError(null)
    setCommandPhase('idle')
    setSession(withSelection(nextSession, selectedNode.id))
  }

  async function addChildNode() {
    if (!session || !selectedNode) {
      return
    }

    const nextIndex = countNewNodesUnderParent(session.graph, selectedNode.id) + 1
    const title = `New node ${nextIndex}`
    const node = {
      id:
        typeof globalThis.crypto?.randomUUID === 'function'
          ? `n_${globalThis.crypto.randomUUID()}`
          : `n_${Math.random().toString(16).slice(2)}`,
      parentId: selectedNode.id,
      kind: 'note' as const,
      title,
    }
    const nextSession = await applyRemoteEdits({
      sessionId: session.id,
      edits: [
        {
          type: 'create_node',
          node,
        },
      ],
      actorId: 'browser-user',
      summary: `Added child node "${title}".`,
    })

    setCommandPlan(null)
    setPlannedSelection(null)
    setCommandError(null)
    setCommandPhase('idle')
    setSession(withSelection(nextSession, selectedNode.id))
  }

  async function deleteSelectedNode() {
    if (!session || !selectedNode || selectedNode.parentId === null) {
      return
    }

    const nextSession = await applyRemoteEdits({
      sessionId: session.id,
      edits: [
        {
          type: 'delete_node',
          nodeId: selectedNode.id,
        },
      ],
      actorId: 'browser-user',
      summary: `Deleted node "${selectedNode.title}".`,
    })

    setCommandPlan(null)
    setPlannedSelection(null)
    setCommandError(null)
    setCommandPhase('idle')
    setSession(withSelection(nextSession, selectedNode.parentId))
  }

  async function expandSelectedBranch(instruction: string) {
    if (!session || !selectedNode) {
      return
    }

    const nextSession = await runRemoteIntent({
      sessionId: session.id,
      intent: 'expand_branch',
      targetNodeId: selectedNode.id,
      instruction,
      actorId: 'browser-user',
    })

    setCommandPlan(null)
    setPlannedSelection(null)
    setCommandError(null)
    setCommandPhase('idle')
    setSession(withSelection(nextSession, selectedNode.id))
  }

  async function createOutline() {
    if (!session) {
      return
    }

    const nextSession = await runRemoteIntent({
      sessionId: session.id,
      intent: 'create_outline',
      targetNodeId: session.graph.rootNodeId,
      actorId: 'browser-user',
    })
    const nextSelectedNodeId =
      selectedNode?.id ?? nextSession.graph.selection.focusedNodeId ?? nextSession.graph.rootNodeId

    setCommandPlan(null)
    setPlannedSelection(null)
    setCommandError(null)
    setCommandPhase('idle')
    setSession(withSelection(nextSession, nextSelectedNodeId))
  }

  async function previewCommand(input: string) {
    const trimmedInput = input.trim()

    if (!session || !trimmedInput) {
      setCommandPlan(null)
      setPlannedSelection(null)
      setCommandError(null)
      setCommandPhase('idle')
      return
    }

    setCommandPhase('planning')
    setCommandError(null)

    try {
      const nextPlan = await planRemoteCommand({
        sessionId: session.id,
        input: trimmedInput,
        actorId: 'browser-user',
        selection: session.graph.selection,
      })

      setCommandPlan(nextPlan)
      setPlannedSelection(session.graph.selection)
    } catch (error) {
      setCommandPlan(null)
      setPlannedSelection(null)
      setCommandError(error instanceof Error ? error.message : String(error))
    } finally {
      setCommandPhase('idle')
    }
  }

  async function runCommand(input: string) {
    const trimmedInput = input.trim()

    if (!session || !trimmedInput) {
      return
    }

    setCommandPhase('executing')
    setCommandError(null)

    try {
      const result = await runRemoteCommand({
        sessionId: session.id,
        input: trimmedInput,
        actorId: 'browser-user',
        selection: session.graph.selection,
      })

      setCommandPlan(result.plan)
      setPlannedSelection(null)
      setSession(result.session)
    } catch (error) {
      setCommandError(error instanceof Error ? error.message : String(error))
      try {
        const refreshedSession = await loadRemoteSession(session.id)
        setSession(refreshedSession)
      } catch {
        // Keep the current browser state if the refresh also fails.
      }
    } finally {
      setCommandPhase('idle')
    }
  }

  async function applyPlannedCommand() {
    if (!session || !commandPlan) {
      return
    }

    setCommandPhase('executing')
    setCommandError(null)

    try {
      const result = await applyRemoteCommandPlan({
        sessionId: session.id,
        plan: commandPlan,
        actorId: 'browser-user',
        selection: plannedSelection ?? undefined,
      })

      setCommandPlan(result.plan)
      setPlannedSelection(null)
      setSession(result.session)
    } catch (error) {
      setCommandError(error instanceof Error ? error.message : String(error))

      try {
        const refreshedSession = await loadRemoteSession(session.id)
        setSession(refreshedSession)
      } catch {
        // Keep the current browser state if the refresh also fails.
      }
    } finally {
      setCommandPhase('idle')
    }
  }

  async function replayCommandRun(commandRunId: string) {
    if (!session) {
      return
    }

    setCommandPhase('executing')
    setCommandError(null)

    try {
      const result = await replayRemoteCommandRun({
        sessionId: session.id,
        commandRunId,
        actorId: 'browser-user',
      })

      setCommandPlan(result.plan)
      setPlannedSelection(null)
      setSession(result.session)
      setCommandError(null)
      setCommandPhase('idle')
    } catch (error) {
      setCommandError(error instanceof Error ? error.message : String(error))

      try {
        const refreshedSession = await loadRemoteSession(session.id)
        setSession(refreshedSession)
      } catch {
        // Keep the current browser state if the refresh also fails.
      }
    } finally {
      setCommandPhase('idle')
    }
  }

  async function resetSession() {
    const freshSession = await createRemoteSession()
    storeSessionId(freshSession.id)
    setCommandPlan(null)
    setPlannedSelection(null)
    setCommandError(null)
    setCommandPhase('idle')
    setSession(freshSession)
  }

  return {
    session: currentSession,
    selectedNode,
    latestArtifact,
    commandPlan,
    commandError,
    commandPhase,
    commandRuns: currentSession.commandRuns,
    generateFromPrompt,
    selectNode,
    renameSelectedNode,
    addChildNode,
    deleteSelectedNode,
    expandSelectedBranch,
    createOutline,
    previewCommand,
    runCommand,
    applyPlannedCommand,
    replayCommandRun,
    resetSession,
  }
}
