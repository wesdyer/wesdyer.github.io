# Point-of-sail sections from sailed bot tracks (tracks.json from tracks.js).
# Row: [x, y, twa_deg (signed), tws, mean_tws, dir_offset_from_base_deg, leg, boat_kt], every 0.5 s.
import json, sys, os
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
D = os.path.dirname(os.path.abspath(__file__))
d = json.load(open(D + '/tracks.json'))
venues = sys.argv[1:] or list(d)
def mode(a):
    a = abs(a); return 'up' if a < 62 else ('down' if a > 128 else 'reach')
for v in venues:
    r = d[v]; tr = [t for t in r['tr'] if len(t) > 20]
    fin = sorted(x for x in r['fin'] if x)
    tot = {'up': 0, 'reach': 0, 'down': 0}; tws = {'up': [], 'reach': [], 'down': []}; tacks = []; sections = []
    for t in tr:
        # smooth modes: a section must last >= 6 samples (3 s)
        ms = [mode(p[2]) for p in t]
        for p, m in zip(t, ms): tot[m] += 0.5; tws[m].append(p[3])
        k = 0; nt = 0
        while k < len(t):
            j = k
            while j < len(t) and ms[j] == ms[k]: j += 1
            if ms[k] == 'up' and j - k >= 6:
                seg = t[k:j]; flips = sum(1 for a, b in zip(seg, seg[1:]) if (a[2] > 0) != (b[2] > 0))
                nt += flips
                sections.append((v, seg[0][6], (j - k) * 0.5, seg[0][:2], seg[-1][:2], flips, sum(p[3] for p in seg) / len(seg)))
            k = j
        tacks.append(nt)
    T = sum(tot.values())
    print(f"=== {v}: finish {fin[0]:.0f}-{fin[-1]:.0f}s (median {fin[len(fin)//2]:.0f}); time up {100*tot['up']/T:.0f}% reach {100*tot['reach']/T:.0f}% down {100*tot['down']/T:.0f}%;"
          f" TWS up {sum(tws['up'])/max(1,len(tws['up'])):.1f} reach {sum(tws['reach'])/max(1,len(tws['reach'])):.1f} down {sum(tws['down'])/max(1,len(tws['down'])):.1f}; tacks/boat {sum(tacks)/len(tacks):.1f}")
    # beat sections grouped by leg: median duration + where
    by = {}
    for s in sections: by.setdefault(s[1], []).append(s)
    for leg, ss in sorted(by.items()):
        ss2 = [s for s in ss if s[2] >= 8]
        if not ss2: continue
        dur = sorted(s[2] for s in ss2)
        tot_leg = sum(s[2] for s in ss2) / len(tr)
        print(f"   leg {leg}: upwind sections>=8s: {len(ss2)/len(tr):.1f}/boat, upwind time {tot_leg:.0f}s/boat, section median {dur[len(dur)//2]:.0f}s; e.g. {ss2[0][3]}->{ss2[0][4]} tws {sum(s[6] for s in ss2)/len(ss2):.1f}")
    # plot
    fig, ax = plt.subplots(figsize=(7, 7)); col = {'up': '#d62728', 'reach': '#2ca02c', 'down': '#1f77b4'}
    for t in tr:
        for a, b in zip(t, t[1:]):
            ax.plot([a[0], b[0]], [a[1], b[1]], color=col[mode(a[2])], lw=0.6, alpha=0.6)
    ax.set_aspect('equal'); ax.invert_yaxis(); ax.set_title(f'{v}: red upwind (<62° TWA), green reach, blue downwind')
    os.makedirs(D + '/tracks', exist_ok=True); fig.savefig(D + f'/tracks/{v}.png', dpi=90); plt.close(fig)
