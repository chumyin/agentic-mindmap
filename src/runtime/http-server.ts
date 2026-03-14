import { once } from 'node:events'
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http'
import type { AddressInfo } from 'node:net'
import { createMindmapApiHandler } from './api'
import {
  MINDMAP_GRAPH_VERSION,
  MINDMAP_PROTOCOL_VERSION,
} from './protocol'
import type { SessionStoreOptions } from './session-types'

export interface MindmapHttpServerOptions extends SessionStoreOptions {
  host?: string
  port?: number
}

export interface MindmapHttpServerInfo {
  host: string
  port: number
  origin: string
  apiBase: string
  healthUrl: string
  describeUrl: string
  sessionCollectionUrl: string
  protocolVersion: string
  graphVersion: string
}

function isMindmapApiRequest(url: string | undefined): boolean {
  return typeof url === 'string' && url.startsWith('/api/mindmap')
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []

  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }

  if (chunks.length === 0) {
    return undefined
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  } catch {
    throw new Error('Invalid JSON request body.')
  }
}

function applyCorsHeaders(response: ServerResponse<IncomingMessage>) {
  response.setHeader('access-control-allow-origin', '*')
  response.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS')
  response.setHeader('access-control-allow-headers', 'content-type')
}

function writeJsonResponse(
  response: ServerResponse<IncomingMessage>,
  payload: {
    status: number
    headers?: Record<string, string>
    body: Record<string, unknown>
  },
) {
  response.statusCode = payload.status
  applyCorsHeaders(response)
  response.setHeader('content-type', 'application/json')

  for (const [name, value] of Object.entries(payload.headers ?? {})) {
    response.setHeader(name, value)
  }

  response.end(JSON.stringify(payload.body))
}

async function startServer(
  server: Server,
  port: number,
  host: string,
): Promise<AddressInfo> {
  server.listen(port, host)

  const outcome = await Promise.race([
    once(server, 'listening').then(() => ({ type: 'listening' as const })),
    once(server, 'error').then(([error]) => ({ type: 'error' as const, error })),
  ])

  if (outcome.type === 'error') {
    throw outcome.error
  }

  const address = server.address()

  if (!address || typeof address === 'string') {
    throw new Error('Unable to resolve the runtime server address.')
  }

  return address
}

export function createMindmapHttpServer(options: MindmapHttpServerOptions = {}) {
  const host = options.host ?? '127.0.0.1'
  const port = options.port ?? 3210
  const handler = createMindmapApiHandler(options)
  const server = createServer(async (request, response) => {
    if (!isMindmapApiRequest(request.url)) {
      writeJsonResponse(response, {
        status: 404,
        body: {
          error: `Unknown route: ${request.method ?? 'GET'} ${request.url ?? '<empty>'}`,
        },
      })
      return
    }

    if (request.method === 'OPTIONS') {
      response.statusCode = 204
      applyCorsHeaders(response)
      response.end()
      return
    }

    try {
      const body =
        request.method === 'GET' || request.method === 'HEAD'
          ? undefined
          : await readJsonBody(request)
      const result = await handler({
        method: request.method ?? 'GET',
        url: request.url ?? '/api/mindmap',
        body,
      })

      writeJsonResponse(response, result)
    } catch (error) {
      writeJsonResponse(response, {
        status: 400,
        body: {
          error: error instanceof Error ? error.message : String(error),
        },
      })
    }
  })

  let info: MindmapHttpServerInfo | null = null

  async function start(): Promise<MindmapHttpServerInfo> {
    if (info) {
      return info
    }

    const address = await startServer(server, port, host)
    info = {
      host,
      port: address.port,
      origin: `http://${host}:${address.port}`,
      apiBase: `http://${host}:${address.port}/api/mindmap`,
      healthUrl: `http://${host}:${address.port}/api/mindmap/health`,
      describeUrl: `http://${host}:${address.port}/api/mindmap/describe`,
      sessionCollectionUrl: `http://${host}:${address.port}/api/mindmap/session`,
      protocolVersion: MINDMAP_PROTOCOL_VERSION,
      graphVersion: MINDMAP_GRAPH_VERSION,
    }

    return info
  }

  async function stop(): Promise<void> {
    if (!server.listening) {
      return
    }

    server.close()
    await once(server, 'close')
    info = null
  }

  return {
    server,
    start,
    stop,
    getInfo: () => info,
  }
}
