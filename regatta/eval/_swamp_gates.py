#!/usr/bin/env python3
"""Gatorgrass Bayou's four passages — find and VERIFY the route gates (ROUTE_GATES, sim/course.js).

    python3 regatta/eval/_swamp_gates.py            (from the repo root)

The bayou is a maze of mud ridges (kind `mud`, the only walls; weed and mud bars sail). Four
passages lead from the start to the windward gate, and Croak's objective counts which one a
finished race came through by the gate line it crossed. Each gate is the shortest wall-to-wall
line through a seed point in its passage's narrowest gap. The check that matters: with ALL
four gates blocked the windward gate must be unreachable (every route crosses one), and each
gate alone must reconnect it. If the venue's walls are edited, re-run this, copy the printed
gates into ROUTE_GATES, and run eval/test_swamp.js (it replays two of Wes's recorded races).
Seeds are image pixels on the 1100-px overview the Sep 25 2026 analysis drew; move them if a
ridge moves. Needs node (to read the venue) and numpy/PIL.
"""
import subprocess, os
REPO = os.path.abspath('.')
SP = os.environ.get('TMPDIR', '/tmp').rstrip('/') + '/swamp_gates'
os.makedirs(SP, exist_ok=True)
subprocess.run(['node', '-e', """
const fs=require('fs');global.window={};eval(fs.readFileSync('regatta/assets/venues/swamp.venue.js','utf8'));const d=window.VENUE_DOC.swamp||window.VENUE_DOC;
fs.writeFileSync(process.argv[1], JSON.stringify({shapes:d.shapes.map(s=>({id:s.id,kind:s.kind,outer:s.outer})), marks:d.course.marks, boundary:d.world.boundary.poly}));""", SP + '/swamp_doc.json'], check=True)
import sys as _sys
SEEDS = '{"cut":[545,505],"east":[660,618],"longway":[688,805],"west":[245,540]}'
_sys.argv = [_sys.argv[0], SP, SEEDS]
import json, heapq, math, collections, sys, numpy as np
from PIL import Image, ImageDraw, ImageFilter
SP=sys.argv[1]
d=json.load(open(SP+'/swamp_doc.json'))
C=15.0
xs=[p[0] for p in d['boundary']]; ys=[p[1] for p in d['boundary']]
x0,y0=min(xs),min(ys); W=int((max(xs)-x0)/C)+2; H=int((max(ys)-y0)/C)+2
S=1100/max(max(xs)-x0,max(ys)-y0)
PX=lambda px,py:((px-10)/S+x0,(py-10)/S+y0)
pt=lambda p:(p[0],p[1]) if isinstance(p,list) else (p['x'],p['y'])
def rast(polys):
    im=Image.new('L',(W,H),0); g=ImageDraw.Draw(im)
    for P in polys: g.polygon([((x-x0)/C,(y-y0)/C) for x,y in P], fill=1)
    return np.array(im,bool)
inside=rast([d['boundary']]); mud=rast([[pt(p) for p in s['outer']] for s in d['shapes'] if s['kind']=='mud'])
wall=~inside|mud
def isw(x,y):
    cx,cy=int((x-x0)/C),int((y-y0)/C)
    return not(0<=cx<W and 0<=cy<H) or wall[cy,cx]
def gate_at(x,y):
    best=None
    for k in range(90):
        a=k*math.pi/90; ux,uy=math.cos(a),math.sin(a); ends=[]
        for sd in (1,-1):
            r=0
            while r<3000 and not isw(x+sd*ux*r,y+sd*uy*r): r+=5
            ends.append((x+sd*ux*r,y+sd*uy*r,r))
        w=ends[0][2]+ends[1][2]
        if best is None or w<best[0]: best=(w,ends)
    return best
M={m['id']:m for m in d['marks']}
S0=((M['sf-pin']['x']+M['sf-boat']['x'])/2,(M['sf-pin']['y']+M['sf-boat']['y'])/2)
G0=((M['wg-port']['x']+M['wg-stbd']['x'])/2,(M['wg-port']['y']+M['wg-stbd']['y'])/2)
seeds=json.loads(sys.argv[2])
gates={}
for name,(px,py) in seeds.items():
    x,y=PX(px,py); w,ends=gate_at(x,y)
    gates[name]={'a':[round(ends[0][0]),round(ends[0][1])],'b':[round(ends[1][0]),round(ends[1][1])],'w':round(w)}
def blockmask(names):
    im=Image.new('L',(W,H),0); g=ImageDraw.Draw(im)
    for n in names:
        a,b=gates[n]['a'],gates[n]['b']; g.line([((a[0]-x0)/C,(a[1]-y0)/C),((b[0]-x0)/C,(b[1]-y0)/C)], fill=1, width=3)
    return np.array(im,bool)
def reach(block):
    free=~wall & ~block; s=(int((S0[0]-x0)/C),int((S0[1]-y0)/C)); t=(int((G0[0]-x0)/C),int((G0[1]-y0)/C))
    seen=np.zeros((H,W),bool); q=collections.deque([s]); seen[s[1],s[0]]=True
    while q:
        x,y=q.popleft()
        if (x,y)==t: return True
        for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
            nx,ny=x+dx,y+dy
            if 0<=nx<W and 0<=ny<H and free[ny,nx] and not seen[ny,nx]: seen[ny,nx]=True; q.append((nx,ny))
    return False
names=list(gates)
print('gates', json.dumps(gates))
print('all open reach:', reach(blockmask([])))
print('all blocked reach (must be False):', reach(blockmask(names)))
for n in names: print('only', n, 'open ->', reach(blockmask([m for m in names if m!=n])))
json.dump(gates, open(SP+'/swamp_gates.json','w'))
