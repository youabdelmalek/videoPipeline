import type { RunState } from '../api';

/** One-line description of how far a run has progressed. */
export function runStateLabel(run: RunState | null): string {
  if (!run) {
    return 'No run loaded';
  }
  if (run.frame_deltas_text) {
    return 'Frame deltas judged and ready';
  }
  if (run.asset_catalog?.some((group) => group.items.length)) {
    return 'Assets extracted, awaiting frame deltas';
  }
  if (run.detailed_videos?.length) {
    return 'Shot lists generated and judged';
  }
  if (run.scenes.length) {
    return 'Standalone videos separated';
  }
  if (run.story_judge_verdict) {
    return `Story judged ${run.story_judge_verdict}`;
  }
  if (run.enhanced_prompt_text) {
    return 'Prompt enhanced, awaiting story';
  }
  return 'Prompt saved, workflow not generated';
}
