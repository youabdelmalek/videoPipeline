import type { JobState, RunState } from '../api';
import { runStateLabel } from '../lib/runStatus';
import { ProcessingPanel } from './ProcessingPanel';

type Props = { run: RunState | null; job: JobState | null };

export function RunStatePanel({ run, job }: Props) {
  const stats: { label: string; value: string | number }[] = [
    { label: 'State', value: runStateLabel(run) },
    { label: 'Enhanced', value: run?.enhanced_prompt_text ? 'Ready' : 'Not run' },
    { label: 'Story', value: run?.story_judge_verdict ?? 'Not run' },
    { label: 'Videos', value: run?.scenes.length ?? 0 },
    { label: 'Shots', value: run?.detailed_videos?.reduce((sum, video) => sum + video.shots.length, 0) ?? 0 },
    {
      label: 'Assets',
      value: run?.asset_catalog?.reduce((sum, group) => sum + group.items.length, 0) ?? 0,
    },
    { label: 'Frames', value: run?.frame_judge_verdict ?? 'Not run' },
    { label: 'Artifacts', value: run?.artifacts.length ?? 0 },
  ];

  return (
    <section className="run-state-panel" aria-label="Current run state">
      <div className="run-state-summary">
        <div>
          <span className="eyebrow">Current Run</span>
          <strong>{run?.slug ?? 'Unsaved prompt'}</strong>
        </div>
        {stats.map((stat) => (
          <div key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </div>
      <ProcessingPanel job={job} />
    </section>
  );
}
