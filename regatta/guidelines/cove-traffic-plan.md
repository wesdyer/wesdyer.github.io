# Cove Traffic — moving vessels on an authored path

*Written 2026-08-09 from a design conversation; every decision below was taken deliberately
and the reasoning is kept so it can be re-argued rather than re-discovered.*

**STATUS: built and under test** (`eval/test_traffic.js`, 65 checks). Path maths in
`js/traffic.js`; lifecycle, wake, shadow and collision in `js/script.js`; validation and
measured hulls in `js/venuedoc.js`; the Traffic layer in `js/editor.js`; one authored vessel
in `bay.venue.js`.

Companion to [venues.md](venues.md) (which specifies the mechanic) and
[editor-plan.md](editor-plan.md) (which owns authoring).

## 0. What this is for — **Intent**

Lighthouse Cove's hook, from venues.md's own table:

> | 1 | Lighthouse Cove | **Trapezoid** | can I make the harbour gate before the ship? | threading the channel with a cargo ship bearing down |

and its traffic entry:

> | **Cargo ship** | slow, utterly predictable | an enormous moving **wind shadow** — the real hazard is its air, not its hull |

The art has shipped. `bay-cove-cargo-ship` and six siblings are registered kinds with
bakes on disk, and the PROP_KINDS note already records what is missing:

> **MOTION fixed, and that is a statement of what exists rather than of what these are.**
> The design calls for slow predictable traffic dragging a moving wind shadow; the engine
> has no 'underway' motion and no prop-borne wind shadow, so a placed ship stands still.

This plan is that missing engine.

## 1. A new document section, not a prop field — **Rule**

Traffic gets its own top-level array, `traffic: []`, beside `shapes`, `course` and
`squalls`. It does **not** become fields on a prop.

A prop is deliberately "a picture with a position and nothing else", and the whole
PROP_KINDS block is written to defend that line. A path, a schedule and a lifecycle are
none of those things, and putting them on the prop model makes every prop in the game
carry the cost of a feature one asset uses. `squalls` already sets the precedent for "a
venue-doc section describing spawned, moving, expiring things".

A traffic entry NAMES a prop kind for its art, so `PROP_KINDS`, `propSprite` and the
whole sprite pipeline are reused unchanged.

```js
traffic: [{
  id: 'ship-1',
  kind: 'bay-cove-cargo-ship',   // art + world size come from PROP_KINDS
  path: [                        // authored polyline, >= 2 points
    { x, y, speed: 4 },          // knots at this point
    { x, y },                    // no speed: inherits the one before it
    { x, y, speed: 2 }           // slows toward here
  ],
  speed: 3.2,                    // knots; default for a path that names none, see 4
  firstSpawn: 20,                // seconds after the start gun; negative = already underway
  end: 'despawn',                // despawn | stay | wrap | pingpong, see 3
  respawn: true,                 // only meaningful with end: 'despawn'
  respawnDelay: 45,              // seconds between despawn and the next spawn
  windShadow: 900,               // units to leeward; omit to derive from height
  hull: { along: 0.86, beam: 0.22 }  // capsule, as fractions of `world`; see 5
}]
```

**THE ENTRY IS THE PRIMITIVE.** One entry is one vessel, one path, one schedule. Three
ships is three entries with similar paths and different `firstSpawn` values — there is no
grouping object, no timetable type, no convoy. A timetable IS the array (designer,
2026-08-09). Anything smarter can be built later on top of a primitive that works.

## 2. Determinism: author it, never roll it — **Rule**

No RNG anywhere in this system. Squalls seed `mulberry32(race.seed + 77)` because a squall
is weather; a cargo ship's entire design virtue is being *"slow, utterly predictable"*, and
a hazard you can learn is a hazard you can plan around. Authored path, authored speed,
authored spawn time. Two runs of the same venue put the ship in the same place at the same
second.

## 3. Lifecycle

```
  t < firstSpawn        absent
  spawn                 at path[0], heading = initial tangent
  underway              advance along the time table; speed ramps between path points
  end of path           per `end`: despawn | stay | wrap | pingpong
  despawned             ship and wake both gone; respawn after respawnDelay if set
```

`firstSpawn` is measured **from the start gun**, not from load, so it means the same thing
however long the player sits in the prestart. Negative values are legal and mean the ship
is already underway when the gun fires — spawn it at the arc length the time table gives
for `-firstSpawn`, which is what makes that work when the speed varies along the way.

End of path is ONE ENUM rather than a `loop` boolean, because there turned out to be four
answers and a flag only holds two:

* `despawn` — vanish. One-shot, the cove default. `respawn` applies only here.
* `stay` — **remain where it stopped, indefinitely** (designer, 2026-08-09). The vessel is
  still a collider and still casts its wind shadow; it has simply become part of the
  furniture. Pair it with a final point at 0 knots and you have authored a berthing: the
  ship decelerates down the last leg, comes alongside, and stays there blanketing the
  harbour for the rest of the race.
* `wrap` — **a loop, compiled as a CLOSED CURVE.** Not a jump back to `s = 0`: the segment
  from the last point to the first is an ordinary segment, its Catmull-Rom control points
  wrap around, and position, heading and speed are all continuous through the join. A figure
  eight is then just a path that crosses itself. Needs 3 points — two closed is a line, which
  is what `pingpong` is for.

  The test that pins this is not "does the seam look smooth" but **rotation invariance**:
  compile the same loop starting from a different vertex and the curve must be the same
  shape, because a kink at the join would travel with the join. Measured 0.0000u and
  0.0000 degrees apart. Two consequences elsewhere — `atArc` wraps, so a wake trails round
  the lap instead of stopping dead at the join; and the wake's "how far have I sailed" bound
  is lifted for a loop, or it would trim itself back to nothing once a lap and announce
  exactly where the seam was.
* `pingpong` — reverse along the same path. Right for a motorboat working a shoreline.

Only `despawn` is needed on day one; the other three are a few lines each at the path end
and are cheaper to include than to schema-migrate toward later.

## 4. Path and motion — **Rule**

**Catmull-Rom through the authored points, resampled to an arc-length table at compile.**

**SPEED IS PER POINT, AND IT RAMPS** (designer, 2026-08-09). Any path point may carry a
`speed` in knots; a point without one inherits the last speed named before it, and a path
naming none runs at the entry's `speed` throughout. So the simple case stays one number and
a vessel can still slow for a turn or wind up on a straight.

Between two points naming different speeds the vessel EASES from one to the other across
the whole leg, arriving at the second speed exactly at the second point. A step change
would read as a gear shift on a hull this size. The authoring consequence is worth stating
plainly, because it will surprise someone: the speed at a point is the speed *reached
there*, not the speed of the leg leaving it — so to hold 4 knots and then slow, author
`4, 4, 2` rather than `4, 2`.

A polyline followed directly gives a vessel that visibly corners and changes speed at every
vertex, because equal parameter steps are not equal distances. Both problems die with one
table: sample the spline finely, accumulate chord lengths, and store `s -> (x, y)`. Then

* position is `lookup(s)` and speed is genuinely constant in world units,
* heading is the tangent, so the hull points where it is going with no extra authoring,
* `speed` in knots converts once — but against the BOAT clock, not the wind one.

**THE CONVERSION IS 1 KNOT = 15 u/s = 0.25 u/frame**, derived from the fleet: boats advance
`speed * timeScale` where `timeScale = dt * 60`, and `knots = boat.speed * 4`. Do NOT reach
for `SQUALL_DRIFT` (0.18 u/frame/kt) — that is how fast the BREEZE CARRIES a thing, which is
a different physical claim and a slower number. A ship is under power, and the whole venue
question is "can I make the gate before the ship?", which is only meaningful if a 4-knot
ship and a 4-knot boat cover ground at the same rate.

`SQUALL_DRIFT`'s own comment is the scar tissue from getting this class of thing wrong:
*"Anything that moves on this map moves in units per frame; a speed in knots has to be
converted before it can be one."*

### Astern: a negative speed — **Rule**

A negative speed does **not** rewind the path. It means the hull covers the next stretch
STERN FIRST — the arc length still advances, so the time table stays monotonic and a vessel
can be authored to back into a berth that lies further along its route than the point it
stopped at. Rewinding would put the ship somewhere it had already been, which is not what
backing into a dock is.

* A leg's direction comes from whichever end names a non-zero speed.
* **A ship cannot swap ends at speed**, so a sign change is only legal across a point that
  names 0 knots — which is also the point a `dwell` can hold it at while it turns. The first
  point may not be negative: nothing precedes it to have stopped at.
* **Magnitudes drive the clock.** How fast a hull is going and which way it points are
  separate questions and only the first belongs in a time table. Getting this wrong is
  subtle: taking `max(0, speed)` in the position lookup while building the table from
  magnitudes zeroed every astern leg's entry speed but kept its deceleration, so the arc
  length ran BACKWARDS down the curve at a reported 0 knots.
* **No wake astern.** A hull backing down does churn water, but it is a slow propeller-driven
  mess and nothing like the wedge a bow throws; drawing the wedge behind a ship moving the
  other way reads as the hull travelling the way it is pointing, which is what the manoeuvre
  exists to contradict.

### ⚠️ A reversal is a CUSP, not a corner — **Observed**

The point where a vessel changes between ahead and astern is a POINT in the track: it stops
and goes back the way it came. Smoothed like any other vertex — which is what centripetal
Catmull-Rom does to everything — the spline rounds it into a small U-turn, and a ship meant
to be backing into a berth instead **drives forward around a loop**. The manoeuvre inverts.

So the curve is broken at those knots: each side takes a reflected phantom rather than seeing
across, exactly as the two ends of an open path do. Two consequences:

* **A cusp needs two tangents**, one per side, and an array indexed by sample holds one. With
  a single value the approach interpolates toward the DEPARTING tangent and the hull spins
  180 degrees through its final sample interval — while decelerating, so slowly and in full
  view. `hs` holds the outgoing tangent, `hsIn` the arriving one at those samples.
* **The held heading is the arriving one.** Once the astern flip is applied that is the same
  angle the departing leg uses, so nothing turns when the wait ends — a stopped hull does not
  swing round.

Hand-drawn legs are never exactly opposed, so a few degrees remain between the attitude a
vessel arrives in and the one it leaves in. A `dwell` spreads that across the wait; without
one there is no time and it lands in a single frame. Measured on a cruise ship berthing:
**17.94 degrees in one frame with no dwell, 0.06 with eight seconds of one.** The validator
warns rather than refuses — it is a look, not a fault.

### Varying speed forces a second table — **Rule**

With one constant speed, position is `lookup(speed * t)` and nothing else is needed. With
per-point speed the naive implementation integrates each frame — `s += speedAt(s) * dt` —
and that is FRAME-RATE DEPENDENT: accumulated error differs between 60 and 120 fps, so two
players watching the same seeded race would see the ship in different places. On a venue
being tuned for 120 fps that is not hypothetical.

So compile a **time -> arc-length** table beside the `s -> (x, y)` one. Then the ship's
position at race time `t` is a lookup with no accumulator, no drift, and no dependence on
how the frame fell — which is what "utterly predictable" has to mean.

**THE RAMP IS LINEAR IN TIME, NOT IN DISTANCE** — constant acceleration per segment. This
is not a stylistic preference, it is the difference between arriving and not:

> Ramp linearly in ARC LENGTH and the segment time is the integral of `ds / v(s)`, which
> DIVERGES as the end speed approaches zero. A leg ending at 0 knots is never completed —
> the vessel creeps toward the last point forever and `end: 'stay'` never fires. Since a
> path is explicitly allowed to end stopped, that is a live case, not a corner.

Linear in time is also what a vessel under a thrust change physically does, and the maths
comes out simpler than the version it replaces. Per segment of length `L` from `v0` to `v1`:

```
  v(t) = v0 + a t            a = (v1 - v0) / T
  s(t) = v0 t + a t^2 / 2
  T    = 2L / (v0 + v1)      segment duration: length over MEAN speed
  v^2  = v0^2 + 2 a s        invert for speed at an arc length
```

`T` is finite when `v1 = 0`, both directions are closed-form, and no logarithm appears.
`v0 = 0` is fine too — a vessel may start from rest at a berth and get underway. The only
degenerate case is two consecutive zeros, where `T` diverges honestly; reject it in
validation.

**Built as described.** `eval/test_traffic.js` guards the zero case explicitly, because
nothing else would: every path that does not end stopped behaves identically under either
ramp, so the divergent version passes every other test in the file.

Precedent for arc-length work along a polyline already exists in the leg-attribution code;
`traceRoundedPoly` is precedent for smoothing an authored outline.

### ⚠️ The heading must be interpolated, not looked up — **Observed**

The position comes off the flattened table and looks smooth, so it is easy to take the
HEADING off the same table the obvious way — a finite difference between two nearby
samples. That answer is piecewise CONSTANT: both samples land inside the same flat segment,
so the hull is handed that segment's direction and holds it until the next one.

Measured on the cove's lane when it was written that way: **97.2% of frames turned by
exactly zero degrees**, and the remainder jumped, worst case 6.9 degrees in a single frame.
A ship does not pivot, and it read as one.

Two things fix it and BOTH are needed:

* store the tangent per sample (central difference, so each accounts for the curve either
  side of it) and **interpolate between them** with a shortest-arc lerp — this is what makes
  the heading continuous at all;
* raise the sampling density, since finer steps are still steps. `FLATTEN` went 24 → 64.

After: worst 0.20 degrees a frame, and no frozen frames at all. `eval/test_traffic.js`
guards continuity rather than resolution — it asserts the share of zero-turn frames stays
near nil, which is the property that actually broke.

**ZERO IS LEGAL ONLY AS A DESTINATION.** A `speed: 0` at the LAST point means the vessel
comes to a stop there, and is well defined because no leg leaves it. Mid-path it would mean
a vessel that never reaches its next point, so validation rejects it. There is deliberately
no mid-path `dwell` — nothing in the brief asks a vessel to pause and continue (designer,
2026-08-09), and it can be added later without disturbing any of this.

**THE SHIP IS ON RAILS** (designer, 2026-08-09). It never slows, swerves, or reacts to
anything — not the fleet, not the marks, not a boat under its bow. Reactivity would make it
unlearnable, and unlearnable is the opposite of the brief. It will happily bulldoze the
entire fleet, and that is the intended behaviour rather than an oversight.

## 5. Collision: it pushes — **Rule**

The hull is solid. It stops a boat, and a boat caught ahead of the bow is pushed along.

**This is a physics problem, not a routing one, and that distinction is what makes it
buildable.** The vessel never enters `state.course.islands`, never becomes a hidden collider,
never touches the nav grid or the router. Contact is resolved directly against boats in the
physics step.

### Shape: a capsule

Not a circle. The PROP_KINDS note already worked out why a circle fails these hulls:

> the hidden collider compile emits is a CIRCLE, and these hulls are 4.3:1. Sized to the
> beam it leaves two thirds of the ship sailable-through; sized to the length it is an
> invisible wall standing 100+ units off both sides in open water.

A capsule — spine segment plus radius — is accurate enough for a ship, rotates with heading
for free, costs one point-segment distance per boat per vessel, and hands back the push
normal as the perpendicular from the spine. `hull.along` / `hull.beam` are measured off the
bake and carried on the entry, exactly as `contactR`, `wash` and `srcBox` are.

### Response: the floe resolver, with infinite mass

Model it on the floe-on-floe bounce, which already solves this shape of problem:

* **Mass-weighted separation.** The ship is effectively infinite mass, so the boat takes
  100% of the positional correction.
* **CAP THE CORRECTION RATE.** This is the lesson the floe code paid for and states
  outright — *"no floe is ever moved faster than it can be seen to move… resolving one of
  those in a single uncapped step is exactly the jump this whole pass exists to prevent."*
  A boat overtaken by a bow at speed can be deeply penetrated in one frame; teleporting it
  clear would be worse than the overlap.
* **Velocity.** Kill the boat's velocity component INTO the hull, and add the ship's
  velocity along the contact normal. "Pushed if in front" falls out of that second term
  with no special case: a boat ahead of the bow is simply carried at ship speed while it
  stays in contact.

### ⚠️ The normal comes from the boat's centre — **Observed**

Not from its nearest hull corner. Cornerwise looks more precise and **oscillates**: a hull
straddling the capsule's centreline has corners on BOTH sides, so the nearest one flips the
instant the boat is nudged and the push reverses every frame. Measured before the fix, a
boat amidships bounced +4.33u, -4.33u, +4.33u forever and never came out. The centre moves
monotonically outward, so the side it picks is stable; the hull's own extent along that
normal comes back as a support function, which is exact for a convex polygon and cheap.

Where the centre sits exactly on the spine there is no outward direction at all — pick the
side the boat is already sliding toward, and the push carries it out from there.

### Ordering: traffic resolves BEFORE land — **Rule**

`settleFloes` states the rule for ice — *"shore pass, last, so the coastline always wins"* —
and it holds here for a stronger reason. A bow can shove a boat clean into a beach; if land
resolved first, that boat would spend a frame inside the shore.

### Why push is also the safe choice while the AI is frozen

Bots cannot see this vessel — it is not in the nav grid, and the planner is off limits. They
will sail into it. That is accepted (designer, 2026-08-09).

It is survivable *because* it pushes. A static wall would TRAP a fleet that does not know to
avoid it: boats would pile against the hull and mill there for the rest of the race. A
pushing body physically cannot trap — it shoves and moves on. The mechanic asked for is also
the only one that survives shipping before the planner learns about it.

### Rules

**A boat pushed over the line early, or onto the wrong side of a mark, wears it**
(designer, 2026-08-09). No exoneration, no special case in the race state. Simple, and it
makes the ship something to be respected rather than something to hide behind.

## 6. Wind shadow

The mechanic the venue actually promises. `shadowAt(x, y, dir, kind)` already walks a list
of casters and multiplies a factor per caster, and `shadowLen()` already reads an authored
`windShadow` off whatever it is given.

**Integration: a second pass inside `shadowAt` over `state.traffic`** — NOT by pushing the
vessel into `state.course.islands`. Joining the islands array would put it in front of the
router, which is the one thing section 5 exists to avoid. A separate pass keeps the wind API
unchanged and the routing untouched.

The silhouette is the capsule from section 5. Unlike an island the caster MOVES, so any
per-caster silhouette cache must key on position, or simply recompute — there are single
digits of these on a map.

**Built as described**, with three details settled in the doing:

* **The lee length reuses the island rule** rather than inventing a second one — ten times
  the height of the thing casting it. A vessel authors no height, so the default takes its
  beam as a stand-in for the stack it carries: a 720u container ship is 38 m across the deck
  and stands roughly that much above the water, which is the figure the rule wants. Gives
  1728u, overridable per entry with `windShadow` or `height`.
* **Wind only, not current.** `shadowLen`'s own argument decides it: a current wake is about
  whether the thing blocks the WATER COLUMN, and `motion` carries the answer — *"which is
  exactly why a floe DRIFTS WITH the current instead of disturbing it"*. A ship floats.
* **The wind at the vessel is sampled once a frame**, in `updateTraffic`, not inside
  `shadowAt`. An island answers this from a cache keyed on its centroid because it never
  moves; sampling the field per query would multiply one lookup by every boat and every
  sample of the wind overlay.

Measured on the cove: 13.6kt of clear air falls to 4.3kt 500u astern (32%), recovers to 48%
by 900u, and is bit-identical to no-ship beyond the lee.

## 7. Wake — Kelvin, both ends

Wakes today are per-boat: a `wakeTrail` of `{x, y, age, str}` sampled every 0.08 s twelve
units aft, capped at 34 samples and 2.25 s, drawn by `drawWakes` as a tapered two-tone
ribbon with short V quarter-waves at the stern.

Every constant in it is dinghy-scaled, and a cargo ship is **~13× a 56 u hull**. Scaling the
ribbon up is the cheap option and it is the wrong one: from directly above — the only way
this game is ever seen — a scaled dinghy ribbon reads as a large dinghy.

**Draw a Kelvin wake for vessels** (designer, 2026-08-09): divergent arms at ~19.5° off the
track, which is where a displacement hull's wake sits *regardless of speed*, plus a
turbulent band down the centreline. That V is what says "tonnage" from above.

* **Bow wave as well as stern wake.** The manifest is explicit that the sprite carries no
  baked disturbance, so everything visible here is engine-drawn.

### Two wakes, chosen per vessel — **Rule**

`wake: 'kelvin' | 'ribbon' | 'none'`, defaulting to `kelvin` so nothing authored before this
changes. **Which is right is a question about the hull, not a preference.** The Kelvin wedge
is what a DISPLACEMENT hull throws — slow, heavy, pushing water aside. A small craft up on
the plane leaves a narrow churned trail, and the wedge drawn behind a motorboat claims a
tonnage it does not have.

`ribbon` is `drawWakes`' own word for the fleet's wake — *"tapered two-tone ribbons along
each boat's recent stern track"* — so the editor uses it rather than inventing a second name
for something already named. It is the same two-pass taper the boats get, read off the PATH
rather than a remembered trail and sized from the hull instead of the 56-unit dinghy those
constants were tuned against.

Choosing Kelvin in the editor DELETES the key rather than writing it: a document should not
carry a field to say it wants what it would get anyway.

### ⚠️ One frame per piece of the wake — **Observed**

There are two frames available at any moment and they are not the same thing:

* the **hull's** — `(v.x, v.y)` rotated by `v.heading`, which is what the sprite is drawn
  with, and
* the **path's** — position and tangent from `atArc(s)`, which is where the ship has been.

The scar and the divergent arms belong to the path: they trace water already sailed, so
they follow the curve. The **bow wave belongs to the hull**, because it is drawn against the
stem the player can see.

Mixing them is invisible on a straight lane and wrong the moment the lane bends. The first
version took the bow wave's lateral axis from the path tangent at `atArc(bowS)` and its
longitudinal axis from `v.heading` — measured on the cove's lane, up to **23.8 degrees
apart**, so the two axes stopped being perpendicular and the crescent skewed, bulging on one
bow while it tightened on the other. It was also anchored to a point half a hull along the
CURVE, which in a turn sits up to **75 units** — 43% of the beam — off the drawn stem.

No automated check guards this one: it is a fact about drawing, and the pieces are local to
`drawTrafficWakes`. What guards it is picking one frame per piece and saying which.
* **Scale with the vessel**, not with a global constant — width, arm length and trail life
  all come off `world`.
* **Trail life is not just a multiply.** These vessels are slow, so a 2.25 s history leaves
  a stub; the wake wants a much longer life to trail properly behind a ship.
* **A stationary vessel has no wake** (designer, 2026-08-09). Placed `motion: fixed` props
  keep standing still and stay wake-less; the wake belongs to traffic underway.
* **Scale wake strength with speed, and the berthing case draws itself.** A vessel ramping
  to 0 over its final leg sheds its wake as it slows, so it settles alongside clean with no
  despawn to hide and no special case anywhere — the ramp and the speed-scaled wake do it
  between them.
* **The wake dies with the ship** (designer, 2026-08-09). On despawn both vanish together,
  and the path is authored so that happens off screen. This is the cheap option and it was
  taken deliberately: an orphan wake has to outlive the entity that owns it, which means a
  second lifetime to manage and a second thing to draw for something the player is not
  looking at. Revisit only if a despawn ever has to happen in view.

## 8. Editor — **Built**

Its own layer (**T**), beside Props because the art comes from the same registry — but a
traffic entry owns a path, a schedule and a lee, none of which a prop has any business
carrying. Draw (**P**) clicks out the lane; Enter or double-click ends it.

**THE EDITOR COMPILES THE PATH WITH THE GAME'S OWN `js/traffic.js`** rather than drawing the
authored polyline. Anything else is a second implementation of the smoothing, and the first
thing it would do is disagree with the real one on exactly the tight corners where the
difference matters. What is on the map is where the hull will be.

Details that earned their place:

* **A lane needs TWO points, not three.** `commitPending`'s ring guard throws away anything
  shorter than a triangle, which is right for a shape that must enclose water and wrong for
  a path that only has to go somewhere. Traffic is handled before that guard.
* **No closing click.** For an outline, clicking the first point closes it. A lane that
  quietly became a loop would be a wrong answer rather than a shortcut, so the lane branch
  never reaches that test — and it draws its own open preview, since the shared one fills
  the ring.
* **A filled handle names its own speed; a hollow one inherits.** The single most useful
  thing to see at a glance on a lane being tuned, and the waypoint field shows the
  *inherited* value as its placeholder so it reads as an override rather than a blank.
* **Respawn disappears when `end` is not `despawn`.** A field that silently does nothing is
  worse than no field.
* **The ghost hull draws at the head of the lane, at its real size.** The whole reason to
  author a path on a map is to see whether a 720-unit ship fits through the gap you drew it
  through, and a line cannot answer that.
* **A blank numeric field deletes the key rather than writing 0** — "auto" and "zero" are
  different answers everywhere in this document, and the placeholders say which is which.

## 9. Build order — **Intent**

Each step independently verifiable, so a failure is attributable.

1. **Section, path, lifecycle, draw.** Compile the path to an arc-length table; spawn,
   advance, despawn, respawn. No collision, no shadow, no wake. You can watch it sail.
2. **Wake.** Kelvin arms, bow wave, fade-after-despawn.
3. **Wind shadow.** Second pass in `shadowAt`.
4. **Capsule collision and push.**

## 10. Accepted risks — **Observed**

* **Bots sail into it.** Accepted; needs planner work to fix properly, and the planner is
  frozen. Push keeps it from being fatal (see 5).
* **No automated check can catch a race-breaker.** `check_venues` sailability is static and
  cannot know a moving hull crosses the course. A ship parked across the gate at the wrong
  moment would pass every test in the repo. Accepted on the understanding that paths are
  authored carefully and tested by hand (designer, 2026-08-09). If it ever bites, the test
  to write walks the vessel's position across the race duration and asserts it never
  occludes a mark or the start line for more than a few seconds.
* **Conflict surface is wide.** This touches `venuedoc.js` (validate + compile), `script.js`
  (state, update, draw, wind, physics) and `editor.js` (path tool, inspector). Worth
  sequencing against anything large landing in main. The path maths and the Kelvin wake
  renderer are new self-contained functions and rebase cleanly; the hooks do not.

## 11. Open

* **`end: 'stay'`, `wrap` and `pingpong` are implemented but unexercised** — no venue
  authors them yet. The wake handles a reversed pingpong leg (its track runs toward
  increasing arc length), which is the only part that needed thought.
* **Does `speed` vary per spawn?** One authored constant per entry today. A seeded sequence
  could vary successive ships without breaking determinism, but it argues against
  "utterly predictable". Unresolved.
