import { useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { GraphView } from './graph-view'
import { Inspector } from './inspector'
import { PromptPanel } from './prompt-panel'
import { useSessionViewModel } from './session-view-model'

export function Workspace() {
  const [prompt, setPrompt] = useState('')
  const [commandInput, setCommandInput] = useState('')
  const [actionBrief, setActionBrief] = useState('Add risks and dependencies')
  const viewModel = useSessionViewModel()

  return (
    <ReactFlowProvider>
      <div className="workspace-shell">
        <header className="workspace-topbar">
          <div className="workspace-brand">
            <span className="workspace-brand__mark">AM</span>
            <div>
              <strong>agentic-mindmap</strong>
              <small>Human edits plus structured agent actions</small>
            </div>
          </div>
          <p className="workspace-topbar__note">
            CLI-first prototype with a shared local session backend.
          </p>
        </header>

        <main className="workspace-grid">
          <PromptPanel
            prompt={prompt}
            commandInput={commandInput}
            commandPlan={viewModel.commandPlan}
            commandRuns={viewModel.commandRuns}
            commandError={viewModel.commandError}
            commandPhase={viewModel.commandPhase}
            sessionId={viewModel.session.id}
            onPromptChange={setPrompt}
            onCommandChange={setCommandInput}
            onGenerate={() => void viewModel.generateFromPrompt(prompt)}
            onPreviewPlan={() => void viewModel.previewCommand(commandInput)}
            onRunCommand={() => void viewModel.runCommand(commandInput)}
            onApplyPlan={() => void viewModel.applyPlannedCommand()}
            onReplayCommandRun={(commandRunId) =>
              void viewModel.replayCommandRun(commandRunId)
            }
            onReset={() => {
              viewModel.resetSession()
              setPrompt('')
              setCommandInput('')
              setActionBrief('Add risks and dependencies')
            }}
          />

          <GraphView
            graph={viewModel.session.graph}
            selectedNodeId={viewModel.session.graph.selection.focusedNodeId}
            onSelectNode={viewModel.selectNode}
          />

          <Inspector
            selectedNode={viewModel.selectedNode}
            artifact={viewModel.latestArtifact}
            actionBrief={actionBrief}
            onTitleChange={viewModel.renameSelectedNode}
            onActionBriefChange={setActionBrief}
            onAddChildNode={viewModel.addChildNode}
            onDeleteNode={viewModel.deleteSelectedNode}
            onExpandBranch={() => void viewModel.expandSelectedBranch(actionBrief)}
            onCreateOutline={() => void viewModel.createOutline()}
          />
        </main>
      </div>
    </ReactFlowProvider>
  )
}
