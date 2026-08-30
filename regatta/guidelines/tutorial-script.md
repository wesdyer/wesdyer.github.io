# Sailing School — Script

*The lines and goals as built in `js/game/school.js`, in order, for refining. Edit the
words here; each beat's trigger is noted so a change to the trigger is a code change.
Keycaps are written as `[Enter]`, `[Space]`, `[←]/[→]`, `[A]/[D]`.*

## The screens

Four sections — 1 open water · 2 pond manoeuvring · 3 start practice · 4 the race — with a
full, opaque screen before and after each: Coach Paddle large on the left, the next section
already built underneath and held until **Next**. Buttons: Next · Restart · Skip (to the next
section's screen) · Skip to race · Go to Clubhouse, each only where it applies.

| Screen | When | Says | Shows |
|---|---|---|---|
| A | before section 1 | Welcome to sailing school! Let's start by learning the basics of the boat: how it moves, where the wind is, and how to steer it. | the venue art (`assets/images/venues/pond.png`; the pond's chart until it exists) |
| B | after section 1 | You've learned to sail the boat. Now let's move to Duckling Pond and learn to sail a course around marks and through gates. | the pond, no course |
| C | after section 2 | Nicely sailed around the pond. You rounded the mark and took the gate. Now we practice a start sequence… | a drawn start line |
| D | after section 3 | That's a start. Now you race. *(plus the start feedback)* One lap of Duckling Pond… Three classmates are on the line with you… | the course chart · the three classmates with faces |
| E | after the race | You won it. / Nth of four. You graduate. / Didn't finish this one. + the coaching lines | the finish order, live while the classmates come in · Go to Clubhouse · Race again · Restart school |

## Section 1 — The First Sail (open water)

Zero wind, no HUD (the HUD first appears in section 2), no marks, no ducklings. The boat sits
on a beam reach and the helm is held.

| # | Coach Paddle says | Goal (bottom of the box) | Shown / advances on |
|---|---|---|---|
| 1 | This is your boat. | Press [Enter] to continue | teal ring around the hull |
| 2 | Wind streaks show which way it's blowing and how hard. The wind is coming from our side at 90 degrees. | Press [Enter] to continue | wind 0 → 7 kn in 0.25 s; the big WIND arrow appears; the TWA panel under the boat appears with a ring on it |
| 3 | Steer with [←] / [→] or [A] / [D]. / Follow those ducklings! | Follow the ducklings · n of 5 | helm released; five ducklings 200 u apart in an S off the nearer beam (about ±24°), carried along with the boat at a fixed offset until you point at the nearest one (within 10°), when the S holds in the water so you can sail up to it; reach it (within a boat length) and only that duckling swims to the far end of the line while you carry on to the next; the count rises; five reached → exit line *That's a reach — wind on your side. Fastest, easiest point of sail.* |
| 4 | Now let's try sailing upwind. Follow the ducklings. | Follow the ducklings | ducklings dead upwind at the edge; they hold the edge until your first tack, then the gap closes with ground to windward |
| 4a | You're in the *no sail zone*. You can't sail directly upwind. Instead, zig zag back and forth just outside of the no sail zone to head upwind. | Turn outside of the no sail zone | 3 s inside ±38° of the wind; the red cone appears (and stays) |
| 4b | Zig zag back and forth upwind. | Follow the ducklings | once out of the zone |
| 4c | Good job! That was your first tack. A tack is when you cross the wind to zig zag back and forth. | Follow the ducklings | first tack |
| 4d | Zig zag back and forth upwind. | Follow the ducklings | second tack; done when the ducklings are reached |
| 5 | Let's sail downwind. | Follow the ducklings | ducklings dead downwind at the edge; cone off; they hold the edge until the kite is up |
| 5a | Good, but it's faster to sail downwind with your spinnaker. Hoist your spinnaker. | Press [Space] to raise your spinnaker. | pointed within 30° of dead downwind; [Space] unlocked here for the first time |
| 5b | Sail downwind with your spinnaker. | Follow the ducklings | kite up; done when reached |
| 6 | Sail upwind again. | Follow the ducklings | ducklings move to 60° off the wind, on your side; they hold the edge until the kite is down |
| 6a | The spinnaker is not for sailing upwind. Let's put it away. | Press [Space] to put your spinnaker away. | the kite starts to luff (TWA < 90°) |
| 6b | Sail upwind again. | Follow the ducklings | kite down; done when reached, then Screen B |

## Section 2 — Pond manoeuvring

The pond document (`assets/venues/pond.venue.js`, edit in editor.html) with the course hidden.
No ducklings. The chart frames the whole pond. The boat starts in the middle of the pond, head to wind and stopped. Six targets
in turn; each is placed from the pond and the previous target (the first "previous target" is
where the boat began), and disappears once used. Marks carry the course's rounding arrow and
zone ring; gates are laid across the approach, 100 m wide.

| # | Coach Paddle says | Goal | Advances on |
|---|---|---|---|
| 1 | Welcome to the Duckling Pond! Let's round a mark. Keep it on your LEFT side as you go around — that's a port rounding. | Round the mark to port | a mark at the screen's edge off the beam; judged by the race's own rounding rule (`roundingStep` in physics.js) with the last goal as where you come from and the next goal as where you go — the taut-string sweep, the wrong-way accumulator and the leave-the-zone trigger are the race's |
| 2 | Now the mark at the top of the pond. This time keep it on your RIGHT side — a starboard rounding. | Round the mark to starboard | the top of the pond; same rule, starboard |
| 3 | Now the downwind gate. Go through it, round one of its marks, and head back upwind. | Round the gate | the bottom of the pond; through → *Through the gate. Now round one of its marks and come back.* → back on the entry side |
| 4 | Next, the mark on the left side of the pond. Keep it on your right. | Round the mark to starboard | the left side of the pond |
| 5 | Now the mark in the middle of the pond. Keep it on your right. | Round the mark to starboard | the centre of the pond |
| 6 | Last one: straight through the downwind gate. | Go through the gate | the same leeward gate, no zone rings; through → Screen C |

Wrong-way roundings get *Wrong way round — keep the mark on your LEFT/RIGHT side as you go around it.*
Tips (the section-4 reminders, in their own row of the box): the no-sail-zone cone, hoist,
douse, and **Avoid hitting objects, it slows you down.** on any collision.

## Section 3 — Start practice

The pond with the start line only — no windward gate, no ladder rungs — one boat, and the
document's prestart (30 s) with the clock ringed and pulsing.

| # | Coach Paddle says | Goal | Advances on |
|---|---|---|---|
| 1 | Let's practice starting a race. Stay behind the line until after the timer runs out. | Stay behind the line | — |
| 1a | You haven't started yet. | Return to behind the start line | over the line (or OCS) before the gun; back behind it restores row 1 |
| 2 | That's the gun. Cross the start line! *(or: Over early! Get back behind the line, then cross it.)* | Cross the start line | the timer expires; ring off |
| — | *(Screen D carries the feedback: Right on time / N seconds after the gun / Over early but recovered)* | | crossing → Screen D |

Tips: the no-sail-zone cone, collisions, OCS, "The race has started. Cross the start line." 5 s after the gun, douse.

## Section 4 — The Pond Race

The pond as authored in `pond.venue.js` — course, marks, committee boat, three classmates,
penalties on. No ducklings. Coach Paddle speaks only as REMINDERS: each watches one condition,
speaks after it has held for the dwell time, repeats while it holds, and clears when it ends.
Listed in priority order — when several hold at once, the first speaks and the rest wait.

| Condition (held for) | Coach Paddle says |
|---|---|
| In the no-sail zone, 3 s | *(silent)* the red cone shows, and only while you are in it |
| Penalty owed and no turn under way, 3 s | You have a penalty. Do a full 360° turn to clear it. |
| Over early and not heading back behind the line, 3 s | You were over early. Turn around and go back behind the start line. |
| Spinnaker up and TWA < 90°, 3 s | The spinnaker is not for upwind. Press [Space] to douse it. |
| Not started, 5 s after the gun | The race has started. Cross the start line. |
| Past the next gate's line without crossing it, 3 s | You've gone past the windward gate / finish line. Turn back and sail between its two marks. |
| Racing, no spinnaker and TWA > 110°, 3 s | Sailing downwind? Press [Space] to raise your spinnaker. |
| No progress toward the next mark, 3 s | Turn left/right — the windward gate / finish line is that way. |

Plus the one-shots from the first build: "Cone's gone. You've got it." at the gun; the rules
lines on the first give-way cross; "Clear. Carry on." when a penalty is cleared.

**Debrief** (finish or timeout): three lines of feedback on *your* race, then **Race again** ·
**Restart school** · **Go to Clubhouse**.
