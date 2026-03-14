import type { MindmapSession } from './session-types'
import type { MindmapCommandPlan, MindmapCommandToolCall } from './session-types'

function cleanCommandText(value: string): string {
  return value.trim().replace(/^["']+|["'.!?]+$/g, '').trim()
}

function selectedNode(session: MindmapSession) {
  const focusedNodeId = session.graph.selection.focusedNodeId
  return (
    session.graph.nodes[focusedNodeId ?? ''] ??
    session.graph.nodes[session.graph.rootNodeId]
  )
}

function createToolCall(
  toolName: MindmapCommandToolCall['toolName'],
  args: Record<string, unknown>,
): MindmapCommandToolCall {
  return {
    id: `call_${toolName}_1`,
    toolName,
    arguments: args,
  }
}

function splitCompoundCommand(input: string): string[] {
  return input
    .split(
      /\s+(?:and then|then)\s+|\s+and\s+(?=(?:rename|retitle|add|create|delete|remove|generate|make|start|build|expand|grow|extend|summari[sz]e|export)\b)|\s*;\s*/i,
    )
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
}

function planRenameCommand(
  session: MindmapSession,
  input: string,
): MindmapCommandPlan | null {
  const match = input.match(
    /^(?:rename|retitle)(?:\s+(?:this|current|selected)\s+node)?\s+(?:to|as)\s+(.+)$/i,
  )

  if (!match) {
    return null
  }

  const node = selectedNode(session)
  const title = cleanCommandText(match[1] ?? '')

  if (!title) {
    throw new Error('Unable to determine the target title from the command.')
  }

  return {
    input,
    summary: `Rename "${node.title}" to "${title}".`,
    target: {
      sessionId: session.id,
      nodeId: node.id,
      nodeTitle: node.title,
    },
    toolCalls: [
      createToolCall('rename_node', {
        nodeId: node.id,
        title,
      }),
    ],
  }
}

function planAddChildCommand(
  session: MindmapSession,
  input: string,
): MindmapCommandPlan | null {
  const match = input.match(
    /^(?:add|create)(?:\s+(?:a|an))?\s+child(?:\s+node)?(?:\s+(?:called|named|titled))?\s+(.+)$/i,
  )

  if (!match) {
    return null
  }

  const node = selectedNode(session)
  const title = cleanCommandText(match[1] ?? '')

  if (!title) {
    throw new Error('Unable to determine the child-node title from the command.')
  }

  return {
    input,
    summary: `Add a child node "${title}" under "${node.title}".`,
    target: {
      sessionId: session.id,
      nodeId: node.id,
      nodeTitle: node.title,
    },
    toolCalls: [
      createToolCall('add_child_node', {
        parentId: node.id,
        title,
        kind: 'note',
      }),
    ],
  }
}

function planDeleteNodeCommand(
  session: MindmapSession,
  input: string,
): MindmapCommandPlan | null {
  if (
    !/^(?:delete|remove)(?:\s+(?:this|current|selected)\s+node|\s+node)?$/i.test(input)
  ) {
    return null
  }

  const node = selectedNode(session)

  if (node.parentId === null) {
    throw new Error('The root node cannot be deleted through a natural-language command.')
  }

  return {
    input,
    summary: `Delete "${node.title}".`,
    target: {
      sessionId: session.id,
      nodeId: node.id,
      nodeTitle: node.title,
    },
    toolCalls: [
      createToolCall('delete_node', {
        nodeId: node.id,
      }),
    ],
  }
}

function planGenerateMapCommand(
  session: MindmapSession,
  input: string,
): MindmapCommandPlan | null {
  const match = input.match(
    /^(?:generate|create|make|start|build)(?:\s+(?:a|an|the))?\s*(?:mind ?map|map)(?:\s+(?:about|for|on|from))?\s+(.+)$/i,
  )

  if (!match) {
    return null
  }

  const prompt = cleanCommandText(match[1] ?? '')

  if (!prompt) {
    throw new Error('Unable to determine the generation prompt from the command.')
  }

  return {
    input,
    summary: `Generate a map from "${prompt}".`,
    target: {
      sessionId: session.id,
      nodeId: session.graph.rootNodeId,
      nodeTitle: session.graph.nodes[session.graph.rootNodeId]?.title ?? null,
    },
    toolCalls: [
      createToolCall('generate_map', {
        prompt,
      }),
    ],
  }
}

function planIntentCommand(
  session: MindmapSession,
  input: string,
): MindmapCommandPlan | null {
  const node = selectedNode(session)
  const normalized = input.toLowerCase()

  if (
    /(?:create|make|generate|export)\s+(?:an?\s+)?outline/.test(normalized) &&
    /(?:this|current|selected|branch|map)?/.test(normalized)
  ) {
    return {
      input,
      summary: `Create an outline from "${node.title}".`,
      target: {
        sessionId: session.id,
        nodeId: node.id,
        nodeTitle: node.title,
      },
      toolCalls: [
        createToolCall('run_intent', {
          intent: 'create_outline',
          targetNodeId: node.id,
        }),
      ],
    }
  }

  if (/(?:summari[sz]e)\s+(?:this|current|selected)?\s*(?:branch|node|topic)?/.test(normalized)) {
    return {
      input,
      summary: `Summarize "${node.title}".`,
      target: {
        sessionId: session.id,
        nodeId: node.id,
        nodeTitle: node.title,
      },
      toolCalls: [
        createToolCall('run_intent', {
          intent: 'summarize_branch',
          targetNodeId: node.id,
        }),
      ],
    }
  }

  const expandMatch = input.match(
    /^(?:expand|grow|extend)(?:\s+(?:this|current|selected)\s+branch)?(?:\s+(?:with|by|to include|for))?\s*(.*)$/i,
  )

  if (expandMatch) {
    const instruction = cleanCommandText(expandMatch[1] ?? '')

    return {
      input,
      summary: instruction
        ? `Expand "${node.title}" with "${instruction}".`
        : `Expand "${node.title}".`,
      target: {
        sessionId: session.id,
        nodeId: node.id,
        nodeTitle: node.title,
      },
      toolCalls: [
        createToolCall('run_intent', {
          intent: 'expand_branch',
          targetNodeId: node.id,
          instruction: instruction || undefined,
        }),
      ],
    }
  }

  return null
}

function planSingleMindmapCommand(input: {
  session: MindmapSession
  input: string
}): MindmapCommandPlan {
  const trimmedInput = input.input.trim()

  if (!trimmedInput) {
    throw new Error('Expected "input" to be a non-empty string.')
  }

  const planners = [
    planRenameCommand,
    planAddChildCommand,
    planDeleteNodeCommand,
    planGenerateMapCommand,
    planIntentCommand,
  ]

  for (const planner of planners) {
    const plan = planner(input.session, trimmedInput)

    if (plan) {
      return plan
    }
  }

  throw new Error(
    `Unsupported natural-language command "${trimmedInput}". Try a map generation, rename, add-child, delete, expand, summarize, or outline command.`,
  )
}

export function planMindmapCommand(input: {
  session: MindmapSession
  input: string
}): MindmapCommandPlan {
  const trimmedInput = input.input.trim()

  if (!trimmedInput) {
    throw new Error('Expected "input" to be a non-empty string.')
  }

  const segments = splitCompoundCommand(trimmedInput)
  const stepPlans = segments.map((segment) =>
    planSingleMindmapCommand({
      session: input.session,
      input: segment,
    }),
  )

  const toolCalls = stepPlans.flatMap((plan) => plan.toolCalls).map((toolCall, index) => ({
    ...toolCall,
    id: `call_${toolCall.toolName}_${index + 1}`,
  }))

  if (stepPlans.length === 1) {
    return {
      ...stepPlans[0],
      toolCalls,
    }
  }

  return {
    input: trimmedInput,
    summary: `Planned ${stepPlans.length} steps: ${stepPlans
      .map((plan) => plan.summary)
      .join(' Then ')}`,
    target: stepPlans[0].target,
    toolCalls,
  }
}
