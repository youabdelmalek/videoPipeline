import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { artifactUrl } from '../api';
import { CollapseToggle, OpenDetailButton } from './NodeButtons';
import type { ArtifactNodeData } from './types';

export function ArtifactNode({ data }: NodeProps<Node<ArtifactNodeData>>) {
  return (
    <section className={`node node-artifacts ${data.collapsed ? 'is-collapsed' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="node-header">
        <div>
          <div className="node-kicker">Ollama Logs</div>
          <h2>Inputs + Outputs</h2>
        </div>
        <div className="node-header-actions">
          <OpenDetailButton
            data={data}
            label="Ollama logs"
            detail={{
              kicker: 'Ollama Logs',
              title: 'Inputs + Outputs',
              body: data.artifacts.length ? data.artifacts.map((artifact) => `${artifact.label}\n${artifact.workspace_path}`).join('\n\n') : 'No logs yet.',
            }}
          />
          <CollapseToggle data={data} label="Ollama logs" />
        </div>
      </div>
      {data.collapsed ? (
        <p className="collapsed-summary">{data.artifacts.length ? `${data.artifacts.length} Markdown logs` : 'No logs yet.'}</p>
      ) : (
        <div className="artifact-list nodrag nopan">
          {data.slug && data.artifacts.length ? (
            data.artifacts.map((artifact) => (
              <a key={artifact.path} href={artifactUrl(data.slug!, artifact.path)} target="_blank" rel="noreferrer" title={artifact.workspace_path}>
                {artifact.label}
              </a>
            ))
          ) : (
            <p>Markdown logs appear after generation starts.</p>
          )}
        </div>
      )}
    </section>
  );
}
