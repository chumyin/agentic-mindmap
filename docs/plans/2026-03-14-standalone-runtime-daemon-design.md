# Standalone Runtime Daemon Design

## Goal

Extract the shared local mindmap runtime from the Vite host into an optional standalone HTTP service that can be started from the CLI and consumed by browsers or external agents without using MCP.

## Why this change

The current prototype already proves that human edits and agent actions can share one graph protocol and one file-backed session store. The remaining gap is transport. Right now the browser can reach the runtime only when the Vite middleware is present.

That is too coupled for the intended operating model:

- agents should be able to control the runtime without depending on the browser host
- the browser should be able to connect to an external local daemon when needed
- the protocol should remain stable while transports evolve

## Scope

This iteration adds:

- a standalone local HTTP server for the existing `/api/mindmap/*` routes
- a `serve` CLI entrypoint to run that server
- browser-side API base resolution so the workspace can target an external local daemon
- CORS support for cross-origin browser-to-daemon requests

This iteration does not add:

- authentication
- multi-user sync
- remote cloud hosting
- JSON-RPC or MCP transports
- provider abstraction beyond the current mock runtime

## Architecture

### 1. Keep one protocol surface

The canonical application protocol remains the existing HTTP route family:

- `POST /api/mindmap/session`
- `GET /api/mindmap/session/:id`
- `POST /api/mindmap/session/:id/generate`
- `POST /api/mindmap/session/:id/edit`
- `POST /api/mindmap/session/:id/intent`
- `GET /api/mindmap/session/:id/export`

The pure request handler in `src/runtime/api.ts` stays the source of truth. Both the Vite middleware and the standalone daemon wrap that handler.

### 2. Add a standalone server, not a new protocol

The standalone daemon should live in a new runtime module that:

- creates a Node `http` server
- parses JSON request bodies
- handles `OPTIONS` and CORS headers
- forwards matching routes into `createMindmapApiHandler`
- exposes start/stop/address helpers for tests and CLI use

This keeps the daemon thin and avoids forking runtime logic into a second server stack.

### 3. Add a CLI-first service command

The CLI should gain:

- `serve --host <host> --port <port> --root-dir <dir>`

Behavior:

- start the standalone daemon
- print a machine-readable startup record with host, port, and API base
- keep the process alive until interruption

This preserves the CLI-first operating model while making the runtime usable by Codex or other local agents.

### 4. Browser endpoint resolution

The browser should resolve its API base in this order:

1. `mindmapApi` query parameter
2. stored API base in browser storage
3. same-origin fallback

That gives two useful modes:

- zero-config local Vite mode
- explicit external-daemon mode for shared local orchestration

The browser does not need a new full settings page in this iteration. Lightweight resolution plus docs is enough.

## Error handling

- Invalid JSON request bodies should produce `400`
- Missing sessions should continue to produce `404`
- Cross-origin standalone requests should return permissive CORS headers
- Browser endpoint resolution should fall back cleanly to same-origin if an override is absent or invalid

## Testing strategy

- add failing runtime server tests first for real network requests and CORS preflight
- add failing CLI tests for `serve` lifecycle behavior or extracted helpers around it
- add failing browser config/client tests for API base resolution
- keep existing shared-backend integration tests green
- run browser smoke with a real standalone daemon and verify CLI can inspect the same browser-written session

## Expected outcome

After this change:

- `npm run cli -- serve --port 3210` starts a stable local runtime daemon
- the browser can be pointed at `http://127.0.0.1:3210`
- external agents can use the daemon directly or keep using CLI commands
- Vite middleware remains available as a convenience fallback, not the only runtime host
