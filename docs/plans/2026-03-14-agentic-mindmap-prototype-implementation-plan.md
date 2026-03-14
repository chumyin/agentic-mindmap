# Agentic Mindmap Prototype Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the current landing shell into a functional local prototype with a shared graph core, local session runtime, CLI integration surface, and a human-editable browser workspace.

**Architecture:** Keep the repository as a single package, but introduce clear internal layers under `src/core`, `src/runtime`, `src/web`, and `src/cli`. Manual edits and agent actions must flow through the same canonical graph reducer and session runtime. The first provider is deterministic and mocked, but its interface must look like a future real provider adapter.

**Tech Stack:** Vite, React, TypeScript, React Flow, Vitest, Node `fs/promises`, Node `util.parseArgs`

---

### Task 1: Establish the shared graph core

**Files:**
- Create: `src/core/graph-types.ts`
- Create: `src/core/graph.ts`
- Create: `src/core/graph.test.ts`
- Modify: `src/test/setup.ts` if shared helpers are needed

**Step 1: Write the failing graph core tests**

Add tests for:

- creating a graph from a root title
- creating a child node under a parent
- updating a node title
- deleting a non-root node
- reordering children
- attaching an artifact
- setting selection

Use a narrow fixture shape and assert canonical `nodes` map output.

**Step 2: Run the graph core tests to verify they fail**

Run: `npm test -- src/core/graph.test.ts`

Expected: FAIL because the graph core files and exports do not exist yet.

**Step 3: Write the minimal graph types**

Define:

- `MindmapNodeKind`
- `MindmapNode`
- `MindmapGraph`
- `MindmapSelection`
- `MindmapArtifact`
- `GraphEdit`
- `OperationRecord`

Keep the types narrow and aligned with the approved design doc.

**Step 4: Write the minimal graph operations**

Implement pure functions for:

- `createGraph`
- `createChildNode`
- `updateNode`
- `deleteNode`
- `reorderChildren`
- `setSelection`
- `attachArtifact`
- `applyGraphEdit`
- `applyGraphEdits`

Use immutable updates and stable child ordering.

**Step 5: Run the graph core tests to verify they pass**

Run: `npm test -- src/core/graph.test.ts`

Expected: PASS

**Step 6: Commit**

```bash
git add src/core/graph-types.ts src/core/graph.ts src/core/graph.test.ts src/test/setup.ts
git commit -m "feat: add mindmap graph core"
```

### Task 2: Add session runtime, history, and a deterministic mock provider

**Files:**
- Create: `src/runtime/session-types.ts`
- Create: `src/runtime/session-store.ts`
- Create: `src/runtime/mock-provider.ts`
- Create: `src/runtime/runtime.ts`
- Create: `src/runtime/runtime.test.ts`
- Modify: `src/core/graph-types.ts` if shared session references are needed

**Step 1: Write the failing runtime tests**

Add tests for:

- creating a session and persisting it to `.agentic-mindmap/sessions`
- loading an existing session
- generating an initial graph from prompt text
- expanding a selected branch
- creating an outline artifact
- recording operation history entries

Use a temp directory override for session storage so tests stay isolated.

**Step 2: Run the runtime tests to verify they fail**

Run: `npm test -- src/runtime/runtime.test.ts`

Expected: FAIL because runtime files do not exist yet.

**Step 3: Implement session types and file-backed session store**

Add:

- `MindmapSession`
- `SessionStoreOptions`
- `createSessionStore`

Support:

- `createSession`
- `loadSession`
- `saveSession`
- `listSessions` if cheap

The store root should be configurable for tests.

**Step 4: Implement the mock provider**

Support deterministic methods for:

- `generateInitialMap`
- `expandBranch`
- `summarizeBranch`
- `createOutline`

The mock output must be stable enough for tests and browser demos.

**Step 5: Implement the runtime orchestration**

Add:

- `createMindmapRuntime`
- `generateMap`
- `runIntent`
- `applyManualEdits`
- `exportArtifact`

The runtime should:

- load session
- validate inputs
- call provider
- convert provider output into graph edits or artifacts
- append operation records
- save session

**Step 6: Run the runtime tests to verify they pass**

Run: `npm test -- src/runtime/runtime.test.ts`

Expected: PASS

**Step 7: Commit**

```bash
git add src/runtime src/core/graph-types.ts
git commit -m "feat: add local session runtime"
```

### Task 3: Add a CLI-first machine interface

**Files:**
- Create: `src/cli/index.ts`
- Create: `src/cli/cli.test.ts`
- Modify: `package.json`
- Modify: `tsconfig.node.json` if the CLI entry needs Node-specific inclusion

**Step 1: Write the failing CLI contract tests**

Add tests for:

- `session create`
- `session show`
- `generate`
- `act`
- `export`
- invalid session error path

Use spawned Node processes or extracted handler functions, but verify JSON
output shape and exit behavior.

**Step 2: Run the CLI tests to verify they fail**

Run: `npm test -- src/cli/cli.test.ts`

Expected: FAIL because the CLI entry and handlers do not exist yet.

**Step 3: Add the CLI entry and command parsing**

Use Node `parseArgs` or a tiny local parser instead of adding a heavy CLI
dependency.

Support:

- `mindmap session create`
- `mindmap session show --session <id>`
- `mindmap generate --session <id>`
- `mindmap act --session <id>`
- `mindmap export --session <id> --format outline`

Read JSON payloads from stdin when present.

**Step 4: Wire the CLI to the shared runtime**

The CLI must:

- never mutate graph state directly
- call runtime methods
- write machine-readable JSON to stdout
- return non-zero exit codes for invalid commands or missing sessions

**Step 5: Update package scripts**

Add scripts such as:

- `cli`
- `test`
- `test:watch`

If a helper is needed to run TypeScript directly for local CLI use, add the
smallest acceptable dependency.

**Step 6: Run the CLI tests to verify they pass**

Run: `npm test -- src/cli/cli.test.ts`

Expected: PASS

**Step 7: Commit**

```bash
git add src/cli package.json tsconfig.node.json
git commit -m "feat: add mindmap cli surface"
```

### Task 4: Replace the landing page with a functional workspace shell

**Files:**
- Create: `src/web/workspace.tsx`
- Create: `src/web/graph-view.tsx`
- Create: `src/web/inspector.tsx`
- Create: `src/web/prompt-panel.tsx`
- Create: `src/web/session-view-model.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/index.css`
- Modify: `src/App.test.tsx`

**Step 1: Write the failing workspace interaction tests**

Cover:

- rendering the workspace instead of the landing hero
- creating a session on load or first action
- submitting a prompt and rendering generated graph content
- selecting a node and showing inspector details
- adding a child node
- renaming a node
- triggering an agent action and showing an outline artifact

Mock React Flow where needed, but keep the runtime calls real.

**Step 2: Run the workspace tests to verify they fail**

Run: `npm test -- src/App.test.tsx`

Expected: FAIL because the current app is still the landing page.

**Step 3: Build the view-model hook and runtime bridge**

Implement a session-focused controller that:

- owns the current session ID
- loads and saves runtime state
- exposes prompt submission
- exposes manual edit handlers
- exposes agent action handlers
- exposes selected node and artifact state

The controller should translate runtime graph state into React-friendly data.

**Step 4: Build the workspace UI**

Render:

- a prompt panel
- a graph canvas
- a node inspector
- an artifact panel

The graph canvas should derive React Flow nodes and edges from canonical graph
state, not the reverse.

**Step 5: Replace the old landing layout**

Move the landing copy out of the critical path and make the workspace the main
application surface.

**Step 6: Run the workspace tests to verify they pass**

Run: `npm test -- src/App.test.tsx`

Expected: PASS

**Step 7: Commit**

```bash
git add src/web src/App.tsx src/App.css src/index.css src/App.test.tsx
git commit -m "feat: add browser mindmap workspace"
```

### Task 5: Strengthen integration coverage and repository docs

**Files:**
- Modify: `README.md`
- Modify: `docs/roadmap.md`
- Modify: `docs/vision.md` if needed for clarified agent/human workflow
- Create: `src/runtime/runtime.integration.test.ts` if separation improves clarity

**Step 1: Write any missing failing integration tests**

Add a narrow end-to-end runtime or CLI integration test if current coverage does
not prove:

- prompt to graph
- graph to manual edit
- branch action to artifact export

**Step 2: Run the new integration test to verify it fails**

Run: `npm test -- src/runtime/runtime.integration.test.ts`

Expected: FAIL until the missing path is implemented.

**Step 3: Implement the minimal integration glue**

Only add the missing glue needed to make the full loop work.

**Step 4: Update docs**

Document:

- the prototype workflow
- CLI usage examples
- session storage location
- the fact that the current provider is mocked and deterministic

**Step 5: Run the integration and doc-adjacent tests to verify they pass**

Run: `npm test -- src/runtime/runtime.integration.test.ts`

Expected: PASS

**Step 6: Commit**

```bash
git add README.md docs/roadmap.md docs/vision.md src/runtime/runtime.integration.test.ts
git commit -m "docs: describe prototype workflow"
```

### Task 6: Verify the full prototype

**Files:**
- No new code required unless verification exposes bugs

**Step 1: Run lint**

Run: `npm run lint`

Expected: PASS

**Step 2: Run the full test suite**

Run: `npm test`

Expected: PASS

**Step 3: Run the production build**

Run: `npm run build`

Expected: PASS

**Step 4: Run browser verification with agent-browser**

Start the app and verify:

- a prompt can be submitted
- a graph appears
- a node can be selected
- an action updates the graph or artifact panel

Capture a screenshot or note the exact state transitions observed.

**Step 5: Commit any verification-driven fixes**

```bash
git add .
git commit -m "fix: resolve verification issues"
```

Only commit if verification reveals real issues that were fixed.

**Step 6: Record final evidence**

Collect:

- lint output
- test output
- build output
- browser verification notes

Use these as the basis for any completion claim.
