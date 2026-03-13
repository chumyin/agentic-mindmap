# agentic-mindmap Bootstrap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create the first public repository baseline for agentic-mindmap with a clear product narrative, a runnable Vite application, and verification commands.

**Architecture:** Use a front-end-first repository layout. The app itself is a lightweight landing shell that demonstrates the product direction and a static graph preview. Supporting docs explain product intent, delivery phases, and future extension points.

**Tech Stack:** Vite, React, TypeScript, React Flow, Vitest, agent-browser

---

### Task 1: Initialize the repository baseline

**Files:**
- Create: `package-lock.json`
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `index.html`

**Step 1: Generate the initial Vite React TypeScript app**

Run: `npm create vite@latest agentic-mindmap -- --template react-ts`

**Step 2: Install core dependencies**

Run: `npm install`

**Step 3: Install graph and test dependencies**

Run: `npm install @xyflow/react`
Run: `npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom`

**Step 4: Add verification scripts**

Add `test` and `test:watch` scripts and configure Vitest for jsdom.

### Task 2: Replace template content with the product shell

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/index.css`
- Modify: `public/favicon.svg`

**Step 1: Remove template branding**

Delete the default Vite starter experience and replace it with product-focused content.

**Step 2: Build the landing shell**

Add:

- strong positioning copy
- a static React Flow preview
- capability sections
- roadmap-oriented messaging

**Step 3: Make the layout responsive**

Ensure the page works on desktop and mobile widths.

### Task 3: Add test coverage and docs

**Files:**
- Create: `src/App.test.tsx`
- Create: `src/test/setup.ts`
- Modify: `README.md`
- Create: `docs/vision.md`
- Create: `docs/roadmap.md`
- Create: `docs/plans/2026-03-13-agentic-mindmap-design.md`
- Create: `docs/plans/2026-03-13-agentic-mindmap-bootstrap.md`
- Create: `LICENSE`

**Step 1: Add a baseline rendering test**

Verify the product hero and graph preview render.

**Step 2: Write the public documentation**

Document:

- product thesis
- technology choices
- roadmap
- local development and verification workflow

**Step 3: Add licensing**

Use MIT so the public repository has clear reuse terms.

### Task 4: Verify and publish

**Files:**
- Modify: `.gitignore` if needed

**Step 1: Run static verification**

Run:

- `npm run lint`
- `npm run test`
- `npm run build`

**Step 2: Run browser verification**

Start the local server and verify the page with `agent-browser`.

**Step 3: Publish**

Initialize git, inspect status and diff, commit the repo baseline, create the public GitHub repository, and push the initial branch.
