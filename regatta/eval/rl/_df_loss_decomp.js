// WHERE DO THE DEFLECTION-LANDING CLOCK LOSSES COME FROM? Paired per-slot
// decomposition from existing bench JSONs: group each boat-seed slot by
// whether its penalties / boat contacts went up, and report each group's
// share of the venue's total paired clock delta.
//   node _df_loss_decomp.js
const fs = require('fs'); const path = require('path');
const VENUES = {
    glowtide: [['dfbglow', 'dfdglow']],
    lake: [['cmblk6100', 'dfdlk6100'], ['cmblk6200', 'dfdlk6200']],
    arctic: [['dfbarc9400', 'dfdarc9400'], ['dfbarc9600', 'dfdarc9600']],
    river: [['dfbriv9400', 'dfdriv9400'], ['dfbriv9408', 'dfdriv9408'], ['dfbriv9500', 'dfdriv9500']],
    bay: [['dfbbay9400', 'dfdbay9400'], ['dfbbay9600', 'dfdbay9600']],
    redrock: ['9400', '9500', '9600', '9700', '9800', '9900'].map(s => ['dfbrr' + s, 'dfdrr' + s]),
    swamp: ['9400', '9500', '9600'].map(s => ['dfbsw' + s, 'dfdsw' + s]),
};
const load = l => JSON.parse(fs.readFileSync(path.join(__dirname, `ocean_bench_${l}.json`), 'utf8'));
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
for (const [v, pairs] of Object.entries(VENUES)) {
    const slots = [];
    for (const [bl, cl] of pairs) {
        const A = load(bl), B = load(cl);
        const bySeed = arr => Object.fromEntries(arr.map(t => [t.seed, t]));
        const bA = bySeed(A), bB = bySeed(B);
        for (const seed of Object.keys(bA)) {
            if (!bB[seed]) continue;
            const mapB = Object.fromEntries(bB[seed].info.map(x => [x.name, x]));
            for (const a of bA[seed].info) {
                const b = mapB[a.name];
                if (!b || a.fin == null || b.fin == null) continue;
                slots.push({ d: b.fin - a.fin,
                    dPen: (b.pen || 0) - (a.pen || 0),
                    dBoat: ((b.col && b.col.boat) || 0) - ((a.col && a.col.boat) || 0),
                    dLand: ((b.col && b.col.land) || 0) - ((a.col && a.col.land) || 0) });
            }
        }
    }
    const tot = slots.reduce((x, s) => x + s.d, 0);
    const grp = (name, f) => {
        const g = slots.filter(f);
        const sum = g.reduce((x, s) => x + s.d, 0);
        return `${name}: n=${g.length} meanΔ=${mean(g.map(s => s.d)).toFixed(1)} carries ${sum.toFixed(0)}s`;
    };
    console.log(`\n=== ${v} — n=${slots.length} paired, total clock Δ ${tot.toFixed(0)}s (mean ${mean(slots.map(s => s.d)).toFixed(2)}/boat) ===`);
    console.log('  ' + grp('penUP  ', s => s.dPen > 0));
    console.log('  ' + grp('penSAME', s => s.dPen === 0));
    console.log('  ' + grp('penDOWN', s => s.dPen < 0));
    console.log('  ' + grp('boatUP ', s => s.dBoat > 0));
    console.log('  ' + grp('boatDN ', s => s.dBoat < 0));
    console.log('  ' + grp('landUP ', s => s.dLand > 0));
}
