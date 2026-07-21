import { useEffect, useState } from 'react';
import type { DetailedVideo } from './api';
import { RunStatePanel } from './components/RunStatePanel';
import { TopBar } from './components/TopBar';
import { WorkflowCanvas } from './components/WorkflowCanvas';
import { buildGraph } from './graph/buildGraph';
import { useCanvas } from './hooks/useCanvas';
import { useWorkflowRun } from './hooks/useWorkflowRun';
import { DetailPanel } from './nodes';

/** Joins several videos' shot lists into one previewable block of text. */
function shotListText(videos: DetailedVideo[]): string {
  return videos
    .map((video) => `VIDEO ${String(video.index).padStart(2, '0')} - ${video.title}\n\n${video.text}`)
    .join('\n\n');
}

export function App() {
  const workflow = useWorkflowRun();
  const canvas = useCanvas(workflow.run);

  // Manual/legacy controls are hidden by default; the real judge nodes stay visible.
  const [showAdvanced, setShowAdvanced] = useState(false);

  // The detailer expands the polished board when the rewriter produced one.
  const boardVideos = workflow.run?.rewritten_board?.length
    ? workflow.run.rewritten_board
    : (workflow.run?.scenes ?? []);
  const boardIsPolished = Boolean(workflow.run?.rewritten_board?.length);
  const detailed = workflow.run?.detailed_videos ?? [];
  const polished = workflow.run?.rewritten_shots ?? [];

  // Loading a different run starts from a clean layout.
  useEffect(() => {
    canvas.reset();
  }, [workflow.run?.slug]);

  function handleReset() {
    workflow.reset();
    canvas.reset();
  }

  // Shot lists to show: the polished version of a video when there is one.
  const shotLists = detailed.map(
    (draft) => polished.find((entry) => entry.index === draft.index) ?? draft,
  );

  const graph = buildGraph({
    run: workflow.run,
    showAdvanced,
    promptData: {
      prompt: workflow.prompt,
      model: workflow.model,
      models: workflow.models,
      modelsNotice: workflow.modelsNotice,
      runSlug: workflow.run?.slug ?? null,
      disabled: workflow.busy,
      onPromptChange: workflow.setPrompt,
      onModelChange: workflow.setModel,
      onGenerate: workflow.generate,
    },
    videoListData: {
      videos: boardVideos.map((video) => ({
        index: video.index,
        title: video.title,
        shotCount: shotLists.find((entry) => entry.index === video.index)?.shots.length ?? null,
      })),
      promptText: workflow.run?.agent_inputs?.story_separator ?? '',
      boardText: workflow.run?.rewritten_board_text ?? workflow.run?.scenes_text ?? '',
      polished: boardIsPolished,
      disabled: workflow.busy,
      onSplitVideo: workflow.splitVideoShots,
      onSplitAll: workflow.splitAllShots,
      onRewriteBoard: workflow.rewriteBoard,
    },
    shotsListData: {
      videos: shotLists,
      promptText: workflow.run?.agent_inputs?.shot_writer ?? '',
      shotsText: shotLists.length ? shotListText(shotLists) : '',
    },
    assetCatalogData: {
      groups: workflow.run?.asset_catalog ?? [],
      promptText: workflow.run?.agent_inputs?.asset_extractor ?? '',
      text: workflow.run?.asset_catalog_text ?? null,
      judgeVerdict: workflow.run?.asset_judge_verdict ?? null,
      disabled: workflow.busy || !shotLists.length,
      onBuildCatalog: workflow.buildAssetCatalog,
      onRegenerateAsset: workflow.regenerateAsset,
    },
    jsonAssetsData: {
      specs: workflow.run?.json_assets ?? [],
      promptText: workflow.run?.agent_inputs?.json_assets ?? '',
      text: workflow.run?.json_assets_text ?? null,
      judgeVerdict: workflow.run?.json_assets_judge_verdict ?? null,
      // The specifier reads the catalog, so it needs one before it can run.
      disabled: workflow.busy || !(workflow.run?.asset_catalog ?? []).some((group) => group.items.length),
      onBuildJsonAssets: workflow.buildJsonAssets,
      onRegenerateJsonAsset: workflow.regenerateJsonAsset,
    },
    jsonFramesData: {
      frames: workflow.run?.json_frames ?? [],
      promptText: workflow.run?.agent_inputs?.json_frames ?? '',
      text: workflow.run?.json_frames_text ?? null,
      judgeVerdict: workflow.run?.json_frames_judge_verdict ?? null,
      // Needs both a frame plan to work from and asset specs to draw states from.
      disabled:
        workflow.busy
        || !workflow.run?.frame_deltas_text
        || !(workflow.run?.json_assets ?? []).length,
      onBuildJsonFrames: workflow.buildJsonFrames,
      onRegenerateJsonFrame: workflow.regenerateJsonFrame,
    },
    judgeData: {
      text: workflow.run?.judge_text ?? null,
      verdict: workflow.run?.judge_verdict ?? null,
      disabled: workflow.busy || !workflow.run?.scenes.length,
      onJudge: workflow.judge,
    },
    boardRewriterData: {
      text: workflow.run?.rewritten_board_text ?? null,
      provider: workflow.boardProvider,
      disabled: workflow.busy || !workflow.run?.scenes.length,
      onProviderChange: workflow.setBoardProvider,
      onRewrite: workflow.rewriteBoard,
    },
    videoDetailerData: {
      text: detailed.length ? shotListText(detailed) : null,
      sourceLabel: boardIsPolished ? 'polished board' : 'draft board',
      videos: boardVideos.map((video) => ({
        index: video.index,
        title: video.title,
        note: detailed.find((entry) => entry.index === video.index)
          ? `${detailed.find((entry) => entry.index === video.index)?.shots.length} shots`
          : undefined,
      })),
      selected: workflow.detailSelection,
      detailed,
      disabled: workflow.busy || !boardVideos.length,
      onToggleVideo: workflow.toggleDetailVideo,
      onSelectVideos: workflow.selectDetailVideos,
      onDetail: workflow.detailVideos,
    },
    shotRewriterData: {
      text: polished.length ? shotListText(polished) : null,
      videos: detailed.map((video) => ({
        index: video.index,
        title: video.title,
        note: `${video.shots.length} shots / ${video.total_seconds}s`,
      })),
      selected: workflow.rewriteSelection,
      polished,
      provider: workflow.shotProvider,
      disabled: workflow.busy || !detailed.length,
      onToggleVideo: workflow.toggleRewriteVideo,
      onSelectVideos: workflow.selectRewriteVideos,
      onProviderChange: workflow.setShotProvider,
      onRewriteShots: workflow.rewriteShots,
    },
    collapsedNodeIds: canvas.collapsedNodeIds,
    nodePositions: canvas.nodePositions,
    folders: canvas.folders,
    selectedNodeIds: canvas.selectedNodeIds,
    dropTargetFolderId: canvas.dropTargetFolderId,
    callbacks: {
      onToggleCollapse: canvas.toggleCollapse,
      onOpenDetail: canvas.setActiveDetail,
      onStartNodeDrag: canvas.onStartNodeDrag,
      onExpandFolder: canvas.expandFolder,
      onDeleteFolder: canvas.deleteFolder,
    },
  });

  return (
    <main className="app-shell">
      <div className="floating-control-card">
        <TopBar
          runs={workflow.runs}
          currentSlug={workflow.run?.slug ?? null}
          job={workflow.job}
          busy={workflow.busy}
          onLoadRun={workflow.loadRun}
          onDeleteRun={workflow.deleteSelectedRun}
          onReset={handleReset}
          showAdvanced={showAdvanced}
          onToggleAdvanced={() => setShowAdvanced((previous) => !previous)}
        />

        {workflow.error ? <div className="error-bar">{workflow.error}</div> : null}
        {workflow.job?.status === 'error' ? <div className="error-bar">{workflow.job.error}</div> : null}
        {workflow.runMessage ? <div className="notice-bar">{workflow.runMessage}</div> : null}

        <RunStatePanel run={workflow.run} job={workflow.job} />
      </div>

      <WorkflowCanvas
        resetKey={canvas.flowResetKey}
        nodes={graph.nodes}
        edges={graph.edges}
        selectionBox={canvas.selectionBox}
        onNodesChange={canvas.applyNodeChanges}
        onNodeDrag={canvas.onNodeDrag}
        onNodeDragStop={canvas.onNodeDragStop}
        onNodeClick={canvas.onNodeClick}
        onPaneClick={canvas.onPaneClick}
        onMouseDownCapture={canvas.onCanvasMouseDown}
        onContextMenu={canvas.onCanvasContextMenu}
      />

      {canvas.activeDetail ? (
        <DetailPanel detail={canvas.activeDetail} onClose={() => canvas.setActiveDetail(null)} />
      ) : null}
    </main>
  );
}
