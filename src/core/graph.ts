import type {
  CreateNodeInput,
  GraphEdit,
  MindmapArtifact,
  MindmapGraph,
  MindmapNode,
  MindmapSelection,
  UpdateNodePatch,
} from './graph-types'

function cloneNodes(graph: MindmapGraph): Record<string, MindmapNode> {
  return Object.fromEntries(
    Object.entries(graph.nodes).map(([id, node]) => [
      id,
      {
        ...node,
        children: [...node.children],
      },
    ]),
  )
}

function assertNodeExists(graph: MindmapGraph, nodeId: string): MindmapNode {
  const node = graph.nodes[nodeId]

  if (!node) {
    throw new Error(`Node "${nodeId}" was not found.`)
  }

  return node
}

function removeSubtree(
  nodes: Record<string, MindmapNode>,
  nodeId: string,
): Record<string, MindmapNode> {
  const nextNodes = { ...nodes }
  const queue = [nodeId]

  while (queue.length > 0) {
    const currentId = queue.pop()

    if (!currentId) {
      continue
    }

    const current = nextNodes[currentId]
    if (!current) {
      continue
    }

    queue.push(...current.children)
    delete nextNodes[currentId]
  }

  return nextNodes
}

export function createGraph(title: string, rootNodeId = 'n_root'): MindmapGraph {
  return {
    version: '0.1',
    rootNodeId,
    nodes: {
      [rootNodeId]: {
        id: rootNodeId,
        kind: 'topic',
        title,
        parentId: null,
        children: [],
        status: 'active',
      },
    },
    artifacts: {},
    selection: {
      focusedNodeId: rootNodeId,
      selectedNodeIds: [rootNodeId],
    },
  }
}

export function createChildNode(
  graph: MindmapGraph,
  input: CreateNodeInput,
): MindmapGraph {
  const parent = assertNodeExists(graph, input.parentId)

  if (graph.nodes[input.id]) {
    throw new Error(`Node "${input.id}" already exists.`)
  }

  const nodes = cloneNodes(graph)
  nodes[parent.id] = {
    ...parent,
    children: [...parent.children, input.id],
  }
  nodes[input.id] = {
    id: input.id,
    kind: input.kind,
    title: input.title,
    body: input.body,
    parentId: input.parentId,
    children: [],
    status: input.status ?? 'active',
    meta: input.meta,
  }

  return {
    ...graph,
    nodes,
  }
}

export function updateNode(
  graph: MindmapGraph,
  nodeId: string,
  patch: UpdateNodePatch,
): MindmapGraph {
  const node = assertNodeExists(graph, nodeId)
  const nodes = cloneNodes(graph)

  nodes[nodeId] = {
    ...node,
    ...patch,
  }

  return {
    ...graph,
    nodes,
  }
}

export function deleteNode(graph: MindmapGraph, nodeId: string): MindmapGraph {
  const node = assertNodeExists(graph, nodeId)

  if (node.parentId === null) {
    throw new Error('The root node cannot be deleted.')
  }

  const parent = assertNodeExists(graph, node.parentId)
  const nodes = removeSubtree(cloneNodes(graph), nodeId)

  nodes[parent.id] = {
    ...parent,
    children: parent.children.filter((childId) => childId !== nodeId),
  }

  const selection =
    graph.selection.focusedNodeId === nodeId ||
    graph.selection.selectedNodeIds.includes(nodeId)
      ? {
          focusedNodeId: parent.id,
          selectedNodeIds: [parent.id],
        }
      : graph.selection

  return {
    ...graph,
    nodes,
    selection,
  }
}

export function reorderChildren(
  graph: MindmapGraph,
  parentId: string,
  childIds: string[],
): MindmapGraph {
  const parent = assertNodeExists(graph, parentId)
  const sameMembers =
    parent.children.length === childIds.length &&
    parent.children.every((childId) => childIds.includes(childId))

  if (!sameMembers) {
    throw new Error(`Child order for node "${parentId}" is invalid.`)
  }

  const nodes = cloneNodes(graph)
  nodes[parentId] = {
    ...parent,
    children: [...childIds],
  }

  return {
    ...graph,
    nodes,
  }
}

export function setSelection(
  graph: MindmapGraph,
  selection: MindmapSelection,
): MindmapGraph {
  return {
    ...graph,
    selection: {
      focusedNodeId: selection.focusedNodeId,
      selectedNodeIds: [...selection.selectedNodeIds],
    },
  }
}

export function attachArtifact(
  graph: MindmapGraph,
  artifact: MindmapArtifact,
): MindmapGraph {
  return {
    ...graph,
    artifacts: {
      ...graph.artifacts,
      [artifact.id]: artifact,
    },
  }
}

export function applyGraphEdit(
  graph: MindmapGraph,
  edit: GraphEdit,
): MindmapGraph {
  switch (edit.type) {
    case 'create_node':
      return createChildNode(graph, edit.node)
    case 'update_node':
      return updateNode(graph, edit.nodeId, edit.patch)
    case 'delete_node':
      return deleteNode(graph, edit.nodeId)
    case 'reorder_children':
      return reorderChildren(graph, edit.parentId, edit.childIds)
    case 'set_selection':
      return setSelection(graph, edit.selection)
    case 'attach_artifact':
      return attachArtifact(graph, edit.artifact)
  }
}

export function applyGraphEdits(
  graph: MindmapGraph,
  edits: GraphEdit[],
): MindmapGraph {
  return edits.reduce((currentGraph, edit) => applyGraphEdit(currentGraph, edit), graph)
}
