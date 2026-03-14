# Protocol

## Purpose

The current prototype exposes one local-first protocol that both humans and agents can use against the same file-backed sessions.

The goal is not to standardize a remote multi-tenant API yet. The goal is to make local agent control explicit, discoverable, and stable enough for tools such as Codex to attach without reading internal source files.

## Runtime model

- transport: local HTTP or direct CLI
- authentication: none
- storage: local files under `.agentic-mindmap/sessions/`
- provider mode: deterministic mock provider
- protocol version: `0.1`
- graph version: `0.1`

## Discovery

External clients should start with one of these entrypoints:

### CLI

- `npm run cli -- describe`
- `npm run cli -- session list`
- `npm run cli -- session create`
- `npm run cli -- command --session <session-id>`
- `npm run cli -- command apply --session <session-id>`
- `npm run cli -- command list --session <session-id>`

The CLI returns machine-readable JSON on stdout.

### HTTP

- `GET /api/mindmap/health`
- `GET /api/mindmap/describe`
- `GET /api/mindmap/session`
- `POST /api/mindmap/session`
- `POST /api/mindmap/session/:id/command`
- `POST /api/mindmap/session/:id/command/apply`
- `GET /api/mindmap/session/:id/command`
- `GET /api/mindmap/session/:id/command/:commandRunId`
- `POST /api/mindmap/session/:id/command/:commandRunId/replay`

When the standalone daemon is used, start it through:

```bash
npm run cli -- serve --host 127.0.0.1 --port 3210
```

The daemon prints a startup record containing `server.origin` and `server.apiBase`.

## Session lifecycle

### 1. Create or discover a session

Create a new session:

```bash
npm run cli -- session create
```

Or list existing sessions:

```bash
npm run cli -- session list
```

The session summary shape is:

```json
{
  "id": "sess_xxx",
  "createdAt": "2026-03-14T10:00:00.000Z",
  "updatedAt": "2026-03-14T10:00:05.000Z",
  "rootTitle": "Launch strategy for a new B2B analytics product",
  "nodeCount": 5,
  "artifactCount": 1,
  "historyCount": 2,
  "commandRunCount": 1
}
```

### 2. Generate a map from natural language

```bash
echo '{"prompt":"Launch strategy for a new B2B analytics product"}' | \
  npm run cli -- generate --session <session-id>
```

### 3. Mix human and agent actions on the same graph

Human-side manual edit:

```bash
echo '{"edits":[{"type":"create_node","node":{"id":"n_manual","parentId":"n_root","kind":"note","title":"Manual note"}}]}' | \
  npm run cli -- edit --session <session-id>
```

Agent-style intent execution:

```bash
echo '{"intent":"expand_branch","targetNodeId":"n_idea","instruction":"Add risks and dependencies"}' | \
  npm run cli -- act --session <session-id>
```

Natural-language command planning:

```bash
echo '{"input":"Rename this node to Priority goals","mode":"plan"}' | \
  npm run cli -- command --session <session-id>
```

Natural-language command execution:

```bash
echo '{"input":"Create an outline for this branch","mode":"execute"}' | \
  npm run cli -- command --session <session-id>
```

Compound natural-language command execution:

```bash
echo '{"input":"Rename this node to Priority goals and add child node called Success metrics","mode":"execute","selection":{"focusedNodeId":"n_root_goals_1","selectedNodeIds":["n_root_goals_1"]}}' | \
  npm run cli -- command --session <session-id>
```

The command contract is intentionally two-step:

- plan first into structured tool calls
- execute second through the same runtime operations used by manual edits and explicit intents
- optionally apply a reviewed plan exactly as supplied, without re-planning
- selection context can be supplied explicitly by clients that have local UI state
- compound commands are supported when each step maps cleanly to a known command verb

Executed command traces are persisted on the session itself:

- `status`: `executed` or `failed`
- `completedToolCalls`: how many structured steps finished
- `plan`: the resolved tool-call trace, when planning succeeded
- `replayOfCommandRunId`: the earlier command run that this execution replayed, when applicable
- `error`: failure reason for unsuccessful executions

### 4. Apply a reviewed plan exactly

Apply a structured command plan:

```bash
echo '{"plan":{"input":"Rename this node to Priority goals","summary":"Rename \"Goals\" to \"Priority goals\".","target":{"sessionId":"<session-id>","nodeId":"n_root_goals_1","nodeTitle":"Goals"},"toolCalls":[{"id":"call_rename_node_1","toolName":"rename_node","arguments":{"nodeId":"n_root_goals_1","title":"Priority goals"}}]}}' | \
  npm run cli -- command apply --session <session-id>
```

Exact plan-apply semantics:

- the supplied `plan.toolCalls` are executed directly
- the runtime does not re-interpret the original natural-language input
- if clients want audit selection provenance, they should send the same `selection` used during planning
- when no explicit `selection` is sent, the runtime derives it from `plan.target.nodeId` when available

### 5. Inspect and replay command runs

List persisted command runs:

```bash
npm run cli -- command list --session <session-id>
```

Inspect one command run:

```bash
npm run cli -- command show --session <session-id> --run <command-run-id>
```

Replay one command run:

```bash
npm run cli -- command replay --session <session-id> --run <command-run-id>
```

Replay semantics:

- replay reuses the stored structured plan and stored selection context
- replay does not re-plan when a persisted plan is available
- replay appends a new `commandRuns` entry rather than mutating the historical one
- replay provenance is visible through `replayOfCommandRunId`

### 6. Read outputs

Show the full session:

```bash
npm run cli -- session show --session <session-id>
```

Export an outline artifact:

```bash
npm run cli -- export --session <session-id> --format outline
```

## Supported intent types

- `expand_branch`
- `summarize_branch`
- `create_outline`

## Supported command tools

- `generate_map`
- `rename_node`
- `add_child_node`
- `delete_node`
- `run_intent`

## Persisted command runs

The full session payload now includes `commandRuns`, which external agents can:

- read through `session show` or `GET /api/mindmap/session/:id`
- execute exactly through `command apply` or `POST /api/mindmap/session/:id/command/apply`
- discover through `command list` or `GET /api/mindmap/session/:id/command`
- inspect individually through `command show` or `GET /api/mindmap/session/:id/command/:commandRunId`
- replay through `command replay` or `POST /api/mindmap/session/:id/command/:commandRunId/replay`

## Supported actor types

- `user`
- `agent`
- `system`

## Supported edit types

- `create_node`
- `update_node`
- `delete_node`
- `reorder_children`
- `set_selection`
- `attach_artifact`

## Design constraints

- This is intentionally not MCP-first. The transport should stay lightweight and avoid wasting context on protocol framing.
- Natural language should be turned into an explicit plan or tool-call trace before state changes happen.
- The browser, CLI, and daemon should keep sharing one graph contract instead of growing separate behavior.
- The local daemon is a convenience transport, not a separate product surface.
- A stronger remote contract should only be added after the local agent workflow is proven.
