// Byte-identity of a fresh k-seed run vs the first k records of an anchor.
//   node _p0_identity.js <freshLabel> <anchorLabel>
const fs = require('fs');
const a = JSON.parse(fs.readFileSync(`ocean_bench_${process.argv[2]}.json`));
const b = JSON.parse(fs.readFileSync(`ocean_bench_${process.argv[3]}.json`));
let ok = true;
for (let i = 0; i < a.length; i++) {
    const sa = JSON.stringify(a[i]), sb = JSON.stringify(b[i]);
    if (sa !== sb) { ok = false; console.log(`seed ${a[i].seed}: DIFF (fresh vs anchor)`); }
}
console.log(ok ? `IDENTICAL over ${a.length} seeds` : 'MISMATCH');
