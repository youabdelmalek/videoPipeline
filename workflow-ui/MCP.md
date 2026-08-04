# Workflow UI MCP

The workspace registers a local MCP server in `.vscode/mcp.json`. It lets
Copilot inspect the Workflow UI catalog, create and update run-backed stage
graphs, save flexible agent/image workflows, and start or inspect jobs.

## Setup

Install the backend requirements once from the repository root:

```powershell
.\.venv\Scripts\python.exe -m pip install -r .\workflow-ui\backend\requirements.txt
```

Keep the Workflow UI backend running on port `8000` and the frontend running on
port `5173`. Then open the workspace in VS Code and enable the
`series-workflow-ui` server from the MCP tools view. The server uses stdio and
does not open a public network port.

## Main tools

- `workflow_ui_catalog` returns the current stage, port, model, and saved workflow catalog.
- `create_composed_workflow` validates a graph, creates a run, saves its workflow, and returns a canvas URL. Set `run_after_save` to start it.
- `update_composed_workflow`, `get_composed_workflow`, and `run_composed_workflow` manage an existing composed workflow.
- `list_flexible_workflows` and `save_flexible_workflow` manage agent/image-node workflows saved in `saved-workflows/`.
- `get_workflow_job` reads background job progress and errors.

Call `workflow_ui_catalog` before creating a workflow so stage ids, port ids,
and installed model names match the running project.