import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { AlertCircle, CheckCircle2, Scale } from 'lucide-react';
import { CollapseToggle, OpenDetailButton } from './NodeButtons';
import type { JudgeNodeData } from './types';

export function JudgeNode({ data }: NodeProps<Node<JudgeNodeData>>) {
  const passed = data.verdict === 'PASS';
  return (
    <section className={`node node-judge ${data.collapsed ? 'is-collapsed' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="judge-head">
        <div>
          <div className="node-kicker">Video Judge</div>
          <h2>{data.verdict ?? 'Not Run'}</h2>
        </div>
        <div className="node-header-actions">
          {data.verdict ? passed ? <CheckCircle2 className="pass" /> : <AlertCircle className="retry" /> : <Scale />}
          <OpenDetailButton data={data} label="video judge" detail={{ kicker: 'Video Judge', title: data.verdict ?? 'Not Run', body: data.text || 'Waiting for video beat sections.' }} />
          <CollapseToggle data={data} label="video judge" />
        </div>
      </div>
      {data.collapsed ? (
        <p className="collapsed-summary">{data.verdict ? `Verdict: ${data.verdict}` : 'Waiting for video beat sections.'}</p>
      ) : (
        <>
          <button className="nodrag nopan" type="button" onClick={data.onJudge} disabled={data.disabled} title="Judge videos">
            <Scale size={16} />
            Judge Again
          </button>
          <pre>{data.text || 'Waiting for video beat sections.'}</pre>
        </>
      )}
    </section>
  );
}
