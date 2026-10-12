// The hub at four progress levels (new, early, experienced, completed): full screenshots of seeded
// test players, combined 2x2 by the caller. Never touches a real profile — a fresh browser each.
//   node regatta/eval/rl/_hub_levels.js <outdir>
const { chromium } = require('playwright'); const path = require('path');
const S = (process.argv[2] || '.') + '/';
const today = (() => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); })();
const ALL = ['bay', 'lake', 'lagoon', 'swamp', 'river', 'ocean', 'redrock', 'glowtide', 'arctic', 'volcanic', 'otter', 'flats', 'seatrials'];
const players = {
    New: { who: 'Finley', progress: {}, trophies: {}, career: {}, fleet: {}, trials: {} },
    Early: { who: 'Gasket', progress: { graduated: true }, trophies: { commodore: { sailed: 1, best: 3 } }, career: { races: 5, finishes: 5, wins: 0, podiums: 2, distM: 9800, topSpeed: 11.6, distV: 3, winStreak: 0, podiumStreak: 1, dayStreak: 1, lastDay: today }, fleet: { bay: [2, 2], lake: [4, 1] }, trials: {} },
    Experienced: { who: 'Muninn', progress: { graduated: true }, trophies: { commodore: { sailed: 2, won: true, best: 1, stars: 2 }, explorer: { sailed: 1, best: 4 }, series: { sailed: 3, byLen: { 4: { sailed: 2, won: true, best: 1 } } } }, career: { races: 31, finishes: 30, wins: 9, podiums: 17, distM: 68000, topSpeed: 14.2, distV: 3, winStreak: 2, podiumStreak: 5, dayStreak: 4, lastDay: today }, fleet: { bay: [1, 4], lake: [1, 3], swamp: [2, 1], glowtide: [1, 2], ocean: [3, 1], otter: [1, 3] }, trials: { otter: -15, bay: -14, lake: -80 } },
    Completed: { who: 'Torch', progress: { graduated: true }, trophies: { commodore: { sailed: 4, won: true, best: 1, stars: 4 }, explorer: { sailed: 3, won: true, best: 1, stars: 4 }, swirl: { sailed: 3, won: true, best: 1, stars: 4 }, series: { sailed: 12, byLen: { 4: { won: true }, 6: { won: true }, 8: { won: true }, 10: { won: true }, 12: { won: true } } } }, career: { races: 120, finishes: 118, wins: 61, podiums: 97, distM: 260000, topSpeed: 15.8, distV: 3, winStreak: 7, podiumStreak: 12, dayStreak: 9, lastDay: today }, fleet: Object.fromEntries(ALL.map(v => [v, [1, 4]])), trials: Object.fromEntries(ALL.map(v => [v, -5])) },
};
(async () => {
    const b = await chromium.launch();
    for (const [name, P] of Object.entries(players)) {
        const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
        p.on('pageerror', e => console.log('PAGE ERROR', e.message));
        await p.addInitScript(P => { localStorage.setItem('regatta_progress', JSON.stringify(P.progress)); localStorage.setItem('regatta_trophies', JSON.stringify(P.trophies)); localStorage.setItem('regatta_career', JSON.stringify(P.career)); const s = JSON.parse(localStorage.getItem('regatta_settings') || '{}'); s.character = P.who; localStorage.setItem('regatta_settings', JSON.stringify(s)); }, P);
        await p.goto('file://' + path.resolve(__dirname, '../../index.html')); await p.waitForTimeout(1500);
        // trial times relative to each venue's time to beat (negative = under it: a record)
        await p.evaluate(P => { const b = {}; for (const [v, [pos, st]] of Object.entries(P.fleet)) b[v + ':' + recordsVenueHash(v) + ':f'] = { bestPos: pos, stars: st }; for (const [v, d] of Object.entries(P.trials)) { const tb = provisionalRecord(v) || 240; b[v + ':' + recordsVenueHash(v) + ':t'] = { t: tb + d }; } localStorage.setItem('regatta_bests', JSON.stringify(b)); refreshClubhouse(); }, P);
        await p.waitForTimeout(900);
        await p.screenshot({ path: S + 'full_' + name + '.png' });
        await p.close();
    }
    await b.close();
})();
