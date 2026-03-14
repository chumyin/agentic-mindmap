# agentic-mindmap Prototype Design

**Date:** 2026-03-14

## Goal

Build the first functional prototype of `agentic-mindmap` as an AI-assisted,
human-editable mindmap workspace with a CLI-first integration surface.

The prototype must prove one narrow but complete workflow:

1. A user enters natural language.
2. The system generates an initial mindmap.
3. The user manually edits the graph.
4. The user or an external agent triggers structured graph actions.
5. The system exports an outline or brief while preserving graph traceability.

The product should be "agentic" without excluding human control. Human edits and
agent edits must operate on the same graph state and operation history.

## Product stance

This prototype should stop being a landing page and become a real workspace.

The first iteration is intentionally narrow:

- no MCP dependency
- no multi-user collaboration
- no hosted backend
- no production LLM provider integration requirement
- no enterprise persistence or auth concerns

The focus is a credible local runtime with:

- an editable graph model
- a CLI for agents such as Codex
- a browser UI for humans
- a shared operation protocol between both

## Why CLI-first instead of MCP

The target user workflow involves agents that already operate in CLI-heavy
environments. MCP would introduce repeated context shipping and additional
protocol overhead before the product's state model is mature.

CLI-first is the correct starting point because it:

- keeps the integration surface simple
- works naturally with Codex and shell-driven agents
- allows stable JSON stdin/stdout contracts
- makes state external to model context via local sessions
- can later be wrapped by a daemon or socket layer without changing the graph
  protocol

The design should therefore support:

- one-shot CLI commands today
- optional local long-lived runtime tomorrow

## Architecture overview

Keep the repository as a single package for now, but split implementation into
clear internal layers:

- `src/core`
- `src/runtime`
- `src/web`
- `src/cli`

### `src/core`

Pure domain logic and protocol definitions:

- graph schema
- graph edit schema
- agent intent schema
- session schema
- operation record schema
- artifact schema
- graph validation helpers
- graph reducer and immutable operations

This layer must not depend on React or Node process APIs.

### `src/runtime`

Stateful orchestration and adapters:

- local session store
- operation application
- history management
- provider adapter interface
- mock provider implementation
- intent planner / executor
- export helpers

This layer mediates between human intent, agent intent, and the pure `core`
operations.

### `src/web`

The browser workspace:

- prompt input
- graph rendering
- node selection
- manual editing controls
- agent action controls
- export preview
- operation history surface

The web layer should not define its own graph mutation rules. It calls runtime
services and renders runtime state.

### `src/cli`

The machine-facing entry point:

- session creation
- session inspection
- graph generation
- graph actions
- manual graph edits
- export commands

All CLI outputs should be machine-readable JSON by default.

## External reference analysis

Two external repositories are useful references:

1. `vercel-labs/json-render`
2. `vercel-labs/visual-json`

### What to borrow from `json-render`

`json-render` separates:

- schema: structural grammar
- catalog: allowed component and action vocabulary

That pattern should be adapted here as:

- graph schema: shape of graph documents and patches
- capability catalog: allowed agent actions and their structured parameters

`json-render` also uses a flat `root + elements map` representation and a
streaming patch model. Those ideas transfer well to graph generation because:

- flat maps are easier to patch incrementally
- partial updates are easier to validate
- CLI and runtime transports stay compact

### What to borrow from `visual-json`

`visual-json` treats the editing engine as a headless core with immutable
operations, history, and framework-agnostic state transitions.

That is directly relevant here:

- graph editing primitives should be pure and replayable
- undo/redo should sit below the UI
- browser and CLI must consume the same operation model

### What not to copy

This prototype should not import the complexity of those projects:

- no monorepo refactor yet
- no large renderer registry system
- no generic visual editor abstraction beyond what the mindmap workflow needs

The reference value is architectural, not cosmetic.

## Graph document model

The canonical graph document should be agent-friendly and independent of React
Flow.

```json
{
  "version": "0.1",
  "rootNodeId": "n_root",
  "nodes": {
    "n_root": {
      "id": "n_root",
      "kind": "topic",
      "title": "Launch strategy",
      "body": "Top-level planning map",
      "parentId": null,
      "children": ["n_1", "n_2"],
      "status": "active",
      "meta": {
        "source": "agent",
        "confidence": 0.82,
        "tags": ["strategy"]
      }
    }
  },
  "artifacts": {},
  "selection": {
    "focusedNodeId": "n_root",
    "selectedNodeIds": ["n_root"]
  }
}
```

### Graph model rules

- The graph is stored as a flat `nodes` map keyed by ID.
- Parent-child structure is represented through `parentId` and ordered
  `children`.
- `rootNodeId` is explicit.
- `kind` is semantic, not visual.
- UI layout data is not part of the canonical graph document.
- `selection` is part of session state because agent actions need explicit
  branch context.
- `artifacts` are derived outputs linked back to graph context.

### Node kinds

The first prototype only needs a small set:

- `topic`
- `subtopic`
- `task`
- `question`
- `risk`
- `note`

This list is intentionally small. It should support useful structure without
pushing the model into a premature ontology exercise.

## Operation model

The system should separate deterministic graph edits from higher-level agent
intents.

### Graph edits

Deterministic, local, replayable operations:

- `create_node`
- `update_node`
- `delete_node`
- `move_node`
- `reorder_children`
- `set_selection`
- `attach_artifact`

These are the canonical mutation primitives. They must be:

- pure
- validated
- undoable
- serializable

### Agent intents

Higher-level semantic operations that resolve into graph edits:

- `generate_map`
- `expand_branch`
- `regroup_branch`
- `summarize_branch`
- `outline_branch`

The runtime should never let an agent intent mutate state directly. The flow is:

1. accept agent intent
2. gather relevant graph context
3. call provider adapter
4. receive candidate structured output
5. validate candidate output
6. convert output to graph edits or artifacts
7. apply edits through the same reducer used by manual edits

This gives one mutation path for both humans and agents.

## Operation records and history

Every state change should produce an operation record.

```json
{
  "id": "op_20260314_001",
  "type": "expand_branch",
  "actor": {
    "type": "agent",
    "id": "codex"
  },
  "input": {
    "targetNodeId": "n_2",
    "instruction": "Expand risks and dependencies"
  },
  "patches": [
    { "op": "create_node", "nodeId": "n_21" },
    { "op": "move_node", "nodeId": "n_21", "parentId": "n_2", "index": 0 }
  ],
  "summary": "Added 3 risk nodes under Dependencies",
  "createdAt": "2026-03-14T14:00:00Z"
}
```

Operation records are required for:

- undo/redo
- auditability
- agent interoperability
- debugging unexpected graph changes
- later daemon or remote synchronization support

The first prototype can store full snapshots for undo/redo simplicity. The
public operation record should still keep edit-level detail.

## Session model

The session is the product's state container.

```json
{
  "id": "sess_01h...",
  "createdAt": "2026-03-14T06:00:00Z",
  "updatedAt": "2026-03-14T06:03:00Z",
  "graph": {},
  "history": [],
  "artifacts": {},
  "context": {
    "focusedNodeId": "n_root",
    "selectedNodeIds": ["n_root"]
  },
  "provider": {
    "mode": "mock"
  }
}
```

### Session storage

Store sessions locally under:

- `.agentic-mindmap/sessions/<session-id>.json`

This gives:

- low transport overhead
- CLI and web interoperability
- persistent graph context between commands
- a path to daemonization later without redesigning the state model

## Capability catalog

Borrowing from the `json-render` schema/catalog split, define a capability
catalog for agent actions. This is the structured vocabulary available to any
provider adapter or orchestration layer.

Initial capabilities:

- `generate_initial_map`
- `expand_branch`
- `regroup_branch`
- `summarize_branch`
- `create_outline`

Each capability needs:

- name
- parameter schema
- description
- result schema

This catalog becomes the stable contract between:

- CLI callers
- runtime planner
- mock provider
- future real LLM adapters

## Provider model

The first functional prototype should use a mock provider while keeping the
adapter surface realistic.

### Provider interface

```ts
interface MindmapProvider {
  generateInitialMap(input: GenerateInitialMapInput): Promise<GenerateInitialMapResult>
  expandBranch(input: ExpandBranchInput): Promise<ExpandBranchResult>
  summarizeBranch(input: SummarizeBranchInput): Promise<SummarizeBranchResult>
  createOutline(input: CreateOutlineInput): Promise<CreateOutlineResult>
}
```

### Mock provider responsibilities

The mock provider should:

- transform prompt text into a plausible initial graph
- expand selected branches deterministically
- summarize branch content into an artifact
- create a simple outline export

It should be deterministic enough for tests and UI demos.

### Future real provider support

The adapter should later support:

- tool-calling models
- structured output models
- planner/executor split if needed

But the first prototype should not depend on that integration being present.

## CLI contract

The CLI is the primary agent integration surface.

### Command set

- `mindmap session create`
- `mindmap session show --session <id>`
- `mindmap generate --session <id>`
- `mindmap act --session <id>`
- `mindmap edit --session <id>`
- `mindmap export --session <id> --format graph|outline|brief`
- `mindmap inspect --session <id>`

### Input and output strategy

- Accept flags for human ergonomics.
- Accept JSON stdin for agent ergonomics.
- Emit JSON stdout by default.
- Use stable exit codes for failure cases.

### Example flows

Create session:

```bash
mindmap session create
```

Generate map:

```bash
echo '{"prompt":"Turn my notes into a launch strategy map"}' | \
  mindmap generate --session sess_123
```

Expand branch:

```bash
echo '{"action":"expand_branch","targetNodeId":"n_2","instruction":"Add risks"}' | \
  mindmap act --session sess_123
```

### Why this matters for Codex

Codex and similar agents do not need a custom transport if they can:

- create a session
- inspect the session
- apply actions with structured JSON
- read back structured results

That is enough to make the system controllable from an external agent.

## Web workspace design

The current landing app should evolve into a split workspace rather than a
marketing page.

### Workspace layout

- left panel: natural-language prompt, session controls, action history summary
- center: graph canvas
- right panel: selected node details, manual edit controls, agent action panel,
  artifact preview

### Required manual actions

The first prototype only needs the minimal human editing loop:

- select node
- add child node
- edit node title
- delete node
- reorder siblings
- choose current branch context

### Required agent actions from UI

- generate initial map from prompt
- expand selected branch
- summarize selected branch
- create outline from selected branch or whole graph

The UI should treat agent actions as structured commands on the current
selection, not as a free-form chat overlay.

## React Flow usage

React Flow should remain a visualization and interaction layer, not the source
of truth.

Rules:

- derive React Flow nodes and edges from canonical graph state
- derive selection from canonical session context
- convert UI interactions into graph edits
- never treat React Flow internals as the session document

This avoids coupling the product model to the canvas library.

## Patch and streaming strategy

The prototype does not need streaming on day one, but the data model should not
block it.

Recommended internal model:

- canonical mutation format: graph edits
- optional transport format later: JSONL patch stream

This mirrors the useful part of `json-render`'s SpecStream idea without forcing
an early streaming implementation.

If streaming is added later, provider output can be compiled into graph edits as
partial results arrive.

## MVP scope

The first implementation should prove a single closed loop:

1. create session
2. input natural language
3. generate initial graph
4. manually edit graph
5. trigger agent action on selected branch
6. export outline

Out of scope for the first pass:

- real provider credentials
- remote persistence
- collaborative editing
- advanced layout algorithms
- complex drag-and-drop semantics
- server deployment

## Testing strategy

### Core unit tests

- graph validation
- immutable graph edit operations
- selection updates
- artifact attachment
- history transitions

### Runtime integration tests

- session create/load/save
- generate flow using mock provider
- branch expand flow
- summarize flow
- export flow

### CLI contract tests

- create session via CLI
- generate graph via stdin JSON
- inspect session via stdout JSON
- invalid session handling
- invalid node handling
- invalid action handling

### Web interaction tests

- render workspace shell
- generate graph from prompt
- select node and show details
- add child node
- rename node
- run agent action
- show artifact output

### Browser-level verification

Use `agent-browser` to verify the narrow happy path:

1. open workspace
2. enter prompt
3. generate graph
4. select a node
5. run expand or outline
6. confirm canvas and side panel update

## Completion criteria

This prototype is ready when all of the following are true:

- the app is a functional workspace, not just a landing page
- graph state is canonical and independent of React Flow
- local sessions persist graph and selection
- CLI can create, inspect, and mutate sessions
- manual and agent actions use the same reducer/runtime path
- at least one export artifact is generated from graph state
- lint, test, and build pass
- browser smoke verification passes

## Implementation order

Recommended order:

1. `core` graph schema and immutable operations
2. `runtime` session store and mock provider
3. CLI integration
4. web workspace refactor
5. browser verification

This order prevents the project from regressing into a visually convincing shell
without a real state model.
