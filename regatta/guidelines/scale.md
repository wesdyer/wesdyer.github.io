# Scale — how big everything is

*Sep 25 2026. Settled with Wes while building the venue wildlife. The venues themselves are
still scattershot on scale; Wes's venue pass will bring them to this. New work — wildlife,
props, structures — is made to this now.*

## The ruler — **Rule**

**The boat is 5.5 m (18 ft) long. One world unit is 10 cm.**

| | |
|---|---|
| Hull | 55 units (`HULL_LENGTH` in `rules.js`) = 5.5 m = 18 ft |
| 1 metre | 10 units |
| 1 foot | ≈ 3 units |
| On screen | 1 unit = 1 px at player zoom (art-pipeline.md §1) |

Not a J-105 (that reading made the hull 11 m and every house a shed). An 18-footer is a
Flying Scot / Lightning-class club boat, which is what the sprite already draws: jib, spinnaker,
cockpit. At this scale houses are properly large (two to three boat lengths) and a ship is a
wall, while an animal can still be drawn big enough to read.

## What is drawn true, and what is not

**True scale:** buildings, docks, piers, seawalls, bridges, lighthouses, ships and boats that are
not in the race, and trees (crowns may run generous, since that buys coverage cheaply; see the
cove planting notes). If it was built or grown, look up its real size and multiply by 10.

**Gameplay-sized, exempt:** marks, the committee boat, gates and anything else the race
rules read. A real racing mark is about 1 m (10 units) and would be invisible, so these are sized
for play.

**Animals: true size × 3, with a floor.**

1. **Floor: about 20 units along the long axis.** Anything smaller does not read at race
   speed. A duckling (1.5 units true) is drawn at the floor.
2. **Cap: about 3× true size.** The approved Cove animals sit here: gull 2.7–3.7×, pelican
   ~3×, porpoise 2.5×. Past 3× an animal stops reading as wildlife and starts reading as a
   landmark.
3. **Keep the order.** Where the floor squashes small animals together, step them about 15%
   per rank so they stay in their true order: duckling < turtle < grebe < loon. A bigger animal
   never draws smaller than a smaller one sharing its water.
4. **Measure body length, bill or nose to tail.** Wings, antlers and legs follow in proportion.
   A flying bird's span comes out of its body length; it is not sized separately.
5. **A broad animal reads by its footprint, not its length: keep it near 2×.** Measure the
   spread as well as the length. Wes, Sep 25: the green sea turtle at 3× (37 long, 46 across
   the spread flippers) was "too large". A domed shell with outspread flippers covers far more
   water than a slim shark of the same length, and read as big as one. At ~2× (26 long, 32
   across) the Lagoon's order matches life: turtle < shark < ray. A slim animal (shark,
   porpoise, loon) or a thin-winged one (gull) can use the full 3×.
7. **Below the floor, on purpose, when the animal reads as a GROUP or by its SPLASH.**
   The 20-unit floor is for an animal that has to read on its own. Three don't:
   - **Bayou bullfrogs, ~10:** three to a drift log. The log and the hop read.
   - **A Lake bass jumping, ~14:** in the air for half a second. Its fish-sized splash and
     rings are the read.
   - **Lagoon tangs, ~10:** a school of twenty-odd is the shape.

   A 20-unit frog would be a two-metre frog on an eight-metre log.
8. **Speed is sized too: a body length or two a second.** Wes, Sep 25: the first tangs moved
   "way too fast". A tang darted at up to 28 u/s and bolted at 160; it now cruises at up to
   ~12 u/s (measured ~7) and scatters at ~45. An animal's cruise speed is about 1–2 of its
   drawn body lengths per second. Its effects follow the same rule: the jumping bass throws a
   fish-sized splash, not the beaver's slap (which is five times the fish).
6. **Count the whole animal, tail included.** Wes, the same day: the eagle ray looked "huge
   tip to tail". It had been sized by body and disc, and its whip tail added ~70 units, making
   it nearly two hulls from snout to tip. The eye reads a thin tail as part of the animal, so
   the ray is now ~58 snout to tail tip (about a hull) with a ~44 disc.
   `eval/_animal_sizes.js` measures the ray at a low alpha threshold so the tail counts.

Effects travel with the animal, not the ruler: a wake, a ring or a splash is sized to the
drawn body, or it reads as belonging to something else. How each water effect and shadow is done (wakes, rings,
splashes, underwater bodies, flying shadows) is [race-view.md §10.6](race-view.md).

## The animals as built — **Observed**

Solid pixels (alpha > 150) of each draw function at game scale, so faint shadows, rings and
wakes are left out. Re-measure with `node regatta/eval/_animal_sizes.js` whenever an animal is redrawn.

| Animal | Venue | True length | True, in units | Target (3×, floor 20) | Drawn now | |
|---|---|---|---|---|---|---|
| Mallard duckling | School | 0.15 m | 1.5 | 20–22 | 22 | ✓ at the floor |
| Painted turtle | School | 0.2 m | 2 | ~25 | 27 (19–27 by size) | ✓ resized Sep 25 (was 33) |
| Great crested grebe | School | 0.5 m | 5 | ~29 | 29 | ✓ resized Sep 25 (was 55) |
| Herring gull (perched) | Cove | 0.6 m | 6 | 20 | 22 | ✓ approved |
| Herring gull (span) | Cove | 1.4 m | 14 | 42 | 38 | ✓ approved |
| Common loon | Lake | 0.8 m | 8 | ~32 | 31 | ✓ resized Sep 25 (was 65) |
| Beaver (with tail) | Lake | 1.2 m | 12 | 36 | 36 | ✓ resized Sep 25 (was 53) |
| Brown pelican (body) | Cove | 1.3 m | 13 | 39 | 41 | ✓ approved |
| Brown pelican (span) | Cove | 2.1 m | 21 | 63 | 62 | ✓ approved |
| Harbour porpoise | Cove | 1.6 m | 16 | 48 | 40 | ✓ approved |
| Moose (with head) | Lake | 3 m | 30 | 90 | 77 | ✓ |
| Green sea turtle | Lagoon | 1.2 m | 12 | ~26 (≈2×, Wes) | 26 (32 across the flippers) | ✓ cut from 37 / 46 across, Sep 25 |
| Spotted eagle ray (disc; snout to tail tip) | Lagoon | 2 m span; ~3.5 m | 20; 35 | ~44; ~58 (about a hull) | 42; 58 | ✓ cut Sep 25 from 60 across and ~100 tip to tail |
| Blacktip reef shark | Lagoon | 1.4 m | 14 | 42 | 40 | ✓ Sep 25 |
| American alligator (nose to tail tip) | Bayou | 3.5 m | 35 | ~48 (≈1.4×: broad, and a boat-sized gator reads as a monster) | 50 | ✓ Sep 25 |
| Great egret (standing; span) | Bayou | 1 m; 1.5 m | 10; 15 | ~28; ~42 | 22; 42 | ✓ Sep 25 |
| Anhinga (wings spread to dry) | Bayou | 1.15 m span | 11.5 | ~32 | 30 | ✓ Sep 25 |
| American bullfrog | Bayou | 0.15 m | 1.5 | ~10 (group, rule 7) | ~10 | ✓ Sep 25 |
| Bass, jumping | Lake | 0.4 m | 4 | ~14 (splash, rule 7) | 14 | ✓ Sep 25 |
| Yellow / blue tang | Lagoon | 0.2 m | 2 | ~10 (school, rule 7) | ~10 | ✓ Sep 25 |
| Harbour seal (head up; body under water) | Cove | 0.2 m head; 1.6 m | 2; 16 | head ~12 (rule 7, read by its ring); body ~30 | ~12; ~30 | ✓ Sep 25 |
| Brown bear (nose to rump) | River | 2.2 m | 22 | ~46 (≈2×: broad; at 58 it stood as long as the hull) | 43 (26 across the shoulders; haunches 0.86 of that, head 0.68 — a grizzly's build) | ✓ Sep 25 |
| Sockeye salmon | River | 0.6 m | 6 | ~18 (a run, rule 7) | 17 | ✓ Sep 25 |
| Bald eagle (span × body) | River | 2 m; 0.9 m | 20; 9 | ~58; ~27 | 58; 29 (span 2× body, per the soaring refs) | ✓ Sep 25 |
| River otter (with tail) | River | 1.1 m | 11 | ~32 | 36 | ✓ Sep 25 |

The four resized animals were all from the pond and lake round, the one Wes said looked worse
than the Cove. They had been iterated at 3× on the bench with no length target and ran 1.5–2×
too big; the loon was even drawn bigger than the beaver. The scales are named constants beside
the Cove's in `js/wildlife.js` (`TURTLE_SCALE`, `GREBE_SCALE`, `LOON_SCALE`, `BEAVER_SCALE`).
Their effects shrank with them: wake widths start at the drawn shoulders, and the beaver's
tail slap is about a body length across.

## Where the code stands — **Observed**

- **Distance labels** convert at 0.2 m per unit (`script.js` `metres()`, the school's buoy
  distances), which is the old J-105 reading. At this ruler they should be 0.1. Moving them
  halves every metre figure the player sees (the goal chip, the mark edge labels), so the
  change belongs to Wes's venue scale pass, not to a wildlife change.
- **Speed** runs at 15 units/s per knot (`U_PER_S_PER_KNOT` in `sailcheck.js`). At 10 units per
  metre a real knot is 5.1 units/s, so the game runs about **3× real time**. That is a
  deliberate choice about how the game feels, and it stays; the knots shown are true to the
  polars.
- **Vegetation** was already sized close to this ruler: venues.md's fruit note puts the
  four-pixel floor at ~0.43 m, i.e. about 9 units per metre.
- **Ships**: a real cargo ship is 150–200 m, which is 1500–2000 units (30+ boat lengths).
  The Cove's current freighter is 700 units, a 70 m coaster at this ruler.

## Quick reference

| Thing | Real | Units | Boat lengths |
|---|---|---|---|
| Racing mark (exempt) | 1 m | 10 | — |
| Dock width | 2–3 m | 20–30 | ~½ |
| Mooring skiff | 4 m | 40 | ¾ |
| **Our boat** | **5.5 m** | **55** | **1** |
| House | 10–15 m | 100–150 | 2–3 |
| Tree crown | 6–12 m | 60–120 | 1–2 |
| Lighthouse tower (base) | 5–8 m | 50–80 | 1–1½ |
| Trawler | 20 m | 200 | 4 |
| Cargo ship | 150–200 m | 1500–2000 | 30–36 |
