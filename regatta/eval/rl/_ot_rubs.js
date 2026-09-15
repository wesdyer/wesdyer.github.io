// WHERE THE BOAT CONTACTS ARE (2026-09-14, the otter push). ocean_bench counts a boat
// contact per (boat, category) with a 0.5 s debounce off window.onRaceEvent; this
// replays a bench SEQUENCE (seed0..seed0+n-1, ten-bot conversion, late venue write) with
// the same hook and records WHERE each debounced boat contact happened: leg, distance
// to the rounding mark, race clock, and speed. Prints bands so a candidate's contact
// delta can be placed (the start scrum, the beat, the mark, the exit line, the reach).
//   node _ot_rubs.js <tree> [seed0] [n] [venue]
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const TREE = process.argv[2] || 'treeOT0', SEED0 = parseInt(process.argv[3] || '9400'), N = parseInt(process.argv[4] || '3'), VENUE = process.argv[5] || 'otter';
const ROOT = path.join(__dirname, TREE);
(async () => {
    const br = await chromium.launch(); const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await p.evaluate((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v, character: AI_CONFIG[0].name })), VENUE);
    const all = [];
    for (let t = 0; t < N; t++) {
        const r = await p.evaluate(({ seed }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            const route = state.course.route || []; let M = null;
            for (const e of route) if (e && e.kind === 'round' && e.mark) { M = { x: e.mark.x, y: e.mark.y, zone: e.mark.zone }; break; }
            const pl = state.boats.find(x => x.isPlayer);
            applyBoatIdentity(pl, playerCharacter(), false); pl.isPlayer = false; pl.manualTrim = false;
            const nine = state.boats.filter(x => x !== pl);
            pl.ai.startLinePct = Math.max(0.05, Math.min(0.90, nine.reduce((a, x) => a + x.ai.startLinePct, 0) / nine.length));
            pl.ai.setupDist = 300;
            const ev = []; const ccT = {};
            const mono = () => state.race.status === 'prestart' ? -state.race.timer : state.race.timer;
            window.onRaceEvent = (ty, d) => {
                try {
                    if (d && d.boat && !d.boat.raceState.finished && (ty === 'collision_boat' || (ty === 'collision_island' && !d.isFloe))) {
                        const cat = ty === 'collision_boat' ? 'boat' : 'land';
                        const k = d.boat.name + ':' + cat, tt = mono();
                        if (ccT[k] == null || tt - ccT[k] >= 0.5) {
                            ccT[k] = tt; const b = d.boat; const v = b.velocity ? Math.hypot(b.velocity.x, b.velocity.y) * 60 : b.speed * 60;
                            ev.push({ cat, name: b.name, t: +tt.toFixed(1), leg: b.raceState.leg, dM: M ? Math.round(Math.hypot(b.x - M.x, b.y - M.y)) : null, v: Math.round(v), x: Math.round(b.x), y: Math.round(b.y), other: d.other && d.other.name, armed: b.raceState.roundArmed ? 1 : 0, ob: b.controller && b.controller._outbound ? 1 : 0, corner: b.controller && b.controller._corner ? 1 : 0 });
                        }
                    }
                } catch (e) {}
            };
            const DT = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) { window.update(DT); if (state.race.status === 'finished') break; if (state.race.timer > 895) break; }
            return { M, ev, fins: state.boats.filter(b => b.raceState.finished).length };
        }, { seed: SEED0 + t });
        console.log(`seed ${SEED0 + t}: ${r.ev.length} boat contacts, fins ${r.fins}`);
        for (const e of r.ev) all.push({ seed: SEED0 + t, ...e });
    }
    await br.close();
    const band = (e) => e.t < 0 ? 'prestart' : e.t < 30 ? 'start<30s' : e.leg === 1 ? (e.dM != null && e.dM < 330 ? 'L1 mark<2z' : e.dM != null && e.dM < 1000 ? 'L1 mark<1000' : 'L1 beat') : e.leg >= 2 ? (e.dM != null && e.dM < 1000 ? 'L2 exit<1000' : 'L2 reach') : 'L0';
    const H = {}; for (const e of all) { const kb = e.cat + ' ' + band(e); H[kb] = (H[kb] || 0) + 1; }
    const nb = all.filter(e => e.cat === 'boat').length, nl = all.filter(e => e.cat === 'land').length; console.log(`\n${TREE} ${VENUE} seeds ${SEED0}+${N}: boat contacts ${nb} (${(nb / (N * 10)).toFixed(2)}/boat-race), land contacts ${nl} (${(nl / (N * 10)).toFixed(2)}/boat-race)`);
    for (const cat of ['boat', 'land']) for (const k of ['prestart', 'start<30s', 'L0', 'L1 beat', 'L1 mark<1000', 'L1 mark<2z', 'L2 exit<1000', 'L2 reach']) if (H[cat + ' ' + k]) console.log(`  ${(cat + ' ' + k).padEnd(20)} ${H[cat + ' ' + k]}`);
    const near = all.filter(e => e.cat === 'land' && e.leg >= 1);
    console.log('  land contacts (leg>=1), first 40:'); for (const e of near.slice(0, 40)) console.log(`    seed ${e.seed} t ${e.t} ${e.name} leg ${e.leg} at (${e.x},${e.y}) dM ${e.dM} v ${e.v}`);
    fs.writeFileSync(path.join(__dirname, `_ot_rubs_${TREE}.json`), JSON.stringify(all));
})();
