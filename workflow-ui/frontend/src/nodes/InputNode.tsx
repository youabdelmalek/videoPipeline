import { useEffect, useRef, useState } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Check, Trash2, TriangleAlert } from 'lucide-react';
import type { InputNodeData } from './types';

/**
 * Pasted text bound to one port.
 *
 * Local state drives the textarea for the same reason as `PromptNode`: the
 * value round-trips through React Flow's store, so binding straight to the prop
 * drops the caret at the end on every keystroke.
 */
export function InputNode({ data }: NodeProps<Node<InputNodeData>>) {
  const [draft, setDraft] = useState(data.text);
  const ownEcho = useRef(data.text);

  useEffect(() => {
    if (data.text !== ownEcho.current) {
      ownEcho.current = data.text;
      setDraft(data.text);
    }
  }, [data.text]);

  function onEdit(value: string) {
    ownEcho.current = value;
    setDraft(value);
    data.onTextChange(data.nodeId, value);
  }

  const port = data.ports.find((entry) => entry.id === data.port);
  const check = data.check;

  return (
    <section className="node node-input">
      <div className="node-header">
        <div>
          <div className="node-kicker">Input</div>
          <h2>{port?.label ?? 'Pick a format'}</h2>
        </div>
        <div className="node-header-actions">
          <button
            className="delete-button nodrag nopan"
            type="button"
            onClick={() => data.onRemove(data.nodeId)}
            title="Remove this input"
            aria-label="Remove this input"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <select
        className="nodrag nopan"
        value={data.port}
        onChange={(event) => data.onPortChange(data.nodeId, event.target.value)}
        aria-label="Input format"
      >
        {data.ports.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.label}
          </option>
        ))}
      </select>

      <textarea
        className="nodrag nopan"
        value={draft}
        onChange={(event) => onEdit(event.target.value)}
        placeholder={port ? `Paste ${port.hint}` : 'Paste text'}
      />

      {check ? (
        <p className={`port-check ${check.ok ? 'is-ok' : 'is-bad'}`}>
          {check.ok ? <Check size={13} /> : <TriangleAlert size={13} />}
          {check.summary}
        </p>
      ) : (
        <p className="port-check">{draft.trim() ? 'Checking…' : port?.hint}</p>
      )}

      {/* One output, carrying whatever port this box is set to. */}
      <Handle type="source" position={Position.Right} id="out" />
    </section>
  );
}
