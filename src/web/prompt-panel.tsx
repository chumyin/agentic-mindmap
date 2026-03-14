import type { MindmapCommandPlan, MindmapCommandRun } from '../runtime/session-types'

type PromptPanelProps = {
  prompt: string
  commandInput: string
  commandPlan: MindmapCommandPlan | null
  commandRuns: MindmapCommandRun[]
  commandError: string | null
  commandPhase: 'idle' | 'planning' | 'executing'
  sessionId: string
  onPromptChange: (value: string) => void
  onCommandChange: (value: string) => void
  onGenerate: () => void
  onPreviewPlan: () => void
  onRunCommand: () => void
  onApplyPlan: () => void
  onReplayCommandRun: (commandRunId: string) => void
  onReset: () => void
}

export function PromptPanel(props: PromptPanelProps) {
  const isBusy = props.commandPhase !== 'idle'
  const recentRuns = props.commandRuns.slice(-3).reverse()

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
          New shared session
        </button>
      </div>

      <div className="prompt-panel__divider" />

      <label className="field">
        <span>Agent command</span>
        <textarea
          aria-label="Agent command"
          className="field__control field__control--textarea field__control--textarea-compact"
          value={props.commandInput}
          onChange={(event) => props.onCommandChange(event.target.value)}
          placeholder="Rename this node to Priority goals"
        />
      </label>

      <div className="prompt-panel__actions">
        <button
          className="button button--secondary"
          disabled={isBusy}
          onClick={props.onPreviewPlan}
        >
          {props.commandPhase === 'planning' ? 'Planning…' : 'Preview plan'}
        </button>
        <button
          className="button button--primary"
          disabled={isBusy}
          onClick={props.onRunCommand}
        >
          {props.commandPhase === 'executing' ? 'Running…' : 'Run command'}
        </button>
        <button
          className="button button--ghost"
          disabled={isBusy || !props.commandPlan}
          onClick={props.onApplyPlan}
        >
          Apply previewed plan
        </button>
      </div>

      <div className="prompt-panel__status">
        <p aria-live="polite" className="panel-note">
          {props.commandPhase === 'planning'
            ? 'Planning command into structured tool calls.'
            : props.commandPhase === 'executing'
              ? 'Executing structured tool calls against the shared runtime.'
              : 'Natural language is planned first, then executed through shared runtime operations.'}
        </p>
      </div>

      {props.commandError ? (
        <p role="alert" className="prompt-panel__error">
          {props.commandError}
        </p>
      ) : null}

      <div className="artifact-panel prompt-panel__plan">
        <div className="artifact-panel__header">
          <p className="panel-eyebrow">Agent plan</p>
          <h3>{props.commandPlan?.summary ?? 'No plan yet'}</h3>
        </div>

        <pre aria-label="Agent plan output" className="artifact-panel__body">
          {props.commandPlan
            ? JSON.stringify(props.commandPlan, null, 2)
            : 'Natural language is first planned into structured tool calls before execution.'}
        </pre>
      </div>

      <div className="artifact-panel prompt-panel__runs">
        <div className="artifact-panel__header">
          <p className="panel-eyebrow">Recent command runs</p>
          <h3>{recentRuns.length > 0 ? `${recentRuns.length} tracked` : 'No command runs yet'}</h3>
        </div>

        <div aria-label="Recent command runs" className="prompt-panel__run-list">
          {recentRuns.length > 0 ? (
            recentRuns.map((run) => (
              <article key={run.id} className="prompt-panel__run-card">
                <div className="prompt-panel__run-header">
                  <strong>{run.status}</strong>
                  <span>{run.completedToolCalls} step{run.completedToolCalls === 1 ? '' : 's'}</span>
                </div>
                <p>{run.input}</p>
                <div className="prompt-panel__run-actions">
                  <button
                    aria-label={`Replay run ${run.id}`}
                    className="button button--ghost"
                    disabled={isBusy}
                    onClick={() => props.onReplayCommandRun(run.id)}
                    type="button"
                  >
                    Replay command
                  </button>
                </div>
                {run.error ? <small>{run.error}</small> : null}
              </article>
            ))
          ) : (
            <p className="panel-note">
              Executed natural-language commands are persisted on the shared session.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
