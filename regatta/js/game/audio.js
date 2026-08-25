// regatta/js/game/audio.js — music tracks and the Sound engine. AUDIO MUST
// NEVER DRAW FROM Math.random() (it is the seeded sim stream — see the noise
// buffer incident documented on Sound.fillNoise). Classic script; global scope.
// Extracted verbatim from script.js (refactor 2026-08-24).
const MUSIC_TRACKS = {
    // The Game's Song, and the fourth attempt at it. This is the track the player hears
    // first and the one guidelines/music.md §13 wants every venue bred from, so it is the only cue briefed
    // for a HOOK — the ten venue tracks are texture and this is the tune they belong to.
    //   chroma flux 0.200 is what "catchy" measures, and it is the best of the menu
    //   line (0.109 -> 0.152 -> 0.200), just under lighthouse-cove's 0.209. It got
    //   there by asking for a MECHANISM, not an adjective: "a short phrase that repeats
    //   and answers itself" and "call and response", where "memorable piano melody"
    //   had produced the least melodic track in the project.
    //   ⚠️ Its 127.5 s body is short for the one cue that loops inside a sitting, and
    //   that is fine: the seam measures 0.2 dB. A seam nobody can hear heard often
    //   beats an audible one heard rarely — take 2 had 361 s of body and a 2.1 dB seam.
    //   ⚠️ A minor against a brief that asked for major twice. `minor key` in the
    //   excludes does not work (three data points); the TONIC holds when named, the
    //   third drifts. Accepted — a minor theme can be plenty warm.
    //   The Dec 2025 original is retired to yacht-club-2025.mp3, unassigned.
    menu:         { file: 'assets/audio/yacht-club.mp3',         loopEnd: 127.5, trim: 0.85 },
    racing:       { file: 'assets/audio/spinnaker-run.mp3',      loopEnd: 264.5, trim: 0.96 },
    // Results, and the most-repeated cue in the game: it fires after EVERY race, so
    // familiarity fatigue beats loop fatigue as the risk. harbor-glow wins the slot on
    // three numbers that are exactly this brief — 11.2 dB dynamics (harbor-results has
    // 6.3, and this cue needs to feel alive), F major r=0.88 (harbor-results is A
    // MINOR, which reads "you lost" whatever you actually finished), and an unhurried
    // 89 BPM. 120.0 s of body from a 120.3 s file, so nothing is discarded.
    //   ⚠️ It is generous rather than triumphant on purpose: `targetCue()` returns
    //   'results' whatever happened, so this same track plays for a win and for eighth.
    //   A fanfare after eighth is worse than a warm track after a win.
    //   harbor-results.mp3 is retired to unassigned, not deleted.
    results:      { file: 'assets/audio/harbor-glow.mp3',        loopEnd: 120.0, trim: 1.02 },
    'racing-seatrials': { file: 'assets/audio/seatrials.mp3',    loopStart: 20.5, loopEnd: 119.5, trim: 0.84 },
    'racing-arctic':    { file: 'assets/audio/arctic.mp3',       loopStart: 15.0, loopEnd: 137.5, trim: 0.78 },
    // Pearl Lagoon is the best-behaved file in the set: no intro and no outro, so
    // 118.5 s of its 119.0 s is loop body and nothing is discarded, and C major reads
    // at r=0.91 against a brief that asked for a sunlit major — the cleanest key in
    // the project.
    //   Its 39.4% in the wind band is second-worst here, and music.md §4 says put a WINDY
    //   venue's identity low. Measured rather than assumed: this venue races at 13 kn,
    //   the same as Lighthouse Cove, so the bed sits 12.1 dB under the music's RMS
    //   (bay 13.4, arctic 6.4 — arctic is the tight one). The conflict §4 warns about
    //   is not present today because THE SQUALLS ARE NOT BUILT YET. When the identity
    //   pass lands them, re-measure this venue before trusting the steel pan: a squall
    //   is exactly the event that takes the band this track lives in.

    'racing-lagoon':    { file: 'assets/audio/pearl-lagoon.mp3', loopEnd: 118.5, trim: 0.87 },
    // Per-venue race tracks override `racing` by key. Lighthouse Cove was held by
    // breezy-race, which is now unassigned: breezy-race puts 47.7% of its energy in
    // the 900 Hz-6.5 kHz band the wind bed was highpassed into, the worst in the set,
    // so the property that once justified it (brightest track here, 2795 Hz centroid)
    // is exactly what music.md §4's inversion turned into a liability. Its successor
    // (retired to lighthouse-cove-take1.mp3) proved a seam can measure 0.0 dB and
    // still jar: its 94.0 s body landed ~half a beat off the bar grid, a defect a
    // LEVEL match cannot see. The Aug 2026 take fixes both exposures at once —
    // 170.6 s of body from a 172.5 s file, so the seam plays about once a race, at a
    // steady 108 BPM with no tempo drift, and 21.0% in the wind band (take1: 29.3%).
    //   ⚠️ loopEnd is 170.6, not music_loop.py's 171.0: hand-snapped to the beat
    //   grid by onset-envelope phase (~2 ms error, chroma r=0.96 across the seam) —
    //   the one row where the "never hand-edit" rule yields, because the tool
    //   measures level and the previous take's jar was beat phase. The trade is a
    //   ~1.5 dB level step at the seam, blurred by the 0.6 s crossfade.
    'racing-bay': { file: 'assets/audio/lighthouse-cove.mp3',    loopEnd: 170.6, trim: 0.82 },
    // Bluewater Bonanza, take 4 — ACCEPTED, and the take that proved the method.
    // Three earlier takes are unassigned beside it (`ocean-take1..3.mp3`).
    //   The venue's brief is contrast, and three takes failed to deliver it because
    //   the prompt kept ASKING FOR LEVEL, which Suno does not control: dynamics went
    //   11.4 -> 5.5 -> 3.8 dB as the demand got more explicit. Take 4 asked for
    //   ARRANGEMENT instead ("alternating sections: solo cello and guitar alone, then
    //   full orchestra") and dropped the words epic/huge/vast/heroic, which mean
    //   "loud and continuous" to the model. Result: 8.6 dB, and real swell SETS —
    //   a 30 s period at r=0.20 where take 3 had no periodicity at all.
    //   It is also the only take with spectral WIDTH rather than one extreme:
    //   22.6% above 2 kHz and a 1240 Hz centroid sit between take 1's murk (4.2%,
    //   445 Hz) and take 3's glare (42.9%, 2394 Hz). The wind band came back down to
    //   29.6% with it, level with the lighthouse-cove of the day (29.3%; the Aug
    //   2026 lighthouse take reads 21.0%).
    //   ⚠️ Its 3.8 dB seam is the one defect, and 222.5 s of body against ~243 s of
    //   prestart+race means it IS heard, once, about 20 s before the finish. Accepted
    //   because the alternative takes trade a rarer seam for no dynamics at all.
    'racing-ocean': { file: 'assets/audio/ocean.mp3',            loopStart: 2.0, loopEnd: 224.5, trim: 0.77 },
    // Gatorgrass Bayou, and the one venue where music.md §4 imposes nothing: it races at
    // 6.5 kn, the lightest in the game, so the wind bed is all but absent and the
    // whole spectrum is free. Its 18.8% wind band is therefore not a number to
    // defend — the bed sits at -44.6 dB here, the quietest anywhere, and headroom
    // measures 18.4 dB, the widest in the project (glowtide 17.0, arctic 10.2).
    //   Two dynamics numbers that disagree, both wanted: music_spec reports 9.4 dB
    //   (half-second frames — washboard and accordion transients, i.e. NOT squashed)
    //   while the long-term bucket swing is 4.0 dB (it breathes without ramping).
    //   Bluewater take 2 is the contrast: flat on both, 5.5 and 2.7.
    //   ⚠️ Briefed dorian, came back aeolian — B flat outweighs B natural 2:1, and
    //   dorian's whole identity is that raised sixth. Accepted: the venue is carried
    //   by the accordion and the drag, and a strong A7 dominant (C# at 7.6%) is more
    //   Cajun than a modal sixth would have been. See guidelines/music.md §10.
    'racing-swamp': { file: 'assets/audio/swamp.mp3',            loopEnd: 172.5, trim: 0.79 },
    // Glowtide Strait. Widest dynamics in the project (13.5 dB) and it is real shape,
    // not a ramp — peak at 141 s, a genuine trough at 200-226 s.
    //   ⚠️ It opens 6.4 dB down and takes ~25 s to arrive, and `music_loop.py` did NOT
    //   set a loopStart for it, because loopStart tests DENSITY and this opening is
    //   dense but QUIET — a full arpeggio at low level. That is why the seam measures
    //   3.8 dB, the worst here. It costs nothing at this venue and only here: 238.5 s
    //   of body against ~245 s of prestart+race means the seam is reached once, at the
    //   very end. On a shorter track the same gap would thump every loop.
    //   The happy accident worth protecting: the ~25 s build lands almost exactly on
    //   the gun, because the prestart is ~30 s. Adding a loopStart would DELETE that.
    'racing-glowtide': { file: 'assets/audio/glowtide.mp3',      loopEnd: 238.5, trim: 0.76 },
    // Sockeye Run. ⚠️ Its 3.4 dB dynamics would be a failure at Bluewater and are a PASS
    // here — this venue's brief is "perpetual motion with no rest in the rhythm", and
    // the ostinato that never rests IS the current. Same number, opposite verdict:
    // a dynamics figure only means something against the brief.
    //   Cleanest seam in the project at 0.6 dB. Tempo reads 136 against a briefed 120
    //   and that gap is real, not measurement noise (bins here are 123/129/136) — it
    //   collides with no other venue and makes the fastest venue faster still, which
    //   serves the difficulty ladder rather than fighting it.
    //   ⚠️ The weak third (F# 4.9% under F 6.3%, third/fifth 0.30) is the fiddle
    //   droning on open strings, not a missed key: tonic D is unambiguous and D-G-A
    //   carry 44% of the chroma. Same category as lighthouse-cove-take1's ambiguous
    //   third, not Glowtide. (The Aug 2026 lighthouse take reads a clean D major.)
    //   ⚠️ 479 s of body against a ~245 s race means half of it never plays, in a
    //   12.4 MB file. Same overshoot as Bluewater take 3; ~4 min is the target.
    'racing-river': { file: 'assets/audio/river.mp3',            loopEnd: 479.0, trim: 0.80 },
    // Redrock Reservoir. ⚠️ Its loop points are the FIRST to come from music_loop's
    // length-aware pair search, added because this track exposed the gap: the old
    // seam-only objective picked an 87.5 s body — shortest in the project, seam heard
    // ~2.8x a race — to win 0.03 dB over a 148.5 s alternative. See art/music_loop.py.
    //   ⚠️ Briefed mixolydian, came back plain F major: E outweighs Eb 8.5% to 3.6%
    //   and the flat seventh IS mixolydian. Third exotic-mode miss out of three
    //   (dorian, aeolian, mixolydian all flattened). Accepted — the venue is carried
    //   by the baritone guitar and the slapback, not by a mode nobody names aloud.
    //   ⚠️ It shares F major with Glowtide, the closest key collision in the set;
    //   glass marimba against baritone tremolo guitar is what still separates them.
    //   Pulse 96 is exactly the brief. Bluewater also reads 96 against a briefed 92,
    //   but that is one autocorrelation bin, so the two are probably not colliding.
    'racing-redrock': { file: 'assets/audio/redrock.mp3',        loopStart: 13.0, loopEnd: 161.5, trim: 0.85 },
    // Stillwater Lake, take 2 — the last venue, and the one where the BRIEF was the
    // bug. Take 1 (`lake-take1.mp3`, unassigned) asked for "sparse", "long rests
    // between phrases" and "silence is the mechanic", got exactly that, and was too
    // sleepy to use. The venue's mechanic is the patient read; the old brief had
    // translated patience into emptiness. A lake can be still and still be alive.
    //   Take 2 fixed it by asking for BRIGHTNESS and MOTION: 3.7% -> 16.2% above
    //   2 kHz, centroid 415 -> 1313 Hz, and the hollow third filled in (third/fifth
    //   0.29 -> 0.68) — which is what turns vague into lovely. Body 77 -> 240.5 s, so
    //   a ~243 s race essentially never reaches the seam.
    //   ⚠️ Its level is steady (3.8 dB over 2 s frames) and that is correct here: the
    //   movement is HARMONIC, not dynamic — chroma flux 0.166, the highest of any
    //   accepted track bar Clubhouse Point and Sockeye Run. Light on water shifts
    //   without getting louder. Do not read the flat level as the Bluewater failure.
    //   ⚠️ Briefed LYDIAN, came back plain G major: C natural still beats C# 12.8% to
    //   5.2%, and the sharp fourth IS lydian. This take carried the mitigation that
    //   had been proposed and never tested — mode first, named as a scale degree —
    //   and it made no difference. Five exotic modes briefed, five flattened.
    'racing-lake': { file: 'assets/audio/lake.mp3',              loopEnd: 240.5, trim: 0.98 },
    // Duckling Pond — ingested ahead of the venue itself, so this cue is INERT until a
    // venue registers under the `duckling` key; targetCue only builds keys from venues
    // that exist. Numbers from music_loop/music_spec, per the header rule:
    //   The 0.0 dB seam is the headline. Its 89.5 s body is the new shortest in the
    //   project (lighthouse-cove's retired take1 held it at 94.0), which is the same trade that entry
    //   documents — a seam nobody can hear, heard often, beats an audible one heard
    //   rarely. 24 s of finale plus a 4.2 s fade are discarded past loopEnd: the ending
    //   is denser than anything it could return to, which is what an ending is.
    //   8.0% in the 900 Hz–6.5 kHz wind band is the LOWEST of any accepted track
    //   (swamp held it at 18.8) — music.md §4 wants a venue's identity out of the
    //   bed's band, and a pond for beginners should leave the most room of anywhere.
    //   C major r=0.86, ~66 BPM pulse, centroid 797 Hz, 12.2 dB dynamics: warm, slow,
    //   and alive without being loud — ducklings at sunset, as briefed.
    'racing-duckling': { file: 'assets/audio/duckling-pond.mp3', loopStart: 1.5, loopEnd: 91.0, trim: 0.87 },
};

const MUSIC_VOLUME = 0.3;       // master, before per-track trim
const MUSIC_XFADE_CUE = 1.6;    // seconds, between cues (menu → prestart → racing)
const MUSIC_XFADE_SEAM = 0.6;   // seconds, across a loop point

// ── WIND BED ────────────────────────────────────────────────────────────────
// Steady state is ~8 dB below the old bed; a gust transient can open 7 dB on top
// of that, so the range is carried by EVENTS rather than by a constant hiss. Peak
// on a hard gust still lands slightly under where the old bed sat all the time.
//   ⚠️ This only breathes once venues author gust regions. Until then the wind
//   field is steady, apparent wind moves only with the boat, and the bed is
//   near-constant by construction — quiet, but not yet doing its job.
const WIND_SOUND = {
    // ── LEVEL. One knob, deliberately separated from the shape below. ───────────
    // Turn the bed up or down HERE and the balance between calm, breeze and gust is
    // untouched. Sitting at -6: the first pass shipped at 0 and still drew attention
    // to itself, which is what a continuous broadband sound does — and it does it
    // most of all because `musicEnabled` defaults to false, so for most players this
    // is the ONLY sustained sound in the game and has nothing to sit underneath.
    masterDb: -6,

    // ── SHAPE. How the bed moves; not how loud it is. ──────────────────────────
    minKn: 4, maxKn: 30,            // apparent wind, knots
    quietDb: -40, loudDb: -25,      // steady-state bed across that range
    gustDb: 7,                      // headroom a gust transient may open
    rushLoHz: 900,                  // rush starts above the music's low-mid
    rushHiMin: 1600, rushHiMax: 6500,
    rumbleHz: 180, rumbleMix: 0.35,
    // Rate of rise that fully opens the transient. Tuned to separate WEATHER from
    // STEERING: heading up or bearing away moves apparent wind about 1–2 kn/s and
    // should only nudge it, while a gust front crossing the boat moves it several
    // knots in a second and should open it all the way.
    gustRise: 4.0,                  // kn/s
    gustDecay: 1.5                  // seconds
};

// Sound System
const Sound = {
    // ⚠️ AUDIO MUST NEVER DRAW FROM Math.random().
    //
    // The two noise buffers below are `sampleRate * 2` samples each — about 96,000 draws
    // apiece, which was 57% of every number the simulation pulled in a whole race. Worse,
    // `initWindSound` fills its buffer ONCE PER PAGE, so the first race consumed ~96,000
    // more draws than every race after it and diverged from them completely. Golden traces
    // caught it as "arctic is non-deterministic"; it was never arctic, and never the ice.
    //
    // White noise from a fixed seed is indistinguishable by ear from white noise off the
    // global RNG, so the audio keeps its own stream and the simulation keeps its own.
    // This is the same rule the visual particles already follow.
    _noiseSeed: 0x2f6e2b1,
    fillNoise: function (data) {
        let x = this._noiseSeed;
        for (let i = 0; i < data.length; i++) {
            // xorshift32 — cheap, no allocation, and stable across engines.
            x ^= x << 13; x >>>= 0;
            x ^= x >>> 17;
            x ^= x << 5;  x >>>= 0;
            data[i] = (x / 0x80000000) - 1;
        }
    },

    ctx: null,
    musicBus: null,
    musicVoices: {},    // track -> up to two voices, so a loop seam can crossfade
    activeVoice: null,
    activeTrack: null,
    musicTick: null,

    init: function() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        this.updateMusic();
    },

    // Which cue the game is currently in. Results wins over race status because the
    // overlay is up while the status is still 'finished'.
    targetCue: function() {
        if (UI.resultsOverlay && !UI.resultsOverlay.classList.contains('hidden')) return 'results';
        // The venue's track starts at the PRESTART and runs straight through the gun. It
        // resolves to the same cue either side, so nothing re-triggers at the start: the
        // music is already going when the race begins, rather than announcing it. That
        // also means the whole time you are on the water is scored by one continuous
        // piece — the countdown is part of the race, not a lobby for it.
        if (state.race.status === 'prestart' || state.race.status === 'racing') return 'racing';
        // Everything before the gun — venue picker, briefing, competitor list — is menu.
        if (UI.preRaceOverlay && !UI.preRaceOverlay.classList.contains('hidden')) return 'menu';
        return null;
    },

    // A venue may own its race track; absent an entry it races to the house track.
    resolveTrack: function(cue) {
        if (cue === 'racing') {
            const key = 'racing-' + (state.race.venue || settings.venue);
            if (MUSIC_TRACKS[key]) return key;
        }
        return cue;
    },

    musicOut: function() {
        if (!this.musicBus && this.ctx) {
            this.musicBus = this.ctx.createGain();
            this.musicBus.gain.value = MUSIC_VOLUME;
            this.musicBus.connect(this.ctx.destination);
        }
        return this.musicBus;
    },

    makeVoice: function(track) {
        const def = MUSIC_TRACKS[track];
        if (!def) return null;
        const el = new Audio(def.file);
        el.preload = 'auto';
        el.loop = false;    // the seam is driven by tickMusic, not by the element
        const voice = { el, track, gain: null, jsRamp: null, stopTimer: null, seamed: false };
        // ⚠️ NEVER route through Web Audio on file://. A media element loaded from the
        // filesystem is treated as cross-origin, so createMediaElementSource yields a node
        // that outputs SILENCE — while the element still plays, currentTime still advances
        // and the gain still reads whatever you set. Nothing throws and nothing logs. The
        // eval harness runs on file:// as well, so every assertion passed while the game
        // was silent on a developer's machine; only tapping the bus with an analyser found
        // it. Same-origin http(s) — which is how this ships — routes normally.
        if (this.ctx && location.protocol !== 'file:') {
            try {
                const src = this.ctx.createMediaElementSource(el);
                voice.gain = this.ctx.createGain();
                voice.gain.gain.value = 0;
                src.connect(voice.gain);
                voice.gain.connect(this.musicOut());
            } catch (e) {
                voice.gain = null;  // fall back to the element's own volume
            }
        }
        if (!voice.gain) el.volume = 0;
        return voice;
    },

    // Equal power: two voices crossfading on cos/sin quarter-turns sum to constant
    // power. The old player ramped both ends LINEARLY, which sums to a ~3 dB dip in
    // the middle of every transition — audible as a sag on each cue change.
    powerCurve: function(from, to, n) {
        const a = new Float32Array(n);
        const rising = to >= from;
        for (let i = 0; i < n; i++) {
            const w = (rising ? Math.sin : Math.cos)((i / (n - 1)) * Math.PI / 2);
            a[i] = rising ? from + (to - from) * w : to + (from - to) * w;
        }
        return a;
    },

    // Master volume lives on the bus — and the fallback path has no bus, so there it has
    // to be folded into the element's own volume or file:// would play at full level.
    // (0.3 x the largest trim is 0.39, comfortably inside the element's 0..1 range.)
    voiceTarget: function(voice) {
        const def = MUSIC_TRACKS[voice.track] || {};
        const trim = def.trim == null ? 1 : def.trim;
        return voice.gain ? trim : trim * MUSIC_VOLUME;
    },

    rampVoice: function(voice, target, duration) {
        if (!voice) return;
        if (voice.gain && this.ctx) {
            const g = voice.gain.gain;
            const now = this.ctx.currentTime;
            try {
                const from = g.value;
                if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(now);
                else g.cancelScheduledValues(now);
                g.setValueAtTime(from, now);
                if (duration > 0) g.setValueCurveAtTime(this.powerCurve(from, target, 48), now, duration);
                else g.setValueAtTime(target, now);
            } catch (e) {
                g.setTargetAtTime(target, now, Math.max(0.01, duration / 3));
            }
            return;
        }
        // No Web Audio routing available — ramp the element's volume from tickMusic.
        voice.jsRamp = duration > 0
            ? { from: voice.el.volume, to: target, start: performance.now(), ms: duration * 1000 }
            : null;
        if (!voice.jsRamp) voice.el.volume = Math.max(0, Math.min(1, target));
    },

    stopVoice: function(voice, duration) {
        if (!voice) return;
        this.rampVoice(voice, 0, duration);
        clearTimeout(voice.stopTimer);
        voice.stopTimer = setTimeout(() => {
            try { voice.el.pause(); } catch (e) {}
        }, Math.max(0, duration * 1000) + 80);
    },

    // Start `track` at `from` seconds, crossfading whatever is playing out over the
    // same window. Each track keeps at most two voices so a loop seam can overlap
    // itself; the second one is only built when a seam actually needs it.
    playTrack: function(track, from, xfade) {
        const def = MUSIC_TRACKS[track];
        if (!def) return null;
        const pool = this.musicVoices[track] || (this.musicVoices[track] = []);
        let voice = pool.find(v => v !== this.activeVoice);
        if (!voice && pool.length < 2) {
            voice = this.makeVoice(track);
            if (voice) pool.push(voice);
        }
        if (!voice) voice = pool[0];
        if (!voice) return null;

        clearTimeout(voice.stopTimer);
        voice.seamed = false;
        // Seeking at readyState 0 is fine — the browser queues it until metadata arrives.
        // (Verified: a fresh element seeks to 15 s and lands there. What a seek DOES need
        // is an origin serving HTTP Range; without it `seekable` is empty and loopStart is
        // silently ignored. Real hosts do, and so must eval/test_audio.js's server.)
        try { voice.el.currentTime = from || 0; } catch (e) {}
        this.rampVoice(voice, 0, 0);
        const played = voice.el.play();
        // Autoplay policy can reject before the first gesture. updateMusic retries
        // on the next call, which init() makes from every gesture path.
        if (played && played.catch) played.catch(() => {});
        this.rampVoice(voice, this.voiceTarget(voice), xfade);

        const previous = this.activeVoice;
        this.activeVoice = voice;
        this.activeTrack = track;
        if (previous && previous !== voice) this.stopVoice(previous, xfade);
        this.startTick();
        return voice;
    },

    startTick: function() {
        if (this.musicTick) return;
        this.musicTick = setInterval(() => this.tickMusic(), 120);
    },

    tickMusic: function() {
        // Drive any fallback volume ramps (only live when Web Audio routing failed).
        Object.keys(this.musicVoices).forEach(track => {
            this.musicVoices[track].forEach(v => {
                if (!v.jsRamp) return;
                const t = Math.min(1, (performance.now() - v.jsRamp.start) / v.jsRamp.ms);
                const rising = v.jsRamp.to >= v.jsRamp.from;
                const w = (rising ? Math.sin : Math.cos)(t * Math.PI / 2);
                const val = rising
                    ? v.jsRamp.from + (v.jsRamp.to - v.jsRamp.from) * w
                    : v.jsRamp.to + (v.jsRamp.from - v.jsRamp.to) * w;
                v.el.volume = Math.max(0, Math.min(1, val));
                if (t >= 1) v.jsRamp = null;
            });
        });

        const voice = this.activeVoice;
        if (!voice || voice.el.paused || voice.seamed) return;
        const def = MUSIC_TRACKS[voice.track];
        const duration = isFinite(voice.el.duration) ? voice.el.duration : 0;
        const end = Math.min(def.loopEnd != null ? def.loopEnd : Infinity, duration || Infinity);
        if (!isFinite(end) || end <= MUSIC_XFADE_SEAM) return;
        if (voice.el.currentTime >= end - MUSIC_XFADE_SEAM) {
            voice.seamed = true;
            this.playTrack(voice.track, def.loopStart || 0, MUSIC_XFADE_SEAM);
        }
    },

    stopMusic: function(fade) {
        const duration = fade == null ? 0 : fade;
        Object.keys(this.musicVoices).forEach(track => {
            this.musicVoices[track].forEach(v => this.stopVoice(v, duration));
        });
        this.activeVoice = null;
        this.activeTrack = null;
        clearInterval(this.musicTick);
        this.musicTick = null;
    },

    updateMusic: function() {
        if (!settings.musicEnabled) {
            if (this.activeTrack || this.activeVoice) this.stopMusic(0.5);
            return;
        }
        const cue = this.targetCue();
        if (!cue) {
            if (this.activeTrack) this.stopMusic(MUSIC_XFADE_CUE);
            return;
        }
        const track = this.resolveTrack(cue);
        // The paused check covers a play() the autoplay policy rejected earlier.
        if (this.activeTrack === track && this.activeVoice && !this.activeVoice.el.paused) return;
        // Start at loopSTART, not at zero. `loopStart..loopEnd` IS the track as far as the
        // game is concerned. This used to start at 0 so a sparse opening "played once, when
        // the cue started" — which was exactly backwards: a cue starts at the moment the
        // music most needs to be present, and Clubhouse Point opens on twenty seconds of
        // bare woodblock that a player reasonably reported as the music not playing at all.
        const def = MUSIC_TRACKS[track];
        this.playTrack(track, (def && def.loopStart) || 0, MUSIC_XFADE_CUE);
    },

    playTone: function(freq, duration, type='sine', startTime=0) {
        if (!settings.soundEnabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        const now = this.ctx.currentTime + startTime;
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        osc.start(now);
        osc.stop(now + duration);
    },

    playStart: function() {
        if (!settings.soundEnabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        // Noise
        const bufferSize = this.ctx.sampleRate * 2.0;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        this.fillNoise(data);
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(1000, now);
        noiseFilter.frequency.exponentialRampToValueAtTime(50, now + 1.0);
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.8, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        noise.start(now);
        noise.stop(now + 2.0);
        // Thump
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.5);
        oscGain.gain.setValueAtTime(1.0, now);
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
        osc.connect(oscGain);
        oscGain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 1.0);
    },

    playFinish: function() {
        if (!settings.soundEnabled) return;
        this.init();
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, i) => this.playTone(freq, 0.4, 'square', i * 0.15));
    },

    playPenalty: function() {
        if (!settings.soundEnabled) return;
        this.init();
        this.playTone(150, 0.15, 'sawtooth', 0);
        this.playTone(150, 0.15, 'sawtooth', 0.2);
    },

    playGateClear: function() {
        if (!settings.soundEnabled) return;
        this.init();
        this.playTone(659.25, 0.1, 'sine', 0);
        this.playTone(880.00, 0.4, 'sine', 0.1);
    },

    // The bed follows APPARENT wind — what the boat actually feels. Bearing away and
    // accelerating makes its own wind, and that is information the HUD does not show;
    // running deep goes quiet, which is both true and useful.
    playerWindSpeed: function() {
        const p = state.boats && state.boats[0];
        if (p && p.apparentWind && isFinite(p.apparentWind.speed)) return p.apparentWind.speed;
        return state.wind.speed;
    },

    // The bed belongs to being ON THE WATER. The venue picker and the scoreboard are not
    // sailing, and a breeze that keeps blowing behind them reads as a stuck sound rather
    // than as weather — the water there is a backdrop, not a place you are. Prestart
    // counts: you are out there manoeuvring, the gun just hasn't gone.
    windAudible: function() {
        if (UI.resultsOverlay && !UI.resultsOverlay.classList.contains('hidden')) return false;
        if (UI.preRaceOverlay && !UI.preRaceOverlay.classList.contains('hidden')) return false;
        return state.race.status === 'prestart' || state.race.status === 'racing';
    },

    initWindSound: function() {
        if (!this.ctx || this.windSource) return;
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        this.fillNoise(data);
        this.windSource = this.ctx.createBufferSource();
        this.windSource.buffer = buffer;
        this.windSource.loop = true;

        this.windGain = this.ctx.createGain();
        this.windGain.gain.value = 0;

        // RUSH — highpassed clear of the music, then a lowpass that opens with speed.
        // The old bed was a single lowpass sweeping 300→1200 Hz, i.e. parked exactly on
        // guitar body, bass and kick: it masked the score and told you nothing the wind
        // readout didn't already say.
        this.windHP = this.ctx.createBiquadFilter();
        this.windHP.type = 'highpass';
        this.windHP.frequency.value = WIND_SOUND.rushLoHz;
        this.windFilter = this.ctx.createBiquadFilter();
        this.windFilter.type = 'lowpass';
        this.windFilter.frequency.value = WIND_SOUND.rushHiMin;

        // RUMBLE — a quiet low layer so the bed reads as weather rather than tape hiss.
        this.windRumble = this.ctx.createBiquadFilter();
        this.windRumble.type = 'lowpass';
        this.windRumble.frequency.value = WIND_SOUND.rumbleHz;
        this.windRumbleGain = this.ctx.createGain();
        this.windRumbleGain.gain.value = WIND_SOUND.rumbleMix;

        this.windSource.connect(this.windHP);
        this.windHP.connect(this.windFilter);
        this.windFilter.connect(this.windGain);
        this.windSource.connect(this.windRumble);
        this.windRumble.connect(this.windRumbleGain);
        this.windRumbleGain.connect(this.windGain);
        this.windGain.connect(this.ctx.destination);
        this.windSource.start(0);

        this.windPrev = null;
        this.windGust = 0;
        this.windTime = this.ctx.currentTime;
    },

    updateWindSound: function(speed, mute = false) {
        if (!this.ctx) return;
        if (!settings.soundEnabled || !settings.bgSoundEnabled || mute || !this.windAudible()) {
            if (this.windGain) this.windGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
            // Forget the history too, so arriving on the water does not read the jump from
            // silence as a gust and open the transient on the first frame of the prestart.
            this.windPrev = null;
            this.windGust = 0;
            return;
        }
        if (!this.windSource) this.initWindSound();
        if (!this.windGain || !this.windFilter) return;

        const C = WIND_SOUND;
        const now = this.ctx.currentTime;
        const dt = Math.max(0, Math.min(0.5, now - (this.windTime == null ? now : this.windTime)));
        this.windTime = now;

        const kn = Math.max(C.minKn, Math.min(C.maxKn, speed || 0));

        // What opens the transient is the RISE, not the level — a gust arriving is the
        // one thing this sound can report that nothing else in the game does.
        if (this.windPrev != null && dt > 0) {
            const rise = (kn - this.windPrev) / dt;   // knots per second
            if (rise > 0) this.windGust = Math.min(1, Math.max(this.windGust, rise / C.gustRise));
        }
        this.windPrev = kn;
        this.windGust *= Math.exp(-dt / C.gustDecay);

        // Mapped in dB, not linear amplitude: the old curve bunched nearly all of its
        // perceptual movement into the top of the wind range.
        const t = (kn - C.minKn) / (C.maxKn - C.minKn);
        const db = C.masterDb + C.quietDb + (C.loudDb - C.quietDb) * t + C.gustDb * this.windGust;
        const volume = Math.pow(10, db / 20);
        // A gust is brighter as well as louder — pressure arrives in the top of the sound.
        const bright = Math.min(1, t + 0.35 * this.windGust);

        this.windGain.gain.setTargetAtTime(volume, now, 0.08);
        this.windFilter.frequency.setTargetAtTime(
            C.rushHiMin + (C.rushHiMax - C.rushHiMin) * bright, now, 0.08);
    }
};


// Physics announces; audio answers. (Registered before ui/screens.js loads, so
// the gun sounds before the banner writes — the order the old direct calls had.)
GameEvents.on('player-penalty', () => Sound.playPenalty());
