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
| A | before section 1 | **Your first sail** — Learn to read the wind, steer the boat, and sail upwind and downwind. | the venue art (`assets/images/venues/pond.png`; the pond's chart until it exists) |
| B | after section 1 | **Now let's sail a course.** — You'll learn to round marks and sail through gates. No racing yet — just follow the course. | the pond, no course |
| C | after section 2 | **Let's practice a race start.** — Stay behind the start line while the clock counts down. When it reaches zero, cross the line as soon as you can. Try to be close, moving, and ready. | a drawn start line |
| D | after section 3 | **Time for your first race.** — *(the start feedback)* Now put it all together. Start with three classmates, sail up through the windward gate, then race back down through the finish. One lap. That's it. They're beginners too. Sail what you've learned. | the course chart · the three classmates with faces |
| E | after the race | kicker *Sailing School Complete* · You won your first race! / Second place — nice racing! / Third place — you finished your first race! / First race finished! + two coaching lines + *That's sailing school. Welcome to the club!* — or, not finished: kicker *The Race · Sailing School* · Race not finished. (no graduation) | the finish order, live while the classmates come in · Go to Clubhouse · Race again · Restart school |

## Section 1 — The First Sail (open water)

Zero wind, no HUD (the HUD first appears in section 2), no marks, no ducklings. The boat sits
on a beam reach and the helm is held.

| # | Coach Paddle says | Goal (bottom of the box) | Shown / advances on |
|---|---|---|---|
| 1 | This is your boat. | Continue › (any key, or click the card) | teal ring around the hull |
| 2 | These streaks show which way the wind is blowing and how strong it is. Right now, it's coming from the side. | Continue › (any key, or click the card) | wind 0 → 7 kn in 0.25 s; the big WIND arrow appears; the TWA panel under the boat appears with a ring on it |
| 3 | Steer with [←] / [→] or [A] / [D]. / Now follow those ducklings! | Follow the ducklings  *n of 5* (the tally set apart) | helm released; five ducklings 200 u apart in an S off the nearer beam (about ±24°), carried along with the boat at a fixed offset until you point at the nearest one (within 10°), when the S holds in the water so you can sail up to it; reach it (within a boat length) and only that duckling swims to the far end of the line while you carry on to the next; the count rises; five reached → exit line *Nice! That's a reach — sailing with the wind from the side. Fast and easy.* |
| 4 | Now let's sail upwind. Follow the ducklings. | Follow the ducklings | ducklings dead upwind at the edge; they hold the edge until your first tack, then the gap closes with ground to windward |
| 4a | You can't sail straight into the wind. Turn out of the red *no-sail zone*. | Turn out of the red zone | first time: 3 s inside ±38° of the wind; the red cone appears (and stays) |
| 4b | To sail upwind, zigzag back and forth just outside the red zone. | Follow the ducklings | first time out of the zone |
| 4a′ | Too far into the wind. Turn out of the red zone. | Turn out of the red zone | every later 3 s in the zone — the short correction, never the full lesson again |
| 4b′ | Good. Keep working your way upwind. | Follow the ducklings | every later exit from the zone |
| 4c | Nice! That was a tack — you crossed through the wind to sail the other way. | Follow the ducklings | first tack (said once); done when the ducklings are reached |
| 5 | Great! Now let's sail downwind. | Follow the ducklings | ducklings dead downwind at the edge; cone off; they hold the edge until the kite is up |
| 5a | This works, but we can go faster. Time for the spinnaker! | Press [Space] to raise the spinnaker | pointed within 30° of dead downwind; [Space] unlocked here for the first time |
| 5b | There she goes! Follow the ducklings downwind. | Follow the ducklings | kite up; done when reached |
| 6 | Now let's head back upwind. | Follow the ducklings | ducklings move to 60° off the wind, on your side; they hold the edge until the kite is down |
| 6a | See that flapping? The spinnaker doesn't work upwind. Let's take it down. | Press [Space] to lower the spinnaker | the kite starts to luff (TWA < 90°) |
| 6b | Much better. Keep following the ducklings. | Follow the ducklings | kite down; done when reached → boat and ducklings fade → Screen B |

## Section 2 — Pond manoeuvring

The pond document (`assets/venues/pond.venue.js`, edit in editor.html) with the course hidden.
No ducklings. The chart frames the whole pond. The boat starts in the middle of the pond, head to wind and stopped. Six targets
in turn; each is placed from the pond and the previous target (the first "previous target" is
where the boat began), and disappears once used. Marks carry the course's rounding arrow and
zone ring; gates are laid across the approach, 100 m wide.

| # | Coach Paddle says | Goal | Advances on |
|---|---|---|---|
| 1 | Welcome to Duckling Pond! See that mark? Sail around it, keeping it on your LEFT. That's called a port rounding. | Round the mark to port · keep it left | a mark at the screen's edge off the beam; judged by the race's own rounding rule (`roundingStep` in physics.js) with the last goal as where you come from and the next goal as where you go — the taut-string sweep, the wrong-way accumulator and the leave-the-zone trigger are the race's |
| 2 | Nice! Now round the mark at the top, keeping it on your RIGHT. That's a starboard rounding. | Round the mark to starboard · keep it right | the top of the pond; same rule, starboard |
| 3 | Now for a gate. Sail between the two marks, round either one, then head back upwind. | Go through the gate and round a mark | the bottom of the pond; through → *Through the gate! Now round one of its marks and head back upwind.* (or *…round the right-hand mark…* when an end is set) → back on the entry side |
| 4 | Next up: the mark on the left. Round it to starboard — keep it on your right. | Round the mark to starboard | the left side of the pond |
| 5 | Now the middle mark. Round it to starboard. | Round the mark to starboard | the centre of the pond |
| 6 | Last one! Sail straight through the downwind gate. | Go through the gate | the same leeward gate, no zone rings; through → Screen C |

Wrong-way roundings get *Wrong side. Go back and round the mark with it on your LEFT/RIGHT.*
Tips (the section-4 reminders, in their own row of the box): the no-sail-zone cone (silent),
**Going downwind? Press [Space] to raise your spinnaker.**, **The spinnaker is for downwind
sailing. Press [Space] to lower it.**, and **Careful — hitting things slows you down.** on any
collision. Paddle says raise/lower, never hoist/douse, throughout the school.

## Section 3 — Start practice

The pond with the start line only — no windward gate, no ladder rungs — one boat, and the
document's prestart (30 s) with the clock ringed and pulsing.

| # | Coach Paddle says | Goal | Advances on |
|---|---|---|---|
| 1 | Get ready! Stay behind the line until zero — but try to stay close. | Stay behind the start line | — |
| 1a | Too soon! Get back behind the start line before the clock reaches zero. *(repeats: Too soon! Back behind the line.)* | Get back behind the start line | over the line (or over early) before the gun |
| 1b | Good. Now stay behind the line until zero. | Stay behind the start line | back behind it |
| 2 | That's the gun — go! Cross the start line. | Cross the start line | the timer expires; ring off; the gun sounds |
| 2a | Over early! Get back behind the line first. | Get back behind the start line | over the line at the gun |
| 2b | Good — now cross the line! | Cross the start line | back behind it after the gun |
| — | *(Screen D opens with the feedback: Great start! Right on the gun. (≤ 1.5 s) / Nice start! You crossed right after the gun. (≤ 5 s) / You started N seconds after the gun. Next time, try to be closer to the line at zero. / You were over early, but you recovered! Next time, stay behind the line until zero.)* | | crossing → fade → Screen D |

Tips: the no-sail-zone cone, collisions, over early, "The gun has gone! Cross the start line." 5 s after the gun, lower the spinnaker.

## Section 4 — The Pond Race

The pond as authored in `pond.venue.js` — course, marks, committee boat, three classmates,
penalties on. No ducklings. Coach Paddle speaks only as REMINDERS: each watches one condition,
speaks after it has held for the dwell time, repeats while it holds, and clears when it ends.
Listed in priority order — when several hold at once, the first speaks and the rest wait.

| Condition (held for) | Coach Paddle says |
|---|---|
| In the no-sail zone, 3 s | *(silent)* the red cone shows, and only while you are in it |
| Penalty owed and no turn under way, 3 s | You have a penalty. Sail one full circle to clear it. |
| Over early and not heading back behind the line, 3 s | You're over early. Get back behind the start line. |
| Spinnaker up and TWA < 90°, 3 s | Your spinnaker is flapping. Press [Space] to lower it. |
| Not started, 5 s after the gun | The gun has gone! Cross the start line. |
| Past the next gate's line without crossing it, 3 s | You passed the windward gate. Turn back and sail between the marks. / You passed the finish line. Turn back and sail between the marks. |
| Racing, no spinnaker and TWA > 110°, 3 s | Going downwind? Press [Space] to raise your spinnaker. |
| No progress toward the next mark, 3 s | The windward gate / The finish is to your LEFT / RIGHT. Turn toward it. — or — … is behind you. Turn around. |

Plus the one-shots: "This one counts. Same start as practice — be ready at zero." at the prestart;
"That's the gun — go race!" at the gun (over early: "Over early! Get back behind the line, then
start again."); "You're off! Sail upwind to the windward gate." on crossing the line; "Through the
gate! Now downwind to the finish." on starting leg 2; on the first give-way cross "Watch the boat markers: RED means you give way. GREEN
means they give way." and, 3 s later on a starboard cross, "They're on starboard. Pass behind
them."; "Penalty cleared. Keep racing!" when a penalty clears. Otherwise Paddle stays quiet.

Debrief (Screen E, two lines): start — *Great start — you crossed just after the gun.* / *You started
N seconds after the gun. Next time, be closer to the line at zero.* / *You were over early and had to go
back. Next time, stay behind the line until zero.* / *You never crossed the start line. When the clock
reaches zero, go!*; sailing — *You sailed too close to the wind. Give the red no-sail zone a little
more room.* / *Your spinnaker stayed up too long. When it starts flapping, lower it.* / *You took a
penalty turn (N penalty turns). When your marker is red, you need to give way.* / *Nice sailing — clean
upwind leg, and the spinnaker came down on time.*

**Debrief** (finish or timeout): three lines of feedback on *your* race, then **Race again** ·
**Restart school** · **Go to Clubhouse**.
