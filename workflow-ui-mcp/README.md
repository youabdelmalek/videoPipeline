# Workflow UI MCP

Small stdio MCP server for creating Workflow UI saved workflows as repo files.

It writes JSON files to:

```text
saved-workflows/
```

Those files are loaded by the Workflow UI app.

## Run

```bash
node workflow-ui-mcp/server.js
```

Optional override:

```bash
WORKFLOW_UI_SAVED_WORKFLOWS_DIR=/path/to/saved-workflows node workflow-ui-mcp/server.js
```

## Tools

- `list_workflows`
- `get_workflow`
- `create_workflow`
- `add_node`
- `link_nodes`
- `delete_workflow`

## Node Kinds

Supported `kind` values:

- `input`
- `output`
- `agent`
- `text`
- `json`
- `if`
- `split`
- `workflow`
- `forEach`

## Common Handles

- Most nodes expose source handle `output`.
- `input` nodes expose source handle `output`.
- `output` nodes receive target handle `input`.
- `agent` target handles match its `inputs[].id`, usually `input1`.
- `json`, `text`, `forEach` receive target handle `input` or `items` where applicable.
- `split` receives `input` and `count`; it outputs `output1`, `output2`, etc.
- `if` receives `input1` and `input2`; it outputs `output1` and `output2`.
- `workflow` source handles are `out-<outputName>`.

## Example

Create a simple workflow with one input, one agent, and one output:

```json
{
  "workflow_name": "Example Agent Workflow",
  "run_name": "Run MCP",
  "nodes": [
    { "id": "in", "kind": "input", "name": "input1", "position": { "x": 100, "y": 100 } },
    {
      "id": "agent",
      "kind": "agent",
      "name": "Writer",
      "prompt": "Rewrite this clearly: ${input1}",
      "inputs": [{ "id": "input1", "name": "input1", "value": "" }],
      "position": { "x": 560, "y": 100 }
    },
    { "id": "out", "kind": "output", "name": "result", "position": { "x": 1040, "y": 100 } }
  ],
  "edges": [
    { "source": "in", "sourceHandle": "output", "target": "agent", "targetHandle": "input1" },
    { "source": "agent", "sourceHandle": "output", "target": "out", "targetHandle": "input" }
  ]
}
```
