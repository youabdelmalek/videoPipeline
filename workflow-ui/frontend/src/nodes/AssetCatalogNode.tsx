import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { RefreshCcw, Sparkles } from 'lucide-react';
import { CollapseToggle, OpenDetailButton } from './NodeButtons';
import type { AssetCatalogNodeData } from './types';

const EMPTY_HINT =
  'Split all videos into shots, then extract backgrounds, props, and characters.';

export function AssetCatalogNode({ data }: NodeProps<Node<AssetCatalogNodeData>>) {
  const itemCount = data.groups.reduce((sum, group) => sum + group.items.length, 0);
  const title = itemCount ? `${itemCount} visual assets` : 'Visual Assets';

  return (
    <section className={`node node-asset-catalog ${data.collapsed ? 'is-collapsed' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="node-header">
        <div>
          <div className="node-kicker">Asset Catalog</div>
          <h2>{title}</h2>
        </div>
        <div className="node-header-actions">
          <OpenDetailButton
            data={data}
            label="asset catalog"
            detail={{
              kicker: 'Asset Catalog',
              title,
              body: [
                data.promptText ? `PROMPT\n\n${data.promptText}` : '',
                data.text ? `OUTPUT\n\n${data.text}` : '',
              ].filter(Boolean).join('\n\n---\n\n') || EMPTY_HINT,
            }}
          />
          <CollapseToggle data={data} label="asset catalog" />
        </div>
      </div>
      {data.collapsed ? (
        <p className="collapsed-summary">
          {itemCount ? `${itemCount} assets grouped by theme.` : 'Not run yet.'}
        </p>
      ) : (
        <>
          <div className="asset-catalog-summary">
            <span>{data.judgeVerdict ? `Judge: ${data.judgeVerdict}` : 'Judge not run'}</span>
            <button
              className="nodrag nopan"
              type="button"
              onClick={data.onBuildCatalog}
              disabled={data.disabled}
              title="Extract and detail backgrounds, props, and characters"
            >
              <Sparkles size={16} />
              {itemCount ? 'Rebuild Catalog' : 'Build Catalog'}
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
            {itemCount ? (
              data.groups.map((group) => (
                <section className="asset-group" key={group.theme}>
                  <h3>
                    {group.title}
                    <span>{group.items.length}</span>
                  </h3>
                  {group.items.length ? (
                    <ul>
                      {group.items.map((item) => (
                        <li key={item.id}>
                          <div className="asset-item-head">
                            <strong>{item.name}</strong>
                            <button
                              className="icon-button nodrag nopan"
                              type="button"
                              onClick={() => data.onRegenerateAsset(item.id)}
                              disabled={data.disabled}
                              title={`Regenerate ${item.name}`}
                              aria-label={`Regenerate ${item.name}`}
                            >
                              <RefreshCcw size={14} />
                            </button>
                          </div>
                          <p>{item.detail || item.evidence || 'Waiting for description.'}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="asset-empty">No items extracted.</p>
                  )}
                </section>
              ))
            ) : (
              <p className="collapsed-summary">{EMPTY_HINT}</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
