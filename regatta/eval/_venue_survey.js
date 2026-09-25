// Probe: what a race at a venue IS, as built — for the venue-objectives design phase. Runs the
// autopilot player and the whole fleet over a few seeds and reports, per boat: finish time,
// seconds in rapids (rapidsTurbAt > 0.2), and the mean current along its direction of travel
// (knots; + helping, - against). With TRACKS=<prefix> it also dumps every boat's track
// ([x,y] each second) to <prefix>_<seed>.json for the overlay maps.
//   node regatta/eval/_venue_survey.js <venue> [seeds]      (from the repo root)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
    const venue = process.argv[2] || 'river';
    const b = await chromium.launch(); const p = await b.newPage();
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.VenueDoc && typeof BotController !== 'undefined');
    for (const seed of (process.argv[3] || '1,2,3').split(',').map(Number)) {
        const r = await p.evaluate(async ({ seed, venue }) => {
            localStorage.setItem('regatta_settings', JSON.stringify({ venue, soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
            let s = seed; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
            resetGame(); startRace(); await new Promise(r => setTimeout(r, 200));
            const me = state.boats[0]; me.controller = new BotController(me);
            const S = new Map(), tracks = new Map(); let t = 0; const dt = 1 / 30;
            const turb = typeof rapidsTurbAt === 'function' ? rapidsTurbAt : () => 0;
            while (t < 600 && !me.raceState.finished) {
                me.controller.update(dt); const d = normalizeAngle(me.controller.targetHeading - me.heading);
                state.keys.ArrowLeft = d < -0.02; state.keys.ArrowRight = d > 0.02; update(dt); t += dt;
                if (state.race.status !== 'racing') continue;
                const tick = Math.round(t * 30) % 30 === 0;
                for (const bt of state.boats) {
                    if (bt.raceState.finished) continue;
                    const o = S.get(bt.name) || { rap: 0, cur: 0, n: 0 };
                    const tv = turb(bt.x, bt.y); const rv = typeof tv === 'number' ? tv : (tv && tv.turb) || 0;
                    if (rv > 0.2) o.rap += dt;
                    const c = getCurrentAt(bt.x, bt.y);
                    if (c && c.speed > 0) { o.cur += c.speed * Math.cos(c.direction - bt.heading); o.n++; }
                    S.set(bt.name, o);
                    if (tick) { if (!tracks.has(bt.name)) tracks.set(bt.name, []); tracks.get(bt.name).push([Math.round(bt.x), Math.round(bt.y)]); }
                }
            }
            const rows = state.boats.map(bt => {
                const o = S.get(bt.name) || { rap: 0, cur: 0, n: 1 };
                return [bt.name + (bt === me ? '*' : ''), bt.raceState.finished ? Math.round(bt.raceState.finishTime || 0) : 'DNF', Math.round(o.rap), +(o.cur / Math.max(1, o.n)).toFixed(2)];
            }).sort((a, c) => (a[1] === 'DNF') - (c[1] === 'DNF') || a[1] - c[1]);
            return { seed, t: Math.round(t), rows, tracks: [...tracks.entries()].map(([n, tr]) => ({ n, tr })) };
        }, { seed, venue });
        if (process.env.TRACKS) fs.writeFileSync(`${process.env.TRACKS}_${seed}.json`, JSON.stringify(r.tracks));
        console.log(`seed ${r.seed}: player ${r.t}s`);
        for (const row of r.rows) console.log('   ' + row.join('  '));
    }
    await b.close();
})();
