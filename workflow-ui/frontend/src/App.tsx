import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { type Connection, type Edge, type EdgeChange, type Node, type NodeChange, type ReactFlowInstance } from '@xyflow/react';
import { Bot, Braces, Eye, FilePlus, GitBranch, LogIn, LogOut, PanelRightClose, PanelRightOpen, Play, Repeat, Save, Scissors, ScrollText, Sparkles, Square, Trash2, Type, Upload, Workflow } from 'lucide-react';
import { WorkflowCanvas } from './components/WorkflowCanvas';
import { WorkflowLogPanel } from './components/WorkflowLogPanel';
import { DEFAULT_MODEL, DEFAULT_THINKING_LEVEL, DEFAULT_VISION_MODEL, FALLBACK_MODELS } from './constants';
import { deleteFlexibleWorkflow, fetchComfyImages, fetchFlexibleWorkflowLibrary, saveFlexibleWorkflow, saveWorkflowLog, uploadComfyImage } from './api';
import {
  edgeInputHandle,
  edgeOutputHandle,
  DEFAULT_PROMPT_LOOP_FIXER_PROMPT,
  DEFAULT_PROMPT_LOOP_JUDGE_PROMPT,
  hydrateNode,
  normalizeEdges,
  outputOf,
  resolveWorkflowSnapshot,
  executeNode,
  formatWorkflowLog,
  workflowOutputHandle,
  type NodeKind,
  type WorkflowLibrary,
  type WorkflowLogEntry,
  type WorkflowNodeState,
} from './lib/engine';
import { messageFrom } from './lib/errors';
import { useModels } from './hooks/useModels';
import type { FlexibleInput, WorkflowOption } from './nodes';

type LinkSource = { nodeId: string; handleId: string };
type LinkMenu = { edgeId: string; x: number; y: number };

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
    thinking: DEFAULT_THINKING_LEVEL,
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

function buildNode(
  kind: NodeKind,
  id: string,
  order: number,
  position: { x: number; y: number },
  model: string,
): WorkflowNodeState {
  switch (kind) {
    case 'agent':
      return {
        id,
        kind,
        name: `Agent ${order}`,
        order,
        prompt: 'Write a useful response using ${input1}.',
        model,
        thinking: DEFAULT_THINKING_LEVEL,
        inputs: [{ id: 'input1', name: 'input1', value: '' }],
        output: '',
        position,
      };
    case 'json':
      return { id, kind, name: `JSON ${order}`, order, input: '', path: 'a.b', output: '', error: null, position };
    case 'if':
      return {
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
        position,
      };
    case 'split':
      return { id, kind, name: `Split ${order}`, order, input: '', delimiter: ',', count: 2, outputs: [], position };
    case 'imageUpload':
      return {
        id,
        kind,
        name: `Upload ${order}`,
        order,
        outputUrl: '',
        outputName: '',
        status: '',
        position,
      };
    case 'imageDisplay':
      return {
        id,
        kind,
        name: `Display ${order}`,
        order,
        imageUrl: '',
        position,
      };
    case 'imageGenerate':
      return {
        id,
        kind,
        name: `Generate ${order}`,
        order,
        prompt: 'Create an image of ${input1}',
        inputs: [{ id: 'input1', name: 'input1', value: '' }],
        referenceImage: '',
        seed: '',
        steps: 8,
        strength: 1,
        outputUrl: '',
        outputName: '',
        status: '',
        position,
      };
    case 'imageText':
      return {
        id,
        kind,
        name: `Image Text ${order}`,
        order,
        prompt: 'Describe this image using ${input1}.',
        model: DEFAULT_VISION_MODEL,
        imageUrl: '',
        inputs: [{ id: 'input1', name: 'input1', value: '' }],
        output: '',
        status: '',
        position,
      };
    case 'forEach':
      return {
        id,
        kind,
        name: `Loop ${order}`,
        order,
        items: '[]',
        workflowName: '',
        output: '',
        threshold: 95,
        maxAttempts: 3,
        retryWith: 'result',
        score: '',
        note: '',
        iterations: 0,
        attempts: 0,
        trace: '',
        status: '',
        position,
      };
    case 'promptLoop':
      return {
        id,
        kind,
        name: 'Prompt Judge Loop',
        order,
        prompt: '',
        judgePrompt: DEFAULT_PROMPT_LOOP_JUDGE_PROMPT,
        fixerPrompt: DEFAULT_PROMPT_LOOP_FIXER_PROMPT,
        model,
        thinking: DEFAULT_THINKING_LEVEL,
        threshold: 95,
        maxRetries: 3,
        score: '',
        fixes: '[]',
        approvedPrompt: '',
        attempts: 0,
        trace: '',
        status: '',
        position,
      };
    case 'input':
      return { id, kind, name: `input${order}`, order, value: '', position };
    case 'output':
      return { id, kind, name: `output${order}`, order, value: '', position };
    case 'workflow':
      return {
        id,
        kind,
        name: `Workflow ${order}`,
        order,
        workflowName: '',
        inputs: [],
        outputs: [],
        status: '',
        position,
      };
    case 'text':
      return { id, kind, name: `Text ${order}`, order, text: '', hasInput: true, hasOutput: true, position };
  }
}

function migrateLegacyPromptLoopSnapshot(
  nodes: WorkflowNodeState[],
  edges: Edge[],
): { nodes: WorkflowNodeState[]; edges: Edge[] } {
  const legacyIds = new Set(nodes.filter((node) => node.kind === 'promptLoop').map((node) => node.id));
  if (!legacyIds.size) {
    return { nodes, edges };
  }

  const migratedNodes = nodes.map((node) => {
    if (node.kind !== 'promptLoop') {
      return node;
    }
    return {
      id: node.id,
      kind: 'forEach' as const,
      name: node.name.replace(/prompt judge loop/i, 'workflow loop'),
      order: node.order,
      items: node.prompt,
      workflowName: 'Prompt fixer and judge',
      output: node.approvedPrompt,
      threshold: node.threshold,
      maxAttempts: Math.max(1, node.maxRetries + 1),
      retryWith: 'result' as const,
      score: node.score,
      note: '',
      iterations: node.attempts ? 1 : 0,
      attempts: node.attempts,
      trace: node.trace,
      status: node.status,
      position: node.position,
    };
  });

  const migratedEdges = edges.map((edge) => {
    const targetHandle = edge.targetHandle ?? (typeof edge.data?.targetHandleId === 'string' ? edge.data.targetHandleId : '');
    const sourceHandle = edge.sourceHandle ?? (typeof edge.data?.sourceHandleId === 'string' ? edge.data.sourceHandleId : 'output');
    const nextTargetHandle = legacyIds.has(edge.target) && targetHandle === 'prompt' ? 'items' : targetHandle;
    const nextSourceHandle = legacyIds.has(edge.source)
      ? ({ approvedPrompt: 'output', fixes: 'note' }[sourceHandle] ?? sourceHandle)
      : sourceHandle;
    return { ...edge, targetHandle: nextTargetHandle, sourceHandle: nextSourceHandle };
  });

  return { nodes: migratedNodes, edges: migratedEdges };
}

function storageRead(): { nodes: WorkflowNodeState[]; edges: Edge[] } {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { nodes: STARTER_NODES, edges: [] };
    }
    const parsed = JSON.parse(raw) as { nodes?: WorkflowNodeState[]; edges?: Edge[] };
    const migrated = migrateLegacyPromptLoopSnapshot(parsed.nodes?.length ? parsed.nodes : STARTER_NODES, parsed.edges ?? []);
    return { nodes: migrated.nodes, edges: normalizeEdges(migrated.edges) };
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

export function App() {
  const initial = useMemo(storageRead, []);
  const initialLibrary = useMemo(libraryRead, []);
  const [workflowNodes, setWorkflowNodes] = useState<WorkflowNodeState[]>(initial.nodes);
  const [edges, setEdges] = useState<Edge[]>(initial.edges);
  const [savedLibrary, setSavedLibrary] = useState<WorkflowLibrary>(initialLibrary);
  const [imageInputDir, setImageInputDir] = useState('');
  const [workflowName, setWorkflowName] = useState('Default workflow');
  const [runName, setRunName] = useState(defaultRunName);
  const [selectedWorkflowName, setSelectedWorkflowName] = useState('');
  const [selectedRunName, setSelectedRunName] = useState('');
  const [pendingLinkSource, setPendingLinkSource] = useState<LinkSource | null>(null);
  const [linkMenu, setLinkMenu] = useState<LinkMenu | null>(null);
  const [nodeSizes, setNodeSizes] = useState<Record<string, { width: number; height: number }>>({});
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [workflowLog, setWorkflowLog] = useState<WorkflowLogEntry[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [debug, setDebug] = useState('Ready');
  const [error, setError] = useState<string | null>(null);
  const [runningNodeId, setRunningNodeId] = useState<string | null>(null);
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);
  const abortRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const nodesRef = useRef(workflowNodes);
  const edgesRef = useRef(edges);
  const savedLibraryRef = useRef(savedLibrary);
  const { models, modelsNotice } = useModels();

  const refreshImages = useCallback(async () => {
    const data = await fetchComfyImages();
    setImageInputDir(data.input_dir);
  }, []);

  useEffect(() => {
    nodesRef.current = workflowNodes;
    writeCurrentSnapshot(workflowNodes, edges);
  }, [workflowNodes, edges]);

  useEffect(() => {
    edgesRef.current = edges;
    writeCurrentSnapshot(workflowNodes, edges);
  }, [workflowNodes, edges]);

  useEffect(() => {
    savedLibraryRef.current = savedLibrary;
  }, [savedLibrary]);

  useEffect(() => {
    let alive = true;
    refreshImages().catch((caught) => {
      if (alive) {
        setDebug(`Image folder unavailable: ${messageFrom(caught, 'Could not load images')}`);
      }
    });
    return () => {
      alive = false;
    };
  }, [refreshImages]);

  useEffect(() => {
    let alive = true;
    async function loadWorkflowFiles() {
      try {
        const library = await fetchFlexibleWorkflowLibrary();
        if (!alive) {
          return;
        }
        const repoCount = Object.keys(library).length;
        const cachedEntries = Object.entries(savedLibraryRef.current);
        if (repoCount > 0) {
          persistLibrary(library);
          setDebug(`Loaded ${repoCount} saved workflow(s) from repo files`);
          return;
        }
        if (cachedEntries.length > 0) {
          for (const [name, workflow] of cachedEntries) {
            await saveFlexibleWorkflow(name, workflow);
          }
          setDebug(`Moved ${cachedEntries.length} browser-saved workflow(s) into repo files`);
          return;
        }
        setDebug('No saved workflow files yet');
      } catch (caught) {
        if (alive) {
          setDebug(`Using browser cache for saved workflows: ${messageFrom(caught, 'Could not read repo files')}`);
        }
      }
    }
    loadWorkflowFiles();
    return () => {
      alive = false;
    };
  }, []);

  const workflowNames = useMemo(() => Object.keys(savedLibrary).sort(), [savedLibrary]);
  const runNames = useMemo(
    () => Object.keys(savedLibrary[selectedWorkflowName]?.runs ?? {}).sort(),
    [savedLibrary, selectedWorkflowName],
  );

  function persistLibrary(next: WorkflowLibrary) {
    setSavedLibrary(next);
    window.localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(next));
  }

  const persistWorkflowLog = useCallback(async (entries: WorkflowLogEntry[]) => {
    try {
      const saved = await saveWorkflowLog(
        workflowName.trim(),
        runName.trim(),
        formatWorkflowLog(entries, workflowName.trim(), runName.trim()),
      );
      setDebug(`Saved workflow log ${saved.filename}`);
    } catch (caught) {
      setDebug(`Could not save workflow log: ${messageFrom(caught, 'Unknown error')}`);
    }
  }, [runName, workflowName]);

  async function saveNamedRun() {
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
    try {
      const library = await saveFlexibleWorkflow(cleanWorkflowName, next[cleanWorkflowName]);
      persistLibrary(library);
      setDebug(`Saved ${cleanWorkflowName} / ${cleanRunName} to repo files`);
    } catch (caught) {
      setError(messageFrom(caught, 'Could not save workflow file'));
    }
  }

  function newWorkflow() {
    setError(null);
    abortRef.current = true;
    controllerRef.current?.abort();
    setRunningNodeId(null);
    setPendingLinkSource(null);
    setLinkMenu(null);
    setNodeSizes({});
    setWorkflowNodes([]);
    setEdges([]);
    setWorkflowLog([]);
    nodesRef.current = [];
    edgesRef.current = [];
    writeCurrentSnapshot([], []);
    setWorkflowName('Untitled workflow');
    setRunName(defaultRunName());
    setSelectedWorkflowName('');
    setSelectedRunName('');
    setDebug('New workflow — drag nodes from the drawer to start');
  }

  function loadNamedRun() {
    setError(null);
    const snapshot = savedLibrary[selectedWorkflowName]?.runs[selectedRunName];
    if (!snapshot) {
      setError('Pick a workflow and run to load');
      return;
    }

    const migrated = migrateLegacyPromptLoopSnapshot(snapshot.nodes, snapshot.edges);
    const loadedEdges = normalizeEdges(migrated.edges);
    setWorkflowNodes(migrated.nodes);
    setEdges(loadedEdges);
    nodesRef.current = migrated.nodes;
    edgesRef.current = loadedEdges;
    writeCurrentSnapshot(migrated.nodes, loadedEdges);
    setWorkflowName(selectedWorkflowName);
    setRunName(selectedRunName);
    setDebug(`Loaded ${selectedWorkflowName} / ${selectedRunName}`);
    window.setTimeout(() => flowInstance?.fitView({ padding: 0.18, duration: 250 }), 50);
  }

  async function deleteSelectedWorkflow() {
    setError(null);
    const name = selectedWorkflowName.trim();
    if (!name) {
      setError('Pick a workflow to delete');
      return;
    }

    try {
      await deleteFlexibleWorkflow(name);
      const next = { ...savedLibrary };
      delete next[name];
      persistLibrary(next);
      setSelectedWorkflowName('');
      setSelectedRunName('');
      if (workflowName === name) {
        setWorkflowName('Untitled workflow');
        setRunName(defaultRunName());
      }
      setDebug(`Deleted ${name}`);
    } catch (caught) {
      setError(messageFrom(caught, 'Could not delete workflow file'));
    }
  }

  const patchNode = useCallback((nodeId: string, patch: Record<string, unknown>) => {
    const next = nodesRef.current.map((node) => (node.id === nodeId ? { ...node, ...patch } as WorkflowNodeState : node));
    nodesRef.current = next;
    setWorkflowNodes(next);
  }, []);

  const uploadImageForNode = useCallback(async (nodeId: string, file: File) => {
    setError(null);
    try {
      setDebug(`Uploading ${file.name}`);
      const image = await uploadComfyImage(file);
      patchNode(nodeId, { outputUrl: image.url, outputName: image.name, status: `Uploaded ${image.name}` });
      await refreshImages();
      setDebug(`Uploaded ${image.name}`);
    } catch (caught) {
      const message = messageFrom(caught, 'Could not upload image');
      setError(message);
      setDebug(message);
    }
  }, [patchNode, refreshImages]);

  const patchInput = useCallback((nodeId: string, inputId: string, patch: Partial<FlexibleInput>) => {
    setWorkflowNodes((current) => current.map((node) => {
      if (node.id !== nodeId || (node.kind !== 'agent' && node.kind !== 'imageGenerate' && node.kind !== 'imageText' && node.kind !== 'workflow')) {
        return node;
      }
      return {
        ...node,
        inputs: (node.inputs ?? []).map((input) => (input.id === inputId ? { ...input, ...patch } : input)),
      };
    }));
  }, []);

  const addInput = useCallback((nodeId: string) => {
    setWorkflowNodes((current) => current.map((node) => {
      if (node.id !== nodeId || (node.kind !== 'agent' && node.kind !== 'imageGenerate' && node.kind !== 'imageText')) {
        return node;
      }
      const inputs = node.inputs ?? [];
      const nextNumber = inputs.length + 1;
      return {
        ...node,
        inputs: [...inputs, { id: `input${nextNumber}`, name: `input${nextNumber}`, value: '' }],
      };
    }));
  }, []);

  const removeInput = useCallback((nodeId: string, inputId: string) => {
    setWorkflowNodes((current) => current.map((node) => {
      if (node.id !== nodeId || (node.kind !== 'agent' && node.kind !== 'imageGenerate' && node.kind !== 'imageText')) {
        return node;
      }
      return { ...node, inputs: (node.inputs ?? []).filter((input) => input.id !== inputId) };
    }));
    setEdges((current) => current.filter((edge) => !(edge.target === nodeId && edgeInputHandle(edge) === inputId)));
  }, []);

  const removeNode = useCallback((nodeId: string) => {
    setWorkflowNodes((current) => current.filter((node) => node.id !== nodeId));
    setEdges((current) => current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
  }, []);

  const hydrateNodeInputs = useCallback((nodeId: string): WorkflowNodeState | null => {
    const current = nodesRef.current;
    const target = current.find((node) => node.id === nodeId);
    if (!target) {
      return null;
    }

    const byId = new Map(current.map((node) => [node.id, node]));
    const updated = hydrateNode(target, edgesRef.current, byId);
    const next = current.map((node) => (node.id === nodeId ? updated : node));
    nodesRef.current = next;
    setWorkflowNodes(next);
    return updated;
  }, []);

  const runNode = useCallback(async (
    nodeId: string,
    onLog?: (entry: WorkflowLogEntry) => void,
  ): Promise<boolean> => {
    setError(null);
    abortRef.current = false;
    const standaloneEntries: WorkflowLogEntry[] = [];
    const logSink = onLog ?? ((entry: WorkflowLogEntry) => {
      standaloneEntries.push(entry);
      setWorkflowLog([...standaloneEntries]);
    });
    if (!onLog) {
      setWorkflowLog([]);
    }
    const hydrated = hydrateNodeInputs(nodeId);
    const node = hydrated ?? nodesRef.current.find((entry) => entry.id === nodeId);
    if (!node) {
      return false;
    }

    // API-backed nodes are slow and abortable; local transform nodes are instant.
    const slow = node.kind === 'agent' || node.kind === 'imageGenerate' || node.kind === 'imageText' || node.kind === 'workflow' || node.kind === 'forEach' || node.kind === 'promptLoop';
    const controller = slow ? new AbortController() : null;
    if (controller) {
      controllerRef.current = controller;
      setRunningNodeId(node.id);
    }
    if (node.kind === 'agent') {
      setDebug(`Step ${node.order}: ${node.name} is calling ${node.model}`);
    } else if (node.kind === 'imageGenerate') {
      setDebug(`Step ${node.order}: ${node.name} is calling ComfyUI`);
    } else if (node.kind === 'imageText') {
      setDebug(`Step ${node.order}: ${node.name} is reading the image with ${node.model}`);
    } else if (node.kind === 'workflow') {
      setDebug(`Step ${node.order}: ${node.name} is running ${node.workflowName}`);
    } else if (node.kind === 'forEach') {
      setDebug(`Step ${node.order}: ${node.name} is running ${node.workflowName}`);
    } else if (node.kind === 'promptLoop') {
      setDebug(`Step ${node.order}: ${node.name} is judging and fixing the prompt`);
    }

    try {
      const execution = await executeNode(node, {
        library: savedLibraryRef.current,
        signal: controller?.signal,
        onProgress: setDebug,
        onLog: logSink,
      });
      const result = execution.result;
      if (abortRef.current) {
        setDebug('Workflow aborted');
        return false;
      }
      if (Object.keys(result.patch).length) {
        patchNode(node.id, result.patch);
      }
      if (result.error) {
        setError(result.error);
        setDebug(result.error);
        return false;
      }
      if (node.kind === 'imageGenerate') {
        await refreshImages().catch(() => undefined);
      }
      setDebug(`Step ${node.order}: ${result.note}`);
      return true;
    } catch (caught) {
      const message = controller?.signal.aborted ? 'Workflow aborted' : messageFrom(caught, 'Node failed');
      setError(message);
      setDebug(message);
      return false;
    } finally {
      if (controller) {
        setRunningNodeId(null);
        controllerRef.current = null;
      }
      if (!onLog) {
        await persistWorkflowLog(standaloneEntries);
      }
    }
  }, [hydrateNodeInputs, patchNode, persistWorkflowLog, refreshImages]);

  async function runAll() {
    setError(null);
    abortRef.current = false;
    const ordered = [...nodesRef.current].sort((a, b) => a.order - b.order);
    const entries: WorkflowLogEntry[] = [];
    const onLog = (entry: WorkflowLogEntry) => {
      entries.push(entry);
      setWorkflowLog([...entries]);
    };
    setWorkflowLog([]);
    try {
      for (const node of ordered) {
        if (abortRef.current) {
          setDebug('Workflow aborted');
          return;
        }
        const ok = await runNode(node.id, onLog);
        if (!ok || abortRef.current) {
          return;
        }
      }
      setDebug(`Workflow complete: ${ordered.length} nodes`);
    } finally {
      await persistWorkflowLog(entries);
    }
  }

  function abortAll() {
    abortRef.current = true;
    controllerRef.current?.abort();
    setRunningNodeId(null);
    setDebug('Abort requested');
  }

  const addWorkflowNode = useCallback((kind: NodeKind, position?: { x: number; y: number }) => {
    setWorkflowNodes((current) => {
      const order = current.length + 1;
      const placedAt = position ?? nextNodePosition(current.length);
      const model = models.find((entry) => entry.installed)?.name ?? DEFAULT_MODEL;
      return [...current, buildNode(kind, newId(kind), order, placedAt, model)];
    });
  }, [models]);

  function onDragStart(event: DragEvent, kind: NodeKind) {
    event.dataTransfer.setData('application/workflow-node', kind);
    event.dataTransfer.effectAllowed = 'move';
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    const kind = event.dataTransfer.getData('application/workflow-node') as NodeKind;
    if (!kind || !flowInstance) {
      return;
    }
    addWorkflowNode(kind, flowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
  }

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    // React Flow reports node measurements as 'dimensions' changes. They must be
    // persisted and fed back through the nodes' `measured` field, otherwise the
    // nodes count as unmeasured and React Flow refuses to draw their edges.
    const sized = changes.filter(
      (change): change is NodeChange & { type: 'dimensions'; id: string; dimensions: { width: number; height: number } } =>
        change.type === 'dimensions' && Boolean(change.dimensions),
    );
    if (sized.length) {
      setNodeSizes((current) => {
        const next = { ...current };
        for (const change of sized) {
          next[change.id] = change.dimensions;
        }
        return next;
      });
    }
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
      sourceHandle: connection.sourceHandle ?? 'output',
      targetHandle: connection.targetHandle,
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
        sourceHandle: source.handleId,
        targetHandle: targetHandleId,
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

  const onEdgeContextMenu = useCallback((event: ReactMouseEvent, edge: Edge) => {
    event.preventDefault();
    // Keep the window-level contextmenu listener from instantly closing the menu.
    event.stopPropagation();
    setLinkMenu({ edgeId: edge.id, x: event.clientX, y: event.clientY });
  }, []);

  // A link the menu is open for may vanish (deleted, node removed); drop the menu.
  useEffect(() => {
    if (linkMenu && !edges.some((edge) => edge.id === linkMenu.edgeId)) {
      setLinkMenu(null);
    }
  }, [edges, linkMenu]);

  // Any click off the menu, or Escape, dismisses it.
  useEffect(() => {
    if (!linkMenu) {
      return;
    }
    const close = () => setLinkMenu(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLinkMenu(null);
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
  }, [linkMenu]);

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

  /** Point a workflow node at a saved workflow and mirror its Input/Output nodes as dots. */
  const pickWorkflow = useCallback((nodeId: string, workflowName: string) => {
    const snapshot = resolveWorkflowSnapshot(savedLibraryRef.current, workflowName);
    const subInputs = (snapshot?.nodes ?? []).flatMap((node) => (node.kind === 'input' ? [node] : []));
    const subOutputs = (snapshot?.nodes ?? []).flatMap((node) => (node.kind === 'output' ? [node] : []));

    setWorkflowNodes((current) => current.map((node) => {
      if (node.id !== nodeId || node.kind !== 'workflow') {
        return node;
      }
      const existing = new Map(node.inputs.map((input) => [input.name, input.value]));
      return {
        ...node,
        workflowName,
        inputs: subInputs.map((sub) => ({ id: sub.name, name: sub.name, value: existing.get(sub.name) ?? sub.value })),
        outputs: subOutputs.map((sub) => ({ name: sub.name, value: '' })),
        status: !workflowName
          ? ''
          : snapshot
            ? `${subInputs.length} input(s), ${subOutputs.length} output(s)`
            : 'Saved workflow not found',
      };
    }));

    // Links into dots that no longer exist would render nowhere; drop them.
    const inputIds = new Set(subInputs.map((sub) => sub.name));
    const outputIds = new Set(subOutputs.map((sub) => workflowOutputHandle(sub.name)));
    setEdges((current) => {
      const next = current.filter((edge) => {
        if (edge.target === nodeId) {
          return inputIds.has(edgeInputHandle(edge) ?? '');
        }
        if (edge.source === nodeId) {
          return outputIds.has(edgeOutputHandle(edge));
        }
        return true;
      });
      edgesRef.current = next;
      writeCurrentSnapshot(nodesRef.current, next);
      return next;
    });
  }, []);

  const pickBodyWorkflow = useCallback((nodeId: string, workflowName: string) => {
    const snapshot = resolveWorkflowSnapshot(savedLibraryRef.current, workflowName);
    const subInputs = (snapshot?.nodes ?? [])
      .filter((node) => node.kind === 'input')
      .sort((a, b) => a.order - b.order);
    const subOutputs = (snapshot?.nodes ?? [])
      .filter((node) => node.kind === 'output')
      .sort((a, b) => a.order - b.order);

    setWorkflowNodes((current) => current.map((node) => {
      if (node.id !== nodeId || node.kind !== 'forEach') {
        return node;
      }
      const inputNames = subInputs.map((input) => input.name);
      const retryWith = snapshot?.nodes.some((bodyNode) => bodyNode.kind === 'imageGenerate') ? 'input' : node.retryWith;
      const status = !workflowName
        ? ''
        : snapshot
          ? subInputs[0]
            ? subInputs.length === 1
              ? `Each item -> ${inputNames[0]}; collects ${subOutputs[0]?.name ?? 'first output'}`
              : `${subInputs.length} inputs (${inputNames.join(', ')}); JSON objects map by name; collects ${subOutputs[0]?.name ?? 'first output'}`
            : 'Body workflow needs at least one Workflow input'
          : 'Saved workflow not found';
      return {
        ...node,
        workflowName,
        retryWith,
        status,
      };
    }));
  }, []);

  const workflowOptions: WorkflowOption[] = useMemo(
    () => Object.keys(savedLibrary).sort().map((name) => ({ name })),
    [savedLibrary],
  );
  const visionModels = useMemo(() => {
    const listed = models.filter((entry) => entry.vision);
    return listed.length
      ? listed
      : FALLBACK_MODELS.filter((entry) => entry.vision);
  }, [models]);

  const flowNodes: Node[] = useMemo(() => {
    const byId = new Map(workflowNodes.map((node) => [node.id, node]));
    const linkedValue = (targetNodeId: string, targetHandleId: string): string | null => {
      const link = edges.find((edge) => edge.target === targetNodeId && edgeInputHandle(edge) === targetHandleId);
      return link ? outputOf(byId.get(link.source), edgeOutputHandle(link)) : null;
    };

    return workflowNodes.map((node) => {
    const shared = {
      nodeId: node.id,
      pendingSourceNodeId: pendingLinkSource?.nodeId ?? null,
      onChange: patchNode,
      onPickOutput: pickOutput,
      onPickInput: pickInput,
      onRemove: removeNode,
    };
    const pendingHandle = pendingLinkSource?.handleId ?? null;
    const spec = (() => {
      switch (node.kind) {
        case 'agent':
          return {
            type: 'flexibleAgent',
            width: 430,
            height: 520,
            data: {
              ...node,
              ...shared,
              thinking: node.thinking ?? DEFAULT_THINKING_LEVEL,
              models,
              running: runningNodeId === node.id,
              onInputChange: patchInput,
              onAddInput: addInput,
              onRemoveInput: removeInput,
              onRun: runNode,
            },
          };
        case 'json':
          return { type: 'flexibleJson', width: 380, height: 430, data: { ...node, ...shared, onRun: runNode } };
        case 'if':
          return {
            type: 'flexibleIf',
            width: 400,
            height: 640,
            data: {
              ...node,
              ...shared,
              running: runningNodeId === node.id,
              pendingSourceHandleId: pendingHandle,
              onRun: runNode,
            },
          };
        case 'split':
          return {
            type: 'flexibleSplit',
            width: 360,
            height: 300 + node.count * 96,
            data: { ...node, ...shared, pendingSourceHandleId: pendingHandle, onRun: runNode },
          };
        case 'imageUpload':
          return {
            type: 'flexibleImageUpload',
            width: 390,
            height: 430,
            data: {
              ...node,
              ...shared,
              pendingSourceHandleId: pendingHandle,
              imageInputDir,
              onUploadImage: uploadImageForNode,
            },
          };
        case 'imageDisplay':
          return {
            type: 'flexibleImageDisplay',
            width: 390,
            height: 420,
            data: {
              ...node,
              ...shared,
              imageUrl: linkedValue(node.id, 'image') ?? node.imageUrl,
              pendingSourceHandleId: pendingHandle,
            },
          };
        case 'imageGenerate':
          const imageInputs = node.inputs?.length ? node.inputs : [{ id: 'input1', name: 'input1', value: '' }];
          return {
            type: 'flexibleImageGenerate',
            width: 440,
            height: 690 + imageInputs.length * 36,
            data: {
              ...node,
              ...shared,
              inputs: imageInputs.map((input) => ({
                ...input,
                value: linkedValue(node.id, input.id) ?? input.value,
              })),
              referenceImage: linkedValue(node.id, 'reference') ?? node.referenceImage,
              running: runningNodeId === node.id,
              pendingSourceHandleId: pendingHandle,
              onInputChange: patchInput,
              onAddInput: addInput,
              onRemoveInput: removeInput,
              onRun: runNode,
            },
          };
        case 'imageText':
          const imageTextInputs = node.inputs?.length ? node.inputs : [{ id: 'input1', name: 'input1', value: '' }];
          return {
            type: 'flexibleImageText',
            width: 440,
            height: 640 + imageTextInputs.length * 36,
            data: {
              ...node,
              ...shared,
              inputs: imageTextInputs.map((input) => ({
                ...input,
                value: linkedValue(node.id, input.id) ?? input.value,
              })),
              imageUrl: linkedValue(node.id, 'image') ?? node.imageUrl,
              model: visionModels.some((entry) => entry.name === node.model) ? node.model : DEFAULT_VISION_MODEL,
              models: visionModels,
              running: runningNodeId === node.id,
              pendingSourceHandleId: pendingHandle,
              onInputChange: patchInput,
              onAddInput: addInput,
              onRemoveInput: removeInput,
              onRun: runNode,
            },
          };
        case 'forEach':
          return {
            type: 'flexibleForEach',
            width: 430,
            height: 900,
            data: {
              ...node,
              ...shared,
              items: linkedValue(node.id, 'items') ?? node.items,
              threshold: node.threshold ?? 95,
              maxAttempts: node.maxAttempts ?? 3,
              retryWith: node.retryWith ?? 'result',
              score: node.score ?? '',
              note: node.note ?? '',
              iterations: node.iterations ?? 0,
              attempts: node.attempts ?? 0,
              trace: node.trace ?? '',
              running: runningNodeId === node.id,
              pendingSourceHandleId: pendingHandle,
              workflowOptions,
              onPickWorkflow: pickBodyWorkflow,
              onRun: runNode,
            },
          };
        case 'promptLoop':
          return {
            type: 'flexiblePromptLoop',
            width: 520,
            height: 1180,
            data: {
              ...node,
              ...shared,
              prompt: linkedValue(node.id, 'prompt') ?? node.prompt,
              models,
              running: runningNodeId === node.id,
              pendingSourceHandleId: pendingHandle,
              onRun: runNode,
            },
          };
        case 'input':
          return { type: 'flexibleWorkflowInput', width: 360, height: 260, data: { ...node, ...shared } };
        case 'output':
          return { type: 'flexibleWorkflowOutput', width: 360, height: 260, data: { ...node, ...shared } };
        case 'workflow':
          return {
            type: 'flexibleWorkflow',
            width: 400,
            height: 320 + (node.inputs.length + node.outputs.length) * 96,
            data: {
              ...node,
              ...shared,
              running: runningNodeId === node.id,
              pendingSourceHandleId: pendingHandle,
              workflowOptions,
              onInputChange: patchInput,
              onPickWorkflow: pickWorkflow,
              onRun: runNode,
            },
          };
        case 'text':
          return { type: 'flexibleText', width: 360, height: 280, data: { ...node, ...shared } };
      }
    })();
    return {
      id: node.id,
      type: spec.type,
      position: node.position,
      measured: nodeSizes[node.id],
      initialWidth: spec.width,
      initialHeight: spec.height,
      data: spec.data,
    };
    });
  }, [workflowNodes, edges, nodeSizes, models, visionModels, runningNodeId, pendingLinkSource, workflowOptions, imageInputDir, patchNode, patchInput, addInput, removeInput, pickOutput, pickInput, pickWorkflow, pickBodyWorkflow, uploadImageForNode, runNode, removeNode]);

  // Highlight the link the context menu is open for.
  const flowEdges: Edge[] = useMemo(
    () => edges.map((edge) => (edge.id === linkMenu?.edgeId ? { ...edge, className: 'is-menu-open' } : edge)),
    [edges, linkMenu],
  );

  return (
    <main className="app-shell">
      <aside className="save-load-window">
        <div className="save-load-group">
          <div className="node-kicker">New</div>
          <button className="compact-action-button" type="button" onClick={newWorkflow} title="Clear the canvas for a new workflow">
            <FilePlus size={12} />
            New workflow
          </button>
        </div>
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
        <div className="save-load-group delete-workflow-group">
          <div className="node-kicker">Delete</div>
          <button
            className="compact-action-button delete-workflow-button"
            type="button"
            onClick={deleteSelectedWorkflow}
            disabled={!selectedWorkflowName}
            title="Delete the selected saved workflow"
          >
            <Trash2 size={12} />
            Delete workflow
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

      <WorkflowLogPanel
        entries={workflowLog}
        workflowName={workflowName}
        runName={runName}
        open={logOpen}
        onClose={() => setLogOpen(false)}
      />
      <button
        type="button"
        className="workflow-log-toggle"
        onClick={() => setLogOpen((open) => !open)}
        title={logOpen ? 'Hide workflow log' : 'Show workflow log'}
        aria-label={logOpen ? 'Hide workflow log' : 'Show workflow log'}
        aria-expanded={logOpen}
      >
        <ScrollText size={15} />
        Log
      </button>

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
              onDragStart={(event) => onDragStart(event, 'imageUpload')}
              onClick={() => addWorkflowNode('imageUpload')}
              title="Click to add, or drag onto the canvas"
            >
              <Upload size={16} />
              <span>Upload image</span>
            </button>
            <button
              className="drawer-item"
              type="button"
              draggable
              onDragStart={(event) => onDragStart(event, 'imageGenerate')}
              onClick={() => addWorkflowNode('imageGenerate')}
              title="Click to add, or drag onto the canvas"
            >
              <Sparkles size={16} />
              <span>Generate image</span>
            </button>
            <button
              className="drawer-item"
              type="button"
              draggable
              onDragStart={(event) => onDragStart(event, 'imageDisplay')}
              onClick={() => addWorkflowNode('imageDisplay')}
              title="Click to add, or drag onto the canvas"
            >
              <Eye size={16} />
              <span>Display image</span>
            </button>
            <button
              className="drawer-item"
              type="button"
              draggable
              onDragStart={(event) => onDragStart(event, 'imageText')}
              onClick={() => addWorkflowNode('imageText')}
              title="Click to add, or drag onto the canvas"
            >
              <Type size={16} />
              <span>Image text</span>
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
              onDragStart={(event) => onDragStart(event, 'forEach')}
              onClick={() => addWorkflowNode('forEach')}
              title="Click to add, or drag onto the canvas"
            >
              <Repeat size={16} />
              <span>Loop workflow</span>
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
            <button
              className="drawer-item"
              type="button"
              draggable
              onDragStart={(event) => onDragStart(event, 'input')}
              onClick={() => addWorkflowNode('input')}
              title="Click to add, or drag onto the canvas"
            >
              <LogIn size={16} />
              <span>Workflow input</span>
            </button>
            <button
              className="drawer-item"
              type="button"
              draggable
              onDragStart={(event) => onDragStart(event, 'output')}
              onClick={() => addWorkflowNode('output')}
              title="Click to add, or drag onto the canvas"
            >
              <LogOut size={16} />
              <span>Workflow output</span>
            </button>
            <button
              className="drawer-item"
              type="button"
              draggable
              onDragStart={(event) => onDragStart(event, 'workflow')}
              onClick={() => addWorkflowNode('workflow')}
              title="Click to add, or drag onto the canvas"
            >
              <Workflow size={16} />
              <span>Workflow</span>
            </button>
          </>
        ) : null}
      </aside>

      <WorkflowCanvas
        resetKey={0}
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={() => undefined}
        onPaneClick={() => undefined}
        connectable
        draggable
        onConnect={onConnect}
        onEdgeContextMenu={onEdgeContextMenu}
        onDrop={onDrop}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
        }}
        onInit={setFlowInstance}
      />
      {linkMenu ? (
        <div
          className="link-context-menu"
          style={{ left: linkMenu.x, top: linkMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              deleteEdge(linkMenu.edgeId);
              setLinkMenu(null);
            }}
          >
            <Trash2 size={13} />
            Delete link
          </button>
        </div>
      ) : null}
    </main>
  );
}
