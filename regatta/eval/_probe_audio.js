// Does <venue> resolve to its track, make real signal over http, and how far does
// the wind bed sit under the music AT THAT VENUE'S OWN BREEZE? The suite races
// seatrials and arctic only, and a wind-band share is a property of the FILE — what
// matters in play is the balance against the bed the venue actually generates.
//
//   node regatta/eval/_probe_audio.js lagoon
//
// Reference points measured Aug 1 2026 (music RMS over the bed, higher = more room):
// bay 13.4 dB @ 13 kn · lagoon 12.1 dB @ 13 kn · arctic 6.4 dB @ 16.5 kn apparent.
// Arctic is deliberately the tight one — on the windiest venue the gust is supposed
// to take the high end. A new track landing near arctic's number on a CALM venue is
// the warning sign.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http');

const ROOT = path.resolve(__dirname, '..', '..');
const VENUE = process.argv[2] || 'lagoon';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
               '.mp3': 'audio/mpeg', '.png': 'image/png', '.json': 'application/json',
               '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const serve = root => new Promise(resolve => {
    const server = http.createServer((req, res) => {
        const file = path.join(root, decodeURIComponent(req.url.split('?')[0]));
        fs.stat(file, (err, st) => {
            if (err) { res.writeHead(404); return res.end(); }
            const type = MIME[path.extname(file)] || 'application/octet-stream';
            const m = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
            if (m) {
                const start = m[1] ? parseInt(m[1], 10) : 0, end = m[2] ? parseInt(m[2], 10) : st.size - 1;
                res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes',
                    'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
                return fs.createReadStream(file, { start, end }).pipe(res);
            }
            res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': st.size });
            fs.createReadStream(file).pipe(res);
        });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
});

(async () => {
    const server = await serve(ROOT);
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    // ⚠️ settings.venue = x + resetGame() does NOT select venue x — resetGame calls
    // loadSettings() first and stomps it. Pin through localStorage.
    await page.addInitScript(v => localStorage.setItem('regatta_settings',
        JSON.stringify({ venue: v, musicEnabled: true, soundEnabled: true, bgSoundEnabled: true })), VENUE);
    await page.goto(`http://127.0.0.1:${server.address().port}/regatta/index.html`);
    await page.waitForFunction(() => typeof Sound !== 'undefined' && state.boats.length > 0);
    const r = await page.evaluate(async (venue) => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const db = v => 20 * Math.log10(Math.max(v, 1e-6));
        settings.musicEnabled = true; settings.soundEnabled = true; settings.bgSoundEnabled = true;
        selectVenue(venue);
        await sleep(400);
        Sound.init();
        await sleep(600);
        startRace();
        await sleep(3000);
        const out = { venue: settings.venue, track: Sound.activeTrack,
                      file: (MUSIC_TRACKS[Sound.activeTrack] || {}).file,
                      routed: !!Sound.musicBus };
        // The breeze the venue actually states, and the bed it drives.
        const p = state.boats[0];
        out.trueWind = +state.wind.speed.toFixed(1);
        out.apparent = p && p.apparentWind ? +p.apparentWind.speed.toFixed(1) : null;
        out.bedDb = +db(Sound.windGain.gain.value).toFixed(1);
        if (Sound.musicBus) {
            const an = Sound.ctx.createAnalyser(); an.fftSize = 2048;
            Sound.musicBus.connect(an);
            const buf = new Float32Array(an.fftSize);
            let peak = 0, sum = 0, n = 0;
            for (let i = 0; i < 60; i++) {
                an.getFloatTimeDomainData(buf);
                for (let j = 0; j < buf.length; j++) { peak = Math.max(peak, Math.abs(buf[j])); sum += buf[j] * buf[j]; n++; }
                await sleep(50);
            }
            out.musicPeakDb = +db(peak).toFixed(1);
            out.musicRmsDb = +db(Math.sqrt(sum / n)).toFixed(1);
            out.headroomDb = +(out.musicRmsDb - out.bedDb).toFixed(1);
        }
        out.enteredAt = +Sound.activeVoice.el.currentTime.toFixed(1);
        return out;
    }, VENUE);
    console.log(r, errors.length ? errors.slice(0, 2) : 'no page errors');
    await browser.close();
    server.close();
})();
