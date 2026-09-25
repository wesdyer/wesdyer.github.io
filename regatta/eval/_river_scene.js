// Probe: Sockeye Run's animals IN THE SCENE — the real game canvas, stepped by hand
// (update + draw), with the player's boat parked beside each animal in turn: the chute bear,
// the eddy bear with its run and an eagle stooping on it, an otter family swimming off its
// logjam, and salmon leaping in the gorge. One screenshot each, full frame and a zoomed crop.
//   node regatta/eval/_river_scene.js <outdir>     (from the repo root)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
    const out = process.argv[2] || '/tmp/river_scene';
    fs.mkdirSync(out, { recursive: true });
    const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 860 } });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
    await p.evaluate(async () => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'river', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        resetGame(); startRace(); await new Promise(r => setTimeout(r, 300));
        for (const el of document.querySelectorAll('.overlay, [id$="-overlay"], #pre-race, #hub')) el.style.display = 'none';
    });
    const shots = [
        // [name, boat x, y, heading, setup]
        ['chute_bear', 5440, -5980, 2.4, 'none'],
        ['eddy_bear_run', 2420, -4180, 1.6, 'stoop'],
        ['otters_p6', 3640, -3420, 5.5, 'otters'],
        ['gorge_leaps', 1330, -2500, -0.4, 'leap'],
        ['eagle_soar', 5250, -5850, 2.4, 'none'],   // under the finish-arm eagle's circle, for its shadow
    ];
    for (const [name, x, y, h, setup] of shots) {
        const info = await p.evaluate(({ x, y, h, setup }) => {
            const me = state.boats[0];
            // park the fleet far away and the player here, drifting
            for (const bt of state.boats) { bt.x = 1e5; bt.y = 1e5; }
            me.x = x; me.y = y; me.heading = h; me.speed = 0;
            const d = Wildlife.debug();
            if (setup === 'stoop') { const E = d.soarers.find(e => e.cx > 3000 && e.cx < 4000) || d.soarers[0]; const G = d.runs[1]; E.x = G.hx + 260; E.y = G.hy - 180; E.mode = 'stoop'; E.tx = G.hx; E.ty = G.hy; E.z0 = 90; E.d0 = 320; E.z = 90; }
            if (setup === 'otters') { const F = d.rompers.find(f => f.jam.id === 'prop-6'); F.t = 0; F.mode = 'rest'; }
            let steps = setup === 'otters' ? 150 : setup === 'stoop' ? 75 : 60;
            for (let i = 0; i < steps; i++) { me.x = x; me.y = y; me.speed = 0; update(1 / 30); }
            if (setup === 'leap') { for (let i = 0; i < 400 && !Wildlife.debug().leaps.some(L => L.t > 0.2 && L.t < L.dur); i++) { me.x = x; me.y = y; update(1 / 30); } }
            // look at the family itself, wherever it has swum to
            if (setup === 'leap') { const L = Wildlife.debug().leaps.find(L => L.t > 0.2 && L.t < L.dur); if (L) { state.camera.x = L.x; state.camera.y = L.y; } }
            if (setup === 'otters') { const F = d.rompers.find(f => f.jam.id === 'prop-6'); const M = F.members; state.camera.x = M.reduce((a, m) => a + m.x, 0) / M.length; state.camera.y = M.reduce((a, m) => a + m.y, 0) / M.length; }
            draw();
            return { bears: d.fishers.map(B => B.mode + '/' + B.rear.toFixed(2)), eagles: d.soarers.map(E => E.mode + '@' + Math.round(E.z)), otters: d.rompers.map(F => F.mode), leaps: Wildlife.debug().leaps.length };
        }, { x, y, h, setup });
        await p.screenshot({ path: path.join(out, `${name}.png`) });
        await p.screenshot({ path: path.join(out, `${name}_zoom.png`), clip: { x: 400, y: 180, width: 600, height: 500 } });
        console.log(name, JSON.stringify(info));
    }
    console.log(errs.length ? 'page errors: ' + errs.slice(0, 3).join(' | ') : 'no page errors');
    await b.close();
})();
