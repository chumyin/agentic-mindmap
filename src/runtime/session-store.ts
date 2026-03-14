import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { MindmapSession, SessionStoreOptions } from './session-types'

function getSessionRoot(rootDir: string): string {
  return join(rootDir, '.agentic-mindmap', 'sessions')
}

export function createSessionStore(options: SessionStoreOptions = {}) {
  const rootDir = options.rootDir ?? process.cwd()
  const sessionRoot = getSessionRoot(rootDir)

  async function ensureSessionRoot() {
    await mkdir(sessionRoot, { recursive: true })
  }

  function getSessionPath(sessionId: string): string {
    return join(sessionRoot, `${sessionId}.json`)
  }

  async function loadSession(sessionId: string): Promise<MindmapSession> {
    await ensureSessionRoot()
    const contents = await readFile(getSessionPath(sessionId), 'utf8')

    return JSON.parse(contents) as MindmapSession
  }

  async function saveSession(session: MindmapSession): Promise<void> {
    await ensureSessionRoot()
    await writeFile(getSessionPath(session.id), JSON.stringify(session, null, 2))
  }

  return {
    rootDir,
    sessionRoot,
    loadSession,
    saveSession,
  }
}
