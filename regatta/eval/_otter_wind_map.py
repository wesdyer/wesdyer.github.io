# OTTER WIND MAP — render a probe's field over the venue (land, kelp, rocks, marks, route, regions).
#   cd regatta; python3 eval/_otter_wind_map.py field.json out.png [--regions] [--dir] [--doc <venue doc>] [--zoom x0,y0,x1,y1] [--tracks price.json]
# Render the Otter venue: land, kelp, rocks, marks, route, wind regions + a sampled wind field.
#   python3 render_map.py field.json out.png [--regions] [--dir]
import json, sys, math
import numpy as np, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon
from matplotlib.collections import PatchCollection

field = json.load(open(sys.argv[1])); out = sys.argv[2]
SHOW_REG = '--regions' in sys.argv; SHOW_DIR = '--dir' in sys.argv
DOC = sys.argv[sys.argv.index('--doc') + 1] if '--doc' in sys.argv else 'assets/venues/otter.venue.js'
s = open(DOC).read()
doc = json.loads(s[s.index('= {') + 2:].rstrip().rstrip(';'))
LAND = {'coastalgranite', 'coastalmeadow', 'cypressfloor', 'buffsand', 'tidepool'}
fig, ax = plt.subplots(figsize=(22, 18), dpi=80)
# wind heatmap
cols, rows, st = field['cols'], field['rows'], field['step']
spd = np.array(field['spd'], float).reshape(rows, cols)
m = np.ma.masked_less(spd, 0)
ext = [field['x0'] - st / 2, field['x0'] + cols * st - st / 2, field['y0'] + rows * st - st / 2, field['y0'] - st / 2]
im = ax.imshow(m, extent=ext, origin='upper', cmap='turbo', vmin=6, vmax=21, interpolation='nearest', alpha=0.95)
X = field['x0'] + np.arange(cols) * st; Y = field['y0'] + np.arange(rows) * st
try:
    cs = ax.contour(X, Y, np.where(spd < 0, np.nan, spd), levels=list(range(6, 22, 1)), colors='k', linewidths=0.4, alpha=0.6)
    ax.clabel(cs, fmt='%d', fontsize=7)
except Exception as e: print('contour skipped', e)
fig.colorbar(im, ax=ax, fraction=0.03, pad=0.01, label='knots (mean field, lees included)')
if SHOW_DIR:
    d = np.array(field['dir'], float).reshape(rows, cols)
    k = 4
    for j in range(0, rows, k):
        for i in range(0, cols, k):
            if spd[j, i] < 0: continue
            a = math.radians(d[j, i]); x = field['x0'] + i * st; y = field['y0'] + j * st
            # wind FROM a -> blows toward a+180; heading convention fwd = (sin, -cos)
            vx, vy = -math.sin(a) * 180, math.cos(a) * 180
            ax.arrow(x, y, vx, vy, head_width=60, color='k', alpha=0.5, lw=0.6)
# shapes
order = ['tidepool', 'coastalgranite', 'coastalmeadow', 'cypressfloor', 'buffsand']
colors = {'tidepool': '#8f9a8a', 'coastalgranite': '#c9bfae', 'coastalmeadow': '#d9c977', 'cypressfloor': '#4b6b3a', 'buffsand': '#f1e2b3', 'kelp': '#3b5f2a', 'sunkenrock': '#333', 'shallows': '#7fd'}
for kind in order:
    for sh in doc['shapes']:
        if sh['kind'] != kind: continue
        ax.add_patch(Polygon(sh['outer'], closed=True, fc=colors[kind], ec='none', zorder=3))
        for h in sh.get('holes', []): ax.add_patch(Polygon(h, closed=True, fc='#7fd', ec='none', zorder=3, alpha=0.6))
for sh in doc['shapes']:
    if sh['kind'] == 'kelp': ax.add_patch(Polygon(sh['outer'], closed=True, fc=colors['kelp'], ec='none', alpha=0.5, zorder=4))
    if sh['kind'] == 'sunkenrock': ax.add_patch(Polygon(sh['outer'], closed=True, fc='#222', ec='none', zorder=5))
# casters (hard rocks)
for c in field['casters']:
    if c['id'].startswith('prop-'):
        ax.add_patch(plt.Circle((c['x'], c['y']), c['r'], fc='none', ec='red', lw=0.8, zorder=6))
# boundary
ax.add_patch(Polygon(doc['world']['boundary']['poly'], closed=True, fc='none', ec='black', lw=1.5, ls='--', zorder=7))
# regions
if SHOW_REG:
    for r in doc['wind']['regions']:
        ax.add_patch(Polygon(r['poly'], closed=True, fc='none', ec='magenta', lw=1.2, zorder=8))
        cx = np.mean([p[0] for p in r['poly']]); cy = np.mean([p[1] for p in r['poly']])
        ax.text(cx, cy, f"{r['id']}\n{r['speed']}kt {round(math.degrees(r['direction']))%360}°", color='magenta', fontsize=7, ha='center', zorder=9)
# course
c = doc['course']
for mk in c['marks']:
    ax.plot(mk['x'], mk['y'], 'o', color='orange', ms=9, mec='k', zorder=10); ax.text(mk['x'] + 80, mk['y'], mk['id'], fontsize=9, zorder=10)
for leg in c['paths']['legs']:
    if leg['pts']: xs, ys = zip(*leg['pts']); ax.plot(xs, ys, '-', color='white', lw=2, zorder=9)
if '--tracks' in sys.argv:
    pr = json.load(open(sys.argv[sys.argv.index('--tracks') + 1]))
    cols_t = ['red', 'magenta', 'cyan', 'yellow', 'white', 'lime']
    for i, tr in enumerate(pr['tracks']):
        xs, ys = zip(*tr); ax.plot(xs, ys, '-', color=cols_t[i % len(cols_t)], lw=1.6, zorder=11, label=pr['beats'][i]['label'] + f" {pr['beats'][i]['secs']:.0f}s")
    for k in ['reachPts', 'bayPts']:
        for name, pts in pr[k].items():
            if 'smart' in name or 'hug' in name or 'band' in name or 'finger' in name or 'corner' in name:
                xs, ys = zip(*pts); ax.plot(xs, ys, '--', lw=1.2, zorder=11, label=name)
    ax.legend(loc='lower left', fontsize=8)
ax.set_xticks(range(-9000, 13000, 1000)); ax.set_yticks(range(-11000, 8000, 1000))
if '--zoom' in sys.argv:
    z = [float(v) for v in sys.argv[sys.argv.index('--zoom') + 1].split(',')]; ax.set_xlim(z[0], z[2]); ax.set_ylim(z[3], z[1])
else: ax.set_xlim(-9500, 12800); ax.set_ylim(7500, -11000)  # y down
ax.set_aspect('equal'); ax.grid(True, alpha=0.3)
plt.setp(ax.get_xticklabels(), rotation=90, fontsize=7); plt.setp(ax.get_yticklabels(), fontsize=7)
plt.tight_layout(); plt.savefig(out); print('wrote', out)
