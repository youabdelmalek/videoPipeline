import { PanelLeftClose } from 'lucide-react';
import { formatWorkflowLog, type WorkflowLogEntry } from '../lib/engine';

type Props = {
  entries: WorkflowLogEntry[];
  workflowName: string;
  runName: string;
  open: boolean;
  onClose: () => void;
};

export function WorkflowLogPanel({ entries, workflowName, runName, open, onClose }: Props) {
  const content = entries.length
    ? formatWorkflowLog(entries, workflowName, runName)
    : 'No workflow entries yet. Start a workflow to fill this log.';

  return (
    <aside className={`workflow-log-drawer ${open ? 'is-open' : 'is-closed'}`} aria-hidden={!open} aria-label="Workflow log">
      <header className="workflow-log-head">
        <div>
          <div className="node-kicker">Execution</div>
          <strong>Workflow log</strong>
        </div>
        <button type="button" className="workflow-log-close" onClick={onClose} title="Close workflow log" aria-label="Close workflow log" tabIndex={open ? 0 : -1}>
          <PanelLeftClose size={15} />
        </button>
      </header>
      <pre className="workflow-log-content">{content}</pre>
    </aside>
  );
}