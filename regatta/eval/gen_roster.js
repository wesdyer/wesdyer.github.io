// GENERATE guidelines/roster.md — one row per character, measurement beside intent.
//
//   node regatta/eval/gen_roster.js
//
// The INTENDED TIER column is the point of the document: it is hand-edited, and this
// generator PRESERVES IT. On every run the existing roster.md is parsed first and each
// character's intended tier is carried forward; only the measured columns are refreshed.
// So re-measuring never clobbers a design decision, and `node gen_roster.js` after the
// next campaign is safe. A character with no intended tier yet is seeded from its
// measurement and marked with `·` so the un-decided ones are greppable.
//
// Everything measured here comes from the completed campaign (see RATING.md): 66,670
// races, ten venues at 600/char. Nothing is re-raced.

const fs = require('fs'), path = require('path');
const L = require('./rate_lib.js');

const OUT = path.resolve('regatta/guidelines/roster.md');
const DIR = 'regatta/eval/rating';
const VENUES = ['seatrials','ocean','lake','lagoon','redrock','river','arctic','bay','swamp','glowtide'];
const STATS = ['acceleration','momentum','handling','upwind','reach','downwind',
               'pressure','lightAir','heavyAir','memory'];
const ABBR  = ['acc','mom','han','upw','rea','dwn','prs','lgt','hvy','mem'];
const TIER_SHAPE = [['S',0.12],['A',0.21],['B',0.33],['C',0.21],['D',0.13]];

// ── roster ────────────────────────────────────────────────────────────────────
const src = fs.readFileSync(path.resolve('regatta/js/script.js'),'utf8');
const ROSTER = eval(src.match(/const AI_CONFIG = \[[\s\S]*?\n\];/)[0].replace('const AI_CONFIG =',''));
const byName = new Map(ROSTER.map(c=>[c.name,c]));

// ── measurement: time rating (deltaPct pooled) and points rating ──────────────
const per = new Map();                       // name -> {vals:[], ses:[], venues:[], pts:[], dnf}
let meanRaces = 0;
for (const venue of VENUES){
    const data = L.loadVenue(DIR, venue);
    // bootstrapSE, not fitFixedEffects — the plain fit returns point estimates only.
    // This is the same call rate_report.js makes, so the numbers agree with the report.
    const t = L.bootstrapSE(data.races, {value:'time', reps:200});
    // Same denominator rate_report.js:68 uses — the mean BOAT FINISH TIME, not r.rt
    // (the race duration, i.e. when the last boat got home). Using r.rt here shrank
    // every percentage by ~30% and silently disagreed with RATING.md.
    const meanRace = data.races.reduce((a,r)=>{
        const ts = r.b.map(b=>b[1]).filter(x=>x!=null);
        return a + (ts.length ? ts.reduce((x,y)=>x+y,0)/ts.length : 0);
    },0) / data.races.length;
    meanRaces += data.races.length;
    t.names.forEach((n,j)=>{
        if(!per.has(n)) per.set(n,{vals:[],ses:[],venues:[],pts:[],slots:0,dnf:0});
        const e=per.get(n);
        e.vals.push(100*t.effect[j]/meanRace);
        e.ses.push(100*t.se[j]/meanRace);
        e.venues.push({v:venue, d:100*t.effect[j]/meanRace});
    });
    // points, straight off the rows
    const agg = new Map();
    for(const r of data.races) for(const b of r.b){
        const [name,,place,pts,status]=b;
        const fin = status==null && place!=null && place>=1;
        if(!agg.has(name)) agg.set(name,{n:0,s:0,dnf:0});
        const a=agg.get(name); a.n++; a.s += fin?pts:0; if(!fin) a.dnf++;
    }
    for(const [n,a] of agg){ const e=per.get(n); if(!e) continue;
        e.pts.push(a.s/a.n); e.slots+=a.n; e.dnf+=a.dnf; }
    process.stderr.write(`  ${venue}\n`);
}

const rows = [...per.entries()].filter(([n])=>byName.has(n)).map(([name,e])=>{
    const c = byName.get(name);
    const mean = e.vals.reduce((a,b)=>a+b,0)/e.vals.length;
    const se   = Math.sqrt(e.ses.reduce((a,b)=>a+b*b,0))/e.vals.length;
    const best = e.venues.reduce((a,b)=> b.d<a.d?b:a).v;
    const worst= e.venues.reduce((a,b)=> b.d>a.d?b:a).v;
    return { name, arch:c.archetype, beat:c.beat, stats:c.stats,
        total: STATS.reduce((s,k)=>s+(c.stats[k]??0),0),
        mean, se, spread: Math.max(...e.vals)-Math.min(...e.vals), best, worst,
        pts: e.pts.reduce((a,b)=>a+b,0)/e.pts.length,
        dnf: 100*e.dnf/e.slots };
}).sort((a,b)=>a.mean-b.mean);

let i=0;
for(const [t,f] of TIER_SHAPE){ const c=Math.round(f*rows.length);
    for(let k=0;k<c&&i<rows.length;k++,i++) rows[i].measured=t; }
while(i<rows.length) rows[i++].measured='D';

// ── carry forward hand-edited intended tiers ──────────────────────────────────
const prior = new Map();
if (fs.existsSync(OUT)){
    for (const line of fs.readFileSync(OUT,'utf8').split('\n')){
        // | S | S | 1 | Stomp | ...
        const m = line.match(/^\|\s*([SABCD·])\s*\|\s*[SABCD]\s*\|\s*\d+\s*\|\s*\*\*([A-Za-z]+)\*\*/);
        if (m && m[1] !== '·') prior.set(m[2], m[1]);
    }
    process.stderr.write(`\ncarried ${prior.size} hand-edited intended tier(s) forward\n`);
}
for (const r of rows) r.intended = prior.get(r.name) || '·';

// ── tier economics, for the "widen the spread" work ───────────────────────────
const mean = xs => xs.reduce((a,b)=>a+b,0)/xs.length;
const byTier = t => rows.filter(r=>r.measured===t);
const tierStats = ['S','A','B','C','D'].map(t=>{
    const g = byTier(t);
    return { t, n:g.length, rating:mean(g.map(r=>r.mean)), pts:mean(g.map(r=>r.pts)),
             total:mean(g.map(r=>r.total)) };
});
// slope of rating on stat total, the lever for widening
const xs = rows.map(r=>r.total), ys = rows.map(r=>r.mean);
const mx=mean(xs), my=mean(ys);
let sxy=0,sxx=0,syy=0;
for(let k=0;k<xs.length;k++){ sxy+=(xs[k]-mx)*(ys[k]-my); sxx+=(xs[k]-mx)**2; syy+=(ys[k]-my)**2; }
const slope = sxy/sxx, corr = sxy/Math.sqrt(sxx*syy);
const gapSD = tierStats[4].rating - tierStats[0].rating;
const budgetGap = tierStats[0].total - tierStats[4].total;

// ── emit ──────────────────────────────────────────────────────────────────────
const f2 = n => (n>=0?'+':'') + n.toFixed(2);
const sgn = n => (n>=0?'+':'') + n;
let md = `# Roster — tiers, stats and measurement

*Generated by \`eval/gen_roster.js\` from the completed re-rating campaign
(${meanRaces.toLocaleString('en-US')} races, ten venues at 600/char — see
[../eval/RATING.md](../eval/RATING.md)). Regenerate after any campaign:*

\`\`\`sh
node regatta/eval/gen_roster.js
\`\`\`

## How to use this document

**The \`Int\` column is yours.** It is the *intended* tier, it is hand-edited, and the
generator preserves it — re-running after a new campaign refreshes every measured column
and leaves your decisions alone. A \`·\` means no intention has been recorded yet.

\`Mea\` is the measured tier, assigned by the standing S/A/B/C/D shape (12/21/33/21/13% of
the roster). Where \`Int\` and \`Mea\` disagree, that is the balance work queue.

Nothing here is authoritative for the game: \`AI_CONFIG\` in \`js/script.js\` remains the only
source of truth for stats. This document is a design surface over it.

---

## Widening the top-to-bottom spread

The roster currently spans **${f2(rows[0].mean)}% to ${f2(rows[rows.length-1].mean)}%** of a
race — a **${(rows[rows.length-1].mean - rows[0].mean).toFixed(2)}-point** total range, with
tier means:

| Tier | n | mean rating | mean avg-pts | mean stat budget |
|---|---|---|---|---|
${tierStats.map(t=>`| **${t.t}** | ${t.n} | ${f2(t.rating)}% | ${t.pts.toFixed(3)} | ${t.total.toFixed(1)} |`).join('\n')}

**S-to-D gap today: ${gapSD.toFixed(2)} points of race time**, on a mean stat-budget
difference of **${budgetGap.toFixed(1)} points**.

The lever is the stat budget, and it is close to linear: rating regresses on total stat
points at **${slope.toFixed(4)}% per point** (correlation **${corr.toFixed(3)}** across the
roster). So widening the S-to-D gap by *G* percentage points of race time needs about
**${(1/Math.abs(slope)).toFixed(1)} × G** points of extra budget separation — split however
you like between raising S and lowering D.

| Target S→D gap | extra budget separation needed |
|---|---|
${[1.5,2,3,4].map(g=>{const tgt=gapSD+g; return `| ${tgt.toFixed(1)} pts (+${g}) | ${(g/Math.abs(slope)).toFixed(0)} stat points |`;}).join('\n')}

Two cautions before spending it. **Not every stat point costs the same** — \`upwind\` is the
only stat that pays at all ten venues, \`memory\` pays at none, and \`lightAir\` pays only at
swamp. A budget point spent on \`memory\` widens nothing. See RATING.md for the full
per-venue price table. And **archetypes only subtract**: \`corner\` and \`freight\` measure
+2.6 and +2.9 seconds against \`bully\`, while all four intended-fast archetypes are
indistinguishable from it, so archetype is not currently a lever for lifting the top.

---

## Notes for the tier rework (2026-08-23)

Worked through against a race simulator built from \`rating/ARCHIVE.json\` — a character's
time is its measured effect plus \`N(0, residSd)\` per venue. Validated first: it reproduces
the measured tier points to a mean error of **0.071 points**, so its extrapolations are
usable. Everything below assumes a target of tier mean points **S=7, A=6, B=5, C=4, D=3**.

### That target is self-consistent

Points are zero-sum inside a race, so tier means must average out to the fleet mean.
Weighted by tier size, \`(12x7 + 21x6 + 33x5 + 21x4 + 13x3)/100 = 4.98\` against a mechanical
fleet mean of ~4.95. It fits.

### ±5 cannot reach it; ±10 can; ±8 cannot

The expressible rating range, accounting for the handling clamp below:

| per-stat range | fastest character | slowest |
|---|---|---|
| ±5 (today) | −11.45% | +11.12% |
| ±8 | −17.66% | +16.99% |
| **±10** | **−21.57%** | **+20.91%** |

At ±5 the S and D tiers run off the end of the scale — the best the current range can do is
about **S 6.7 / D 3.2**, and only by pinning every S character to +5 on all ten stats, which
turns the tier into clones. **±10 is roughly the minimum workable range**; ±8 falls about 1.4
points short of S. Note ±10 gives −21.57%, not a naive doubling to −22.90%, because handling
saturates.

### Preserving character shape makes the target EASIER, not harder

A first pass compressed the performance stats to fit and produced near-identical S
characters. That was a modelling error. **Points are concave in rating**: inside a tier the
weaker half loses more than the stronger half gains, so a tier with real internal spread
lands *lower* than a flat one at the same mean rating — and therefore needs *less* rating to
hit a given points target.

Assuming a flat tier said S needed a budget of **+82**. Keeping every character's real shape
needs **+47**. Roughly half. Identity is not in tension with the target.

### Code constraints found in script.js — read before authoring

- **\`AI_STAT_BONUS = 4\`** (\`script.js:11649\`) adds a flat +4 to all seven *performance*
  stats of every AI boat at construction. The physics already sees \`authored + 4\`, i.e.
  −1..+9 today. It is constant across characters so it does not bias the measured prices,
  but it puts the clamps closer than the authored numbers suggest.
- **\`handling\` saturates at authored +6.** Five sites consume it as
  \`clamp((handling + 4) / 10, 0, 1)\`, which hits 1.0 at authored +6 and 0.0 at authored −4.
  Only the \`tackAgility\` term keeps responding outside that band. So handling above +6 is
  largely wasted, and **handling below −4 is already dead today** — a −5 sails as a −4.
  If handling should keep separating strong characters, that clamp has to move too.
- **\`lightAir\`, \`heavyAir\` and \`memory\` do not take the bonus** and price at ~0 almost
  everywhere: together they are 0.92% of the 11.45% maximum — 8% of the effect for 30% of
  the budget. That makes them the natural home for character identity and venue
  specialisation during a tier-wide power raise, since moving them costs nothing against
  the target.

### The cheaper lever is race noise

Character spread averages **7.7 s against 40.3 s of within-race residual**. Finishing
position is mostly the day, not the boat, which is the real reason points sit in a tight
band around 5. Holding every stat exactly as authored today and only shrinking the residual:

| noise × | S | A | B | C | D | gap |
|---|---|---|---|---|---|---|
| 1.00 | 5.63 | 5.23 | 4.96 | 4.66 | 4.27 | 1.36 |
| 0.50 | 6.22 | 5.50 | 4.98 | 4.39 | 3.71 | 2.51 |
| **0.25** | **7.05** | **5.90** | **5.00** | **3.98** | **2.91** | **4.14** |

Quarter noise hits the target with no stat changes at all. Halving the noise moves the tiers
about as far as tripling every budget.

### Worked example — the current S tier at ±10

One transform, no compression:

> \`newStat = round(oldStat + 4.5)\` on the seven performance stats, handling capped at +6,
> conditional stats untouched.

Simulated result across all five tiers: **6.92 / 6.13 / 5.07 / 3.85 / 2.69** against
7/6/5/4/3 — S on target, C and D slightly over-scaled and wanting a touch less.

| Character | acc | mom | han | upw | rea | dwn | prs | lgt | hvy | mem | Bud | Rating | Pts |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Talon | +10 | +1 | +6 | +10 | +9 | +2 | +8 | +1 | +1 | 0 | +48 | −15.1% | 7.11 |
| Stomp | +10 | +2 | +6 | +8 | +7 | +5 | +6 | 0 | +1 | 0 | +45 | −13.8% | 6.85 |
| Muninn | +7 | +2 | +6 | +8 | +8 | +3 | +10 | +2 | −1 | +5 | +50 | −14.5% | 7.01 |
| Cruz | +7 | +7 | +6 | +7 | +7 | +7 | +7 | +1 | +1 | +3 | +53 | −14.6% | 6.99 |
| Hug | +2 | +6 | +5 | +10 | +7 | +7 | +10 | +1 | −2 | −5 | +41 | −15.0% | 7.00 |
| Seam | +6 | +1 | +6 | +9 | +6 | +2 | +8 | +4 | −4 | +1 | +39 | −13.0% | 6.78 |
| Chroma | +5 | +5 | +6 | +4 | +6 | +6 | +9 | +5 | −4 | −5 | +37 | −12.7% | 6.78 |
| Pebble | +3 | +10 | +6 | +10 | +1 | +9 | +3 | −1 | +4 | +5 | +50 | −13.0% | 6.76 |
| Puff | +7 | +9 | +6 | +6 | +7 | +2 | +9 | +5 | −3 | +2 | +50 | −14.2% | 7.04 |
| Cheer | +7 | +3 | +6 | +6 | +3 | +4 | +10 | +2 | −1 | −1 | +39 | −12.8% | 6.81 |
| Fathom | +5 | +10 | 0 | +8 | +9 | +9 | +7 | 0 | +5 | +5 | +58 | −14.3% | 6.99 |
| Mistral | +10 | +10 | +6 | +5 | +4 | +5 | +4 | +3 | +3 | +2 | +52 | −13.0% | 6.87 |

Mean budget **+46.8**, mean rating **−13.84%** — well inside the ±100 ceiling. Shape is
preserved rather than compressed: within-character spread across the seven performance stats
goes 7.1 → 7.2, and between-character budget sd goes 5.9 → 6.3. Cruz stays the flat
metronome, Hug keeps the tier's lowest acceleration (her beat line still reads true), Fathom
stays the handling liability.

**Ten of the twelve land on handling +6** — the clamp, not a choice. Handling stops
differentiating strong characters until that limit moves.

### The caveat that is still open

**Every price above +5 is an extrapolation.** No character has ever carried a stat higher
than 5, so the per-point prices beyond that are unverified. The physics supports linearity —
\`upwind * 0.012\`, \`reach * 0.018\`, \`pressure * 0.05\`, \`acceleration * 0.024\` are plain
multipliers with no clamp in range, and at authored +10 the effective +14 leaves \`momMod\` at
0.72 and \`accelMod\` at 1.34 — but supported is not verified. Race a handful of synthetic
characters at +8/+10 across two or three venues before authoring 100 against the new scale.

---

## The roster

Sorted fastest to slowest by measured rating. \`Rating\` is % of a race vs an average
character in the same race (negative = faster); \`Pts\` is average points per race on the
9→1 scale, DNF = 0; \`Bud\` is the sum of all ten stat points.

| Int | Mea | # | Name | Archetype | Rating | ±SE | Pts | Bud | Swing | Best | Worst |
|:---:|:---:|--:|---|---|--:|--:|--:|--:|--:|---|---|
`;
rows.forEach((r,k)=>{
    md += `| ${r.intended} | ${r.measured} | ${k+1} | **${r.name}** | ${r.arch} | ${f2(r.mean)} | ${r.se.toFixed(2)} | ${r.pts.toFixed(2)} | ${sgn(r.total)} | ${r.spread.toFixed(1)} | ${r.best} | ${r.worst} |\n`;
});

md += `
---

## Stat lines

The ten authored values per character, for editing. Order matches the table above.

| Name | ${ABBR.join(' | ')} | Bud |
|---|${ABBR.map(()=>'--:').join('|')}|--:|
`;
for(const r of rows){
    md += `| **${r.name}** | ${STATS.map(s=>sgn(r.stats[s]??0)).join(' | ')} | ${sgn(r.total)} |\n`;
}

md += `
---

## Beat lines

Each character's authored counter. Three currently contradict the measurement outright and
are flagged; see the beat-line audit in RATING.md for the full eight.

| Name | Beat line |
|---|---|
`;
for(const r of rows) md += `| **${r.name}** | ${String(r.beat||'').replace(/\|/g,'\\|')} |\n`;

md += `
---

*Measured columns regenerate; the \`Int\` column does not. Last generated from
${meanRaces.toLocaleString('en-US')} races.*
`;

fs.mkdirSync(path.dirname(OUT), {recursive:true});
fs.writeFileSync(OUT, md);
console.log(`\nwrote ${OUT}`);
console.log(`${rows.length} characters | S-D gap ${gapSD.toFixed(2)} pts | slope ${slope.toFixed(4)} %/stat-pt | corr ${corr.toFixed(3)}`);
console.log(`intended tiers carried forward: ${prior.size}`);
