# Music — Direction, Prompts & Delivery

**Version:** 0.1 · **Date:** July 31, 2026
**Scope:** the score. What each venue sounds like, how to generate it, how to
install it, and how to judge it.
**Companion docs:** [visual-style.md](visual-style.md) (brand, §1 personality) ·
[venue-art.md](venue-art.md) (the model this document follows) ·
[venues.md](venues.md) (what each venue is *about*)

Markers follow [visual-style.md](visual-style.md) §0: **Observed** goes stale if
the code changes, **Rule** is binding on new work, **Intent** is direction not yet
realized.

---

## 1. The style in one sentence — **Rule**

> A small live acoustic ensemble playing sailing-club music — plucked strings,
> upright bass, brushed kit, one folk lead voice — bright, unhurried and
> confident, where each venue changes the lead instrument and the rhythmic feel
> but never the ensemble.

## 2. Six rules — **Rule**

1. **One ensemble, ten dialects.** Every venue owns a lead instrument and a
   rhythmic feel that no other venue uses. §5 is that registry, and it works the
   way the palette registry in [venue-art.md](venue-art.md) does: a new venue must
   claim unclaimed territory.
2. **Instrumentation carries the PLACE. Tempo, density and form carry the
   MECHANIC.** This is the music's version of "the palette carries the place, the
   sky advertises the mechanic," and it is why you never have to choose between
   flavour and function. Gatorgrass gets a Cajun accordion because of *where* it
   is, and drags behind the beat because of *how it plays*.
3. **Borrow instruments, not genres.** One or two signature instruments per
   venue, played by the house ensemble in the house idiom. Ten full regional
   genres is a novelty world-tour album: jarring venue to venue, and a couple of
   the picks land close to tourist cliché. The precedent is Wind Waker — Dragon
   Roost is pan flute and flamenco guitar and still unmistakably the same score.
4. **Tempo is the difficulty dial**, not volume and not density. Keep the ladder
   in §5 explicit; no two venues share a BPM.
5. **Race music has no hook.** It plays for three and a half minutes behind
   tactical decisions. Ostinato, texture and groove. Tunes belong in the menu and
   results cues, where the player is not thinking.
6. **Never write a track that ends.** Every prompt carries *seamless loop, no
   intro, no outro, ends as it began*. A track that fades is a track with a hole
   in its loop; one that ends denser than it began has a step in it instead.

**Instrumental, with no exceptions, on every race track.** Lyrics measurably cost
about 5–10% in strategy games because vocals compete with the same faculties as
tactical thinking. That includes wordless "ooh/ahh" vocalise, which is also Suno
v5's most-reported unwanted behaviour — so it gets an explicit exclusion, every
time, not just an "instrumental" checkbox.

## 3. What the wind bed leaves you — **Observed** (`script.js`, `WIND_SOUND`)

⚠️ **This inverted in July 2026 and old advice is wrong.** The wind bed used to be
lowpassed 300→1200 Hz, i.e. parked on guitar body, bass and kick. It is now
highpassed at **900 Hz** and sweeps up to **6.5 kHz**, with a quiet rumble below
180 Hz.

So the band to protect is now the **upper mids and highs**, and the low-mid is
free. Concretely:

⚠️ **This table is written against the venues as PLANNED, not as they race today.**
Measured Aug 1 2026: Pearl Lagoon runs 13 kn, the same as Lighthouse Cove, because
its squalls are not built — so its "heavy" row is a forecast. Only Glacier Sound is
actually windy right now (20 kn). Measure the venue before designing around its
weather; the probe is in §8.

| Venue wind | What it means for the music |
|---|---|
| Heavy (Glacier Sound, Redrock, Lagoon squalls) | Put the identity **low** — horn, cello, baritone guitar, floor toms. Shakers, ride cymbals and bowed-glass shimmer will trade with the gust, which on Glacier is the point |
| Light (Gatorgrass, Stillwater) | The bed nearly vanishes. These venues can use the whole spectrum, and Gatorgrass can be the warmest, fullest track in the game |

The bed is also keyed to **apparent** wind, so it falls away downwind and builds
as a boat accelerates. Downwind is where the music is most exposed.

**And it is quieter than you may expect.** In play it sits around -40 dB (13 kn
apparent), reaching about -34 dB in a hard breeze, with a gust front opening
roughly 9 dB above the bed for a second or so. It is also **silent on the venue
picker and the scoreboard** — `Sound.windAudible()`; the bed belongs to being on
the water. So the music is on its own in the menus and carries those screens by
itself; only the race tracks share the mix with weather.

Level and shape are separate knobs: `WIND_SOUND.masterDb` moves the whole bed
without touching the balance between calm, breeze and gust.

⚠️ **Auditioning a track over `file://` will not tell you how it sounds.** A media
element opened from the filesystem is cross-origin, so `createMediaElementSource`
returns a node that outputs SILENCE while the element still plays, `currentTime`
still advances and every gain still reads normal — nothing throws, nothing logs.
The player detects `file:` and falls back to the element's own volume, so music
*is* audible there, but it takes a different path through the mix and skips the
bus. **Judge a track over http** (`python3 -m http.server`, then
`http://localhost:8000/regatta/`). `test_audio.js` serves the tree on an ephemeral
port and measures real signal on the bus for exactly this reason: it is the only
assertion in the suite that can see a silent-but-healthy graph.

## 4. The cue map — **Observed** (`script.js`, `MUSIC_TRACKS`)

| Cue | Count | Length | Status |
|---|---|---|---|
| `menu` — picker, briefing, competitor list | 1 | 3 min | `yacht-club` |
| `prestart` | **none — the venue track starts here** | — | see below |
| `racing` + `racing-<venue>` | 1 house + 10 | 4–6 min | `spinnaker-run`, `racing-bay` |
| `results` | 1–2 | 2 min | `harbor-results` |

**Length is measured on the LOOP BODY, not the file.** What plays is
`loopEnd - loopStart`; everything else is discarded. A 3-minute file whose ending
is denser than its opening can yield barely 2 minutes of usable loop.

The target follows from on-water time: the prestart is ~30 s and a race about
213 s, so **a body of ~4 minutes means a normal race never loops at all** and the
loop is pure insurance. Bluewater Bonanza's distance course wants 6. Below about
2 minutes of body you hear the seam twice a race, every race, which is where
loop fatigue starts to bite.

**There is no prestart cue** (Aug 1 2026). The venue's track starts at the
PRESTART and runs straight through the gun — prestart and racing resolve to the
same cue, so nothing re-triggers at the start. The music is already going when the
race begins rather than announcing it, and the whole time you are on the water is
scored by one continuous piece: the countdown is part of the race, not a lobby for
it. It also means **a race track's first minute is heard during the countdown**,
so write the opening for manoeuvring, not for a starting gun.
`prestart-countdown.mp3` and `harbor-glow.mp3` both ship, both unassigned.

**A cue ENTERS at `loopStart`.** Anything before it is unused material — see §8.

Per-venue tracks are one table row: `'racing-<venuekey>'`. Absent a row, the venue
races to the house track, and `test_audio.js` asserts every venue reaches one.

## 5. The registry — **Rule**

Instruments carry the place; tempo, density and form carry the mechanic.

| Venue | Signature instrument(s) — *place* | Feel / form — *mechanic* | BPM | Mode |
|---|---|---|---|---|
| Gatorgrass Bayou | Cajun accordion, washboard, resonator slide | dragging behind the beat | 72 | dorian blues |
| Stillwater Lake | fingerpicked nylon, solo flute | stops and restarts — real silences | 84 | lydian major |
| Glacier Sound | low horn drone, bowed double bass | slow pressure, no melody | 88 | open fifths, no third |
| Bluewater Bonanza | cello over acoustic guitar | one long patient build | 92 | major |
| Redrock Reservoir | baritone tremolo guitar, floor toms | dry, spacious, big slapback | 96 | mixolydian |
| Clubhouse Point | woodblock, upright bass, brushes — no lead | metronomic, warm, forgettable on purpose | 100 | C major |
| Glowtide Strait | glass marimba, analog synth arp | kinetic nocturnal pulse | 104 | aeolian |
| Pearl Lagoon | steel pan, hand percussion | island offbeat + a squall gear | 106 | major |
| Lighthouse Cove | penny whistle, concertina | easy club-race 4/4 — the reference | 112 | D major |
| Otter Run | banjo roll, fiddle | continuous ostinato, never rests | 120 | major |

⚠️ **Gatorgrass is Cajun/zydeco, not bluegrass.** Bluegrass is Appalachian —
banjo-led, fast, bright, virtuosic. The bayou is Louisiana, and zydeco is also the
better *mechanical* fit: low and rolling for a venue whose whole mechanic is that
you cannot get moving. The banjo went to Otter Run, where a perpetual roll *is*
the current. The two prompts exclude each other's instrument to hold the line.

## 6. Prompts — **Rule**

Suno Custom mode. **Instrumental ON.** Paste the Style line into *Style of Music*
and the Exclude line into *Exclude Styles* — the dedicated field is parsed more
reliably than negatives written into the style. Leave Lyrics empty.

Sliders: **Weirdness** as listed (low keeps a loop predictable, which is what
background music wants); **Style Influence 85** unless noted, so the tags actually
bind.

**Ask for length up front.** Suno's default take runs 2–2:30, which after loop
trimming leaves under 2 minutes of body — half what §4 asks for. Generating long
beats extending: an Extend joins mid-body where nothing can hide it, whereas the
loop seam gets a 0.6 s crossfade. Extend only when a take has a quality worth
protecting that a regeneration might not reproduce.

Every line ends in the same loop contract: *seamless loop, no intro, no outro,
ends as it began*.

**"Ends as it began" was added after the first generation came back** (Clubhouse
Point, Aug 1 2026). "No intro" stops Suno prepending a separate intro *section*;
it does not stop it opening on a bare pulse and filling the texture in over the
first twenty seconds. That begins at full LEVEL, so it passes every loudness
check, and then drops the texture floor 36 dB every time the loop comes round.
The property a loop needs is not *density* but **symmetry** — which is why the
tag is "ends as it began" and not "no build". Bluewater Bonanza is supposed to
build and Stillwater Lake is supposed to be sparse; both are fine, so long as the
last bar matches the first.

**Naming.** A venue track is saved as `regatta/assets/audio/<venuekey>.mp3` and
takes the `MUSIC_TRACKS` row key `racing-<venuekey>` — the keys are the ones in
`VENUES` (`bay`, `lake`, `lagoon`, `swamp`, `river`, `ocean`, `redrock`,
`glowtide`, `arctic`, `seatrials`). Nothing else needs touching: `resolveTrack`
finds the row, and `test_audio.js` asserts every venue reaches a track.

### Clubhouse Point — generate this one first

**Style**
```
Bright C major club bed, instrumental, 100 BPM, soft woodblock pulse, warm upright bass, lightly brushed kit, no melody at all, unhurried and even, warm acoustic room, seamless loop, no intro, no outro, ends as it began
```
**Exclude**
```
vocals, wordless vocalise, melodic lead, minor key
```
Weirdness **10** · Style Influence **90** · target 2 min
*It should be the least memorable track in the game. That is the brief, not a
failure — this is the eval anchor, and blandness is its identity, the same way
its card is deliberately the flattest of the ten.*

⚠️ **Revised Aug 1 2026 after the first take came back in D minor.** The key had
been buried mid-line behind the tempo; it now LEADS, and "minor key" replaced
"orchestral strings" in the excludes — the strings exclusion was defending against
something this brief was never going to produce anyway. One sample is not a
finding, so treat this as a reasonable precaution rather than a proven fix; but
put the key first in any prompt where the key is load-bearing.

*The July 31 rename changed this track's TEMPERATURE, not its brief. It was
specced dry, neutral and pad-led, which was correct for a venue called Sea Trial
Bay and made it the one cold track in a warm album. "No melody at all" and "even
dynamics" stay — the function is unchanged — but the room is warm now and the
woodblock reads as the club's five-minute gun rather than a lab metronome.*

### Stillwater Lake
**Style**
```
Sparse acoustic instrumental, 84 BPM, fingerpicked nylon guitar and solo flute, lydian major, long rests between phrases, brushed upright bass, glassy and patient, seamless loop, no intro, no outro, ends as it began
```
**Exclude** `vocals, wordless vocalise, dense percussion`
Weirdness **20** · *the arrangement must have holes in it — silence is the mechanic*

### Pearl Lagoon — **done**
Filled by `pearl-lagoon.mp3` (C major at r=0.91, the cleanest key reading in the
project, and 118.5 s of loop body from a 119.0 s file — no intro, no outro,
nothing discarded). ⚠️ It measures **39.4%** in the wind band, against advice
below that says put a windy venue's identity low. Accepted because the squalls
are not built yet and the venue currently races at 13 kn, the same as Lighthouse
Cove. **Re-measure when the identity pass lands the squalls.** The prompt below
is the one that produced it.
**Style**
```
Bright island instrumental, 106 BPM, steel pan lead, offbeat guitar skank, shaker and hand percussion, sunlit major key, one urgent double-time squall section, seamless loop, no intro, no outro, ends as it began
```
**Exclude** `vocals, wordless vocalise, EDM synth`
Weirdness **25** · *the double-time section is the squall; keep it inside the loop*

### Gatorgrass Bayou
**Style**
```
Slow swamp instrumental, 72 BPM, Cajun accordion and resonator slide guitar, washboard and triangle, dorian blues, humid and dragging behind the beat, seamless loop, no intro, no outro, ends as it began
```
**Exclude** `vocals, wordless vocalise, bluegrass banjo`
Weirdness **25** · *no wind bed to fight here — warmest, lowest, fullest track in the set*

### Otter Run
**Style**
```
Driving old-time instrumental, 120 BPM, continuous banjo roll and fiddle, upright bass, bright major key, perpetual motion with no rest in the rhythm, seamless loop, no intro, no outro, ends as it began
```
**Exclude** `vocals, wordless vocalise, accordion`
Weirdness **20** · *the ostinato that never rests is the current*

### Bluewater Bonanza
**Style**
```
Wide open instrumental, 92 BPM, solo cello over steady acoustic guitar, slow harmonic movement, distant swelling strings, patient oceanic build, major key, seamless loop, no intro, no outro, ends as it began
```
**Exclude** `vocals, wordless vocalise, drum kit`
Weirdness **20** · Style Influence **80** · target **6 min** — Extend once
*the one venue where an orchestral swell is allowed; it is the passage*

### Redrock Reservoir
**Style**
```
Dry desert instrumental, 96 BPM, baritone tremolo guitar with deep slapback echo, sparse floor toms, no cymbals, mixolydian, sun-bleached canyon space, seamless loop, no intro, no outro, ends as it began
```
**Exclude** `vocals, wordless vocalise, cymbals`
Weirdness **30** · *the slapback is the canyon; low register keeps it clear of the gusts*

### Glowtide Strait
**Style**
```
Nocturnal electronic instrumental, 104 BPM, glass marimba and soft analog synth arpeggio, deep sub bass, brushed rim, aeolian minor, gliding and weightless, seamless loop, no intro, no outro, ends as it began
```
**Exclude** `vocals, wordless vocalise, acoustic guitar`
Weirdness **35** · *the only venue that leaves the acoustic ensemble, exactly as it
is the only venue allowed neon in the art registry*

### Glacier Sound
**Style**
```
Cold sparse instrumental, 88 BPM, low horn drone and bowed double bass, open fifths with no third, restrained log drum, texture not melody, vast and still, seamless loop, no intro, no outro, ends as it began
```
**Exclude** `vocals, wordless vocalise, melodic lead`
Weirdness **30**
*Low on purpose. This is the windiest venue, so the top of the spectrum belongs to
the gust — when a katabatic hits, the wind takes the high end and the music holds
the floor. That is the venue's story, not a compromise.*

### Lighthouse Cove — **done**
Filled by `lighthouse-cove.mp3` (112 BPM on a 112 BPM brief, tonic D with an
ambiguous third, 29.3% in the wind band against `breezy-race`'s 47.7%). It
replaced `breezy-race`, which is retired to unassigned. The prompt below is the
one that produced it.
**Style**
```
Bright acoustic sailing instrumental, 112 BPM, D major, penny whistle and concertina over strummed guitar, upright bass, brushed kit, easy club-race swing, seamless loop, no intro, no outro, ends as it began
```
**Exclude** `vocals, wordless vocalise, sea shanty chorus`
Weirdness **20**

### Shared cues — optional
**Prestart** — *no longer needed; the venue track now covers the countdown (§4).
Kept in case that decision is revisited:*
```
Tense instrumental countdown bed, 88 BPM, ticking rim and shaker, low pulsing bass, rising string tremolo, building pressure that never resolves, seamless loop, no intro, no outro, ends as it began
```
**Exclude** `vocals, wordless vocalise, triumphant fanfare` · Weirdness **25** · 40 s

**Results — victory variant**, the one genuine gap in the cue map:
```
Warm acoustic celebration instrumental, 104 BPM, C major, concertina and mandolin over strummed guitar, brushed kit, generous and relaxed, harbour evening, seamless loop, no intro, no outro, ends as it began
```
**Exclude** `vocals, wordless vocalise, orchestral fanfare` · Weirdness **20**
*Vocals are allowed on menu and results if you want them — only race tracks are
under the hard rule.*

## 7. Making it one album — **Intent**

The registry keeps venues distinct; something has to keep them related. Two levers,
in order of effort:

1. **Build a Persona from a track you already own** and base every venue on it. A
   Persona saves a song's sonic essence — ensemble, production, room — and reuses
   it. Use *Salty Critter Yacht Club* (the title track, the house sound) or
   *Breezy Race to Windward*. Do **not** build it from Clubhouse Point: a Persona made
   from a deliberately characterless bed gives you a characterless album.
2. **A motif.** One six-to-eight note figure in the menu track that hides inside
   every venue track — different instrument, different tempo, sometimes only in
   the bass. This is what makes Wind Waker cohere. Suno cannot reuse a motif from
   text alone; Cover preserves melody while changing style, so the route is a
   single motif seed put through Cover per venue. Untested — try it on two venues
   before committing.

## 8. Delivery — **Observed**

1. Download the MP3 from Suno at the highest quality offered.
2. Save as `regatta/assets/audio/<name>.mp3`.
3. Measure it and paste the row it prints into `MUSIC_TRACKS` in `script.js`:
   ```
   python3 regatta/art/music_loop.py regatta/assets/audio/<name>.mp3
   ```
   `loopEnd` is where the music stops and the fade begins. `loopStart` is where the
   texture becomes dense enough to loop back INTO — not the same question, and the
   one that catches people out: Suno likes to open a bed with a bare pulse and fill
   it in over the first half-minute, which begins at full LEVEL and would still drop
   the floor out by 36 dB every time the loop came round. Playback ENTERS at
   `loopStart` as well as returning to it: a cue starting is the moment the music
   most needs to be present, so a sparse opening is skipped, not savoured.
   `trim` normalises level to the set's -17 dB mean.
   **Do not hand-edit any of the three.**
4. `npm run test:audio` — asserts the file exists, the cue resolves, and the loop
   point sits inside the track.
5. When there is a CHOICE to make — two takes, or a candidate against a track
   already in the slot — measure both over their loop bodies:
   ```
   python3 regatta/art/music_spec.py "regatta/assets/audio/<name>.mp3:<loopStart>:<loopEnd>"
   ```
   It prints the wind-band share (§3), dynamics, the third/fifth ratio a brief like
   Glacier Sound's is really asking for, and how much the harmony moves. It picked
   Glacier Sound between two takes and retired `breezy-race` from Lighthouse Cove.
   ⚠️ It cannot identify an instrument, so it cannot decide venue FIT — that stays
   a listening call against the registry in §6.

⚠️ **The suite races seatrials and arctic, not your venue.** A new track gets the
static loop-map check and nothing more, so drive the actual venue over http once:
```
node regatta/eval/_probe_audio.js <venue>
```
It confirms the cue resolves, that real signal reaches the bus, and — the part a
file measurement cannot tell you — how far the wind bed sits under the music **at
that venue's own breeze**. A wind-band share is a property of the track; headroom
is a property of the pairing. Measured Aug 1 2026: bay 13.4 dB, lagoon 12.1 dB,
arctic 6.4 dB, the last deliberately tight.

⚠️ Pin the venue through `localStorage`, never `settings.venue = x`: `resetGame()`
calls `loadSettings()` and stomps it, and the probe then measures whatever venue
was already loaded while appearing to pass.

**Size.** Suno's MP3s run ~190 kbps, about 4–7 MB per track; ten venue tracks is
~50 MB, all lazily loaded per cue. If that becomes a problem, 128 kbps roughly
halves it — but no MP3 encoder is installed on this machine, so that needs
`brew install lame` or ffmpeg first. Not urgent.

## 9. Acceptance checklist — **Rule**

- [ ] Instrumental, and no wordless vocalise anywhere in it
- [ ] No fade: `music_loop.py` reports under ~2 s trimmed, ideally "already tight"
- [ ] Loops without drawing attention to the seam — listen through it three times
- [ ] Tempo matches the registry; no BPM collision with another venue
- [ ] The owned instrument is audible in the first fifteen seconds
- [ ] Nothing in it competes with a wind gust on a windy venue (§3) — `music_spec.py`
      puts a number on it; the set runs 5.4% (arctic) to 47.7% (breezy-race, retired)
- [ ] Loop BODY is long enough: `loopEnd - loopStart` against ~245 s of prestart +
      race. Under ~120 s the seam comes round twice or more, which raises the bar on
      how clean it is rather than ruling the track out
- [ ] No hook you can hum after one race — for race tracks, that is a failure
- [ ] Sits with its neighbours: play it straight after the venue before and after
      it in the registry, not on its own
