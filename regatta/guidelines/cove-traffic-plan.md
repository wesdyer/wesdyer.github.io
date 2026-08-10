# Cove Traffic — moving vessels on an authored path

*Plan, not yet built. Written 2026-08-09 from a design conversation; every decision below
was taken deliberately and the reasoning is kept so it can be re-argued rather than
re-discovered.*

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
* `wrap` — jump to `s = 0`. Seamless only if the path is closed (last point ≈ first).
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

Precedent for arc-length work along a polyline already exists in the leg-attribution code;
`traceRoundedPoly` is precedent for smoothing an authored outline.

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

## 8. Editor

Path authoring is an open-polyline tool. The editor already draws closed outlines for shapes
and the boundary, so the interaction — click to drop points, drag to adjust, direct-select
for vertices — exists and wants adapting rather than inventing.

The schedule is ordinary inspector fields: `speed`, `firstSpawn`, `respawn`, `respawnDelay`,
`loop`, `windShadow`. Same numeric-input pattern the props inspector already uses.

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

* **Does `speed` vary per spawn?** One authored constant per entry today. A seeded sequence
  could vary successive ships without breaking determinism, but it argues against
  "utterly predictable". Unresolved.
