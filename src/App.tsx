import type { ReactNode } from 'react'
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './App.css'

type PreviewNodeData = {
  label: ReactNode
}

const capabilities = [
  {
    title: 'Generate from intent',
    body: 'Start with a topic, a paragraph, or a messy idea. The app turns that intent into a structured mindmap instead of a blank canvas.',
  },
  {
    title: 'Operate on branches',
    body: 'Ask the system to expand, merge, regroup, summarize, or rewrite a selected branch while preserving the surrounding context.',
  },
  {
    title: 'Turn maps into output',
    body: 'Move from map to plan, brief, spec, or checklist without losing the graph structure that made the thinking legible.',
  },
]

const workflows = [
  {
    title: 'Research synthesis',
    body: 'Collect sources, cluster signals, and let the agent propose a clearer structure for the map before turning it into a report.',
  },
  {
    title: 'Product planning',
    body: 'Convert a strategic prompt into problem areas, themes, initiatives, and an execution plan that still traces back to the original thinking.',
  },
  {
    title: 'Knowledge gardening',
    body: 'Use natural language to continuously refine a living map instead of manually re-laying every node as the idea evolves.',
  },
]

const principles = [
  'Mindmaps are first-class AI objects, not static diagrams.',
  'Canvas actions and language actions should feel like one system.',
  'Structure must stay inspectable instead of disappearing into chat.',
]

const roadmap = [
  {
    phase: 'Phase 1',
    title: 'Narrative + prototype shell',
    detail: 'Public repo, positioning, visual prototype, baseline tests, and a stable development workflow.',
  },
  {
    phase: 'Phase 2',
    title: 'Agentic graph operations',
    detail: 'Prompt-to-map generation, branch transforms, action history, and structured AI commands on selected nodes.',
  },
  {
    phase: 'Phase 3',
    title: 'Execution workflows',
    detail: 'Export to plans/docs, collaborative map sessions, and optional runtime services for longer-running agent tasks.',
  },
]

const nodes: Node<PreviewNodeData>[] = [
  {
    id: 'seed',
    position: { x: 270, y: 40 },
    data: {
      label: (
        <div className="flow-card flow-card--seed">
          <strong>AI-native mindmap</strong>
          <span>Structure, dialogue, and execution in one graph.</span>
        </div>
      ),
    },
    style: { width: 248, border: 'none', background: 'transparent' },
  },
  {
    id: 'prompt',
    position: { x: 40, y: 176 },
    data: {
      label: (
        <div className="flow-card">
          <strong>Prompt</strong>
          <span>“Turn my notes into a launch strategy map.”</span>
        </div>
      ),
    },
    style: { width: 220, border: 'none', background: 'transparent' },
  },
  {
    id: 'expand',
    position: { x: 296, y: 216 },
    data: {
      label: (
        <div className="flow-card">
          <strong>Expand branch</strong>
          <span>Add risks, assumptions, and missing supporting ideas.</span>
        </div>
      ),
    },
    style: { width: 220, border: 'none', background: 'transparent' },
  },
  {
    id: 'reshape',
    position: { x: 548, y: 176 },
    data: {
      label: (
        <div className="flow-card">
          <strong>Restructure</strong>
          <span>Merge duplicates and regroup the map around themes.</span>
        </div>
      ),
    },
    style: { width: 220, border: 'none', background: 'transparent' },
  },
  {
    id: 'output',
    position: { x: 296, y: 364 },
    data: {
      label: (
        <div className="flow-card">
          <strong>Output</strong>
          <span>Convert the map into a spec, roadmap, or checklist.</span>
        </div>
      ),
    },
    style: { width: 220, border: 'none', background: 'transparent' },
  },
]

const edges: Edge[] = [
  { id: 'seed-prompt', source: 'seed', target: 'prompt', animated: true },
  { id: 'seed-expand', source: 'seed', target: 'expand', animated: true },
  { id: 'seed-reshape', source: 'seed', target: 'reshape', animated: true },
  { id: 'seed-output', source: 'seed', target: 'output', animated: true },
]

function MindmapPreview() {
  return (
    <div className="flow-shell" aria-label="Mindmap preview">
      <div className="flow-shell__bar">
        <span />
        <span />
        <span />
        <p>Live graph preview</p>
      </div>
      <div className="flow-shell__body">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          minZoom={0.8}
          maxZoom={1.1}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          zoomOnDoubleClick={false}
          panOnDrag={false}
        >
          <MiniMap pannable zoomable />
          <Controls showInteractive={false} />
          <Background gap={20} size={1} />
        </ReactFlow>
      </div>
    </div>
  )
}

function App() {
  return (
    <ReactFlowProvider>
      <div className="app-shell">
        <header className="topbar">
          <a className="brand" href="#top">
            <span className="brand__mark">AM</span>
            <span>
              <strong>agentic-mindmap</strong>
              <small>AI-native mapping workspace</small>
            </span>
          </a>
          <nav className="topbar__nav" aria-label="Primary">
            <a href="#capabilities">Capabilities</a>
            <a href="#workflows">Workflows</a>
            <a href="#roadmap">Roadmap</a>
          </nav>
        </header>

        <main className="page" id="top">
          <section className="hero-section">
            <div className="hero-copy">
              <p className="eyebrow">Build, reshape, and execute ideas as graphs</p>
              <h1>Mindmaps that agents can read, transform, and operate on.</h1>
              <p className="hero-copy__body">
                agentic-mindmap is a public experiment in AI-native thinking
                tools. It treats a mindmap as a live structure for generation,
                expansion, regrouping, summarization, and planning instead of a
                static drawing.
              </p>

              <div className="hero-actions">
                <a className="button button--primary" href="#roadmap">
                  Explore the roadmap
                </a>
                <a
                  className="button button--secondary"
                  href="https://github.com/chumyin/agentic-mindmap"
                >
                  View on GitHub
                </a>
              </div>

              <ul className="principles" aria-label="Project principles">
                {principles.map((principle) => (
                  <li key={principle}>{principle}</li>
                ))}
              </ul>
            </div>

            <div className="hero-preview">
              <MindmapPreview />
            </div>
          </section>

          <section className="section-grid" id="capabilities">
            <div className="section-heading">
              <p className="eyebrow">Core capabilities</p>
              <h2>Designed for AI-native graph operations</h2>
            </div>
            <div className="card-grid">
              {capabilities.map((item) => (
                <article className="info-card" key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="section-grid">
            <div className="section-heading">
              <p className="eyebrow">Why this stack</p>
              <h2>Fast front-end iteration first, heavier services later</h2>
            </div>
            <div className="stack-panel">
              <div>
                <h3>Current foundation</h3>
                <p>Vite, React, TypeScript, React Flow, Vitest, and agent-browser.</p>
              </div>
              <div>
                <h3>Reasoning</h3>
                <p>
                  The hard problem is product interaction, not server throughput.
                  This stack optimizes for fast feedback on graph editing,
                  AI-assisted actions, and browser-level validation.
                </p>
              </div>
              <div>
                <h3>Future extension</h3>
                <p>
                  If long-running agent jobs or sync services become necessary,
                  a Go worker can be added later without making the first repo
                  heavier than it needs to be.
                </p>
              </div>
            </div>
          </section>

          <section className="section-grid" id="workflows">
            <div className="section-heading">
              <p className="eyebrow">Target workflows</p>
              <h2>Three early jobs this product should do well</h2>
            </div>
            <div className="workflow-grid">
              {workflows.map((workflow) => (
                <article className="workflow-card" key={workflow.title}>
                  <h3>{workflow.title}</h3>
                  <p>{workflow.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="section-grid" id="roadmap">
            <div className="section-heading">
              <p className="eyebrow">Roadmap</p>
              <h2>Start narrow, prove the graph interaction model, then expand.</h2>
            </div>
            <div className="roadmap-list">
              {roadmap.map((item) => (
                <article className="roadmap-item" key={item.phase}>
                  <p className="roadmap-item__phase">{item.phase}</p>
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>
          </section>
        </main>
      </div>
    </ReactFlowProvider>
  )
}

export default App
