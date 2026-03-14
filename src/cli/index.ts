/// <reference types="node" />

import { fileURLToPath } from 'node:url'
import type { MindmapSelection } from '../core/graph-types'
import { createMindmapRuntime } from '../runtime/runtime'
import type { GraphEdit, MindmapArtifact } from '../core/graph-types'
import {
  createMindmapHttpServer,
  type MindmapHttpServerInfo,
} from '../runtime/http-server'
import { createMindmapProtocolDescription } from '../runtime/protocol'
import type {
  MindmapCommandMode,
  MindmapCommandPlan,
} from '../runtime/session-types'

type ParsedArgs = {
  positionals: string[]
  flags: Record<string, string | boolean>
}

type ExecuteCliOptions = {
  stdin?: string
  signal?: AbortSignal
  onServeReady?: (info: MindmapHttpServerInfo) => void
}

export type ExecuteCliResult = {
  exitCode: number
  stdout: string
  stderr: string
}

function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = []
  const flags: Record<string, string | boolean> = {}

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]

    if (!token.startsWith('--')) {
      positionals.push(token)
      continue
    }

    const flagName = token.slice(2)
    const nextToken = argv[index + 1]

    if (!nextToken || nextToken.startsWith('--')) {
      flags[flagName] = true
      continue
    }

    flags[flagName] = nextToken
    index += 1
  }

  return { positionals, flags }
}

function getStringFlag(
  flags: Record<string, string | boolean>,
  name: string,
): string | undefined {
  const value = flags[name]
  return typeof value === 'string' ? value : undefined
}

function parseJsonInput(stdin?: string): Record<string, unknown> {
  if (!stdin?.trim()) {
    return {}
  }

  return JSON.parse(stdin) as Record<string, unknown>
}

function renderJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
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
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    typeof (value as { input?: unknown }).input !== 'string' ||
    typeof (value as { summary?: unknown }).summary !== 'string' ||
    typeof (value as { target?: unknown }).target !== 'object' ||
    !Array.isArray((value as { toolCalls?: unknown }).toolCalls)
  ) {
    throw new Error('Expected "plan" to match the command plan shape.')
  }

  return value as MindmapCommandPlan
}

function parseSelection(value: unknown): MindmapSelection | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined
  }

  const selection = value as Record<string, unknown>

  return {
    focusedNodeId:
      typeof selection.focusedNodeId === 'string' || selection.focusedNodeId === null
        ? (selection.focusedNodeId as string | null)
        : null,
    selectedNodeIds: Array.isArray(selection.selectedNodeIds)
      ? selection.selectedNodeIds.filter(
          (item): item is string => typeof item === 'string',
        )
      : [],
  }
}

function parsePortFlag(value: string | undefined): number {
  if (value === undefined) {
    return 3210
  }

  const port = Number(value)

  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Expected "port" to be an integer between 0 and 65535.`)
  }

  return port
}

async function waitForAbort(signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return
  }

  await new Promise<void>((resolve) => {
    signal.addEventListener('abort', () => resolve(), { once: true })
  })
}

async function runServeCommand(
  flags: Record<string, string | boolean>,
  rootDir: string | undefined,
  options: ExecuteCliOptions,
): Promise<void> {
  if (!options.signal) {
    throw new Error('The serve command requires an AbortSignal when run programmatically.')
  }

  const runtimeServer = createMindmapHttpServer({
    rootDir,
    host: getStringFlag(flags, 'host') ?? '127.0.0.1',
    port: parsePortFlag(getStringFlag(flags, 'port')),
  })
  const serverInfo = await runtimeServer.start()

  options.onServeReady?.(serverInfo)

  try {
    await waitForAbort(options.signal)
  } finally {
    await runtimeServer.stop()
  }
}

function selectArtifact(
  artifacts: Record<string, MindmapArtifact>,
  kind: MindmapArtifact['kind'],
): MindmapArtifact | undefined {
  return Object.values(artifacts).find((artifact) => artifact.kind === kind)
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function runCommand(
  argv: string[],
  options: ExecuteCliOptions,
): Promise<unknown> {
  const parsed = parseArgs(argv)
  const rootDir = getStringFlag(parsed.flags, 'root-dir')
  const resolvedRootDir = rootDir ?? process.cwd()
  const payload = parseJsonInput(options.stdin)
  const [command, subcommand] = parsed.positionals

  if (command === 'serve') {
    await runServeCommand(parsed.flags, rootDir, options)
    return undefined
  }

  const runtime = createMindmapRuntime({ rootDir })

  if (command === 'session' && subcommand === 'create') {
    const session = await runtime.createSession()
    return { session }
  }

  if (command === 'session' && subcommand === 'show') {
    const sessionId = ensureString(getStringFlag(parsed.flags, 'session'), 'session')
    const session = await runtime.loadSession(sessionId)
    return { session }
  }

  if (command === 'session' && subcommand === 'list') {
    const sessions = await runtime.listSessions()
    return { sessions }
  }

  if (command === 'describe') {
    return createMindmapProtocolDescription({
      rootDir: resolvedRootDir,
    })
  }

  if (command === 'command') {
    const sessionId = ensureString(getStringFlag(parsed.flags, 'session'), 'session')

    if (subcommand === 'list') {
      const commandRuns = await runtime.listCommandRuns(sessionId)
      return { commandRuns }
    }

    if (subcommand === 'show') {
      const commandRun = await runtime.loadCommandRun(
        sessionId,
        ensureString(getStringFlag(parsed.flags, 'run'), 'run'),
      )
      return { commandRun }
    }

    if (subcommand === 'replay') {
      return runtime.replayCommandRun(
        sessionId,
        ensureString(getStringFlag(parsed.flags, 'run'), 'run'),
        typeof payload.actorId === 'string' ? payload.actorId : undefined,
      )
    }

    if (subcommand === 'apply') {
      return runtime.applyCommandPlan({
        sessionId,
        plan: ensureCommandPlan(payload.plan),
        actorId: typeof payload.actorId === 'string' ? payload.actorId : undefined,
        selection: parseSelection(payload.selection),
      })
    }

    const mode =
      typeof payload.mode === 'string' ? ensureCommandMode(payload.mode) : 'execute'

    if (mode === 'plan') {
      const plan = await runtime.planCommand({
        sessionId,
        input: ensureString(payload.input, 'input'),
        actorId: typeof payload.actorId === 'string' ? payload.actorId : undefined,
        selection: parseSelection(payload.selection),
      })

      return { plan }
    }

    return runtime.executeCommand({
      sessionId,
      input: ensureString(payload.input, 'input'),
      actorId: typeof payload.actorId === 'string' ? payload.actorId : undefined,
      selection: parseSelection(payload.selection),
    })
  }

  if (command === 'generate') {
    const sessionId = ensureString(getStringFlag(parsed.flags, 'session'), 'session')
    const prompt = ensureString(payload.prompt, 'prompt')
    const session = await runtime.generateMap({
      sessionId,
      prompt,
      actorId: typeof payload.actorId === 'string' ? payload.actorId : undefined,
    })
    return { session }
  }

  if (command === 'act') {
    const sessionId = ensureString(getStringFlag(parsed.flags, 'session'), 'session')
    const intent = ensureString(payload.intent, 'intent') as
      | 'expand_branch'
      | 'summarize_branch'
      | 'create_outline'
    const targetNodeId = ensureString(payload.targetNodeId, 'targetNodeId')
    const session = await runtime.runIntent({
      sessionId,
      intent,
      targetNodeId,
      instruction:
        typeof payload.instruction === 'string' ? payload.instruction : undefined,
      actorId: typeof payload.actorId === 'string' ? payload.actorId : undefined,
    })
    return { session }
  }

  if (command === 'edit') {
    const sessionId = ensureString(getStringFlag(parsed.flags, 'session'), 'session')
    const session = await runtime.applyManualEdits({
      sessionId,
      edits: ensureGraphEdits(payload.edits),
      actorId: typeof payload.actorId === 'string' ? payload.actorId : undefined,
      actorType:
        typeof payload.actorType === 'string'
          ? ensureActorType(payload.actorType)
          : undefined,
      summary: typeof payload.summary === 'string' ? payload.summary : undefined,
    })
    return { session }
  }

  if (command === 'export') {
    const sessionId = ensureString(getStringFlag(parsed.flags, 'session'), 'session')
    const format = ensureString(getStringFlag(parsed.flags, 'format'), 'format')
    const session = await runtime.loadSession(sessionId)

    if (format === 'graph') {
      return { graph: session.graph }
    }

    if (format === 'outline') {
      const outlined = await runtime.runIntent({
        sessionId,
        intent: 'create_outline',
        targetNodeId: session.graph.rootNodeId,
        actorId: 'cli',
      })
      const artifact = selectArtifact(outlined.graph.artifacts, 'outline')

      if (!artifact) {
        throw new Error('Outline artifact was not created.')
      }

      return {
        sessionId,
        artifact,
      }
    }

    throw new Error(`Unsupported export format "${format}".`)
  }

  throw new Error(`Unknown command: ${parsed.positionals.join(' ') || '<empty>'}`)
}

export async function executeCli(
  argv: string[],
  options: ExecuteCliOptions = {},
): Promise<ExecuteCliResult> {
  try {
    const result = await runCommand(argv, options)

    return {
      exitCode: 0,
      stdout: result === undefined ? '' : renderJson(result),
      stderr: '',
    }
  } catch (error) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: renderJson({
        error: toErrorMessage(error),
      }),
    }
  }
}

async function readProcessStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    return ''
  }

  const chunks: Buffer[] = []

  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }

  return Buffer.concat(chunks).toString('utf8')
}

async function main() {
  const argv = process.argv.slice(2)

  if (argv[0] === 'serve') {
    const abortController = new AbortController()
    const abort = () => abortController.abort()

    process.once('SIGINT', abort)
    process.once('SIGTERM', abort)

    const result = await executeCli(argv, {
      signal: abortController.signal,
      onServeReady(info) {
        process.stdout.write(
          renderJson({
            status: 'listening',
            server: info,
          }),
        )
      },
    })

    if (result.stderr) {
      process.stderr.write(result.stderr)
    }

    process.exitCode = result.exitCode
    return
  }

  const result = await executeCli(argv, {
    stdin: await readProcessStdin(),
  })

  if (result.stdout) {
    process.stdout.write(result.stdout)
  }

  if (result.stderr) {
    process.stderr.write(result.stderr)
  }

  process.exitCode = result.exitCode
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void main()
}
