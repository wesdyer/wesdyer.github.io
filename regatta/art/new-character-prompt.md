# New competitor prompt

Paste the block below into an assistant, replacing `{{CREATURE}}` with the animal you
want. It returns everything needed to add one racer: the `AI_CONFIG` record, the kite
pattern, the 14 quotes, and the portrait (or the image prompt to generate it).

Fleet facts in the prompt go stale as the roster grows — if the assistant has repo
access, tell it to read `regatta/js/script.js` instead of trusting the lists inline.

---

```
You are adding one competitor to SaltyCritter Yacht Club, a stylized top-down sailing
racing game with a 66-boat AI roster. I will give you a creature; you return a complete,
drop-in character.

CREATURE: {{CREATURE}}

Design the character first — one clear racing personality that grows out of how this
animal actually moves and behaves — then make every field below express that same idea.
A character is coherent when the stats, the archetype, the personality line, the beat
line, the colors and the portrait are all saying one thing. Incoherent characters have
shipped here before (a "rocket start" with -3 acceleration) and had to be reworked.

Return these five deliverables, in this order, each in its own fenced code block.

────────────────────────────────────────────────────────────────────────
1. THE AI_CONFIG RECORD
────────────────────────────────────────────────────────────────────────
One JavaScript object literal on a single line, fields in exactly this order:

{ name: 'Xxx', creature: 'Xxx', hull: '#RRGGBB', spinnaker: '#RRGGBB', spinnaker2: '#RRGGBB', sail: '#RRGGBB', cockpit: '#RRGGBB', personality: "...", beat: '...', archetype: '...', stats: { acceleration: 0, momentum: 0, handling: 0, upwind: 0, reach: 0, downwind: 0, boost: 0 } },

name        One word, capitalized, evocative rather than literal — the roster runs
            Bixby, Fathom, Skitter, Bulkhead, Slipstream. Not the species name. Must
            not collide with a name already taken (list at the bottom).
creature    The species in title case, e.g. 'Leafy Seadragon'.
hull        The boat's primary identity color. Must be visibly distinct from every
            hull in the taken-colors list.
spinnaker / spinnaker2
            Kite base color and panel accent. High contrast against the hull; this is
            the second identity signal on the water.
sail        Almost always '#FFFFFF'; '#000000' for a dark/severe character.
cockpit     A muted neutral — grey, tan or slate, roughly #A0A0A0–#D8D8D8. It is
            interior trim, never a third identity color.
personality One short sentence, present tense, no name, ends with a period. It appears
            verbatim in the profile panel as the character's italic blurb.
            e.g. "Patient hunter striking without warning."
beat        The "How to Beat Them" line — one imperative sentence telling the player
            the tactical counter. It MUST name a weakness that is real in the stats or
            the archetype, not a generic taunt.
            e.g. 'Tack early, tack often — the ambusher cannot follow through turns.'
archetype   One key from the table below.

COLOR RULE: the profile header band uses the hull unless its perceived luma
(0.299R + 0.587G + 0.114B) is under 50 or over 200, in which case it falls back to the
spinnaker. A near-black or near-white hull is fine, but then the spinnaker must be a
mid-tone. Do not make both extreme.

────────────────────────────────────────────────────────────────────────
2. STATS — how they actually work
────────────────────────────────────────────────────────────────────────
Seven integers, each -5..+5. Real mechanical effect per point:

acceleration  ±2.4%/pt on acceleration rate — building speed out of turns and lulls
momentum      ±2.0%/pt on deceleration damping — carrying speed through maneuvers,
              chop and wind holes
handling      ±3.0%/pt on turn rate, plus relief when overpowered
upwind        ±1.2%/pt boat speed on the beat        (±6% at ±5)
reach         ±1.8%/pt boat speed on the reach       (±9% at ±5)  ← widest lever
downwind      ±1.5%/pt boat speed on the run         (±7.5% at ±5)
boost         ±5.0%/pt on gust response              (±25% at ±5) ← biggest swing

Tacking and gybing agility is a blend: handling×0.3 + acceleration×0.3 + momentum×0.2.
A boat weak in all three is genuinely painful to force into maneuvers, and that is the
most reliable weakness a beat line can point at.

Balance rules:
- Sum of all seven between -8 and +8. (Fleet mean is ~0; extreme outliers exist but do
  not add more.)
- At least one stat ≥ +3 and at least one ≤ -3. The profile panel shows the three
  most extreme stats by absolute value, so those three ARE the character to the player.
  Make them tell the story.
- No more than two stats at ±5.
- Every advertised strength and weakness must be mechanically real. This is the rule
  the roster has broken most often.

────────────────────────────────────────────────────────────────────────
3. ARCHETYPES — pick exactly one
────────────────────────────────────────────────────────────────────────
Each is a behavior layer on top of the stats, with a threat and an exploitable
weakness. Never a flat power boost.

key         label            races like                          stat requirement
bully       Line Bully       shaves give-way margins, crowds      —
                             rivals, collects fouls
rocket      Rocket Start     commits early and cleanly off        acceleration ≥ +1
                             the line
shift       Shift Whisperer  reads wind fast, banks lifts and     pays a 3% flat
                             pressure                             speed tax — do not
                                                                  sell as pure speed
freight     Freight Train    carries speed, rounds wide           momentum ≥ +1
corner      Corner Artist    surgical roundings, yields lanes     handling ≥ 0
                             in a crowd
gambler     Corner Gambler   picks a side of the beat and bangs   —
                             it, mostly ignoring shifts
leech       The Leech        locks onto the nearest rival and     —
                             matches every tack
metronome   Metronome        never blunders, never spikes         —

The personality line's claims must match: don't write "explosive starts" for a boat
with negative acceleration, or "unstoppable momentum" for one with negative momentum.

────────────────────────────────────────────────────────────────────────
4. SPIN_LOOKS ENTRY
────────────────────────────────────────────────────────────────────────
One line: `    Name: 'pattern',`
Pattern is one of: solid, halves, crosshalves, gores, stripes, rays, triangle.
Pick what suits the character — solid for severe/minimal, rays or gores for flashy,
stripes for methodical. `solid` ignores spinnaker2.

────────────────────────────────────────────────────────────────────────
5. AI_QUOTES BLOCK
────────────────────────────────────────────────────────────────────────
A JSON block keyed by the character's name with exactly these 14 triggers:

player_passes_them, they_pass_player, they_hit_player, they_were_hit,
narrowly_avoided_collision, player_narrowly_avoided_collision, moved_into_first,
moved_into_last, rounded_mark, first_across_start, finished_race, prestart,
start_planing, random

Voice rules: 2–7 words each, under ~45 characters — these render as small floating
callouts over a moving race. In character, never naming themselves or the player. No
emoji. Straight ASCII apostrophes. they_hit_player and they_were_hit should differ in
attitude the way the character would (an apologetic boat vs. a hostile one).

────────────────────────────────────────────────────────────────────────
6. THE PORTRAIT
────────────────────────────────────────────────────────────────────────
Spec: 500 × 500 PNG, straight-alpha transparent background, bust crop centered for a
circular frame, face within the central 70%, legible at 64 px.
Delivered to: regatta/assets/images/competitors/<lowercase-name>.png

If you can generate images, produce it. Otherwise return the prompt below filled in,
ready to paste into an image model.

  Stylized polished 2D game art for SaltyCritter Yacht Club; colorful nautical
  adventure; bold simplified shapes; clean cel-shaded and lightly faceted planes;
  saturated but controlled palette; crisp readable silhouette; friendly sophisticated
  tone; clear directional lighting; minimal microtexture; no text; no UI; no
  photorealism. Anthropomorphic {{CREATURE}} sailing competitor, upper-body
  three-quarter portrait, transparent background, expressive face reading as
  <the personality in 3-4 words>, strong dark charcoal outer outline 4-8px, simplified
  interior linework, wearing a distinctive modern life jacket in <hull color> with
  visible zipper, belt and buckle hardware, clean cel shading, readable at 64px,
  no scenery.

  Negative: photorealistic, cinematic realism, 3D render, heavy painterly brushwork,
  watercolor wash, gritty, horror, military, generic vector clip art, excessive
  texture, excessive bloom, neon everywhere, thin fragile details, cluttered
  background, text, logo, watermark, inconsistent perspective.

Character-art rules the image must satisfy: broad angular forms read as power or
aggression, rounded forms as warmth and comic energy, narrow swept shapes as speed and
precision — the silhouette should match the archetype. Every competitor wears
recognizable sailing safety gear. No props unrelated to the character, no background,
no scene. Clean transparent edge with no dark matte halo.

────────────────────────────────────────────────────────────────────────
TAKEN — do not reuse
────────────────────────────────────────────────────────────────────────
Names: Anchor Bixby Blaze Bluff Bramble Breeze Brine Bruce Bulkhead Cheer Chomp Clutch
Crimson Croak Crush Dart Drift Fathom Finley Flash Flicker Frond Gasket Glide Hug
Jester Knot Lure Mistral Nimbus Pearl Pebble Petal Pinch Popper Puff Pulse Razor Regal
Rift Ripple Roll Saffron Scoop Scuttle Skerry Skim Skitter Slipstream Snap Spike Splat
Stomp Strut Sunshine Tangle Torch Torrent Veil Vex Viper Whiskers Wiggle Wobble Zeffir
Zing

Also avoid these — unused portrait files already sit at those filenames and a new
character would silently inherit the wrong art: Anvil, Cruz, Dozer, Ember, Etienne,
Flaunt, Frenzy, Grip, Paddle, Piper, Prism, Splash, Stripes, Tiny, Torpedo.

Creatures: Albatross, Anglerfish, Axolotl, Barracuda, Beaver, Blobfish,
Blue-Footed Booby, Bullfrog, Clownfish, Cloud Ray, Crab, Dolphin, Elephant Seal,
Fire Salamander, Flamingo, Flying Fish, Flying Squirrel, Great White, Harbor Seal,
Hermit Crab, Jellyfish, Kingfisher, Leafy Seadragon, Lobster, Mackerel,
Mahi-Mahi, Manatee, Mandarin Dragonet, Mantis Shrimp, Mako Shark, Moray Eel, Narwhal,
Nautilus, Nudibranch, Octopus, Orca, Otter, Oyster, Pelican, Penguin, Platypus,
Polar Bear, Pom Pom Crab, Pufferfish, Puffin, Red Snapper, Roseate Spoonbill, Salmon,
Saltwater Crocodile, Sea Turtle, Sea Urchin, Seagull, Seahorse, Snapping Turtle,
Starfish, Swan, Swift, Swordfish, Tern, Tree Frog, Green Tree Snake, Tuna,
Vampire Squid, Walrus, Water Dragon, Mudskipper

Hull colors in use: #FF9ECF #0046ff #8FD3FF #FF8C1A #E10600 #121212 #FF4F9A #FFE600
#2ECC71 #C49A6C #0fe367 #9900ff #00B3FF #B00020 #E8F1F8 #1C1C3C #FFB703 #0077B6
#FF3B30 #6A7FDB #7A1FA2 #5E7C8A #2D3142 #1F1F1F #FFB000 #2B2E4A #A8DADC #FF70A6
#96C47A #9B5DE5 #C8553D #3A86FF #C7A6FF #FFFFFF #FFEB3B #00FF6A #E7A6B4 #00C2FF
#7D8597 #6B7FD7 #EE6C4D #386641 #4B5D23 #d4ff07 #FF5400 #00F5D4 #083fa6 #ffa000
#000080 #FF6FAE #00B4D8 #ed1515 #49c100 #e33d28 #0032ff #0B0F1A #D8C6A3 #FFD84D
#5FAF6E #6B7280 #B6BCC6 #1F3C5B

────────────────────────────────────────────────────────────────────────
FINALLY
────────────────────────────────────────────────────────────────────────
After the five blocks, add a short "Coherence check" — three or four lines confirming:
the archetype's stat requirement is met; the beat line points at a weakness that is
actually in the stats; the top three stats by absolute value tell the intended story;
and the sum is within -8..+8. If any check fails, fix the record and say what you
changed.
```

---

## Where the output goes

| Block | Destination |
|---|---|
| 1. `AI_CONFIG` record | append inside `const AI_CONFIG = [ … ]`, `js/script.js` |
| 4. `SPIN_LOOKS` entry | append inside `const SPIN_LOOKS = { … }`, `js/script.js` |
| 5. `AI_QUOTES` block | append inside `const AI_QUOTES = { … }`, `js/ai-quotes.js` |
| 6. Portrait | `assets/images/competitors/<lowercase-name>.png`, 500×500 RGBA |

Nothing else needs registering — the fleet is drawn at random from `AI_CONFIG`.

## Verifying

```bash
node --check regatta/js/script.js && node --check regatta/js/ai-quotes.js
python3 -c "from PIL import Image; im=Image.open('regatta/assets/images/competitors/NAME.png'); print(im.size, im.mode)"
# expect (500, 500) RGBA
```

Then open `regatta/competitor.html` — the roster sheet renders every profile panel
exactly as the pre-race sidebar does, so the band color, the three stat bars, the
blurb and the beat line are all checkable at a glance. Race the character once to
confirm the quotes fire and the portrait reads at leaderboard size.

## Adding a character shifts the eval baseline

`resetGame()` draws 9 opponents at random from `AI_CONFIG`, and the eval harness runs
on a seeded `Math.random`. A 67th entry changes the draw for **every seed**, so:

- `npm run trace` will report divergence. That is expected, not a bug — re-record with
  `npm run trace:update` once the character is final.
- The eval anchor (`node regatta/eval/run_eval.js 100 100`) moves because the fleets
  are different. Don't read the delta as a regression; re-measure and record the new
  anchor.
- To check the character isn't over- or under-powered, use the per-character run:
  `node regatta/eval/character_eval.js 50` → `regatta/eval/character_stats.json`,
  which reports placement by character. Judge at 20+ seeds; small samples have
  reversed on this project before.
