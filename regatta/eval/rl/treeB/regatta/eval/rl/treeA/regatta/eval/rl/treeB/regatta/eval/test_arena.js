// Arena tests: the boundary abstraction that eleven runtime sites now depend on.
//
//   node regatta/eval/test_arena.js
//
// The property that matters most is the LAST one: the circle path must consume
// exactly two rng() draws, in the order angle-then-distance. `Math.sqrt(rng()) * r`
// is fixed-cost and rejection sampling is not, so if that ever changes it shifts the
// RNG stream for every generated venue and moves the eval anchor — a behaviour
// change disguised as a geometry change.
const fs = require('fs');
const path = require('path');

global.window = {};
new Function('window', fs.readFileSync(path.resolve(__dirname, '../js/arena.js'), 'utf8'))(global.window);
const A = global.window.Arena;

let failures = 0;
const check = (name, cond, detail) => {
    console.log(`  ${cond ? 'ok   ' : 'FAIL '} ${name}${cond || !detail ? '' : ' — ' + detail}`);
    if (!cond) failures++;
};
const near = (a, b, tol) => Math.abs(a - b) <= (tol === undefined ? 1e-9 : tol);

const circle = { x: 100, y: -50, radius: 1000 };
const square = { x: 0, y: 0, radius: 1414.21, poly: A.rectPoly(0, 0, 1000, 1000) };

console.log('extent');
{
    const e = A.extent(circle);
    check('circle extent', near(e.minX, -900) && near(e.maxX, 1100) && near(e.minY, -1050) && near(e.maxY, 950));
    const f = A.extent(square);
    check('poly extent', near(f.minX, -1000) && near(f.maxX, 1000) && near(f.minY, -1000) && near(f.maxY, 1000));
}

console.log('\nsignedDist: positive inside, negative outside, magnitude = distance to edge');
check('circle centre', near(A.signedDist(circle, 100, -50), 1000));
check('circle on the edge', near(A.signedDist(circle, 1100, -50), 0));
check('circle 300 outside', near(A.signedDist(circle, 1400, -50), -300));
check('poly centre', near(A.signedDist(square, 0, 0), 1000));
check('poly near one wall', near(A.signedDist(square, 900, 0), 100));
check('poly outside a wall', near(A.signedDist(square, 1200, 0), -200));
// A corner is the case a naive "distance to nearest wall" gets wrong.
check('poly outside a corner', near(A.signedDist(square, 1300, 1400), -500),
      String(A.signedDist(square, 1300, 1400)));

console.log('\ncontains honours the inset');
check('circle inside with inset', A.contains(circle, 100, -50, 500) === true);
check('circle fails a too-large inset', A.contains(circle, 1050, -50, 100) === false);
check('poly inside with inset', A.contains(square, 0, 0, 900) === true);
check('poly fails near a wall', A.contains(square, 950, 0, 100) === false);

console.log('\nclamp returns a point ON the edge when outside, untouched when inside');
{
    const a = A.clamp(circle, 100, -50);
    check('circle inside is untouched', a.clamped === false && near(a.x, 100) && near(a.y, -50));
    const b = A.clamp(circle, 3000, -50);
    check('circle outside lands on the rim', b.clamped === true && near(A.signedDist(circle, b.x, b.y), 0, 1e-6));
    const c = A.clamp(square, 0, 0);
    check('poly inside is untouched', c.clamped === false);
    const d = A.clamp(square, 1500, 200);
    check('poly outside lands on the wall', d.clamped === true && near(d.x, 1000) && near(d.y, 200));
    const e = A.clamp(square, 1500, 1500);
    check('poly outside a corner lands on the corner', e.clamped === true && near(e.x, 1000) && near(e.y, 1000));
}

console.log('\noutward normals point out of bounds');
{
    const n = A.outward(circle, 1100, -50);
    check('circle normal', near(n.x, 1, 1e-6) && near(n.y, 0, 1e-6));
    const m = A.outward(square, 1200, 0);
    check('poly normal outside a wall', near(m.x, 1, 1e-6) && near(m.y, 0, 1e-6));
    // Inside, the normal must still point OUT — it is used to ask "is this boat
    // heading further out?", and a sign flip would invert that answer.
    const k = A.outward(square, 900, 0);
    check('poly normal from inside still points out', k.x > 0.9 && near(k.y, 0, 1e-6),
          `(${k.x.toFixed(3)},${k.y.toFixed(3)})`);
}

console.log('\nrayHit');
check('circle ray east from centre', near(A.rayHit(circle, 100, -50, 1, 0), 1000, 1e-6));
check('poly ray east from centre', near(A.rayHit(square, 0, 0, 1, 0), 1000, 1e-6));
check('poly ray diagonal hits a wall not a corner distance',
      near(A.rayHit(square, 0, 0, Math.SQRT1_2, Math.SQRT1_2), 1000 * Math.SQRT2, 1e-6),
      String(A.rayHit(square, 0, 0, Math.SQRT1_2, Math.SQRT1_2)));
check('ray from outside pointing away misses', A.rayHit(square, 5000, 0, 1, 0) === null);

console.log('\nrimPoint sits inside, near the edge, in the given direction');
{
    // Heading convention: forward = (sin, -cos), so ang=0 is +y-up (north).
    const p = A.rimPoint(circle, 0, 150);
    check('circle rim north', near(p.x, 100) && near(p.y, -50 - 850));
    const q = A.rimPoint(square, Math.PI / 2, 150);   // east
    check('poly rim east is inside', A.contains(square, q.x, q.y) === true, `(${q.x},${q.y})`);
    check('poly rim east is near the wall', near(A.signedDist(square, q.x, q.y), 150, 1e-6),
          String(A.signedDist(square, q.x, q.y)));
}

console.log('\nsample stays inside, with the inset');
{
    let s = 1;
    const rng = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
    let okC = 0, okP = 0;
    for (let i = 0; i < 400; i++) {
        const a = A.sample(circle, rng, 200);
        if (A.contains(circle, a.x, a.y, 199.9)) okC++;
        const b = A.sample(square, rng, 200);
        if (A.contains(square, b.x, b.y, 199.9)) okP++;
    }
    check('400 circle samples all respect the inset', okC === 400, `${okC}/400`);
    check('400 poly samples all respect the inset', okP === 400, `${okP}/400`);
}

console.log('\nRNG NEUTRALITY — the property that protects the eval anchor');
{
    let draws = 0;
    const counting = () => { draws++; return 0.375; };
    A.sample(circle, counting, 300);
    check('circle sample consumes exactly 2 draws', draws === 2, `${draws} draws`);

    // ...and in the same order, producing the same point as the original inline
    // `const ang = rng()*2PI; const dst = sqrt(rng())*(r-inset)` did.
    let k = 0;
    const seq = [0.11, 0.77];
    const fixed = () => seq[k++];
    const got = A.sample(circle, fixed, 300);
    const ang = seq[0] * Math.PI * 2, dst = Math.sqrt(seq[1]) * (circle.radius - 300);
    const want = { x: circle.x + Math.sin(ang) * dst, y: circle.y - Math.cos(ang) * dst };
    check('circle sample matches the retired inline formula exactly',
          got.x === want.x && got.y === want.y, `${got.x},${got.y} vs ${want.x},${want.y}`);
}

console.log('\nboundingCircle + rectPoly');
{
    const bc = A.boundingCircle(A.rectPoly(0, 0, 1000, 1000));
    check('bounding circle of a square', near(bc.x, 0) && near(bc.y, 0) && near(bc.r, 1000 * Math.SQRT2, 1e-6));
    check('rectPoly is 4 points', A.rectPoly(0, 0, 5, 5).length === 4);
}

console.log(`\n${failures ? 'FAIL' : 'PASS'} — ${failures} failure(s)`);
process.exitCode = failures ? 1 : 0;
