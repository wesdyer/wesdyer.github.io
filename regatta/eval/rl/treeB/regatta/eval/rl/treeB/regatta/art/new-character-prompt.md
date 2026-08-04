# New competitor prompt

Paste the block below into an assistant, replacing `{{CREATURE}}` with the animal you
want. It returns everything needed to add one racer: the `AI_CONFIG` record, the kite
pattern, the 14 quotes, and the portrait (or the image prompt to generate it).

Fleet facts go stale as the roster grows — if the assistant has repo access, tell it to
read `regatta/js/script.js` and `guidelines/skills.md` rather than trust the lists here.

**Current roster: 82 competitors.** Target is 100.

---

```
You are adding one competitor to SaltyCritter Yacht Club, a stylized top-down sailing
racing game with an 82-boat AI roster. I will give you a creature; you return a
complete, drop-in character.

CREATURE: {{CREATURE}}

Design the character first — one clear racing personality that grows out of how this
animal actually moves and behaves — then make every field express that same idea. A
character is coherent when the stats, the archetype, the personality line, the beat
line, the colours and the portrait all say one thing. Incoherent characters have
shipped here before (a "rocket start" with -3 acceleration, an "explosive" boat with
-4 acceleration) and all of them had to be reworked.

Return these five deliverables, each in its own fenced code block.

────────────────────────────────────────────────────────────────────────
1. THE AI_CONFIG RECORD
────────────────────────────────────────────────────────────────────────
One JavaScript object literal on a single line, fields in exactly this order:

{ name: 'Xxx', creature: 'Xxx', hull: '#RRGGBB', spinnaker: '#RRGGBB', spinnaker2: '#RRGGBB', spinnaker3: '#RRGGBB', sail: '#RRGGBB', cockpit: '#RRGGBB', personality: "...", beat: '...', archetype: '...', stats: { acceleration: 0, momentum: 0, handling: 0, upwind: 0, reach: 0, downwind: 0, pressure: 0, lightAir: 0, heavyAir: 0, memory: 0 } },

name         One word, capitalized, evocative rather than literal — the roster runs
             Bixby, Fathom, Skitter, Bulkhead, Slipstream. Not the species name.
creature     The species in title case, e.g. 'Leafy Seadragon'.
hull         The boat's primary identity colour. Derive it from the PORTRAIT, not from
             imagination — the boat should look like the character.
spinnaker    Kite base. It MUST contrast the hull: the hull already carries the
             creature's colour, so a kite in the same hue is invisible at race scale.
spinnaker2   Kite accent. Must differ from the base or the pattern vanishes.
spinnaker3   OPTIONAL third kite colour. Required if the pattern is a 3-colour one;
             omit entirely otherwise.
sail         White or black. Nothing else — one saturated sail shipped once and was
             reworked. Black sails need a hull of luma >= 80 or the boat is a
             featureless silhouette upwind.
cockpit      A muted neutral — grey, tan or slate, roughly #A0A0A0-#D8D8D8. Interior
             trim, never a third identity colour.
personality  One short sentence, present tense, no name, ends with a period. Appears
             verbatim in the profile panel.
beat         The "How to Beat Them" line — one imperative sentence giving the player
             the tactical counter. It MUST name a weakness real in the stats or the
             archetype. This is the rule the roster has broken most often.
archetype    One key from the table below.

COLOUR RULES, all enforced by `npm run test:livery`:
  · profile band uses the hull unless its luma (0.299R+0.587G+0.114B) is <50 or >200,
    in which case it falls back to the spinnaker. Both extreme = a band with nothing
    to draw. One of the two must be mid-tone.
  · hull and spinnaker must not share a hue within 40 deg AND a luma within 60.
  · no two competitors may share an identical kite (pattern + all colours).

────────────────────────────────────────────────────────────────────────
2. STATS — ten of them, -5..+5, integers (decimals only for tuning)
────────────────────────────────────────────────────────────────────────
acceleration  ±2.4%/pt on acceleration rate — building speed out of turns and lulls
momentum      ±2.0%/pt on deceleration damping — carrying speed through manoeuvres
handling      ±3.0%/pt on turn rate (pure turning; heavy air is NOT its job)
upwind        ±1.2%/pt boat speed on the beat
reach         ±1.8%/pt boat speed reaching     — largest multiplier
downwind      ±1.5%/pt boat speed on the run
pressure      ±5.0%/pt on wind capture: more from gusts, less lost in lulls and
              terrain shadows, and LESS HURT BY ANOTHER BOAT'S DIRTY AIR. Nothing
              else in the game touches dirty air. Does nothing in steady clean wind.
lightAir      groove below 10 kn, quadratic ramp 10 -> 6
heavyAir      groove above 16 kn, quadratic ramp 16 -> 20; also relieves the
              OVERPOWERED penalty every boat pays above 18 kn
memory        persistence-vs-recency: +5 is a long retention window, strong where
              structure repeats, slow to notice genuine change. -5 adapts instantly
              and accumulates nothing. NOT a good/bad axis.

lightAir and heavyAir are INDEPENDENT axes, not two ends of one scale: both high is a
wide groove, both low is good-only-in-the-middle, and both are legitimate characters.
Moderate air (10-16 kn) is untouched by either.

Tack agility blends handling×0.3 + acceleration×0.3 + momentum×0.2. A boat weak in all
three is genuinely painful to force into manoeuvres — the most reliable weakness a
beat line can point at.

BALANCE. Do not aim at a stat total; aim at a TIER. Absolute cutoffs live in
`regatta/eval/tier_bands.json` and the scoring model in `regatta/eval/tier_grid.py`.
Say which tier the character should be and check it, rather than guessing from a sum.
  · at least one stat >= +3 and one <= -3, OR a deliberate "Even" build (nothing
    beyond ±2), which is a real character type and the rarest on the roster
  · no more than two stats at ±5
  · every advertised strength and weakness must be mechanically real

────────────────────────────────────────────────────────────────────────
3. ARCHETYPES — pick exactly one
────────────────────────────────────────────────────────────────────────
key         label            races like                        stat requirement
bully       Line Bully       crowds rivals, collects fouls      —
rocket      Rocket Start     commits early off the line         acceleration >= +1
shift       Shift Whisperer  reads wind fast; OVER-TACKS, and   —
                             pays for it in every manoeuvre
freight     Freight Train    carries speed, rounds wide         momentum >= +1
corner      Corner Artist    surgical roundings, yields lanes   handling >= 0
gambler     Corner Gambler   bangs one side of the beat         —
leech       The Leech        matches the nearest rival's tack   —
metronome   Metronome        never blunders, never spikes       —

Measured: seven of the eight have NO effect on finish time — they change how a boat
races without handing it power. That is the design working. Do not treat an archetype
as a stat bonus.

Optionally add `traits: { ... }` to override ONE archetype trait that is this
character's identity, within ~30% of the archetype value. Example: Muninn is `shift`
with `traits: { windFast: 1.75 }` against the archetype's 1.4, because he is the
roster's learner. Two overrides maximum, or archetypes stop meaning anything.

────────────────────────────────────────────────────────────────────────
4. SPIN_LOOKS ENTRY
────────────────────────────────────────────────────────────────────────
One line: `    Name: 'pattern',`

2 colours: halves, crosshalves, gores, stripes, rays, triangle
3 colours: thirds, chevron, sunburst, tricolour   (these REQUIRE spinnaker3)
1 colour : solid   (ignores spinnaker2 and spinnaker3)

Match the pattern to the personality: solid is severe or immovable, stripes
methodical, gores classic-technical, crosshalves aggressive, rays and sunburst
explosive or festive, chevron directional and fast, thirds calm and formal, tricolour
bold and ceremonial, triangle focused.

Three-colour patterns must stay LARGE-FEATURED — the kite is 40-60 px at race scale
and finer divisions grey into mush.

────────────────────────────────────────────────────────────────────────
5. AI_QUOTES BLOCK
────────────────────────────────────────────────────────────────────────
JSON keyed by the character's name with exactly these 14 triggers:

player_passes_them, they_pass_player, they_hit_player, they_were_hit,
narrowly_avoided_collision, player_narrowly_avoided_collision, moved_into_first,
moved_into_last, rounded_mark, first_across_start, finished_race, prestart,
start_planing, random

2-7 words each, under ~45 characters — these float over a moving race. In character,
never naming themselves or the player. No emoji. Straight ASCII apostrophes.
they_hit_player and they_were_hit should differ in attitude.

────────────────────────────────────────────────────────────────────────
6. THE PORTRAIT
────────────────────────────────────────────────────────────────────────
500 x 500 PNG, straight-alpha transparent, bust crop, face within the central 70%,
legible at 64 px. Delivered to regatta/assets/images/competitors/<lowercase>.png

Match the roster's framing or the character crops differently from everyone else in a
circular frame. Measured over the shipped portraits: content spans x 0.16-0.87,
y 0.12-0.87, filling ~0.53 of the frame, centred at (0.508, 0.496).

  Stylized polished 2D game art for SaltyCritter Yacht Club; colorful nautical
  adventure; bold simplified shapes; clean cel-shaded and lightly faceted planes;
  saturated but controlled palette; crisp readable silhouette; friendly sophisticated
  tone; clear directional lighting; minimal microtexture; no text; no UI; no
  photorealism. Anthropomorphic {{CREATURE}} sailing competitor, upper-body
  three-quarter portrait, transparent background, expressive face reading as
  <personality in 3-4 words>, strong dark charcoal outer outline 4-8px, simplified
  interior linework, wearing a distinctive modern life jacket with visible zipper,
  belt and buckle hardware, clean cel shading, readable at 64px, no scenery.

  Negative: photorealistic, cinematic realism, 3D render, heavy painterly brushwork,
  watercolor wash, gritty, horror, military, generic vector clip art, excessive
  texture, excessive bloom, neon everywhere, thin fragile details, cluttered
  background, text, logo, watermark, inconsistent perspective.

EVERY competitor wears a proper PFD with zipper and belt. No costumes, no props — the
one costumed character shipped was reworked.

────────────────────────────────────────────────────────────────────────
TAKEN — do not reuse
────────────────────────────────────────────────────────────────────────
Names: Anchor Anvil Bixby Blaze Bluff Bramble Breeze Brine Bruce Bulkhead Cheer
Chomp Clutch Crimson Croak Crush Cruz Dart Dozer Drift Ember Etienne
Fathom Finley Flash Flaunt Flicker Frenzy Frond Gasket Glide Grip Hug
Jester Knot Lure Mistral Muninn Nimbus Paddle Pearl Pebble Petal Pinch
Piper Popper Prism Puff Pulse Razor Regal Rift Ripple Roll Saffron Scoop
Scuttle Skerry Skim Skitter Slipstream Snap Spike Splash Splat Stomp
Stripes Strut Sunshine Tangle Tiny Torch Torpedo Torrent Veil Vex Viper
Whiskers Wiggle Wobble Zeffir Zing

Creatures: Acorn Barnacle, Adelie Penguin, American Beaver, American Bullfrog,
American Lobster, Anemone Shrimp, Antarctic Krill, Arctic Tern, Atlantic
Mudskipper, Atlantic Puffin, Axolotl, Barracuda, Black Seadevil,
Blobfish, Blue-Footed Booby, Bottlenose Dolphin, Brown Pelican,
California Newt, Chambered Nautilus, Clownfish, Common
Octopus, Common Raven, Common Swift, Elephant Seal, Fire Salamander,
Firefish, Flamingo, Florida Manatee, Flying Fish, Flying Squirrel, Great
White Shark, Green Tree Snake, Hammerhead Shark, Harbor Seal, Hermit Crab,
Herring Gull, Hippopotamus, Kingfisher, Leafy Seadragon, Lined Seahorse,
Mackerel, Mahi-Mahi, Mako Shark, Mallard Duck, Mandarin Dragonet, Mantis
Shrimp, Maxima Clam, Moray Eel, Mute Swan, Narwhal, Northern Pike,
Nudibranch, Nurse Shark, Ochre Sea Star, Orca, Pacific Oyster, Platypus,
Polar Bear, Pom Pom Crab, Pufferfish, Red Rock Crab, Red Snapper, Red
Swamp Crayfish, Red-Bellied Piranha, Roseate Spoonbill, Saltwater
Crocodile, Sanderling, Sea Nettle, Sea Otter, Sea Turtle, Sea Urchin,
Snapping Turtle, Sockeye Salmon, Spotted Eagle Ray, Swordfish, Tiger Shark, Tree Frog,
Vampire Squid, Walrus, Wandering Albatross, Water Dragon, Yellowfin Tuna

────────────────────────────────────────────────────────────────────────
FINALLY
────────────────────────────────────────────────────────────────────────
Add a short coherence check: the archetype's stat requirement is met; the beat line
names a weakness that is real in the stats; the top three stats by absolute value tell
the intended story; the kite contrasts the hull; and any 3-colour pattern has a
spinnaker3. If a check fails, fix it and say what changed.
```

---

## Where the output goes

| Block | Destination |
|---|---|
| `AI_CONFIG` record | append inside `const AI_CONFIG = [ … ]`, `js/script.js` |
| `SPIN_LOOKS` entry | append inside `const SPIN_LOOKS = { … }`, `js/script.js` |
| `AI_QUOTES` block | append inside `const AI_QUOTES = { … }`, `js/ai-quotes.js` |
| Portrait | `assets/images/competitors/<lowercase-name>.png`, 500×500 RGBA |

Nothing else needs registering — the fleet is drawn at random from `AI_CONFIG`.

## Verifying

```bash
npm run test:livery      # colours, contrast, patterns, duplicate kites
npm test                 # the full suite
node --check regatta/js/script.js && node --check regatta/js/ai-quotes.js
python3 regatta/eval/tier_grid.py   # where the new character actually lands
```

Then open `regatta/competitor.html` — the roster sheet renders every profile panel
exactly as the pre-race sidebar does, plus the full stat line and paint job.

## Adding a character shifts the eval baseline

`resetGame()` draws 9 opponents at random from `AI_CONFIG` on a seeded RNG, so one new
entry changes the draw for **every seed**. `npm run trace` will report divergence —
expected, not a bug. Re-record with `npm run trace:update` once the character is final,
and re-measure the anchor rather than reading the delta as a regression.
