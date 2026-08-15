// EARLY, PARTIAL, PAIRED-BY-SEED READ OFF A RUNNING BENCH (2026-08-13).
//
// `ocean_bench.js` writes its JSON only at the end, but it prints one line per seed
// as it goes: `seed N: finishers K finT a,b,c,...`. Under a loaded machine a 16-seed
// glowtide bench takes hours, and waiting for the file to decide what to launch next
// wastes the night. This pairs whatever seeds BOTH sides have finished so far.
//
// ⚠️ It pairs by SEED, not by boat — the log has no names — so it compares the
// per-race MEAN and MEDIAN of the finishers, not per-boat deltas. That is the right
// statistic anyway on this venue (`_owner_metrics` on two disjoint baseline sets:
// the 16-seed mean is stable to 0.2 s while the median swings 15 s), but it is a
// SCREEN, not a verdict. The verdict is `_pool_rr.js` / `_owner_metrics.js` on the
// finished JSONs, paired per boat.
//
//   node _logdelta.js <baseLabelOrLog> <candLog> [more pairs...]
// A base argument that names an existing ocean_bench_<label>.json is read from the
// JSON (so a finished baseline needs no log file).
const fs = require('fs'); const path = require('path');
const readSeeds = (arg) => {
    const j = path.join(__dirname, `ocean_bench_${arg}.json`);
    const out = {};
    if (fs.existsSync(j)) {
        for (const e of JSON.parse(fs.readFileSync(j, 'utf8'))) {
            const f = e.info.filter(b => b.fin != null).map(b => b.fin).sort((a, b) => a - b);
            out[e.seed] = { fins: f, n: e.info.length };
        }
        return out;
    }
    const l = fs.existsSync(arg) ? arg : path.join(__dirname, arg);
    if (!fs.existsSync(l)) return null;
    for (const line of fs.readFileSync(l, 'utf8').split('\n')) {
        const m = line.match(/^seed (\d+): finishers (\d+) finT (.*)$/);
        if (!m) continue;
        const f = m[3].split(',').filter(x => x.length).map(Number).sort((a, b) => a - b);
        out[+m[1]] = { fins: f, n: null };
    }
    return out;
};
const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };

const args = process.argv.slice(2);
for (let i = 0; i + 1 < args.length; i += 2) {
    const B = readSeeds(args[i]), C = readSeeds(args[i + 1]);
    console.log(`\n=== ${args[i]}  ->  ${args[i + 1]} ===`);
    if (!B || !C) { console.log('  (missing input)'); continue; }
    const seeds = Object.keys(B).map(Number).filter(s => C[s]).sort((a, b) => a - b);
    if (!seeds.length) { console.log('  (no overlapping seeds yet)'); continue; }
    const dMean = [], dMed = [], dWorst = [];
    let finB = 0, finC = 0, allB = [], allC = [];
    console.log('   seed |  base mean  cand mean   delta |  base med  cand med |  base worst  cand worst');
    for (const s of seeds) {
        const b = B[s].fins, c = C[s].fins;
        finB += b.length; finC += c.length;
        allB.push(...b); allC.push(...c);
        const dm = mean(c) - mean(b), dd = med(c) - med(b), dw = (c[c.length - 1] || 0) - (b[b.length - 1] || 0);
        dMean.push(dm); dMed.push(dd); dWorst.push(dw);
        console.log(`   ${String(s).padStart(4)} | ${mean(b).toFixed(1).padStart(10)} ${mean(c).toFixed(1).padStart(10)} ${((dm >= 0 ? '+' : '') + dm.toFixed(1)).padStart(8)} |` +
            ` ${med(b).toFixed(0).padStart(9)} ${med(c).toFixed(0).padStart(9)} |` +
            ` ${String(b[b.length - 1]).padStart(11)} ${String(c[c.length - 1]).padStart(11)}`);
    }
    const neg = dMean.filter(x => x < 0).length;
    console.log(`  ── ${seeds.length} paired seeds, finishers ${finB} -> ${finC} ──`);
    console.log(`  PAIRED per-seed MEAN delta: mean ${mean(dMean).toFixed(1)}  med ${med(dMean).toFixed(1)}   ${neg}/${seeds.length} seeds faster`);
    console.log(`  PAIRED per-seed MED  delta: mean ${mean(dMed).toFixed(1)}  med ${med(dMed).toFixed(1)}`);
    console.log(`  PAIRED worst-boat   delta: mean ${mean(dWorst).toFixed(1)}  med ${med(dWorst).toFixed(1)}`);
    console.log(`  POOLED over these seeds: base med ${med(allB).toFixed(1)} mean ${mean(allB).toFixed(1)} best ${Math.min(...allB)}` +
        `  ->  cand med ${med(allC).toFixed(1)} mean ${mean(allC).toFixed(1)} best ${Math.min(...allC)}`);
    console.log('  ⚠️ SCREEN ONLY — paired by seed, not by boat, and possibly a partial set.');
}
