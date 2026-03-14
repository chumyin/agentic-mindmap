import type { GraphEdit, MindmapSelection } from '../core/graph-types'
import type {
  MindmapCommandPlan,
  MindmapCommandRun,
  MindmapIntentType,
  MindmapSession,
} from '../runtime/session-types'
import {
  DEFAULT_MINDMAP_API_BASE,
  clearStoredMindmapApiBase,
  resolveMindmapApiConfig,
} from './api-config'

type SessionResponse = {
  session: MindmapSession
}

type CommandPlanResponse = {
  plan: MindmapCommandPlan
}

type CommandExecutionResponse = {
  plan: MindmapCommandPlan
  session: MindmapSession
}

type CommandRunResponse = {
  commandRun: MindmapCommandRun
}

type ApiErrorResponse = {
  error?: string
}

class MindmapApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'MindmapApiError'
    this.status = status
  }
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & ApiErrorResponse

  if (!response.ok) {
    throw new MindmapApiError(
      response.status,
      payload.error ?? `Mindmap API request failed (${response.status}).`,
    )
  }

  return payload
}

async function requestJson<T>(
  apiBase: string,
  path: string,
  options: {
    method?: string
    body?: Record<string, unknown>
  } = {},
): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  return readJsonResponse<T>(response)
}

async function requestWithFallback<T>(
  path: string,
  options: {
    method?: string
    body?: Record<string, unknown>
  } = {},
): Promise<T> {
  const config = resolveMindmapApiConfig()

  try {
    return await requestJson<T>(config.apiBase, path, options)
  } catch (error) {
    const shouldFallback =
      config.source === 'storage' &&
      (error instanceof TypeError ||
        (error instanceof MindmapApiError &&
          (error.status === 404 || error.status >= 500)))

    if (!shouldFallback) {
      throw error
    }

    clearStoredMindmapApiBase()
    return requestJson<T>(DEFAULT_MINDMAP_API_BASE, path, options)
  }
}

export async function createRemoteSession(): Promise<MindmapSession> {
  const response = await requestWithFallback<SessionResponse>('/session', {
    method: 'POST',
  })

  return response.session
}

export async function loadRemoteSession(sessionId: string): Promise<MindmapSession> {
  const response = await requestWithFallback<SessionResponse>(
    `/session/${sessionId}`,
  )
  return response.session
}

export async function generateRemoteMap(input: {
  sessionId: string
  prompt: string
  actorId?: string
}): Promise<MindmapSession> {
  const response = await requestWithFallback<SessionResponse>(
    `/session/${input.sessionId}/generate`,
    {
      method: 'POST',
      body: {
        prompt: input.prompt,
        actorId: input.actorId,
      },
    },
  )

  return response.session
}

export async function applyRemoteEdits(input: {
  sessionId: string
  edits: GraphEdit[]
  actorId?: string
  summary?: string
}): Promise<MindmapSession> {
  const response = await requestWithFallback<SessionResponse>(
    `/session/${input.sessionId}/edit`,
    {
      method: 'POST',
      body: {
        edits: input.edits,
        actorId: input.actorId,
        summary: input.summary,
      },
    },
  )

  return response.session
}

export async function runRemoteIntent(input: {
  sessionId: string
  intent: MindmapIntentType
  targetNodeId: string
  instruction?: string
  actorId?: string
}): Promise<MindmapSession> {
  const response = await requestWithFallback<SessionResponse>(
    `/session/${input.sessionId}/intent`,
    {
      method: 'POST',
      body: {
        intent: input.intent,
        targetNodeId: input.targetNodeId,
        instruction: input.instruction,
        actorId: input.actorId,
      },
    },
  )

  return response.session
}

export async function planRemoteCommand(input: {
  sessionId: string
  input: string
  actorId?: string
  selection?: MindmapSelection
}): Promise<MindmapCommandPlan> {
  const response = await requestWithFallback<CommandPlanResponse>(
    `/session/${input.sessionId}/command`,
    {
      method: 'POST',
      body: {
        input: input.input,
        actorId: input.actorId,
        mode: 'plan',
        selection: input.selection,
      },
    },
  )

  return response.plan
}

export async function runRemoteCommand(input: {
  sessionId: string
  input: string
  actorId?: string
  selection?: MindmapSelection
}): Promise<CommandExecutionResponse> {
  return requestWithFallback<CommandExecutionResponse>(
    `/session/${input.sessionId}/command`,
    {
      method: 'POST',
      body: {
        input: input.input,
        actorId: input.actorId,
        mode: 'execute',
        selection: input.selection,
      },
    },
  )
}

export async function applyRemoteCommandPlan(input: {
  sessionId: string
  plan: MindmapCommandPlan
  actorId?: string
  selection?: MindmapSelection
}): Promise<CommandExecutionResponse> {
  return requestWithFallback<CommandExecutionResponse>(
    `/session/${input.sessionId}/command/apply`,
    {
      method: 'POST',
      body: {
        plan: input.plan,
        actorId: input.actorId,
        selection: input.selection,
      },
    },
  )
}

export async function loadRemoteCommandRun(input: {
  sessionId: string
  commandRunId: string
}): Promise<MindmapCommandRun> {
  const response = await requestWithFallback<CommandRunResponse>(
    `/session/${input.sessionId}/command/${input.commandRunId}`,
  )

  return response.commandRun
}

export async function replayRemoteCommandRun(input: {
  sessionId: string
  commandRunId: string
  actorId?: string
}): Promise<CommandExecutionResponse> {
  return requestWithFallback<CommandExecutionResponse>(
    `/session/${input.sessionId}/command/${input.commandRunId}/replay`,
    {
      method: 'POST',
      body: {
        actorId: input.actorId,
      },
    },
  )
}
