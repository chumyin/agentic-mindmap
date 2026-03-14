/// <reference types="node" />

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { createMindmapApiHandler } from './runtime/api'

const SESSION_STORAGE_KEY = 'agentic-mindmap/browser-session-id'

vi.mock('@xyflow/react', async () => {
  const actual =
    await vi.importActual<typeof import('@xyflow/react')>('@xyflow/react')

  return {
    ...actual,
    Background: () => null,
    Controls: () => null,
    MiniMap: () => null,
    ReactFlow: () => <div data-testid="mindmap-canvas" />,
    ReactFlowProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  }
})

describe('App workspace', () => {
  let rootDir = ''
  let handler = createMindmapApiHandler()

  afterEach(async () => {
    cleanup()

    vi.unstubAllGlobals()

    if (rootDir) {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), 'agentic-mindmap-app-'))

    const storage = new Map<string, string>()

    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        clear: () => storage.clear(),
        getItem: (key: string) => storage.get(key) ?? null,
        key: (index: number) => Array.from(storage.keys())[index] ?? null,
        removeItem: (key: string) => storage.delete(key),
        setItem: (key: string, value: string) => storage.set(key, value),
        get length() {
          return storage.size
        },
      },
    })

    handler = createMindmapApiHandler({ rootDir })

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url
        const body =
          typeof init?.body === 'string' && init.body.length > 0
            ? JSON.parse(init.body)
            : undefined
        const response = await handler({
          method: init?.method ?? 'GET',
          url,
          body,
        })

        return new Response(JSON.stringify(response.body), {
          status: response.status,
          headers: {
            'content-type': 'application/json',
            ...response.headers,
          },
        })
      }),
    )
  })

  it('renders the workspace shell and bootstraps a shared session', async () => {
    render(<App />)

    expect(
      screen.getByRole('heading', {
        name: /agentic mindmap workspace/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/prompt input/i)).toBeInTheDocument()
    expect(screen.getByTestId('mindmap-canvas')).toBeInTheDocument()
    expect(await screen.findByText(/^sess_/i, {}, { timeout: 5000 })).toBeInTheDocument()
  })

  it('loads an existing backend session from a stored session id', async () => {
    const created = await handler({
      method: 'POST',
      url: '/api/mindmap/session',
    })
    const sessionId = (created.body.session as { id: string }).id

    await handler({
      method: 'POST',
      url: `/api/mindmap/session/${sessionId}/generate`,
      body: {
        prompt: 'Launch strategy for a new B2B analytics product',
      },
    })

    window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId)

    render(<App />)

    expect(
      await screen.findByRole('button', { name: /Goals/i }, { timeout: 5000 }),
    ).toBeInTheDocument()
  })

  it(
    'supports prompt generation, manual edits, and outline creation through the shared backend',
    async () => {
    const created = await handler({
      method: 'POST',
      url: '/api/mindmap/session',
    })
    const sessionId = (created.body.session as { id: string }).id

    window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId)

    render(<App />)

      expect(
        await screen.findByText(sessionId, {}, { timeout: 5000 }),
      ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/prompt input/i), {
      target: {
        value: 'Launch strategy for a new B2B analytics product',
      },
    })
    fireEvent.click(screen.getByRole('button', { name: /generate map/i }))

      expect(
        await screen.findByRole('button', { name: /Goals/i }, { timeout: 5000 }),
      ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Goals/i }))

    const titleInput = screen.getByLabelText(/node title/i)
    fireEvent.change(titleInput, {
      target: {
        value: 'Priority goals',
      },
    })

      expect(
        await screen.findByDisplayValue('Priority goals', {}, { timeout: 5000 }),
      ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /add child node/i }))

      expect(
        await screen.findByRole('button', { name: /New node 1/i }, { timeout: 5000 }),
      ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/action brief/i), {
      target: {
        value: 'Add risks and dependencies',
      },
    })
    fireEvent.click(screen.getByRole('button', { name: /expand branch/i }))

      expect(
        await screen.findByRole('button', { name: /Key risks/i }, { timeout: 5000 }),
      ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /create outline/i }))

      await waitFor(
        () => {
          expect(screen.getByLabelText(/artifact output/i)).toHaveTextContent(
            /Launch strategy for a new B2B analytics product/i,
          )
        },
        {
          timeout: 5000,
        },
      )

      const shown = await handler({
        method: 'GET',
        url: `/api/mindmap/session/${sessionId}`,
      })
      const session = shown.body.session as {
        graph: {
          nodes: Record<string, { title: string }>
          artifacts: Record<string, { kind: string; content: string }>
        }
      }

      expect(Object.values(session.graph.nodes)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ title: 'Priority goals' }),
          expect.objectContaining({ title: 'New node 1' }),
          expect.objectContaining({ title: 'Key risks' }),
        ]),
      )
      expect(Object.values(session.graph.artifacts)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'outline',
            content: expect.stringContaining(
              'Launch strategy for a new B2B analytics product',
            ),
          }),
        ]),
      )
    },
    30000,
  )

  it(
    'supports agent-command planning and execution through the shared backend',
    async () => {
      const created = await handler({
        method: 'POST',
        url: '/api/mindmap/session',
      })
      const sessionId = (created.body.session as { id: string }).id

      window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId)

      render(<App />)

      expect(
        await screen.findByText(sessionId, {}, { timeout: 5000 }),
      ).toBeInTheDocument()

      fireEvent.change(screen.getByLabelText(/prompt input/i), {
        target: {
          value: 'Launch strategy for a new B2B analytics product',
        },
      })
      fireEvent.click(screen.getByRole('button', { name: /generate map/i }))

      expect(
        await screen.findByRole('button', { name: /Goals/i }, { timeout: 5000 }),
      ).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /Goals/i }))

      fireEvent.change(screen.getByLabelText(/agent command/i), {
        target: {
          value: 'Rename this node to Priority goals',
        },
      })
      fireEvent.click(screen.getByRole('button', { name: /preview plan/i }))

      await waitFor(
        () => {
          expect(screen.getByLabelText(/agent plan output/i)).toHaveTextContent(
            /rename_node/i,
          )
        },
        {
          timeout: 5000,
        },
      )

      expect(screen.getByRole('button', { name: /Goals/i })).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /run command/i }))

      expect(
        await screen.findByRole('button', { name: /Priority goals/i }, { timeout: 5000 }),
      ).toBeInTheDocument()
      expect(
        await screen.findByLabelText(/recent command runs/i, {}, { timeout: 5000 }),
      ).toHaveTextContent(/executed/i)
      expect(screen.getByLabelText(/recent command runs/i)).toHaveTextContent(
        /Rename this node to Priority goals/i,
      )

      const shown = await handler({
        method: 'GET',
        url: `/api/mindmap/session/${sessionId}`,
      })
      const session = shown.body.session as {
        graph: {
          nodes: Record<string, { title: string }>
        }
      }

      expect(session.graph.nodes.n_root_goals_1?.title).toBe('Priority goals')
    },
    30000,
  )

  it(
    'supports previewing and then applying the exact agent plan from the browser',
    async () => {
      const created = await handler({
        method: 'POST',
        url: '/api/mindmap/session',
      })
      const sessionId = (created.body.session as { id: string }).id

      window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId)

      render(<App />)

      expect(
        await screen.findByText(sessionId, {}, { timeout: 5000 }),
      ).toBeInTheDocument()

      fireEvent.change(screen.getByLabelText(/prompt input/i), {
        target: {
          value: 'Launch strategy for a new B2B analytics product',
        },
      })
      fireEvent.click(screen.getByRole('button', { name: /generate map/i }))

      expect(
        await screen.findByRole('button', { name: /Goals/i }, { timeout: 5000 }),
      ).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /Goals/i }))

      fireEvent.change(screen.getByLabelText(/agent command/i), {
        target: {
          value: 'Rename this node to Priority goals',
        },
      })
      fireEvent.click(screen.getByRole('button', { name: /preview plan/i }))

      await waitFor(
        () => {
          expect(screen.getByLabelText(/agent plan output/i)).toHaveTextContent(
            /rename_node/i,
          )
        },
        {
          timeout: 5000,
        },
      )

      fireEvent.click(screen.getByRole('button', { name: /Audience/i }))
      fireEvent.click(screen.getByRole('button', { name: /apply previewed plan/i }))

      expect(
        await screen.findByRole('button', { name: /Priority goals/i }, { timeout: 5000 }),
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Audience/i })).toBeInTheDocument()

      const shown = await handler({
        method: 'GET',
        url: `/api/mindmap/session/${sessionId}`,
      })
      const session = shown.body.session as {
        graph: {
          nodes: Record<string, { title: string }>
        }
      }

      expect(session.graph.nodes.n_root_goals_1?.title).toBe('Priority goals')
      expect(session.graph.nodes.n_root_audience_2?.title).toBe('Audience')
    },
    15000,
  )

  it(
    'shows browser-visible feedback for invalid agent commands',
    async () => {
      const created = await handler({
        method: 'POST',
        url: '/api/mindmap/session',
      })
      const sessionId = (created.body.session as { id: string }).id

      window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId)

      render(<App />)

      expect(
        await screen.findByText(sessionId, {}, { timeout: 5000 }),
      ).toBeInTheDocument()

      fireEvent.change(screen.getByLabelText(/agent command/i), {
        target: {
          value: 'Teleport this map into a spreadsheet',
        },
      })
      fireEvent.click(screen.getByRole('button', { name: /run command/i }))

      await waitFor(
        () => {
          expect(screen.getByRole('alert')).toHaveTextContent(
            /unsupported natural-language command/i,
          )
        },
        {
          timeout: 5000,
        },
      )

      await waitFor(
        () => {
          expect(screen.getByLabelText(/recent command runs/i)).toHaveTextContent(
            /failed/i,
          )
        },
        {
          timeout: 5000,
        },
      )
    },
    15000,
  )

  it(
    'allows replaying a recent command run from the browser workspace',
    async () => {
      const created = await handler({
        method: 'POST',
        url: '/api/mindmap/session',
      })
      const sessionId = (created.body.session as { id: string }).id

      window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId)

      render(<App />)

      expect(
        await screen.findByText(sessionId, {}, { timeout: 5000 }),
      ).toBeInTheDocument()

      fireEvent.change(screen.getByLabelText(/prompt input/i), {
        target: {
          value: 'Launch strategy for a new B2B analytics product',
        },
      })
      fireEvent.click(screen.getByRole('button', { name: /generate map/i }))

      expect(
        await screen.findByRole('button', { name: /Goals/i }, { timeout: 5000 }),
      ).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /Goals/i }))

      fireEvent.change(screen.getByLabelText(/agent command/i), {
        target: {
          value:
            'Rename this node to Priority goals and add child node called Success metrics',
        },
      })
      fireEvent.click(screen.getByRole('button', { name: /run command/i }))

      expect(
        await screen.findByRole('button', { name: /Priority goals/i }, { timeout: 5000 }),
      ).toBeInTheDocument()
      expect(
        await screen.findByRole(
          'button',
          { name: /replay run/i },
          { timeout: 5000 },
        ),
      ).toBeInTheDocument()

      fireEvent.click(
        screen.getByRole('button', {
          name: /replay run/i,
        }),
      )

      await waitFor(
        async () => {
          const shown = await handler({
            method: 'GET',
            url: `/api/mindmap/session/${sessionId}`,
          })
          const session = shown.body.session as {
            graph: {
              nodes: Record<
                string,
                {
                  title: string
                  parentId: string | null
                }
              >
            }
            commandRuns: Array<{
              id: string
              replayOfCommandRunId?: string
            }>
          }

          expect(session.commandRuns).toHaveLength(2)
          expect(session.commandRuns.at(-1)?.replayOfCommandRunId).toBe(
            session.commandRuns[0]?.id,
          )
          expect(
            Object.values(session.graph.nodes).filter(
              (node) =>
                node.parentId === 'n_root_goals_1' &&
                node.title === 'Success metrics',
            ),
          ).toHaveLength(2)
        },
        {
          timeout: 5000,
        },
      )
    },
    15000,
  )
})
