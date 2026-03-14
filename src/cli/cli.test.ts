/// <reference types="node" />

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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
})
