import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { type Connection, type Edge, type EdgeChange, type Node, type NodeChange, type ReactFlowInstance } from '@xyflow/react';
import { Bot, Braces, GitBranch, PanelRightClose, PanelRightOpen, Play, Save, Scissors, Square, Trash2, Type } from 'lucide-react';
import { runFlexibleLlm } from './api';
import { WorkflowCanvas } from './components/WorkflowCanvas';
import { DEFAULT_MODEL } from './constants';
import { messageFrom } from './lib/errors';
import { useModels } from './hooks/useModels';
import type { FlexibleInput } from './nodes';

type AgentNodeState = {
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

type TextNodeState = {
  id: string;
  kind: 'text';
  name: string;
  order: number;
  text: string;
  hasInput: boolean;
  hasOutput: boolean;
  position: { x: number; y: number };
};

type JsonNodeState = {
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

type IfNodeState = {
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

type SplitNodeState = {
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

type WorkflowNodeState = AgentNodeState | TextNodeState | JsonNodeState | IfNodeState | SplitNodeState;

type WorkflowSnapshot = {
  nodes: WorkflowNodeState[];
  edges: Edge[];
  updatedAt: number;
};

type SavedWorkflow = {
  runs: Record<string, WorkflowSnapshot>;
};

type WorkflowLibrary = Record<string, SavedWorkflow>;
type LinkSource = { nodeId: string; handleId: string };
type VisualLine = { id: string; x1: number; y1: number; x2: number; y2: number };

const STORAGE_KEY = 'flexible-workflow-v1';
const LIBRARY_STORAGE_KEY = 'flexible-workflow-library-v1';
const STARTER_NODES: WorkflowNodeState[] = [
  {
    id: 'agent-1',
    kind: 'agent',
    name: 'Agent 1',
    order: 1,
    prompt: 'Use ${input1} and produce a clear string output.',
    model: DEFAULT_MODEL,
    inputs: [{ id: 'input1', name: 'input1', value: '' }],
    output: '',
    position: { x: 120, y: 120 },
  },
  {
    id: 'text-1',
    kind: 'text',
    name: 'Text 1',
    order: 2,
    text: '',
    hasInput: true,
    hasOutput: true,
    position: { x: 620, y: 160 },
  },
];

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 10000)}`;
}

function nextNodePosition(count: number): { x: number; y: number } {
  return { x: 120 + (count % 3) * 460, y: 120 + Math.floor(count / 3) * 380 };
}

function interpolate(prompt: string, inputs: FlexibleInput[]): string {
  return inputs.reduce(
    (result, input) => result.split(`\${${input.name}}`).join(input.value),
    prompt,
  );
}

/** Fill `${name}` placeholders from a value map, leaving unknown ones untouched. */
function interpolateText(template: string, values: Record<string, string>): string {
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
function evaluateCondition(
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
function splitInto(input: string, delimiter: string, count: number): string[] {
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

function extractJsonPath(input: string, path: string): { output: string; error: string | null } {
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

function storageRead(): { nodes: WorkflowNodeState[]; edges: Edge[] } {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { nodes: STARTER_NODES, edges: [] };
    }
    const parsed = JSON.parse(raw) as { nodes?: WorkflowNodeState[]; edges?: Edge[] };
    return { nodes: parsed.nodes?.length ? parsed.nodes : STARTER_NODES, edges: parsed.edges ?? [] };
  } catch {
    return { nodes: STARTER_NODES, edges: [] };
  }
}

function libraryRead(): WorkflowLibrary {
  try {
    const raw = window.localStorage.getItem(LIBRARY_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as WorkflowLibrary;
  } catch {
    return {};
  }
}

function writeCurrentSnapshot(nodes: WorkflowNodeState[], edges: Edge[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges }));
}

function defaultRunName() {
  const date = new Date();
  const stamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return `Run ${stamp}`;
}

function edgeInputHandle(edge: Edge): string | null {
  const handle = edge.data?.targetHandleId;
  return typeof handle === 'string' ? handle : edge.targetHandle ?? null;
}

function edgeOutputHandle(edge: Edge): string {
  const handle = edge.data?.sourceHandleId;
  return typeof handle === 'string' ? handle : edge.sourceHandle ?? 'output';
}

function selectorValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function VisualLinks({
  edges,
  nodes,
  onDelete,
}: {
  edges: Edge[];
  nodes: WorkflowNodeState[];
  onDelete: (edgeId: string) => void;
}) {
  const [lines, setLines] = useState<VisualLine[]>([]);
  const [menu, setMenu] = useState<{ edgeId: string; x: number; y: number } | null>(null);

  useEffect(() => {
    function updateLines() {
      setLines(edges.flatMap((edge) => {
        const sourceHandle = edgeOutputHandle(edge);
        const targetHandle = edgeInputHandle(edge);
        if (!targetHandle) {
          return [];
        }
        const source = document.querySelector(
          `[data-id="${selectorValue(edge.source)}"] [data-handleid="${selectorValue(sourceHandle)}"]`,
        );
        const target = document.querySelector(
          `[data-id="${selectorValue(edge.target)}"] [data-handleid="${selectorValue(targetHandle)}"]`,
        );
        if (!source || !target) {
          return [];
        }
        const sourceRect = source.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        return [{
          id: edge.id,
          x1: sourceRect.left + sourceRect.width / 2,
          y1: sourceRect.top + sourceRect.height / 2,
          x2: targetRect.left + targetRect.width / 2,
          y2: targetRect.top + targetRect.height / 2,
        }];
      }));
    }

    updateLines();
    const interval = window.setInterval(updateLines, 250);
    window.addEventListener('resize', updateLines);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('resize', updateLines);
    };
  }, [edges, nodes]);

  // A link the menu is open for may vanish (deleted, node removed); drop the menu.
  useEffect(() => {
    if (menu && !edges.some((edge) => edge.id === menu.edgeId)) {
      setMenu(null);
    }
  }, [edges, menu]);

  // Any click off the menu, or Escape, dismisses it.
  useEffect(() => {
    if (!menu) {
      return;
    }
    const close = () => setMenu(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenu(null);
      }
    };
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  function openMenu(event: ReactMouseEvent, edgeId: string) {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ edgeId, x: event.clientX, y: event.clientY });
  }

  return (
    <>
      <svg className="visual-link-layer">
        {lines.map((line) => {
          const bend = Math.max(80, Math.abs(line.x2 - line.x1) * 0.45);
          const path = `M ${line.x1} ${line.y1} C ${line.x1 + bend} ${line.y1}, ${line.x2 - bend} ${line.y2}, ${line.x2} ${line.y2}`;
          return (
            <g key={line.id}>
              {/* A fat transparent stroke gives the thin curve a comfortable click target. */}
              <path
                className="visual-link-hit"
                d={path}
                onContextMenu={(event) => openMenu(event, line.id)}
              />
              <path className={`visual-link-path ${menu?.edgeId === line.id ? 'is-active' : ''}`} d={path} />
            </g>
          );
        })}
      </svg>
      {menu ? (
        <div
          className="link-context-menu"
          style={{ left: menu.x, top: menu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              onDelete(menu.edgeId);
              setMenu(null);
            }}
          >
            <Trash2 size={13} />
            Delete link
          </button>
        </div>
      ) : null}
    </>
  );
}

export function App() {
  const initial = useMemo(storageRead, []);
  const initialLibrary = useMemo(libraryRead, []);
  const [workflowNodes, setWorkflowNodes] = useState<WorkflowNodeState[]>(initial.nodes);
  const [edges, setEdges] = useState<Edge[]>(initial.edges);
  const [savedLibrary, setSavedLibrary] = useState<WorkflowLibrary>(initialLibrary);
  const [workflowName, setWorkflowName] = useState('Default workflow');
  const [runName, setRunName] = useState(defaultRunName);
  const [selectedWorkflowName, setSelectedWorkflowName] = useState('');
  const [selectedRunName, setSelectedRunName] = useState('');
  const [pendingLinkSource, setPendingLinkSource] = useState<LinkSource | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [debug, setDebug] = useState('Ready');
  const [error, setError] = useState<string | null>(null);
  const [runningNodeId, setRunningNodeId] = useState<string | null>(null);
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);
  const abortRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const nodesRef = useRef(workflowNodes);
  const edgesRef = useRef(edges);
  const { models, modelsNotice } = useModels();

  useEffect(() => {
    nodesRef.current = workflowNodes;
    writeCurrentSnapshot(workflowNodes, edges);
  }, [workflowNodes, edges]);

  useEffect(() => {
    edgesRef.current = edges;
    writeCurrentSnapshot(workflowNodes, edges);
  }, [workflowNodes, edges]);

  const workflowNames = useMemo(() => Object.keys(savedLibrary).sort(), [savedLibrary]);
  const runNames = useMemo(
    () => Object.keys(savedLibrary[selectedWorkflowName]?.runs ?? {}).sort(),
    [savedLibrary, selectedWorkflowName],
  );

  function persistLibrary(next: WorkflowLibrary) {
    setSavedLibrary(next);
    window.localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(next));
  }

  function saveNamedRun() {
    setError(null);
    const cleanWorkflowName = workflowName.trim();
    const cleanRunName = runName.trim();
    if (!cleanWorkflowName || !cleanRunName) {
      setError('Workflow name and run name are required to save');
      return;
    }

    const next: WorkflowLibrary = {
      ...savedLibrary,
      [cleanWorkflowName]: {
        runs: {
          ...(savedLibrary[cleanWorkflowName]?.runs ?? {}),
          [cleanRunName]: {
            nodes: workflowNodes,
            edges,
            updatedAt: Date.now(),
          },
        },
      },
    };
    persistLibrary(next);
    setSelectedWorkflowName(cleanWorkflowName);
    setSelectedRunName(cleanRunName);
    setDebug(`Saved ${cleanWorkflowName} / ${cleanRunName}`);
  }

  function loadNamedRun() {
    setError(null);
    const snapshot = savedLibrary[selectedWorkflowName]?.runs[selectedRunName];
    if (!snapshot) {
      setError('Pick a workflow and run to load');
      return;
    }

    setWorkflowNodes(snapshot.nodes);
    setEdges(snapshot.edges);
    nodesRef.current = snapshot.nodes;
    edgesRef.current = snapshot.edges;
    writeCurrentSnapshot(snapshot.nodes, snapshot.edges);
    setWorkflowName(selectedWorkflowName);
    setRunName(selectedRunName);
    setDebug(`Loaded ${selectedWorkflowName} / ${selectedRunName}`);
    window.setTimeout(() => flowInstance?.fitView({ padding: 0.18, duration: 250 }), 50);
  }

  const patchNode = useCallback((nodeId: string, patch: Record<string, unknown>) => {
    setWorkflowNodes((current) => current.map((node) => (node.id === nodeId ? { ...node, ...patch } as WorkflowNodeState : node)));
  }, []);

  const patchInput = useCallback((nodeId: string, inputId: string, patch: Partial<FlexibleInput>) => {
    setWorkflowNodes((current) => current.map((node) => {
      if (node.id !== nodeId || node.kind !== 'agent') {
        return node;
      }
      return {
        ...node,
        inputs: node.inputs.map((input) => (input.id === inputId ? { ...input, ...patch } : input)),
      };
    }));
  }, []);

  const addInput = useCallback((nodeId: string) => {
    setWorkflowNodes((current) => current.map((node) => {
      if (node.id !== nodeId || node.kind !== 'agent') {
        return node;
      }
      const nextNumber = node.inputs.length + 1;
      return {
        ...node,
        inputs: [...node.inputs, { id: `input${nextNumber}`, name: `input${nextNumber}`, value: '' }],
      };
    }));
  }, []);

  const removeInput = useCallback((nodeId: string, inputId: string) => {
    setWorkflowNodes((current) => current.map((node) => {
      if (node.id !== nodeId || node.kind !== 'agent') {
        return node;
      }
      return { ...node, inputs: node.inputs.filter((input) => input.id !== inputId) };
    }));
    setEdges((current) => current.filter((edge) => !(edge.target === nodeId && edgeInputHandle(edge) === inputId)));
  }, []);

  const removeNode = useCallback((nodeId: string) => {
    setWorkflowNodes((current) => current.filter((node) => node.id !== nodeId));
    setEdges((current) => current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
  }, []);

  function outputOf(node: WorkflowNodeState | undefined, handle?: string): string {
    if (!node) {
      return '';
    }
    if (node.kind === 'agent') {
      return node.output;
    }
    if (node.kind === 'json') {
      return node.output;
    }
    if (node.kind === 'if') {
      // The If node has two outputs; only the fired branch carries a value.
      return handle === 'output2' ? node.output2 : node.output1;
    }
    if (node.kind === 'split') {
      // Handles are output1..outputN; map back to the split part.
      const index = handle ? Number(handle.replace('output', '')) - 1 : 0;
      return node.outputs[index] ?? '';
    }
    return node.hasOutput ? node.text : '';
  }

  const hydrateNodeInputs = useCallback((nodeId: string): WorkflowNodeState | null => {
    let updated: WorkflowNodeState | null = null;
    setWorkflowNodes((current) => {
      const byId = Object.fromEntries(current.map((node) => [node.id, node]));
      const incoming = edgesRef.current.filter((edge) => edge.target === nodeId);
      const next = current.map((node) => {
        if (node.id !== nodeId) {
          return node;
        }
        if (node.kind === 'text' && node.hasInput) {
          const link = incoming[0];
          const incomingText = outputOf(byId[link?.source], link ? edgeOutputHandle(link) : undefined);
          updated = { ...node, text: incomingText };
          return updated;
        }
        if (node.kind === 'json') {
          const link = incoming[0];
          const incomingText = outputOf(byId[link?.source], link ? edgeOutputHandle(link) : undefined);
          updated = incoming.length ? { ...node, input: incomingText } : node;
          return updated;
        }
        if (node.kind === 'split') {
          const inputLink = incoming.find((edge) => edgeInputHandle(edge) === 'input');
          const countLink = incoming.find((edge) => edgeInputHandle(edge) === 'count');
          let nextCount = node.count;
          if (countLink) {
            const parsed = Math.round(Number(outputOf(byId[countLink.source], edgeOutputHandle(countLink))));
            if (Number.isFinite(parsed)) {
              nextCount = Math.min(20, Math.max(1, parsed));
            }
          }
          updated = {
            ...node,
            input: inputLink ? outputOf(byId[inputLink.source], edgeOutputHandle(inputLink)) : node.input,
            count: nextCount,
          };
          return updated;
        }
        if (node.kind === 'if') {
          const link1 = incoming.find((edge) => edgeInputHandle(edge) === 'input1');
          const link2 = incoming.find((edge) => edgeInputHandle(edge) === 'input2');
          updated = {
            ...node,
            input1: link1 ? outputOf(byId[link1.source], edgeOutputHandle(link1)) : node.input1,
            input2: link2 ? outputOf(byId[link2.source], edgeOutputHandle(link2)) : node.input2,
          };
          return updated;
        }
        if (node.kind === 'agent') {
          updated = {
            ...node,
            inputs: node.inputs.map((input) => {
              const link = incoming.find((edge) => edgeInputHandle(edge) === input.id);
              return link ? { ...input, value: outputOf(byId[link.source], edgeOutputHandle(link)) } : input;
            }),
          };
          return updated;
        }
        updated = node;
        return node;
      });
      nodesRef.current = next;
      return next;
    });
    return updated;
  }, []);

  const runNode = useCallback(async (nodeId: string): Promise<boolean> => {
    setError(null);
    abortRef.current = false;
    const hydrated = hydrateNodeInputs(nodeId);
    const node = hydrated ?? nodesRef.current.find((entry) => entry.id === nodeId);
    if (!node) {
      return false;
    }
    if (node.kind === 'text') {
      setDebug(`Step ${node.order}: ${node.name} passed text through`);
      return true;
    }
    if (node.kind === 'json') {
      const result = extractJsonPath(node.input, node.path);
      patchNode(node.id, result);
      if (result.error) {
        setError(result.error);
        setDebug(result.error);
        return false;
      }
      setDebug(`Step ${node.order}: ${node.name} extracted ${node.path}`);
      return true;
    }
    if (node.kind === 'split') {
      const outputs = splitInto(node.input, node.delimiter, node.count);
      patchNode(node.id, { outputs });
      const filled = outputs.filter((part) => part).length;
      setDebug(`Step ${node.order}: ${node.name} split into ${node.count} (${filled} filled)`);
      return true;
    }
    if (node.kind === 'if') {
      const values = { input1: node.input1, input2: node.input2 };
      const { result, error } = evaluateCondition(node.condition, values);
      if (error) {
        patchNode(node.id, { status: error });
        setError(error);
        setDebug(error);
        return false;
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
      patchNode(node.id, { output1, output2, status });
      setDebug(`Step ${node.order}: ${node.name} — ${status}`);
      return true;
    }

    const prompt = interpolate(node.prompt, node.inputs);
    const controller = new AbortController();
    controllerRef.current = controller;
    setRunningNodeId(node.id);
    setDebug(`Step ${node.order}: ${node.name} is calling ${node.model}`);
    try {
      const output = await runFlexibleLlm(prompt, node.model, controller.signal);
      if (abortRef.current) {
        setDebug('Workflow aborted');
        return false;
      }
      patchNode(node.id, { output });
      setDebug(`Step ${node.order}: ${node.name} finished`);
      return true;
    } catch (caught) {
      const message = controller.signal.aborted ? 'Workflow aborted' : messageFrom(caught, 'LLM call failed');
      setError(message);
      setDebug(message);
      return false;
    } finally {
      setRunningNodeId(null);
      controllerRef.current = null;
    }
  }, [hydrateNodeInputs, patchNode]);

  async function runAll() {
    setError(null);
    abortRef.current = false;
    const ordered = [...nodesRef.current].sort((a, b) => a.order - b.order);
    for (const node of ordered) {
      if (abortRef.current) {
        setDebug('Workflow aborted');
        return;
      }
      const ok = await runNode(node.id);
      if (!ok || abortRef.current) {
        return;
      }
    }
    setDebug(`Workflow complete: ${ordered.length} nodes`);
  }

  function abortAll() {
    abortRef.current = true;
    controllerRef.current?.abort();
    setRunningNodeId(null);
    setDebug('Abort requested');
  }

  const addWorkflowNode = useCallback((kind: 'agent' | 'text' | 'json' | 'if' | 'split', position?: { x: number; y: number }) => {
    setWorkflowNodes((current) => {
      const order = current.length + 1;
      const id = newId(kind);
      const placedAt = position ?? nextNodePosition(current.length);
      const nextNode: WorkflowNodeState = kind === 'agent'
        ? {
            id,
            kind,
            name: `Agent ${order}`,
            order,
            prompt: 'Write a useful response using ${input1}.',
            model: models.find((model) => model.installed)?.name ?? DEFAULT_MODEL,
            inputs: [{ id: 'input1', name: 'input1', value: '' }],
            output: '',
            position: placedAt,
          }
        : kind === 'json'
          ? {
              id,
              kind,
              name: `JSON ${order}`,
              order,
              input: '',
              path: 'a.b',
              output: '',
              error: null,
              position: placedAt,
            }
        : kind === 'if'
          ? {
              id,
              kind,
              name: `If ${order}`,
              order,
              input1: '',
              input2: '',
              condition: '${input1} == "pass"',
              prompt: 'Revise this so it passes the check: ${input2}',
              output1: '',
              output2: '',
              status: '',
              position: placedAt,
            }
        : kind === 'split'
          ? {
              id,
              kind,
              name: `Split ${order}`,
              order,
              input: '',
              delimiter: ',',
              count: 2,
              outputs: [],
              position: placedAt,
            }
        : {
            id,
            kind,
            name: `Text ${order}`,
            order,
            text: '',
            hasInput: true,
            hasOutput: true,
            position: placedAt,
          };
      return [...current, nextNode];
    });
  }, [models]);

  function onDragStart(event: DragEvent, kind: 'agent' | 'text' | 'json' | 'if' | 'split') {
    event.dataTransfer.setData('application/workflow-node', kind);
    event.dataTransfer.effectAllowed = 'move';
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    const kind = event.dataTransfer.getData('application/workflow-node') as 'agent' | 'text' | 'json' | 'if' | 'split';
    if (!kind || !flowInstance) {
      return;
    }
    addWorkflowNode(kind, flowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
  }

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setWorkflowNodes((current) => current.map((node) => {
      const change = changes.find((entry) => entry.type === 'position' && entry.id === node.id && entry.position);
      return change && 'position' in change && change.position ? { ...node, position: change.position } : node;
    }));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((current) => {
      const removed = new Set(changes.filter((change) => change.type === 'remove').map((change) => change.id));
      const next = current.filter((edge) => !removed.has(edge.id));
      edgesRef.current = next;
      writeCurrentSnapshot(nodesRef.current, next);
      return next;
    });
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target || !connection.targetHandle) {
      return;
    }
    setEdges((current) => {
      const next = [{
      id: `${connection.source}->${connection.target}:${connection.targetHandle}`,
      source: connection.source!,
      target: connection.target!,
      animated: true,
      data: {
        sourceHandleId: connection.sourceHandle ?? 'output',
        targetHandleId: connection.targetHandle,
      },
      }, ...current.filter((edge) => !(edge.target === connection.target && edgeInputHandle(edge) === connection.targetHandle))];
      edgesRef.current = next;
      writeCurrentSnapshot(nodesRef.current, next);
      return next;
    });
  }, []);

  const createLink = useCallback((source: LinkSource, targetNodeId: string, targetHandleId: string) => {
    if (source.nodeId === targetNodeId) {
      setDebug('Pick an input on a different node');
      setPendingLinkSource(null);
      return;
    }

    setEdges((current) => {
      const next = [{
        id: `${source.nodeId}:${source.handleId}->${targetNodeId}:${targetHandleId}`,
        source: source.nodeId,
        target: targetNodeId,
        animated: true,
        data: {
          sourceHandleId: source.handleId,
          targetHandleId,
        },
      }, ...current.filter((edge) => !(edge.target === targetNodeId && edgeInputHandle(edge) === targetHandleId))];
      edgesRef.current = next;
      writeCurrentSnapshot(nodesRef.current, next);
      setDebug(`Linked nodes (${next.length})`);
      return next;
    });
    setPendingLinkSource(null);
  }, []);

  const deleteEdge = useCallback((edgeId: string) => {
    setEdges((current) => {
      const next = current.filter((edge) => edge.id !== edgeId);
      edgesRef.current = next;
      writeCurrentSnapshot(nodesRef.current, next);
      return next;
    });
    setDebug('Removed a link');
  }, []);

  const pickOutput = useCallback((nodeId: string, handleId: string) => {
    setPendingLinkSource({ nodeId, handleId });
    setDebug('Now click an input dot to link it');
  }, []);

  const pickInput = useCallback((nodeId: string, handleId: string) => {
    if (!pendingLinkSource) {
      setDebug('Click an output dot first, then an input dot');
      return;
    }
    createLink(pendingLinkSource, nodeId, handleId);
  }, [pendingLinkSource, createLink]);

  const flowNodes: Node[] = useMemo(() => workflowNodes.map((node) => ({
    id: node.id,
    type: node.kind === 'agent'
      ? 'flexibleAgent'
      : node.kind === 'json'
        ? 'flexibleJson'
        : node.kind === 'if'
          ? 'flexibleIf'
          : node.kind === 'split'
            ? 'flexibleSplit'
            : 'flexibleText',
    position: node.position,
    initialWidth: node.kind === 'agent' ? 430 : node.kind === 'if' ? 400 : node.kind === 'json' ? 380 : node.kind === 'split' ? 360 : 360,
    initialHeight: node.kind === 'agent'
      ? 520
      : node.kind === 'if'
        ? 640
        : node.kind === 'json'
          ? 430
          : node.kind === 'split'
            ? 300 + node.count * 96
            : 280,
    data: node.kind === 'agent'
      ? {
          ...node,
          nodeId: node.id,
          models,
          running: runningNodeId === node.id,
          pendingSourceNodeId: pendingLinkSource?.nodeId ?? null,
          onChange: patchNode,
          onInputChange: patchInput,
          onAddInput: addInput,
          onRemoveInput: removeInput,
          onPickOutput: pickOutput,
          onPickInput: pickInput,
          onRun: runNode,
          onRemove: removeNode,
        }
      : node.kind === 'json'
        ? {
            ...node,
            nodeId: node.id,
            pendingSourceNodeId: pendingLinkSource?.nodeId ?? null,
            onChange: patchNode,
            onPickOutput: pickOutput,
            onPickInput: pickInput,
            onRun: runNode,
            onRemove: removeNode,
          }
      : node.kind === 'if'
        ? {
            ...node,
            nodeId: node.id,
            running: runningNodeId === node.id,
            pendingSourceNodeId: pendingLinkSource?.nodeId ?? null,
            pendingSourceHandleId: pendingLinkSource?.handleId ?? null,
            onChange: patchNode,
            onPickOutput: pickOutput,
            onPickInput: pickInput,
            onRun: runNode,
            onRemove: removeNode,
          }
      : node.kind === 'split'
        ? {
            ...node,
            nodeId: node.id,
            pendingSourceNodeId: pendingLinkSource?.nodeId ?? null,
            pendingSourceHandleId: pendingLinkSource?.handleId ?? null,
            onChange: patchNode,
            onPickOutput: pickOutput,
            onPickInput: pickInput,
            onRun: runNode,
            onRemove: removeNode,
          }
      : {
          ...node,
          nodeId: node.id,
          pendingSourceNodeId: pendingLinkSource?.nodeId ?? null,
          onChange: patchNode,
          onPickOutput: pickOutput,
          onPickInput: pickInput,
          onRemove: removeNode,
        },
  })), [workflowNodes, models, runningNodeId, pendingLinkSource, patchNode, patchInput, addInput, removeInput, pickOutput, pickInput, runNode, removeNode]);

  return (
    <main className="app-shell">
      <aside className="save-load-window">
        <div className="save-load-group">
          <div className="node-kicker">Save</div>
          <input
            className="control-input"
            value={workflowName}
            onChange={(event) => setWorkflowName(event.target.value)}
            placeholder="Workflow name"
            aria-label="Workflow name"
          />
          <input
            className="control-input"
            value={runName}
            onChange={(event) => setRunName(event.target.value)}
            placeholder="Run name"
            aria-label="Run name"
          />
          <button className="compact-action-button" type="button" onClick={saveNamedRun} title="Save workflow run">
            <Save size={12} />
            Save
          </button>
        </div>
        <div className="save-load-group">
          <div className="node-kicker">Load</div>
          <select
            className="control-input"
            value={selectedWorkflowName}
            onChange={(event) => {
              const nextWorkflow = event.target.value;
              const firstRun = Object.keys(savedLibrary[nextWorkflow]?.runs ?? {}).sort()[0] ?? '';
              setSelectedWorkflowName(nextWorkflow);
              setSelectedRunName(firstRun);
            }}
            aria-label="Saved workflow"
          >
            <option value="">Workflow name</option>
            {workflowNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            className="control-input"
            value={selectedRunName}
            onChange={(event) => setSelectedRunName(event.target.value)}
            disabled={!selectedWorkflowName}
            aria-label="Saved run"
          >
            <option value="">Run name</option>
            {runNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button
            className="compact-action-button"
            type="button"
            onClick={loadNamedRun}
            disabled={!selectedWorkflowName || !selectedRunName}
          >
            Load
          </button>
        </div>
      </aside>

      <aside className="debug-window">
        <div>
          <div className="node-kicker">Debug</div>
          <p>{error ?? debug}</p>
          {modelsNotice ? <small>{modelsNotice}</small> : null}
        </div>
        <button className="start-debug-button" type="button" onClick={runAll} disabled={Boolean(runningNodeId)}>
          <Play size={14} />
          Start
        </button>
        <button type="button" className="abort-button" onClick={abortAll} disabled={!runningNodeId && debug !== 'Abort requested'}>
          <Square size={14} />
          Abort
        </button>
      </aside>

      <aside className={`node-drawer ${drawerOpen ? 'is-open' : 'is-closed'}`}>
        <button
          type="button"
          className="drawer-toggle"
          onClick={() => setDrawerOpen((open) => !open)}
          title={drawerOpen ? 'Collapse node drawer' : 'Open node drawer'}
          aria-label={drawerOpen ? 'Collapse node drawer' : 'Open node drawer'}
        >
          {drawerOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
        </button>
        {drawerOpen ? (
          <>
            <button
              className="drawer-item"
              type="button"
              draggable
              onDragStart={(event) => onDragStart(event, 'agent')}
              onClick={() => addWorkflowNode('agent')}
              title="Click to add, or drag onto the canvas"
            >
              <Bot size={16} />
              <span>LLM agent</span>
            </button>
            <button
              className="drawer-item"
              type="button"
              draggable
              onDragStart={(event) => onDragStart(event, 'json')}
              onClick={() => addWorkflowNode('json')}
              title="Click to add, or drag onto the canvas"
            >
              <Braces size={16} />
              <span>JSON extract</span>
            </button>
            <button
              className="drawer-item"
              type="button"
              draggable
              onDragStart={(event) => onDragStart(event, 'if')}
              onClick={() => addWorkflowNode('if')}
              title="Click to add, or drag onto the canvas"
            >
              <GitBranch size={16} />
              <span>If</span>
            </button>
            <button
              className="drawer-item"
              type="button"
              draggable
              onDragStart={(event) => onDragStart(event, 'split')}
              onClick={() => addWorkflowNode('split')}
              title="Click to add, or drag onto the canvas"
            >
              <Scissors size={16} />
              <span>Split</span>
            </button>
            <button
              className="drawer-item"
              type="button"
              draggable
              onDragStart={(event) => onDragStart(event, 'text')}
              onClick={() => addWorkflowNode('text')}
              title="Click to add, or drag onto the canvas"
            >
              <Type size={16} />
              <span>Text box</span>
            </button>
          </>
        ) : null}
      </aside>

      <WorkflowCanvas
        resetKey={0}
        nodes={flowNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={() => undefined}
        onPaneClick={() => undefined}
        connectable
        draggable
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
        }}
        onInit={setFlowInstance}
      />
      <VisualLinks edges={edges} nodes={workflowNodes} onDelete={deleteEdge} />
    </main>
  );
}
