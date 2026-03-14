import type { CSSProperties } from 'react'
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react'
import type { MindmapGraph } from '../core/graph-types'

type GraphViewProps = {
  graph: MindmapGraph
  selectedNodeId: string | null
  onSelectNode: (nodeId: string) => void
}

type OrderedNode = {
  depth: number
  id: string
}

function getOrderedNodes(
  graph: MindmapGraph,
  nodeId = graph.rootNodeId,
  depth = 0,
): OrderedNode[] {
  const node = graph.nodes[nodeId]

  if (!node) {
    return []
  }

  return [
    { depth, id: nodeId },
    ...node.children.flatMap((childId) => getOrderedNodes(graph, childId, depth + 1)),
  ]
}

function buildFlow(graph: MindmapGraph, selectedNodeId: string | null) {
  const orderedNodes = getOrderedNodes(graph)
  const rowsByDepth = new Map<number, number>()
  const positions = new Map<string, { x: number; y: number }>()

  for (const entry of orderedNodes) {
    const row = rowsByDepth.get(entry.depth) ?? 0
    positions.set(entry.id, {
      x: entry.depth * 260,
      y: row * 148,
    })
    rowsByDepth.set(entry.depth, row + 1)
  }

  const nodes: Node[] = orderedNodes.map((entry) => {
    const current = graph.nodes[entry.id]

    return {
      id: current.id,
      position: positions.get(current.id) ?? { x: 0, y: 0 },
      data: {
        label: (
          <div
            className={`flow-chip${selectedNodeId === current.id ? ' flow-chip--selected' : ''}`}
          >
            <strong>{current.title}</strong>
            <span>{current.kind}</span>
          </div>
        ),
      },
      style: {
        width: 220,
        border: 'none',
        background: 'transparent',
      },
    }
  })

  const edges: Edge[] = Object.values(graph.nodes).flatMap((node) =>
    node.children.map((childId) => ({
      id: `${node.id}-${childId}`,
      source: node.id,
      target: childId,
      animated: selectedNodeId === node.id || selectedNodeId === childId,
    })),
  )

  return {
    nodes,
    edges,
    orderedNodes,
  }
}

export function GraphView(props: GraphViewProps) {
  const flow = buildFlow(props.graph, props.selectedNodeId)

  return (
    <section className="workspace-card graph-panel">
      <div className="panel-heading panel-heading--compact">
        <div>
          <p className="panel-eyebrow">Graph canvas</p>
          <h2>Live structure</h2>
        </div>
        <p className="panel-note">
          The canvas is visual. The canonical graph state stays outside React
          Flow.
        </p>
      </div>

      <div className="graph-panel__canvas">
        <ReactFlow
          fitView
          nodes={flow.nodes}
          edges={flow.edges}
          nodesDraggable={false}
          nodesConnectable={false}
          onNodeClick={(_, node) => props.onSelectNode(node.id)}
        >
          <MiniMap pannable zoomable />
          <Controls showInteractive={false} />
          <Background gap={18} size={1} />
        </ReactFlow>
      </div>

      <div className="graph-panel__outline" aria-label="Graph outline">
        {flow.orderedNodes.map((entry) => {
          const node = props.graph.nodes[entry.id]

          return (
            <button
              key={node.id}
              className={`outline-node${props.selectedNodeId === node.id ? ' outline-node--selected' : ''}`}
              onClick={() => props.onSelectNode(node.id)}
              style={{ '--outline-depth': entry.depth } as CSSProperties}
              type="button"
            >
              <span>{node.title}</span>
              <small>{node.kind}</small>
            </button>
          )
        })}
      </div>
    </section>
  )
}
