# Roadmap

## Phase 1: Public baseline

- Publish the repository and narrative
- Ship a visual prototype shell
- Establish lint, test, and build verification
- Use `agent-browser` for browser-level smoke checks

## Phase 2: Functional prototype

- Prompt-to-map generation in the browser workspace
- Manual node selection, rename, add-child, and delete flows
- CLI session creation and machine-readable graph control
- Deterministic mock provider for structured branch actions
- Outline artifact generation from graph state
- Shared local session backend between browser and CLI entrypoints

## Phase 3: Core graph actions

- Standalone local daemon for the shared runtime API
- Discovery routes and protocol self-description for external agent clients
- Branch expand, summarize, merge, split, and regroup actions
- Structured action history with richer review and replay support
- Stronger graph validation and conflict handling

## Phase 4: Output generation

- Export a map into outlines, briefs, and execution plans
- Keep traceability between graph nodes and generated output
- Improve formatting and downstream editing flows

## Phase 5: Runtime extensions

- Optional background worker layer
- Optional provider abstractions for multiple AI backends
- Optional collaboration and persistence services

## Delivery rules

- Keep the product scope narrow until graph interactions feel strong
- Prefer causal improvements to the interaction model over feature accumulation
- Do not add backend complexity before the graph protocol and CLI workflow prove their value
