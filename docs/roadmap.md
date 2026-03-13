# Roadmap

## Phase 1: Public baseline

- Publish the repository and narrative
- Ship a visual prototype shell
- Establish lint, test, and build verification
- Use `agent-browser` for browser-level smoke checks

## Phase 2: Core graph actions

- Prompt-to-map generation
- Node selection state
- Branch expand, summarize, merge, split, and regroup actions
- Structured action history

## Phase 3: Output generation

- Export a map into outlines, briefs, and execution plans
- Keep traceability between graph nodes and generated output
- Improve formatting and downstream editing flows

## Phase 4: Runtime extensions

- Optional background worker layer
- Optional provider abstractions for multiple AI backends
- Optional collaboration and persistence services

## Delivery rules

- Keep the product scope narrow until graph interactions feel strong
- Prefer causal improvements to the interaction model over feature accumulation
- Do not add backend complexity before the front-end workflow proves its value
