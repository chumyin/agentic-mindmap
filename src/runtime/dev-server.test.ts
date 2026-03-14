/// <reference types="node" />

import { mkdtemp, rm } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMindmapApiMiddleware } from './dev-server'

function createRequest(input: {
  method: string
  url: string
  body?: Record<string, unknown>
}): IncomingMessage {
  const stream = Readable.from(
    input.body ? [JSON.stringify(input.body)] : [],
  ) as IncomingMessage

  stream.method = input.method
  stream.url = input.url
  stream.headers = input.body
    ? {
        'content-type': 'application/json',
      }
    : {}

  return stream
}

function createResponse() {
  const headers = new Map<string, string>()
  let body = ''
  const response = {
    statusCode: 200,
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value)
    },
    end(chunk?: string | Buffer) {
      body =
        typeof chunk === 'string'
          ? chunk
          : chunk
            ? chunk.toString('utf8')
            : ''
    },
  } as ServerResponse<IncomingMessage>

  return {
    response,
    headers,
    readBody: () => body,
  }
}

describe('mindmap api middleware', () => {
  let rootDir = ''

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), 'agentic-mindmap-dev-server-'))
  })

  afterEach(async () => {
    if (rootDir) {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  it('serves the local mindmap api over a connect-style middleware interface', async () => {
    const middleware = createMindmapApiMiddleware({ rootDir })
    const request = createRequest({
      method: 'POST',
      url: '/api/mindmap/session',
    })
    const { response, headers, readBody } = createResponse()
    const next = vi.fn()

    await middleware(request, response, next)

    expect(next).not.toHaveBeenCalled()
    expect(response.statusCode).toBe(200)
    expect(headers.get('content-type')).toContain('application/json')
    expect(JSON.parse(readBody()).session.id).toMatch(/^sess_/)
  })

  it('passes through unrelated requests without intercepting them', async () => {
    const middleware = createMindmapApiMiddleware({ rootDir })
    const request = createRequest({
      method: 'GET',
      url: '/assets/index.js',
    })
    const { response, readBody } = createResponse()
    const next = vi.fn()

    await middleware(request, response, next)

    expect(next).toHaveBeenCalledOnce()
    expect(readBody()).toBe('')
  })
})
