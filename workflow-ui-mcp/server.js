#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SERVER_VERSION = '0.1.0';
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const savedDir = process.env.WORKFLOW_UI_SAVED_WORKFLOWS_DIR
  ? path.resolve(process.env.WORKFLOW_UI_SAVED_WORKFLOWS_DIR)
  : path.join(repoRoot, 'saved-workflows');

function slugFor(name) {
  const slug = String(name ?? '').trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^[.-]+|[.-]+$/g, '').slice(0, 120);
  if (!slug) {
    throw new Error('workflow_name is required');
  }
  return slug;
}

function workflowPath(name) {
  return path.join(savedDir, `${slugFor(name)}.json`);
}

function readWorkflowFile(name) {
  const file = workflowPath(name);
  if (!fs.existsSync(file)) {
    return { name, workflow: { runs: {} } };
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeWorkflowFile(name, workflow) {
  fs.mkdirSync(savedDir, { recursive: true });
  const file = workflowPath(name);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify({ name, workflow }, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
  return file;
}

function listWorkflowFiles() {
  if (!fs.existsSync(savedDir)) {
    return [];
  }
  return fs.readdirSync(savedDir)
    .filter((entry) => entry.endsWith('.json'))
    .map((entry) => {
      const file = path.join(savedDir, entry);
      try {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        return {
          name: typeof data.name === 'string' ? data.name : path.basename(entry, '.json'),
          runs: Object.keys(data.workflow?.runs ?? {}).sort(),
          file,
        };
      } catch (error) {
        return { name: path.basename(entry, '.json'), runs: [], file, error: String(error.message ?? error) };
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function latestRunName(savedWorkflow) {
  const runs = savedWorkflow.workflow?.runs ?? {};
  const entries = Object.entries(runs);
  if (!entries.length) {
    return null;
  }
  return entries.sort(([, a], [, b]) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0][0];
}

function getRun(savedWorkflow, runName, create = false) {
  const workflow = savedWorkflow.workflow ?? { runs: {} };
  workflow.runs ??= {};
  savedWorkflow.workflow = workflow;
  const selected = runName || latestRunName(savedWorkflow) || 'Run MCP';
  if (!workflow.runs[selected]) {
    if (!create) {
      throw new Error(`Run not found: ${selected}`);
    }
    workflow.runs[selected] = { nodes: [], edges: [], updatedAt: Date.now() };
  }
  return { runName: selected, snapshot: workflow.runs[selected] };
}

function nextPosition(index) {
  return { x: 120 + (index % 3) * 460, y: 120 + Math.floor(index / 3) * 360 };
}

function nextOrder(nodes) {
  return nodes.reduce((max, node) => Math.max(max, Number(node.order) || 0), 0) + 1;
}

function defaultNode(kind, id, order, position, config = {}) {
  const base = { id, kind, order, position };
  switch (kind) {
    case 'input':
      return { ...base, name: config.name ?? `input${order}`, value: config.value ?? '' };
    case 'output':
      return { ...base, name: config.name ?? `output${order}`, value: config.value ?? '' };
    case 'agent':
      return {
        ...base,
        name: config.name ?? `Agent ${order}`,
        prompt: config.prompt ?? 'Use ${input1} and produce a clear string output.',
        model: config.model ?? 'VladimirGav/gemma4-26b-16GB-VRAM',
        inputs: config.inputs ?? [{ id: 'input1', name: 'input1', value: '' }],
        output: config.output ?? '',
      };
    case 'text':
      return {
        ...base,
        name: config.name ?? `Text ${order}`,
        text: config.text ?? '',
        hasInput: config.hasInput ?? true,
        hasOutput: config.hasOutput ?? true,
      };
    case 'json':
      return {
        ...base,
        name: config.name ?? `JSON ${order}`,
        input: config.input ?? '',
        path: config.path ?? 'a.b',
        output: config.output ?? '',
        error: config.error ?? null,
      };
    case 'if':
      return {
        ...base,
        name: config.name ?? `If ${order}`,
        input1: config.input1 ?? '',
        input2: config.input2 ?? '',
        condition: config.condition ?? '${input1} == "pass"',
        prompt: config.prompt ?? 'Revise this so it passes the check: ${input2}',
        output1: config.output1 ?? '',
        output2: config.output2 ?? '',
        status: config.status ?? '',
      };
    case 'split':
      return {
        ...base,
        name: config.name ?? `Split ${order}`,
        input: config.input ?? '',
        delimiter: config.delimiter ?? ',',
        count: config.count ?? 2,
        outputs: config.outputs ?? [],
      };
    case 'workflow':
      return {
        ...base,
        name: config.name ?? `Workflow ${order}`,
        workflowName: config.workflowName ?? '',
        inputs: config.inputs ?? [],
        outputs: config.outputs ?? [],
        status: config.status ?? '',
      };
    case 'forEach':
      return {
        ...base,
        name: config.name ?? `For Each ${order}`,
        items: config.items ?? '[]',
        workflowName: config.workflowName ?? '',
        output: config.output ?? '',
        iterations: config.iterations ?? 0,
        status: config.status ?? '',
      };
    default:
      throw new Error(`Unsupported node kind: ${kind}`);
  }
}

function normalizeEdge(edge) {
  if (!edge.source || !edge.target) {
    throw new Error('Edge needs source and target');
  }
  const sourceHandle = edge.sourceHandle ?? edge.source_handle ?? 'output';
  const targetHandle = edge.targetHandle ?? edge.target_handle ?? 'input';
  return {
    id: edge.id ?? `${edge.source}:${sourceHandle}->${edge.target}:${targetHandle}`,
    source: edge.source,
    target: edge.target,
    sourceHandle,
    targetHandle,
  };
}

function contentJson(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

const tools = [
  {
    name: 'list_workflows',
    description: 'List saved Workflow UI workflows stored as repo JSON files.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_workflow',
    description: 'Read one saved workflow file, including all runs, nodes, and links.',
    inputSchema: {
      type: 'object',
      properties: { workflow_name: { type: 'string' } },
      required: ['workflow_name'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_workflow',
    description: 'Create or replace a saved workflow run. Optionally seed it with nodes and edges.',
    inputSchema: {
      type: 'object',
      properties: {
        workflow_name: { type: 'string' },
        run_name: { type: 'string', default: 'Run MCP' },
        nodes: { type: 'array', items: { type: 'object' }, default: [] },
        edges: { type: 'array', items: { type: 'object' }, default: [] },
        replace: { type: 'boolean', default: true },
      },
      required: ['workflow_name'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_node',
    description: 'Add one node to a saved workflow run. Supports input, output, agent, text, json, if, split, workflow, and forEach.',
    inputSchema: {
      type: 'object',
      properties: {
        workflow_name: { type: 'string' },
        run_name: { type: 'string' },
        kind: { type: 'string', enum: ['input', 'output', 'agent', 'text', 'json', 'if', 'split', 'workflow', 'forEach'] },
        id: { type: 'string' },
        name: { type: 'string' },
        position: {
          type: 'object',
          properties: { x: { type: 'number' }, y: { type: 'number' } },
          additionalProperties: false,
        },
        config: { type: 'object', default: {} },
      },
      required: ['workflow_name', 'kind'],
      additionalProperties: false,
    },
  },
  {
    name: 'link_nodes',
    description: 'Create or replace a link from one node output handle to one node input handle.',
    inputSchema: {
      type: 'object',
      properties: {
        workflow_name: { type: 'string' },
        run_name: { type: 'string' },
        source_id: { type: 'string' },
        target_id: { type: 'string' },
        source_handle: { type: 'string', default: 'output' },
        target_handle: { type: 'string', default: 'input' },
      },
      required: ['workflow_name', 'source_id', 'target_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_workflow',
    description: 'Delete a saved workflow file from the repo.',
    inputSchema: {
      type: 'object',
      properties: { workflow_name: { type: 'string' } },
      required: ['workflow_name'],
      additionalProperties: false,
    },
  },
];

async function callTool(name, args = {}) {
  if (name === 'list_workflows') {
    return contentJson({ saved_dir: savedDir, workflows: listWorkflowFiles() });
  }
  if (name === 'get_workflow') {
    return contentJson(readWorkflowFile(args.workflow_name));
  }
  if (name === 'create_workflow') {
    const saved = readWorkflowFile(args.workflow_name);
    const runName = args.run_name || 'Run MCP';
    const normalizedNodes = (args.nodes ?? []).map((node, index) => {
      if (!node.kind) {
        throw new Error(`Node ${index + 1} needs kind`);
      }
      return defaultNode(
        node.kind,
        node.id ?? `${node.kind}-${index + 1}`,
        node.order ?? index + 1,
        node.position ?? nextPosition(index),
        node,
      );
    });
    const snapshot = {
      nodes: normalizedNodes,
      edges: (args.edges ?? []).map(normalizeEdge),
      updatedAt: Date.now(),
    };
    if (args.replace ?? true) {
      saved.workflow = { runs: { [runName]: snapshot } };
    } else {
      saved.workflow ??= { runs: {} };
      saved.workflow.runs ??= {};
      saved.workflow.runs[runName] = snapshot;
    }
    const file = writeWorkflowFile(args.workflow_name, saved.workflow);
    return contentJson({ workflow_name: args.workflow_name, run_name: runName, file, snapshot });
  }
  if (name === 'add_node') {
    const saved = readWorkflowFile(args.workflow_name);
    const { runName, snapshot } = getRun(saved, args.run_name, true);
    const id = args.id || `${args.kind}-${Date.now()}`;
    if (snapshot.nodes.some((node) => node.id === id)) {
      throw new Error(`Node id already exists: ${id}`);
    }
    const config = { ...(args.config ?? {}), ...(args.name ? { name: args.name } : {}) };
    const node = defaultNode(args.kind, id, nextOrder(snapshot.nodes), args.position ?? nextPosition(snapshot.nodes.length), config);
    snapshot.nodes.push(node);
    snapshot.updatedAt = Date.now();
    const file = writeWorkflowFile(args.workflow_name, saved.workflow);
    return contentJson({ workflow_name: args.workflow_name, run_name: runName, file, node });
  }
  if (name === 'link_nodes') {
    const saved = readWorkflowFile(args.workflow_name);
    const { runName, snapshot } = getRun(saved, args.run_name, true);
    if (!snapshot.nodes.some((node) => node.id === args.source_id)) {
      throw new Error(`Source node not found: ${args.source_id}`);
    }
    if (!snapshot.nodes.some((node) => node.id === args.target_id)) {
      throw new Error(`Target node not found: ${args.target_id}`);
    }
    const edge = normalizeEdge({
      source: args.source_id,
      target: args.target_id,
      sourceHandle: args.source_handle ?? 'output',
      targetHandle: args.target_handle ?? 'input',
    });
    snapshot.edges = [edge, ...snapshot.edges.filter((item) => !(item.target === edge.target && item.targetHandle === edge.targetHandle))];
    snapshot.updatedAt = Date.now();
    const file = writeWorkflowFile(args.workflow_name, saved.workflow);
    return contentJson({ workflow_name: args.workflow_name, run_name: runName, file, edge });
  }
  if (name === 'delete_workflow') {
    const file = workflowPath(args.workflow_name);
    if (!fs.existsSync(file)) {
      throw new Error(`Workflow not found: ${args.workflow_name}`);
    }
    fs.unlinkSync(file);
    return contentJson({ deleted: args.workflow_name, file });
  }
  throw new Error(`Unknown tool: ${name}`);
}

function send(message) {
  const body = JSON.stringify(message);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`);
}

async function handle(message) {
  if (!message.id && message.method?.startsWith('notifications/')) {
    return;
  }
  try {
    if (message.method === 'initialize') {
      send({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          protocolVersion: message.params?.protocolVersion ?? '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'workflow-ui-mcp', version: SERVER_VERSION },
        },
      });
      return;
    }
    if (message.method === 'tools/list') {
      send({ jsonrpc: '2.0', id: message.id, result: { tools } });
      return;
    }
    if (message.method === 'tools/call') {
      const result = await callTool(message.params?.name, message.params?.arguments ?? {});
      send({ jsonrpc: '2.0', id: message.id, result });
      return;
    }
    send({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: `Method not found: ${message.method}` } });
  } catch (error) {
    send({
      jsonrpc: '2.0',
      id: message.id,
      error: { code: -32000, message: String(error.message ?? error) },
    });
  }
}

let buffer = Buffer.alloc(0);
process.stdin.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (true) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) {
      return;
    }
    const header = buffer.slice(0, headerEnd).toString('utf8');
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      buffer = buffer.slice(headerEnd + 4);
      continue;
    }
    const length = Number(match[1]);
    const messageStart = headerEnd + 4;
    const messageEnd = messageStart + length;
    if (buffer.length < messageEnd) {
      return;
    }
    const raw = buffer.slice(messageStart, messageEnd).toString('utf8');
    buffer = buffer.slice(messageEnd);
    handle(JSON.parse(raw));
  }
});

process.stdin.resume();
