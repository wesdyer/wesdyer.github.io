---
name: venue-wildlife
description: Draw and animate a regatta venue animal in js/wildlife.js the way Wes wants it — overhead reference research, a size target from guidelines/scale.md, the look-bench, in-scene checks, and water effects and shadows. Use for any new or reworked animal (and the school's ducklings).
---

# Venue wildlife — research, size, draw, look, repeat

Wes judges animals by looking at them. The Cove's gull, pelican and porpoise are the quality
bar he approved. The pond and lake animals had to be redone because they skipped steps 1–2
and were never checked at game scale against the Cove set.

## Where things live

- **All animal drawing is in `regatta/js/wildlife.js`.** Wes: "keep that stuff clean." A
  module that moves its own animals (school.js and the ducklings) keeps the behaviour and
  calls a `Wildlife.draw*` function, like `drawDucklings(ctx, ducks)`.
- **Behaviour kits**, configured per venue in `WILDLIFE`: COLONY (perched flock, flushes),
  PODS (bow-riders + a resident pod), FEEDERS (patrol birds + bait boil), FOLLOWERS (gulls
  astern of a boat), BASKERS (turtles on a log prop), DIVERS (grebes/loons/beavers; `pair`),
  WADERS (the moose: bed → open bank → forest → back), CRUISERS (under the surface, seen
  through it: `depth` drives the veil and the bottom-shadow offset; `formation`, `breathe`,
  leaps — the Lagoon's turtles, eagle rays and reef sharks). Reuse a kit before writing a new
  one. Swimmers treat reef as water: their dry-land test is `VenueDoc.traits(s).hard && !reef`,
  and it also skips prop colliders (`s.id` ending `.hit`). A coral head's collider is a wall to
  a boat, but the tangs started inside it and never moved. Also: LEAPERS (a fish jumps near the
  player now and then), SHOALS (tang schools round a coral head), and BASKERS with
  `all`/`openOnly`/`banks` (the Bayou's bullfrogs;
  POPPERS = the Cove's harbour seals bottling, head up and turning to watch the nearest boat,
  gliding off as a dim seal shape under the water between — Wes asked for that underwater
  shadow; `underCrown()` skips logs under a tree —
  trees mark their crown as `parts.canopy`, not the canopy plane).
- **Speed is sized like size: about 1–2 drawn body lengths a second.** Tangs "way too fast"
  at 28 u/s; now capped ~12. Steer VELOCITY toward the target (a capped spring, eased), never
  snap the heading at a target right beside the animal, which makes it dart.
- **Draw layers:**
  - `drawWater`: under land, after SeaFX. Swimmers and underwater shapes.
  - `drawPerched`: above land and props, below the canopy. Anything that walks on land.
  - `drawAir`: above the canopy. Flyers.
- ⚠️ **Never `Math.random`.** Use the module's mulberry PRNG seeded by the venue. `update(dt)`
  runs on the sim clock. Nothing touches a boat.

## 1. Size first (guidelines/scale.md)

1 unit = 10 cm, and the boat is 5.5 m = 55 units. **Draw at true size × 3, with a floor of 20
units bill/nose to tail, keeping the true size order** among animals that share water. **A
broad animal (a turtle's shell with spread flippers) reads by its footprint: keep it near 2×
and measure its spread too.** Wes found the 3× green sea turtle too large. **Count tails and
whips in the length**: the eagle ray read "huge tip to tail" until its whole length was about a hull. Write
the target length down BEFORE drawing, and measure with
`node regatta/eval/_animal_sizes.js` (add the new draw function to its list). Each animal's
scale is a named constant near the top of wildlife.js (`TURTLE_SCALE` and so on). The grebe,
loon, turtle and beaver were drawn 1.5–2× over the cap until Sep 25: they had been iterated
at 3× on the bench with no size target. When an animal is resized, its wake `halfW`, rings and
splashes must shrink with it.

## 2. Reference research (a research task, not a glance)

Wes, Sep 25 2026: "find many reference images and use them (especially orthographic, aerial
or drone imagery)". Aim for 3–5 sheets per animal. Run the slugs in parallel (a `while read`
loop with `&` and `wait`) and write down what each sheet changed. At Sockeye Run the
second round changed four drawings:
- **Bear:** a peanut from above, with a small head, ears on its back corners and huge
  haunches. Fishing, it stands half-submerged.
- **Otter family:** separate heads a body length apart, each with its own V. On a log they
  lie side by side, never nose to tail.
- **Sockeye:** comet-shaped streams of dozens, not a dozen scattered fish.
- **Eagle:** it carries its fish head-first under the body.

Collect several overhead references per subject, drone or orthographic if possible:

```sh
REFDIR=<scratchpad>/refs python3 regatta/eval/_refsheet.py <name> <istock-slug> <must|words>
```

Then Read the contact sheet image. Slug tips:
- Name the viewpoint in the slug: `-from-above`, `-aerial-view`, `-top-view`, `-drone`.
- Also try the social form, e.g. `duck-family-swimming-top-view`. Baby words return toys:
  every "duckling" slug gave rubber ducks.
- Run 2–4 slugs and throw away the cartoons.

Write down what the references say before drawing. Examples that changed a drawing:
- **Basking turtles:** single file, nose to tail.
- **Mallard ducklings:** a brown back with four yellow spots, not yellow birds.
- **Swimming beaver:** a bow-wave "moustache" and a many-line V wake.
- **Moose:** palmate antlers that stay above water when the head dips.

**Then compare, feature by feature.** Build a board of the 6–8 best cells:

```sh
REFDIR=<dir> python3 regatta/eval/_refcells.py out.jpg sheet:row:col ...
```

Set it beside the bench render at 3× and go through each feature: outline and proportions,
the colour of each part (head, body, tail, face), what shows above and below the water, and
how the water responds. Wes asked for exactly this on Sep 25 ("look closely at reference
images … make sure the salmon look right (head and body coloring)"). A glance at a sheet had
missed the sockeye's yellow-olive head, the bear's calm rings in slack water, and the
eagle's wing length. Put shared colours in a named palette (`SOCKEYE`) so every drawing of
that animal agrees: the leaper, the one in the bear's jaws, and the one in the eagle's
talons.

## 3. Draw in the house style

- Soft outline `SOFT`, flat fills, a few lines of pattern that read at 1 unit = 1 px.
- No perfect ellipses or rings: geometric shapes read as UI. Break the arcs up.
- Draw the organism's silhouette, not a blob. The moose read as a hippo, then a bottle,
  until the face, spine stripe and antlers were there.
- Poses cycle off `bob`, `flap`, `dip` and similar state, not wall time.

## 4. Water effects and shadows (they count as much as the animal)

The full rules are in `guidelines/race-view.md` §10.6. Plan every animal's water events
before you draw: what it does on the surface, under it, above it, and on land. Each event
needs its own effect, sized to the drawn body.

**Shadows:** light comes from the upper left, so shadows fall down and to the right.

| Kind | How |
|---|---|
| Flying | Own silhouette, same wing pose, offset `(x + 0.35z, y + 0.55z)`, scale 0.95. `rgba(10,25,40, 0.2·max(0.3, 1−z/120))`. Reuse `shadow()` or copy the gull/pelican pattern. |
| On the water | A soft contact shade under and behind the body (~`rgba(8,24,30,0.28)`). |
| Under the water | Faint flat darker shape, alpha 0.3–0.5, no outline: the porpoise's whole body, the beaver's body and tail, the moose's legs, a submerged turtle. Diving = shrink + fade (`sink`), not a blink. |
| Wading / on land | Shadow on the shallow bottom in water; cast on the ground once `onLand`. Switch the ripples off ashore. |

**Water interaction:**

| Event | Effect |
|---|---|
| Swimming | `drawWakeTrail(ctx, a, halfW, spread, alpha)`: `halfW` = DRAWN shoulder half-width (native × scale); `spread` ≈ 0.35 × point spacing (Kelvin ~19°); ducklings 5 / 1.9 at 3.5-unit spacing. Record trail points only on real movement and age them out. For a line of animals, draw all the wakes, then the bodies. |
| Pushing water | Bow ripple: short arcs curling back off the chest, or the beaver's white moustache. Never a ring around the head. |
| At rest | Slow ring breathing out, ~0.3 alpha, phased per animal. |
| Diving / surfacing | Dive ring where it goes down (`drawDiveRing`), rise ring where it comes up. |
| Plunge / slide in | White spray crown, then a spreading ring. Spray at irregular angles and lengths (see `drawSlap`); a regular sunburst reads as an icon. |
| Head lifted out | Drips off the head plus a ring (the moose). |
| Gone down | Pale smooth slick, fading (the porpoise). |
| Fish feeding | Bait boil: dark fish swirling UNDER the water as soft shadows, surface boiling, spray crowns where birds hit. |

**Never:** perfect ellipses or rings (read as UI), particle dashes for foam or spray (read
as rain; white water is connected sheets), effects pulsing in lockstep across a group.

- **An animal standing IN a stream** (the bear) takes the stream's wake. Lay a trail
  DOWNSTREAM along the current (not along its heading) and hand it to `drawWakeTrail`. Dim
  the submerged flanks with `waterTint()`, keep the back dry, and heap foam on the upstream
  side. Straight parallel white lines off its sides read as spider legs, and a dashed outline
  reads as a sticker rim.

## 5. Look at it, at game scale, then in the scene

`eval/_river_bench.js` (a headless bench PNG with the hull and the Cove references) and
`eval/_river_scene.js` (the real canvas, stepped, the boat parked by each animal) are
templates; copy them per venue. Park the camera boat OUTSIDE an animal's reaction radius,
or you are only photographing its reaction.


1. **Bench:** serve the repo over http (`python3 -m http.server <port>` from the repo root;
   use a new port if the cache bites). In the page:

   ```js
   const s = document.createElement('script'); s.src = 'eval/_wildlife_bench.js?' + Date.now(); document.head.appendChild(s);
   __bench('<venue>')   // game scale + 3x, the Cove set as the reference row, a hull for size
   ```

   Add the new animal's items to `eval/_wildlife_bench.js`, then zoom the screenshot on both
   rows.
2. **In the scene:** the Chrome tab is a background tab, so rAF is unreliable. Step it by hand:
   `for (...) { update(1/30); draw(); }`. Then render the live objects onto an overlay canvas
   at 1× and ~3× around their centroid (translate → rotate(−heading) → translate(−centroid)
   → call the real draw with the live objects). That gives a steady close-up of real
   behaviour and real wakes.
3. **Getting to a scene:**
   - Click hub buttons from JS (`[...document.querySelectorAll('button')].find(e =>
     /start school/i.test(e.textContent)).click()`); coordinate clicks on the hub miss
     intermittently.
   - Sailing School reading gates freeze the sim clock. `update()` still steps it.
   - After re-laying a lesson, steer the boat along its path (at `s.B1`), or the lead point
     never moves.
4. **Know your own artifacts.** Spawning animals far away makes them swim sideways into
   place. A zero-length step gives `atan2(0, -0) = π` headings, so turn only on real motion,
   and ease the turn.

## 6. Finish

- Venue test (`eval/test_<venue>.js`): positions, no `Math.random`, feats (see the
  `venue-objectives` skill).
- Run the other venues' tests too: the draw code is shared.
- Re-run `_animal_sizes.js` and update the table in `guidelines/scale.md`.
- Show Wes at-size screenshots, including the bench, and say what the references changed.
