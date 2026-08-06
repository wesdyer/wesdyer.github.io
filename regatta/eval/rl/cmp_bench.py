#!/usr/bin/env python3
"""Compare two bench runs.  python3 cmp_bench.py A.json B.json

Reports the fleet aggregates AND the PAIRED per-boat delta (same seed, same boat
name), which is the statistic that survives traffic variance.  Positive paired
numbers mean B is FASTER (B took less time).  Boats that finish in only one run
are excluded from the pairing and reported separately.
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

def load(p):
    return json.load(open(p))

def agg(d):
    fins, pens, ocs, cols, rounders, intime = [], [], 0, {}, 0, 0
    nboats = 0
    nlegs = d[0].get('nLegs', 0)
    for race in d:
        for b in race['info']:
            nboats += 1
            if b.get('fin') is not None:
                fins.append(b['fin'])
                if b['fin'] <= 360: intime += 1
            pens.append(b.get('pen', 0) or 0)
            ocs += 1 if b.get('ocs') else 0
            for k, v in (b.get('col') or {}).items():
                cols[k] = cols.get(k, 0) + v
            # "rounder" = reached the last leg
            if b.get('fin') is not None or (b.get('legT') or {}).get(str(nlegs - 1)) is not None:
                rounders += 1
    return dict(n=nboats, fins=fins, med=st.median(fins) if fins else None,
                mean=round(st.mean(fins), 1) if fins else None,
                mn=min(fins) if fins else None, mx=max(fins) if fins else None,
                nfin=len(fins), intime=intime, rounders=rounders,
                pen=round(sum(pens) / nboats, 2), ocs=round(100 * ocs / nboats, 1),
                col={k: round(v / nboats, 2) for k, v in sorted(cols.items())})

def paired(a, b):
    A = {(r['seed'], x['name']): x.get('fin') for r in a for x in r['info']}
    B = {(r['seed'], x['name']): x.get('fin') for r in b for x in r['info']}
    both = [(A[k], B[k]) for k in A if k in B and A[k] is not None and B[k] is not None]
    onlyA = sum(1 for k in A if k in B and A[k] is not None and B[k] is None)
    onlyB = sum(1 for k in A if k in B and A[k] is None and B[k] is not None)
    d = [x - y for x, y in both]          # positive => B faster
    return (st.median(d) if d else None, round(st.mean(d), 1) if d else None, len(d), onlyA, onlyB)

pa, pb = sys.argv[1], sys.argv[2]
check_comparable(pa, pb)
a, b = load(pa), load(pb)
ga, gb = agg(a), agg(b)
w = max(len(pa), len(pb), 12)
print(f"{'':<12} {'A=' + pa:<38} {'B=' + pb}")
for k in ['med', 'mean', 'mn', 'mx', 'nfin', 'intime', 'rounders', 'pen', 'ocs', 'n']:
    print(f"  {k:<9} {str(ga[k]):<38} {gb[k]}")
print(f"  {'contacts':<9} {str(ga['col']):<38} {gb['col']}")
m, mn, n, oa, ob = paired(a, b)
print(f"\n  PAIRED (positive = B faster): median {m}  mean {mn}  over {n} boats")
print(f"  finished in A only: {oa}   in B only: {ob}")
