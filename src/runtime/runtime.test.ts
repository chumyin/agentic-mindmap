/// <reference types="node" />

import { access, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMindmapRuntime } from './runtime'

describe('mindmap runtime', () => {
  let rootDir = ''

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), 'agentic-mindmap-runtime-'))
  })

  afterEach(async () => {
    if (rootDir) {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  it('creates and persists a session to the local store', async () => {
    const runtime = createMindmapRuntime({ rootDir })

    const session = await runtime.createSession()

    expect(session.id).toMatch(/^sess_/)
    expect(session.graph.rootNodeId).toBe('n_root')

    await access(
      join(rootDir, '.agentic-mindmap', 'sessions', `${session.id}.json`),
    )

    const reloaded = await runtime.loadSession(session.id)
    expect(reloaded.id).toBe(session.id)
    expect(reloaded.graph.rootNodeId).toBe('n_root')
  })

  it('generates an initial graph from prompt text and records history', async () => {
    const runtime = createMindmapRuntime({ rootDir })
    const session = await runtime.createSession()

    const generated = await runtime.generateMap({
      sessionId: session.id,
      prompt: 'Launch strategy for a new B2B analytics product',
      actorId: 'test-agent',
    })

    const root = generated.graph.nodes[generated.graph.rootNodeId]

    expect(root.title).toBe('Launch strategy for a new B2B analytics product')
    expect(root.children.length).toBeGreaterThan(0)
    expect(generated.history.at(-1)).toMatchObject({
      type: 'generate_map',
      actor: {
        type: 'agent',
        id: 'test-agent',
      },
    })
  })

  it('expands a selected branch through the runtime intent path', async () => {
    const runtime = createMindmapRuntime({ rootDir })
    const session = await runtime.createSession()
    const generated = await runtime.generateMap({
      sessionId: session.id,
      prompt: 'Launch strategy for a new B2B analytics product',
      actorId: 'test-agent',
    })

    const targetNodeId = generated.graph.nodes[generated.graph.rootNodeId].children[0]

    const expanded = await runtime.runIntent({
      sessionId: generated.id,
      intent: 'expand_branch',
      targetNodeId,
      instruction: 'Add risks and dependencies',
      actorId: 'test-agent',
    })

    expect(expanded.graph.nodes[targetNodeId].children.length).toBeGreaterThan(0)
    expect(expanded.history.at(-1)?.type).toBe('expand_branch')
  })

  it('creates an outline artifact and persists it on the session graph', async () => {
    const runtime = createMindmapRuntime({ rootDir })
    const session = await runtime.createSession()
    const generated = await runtime.generateMap({
      sessionId: session.id,
      prompt: 'Launch strategy for a new B2B analytics product',
      actorId: 'test-agent',
    })

    const outlined = await runtime.runIntent({
      sessionId: generated.id,
      intent: 'create_outline',
      targetNodeId: generated.graph.rootNodeId,
      actorId: 'test-agent',
    })

    const outlineArtifact = Object.values(outlined.graph.artifacts).find(
      (artifact) => artifact.kind === 'outline',
    )

    expect(outlineArtifact).toBeDefined()
    expect(outlineArtifact?.sourceNodeId).toBe(generated.graph.rootNodeId)
    expect(outlineArtifact?.content).toContain(
      'Launch strategy for a new B2B analytics product',
    )
  })

  it('reloads the saved session with its accumulated history', async () => {
    const runtime = createMindmapRuntime({ rootDir })
    const session = await runtime.createSession()

    await runtime.generateMap({
      sessionId: session.id,
      prompt: 'Launch strategy for a new B2B analytics product',
      actorId: 'test-agent',
    })
    await runtime.runIntent({
      sessionId: session.id,
      intent: 'create_outline',
      targetNodeId: 'n_root',
      actorId: 'test-agent',
    })

    const reloaded = await runtime.loadSession(session.id)

    expect(reloaded.history).toHaveLength(2)
    expect(reloaded.history.map((entry) => entry.type)).toEqual([
      'generate_map',
      'create_outline',
    ])
  })

  it('records manual edits as user-authored history by default', async () => {
    const runtime = createMindmapRuntime({ rootDir })
    const session = await runtime.createSession()

    const edited = await runtime.applyManualEdits({
      sessionId: session.id,
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
    })

    expect(edited.history.at(-1)).toMatchObject({
      type: 'manual_edit',
      actor: {
        type: 'user',
        id: 'user',
      },
    })
  })

  it('plans and executes a natural-language command through the shared runtime', async () => {
    const runtime = createMindmapRuntime({ rootDir })
    const session = await runtime.createSession()
    const generated = await runtime.generateMap({
      sessionId: session.id,
      prompt: 'Launch strategy for a new B2B analytics product',
      actorId: 'test-agent',
    })
    const targetNodeId = generated.graph.nodes[generated.graph.rootNodeId].children[0]

    await runtime.applyManualEdits({
      sessionId: generated.id,
      edits: [
        {
          type: 'set_selection',
          selection: {
            focusedNodeId: targetNodeId,
            selectedNodeIds: [targetNodeId],
          },
        },
      ],
      actorId: 'browser-user',
      summary: 'Selected Goals branch.',
    })

    const planned = await runtime.planCommand({
      sessionId: generated.id,
      input: 'Rename this node to Priority goals',
      actorId: 'test-agent',
    })

    expect(planned.toolCalls).toEqual([
      expect.objectContaining({
        toolName: 'rename_node',
        arguments: expect.objectContaining({
          nodeId: targetNodeId,
          title: 'Priority goals',
        }),
      }),
    ])

    const unchanged = await runtime.loadSession(generated.id)
    expect(unchanged.graph.nodes[targetNodeId]?.title).toBe('Goals')

    const executed = await runtime.executeCommand({
      sessionId: generated.id,
      input: 'Rename this node to Priority goals',
      actorId: 'test-agent',
    })

    expect(executed.plan.toolCalls).toHaveLength(1)
    expect(executed.session.graph.nodes[targetNodeId]?.title).toBe('Priority goals')
    expect(executed.session.commandRuns.at(-1)).toMatchObject({
      status: 'executed',
      completedToolCalls: 1,
      plan: expect.objectContaining({
        input: 'Rename this node to Priority goals',
      }),
    })
  })

  it('applies a previewed command plan without re-planning against the current selection', async () => {
    const runtime = createMindmapRuntime({ rootDir })
    const session = await runtime.createSession()
    const generated = await runtime.generateMap({
      sessionId: session.id,
      prompt: 'Launch strategy for a new B2B analytics product',
      actorId: 'test-agent',
    })
    const [targetNodeId, otherNodeId] =
      generated.graph.nodes[generated.graph.rootNodeId].children

    const plan = await runtime.planCommand({
      sessionId: generated.id,
      input: 'Rename this node to Priority goals',
      actorId: 'test-agent',
      selection: {
        focusedNodeId: targetNodeId,
        selectedNodeIds: [targetNodeId],
      },
    })

    await runtime.applyManualEdits({
      sessionId: generated.id,
      edits: [
        {
          type: 'set_selection',
          selection: {
            focusedNodeId: otherNodeId,
            selectedNodeIds: [otherNodeId],
          },
        },
      ],
      actorId: 'browser-user',
      summary: 'Changed selection before applying the previewed plan.',
    })

    const applied = await runtime.applyCommandPlan({
      sessionId: generated.id,
      plan,
      actorId: 'plan-agent',
    })

    expect(applied.session.graph.nodes[targetNodeId]?.title).toBe('Priority goals')
    expect(applied.session.graph.nodes[otherNodeId]?.title).toBe('Audience')
    expect(applied.session.graph.selection).toEqual({
      focusedNodeId: targetNodeId,
      selectedNodeIds: [targetNodeId],
    })
    expect(applied.session.commandRuns.at(-1)).toMatchObject({
      status: 'executed',
      completedToolCalls: 1,
      actorId: 'plan-agent',
      selection: {
        focusedNodeId: targetNodeId,
        selectedNodeIds: [targetNodeId],
      },
      plan,
    })
  })

  it('rejects applying a plan to a different session', async () => {
    const runtime = createMindmapRuntime({ rootDir })
    const sourceSession = await runtime.createSession()
    const targetSession = await runtime.createSession()

    await runtime.generateMap({
      sessionId: sourceSession.id,
      prompt: 'Launch strategy for a new B2B analytics product',
      actorId: 'test-agent',
    })
    const targetGenerated = await runtime.generateMap({
      sessionId: targetSession.id,
      prompt: 'Hiring plan for a new product team',
      actorId: 'test-agent',
    })

    const plan = await runtime.planCommand({
      sessionId: sourceSession.id,
      input: 'Rename this node to Priority goals',
      selection: {
        focusedNodeId: 'n_root_goals_1',
        selectedNodeIds: ['n_root_goals_1'],
      },
    })

    await expect(
      runtime.applyCommandPlan({
        sessionId: targetSession.id,
        plan,
        actorId: 'plan-agent',
      }),
    ).rejects.toThrow(
      `Command plan targets session "${sourceSession.id}" but was applied to session "${targetSession.id}".`,
    )

    const reloadedTarget = await runtime.loadSession(targetSession.id)
    expect(reloadedTarget.graph).toEqual(targetGenerated.graph)
    expect(reloadedTarget.commandRuns.at(-1)).toMatchObject({
      status: 'failed',
      actorId: 'plan-agent',
      error: expect.stringMatching(/targets session/i),
    })
  })

  it('keeps compound command application atomic when a later step fails', async () => {
    const runtime = createMindmapRuntime({ rootDir })
    const session = await runtime.createSession()
    const generated = await runtime.generateMap({
      sessionId: session.id,
      prompt: 'Launch strategy for a new B2B analytics product',
      actorId: 'test-agent',
    })
    const targetNodeId = generated.graph.nodes[generated.graph.rootNodeId].children[0]

    await expect(
      runtime.applyCommandPlan({
        sessionId: generated.id,
        actorId: 'plan-agent',
        plan: {
          input: 'Delete this node and add child node called Success metrics',
          summary: 'Delete the focused node, then add a child under it.',
          target: {
            sessionId: generated.id,
            nodeId: targetNodeId,
            nodeTitle: 'Goals',
          },
          toolCalls: [
            {
              id: 'call_delete_node_1',
              toolName: 'delete_node',
              arguments: {
                nodeId: targetNodeId,
              },
            },
            {
              id: 'call_add_child_node_2',
              toolName: 'add_child_node',
              arguments: {
                parentId: targetNodeId,
                title: 'Success metrics',
                kind: 'note',
              },
            },
          ],
        },
      }),
    ).rejects.toThrow()

    const reloaded = await runtime.loadSession(generated.id)
    expect(reloaded.graph.nodes[targetNodeId]?.title).toBe('Goals')
    expect(
      Object.values(reloaded.graph.nodes).some(
        (node) =>
          node.parentId === targetNodeId && node.title === 'Success metrics',
      ),
    ).toBe(false)
    expect(reloaded.commandRuns.at(-1)).toMatchObject({
      status: 'failed',
      completedToolCalls: 1,
    })
  })

  it('rejects invalid external plans without crashing and records the failure', async () => {
    const runtime = createMindmapRuntime({ rootDir })
    const session = await runtime.createSession()

    await expect(
      runtime.applyCommandPlan({
        sessionId: session.id,
        actorId: 'plan-agent',
        plan: {
          input: 'Do something invalid',
          summary: 'Invalid test plan.',
          target: {
            sessionId: session.id,
            nodeId: 'n_root',
            nodeTitle: 'Untitled map',
          },
          toolCalls: [
            {
              id: 'call_bogus_1',
              toolName: 'bogus' as 'rename_node',
              arguments: {},
            },
          ],
        },
      }),
    ).rejects.toThrow('Unsupported command tool "bogus".')

    const reloaded = await runtime.loadSession(session.id)
    expect(reloaded.commandRuns.at(-1)).toMatchObject({
      status: 'failed',
      completedToolCalls: 0,
      error: 'Unsupported command tool "bogus".',
    })
  })

  it('executes a compound natural-language command through the shared runtime', async () => {
    const runtime = createMindmapRuntime({ rootDir })
    const session = await runtime.createSession()
    const generated = await runtime.generateMap({
      sessionId: session.id,
      prompt: 'Launch strategy for a new B2B analytics product',
      actorId: 'test-agent',
    })
    const targetNodeId = generated.graph.nodes[generated.graph.rootNodeId].children[0]

    const executed = await runtime.executeCommand({
      sessionId: generated.id,
      input:
        'Rename this node to Priority goals and add child node called Success metrics',
      actorId: 'test-agent',
      selection: {
        focusedNodeId: targetNodeId,
        selectedNodeIds: [targetNodeId],
      },
    })

    expect(executed.plan.toolCalls).toHaveLength(2)
    expect(executed.session.graph.nodes[targetNodeId]?.title).toBe('Priority goals')
    expect(
      Object.values(executed.session.graph.nodes).some(
        (node) =>
          node.parentId === targetNodeId && node.title === 'Success metrics',
      ),
    ).toBe(true)
    expect(executed.session.commandRuns.at(-1)).toMatchObject({
      status: 'executed',
      completedToolCalls: 2,
    })
  })

  it('persists a failed command run when execution cannot be planned', async () => {
    const runtime = createMindmapRuntime({ rootDir })
    const session = await runtime.createSession()

    await expect(
      runtime.executeCommand({
        sessionId: session.id,
        input: 'Teleport this map into a spreadsheet',
        actorId: 'test-agent',
      }),
    ).rejects.toThrow(/unsupported natural-language command/i)

    const reloaded = await runtime.loadSession(session.id)

    expect(reloaded.commandRuns.at(-1)).toMatchObject({
      status: 'failed',
      completedToolCalls: 0,
      error: expect.stringMatching(/unsupported natural-language command/i),
      plan: null,
    })
  })

  it('lists, loads, and replays persisted command runs', async () => {
    const runtime = createMindmapRuntime({ rootDir })
    const session = await runtime.createSession()
    const generated = await runtime.generateMap({
      sessionId: session.id,
      prompt: 'Launch strategy for a new B2B analytics product',
      actorId: 'test-agent',
    })
    const targetNodeId = generated.graph.nodes[generated.graph.rootNodeId].children[0]

    const executed = await runtime.executeCommand({
      sessionId: generated.id,
      input:
        'Rename this node to Priority goals and add child node called Success metrics',
      actorId: 'test-agent',
      selection: {
        focusedNodeId: targetNodeId,
        selectedNodeIds: [targetNodeId],
      },
    })
    const commandRunId = executed.session.commandRuns.at(-1)?.id

    expect(commandRunId).toBeDefined()

    const commandRuns = await runtime.listCommandRuns(generated.id)

    expect(commandRuns).toHaveLength(1)
    expect(commandRuns[0]).toMatchObject({
      id: commandRunId,
      status: 'executed',
      completedToolCalls: 2,
      selection: {
        focusedNodeId: targetNodeId,
        selectedNodeIds: [targetNodeId],
      },
    })

    const commandRun = await runtime.loadCommandRun(
      generated.id,
      commandRunId as string,
    )

    expect(commandRun).toMatchObject({
      id: commandRunId,
      input:
        'Rename this node to Priority goals and add child node called Success metrics',
    })

    const replayed = await runtime.replayCommandRun(
      generated.id,
      commandRunId as string,
      'replay-agent',
    )

    expect(replayed.plan.toolCalls).toHaveLength(2)
    expect(replayed.session.commandRuns).toHaveLength(2)
    expect(replayed.session.commandRuns.at(-1)).toMatchObject({
      status: 'executed',
      completedToolCalls: 2,
      actorId: 'replay-agent',
      replayOfCommandRunId: commandRunId,
    })
    expect(replayed.session.graph.selection).toEqual({
      focusedNodeId: targetNodeId,
      selectedNodeIds: [targetNodeId],
    })
    expect(
      Object.values(replayed.session.graph.nodes).filter(
        (node) =>
          node.parentId === targetNodeId && node.title === 'Success metrics',
      ),
    ).toHaveLength(2)
  })

  it('fails when loading an unknown command run', async () => {
    const runtime = createMindmapRuntime({ rootDir })
    const session = await runtime.createSession()

    await expect(
      runtime.loadCommandRun(session.id, 'cmd_missing'),
    ).rejects.toThrow('Command run "cmd_missing" was not found.')
  })

  it('rejects replay when a command run has no captured plan', async () => {
    const runtime = createMindmapRuntime({ rootDir })
    const session = await runtime.createSession()

    await expect(
      runtime.executeCommand({
        sessionId: session.id,
        input: 'Teleport this map into a spreadsheet',
        actorId: 'test-agent',
      }),
    ).rejects.toThrow(/unsupported natural-language command/i)

    const failedRunId = (await runtime.loadSession(session.id)).commandRuns.at(-1)?.id

    await expect(
      runtime.replayCommandRun(session.id, failedRunId as string),
    ).rejects.toThrow(
      `Command run "${failedRunId}" cannot be replayed because no plan was captured.`,
    )
  })
})
