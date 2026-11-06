# Which wind regions the bots actually sail through, split by point of sail (upwind/reach/down).
import json, sys, os
D = os.path.dirname(os.path.abspath(__file__))
T = json.load(open(D + '/tracks.json')); R = json.load(open(D + '/regions.json'))
def inside(poly, x, y):
    c = False; n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]; x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: c = not c
    return c
def mode(a): a = abs(a); return 'up' if a < 62 else ('down' if a > 128 else 'reach')
for v in (sys.argv[1:] or T):
    regs = R[v]['wind']; cnt = {}; tot = {'up': 0, 'reach': 0, 'down': 0}
    for t in T[v]['tr']:
        for p in t:
            m = mode(p[2]); tot[m] += 1
            hits = [r['id'] for r in regs if inside(r['poly'], p[0], p[1])]
            # smallest containing region = the most specific authored zone
            if hits:
                h = min(hits, key=lambda i: abs(sum(a[0]*b[1]-b[0]*a[1] for a, b in zip(next(r for r in regs if r['id']==i)['poly'], next(r for r in regs if r['id']==i)['poly'][1:]))))
            else: h = '(none)'
            cnt.setdefault(h, {'up': 0, 'reach': 0, 'down': 0})[m] += 1
    print('===', v)
    rows = sorted(cnt.items(), key=lambda kv: -sum(kv[1].values()))
    for h, c in rows:
        s = sum(c.values()); 
        if s / sum(tot.values()) < 0.03: continue
        r = next((r for r in regs if r['id'] == h), None)
        desc = f"{r['kt']}kt dir{r['dir']} ±{r['dv']}° ±{r['sv']}kt per{r['per']}s" if r else ''
        print(f"  {h:22s} {100*s/sum(tot.values()):4.0f}% of time | up {100*c['up']/max(1,tot['up']):3.0f}% reach {100*c['reach']/max(1,tot['reach']):3.0f}% down {100*c['down']/max(1,tot['down']):3.0f}% | {desc} {(r or {}).get('name') or ''}")
