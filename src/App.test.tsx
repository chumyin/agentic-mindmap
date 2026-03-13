import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('@xyflow/react', async () => {
  const actual =
    await vi.importActual<typeof import('@xyflow/react')>('@xyflow/react')

  return {
    ...actual,
    Background: () => null,
    Controls: () => null,
    MiniMap: () => null,
    ReactFlow: () => <div data-testid="mindmap-preview" />,
    ReactFlowProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  }
})

describe('App', () => {
  it('renders the product narrative and preview shell', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', {
        name: /mindmaps that agents can read, transform, and operate on/i,
      }),
    ).toBeInTheDocument()

    expect(
      screen.getByRole('heading', { name: /designed for ai-native graph operations/i }),
    ).toBeInTheDocument()

    expect(screen.getByTestId('mindmap-preview')).toBeInTheDocument()
  })
})
