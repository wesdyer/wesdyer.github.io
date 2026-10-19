// Probe: the humpbacks' behaviour against the field numbers (Oct 19 2026 research pass; see WHALES in js/wildlife.js).
// Twenty minutes of game clock, boats away: stroke rate per pod (Hz, game clock ~3x real), fluke-up share of dives,
// blows a minute for the resting mother and her calf, the calf's place beside her, events seen, breach bouts.
//   node regatta/eval/_ocean_hump_behave.js      (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
    const r = await p.evaluate(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'ocean', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        resetGame(); for (const bt of state.boats) { bt.x = 1e6; bt.y = 1e6; }
        const d = Wildlife.debug(), W = d.whalePods, dt = 1 / 30, N = 30 * 1200;
        const st0 = W.map(P => P.members.map(m => m.st)), dives = { up: 0, down: 0 }, ev = {}, blowsBy = new Map(); let bout = 0, calfDx = [], calfDy = [];
        const prevMode = new Map(), prevEv = new Map(), prevBlow = new Map();
        for (let i = 0; i < N; i++) { Wildlife.update(dt);
            for (const P of W) for (const m of P.members) {
                if (m.mode === 'dive' && prevMode.get(m) !== 'dive') m.up ? dives.up++ : dives.down++;
                if (m.ev && prevEv.get(m) !== m.ev) { ev[m.ev] = (ev[m.ev] || 0) + 1; if (m.ev === 'breach' && m.bout >= 0 && prevEv.get(m) == null && m._lastBreach != null && i - m._lastBreach < 30 * 20) bout++; if (m.ev === 'breach') m._lastBreach = i; }
                if (m.blowT > (prevBlow.get(m) || 0) + 0.5) blowsBy.set(m, (blowsBy.get(m) || 0) + 1);
                prevMode.set(m, m.mode); prevEv.set(m, m.ev); prevBlow.set(m, m.blowT);
            }
            const C = W.find(P => P.cfg.calf); if (i % 30 === 0) { const mo = C.members[0], ca = C.members[1], fx = Math.sin(mo.h), fy = -Math.cos(mo.h), ex = ca.x - mo.x, ey = ca.y - mo.y; calfDx.push(ex * -fy + ey * fx); calfDy.push(ex * fx + ey * fy); }
        }
        const mins = N * dt / 60, med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
        return { pods: W.map((P, k) => ({ id: P.cfg.id, speed: P.cfg.speed, hz: P.members.map((m, j) => +((m.st - st0[k][j]) / (2 * Math.PI) / (N * dt)).toFixed(2)) })),
            flukeUpShare: +(dives.up / (dives.up + dives.down)).toFixed(2), dives, events: ev, breachesWithin20s: bout,
            mumBlowsPerMin: +((blowsBy.get(W.find(P => P.cfg.calf).members[0]) || 0) / mins).toFixed(1), calfBlowsPerMin: +((blowsBy.get(W.find(P => P.cfg.calf).members[1]) || 0) / mins).toFixed(1),
            calfBeside: +med(calfDx).toFixed(0), calfAhead: +med(calfDy).toFixed(0) };
    });
    console.log(JSON.stringify(r, null, 1)); await b.close();
})();
