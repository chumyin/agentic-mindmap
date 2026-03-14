import { randomUUID } from 'node:crypto'
import { attachArtifact, applyGraphEdits, createGraph, setSelection } from '../core/graph'
import type { GraphEdit, OperationRecord } from '../core/graph-types'
import { createSessionStore } from './session-store'
import { createMockProvider } from './mock-provider'
import type {
  ApplyManualEditsInput,
  GenerateMapInput,
  MindmapIntentType,
  MindmapProvider,
  MindmapSession,
  RunIntentInput,
  SessionStoreOptions,
} from './session-types'

function nowIso(): string {
  return new Date().toISOString()
}

function makeSessionId(): string {
  return `sess_${randomUUID()}`
}

function createOperationRecord(input: {
  type: string
  actorId: string
  summary: string
  patches: GraphEdit[]
}): OperationRecord {
  return {
    id: `op_${randomUUID()}`,
    type: input.type,
    actor: {
      type: 'agent',
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

async function resolveIntentResult(input: {
  intent: MindmapIntentType
  session: MindmapSession
  provider: MindmapProvider
  targetNodeId: string
  instruction?: string
}) {
  switch (input.intent) {
    case 'expand_branch':
      return {
        type: input.intent,
        mode: 'edits' as const,
        result: await input.provider.expandBranch({
          graph: input.session.graph,
          targetNodeId: input.targetNodeId,
          instruction: input.instruction,
        }),
      }
    case 'summarize_branch':
      return {
        type: input.intent,
        mode: 'artifact' as const,
        result: await input.provider.summarizeBranch({
          graph: input.session.graph,
          targetNodeId: input.targetNodeId,
        }),
      }
    case 'create_outline':
      return {
        type: input.intent,
        mode: 'artifact' as const,
        result: await input.provider.createOutline({
          graph: input.session.graph,
          targetNodeId: input.targetNodeId,
        }),
      }
  }
}

export function createMindmapRuntime(
  options: SessionStoreOptions & { provider?: MindmapProvider } = {},
) {
  const store = createSessionStore(options)
  const provider = options.provider ?? createMockProvider()

  async function saveSession(session: MindmapSession): Promise<MindmapSession> {
    await store.saveSession(session)
    return session
  }

  async function loadSession(sessionId: string): Promise<MindmapSession> {
    return store.loadSession(sessionId)
  }

  async function createSession(): Promise<MindmapSession> {
    const createdAt = nowIso()
    const session: MindmapSession = {
      id: makeSessionId(),
      createdAt,
      updatedAt: createdAt,
      graph: createGraph('Untitled map'),
      history: [],
      provider: {
        mode: 'mock',
      },
    }

    return saveSession(session)
  }

  async function generateMap(input: GenerateMapInput): Promise<MindmapSession> {
    const session = await loadSession(input.sessionId)
    const baseGraph = createGraph(input.prompt)
    const generation = await provider.generateInitialMap({
      prompt: input.prompt,
      rootNodeId: baseGraph.rootNodeId,
    })
    const graph = setSelection(
      applyGraphEdits(baseGraph, generation.edits),
      {
        focusedNodeId: baseGraph.rootNodeId,
        selectedNodeIds: [baseGraph.rootNodeId],
      },
    )
    const nextSession = appendHistory(
      {
        ...session,
        graph,
      },
      createOperationRecord({
        type: 'generate_map',
        actorId: input.actorId ?? 'system',
        summary: generation.summary,
        patches: generation.edits,
      }),
    )

    return saveSession(nextSession)
  }

  async function runIntent(input: RunIntentInput): Promise<MindmapSession> {
    const session = await loadSession(input.sessionId)
    const target = session.graph.nodes[input.targetNodeId]

    if (!target) {
      throw new Error(`Node "${input.targetNodeId}" was not found.`)
    }

    const resolved = await resolveIntentResult({
      intent: input.intent,
      session,
      provider,
      targetNodeId: input.targetNodeId,
      instruction: input.instruction,
    })

    if (resolved.mode === 'edits') {
      const graph = applyGraphEdits(session.graph, resolved.result.edits)
      const nextSession = appendHistory(
        {
          ...session,
          graph,
        },
        createOperationRecord({
          type: resolved.type,
          actorId: input.actorId ?? 'system',
          summary: resolved.result.summary,
          patches: resolved.result.edits,
        }),
      )

      return saveSession(nextSession)
    }

    const graph = attachArtifact(session.graph, resolved.result.artifact)
    const nextSession = appendHistory(
      {
        ...session,
        graph,
      },
      createOperationRecord({
        type: resolved.type,
        actorId: input.actorId ?? 'system',
        summary: resolved.result.summary,
        patches: [
          {
            type: 'attach_artifact',
            artifact: resolved.result.artifact,
          },
        ],
      }),
    )

    return saveSession(nextSession)
  }

  async function applyManualEdits(
    input: ApplyManualEditsInput,
  ): Promise<MindmapSession> {
    const session = await loadSession(input.sessionId)
    const graph = applyGraphEdits(session.graph, input.edits)
    const nextSession = appendHistory(
      {
        ...session,
        graph,
      },
      createOperationRecord({
        type: 'manual_edit',
        actorId: input.actorId ?? 'user',
        summary: input.summary ?? `Applied ${input.edits.length} manual edits.`,
        patches: input.edits,
      }),
    )

    return saveSession(nextSession)
  }

  return {
    createSession,
    loadSession,
    generateMap,
    runIntent,
    applyManualEdits,
  }
}
