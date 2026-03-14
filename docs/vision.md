# Vision

## Positioning

agentic-mindmap is an AI-native workspace for thinking in graphs.

The product thesis is simple: a mindmap should not stop being useful once the first draft appears. The structure itself should remain available for AI operations such as expansion, regrouping, summarization, and conversion into executable outputs.

## Product principles

### 1. The graph is the product surface

The graph is not a decorative output. It is the main working object. Every meaningful AI action should understand node relationships, hierarchy, branch scope, and structural intent.

### 2. Chat should not replace structure

Conversation is useful, but it should not hide the map. The system should let users issue intent in natural language while keeping the resulting structure inspectable and editable.

The product is not "agent-only". Human edits matter:

- selecting a branch
- renaming nodes
- adding or deleting child nodes
- correcting the structure before or after an agent action

The map should support a mixed-control workflow, not an automation-only workflow.

### 3. Execution is part of the workflow

The map should be able to produce downstream artifacts:

- plans
- outlines
- specs
- summaries
- checklists

The map is valuable because it bridges thought and action.

## Non-goals for the first public phase

- building a full collaborative whiteboard
- shipping every export format immediately
- optimizing for enterprise multi-tenant concerns before the interaction model is proven

## Technology stance

The first version is front-end heavy on purpose.

Vite + React + TypeScript is the fastest way to iterate on:

- graph editing interactions
- branch-level action UX
- AI command surfaces
- visual clarity of the canvas

If the project later needs dedicated long-running services or agent workers, Go remains a strong candidate for that layer, but not for the first public repository baseline.

## Current prototype stance

The current prototype intentionally separates transport from protocol:

- the browser proves the human editing and agent action workflow
- the CLI proves agent-oriented control from external tools
- both rely on the same graph concepts, edit types, and mock provider model

Storage is still split by environment:

- browser sessions are currently stored in `localStorage`
- CLI sessions are stored on disk under `.agentic-mindmap/sessions/`

Unifying those backends is future work, not hidden behavior.
