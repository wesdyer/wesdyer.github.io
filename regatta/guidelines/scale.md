# Scale — how big everything is

*Sep 25 2026. Settled with Wes while building the venue wildlife. The venues themselves are
still scattershot on scale; Wes's venue pass will bring them to this. New work — wildlife,
props, structures — is made to this now.*

## The ruler — **Rule**

**The boat is a Spindrift 18: 18 ft (5.49 m) long. One world unit is 10 cm.**

It is codified in `js/scale.js`, loaded first by every page: `SPINDRIFT_FT`, `WORLD_M_PER_U`,
`BOAT_LEN_U` (55, derived) and `lifeU(metres)`. Size things from those, not from a typed 55 or 56
(Wes, Oct 13 2026).

| | |
|---|---|
| Hull | 55 units (`BOAT_LEN_U` in `scale.js`; 54.9 held to the hull polygon's whole unit) = 18 ft |
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

**Animals: 1.5× true size or less, at sea level, with a floor.** (Oct 18 2026, Wes: "let's reduce everything
to 1.5x or less" — "scale should represent scale at sea level". Until then the house rule was ×3 with a 20-unit floor;
every venue was brought down to this in one pass, Oct 18 2026.)

1. **Cap: 1.5× true length, measured at sea level (z = 0).** A flying bird is then drawn larger with its height
   (perspective: `zScale(z)` and kin) — that is the camera, and stays: a frigatebird soaring at ~150 draws ~1.3× its
   sea-level size. Animals already at or under 1.5× (the whales, orcas, porpoise, spinner, alligator, manta) stay.
2. **Floor, so it still reads: about 10 units** for an animal that has to read on its own; **about 6–8** for one read as
   a group, flock, school, bloom or by its splash. Below the floor an animal is a pixel or two at race zoom (Emberfall's
   crab at 1.5× was ~3). Animals held up by the floor: duckling, painted turtle, grebe, gull, avocet, the terns, the
   small penguins, bullfrog, tangs, bass, sockeye, flying fish, mackerel, jellies — and the Sally Lightfoot and shore
   crabs, "a bit oversized" by Wes's call (~7 across the legs).
3. **Keep the order.** Where the floor squashes small animals together, step them so they stay in their true
   order: duckling < turtle < grebe (9.5 < 10.3 < 11.3); tern < gull < cormorant. A bigger animal never draws
   smaller than a smaller one sharing its water.
4. **Measure body length, bill or nose to tail.** Wings, antlers and legs follow in proportion.
   A flying bird's span comes out of its body length; it is not sized separately.
5. **A broad animal reads by its footprint, not its length** (the ×3 era kept these near 2×; under the 1.5× cap they
   are simply at or under it). Measure the
   spread as well as the length. Wes, Sep 25: the green sea turtle at 3× (37 long, 46 across
   the spread flippers) was "too large". A domed shell with outspread flippers covers far more
   water than a slim shark of the same length, and read as big as one. At ~2× (26 long, 32
   across) the Lagoon's order matches life: turtle < shark < ray. (History, the ×3 era.)
7. **The group floor (~6–8) is for an animal read as a GROUP or by its SPLASH:** bullfrogs on a drift log (~6), a
   jumping bass (~6), a school of tangs (~6), a run of sockeye (~9.5), mackerel in a boil (~6), a tern flock (~8).
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

Solid pixels (alpha > 150) of each draw function, drawn alone at sea level (z = 0) at 4 px a unit so thin bills and
tails count — `SIZES_ZOOM=4 node regatta/eval/_animal_sizes.js` (and `eval/_volc_sizes.js` for Emberfall). Length is
bill/nose to tail tip; a bird's span in brackets. Measured Oct 18 2026, after the 1.5× pass.

| Venue | Animal | True | Drawn (u) | × true |
|---|---|---|---|---|
| Duckling Pond | Mallard duckling | 0.15 m | 9.5 | floor |
| | Painted turtle | 0.2 m | 10.3 | floor |
| | Great crested grebe | 0.5 m | 11.3 | floor |
| Cove | Herring gull, perched (gliding span) | 0.6 m (1.4 m) | 9.8 (20.3) | floor (1.45×) |
| | Brown pelican, sitting (gliding span) | 1.3 m (2.1 m) | 19.3 (29) | 1.5× (1.4×) |
| | Harbour porpoise | 1.6 m | 23.5 | 1.5× |
| | Harbour seal, gliding under; its head bottling | 1.6 m | 23.8; 13.3 | 1.5× |
| Lake | Common loon | 0.8 m | 11.5 | 1.4× |
| | Beaver (with tail) | 1.2 m | 18.5 | 1.5× |
| | Moose | 3 m | 43.8 | 1.5× |
| | Bass, jumping | 0.4 m | 5.5 | group floor |
| Lagoon | Green sea turtle | 1.2 m | 18.5 | 1.5× |
| | Spotted eagle ray (snout to tail tip; disc) | 3.5 m; ~2 m | 46.8; 41.8 | 1.3× (disc ~2×) |
| | Blacktip reef shark | 1.4 m | 21 | 1.5× |
| | Tangs | 0.2 m | 5.8 | group floor |
| Gatorgrass Bayou | American alligator | 3.5 m | 50 | 1.4× |
| | Great egret standing (flying span) | 1 m (1.5 m) | 15.3 (~27) | 1.5× |
| | Anhinga swimming (drying span) | 0.85 m | 11.8 (11.8) | 1.4× |
| | Bullfrog | 0.15 m | 6.8 | group floor |
| Sockeye Run | Brown bear | 2.2 m | 32.5 | 1.5× |
| | Sockeye | 0.6 m | 9.5 | 1.6× (run) |
| | Bald eagle (span) | 0.9 m (2 m) | 13.8 (27.5) | 1.5× |
| | River otter, swimming | 1.1 m | 16.8 | 1.5× |
| Open Ocean | Humpback whale; calf | 14 m; 5 m | 134; 49 | 1.0× |
| | Spinner dolphin | 2 m | 29.5 | 1.5× |
| | Mahi-mahi | 1 m | 12.8 | 1.3× |
| | Flying fish | 0.3 m | 5.3 | group floor |
| | Laysan albatross (span) | 0.8 m (2 m) | 12 (35.3) | 1.5× |
| Redrock | California condor (span) | 1.2 m (2.9 m) | 18 (43.5) | 1.5× |
| | Desert bighorn ram; ewe; lamb | 1.6 m | 23.8; 21.3; 14.8 | 1.5× |
| | Coyote | 1.6 m | 24.8 | 1.5× |
| | Striped bass | 0.8 m | 12 | 1.5× |
| | Common carp | 0.7 m | 10.5 | 1.5× |
| Glacier Sound | Orca bull; cow; calf | 7.6; 6; 3.2 m | 76.5; 60.5; 32.3 | 1.0× |
| | Emperor penguin (prone) | 1.15 m | 17 | 1.5× |
| | Gentoo; macaroni; Adélie (prone) | 0.8; 0.7; 0.7 m | 11.5; 10.3; 10.3 | 1.4–1.5× |
| | Leopard seal | 3.2 m | 47.8 | 1.5× |
| | Antarctic tern (span) | 0.4 m (0.8 m) | 7 (16) | flock floor |
| Glowtide | Manta ray (span) | 4.5 m span | 68 | 1.5× |
| | Dugong; calf | 2.7 m; 1.5 m | 40.8; 23.5 | 1.5× |
| | Hawksbill turtle | 0.8 m | 12.3 | 1.5× |
| | Palau flying fox (span) | 1.1 m span | 15.8 | 1.45× |
| | Golden jelly (largest; smallest) | 0.1–0.2 m | 5.5; 2.5 | bloom |
| | Moon jellies (`world` 8.5 / 5.5) | 0.1–0.4 m | ~5–12; ~3–8 | bloom |
| Otter Point | Great white | 5 m | 67.5 | 1.35× |
| | Blue whale | 25 m | 340 | 1.4× |
| | California sea lion cow; bull | 1.9 m; 2.4 m | 27; 34 | 1.4× |
| | Sea otter | 1.3 m | 20.3 | 1.5× |
| Spoonbill Flats | Grey seal cow; bull | 2.0 m; 2.6 m | 34; 38 | 1.5–1.7× (size 1); ~1.5× at the mean size |
| | Roseate spoonbill (span) | 0.8 m (1.3 m) | 12 (~18.5) | 1.5× |
| | Pied avocet (span) | 0.44 m (0.75 m) | 8 (~16) | flock floor |
| | Shore crab (across the legs) | 0.15 m | 7 | oversized (Wes) |
| Clubhouse Point | Great cormorant (flying span) | 0.9 m (1.4 m) | 13.3 (16.5) | 1.5× |
| | Herring gull afloat (flying span) | 0.6 m (1.4 m) | 9.8 (20.3) | floor |
| | Common tern (span) | 0.33 m | 7.8 (16) | flock floor |
| | Mackerel | 0.3 m | 6 | group floor |
| | By-the-wind sailor | 7 cm | ~6 | mass |
| Emberfall | Scalloped hammerhead | 2.3 m | 35 | 1.5× |
| | Marine iguana | 1.2 m | 17 | 1.4× |
| | Blue-footed booby (span) | 0.8 m (1.5 m) | 11.3 (25) | 1.4× |
| | Great frigatebird (span) | 0.95 m (2.2 m) | 13.3 (31.8) | 1.4× |
| | Sooty tern (span) | 0.4 m (0.9 m) | 8.5 (19.5) | flock floor |
| | Sally Lightfoot crab (across the legs) | 0.2 m | 7 | oversized (Wes) |

(History, Sep 25 — the ×3 era:) the four resized animals were all from the pond and lake round, the one Wes said looked worse
than the Cove. They had been iterated at 3× on the bench with no length target and ran 1.5–2×
too big; the loon was even drawn bigger than the beaver. The scales are named constants beside
the Cove's in `js/wildlife.js` (`TURTLE_SCALE`, `GREBE_SCALE`, `LOON_SCALE`, `BEAVER_SCALE`).
Their effects shrank with them: wake widths start at the drawn shoulders, and the beaver's
tail slap is about a body length across.

## Where the code stands — **Observed**

- **Every metre is on this ruler** (Oct 12 2026, Wes: "move everything to the new system").
  `VenueDoc.U_PER_M`, the lee rule's `M_TO_U` (wind.js) and the swell's `U_PER_M` are all 10;
  the player-facing labels (results, records, course lengths, goal and school chips, the hub
  logbook, the venue checker, the editor's rulers) read 10 cm a unit; `legDistances` are summed
  in these metres. Venue documents went to **schema 2**: every metre a schema-1 file stated
  (shape and traffic lee heights, gust puff sizes, swell heights) is halved on load
  (`migrateVenueDoc`), and the kind tables' heights were halved in code, so nothing in the
  game moved — only what the numbers mean. Tide `elev` is a vertical height against a draft
  in metres and did not change. A few tuned constants keep their old value in units with a
  note (the thunder's speed of sound, the 0.375 s a metre fallback cutoff).
- **Speed** runs at 15 units/s per knot (`U_PER_S_PER_KNOT` in `sailcheck.js`). At 10 units per
  metre a real knot is 5.1 units/s, so the game runs about **3× real time**. That is a
  deliberate choice about how the game feels, and it stays; the knots shown are true to the
  polars.
- **Vegetation** was already sized close to this ruler: venues.md's fruit note puts the
  four-pixel floor at ~0.43 m, i.e. about 9 units per metre.
- **Ships**: a real cargo ship is 150–200 m, which is 1500–2000 units (30+ boat lengths).
  The Cove's current freighter is 700 units, a 70 m coaster at this ruler.
- **Capped for gameplay (Wes, Oct 15 2026, PT-015):** the Cove's bridges (72–110 m) stay below
  true size. The cargo ships went up the same day (blue 96 m, rust 86 m, green 72 m, cruise ship
  110 m; real 120–200 m) so every freighter outranks the 45 m ferry; their limit is the Bay
  bridge's 30.6 m tower gap, which the routes must pass centred and square.
- **PT-015 prop review (Oct 15 2026):** every prop measured against the hull; see
  `~/Desktop/regatta-issues/scale-review/`. The Cove's town and harbour vessels were upscaled
  by their kind `world` (church 24 m, cottages 11–12 m, tug 26 m, ferry 45 m, …), not by
  placement scale, so traffic and new placements come out right too.
- **Overshoots fixed (Oct 16 2026, PT-015):** the later venues' built things were placed at
  ×2–4 over kinds already drawn near true size at ×1, so the fix was PLACEMENT scale (log
  cabin 9 m, lodge 20 m, boathouse 18 m, pontoon 12 m, tent 4 m, houseboat 15 m, Point Pinos
  16 m, lighthouse 8 m, fire rings 1.6 m, mooring buoys 1 m, …). Anything tied to a shore was
  shrunk about its shore end, not its centre, so slipways, pontoons and steps still land.
  The tide mill stays at ×3: its house is already ~13 × 22 m and its sluice walls span the
  creek.
- **Trees (Oct 16 2026, PT-015):** kept oversized for coverage (Wes), but nothing over ~1.8×
  life: the kinds above it came down to ~1.6× by their `world` (sea hibiscus, the Glowtide
  palms, coconut palm, pandanus, Lake red pine/birch/aspen/fir, Sitka spruce, hemlock, Bayou
  cypress). Outlines rescale on their own. Where the shrink opened real holes in the canopy
  (Glowtide's jungle, the River's spruce) the same species were infilled — 165 and 317 trees,
  each slotted beside a same-kind tree of similar size so the draw order stays height-sorted.
  The Cove's trees (~1–1.5×) are now the truest; Pond and Otter sit at ~1.1–1.7×.

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
