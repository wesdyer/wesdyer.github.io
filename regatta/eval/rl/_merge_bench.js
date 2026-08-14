// MERGE BENCH CHUNKS INTO ONE LABEL (2026-08-13).
//
// A 16-seed glowtide bench is hours long on a loaded machine and `ocean_bench.js`
// writes its JSON only at the very end, so a crash loses the whole run — which is
// exactly what happened at 21:41 when every browser on the machine died at once.
// Running in 8-seed chunks caps the loss and produces usable results sooner; this
// stitches the chunks back into the single label the poolers expect.
//
// Refuses to merge across different venue FINGERPRINTS (the venue-freeze policy) or
// to merge duplicate seeds.
//   node _merge_bench.js <outLabel> <inLabel> <inLabel> ...
const fs = require('fs'); const path = require('path');
const [OUT, ...INS] = process.argv.slice(2);
if (!OUT || INS.length < 1) { console.log('usage: node _merge_bench.js <outLabel> <inLabel>...'); process.exit(1); }
const rows = []; const seen = new Set(); let meta = null;
for (const l of INS) {
    const jf = path.join(__dirname, `ocean_bench_${l}.json`);
    const mf = path.join(__dirname, `ocean_bench_${l}.meta.json`);
    if (!fs.existsSync(jf)) { console.log(`  MISSING ocean_bench_${l}.json — skipped`); continue; }
    const j = JSON.parse(fs.readFileSync(jf, 'utf8'));
    const m = fs.existsSync(mf) ? JSON.parse(fs.readFileSync(mf, 'utf8')) : null;
    if (m) {
        if (!meta) meta = { venue: m.venue, fingerprint: m.fingerprint, trials: 0, seed0: m.seed0, mergedFrom: [] };
        if (m.venue !== meta.venue || m.fingerprint !== meta.fingerprint) {
            console.log(`  ⛔ ${l}: venue/fingerprint mismatch (${m.venue}/${m.fingerprint} vs ${meta.venue}/${meta.fingerprint}) — REFUSING`);
            process.exit(1);
        }
        meta.mergedFrom.push(l);
    }
    let added = 0;
    for (const e of j) { if (seen.has(e.seed)) continue; seen.add(e.seed); rows.push(e); added++; }
    console.log(`  ${l}: ${j.length} seeds, ${added} added`);
}
rows.sort((a, b) => a.seed - b.seed);
if (meta) { meta.trials = rows.length; meta.seed0 = rows.length ? rows[0].seed : meta.seed0; }
fs.writeFileSync(path.join(__dirname, `ocean_bench_${OUT}.json`), JSON.stringify(rows));
if (meta) fs.writeFileSync(path.join(__dirname, `ocean_bench_${OUT}.meta.json`), JSON.stringify(meta));
console.log(`=> ocean_bench_${OUT}.json  ${rows.length} seeds  ${meta ? meta.venue + ' ' + meta.fingerprint : ''}`);
