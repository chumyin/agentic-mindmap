/// <reference types="node" />

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { MindmapArtifact } from '../core/graph-types'
import type { MindmapSession } from './session-types'
import { createMindmapApiHandler } from './api'

type SessionBody = {
  session: MindmapSession
}

type ArtifactBody = {
  artifact: MindmapArtifact
}

describe('mindmap api handler', () => {
  let rootDir = ''

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), 'agentic-mindmap-api-'))
  })

  afterEach(async () => {
    if (rootDir) {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  it('creates and returns a session', async () => {
    const handler = createMindmapApiHandler({ rootDir })

    const response = await handler({
      method: 'POST',
      url: '/api/mindmap/session',
    })
    const session = (response.body as SessionBody).session

    expect(response.status).toBe(200)
    expect(session.id).toMatch(/^sess_/)
  })

  it('exposes health, protocol description, and session summaries for agent clients', async () => {
    const handler = createMindmapApiHandler({ rootDir })
    const created = await handler({
      method: 'POST',
      url: '/api/mindmap/session',
    })
    const sessionId = (created.body as SessionBody).session.id

    await handler({
      method: 'POST',
      url: `/api/mindmap/session/${sessionId}/generate`,
      body: {
        prompt: 'Launch strategy for a new B2B analytics product',
      },
    })

    const health = await handler({
      method: 'GET',
      url: '/api/mindmap/health',
    })
    const described = await handler({
      method: 'GET',
      url: '/api/mindmap/describe',
    })
    const listed = await handler({
      method: 'GET',
      url: '/api/mindmap/session',
    })
    const listBody = listed.body as {
      sessions: Array<{
        id: string
        rootTitle: string
        nodeCount: number
        commandRunCount: number
      }>
    }

    expect(health.status).toBe(200)
    expect(health.body.status).toBe('ok')
    expect(described.status).toBe(200)
    expect(described.body.supportedIntents).toContain('expand_branch')
    expect(described.body.supportedCommandTools).toContain('rename_node')
    expect(described.body.planningContract).toMatchObject({
      previewBeforeExecute: true,
      supportsCompoundCommands: true,
      supportsPlanApply: true,
      planApplyAtomic: true,
    })
    expect(described.body.replayContract).toMatchObject({
      mode: 'best_effort_current_state',
      reappliesStoredSelection: true,
    })
    expect(described.body.sessionSummaryFields).toContain('commandRunCount')
    expect(described.body.commandRunFields).toContain('status')
    expect(described.body.commandRunFields).toContain('replayOfCommandRunId')
    expect(described.body.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: 'GET',
          path: '/api/mindmap/session',
        }),
        expect.objectContaining({
          method: 'GET',
          path: '/api/mindmap/session/:id/command',
        }),
        expect.objectContaining({
          method: 'POST',
          path: '/api/mindmap/session/:id/command/:commandRunId/replay',
        }),
        expect.objectContaining({
          method: 'POST',
          path: '/api/mindmap/session/:id/command/apply',
        }),
      ]),
    )
    expect(listed.status).toBe(200)
    expect(listBody.sessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: sessionId,
          rootTitle: 'Launch strategy for a new B2B analytics product',
        }),
      ]),
    )
    expect(listBody.sessions[0]?.nodeCount).toBeGreaterThan(0)
    expect(listBody.sessions[0]?.commandRunCount).toBeGreaterThanOrEqual(0)
  })

  it('supports show, generate, edit, intent, and export routes on the same session backend', async () => {
    const handler = createMindmapApiHandler({ rootDir })
    const created = await handler({
      method: 'POST',
      url: '/api/mindmap/session',
    })
    const sessionId = (created.body as SessionBody).session.id

    const generated = await handler({
      method: 'POST',
      url: `/api/mindmap/session/${sessionId}/generate`,
      body: {
        prompt: 'Launch strategy for a new B2B analytics product',
      },
    })
    const generatedSession = (generated.body as SessionBody).session

    expect(generatedSession.graph.nodes.n_root.title).toBe(
      'Launch strategy for a new B2B analytics product',
    )

    const edited = await handler({
      method: 'POST',
      url: `/api/mindmap/session/${sessionId}/edit`,
      body: {
        edits: [
          {
            type: 'create_node',
            node: {
              id: 'n_manual',
              parentId: 'n_root',
              kind: 'note',
              title: 'Manual note',
            },
          },
        ],
      },
    })
    const editedSession = (edited.body as SessionBody).session

    expect(editedSession.graph.nodes.n_manual.title).toBe('Manual note')

    const targetNodeId = generatedSession.graph.nodes.n_root.children[0] as string
    const acted = await handler({
      method: 'POST',
      url: `/api/mindmap/session/${sessionId}/intent`,
      body: {
        intent: 'expand_branch',
        targetNodeId,
        instruction: 'Add risks and dependencies',
      },
    })
    const actedSession = (acted.body as SessionBody).session

    expect(actedSession.graph.nodes[targetNodeId].children.length).toBeGreaterThan(0)

    const exported = await handler({
      method: 'GET',
      url: `/api/mindmap/session/${sessionId}/export?format=outline`,
    })
    const exportedArtifact = (exported.body as ArtifactBody).artifact

    expect(exportedArtifact.kind).toBe('outline')
    expect(exportedArtifact.content).toContain(
      'Launch strategy for a new B2B analytics product',
    )

    const shown = await handler({
      method: 'GET',
      url: `/api/mindmap/session/${sessionId}`,
    })
    const shownSession = (shown.body as SessionBody).session

    expect(shownSession.id).toBe(sessionId)
    expect(shownSession.history.length).toBeGreaterThan(0)
  })

  it('plans and executes natural-language commands for agent clients', async () => {
    const handler = createMindmapApiHandler({ rootDir })
    const created = await handler({
      method: 'POST',
      url: '/api/mindmap/session',
    })
    const sessionId = (created.body as SessionBody).session.id

    await handler({
      method: 'POST',
      url: `/api/mindmap/session/${sessionId}/generate`,
      body: {
        prompt: 'Launch strategy for a new B2B analytics product',
      },
    })

    await handler({
      method: 'POST',
      url: `/api/mindmap/session/${sessionId}/edit`,
      body: {
        edits: [
          {
            type: 'set_selection',
            selection: {
              focusedNodeId: 'n_root_goals_1',
              selectedNodeIds: ['n_root_goals_1'],
            },
          },
        ],
        summary: 'Selected Goals branch.',
      },
    })

    const planned = await handler({
      method: 'POST',
      url: `/api/mindmap/session/${sessionId}/command`,
      body: {
        input: 'Rename this node to Priority goals',
        mode: 'plan',
      },
    })
    const plannedBody = planned.body as {
      plan: {
        toolCalls: Array<{
          toolName: string
          arguments: Record<string, unknown>
        }>
      }
    }

    expect(planned.status).toBe(200)
    expect(plannedBody.plan.toolCalls).toEqual([
      expect.objectContaining({
        toolName: 'rename_node',
        arguments: expect.objectContaining({
          nodeId: 'n_root_goals_1',
          title: 'Priority goals',
        }),
      }),
    ])

    const executed = await handler({
      method: 'POST',
      url: `/api/mindmap/session/${sessionId}/command`,
      body: {
        input: 'Rename this node to Priority goals',
        mode: 'execute',
      },
    })
    const executedBody = executed.body as {
      session: MindmapSession
    }

    expect(executed.status).toBe(200)
    expect(executedBody.session.graph.nodes.n_root_goals_1?.title).toBe(
      'Priority goals',
    )
  })

  it('lists, shows, and replays command runs for agent clients', async () => {
    const handler = createMindmapApiHandler({ rootDir })
    const created = await handler({
      method: 'POST',
      url: '/api/mindmap/session',
    })
    const sessionId = (created.body as SessionBody).session.id

    await handler({
      method: 'POST',
      url: `/api/mindmap/session/${sessionId}/generate`,
      body: {
        prompt: 'Launch strategy for a new B2B analytics product',
      },
    })

    const executed = await handler({
      method: 'POST',
      url: `/api/mindmap/session/${sessionId}/command`,
      body: {
        input:
          'Rename this node to Priority goals and add child node called Success metrics',
        mode: 'execute',
        selection: {
          focusedNodeId: 'n_root_goals_1',
          selectedNodeIds: ['n_root_goals_1'],
        },
      },
    })
    const executedBody = executed.body as {
      session: {
        commandRuns: Array<{
          id: string
        }>
      }
    }
    const commandRunId = executedBody.session.commandRuns.at(-1)?.id

    expect(commandRunId).toBeDefined()

    const listed = await handler({
      method: 'GET',
      url: `/api/mindmap/session/${sessionId}/command`,
    })
    const listedBody = listed.body as {
      commandRuns: Array<{
        id: string
        status: string
      }>
    }

    expect(listed.status).toBe(200)
    expect(listedBody.commandRuns).toEqual([
      expect.objectContaining({
        id: commandRunId,
        status: 'executed',
      }),
    ])

    const shown = await handler({
      method: 'GET',
      url: `/api/mindmap/session/${sessionId}/command/${commandRunId}`,
    })
    const shownBody = shown.body as {
      commandRun: {
        id: string
        input: string
      }
    }

    expect(shown.status).toBe(200)
    expect(shownBody.commandRun).toMatchObject({
      id: commandRunId,
      input:
        'Rename this node to Priority goals and add child node called Success metrics',
    })

    const replayed = await handler({
      method: 'POST',
      url: `/api/mindmap/session/${sessionId}/command/${commandRunId}/replay`,
      body: {
        actorId: 'replay-agent',
      },
    })
    const replayedBody = replayed.body as {
      plan: {
        toolCalls: Array<unknown>
      }
      session: {
        graph: {
          nodes: Record<
            string,
            {
              title: string
              parentId: string | null
            }
          >
        }
        commandRuns: Array<{
          actorId: string
          replayOfCommandRunId?: string
        }>
      }
    }

    expect(replayed.status).toBe(200)
    expect(replayedBody.plan.toolCalls).toHaveLength(2)
    expect(replayedBody.session.commandRuns).toHaveLength(2)
    expect(replayedBody.session.commandRuns.at(-1)).toMatchObject({
      actorId: 'replay-agent',
      replayOfCommandRunId: commandRunId,
    })
    expect(
      Object.values(replayedBody.session.graph.nodes).filter(
        (node) =>
          node.parentId === 'n_root_goals_1' && node.title === 'Success metrics',
      ),
    ).toHaveLength(2)
  })

  it('applies a supplied command plan for agent clients', async () => {
    const handler = createMindmapApiHandler({ rootDir })
    const created = await handler({
      method: 'POST',
      url: '/api/mindmap/session',
    })
    const sessionId = (created.body as SessionBody).session.id

    await handler({
      method: 'POST',
      url: `/api/mindmap/session/${sessionId}/generate`,
      body: {
        prompt: 'Launch strategy for a new B2B analytics product',
      },
    })

    const planned = await handler({
      method: 'POST',
      url: `/api/mindmap/session/${sessionId}/command`,
      body: {
        input: 'Rename this node to Priority goals',
        mode: 'plan',
        selection: {
          focusedNodeId: 'n_root_goals_1',
          selectedNodeIds: ['n_root_goals_1'],
        },
      },
    })
    const plannedBody = planned.body as {
      plan: {
        input: string
        toolCalls: Array<unknown>
      }
    }

    await handler({
      method: 'POST',
      url: `/api/mindmap/session/${sessionId}/edit`,
      body: {
        edits: [
          {
            type: 'set_selection',
            selection: {
              focusedNodeId: 'n_root_audience_2',
              selectedNodeIds: ['n_root_audience_2'],
            },
          },
        ],
        summary: 'Changed selection before applying the previewed plan.',
      },
    })

    const applied = await handler({
      method: 'POST',
      url: `/api/mindmap/session/${sessionId}/command/apply`,
      body: {
        plan: plannedBody.plan,
      },
    })
    const appliedBody = applied.body as {
      session: MindmapSession
    }

    expect(applied.status).toBe(200)
    expect(appliedBody.session.graph.nodes.n_root_goals_1?.title).toBe(
      'Priority goals',
    )
    expect(appliedBody.session.graph.nodes.n_root_audience_2?.title).toBe('Audience')
    expect(appliedBody.session.commandRuns.at(-1)).toMatchObject({
      selection: {
        focusedNodeId: 'n_root_goals_1',
        selectedNodeIds: ['n_root_goals_1'],
      },
      plan: expect.objectContaining({
        input: 'Rename this node to Priority goals',
      }),
    })
  })

  it('returns a clean protocol error for invalid externally supplied plans', async () => {
    const handler = createMindmapApiHandler({ rootDir })
    const created = await handler({
      method: 'POST',
      url: '/api/mindmap/session',
    })
    const sessionId = (created.body as SessionBody).session.id

    const applied = await handler({
      method: 'POST',
      url: `/api/mindmap/session/${sessionId}/command/apply`,
      body: {
        plan: {
          input: 'Do something invalid',
          summary: 'Invalid test plan.',
          target: {
            sessionId,
            nodeId: 'n_root',
            nodeTitle: 'Untitled map',
          },
          toolCalls: [
            {
              id: 'call_bogus_1',
              toolName: 'bogus',
              arguments: {},
            },
          ],
        },
      },
    })

    expect(applied.status).toBe(400)
    expect(applied.body.error).toContain('Unsupported command tool "bogus"')

    const shown = await handler({
      method: 'GET',
      url: `/api/mindmap/session/${sessionId}`,
    })
    const shownBody = shown.body as SessionBody
    expect(shownBody.session.commandRuns.at(-1)).toMatchObject({
      status: 'failed',
      error: 'Unsupported command tool "bogus".',
    })
  })
})
