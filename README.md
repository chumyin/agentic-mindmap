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

This repo is in the `prototype shell` stage.

What exists now:

- a public-facing landing application
- the initial product narrative
- design and bootstrap planning docs
- a testing baseline with `Vitest`

What does not exist yet:

- real AI provider integration
- persistent map storage
- multi-user collaboration
- production-grade export and execution workflows

## Local development

```bash
npm install
npm run dev
```

Open the app at the local Vite URL.

## Verification

Run the current checks:

```bash
npm run lint
npm run test
npm run build
```

For browser-level verification, this repo prefers `agent-browser` over Playwright in the early stage workflow.

## Roadmap

See:

- [`docs/vision.md`](docs/vision.md)
- [`docs/roadmap.md`](docs/roadmap.md)
- [`docs/plans/2026-03-13-agentic-mindmap-design.md`](docs/plans/2026-03-13-agentic-mindmap-design.md)

## Project structure

```text
src/
  App.tsx            Product landing and graph preview
  App.test.tsx       Baseline rendering test
  test/setup.ts      Vitest setup
docs/
  vision.md          Product narrative and principles
  roadmap.md         Delivery phases
  plans/             Design and implementation planning docs
```

## Design principles

- Mindmaps are live structures, not frozen output.
- AI actions should operate on graph context, not only on raw text.
- A good graph tool should help users move from thinking to execution.

## Contributing

This repo is still early and opinionated. If you want to contribute, open an issue with:

- the workflow you are trying to support
- what is broken or missing in current mindmap tools
- why the behavior should be canvas-native instead of chat-only

## License

MIT
