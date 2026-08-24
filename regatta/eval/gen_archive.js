// GENERATE rating/ARCHIVE.json — the durable record of the campaign.
//
//   node regatta/eval/gen_archive.js
//
// WHY THIS EXISTS. The 66,670 race rows live in rating/*.jsonl, which .gitignore
// deliberately excludes: ~25 MB of bulk output, justified on the grounds that seeds are a
// pure function of (venue, shard) so the rows are reproducible. They are — but only at
// 149 hours of compute, on a checkout with the same line endings (the codeHash gate is
// eol-sensitive, see BASELINE.json) and the same pinned Chromium. That is a thin thread to
// hang 149 hours on, and it means every future question about this campaign either gets
// asked now or gets re-raced.
//
// So: pre-compute the aggregates that answer the questions worth asking, and commit those.
// This file is small enough to track and rich enough that the common follow-ups —
// per-character per-venue performance, head-to-head, per-leg splits, distribution shape,
// stat prices, DNF structure — never need the rows again.
//
// WHAT IT CANNOT ANSWER, so ask these before deleting the rows: anything needing the joint
// distribution within a single race (did A and B fail together?), anything conditioned on a
// per-race covariate not aggregated here (wind direction bins finer than the three kept),
// and any re-fit of the character model at a different specification.

const fs = require('fs'), path = require('path');
const L = require('./rate_lib.js');

const DIR = 'regatta/eval/rating';
const OUT = path.resolve(DIR, 'ARCHIVE.json');
const VENUES = ['seatrials','ocean','lake','lagoon','redrock','river','arctic','bay','swamp','glowtide'];
const STATS = ['acceleration','momentum','handling','upwind','reach','downwind',
               'pressure','lightAir','heavyAir','memory'];

const src = fs.readFileSync(path.resolve('regatta/js/ai/roster.js'),'utf8');
const ROSTER = eval(src.match(/const AI_CONFIG = \[[\s\S]*?\n\];/)[0].replace('const AI_CONFIG =',''));
const byName = new Map(ROSTER.map(c=>[c.name,c]));
const ARCH = [...new Set(ROSTER.map(c=>c.archetype))].sort();
const NAMES = ROSTER.map(c=>c.name).sort();
const NI = new Map(NAMES.map((n,i)=>[n,i]));

const r3 = x => x==null ? null : Math.round(x*1000)/1000;
const r2 = x => x==null ? null : Math.round(x*100)/100;
const quant = (sorted,q) => sorted.length ? sorted[Math.min(sorted.length-1,
                            Math.max(0,Math.floor(q*(sorted.length-1))))] : null;

function priceStats(rows, meanRace){
    const X=[],y=[];
    for(const r of rows){ const c=byName.get(r.name); if(!c) continue;
        const row=[1];
        for(const s of STATS) row.push(c.stats[s]||0);
        for(const a of ARCH.slice(1)) row.push(c.archetype===a?1:0);
        X.push(row); y.push(r.delta); }
    const fit=L.ols(X,y);
    return { r2: r3(fit.r2),
        stats: Object.fromEntries(STATS.map((s,i)=>[s,[r3(fit.beta[i+1]), r3(fit.se[i+1])]])),
        archetypes: Object.fromEntries(ARCH.slice(1).map((a,i)=>
            [a,[r3(fit.beta[1+STATS.length+i]), r3(fit.se[1+STATS.length+i])]])),
        archetypeReference: ARCH[0] };
}

// head-to-head, upper triangle only, flat and indexed by NI
const HH_TOGETHER = new Int32Array(NAMES.length*NAMES.length);
const HH_AHEAD    = new Int32Array(NAMES.length*NAMES.length);

const venues = {}, chars = {};
let totalRaces = 0;

for (const venue of VENUES){
    const data = L.loadVenue(DIR, venue);
    const races = data.races;
    totalRaces += races.length;
    const meanRace = races.reduce((a,r)=>{
        const ts=r.b.map(b=>b[1]).filter(x=>x!=null);
        return a + (ts.length ? ts.reduce((x,y)=>x+y,0)/ts.length : 0); },0)/races.length;

    const t = L.bootstrapSE(races, {value:'time', reps:200});
    const p = L.fitFixedEffects(races, {value:'pts'});
    const pIdx = new Map(p.names.map((n,i)=>[n,i]));

    // per-character accumulators
    const A = new Map();
    const legN = [];
    let wSum=0,wN=0,wMin=Infinity,wMax=-Infinity, durSum=0;
    for (const r of races){
        if(r.w!=null){ wSum+=r.w; wN++; }
        if(r.wlo!=null) wMin=Math.min(wMin,r.wlo);
        if(r.whi!=null) wMax=Math.max(wMax,r.whi);
        durSum += r.rt||0;
        // head-to-head within this race
        const fin = r.b.filter(b=>b[4]==null && b[2]!=null).map(b=>[NI.get(b[0]), b[2]]);
        for(let i=0;i<fin.length;i++) for(let j=0;j<fin.length;j++){
            if(i===j) continue;
            const a=fin[i], b=fin[j];
            if(a[0]==null||b[0]==null) continue;
            HH_TOGETHER[a[0]*NAMES.length+b[0]]++;
            if(a[1]<b[1]) HH_AHEAD[a[0]*NAMES.length+b[0]]++;
        }
        for (const b of r.b){
            const [name,ft,place,pts,status,pen,late,leg,legs,man]=b;
            if(!A.has(name)) A.set(name,{n:0,fin:0,dnf:0,late:0,win:0,top3:0,pts:0,pts2:0,
                pen:0,man:0,ts:[],legSum:[],legN:[]});
            const e=A.get(name);
            e.n++;
            if(status==null && place!=null){ e.fin++; if(place===1)e.win++; if(place<=3)e.top3++; }
            else e.dnf++;
            if(late) e.late++;
            e.pts+=pts||0; e.pts2+=(pts||0)*(pts||0);
            e.pen+=pen||0; e.man+=Array.isArray(man)?man.reduce((x,y)=>x+y,0):0;
            if(ft!=null) e.ts.push(ft);
            if(Array.isArray(legs)) legs.forEach((v,k)=>{ if(v>0){
                e.legSum[k]=(e.legSum[k]||0)+v; e.legN[k]=(e.legN[k]||0)+1; } });
        }
    }

    const rows = t.names.map((n,j)=>({ name:n, delta:t.effect[j], se:t.se[j] }));
    venues[venue] = {
        races: races.length,
        venueHash: data.venueHash, rosterHash: data.rosterHash, codeHash: data.codeHash,
        meanFinishTime: r2(meanRace),
        meanRaceDuration: r2(durSum/races.length),
        residSd: r2(t.residSd),
        cutoff: races[0] ? races[0].co : null,
        totalLegs: races[0] ? races[0].tl : null,
        marks: data.marks,
        wind: { mean: r2(wN?wSum/wN:null), min: r2(wMin===Infinity?null:wMin),
                max: r2(wMax===-Infinity?null:wMax) },
        dnfPct: r3(100*[...A.values()].reduce((s,e)=>s+e.dnf,0)/[...A.values()].reduce((s,e)=>s+e.n,0)),
        prices: priceStats(rows.map(r=>({name:r.name,delta:r.delta})), meanRace)
    };

    for (const [name,e] of A){
        if(!byName.has(name)) continue;
        if(!chars[name]) chars[name] = {};
        const ts = e.ts.slice().sort((a,b)=>a-b);
        const mu = ts.length ? ts.reduce((a,b)=>a+b,0)/ts.length : null;
        const sd = ts.length>1 ? Math.sqrt(ts.reduce((a,b)=>a+(b-mu)**2,0)/(ts.length-1)) : null;
        const row = rows.find(r=>r.name===name);
        const pm = e.pts/e.n;
        chars[name][venue] = {
            n: e.n,
            delta: r3(row?row.delta:null),          // seconds vs an average character
            se:    r3(row?row.se:null),
            deltaPct: r3(row ? 100*row.delta/meanRace : null),
            pts: r3(pm),
            ptsSd: r3(Math.sqrt(Math.max(0, e.pts2/e.n - pm*pm))),
            ptsEffect: r3(p.effect[pIdx.get(name)] ?? null),
            winPct: r3(100*e.win/e.n), top3Pct: r3(100*e.top3/e.n),
            dnfPct: r3(100*e.dnf/e.n), shipDnfPct: r3(100*(e.dnf+e.late)/e.n),
            penPerRace: r3(e.pen/e.n), manPerRace: r3(e.man/e.n),
            finishMean: r2(mu), finishSd: r2(sd),
            finishP10: r2(quant(ts,0.10)), finishP50: r2(quant(ts,0.50)), finishP90: r2(quant(ts,0.90)),
            legMean: e.legSum.map((s,k)=>r2(s/e.legN[k]))
        };
    }
    process.stderr.write(`  ${venue}\n`);
}

// ── head-to-head, upper triangle, dropping empty pairs ────────────────────────
const hh = [];
for(let i=0;i<NAMES.length;i++) for(let j=i+1;j<NAMES.length;j++){
    const tg = HH_TOGETHER[i*NAMES.length+j];
    if(!tg) continue;
    hh.push([i, j, tg, HH_AHEAD[i*NAMES.length+j]]);   // i,j,racesTogether,timesIAheadOfJ
}

// ── sub-leg composition, measured at 10Hz (see RATING.md) ─────────────────────
let composition = null;
for (const f of ['sublegs.json','sublegs2.json','sublegs3.json']){
    for (const base of [path.resolve('regatta/eval'), process.env.SUBLEGS_DIR || '']){
        if(!base) continue;
        const p = path.join(base, f);
        if(fs.existsSync(p)){ composition = Object.assign(composition||{}, JSON.parse(fs.readFileSync(p,'utf8'))); }
    }
}

const archive = {
    _README: 'Durable aggregate record of the character re-rating campaign. The raw race '+
             'rows (rating/*.jsonl, ~25MB) are gitignored and may be deleted; this file is '+
             'designed to survive them. See ARCHIVE.md for the schema and for the questions '+
             'it deliberately cannot answer.',
    generated: '2026-08-23',
    campaign: {
        races: totalRaces, venues: VENUES.length, characters: NAMES.length,
        perChar: 600, shards: 670, shardSize: 100,
        wallClockHours: 148.9, workers: 10,
        cutoffPolicy: { default: 2, river: 1.25 },
        scoring: '9 down to 1 by finish order over the nine-boat AI fleet; DNF and DNS score 0',
        toolchain: 'node v24.19.0, playwright 1.57.0 (locked), chromium 143.0.7499.4 / pw build v1200, Windows',
        codeHashNote: 'Shards stamp 30c4272fa461bec1 on this CRLF checkout; the identical '+
                      'tree hashes to 4f6bd728bd731167 with LF endings. Same AI. See BASELINE.json.'
    },
    statOrder: STATS,
    names: NAMES,
    roster: Object.fromEntries(ROSTER.map(c=>[c.name,
        { archetype: c.archetype, beat: c.beat,
          stats: STATS.map(s=>c.stats[s]??0),
          total: STATS.reduce((a,s)=>a+(c.stats[s]??0),0) }])),
    venues,
    characters: chars,
    headToHead: { format: '[i, j, racesTogether, timesIFinishedAheadOfJ] — i,j index into names[]',
                  pairs: hh },
    legComposition: composition,
    legCompositionNote: 'Measured beat/reach/run fractions per leg, sampled at 10Hz from real '+
        'races. Chord-based labels in legtypes.json are wrong at nine of ten venues; these '+
        'supersede them for any point-of-sail attribution.'
};

fs.writeFileSync(OUT, JSON.stringify(archive));
const mb = (fs.statSync(OUT).size/1048576).toFixed(2);
console.log(`\nwrote ${OUT}  (${mb} MB)`);
console.log(`${totalRaces} races | ${VENUES.length} venues | ${NAMES.length} characters | ${hh.length} head-to-head pairs`);
console.log(`legComposition: ${composition ? Object.keys(composition).length + ' venues' : 'MISSING — set SUBLEGS_DIR'}`);
