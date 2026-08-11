import type { Node } from '@xyflow/react';
import {
  FlexibleAgentNode,
  FlexibleForEachNode,
  FlexibleIfNode,
  FlexibleImageDisplayNode,
  FlexibleImageGenerateNode,
  FlexibleImageTextNode,
  FlexibleImageUploadNode,
  FlexibleVideoGenerateNode,
  FlexibleJsonNode,
  FlexibleSplitNode,
  FlexibleTextNode,
  FlexibleWorkflowInputNode,
  FlexibleWorkflowNode,
  FlexibleWorkflowOutputNode,
} from '../nodes';

/** Maps a node's `type` to the component that renders it. */
export const nodeTypes = {
  flexibleAgent: FlexibleAgentNode,
  flexibleForEach: FlexibleForEachNode,
  flexibleIf: FlexibleIfNode,
  flexibleImageDisplay: FlexibleImageDisplayNode,
  flexibleImageGenerate: FlexibleImageGenerateNode,
  flexibleImageText: FlexibleImageTextNode,
  flexibleImageUpload: FlexibleImageUploadNode,
  flexibleVideoGenerate: FlexibleVideoGenerateNode,
  flexibleJson: FlexibleJsonNode,
  flexibleSplit: FlexibleSplitNode,
  flexibleText: FlexibleTextNode,
  flexibleWorkflowInput: FlexibleWorkflowInputNode,
  flexibleWorkflowOutput: FlexibleWorkflowOutputNode,
  flexibleWorkflow: FlexibleWorkflowNode,
};

const MINIMAP_COLORS: Record<string, string> = {
  flexibleAgent: '#116466',
  flexibleForEach: '#2f7f6a',
  flexibleIf: '#8a4f7d',
  flexibleImageDisplay: '#4b6f9f',
  flexibleImageGenerate: '#116466',
  flexibleImageText: '#8a4f7d',
  flexibleImageUpload: '#7c5b2c',
  flexibleVideoGenerate: '#a84f2f',
  flexibleJson: '#8a6f2f',
  flexibleSplit: '#2f7f6a',
  flexibleText: '#7c5b2c',
  flexibleWorkflowInput: '#8a6f2f',
  flexibleWorkflowOutput: '#6b4f9f',
  flexibleWorkflow: '#116466',
};

const MINIMAP_FALLBACK = '#6f685d';

export function minimapNodeColor(node: Node): string {
  return (node.type && MINIMAP_COLORS[node.type]) || MINIMAP_FALLBACK;
}
