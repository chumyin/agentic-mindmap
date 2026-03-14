/// <reference types="node" />

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { executeCli } from './index'

describe('mindmap cli', () => {
  let rootDir = ''

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), 'agentic-mindmap-cli-'))
  })

  afterEach(async () => {
    if (rootDir) {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  it('creates a session and returns machine-readable JSON', async () => {
    const result = await executeCli(['session', 'create', '--root-dir', rootDir])
    const payload = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(0)
    expect(payload.session.id).toMatch(/^sess_/)
    expect(payload.session.graph.rootNodeId).toBe('n_root')
  })

  it('shows an existing session by id', async () => {
    const created = await executeCli(['session', 'create', '--root-dir', rootDir])
    const sessionId = JSON.parse(created.stdout).session.id as string

    const shown = await executeCli([
      'session',
      'show',
      '--root-dir',
      rootDir,
      '--session',
      sessionId,
    ])

    const payload = JSON.parse(shown.stdout)

    expect(shown.exitCode).toBe(0)
    expect(payload.session.id).toBe(sessionId)
  })

  it('lists session summaries for agent discovery', async () => {
    const created = await executeCli(['session', 'create', '--root-dir', rootDir])
    const sessionId = JSON.parse(created.stdout).session.id as string

    await executeCli(['generate', '--root-dir', rootDir, '--session', sessionId], {
      stdin: JSON.stringify({
        prompt: 'Launch strategy for a new B2B analytics product',
      }),
    })

    const listed = await executeCli(['session', 'list', '--root-dir', rootDir])
    const payload = JSON.parse(listed.stdout) as {
      sessions: Array<{
        id: string
        rootTitle: string
      }>
    }

    expect(listed.exitCode).toBe(0)
    expect(payload.sessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: sessionId,
          rootTitle: 'Launch strategy for a new B2B analytics product',
        }),
      ]),
    )
  })

  it('prints a protocol description for external agent clients', async () => {
    const described = await executeCli(['describe', '--root-dir', rootDir])
    const payload = JSON.parse(described.stdout) as {
      supportedIntents: string[]
      supportedCommandTools: string[]
      planningContract: {
        supportsCompoundCommands: boolean
        supportsPlanApply: boolean
        planApplyAtomic: boolean
      }
      replayContract: {
        mode: string
        reappliesStoredSelection: boolean
      }
      sessionSummaryFields: string[]
      commandRunFields: string[]
      routes: Array<{
        method: string
        path: string
      }>
    }

    expect(described.exitCode).toBe(0)
    expect(payload.supportedIntents).toContain('create_outline')
    expect(payload.supportedCommandTools).toContain('rename_node')
    expect(payload.planningContract.supportsCompoundCommands).toBe(true)
    expect(payload.planningContract.supportsPlanApply).toBe(true)
    expect(payload.planningContract.planApplyAtomic).toBe(true)
    expect(payload.replayContract).toMatchObject({
      mode: 'best_effort_current_state',
      reappliesStoredSelection: true,
    })
    expect(payload.sessionSummaryFields).toContain('commandRunCount')
    expect(payload.commandRunFields).toContain('status')
    expect(payload.commandRunFields).toContain('replayOfCommandRunId')
    expect(payload.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: 'GET',
          path: '/api/mindmap/describe',
        }),
        expect.objectContaining({
          method: 'GET',
          path: '/api/mindmap/session/:id/command',
        }),
        expect.objectContaining({
          method: 'POST',
          path: '/api/mindmap/session/:id/command/apply',
        }),
      ]),
    )
  })

  it('generates a graph from stdin JSON', async () => {
    const created = await executeCli(['session', 'create', '--root-dir', rootDir])
    const sessionId = JSON.parse(created.stdout).session.id as string

    const generated = await executeCli(
      ['generate', '--root-dir', rootDir, '--session', sessionId],
      {
        stdin: JSON.stringify({
          prompt: 'Launch strategy for a new B2B analytics product',
        }),
      },
    )

    const payload = JSON.parse(generated.stdout)

    expect(generated.exitCode).toBe(0)
    expect(payload.session.graph.nodes.n_root.title).toBe(
      'Launch strategy for a new B2B analytics product',
    )
    expect(payload.session.graph.nodes.n_root.children.length).toBeGreaterThan(0)
  })

  it('runs an intent action through the cli', async () => {
    const created = await executeCli(['session', 'create', '--root-dir', rootDir])
    const sessionId = JSON.parse(created.stdout).session.id as string
    const generated = await executeCli(
      ['generate', '--root-dir', rootDir, '--session', sessionId],
      {
        stdin: JSON.stringify({
          prompt: 'Launch strategy for a new B2B analytics product',
        }),
      },
    )
    const generatedSession = JSON.parse(generated.stdout).session
    const targetNodeId = generatedSession.graph.nodes.n_root.children[0] as string

    const acted = await executeCli(
      ['act', '--root-dir', rootDir, '--session', sessionId],
      {
        stdin: JSON.stringify({
          intent: 'expand_branch',
          targetNodeId,
          instruction: 'Add risks and dependencies',
        }),
      },
    )

    const payload = JSON.parse(acted.stdout)

    expect(acted.exitCode).toBe(0)
    expect(payload.session.graph.nodes[targetNodeId].children.length).toBeGreaterThan(0)
  })

  it('applies manual graph edits through the cli', async () => {
    const created = await executeCli(['session', 'create', '--root-dir', rootDir])
    const sessionId = JSON.parse(created.stdout).session.id as string

    const edited = await executeCli(
      ['edit', '--root-dir', rootDir, '--session', sessionId],
      {
        stdin: JSON.stringify({
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
        }),
      },
    )

    const payload = JSON.parse(edited.stdout)

    expect(edited.exitCode).toBe(0)
    expect(payload.session.graph.nodes.n_manual).toMatchObject({
      title: 'Manual note',
      parentId: 'n_root',
    })
  })

  it('exports an outline artifact for a session', async () => {
    const created = await executeCli(['session', 'create', '--root-dir', rootDir])
    const sessionId = JSON.parse(created.stdout).session.id as string

    await executeCli(['generate', '--root-dir', rootDir, '--session', sessionId], {
      stdin: JSON.stringify({
        prompt: 'Launch strategy for a new B2B analytics product',
      }),
    })

    const exported = await executeCli([
      'export',
      '--root-dir',
      rootDir,
      '--session',
      sessionId,
      '--format',
      'outline',
    ])

    const payload = JSON.parse(exported.stdout)

    expect(exported.exitCode).toBe(0)
    expect(payload.artifact.kind).toBe('outline')
    expect(payload.artifact.content).toContain(
      'Launch strategy for a new B2B analytics product',
    )
  })

  it('serves the shared runtime api over http until aborted', async () => {
    const abortController = new AbortController()
    let apiBase = ''
    let describeUrl = ''
    let protocolVersion = ''

    const servePromise = executeCli(
      ['serve', '--root-dir', rootDir, '--host', '127.0.0.1', '--port', '0'],
      {
        signal: abortController.signal,
        onServeReady(info) {
          apiBase = info.apiBase
          describeUrl = info.describeUrl
          protocolVersion = info.protocolVersion
        },
      },
    )

    await vi.waitFor(() => {
      expect(apiBase).not.toBe('')
    })

    const described = await fetch(describeUrl)
    const describedPayload = (await described.json()) as {
      protocolVersion: string
    }
    const created = await fetch(`${apiBase}/session`, {
      method: 'POST',
    })
    const payload = (await created.json()) as {
      session: {
        id: string
      }
    }

    abortController.abort()

    const result = await servePromise

    expect(protocolVersion).toBe('0.1')
    expect(described.status).toBe(200)
    expect(describedPayload.protocolVersion).toBe('0.1')
    expect(created.status).toBe(200)
    expect(payload.session.id).toMatch(/^sess_/)
    expect(result.exitCode).toBe(0)
  })

  it('returns a non-zero exit code for an unknown session', async () => {
    const result = await executeCli([
      'session',
      'show',
      '--root-dir',
      rootDir,
      '--session',
      'sess_missing',
    ])

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('sess_missing')
  })

  it('plans and executes natural-language commands for agent control', async () => {
    const created = await executeCli(['session', 'create', '--root-dir', rootDir])
    const sessionId = JSON.parse(created.stdout).session.id as string

    await executeCli(['generate', '--root-dir', rootDir, '--session', sessionId], {
      stdin: JSON.stringify({
        prompt: 'Launch strategy for a new B2B analytics product',
      }),
    })

    await executeCli(['edit', '--root-dir', rootDir, '--session', sessionId], {
      stdin: JSON.stringify({
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
      }),
    })

    const planned = await executeCli(
      ['command', '--root-dir', rootDir, '--session', sessionId],
      {
        stdin: JSON.stringify({
          input: 'Rename this node to Priority goals',
          mode: 'plan',
        }),
      },
    )
    const plannedPayload = JSON.parse(planned.stdout) as {
      plan: {
        toolCalls: Array<{
          toolName: string
          arguments: Record<string, unknown>
        }>
      }
    }

    expect(planned.exitCode).toBe(0)
    expect(plannedPayload.plan.toolCalls).toEqual([
      expect.objectContaining({
        toolName: 'rename_node',
        arguments: expect.objectContaining({
          nodeId: 'n_root_goals_1',
          title: 'Priority goals',
        }),
      }),
    ])

    const executed = await executeCli(
      ['command', '--root-dir', rootDir, '--session', sessionId],
      {
        stdin: JSON.stringify({
          input: 'Rename this node to Priority goals',
          mode: 'execute',
        }),
      },
    )
    const executedPayload = JSON.parse(executed.stdout) as {
      session: {
        graph: {
          nodes: Record<string, { title: string }>
        }
      }
    }

    expect(executed.exitCode).toBe(0)
    expect(executedPayload.session.graph.nodes.n_root_goals_1?.title).toBe(
      'Priority goals',
    )
  })

  it('executes compound natural-language commands for agent control', async () => {
    const created = await executeCli(['session', 'create', '--root-dir', rootDir])
    const sessionId = JSON.parse(created.stdout).session.id as string

    await executeCli(['generate', '--root-dir', rootDir, '--session', sessionId], {
      stdin: JSON.stringify({
        prompt: 'Launch strategy for a new B2B analytics product',
      }),
    })

    const executed = await executeCli(
      ['command', '--root-dir', rootDir, '--session', sessionId],
      {
        stdin: JSON.stringify({
          input:
            'Rename this node to Priority goals and add child node called Success metrics',
          mode: 'execute',
          selection: {
            focusedNodeId: 'n_root_goals_1',
            selectedNodeIds: ['n_root_goals_1'],
          },
        }),
      },
    )
    const executedPayload = JSON.parse(executed.stdout) as {
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
          status: string
          completedToolCalls: number
        }>
      }
    }

    expect(executed.exitCode).toBe(0)
    expect(executedPayload.plan.toolCalls).toHaveLength(2)
    expect(executedPayload.session.graph.nodes.n_root_goals_1?.title).toBe(
      'Priority goals',
    )
    expect(executedPayload.session.commandRuns.at(-1)).toMatchObject({
      status: 'executed',
      completedToolCalls: 2,
    })
    expect(
      Object.values(executedPayload.session.graph.nodes).some(
        (node) =>
          node.parentId === 'n_root_goals_1' && node.title === 'Success metrics',
      ),
    ).toBe(true)
  })

  it('returns a visible error and persists a failed command run for unsupported commands', async () => {
    const created = await executeCli(['session', 'create', '--root-dir', rootDir])
    const sessionId = JSON.parse(created.stdout).session.id as string

    const result = await executeCli(
      ['command', '--root-dir', rootDir, '--session', sessionId],
      {
        stdin: JSON.stringify({
          input: 'Teleport this map into a spreadsheet',
          mode: 'execute',
        }),
      },
    )

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Unsupported natural-language command')

    const shown = await executeCli([
      'session',
      'show',
      '--root-dir',
      rootDir,
      '--session',
      sessionId,
    ])
    const shownPayload = JSON.parse(shown.stdout) as {
      session: {
        commandRuns: Array<{
          status: string
          error?: string
        }>
      }
    }

    expect(shownPayload.session.commandRuns.at(-1)).toMatchObject({
      status: 'failed',
      error: expect.stringMatching(/unsupported natural-language command/i),
    })
  })

  it('lists, shows, and replays persisted command runs through the cli', async () => {
    const created = await executeCli(['session', 'create', '--root-dir', rootDir])
    const sessionId = JSON.parse(created.stdout).session.id as string

    await executeCli(['generate', '--root-dir', rootDir, '--session', sessionId], {
      stdin: JSON.stringify({
        prompt: 'Launch strategy for a new B2B analytics product',
      }),
    })

    const executed = await executeCli(
      ['command', '--root-dir', rootDir, '--session', sessionId],
      {
        stdin: JSON.stringify({
          input:
            'Rename this node to Priority goals and add child node called Success metrics',
          mode: 'execute',
          selection: {
            focusedNodeId: 'n_root_goals_1',
            selectedNodeIds: ['n_root_goals_1'],
          },
        }),
      },
    )
    const executedPayload = JSON.parse(executed.stdout) as {
      session: {
        commandRuns: Array<{
          id: string
        }>
      }
    }
    const commandRunId = executedPayload.session.commandRuns.at(-1)?.id

    expect(commandRunId).toBeDefined()

    const listed = await executeCli([
      'command',
      'list',
      '--root-dir',
      rootDir,
      '--session',
      sessionId,
    ])
    const listedPayload = JSON.parse(listed.stdout) as {
      commandRuns: Array<{
        id: string
        status: string
      }>
    }

    expect(listed.exitCode).toBe(0)
    expect(listedPayload.commandRuns).toEqual([
      expect.objectContaining({
        id: commandRunId,
        status: 'executed',
      }),
    ])

    const shown = await executeCli([
      'command',
      'show',
      '--root-dir',
      rootDir,
      '--session',
      sessionId,
      '--run',
      commandRunId as string,
    ])
    const shownPayload = JSON.parse(shown.stdout) as {
      commandRun: {
        id: string
        input: string
      }
    }

    expect(shown.exitCode).toBe(0)
    expect(shownPayload.commandRun).toMatchObject({
      id: commandRunId,
      input:
        'Rename this node to Priority goals and add child node called Success metrics',
    })

    const replayed = await executeCli(
      [
        'command',
        'replay',
        '--root-dir',
        rootDir,
        '--session',
        sessionId,
        '--run',
        commandRunId as string,
      ],
      {
        stdin: JSON.stringify({
          actorId: 'replay-agent',
        }),
      },
    )
    const replayedPayload = JSON.parse(replayed.stdout) as {
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

    expect(replayed.exitCode).toBe(0)
    expect(replayedPayload.plan.toolCalls).toHaveLength(2)
    expect(replayedPayload.session.commandRuns).toHaveLength(2)
    expect(replayedPayload.session.commandRuns.at(-1)).toMatchObject({
      actorId: 'replay-agent',
      replayOfCommandRunId: commandRunId,
    })
    expect(
      Object.values(replayedPayload.session.graph.nodes).filter(
        (node) =>
          node.parentId === 'n_root_goals_1' && node.title === 'Success metrics',
      ),
    ).toHaveLength(2)
  })

  it('applies a supplied command plan through the cli', async () => {
    const created = await executeCli(['session', 'create', '--root-dir', rootDir])
    const sessionId = JSON.parse(created.stdout).session.id as string

    await executeCli(['generate', '--root-dir', rootDir, '--session', sessionId], {
      stdin: JSON.stringify({
        prompt: 'Launch strategy for a new B2B analytics product',
      }),
    })

    const planned = await executeCli(
      ['command', '--root-dir', rootDir, '--session', sessionId],
      {
        stdin: JSON.stringify({
          input: 'Rename this node to Priority goals',
          mode: 'plan',
          selection: {
            focusedNodeId: 'n_root_goals_1',
            selectedNodeIds: ['n_root_goals_1'],
          },
        }),
      },
    )
    const plannedPayload = JSON.parse(planned.stdout) as {
      plan: {
        input: string
        toolCalls: Array<unknown>
      }
    }

    await executeCli(['edit', '--root-dir', rootDir, '--session', sessionId], {
      stdin: JSON.stringify({
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
      }),
    })

    const applied = await executeCli(
      ['command', 'apply', '--root-dir', rootDir, '--session', sessionId],
      {
        stdin: JSON.stringify({
          plan: plannedPayload.plan,
        }),
      },
    )
    const appliedPayload = JSON.parse(applied.stdout) as {
      session: {
        graph: {
          nodes: Record<
            string,
            {
              title: string
            }
          >
        }
        commandRuns: Array<{
          selection: {
            focusedNodeId: string | null
            selectedNodeIds: string[]
          }
        }>
      }
    }

    expect(applied.exitCode).toBe(0)
    expect(appliedPayload.session.graph.nodes.n_root_goals_1?.title).toBe(
      'Priority goals',
    )
    expect(appliedPayload.session.graph.nodes.n_root_audience_2?.title).toBe(
      'Audience',
    )
    expect(appliedPayload.session.commandRuns.at(-1)).toMatchObject({
      selection: {
        focusedNodeId: 'n_root_goals_1',
        selectedNodeIds: ['n_root_goals_1'],
      },
    })
  })
})
