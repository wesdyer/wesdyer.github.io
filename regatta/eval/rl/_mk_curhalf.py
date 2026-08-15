# Build the two DECOMPOSITION arms of the robust-current-statistic candidate.
#
# `_avCurMax` is a MAXIMUM over navigable cells and it gates SEVEN behaviours at
# 2.0 kt. treeCURP swaps the statistic for a p90 and so flips all seven at once on
# glowtide (and, by construction, nothing on any other venue). These two arms split
# that bundle along the physical line the comments themselves draw:
#
#   treeCURG  "the water stands still" GEOMETRY   508 retreat line, 1244 gybe-around,
#                                                 3274 armed rounding arc rollout
#   treeCURS  PROBE / PRICE SCOPING               2080 jam stamps, 4205 probe cap,
#                                                 4296+4301 short plan-aligned probe,
#                                                 4432 bandTrusted (the staircase waiver)
#
# Each arm keeps `_avCurMax` exactly as it is and adds `_avCurP90` beside it, then
# reads the p90 at its own sites only. Every venue but glowtide has the same gate
# state under either statistic, so nine venues stay byte-identical in both arms.
import sys, io

P90_BLOCK = '''                    state.course._avCurMax = mCJ;
                    // A ROBUST venue-class current statistic beside the maximum. See
                    // `_curmax.js`: glowtide max 2.31 / p90 1.79 / 0.6% of cells >= 2.0;
                    // river max 4.96 / p90 2.90 / 23.7% over. Only glowtide changes side.
                    const sP9 = [];
                    const gP9 = state.course.botGrid;
                    if (gP9 && (state.course.currentRegions || []).length) {
                        for (let yP9 = 0; yP9 < gP9.n; yP9 += 4) for (let xP9 = 0; xP9 < gP9.n; xP9 += 4) {
                            if (!gP9.at(xP9, yP9)) continue;
                            const cwP9 = getCurrentAt(gP9.x0 + (xP9 + 0.5) * gP9.res, gP9.y0 + (yP9 + 0.5) * gP9.res);
                            sP9.push(cwP9 ? cwP9.speed : 0);
                        }
                    }
                    sP9.sort((a, b) => a - b);
                    state.course._avCurP90 = sP9.length ? sP9[Math.min(sP9.length - 1, Math.floor(0.90 * sP9.length))] : 0;
'''

GATE_A = '(state.course._avCurMax === undefined || state.course._avCurMax < 2.0)'
GATE_A_NEW = '(state.course._avCurP90 === undefined || state.course._avCurP90 < 2.0)'
GATE_B = 'state.course._avCurMax < 2.0'
GATE_B_NEW = 'state.course._avCurP90 < 2.0'

ARMS = {
    'treeCURG': [508, 1244, 3274],
    'treeCURS': [2080, 4205, 4296, 4301, 4432],
}

for tree, lines in ARMS.items():
    path = f'/Users/wesdyer/Documents/GitHub/wesdyer.github.io/regatta/eval/rl/{tree}/regatta/js/script.js'
    src = io.open(path, encoding='utf-8').read().split('\n')
    hits = 0
    for ln in lines:
        i = ln - 1
        if GATE_A in src[i]:
            src[i] = src[i].replace(GATE_A, GATE_A_NEW); hits += 1
        elif GATE_B in src[i]:
            src[i] = src[i].replace(GATE_B, GATE_B_NEW); hits += 1
        else:
            print(f'  !! {tree} line {ln}: no gate found -> {src[i][:90]}'); sys.exit(1)
    out = '\n'.join(src)
    assert '                    state.course._avCurMax = mCJ;\n' in out, 'anchor missing'
    out = out.replace('                    state.course._avCurMax = mCJ;\n', P90_BLOCK, 1)
    io.open(path, 'w', encoding='utf-8').write(out)
    print(f'{tree}: {hits} gate(s) switched to the p90 + the p90 computed')
