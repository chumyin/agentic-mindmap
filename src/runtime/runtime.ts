import { randomUUID } from 'node:crypto'
import { attachArtifact, applyGraphEdits, createGraph, setSelection } from '../core/graph'
import type {
  GraphEdit,
  MindmapActorType,
  MindmapNodeKind,
  MindmapSelection,
  OperationRecord,
} from '../core/graph-types'
import { planMindmapCommand } from './command-planner'
import { createSessionStore } from './session-store'
import { createMockProvider } from './mock-provider'
import { summarizeSession } from './protocol'
import type {
  ApplyCommandPlanInput,
  ApplyManualEditsInput,
  MindmapCommandPlan,
  MindmapCommandRun,
  ExecuteCommandInput,
  ExecuteCommandResult,
  GenerateMapInput,
  MindmapCommandToolCall,
  MindmapIntentType,
  MindmapProvider,
  MindmapSession,
  MindmapSessionSummary,
  PlanCommandInput,
  RunIntentInput,
  SessionStoreOptions,
} from './session-types'

function nowIso(): string {
  return new Date().toISOString()
}

function makeSessionId(): string {
  return `sess_${randomUUID()}`
}

function makeCommandRunId(): string {
  return `cmd_${randomUUID()}`
}

function slugifySegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function makeCommandChildNodeId(input: {
  graph: MindmapSession['graph']
  parentId: string
  title: string
}): string {
  const base = `${input.parentId}_${slugifySegment(input.title) || 'node'}`
  let index = 1
  let candidate = `${base}_${index}`

  while (input.graph.nodes[candidate]) {
    index += 1
    candidate = `${base}_${index}`
  }

  return candidate
}

function createOperationRecord(input: {
  type: string
  actorType: MindmapActorType
  actorId: string
  summary: string
  patches: GraphEdit[]
}): OperationRecord {
  return {
    id: `op_${randomUUID()}`,
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

function appendCommandRun(
  session: MindmapSession,
  commandRun: MindmapCommandRun,
): MindmapSession {
  return {
    ...session,
    updatedAt: nowIso(),
    commandRuns: [...session.commandRuns, commandRun],
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

function selectionFromPlanTarget(plan: MindmapCommandPlan): MindmapSelection | null {
  if (!plan.target.nodeId) {
    return null
  }

  return {
    focusedNodeId: plan.target.nodeId,
    selectedNodeIds: [plan.target.nodeId],
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
      commandRuns: [],
      provider: {
        mode: 'mock',
      },
    }

    return saveSession(session)
  }

  async function listSessions(): Promise<MindmapSessionSummary[]> {
    const sessions = await store.listSessions()
    return sessions.map((session) => summarizeSession(session))
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
        actorType: 'agent',
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
          actorType: 'agent',
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
        actorType: 'agent',
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
        actorType: input.actorType ?? 'user',
        actorId: input.actorId ?? 'user',
        summary: input.summary ?? `Applied ${input.edits.length} manual edits.`,
        patches: input.edits,
      }),
    )

    return saveSession(nextSession)
  }

  async function planCommand(input: PlanCommandInput) {
    const session = await loadSession(input.sessionId)
    return planMindmapCommand({
      session:
        input.selection === undefined
          ? session
          : {
              ...session,
              graph: setSelection(session.graph, input.selection),
            },
      input: input.input,
    })
  }

  async function listCommandRuns(sessionId: string): Promise<MindmapCommandRun[]> {
    const session = await loadSession(sessionId)
    return session.commandRuns
  }

  async function loadCommandRun(
    sessionId: string,
    commandRunId: string,
  ): Promise<MindmapCommandRun> {
    const commandRun = (await listCommandRuns(sessionId)).find(
      (entry) => entry.id === commandRunId,
    )

    if (!commandRun) {
      throw new Error(`Command run "${commandRunId}" was not found.`)
    }

    return commandRun
  }

  async function applyCommandPlan(
    input: ApplyCommandPlanInput,
  ): Promise<ExecuteCommandResult> {
    let currentSession = await loadSession(input.sessionId)
    const selection =
      input.selection ??
      selectionFromPlanTarget(input.plan) ??
      currentSession.graph.selection
    const actorId = input.actorId ?? 'command-agent'
    let completedToolCalls = 0

    try {
      for (const toolCall of input.plan.toolCalls) {
        currentSession = await executeToolCall({
          session: currentSession,
          toolCall,
          actorId: input.actorId,
        })
        completedToolCalls += 1
      }

      const nextSession = appendCommandRun(currentSession, {
        id: makeCommandRunId(),
        input: input.plan.input,
        actorId,
        createdAt: nowIso(),
        selection,
        replayOfCommandRunId: input.replayOfCommandRunId,
        status: 'executed',
        completedToolCalls,
        plan: input.plan,
      })

      return {
        plan: input.plan,
        session: await saveSession(nextSession),
      }
    } catch (error) {
      const nextSession = appendCommandRun(currentSession, {
        id: makeCommandRunId(),
        input: input.plan.input,
        actorId,
        createdAt: nowIso(),
        selection,
        replayOfCommandRunId: input.replayOfCommandRunId,
        status: 'failed',
        completedToolCalls,
        plan: input.plan,
        error: error instanceof Error ? error.message : String(error),
      })
      await saveSession(nextSession)
      throw error
    }
  }

  async function executeCommand(
    input: ExecuteCommandInput,
  ): Promise<ExecuteCommandResult> {
    const currentSession = await loadSession(input.sessionId)
    const selection = input.selection ?? currentSession.graph.selection
    const actorId = input.actorId ?? 'command-agent'
    let plan: MindmapCommandPlan | null = null

    try {
      plan = await planCommand(input)
    } catch (error) {
      const nextSession = appendCommandRun(currentSession, {
        id: makeCommandRunId(),
        input: input.input,
        actorId,
        createdAt: nowIso(),
        selection,
        replayOfCommandRunId: input.replayOfCommandRunId,
        status: 'failed',
        completedToolCalls: 0,
        plan,
        error: error instanceof Error ? error.message : String(error),
      })
      await saveSession(nextSession)
      throw error
    }

    const resolvedPlan = plan

    return applyCommandPlan({
      sessionId: input.sessionId,
      plan: resolvedPlan,
      actorId: input.actorId,
      selection: input.selection,
      replayOfCommandRunId: input.replayOfCommandRunId,
    })
  }

  async function replayCommandRun(
    sessionId: string,
    commandRunId: string,
    actorId?: string,
  ): Promise<ExecuteCommandResult> {
    const commandRun = await loadCommandRun(sessionId, commandRunId)

    if (!commandRun.plan) {
      throw new Error(
        `Command run "${commandRunId}" cannot be replayed because no plan was captured.`,
      )
    }

    return applyCommandPlan({
      sessionId,
      plan: commandRun.plan,
      actorId: actorId ?? commandRun.actorId,
      selection: commandRun.selection,
      replayOfCommandRunId: commandRun.id,
    })
  }

  async function executeToolCall(input: {
    session: MindmapSession
    toolCall: MindmapCommandToolCall
    actorId?: string
  }): Promise<MindmapSession> {
    switch (input.toolCall.toolName) {
      case 'generate_map':
        return generateMap({
          sessionId: input.session.id,
          prompt: String(input.toolCall.arguments.prompt ?? ''),
          actorId: input.actorId ?? 'command-agent',
        })
      case 'rename_node':
        return applyManualEdits({
          sessionId: input.session.id,
          edits: [
            {
              type: 'update_node',
              nodeId: String(input.toolCall.arguments.nodeId ?? ''),
              patch: {
                title: String(input.toolCall.arguments.title ?? ''),
              },
            },
          ],
          actorId: input.actorId ?? 'command-agent',
          actorType: 'agent',
          summary: `Renamed node to "${String(input.toolCall.arguments.title ?? '')}".`,
        })
      case 'add_child_node': {
        const parentId = String(input.toolCall.arguments.parentId ?? '')
        const title = String(input.toolCall.arguments.title ?? '')
        const kind =
          typeof input.toolCall.arguments.kind === 'string'
            ? (input.toolCall.arguments.kind as MindmapNodeKind)
            : 'note'
        const nodeId = makeCommandChildNodeId({
          graph: input.session.graph,
          parentId,
          title,
        })

        return applyManualEdits({
          sessionId: input.session.id,
          edits: [
            {
              type: 'create_node',
              node: {
                id: nodeId,
                parentId,
                kind,
                title,
              },
            },
          ],
          actorId: input.actorId ?? 'command-agent',
          actorType: 'agent',
          summary: `Added child node "${title}".`,
        })
      }
      case 'delete_node':
        return applyManualEdits({
          sessionId: input.session.id,
          edits: [
            {
              type: 'delete_node',
              nodeId: String(input.toolCall.arguments.nodeId ?? ''),
            },
          ],
          actorId: input.actorId ?? 'command-agent',
          actorType: 'agent',
          summary: `Deleted node "${String(input.toolCall.arguments.nodeId ?? '')}".`,
        })
      case 'run_intent':
        return runIntent({
          sessionId: input.session.id,
          intent: input.toolCall.arguments.intent as MindmapIntentType,
          targetNodeId: String(input.toolCall.arguments.targetNodeId ?? ''),
          instruction:
            typeof input.toolCall.arguments.instruction === 'string'
              ? input.toolCall.arguments.instruction
              : undefined,
          actorId: input.actorId ?? 'command-agent',
        })
    }
  }

  return {
    createSession,
    loadSession,
    listSessions,
    listCommandRuns,
    loadCommandRun,
    applyCommandPlan,
    generateMap,
    runIntent,
    applyManualEdits,
    planCommand,
    executeCommand,
    replayCommandRun,
  }
}
