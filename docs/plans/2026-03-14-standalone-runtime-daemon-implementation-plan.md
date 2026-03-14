# Standalone Runtime Daemon Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a CLI-started standalone local mindmap daemon and let the browser connect to it without changing the shared graph protocol.

**Architecture:** Reuse the pure runtime API handler for both embedded Vite middleware and a new Node HTTP server. Keep the browser on fetch-based HTTP calls, but resolve the API base from query param or storage before falling back to same-origin.

**Tech Stack:** TypeScript, Node HTTP server, Vite middleware, Vitest, React

---

### Task 1: Add failing tests for the standalone HTTP server

**Files:**
- Create: `src/runtime/http-server.test.ts`
- Modify: `src/runtime/dev-server.ts` only after tests fail

**Step 1: Write the failing test**

- Add a test that starts a standalone server on port `0`, calls `POST /api/mindmap/session`, and expects a real session id in the JSON response.
- Add a test that sends `OPTIONS` to a runtime route and expects `204` plus CORS headers.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/runtime/http-server.test.ts`
Expected: FAIL because the standalone server module does not exist yet.

**Step 3: Write minimal implementation**

- Create `src/runtime/http-server.ts`
- Export helpers to start and stop a Node HTTP server around `createMindmapApiHandler`

**Step 4: Run test to verify it passes**

Run: `npm test -- src/runtime/http-server.test.ts`
Expected: PASS

### Task 2: Add failing tests for browser API base resolution

**Files:**
- Create: `src/web/api-config.test.ts`
- Create: `src/web/api-config.ts`
- Modify: `src/web/session-client.ts`

**Step 1: Write the failing test**

- Add tests for query-param override, stored API base override, and same-origin fallback.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/web/api-config.test.ts`
Expected: FAIL because the config module does not exist yet.

**Step 3: Write minimal implementation**

- Add a small API config helper
- Make `session-client.ts` build URLs from that resolved base

**Step 4: Run test to verify it passes**

Run: `npm test -- src/web/api-config.test.ts src/App.test.tsx`
Expected: PASS

### Task 3: Add failing tests for CLI serve orchestration

**Files:**
- Modify: `src/cli/cli.test.ts`
- Modify: `src/cli/index.ts`
- Modify: `package.json`

**Step 1: Write the failing test**

- Add a test that starts `serve` with an abort signal, waits for a startup callback, hits the reported API base over HTTP, and confirms the server shuts down on abort.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/cli/cli.test.ts`
Expected: FAIL because `serve` is not implemented.

**Step 3: Write minimal implementation**

- Add the `serve` command
- Reuse the standalone HTTP server helper
- Return startup metadata for tests and print startup JSON from the real CLI path

**Step 4: Run test to verify it passes**

Run: `npm test -- src/cli/cli.test.ts src/runtime/http-server.test.ts`
Expected: PASS

### Task 4: Update docs and ignore local runtime data

**Files:**
- Modify: `README.md`
- Modify: `docs/vision.md`
- Modify: `docs/roadmap.md`
- Modify: `.gitignore`

**Step 1: Write docs that reflect the extracted runtime path**

- Document `serve`
- Document browser query-param override for external daemon mode
- Keep Vite middleware documented as fallback

**Step 2: Run focused checks**

Run: `npm test -- src/App.test.tsx src/cli/cli.test.ts`
Expected: PASS

### Task 5: Full verification

**Files:**
- No new source files

**Step 1: Run lint**

Run: `npm run lint`
Expected: PASS

**Step 2: Run full test suite**

Run: `npm test`
Expected: PASS

**Step 3: Run production build**

Run: `npm run build`
Expected: PASS

**Step 4: Run browser smoke against the standalone daemon**

Run:

```bash
npm run cli -- serve --host 127.0.0.1 --port 3210
npm run dev -- --host 127.0.0.1 --port 4175
```

Then open:

```text
http://127.0.0.1:4175/?mindmapApi=http://127.0.0.1:3210
```

Expected:

- browser creates or loads a session through the daemon
- CLI `session show` can inspect the same session written by the browser

