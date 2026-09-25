# Sailing School characters — Fuzz, Oar, Bask, Wisp

*Sep 25 2026. The four new Duckling Pond characters. Paddle (mallard, the instructor)
already exists.*

**The prompts come from the art pipeline, not from this file.** Each character has a
`portrait` entry in `art/manifest.json`, and `art/prompt.py` assembles the full prompt (house
style + portrait profile + the character's subject, vest colours and species signature):

```sh
python3 regatta/art/prompt.py fuzz
python3 regatta/art/prompt.py oar
python3 regatta/art/prompt.py bask
python3 regatta/art/prompt.py wisp
```

Fuzz, Oar and Wisp were already in the manifest from the Aug 5 roster expansion; Bask was
added Sep 25 (he replaced Puddle the pond snail, whose slot is unused).

| Character | Species | Objective (Sailing School) | Pond animal |
|---|---|---|---|
| **Paddle** | Mallard drake (exists) | Win the graduation race | the ducklings' teacher |
| **Fuzz** | Mallard duckling | Finish every lesson without skipping | the ducklings |
| **Oar** | Water boatman | In start practice, cross within 2 s of the gun, not over early | — |
| **Bask** | Painted turtle | Send the turtles sliding off their log, then finish | turtles on the log |
| **Wisp** | Great crested grebe | Graduate with a clean report card | grebes diving |

**Delivery:** a square transparent PNG, saved as `~/Desktop/<name>.png`. Ask for the dark
outline straight onto transparency — no light halo or sticker rim (Wake's had one and it was
peeled by hand).

**On ship:** each portrait is reframed to the roster's crop, then gets its AI_CONFIG record,
SPIN_LOOKS pattern and 14 quotes. The vest colours in the manifest ARE the proposed hull and
spinnaker; they are re-measured off the delivered portrait. Stat intentions:

- **Fuzz** — a gentle boat (tier C/D), `metronome`.
- **Oar** — `rocket`, acceleration the headline, weak downwind.
- **Bask** — slow to accelerate, carries momentum, good in light air; `freight` or `metronome`.
- **Wisp** — the school's capstone, **+3 or better** (tier A): handling, upwind, pressure;
  `corner` or `shift`.
