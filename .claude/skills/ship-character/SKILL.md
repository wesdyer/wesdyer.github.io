---
name: ship-character
description: Add a new regatta competitor end to end — the manifest portrait entry Wes generates from, prepping his delivered portrait, and the roster record, spinnaker pattern, quotes and unlock wiring. Use when a venue needs a new character, when Wes asks for a character prompt, or when he delivers portraits ("How are these?", "Ship them").
---

# Ship a character

The roster is 107. The seven added Sep 25 2026 were Wake, Fuzz, Oar, Bask, Wisp, Diver and
Timber; each followed these steps.

## A. The prompt (before Wes generates)

Wes runs `python3 regatta/art/prompt.py <key>`, which reads the character's `portrait`
entry in `regatta/art/manifest.json`. **Never hand-write a prompt file.** Bask was written
only into a .md file, and Wes hit `KeyError: 'bask'`.

1. Check for an existing slot first: `grep -n '"key": "<key>"' regatta/art/manifest.json`.
   Many planned characters are already slotted.
2. If there is none, insert an entry modelled on its neighbours (the subject in the house
   format: EXPRESSION / GESTURE / LIMBS / BODY COVERING / ITS OWN COLOUR / PFD COLOURS /
   SPECIES SIGNATURE / REQUIRED + note).
   - Write the file back with `json.dumps(m, indent=2, ensure_ascii=False) + "\n"`, which
     round-trips it byte for byte.
   - The vest colours in the subject ARE the proposed hull and spinnaker.
3. Run `prompt.py <key>` yourself to prove it resolves, then tell Wes the command.
4. **Delivery ask:** a square transparent PNG saved as `~/Desktop/<key>.png`, with the dark
   outline straight onto transparency and no light halo or sticker rim.

## B. The portrait (when Wes delivers)

```sh
python3 regatta/art/ship_portrait.py <key> --check   # measure only; ships nothing
python3 regatta/art/ship_portrait.py <key>           # ship it   (--peel if it has a halo)
```

This chains `prep_master.py` (the roster framing: span 0.86, CX 0.51 / CY 0.50), then
`ingest.py` (portrait profile, 500 px, into `assets/images/competitors/<key>.png`), then
`review.measure`. It prints:
- the rim-light share (a halo above 25% is refused until you pass `--peel`);
- the silhouette aspect against the roster's range;
- the animal and vest colours;
- the outline weight;

and writes `art/review/ship_<key>.png` at picker sizes beside shipped portraits.

**Look at the sheet.** The vest flag is advisory: a vest hidden by limbs measures as fur
(Timber). Show Wes the sheet and point out any problems; ship when he says so.

## C. The racer

1. **`js/ai/roster.js` AI_CONFIG record.** Fields: `name`, `creature`, `hull`, `spinnaker`,
   `spinnaker2`, `sail`, `cockpit`, `personality`, `beat`, `archetype`, `stats` (the ten
   stats).
   - **Colours:** measure the vest off the shipped portrait (review.measure prints it); the
     manifest note has the proposed pair.
   - **Hull clash:** compare the new hull against every existing hull with `review.dE`
     (`python3 -c "import sys; sys.path.insert(0,'regatta/art'); import review; ..."`). A
     near-match within the same venue is a clash: Diver's amber hull was too close to Bask's
     boat, so it became black (`#1E2428`).
   - **Stats** carry the design intent. The venue's four-star capstone must be +3 or better.
     A gentle boat (Fuzz) sits around tier C/D. Archetypes are in `guidelines/skills.md`.
2. **`js/render/sprites.js` SPIN_LOOKS:** give it a pattern (`solid`, `halves`,
   `crosshalves`, `gores`, `stripes`, `rays`, `fiverays`, `triangle`, `thirds`, `chevron`,
   `sunburst`, `tricolour`). Prefer an under-used one that doesn't copy a venue-mate.
3. **`js/ai-quotes.js`:** add 14 lines with these keys: player_passes_them, they_pass_player,
   they_hit_player, they_were_hit, narrowly_avoided_collision,
   player_narrowly_avoided_collision, moved_into_first, moved_into_last, rounded_mark,
   first_across_start, finished_race, prestart, start_planing, random. Write them in the
   character's voice, short.
4. **Unlocks:** the character's row in `js/game/unlocks.js` usually exists already, since
   objectives go live before the art. Remove the name from `unshipped` in
   `eval/test_unlocks.js`, and update the "shipped" comment in the venue's section.
5. **Docs:** bold the character in `guidelines/venue-roster.md`.
   - `guidelines/roster.md` is generated from the last rating campaign, so the new
     character has no measured tier until the next campaign (`eval/RATING.md`). Don't
     invent a measurement.
   - Don't re-record golden traces (Wes's call; every roster entry changes fleet draws).

## D. Verify

- `node regatta/eval/test_unlocks.js`, `test_pages.js`, `test_character_swap.js`, run from
  the repo root.
- Open `editor.html` → Fleet: the card shows the portrait, boat and stat strip. Render it
  headless if in doubt.
- If Wes says a character is missing from a view, render that view first. On Sep 25 it was his
  open tab predating the change: tell him to save, then hard reload (⌘⇧R). Nothing is
  committed until he asks, so the deployed site lags too.
