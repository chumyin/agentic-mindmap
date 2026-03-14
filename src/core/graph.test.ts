import { describe, expect, it } from 'vitest'
import {
  applyGraphEdit,
  attachArtifact,
  createChildNode,
  createGraph,
  deleteNode,
  reorderChildren,
  setSelection,
  updateNode,
} from './graph'

describe('graph core', () => {
  it('creates a graph with a root node and default selection', () => {
    const graph = createGraph('Launch strategy')

    expect(graph.rootNodeId).toBe('n_root')
    expect(graph.selection).toEqual({
      focusedNodeId: 'n_root',
      selectedNodeIds: ['n_root'],
    })
    expect(graph.nodes.n_root).toMatchObject({
      id: 'n_root',
      kind: 'topic',
      title: 'Launch strategy',
      parentId: null,
      children: [],
      status: 'active',
    })
  })

  it('creates a child node under a parent and preserves child order', () => {
    const graph = createGraph('Launch strategy')

    const withResearch = createChildNode(graph, {
      id: 'n_research',
      parentId: 'n_root',
      kind: 'subtopic',
      title: 'Research',
    })
    const withRisks = createChildNode(withResearch, {
      id: 'n_risks',
      parentId: 'n_root',
      kind: 'risk',
      title: 'Risks',
    })

    expect(withRisks.nodes.n_root.children).toEqual(['n_research', 'n_risks'])
    expect(withRisks.nodes.n_research).toMatchObject({
      parentId: 'n_root',
      title: 'Research',
    })
  })

  it('updates a node title without mutating unrelated nodes', () => {
    const graph = createChildNode(createGraph('Launch strategy'), {
      id: 'n_research',
      parentId: 'n_root',
      kind: 'subtopic',
      title: 'Research',
    })

    const updated = updateNode(graph, 'n_research', {
      title: 'User research',
      body: 'Interview target users and cluster findings.',
    })

    expect(updated.nodes.n_research).toMatchObject({
      title: 'User research',
      body: 'Interview target users and cluster findings.',
    })
    expect(updated.nodes.n_root.title).toBe('Launch strategy')
  })

  it('deletes a non-root node and removes it from its parent children', () => {
    const graph = createChildNode(createGraph('Launch strategy'), {
      id: 'n_research',
      parentId: 'n_root',
      kind: 'subtopic',
      title: 'Research',
    })

    const updated = deleteNode(graph, 'n_research')

    expect(updated.nodes.n_root.children).toEqual([])
    expect(updated.nodes.n_research).toBeUndefined()
  })

  it('reorders sibling nodes deterministically', () => {
    const graph = createChildNode(
      createChildNode(createGraph('Launch strategy'), {
        id: 'n_research',
        parentId: 'n_root',
        kind: 'subtopic',
        title: 'Research',
      }),
      {
        id: 'n_risks',
        parentId: 'n_root',
        kind: 'risk',
        title: 'Risks',
      },
    )

    const updated = reorderChildren(graph, 'n_root', ['n_risks', 'n_research'])

    expect(updated.nodes.n_root.children).toEqual(['n_risks', 'n_research'])
  })

  it('attaches artifacts and updates selection context', () => {
    const graph = createGraph('Launch strategy')

    const withSelection = setSelection(graph, {
      focusedNodeId: 'n_root',
      selectedNodeIds: ['n_root'],
    })
    const withArtifact = attachArtifact(withSelection, {
      id: 'outline.root',
      kind: 'outline',
      title: 'Launch outline',
      content:
        '- Launch strategy\n  - Problem framing\n  - Research\n  - Execution',
      sourceNodeId: 'n_root',
    })

    expect(withArtifact.selection.focusedNodeId).toBe('n_root')
    expect(withArtifact.artifacts['outline.root']).toMatchObject({
      id: 'outline.root',
      kind: 'outline',
      sourceNodeId: 'n_root',
    })
  })

  it('applies a graph edit through the canonical reducer path', () => {
    const graph = createGraph('Launch strategy')

    const updated = applyGraphEdit(graph, {
      type: 'create_node',
      node: {
        id: 'n_tasks',
        parentId: 'n_root',
        kind: 'task',
        title: 'Execution tasks',
      },
    })

    expect(updated.nodes.n_tasks).toMatchObject({
      id: 'n_tasks',
      parentId: 'n_root',
      kind: 'task',
      title: 'Execution tasks',
    })
    expect(updated.nodes.n_root.children).toEqual(['n_tasks'])
  })
})
