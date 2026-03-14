import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

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
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
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
  })

  it('renders the workspace shell instead of the landing page hero', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', {
        name: /agentic mindmap workspace/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/prompt input/i)).toBeInTheDocument()
    expect(screen.getByTestId('mindmap-canvas')).toBeInTheDocument()
  })

  it('supports prompt generation, manual edits, and outline creation', async () => {
    render(<App />)

    fireEvent.change(screen.getByLabelText(/prompt input/i), {
      target: {
        value: 'Launch strategy for a new B2B analytics product',
      },
    })
    fireEvent.click(screen.getByRole('button', { name: /generate map/i }))

    expect(
      await screen.findByRole('button', { name: /Goals/i }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Goals/i }))

    const titleInput = screen.getByLabelText(/node title/i)
    fireEvent.change(titleInput, {
      target: {
        value: 'Priority goals',
      },
    })

    expect(screen.getByDisplayValue('Priority goals')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /add child node/i }))

    expect(
      await screen.findByRole('button', { name: /New node 1/i }),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/action brief/i), {
      target: {
        value: 'Add risks and dependencies',
      },
    })
    fireEvent.click(screen.getByRole('button', { name: /expand branch/i }))

    expect(
      await screen.findByRole('button', { name: /Key risks/i }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /create outline/i }))

    const artifactOutput = await screen.findByLabelText(/artifact output/i)
    expect(artifactOutput).toHaveTextContent(
      /Launch strategy for a new B2B analytics product/i,
    )
  })
})
