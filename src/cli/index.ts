/// <reference types="node" />

import { fileURLToPath } from 'node:url'
import { createMindmapRuntime } from '../runtime/runtime'
import type { MindmapArtifact } from '../core/graph-types'

type ParsedArgs = {
  positionals: string[]
  flags: Record<string, string | boolean>
}

type ExecuteCliOptions = {
  stdin?: string
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
  const runtime = createMindmapRuntime({ rootDir })
  const payload = parseJsonInput(options.stdin)
  const [command, subcommand] = parsed.positionals

  if (command === 'session' && subcommand === 'create') {
    const session = await runtime.createSession()
    return { session }
  }

  if (command === 'session' && subcommand === 'show') {
    const sessionId = ensureString(getStringFlag(parsed.flags, 'session'), 'session')
    const session = await runtime.loadSession(sessionId)
    return { session }
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
      stdout: renderJson(result),
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
  const result = await executeCli(process.argv.slice(2), {
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
