// FLATS RACE PROBE — race the bot fleet on Spoonbill Flats and report what the tide did to it:
// finish times, groundings (count, seconds aground, where), and which of the three choices
// each boat took (the wantij corridor, the point bar shelf, the flood creek), read off a
// trajectory sampled every second against the document's own polygons.
//   node regatta/eval/_flats_race.js [races] [seedBase] [--period N] [--phase X] [--player]
// --player: the player's boat is left in the fleet under the bot autopilot (BotController), so
// a tenth boat races; default parks it off the map like check_raceable does.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ARGS = process.argv.slice(2);
const flag = (k) => { const i = ARGS.indexOf(k); return i >= 0 ? ARGS[i + 1] : null; };
const RACES = +(ARGS.find(a => /^\d+$/.test(a)) || 2);
const SEED0 = +(ARGS.filter(a => /^\d+$/.test(a))[1] || 9100);
const PERIOD = flag('--period') ? +flag('--period') : null;
const PHASE = flag('--phase') ? +flag('--phase') : null;
const mmss = (s) => s == null ? '  DNF' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
    await page.goto('file://' + path.resolve('regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js', 'utf8') });
    await page.waitForTimeout(400);
    const all = [];
    for (let i = 0; i < RACES; i++) {
        const r = await page.evaluate(async ([seed, period, phase]) => {
            localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'flats' }));
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            if (period) state.tide.period = period;
            if (phase != null) state.tide.phase0 = phase;
            const doc = state.course.doc;
            const shapeOf = (id) => doc.shapes.find(s => s.id === id);
            const pir = (x, y, ring) => { let ins = false; for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) { const xi = ring[a][0], yi = ring[a][1], xj = ring[b][0], yj = ring[b][1]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) ins = !ins; } return ins; };
            const zones = { wantij: shapeOf('wantij-corridor'), pointbar: shapeOf('point-bar'), creek: shapeOf('creek-flood'), sill: shapeOf('wantij-sill'), creeksill: shapeOf('creek-sill') };
            const events = [];
            const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                try { if (d && d.boat && (ty === 'aground' || ty === 'collision_island')) events.push({ ty, boat: d.boat.name, t: Math.round(state.race.timer), x: Math.round(d.boat.x), y: Math.round(d.boat.y), leg: d.boat.raceState.leg }); } catch (e) {}
                return inner && inner(ty, d);
            };
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const fin = bots.map(() => null), agroundS = bots.map(() => 0), agroundN = bots.map(() => 0), visits = bots.map(() => ({}));
            const track = bots.map(() => []);
            const dt = 1 / 60;
            let frame = 0, lastAg = bots.map(() => false);
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt); frame++;
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > state.course.cutoff) break;
                for (let k = 0; k < bots.length; k++) {
                    const b = bots[k];
                    if (fin[k] == null && b.raceState.finished) fin[k] = state.race.timer;
                    if (fin[k] != null) continue;
                    if (b.aground) { agroundS[k] += dt; if (!lastAg[k]) agroundN[k]++; }
                    lastAg[k] = !!b.aground;
                    if (frame % 60 === 0) {
                        track[k].push([Math.round(b.x), Math.round(b.y), Math.round(state.race.timer), b.aground ? 1 : 0]);
                        for (const z in zones) if (zones[z] && pir(b.x, b.y, zones[z].outer)) visits[k][z] = (visits[k][z] || 0) + 1;
                    }
                }
                if (fin.every(f => f != null)) break;
            }
            return { period: state.tide.period, phase0: state.tide.phase0, boats: bots.map((b, k) => ({ name: b.name, fin: fin[k], agroundS: Math.round(agroundS[k]), agroundN: agroundN[k], visits: visits[k], leg: b.raceState.leg })), events, track };
        }, [SEED0 + i, PERIOD, PHASE]);
        all.push(r);
        console.log(`\nrace ${i + 1} seed ${SEED0 + i}  period ${r.period}s phase0 ${r.phase0.toFixed(2)}`);
        const sorted = r.boats.slice().sort((a, b) => (a.fin == null ? 1e9 : a.fin) - (b.fin == null ? 1e9 : b.fin));
        for (const b of sorted) {
            const v = b.visits;
            const route = [v.wantij ? `wantij${v.sill ? '+sill' : ''}` : '', v.pointbar ? 'pointbar' : '', v.creek ? `creek${v.creeksill ? '+sill' : ''}` : ''].filter(Boolean).join(' ') || 'channel';
            console.log(`  ${mmss(b.fin).padStart(6)}  ${b.name.padEnd(10)} aground ${String(b.agroundN).padStart(2)}x ${String(b.agroundS).padStart(3)}s  leg ${b.leg}  ${route}`);
        }
        const ag = r.events.filter(e => e.ty === 'aground');
        if (ag.length) console.log('  groundings: ' + ag.slice(0, 14).map(e => `${e.boat}@${e.t}s(${e.x},${e.y})`).join(' '));
    }
    const fins = all.flatMap(r => r.boats.map(b => b.fin)).filter(x => x != null).sort((a, b) => a - b);
    const n = all.reduce((a, r) => a + r.boats.length, 0);
    console.log(`\n${fins.length}/${n} finished; best ${mmss(fins[0])} median ${mmss(fins[Math.floor(fins.length / 2)])} worst ${mmss(fins[fins.length - 1])}`);
    fs.writeFileSync('/tmp/flats_race_last.json', JSON.stringify(all));
    if (errs.length) console.log('page errors: ' + errs.slice(0, 3).join(' | '));
    await browser.close();
})();
