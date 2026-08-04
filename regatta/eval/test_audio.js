// EVERY MUSIC CUE PLAYS, AND THE WIND BED STAYS OUT OF THE MUSIC'S WAY.
//
//   node regatta/eval/test_audio.js
//
// This exists because broken audio wiring is silent — the same reason test_controls.js
// exists for buttons. Before this test, THREE of the six shipped tracks never played and
// nothing anywhere said so: `getMusicFile` knew four names, the racing branch always
// chose 'racing-downwind', so breezy-race (the 'racing-upwind' file) was unreachable, and
// harbor-glow and yacht-club were referenced by nothing at all. The menu was silent for
// months. A cue that resolves to a missing file, or a loopEnd past the end of a track,
// fails exactly the same way: no error, no log, just nothing.
//
// So: assert every declared track resolves to a file that exists and whose loop point is
// inside it, assert every cue the game can occupy maps to a track, and drive the real
// page through menu → prestart → racing to prove the map is followed, on a venue
// whose track declares a loopStart so entry and seam are exercised for real.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');

// The suite runs on file://, and file:// CANNOT hear music. A media element loaded from
// the filesystem is cross-origin, so createMediaElementSource returns a node that outputs
// silence while the element still plays and every property still reads healthy. That is
// exactly the bug this server exists to catch: the only assertion that can see it is a
// real signal measurement on a real origin, which is also how the game actually ships.
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
               '.mp3': 'audio/mpeg', '.png': 'image/png', '.json': 'application/json',
               '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
// ⚠️ It MUST serve HTTP Range. A browser cannot seek in media without it — `seekable`
// stays empty and `currentTime = loopStart` is silently ignored — so a server without
// Range makes every track look like it ignores its loop point. That cost a wrong
// diagnosis once already; real hosts (GitHub Pages included) serve Range, so a test
// server that doesn't is testing something the game never meets.
const serve = root => new Promise(resolve => {
    const server = http.createServer((req, res) => {
        const file = path.join(root, decodeURIComponent(req.url.split('?')[0]));
        fs.stat(file, (err, st) => {
            if (err) { res.writeHead(404); return res.end(); }
            const type = MIME[path.extname(file)] || 'application/octet-stream';
            const match = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
            if (match) {
                const start = match[1] ? parseInt(match[1], 10) : 0;
                const end = match[2] ? parseInt(match[2], 10) : st.size - 1;
                res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes',
                    'Content-Range': `bytes ${start}-${end}/${st.size}`,
                    'Content-Length': end - start + 1 });
                return fs.createReadStream(file, { start, end }).pipe(res);
            }
            res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes',
                                 'Content-Length': st.size });
            fs.createReadStream(file).pipe(res);
        });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
});

let failures = 0;
const check = (name, cond, detail) => {
    console.log(`  ${cond ? 'ok   ' : 'FAIL '} ${name}${cond || !detail ? '' : ' — ' + detail}`);
    if (!cond) failures++;
};

(async () => {
    console.log('audio: cues, loop points and the wind bed\n');

    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio']
    });
    try {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

        await page.goto('file://' + path.resolve('regatta/index.html'));
        await page.waitForFunction(() =>
            typeof Sound !== 'undefined' && typeof state !== 'undefined' && state.boats.length > 0);

        // ── Declared tracks point at real files ──────────────────────────────────
        const tracks = await page.evaluate(() => JSON.parse(JSON.stringify(MUSIC_TRACKS)));
        console.log('every declared track exists on disk\n');
        for (const [key, def] of Object.entries(tracks)) {
            const file = path.resolve('regatta', def.file);
            check(`${key} → ${def.file}`, fs.existsSync(file), 'file not found');
        }

        // ── Every cue the game can occupy resolves ───────────────────────────────
        // A cue with no track is a silent screen, which is a decision, not an accident —
        // so it has to be declared here to pass.
        console.log('\nevery cue resolves to a track');
        const CUES = ['menu', 'racing', 'results'];   // prestart is deliberately silent
        const resolved = await page.evaluate(cues =>
            cues.map(c => [c, Sound.resolveTrack(c), !!MUSIC_TRACKS[Sound.resolveTrack(c)]]), CUES);
        for (const [cue, track, ok] of resolved) {
            check(`cue '${cue}' → '${track}'`, ok, 'resolves to nothing');
        }

        // Every venue must reach a race track, whether its own or the house one.
        console.log('\nevery venue reaches a race track');
        const venueTracks = await page.evaluate(() => {
            const out = {};
            const saved = state.race.venue;
            for (const key of Object.keys(window.VENUE_DOC)) {
                state.race.venue = key;
                const t = Sound.resolveTrack('racing');
                out[key] = [t, !!MUSIC_TRACKS[t]];
            }
            state.race.venue = saved;
            return out;
        });
        for (const [venue, [track, ok]] of Object.entries(venueTracks)) {
            check(`${venue} → ${track}`, ok, 'no race track');
        }

        // ── Loop points are inside their file ────────────────────────────────────
        // loopEnd past the end silently disables the seam and the fade-out comes back.
        console.log('\nloop points sit inside the track, before the fade');
        const durations = await page.evaluate(async defs => {
            const out = {};
            await Promise.all(Object.entries(defs).map(([key, def]) => new Promise(res => {
                const el = new Audio(def.file);
                const done = () => { out[key] = el.duration; res(); };
                el.addEventListener('loadedmetadata', done, { once: true });
                el.addEventListener('error', () => { out[key] = null; res(); }, { once: true });
            })));
            return out;
        }, tracks);
        for (const [key, def] of Object.entries(tracks)) {
            const d = durations[key];
            const start = def.loopStart || 0;
            check(`${key} loop ${start}–${def.loopEnd}s of ${d ? d.toFixed(1) : '?'}s`,
                d != null && def.loopEnd > start + 5 && def.loopEnd <= d,
                d == null ? 'could not read duration' : 'loop point outside the track');
        }

        // ── The game actually follows the cue map ────────────────────────────────
        console.log('\nthe running game follows the cue map');
        const run = await page.evaluate(async () => {
            const sleep = ms => new Promise(r => setTimeout(r, ms));
            const snap = () => ({
                cue: Sound.targetCue(),
                track: Sound.activeTrack,
                playing: !!(Sound.activeVoice && !Sound.activeVoice.el.paused),
                routed: !!(Sound.activeVoice && Sound.activeVoice.gain),
                startedAt: Sound.activeVoice ? +Sound.activeVoice.el.currentTime.toFixed(1) : null,
                loopStart: (MUSIC_TRACKS[Sound.activeTrack] || {}).loopStart || 0,
                elVolume: Sound.activeVoice ? +Sound.activeVoice.el.volume.toFixed(3) : null,
                elExpected: +(((MUSIC_TRACKS[Sound.activeTrack] || {}).trim || 1) * MUSIC_VOLUME).toFixed(3),
            });
            const r = {};
            settings.musicEnabled = true;
            // Race the venue whose track HAS a loopStart, so the "starts at loopStart"
            // and seam checks below are real rather than trivially true at zero.
            settings.venue = 'seatrials';
            selectVenue('seatrials');
            await sleep(400);
            Sound.init();
            await sleep(900);
            r.menu = snap();
            startRace();
            await sleep(350);
            r.entry = snap();             // where the cue OPENED — the loopStart check
            await sleep(1900);            // past the cue crossfade
            r.prestart = snap();
            const prestartVoice = Sound.activeVoice;
            state.race.status = 'racing';
            Sound.updateMusic();
            await sleep(2100);            // past MUSIC_XFADE_CUE, so levels are settled
            r.racing = snap();
            // The gun must not re-trigger the music. Same voice object, still advancing:
            // anything else means the track restarted or crossfaded into itself.
            r.continuous = Sound.activeVoice === prestartVoice &&
                           Sound.activeVoice.el.currentTime > r.prestart.startedAt;
            r.decodesToBuffers = 'musicBuffers' in Sound;

            // The seam: land just before loopEnd and confirm it turns around rather than
            // playing into the fade and hard-cutting.
            const def = MUSIC_TRACKS[Sound.activeTrack];
            const before = Sound.activeVoice;
            Sound.activeVoice.el.currentTime = def.loopEnd - 1.0;
            await sleep(1500);
            r.seam = {
                swapped: Sound.activeVoice !== before,
                restartedAt: Sound.activeVoice.el.currentTime,
                expectedFrom: def.loopStart || 0,
                playing: !Sound.activeVoice.el.paused,
            };

            settings.musicEnabled = false;
            Sound.updateMusic();
            await sleep(800);
            r.afterDisable = { track: Sound.activeTrack, tick: !!Sound.musicTick };
            return r;
        });

        for (const cue of ['menu', 'racing']) {
            check(`${cue}: cue='${run[cue].cue}' track='${run[cue].track}'`,
                run[cue].cue === cue && !!run[cue].track && run[cue].playing,
                'cue did not start');
        }
        // The venue's track starts at the prestart and runs THROUGH the gun.
        check(`prestart starts the venue track ('${run.prestart.track}')`,
            run.prestart.cue === 'racing' && !!run.prestart.track && run.prestart.playing,
            `cue=${run.prestart.cue} track=${run.prestart.track}`);
        check('the gun does not re-trigger it — one continuous piece', run.continuous,
            'the music restarted at the start signal');
        // A cue must open ON the music, not on whatever sparse material precedes it.
        // Measured at the moment the cue opens — which is now the PRESTART, since the
        // venue track runs from there straight through the gun.
        check(`the cue opens at loopStart, not at zero (t=${run.entry.startedAt})`,
            Math.abs(run.entry.startedAt - run.entry.loopStart) < 1.5,
            `opened at ${run.entry.startedAt}, loopStart is ${run.entry.loopStart}`);
        // On file:// the Web Audio route is silent, so the player must NOT take it — and
        // the master volume then has to be folded into the element's own volume, because
        // the fallback path has no bus to carry it.
        check('file:// falls back to element volume instead of the silent Web Audio route',
            run.racing.routed === false, 'routed through Web Audio on file:// — that is silence');
        check(`file:// element volume carries the master (${run.racing.elVolume} ≈ ${run.racing.elExpected})`,
            Math.abs(run.racing.elVolume - run.racing.elExpected) < 0.02,
            'trim x MUSIC_VOLUME not applied to the element');
        check('music streams rather than decoding to AudioBuffers', !run.decodesToBuffers,
            'a buffer cache is back: a 4-minute stereo track costs ~100 MB of RAM');
        // It must return to loopSTART, not to zero: a track whose opening is too sparse
        // to loop into declares one, and looping to 0 would drop the texture out.
        check('loop seam turns the track around, back to loopStart',
            run.seam.swapped && run.seam.playing &&
            Math.abs(run.seam.restartedAt - run.seam.expectedFrom) < 3,
            `swapped=${run.seam.swapped} restartedAt=${run.seam.restartedAt} ` +
            `expected≈${run.seam.expectedFrom}`);
        check('disabling music stops every voice and the tick',
            run.afterDisable.track === null && !run.afterDisable.tick,
            'something kept running');

        // ── Music is actually AUDIBLE on a real origin ───────────────────────────
        // Everything above runs on file://, where music cannot be heard at all. This is
        // the only check that measures signal rather than state, and the only one that
        // would have caught createMediaElementSource silently muting the whole score.
        console.log('\nmusic is audible over http, the way it ships');
        const server = await serve(path.resolve('.'));
        try {
            const origin = `http://127.0.0.1:${server.address().port}`;
            const web = await browser.newPage();
            const webErrors = [];
            web.on('pageerror', e => webErrors.push(e.message));
            await web.goto(`${origin}/regatta/index.html`);
            await web.waitForFunction(() =>
                typeof Sound !== 'undefined' && state.boats.length > 0);
            const heard = await web.evaluate(async () => {
                const sleep = ms => new Promise(r => setTimeout(r, ms));
                settings.musicEnabled = true;
                // A venue whose track declares a loopStart, entered over a REAL origin.
                // A fresh element cannot seek before metadata loads and fails silently, so
                // this is where a dropped loopStart shows up — file:// loads fast enough to
                // hide it.
                settings.venue = 'arctic';
                selectVenue('arctic');
                await sleep(400);
                Sound.init();
                await sleep(600);
                startRace();
                await sleep(2500);
                if (!Sound.musicBus) return { routed: false, peak: 0, track: Sound.activeTrack };
                const an = Sound.ctx.createAnalyser();
                an.fftSize = 2048;
                Sound.musicBus.connect(an);
                const buf = new Float32Array(an.fftSize);
                let peak = 0;
                for (let i = 0; i < 30; i++) {
                    an.getFloatTimeDomainData(buf);
                    for (let j = 0; j < buf.length; j++) peak = Math.max(peak, Math.abs(buf[j]));
                    await sleep(50);
                }
                const def = MUSIC_TRACKS[Sound.activeTrack] || {};
                return { routed: !!(Sound.activeVoice && Sound.activeVoice.gain),
                         peak: +peak.toFixed(5), track: Sound.activeTrack,
                         enteredAt: +Sound.activeVoice.el.currentTime.toFixed(1),
                         loopStart: def.loopStart || 0 };
            });
            check(`http:// routes through Web Audio (track '${heard.track}')`, heard.routed,
                  'fell back to element volume on a real origin');
            check(`SIGNAL REACHES THE OUTPUT (peak ${heard.peak})`, heard.peak > 1e-3,
                  'the graph is connected and silent — this is the bug file:// cannot see');
            // Entry must land past loopStart and keep moving — never snap back to 0.
            check(`http:// enters at loopStart (t=${heard.enteredAt}, loopStart ${heard.loopStart})`,
                  heard.enteredAt >= heard.loopStart - 0.5,
                  'the seek was dropped — a fresh element cannot seek before metadata loads');
            check('no page errors over http', webErrors.length === 0, webErrors.slice(0, 2).join(' | '));
            await web.close();
        } finally {
            server.close();
        }

        // ── The wind bed ────────────────────────────────────────────────────────
        // It has to stay off the music's low-mid and stay quieter than the old bed, and
        // its range has to come from gust TRANSIENTS rather than a louder constant.
        console.log('\nthe wind bed reports gusts and stays out of the music');
        const wind = await page.evaluate(async () => {
            const sleep = ms => new Promise(r => setTimeout(r, ms));
            const db = v => 20 * Math.log10(Math.max(v, 1e-6));
            settings.soundEnabled = true; settings.bgSoundEnabled = true;
            // Drive through playerWindSpeed: the render loop calls updateWindSound every
            // frame and would overwrite an injected value.
            const real = Sound.playerWindSpeed;
            Sound.playerWindSpeed = () => 6;
            await sleep(600);
            const calm = db(Sound.windGain.gain.value);
            // The bed belongs to being on the water. Menus and the scoreboard are not.
            const audible = { racing: Sound.windAudible() };
            const status = state.race.status;
            state.race.status = 'waiting';
            UI.preRaceOverlay.classList.remove('hidden');
            audible.menu = Sound.windAudible();
            await sleep(500);
            const menuLevel = db(Sound.windGain.gain.value);
            UI.preRaceOverlay.classList.add('hidden');
            UI.resultsOverlay.classList.remove('hidden');
            audible.results = Sound.windAudible();
            UI.resultsOverlay.classList.add('hidden');
            state.race.status = status;
            await sleep(500);
            Sound.playerWindSpeed = () => 22;       // a gust front arrives
            await sleep(150);
            const peak = db(Sound.windGain.gain.value);
            await sleep(3000);                      // transient decays; level stays up
            const settled = db(Sound.windGain.gain.value);
            Sound.playerWindSpeed = real;
            return {
                calm, peak, settled, audible, menuLevel,
                hp: Sound.windHP.frequency.value,
                oldBedPeak: db(0.15),               // where the previous bed sat
                usesApparent: (() => {
                    const p = state.boats[0];
                    return !!(p && p.apparentWind) &&
                        Math.abs(Sound.playerWindSpeed() - p.apparentWind.speed) < 1e-6;
                })(),
            };
        });
        check('follows apparent wind, not true wind', wind.usesApparent,
            'playerWindSpeed is not reading boat.apparentWind');
        check(`highpassed clear of the music's low-mid (${wind.hp} Hz)`, wind.hp >= 800,
            'the bed is back on top of guitar body, bass and kick');
        check(`a gust opens a transient (+${(wind.peak - wind.settled).toFixed(1)} dB)`,
            wind.peak - wind.settled > 2.0, 'no audible gust event');
        // Materially quieter, not marginally: a continuous broadband sound draws attention
        // out of all proportion to its level, and with music off by default it has nothing
        // to sit underneath.
        check(`well under the old bed (peak ${wind.peak.toFixed(1)} vs ${wind.oldBedPeak.toFixed(1)} dB)`,
            wind.peak < wind.oldBedPeak - 8,
            'the bed has crept back up towards the one it replaced');
        check('silent on the venue picker and the scoreboard, audible while sailing',
            wind.audible.racing === true && wind.audible.menu === false &&
            wind.audible.results === false && wind.menuLevel < -55,
            `racing=${wind.audible.racing} menu=${wind.audible.menu} ` +
            `results=${wind.audible.results} menuLevel=${wind.menuLevel.toFixed(1)}dB`);
        check(`wind range is audible (${(wind.settled - wind.calm).toFixed(1)} dB, 6→22 kn)`,
            wind.settled - wind.calm > 5, 'calm and breezy sound the same');

        check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    } finally {
        await browser.close();
    }

    console.log(`\n${failures ? 'FAIL' : 'PASS'} — ${failures} failure(s)`);
    process.exit(failures ? 1 : 0);
})();
