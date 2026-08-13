/**
 * Pure workflow engine: node state types, value plumbing, and execution.
 *
 * Everything here is UI-free so a saved workflow runs the same way whether it
 * sits on the canvas or is embedded as a workflow node inside another
 * workflow. Execution is strictly sequential: nodes run one at a time in
 * `order`, and a node never starts until the one before it has finished.
 */

import type { Edge } from '@xyflow/react';
import { generateComfyImage, generateComfyVideo, runFlexibleImageLlm, runFlexibleLlm } from '../api';
import { DEFAULT_ASPECT_RATIO, DEFAULT_THINKING_LEVEL, DEFAULT_VISION_MODEL, VISION_MODEL_NAMES } from '../constants';
import type { AspectRatio } from '../constants';
import type { ThinkingLevel } from '../api';
import type { FlexibleInput } from '../nodes';

export type AgentNodeState = {
  id: string;
  kind: 'agent';
  name: string;
  order: number;
  prompt: string;
  model: string;
  thinking: ThinkingLevel;
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

export type ImageUploadNodeState = {
  id: string;
  kind: 'imageUpload';
  name: string;
  order: number;
  outputUrl: string;
  outputName: string;
  status: string;
  position: { x: number; y: number };
};

export type ImageDisplayNodeState = {
  id: string;
  kind: 'imageDisplay';
  name: string;
  order: number;
  imageUrl: string;
  position: { x: number; y: number };
};

export type ImageGenerateNodeState = {
  id: string;
  kind: 'imageGenerate' | 'imageGenerateIdentity' | 'imageGenerateTextToImage';
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
  position: { x: number; y: number };
};

export type VideoGenerateNodeState = {
  id: string;
  kind: 'videoGenerateRef2VA' | 'videoGenerateFL2V';
  name: string;
  order: number;
  prompt: string;
  inputs: FlexibleInput[];
  image1: string;
  image2: string;
  aspectRatio: AspectRatio;
  durationSeconds: number;
  seed: string;
  steps: number;
  outputUrl: string;
  outputName: string;
  status: string;
  position: { x: number; y: number };
};

export type ImageTextNodeState = {
  id: string;
  kind: 'imageText';
  name: string;
  order: number;
  prompt: string;
  model: string;
  imageUrl: string;
  inputs: FlexibleInput[];
  output: string;
  status: string;
  position: { x: number; y: number };
};

export type LoopRetryMode = 'result' | 'input';

/** Runs a saved workflow per item, optionally retrying from a scored result. */
export type ForEachNodeState = {
  id: string;
  kind: 'forEach';
  name: string;
  order: number;
  items: string;
  workflowName: string;
  output: string;
  threshold: number;
  maxAttempts: number;
  retryWith: LoopRetryMode;
  score: string;
  note: string;
  iterations: number;
  attempts: number;
  trace: string;
  status: string;
  position: { x: number; y: number };
};

export type WorkflowNodeState =
  | AgentNodeState
  | TextNodeState
  | JsonNodeState
  | ImageUploadNodeState
  | ImageDisplayNodeState
  | ImageGenerateNodeState
  | VideoGenerateNodeState
  | ImageTextNodeState
  | IfNodeState
  | SplitNodeState
  | InputNodeState
  | OutputNodeState
  | WorkflowRefNodeState
  | ForEachNodeState;

export type NodeKind = WorkflowNodeState['kind'];

export type ModelCallLog = {
  model: string;
  prompt: string;
  response: string;
};

export type WorkflowLogEntry = {
  nodeName: string;
  model: string | null;
  inputs: Record<string, string>;
  calls: ModelCallLog[];
  outputs: Record<string, string>;
  error: string | null;
};

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

  if (!left || !rightRaw) {
    return { result: false, error: `Cannot compare an empty value: "${left}" ${op} ${rightRaw}` };
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

function logRecord(values: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, valueToString(value)]));
}

function inputValues(inputs: FlexibleInput[]): Record<string, string> {
  return Object.fromEntries(inputs.map((input) => [input.name, input.value]));
}

function nodeInputs(node: WorkflowNodeState): Record<string, string> {
  switch (node.kind) {
    case 'agent':
      return inputValues(node.inputs);
    case 'imageGenerate':
    case 'imageGenerateIdentity':
    case 'imageGenerateTextToImage':
      return {
        ...inputValues(node.inputs),
        referenceImage: node.referenceImage,
        aspectRatio: node.aspectRatio ?? DEFAULT_ASPECT_RATIO,
      };
    case 'videoGenerateRef2VA':
    case 'videoGenerateFL2V':
      return logRecord({
        ...inputValues(node.inputs),
        image1: node.image1,
        image2: node.image2,
        aspectRatio: node.aspectRatio ?? DEFAULT_ASPECT_RATIO,
        durationSeconds: node.durationSeconds,
      });
    case 'imageText':
      return { ...inputValues(node.inputs), imageUrl: node.imageUrl };
    case 'json':
      return logRecord({ input: node.input, path: node.path });
    case 'if':
      return logRecord({ input1: node.input1, input2: node.input2, condition: node.condition });
    case 'split':
      return logRecord({ input: node.input, delimiter: node.delimiter, count: node.count });
    case 'imageUpload':
      return logRecord({ outputUrl: node.outputUrl, outputName: node.outputName });
    case 'imageDisplay':
      return logRecord({ imageUrl: node.imageUrl });
    case 'workflow':
      return { ...inputValues(node.inputs), workflowName: node.workflowName };
    case 'forEach':
      return logRecord({
        items: node.items,
        workflowName: node.workflowName,
        threshold: node.threshold,
        maxAttempts: node.maxAttempts,
        retryWith: node.retryWith,
      });
    case 'text':
      return logRecord({ text: node.text });
    case 'input':
      return logRecord({ value: node.value });
    case 'output':
      return logRecord({ value: node.value });
  }
}

function nodeOutputs(node: WorkflowNodeState): Record<string, string> {
  switch (node.kind) {
    case 'agent':
    case 'imageText':
      return { output: node.output };
    case 'imageGenerate':
    case 'imageGenerateIdentity':
    case 'imageGenerateTextToImage':
      return logRecord({
        outputUrl: node.outputUrl,
        outputName: node.outputName,
        seed: node.seed,
        steps: node.steps,
        strength: node.strength,
        aspectRatio: node.aspectRatio ?? DEFAULT_ASPECT_RATIO,
        status: node.status,
      });
    case 'videoGenerateRef2VA':
    case 'videoGenerateFL2V':
      return logRecord({
        outputUrl: node.outputUrl,
        outputName: node.outputName,
        seed: node.seed,
        steps: node.steps,
        aspectRatio: node.aspectRatio ?? DEFAULT_ASPECT_RATIO,
        durationSeconds: node.durationSeconds,
        status: node.status,
      });
    case 'imageUpload':
      return logRecord({ outputUrl: node.outputUrl, outputName: node.outputName, status: node.status });
    case 'imageDisplay':
      return logRecord({ imageUrl: node.imageUrl });
    case 'json':
      return logRecord({ output: node.output, error: node.error });
    case 'if':
      return logRecord({ output1: node.output1, output2: node.output2, status: node.status });
    case 'split':
      return logRecord({ outputs: node.outputs });
    case 'workflow':
      return {
        ...Object.fromEntries(node.outputs.map((output) => [output.name, output.value])),
        status: node.status,
      };
    case 'forEach':
      return logRecord({
        output: node.output,
        score: node.score,
        note: node.note,
        trace: node.trace,
        iterations: node.iterations,
        attempts: node.attempts,
        status: node.status,
      });
    case 'text':
      return logRecord({ text: node.text });
    case 'input':
      return logRecord({ value: node.value });
    case 'output':
      return logRecord({ value: node.value });
  }
}

function configuredModel(node: WorkflowNodeState): string | null {
  switch (node.kind) {
    case 'agent':
    case 'imageText':
      return node.model;
    case 'imageGenerate':
    case 'imageGenerateIdentity':
    case 'imageGenerateTextToImage':
      return 'ComfyUI';
    case 'videoGenerateRef2VA':
    case 'videoGenerateFL2V':
      return 'ComfyUI';
    default:
      return null;
  }
}

export function createWorkflowLogEntry(
  node: WorkflowNodeState,
  finishedNode: WorkflowNodeState,
  calls: ModelCallLog[],
  error: string | null,
): WorkflowLogEntry {
  return {
    nodeName: node.name,
    model: calls[0]?.model ?? configuredModel(node),
    inputs: nodeInputs(node),
    calls,
    outputs: nodeOutputs(finishedNode),
    error,
  };
}

function appendLogRecord(lines: string[], label: string, values: Record<string, string>): void {
  lines.push(`${label}:`);
  if (!Object.keys(values).length) {
    lines.push('  (none)');
    return;
  }
  for (const [key, value] of Object.entries(values)) {
    const valueLines = value.split(/\r?\n/g);
    lines.push(`  ${key}: ${valueLines[0] ?? ''}`);
    lines.push(...valueLines.slice(1).map((line) => `    ${line}`));
  }
}

function appendLogText(lines: string[], label: string, value: string): void {
  const valueLines = value ? value.split(/\r?\n/g) : ['(none)'];
  lines.push(`${label}:`, ...valueLines);
}

export function formatWorkflowLog(entries: WorkflowLogEntry[], workflowName: string, runName: string): string {
  const lines = [
    'WORKFLOW EXECUTION LOG',
    `WORKFLOW: ${workflowName || '(unnamed)'}`,
    `RUN: ${runName || '(unnamed)'}`,
    `CREATED: ${new Date().toISOString()}`,
  ];

  entries.forEach((entry, index) => {
    lines.push('', '='.repeat(88), `NODE ${index + 1}: ${entry.nodeName}`, `MODEL: ${entry.model ?? 'none'}`);
    appendLogRecord(lines, 'INPUTS', entry.inputs);
    if (!entry.calls.length) {
      appendLogText(lines, 'PROMPT', '');
      appendLogText(lines, 'RESPONSE', '');
    } else {
      entry.calls.forEach((call, callIndex) => {
        lines.push(`MODEL CALL ${callIndex + 1}: ${call.model}`);
        appendLogText(lines, `PROMPT ${callIndex + 1}`, call.prompt);
        appendLogText(lines, `RESPONSE ${callIndex + 1}`, call.response);
      });
    }
    appendLogRecord(lines, 'OUTPUTS', entry.outputs);
    if (entry.error) {
      appendLogText(lines, 'ERROR', entry.error);
    }
  });

  lines.push('', '='.repeat(88), `NODES LOGGED: ${entries.length}`, '');
  return `${lines.join('\n')}\n`;
}

type LoopItem = {
  value: string;
  values: Record<string, string> | null;
};

function loopItemFromValue(value: unknown): LoopItem {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return {
      value: valueToString(value),
      values: Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [key, valueToString(entry)]),
      ),
    };
  }
  return { value: valueToString(value), values: null };
}

function jsonCandidateAt(text: string, start: number): string | null {
  const opening = text[start];
  if (opening !== '{' && opening !== '[') {
    return null;
  }

  const closing = opening === '{' ? '}' : ']';
  const stack = [closing];
  let inString = false;
  let escaped = false;

  for (let index = start + 1; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === '{') {
      stack.push('}');
      continue;
    }
    if (character === '[') {
      stack.push(']');
      continue;
    }
    if (character === '}' || character === ']') {
      if (stack.pop() !== character) {
        return null;
      }
      if (!stack.length) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}

function parseJsonInput(input: string): { value: unknown; error: string | null } {
  const text = input.replace(/^\uFEFF/, '').trim();
  const candidates: string[] = [];
  const seen = new Set<string>();
  const addCandidate = (candidate: string | null | undefined) => {
    const trimmed = candidate?.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      candidates.push(trimmed);
    }
  };

  addCandidate(text);
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  addCandidate(fenced?.[1]);
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '{' || text[index] === '[') {
      addCandidate(jsonCandidateAt(text, index));
    }
  }

  let lastError = 'Invalid JSON';
  for (const candidate of candidates) {
    try {
      return { value: JSON.parse(candidate) as unknown, error: null };
    } catch (caught) {
      lastError = caught instanceof Error ? caught.message : lastError;
    }
  }

  return { value: null, error: `Invalid JSON: ${lastError}` };
}

export function extractJsonPath(input: string, path: string): { output: string; error: string | null } {
  const parsedResult = parseJsonInput(input);
  if (parsedResult.error) {
    return { output: '', error: parsedResult.error };
  }

  const parts = path.split('.').map((part) => part.trim()).filter(Boolean);
  if (!parts.length) {
    return { output: '', error: 'Key path is required' };
  }

  let current = parsedResult.value;
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

function visionModelOrDefault(model: string): string {
  return VISION_MODEL_NAMES.some((name) => name === model) ? model : DEFAULT_VISION_MODEL;
}

function parseLoopItems(input: string): { items: LoopItem[]; error: string | null } {
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
    if (Array.isArray(parsed)) {
      return { items: parsed.map(loopItemFromValue), error: null };
    }
    if (parsed !== null && typeof parsed === 'object') {
      return { items: [loopItemFromValue(parsed)], error: null };
    }
    return { items: [], error: 'Items must be a JSON array/object or line-separated text' };
  }

  const lines = input
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
  return {
    items: (lines.length ? lines : [input]).map((line) => ({ value: line, values: null })),
    error: null,
  };
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

function namedWorkflowOutput(outputs: Record<string, string>, name: string): string {
  return outputs[name] ?? '';
}

function parseLoopScore(value: string): { score: number | null; error: string | null } {
  const text = value.trim();
  if (!text) {
    return { score: null, error: null };
  }

  const direct = Number(text);
  if (Number.isFinite(direct)) {
    return { score: Math.min(100, Math.max(0, direct)), error: null };
  }

  const match = text.match(/\bscore\s*[:=]\s*(\d{1,3})(?:\s*\/\s*100)?\b/i);
  if (!match) {
    return { score: null, error: `Loop score is not numeric: ${text}` };
  }
  return { score: Math.min(100, Math.max(0, Number(match[1]))), error: null };
}

function formatLoopValues(values: string[]): string {
  return values.length === 1 ? values[0] ?? '' : formatArray(values);
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
    case 'imageText':
    case 'json':
      return node.output;
    case 'imageUpload':
    case 'imageGenerate':
    case 'imageGenerateIdentity':
    case 'imageGenerateTextToImage':
      return node.outputUrl;
    case 'videoGenerateRef2VA':
    case 'videoGenerateFL2V':
      return node.outputUrl;
    case 'imageDisplay':
      return '';
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
      if (handle === 'score') {
        return node.score;
      }
      if (handle === 'note') {
        return node.note;
      }
      if (handle === 'attempts') {
        return String(node.attempts);
      }
      if (handle === 'trace') {
        return node.trace;
      }
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
    case 'imageUpload':
      return node;
    case 'imageDisplay': {
      const link = incoming.find((edge) => edgeInputHandle(edge) === 'image') ?? incoming[0];
      return link ? { ...node, imageUrl: valueOf(link) } : node;
    }
    case 'imageGenerate':
    case 'imageGenerateIdentity':
    case 'imageGenerateTextToImage': {
      const inputs = node.inputs?.length ? node.inputs : [{ id: 'input1', name: 'input1', value: '' }];
      const referenceLink = incoming.find((edge) => edgeInputHandle(edge) === 'reference');
      return {
        ...node,
        inputs: inputs.map((input) => {
          const link = incoming.find((edge) => edgeInputHandle(edge) === input.id);
          return link ? { ...input, value: valueOf(link) } : input;
        }),
        referenceImage: referenceLink ? valueOf(referenceLink) : node.referenceImage,
      };
    }
    case 'videoGenerateRef2VA':
    case 'videoGenerateFL2V': {
      const inputs = node.inputs?.length ? node.inputs : [{ id: 'input1', name: 'input1', value: '' }];
      const image1Link = incoming.find((edge) => edgeInputHandle(edge) === 'image1');
      const image2Link = incoming.find((edge) => edgeInputHandle(edge) === 'image2');
      return {
        ...node,
        inputs: inputs.map((input) => {
          const link = incoming.find((edge) => edgeInputHandle(edge) === input.id);
          return link ? { ...input, value: valueOf(link) } : input;
        }),
        image1: image1Link ? valueOf(image1Link) : node.image1,
        image2: image2Link ? valueOf(image2Link) : node.image2,
      };
    }
    case 'imageText': {
      const inputs = node.inputs?.length ? node.inputs : [{ id: 'input1', name: 'input1', value: '' }];
      const imageLink = incoming.find((edge) => edgeInputHandle(edge) === 'image');
      return {
        ...node,
        imageUrl: imageLink ? valueOf(imageLink) : node.imageUrl,
        inputs: inputs.map((input) => {
          const link = incoming.find((edge) => edgeInputHandle(edge) === input.id);
          return link ? { ...input, value: valueOf(link) } : input;
        }),
      };
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
  onLog?: (entry: WorkflowLogEntry) => void;
  onModelCall?: (call: ModelCallLog) => void;
  /** Workflow/run keys currently executing, to refuse self-reference. */
  stack?: string[];
};

export type StepResult = {
  patch: Record<string, unknown>;
  error: string | null;
  note: string;
};

async function runLoggedLlm(
  ctx: StepContext,
  prompt: string,
  model: string,
  thinking: ThinkingLevel,
): Promise<string> {
  try {
    const response = await runFlexibleLlm(prompt, model, ctx.signal, thinking);
    ctx.onModelCall?.({ model, prompt, response });
    return response;
  } catch (caught) {
    ctx.onModelCall?.({ model, prompt, response: `ERROR: ${messageFromError(caught, 'Model call failed')}` });
    throw caught;
  }
}

async function runLoggedImageLlm(
  ctx: StepContext,
  prompt: string,
  imageUrl: string,
  model: string,
): Promise<string> {
  try {
    const response = await runFlexibleImageLlm(prompt, imageUrl, model, ctx.signal);
    ctx.onModelCall?.({ model, prompt, response });
    return response;
  } catch (caught) {
    ctx.onModelCall?.({ model, prompt, response: `ERROR: ${messageFromError(caught, 'Model call failed')}` });
    throw caught;
  }
}

async function runLoggedImageGeneration(
  ctx: StepContext,
  request: Parameters<typeof generateComfyImage>[0],
): Promise<Awaited<ReturnType<typeof generateComfyImage>>> {
  try {
    const response = await generateComfyImage(request, ctx.signal);
    ctx.onModelCall?.({ model: 'ComfyUI', prompt: request.prompt, response: JSON.stringify(response) });
    return response;
  } catch (caught) {
    ctx.onModelCall?.({ model: 'ComfyUI', prompt: request.prompt, response: `ERROR: ${messageFromError(caught, 'Image generation failed')}` });
    throw caught;
  }
}

async function runLoggedVideoGeneration(
  ctx: StepContext,
  request: Parameters<typeof generateComfyVideo>[0],
): Promise<Awaited<ReturnType<typeof generateComfyVideo>>> {
  try {
    const response = await generateComfyVideo(request, ctx.signal);
    ctx.onModelCall?.({ model: 'ComfyUI', prompt: request.prompt, response: JSON.stringify(response) });
    return response;
  } catch (caught) {
    ctx.onModelCall?.({ model: 'ComfyUI', prompt: request.prompt, response: `ERROR: ${messageFromError(caught, 'Video generation failed')}` });
    throw caught;
  }
}

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
    case 'imageUpload':
      return { patch: {}, error: null, note: `${node.name} provided its image URL` };
    case 'imageDisplay':
      return { patch: {}, error: null, note: `${node.name} displayed its image URL` };
    case 'imageGenerate':
    case 'imageGenerateIdentity':
    case 'imageGenerateTextToImage': {
      const prompt = interpolate(node.prompt, node.inputs?.length ? node.inputs : [{ id: 'input1', name: 'input1', value: '' }]);
      if (!prompt.trim()) {
        const error = 'Prompt is required';
        return { patch: { status: error }, error, note: '' };
      }
      if (node.kind !== 'imageGenerateTextToImage' && !node.referenceImage.trim()) {
        const error = 'Link an image URL';
        return { patch: { status: error }, error, note: '' };
      }

      let seed: number | null = null;
      const seedText = node.seed.trim();
      if (seedText) {
        seed = Math.trunc(Number(seedText));
        if (!Number.isFinite(seed)) {
          const error = 'Seed must be a number';
          return { patch: { status: error }, error, note: '' };
        }
      }

      const steps = Math.min(150, Math.max(1, Math.round(Number(node.steps) || 8)));
      const strengthValue = Number(node.strength);
      const strength = Number.isFinite(strengthValue) ? Math.min(2, Math.max(0, strengthValue)) : 1;
      const result = await runLoggedImageGeneration(ctx, {
        prompt,
        reference_image: node.referenceImage,
        workflow: node.kind === 'imageGenerateIdentity'
          ? 'identity'
          : node.kind === 'imageGenerateTextToImage'
            ? 'text_to_image'
            : 'style',
        aspect_ratio: node.aspectRatio ?? DEFAULT_ASPECT_RATIO,
        seed,
        steps,
        strength,
        timeout_seconds: 900,
      });
      return {
        patch: {
          outputUrl: result.url,
          outputName: result.filename,
          aspectRatio: result.aspect_ratio,
          seed: String(result.seed),
          steps,
          strength,
          status: `Generated ${result.filename}`,
        },
        error: null,
        note: `${node.name} generated ${result.filename}`,
      };
    }
    case 'videoGenerateRef2VA':
    case 'videoGenerateFL2V': {
      const prompt = interpolate(node.prompt, node.inputs?.length ? node.inputs : [{ id: 'input1', name: 'input1', value: '' }]);
      if (!prompt.trim()) {
        const error = 'Prompt is required';
        return { patch: { status: error }, error, note: '' };
      }
      if (!node.image1.trim() || !node.image2.trim()) {
        const error = 'Link both input images';
        return { patch: { status: error }, error, note: '' };
      }

      let seed: number | null = null;
      const seedText = node.seed.trim();
      if (seedText) {
        seed = Math.trunc(Number(seedText));
        if (!Number.isFinite(seed)) {
          const error = 'Seed must be a number';
          return { patch: { status: error }, error, note: '' };
        }
      }

      const durationSeconds = Math.min(60, Math.max(0.1, Number(node.durationSeconds) || 5));
      const steps = Math.min(150, Math.max(1, Math.round(Number(node.steps) || 25)));
      const result = await runLoggedVideoGeneration(ctx, {
        prompt,
        workflow: node.kind === 'videoGenerateFL2V' ? 'fl2v' : 'ref2va',
        ...(node.kind === 'videoGenerateFL2V'
          ? { first_frame: node.image1, last_frame: node.image2 }
          : { character_image: node.image1, background_image: node.image2 }),
        aspect_ratio: node.aspectRatio ?? DEFAULT_ASPECT_RATIO,
        duration_seconds: durationSeconds,
        seed,
        steps,
        timeout_seconds: 1800,
      });
      return {
        patch: {
          outputUrl: result.url,
          outputName: result.filename,
          aspectRatio: result.aspect_ratio,
          durationSeconds: result.duration_seconds,
          seed: String(result.seed),
          steps,
          status: `Generated ${result.filename}`,
        },
        error: null,
        note: `${node.name} generated ${result.filename}`,
      };
    }
    case 'imageText': {
      const prompt = interpolate(node.prompt, node.inputs?.length ? node.inputs : [{ id: 'input1', name: 'input1', value: '' }]);
      if (!prompt.trim()) {
        const error = 'Prompt is required';
        return { patch: { status: error }, error, note: '' };
      }
      if (!node.imageUrl.trim()) {
        const error = 'Link an image URL';
        return { patch: { status: error }, error, note: '' };
      }
      const model = visionModelOrDefault(node.model);
      const output = await runLoggedImageLlm(ctx, prompt, node.imageUrl, model);
      return {
        patch: { output, model, status: 'Finished' },
        error: null,
        note: `${node.name} finished`,
      };
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

      const bodyInputs = sortedWorkflowInputs(snapshot);
      const bodyInput = bodyInputs[0];
      if (!bodyInput) {
        const error = `${node.workflowName} needs at least one Workflow input`;
        return { patch: { status: error }, error, note: '' };
      }

      const bodyOutput = sortedWorkflowOutputs(snapshot)[0];
      const results: string[] = [];
      const scores: string[] = [];
      const notes: string[] = [];
      const trace: string[] = [];
      let totalAttempts = 0;
      let fallbackItems = 0;

      const thresholdValue = Number(node.threshold);
      const threshold = Number.isFinite(thresholdValue) ? Math.min(100, Math.max(0, thresholdValue)) : 95;
      const maxAttemptsValue = Number(node.maxAttempts);
      const maxAttempts = Number.isFinite(maxAttemptsValue)
        ? Math.min(10, Math.max(1, Math.round(maxAttemptsValue)))
        : 3;
      const retryWith = node.retryWith === 'input' ? 'input' : 'result';

      for (let index = 0; index < parsed.items.length; index += 1) {
        if (ctx.signal?.aborted) {
          throw new Error('Workflow aborted');
        }

        ctx.onProgress?.(`${node.name} - item ${index + 1}/${parsed.items.length}`);
        const item = parsed.items[index];
        const originalValues = item.values ? { ...item.values } : { [bodyInput.name]: item.value };
        const original = originalValues[bodyInput.name] ?? item.value;
        if (!(bodyInput.name in originalValues)) {
          originalValues[bodyInput.name] = original;
        }
        for (const input of bodyInputs) {
          if (input.name === 'original_story' || input.name === 'source_story') {
            const existing = originalValues[input.name];
            if (existing === undefined || !String(existing).trim()) {
              originalValues[input.name] = original;
            }
          }
        }
        let candidateValues = { ...originalValues };
        let resultValue = original;
        let scoreValue = '';
        let noteValue = '';
        let passed = false;
        let bestResult = original;
        let bestScore = '';
        let bestNote = '';
        let bestScoreNumber = -Infinity;
        let bestAttempt = 0;

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          if (ctx.signal?.aborted) {
            throw new Error('Workflow aborted');
          }

          totalAttempts += 1;
          ctx.onProgress?.(`${node.name} - item ${index + 1}, pass ${attempt}/${maxAttempts}`);
          let outputs: Record<string, string>;
          try {
            outputs = await executeWorkflow({
              nodes: snapshot.nodes,
              edges: normalizeEdges(snapshot.edges),
              inputValues: candidateValues,
              library: ctx.library,
              signal: ctx.signal,
              onProgress: ctx.onProgress,
              onLog: ctx.onLog,
              stack: [...stack, node.workflowName],
            });
          } catch (caught) {
            if (ctx.signal?.aborted) {
              throw caught;
            }
            const message = `Item ${index + 1}: ${messageFromError(caught, 'Iteration failed')}`;
            return {
              patch: {
                output: formatLoopValues(results),
                score: formatLoopValues(scores),
                note: formatLoopValues(notes),
                trace: trace.join('\n'),
                iterations: results.length,
                attempts: totalAttempts,
                status: message,
              },
              error: message,
              note: '',
            };
          }

          resultValue = pickNamedOutput(outputs, 'result') || pickNamedOutput(outputs, bodyOutput?.name ?? '');
          noteValue = namedWorkflowOutput(outputs, 'note') || namedWorkflowOutput(outputs, 'feedback');
          const rawScore = namedWorkflowOutput(outputs, 'score');
          if (!rawScore.trim()) {
            trace.push(`Item ${index + 1}, pass ${attempt}: no score`);
            passed = true;
            break;
          }

          const parsedScore = parseLoopScore(rawScore);
          if (parsedScore.error || parsedScore.score === null) {
            const message = `Item ${index + 1}: ${parsedScore.error ?? 'Loop score is empty'}`;
            return {
              patch: {
                output: formatLoopValues([...results, resultValue]),
                score: formatLoopValues([...scores, rawScore.trim()]),
                note: formatLoopValues([...notes, noteValue]),
                trace: trace.join('\n'),
                iterations: results.length,
                attempts: totalAttempts,
                status: message,
              },
              error: message,
              note: '',
            };
          }

          scoreValue = String(parsedScore.score);
          trace.push(`Item ${index + 1}, pass ${attempt}: ${scoreValue}/100${noteValue ? ` - ${noteValue}` : ''}`);
          if (parsedScore.score > bestScoreNumber) {
            bestResult = resultValue;
            bestScore = scoreValue;
            bestNote = noteValue;
            bestScoreNumber = parsedScore.score;
            bestAttempt = attempt;
          }
          if (parsedScore.score >= threshold) {
            passed = true;
            break;
          }

          if (attempt < maxAttempts) {
            candidateValues = retryWith === 'result' && resultValue.trim()
              ? { ...originalValues, [bodyInput.name]: resultValue }
              : { ...originalValues };
            trace.push(`Item ${index + 1}: retrying with ${retryWith === 'result' ? 'workflow result' : 'original input'}`);
          }
        }

        if (bestAttempt > 0) {
          resultValue = bestResult;
          scoreValue = bestScore;
          noteValue = bestNote;
        }
        results.push(resultValue);
        scores.push(scoreValue);
        notes.push(noteValue);
        if (!passed) {
          fallbackItems += 1;
          trace.push(`Item ${index + 1}: threshold ${threshold}/100 not reached; selected best pass ${bestAttempt} at ${scoreValue || 'no score'}/100`);
        }
      }

      const output = formatLoopValues(results);
      const score = formatLoopValues(scores);
      const note = formatLoopValues(notes);
      const fallbackStatus = fallbackItems ? `; selected best score for ${fallbackItems} item(s)` : '';
      const status = `Ran ${parsed.items.length} item(s) in ${totalAttempts} pass(es)${fallbackStatus}`;
      return {
        patch: {
          output,
          score,
          note,
          trace: trace.join('\n'),
          iterations: parsed.items.length,
          attempts: totalAttempts,
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
      const output = await runLoggedLlm(
        ctx,
        interpolate(node.prompt, node.inputs),
        node.model,
        node.thinking ?? DEFAULT_THINKING_LEVEL,
      );
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
        onLog: ctx.onLog,
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

export type NodeExecution = {
  finished: WorkflowNodeState;
  result: StepResult;
};

export async function executeNode(node: WorkflowNodeState, ctx: StepContext): Promise<NodeExecution> {
  const calls: ModelCallLog[] = [];
  try {
    const result = await stepNode(node, {
      ...ctx,
      onModelCall: (call) => calls.push(call),
    });
    const finished = { ...node, ...result.patch } as WorkflowNodeState;
    ctx.onLog?.(createWorkflowLogEntry(node, finished, calls, result.error));
    return { finished, result };
  } catch (caught) {
    ctx.onLog?.(createWorkflowLogEntry(node, node, calls, messageFromError(caught, 'Node failed')));
    throw caught;
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
  onLog?: (entry: WorkflowLogEntry) => void;
  stack?: string[];
}): Promise<Record<string, string>> {
  const { nodes, edges, inputValues, library, signal, onProgress, onLog, stack = [] } = args;
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
    const execution = await executeNode(hydrated, { library, signal, onProgress, onLog, stack });
    if (execution.result.error) {
      throw new Error(`${hydrated.name}: ${execution.result.error}`);
    }
    const finished = execution.finished;
    byId.set(finished.id, finished);
    if (finished.kind === 'output') {
      results[finished.name] = finished.value;
    }
  }

  return results;
}
