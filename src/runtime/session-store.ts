import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { MindmapSession, SessionStoreOptions } from './session-types'

function getSessionRoot(rootDir: string): string {
  return join(rootDir, '.agentic-mindmap', 'sessions')
}

export function createSessionStore(options: SessionStoreOptions = {}) {
  const rootDir = options.rootDir ?? process.cwd()
  const sessionRoot = getSessionRoot(rootDir)

  function normalizeSession(session: MindmapSession): MindmapSession {
    return {
      ...session,
      commandRuns: Array.isArray(session.commandRuns) ? session.commandRuns : [],
    }
  }

  async function ensureSessionRoot() {
    await mkdir(sessionRoot, { recursive: true })
  }

  function getSessionPath(sessionId: string): string {
    return join(sessionRoot, `${sessionId}.json`)
  }

  async function loadSession(sessionId: string): Promise<MindmapSession> {
    await ensureSessionRoot()
    const contents = await readFile(getSessionPath(sessionId), 'utf8')

    return normalizeSession(JSON.parse(contents) as MindmapSession)
  }

  async function saveSession(session: MindmapSession): Promise<void> {
    await ensureSessionRoot()
    await writeFile(getSessionPath(session.id), JSON.stringify(session, null, 2))
  }

  async function listSessions(): Promise<MindmapSession[]> {
    await ensureSessionRoot()
    const entries = await readdir(sessionRoot, { withFileTypes: true })
    const sessionFiles = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => entry.name)

    const sessions = await Promise.all(
      sessionFiles.map(async (filename) => {
        const contents = await readFile(join(sessionRoot, filename), 'utf8')
        return normalizeSession(JSON.parse(contents) as MindmapSession)
      }),
    )

    return sessions.sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    )
  }

  return {
    rootDir,
    sessionRoot,
    loadSession,
    saveSession,
    listSessions,
  }
}
