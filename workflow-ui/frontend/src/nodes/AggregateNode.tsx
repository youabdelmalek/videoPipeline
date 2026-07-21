import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { CollapseToggle, DownloadMarkdownButton, OpenDetailButton } from './NodeButtons';
import type { AggregateNodeData } from './types';

function detailBody(data: AggregateNodeData): string {
  return [
    data.inputText ? `PROMPT\n\n${data.inputText}` : '',
    data.text ? `OUTPUT\n\n${data.text}` : '',
  ].filter(Boolean).join('\n\n---\n\n') || 'Pending generation.';
}

export function AggregateNode({ data }: NodeProps<Node<AggregateNodeData>>) {
  const hasInput = Boolean(data.inputText?.trim());
  const hasOutput = Boolean(data.text?.trim());
  return (
    <section className={`node node-aggregate ${data.collapsed ? 'is-collapsed' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="node-header">
        <div>
          <div className="node-kicker">{data.kicker ?? 'All Videos'}</div>
          <h2>{data.title}</h2>
        </div>
        <div className="node-header-actions">
          {data.downloadable && hasOutput ? (
            <DownloadMarkdownButton
              filename={`${data.kicker ?? 'output'}-${data.title}`}
              markdown={`# ${data.kicker ?? 'Output'}\n\n## ${data.title}\n\n${data.text}\n`}
            />
          ) : null}
          <OpenDetailButton data={data} label={data.kicker ?? 'agent'} detail={{ kicker: data.kicker ?? 'Agent', title: data.title, body: detailBody(data) }} />
          <CollapseToggle data={data} label="all videos" />
        </div>
      </div>
      {data.collapsed ? (
        <p className="collapsed-summary">{hasOutput ? `${data.title} generated.` : 'Pending generation.'}</p>
      ) : (
        <div className="agent-io">
          <section>
            <h3>Prompt</h3>
            <pre>{hasInput ? data.inputText : 'Prompt not saved yet.'}</pre>
          </section>
          <section>
            <h3>Output</h3>
            <pre>{hasOutput ? data.text : 'Pending generation.'}</pre>
          </section>
        </div>
      )}
    </section>
  );
}
