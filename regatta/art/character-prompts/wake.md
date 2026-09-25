# Wake — Harbour Porpoise (Lighthouse Cove, Mechanic)

*Sep 25 2026. The filled-in form of `art/new-character-prompt.md` for the Cove's mechanic
character. Paste the fenced block into an assistant; it returns the AI_CONFIG record, the
kite pattern, the quotes and the portrait prompt. Where the output goes and how to verify
it is in `new-character-prompt.md`.*

**Why Wake exists.** Lighthouse Cove's mechanic objective is *cross a cargo ship's bow
within 3 boat lengths, then finish* — the venue's question ("can I make the gate before the
ship does?") answered at the moment it is most frightening. Harbour porpoises work ship
channels and are the small, quick thing that cuts across in front of everything. The
porpoises are also one of the Cove's three wildlife types (with gulls and pelicans), so Wake
is the pod's own racer.

**Neighbours to stay clear of.** Ripple (bottlenose dolphin, hull `#00B3FF`) is the roster's
other small cetacean, and Roll (harbor seal, hull `#7D8597`) races the same venue. Wake must
not read as either — see the silhouette and colour notes in the block.

---

```
You are adding one competitor to SaltyCritter Yacht Club, a stylized top-down sailing
racing game with a 100-boat AI roster. I will give you a creature; you return a complete,
drop-in character. If you have repo access, read regatta/js/ai/roster.js (AI_CONFIG),
regatta/js/render/sprites.js (SPIN_LOOKS), regatta/js/ai-quotes.js and
guidelines/skills.md, and trust them over any list below.

CREATURE: Harbour Porpoise (Phocoena phocoena)

NAME: Wake — already chosen; do not rename.

WHO THEY ARE. The shy, quick little cetacean of busy harbours. Wake lives in the ship
channel at Lighthouse Cove and makes a habit of darting across the bows of cargo ships —
the unlock that earns Wake is exactly that move. Build one racing personality out of it:
nerve and timing in traffic, a small boat that is always somewhere a bigger one isn't.
Harbour porpoises are real: small (1.5 m), rarely leap, surface with a quick rolling
"puff" and are gone; they are wary of boats, not playful like dolphins.

Design direction (the assistant decides the numbers, but these are the story):
  · A crossing specialist: strong acceleration and handling (it gets in and out of gaps),
    weaker momentum and heavy air (a small body that doesn't carry speed or like a big
    breeze). Good-in-traffic, not a straight-line speed boat.
  · The beat line should point at the real weakness — e.g. make it sail a long straight
    leg in a building breeze, where there is no traffic to dart through.
  · Tier: mid (B). It is a Mechanic rung, not a capstone; it does not need to be strong.
  · Archetype: rocket or corner fit the story best; pick the one the stats support.

SILHOUETTE — it must not read as Ripple the bottlenose dolphin:
  · NO beak. A blunt, rounded head and a short, stubby face.
  · Small, low, triangular dorsal fin (not tall and curved).
  · Chunky, compact body; smaller and rounder than Ripple.
  · Colouring: dark charcoal-grey cape over the back, paler grey flanks, white belly, and
    the porpoise's dark stripe from the mouth corner to the flipper.
  · Expression: alert, quick, a little wary — not a grin. Spade-shaped teeth if the mouth
    is open at all.

COLOUR. The real animal is greys, and Roll (#7D8597, slate grey) is already the Cove's grey
boat, so the hull must NOT be a neutral slate. Take the hull from the portrait's cool
charcoal pushed toward a deep sea-green or teal-grey, mid-tone (luma roughly 80-130), and
give the kite a warm, high-contrast colour — the boat should pop against the harbour's blue
water. Avoid Ripple's cyan and Roll's slate-and-gold.

Return these deliverables exactly as regatta/art/new-character-prompt.md specifies,
each in its own fenced code block:

1. THE AI_CONFIG RECORD — one line, fields in the template's order, all colour rules
   (profile band luma, hull/kite contrast, unique kite) satisfied.
2. STATS — ten, -5..+5, with the tier stated and checked against
   regatta/eval/tier_bands.json.
3. ARCHETYPE — one key, its stat requirement met.
4. SPIN_LOOKS ENTRY — `    Wake: 'pattern',` (chevron or triangle suit a darting,
   directional character; a 3-colour pattern needs spinnaker3).
5. AI_QUOTES BLOCK — the 14 triggers, 2-7 words each, in character: quick, wary, a
   little cheeky about big ships. No emoji, straight apostrophes.
6. THE PORTRAIT — 500 x 500 PNG, straight-alpha transparent, bust crop matching the
   roster's framing (content x 0.16-0.87, y 0.12-0.87, centred ~(0.508, 0.496)).

  Stylized polished 2D game art for SaltyCritter Yacht Club; colorful nautical
  adventure; bold simplified shapes; clean cel-shaded and lightly faceted planes;
  saturated but controlled palette; crisp readable silhouette; friendly sophisticated
  tone; clear directional lighting; minimal microtexture; no text; no UI; no
  photorealism. Anthropomorphic harbour porpoise sailing competitor, upper-body
  three-quarter portrait, transparent background, blunt rounded beakless head, small
  compact chunky build, dark charcoal back fading to pale grey flanks and a white belly,
  a dark stripe from the mouth corner toward the flipper, expressive face reading as
  quick, alert and daring, strong dark charcoal outer outline 4-8px, simplified interior
  linework, wearing a distinctive modern life jacket with visible zipper, belt and
  buckle hardware, clean cel shading, readable at 64px, no scenery.

  Negative: dolphin beak, bottlenose dolphin, long snout, tall curved dorsal fin, grin,
  playful leaping, photorealistic, cinematic realism, 3D render, heavy painterly
  brushwork, watercolor wash, gritty, horror, military, generic vector clip art,
  excessive texture, excessive bloom, neon everywhere, thin fragile details, cluttered
  background, text, logo, watermark, inconsistent perspective.

EVERY competitor wears a proper PFD with zipper and belt. No costumes, no props.

TAKEN — the names and creatures already on the roster are in regatta/js/ai/roster.js.
Wake and Harbour Porpoise are both free.

FINALLY, the coherence check from the template: archetype requirement met; the beat line
names a weakness real in the stats; the top three stats by absolute value tell the
darting-in-traffic story; the kite contrasts the hull; the hull is clear of Roll's slate
and Ripple's cyan; any 3-colour pattern has a spinnaker3.
```

---

## When it lands

- `AI_CONFIG` → `js/ai/roster.js`; `SPIN_LOOKS` → `js/render/sprites.js`; quotes →
  `js/ai-quotes.js`; portrait → `assets/images/competitors/wake.png`.
- Wake's achievement row already exists in `js/game/unlocks.js`. An objective earned
  before the art ships is remembered, and Wake unlocks the moment he is in the roster.
- Adding a character changes every seeded fleet draw, so the golden traces need a
  deliberate `npm run trace:update` once he is final (see `new-character-prompt.md`).
