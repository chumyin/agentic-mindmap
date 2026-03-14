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
})
