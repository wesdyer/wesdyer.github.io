// Emberfall Isle's weather (js/volcano.js): the eruption cycle, the plume's dead air, the
// vent boils, and lightning that fries a boat's electronics. Drives the real game in a
// headless page, the way test_render does, so the hooks in wind, physics, the bots and the
// HUD are exercised where they live.
//
// Usage: node regatta/eval/test_volcano.js   (from the repo root, like every suite)
const { chromium } = require('playwright');
const path = require('path');

let failures = 0;
const VOLCANO_AIM_FAR = 420;
const check = (name, cond, detail) => {
    console.log(`  ${cond ? 'ok   ' : 'FAIL '} ${name}${cond || !detail ? '' : ' — ' + detail}`);
    if (!cond) failures++;
};

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
    await page.goto('file://' + path.resolve('regatta/index.html'));
    await page.evaluate(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic' })));
    await page.reload();
    await page.waitForTimeout(700);

    const r = await page.evaluate(() => {
        window.requestAnimationFrame = () => 0;
        let s = 90210;
        Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        const out = { problems: [] };
        const attempt = (label) => { try { draw(); } catch (e) { out.problems.push(`${label}: ${e.message}`); } };
        resetGame();
        state.race.seed = 4242;
        // A seabed vent for the boil, whether or not the document places one.
        state.course.props.push({ id: 'test-vent', kind: 'volcanic-vent-underwater', x: state.boats[0].x + 600, y: state.boats[0].y,
                                  heading: 0, scale: 1, plane: 'seabed', motion: 'fixed', contact: 'none' });
        state.course._propGrid = null;
        Volcano.init();
        const v = state.volcano;
        out.active = !!v;
        if (!v) return out;
        out.cones = v.cones.filter(c => !c.steam).length;
        out.vents = v.vents.length;
        // Determinism: the same seed deals the same cycle.
        const deal = v.cones.map(c => [c.period.toFixed(3), c.phase.toFixed(4)].join('/')).join(',');
        Volcano.init();
        out.sameDeal = deal === state.volcano.cones.map(c => [c.period.toFixed(3), c.phase.toFixed(4)].join('/')).join(',');
        const V = state.volcano;
        const cone = V.cones.find(c => !c.steam);
        const vent = V.vents[0];
        startRace();
        // Quiet: the wisp costs nothing.
        for (let i = 0; i < 180; i++) update(1 / 60);
        const q = VOLCANO;
        const quiet = cone.period - q.build - q.peak - q.wane;
        const inQuiet = (c) => ((V.t / c.period + c.phase) % 1) * c.period < quiet;
        // Force this cone into its PEAK now, then run twelve seconds of eruption.
        cone.phase = (((quiet + q.build + 1) - V.t) / cone.period) % 1;
        if (cone.phase < 0) cone.phase += 1;
        for (let i = 0; i < 720; i++) update(1 / 60);
        out.intensity = cone.intensity;
        out.heat = cone.p.heat; out.activity = cone.p.activity;   // must stay untouched
        out.parcels = cone.parcels.length;
        // Dead air: sample along the plume — its parcels — and take the deepest hole.
        let deepest = 1, tail = 1;
        for (const p of cone.parcels) deepest = Math.min(deepest, Volcano.windMul(p.x, p.y));
        const oldest = cone.parcels.reduce((a, b) => (a && a.age > b.age) ? a : b, null);
        if (oldest) tail = Volcano.windMul(oldest.x, oldest.y);
        out.deepest = deepest; out.tail = tail; out.oldestAge = oldest ? oldest.age : 0;
        // getWindAt sees it too — sampled a few seconds down the plume, where the parcel has
        // finished fading in (a newborn one is still thin by design).
        const young = cone.parcels.reduce((a, b) => (a && Math.abs(a.age - 3) < Math.abs(b.age - 3)) ? a : b, null);
        if (young) {
            const at = getWindAt(young.x, young.y).speed, mean = regionWindAt(young.x, young.y).speed;
            out.windUnder = at; out.windMean = mean;
        }
        out.farMul = Volcano.windMul(cone.x + 40000, cone.y + 40000);
        // The boil: broken water over the vent, none a boat length outside it.
        out.boilCore = Volcano.boilAt(vent.x, vent.y);
        out.boilOut = Volcano.boilAt(vent.x + vent.r + 40, vent.y);
        // Lightning: force a strike beside the player and read the outage.
        const player = state.boats[0];
        const bot = state.boats.find(b => !b.isPlayer);
        bot.x = player.x + 120; bot.y = player.y + 40;
        const far = state.boats.find(b => !b.isPlayer && b !== bot);
        far.x = player.x + 5000; far.y = player.y + 5000;
        const mid = state.boats.find(b => !b.isPlayer && b !== bot && b !== far);
        mid.x = player.x + 100; mid.y = player.y + 480;
        // AIM: with the player under the cloud, most strikes are dealt near a boat.
        let near = 0, dealt = 0;
        for (let i = 0; i < 40; i++) {
            // Pin the player under the cloud each time: the parcels drift, the boat sails.
            const underCloud = cone.parcels.filter(p => p.age > 2 && p.age < 8);
            // Measured against where the boats WERE when the strike was dealt: the plume is
            // over the isle here, and the physics shoves a boat pinned onto land.
            const pinned = { x: underCloud[0].x, y: underCloud[0].y };
            player.x = pinned.x; player.y = pinned.y; player.speed = 0;
            const others = state.boats.filter(b => b !== player).map(b => ({ x: b.x, y: b.y }));
            cone.pending = null; cone.nextStrike = 0;
            update(1 / 60);
            if (!cone.pending) continue;
            dealt++;
            let best = Infinity;
            for (const b of [pinned].concat(others)) best = Math.min(best, Math.hypot(b.x - cone.pending.x, b.y - cone.pending.y));
            if (best <= VOLCANO.aimFar + 1) near++;
        }
        out.aimDealt = dealt; out.aimNear = near;
        cone.pending = null;
        cone.pending = { ox: cone.x, oy: cone.y, x: player.x + 100, y: player.y, at: V.t, seed: 7 };
        bot.x = player.x + 120; bot.y = player.y + 40;
        mid.x = player.x + 100; mid.y = player.y + 480;
        update(1 / 60);
        out.strikes = V.strikes.length;
        out.thunder = Sound._lastThunder || null;
        out.playerFried = Volcano.isFried(player);
        out.botFried = Volcano.isFried(bot);
        out.farFried = Volcano.isFried(far);
        out.midDur = Volcano.fryOf(mid) ? Volcano.fryOf(mid).dur : 0;
        out.botDur = Volcano.fryOf(bot) ? Volcano.fryOf(bot).dur : 0;
        out.hud = ['rose', 'instruments', 'minimap', 'nav', 'leaderboard'].map(s => Volcano.hudFried(s));
        out.glitch = Volcano.glitch();
        // Drawing through the strike, the flash and the fried HUD must not throw.
        for (const aids of [false, true]) { state.showNavAids = aids; attempt(`strike aids=${aids}`); }
        for (let i = 0; i < 12; i++) { update(1 / 60); attempt(`strike +${i}`); }
        out.lbClass = document.getElementById('leaderboard') && document.getElementById('leaderboard').classList.contains('fried');
        // Staggered reboot: the rose is back before the leaderboard.
        const f = Volcano.fryOf(player);
        const dur = f ? f.dur : 0;
        out.fryDur = dur;
        for (let i = 0; i < Math.ceil(dur * 0.62 * 60); i++) update(1 / 60);
        out.midway = ['rose', 'leaderboard'].map(s => Volcano.hudFried(s));
        for (let i = 0; i < Math.ceil(dur * 0.5 * 60); i++) update(1 / 60);
        out.after = Volcano.isFried(player) || Volcano.isFried(bot);
        attempt('after');
        // The cycle: over one full period the cone goes quiet and erupts once more.
        let sawQuiet = false, sawPeak = false;
        for (let i = 0; i < Math.ceil(cone.period * 60); i += 1) { update(1 / 60); if (cone.intensity === 0) sawQuiet = true; if (cone.intensity === 1) sawPeak = true; }
        out.cycle = sawQuiet && sawPeak;
        return out;
    });

    check('the venue has an eruption cycle', r.active, 'state.volcano is null');
    if (r.active) {
        check(`cones (${r.cones}) and vents (${r.vents}) found`, r.cones >= 1 && r.vents >= 1);
        check('the cycle is dealt from the seed', r.sameDeal);
        check(`forced peak: intensity ${r.intensity}; lava untouched (heat ${r.heat}, activity ${r.activity})`, r.intensity === 1 && r.heat == null && r.activity == null);
        check(`plume has parcels (${r.parcels})`, r.parcels >= 8);
        check(`dead air under the plume: deepest x${r.deepest.toFixed(2)}, far x${r.farMul}`, r.deepest < 0.5 && r.farMul === 1);
        check(`dissipates downwind: tail x${r.tail.toFixed(2)} at ${r.oldestAge.toFixed(1)} s`, r.tail > r.deepest);
        check(`getWindAt reads it: ${r.windUnder.toFixed(2)} of ${r.windMean.toFixed(2)} kn`, r.windUnder < r.windMean * 0.6);
        check(`boil: ${r.boilCore.toFixed(2)} at the vent, ${r.boilOut} outside`, r.boilCore > 0.3 && r.boilOut === 0);
        check(`strikes aim at the fleet: ${r.aimNear} of ${r.aimDealt} dealt within ${VOLCANO_AIM_FAR} of a boat`, r.aimDealt >= 30 && r.aimNear >= r.aimDealt * 0.5);
        check(`strike fires (${r.strikes}) and fries player/near bot, not the far boat: ${r.playerFried}/${r.botFried}/${r.farFried}`,
              r.strikes === 1 && r.playerFried && r.botFried && !r.farFried);
        check(`thunder: ${r.thunder ? r.thunder.delay.toFixed(2) + ' s late, near ' + r.thunder.near.toFixed(2) + ' far ' + r.thunder.far.toFixed(2) : 'none'}`,
              !!r.thunder && r.thunder.delay < 0.1 && r.thunder.near > 0.8 && r.thunder.far > 0.2 && r.thunder.far < r.thunder.near);
        check(`outage scales with proximity: ${r.botDur.toFixed(1)} s at 45 u, ${r.midDur.toFixed(1)} s at 480 u`, r.botDur > 6 && r.midDur > 0.8 && r.midDur < r.botDur * 0.4);
        check(`every HUD system down at the strike: ${r.hud.join(',')}, glitch ${r.glitch}`, r.hud.every(Boolean) && r.glitch >= 0.9);
        check('the leaderboard wears .fried', r.lbClass === true);
        check(`staggered reboot at 62% of ${r.fryDur.toFixed(1)} s: rose ${r.midway[0]}, leaderboard ${r.midway[1]}`, r.midway[0] === false && r.midway[1] === true);
        check('everyone recovers', r.after === false);
        check('the cone goes quiet and erupts again over one period', r.cycle);
        check('draw() survives the strike, the flash and the fried HUD', r.problems.length === 0, r.problems.slice(0, 3).join(' | '));
    }
    check('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));

    await browser.close();
    console.log(`\n${failures ? 'FAIL' : 'PASS'} — volcano: ${failures} problem(s)`);
    process.exitCode = failures ? 1 : 0;
})();
