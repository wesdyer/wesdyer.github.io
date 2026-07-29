# The Art Pipeline — Generating Assets

*How art gets made for this game. Companion to [visual-style.md](visual-style.md)
(what it should look like), [venue-art.md](venue-art.md) (venue cards) and
[race-view.md](race-view.md) (what the water looks like).*

Those three documents say what good art **is**. This one says how it gets **made**:
declared, prompted, generated, validated, shipped. Tooling lives in `../art/`.

## 0. The one rule — **Rule**

> **Declare the slot before you draw the asset.**

Everything downstream keys off `../art/manifest.json`. Nothing gets generated that
isn't in it, because the manifest carries the facts a generator cannot guess — how
big the thing is in the world, what it anchors on, which role it plays, which venue
palette binds it. Art made without those is art that has to be remade.

## 1. Two tracks, one machine — **Rule**

The split people expect is "sprites vs. static art". That is a real split, but it
falls on the **profile**, not the pipeline — both tracks run the same six steps.

| Track | Classes | Lives in | Judged by |
|---|---|---|---|
| **Sprite** | `world-prop`, `terrain` | the water, under the camera | contact sheet at true race scale over the two extreme waters |
| **Static** | `illustration`, `portrait`, `ui-icon` | the product shell | reduction test at thumbnail / circular-crop / icon size |

Profiles in `manifest.json` carry master size, background, output directory and the
reduction target. Adding an asset class means adding a profile, not a new workflow.

**Scale is not a judgement call — Observed.** The race camera is translate-only with
no zoom (`state.camera` in `script.js` has `x`/`y` and nothing else), so at
`deviceScaleFactor: 1` **one world unit is exactly one screen pixel**. A prop declared
`"world": 70` occupies 70px on screen. Boat parts set the convention the sprite track
follows: a 1024 master, baked at 4× display size, drawn down from the bake
(`BOAT_SPRITE_SCALE = 16`, `BOAT_SPRITE_BAKE = 4` — a boat's box is 64 units).

## 2. Roles are a design contract, not a taxonomy — **Rule**

Every world-prop declares a role, and the role changes what the art must do. The two
that carry real gameplay weight:

- **`ambient` must never be confusable with `hazard`.** If a decorative lily pad and
  a floating log read alike at 60px, players learn to distrust the world and start
  either dodging everything or trusting nothing. The distinction has to survive with
  color removed — different silhouette families, per §7.2's "never color alone".
- **`traffic` must never be confusable with a competitor.** A working boat that reads
  like a racing boat makes the player misread the race itself. This extends
  [race-view.md](race-view.md) §10.2's confusability rule off the starting grid.

`landmark` and `nav` are lower-risk: landmarks never sit in the racing water, and nav
aids get canonical buoyage coding.

## 3. Anchors — **Rule**

The anchor is the point in the art the engine places and rotates about. From directly
overhead it is *where the object meets the world*, which is usually near the alpha
bounding-box center but is not the same thing — a leaning tree, an L-shaped dock and a
beacon on an off-center piling all break it.

`ingest.py` seeds `anchorPx` from the bbox center and `contact.py` draws a crosshair on
it. **Check the crosshair; correct `anchorPx` by hand when it's wrong.** This is the
single field that is cheap now and expensive across eighty files later, because
fixing it after the fact means re-cropping masters.

**Orientation — Rule.** Anything with a front faces the **top of the frame** in the
master. The engine rotates sprites about the anchor and treats sprite-up as zero
heading (`hull.png` ships bow-up; `drawBoat()` applies heading straight to it). A
library where some assets face up and others face right is unfixable without
re-exporting, so this is checked at generation time, not at ingest.

## 3b. Generate single objects; compose groups in code — **Rule**

> **A master is one object. Anything that ships as several of the same object is
> composed by `compose.py`, not generated as a group.**

Image models are strongly drawn to symmetry. Asked for "seven penguins in a loose
huddle" they return a rosette — evenly spaced, facing inward, a hole in the middle —
and they keep returning one after the negative prompt is hardened with `mandala`,
`rosette`, `radial symmetry` and six more terms. At race scale a rosette reads as a
snowflake, not as animals. Two generations were spent proving this.

Irregular scatter is trivial for a PRNG. So the split is:

- **element** (`class: "element"`) — one object, centred, facing up, filling the
  frame. Lives in `art/elements/`, never ships: a single penguin is 4–7px on screen.
- **group** — a `world-prop` with a `compose` block naming its element, a count, a
  spread, scale and rotation ranges, and a seed. `compose.py` writes the master.

Four things fall out of it that generating groups cannot give you:

1. Every member is literally the same accepted art, so a group cannot drift in style.
2. A new variant costs a `--seed`, not a generation.
3. Density, count and footprint become tunable numbers rather than prompt pleading.
4. One element serves every group built from it — three penguin groups, one bird.

**This applies to repeated instances of the SAME object.** A composition of genuinely
different interlocking parts — the Bayou's shack with its dock and moored skiff — stays
a single generated master, because it isn't N copies of anything.

`compose.py` offers two layouts. `cluster` samples a disc with `r = R·u^0.62`, biasing
inward so the middle is the densest part — the thing every generated rosette got
backwards. `line` lays a vertical track with a slight bow and uneven spacing; vertical
because §3 makes sprite-up the direction of travel.

## 3c. Venue palette binds pictures, not objects — **Rule**

The palette registry in [venue-art.md](venue-art.md) governs **venue card
illustration**: what a whole picture of a place commits to. A prop is an object *in*
that place, not a picture *of* it, so the two need different clauses and `prompt.py`
now emits different ones.

Applying the card's commitment to props cost real work before it was spotted. Every
arctic prompt carried *"palette is committed to steel navy and faceted ice blue-white
... do not introduce hues outside that commitment"*, which instructed the model that
the object itself should be made of steel navy. Consequences:

- Three orcas came back navy instead of black, fought in the subject text for three
  generations while the palette clause pushed the other way.
- A snow petrel — a bird that is famously immaculate white — came back with navy
  wings, and was misdiagnosed as the generic seabird prior.
- An albatross's pink bill, a gentoo's orange beak and any nav aid's canonical
  buoyage colour were all technically forbidden.

For props the venue palette is **context, not instruction**: the world the object has
to belong to, and a list of hues that would look alien in it. **Colour that carries
information always wins** — true plumage or hide, a beak, canonical buoyage, a painted
hull — even when that colour appears nowhere else in the venue.

## 4. The six steps

```
1. SLOT      add to art/manifest.json with role, venue, world size, anchor
2. PLACEHOLDER   (see §6) play the venue with boxes at the right sizes
3. PROMPT    python3 regatta/art/prompt.py <key>
4. GENERATE  image model -> save master to regatta/art/inbox/<key>.png
5. INGEST    python3 regatta/art/ingest.py <key>
6. VALIDATE  node regatta/art/plates.js <venue>      (once per venue)
             python3 regatta/art/contact.py <key>    -> art/sheets/<key>.png
```

**Never hand-write a prompt.** Step 3 assembles it from the base style, the class
add-on, the role add-on and the venue's committed palette. Hand-written prompts are
how a library drifts into looking like four different artists.

**Step 5 is a gate, not a copy.** `ingest.py` hard-fails on an unremoved background,
a non-square master or dead alpha; it warns on content that reaches the edge with no
rotation margin. It exits non-zero on failure so an agent loop can branch on it.

**Step 6 is the acceptance gate.** The 1024px master always looks good. The only
question that matters is whether the thing reads at the 26–130px it actually occupies,
over both Pearl Lagoon and Glacier Sound. Plates are real frames from the running
game — real water, real wind waves, real boats for scale.

## 5. Where the pixels come from — **Intent**

Step 4 is deliberately the only manual step. The pipeline neither knows nor cares
whether the master came from an image model's API, a chat window, or a person with a
tablet — it validates what lands in `inbox/`. Wiring a specific generator into step 4
is a later convenience, not a prerequisite, and keeping the seam there is what lets the
human route (§0 of this project's plan) drop in unchanged.

## 6. Slots before art — **Intent**

Not yet built. The order that avoids waste is: manifest slot → placeholder box drawn
in the running venue at the declared world size → play it → *then* generate. Placement,
density and scale are gameplay decisions, and settling them against grey boxes costs
nothing, where settling them against finished art costs the art.

This needs a prop placement system in `script.js` (a per-venue registry plus a draw
pass slotted into the existing `drawIslands(ctx, which)` land/floe ordering). Until
that exists the pipeline still works — it just validates against plates rather than
against the venue you'll actually place things in.

## 7. Terrain is reserved — **Observed**

Islands, shorelines, weeds and floes are procedural today (`bakeIslandSprite()`,
`ISLAND_STYLES`, `drawWeeds()`), and `palm.png` is the lone tree sprite — stamped for
both the `tropical` and `grass` styles, so Stillwater's conifers and the Bayou's
cypress are currently the same palm.

The `terrain` profile exists so the planned island rework has a home without
reopening the pipeline. Note the standing hazard: dropping painted props onto
procedural land is [visual-style.md](visual-style.md) §12's Mistake 2 waiting to
happen. Decide per venue whether props pull land toward art or land pulls props
toward procedural — don't let the seam land mid-venue.

## 8. Acceptance — **Rule**

An asset ships when it passes [visual-style.md](visual-style.md) §13's rubric, plus:

- [ ] Reads at its declared `world` size, not just at master size
- [ ] Role is unmistakable at that size **with color removed** (§2)
- [ ] Anchor crosshair sits where the object meets the world (§3)
- [ ] Holds the 3:1 contrast floor on Pearl Lagoon **and** Glacier Sound
- [ ] Palette stays inside the venue's committed hue ([venue-art.md](venue-art.md))
- [ ] Ingest passes with no warnings
- [ ] Construction matches the **view**, not the venue card
      ([race-view.md](race-view.md) §0)
