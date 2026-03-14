import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { createMindmapApiHandler } from './api'
import type { SessionStoreOptions } from './session-types'

type NextFunction = (error?: Error) => void

async function readRequestBody(request: IncomingMessage): Promise<unknown> {
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

function isMindmapApiRequest(url: string | undefined): boolean {
  return typeof url === 'string' && url.startsWith('/api/mindmap')
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

  response.setHeader('content-type', 'application/json')

  for (const [name, value] of Object.entries(payload.headers ?? {})) {
    response.setHeader(name, value)
  }

  response.end(JSON.stringify(payload.body))
}

export function createMindmapApiMiddleware(options: SessionStoreOptions = {}) {
  const handler = createMindmapApiHandler(options)

  return async function mindmapApiMiddleware(
    request: IncomingMessage,
    response: ServerResponse<IncomingMessage>,
    next: NextFunction,
  ) {
    if (!isMindmapApiRequest(request.url)) {
      next()
      return
    }

    try {
      const body =
        request.method === 'GET' || request.method === 'HEAD'
          ? undefined
          : await readRequestBody(request)
      const result = await handler({
        method: request.method ?? 'GET',
        url: request.url ?? '/api/mindmap',
        body,
      })

      writeJsonResponse(response, result)
    } catch (error) {
      next(error instanceof Error ? error : new Error(String(error)))
    }
  }
}

export function createMindmapApiVitePlugin(
  options: SessionStoreOptions = {},
): Plugin {
  return {
    name: 'agentic-mindmap-local-api',
    configureServer(server) {
      server.middlewares.use(createMindmapApiMiddleware(options))
    },
    configurePreviewServer(server) {
      server.middlewares.use(createMindmapApiMiddleware(options))
    },
  }
}
