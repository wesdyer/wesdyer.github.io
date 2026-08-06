#!/usr/bin/env python3
"""Compare two ocean_bench runs.  python3 cmp_ocean.py A.json B.json

Positive paired numbers mean B is FASTER.  Also reports the two quantities the sea
decides — VMG made good upwind and downwind — and the share of downwind time spent on a
wave face, because a change can move those without moving the clock.
"""
import json, sys, statistics as st


def meta(p):
    """The venue fingerprint this bench ran on, if it was stamped."""
    import os, json as _j
    m = p[:-5] + '.meta.json'
    try:
        return _j.load(open(m))
    except Exception:
        return None

def check_comparable(pa, pb):
    """⚠️ REFUSE a comparison across two different venue cuts. A baseline is numbers
    produced on ONE version of a venue document; comparing across an edit is how a
    conclusion goes quietly wrong. Unstamped files predate the policy and pass."""
    ma, mb = meta(pa), meta(pb)
    if ma and mb and ma.get('fingerprint') and mb.get('fingerprint') \
       and ma['fingerprint'] != mb['fingerprint']:
        print(f"REFUSED: these ran on different cuts of {ma.get('venue')} — "
              f"{ma['fingerprint']} vs {mb['fingerprint']}.")
        print("A baseline is only comparable within one venue version. "
              "See regatta/eval/venues/README.md.")
        raise SystemExit(2)

def load(p): return json.load(open(p))

def agg(d):
    fins, pens, ocs, cols = [], [], 0, {}
    upD = upT = dnD = dnT = face = climb = 0.0
    n = 0
    for race in d:
        for b in race['info']:
            n += 1
            if b.get('fin') is not None: fins.append(b['fin'])
            pens.append(b.get('pen', 0) or 0)
            ocs += 1 if b.get('ocs') else 0
            upD += b['upD']; upT += b['upT']; dnD += b['dnD']; dnT += b['dnT']
            face += b['face']; climb += b['climb']
            for k, v in (b.get('col') or {}).items(): cols[k] = cols.get(k, 0) + v
    return dict(n=n, nfin=len(fins),
                med=st.median(fins) if fins else None,
                mean=round(st.mean(fins), 1) if fins else None,
                mn=min(fins) if fins else None, mx=max(fins) if fins else None,
                upKt=round((upD / upT) / 15, 3) if upT else None,
                dnKt=round((dnD / dnT) / 15, 3) if dnT else None,
                face=round(100 * face / max(1, face + climb), 1),
                pen=round(sum(pens) / n, 2), ocs=round(100 * ocs / n, 1),
                col={k: round(v / n, 2) for k, v in sorted(cols.items())})

def paired(a, b):
    A = {(r['seed'], x['name']): x.get('fin') for r in a for x in r['info']}
    B = {(r['seed'], x['name']): x.get('fin') for r in b for x in r['info']}
    both = [(A[k], B[k]) for k in A if k in B and A[k] is not None and B[k] is not None]
    d = [x - y for x, y in both]
    onlyA = sum(1 for k in A if k in B and A[k] is not None and B[k] is None)
    onlyB = sum(1 for k in A if k in B and A[k] is None and B[k] is not None)
    return (st.median(d) if d else None, round(st.mean(d), 1) if d else None, len(d), onlyA, onlyB)

pa, pb = sys.argv[1], sys.argv[2]
check_comparable(pa, pb)
a, b = load(pa), load(pb)
ga, gb = agg(a), agg(b)
print(f"{'':<11} {'A=' + pa:<34} {'B=' + pb}")
for k in ['med', 'mean', 'mn', 'mx', 'nfin', 'upKt', 'dnKt', 'face', 'pen', 'ocs', 'n']:
    print(f"  {k:<8} {str(ga[k]):<34} {gb[k]}")
print(f"  {'contacts':<8} {str(ga['col']):<34} {gb['col']}")
m, mn, n, oa, ob = paired(a, b)
print(f"\n  PAIRED (positive = B faster): median {m}  mean {mn}  over {n} boats")
print(f"  finished in A only: {oa}   in B only: {ob}")
