import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Braces, Download, RefreshCcw } from 'lucide-react';
import { CollapseToggle, OpenDetailButton } from './NodeButtons';
import type { JsonAssetsNodeData } from './types';
import type { JsonAssetSpec } from '../api';

const EMPTY_HINT =
  'Build the asset catalog first, then turn each asset into a JSON generation spec.';

/** Angle or state labels, for the one-line summary under each asset. */
function labels(spec: JsonAssetSpec, key: 'angles' | 'states'): string {
  const entries = spec.spec[key];
  if (!Array.isArray(entries)) {
    return 'none';
  }
  const names = entries
    .map((entry) => (entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : null))
    .map((entry) => String(entry?.label ?? entry?.id ?? '').trim())
    .filter(Boolean);
  return names.join(', ') || 'none';
}

function downloadSpec(spec: JsonAssetSpec): void {
  const body = JSON.stringify(spec.spec, null, 2);
  const url = URL.createObjectURL(new Blob([body], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = spec.filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function JsonAssetsNode({ data }: NodeProps<Node<JsonAssetsNodeData>>) {
  const specCount = data.specs.length;
  const title = specCount ? `${specCount} JSON specs` : 'JsonAssets';

  return (
    <section className={`node node-json-assets ${data.collapsed ? 'is-collapsed' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="node-header">
        <div>
          <div className="node-kicker">JsonAssets</div>
          <h2>{title}</h2>
        </div>
        <div className="node-header-actions">
          <OpenDetailButton
            data={data}
            label="json assets"
            detail={{
              kicker: 'JsonAssets',
              title,
              body: [
                data.promptText ? `PROMPT\n\n${data.promptText}` : '',
                data.text ? `OUTPUT\n\n${data.text}` : '',
              ].filter(Boolean).join('\n\n---\n\n') || EMPTY_HINT,
            }}
          />
          <CollapseToggle data={data} label="json assets" />
        </div>
      </div>
      {data.collapsed ? (
        <p className="collapsed-summary">
          {specCount ? `${specCount} asset specifications written.` : 'Not run yet.'}
        </p>
      ) : (
        <>
          <div className="asset-catalog-summary">
            <span>{data.judgeVerdict ? `Judge: ${data.judgeVerdict}` : 'Judge not run'}</span>
            <button
              className="nodrag nopan"
              type="button"
              onClick={data.onBuildJsonAssets}
              disabled={data.disabled}
              title="Turn every catalog asset into a JSON generation spec"
            >
              <Braces size={16} />
              {specCount ? 'Rebuild Specs' : 'Build Specs'}
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
            {specCount ? (
              <ul className="json-asset-list">
                {data.specs.map((spec) => (
                  <li key={spec.id}>
                    <div className="asset-item-head">
                      <strong>{spec.name}</strong>
                      <span className="json-asset-actions">
                        <button
                          className="icon-button nodrag nopan"
                          type="button"
                          onClick={() => downloadSpec(spec)}
                          title={`Download ${spec.filename}`}
                          aria-label={`Download ${spec.filename}`}
                        >
                          <Download size={14} />
                        </button>
                        <button
                          className="icon-button nodrag nopan"
                          type="button"
                          onClick={() => data.onRegenerateJsonAsset(spec.id)}
                          disabled={data.disabled}
                          title={`Regenerate spec for ${spec.name}`}
                          aria-label={`Regenerate spec for ${spec.name}`}
                        >
                          <RefreshCcw size={14} />
                        </button>
                      </span>
                    </div>
                    <p className="json-asset-file">{spec.filename}</p>
                    <p>
                      Angles ({spec.angle_count}): {labels(spec, 'angles')}
                    </p>
                    <p>
                      States ({spec.state_count}): {labels(spec, 'states')}
                    </p>
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
