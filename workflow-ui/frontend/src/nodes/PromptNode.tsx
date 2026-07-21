import { useEffect, useRef, useState } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { WandSparkles } from 'lucide-react';
import { CollapseToggle, OpenDetailButton } from './NodeButtons';
import type { PromptNodeData } from './types';

/** "14.4 GB", or nothing when the backend could not read a size.
 *  Decimal GB, so the number matches what `ollama list` prints. */
function sizeLabel(bytes: number): string {
  return bytes > 0 ? ` - ${(bytes / 1e9).toFixed(1)} GB` : '';
}

/**
 * Keeps the caret where the user put it.
 *
 * `data.prompt` reaches this node through React Flow's store, which is synced
 * from the `nodes` prop in an effect rather than during render. Binding the
 * textarea straight to it means one commit still carries the previous text, and
 * React rewrites that stale value into the element - which drops the caret at
 * the end. So the textarea is driven by local state, and `data.prompt` is only
 * copied in when it changes for some reason other than our own typing (loading
 * a run, or Reset).
 */
function usePromptDraft(promptFromStore: string, onPromptChange: (value: string) => void) {
  const [draft, setDraft] = useState(promptFromStore);
  const ownEcho = useRef(promptFromStore);

  useEffect(() => {
    if (promptFromStore !== ownEcho.current) {
      ownEcho.current = promptFromStore;
      setDraft(promptFromStore);
    }
  }, [promptFromStore]);

  return {
    draft,
    onEdit(value: string) {
      ownEcho.current = value;
      setDraft(value);
      onPromptChange(value);
    },
  };
}

export function PromptNode({ data }: NodeProps<Node<PromptNodeData>>) {
  const { draft, onEdit } = usePromptDraft(data.prompt, data.onPromptChange);

  return (
    <section className={`node node-prompt ${data.collapsed ? 'is-collapsed' : ''}`}>
      <Handle type="source" position={Position.Right} />
      <div className="node-header">
        <div>
          <div className="node-kicker">Prompt</div>
          {data.collapsed ? <h2>Story Prompt</h2> : null}
        </div>
        <div className="node-header-actions">
          <OpenDetailButton data={data} label="prompt" detail={{ kicker: 'Prompt', title: 'Story Prompt', body: draft }} />
          <CollapseToggle data={data} label="prompt" />
        </div>
      </div>
      {data.collapsed ? (
        <p className="collapsed-summary">{draft.split('\n')[0]}</p>
      ) : (
        <>
          <textarea className="nodrag nopan" value={draft} onChange={(event) => onEdit(event.target.value)} />
          <div className="node-actions">
            <select
              className="nodrag nopan"
              value={data.model}
              onChange={(event) => data.onModelChange(event.target.value)}
              aria-label="Ollama model"
            >
              {data.models.map((option) => (
                <option key={option.name} value={option.name} disabled={!option.installed}>
                  {option.label}
                  {sizeLabel(option.size_bytes)}
                  {option.installed ? '' : ' (not pulled)'}
                </option>
              ))}
            </select>
            <button className="nodrag nopan" type="button" onClick={data.onGenerate} disabled={data.disabled || draft.trim().length < 8} title="Generate video beat sections">
              <WandSparkles size={16} />
              Generate Videos
            </button>
          </div>
          {data.modelsNotice ? <p className="node-notice">{data.modelsNotice}</p> : null}
          {data.runSlug ? <div className="run-chip">{data.runSlug}</div> : null}
        </>
      )}
    </section>
  );
}
