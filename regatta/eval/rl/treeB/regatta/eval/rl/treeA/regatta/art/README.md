# art/ — asset generation pipeline

Tooling for making game art. The workflow and its rules are in
[../guidelines/art-pipeline.md](../guidelines/art-pipeline.md); this is the
operating manual.

```
manifest.json   the registry — profiles, roles, anchors, every asset slot
prompt.py       assemble a generation prompt from a slot
dekey.py        knock a flat/checkerboard background out of a raw generation
ingest.py       validate a generated master, emit the game-ready asset
plates.js       capture real race frames to composite candidates onto
contact.py      build the contact sheet — the acceptance gate

paths.py        one definition of where each asset's files live

inbox/          drop generated masters here as <key>.png  — FLAT
masters/        archived originals after ingest            — by venue
elements/       single objects for compose.py              — by venue
plates/         captured race backdrops, one per venue
sheets/         contact sheets for review                  — by venue
```

## File layout

Persistent stores are organized by **venue**, and the filename drops the venue
prefix — `arctic-orca` lives at `arctic/orca.png`:

```
art/masters/arctic/orca.png
art/elements/arctic/penguin-emperor.png
art/sheets/arctic/orca.png
assets/images/props/arctic/orca.png
```

`inbox/` stays flat and keyed by the full manifest key (`arctic-orca.png`). It is a
staging area you drop files into, and one unambiguous name beats a directory to
navigate.

The strippable prefix is **derived, not assumed** — the swamp venue's assets are all
keyed `bayou-*`, so `paths.py` takes a venue's prefix to be the leading token every
one of its assets shares, and leaves keys alone when a venue is mixed. Manifest keys
never change; only where the files sit.

## Single objects, composed groups

**A master is one object.** Anything that ships as several of the same object is
composed in code, never generated as a group — image models return symmetric
rosettes when asked for "seven of X", and a rosette reads as a snowflake at race
scale. See art-pipeline.md 3b.

```bash
# 1. generate the element (one object) -> save cutout to art/elements/<key>.png
python3 regatta/art/prompt.py arctic-penguin-macaroni --bg white

# 2. compose the group, then ship it
python3 regatta/art/compose.py arctic-penguin-macaroni-colony
python3 regatta/art/ingest.py arctic-penguin-macaroni-colony
python3 regatta/art/contact.py arctic-penguin-macaroni-colony

# retune without regenerating anything
python3 regatta/art/compose.py arctic-penguin-huddle --seed 12 --preview
```

Tune `count`, `spread`, `scale`, `rotate`, `minGap` and `seed` in the manifest's
`compose` block. `--preview` reports the content bbox and tightest margin without
writing, which catches a cluster that overflows the 8% rotation margin.

## Making one asset

```bash
# 1. declare the slot in manifest.json, then:
python3 regatta/art/prompt.py bayou-cypress

# 2. generate from that prompt, save to regatta/art/inbox/bayou-cypress.png

# 3. validate + ship
python3 regatta/art/ingest.py bayou-cypress

# 4. review at race scale (plates are a one-time cost per venue, ~1 min each)
node regatta/art/plates.js swamp lagoon arctic
python3 regatta/art/contact.py bayou-cypress
open regatta/art/sheets/bayou-cypress.png
```

## Generator notes — measured, July 2026

| Generator | Verdict |
|---|---|
| **Gemini** | Best for wildlife. Nails strict top-down and holds style across a session when you feed an accepted sprite back as reference. Cannot produce real alpha — returns an opaque file with a transparency checkerboard *painted into the pixels*. **Subject quality drops measurably on a magenta field**, so ask for `--bg white` and cut it out with a real background remover. |
| **OpenAI** | Delivered true top-down and genuine alpha first try. Tends to add a rim glow and drift toward navy; needs the no-glow and true-black language. Strong second choice. |
| **Midjourney** | Untested here. Expect a fight on strict overhead views of animals — the training data is overwhelmingly side-on. Likely better on inanimate props. |

Cutting against white leaves a light edge fringe — measured at 1.7× body luminance
on `arctic-orca-calf`. **It is not visible at race scale** (sub-pixel at 50–88px),
but check the edge on the contact sheet over arctic water before accepting anything
larger than ~130px.

## Per-generator background handling

Not every model can produce a real alpha channel. Gemini in particular returns an
RGBA file that is **100% opaque with a transparency checkerboard painted into the
pixels** — it looks right in a viewer and is not. Asking it harder produces more
checkerboards, so ask for a chroma key instead and remove it locally.

```bash
# OpenAI — real alpha, straight through
python3 regatta/art/prompt.py arctic-orca
python3 regatta/art/ingest.py arctic-orca

# Gemini — white field, cut out with a real background remover
python3 regatta/art/prompt.py arctic-orca --bg white
#   ...remove the background, save the result, then:
python3 regatta/art/ingest.py arctic-orca

# Fallback with no remover to hand — chroma key + dekey
python3 regatta/art/prompt.py arctic-orca --bg magenta
python3 regatta/art/dekey.py ~/Desktop/raw.png arctic-orca
python3 regatta/art/ingest.py arctic-orca
```

**Never key on white with `dekey.py`** — its flood fill can walk into a near-white
marking that touches the silhouette edge (orca eye patches, the lily bloom, the
heron). That limit is `dekey.py`'s, not a universal one: a dedicated background
remover handles white fine, which is why the Gemini path above uses it.

**A dedicated background remover beats `dekey.py` and is the recommended path when
you have one.** `dekey.py` produces a binary mask, so it erodes about a pixel of the
original antialiased edge — invisible at race scale, but a real remover keeps a
softer edge (measured on arctic-orca: 2.0% partial alpha against dekey's 1.1%).
Treat `dekey.py` as the no-round-trip fallback.

Its `--thresh` is summed across RGB, and a transparency checkerboard's two tones
differ by 132 — hence the default of 160. If a background resists, sweep it:

```bash
python3 regatta/art/dekey.py raw.png --inspect --thresh 140
```

The right value sits on a plateau where the removed percentage and the bounding box
stop changing. If nothing is removed, the background isn't border-connected; if
nearly everything is, the threshold is eating the subject.

## Comparing models

```bash
python3 regatta/art/contact.py arctic-orca --compare \
  "openai:/tmp/a.png" "gemini:/tmp/b.png" "mj:/tmp/c.png"
```

Every candidate at true race scale on the same water, plus a detail row. This is the
only fair way to pick — masters flatter every model equally.

## Batches

```bash
python3 regatta/art/prompt.py --venue swamp      # every slot for a venue
python3 regatta/art/prompt.py --all-slots        # everything not yet drawn
python3 regatta/art/ingest.py --all              # everything in inbox/
python3 regatta/art/contact.py --venue swamp
```

`ingest.py` exits non-zero if any master fails, so a generation loop can branch on
it and retry with a corrected prompt.

## What ingest enforces

Hard failures — the master is rejected:
- not square, or fully transparent
- alpha missing on a profile that needs it
- **fully opaque, or corners not transparent** — the model painted a backdrop.
  This is the most common failure by a wide margin.

Warnings — it ships, but look at it:
- master size differs from the profile (it gets resampled)
- content reaches within the safe margin of the edge, leaving no room for rotation
  or a contact shadow

## Reading a contact sheet

One band per venue at true race scale, three placements each, then a reduction
ladder at 1×/2×/4× on neutral.

- **The magenta crosshair is the anchor.** It should sit where the object meets the
  world. If it floats off the object, fix `anchorPx` in the manifest by hand — the
  seeded value is only the alpha bbox center.
- Judge the top bands, not the ladder. The ladder is for finding *which* detail died;
  the bands are for deciding whether it reads.
- Squint. If a `hazard` and an `ambient` prop blur into the same shape, the art
  fails §2 of the pipeline doc no matter how good it looks at 1024px.
