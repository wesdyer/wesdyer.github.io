// Probe: a headless look-bench for Glowtide's animals — golden jellies, the manta (cruising,
// flipping over, belly up), the flying fox through one wingbeat, the hawksbill (swimming, on the
// sand with its track), the dugong (grazing, breathing, with a calf) — on night water and sand,
// at game scale and zoomed, with a 55-unit hull for size.
//   node regatta/eval/_glowtide_bench.js <out.png>     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => {
    const out = process.argv[2] || '/tmp/glowtide_bench.png';
    const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 1100 } });
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
    await p.evaluate(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'glowtide', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); resetGame();
        const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1500; c.height = 1100; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999';
        document.body.appendChild(c); const g = c.getContext('2d'); g.fillStyle = '#1a3f5c'; g.fillRect(0, 0, 1500, 1100); g.fillStyle = '#b89b6e'; g.fillRect(0, 880, 1500, 220);
        const lab = (s, x, y) => { g.fillStyle = 'rgba(255,255,255,0.9)'; g.font = '11px sans-serif'; g.fillText(s, x, y); };
        const hull = (x, y) => { g.save(); g.translate(x, y); g.fillStyle = '#f2f2f2'; g.strokeStyle = '#333'; g.lineWidth = 0.6;
            g.beginPath(); g.moveTo(0, -27.5); g.bezierCurveTo(9, -14, 9, 12, 6.5, 27.5); g.lineTo(-6.5, 27.5); g.bezierCurveTo(-9, 12, -9, -14, 0, -27.5); g.fill(); g.stroke(); g.restore(); };
        const put = (x, y, s, fn) => { g.save(); g.translate(x, y); g.scale(s, s); fn(); g.restore(); };
        const jel = (x, y, size, depth, ph) => ({ x, y, h: 0.3, size, depth, ph, spots: Math.floor(x * 7 + y * 13) });
        const man = (o) => Object.assign({ x: 0, y: 0, h: 0, beat: 0, pitch: 0, sparks: [] }, o);
        const turtle = (o) => Object.assign({ x: 0, y: 0, h: 0, beat: 0.8, up: 0.6, ring: 0, mode: 'swim', sand: [] }, o);
        const dug = (o) => Object.assign({ x: 0, y: 0, h: 0, beat: 0, up: 0, ring: 0, puff: 0, trail: [], silt: 1, len: 52, calf: null }, o);
        // game scale row
        lab('GAME SCALE', 10, 20); hull(40, 80);
        put(110, 80, 1, () => { for (let i = 0; i < 14; i++) A.drawGoldJelly(g, jel((i % 5) * 9 - 18, Math.floor(i / 5) * 9 - 9, 0.7 + (i % 4) * 0.18, (i % 3) * 0.35, i)); });
        put(210, 80, 1, () => A.drawManta(g, man({})));
        put(310, 80, 1, () => A.drawFlyingFox(g, { x: 0, y: 0, h: 0, z: 60, flap: 1.6 }));
        put(400, 80, 1, () => A.drawHawksbill(g, turtle({})));
        put(480, 80, 1, () => A.drawDugong(g, dug({ calf: { x: 18, y: 10, h: 0, beat: 1, len: 29, up: 0 } })));
        // zoomed
        lab('golden jellies 4x (surface → deep, pulsing)', 10, 160); for (let i = 0; i < 6; i++) put(50 + i * 60, 210, 4, () => A.drawGoldJelly(g, jel(0, 0, 1.1, i * 0.18, i * 0.9)));
        lab('bloom 1.5x', 420, 160); put(560, 230, 1.5, () => { for (let i = 0; i < 160; i++) { const a = i * 2.4 + Math.sin(i * 7.1), d = Math.sqrt(i) * 4.6 + Math.sin(i * 3.3) * 3; A.drawGoldJelly(g, jel(Math.cos(a) * d, Math.sin(a) * d, 0.6 + (i % 5) * 0.14, (i % 4) * 0.25, i * 1.3)); } });
        lab('manta 2x: travelling (horns rolled) · feeding (fins unfurled, mouth open) · stroke down · somersault · on its back', 700, 160);
        [{ mode: 'travel', beat: 1.6 }, { mode: 'feed', beat: 1.6, ceph: 1 }, { mode: 'feed', beat: -1.6, ceph: 1 }, { mode: 'loop', pitch: 1.2, ceph: 1 }, { mode: 'loop', pitch: Math.PI, ceph: 1 }].forEach((o, i) => put(760 + i * 150, 240, 2, () => A.drawManta(g, man(o))));
        lab('flying fox 3x — one beat, 8 phases', 10, 350); for (let i = 0; i < 8; i++) put(60 + i * 120, 420, 3, () => A.drawFlyingFox(g, { x: 0, y: 0, h: 0, z: 0, flap: i / 8 * Math.PI * 2 }));
        lab('hawksbill 4x: swimming, stroke phases', 10, 520); for (let i = 0; i < 4; i++) put(70 + i * 140, 600, 4, () => A.drawHawksbill(g, turtle({ beat: i * 1.6, up: 1 })));
        lab('dugong 2.4x: grazing (with trail + silt) · breathing · mother and calf', 620, 520);
        put(700, 620, 2.4, () => A.drawDugong(g, dug({ trail: [1, 2, 3, 4, 5, 6].map(k => ({ x: 0, y: 26 + k * 6, h: 0, age: k * 8 })) })));
        put(900, 620, 2.4, () => A.drawDugong(g, dug({ up: 1, ring: 0.6, puff: 0.6, silt: 0 })));
        put(1150, 620, 2.4, () => A.drawDugong(g, dug({ up: 0.5, calf: { x: 18, y: 10, h: 0, beat: 1, len: 29, up: 0.5 } })));
        lab('hawksbill nesting on the sand 3x, with its track (staggered flipper marks)', 10, 900);
        put(200, 990, 3, () => { const H = turtle({ mode: 'nest', beat: 0.5, tracks: [Array.from({ length: 14 }, (_, k) => ({ x: 0, y: 18 + k * 2.2, h: 0, side: k % 2 ? 1 : -1 }))], sand: [{ x: -4, y: 14, age: 0.3 }, { x: 3, y: 16, age: 0.5 }] }); A.drawTurtleTracks(g, H); A.drawHawksbill(g, H); });
        hull(1400, 990);
    });
    await p.screenshot({ path: out }); await b.close(); console.log('wrote', out);
})();
