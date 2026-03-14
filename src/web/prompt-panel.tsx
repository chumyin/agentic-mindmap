type PromptPanelProps = {
  prompt: string
  sessionId: string
  onPromptChange: (value: string) => void
  onGenerate: () => void
  onReset: () => void
}

export function PromptPanel(props: PromptPanelProps) {
  return (
    <section className="workspace-card prompt-panel">
      <div className="panel-heading">
        <p className="panel-eyebrow">Prompt to graph</p>
        <h1>Agentic mindmap workspace</h1>
        <p>
          Start from natural language, then keep refining the map through direct
          edits and structured agent actions.
        </p>
      </div>

      <div className="session-chip">
        <span>Session</span>
        <strong>{props.sessionId}</strong>
      </div>

      <label className="field">
        <span>Prompt input</span>
        <textarea
          aria-label="Prompt input"
          className="field__control field__control--textarea"
          value={props.prompt}
          onChange={(event) => props.onPromptChange(event.target.value)}
          placeholder="Turn my notes into a launch strategy mindmap."
        />
      </label>

      <div className="prompt-panel__actions">
        <button className="button button--primary" onClick={props.onGenerate}>
          Generate map
        </button>
        <button className="button button--secondary" onClick={props.onReset}>
          New local session
        </button>
      </div>
    </section>
  )
}
