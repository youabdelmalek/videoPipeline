# Cinematic Shot Workflow Plan

## Goal

Turn one short-story paragraph into one approximately 60-second video plan made
of 3-5 second, generation-ready shots. Every shot should state a concrete
camera setup, movement, visible action, setting, and light while preserving the
same location, cast, props, time, and screen direction.

## Existing-node Composition

Use the current flexible workflow nodes only. No new backend stage, React node,
or legacy stage-pipeline code is required.

1. The saved child workflow `Cinematic shot writer and judge` exposes a
   `story` workflow input and an immutable `original_story` workflow input.
   The ForEach loop preserves `original_story` across retries so later passes
   are judged against the real source story, not a previous failed shot list.
2. An existing Agent writes exactly 15 shots with a continuity bible, explicit
   entrances/actions, shot size, angle, focal length in millimeters, and
   measurable camera movement.
3. A second Agent judges the candidate and returns JSON containing `score`,
   `note`, and concrete `fixes`.
4. Existing JSON nodes extract the judge values. An existing If node passes a
   candidate at `95+` or creates a repair request below the threshold. Existing
   repair and selector Agents produce the next candidate and expose workflow
   outputs named `result`, `score`, and `note`.
5. The saved parent workflow `Cinematic one-minute shot loop` sends one story
   item through the existing ForEach loop. It allows four passes and retries
   with the best workflow result, then exposes `shots` as the only workflow
   output. The parent loop still shows score, note, and trace internally for
   debugging. The parent loop threshold is also `95`, so scores below 95 retry
   or fall back as not-passed best attempts.

## Validation

- Open `Cinematic one-minute shot loop` in the existing flexible canvas.
- Run it with the installed Ollama model and the story input.
- Confirm the result contains one story thread, 12-18 shots, 55-65 total
  seconds, stable continuity, concrete camera language, explicit actions, and
  a strong opening and final image.
- Use the loop trace and judge note to diagnose any retained best-of result.