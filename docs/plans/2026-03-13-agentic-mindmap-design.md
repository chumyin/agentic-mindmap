# agentic-mindmap Design

**Date:** 2026-03-13

## Goal

Create a public repository for an AI-native mind mapping product concept, with a credible technical direction and an initial browser-based prototype shell.

## Recommended architecture

- Browser-first application built with `Vite + React + TypeScript`
- Graph visualization and future editing flows built on `React Flow`
- Baseline testing with `Vitest`
- Browser verification handled by `agent-browser`
- Optional future Go runtime for long-running agent execution

## Why this approach

The first delivery problem is product interaction, not backend throughput. The repository needs to communicate a clear product thesis and support fast iteration on graph UX.

## Core capabilities

1. Generate a map from natural language
2. Expand and rewrite selected branches
3. Restructure maps through merge, split, regroup, and summarize actions
4. Convert maps into executable outputs such as plans and briefs
5. Keep graph structure visible throughout the workflow

## Initial repository scope

- Public GitHub repository
- Landing application that reflects the product positioning
- README and supporting docs
- Design and implementation planning artifacts
- Lint, test, and build verification

## Validation strategy

- Unit and rendering checks with `Vitest`
- Browser-level smoke verification with `agent-browser`
- No Playwright in the first baseline
