# agentic-mindmap

AI-native mind mapping workspace for generating, restructuring, and executing ideas as graphs.

## What this repository is

`agentic-mindmap` is a public product repo for exploring a simple claim:

> A mindmap should be a first-class object for AI agents, not just a canvas that happens to have chat attached.

The goal is to build a tool where a user can:

- start from natural language
- generate a structured map
- select a branch and ask the system to expand, regroup, summarize, or rewrite it
- turn the graph into an executable artifact such as a plan, spec, or brief

## Why AI-native mindmaps

Most mind mapping tools treat AI as an add-on. They can generate a first draft, but the structure itself is usually not designed to be continuously operated on by agents.

This project is aiming for a different model:

- the graph is inspectable and editable
- the graph can be transformed by structured AI actions
- chat and canvas are part of the same workflow
- outputs such as plans and documents keep a trace back to the map

## Core capabilities

The near-term product direction is centered on five capabilities:

1. Prompt-to-map generation
2. Branch expansion and refinement
3. Structural transforms such as merge, split, regroup, and summarize
4. Output generation from maps into docs, plans, and checklists
5. A browser-first interaction model for fast iteration on graph UX

## Current stack

- `Vite`
- `React`
- `TypeScript`
- `React Flow`
- `Vitest`
- `agent-browser` for browser-level checks

## Why this stack

The difficult part of this product is not server throughput. It is the interaction model:

- graph editing
- node selection
- branch-level operations
- AI-assisted transforms
- legible state transitions

That makes a front-end-first stack the right choice for the first public iteration. If the project later needs long-running agent workers, sync services, or background execution, a separate Go service can be added without forcing that complexity into the first build.

## Repository status

This repo is now in the `functional prototype` stage.

What exists now:

- a browser workspace for prompt-to-map generation
- natural-language agent commands that preview structured tool calls before execution
- exact plan application after preview, so humans or external agents can approve and run the same structured trace
- persisted command-run traces with discovery and replay on the shared session
- direct node selection and manual branch editing
- structured branch actions backed by a deterministic mock provider
- outline artifact generation
- a CLI surface for session creation, graph generation, actions, export, exact plan apply, and command replay
- protocol discovery surfaces for external agents through CLI plus HTTP
- a standalone `serve` daemon plus Vite middleware fallback for the same local API
- a shared local API and file-backed session backend for browser plus CLI flows
- a shared graph core with immutable edits and operation history

Current constraints:

- the provider is mocked and deterministic, not a real LLM integration
- the standalone daemon is local-only and unauthenticated by design
- the browser still defaults to same-origin unless an external daemon endpoint is configured
- layout and transforms are intentionally narrow and heuristic

What does not exist yet:

- real AI provider integration
- multi-user collaboration
- production-grade export and execution workflows
- a hardened remote runtime story beyond the local daemon

## Local development

```bash
npm install
npm run dev
```

Open the app at the local Vite URL.

### CLI prototype

Run the CLI through the package script:

```bash
npm run cli -- session create
```

Generate a map for an existing session:

```bash
echo '{"prompt":"Launch strategy for a new B2B analytics product"}' | \
  npm run cli -- generate --session <session-id>
```

Export an outline:

```bash
npm run cli -- export --session <session-id> --format outline
```

List existing sessions for agent discovery:

```bash
npm run cli -- session list
```

Describe the supported protocol surface:

```bash
npm run cli -- describe
```

Preview how a natural-language command will be translated into tool calls:

```bash
echo '{"input":"Rename this node to Priority goals","mode":"plan"}' | \
  npm run cli -- command --session <session-id>
```

Apply a previously reviewed command plan exactly as supplied:

```bash
echo '{"plan":{"input":"Rename this node to Priority goals","summary":"Rename \"Goals\" to \"Priority goals\".","target":{"sessionId":"<session-id>","nodeId":"n_root_goals_1","nodeTitle":"Goals"},"toolCalls":[{"id":"call_rename_node_1","toolName":"rename_node","arguments":{"nodeId":"n_root_goals_1","title":"Priority goals"}}]}}' | \
  npm run cli -- command apply --session <session-id>
```

Execute a natural-language command against the current selection:

```bash
echo '{"input":"Create an outline for this branch","mode":"execute"}' | \
  npm run cli -- command --session <session-id>
```

Executed commands are persisted on the session as `commandRuns`, including
status, completed step count, replay provenance, and any failure reason.

This gives the prototype two execution modes:

- natural language -> plan -> execute
- reviewed plan -> exact apply

External agents can discover the execution contract through `describe`, including:

- exact plan apply is atomic
- replay mode is `best_effort_current_state`
- replay re-applies the stored selection before execution

List recent command runs for a session:

```bash
npm run cli -- command list --session <session-id>
```

Inspect one persisted command run:

```bash
npm run cli -- command show --session <session-id> --run <command-run-id>
```

Replay a persisted command run against the current session graph:

```bash
npm run cli -- command replay --session <session-id> --run <command-run-id>
```

Replay appends a new `commandRuns` entry with `replayOfCommandRunId`, so agents can
trace which execution came from a previous run.

Replay is intentionally not a historical snapshot re-simulation. It reuses the stored
plan against the current session graph, so results can differ if the graph changed
after the original run.

Apply a manual graph edit:

```bash
echo '{"edits":[{"type":"create_node","node":{"id":"n_manual","parentId":"n_root","kind":"note","title":"Manual note"}}]}' | \
  npm run cli -- edit --session <session-id>
```

Run the standalone local daemon:

```bash
npm run cli -- serve --host 127.0.0.1 --port 3210
```

The daemon prints a machine-readable startup record with its `origin` and `apiBase`.

Discovery endpoints exposed by the daemon:

- `GET /api/mindmap/health`
- `GET /api/mindmap/describe`
- `GET /api/mindmap/session`
- `POST /api/mindmap/session/:id/command`
- `POST /api/mindmap/session/:id/command/apply`
- `GET /api/mindmap/session/:id/command`
- `GET /api/mindmap/session/:id/command/:commandRunId`
- `POST /api/mindmap/session/:id/command/:commandRunId/replay`

Point the browser workspace at the standalone daemon:

```text
http://127.0.0.1:5173/?mindmapApi=http://127.0.0.1:3210
```

The browser will persist that override locally and fall back to same-origin when a
stored external endpoint becomes unreachable or behaves like an incompatible daemon,
for example by missing the create-session route or returning a non-JSON error page.

The browser prompt panel now supports two mixed-control loops:

- preview a command plan and apply that exact plan
- replay one of the recent command runs without leaving the shared session workflow

Exact plan apply is now guarded and atomic:

- `plan.target.sessionId` must match the session being mutated
- the selection used for planning is re-applied before execution
- a failing multi-step plan records a failed `commandRun` without partially mutating the graph

## Verification

Run the current checks:

```bash
npm run cli -- session create
npm run lint
npm run test
npm run build
```

For browser-level verification, this repo prefers `agent-browser` over Playwright in the early stage workflow.

## Roadmap

See:

- [`docs/vision.md`](docs/vision.md)
- [`docs/roadmap.md`](docs/roadmap.md)
- [`docs/protocol.md`](docs/protocol.md)
- [`docs/plans/2026-03-14-agentic-mindmap-prototype-design.md`](docs/plans/2026-03-14-agentic-mindmap-prototype-design.md)
- [`docs/plans/2026-03-14-agentic-mindmap-prototype-implementation-plan.md`](docs/plans/2026-03-14-agentic-mindmap-prototype-implementation-plan.md)

## Project structure

```text
src/
  core/              Canonical graph schema and edits
  runtime/           File-backed runtime and mock provider
  cli/               Machine-readable command interface
  web/               Browser workspace components and view-model
  App.tsx            Workspace entry point
  App.test.tsx       Workspace interaction test
  test/setup.ts      Vitest setup
docs/
  vision.md          Product narrative and principles
  roadmap.md         Delivery phases
  plans/             Design and implementation planning docs
```

## Design principles

- Mindmaps are live structures, not frozen output.
- AI actions should operate on graph context, not only on raw text.
- Human edits and agent edits should share the same graph protocol.
- A good graph tool should help users move from thinking to execution.

## Contributing

This repo is still early and opinionated. If you want to contribute, open an issue with:

- the workflow you are trying to support
- what is broken or missing in current mindmap tools
- why the behavior should be canvas-native instead of chat-only

## License

MIT
