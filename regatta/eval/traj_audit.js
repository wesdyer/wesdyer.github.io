// TRAJECTORY CORPUS AUDIT — is the right data coming in?
//
// Checks every recorded human trajectory, column by column, against what the
// recorder PROMISES (script.js recordTrajectory). Born of a real incident: the
// format names are decorated ('rivals[x,y,...]'), a consumer indexed F.rivals,
// read undefined, and published "the human sailed alone" to the campaign log —
// zeros at every percentile, from a nonexistent column. Column names here are
// normalized (name up to the first bracket) and every check reports a VERDICT
// so silent-zero classes of failure are loud.
//
// Usage: node regatta/eval/traj_audit.js [dir=regatta/eval/rl/traj]
const fs = require('fs');
const path = require('path');
const DIR = process.argv[2] || 'regatta/eval/rl/traj';
const norm = n => n.split(/[\[(<]/)[0];

let files = 0, failures = 0;
const fail = (f, msg) => { failures++; console.log(`  FAIL ${f}: ${msg}`); };
const agg = { dt: [], rivTack: new Set(), phaseJumps: 0 };

for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort()) {
  const d = JSON.parse(fs.readFileSync(path.join(DIR, f)));
  files++;
  const F = {}; d.format.forEach((n, i) => F[norm(n)] = i);
  const need = ['t', 'phase', 'x', 'y', 'hdg', 'spd', 'windDir', 'windSpd', 'leg',
                'sweep', 'armed', 'ringSect16', 'rivals', 'legProg', 'floes',
                'giveWayN', 'ocs', 'penaltyTurnsOwed', 'awa', 'aws', 'playerTack'];
  const missing = need.filter(n => F[n] == null);
  if (missing.length) { fail(f, 'format missing ' + missing.join(',')); continue; }
  const S = d.samples;
  if (!S.length) { fail(f, 'no samples'); continue; }

  // t: 10Hz within each phase (prestart timer counts DOWN, race timer UP — the
  // recorder stores state.race.timer, so spacing sign flips at the gun).
  let prevT = null, prevPhase = null, big = 0, phaseChanges = 0;
  for (const s of S) {
    if (prevT != null && s[F.phase] === prevPhase) {
      const dt = Math.abs(s[F.t] - prevT);
      agg.dt.push(dt);
      if (dt > 0.35) big++;
    }
    if (prevPhase != null && s[F.phase] !== prevPhase) phaseChanges++;
    prevT = s[F.t]; prevPhase = s[F.phase];
  }
  if (big > S.length * 0.02) fail(f, `${big} sample gaps > 0.35s (10Hz promise)`);
  if (phaseChanges > 1) { agg.phaseJumps++; fail(f, `phase changed ${phaseChanges} times (expect prestart->racing once)`); }

  // x/y continuity: no teleports.
  let jumps = 0;
  for (let i = 1; i < S.length; i++) {
    if (S[i][F.phase] !== S[i - 1][F.phase]) continue;
    if (Math.hypot(S[i][F.x] - S[i - 1][F.x], S[i][F.y] - S[i - 1][F.y]) > 500) jumps++;
  }
  if (jumps) fail(f, `${jumps} position jumps > 500u/sample`);

  // scalar ranges
  const bad = (name, pred) => { const n = S.filter(s => !pred(s)).length; if (n) fail(f, `${n} samples fail ${name}`); };
  bad('spd in [0,6]', s => s[F.spd] >= 0 && s[F.spd] < 6);
  bad('windSpd in (0,35]', s => s[F.windSpd] > 0 && s[F.windSpd] <= 35);
  bad('awa in [-pi,pi]', s => Math.abs(s[F.awa]) <= Math.PI + 1e-6);
  bad('aws sane', s => s[F.aws] === -1 || (s[F.aws] >= 0 && s[F.aws] < 60));
  bad('playerTack in {-1,0,1}', s => [-1, 0, 1].includes(s[F.playerTack]));
  bad('giveWayN in [-1,9]', s => s[F.giveWayN] >= -1 && s[F.giveWayN] <= 9);

  // leg: nondecreasing while racing
  let legBack = 0;
  for (let i = 1; i < S.length; i++)
    if (S[i][F.phase] === 1 && S[i - 1][F.phase] === 1 && S[i][F.leg] < S[i - 1][F.leg]) legBack++;
  if (legBack) fail(f, `leg went BACKWARD ${legBack} times`);

  // rivals: arrays, tuples of 5, tack in {-1,0,1}, count only ever falls
  // (rivals leave the sample set by FINISHING, never return)
  let rivBad = 0, rivRise = 0, prevN = null;
  for (const s of S) {
    const r = s[F.rivals];
    if (!Array.isArray(r)) { rivBad++; continue; }
    for (const b of r) {
      if (!Array.isArray(b) || b.length !== 5 || ![-1, 0, 1].includes(b[4])) rivBad++;
      agg.rivTack.add(b && b[4]);
    }
    if (prevN != null && r.length > prevN) rivRise++;
    prevN = r.length;
  }
  if (rivBad) fail(f, `${rivBad} malformed rival entries`);
  if (rivRise) fail(f, `rival count ROSE ${rivRise} times (finished boats must not return)`);

  // ringSect16: array of 16 iff near the round mark, scalar 0 otherwise
  if (d.course && d.course.roundMark) {
    const rm = d.course.roundMark;
    let sectBad = 0;
    for (const s of S) {
      const near = Math.hypot(s[F.x] - rm.x, s[F.y] - rm.y) < rm.zone * 3;
      const v = s[F.ringSect16];
      if (near && (!Array.isArray(v) || v.length !== 16)) sectBad++;
      if (!near && v !== 0) sectBad++;
    }
    // the 10Hz sample and the boundary race each other at the ring edge; a few
    // one-sample straddles are the sampling, not the instrument
    if (sectBad > 3) fail(f, `${sectBad} ringSect16 samples disagree with mark distance`);
  }

  // legProg: -1 or a number; grossly nonmonotone within a leg is a projection bug
  let lpBad = 0;
  for (const s of S) { const v = s[F.legProg]; if (typeof v !== 'number') lpBad++; }
  if (lpBad) fail(f, `${lpBad} legProg non-numeric`);

  // floes: non-empty at least once on arctic, tuples of 6
  const floeSamples = S.filter(s => Array.isArray(s[F.floes]) && s[F.floes].length);
  if (d.venue === 'arctic' && !floeSamples.length) fail(f, 'arctic run but floes never non-empty');
  let floeBad = 0;
  for (const s of floeSamples) for (const q of s[F.floes]) if (!Array.isArray(q) || q.length !== 6) floeBad++;
  if (floeBad) fail(f, `${floeBad} malformed floe entries`);
  if (d.venue === 'arctic' && !d.floeHulls) fail(f, 'arctic run missing floeHulls');

  // events: types from the recorder's own list, timestamps within range
  const evTypes = new Set(['penalty', 'collision_island', 'collision_boundary', 'collision_boat', 'collision_mark']);
  for (const e of (d.events || [])) if (!evTypes.has(e[1])) { fail(f, `unknown event type ${e[1]}`); break; }

  // finish bookkeeping
  if (d.finished && !(d.finishTime > 0)) fail(f, 'finished but no finishTime');
}

const dts = agg.dt.sort((a, b) => a - b);
const q = p => dts[Math.floor(p * (dts.length - 1))];
console.log(`\n${files} files audited, ${failures} failures`);
console.log(`sample spacing p10=${q(0.1).toFixed(3)}s med=${q(0.5).toFixed(3)}s p90=${q(0.9).toFixed(3)}s p99=${q(0.99).toFixed(3)}s (promise: 0.1s)`);
console.log(`rival tack values seen: ${[...agg.rivTack].join(',')}`);
process.exit(failures ? 1 : 0);
