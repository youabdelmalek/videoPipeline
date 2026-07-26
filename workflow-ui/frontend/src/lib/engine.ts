/**
 * Pure workflow engine: node state types, value plumbing, and execution.
 *
 * Everything here is UI-free so a saved workflow runs the same way whether it
 * sits on the canvas or is embedded as a workflow node inside another
 * workflow. Execution is strictly sequential: nodes run one at a time in
 * `order`, and a node never starts until the one before it has finished.
 */

import type { Edge } from '@xyflow/react';
import { runFlexibleLlm } from '../api';
import type { FlexibleInput } from '../nodes';

export type AgentNodeState = {
  id: string;
  kind: 'agent';
  name: string;
  order: number;
  prompt: string;
  model: string;
  inputs: FlexibleInput[];
  output: string;
  position: { x: number; y: number };
};

export type TextNodeState = {
  id: string;
  kind: 'text';
  name: string;
  order: number;
  text: string;
  hasInput: boolean;
  hasOutput: boolean;
  position: { x: number; y: number };
};

export type JsonNodeState = {
  id: string;
  kind: 'json';
  name: string;
  order: number;
  input: string;
  path: string;
  output: string;
  error: string | null;
  position: { x: number; y: number };
};

export type IfNodeState = {
  id: string;
  kind: 'if';
  name: string;
  order: number;
  input1: string;
  input2: string;
  condition: string;
  prompt: string;
  output1: string;
  output2: string;
  status: string;
  position: { x: number; y: number };
};

export type SplitNodeState = {
  id: string;
  kind: 'split';
  name: string;
  order: number;
  input: string;
  delimiter: string;
  count: number;
  outputs: string[];
  position: { x: number; y: number };
};

/** Entry point of a workflow. Its name is the input's exposed name. */
export type InputNodeState = {
  id: string;
  kind: 'input';
  name: string;
  order: number;
  /** Value used when run standalone; overridden when run as a workflow node. */
  value: string;
  position: { x: number; y: number };
};

/** Exit point of a workflow. Its name is the output's exposed name. */
export type OutputNodeState = {
  id: string;
  kind: 'output';
  name: string;
  order: number;
  value: string;
  position: { x: number; y: number };
};

/** A saved workflow embedded as a single callable node. */
export type WorkflowRefNodeState = {
  id: string;
  kind: 'workflow';
  name: string;
  order: number;
  workflowName: string;
  /** Mirrors the saved workflow's Input nodes; id === exposed input name. */
  inputs: FlexibleInput[];
  /** Mirrors the saved workflow's Output nodes. */
  outputs: { name: string; value: string }[];
  status: string;
  position: { x: number; y: number };
};

/** Runs a saved workflow once per item. */
export type ForEachNodeState = {
  id: string;
  kind: 'forEach';
  name: string;
  order: number;
  items: string;
  workflowName: string;
  output: string;
  iterations: number;
  status: string;
  position: { x: number; y: number };
};

export type WorkflowNodeState =
  | AgentNodeState
  | TextNodeState
  | JsonNodeState
  | IfNodeState
  | SplitNodeState
  | InputNodeState
  | OutputNodeState
  | WorkflowRefNodeState
  | ForEachNodeState;

export type NodeKind = WorkflowNodeState['kind'];

export type WorkflowSnapshot = {
  nodes: WorkflowNodeState[];
  edges: Edge[];
  updatedAt: number;
};

export type SavedWorkflow = {
  runs: Record<string, WorkflowSnapshot>;
};

export type WorkflowLibrary = Record<string, SavedWorkflow>;

/** Handle id of a workflow node's source dot for a named output. */
export function workflowOutputHandle(name: string): string {
  return `out-${name}`;
}

/**
 * The snapshot a workflow node runs: the most recently saved run of that
 * workflow. Runs are just save points, so a workflow node tracks the workflow
 * and always resolves to its latest state rather than pinning one run.
 */
export function resolveWorkflowSnapshot(
  library: WorkflowLibrary,
  workflowName: string,
): WorkflowSnapshot | undefined {
  const runs = library[workflowName]?.runs;
  const snapshots = runs ? Object.values(runs) : [];
  if (!snapshots.length) {
    return undefined;
  }
  return snapshots.reduce((latest, snapshot) => (snapshot.updatedAt > latest.updatedAt ? snapshot : latest));
}

export function interpolate(prompt: string, inputs: FlexibleInput[]): string {
  return inputs.reduce(
    (result, input) => result.split(`\${${input.name}}`).join(input.value),
    prompt,
  );
}

/** Fill `${name}` placeholders from a value map, leaving unknown ones untouched. */
export function interpolateText(template: string, values: Record<string, string>): string {
  return template.replace(/\$\{(\w+)\}/g, (whole, name: string) => (name in values ? values[name] : whole));
}

// Longest-first so `>=` is found before `>`, `<=` before `<`.
const COMPARATORS = ['==', '!=', '>=', '<=', '>', '<'] as const;

function applyComparator(left: number | string, right: number | string, op: string): boolean {
  switch (op) {
    case '==':
      return left === right;
    case '!=':
      return left !== right;
    case '>':
      return left > right;
    case '<':
      return left < right;
    case '>=':
      return left >= right;
    case '<=':
      return left <= right;
    default:
      return false;
  }
}

/**
 * Evaluate a condition like `${input1} == 5`, `${input1} > 5`, or
 * `${input1} == "fail"`. A quoted right side is a string match; an unquoted
 * one is coerced to a number before comparing.
 */
export function evaluateCondition(
  condition: string,
  values: Record<string, string>,
): { result: boolean; error: string | null } {
  const text = condition.trim();
  if (!text) {
    return { result: false, error: 'Condition is empty' };
  }

  let op = '';
  let at = -1;
  for (const candidate of COMPARATORS) {
    const found = text.indexOf(candidate);
    if (found !== -1) {
      op = candidate;
      at = found;
      break;
    }
  }
  if (at === -1) {
    return { result: false, error: 'Condition needs a comparator: ==, !=, >, <, >=, <=' };
  }

  const left = interpolateText(text.slice(0, at), values).trim();
  const rightRaw = interpolateText(text.slice(at + op.length), values).trim();

  const quoted =
    rightRaw.length >= 2 &&
    ((rightRaw.startsWith('"') && rightRaw.endsWith('"')) ||
      (rightRaw.startsWith("'") && rightRaw.endsWith("'")));

  if (quoted) {
    return { result: applyComparator(left, rightRaw.slice(1, -1), op), error: null };
  }

  const leftNum = Number(left);
  const rightNum = Number(rightRaw);
  if (Number.isNaN(leftNum) || Number.isNaN(rightNum)) {
    return {
      result: false,
      error: `Cannot compare "${left}" ${op} ${rightRaw} as numbers. Quote the value for a text match.`,
    };
  }
  return { result: applyComparator(leftNum, rightNum, op), error: null };
}

/**
 * Split `input` by `delimiter` into exactly `count` outputs. `\n`, `\t`, `\r` in
 * the delimiter are treated as the real characters so they can be typed into a
 * single-line field. Any parts beyond `count` are joined back onto the last
 * output so nothing is dropped; missing parts come out empty.
 */
export function splitInto(input: string, delimiter: string, count: number): string[] {
  const slots = Math.min(20, Math.max(1, Math.round(count) || 1));
  const sep = delimiter.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r');
  const parts = sep ? input.split(sep) : [input];
  const outputs: string[] = [];
  for (let index = 0; index < slots; index += 1) {
    if (index === slots - 1 && parts.length > slots) {
      outputs.push(parts.slice(index).join(sep).trim());
    } else {
      outputs.push((parts[index] ?? '').trim());
    }
  }
  return outputs;
}

function valueToString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value === null || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

export function extractJsonPath(input: string, path: string): { output: string; error: string | null } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Invalid JSON';
    return { output: '', error: `Invalid JSON: ${message}` };
  }

  const parts = path.split('.').map((part) => part.trim()).filter(Boolean);
  if (!parts.length) {
    return { output: '', error: 'Key path is required' };
  }

  let current = parsed;
  for (const part of parts) {
    if (current === null || typeof current !== 'object' || !(part in current)) {
      return { output: '', error: `Key not found: ${parts.join('.')}` };
    }
    current = (current as Record<string, unknown>)[part];
  }

  return { output: valueToString(current), error: null };
}

function messageFromError(caught: unknown, fallback: string): string {
  return caught instanceof Error && caught.message ? caught.message : fallback;
}

function formatArray(values: string[]): string {
  return JSON.stringify(values, null, 2);
}

function parseLoopItems(input: string): { items: string[]; error: string | null } {
  const text = input.trim();
  if (!text) {
    return { items: [], error: 'Items are empty' };
  }

  if (text.startsWith('[') || text.startsWith('{')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (caught) {
      return { items: [], error: `Invalid items JSON: ${messageFromError(caught, 'Invalid JSON')}` };
    }
    if (!Array.isArray(parsed)) {
      return { items: [], error: 'Items must be a JSON array or line-separated text' };
    }
    return { items: parsed.map(valueToString), error: null };
  }

  const lines = input
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
  return { items: lines.length ? lines : [input], error: null };
}

function pickNamedOutput(outputs: Record<string, string>, preferredName: string): string {
  if (preferredName && preferredName in outputs) {
    return outputs[preferredName] ?? '';
  }
  if ('result' in outputs) {
    return outputs.result ?? '';
  }
  return Object.values(outputs)[0] ?? '';
}

function sortedWorkflowInputs(snapshot: WorkflowSnapshot): InputNodeState[] {
  return snapshot.nodes
    .filter((node): node is InputNodeState => node.kind === 'input')
    .sort((a, b) => a.order - b.order);
}

function sortedWorkflowOutputs(snapshot: WorkflowSnapshot): OutputNodeState[] {
  return snapshot.nodes
    .filter((node): node is OutputNodeState => node.kind === 'output')
    .sort((a, b) => a.order - b.order);
}

export function edgeInputHandle(edge: Edge): string | null {
  const handle = edge.data?.targetHandleId;
  return typeof handle === 'string' ? handle : edge.targetHandle ?? null;
}

export function edgeOutputHandle(edge: Edge): string {
  const handle = edge.data?.sourceHandleId;
  return typeof handle === 'string' ? handle : edge.sourceHandle ?? 'output';
}

/**
 * Older snapshots kept handle ids only in `edge.data`, which React Flow cannot
 * anchor to, so links were drawn by a separate overlay. Lift the ids into the
 * top-level fields so React Flow attaches each edge to the right handle dot,
 * and drop `animated` so the curve renders solid.
 */
export function normalizeEdges(edges: Edge[]): Edge[] {
  return edges.map(({ animated: _animated, ...edge }) => ({
    ...edge,
    sourceHandle: edgeOutputHandle(edge),
    targetHandle: edgeInputHandle(edge),
  }));
}

/** The value a node exposes on one of its source handles. */
export function outputOf(node: WorkflowNodeState | undefined, handle?: string): string {
  if (!node) {
    return '';
  }
  switch (node.kind) {
    case 'agent':
    case 'json':
      return node.output;
    case 'if':
      // The If node has two outputs; only the fired branch carries a value.
      return handle === 'output2' ? node.output2 : node.output1;
    case 'split': {
      // Handles are output1..outputN; map back to the split part.
      const index = handle ? Number(handle.replace('output', '')) - 1 : 0;
      return node.outputs[index] ?? '';
    }
    case 'input':
    case 'output':
      return node.value;
    case 'workflow': {
      // Handles are out-<name>; default to the first output.
      const name = handle?.startsWith('out-') ? handle.slice(4) : null;
      const found = name ? node.outputs.find((output) => output.name === name) : node.outputs[0];
      return found?.value ?? '';
    }
    case 'forEach':
      return node.output;
    case 'text':
      return node.hasOutput ? node.text : '';
  }
}

/** Pull values from a node's incoming links into its input fields. */
export function hydrateNode(
  node: WorkflowNodeState,
  edges: Edge[],
  byId: Map<string, WorkflowNodeState>,
): WorkflowNodeState {
  const incoming = edges.filter((edge) => edge.target === node.id);
  const valueOf = (edge: Edge) => outputOf(byId.get(edge.source), edgeOutputHandle(edge));

  switch (node.kind) {
    case 'text': {
      if (!node.hasInput) {
        return node;
      }
      const link = incoming[0];
      return { ...node, text: link ? valueOf(link) : '' };
    }
    case 'json': {
      const link = incoming[0];
      return link ? { ...node, input: valueOf(link) } : node;
    }
    case 'split': {
      const inputLink = incoming.find((edge) => edgeInputHandle(edge) === 'input');
      const countLink = incoming.find((edge) => edgeInputHandle(edge) === 'count');
      let nextCount = node.count;
      if (countLink) {
        const parsed = Math.round(Number(valueOf(countLink)));
        if (Number.isFinite(parsed)) {
          nextCount = Math.min(20, Math.max(1, parsed));
        }
      }
      return {
        ...node,
        input: inputLink ? valueOf(inputLink) : node.input,
        count: nextCount,
      };
    }
    case 'if': {
      const link1 = incoming.find((edge) => edgeInputHandle(edge) === 'input1');
      const link2 = incoming.find((edge) => edgeInputHandle(edge) === 'input2');
      return {
        ...node,
        input1: link1 ? valueOf(link1) : node.input1,
        input2: link2 ? valueOf(link2) : node.input2,
      };
    }
    case 'agent':
    case 'workflow': {
      return {
        ...node,
        inputs: node.inputs.map((input) => {
          const link = incoming.find((edge) => edgeInputHandle(edge) === input.id);
          return link ? { ...input, value: valueOf(link) } : input;
        }),
      };
    }
    case 'forEach': {
      const itemsLink = incoming.find((edge) => edgeInputHandle(edge) === 'items');
      return {
        ...node,
        items: itemsLink ? valueOf(itemsLink) : node.items,
      };
    }
    case 'output': {
      const link = incoming.find((edge) => edgeInputHandle(edge) === 'input') ?? incoming[0];
      return link ? { ...node, value: valueOf(link) } : node;
    }
    case 'input':
      return node;
  }
}

export type StepContext = {
  library: WorkflowLibrary;
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
  /** Workflow/run keys currently executing, to refuse self-reference. */
  stack?: string[];
};

export type StepResult = {
  patch: Record<string, unknown>;
  error: string | null;
  note: string;
};

/**
 * Execute one already-hydrated node and return the state patch to apply.
 * `error` is set (with any partial patch) when the node failed.
 */
export async function stepNode(node: WorkflowNodeState, ctx: StepContext): Promise<StepResult> {
  switch (node.kind) {
    case 'text':
      return { patch: {}, error: null, note: `${node.name} passed text through` };
    case 'input':
      return { patch: {}, error: null, note: `${node.name} provided its value` };
    case 'output':
      return { patch: {}, error: null, note: `${node.name} captured the workflow output` };
    case 'json': {
      const result = extractJsonPath(node.input, node.path);
      return { patch: { ...result }, error: result.error, note: `${node.name} extracted ${node.path}` };
    }
    case 'split': {
      const outputs = splitInto(node.input, node.delimiter, node.count);
      const filled = outputs.filter((part) => part).length;
      return { patch: { outputs }, error: null, note: `${node.name} split into ${node.count} (${filled} filled)` };
    }
    case 'forEach': {
      const parsed = parseLoopItems(node.items);
      if (parsed.error) {
        return { patch: { status: parsed.error }, error: parsed.error, note: '' };
      }

      if (!node.workflowName) {
        const error = 'Pick a saved workflow first';
        return { patch: { status: error }, error, note: '' };
      }

      const snapshot = resolveWorkflowSnapshot(ctx.library, node.workflowName);
      if (!snapshot) {
        const error = `Saved workflow not found: ${node.workflowName}`;
        return { patch: { status: error }, error, note: '' };
      }

      const stack = ctx.stack ?? [];
      if (stack.includes(node.workflowName)) {
        const error = `${node.workflowName} calls itself`;
        return { patch: { status: error }, error, note: '' };
      }

      const bodyInput = sortedWorkflowInputs(snapshot)[0];
      if (!bodyInput) {
        const error = `${node.workflowName} needs one Workflow input`;
        return { patch: { status: error }, error, note: '' };
      }

      const bodyOutput = sortedWorkflowOutputs(snapshot)[0];
      const results: string[] = [];

      for (let index = 0; index < parsed.items.length; index += 1) {
        if (ctx.signal?.aborted) {
          throw new Error('Workflow aborted');
        }

        ctx.onProgress?.(`${node.name} - item ${index + 1}/${parsed.items.length}`);
        try {
          const outputs = await executeWorkflow({
            nodes: snapshot.nodes,
            edges: normalizeEdges(snapshot.edges),
            inputValues: { [bodyInput.name]: parsed.items[index] },
            library: ctx.library,
            signal: ctx.signal,
            onProgress: ctx.onProgress,
            stack: [...stack, node.workflowName],
          });
          results.push(pickNamedOutput(outputs, bodyOutput?.name ?? ''));
        } catch (caught) {
          if (ctx.signal?.aborted) {
            throw caught;
          }
          const message = `Item ${index + 1}: ${messageFromError(caught, 'Iteration failed')}`;
          return {
            patch: {
              output: formatArray(results),
              iterations: index,
              status: message,
            },
            error: message,
            note: '',
          };
        }
      }

      const output = formatArray(results);
      const status = `Ran ${parsed.items.length} item(s)`;
      return {
        patch: {
          output,
          iterations: parsed.items.length,
          status,
        },
        error: null,
        note: `${node.name} ${status}`,
      };
    }
    case 'if': {
      const values = { input1: node.input1, input2: node.input2 };
      const { result, error } = evaluateCondition(node.condition, values);
      if (error) {
        return { patch: { status: error }, error, note: '' };
      }
      let output1 = '';
      let output2 = '';
      let status = '';
      if (result) {
        output1 = node.input2;
        status = 'Condition true → output 1 (success)';
      } else {
        output2 = interpolateText(node.prompt, values);
        status = 'Condition false → output 2 (retry)';
      }
      return { patch: { output1, output2, status }, error: null, note: `${node.name} — ${status}` };
    }
    case 'agent': {
      const output = await runFlexibleLlm(interpolate(node.prompt, node.inputs), node.model, ctx.signal);
      return { patch: { output }, error: null, note: `${node.name} finished` };
    }
    case 'workflow': {
      if (!node.workflowName) {
        const error = 'Pick a saved workflow first';
        return { patch: { status: error }, error, note: '' };
      }
      const key = node.workflowName;
      const snapshot = resolveWorkflowSnapshot(ctx.library, key);
      if (!snapshot) {
        const error = `Saved workflow not found: ${key}`;
        return { patch: { status: error }, error, note: '' };
      }
      const stack = ctx.stack ?? [];
      if (stack.includes(key)) {
        const error = `${key} calls itself`;
        return { patch: { status: error }, error, note: '' };
      }
      const results = await executeWorkflow({
        nodes: snapshot.nodes,
        edges: normalizeEdges(snapshot.edges),
        inputValues: Object.fromEntries(node.inputs.map((input) => [input.name, input.value])),
        library: ctx.library,
        signal: ctx.signal,
        onProgress: ctx.onProgress,
        stack: [...stack, key],
      });
      const outputs = node.outputs.map((output) => ({ ...output, value: results[output.name] ?? '' }));
      // Surface outputs the saved workflow gained since this node last synced.
      for (const name of Object.keys(results)) {
        if (!outputs.some((output) => output.name === name)) {
          outputs.push({ name, value: results[name] });
        }
      }
      return { patch: { outputs, status: `Ran ${key}` }, error: null, note: `${node.name} ran ${key}` };
    }
  }
}

/**
 * Run a whole workflow start to finish and return its named outputs.
 *
 * Nodes execute strictly one after another in `order`; Input nodes are
 * overridden by `inputValues` where names match, and each Output node's
 * captured value lands in the result map under its name.
 */
export async function executeWorkflow(args: {
  nodes: WorkflowNodeState[];
  edges: Edge[];
  inputValues: Record<string, string>;
  library: WorkflowLibrary;
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
  stack?: string[];
}): Promise<Record<string, string>> {
  const { nodes, edges, inputValues, library, signal, onProgress, stack = [] } = args;
  if (stack.length > 8) {
    throw new Error('Workflows are nested too deeply');
  }

  const byId = new Map<string, WorkflowNodeState>(
    nodes.map((node) => [node.id, JSON.parse(JSON.stringify(node)) as WorkflowNodeState]),
  );
  for (const node of byId.values()) {
    if (node.kind === 'input' && node.name in inputValues) {
      node.value = inputValues[node.name];
    }
  }

  const label = stack[stack.length - 1] ?? 'workflow';
  const ordered = [...byId.values()].sort((a, b) => a.order - b.order);
  const results: Record<string, string> = {};

  for (const node of ordered) {
    if (signal?.aborted) {
      throw new Error('Workflow aborted');
    }
    const hydrated = hydrateNode(node, edges, byId);
    byId.set(node.id, hydrated);
    onProgress?.(`${label} — step ${hydrated.order}: ${hydrated.name}`);
    const result = await stepNode(hydrated, { library, signal, onProgress, stack });
    if (result.error) {
      throw new Error(`${hydrated.name}: ${result.error}`);
    }
    const finished = { ...hydrated, ...result.patch } as WorkflowNodeState;
    byId.set(finished.id, finished);
    if (finished.kind === 'output') {
      results[finished.name] = finished.value;
    }
  }

  return results;
}
