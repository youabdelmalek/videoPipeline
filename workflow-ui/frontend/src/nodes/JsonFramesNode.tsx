import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Clapperboard, Download, RefreshCcw } from 'lucide-react';
import { CollapseToggle, OpenDetailButton } from './NodeButtons';
import type { JsonFramesNodeData } from './types';
import type { JsonFrameSpec } from '../api';

const EMPTY_HINT =
  'Run the frame delta agent and the JSON asset specs, then write one JSON prompt per shot.';

/** The delta summary, which is what tells you the shot will animate. */
function deltaSummary(spec: JsonFrameSpec): string {
  const delta = spec.spec.delta;
  if (!delta || typeof delta !== 'object') {
    return 'Delta not written.';
  }
  return String((delta as Record<string, unknown>).summary ?? '').trim() || 'Delta not written.';
}

function downloadFrame(spec: JsonFrameSpec): void {
  const body = JSON.stringify(spec.spec, null, 2);
  const url = URL.createObjectURL(new Blob([body], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = spec.filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function JsonFramesNode({ data }: NodeProps<Node<JsonFramesNodeData>>) {
  const frameCount = data.frames.length;
  const title = frameCount ? `${frameCount} frame prompts` : 'JsonFrames';

  return (
    <section className={`node node-json-frames ${data.collapsed ? 'is-collapsed' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="node-header">
        <div>
          <div className="node-kicker">JsonFrames</div>
          <h2>{title}</h2>
        </div>
        <div className="node-header-actions">
          <OpenDetailButton
            data={data}
            label="json frames"
            detail={{
              kicker: 'JsonFrames',
              title,
              body: [
                data.promptText ? `PROMPT\n\n${data.promptText}` : '',
                data.text ? `OUTPUT\n\n${data.text}` : '',
              ].filter(Boolean).join('\n\n---\n\n') || EMPTY_HINT,
            }}
          />
          <CollapseToggle data={data} label="json frames" />
        </div>
      </div>
      {data.collapsed ? (
        <p className="collapsed-summary">
          {frameCount ? `${frameCount} shot prompts written.` : 'Not run yet.'}
        </p>
      ) : (
        <>
          <div className="asset-catalog-summary">
            <span>{data.judgeVerdict ? `Judge: ${data.judgeVerdict}` : 'Judge not run'}</span>
            <button
              className="nodrag nopan"
              type="button"
              onClick={data.onBuildJsonFrames}
              disabled={data.disabled}
              title="Write a first/last frame JSON prompt for every shot"
            >
              <Clapperboard size={16} />
              {frameCount ? 'Rebuild Prompts' : 'Build Prompts'}
            </button>
          </div>
          <div className="agent-io agent-io-compact">
            <section>
              <h3>Prompt</h3>
              <pre>{data.promptText || 'Prompt not saved yet.'}</pre>
            </section>
            <section>
              <h3>Output</h3>
              <pre>{data.text || EMPTY_HINT}</pre>
            </section>
          </div>
          <div className="asset-groups">
            {frameCount ? (
              <ul className="json-asset-list">
                {data.frames.map((spec) => (
                  <li key={spec.ref}>
                    <div className="asset-item-head">
                      <strong>
                        {spec.ref} - {spec.title}
                      </strong>
                      <span className="json-asset-actions">
                        <button
                          className="icon-button nodrag nopan"
                          type="button"
                          onClick={() => downloadFrame(spec)}
                          title={`Download ${spec.filename}`}
                          aria-label={`Download ${spec.filename}`}
                        >
                          <Download size={14} />
                        </button>
                        <button
                          className="icon-button nodrag nopan"
                          type="button"
                          onClick={() => data.onRegenerateJsonFrame(spec.ref)}
                          disabled={data.disabled}
                          title={`Regenerate the prompt for ${spec.ref}`}
                          aria-label={`Regenerate the prompt for ${spec.ref}`}
                        >
                          <RefreshCcw size={14} />
                        </button>
                      </span>
                    </div>
                    <p className="json-asset-file">{spec.filename}</p>
                    <p>
                      {spec.background || 'no background'}
                      {spec.characters.length ? ` - ${spec.characters.join(', ')}` : ''}
                    </p>
                    <p>Delta: {deltaSummary(spec)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="collapsed-summary">{EMPTY_HINT}</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
