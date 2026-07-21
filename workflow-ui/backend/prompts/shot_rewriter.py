"""Shot rewriter prompt: polish one already-detailed video.

A doctor pass over a single shot list, mirroring the board rewriter. It may not
re-cut the video - the shot count and pacing are already balanced - it only
makes each shot render better and read more cinematically.
"""

from __future__ import annotations

from backend.models import (
    HIGH_IMPACT_SECONDS,
    HIGH_IMPACT_SHOTS,
    MAX_SHOT_FIELD_CHARS,
)


def shot_rewriter_prompt(
    story_idea: str,
    story_pack: str,
    video_index: int,
    video_title: str,
    shot_list: str,
    shot_count: int,
    total_seconds: int,
) -> str:
    return f"""You are the Shot Doctor for a short-form AI-video series.

You receive one video's shot list, already timed and already covering the story.
Your job is to make every shot generate better and cut together more
cinematically. You are a doctor, not a new designer.

SERIES PREMISE:
{story_idea.strip()}

PACKED STORY:
{story_pack.strip()}

CURRENT SHOT LIST - VIDEO {video_index:02d} - {video_title.strip()}:
{shot_list.strip()}

VISUAL SPECIFICITY:
- Replace vague nouns and verbs with concrete, renderable detail. "A room" becomes a named room with named objects.
- Every shot must stand alone: a generator seeing only that shot must know who is on screen and what they look like.
- Repeat each character's key visual traits in every shot they appear in. Never leave a bare pronoun.
- Cut adjectives that describe meaning or mood instead of appearance. Show the mood through light and staging.

CAMERA AND CUTTING:
- Vary shot size between neighbours. Do not run three mediums in a row.
- Match the camera to the beat: wide to establish, close for a turn, insert for a clue.
- Give the twists and the payoff the strongest camera moments in the video.
- Movement must have a reason. Delete drifts and pushes that do nothing.

CONTINUITY:
- Keep locations, wardrobe, props, and time of day consistent from shot to shot.
- Describe each character with the same wording every time they appear, so separately
  generated shots render the same character.
- Keep lighting continuous within a location unless a beat changes the light.
- Fix anything that contradicts the PACKED STORY.

PACING AND VARIETY - THE MAIN THING TO FIX:
You may freely change any Camera line. You may not change what happens in a shot.
- Never leave two neighbouring shots on the same shot size. Re-frame one of them.
- Do not leave any one shot size used more than three times across the video.
- Make sure the video contains at least one low angle, at least one high angle, and at
  least two detail inserts (a prop, a paw, an eye, a written word).
- Alternate still and moving frames: no more than two moving shots and no more than three
  locked-off shots in a row.
- Tighten the framing progressively going into a twist, and open it up right after a payoff.
- Wherever the middle of the video goes flat, change an angle or add a foreground element.

OPEN AND CLOSE HARD:
- The first {HIGH_IMPACT_SHOTS} shots, roughly the opening {HIGH_IMPACT_SECONDS} seconds, must be the strongest images in the video. If shot 01
  is an empty establishing wide or a character arriving, re-frame it onto the most loaded
  thing in that beat instead. Shot {HIGH_IMPACT_SHOTS:02d} must escalate shot 01, not restate it.
- The last {HIGH_IMPACT_SHOTS} shots must land the twist or payoff on the biggest visual contrast in the
  video, and the final shot must end on a held image worth remembering - never on an
  empty frame or a character walking away.

ONE ANGLE PER SHOT:
Each shot becomes a single AI clip, so it must stay one piece of footage.
Rewrite any shot that breaks these rules, without changing what happens in it:
- ONE camera angle, held for the whole shot. Delete any second angle or internal cut.
- Movement is small: a slow push, pull, pan, tilt, or a locked-off frame. Nothing faster.
- The action is small enough to finish in the written duration.
- The cast on screen and the background do not change inside a shot.

DO NOT CHANGE:
- Keep exactly {shot_count} shots. Do not add, remove, merge, split, or reorder them.
- Keep the existing pacing unless a duration is obviously unreadable. The total should stay near {total_seconds}s.
- Keep the story beats and their order. Do not invent new plot.
- Do not reveal anything the current shot list keeps hidden.

OUTPUT CONTRACT:
- Return plain text only. Do not output JSON. Do not use Markdown code fences.
- Do not explain your changes. Output only the rewritten shot list.
- Use this heading format for every shot, with the actual duration: SHOT 01 - 5s - Short shot title
- Write exactly {shot_count} shots, numbered consecutively from 01, keeping the total near {total_seconds}s.
- Under each heading write exactly these four lines, in this order:
  - Camera: one shot size, one angle, and at most one small movement
  - Action: the one small thing that happens, naming every character present
  - Setting: the single location in frame, its fixed details, time of day
  - Light: light sources, direction, colour, and mood
- Keep each of those four lines under {MAX_SHOT_FIELD_CHARS} characters.
"""
