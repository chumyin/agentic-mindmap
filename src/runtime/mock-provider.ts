import type { GraphEdit, MindmapArtifact, MindmapGraph } from '../core/graph-types'
import type { MindmapProvider, ProviderArtifactResult, ProviderEditResult } from './session-types'

function slugifySegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function makeChildId(parentId: string, title: string, index: number): string {
  return `${parentId}_${slugifySegment(title) || 'node'}_${index + 1}`
}

function buildOutline(graph: MindmapGraph, nodeId: string, depth = 0): string[] {
  const node = graph.nodes[nodeId]

  if (!node) {
    return []
  }

  const prefix = `${'  '.repeat(depth)}- `
  const lines = [`${prefix}${node.title}`]

  for (const childId of node.children) {
    lines.push(...buildOutline(graph, childId, depth + 1))
  }

  return lines
}

function pickInitialChildren(prompt: string): string[] {
  const normalized = prompt.toLowerCase()

  if (normalized.includes('launch')) {
    return ['Goals', 'Audience', 'Execution']
  }

  if (normalized.includes('research')) {
    return ['Questions', 'Signals', 'Synthesis']
  }

  return ['Context', 'Opportunities', 'Next steps']
}

function pickExpansionChildren(instruction?: string): string[] {
  const normalized = instruction?.toLowerCase() ?? ''

  if (normalized.includes('risk')) {
    return ['Key risks', 'Dependencies']
  }

  if (normalized.includes('summary')) {
    return ['Main takeaway', 'Supporting point']
  }

  return ['Supporting detail', 'Next action']
}

export function createMockProvider(): MindmapProvider {
  return {
    async generateInitialMap(input): Promise<ProviderEditResult> {
      const titles = pickInitialChildren(input.prompt)
      const edits: GraphEdit[] = titles.map((title, index) => ({
        type: 'create_node',
        node: {
          id: makeChildId(input.rootNodeId, title, index),
          parentId: input.rootNodeId,
          kind: 'subtopic',
          title,
        },
      }))

      return {
        edits,
        summary: `Generated ${titles.length} primary branches from the prompt.`,
      }
    },

    async expandBranch(input): Promise<ProviderEditResult> {
      const titles = pickExpansionChildren(input.instruction)
      const edits: GraphEdit[] = titles.map((title, index) => ({
        type: 'create_node',
        node: {
          id: makeChildId(input.targetNodeId, title, index),
          parentId: input.targetNodeId,
          kind: title.toLowerCase().includes('risk') ? 'risk' : 'note',
          title,
        },
      }))

      return {
        edits,
        summary: `Expanded branch "${input.graph.nodes[input.targetNodeId]?.title ?? input.targetNodeId}" with ${titles.length} child nodes.`,
      }
    },

    async summarizeBranch(input): Promise<ProviderArtifactResult> {
      const lines = buildOutline(input.graph, input.targetNodeId)
      const node = input.graph.nodes[input.targetNodeId]
      const artifact: MindmapArtifact = {
        id: `summary.${input.targetNodeId}`,
        kind: 'summary',
        title: `${node?.title ?? 'Selection'} summary`,
        content: lines.join('\n'),
        sourceNodeId: input.targetNodeId,
      }

      return {
        artifact,
        summary: `Summarized branch "${node?.title ?? input.targetNodeId}".`,
      }
    },

    async createOutline(input): Promise<ProviderArtifactResult> {
      const lines = buildOutline(input.graph, input.targetNodeId)
      const node = input.graph.nodes[input.targetNodeId]
      const artifact: MindmapArtifact = {
        id: `outline.${input.targetNodeId}`,
        kind: 'outline',
        title: `${node?.title ?? 'Selection'} outline`,
        content: lines.join('\n'),
        sourceNodeId: input.targetNodeId,
      }

      return {
        artifact,
        summary: `Created outline for "${node?.title ?? input.targetNodeId}".`,
      }
    },
  }
}
