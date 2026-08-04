# Music — Guide & Reference

**Version:** 1.0 · **Date:** August 1, 2026
**Scope:** the score. What the game sounds like, how to write a prompt that gets it,
how to install a track, and how to judge one.
**Companion docs:** [visual-style.md](visual-style.md) (brand, §1 personality) ·
[venue-art.md](venue-art.md) (the model this document follows) ·
[venues.md](venues.md) (what each venue is *about*)

Markers follow [visual-style.md](visual-style.md) §0: **Observed** goes stale if the
code changes, **Rule** is binding on new work, **Intent** is direction not yet realised.

**How to use this.** **Part I** is the guide — read §3 before writing any prompt, and
§6 before judging a take. **Part II** is the reference — what exists, what it measures,
and the exact prompt that produced each track. Every claim here was measured; where a
number is quoted, the tool that produces it is named in §14.

**Status:** all 13 cues are filled and purpose-written — ten venues, menu, results, and
a house fallback. Four more tracks exist for venues that have not been built yet, and a
brief for a proposed tutorial cue is recorded in §12.4.

---

# PART I — THE GUIDE

## 1. The style in one sentence — **Rule**

> A warm, hand-played score for a club racing game — piano, guitar, upright bass and
> brushed kit at its centre — where every venue borrows one or two instruments from
> its own place and plays them in the house's unhurried, confident register.

⚠️ **This replaced an earlier sentence that had gone stale, and the failure is
instructive.** The original read *"a small live acoustic ensemble… one folk lead
voice."* It was written before any track existed, and by the time ten had shipped it
described **about half the album** — not the analog-synth nocturne, the orchestral
swell piece, the taiko-and-struck-metal venue or the nyckelharpa fjord. It stayed true
of Lighthouse Cove, Stillwater, Gatorgrass and Sockeye Run, **so it described the
album's folk corner and got mistaken for the album.** A menu brief written straight
from it came back too folksy for a game spanning zydeco to volcanic percussion.

**The replacement above is Intent until confirmed.** It changes nothing that shipped;
it changes what the next brief is written from.

## 2. The rules — **Rule**

1. **One ensemble, many dialects.** Every venue owns a lead instrument and a rhythmic
   feel no other venue uses. §10 is that registry, and it works the way the palette
   registry in [venue-art.md](venue-art.md) does: a new venue must claim unclaimed
   territory.
2. **Instrumentation carries the PLACE. Tempo, density and form carry the MECHANIC.**
   The music's version of "the palette carries the place, the sky advertises the
   mechanic." Gatorgrass gets a Cajun accordion because of *where* it is, and drags
   behind the beat because of *how it plays*.
3. **Borrow instruments, not genres.** One or two signature instruments per venue,
   played in the house register. Ten full regional genres is a novelty world-tour
   album. The precedent is Wind Waker — Dragon Roost is pan flute and flamenco guitar
   and still unmistakably the same score.
4. **Tempo is the difficulty dial**, not volume and not density. ⚠️ See the saturation
   warning in §10: with fourteen venues this is now a matter of **bands**, not exact
   values.
5. **Race music has no hook.** It plays for three and a half minutes behind tactical
   decisions. Ostinato, texture and groove. Tunes belong in the menu cue.
6. **Never write a track that ends.** Every prompt carries *seamless loop, no intro,
   no outro, ends as it began*. A track that fades has a hole in its loop; one that
   ends denser than it began has a step in it.

**Instrumental, with no exceptions, on every race track.** Lyrics measurably cost about
5–10% in strategy games because vocals compete with the same faculties as tactical
thinking. That includes wordless "ooh/ahh" vocalise, which is also Suno v5's
most-reported unwanted behaviour, so it gets an explicit exclusion every time — not
just an "instrumental" checkbox. Vocals are *permitted* on menu and results; §12.2
explains why the menu track should still not have them.

## 3. How to write a prompt — **Rule**

Suno Custom mode. **Instrumental ON.** Paste the Style line into *Style of Music* and
the Exclude line into *Exclude Styles* — the dedicated field is parsed more reliably
than negatives written into the style. Leave Lyrics empty.

### 3.1 The shape of a Style line

Elements in this order. The order matters: the front of the line binds hardest.

1. **Key and mode** — *"D major"*, *"A minor"*. Name the tonic; never name an exotic
   mode (§3.3).
2. **One genre-or-register phrase** — *"orchestral sailing instrumental"*, *"dry desert
   instrumental"*. One, not three.
3. **Tempo** — *"96 BPM"*.
4. **The signature instruments** — the venue's claim from §10, two at most.
5. **The mechanism** — what the players actually *do*: who alternates with whom, what
   repeats, what the bass is doing. This is the load-bearing clause; see §3.2.
6. **One or two colour words** — *"sun-bleached canyon space"*.
7. **The loop contract, verbatim** — *seamless loop, no intro, no outro, ends as it
   began*.

**Ask for length up front.** Suno's default take runs 2–2:30, which after loop trimming
leaves under 2 minutes of body. Generating long beats extending: an Extend joins
mid-body where nothing hides it, whereas the loop seam gets a 0.6 s crossfade.

### 3.2 ⚠️⚠️ Specify the MECHANISM, not the adjective — the central rule

**Suno reliably obeys instructions about instrumentation and arrangement, and reliably
ignores instructions about outcomes.** Two independent proofs, both expensive:

| asked for | got | what worked instead |
|---|---|---|
| **dynamics** — *"rise and fall away to almost nothing every 40 seconds"*, plus `constant intensity` excluded (Bluewater, three takes) | flatter every time: 11.4 → 5.5 → **3.8 dB** | *"alternating sections: solo cello and acoustic guitar alone, then full orchestra"* → **8.6 dB**, with real 30 s swell sets |
| **melody** — *"memorable piano melody"* (menu, take 2) | **0.109 chroma flux** — near the least melodically active track in the project | *"a short phrase that repeats and answers itself"*, *"call and response between piano and guitar"* → **0.200** |

**An adjective describes the result you want; only a mechanism produces it.** Before
writing any brief, translate each quality into the arrangement that causes it:

| you want | ask for |
|---|---|
| loud / quiet passages | *who is playing* — "solo cello alone, then full orchestra" |
| memorable | *what repeats* — "a short phrase that repeats and answers itself" |
| energy | *what the rhythm section does* — "walking upright bass", "brushed snare with a bounce" |
| space | *who stops* — but never at the start; see §5 |
| speed, without changing tempo | *subdivision* — "sixteenth-note string ostinato" |
| grandeur | *range* — "soaring high violins over cello and low brass" |

### 3.3 ⚠️ Words that do not mean what you think — **Rule**

Three separate ways the prompt vocabulary bites. All were paid for.

**(a) Some "adjectives" are read as instruments.** A menu brief said *"catchy
whistleable piano tune"* meaning *hummable*, and the take came back **with whistling on
it** — past `vocals` and `wordless vocalise`, since whistling is strictly neither.
**Never describe an effect with a word that names a sound.** *Whistleable, singable,
hummable, anthemic, chanting, orchestral, cinematic* can all be literally performed.

**(b) Mood words carry a tempo and a density.**

| word | what it also means |
|---|---|
| *epic, huge, vast, heroic* | loud and continuous — it will flatten your dynamics |
| *unhurried, patient, open, airy, cinematic* | slow and spacious — it will drain your energy |
| *distant* | reverbed, filtered, far away — it buried Bluewater take 1 at 4.2% above 2 kHz |

**(c) Two exclusions are known not to work.**

- ⚠️ **`minor key` does not hold the third.** Three data points: Clubhouse Point, and
  menu takes 3 (omitted it → A minor) and 4 (included it → A minor). The **tonic**
  holds when you name it; the **third** drifts.
- ⚠️ **Naming an exotic mode never works — 5 briefed, 5 flattened.** dorian → aeolian,
  aeolian → F major, mixolydian → F major, lydian → G major twice. The second lydian
  attempt carried the proposed mitigation (*"G lydian, major with a sharp fourth"*,
  mode first) and made no difference. **Ask for major or minor only.** The Mode column
  in §10 is now a record of what shipped, not an instruction.

### 3.4 What Suno obeys, and what it does not — **Observed**

| reliable | unreliable |
|---|---|
| instrumentation and arrangement | dynamics and level |
| **the tonic**, when named (6 of 8 briefs) | **the mode**, always (0 of 5 exotic) |
| tempo, to about ±5 BPM | any outcome adjective |
| the loop contract (with the §5 caveat) | negatives written into the Style line rather than Exclude |

**Sliders.** Weirdness as listed per track; **20 produces safe, even bed-making**,
which is the failure mode behind two rejected takes — use 25–35 when a track needs
character. **Style Influence 85** unless noted, so the tags actually bind.

## 4. What the mix leaves you — **Observed** (`script.js`, `WIND_SOUND`)

The wind bed is **highpassed at 900 Hz**, sweeping to **6.5 kHz**, with a quiet rumble
below 180 Hz. ⚠️ This inverted in July 2026 — it used to be lowpassed onto guitar body,
bass and kick, so **any advice about keeping a track bright is backwards now.** The
band to protect is the upper mids and highs; the low-mid is free.

**It is quieter than you expect**: around −40 dB at 13 kn apparent, reaching −34 dB in
a hard breeze, with a gust front opening ~9 dB above the bed for a second. It follows
**apparent** wind, so it falls away downwind — downwind is where music is most exposed.
`WIND_SOUND.masterDb` moves the whole bed without touching the calm/breeze/gust balance.

⚠️ **The bed is SILENT on the venue picker and the scoreboard** (`Sound.windAudible()`)
— it belongs to being on the water. **So §4 does not constrain the menu and results
cues at all**, and they are the only two tracks free to be as bright as they like.

**Measured venue winds** — design against these, not against the plan:

| wind | venues | what it means |
|---|---|---|
| Heavy — **Glacier Sound only, 20 kn** | `arctic` | Put the identity **low** — horn, cello, baritone guitar, floor toms. Shakers, rides and bowed-glass shimmer trade with the gust, which here is the point |
| Light — 6.5–9 kn | `swamp`, `lake` | The bed nearly vanishes; use the whole spectrum. Borne out — they carry the two widest headrooms in the game |
| Everything else, 11–16 kn | the other seven | No constraint worth designing around |

⚠️ Redrock and Pearl Lagoon were both briefed *heavy* and both race at 12–13 kn; their
weather is an unbuilt identity pass, not a live constraint. **Re-measure if it lands.**

⚠️⚠️ **This section says what to keep OUT of the band and never what a track needs to
HAVE.** Two takes were rejected for being too dark — Bluewater take 1 at 4.2% above
2 kHz, Stillwater take 1 at 3.7% — while scoring *perfectly* by the rule above.
**Dark is cheap here and it is usually wrong: majesty and beauty both need a top.**
Read §4 as a constraint and §10 as the goal.

⚠️ **Auditioning over `file://` will not tell you how it sounds.** A media element
loaded from the filesystem is cross-origin, so `createMediaElementSource` returns a
node that outputs **silence** while the element still plays, `currentTime` still
advances and every gain still reads normal — nothing throws, nothing logs. The player
detects `file:` and falls back to element volume, so music *is* audible, but it takes
a different path and skips the bus. **Judge over http.**

## 5. Loops, length and the loopStart trap — **Rule**

**Length is measured on the LOOP BODY, not the file.** What plays is
`loopEnd - loopStart`; everything else is discarded. A 3-minute file whose ending is
denser than its opening can yield barely 2 minutes of usable loop.

On-water time is ~30 s prestart + ~213 s race, so:

| body | consequence |
|---|---|
| ≥ ~245 s | the seam is never reached in a normal race |
| ~120–245 s | heard once or twice |
| < ~120 s | heard two or three times, every race — loop fatigue |

⚠️ **A short body with a clean seam beats a long body with an audible one.** The menu
track has 127.5 s and a **0.2 dB** seam; an earlier take had 361 s and 2.1 dB. Take the
first. Only the menu loops repeatedly *within* one sitting, so it is the one cue where
length is worth chasing on its own.

⚠️⚠️ **NEVER ask for a build-in, an intro, or a slow start — the game deletes it.**
Playback **enters at `loopStart`**, and `music_loop.py` puts `loopStart` past any
opening too sparse to loop back into. A build-in is therefore *measured, skipped and
discarded*: Clubhouse Point lost 20.5 s and Bluewater take 1 lost 27 s exactly this way.
**A track must be able to start at full tilt, because it will.** Dynamic range has to
live **mid-track**, as troughs between peaks — which is also the only shape that
satisfies "ends as it began."

⚠️ **`loopStart` tests DENSITY, not level**, so an opening that is *dense but quiet*
passes and then thumps at the seam. Seen three times: Glowtide (6.4 dB down for 25 s),
Spoonbill Flats, and the results track (6.2 dB down for 7 s). If a track's opening
matters, check its level profile by hand.

## 6. Judging a take — **Rule**

Run `music_spec.py` over the loop body (§14) and read it like this:

| number | what it means | healthy range |
|---|---|---|
| **wind band 900 Hz–6.5 kHz** | how much the music argues with the weather | under ~30% is comfortable; only matters on a windy venue |
| **above 2 kHz / centroid** | brightness — **is there a top at all?** | under ~10% / under ~600 Hz is murk unless the venue is Glacier Sound |
| **dynamics** | swing of the half-second RMS | ⚠️ meaningless except against the brief — see below |
| **key / third / fifth** | tonic and mode | ⚠️ needs harmonic content; unreliable on percussion-led tracks |
| **chroma flux** | how much the harmony and melody MOVE | race tracks 0.09–0.24; **under ~0.12 on a track that wants a tune is "not catchy"** |
| **tempo** | peak family plus a resolved pulse | sanity check only; ±4 BPM near 100 |

⚠️⚠️ **A dynamics number means nothing on its own.** Sockeye Run ships at 3.4 dB and
that is a **pass** — its brief is *perpetual motion with no rest in the rhythm*, and
the ostinato that never rests *is* the current. The same figure failed Bluewater three
times, because that brief is contrast. **Judge against the brief, then check WHERE the
energy sits**: a flat track and a track with one ramp report similar numbers. Bluewater
take 2 reached full intensity at 13 s and never moved again.

⚠️ **Flat level is not the same as flat music.** Stillwater ships at 3.8 dB over 2 s
frames with **no periodicity** and is right, because its motion is *harmonic* — 0.166
flux. The failure case is flat on *both*: Bluewater take 3 measured 3.1 dB **and** 0.119
flux **and** no periodicity.

## 7. Delivery — **Observed**

1. Download the MP3 from Suno at the highest quality offered.
2. Save as `regatta/assets/audio/<venuekey>.mp3` — keys are the ones in `VENUES`
   (`bay`, `lake`, `lagoon`, `swamp`, `river`, `ocean`, `redrock`, `glowtide`,
   `arctic`, `seatrials`).
3. Measure it and paste the row it prints into `MUSIC_TRACKS`:
   ```
   python3 regatta/art/music_loop.py regatta/assets/audio/<name>.mp3
   ```
   **Do not hand-edit `loopStart`, `loopEnd` or `trim`.**
4. `npm run test:audio` — asserts the file exists, the cue resolves, and the loop point
   sits inside the track.
5. **Drive the venue once over http**, because the suite races `seatrials` and `arctic`
   only:
   ```
   node regatta/eval/_probe_audio.js <venue>
   ```
   It confirms real signal reaches the bus and reports **headroom** — how far the bed
   sits under the music at that venue's own breeze. A wind-band share is a property of
   the file; headroom is a property of the pairing.
6. **When choosing between takes**, measure both over their loop bodies with
   `music_spec.py` (§14) and compare on the axis the brief cares about.

⚠️ **A track for a venue that does not exist must NOT get a `MUSIC_TRACKS` row.** An
unreachable row is dead weight — three such rows were cleaned out in the July 2026
plumbing pass. Save the file, record the row in §12.3, wire it when the venue lands.

⚠️ **Pin the venue through `localStorage`, never `settings.venue = x`** — `resetGame()`
calls `loadSettings()` and stomps it, and the probe then measures whatever venue was
already loaded while appearing to pass.

**Size.** Suno MP3s run ~190 kbps, 4–7 MB per track; the full set is ~50 MB, lazily
loaded per cue. 128 kbps would roughly halve it but needs `lame` or `ffmpeg` installed.

## 8. Acceptance checklist — **Rule**

- [ ] Instrumental, no wordless vocalise, no whistling
- [ ] No fade: `music_loop.py` reports under ~2 s trimmed
- [ ] Loop body long enough for the cue (§5), and the seam clean enough for how often
      it is heard
- [ ] The owned instrument is audible in the first fifteen seconds
- [ ] **It has a top** — check above-2 kHz and centroid against §6 before anything else;
      two takes died of murk while passing every other test
- [ ] **It has the shape the brief asked for** — and if the brief asked for dynamics,
      the prompt asked for *arrangement*, not level (§3.2)
- [ ] Tempo in the right band (§10); mode ignored as unmeasurable (§3.3c)
- [ ] Nothing competes with a gust on a windy venue — but only Glacier Sound is windy
- [ ] No hook you can hum after one race — for race tracks that is a failure; for the
      menu it is the requirement
- [ ] Sits with its neighbours: play it straight after the venues either side of it in
      the registry, not on its own

---

# PART II — THE REFERENCE

## 9. The cue map — **Observed** (`script.js`, `MUSIC_TRACKS`)

| Cue | File | Loop | Notes |
|---|---|---|---|
| `menu` | `yacht-club.mp3` | 0 → 127.5, trim 0.85 | the Game's Song; Dec 2025 original retired to `yacht-club-2025.mp3` |
| `prestart` | — | — | **deliberately none**; the venue track covers the countdown |
| `racing` | `spinnaker-run.mp3` | 0 → 264.5, trim 0.96 | house fallback; nothing reaches it now, kept for an 11th venue |
| `racing-<venue>` | ten files | see §11 | one per venue |
| `results` | `harbor-glow.mp3` | 0 → 120.0, trim 1.02 | `harbor-results.mp3` retired to unassigned |

**There is no prestart cue.** Prestart and racing resolve to the same cue, so the
venue's track starts on the water and runs straight through the gun with nothing
re-triggering. ⚠️ **Consequence for writing: a race track's first minute is heard during
the COUNTDOWN**, so its opening should suit manoeuvring, not a starting gun.

**Unassigned files kept on disk:** `yacht-club-2025`, `yacht-club-take2/3`,
`harbor-results`, `breezy-race`, `prestart-countdown`, `ocean-take1/2/3`, `lake-take1`.
Unassigning is how a track leaves the game; deleting is not.

A tutorial venue — Duckling Pond, `pond`, [venues.md](venues.md) §15 — is specced
but unbuilt; its cue brief is §12.4. Nothing in code yet.

## 10. The registry — **Rule**

Instruments carry the place; tempo, density and form carry the mechanic. A new venue
must claim unclaimed territory.

| Venue | key | Signature instruments — *place* | Feel / form — *mechanic* | BPM briefed → shipped | Key shipped |
|---|---|---|---|---|---|
| Gatorgrass Bayou | `swamp` | Cajun accordion, washboard, resonator slide | dragging behind the beat | 72 → 68 | D minor |
| Stillwater Lake | `lake` | fingerpicked nylon, airy high flute | continuous arpeggios; harmony drifts like the shifts | 84 → 83 | G major |
| Glacier Sound | `arctic` | low horn drone, bowed double bass | slow pressure, no melody | 88 → 83 | C major |
| Bluewater Bonanza | `ocean` | solo cello + guitar alternating with full orchestra | swell sets — troughs are an ARRANGEMENT, not a fade | 92 → 96 | D major |
| Redrock Reservoir | `redrock` | baritone tremolo guitar, floor toms | dry, spacious, big slapback | 96 → 96 | F major |
| Clubhouse Point | `seatrials` | woodblock, upright bass, brushes — no lead | metronomic, warm, forgettable on purpose | 100 → 99 | C major |
| Glowtide Strait | `glowtide` | glass marimba, analog synth arp | kinetic nocturnal pulse | 104 → 99 | F major |
| Pearl Lagoon | `lagoon` | steel pan, hand percussion | island offbeat + a squall gear | 106 → 89 | C major |
| Lighthouse Cove | `bay` | saxophone, penny whistle | easy club-race 4/4 with a light swing — the reference | 112 → 112 | D (amb. third) |
| Sockeye Run | `river` | banjo roll, fiddle | continuous ostinato, never rests | 120 → 136 | D major |

**Unbuilt venues — claimed here so nothing collides later:**

| Venue | key | Signature instruments | Feel / form | BPM | Key |
|---|---|---|---|---|---|
| Spoonbill Flats | `flats` | hammered dulcimer, bass clarinet | figures that fall and restart — the tide | 76 | E minor |
| Flamingo Reach | `wetland` | muted trumpet, vibraphone | a groove that circles and never resolves, plus one flurry | 108 | E major |
| Fallwater Fjord | `fjord` | nyckelharpa, frame drum | driving; the falls are the slalom | 124 | A minor |
| Emberfall Isle | `volcanic` | struck metal (anvil, brake drums), taiko | percussion-led, the only one — the gauntlet | 132 | C minor |
| Duckling Pond | `pond` | felt piano | short phrases that always resolve — the lesson | 88 | C major |

⚠️⚠️ **Rule 4 does not scale past about ten venues.** Ten used
72/84/88/92/96/100/104/106/112/120; four more can only slot 4–8 BPM from a neighbour,
while **Suno's tolerance is ~±5 BPM and the measurement cannot resolve better than ±4
near 100.** Treat the column as **bands** — slow 70–85 · mid 88–108 · fast 112–136 —
and require distinctness *within a band*, not to the beat. Flamingo Reach is the proof:
briefed 108 to sit between Glowtide and Lighthouse Cove, it came back at 99, on
Clubhouse Point's rung.

⚠️ **The Mode column records what shipped, not what to ask for** (§3.3c). Note the
collisions this produced: **Glowtide and Redrock both landed in F major**, the closest
in the set, and only instrumentation separates them.

⚠️ **Gatorgrass is Cajun/zydeco, not bluegrass.** Bluegrass is Appalachian —
banjo-led, fast, bright. The bayou is Louisiana, and zydeco is also the better
*mechanical* fit: low and rolling for a venue whose whole mechanic is that you cannot
get moving. The banjo went to Sockeye Run, where a perpetual roll *is* the current.
The two prompts exclude each other's instrument to hold the line.

⚠️ **Lighthouse Cove's claim is saxophone + penny whistle, not the concertina it was
briefed with** (changed Aug 2026, ahead of a planned regeneration — see §12.1). The
shipped take's best-loved feature is its saxophone phrases, and the brief never asked
for them: Suno volunteered the sax, and the concertina it *was* asked for is not what
anyone remembers about the track. Claiming the sax **before** the regen is the point —
instrumentation is what Suno reliably obeys (§3.2), so an unrecorded accident is
exactly the thing a regeneration loses. Two consequences: the concertina is freed, and
§12.2's victory-variant draft already reaches for it; and **Flamingo Reach now needs a
fence** — sax with an easy swing at 112 and muted trumpet + vibraphone circling at 108
are the album's two jazz-adjacent corners, separated only by instrument and feel. Per
Rule 3 the jazziness stays a borrowed instrument and a swing, not a genre: neither
brief should ever say "jazz", and each should exclude the other's horn.

## 11. Measured properties of every track — **Observed**

Measured over the loop body. `*` = venue not built; track saved but unwired.

| Venue | key | body s | wind band | >2 kHz | centroid | dyn | key | flux | pulse |
|---|---|---|---|---|---|---|---|---|---|
| Lighthouse Cove | bay | 94.0 | 29.3% | 28.6% | 1955 | 3.8 | D minor | **0.205** | 112 |
| Stillwater Lake | lake | 240.5 | 12.8% | 16.2% | 1313 | 6.3 | G major | 0.166 | 83 |
| Pearl Lagoon | lagoon | 118.5 | 39.4% | 45.3% | 2793 | 4.8 | C major | 0.147 | 89 |
| Gatorgrass Bayou | swamp | 172.5 | 18.8% | 15.8% | 1110 | 9.4 | D minor | 0.119 | 68 |
| Sockeye Run | river | 479.0 | 23.6% | 36.4% | 2530 | 3.4 | D major | 0.180 | 136 |
| Bluewater Bonanza | ocean | 222.5 | 29.6% | 22.6% | 1240 | 8.6 | D major | 0.123 | 96 |
| Redrock Reservoir | redrock | 148.5 | 26.7% | 24.7% | 1530 | 8.0 | F major | 0.183 | 96 |
| Glowtide Strait | glowtide | 238.5 | 15.7% | 16.1% | 1209 | **13.5** | F major | 0.226 | 99 |
| Glacier Sound | arctic | 122.5 | **5.4%** | **2.4%** | **309** | 13.2 | C major | 0.129 | 83 |
| Clubhouse Point | seatrials | 99.0 | 21.4% | 16.4% | 1116 | 13.4 | C major | **0.235** | 99 |
| **Menu** | menu | 127.5 | 23.8% | 22.8% | 1619 | 4.3 | A minor | 0.200 | 112 |
| **Results** | results | 120.0 | 32.0% | 29.8% | 1875 | 11.2 | F major | 0.140 | 89 |
| Fallwater Fjord | fjord* | 133.5 | 26.2% | 21.8% | 1319 | 8.6 | A minor | 0.164 | 123 |
| Emberfall Isle | volcanic* | 225.0 | **44.6%** | 41.2% | 2269 | 9.0 | C major | 0.129 | 66 |
| Flamingo Reach | wetland* | 241.0 | 16.9% | 20.0% | 1472 | 6.8 | A minor | 0.168 | 99 |
| Spoonbill Flats | flats* | 139.5 | 24.1% | 21.0% | 1491 | 11.9 | D minor | 0.156 | 76 |

**Headroom** — music RMS over the wind bed, at each venue's own breeze:

| venue | bed | headroom | | venue | bed | headroom |
|---|---|---|---|---|---|---|
| Gatorgrass `swamp` | −44.6 dB | **18.4** | | Sockeye Run `river` | −41.4 | 14.1 |
| Glowtide `glowtide` | −42.0 | 17.0 | | Pearl Lagoon `lagoon` | −40.8 | 13.7 |
| Stillwater `lake` | −43.1 | 16.1 | | Lighthouse Cove `bay` | −40.8 | 13.3 |
| Redrock `redrock` | −41.4 | 15.9 | | Bluewater `ocean` | −39.1 | 12.2 |
| Clubhouse Point `seatrials` | −41.4 | 14.9 | | Glacier Sound `arctic` | −38.8 | **10.2** |

The ladder is the venues' own wind, in order, which is the shape it should have.

## 12. The prompts — **Reference**

Each is the line that produced the track now in the slot. Loop contract omitted for
brevity — **every one ends** `seamless loop, no intro, no outro, ends as it began`.

### 12.1 Venues

**Lighthouse Cove** `bay` · Weirdness 20 · *the reference track*
```
Bright acoustic sailing instrumental, 112 BPM, D major, penny whistle and concertina over strummed guitar, upright bass, brushed kit, easy club-race swing
```
`vocals, wordless vocalise, sea shanty chorus`
*⚠️ **A regeneration is planned, and this line predates the claim change in §10.** The
take it produced is loved for its saxophone phrases — which it never asked for — and
its 94.0 s body is the shortest in the project, so the seam comes round ~2.5× a race
and lands mid-bar (~half a beat off the grid; the 0.0 dB level match cannot see beat
phase). The next brief must name the sax and ask for length. Working draft, unshipped:*
```
D major, bright acoustic sailing instrumental, 112 BPM, saxophone and penny whistle over strummed guitar, walking upright bass, brushed kit with an easy swing, relaxed saxophone phrases answering the whistle, easy club-race feel
```
*4–6 min · exclude `vocals, wordless vocalise, sea shanty chorus, smooth jazz, lounge,
muted trumpet`. When a take ships, replace the recorded line above — this section
records what produced the track in the slot, nothing else.*

**Stillwater Lake** `lake` · Weirdness 20 · SI 85 · 4–6 min
```
G lydian, major with a sharp fourth — bright sunlit acoustic instrumental, 84 BPM, continuous flowing fingerpicked nylon guitar arpeggios that never stop, airy high flute above them, brushed upright bass, shimmering like sunlight on open water, gently drifting harmony
```
`vocals, wordless vocalise, dense percussion, sparse arrangement, long silences, ambient drone, dark, muffled`
*Take 1 was rejected as too sleepy — and was a faithful execution of a brief that asked
for `sparse`, `long rests between phrases` and "silence is the mechanic". **The brief
was the bug**: the venue's mechanic is the patient read, and patience got translated
into emptiness. A lake can be still and still be alive. The fix was brightness (3.7% →
16.2% above 2 kHz) and a filled-in third (0.29 → 0.68), not tempo.*

**Pearl Lagoon** `lagoon` · Weirdness 25
```
Bright island instrumental, 106 BPM, steel pan lead, offbeat guitar skank, shaker and hand percussion, sunlit major key, one urgent double-time squall section
```
`vocals, wordless vocalise, EDM synth`
*Keep the double-time section inside the loop. Its 39.4% wind band is second-worst in
the set and does not matter — the squalls are not built and it races at 13 kn.*

**Gatorgrass Bayou** `swamp` · Weirdness 25
```
Slow swamp instrumental, 72 BPM, Cajun accordion and resonator slide guitar, washboard and triangle, dorian blues, humid and dragging behind the beat
```
`vocals, wordless vocalise, bluegrass banjo`
*The one venue §4 does not constrain — 6.5 kn, the quietest bed and the widest headroom
in the game. Briefed dorian, shipped aeolian; accepted, because a strong A7 dominant is
more idiomatically Cajun than a modal sixth.*

**Sockeye Run** `river` · Weirdness 20
```
Driving old-time instrumental, 120 BPM, continuous banjo roll and fiddle, upright bass, bright major key, perpetual motion with no rest in the rhythm
```
`vocals, wordless vocalise, accordion`
*⚠️ Its 3.4 dB dynamics is a **pass** — the ostinato that never rests is the current.
The identical figure failed Bluewater three times. Cleanest seam in the project at
0.6 dB. Listen for a hook: 0.180 flux, and a fiddle tune has one by nature.*

**Bluewater Bonanza** `ocean` · Weirdness 25 · SI 85 · 4–6 min
```
D major orchestral sailing instrumental, 92 BPM, alternating sections: solo cello and acoustic guitar alone, then full orchestra with soaring violins, sixteenth-note string ostinato, timpani, long quiet passages between the big ones
```
`vocals, wordless vocalise, epic choir, rock drum kit, minor key, distant, muffled, lo-fi, constant intensity`
*Four takes, and the source of §3.2. Take 1 was too dark (4.2% above 2 kHz) and too
small; takes 2–3 fixed the spectrum and lost all dynamics by asking for level. **Take 4
asked for arrangement and got 8.6 dB with real 30 s swell sets.** It is also the only
take with spectral width rather than one extreme.*

**Redrock Reservoir** `redrock` · Weirdness 30
```
Dry desert instrumental, 96 BPM, baritone tremolo guitar with deep slapback echo, sparse floor toms, no cymbals, mixolydian, sun-bleached canyon space
```
`vocals, wordless vocalise, cymbals`
*Briefed heavy-wind; races at 12 kn, so the low-register rationale is a forecast.
Its loop points are the first from the length-aware pair search (§14).*

**Glowtide Strait** `glowtide` · Weirdness 35 · *the only electronic venue*
```
Nocturnal electronic instrumental, 104 BPM, glass marimba and soft analog synth arpeggio, deep sub bass, brushed rim, aeolian minor, gliding and weightless
```
`vocals, wordless vocalise, acoustic guitar`
*Widest dynamics in the game (13.5 dB) and it is real shape, not a ramp. ⚠️ It opens
6.4 dB down for ~25 s and `music_loop` did not flag it — dense but quiet. Costs nothing
only because its 238.5 s body outlasts the race. The build lands on the gun, since the
prestart is ~30 s; **adding a `loopStart` would delete that.***

**Glacier Sound** `arctic` · Weirdness 30
```
Cold sparse instrumental, 88 BPM, low horn drone and bowed double bass, open fifths with no third, restrained log drum, texture not melody, vast and still
```
`vocals, wordless vocalise, melodic lead`
*Low on purpose — the windiest venue, so the top of the spectrum belongs to the gust.
Chosen between two takes on third/fifth ratio: 0.31 against 0.62.*

**Clubhouse Point** `seatrials` · Weirdness 10 · SI 90 · 2 min
```
Bright C major club bed, instrumental, 100 BPM, soft woodblock pulse, warm upright bass, lightly brushed kit, no melody at all, unhurried and even, warm acoustic room
```
`vocals, wordless vocalise, melodic lead, minor key`
*It should be the least memorable track in the game. That is the brief, not a failure —
this is the eval anchor, and blandness is its identity. ⚠️ **Do not build the album
Persona from it** (§13).*

### 12.2 Menu and results

These two are unlike the race tracks in four ways, and the differences drive the briefs:

1. **The wind bed is silent here** (§4), so nothing constrains the spectrum. The menu
   track puts 23.8% in the wind band and it is irrelevant.
2. **A melody is allowed — but the licence is not equal.** The menu is heard by choice
   while browsing; results fires **after every race**, making it the most-repeated cue
   per second of attention in the game. **Menu: a melody you can hum. Results: a
   resolution you can sit through.** `big melodic hook` is excluded on results — the
   one place in this document where that would be wrong anywhere else.
3. **Opposite loop profiles.** The menu loops repeatedly within one sitting and wants
   length; results is heard for 20–40 s from its start, so **its opening is the cue**,
   and it is the only place a cadence belongs.
4. **The menu is the Persona source** (§13), so it must be the most characterful track
   in the set — and **must stay instrumental**, because a vocal in the Persona would
   bleed into venue tracks under the hard no-vocals rule. That is a technical reason,
   not a taste one.

**Menu — the Game's Song** · Weirdness 25 · SI 85 · 6 min
```
A major upbeat acoustic club-band instrumental, 116 BPM, warm clarinet lead playing a short catchy phrase that repeats and answers itself, call and response between clarinet and piano, piano comping, walking upright bass, brushed snare with a bounce, bright and lively, small close-miked room, playful and driving
```
`vocals, wordless vocalise, whistling, minor key, mandolin, banjo, fiddle, accordion, penny whistle, sea shanty, bluegrass, celtic folk, sustained strings, ambient pad, cinematic, slow, sparse, dark, muffled, EDM synth, epic trailer`

*Four takes, and both §3.2 and §3.3a came out of them. **It must not be folksy** — the
menu is the umbrella over an album spanning a Cajun bayou, an analog-synth nocturne, a
taiko volcano and an orchestral ocean, and a folk lead announces one dialect and
mislabels the rest. It also crowds Sockeye Run, the album's actual folk corner. **The
excludes name every folk instrument that is a venue's signature**, which is the only
reliable way to stop Suno reaching for the genre they imply. Shipped in A minor against
a brief asking for major — `minor key` does not work (§3.3c).*

**Results** · Weirdness 20 · SI 85 · 3 min
```
B flat major warm acoustic instrumental, 96 BPM, piano and acoustic guitar over upright bass and brushed kit, soft strings beneath, opening on a full warm chord that settles and resolves, easy forward motion, understated and companionable, evening after racing
```
`vocals, wordless vocalise, mandolin, banjo, fiddle, accordion, sea shanty, orchestral fanfare, triumphant brass, stadium drums, big melodic hook, dark, muffled, minor key`

*Four jobs that constrain each other: encouraging, conclusive, neutral enough for
eighth as well as first, and repeat-tolerant. **The resolution is warmth and a cadence,
never a statement** — anything written to be noticed is what you will be sick of by the
tenth race. **Generous, not triumphant**, is a product call: `targetCue()` returns
`'results'` whatever happened, so a fanfare after eighth is worse than a warm track
after a win.*

*The slot is filled by `harbor-glow`, which had been unassigned since Dec 2025 and won
on three numbers that are this brief exactly: 11.2 dB dynamics, F major, and an
unhurried 89 BPM. ⚠️ It opens 6.2 dB down for 7 s where the brief asked for a full
chord — accepted, because a short settle before the arrival is defensible on a
scoreboard in a way it never would be on a menu. `loopStart: 8.0` would make the
conclusion land immediately, at the cost of 8 s of body.*

**Optional — a victory variant.** The one genuine gap in the cue map. Needs
`targetCue()` returning `'results-win'` on a top-three finish plus one `MUSIC_TRACKS`
row; `resolveTrack` degrades cleanly if the file is absent. Weirdness 20 · 2 min
```
B flat major warm acoustic celebration instrumental, 104 BPM, mandolin and concertina trading the lead over strummed guitar, upright bass, brushed kit, bright and open, a win worth a handshake not a trophy
```
`vocals, wordless vocalise, orchestral fanfare, stadium drums, dark, muffled, minor key`
*Club racing, not a podium — the game's register is a Wednesday-night beer-can fleet.*

**Prestart — not needed.** The venue track covers the countdown. Kept only in case that
is revisited. Weirdness 25 · 40 s
```
Tense instrumental countdown bed, 88 BPM, ticking rim and shaker, low pulsing bass, rising string tremolo, building pressure that never resolves
```
`vocals, wordless vocalise, triumphant fanfare`

### 12.3 Unbuilt venues — tracks in hand, **not wired**

All four files are on disk and **deliberately absent from `MUSIC_TRACKS`** (§7). Add
the row the day the venue lands.

**Spoonbill Flats** `flats` · *the clock* · Weirdness 25 · SI 85 · 4–6 min
`'racing-flats': { file: 'assets/audio/flats.mp3', loopEnd: 139.5, trim: 0.92 }`
```
E minor hammered dulcimer instrumental, 76 BPM, bright ringing dulcimer figures that fall and restart continuously, low bass clarinet beneath, brushed frame drum, wide open estuary with a quiet unease
```
`vocals, wordless vocalise, dark, muffled, ambient drone, long silences, sparse arrangement`
*⚠️ Listening check: 11.8% of frames sit more than 6 dB under the median — most of any
candidate. Probably the dulcimer's decay envelope rather than arrangement gaps, but
this is the venue whose brief excluded `long silences`. Does it breathe, or does it stop?*

**Flamingo Reach** `wetland` · *where can I possibly pass?* · Weirdness 25 · SI 85 · 4–6 min
`'racing-wetland': { file: 'assets/audio/wetland.mp3', loopEnd: 241.0, trim: 0.99 }`
```
E major humid instrumental, 108 BPM, muted trumpet lead over vibraphone, upright bass and brushed rim, a circling groove that never quite resolves, one sudden bright flurry where the whole band lifts at once
```
`vocals, wordless vocalise, steel pan, accordion, dark, muffled`
*Best-behaved file in the project: 241.0 s of body from a 241.0 s file, nothing
discarded. The flurry is measurable — a −4.1 dB drop at 151 s, then a sustained lift.
⚠️ If this is ever regenerated, add `saxophone` to the excludes: Lighthouse Cove now
claims the sax (§10), and these two are the album's jazz-adjacent corners — the fence
runs both ways, and Lighthouse's draft already excludes `muted trumpet`.*

**Fallwater Fjord** `fjord` · *take the downdraft or sail around it?* · Weirdness 30 · SI 85 · 4–6 min
`'racing-fjord': { file: 'assets/audio/fjord.mp3', loopStart: 14.0, loopEnd: 147.5, trim: 0.65 }`
```
A minor nordic folk instrumental, 124 BPM, nyckelharpa lead with ringing sympathetic drone strings, driving frame drum, low strings, green summer fjord, urgent and mythic
```
`vocals, wordless vocalise, chanting, throat singing, choir, viking metal, distorted guitar, dark, muffled, icy`
*Cleanest key reading anywhere — A minor at r=0.92, tonic and mode both hit. ⚠️ **Norse
is the strongest vocal trigger in the set**, so chanting/throat singing/choir are
excluded by name; and the venues doc requires a **summer** fjord to vacate Glacier
Sound's palette, hence `icy`. ⚠️ Its 3.98 dB seam is the worst in the project and the
tool will not fix it — see §14.*

**Emberfall Isle** `volcanic` · *the gauntlet* · Weirdness 35 · SI 85 · 4–6 min
`'racing-volcanic': { file: 'assets/audio/volcanic.mp3', loopStart: 14.5, loopEnd: 239.5, trim: 0.87 }`
```
C minor percussive instrumental, 132 BPM, struck metal — anvil, brake drums and tuned bells — over deep taiko drums, low prepared piano ostinato, alien and dangerous, hard edged and bright
```
`vocals, wordless vocalise, epic choir, trailer braams, orchestral strings, dark, muffled`
*The only percussion-led venue. ⚠️ 44.6% wind band, worst of any live track — struck
metal lives exactly in the bed's band, a risk this brief created by asking for metal
**and** brightness. `_probe_audio.js volcanic` is mandatory before accepting; if the
venue turns out breezy, let the taiko carry more and the bells less. ⚠️ Its key reading
is unmeasurable (§14).*

### 12.4 Tutorial — Duckling Pond `pond` — proposed, **Intent** · *venue specced, not built*

The learn-to-sail tutorial has a venue: **Duckling Pond** ([venues.md](venues.md) §15),
a small club pond, mode-gated behind Sailing School. It is unbuilt, so per §7 there
must be **no `MUSIC_TRACKS` row** until it lands — this section records the brief and
the reasoning so the track can be generated and judged ahead of need.

**What the cue is.** The player is *reading and doing* — instructional text on screen,
one manoeuvre at a time, at their own pace. That makes the tutorial kin to Clubhouse
Point, not to the menu: the music is a bed under sustained attention, and anything
written to be noticed is competing with the lesson. But it is not Clubhouse Point's
slot. The eval anchor is *forgettable on purpose*; the tutorial should be **patient and
encouraging** — a first sail with a friendly instructor, not a metronome. The
difference is warmth, not melody.

**Constraints that fall out of the design:**

1. **On the water at ~7 kn steady, so §4 barely constrains it.** The pond sits in the
   light band with `swamp` and `lake`, where the bed nearly vanishes — the whole
   spectrum is available, which is exactly right for music under instruction text.
   Give it a top anyway (§4's murk warning), and re-measure headroom if the venue's
   wind changes.
2. **Unbounded session length.** A tutorial has no 213 s clock; a slow reader may sit
   on one step for minutes. The seam will be heard **more often than any race track's**,
   so this cue values a clean seam the way the menu does — ask for 4–6 min, but per §5
   take the cleaner seam over the longer body if they conflict.
3. **Starts at full density, gently** (§5). The cue fires when the tutorial opens, and
   `loopStart` will delete any build-in. "Gentle" must be an *arrangement* that is
   already complete at bar one, not a track that assembles itself.
4. **No hook, stricter than anywhere else.** A phrase you can hum after ten minutes of
   tacking practice is a phrase you resent. But `melodic lead` excluded outright gave
   Clubhouse Point its blandness — here the mechanism is **short phrases that always
   resolve**: nothing left hanging, nothing to wait for, nothing to remember.
5. **Instrumental, obviously** — the one cue where a lyric would collide with literal
   on-screen text, not just tactical thinking.

**Registry note.** The claim is recorded in §10: **felt piano as lead** — soft attack,
close, unhurried, the right voice for a classroom — over the house core (upright bass,
brushed kit), which claims no territory. Nylon guitar is Stillwater's claim; keep it
out. Slow-band neighbours are Spoonbill Flats at 76 and Glacier Sound/Stillwater at 83
— at 88 with a piano lead nothing collides.

**Duckling Pond** `pond` · Weirdness 15 · SI 85 · 4–6 min
```
C major calm acoustic instrumental, 88 BPM, soft felt piano playing short two-bar phrases that always resolve, warm upright bass, lightly brushed kit, steady and even from the first bar, small warm room, patient and reassuring
```
`vocals, wordless vocalise, whistling, melodic hook, strings, cinematic, epic, dark, muffled, sparse arrangement, long silences, ambient drone, build-up`

*Judging notes, ahead of a take: expect flux in the 0.10–0.14 band — below Stillwater,
above nothing-happening; a reading over ~0.15 means it is too interesting for the job.
Dynamics should be modest and **aperiodic** — this brief is Sockeye Run's kind of flat
(steadiness is the point), not Bluewater's kind of failure. Check the §5 density trap by
hand: "soft felt piano" is precisely the *dense but quiet* opening `loopStart` cannot
see. And play it straight after `seatrials` — they are neighbours in function and must
read as siblings, not as the same track twice.*

**Wiring, when the venue lands:** because the tutorial *is* a venue, no `targetCue()`
change is needed — prestart and racing resolve to `racing-pond` through the standard
mechanism, exactly like every other venue. One `MUSIC_TRACKS` row from
`music_loop.py` (§7 — never hand-edited), file at `assets/audio/pond.mp3`, then
`_probe_audio.js pond` to confirm headroom against the live bed — expect it near the
top of the §11 ladder, beside `swamp`.

## 13. Making it one album — **Intent**

The registry keeps venues distinct; something has to keep them related.

1. **Build a Persona from a track you already own.** A Persona saves a song's sonic
   essence — ensemble, production, room — and reuses it. **Use the current
   `yacht-club.mp3`**: four takes existed precisely to make it the most characterful
   track in the set, and at 0.200 chroma flux it is second only to Lighthouse Cove.
   ⚠️ **Not** Clubhouse Point (a Persona from a deliberately characterless bed gives a
   characterless album) and **not** `yacht-club-2025.mp3` (4.1 dB dynamics at a mean of
   −19.0 dB — the flattest and quietest file in the project).
2. **A motif.** One six-to-eight note figure from the menu track hiding inside every
   venue track — different instrument, different tempo, sometimes only in the bass.
   This is what makes Wind Waker cohere. Suno cannot reuse a motif from text alone, but
   **Cover preserves melody and structure**, so the route is one motif seed put through
   Cover per venue. Untested — try two venues before committing.

⚠️ **Cover is the right tool only when you want the structure too.** It was wrong for
Bluewater, where the form was the thing being changed. It is right for a results
variant that reprises the menu theme, and right for motif work.

## 14. The tools — **Observed**

| tool | question it answers |
|---|---|
| `art/music_loop.py <file>` | where does this loop, and what row do I paste? |
| `art/music_spec.py "<file>:<start>:<end>"` | should we ship it? (§6) |
| `eval/_probe_audio.js <venue>` | does it make real sound in the game, and how much headroom? |
| `npm run test:audio` | does the whole cue map still resolve and sound? |

**`music_loop.py`.** `loopEnd` is where the music stops and the fade begins; `loopStart`
is where the texture becomes dense enough to loop back *into*. When no early point
matches the ending it searches start/end **pairs** and trims the tail too.

- ⚠️ Among pairs whose seam is within 0.5 dB of the tightest it takes the **longest
  body**, guarded so it only fires when the gain is ≥1.15×. Without that, Redrock got
  an 87.5 s body to win 0.03 dB where 148.5 s was available. **The guard matters** —
  an earlier version regressed Lighthouse Cove for 3.5 s of body.
- ⚠️ **`FLOOR_TOL` (4.0 dB) is a loose gate.** Fallwater Fjord's 3.98 dB one-sided seam
  sits just under it, so the pair search never runs even though a 0.26 dB pair exists at
  a longer body. Tightening it re-measures every shipped track; **do not** "fix" this by
  running the search unconditionally (perturbs 18 of 20 assets) or by adding a
  body-retention guard (hands yacht-club back its 7.9 dB seam). Both were tried.

**`music_spec.py`.** Weighted by **magnitude, not power** — power weighting buries
everything under the bass and reports Glacier Sound at 0.2% where the number on record
is 5.4%. Nothing measured that way is comparable.

- ⚠️ **Tempo** is a peak family plus a resolved pulse, because the strongest peak is
  usually the fastest thing moving, not the beat. The pulse is the family member
  explaining the most of the family through **octave relations only** — admitting 3/2
  lets an artifact win. **Resolution is coarse and worsens with tempo**: adjacent bins
  near 100 BPM are 99.4 and 103.4, so a reported 99 cannot be told from 103. Trust it
  at slow tempos; treat anything near 100 as ±4.
- ⚠️ **The key estimate needs harmonic content.** On a percussion-led track struck metal
  and drums smear energy across all twelve pitch classes, the chroma comes back nearly
  uniform, and the mode reading is noise however confident `r` looks. **Check the chroma
  profile is peaked before believing it.** Two readings within ~0.02 of each other mean
  the third is *ambiguous*, not that the track is minor.

**`_probe_audio.js`.** ⚠️ It **seeks to the middle of the loop body** before measuring
and reports `sampledAt` alongside `enteredAt`. It used to sample wherever playback
happened to be, 3–6 s in, which only measures steady state for a track that opens at
full level — it reported 3.4 dB of headroom for a track that has 17. Four of six
recorded headroom numbers moved when this was fixed.

**`test_audio.js`** serves the tree over http on an ephemeral port and taps
`Sound.musicBus` with an AnalyserNode. ⚠️ It is **the only assertion in the suite that
measures sound rather than state** — every state-based check passed while the score was
silent over `file://`. ⚠️ Its server implements HTTP **Range**, which is required: without
it `el.seekable` is empty and `currentTime = loopStart` is silently ignored, so every
track looks like it starts at 0.
