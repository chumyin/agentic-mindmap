import type { MindmapArtifact, MindmapNode } from '../core/graph-types'

type InspectorProps = {
  selectedNode: MindmapNode | null
  artifact: MindmapArtifact | null
  actionBrief: string
  onTitleChange: (value: string) => void
  onActionBriefChange: (value: string) => void
  onAddChildNode: () => void
  onDeleteNode: () => void
  onExpandBranch: () => void
  onCreateOutline: () => void
}

export function Inspector(props: InspectorProps) {
  return (
    <section className="workspace-card inspector">
      <div className="panel-heading panel-heading--compact">
        <div>
          <p className="panel-eyebrow">Inspector</p>
          <h2>Node and artifact controls</h2>
        </div>
        <p className="panel-note">
          Manual edits and agent actions work against the same map.
        </p>
      </div>

      {props.selectedNode ? (
        <>
          <label className="field">
            <span>Node title</span>
            <input
              aria-label="Node title"
              className="field__control"
              value={props.selectedNode.title}
              onChange={(event) => props.onTitleChange(event.target.value)}
            />
          </label>

          <div className="inspector__meta">
            <span>{props.selectedNode.kind}</span>
            <span>
              {props.selectedNode.parentId === null ? 'Root node' : 'Branch node'}
            </span>
          </div>

          <div className="stack-actions">
            <button className="button button--secondary" onClick={props.onAddChildNode}>
              Add child node
            </button>
            <button
              className="button button--ghost"
              disabled={props.selectedNode.parentId === null}
              onClick={props.onDeleteNode}
            >
              Delete node
            </button>
          </div>
        </>
      ) : (
        <p className="empty-state">Select a node to edit it.</p>
      )}

      <label className="field">
        <span>Action brief</span>
        <input
          aria-label="Action brief"
          className="field__control"
          value={props.actionBrief}
          onChange={(event) => props.onActionBriefChange(event.target.value)}
          placeholder="Add risks and dependencies"
        />
      </label>

      <div className="stack-actions">
        <button className="button button--primary" onClick={props.onExpandBranch}>
          Expand branch
        </button>
        <button className="button button--secondary" onClick={props.onCreateOutline}>
          Create outline
        </button>
      </div>

      <div className="artifact-panel">
        <div className="artifact-panel__header">
          <p className="panel-eyebrow">Artifact output</p>
          <h3>{props.artifact?.title ?? 'No artifact yet'}</h3>
        </div>

        <pre aria-label="Artifact output" className="artifact-panel__body">
          {props.artifact?.content ??
            'Run an agent action to generate an outline or summary artifact.'}
        </pre>
      </div>
    </section>
  )
}
