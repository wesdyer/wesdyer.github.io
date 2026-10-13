// PT-094 end to end at Emberfall: the path line is drawn while the electronics work, not while lightning
// has them fried, and comes back with them.   node regatta/eval/rl/_fried_path.js
const { chromium } = require('playwright'); const path = require('path');
(async () => {
    const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
    p.on('pageerror', e => console.log('PAGE ERROR', e.message));
    await p.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic', musicEnabled: false, soundEnabled: false, bgSoundEnabled: false })));
    await p.goto('file://' + path.resolve(__dirname, '../../index.html')); await p.waitForTimeout(1500);
    const r = await p.evaluate(() => {
        TimeTrial.active = true; selectVenue('volcanic'); resetGame(); state.boats.length = 1; startRace();
        while (state.race.status === 'prestart') update(1 / 30);
        let n = 0; const orig = GoalField.drawPath; GoalField.drawPath = function () { n++; return orig.apply(this, arguments); };
        const frames = (k) => { n = 0; for (let i = 0; i < k; i++) { update(1 / 30); draw(); } return n; };
        const me = state.boats[0], v = state.volcano, out = {};
        out.before = frames(30);
        v.fry.set(me, { t0: v.t, dur: 4 }); me.fried = v.fry.get(me);
        out.friedNav = Volcano.hudFried('nav');
        out.during = frames(60);
        out.after = (frames(120), frames(30));
        out.navBack = !Volcano.hudFried('nav');
        GoalField.drawPath = orig;
        return out;
    });
    console.log(JSON.stringify(r));
    console.log(r.before > 0 && r.friedNav && r.during === 0 && r.after > 0 && r.navBack ? 'PASS' : 'FAIL');
    await b.close();
})();
