# SaltyCritter Yacht Club — Guidelines

Design guidelines for the regatta game. One folder, versioned alongside the code that
implements it.

## Documents

| Document | Covers | Status |
|---|---|---|
| [visual-style.md](visual-style.md) | Brand, color, typography, motion, accessibility, the product shell and HUD chrome, character art, asset specs, review rubric | **v0.5** — current |
| [race-view.md](race-view.md) | Everything drawn on the water: camera, water, venue palettes, land, course overlay, wakes, particles, weather, race-scale sprites | **v1.0** — current |
| [venue-art.md](venue-art.md) | Venue illustration: art direction, owned-hue registry, base prompt, delivery pipeline, acceptance checklist | current |
| [art-pipeline.md](art-pipeline.md) | How art gets *made*: asset classes, roles, anchors, the six-step workflow, acceptance. Tooling in `../art/` | current |
| [music.md](music.md) | The score. Guide (how to write a prompt, judge a take, install it) + reference (cue map, registry, every prompt, every measurement) | **v1.0** — current |
| [skills.md](skills.md) | Competitor stats, archetypes, traits, character shape, venue natives, colour and pattern policy | **v0.1** — proposal |
| [debt.md](debt.md) | The single register of verified visual defects, across all three | current |

**Planned.** `gameplay.md` (course design, venue mechanics, difficulty, feel) ·
`ai.md` (bot behavior, archetypes, tuning philosophy, eval discipline) · `sfx.md`
(the non-musical half of audio: the wind bed, cues, mix). Add them here as
siblings; keep each one narrow.

## The seam

visual-style.md, race-view.md and venue-art.md say what good art **is**;
art-pipeline.md says how it gets **made**. The split between visual-style.md and
race-view.md follows the same line the design decisions do:

> **On the water: broadcast graphics and the illustrated world.
> Above it: the product shell.**

The HUD *chrome* — leaderboard, badges, panels — sits above the line and stays with
visual-style.md. It is product UI that happens to sit over a race.

## References

`references/` holds images that aren't otherwise in the repo — both what the game
looks like now and what it's aiming at.

*Shipped surfaces:*
- `ui-venue-selection.png` — the product shell. **The reference standard.**
- `gameplay-sea-trial-bay.png` / `gameplay-glacier-sound.png` — race view over bright
  and dark water

*Direction:*
- `topdown-world-reference.png` — the top-down idiom: islands, shallow halo, flat
  water, boat and wake
- `sailgp-*.jpg` — broadcast course graphics: mark zones, ladder rungs, distance
  chevrons, boundary ribbon, and wind pressure as colored streaks

Everything else is referenced in place, never duplicated: venue art in
`../assets/images/venues/`, portraits in `../assets/images/competitors/`, boat parts
in `../assets/images/boat-parts/`.

## How these documents work

**Statements are labelled Observed, Rule or Intent.** *Observed* = what the code does
today, verifiable and goes stale. *Rule* = a decision new work must follow, binding
and doesn't go stale. *Intent* = direction not yet realized. An external draft mixed
these and produced rules that were false on inspection; the labels exist to stop that
recurring.

**Citations are symbols, not line numbers** — `renderVenuePicker()`,
`#start-race-btn`, `WATER_CONFIG`. Line numbers in `script.js` go stale within a
session. Everything cited is greppable.

**Four directions are settled** and shouldn't be relitigated without a reason:

1. The card art governs palette and mood; the **view** governs construction — so the
   race view keeps its own top-down idiom for land and wakes.
2. The HUD chrome stays the navy product shell; SailGP influence is confined to what
   is drawn on the water.
3. The game targets desktop at 1280–2560 wide; mobile is out of scope.
4. Colors come from the Tailwind v3 default scale unless there's a reason; the six
   exceptions are listed in visual-style.md §4.5.

## Maintaining

When you change a color, font, radius or asset spec in code, update the matching
Observed row in the same commit. When a [debt.md](debt.md) item lands, delete the row
and move whatever it established into the relevant Observed section.
