/**
 * The composed-workflow builder: which nodes exist, how they are linked, and
 * whether each pasted input actually parses.
 *
 * The stage and port contracts come from the backend (`GET /api/stages`) so port
 * names live in exactly one place.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Connection, Edge } from '@xyflow/react';
import {
  fetchStages,
  fetchWorkflow,
  saveWorkflow,
  validatePort,
  type PortCheck,
  type StageCatalog,
  type WorkflowDefinition,
  type WorkflowEdge,
  type WorkflowNode,
} from '../api';

const EMPTY: WorkflowDefinition = { nodes: [], edges: [] };
const VALIDATE_DEBOUNCE_MS = 400;

function newId(kind: string): string {
  return `${kind}-${Date.now()}-${Math.round(Math.random() * 1e4)}`;
}

export function useComposer(slug: string | null, enabled: boolean) {
  const [catalog, setCatalog] = useState<StageCatalog>({ stages: [], ports: [] });
  const [workflow, setWorkflow] = useState<WorkflowDefinition>(EMPTY);
  const [checks, setChecks] = useState<Record<string, PortCheck | null>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStages()
      .then(setCatalog)
      .catch(() => setError('Could not load the stage list'));
  }, []);

  // Loading a run brings its saved workflow with it.
  useEffect(() => {
    if (!slug) {
      setWorkflow(EMPTY);
      return;
    }
    fetchWorkflow(slug)
      .then(setWorkflow)
      .catch(() => setWorkflow(EMPTY));
  }, [slug]);

  const portsById = useMemo(
    () => Object.fromEntries(catalog.ports.map((port) => [port.id, port])),
    [catalog.ports],
  );
  const stagesById = useMemo(
    () => Object.fromEntries(catalog.stages.map((stage) => [stage.id, stage])),
    [catalog.stages],
  );

  const portLabel = useCallback(
    (port: string) => portsById[port]?.label ?? port,
    [portsById],
  );

  /** Persist on every change, so a reload never loses the graph. */
  const persist = useCallback(
    (next: WorkflowDefinition) => {
      setWorkflow(next);
      if (slug) {
        saveWorkflow(slug, next).catch(() => setError('Could not save the workflow'));
      }
    },
    [slug],
  );

  // Re-check pasted text a beat after typing stops.
  const timers = useRef<Record<string, number>>({});
  useEffect(() => {
    if (!enabled) {
      return;
    }
    for (const node of workflow.nodes) {
      if (node.kind !== 'input' || !node.port) {
        continue;
      }
      window.clearTimeout(timers.current[node.id]);
      if (!node.text.trim()) {
        setChecks((current) => ({ ...current, [node.id]: null }));
        continue;
      }
      const { id, port, text } = node;
      timers.current[id] = window.setTimeout(() => {
        validatePort(port, text)
          .then((check) => setChecks((current) => ({ ...current, [id]: check })))
          .catch(() => setChecks((current) => ({ ...current, [id]: null })));
      }, VALIDATE_DEBOUNCE_MS);
    }
  }, [workflow.nodes, enabled]);

  const addStage = useCallback(
    (stageId: string) => {
      persist({
        ...workflow,
        nodes: [
          ...workflow.nodes,
          { id: newId('stage'), kind: 'stage', stage: stageId, port: '', text: '', position: {} },
        ],
      });
    },
    [workflow, persist],
  );

  const addInput = useCallback(
    (portId: string) => {
      persist({
        ...workflow,
        nodes: [
          ...workflow.nodes,
          { id: newId('input'), kind: 'input', stage: '', port: portId, text: '', position: {} },
        ],
      });
    },
    [workflow, persist],
  );

  const removeNode = useCallback(
    (nodeId: string) => {
      persist({
        nodes: workflow.nodes.filter((node) => node.id !== nodeId),
        edges: workflow.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
      });
    },
    [workflow, persist],
  );

  const updateNode = useCallback(
    (nodeId: string, patch: Partial<WorkflowNode>) => {
      persist({
        ...workflow,
        nodes: workflow.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)),
      });
    },
    [workflow, persist],
  );

  const setNodeText = useCallback(
    (nodeId: string, text: string) => updateNode(nodeId, { text }),
    [updateNode],
  );
  const setNodePort = useCallback(
    (nodeId: string, port: string) => updateNode(nodeId, { port }),
    [updateNode],
  );

  /** What a node hands over on a given source handle. */
  const outputPort = useCallback(
    (nodeId: string, handle: string | null): string => {
      const node = workflow.nodes.find((entry) => entry.id === nodeId);
      if (!node) {
        return '';
      }
      return node.kind === 'input' ? node.port : handle || '';
    },
    [workflow.nodes],
  );

  /** A link is only allowed when the two ports carry the same thing. */
  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      const { source, target } = connection;
      if (!source || !target || source === target) {
        return false;
      }
      const targetNode = workflow.nodes.find((entry) => entry.id === target);
      if (!targetNode || targetNode.kind !== 'stage') {
        return false;
      }
      return outputPort(source, connection.sourceHandle ?? null) === (connection.targetHandle ?? '');
    },
    [workflow.nodes, outputPort],
  );

  const connect = useCallback(
    (connection: Connection) => {
      if (!isValidConnection(connection)) {
        setError('Those ports carry different things, so they cannot be linked');
        return;
      }
      const edge: WorkflowEdge = {
        source: connection.source!,
        target: connection.target!,
        source_handle: connection.sourceHandle ?? 'out',
        target_handle: connection.targetHandle ?? '',
      };
      const duplicate = workflow.edges.some(
        (entry) => entry.target === edge.target && entry.target_handle === edge.target_handle,
      );
      persist({
        ...workflow,
        // One source per input port: a second link replaces the first.
        edges: [...workflow.edges.filter((entry) => !(duplicate && entry.target === edge.target
          && entry.target_handle === edge.target_handle)), edge],
      });
      setError(null);
    },
    [workflow, persist, isValidConnection],
  );

  /** Input ports on each stage node that nothing is linked to. */
  const unsatisfied = useMemo(() => {
    const gaps: Record<string, string[]> = {};
    for (const node of workflow.nodes) {
      if (node.kind !== 'stage') {
        continue;
      }
      const stage = stagesById[node.stage];
      if (!stage) {
        continue;
      }
      const linked = new Set(
        workflow.edges.filter((edge) => edge.target === node.id).map((edge) => edge.target_handle),
      );
      gaps[node.id] = stage.inputs.filter((port) => !linked.has(port));
    }
    return gaps;
  }, [workflow, stagesById]);

  const readyToRun =
    workflow.nodes.some((node) => node.kind === 'stage') &&
    Object.values(unsatisfied).every((ports) => ports.length === 0) &&
    workflow.nodes
      .filter((node) => node.kind === 'input')
      .every((node) => checks[node.id]?.ok);

  const clear = useCallback(() => persist(EMPTY), [persist]);

  return {
    catalog,
    workflow,
    checks,
    error,
    unsatisfied,
    readyToRun,
    portLabel,
    stagesById,
    addStage,
    addInput,
    removeNode,
    setNodeText,
    setNodePort,
    connect,
    isValidConnection,
    clear,
    clearError: () => setError(null),
  };
}
