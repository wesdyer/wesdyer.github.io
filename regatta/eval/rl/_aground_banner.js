// PT-086 end to end at Spoonbill Flats: ground the player, step the race with the HUD drawn, and
// read the banner — it must count down while she is aground and be gone once she floats.
//   node regatta/eval/rl/_aground_banner.js
const { chromium } = require('playwright'); const path = require('path');
(async () => {
    const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
    p.on('pageerror', e => console.log('PAGE ERROR', e.message));
    await p.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'flats', musicEnabled: false, soundEnabled: false, bgSoundEnabled: false })));
    await p.goto('file://' + path.resolve(__dirname, '../../index.html')); await p.waitForTimeout(1500);
    const r = await p.evaluate(() => {
        TimeTrial.active = true; selectVenue('flats'); resetGame(); state.boats.length = 1; startRace();
        while (state.race.status === 'prestart') update(1 / 30);
        const me = state.boats[0], home = { x: me.x, y: me.y };
        const step = (n, at) => { for (let i = 0; i < n; i++) { if (at) { me.x = at.x; me.y = at.y; } update(1 / 30); try { draw(); } catch (e) { tickAgroundBanner(me); } } };
        const msg = () => (UI.message.classList.contains('hidden') ? '(hidden)' : UI.message.textContent);
        // a shoal that is dry now and floats in 5–8 s on the flood: ground there, so the countdown runs
        const T = state.tide, F = T.field, L = Tide.level(), t0 = Tide.clock();
        const cands = [];
        for (let j = 2; j < F.H - 2; j += 3) for (let i = 2; i < F.W - 2; i += 3) {
            const x = F.x0 + i * F.res, y = F.y0 + j * F.res, z = Tide.groundAt(x, y);
            if (L - z >= T.draft) continue;                      // afloat here now
            const r = Tide.nextReach(z + T.draft + T.refloat, t0);
            if (r != null && r > 5 && r < 8) cands.push({ x, y, r });
        }
        // ...and open mud, not inside a marsh island's collider (that pushes the hull off it): she
        // must ground WHERE she was put, so step onto each until one holds her
        let dry = null;
        for (let k = 0; k < cands.length && !dry; k += 7) {
            const c = cands[k]; me.aground = false;
            me.x = c.x; me.y = c.y; update(1 / 30);
            if (me.aground && Math.hypot(me.x - c.x, me.y - c.y) < 40 && Tide.refloatIn(me) != null) dry = c;
        }
        if (!dry) return [['no open shoal that floods in 5-8 s right now', '', '']];
        if (UI.message) { UI.message.classList.add('hidden'); delete UI.message.dataset.aground; }
        me.aground = false;
        const log = [];
        step(2, dry); log.push(['grounded', me.aground, msg()]);
        for (let k = 1; k <= 8 && me.aground; k++) { step(15, dry); log.push(['+' + (k / 2) + 's', me.aground, msg()]); }
        // the tide floats her where she sits
        let n = 0; while (me.aground && n++ < 2100) step(1, dry);
        step(2); log.push(['afloat after ' + (n / 30).toFixed(1) + 's', me.aground, msg()]);
        return log;
    });
    for (const row of r) console.log(row.join('  |  '));
    await b.close();
})();
