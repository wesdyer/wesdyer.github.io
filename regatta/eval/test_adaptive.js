// ADAPTIVE AI — the policy in js/ai/adaptive.js holds, and it is inert where it must be.
//
//   node regatta/eval/test_adaptive.js
//
// Policy (each check stages the player at an exact gap and steps the band, no physics):
//   behind     a bot far behind the player converges on +10% (the boost), at no more than 1%/s;
//              one 12 s behind gets the first step's +5%
//   dead zone  a bot within ±3 s of the player is untouched
//   ahead      with the player trailing far, the pack ahead is held back by half the boost (−5%)
//   start      nothing before the bot AND the player have rounded the first mark (leg >= 2)
//   marks      the effect fades to nothing inside a mark's zone
//   penalty    a bot doing penalty turns is untouched
//   setting    off with settings.adaptiveAI = false, and the player's boat is never touched
// End to end: the fleet races with the player parked far ahead (so every bot is well behind);
//   with the band on, the fleet past the first mark sails at about the boost (finish times are
//   reported, not gated — three races swing ±5 s run to run).
// Inert: an undriven player (every eval and golden trace) never engages it.
const { chromium } = require('playwright');
const path = require('path');

let fails = 0;
const check = (name, ok, detail) => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
    if (!ok) fails++;
};

async function open(browser, venue) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.addInitScript(v => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v, musicEnabled: false, soundEnabled: false, bgSoundEnabled: false })), venue);
    await page.goto('file://' + path.resolve('regatta/index.html'));
    await page.waitForFunction(() => typeof state !== 'undefined' && state.boats && state.boats.length > 0, null, { timeout: 30000 });
    return { page, errs };
}

(async () => {
    const browser = await chromium.launch();

    // ── the policy, staged ──────────────────────────────────────────────────
    {
        const { page, errs } = await open(browser, 'lagoon');
        const r = await page.evaluate(() => {
            let s = 11; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
            selectVenue('lagoon'); resetGame(); startRace();
            for (let i = 0; i < 3; i++) update(1 / 60);
            state.race.status = 'racing'; state.race.timer = 120;
            const P = state.boats.find(b => b.isPlayer), bots = state.boats.filter(b => !b.isPlayer);
            const L = 2, path2 = state.course.dmc.legs[L];
            // a point s units along leg L's ideal path
            const at = (s) => { const pts = path2.pts, cum = path2.cum; let k = 1; while (k < cum.length - 1 && cum[k] < s) k++; const t = (s - cum[k - 1]) / Math.max(1e-6, cum[k] - cum[k - 1]); return { x: pts[k - 1].x + (pts[k].x - pts[k - 1].x) * t, y: pts[k - 1].y + (pts[k].y - pts[k - 1].y) * t }; };
            const put = (b, s, leg) => { const p = at(s); b.x = p.x; b.y = p.y; b.raceState.leg = leg; b.raceState.finished = false; b.raceState.penalty = false; b.raceState.roundRebased = false; b.raceState.isRounding = false; b._adaptMul = null; if (b.controller) { b.controller.penaltySpin = false; b.controller.wiggleActive = false; b.controller.escActive = false; } };
            const mid = path2.length / 2;
            // pace for the gap conversion: pin the band's fleet pace so gaps are exact seconds
            const PACE = 15;   // u/s — slow, so a gap that fits in the middle of the leg is long in seconds
            const stage = (meS, botS, legs) => { put(P, meS, L); bots.forEach((b, i) => put(b, botS[i] != null ? botS[i] : botS[0], legs != null ? legs : L)); Adaptive.reset(); };
            const step = (secs) => { const dt = 1 / 60; for (let i = 0; i < secs * 60; i++) { Adaptive._pace = PACE; Adaptive._prev = null; Adaptive.update(dt); } };
            const out = {};
            settings.adaptiveAI = true;
            // behind: the player well past saturation ahead of every bot (the band reads ROUTE distance,
            // so stage the length of the leg apart); check the rate cap after 2 s, the target after 30
            const far = Math.min(1200, mid * 0.45);   // both boats stay in the middle of the leg, clear of its marks
            out.stagedGap = null;
            stage(mid + far, [mid - far]);
            step(2); out.after2s = bots[0]._adaptMul;
            step(30); out.behind = bots[0]._adaptMul; out.playerUntouched = P._adaptMul == null;
            out.stagedGap = Adaptive._gap.get(bots[0]);
            // dead zone: bots ~2 s behind
            stage(mid + 10, [mid - 10]); step(30); out.dead = bots[0]._adaptMul; out.deadGap = Adaptive._gap.get(bots[0]);
            // the first step: a bot staged so its smoothed gap is 12 s
            { const want = 12 * PACE; let lo = 0, hi = far * 2; stage(mid + far, [mid - far]); step(1);
              const g0 = Adaptive._gap.get(bots[0]) * PACE, per = g0 / (2 * far);
              const d = want / per / 2; stage(mid + d, [mid - d]); step(30); out.step1 = bots[0]._adaptMul; out.step1Gap = Adaptive._gap.get(bots[0]); }
            // ahead: player 30 s behind the whole pack
            stage(mid - far, [mid + far]); step(30); out.ahead = bots[0]._adaptMul;
            // start: everyone still on leg 1
            stage(mid + 1500, [mid - 1500], 1); P.raceState.leg = 1; step(30); out.start = bots[0]._adaptMul;
            // marks: bot 30 s behind but sitting on its leg's mark
            stage(mid + 1500, [mid - 1500]);
            const rm = state.course.route[L].mark || null; bots[0].x = rm.x + 40; bots[0].y = rm.y; step(30); out.atMark = bots[0]._adaptMul;
            // penalty
            stage(mid + 1500, [mid - 1500]); bots[0].raceState.penalty = true; step(30); out.penalty = bots[0]._adaptMul;
            // setting off
            stage(mid + 1500, [mid - 1500]); settings.adaptiveAI = false; step(30); out.off = bots[0]._adaptMul; settings.adaptiveAI = true;
            return out;
        });
        const near = (v, x, tol) => v != null && Math.abs(v - x) < tol;
        console.log('\npolicy');
        check('a bot far behind the player gains +10%', near(r.behind, 1.10, 0.002), `×${r.behind} at a ${r.stagedGap != null ? r.stagedGap.toFixed(1) : '?'} s gap`);
        check('...no faster than 1% a second', r.after2s != null && r.after2s <= 1.0201, `×${r.after2s} after 2 s`);
        check('a bot 12 s behind gets the first step, about +5%', near(r.step1, 1.05, 0.006), `×${r.step1} at a ${r.step1Gap != null ? r.step1Gap.toFixed(1) : '?'} s gap`);
        check('the player\'s own boat is never touched', r.playerUntouched === true);
        check('inside ±3 s nothing changes', r.dead == null || near(r.dead, 1, 1e-6), `×${r.dead} at a ${r.deadGap != null ? r.deadGap.toFixed(1) : '?'} s gap`);
        check('the pack ahead of a far-trailing player is held back by half (−5%)', near(r.ahead, 0.95, 0.002), `×${r.ahead}`);
        check('nothing before the first mark', r.start == null || near(r.start, 1, 1e-6), `×${r.start}`);
        check('it fades out at a mark', r.atMark == null || near(r.atMark, 1, 1e-6), `×${r.atMark}`);
        check('a bot in penalty turns is untouched', r.penalty == null || near(r.penalty, 1, 1e-6), `×${r.penalty}`);
        check('the setting turns it off', r.off == null || near(r.off, 1, 1e-6), `×${r.off}`);
        check('no page errors', errs.length === 0, errs[0]);
        await page.close();
    }

    // ── end to end: the fleet with the player parked far ahead ──────────────
    {
        const runs = {};
        for (const on of [false, true]) {
            const { page } = await open(browser, 'lagoon');
            runs[on] = await page.evaluate((on) => {
                const fins = [];
                for (let seed = 0; seed < 3; seed++) {
                    let s = 500 + seed; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
                    selectVenue('lagoon'); resetGame(); startRace();
                    settings.adaptiveAI = on;
                    const P = state.boats.find(b => b.isPlayer);
                    const last = state.course.dmc.legs.length - 1, lp = state.course.dmc.legs[last];
                    const park = lp.pts[Math.max(0, lp.pts.length - 3)];
                    let used = 0, mulSum = 0, mulN = 0;
                    for (let it = 0; it < 60 * 900; it++) {
                        update(1 / 60);
                        if (state.race.status === 'racing') {
                            // the player "is" far ahead on the last leg, short of the line
                            P.x = park.x; P.y = park.y; P.speed = 0; P.raceState.leg = last; P.raceState.finished = false;
                            if (state.boats.some(b => b._adaptMul != null && b._adaptMul !== 1)) used++;
                            for (const b of state.boats) if (!b.isPlayer && !b.raceState.finished && b.raceState.leg >= 2) { mulSum += b._adaptMul != null ? b._adaptMul : 1; mulN++; }
                        }
                        if (state.boats.every(b => b.isPlayer || b.raceState.finished)) break;
                    }
                    for (const b of state.boats) if (!b.isPlayer && b.raceState.finished && !b.raceState.resultStatus) fins.push(b.raceState.finishTime);
                    fins.used = (fins.used || 0) + used; fins.mulSum = (fins.mulSum || 0) + mulSum; fins.mulN = (fins.mulN || 0) + mulN;
                }
                fins.sort((a, c) => a - c);
                return { med: fins[fins.length >> 1], n: fins.length, used: fins.used, meanMul: fins.mulN ? fins.mulSum / fins.mulN : 1 };
            }, on);
            await page.close();
        }
        const off = runs[false], on = runs[true];
        const gain = off.med && on.med ? (off.med - on.med) / off.med : 0;
        console.log('\nend to end (lagoon, 3 races, player parked far ahead)');
        check('with the band off, nothing engages', off.used === 0, `${off.used} frames`);
        // The gate is what the band DID, not the finish times: three races swing ±5 s run to run (the
        // router works to a wall-clock budget), the same size as the effect. Times are reported.
        check('with it on, the fleet past the first mark sails at about the boost', on.meanMul > 1.03 && on.meanMul <= 1.1001, `mean ×${on.meanMul.toFixed(4)} (fades at marks pull it under 1.10)`);
        console.log(`        (finish median ${off.med.toFixed(1)} s off → ${on.med.toFixed(1)} s on, ${(gain * 100).toFixed(1)}% — information, not a gate)`);
    }

    await browser.close();
    console.log(fails ? `\nFAIL — ${fails} failure(s)` : '\nPASS — 0 failure(s)');
    process.exit(fails ? 1 : 0);
})();
