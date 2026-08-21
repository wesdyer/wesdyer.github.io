// Which venues carry DRIFTING props / jellies — the two things updated from draw()
// with `performance.now()` (script.js 20223-20224)? Cross-process bench divergence
// so far: river ✗, lagoon ✗, bay ✓, glowtide ✓, redrock ✓, lake ✓.
//   node _props_census.js [tree]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeGLB');
const VENUES = ['glowtide','redrock','river','arctic','lake','bay','ocean','lagoon','seatrials','swamp'];
(async () => {
  const br = await chromium.launch();
  for (const V of VENUES) {
    const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0,150)));
    await p.addInitScript((v)=>{localStorage.setItem('regatta_settings',JSON.stringify({venue:v}));}, V);
    await p.goto('file://' + path.resolve(ROOT,'regatta/index.html'));
    await p.addScriptTag({content: fs.readFileSync(path.resolve(ROOT,'regatta/eval/eval_harness.js'),'utf8')});
    const r = await p.evaluate(()=>{
      window.evalHarness.seed = 9400; window.resetGame(); window.startRace();
      for (let i=0;i<60;i++) window.update(1/60);
      const c = state.course;
      const props = c.props || c.propObjs || [];
      const drift = props.filter(x => x && (x.drift || x.driftX != null || x.vx != null));
      const solid = props.filter(x => x && (x.solid || x.collide || x.isCollider));
      return {
        props: props.length, drift: drift.length, solid: solid.length,
        jelly: (c.jellies || c.jellyfish || window.JELLY || []).length || 0,
        traffic: (c.traffic || c.vessels || []).length || 0,
        islands: (c.islands||[]).length,
        awash: (c.islands||[]).filter(i=>i.awash).length,
        floes: (c._floeObjs||[]).length,
        curRegions: (c.currentRegions||[]).length,
        keys: Object.keys(c).filter(k=>/prop|jell|drift|weed|grass|traffic|vessel/i.test(k)).join(',')
      };
    });
    await p.close();
    console.log(`${V.padEnd(10)} props ${String(r.props).padStart(5)} drift ${String(r.drift).padStart(5)} solid ${String(r.solid).padStart(5)} jelly ${String(r.jelly).padStart(4)} traffic ${String(r.traffic).padStart(3)} islands ${String(r.islands).padStart(5)} awash ${String(r.awash).padStart(4)} curReg ${String(r.curRegions).padStart(3)}  keys=[${r.keys}]`);
  }
  await br.close();
})();
