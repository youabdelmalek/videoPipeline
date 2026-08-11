import type {
  ModelOption,
  ThinkingLevel,
} from '../api';
import type { AspectRatio } from '../constants';

export type FlexibleInput = {
  id: string;
  name: string;
  value: string;
};

export type FlexibleAgentNodeData = {
  nodeId: string;
  name: string;
  order: number;
  prompt: string;
  model: string;
  thinking: ThinkingLevel;
  models: ModelOption[];
  inputs: FlexibleInput[];
  output: string;
  running: boolean;
  pendingSourceNodeId: string | null;
  onChange: (nodeId: string, patch: Partial<FlexibleAgentPatch>) => void;
  onInputChange: (nodeId: string, inputId: string, patch: Partial<FlexibleInput>) => void;
  onAddInput: (nodeId: string) => void;
  onRemoveInput: (nodeId: string, inputId: string) => void;
  onPickOutput: (nodeId: string, handleId: string) => void;
  onPickInput: (nodeId: string, handleId: string) => void;
  onRun: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
};

export type FlexibleAgentPatch = {
  name: string;
  order: number;
  prompt: string;
  model: string;
  thinking: ThinkingLevel;
  output: string;
};

export type FlexibleTextNodeData = {
  nodeId: string;
  name: string;
  order: number;
  text: string;
  hasInput: boolean;
  hasOutput: boolean;
  pendingSourceNodeId: string | null;
  onChange: (nodeId: string, patch: Partial<FlexibleTextPatch>) => void;
  onPickOutput: (nodeId: string, handleId: string) => void;
  onPickInput: (nodeId: string, handleId: string) => void;
  onRemove: (nodeId: string) => void;
};

export type FlexibleTextPatch = {
  name: string;
  order: number;
  text: string;
  hasInput: boolean;
  hasOutput: boolean;
};

export type FlexibleIfNodeData = {
  nodeId: string;
  name: string;
  order: number;
  input1: string;
  input2: string;
  condition: string;
  prompt: string;
  output1: string;
  output2: string;
  status: string;
  running: boolean;
  pendingSourceNodeId: string | null;
  pendingSourceHandleId: string | null;
  onChange: (nodeId: string, patch: Partial<FlexibleIfPatch>) => void;
  onPickOutput: (nodeId: string, handleId: string) => void;
  onPickInput: (nodeId: string, handleId: string) => void;
  onRun: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
};

export type FlexibleIfPatch = {
  name: string;
  order: number;
  input1: string;
  input2: string;
  condition: string;
  prompt: string;
  output1: string;
  output2: string;
  status: string;
};

export type FlexibleSplitNodeData = {
  nodeId: string;
  name: string;
  order: number;
  input: string;
  delimiter: string;
  count: number;
  outputs: string[];
  pendingSourceNodeId: string | null;
  pendingSourceHandleId: string | null;
  onChange: (nodeId: string, patch: Partial<FlexibleSplitPatch>) => void;
  onPickOutput: (nodeId: string, handleId: string) => void;
  onPickInput: (nodeId: string, handleId: string) => void;
  onRun: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
};

export type FlexibleSplitPatch = {
  name: string;
  order: number;
  input: string;
  delimiter: string;
  count: number;
  outputs: string[];
};

export type FlexibleImageUploadNodeData = {
  nodeId: string;
  name: string;
  order: number;
  outputUrl: string;
  outputName: string;
  status: string;
  imageInputDir: string;
  pendingSourceNodeId: string | null;
  pendingSourceHandleId: string | null;
  onChange: (nodeId: string, patch: Partial<FlexibleImageUploadPatch>) => void;
  onPickOutput: (nodeId: string, handleId: string) => void;
  onUploadImage: (nodeId: string, file: File) => void;
  onRemove: (nodeId: string) => void;
};

export type FlexibleImageUploadPatch = {
  name: string;
  order: number;
  outputUrl: string;
  outputName: string;
  status: string;
};

export type FlexibleImageDisplayNodeData = {
  nodeId: string;
  name: string;
  order: number;
  imageUrl: string;
  pendingSourceNodeId: string | null;
  onChange: (nodeId: string, patch: Partial<FlexibleImageDisplayPatch>) => void;
  onPickInput: (nodeId: string, handleId: string) => void;
  onRemove: (nodeId: string) => void;
};

export type FlexibleImageDisplayPatch = {
  name: string;
  order: number;
  imageUrl: string;
};

export type FlexibleImageGenerateNodeData = {
  nodeId: string;
  name: string;
  order: number;
  prompt: string;
  inputs: FlexibleInput[];
  referenceImage: string;
  aspectRatio: AspectRatio;
  seed: string;
  steps: number;
  strength: number;
  outputUrl: string;
  outputName: string;
  status: string;
  running: boolean;
  pendingSourceNodeId: string | null;
  pendingSourceHandleId: string | null;
  onChange: (nodeId: string, patch: Partial<FlexibleImageGeneratePatch>) => void;
  onInputChange: (nodeId: string, inputId: string, patch: Partial<FlexibleInput>) => void;
  onAddInput: (nodeId: string) => void;
  onRemoveInput: (nodeId: string, inputId: string) => void;
  onPickOutput: (nodeId: string, handleId: string) => void;
  onPickInput: (nodeId: string, handleId: string) => void;
  onRun: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
};

export type FlexibleImageGeneratePatch = {
  name: string;
  order: number;
  prompt: string;
  referenceImage: string;
  aspectRatio: AspectRatio;
  seed: string;
  steps: number;
  strength: number;
  outputUrl: string;
  outputName: string;
  status: string;
};

export type FlexibleImageTextNodeData = {
  nodeId: string;
  name: string;
  order: number;
  prompt: string;
  model: string;
  models: ModelOption[];
  imageUrl: string;
  inputs: FlexibleInput[];
  output: string;
  status: string;
  running: boolean;
  pendingSourceNodeId: string | null;
  pendingSourceHandleId: string | null;
  onChange: (nodeId: string, patch: Partial<FlexibleImageTextPatch>) => void;
  onInputChange: (nodeId: string, inputId: string, patch: Partial<FlexibleInput>) => void;
  onAddInput: (nodeId: string) => void;
  onRemoveInput: (nodeId: string, inputId: string) => void;
  onPickOutput: (nodeId: string, handleId: string) => void;
  onPickInput: (nodeId: string, handleId: string) => void;
  onRun: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
};

export type FlexibleImageTextPatch = {
  name: string;
  order: number;
  prompt: string;
  model: string;
  imageUrl: string;
  output: string;
  status: string;
};

export type FlexibleWorkflowInputNodeData = {
  nodeId: string;
  name: string;
  order: number;
  value: string;
  pendingSourceNodeId: string | null;
  onChange: (nodeId: string, patch: Partial<FlexibleWorkflowInputPatch>) => void;
  onPickOutput: (nodeId: string, handleId: string) => void;
  onRemove: (nodeId: string) => void;
};

export type FlexibleWorkflowInputPatch = {
  name: string;
  order: number;
  value: string;
};

export type FlexibleWorkflowOutputNodeData = {
  nodeId: string;
  name: string;
  order: number;
  value: string;
  pendingSourceNodeId: string | null;
  onChange: (nodeId: string, patch: Partial<FlexibleWorkflowOutputPatch>) => void;
  onPickInput: (nodeId: string, handleId: string) => void;
  onRemove: (nodeId: string) => void;
};

export type FlexibleWorkflowOutputPatch = {
  name: string;
  order: number;
  value: string;
};

/** One saved workflow, for the workflow node's picker. */
export type WorkflowOption = {
  name: string;
};

export type FlexibleWorkflowNodeData = {
  nodeId: string;
  name: string;
  order: number;
  workflowName: string;
  inputs: FlexibleInput[];
  outputs: { name: string; value: string }[];
  status: string;
  running: boolean;
  workflowOptions: WorkflowOption[];
  pendingSourceNodeId: string | null;
  pendingSourceHandleId: string | null;
  onChange: (nodeId: string, patch: Partial<FlexibleWorkflowPatch>) => void;
  onInputChange: (nodeId: string, inputId: string, patch: Partial<FlexibleInput>) => void;
  onPickWorkflow: (nodeId: string, workflowName: string) => void;
  onOpenWorkflow: (workflowName: string) => void;
  onPickOutput: (nodeId: string, handleId: string) => void;
  onPickInput: (nodeId: string, handleId: string) => void;
  onRun: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
};

export type FlexibleWorkflowPatch = {
  name: string;
  order: number;
  status: string;
};

export type FlexibleForEachNodeData = {
  nodeId: string;
  name: string;
  order: number;
  items: string;
  workflowName: string;
  output: string;
  threshold: number;
  maxAttempts: number;
  retryWith: 'result' | 'input';
  score: string;
  note: string;
  iterations: number;
  attempts: number;
  trace: string;
  status: string;
  running: boolean;
  workflowOptions: WorkflowOption[];
  pendingSourceNodeId: string | null;
  pendingSourceHandleId: string | null;
  onChange: (nodeId: string, patch: Partial<FlexibleForEachPatch>) => void;
  onPickWorkflow: (nodeId: string, workflowName: string) => void;
  onOpenWorkflow: (workflowName: string) => void;
  onPickOutput: (nodeId: string, handleId: string) => void;
  onPickInput: (nodeId: string, handleId: string) => void;
  onRun: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
};

export type FlexibleForEachPatch = {
  name: string;
  order: number;
  items: string;
  workflowName: string;
  threshold: number;
  maxAttempts: number;
  retryWith: 'result' | 'input';
  output: string;
  score: string;
  note: string;
  iterations: number;
  attempts: number;
  trace: string;
  status: string;
};

export type FlexibleJsonNodeData = {
  nodeId: string;
  name: string;
  order: number;
  input: string;
  path: string;
  output: string;
  error: string | null;
  pendingSourceNodeId: string | null;
  onChange: (nodeId: string, patch: Partial<FlexibleJsonPatch>) => void;
  onPickOutput: (nodeId: string, handleId: string) => void;
  onPickInput: (nodeId: string, handleId: string) => void;
  onRun: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
};

export type FlexibleJsonPatch = {
  name: string;
  order: number;
  input: string;
  path: string;
  output: string;
  error: string | null;
};
