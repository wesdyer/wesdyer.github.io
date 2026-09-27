const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
 await p.goto('file://' + path.resolve('regatta/index.html'));
 await p.waitForFunction(() => window.state && window.Volcano && typeof resetGame === 'function');
 const r = await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
  selectVenue('volcanic'); resetGame(); startRace(); for (let i=0;i<360;i++) update(1/30);
  const d = Wildlife.debug(); for (const o of state.boats) { o.x = 1e6; o.y = 1e6; }
  const kinds = {}; for (const s of state.course.islands) kinds[s.kind] = (kinds[s.kind]||0)+1;
  const lava = state.course.islands.filter(s => s.vertices && (VenueDoc.traits(s).lava || VenueDoc.traits(s).magma || /lava|magma/.test(s.kind||'')));
  const inL = (x,y) => lava.some(s => pointInVerts(x,y,s.vertices));
  const bad = {}; const add=(k,x,y,m)=>{ bad[k]=bad[k]||{n:0,ex:[]}; bad[k].n++; if(bad[k].ex.length<4) bad[k].ex.push([Math.round(x),Math.round(y),m]); };
  for (let i=0;i<30*240;i++){ Wildlife.update(1/30); if(i%15) continue;
   for (const G of d.igHeaps) for (const m of G.members){ if (m.mode==='bask' && !pointOnLand(m.x,m.y)) add('igWet',m.x,m.y,G.s&&G.s.kind); if (inL(m.x,m.y)) add('igLava',m.x,m.y,m.mode); }
   for (const B of d.crabBeds) for (const c of B.crabs){ if(!pointOnLand(c.x,c.y)) add('crabWet',c.x,c.y,c.s&&c.s.kind+'/'+c.s.id); if (inL(c.x,c.y)) add('crabLava',c.x,c.y,''); }
   for (const F of d.boobyFlocks) for (const q of F.birds) if (q.mode==='sit' && pointOnLand(q.x,q.y)) add(inL(q.x,q.y)?'boobyLava':'boobyLand',q.x,q.y,'');
   for (const F of d.ternFlocks) for (const q of F.birds) if (q.z<3 && q.mode!=='roost' && pointOnLand(q.x,q.y)) add(inL(q.x,q.y)?'ternLava':'ternLand',q.x,q.y,q.mode);
   for (const S of d.hammerSchools) for (const f of S.fish) if (inL(f.x,f.y)) add('hamLava',f.x,f.y,'');
  }
  return { kinds, lavaN: lava.length, traitsSample: lava[0] && VenueDoc.traits(lava[0]), bad }; });
 console.log(JSON.stringify(r, null, 1)); await b.close(); })();
