// Probe: Glacier Sound motion as FILM STRIPS — the same animal drawn at successive moments
// across a row, so gait, rhythm and timing can be judged, not just the pose. Rows: an orca's
// surfacing and blow (0.4 s apart); each penguin species walking (or hopping) a short trek, and
// the toboggan (0.15 s apart, fixed camera, so the travel per frame shows speed); each species
// swimming (0.2 s apart). At 2x on water / snow.
//   node regatta/eval/_arctic_motion.js <out.png>     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => {
    const out = process.argv[2] || '/tmp/arctic_motion.png';
    const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 1250 } });
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
    await p.evaluate(async () => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        resetGame();
        const A = Wildlife.art, P = A.PENG();
        for (const k of ['orca-body', 'orca-flukes', 'penguin-emperor', 'penguin-adelie', 'penguin-gentoo', 'penguin-macaroni']) A.arcticImg(k);
        await new Promise(r => setTimeout(r, 800));
        const c = document.createElement('canvas'); c.width = 1500; c.height = 1250; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999';
        document.body.appendChild(c); const g = c.getContext('2d');
        g.fillStyle = '#1d3a5f'; g.fillRect(0, 0, 1500, 1250);
        const lab = (s, x, y) => { g.fillStyle = 'rgba(255,255,255,0.9)'; g.font = '12px sans-serif'; g.fillText(s, x, y); };
        // 1. orca surfacing, 10 frames 0.4 s apart (the sim's own rules: up over 4 s, blow decays over 2.4)
        lab('orca surfacing + blow, 0.4 s apart (heading up)', 10, 18);
        for (let i = 0; i < 10; i++) { const t = i * 0.4, tb = t - 1.12, m = { kind: 'orca', x: 0, y: 0, h: 0, up: t < 4 ? t / 4 : -1, blow: tb >= 0 ? Math.max(0, 1 - tb / 2.2) : 0, bx: 0, by: -76 * 0.22 + (-70 * Math.min(t, 1.12) + 70 * 1.12) * 0, bh: 1, beat: t * 2.2, trail: [] };
            g.save(); g.translate(75 + i * 145, 140); g.scale(1.6, 1.6); A.drawOrca(g, m); g.restore(); lab(t.toFixed(1) + 's', 60 + i * 145, 250); }
        // 2. treks: each species along a 140-u path, 8 frames 0.15 s apart, on snow
        g.fillStyle = '#eaf1f8'; g.fillRect(0, 270, 1500, 560);
        const sim = (T, secs) => { for (let t = 0; t < secs; t += 1 / 30) for (const bd of T.birds) { bd.delay -= 1 / 30; if (bd.delay > 0) continue; bd.step = (bd.step || 0) + 1 / 30; const G = P[T.species];
            const v = T.slide ? T.speed : G.hops ? T.speed * 2.2 * Math.max(0, Math.sin(bd.step * G.rock)) : T.speed * (0.75 + 0.5 * Math.max(0, Math.sin(bd.step * G.rock))); bd.s += v / 30; } };
        const rows = [['emperor', false], ['adelie', false], ['gentoo', false], ['macaroni', false], ['adelie', true], ['emperor', true]];
        rows.forEach(([sp, slide], r) => {
            const y = 310 + r * 88; lab(`${sp} ${slide ? 'TOBOGGAN' : P[sp].hops ? 'hop' : 'walk'}  ${slide ? P[sp].slide : P[sp].walk} u/s, 0.15 s apart`, 10, y - 22);
            for (let i = 0; i < 9; i++) {
                const T = { species: sp, dir: 'out', slide, speed: slide ? P[sp].slide : P[sp].walk, pts: [{ x: 0, y: 0 }, { x: 400, y: 0 }], birds: [{ delay: 0, s: 0 }] };
                sim(T, i * 0.15);
                g.save(); g.translate(40 + i * 160, y + 10); g.scale(2, 2); A.drawTreks(g, [T]); g.restore();
            }
        });
        // 3. swimming, each species, a 3-bird group, 8 frames 0.2 s apart, heading right
        const sps = ['gentoo', 'adelie', 'macaroni', 'emperor'];
        sps.forEach((sp, r) => {
            const y = 880 + r * 92; lab(`${sp} swimming, 0.2 s apart`, 10, y - 30);
            for (let i = 0; i < 8; i++) { const S = { species: sp, x: 0, y: 0, h: Math.PI / 2, t: 1 + i * 0.2, birds: [0, 1, 2].map(k => ({ ox: (k - 1) * 14, oy: -k * 13, ph: k * 0.45, per: P[sp].porp ? P[sp].porp[0] + k * 0.1 : 4 })) };
                g.save(); g.translate(70 + i * 180, y + 10); g.scale(2, 2); A.drawSwimmers(g, S); g.restore(); }
        });
    });
    await p.screenshot({ path: out }); await b.close(); console.log('wrote', out);
})();
