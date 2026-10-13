// PT-098: the race leaderboard at Emberfall as Flaunt (a red boat), in three states — no penalties,
// two AI boats owing a penalty, and you owing one. ROOT=<repo checkout> OUT=dir TAG=x node <this>
const { chromium } = require('playwright'); const path = require('path');
const OUT = process.env.OUT, TAG = process.env.TAG || 'after', ROOT = process.env.ROOT || path.resolve('.');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForFunction(() => window.state && typeof resetGame === 'function');
  await p.evaluate(() => { let s = 3;
    Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic', character: 'Flaunt', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    settings.character = 'Flaunt'; selectVenue('volcanic'); resetGame(); if (typeof applyPlayerCharacter === 'function') applyPlayerCharacter(); startRace();
    for (const bt of state.boats) if (!bt.isPlayer) bt.controller = bt.controller || null;
    for (let i = 0; i < 30 * 50; i++) update(1 / 30);   // past the gun
  });
  const states = [['clean', []], ['ai-pen', ['Chisel', 'Stripes']], ['you-pen', ['__me__']]];
  for (const [tag, who] of states) {
    const names = await p.evaluate((who) => {
      for (const bt of state.boats) bt.raceState.penalty = who.includes(bt.isPlayer ? '__me__' : bt.name);
      // (the fleet varies: two AI boats if the named ones aren't sailing)
      if (who.length && !who.includes('__me__') && !state.boats.some(bt => bt.raceState.penalty)) { const ai = state.boats.filter(bt => !bt.isPlayer); ai[2].raceState.penalty = true; ai[6].raceState.penalty = true; }
      updateLeaderboard();
      return state.boats.filter(bt => bt.raceState.penalty).map(bt => bt.name + (bt.isPlayer ? ' (you)' : '')).join(', ') || 'none';
    }, who);
    await p.waitForTimeout(700);   // the row colour transition
    const el = await p.$('#leaderboard'); await el.screenshot({ path: `${OUT}/pt098_${TAG}_${tag}.png` });
    console.log(TAG, tag, 'penalties:', names);
  }
  console.log(errs.length ? 'errors: ' + errs.slice(0, 3).join(' | ') : 'no page errors'); await b.close(); })();
