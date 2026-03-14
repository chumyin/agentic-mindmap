import { applyGraphEdits, createGraph } from '../core/graph'
import { describe, expect, it } from 'vitest'
import type { MindmapSession } from './session-types'
import { planMindmapCommand } from './command-planner'

function createSessionWithGraph(graph: MindmapSession['graph']): MindmapSession {
  return {
    id: 'sess_test',
    createdAt: '2026-03-14T00:00:00.000Z',
    updatedAt: '2026-03-14T00:00:00.000Z',
    graph,
    history: [],
    commandRuns: [],
    provider: {
      mode: 'mock',
    },
  }
}

describe('mindmap command planner', () => {
  it('plans a rename command against the current selection as a structured tool call', () => {
    const graph = applyGraphEdits(createGraph('Launch strategy'), [
      {
        type: 'create_node',
        node: {
          id: 'n_goals',
          parentId: 'n_root',
          kind: 'subtopic',
          title: 'Goals',
        },
      },
      {
        type: 'set_selection',
        selection: {
          focusedNodeId: 'n_goals',
          selectedNodeIds: ['n_goals'],
        },
      },
    ])

    const plan = planMindmapCommand({
      session: createSessionWithGraph(graph),
      input: 'Rename this node to Priority goals',
    })

    expect(plan.toolCalls).toEqual([
      expect.objectContaining({
        toolName: 'rename_node',
        arguments: {
          nodeId: 'n_goals',
          title: 'Priority goals',
        },
      }),
    ])
    expect(plan.summary).toContain('Priority goals')
  })

  it('plans an outline command against the current selection', () => {
    const graph = applyGraphEdits(createGraph('Launch strategy'), [
      {
        type: 'create_node',
        node: {
          id: 'n_goals',
          parentId: 'n_root',
          kind: 'subtopic',
          title: 'Goals',
        },
      },
      {
        type: 'set_selection',
        selection: {
          focusedNodeId: 'n_goals',
          selectedNodeIds: ['n_goals'],
        },
      },
    ])

    const plan = planMindmapCommand({
      session: createSessionWithGraph(graph),
      input: 'Create an outline for this branch',
    })

    expect(plan.toolCalls).toEqual([
      expect.objectContaining({
        toolName: 'run_intent',
        arguments: {
          intent: 'create_outline',
          targetNodeId: 'n_goals',
        },
      }),
    ])
  })

  it('plans a compound command into ordered tool calls', () => {
    const graph = applyGraphEdits(createGraph('Launch strategy'), [
      {
        type: 'create_node',
        node: {
          id: 'n_goals',
          parentId: 'n_root',
          kind: 'subtopic',
          title: 'Goals',
        },
      },
      {
        type: 'set_selection',
        selection: {
          focusedNodeId: 'n_goals',
          selectedNodeIds: ['n_goals'],
        },
      },
    ])

    const plan = planMindmapCommand({
      session: createSessionWithGraph(graph),
      input: 'Rename this node to Priority goals and add child node called Success metrics',
    })

    expect(plan.toolCalls).toEqual([
      expect.objectContaining({
        toolName: 'rename_node',
        arguments: expect.objectContaining({
          nodeId: 'n_goals',
          title: 'Priority goals',
        }),
      }),
      expect.objectContaining({
        toolName: 'add_child_node',
        arguments: expect.objectContaining({
          parentId: 'n_goals',
          title: 'Success metrics',
        }),
      }),
    ])
    expect(plan.summary).toContain('2 step')
  })

  it('rejects unsupported natural-language commands', () => {
    const graph = createGraph('Launch strategy')

    expect(() =>
      planMindmapCommand({
        session: createSessionWithGraph(graph),
        input: 'Teleport this map into a spreadsheet',
      }),
    ).toThrow(/unsupported natural-language command/i)
  })
})
