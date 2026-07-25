import { Play, Plus, Trash2 } from 'lucide-react';
import type { StageCatalog } from '../api';

type Props = {
  catalog: StageCatalog;
  stageCount: number;
  readyToRun: boolean;
  busy: boolean;
  onAddStage: (stageId: string) => void;
  onAddInput: (portId: string) => void;
  onClear: () => void;
  onRun: () => void;
};

/** The palette: add an input box or a stage, then run what you built. */
export function ComposerBar({
  catalog,
  stageCount,
  readyToRun,
  busy,
  onAddStage,
  onAddInput,
  onClear,
  onRun,
}: Props) {
  return (
    <div className="composer-bar">
      <label htmlFor="add-input">
        <Plus size={13} /> Input
      </label>
      <select
        id="add-input"
        value=""
        onChange={(event) => event.target.value && onAddInput(event.target.value)}
      >
        <option value="" disabled>
          Paste…
        </option>
        {catalog.ports.map((port) => (
          <option key={port.id} value={port.id}>
            {port.label}
          </option>
        ))}
      </select>

      <label htmlFor="add-stage">
        <Plus size={13} /> Stage
      </label>
      <select
        id="add-stage"
        value=""
        onChange={(event) => event.target.value && onAddStage(event.target.value)}
      >
        <option value="" disabled>
          Add…
        </option>
        {catalog.stages.map((stage) => (
          <option key={stage.id} value={stage.id}>
            {stage.label}
          </option>
        ))}
      </select>

      <button className="reset-button" type="button" onClick={onClear} disabled={!stageCount} title="Clear the composed workflow">
        <Trash2 size={14} />
        Clear
      </button>

      <button
        className="run-workflow-button"
        type="button"
        onClick={onRun}
        disabled={busy || !readyToRun}
        title={
          readyToRun
            ? 'Seed the inputs and run these stages'
            : 'Every stage input needs a valid link before this can run'
        }
      >
        <Play size={14} />
        Run workflow
      </button>
    </div>
  );
}
