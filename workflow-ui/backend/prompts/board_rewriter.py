"""Board rewriter prompt: sharpen twists, humour, and logic without redesigning.

Deliberately a *doctor* pass, not a writer pass - it must not change the shape
of the series, only the quality of each video, and it must protect the finale.
"""

from __future__ import annotations

from backend.models import (
    MAX_TOTAL_VIDEO_WORDS,
    MAX_VIDEO_BEATS,
    MAX_VIDEO_CARD_WORDS,
    MIN_VIDEO_BEATS,
    MIN_VIDEO_BULLETS,
)
from backend.utils.parser import parse_scene_cards


def board_rewriter_prompt(story_idea: str, story_pack: str, board_text: str) -> str:
    cards = parse_scene_cards(board_text)
    expected_count = len(cards) or MIN_VIDEO_BULLETS
    final_video = f"VIDEO {expected_count:02d}"

    return f"""You are the Video Board Doctor for a short-form AI-video series.

You receive a VIDEO BULLET BOARD: a batch of standalone 60-90 second video concepts written as compact beat bullets. Your job is to make that board land harder on three axes - TWIST, HUMOR, and LOGIC - while protecting the finale reveal.

You are a script doctor, not a new writer. Keep the SHAPE of the season that already exists - the same videos, in the same order, telling the same story. Inside that shape, rewrite as hard as the material needs. Preserving the original wording is worth nothing if the beats do not hold up.

Assume this board has logic holes in it. Your first job is to find them. A board that reads smoothly is not the same as a board that holds together, and this one has already been drafted by a weaker writer than you.

SERIES PREMISE:
{story_idea.strip()}

PACKED STORY:
{story_pack.strip()}

CURRENT VIDEO BULLET BOARD:
{board_text.strip()}

LOGIC AUDIT - DO THIS BEFORE YOU WRITE ANYTHING:
Work through the board one video at a time and interrogate it. For each video, answer these questions to yourself:
- Walk the beats in order. For each beat, name the earlier beat that forces it to happen. Any beat you cannot connect backwards is a hole.
- Who knows what, and when did they learn it? Track this per character across the video. A character acting on information they were never given is a hole.
- What is physically required for each beat to be possible - access, tools, time, distance, strength, numbers? A beat nobody present could actually perform is a hole.
- Why does the antagonist's plan need this specific event? If the plan works just as well without the video's central action, the video has no stakes.
- What is the obvious question a smart character would ask here, and why does nobody ask it? "Nobody thought of it" is not an answer.
- Does this video contradict the PACKED STORY, or any other video on the board? Check names, timelines, established capabilities, and who was present where.
Then rewrite the video so every one of those answers holds. Fix the cause, not the symptom: if a beat only works because a character is inexplicably stupid, change the situation so a smart character would still be trapped.

TWIST QUALITY:
- Every video needs two real turns: Twist 1 near the middle, Twist 2 / Payoff near the end.
- A twist must reframe something the viewer already saw. It is not a twist if it introduces a brand new element out of nowhere.
- Replace any twist a viewer could predict from the video's first three beats.
- The two twists in a video must differ in kind. Do not run the same reversal twice.
- Across the board, do not reuse the same twist mechanism more than twice.

SERIES VARIETY - EVERY EPISODE MUST EARN ITS PLACE:
- Each video must reveal something the audience did not already know. Name to yourself what each video teaches, then check that no two videos teach the same thing.
- If two videos land on the same discovery, rewrite the weaker one to uncover a different piece of the picture. Do not settle for rewording the same beat.
- Vary the KIND of revelation across the board: a method, a motive, a location, a hidden participant, a timeline, a rule of the world, a scale, a relationship. Do not run the same kind twice in a row.
- Vary the EVIDENCE too. Do not keep using the same prop, document, sound, or trace as the clue. If a silver object, a missing recording, or an unsigned order already did the work in one video, the next video needs a different sort of evidence.
- Across the whole board, no single clue type should appear more than twice, and never in consecutive videos.
- Escalate what is at stake in what gets revealed. A later video should not reveal something smaller than an earlier one already did.
- The audience should finish each video knowing strictly more than when it started, and should never feel a video restated the previous one.
- These are episode-level discoveries about the conspiracy, NOT the season reveal. Revealing more each video must never mean edging closer to naming the answer. REVEAL PROTECTION below still wins.

HUMOR:
- The comedy comes from character behavior, escalating stakes, and absurd logic played completely straight.
- Jokes must ride on plot beats. Never add a joke bullet that stops the story to be funny.
- Aim for two or three genuinely funny beats per video. Do not turn every bullet into a gag.
- Keep it PG-13. No cruelty, no punching down, no gore.

LOGIC - THE HIGHEST PRIORITY AXIS:
Hunt these specific failures and rewrite every one you find. Be harsh. It is better to rebuild a video's middle than to ship a beat that does not survive a second viewing.
- CONVENIENCE: a problem solved by luck, timing, or something that happens to be lying there. Make the solution come from a choice a character made earlier, on screen.
- UNEARNED KNOWLEDGE: a character knows something the story never gave them. Either show them learning it or have them get it wrong.
- IDIOT PLOT: the video only works because someone fails to ask, look, or check. Remove the option instead of removing their intelligence.
- CAPABILITY DRIFT: a character does something the story has not established they can do. Either plant the capability earlier or change the action.
- WEIGHTLESS STAKES: nothing is actually lost if the character fails. Attach a concrete, visible cost to failure.
- OFFSCREEN MIRACLE: the hard part happens between beats. Put the hard part on screen and make it cost something.
- CONTRADICTION: it conflicts with the PACKED STORY or another video - names, timeline, geography, who was present, what was established as impossible.
- UNMOTIVATED ACTION: a character acts because the plot needs it. Give them a want that makes the action the obvious move for them.
Also hold these:
- Every beat must be caused by the beat before it. Delete coincidences that conveniently solve problems.
- Each character must want something concrete and act on it for reasons the viewer can see.
- Keep the world's rules consistent: if something was established as impossible, it stays impossible.
- The antagonist must be competent. If their scheme only survives because everyone else is slow, tighten the scheme.

PRECEDENCE WHEN RULES COLLIDE:
1. Protect the finale reveal.
2. Fix the logic.
3. Sharpen the twists.
4. Land the humor.
5. Keep the original wording.
Rule 5 is the one you sacrifice. If a beat cannot be made to hold, replace it outright rather than patching around it.

REVEAL PROTECTION (most important):
- The reveal in {final_video} is the season's cliffhanger payoff. It must stay hidden until {final_video}.
- Every video before {final_video} may plant clues, but must never state, show, or let a character correctly deduce the answer.
- Pre-finale clues must misdirect: impossible supply-chain timing, unsigned orders, missing footage, contradictory witnesses, strange accounting, frightened behavior, an unseen voice, orders given offscreen.
- Before {final_video}, do not use language that identifies the answer's size, species, diet, habitat, body parts, or characteristic sounds.
- For the Mouse Crime Boss premise specifically, do not use small, tiny, little, miniature, mouse, rat, rodent, cheese, crumbs, squeak, nibble, whisker, tail, paw, burrow, herbivore, seed, grain, or vegetarian before {final_video}.
- {final_video} must explicitly deliver the reveal and make the earlier clues feel earned in hindsight.
- If the current board leaks the reveal early, rewrite those beats into misdirection. This overrides keeping the original wording.

DO NOT CHANGE:
- Do not add, remove, merge, split, or reorder videos.
- Keep the same VIDEO numbering and order.
- Keep every video standalone: any one can be watched first and still make sense.
- Keep each title unless it spoils the reveal or no longer matches the rewritten beats.
- Preserve the continuity clues that connect the season, even while improving them.
- These constrain the board's STRUCTURE only. Nothing here protects a beat that does not hold up - rewrite those freely.

FINAL CHECK BEFORE YOU ANSWER:
Reread your rewritten board as a hostile viewer looking for holes. For every video, confirm:
- Each beat is forced by an earlier beat, not by convenience.
- No character acts on knowledge the story never gave them.
- No beat depends on someone failing to ask an obvious question.
- Nothing contradicts the PACKED STORY or another video.
- Failure would cost the characters something concrete and visible.
- This video reveals something no other video on the board reveals, using evidence the board has not already leaned on.
If any video still fails, fix it before you answer. Do not hand back a board you know has a hole in it.

OUTPUT CONTRACT:
- Return plain text only. Do not output JSON. Do not use Markdown code fences.
- Do not explain your changes. Output only the rewritten board.
- Write exactly {expected_count} VIDEO sections.
- Use this exact heading format for every section: VIDEO 01 - Short title
- Under each heading, write {MIN_VIDEO_BEATS}-{MAX_VIDEO_BEATS} compact beat bullets starting with "- ".
- Each bullet must be one short line under 18 words.
- Every section must include clearly labeled Twist 1, Twist 2 / Payoff, Standalone payoff, and Continuity clue beats.
- Keep each video section under {MAX_VIDEO_CARD_WORDS} words and the whole answer under {MAX_TOTAL_VIDEO_WORDS} words.
"""
