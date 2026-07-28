# art/ — asset generation pipeline

Tooling for making game art. The workflow and its rules are in
[../guidelines/art-pipeline.md](../guidelines/art-pipeline.md); this is the
operating manual.

```
manifest.json   the registry — profiles, roles, anchors, every asset slot
prompt.py       assemble a generation prompt from a slot
ingest.py       validate a generated master, emit the game-ready asset
plates.js       capture real race frames to composite candidates onto
contact.py      build the contact sheet — the acceptance gate

inbox/          drop generated masters here as <key>.png
masters/        archived originals after ingest
plates/         captured race backdrops, one per venue
sheets/         contact sheets for review
```

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
