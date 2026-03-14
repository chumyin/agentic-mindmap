import type { GraphEdit, MindmapArtifact } from '../core/graph-types'
import type { MindmapSelection } from '../core/graph-types'
import {
  createMindmapProtocolDescription,
  MINDMAP_PROTOCOL_VERSION,
} from './protocol'
import { createMindmapRuntime } from './runtime'
import type {
  MindmapCommandPlan,
  MindmapCommandMode,
  MindmapIntentType,
  SessionStoreOptions,
} from './session-types'

export interface MindmapApiRequest {
  method: string
  url: string
  body?: unknown
}

export interface MindmapApiResponse {
  status: number
  body: Record<string, unknown>
  headers?: Record<string, string>
}

function parseRequestUrl(url: string): URL {
  return new URL(url, 'http://agentic-mindmap.local')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getPayload(body: unknown): Record<string, unknown> {
  return isRecord(body) ? body : {}
}

function ensureString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Expected "${fieldName}" to be a non-empty string.`)
  }

  return value
}

function ensureGraphEdits(value: unknown): GraphEdit[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Expected "edits" to be a non-empty array.')
  }

  return value as GraphEdit[]
}

function ensureIntent(value: unknown): MindmapIntentType {
  if (
    value === 'expand_branch' ||
    value === 'summarize_branch' ||
    value === 'create_outline'
  ) {
    return value
  }

  throw new Error('Expected "intent" to be one of expand_branch, summarize_branch, or create_outline.')
}

function ensureActorType(value: unknown): 'user' | 'agent' | 'system' {
  if (value === 'user' || value === 'agent' || value === 'system') {
    return value
  }

  throw new Error('Expected "actorType" to be one of user, agent, or system.')
}

function ensureCommandMode(value: unknown): MindmapCommandMode {
  if (value === 'plan' || value === 'execute') {
    return value
  }

  throw new Error('Expected "mode" to be either plan or execute.')
}

function ensureCommandPlan(value: unknown): MindmapCommandPlan {
  if (!isRecord(value)) {
    throw new Error('Expected "plan" to be an object.')
  }

  if (
    typeof value.input !== 'string' ||
    typeof value.summary !== 'string' ||
    !isRecord(value.target) ||
    !Array.isArray(value.toolCalls)
  ) {
    throw new Error('Expected "plan" to match the command plan shape.')
  }

  return value as unknown as MindmapCommandPlan
}

function parseSelection(value: unknown): MindmapSelection | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  return {
    focusedNodeId:
      typeof value.focusedNodeId === 'string' || value.focusedNodeId === null
        ? (value.focusedNodeId as string | null)
        : null,
    selectedNodeIds: Array.isArray(value.selectedNodeIds)
      ? value.selectedNodeIds.filter((item): item is string => typeof item === 'string')
      : [],
  }
}

function selectArtifact(
  artifacts: Record<string, MindmapArtifact>,
  kind: MindmapArtifact['kind'],
): MindmapArtifact | undefined {
  return Object.values(artifacts).find((artifact) => artifact.kind === kind)
}

function toErrorResponse(error: unknown): MindmapApiResponse {
  const message = error instanceof Error ? error.message : String(error)
  const status =
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
      ? 404
      : 400

  return {
    status,
    body: {
      error: message,
    },
  }
}

export function createMindmapApiHandler(options: SessionStoreOptions = {}) {
  const runtime = createMindmapRuntime(options)
  const rootDir = options.rootDir ?? process.cwd()

  return async function handleRequest(
    request: MindmapApiRequest,
  ): Promise<MindmapApiResponse> {
    try {
      const requestUrl = parseRequestUrl(request.url)
      const payload = getPayload(request.body)
      const pathSegments = requestUrl.pathname.split('/').filter(Boolean)

      if (
        request.method === 'POST' &&
        requestUrl.pathname === '/api/mindmap/session'
      ) {
        const session = await runtime.createSession()
        return {
          status: 200,
          body: { session },
        }
      }

      if (
        request.method === 'GET' &&
        requestUrl.pathname === '/api/mindmap/health'
      ) {
        return {
          status: 200,
          body: {
            status: 'ok',
            protocolVersion: MINDMAP_PROTOCOL_VERSION,
          },
        }
      }

      if (
        request.method === 'GET' &&
        requestUrl.pathname === '/api/mindmap/describe'
      ) {
        return {
          status: 200,
          body: createMindmapProtocolDescription({ rootDir }),
        }
      }

      if (
        request.method === 'GET' &&
        requestUrl.pathname === '/api/mindmap/session'
      ) {
        const sessions = await runtime.listSessions()
        return {
          status: 200,
          body: { sessions },
        }
      }

      if (
        pathSegments.length < 4 ||
        pathSegments[0] !== 'api' ||
        pathSegments[1] !== 'mindmap' ||
        pathSegments[2] !== 'session'
      ) {
        return {
          status: 404,
          body: {
            error: `Unknown route: ${request.method} ${requestUrl.pathname}`,
          },
        }
      }

      const sessionId = decodeURIComponent(pathSegments[3])

      if (request.method === 'GET' && pathSegments.length === 4) {
        const session = await runtime.loadSession(sessionId)
        return {
          status: 200,
          body: { session },
        }
      }

      if (
        request.method === 'GET' &&
        pathSegments.length === 5 &&
        pathSegments[4] === 'command'
      ) {
        const commandRuns = await runtime.listCommandRuns(sessionId)
        return {
          status: 200,
          body: { commandRuns },
        }
      }

      if (
        request.method === 'POST' &&
        pathSegments.length === 6 &&
        pathSegments[4] === 'command' &&
        pathSegments[5] === 'apply'
      ) {
        const result = await runtime.applyCommandPlan({
          sessionId,
          plan: ensureCommandPlan(payload.plan),
          actorId:
            typeof payload.actorId === 'string' ? payload.actorId : 'api-client',
          selection: parseSelection(payload.selection),
        })

        return {
          status: 200,
          body: {
            plan: result.plan,
            session: result.session,
          },
        }
      }

      if (
        request.method === 'POST' &&
        pathSegments.length === 5 &&
        pathSegments[4] === 'command'
      ) {
        const mode =
          typeof payload.mode === 'string' ? ensureCommandMode(payload.mode) : 'execute'

        if (mode === 'plan') {
          const plan = await runtime.planCommand({
            sessionId,
            input: ensureString(payload.input, 'input'),
            actorId:
              typeof payload.actorId === 'string' ? payload.actorId : 'api-client',
            selection: parseSelection(payload.selection),
          })

          return {
            status: 200,
            body: { plan },
          }
        }

        const result = await runtime.executeCommand({
          sessionId,
          input: ensureString(payload.input, 'input'),
          actorId:
            typeof payload.actorId === 'string' ? payload.actorId : 'api-client',
          selection: parseSelection(payload.selection),
        })

        return {
          status: 200,
          body: {
            plan: result.plan,
            session: result.session,
          },
        }
      }

      if (
        request.method === 'GET' &&
        pathSegments.length === 6 &&
        pathSegments[4] === 'command'
      ) {
        const commandRun = await runtime.loadCommandRun(
          sessionId,
          decodeURIComponent(pathSegments[5]),
        )
        return {
          status: 200,
          body: { commandRun },
        }
      }

      if (
        request.method === 'POST' &&
        pathSegments.length === 7 &&
        pathSegments[4] === 'command' &&
        pathSegments[6] === 'replay'
      ) {
        const result = await runtime.replayCommandRun(
          sessionId,
          decodeURIComponent(pathSegments[5]),
          typeof payload.actorId === 'string' ? payload.actorId : undefined,
        )

        return {
          status: 200,
          body: {
            plan: result.plan,
            session: result.session,
          },
        }
      }

      if (
        request.method === 'POST' &&
        pathSegments.length === 5 &&
        pathSegments[4] === 'generate'
      ) {
        const session = await runtime.generateMap({
          sessionId,
          prompt: ensureString(payload.prompt, 'prompt'),
          actorId:
            typeof payload.actorId === 'string' ? payload.actorId : 'api-client',
        })

        return {
          status: 200,
          body: { session },
        }
      }

      if (
        request.method === 'POST' &&
        pathSegments.length === 5 &&
        pathSegments[4] === 'edit'
      ) {
        const session = await runtime.applyManualEdits({
          sessionId,
          edits: ensureGraphEdits(payload.edits),
          actorId:
            typeof payload.actorId === 'string' ? payload.actorId : 'browser-user',
          actorType:
            typeof payload.actorType === 'string'
              ? ensureActorType(payload.actorType)
              : 'user',
          summary:
            typeof payload.summary === 'string' ? payload.summary : undefined,
        })

        return {
          status: 200,
          body: { session },
        }
      }

      if (
        request.method === 'POST' &&
        pathSegments.length === 5 &&
        pathSegments[4] === 'intent'
      ) {
        const session = await runtime.runIntent({
          sessionId,
          intent: ensureIntent(payload.intent),
          targetNodeId: ensureString(payload.targetNodeId, 'targetNodeId'),
          instruction:
            typeof payload.instruction === 'string' ? payload.instruction : undefined,
          actorId:
            typeof payload.actorId === 'string' ? payload.actorId : 'api-client',
        })

        return {
          status: 200,
          body: { session },
        }
      }

      if (
        request.method === 'GET' &&
        pathSegments.length === 5 &&
        pathSegments[4] === 'export'
      ) {
        const format = requestUrl.searchParams.get('format')

        if (format === 'graph') {
          const session = await runtime.loadSession(sessionId)
          return {
            status: 200,
            body: {
              graph: session.graph,
            },
          }
        }

        if (format === 'outline') {
          const outlined = await runtime.runIntent({
            sessionId,
            intent: 'create_outline',
            targetNodeId: 'n_root',
            actorId: 'api-client',
          })
          const artifact = selectArtifact(outlined.graph.artifacts, 'outline')

          if (!artifact) {
            throw new Error('Outline artifact was not created.')
          }

          return {
            status: 200,
            body: {
              sessionId,
              artifact,
            },
          }
        }

        throw new Error(`Unsupported export format "${format ?? '<empty>'}".`)
      }

      return {
        status: 404,
        body: {
          error: `Unknown route: ${request.method} ${requestUrl.pathname}`,
        },
      }
    } catch (error) {
      return toErrorResponse(error)
    }
  }
}
