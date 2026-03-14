/// <reference types="node" />

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMindmapHttpServer } from './http-server'

describe('mindmap http server', () => {
  let rootDir = ''

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), 'agentic-mindmap-http-server-'))
  })

  afterEach(async () => {
    if (rootDir) {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  it('serves the shared mindmap api over a standalone local http server', async () => {
    const runtimeServer = createMindmapHttpServer({
      rootDir,
      host: '127.0.0.1',
      port: 0,
    })
    const started = await runtimeServer.start()

    try {
      const described = await fetch(started.describeUrl)
      const describedPayload = (await described.json()) as {
        protocolVersion: string
      }
      const created = await fetch(`${started.apiBase}/session`, {
        method: 'POST',
      })
      const payload = (await created.json()) as {
        session: {
          id: string
        }
      }

      expect(started.protocolVersion).toBe('0.1')
      expect(described.status).toBe(200)
      expect(describedPayload.protocolVersion).toBe('0.1')
      expect(created.status).toBe(200)
      expect(payload.session.id).toMatch(/^sess_/)
    } finally {
      await runtimeServer.stop()
    }
  })

  it('responds to cors preflight requests for external browser clients', async () => {
    const runtimeServer = createMindmapHttpServer({
      rootDir,
      host: '127.0.0.1',
      port: 0,
    })
    const started = await runtimeServer.start()

    try {
      const preflight = await fetch(`${started.apiBase}/session`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://127.0.0.1:4175',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type',
        },
      })

      expect(preflight.status).toBe(204)
      expect(preflight.headers.get('access-control-allow-origin')).toBe('*')
      expect(preflight.headers.get('access-control-allow-methods')).toContain('POST')
      expect(preflight.headers.get('access-control-allow-headers')).toContain(
        'content-type',
      )
    } finally {
      await runtimeServer.stop()
    }
  })
})
