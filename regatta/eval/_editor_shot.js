// Eyeball the editor's panels. Usage: node regatta/eval/_editor_shot.js
const { chromium } = require('playwright');
const path = require('path');

const shots = [
  { mode: 'marks', name: 'marks', setup: (p) => p.evaluate(() => {
      const A = window.EditorApp;
      document.getElementById('btn-add-line').click();
      const gid = A._state().doc.course.lines.slice(-1)[0].id;
      A._addToRoute(`line:${gid}`, 'through'); A._afterEdit(true, 'x');
      A._selectLine(A._state().doc.course.lines.length - 1);
  }) },
  { mode: 'route', name: 'route', setup: (p) => p.evaluate(() => {
      // Marks and gates are made in their own mode now; Route only orders them.
      const A = window.EditorApp;
      const m = A._addMark('can'); A._afterEdit(true, 'mark');
      A._addToRoute(`mark:${m}`); A._afterEdit(true, 'leg');
      document.querySelector('#obj-list .ob[data-i="1"]').click();
  }) },
  { mode: 'current', name: 'current', setup: (p) => p.evaluate(() => {
      document.getElementById('btn-add-cur-all').click();
      document.getElementById('btn-field-cur').click();     // the field toggles live in the header now
  }) },
  { mode: 'venue', name: 'venue', setup: async (p) => {
      await p.evaluate(() => {
          document.getElementById('ice-scatter').value = '5';
          window.EditorApp._addIce(-1200, 900, 900);
          window.EditorApp._afterEdit(true, 'ice');
      });
  } },
  { mode: 'wind', name: 'wind', setup: (p) => p.evaluate(() => {
      document.getElementById('btn-field-wind').click();
      document.querySelector('#wind-list .rt b').click();
  }) },
  { mode: 'measure', name: 'measure', setup: async (p) => {
      const cv = await p.locator('#schematic').boundingBox();
      await p.mouse.move(cv.x + 300, cv.y + 260);
      await p.mouse.down(); await p.mouse.move(cv.x + 560, cv.y + 400); await p.mouse.up();
      await p.keyboard.down('Shift');
      await p.mouse.move(cv.x + 760, cv.y + 300); await p.mouse.down(); await p.mouse.up();
      await p.mouse.move(cv.x + 900, cv.y + 520); await p.mouse.down(); await p.mouse.up();
      await p.keyboard.up('Shift');
      await p.evaluate(() => {
          document.getElementById('show-boat').click();
          // Zoomed to where a boat is judgeable against a gate, which is the whole point.
          window.EditorApp._setView(2500, 1800, 0.55);
      });
  } }
];

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.setViewportSize({ width: 1800, height: 1050 });
  await p.goto('file://' + path.resolve('regatta/editor.html'));
  await p.waitForTimeout(1500);

  for (const s of shots) {
    await p.click(`[data-mode="${s.mode}"]`);
    await s.setup(p);
    await p.waitForTimeout(250);
    await p.screenshot({ path: `regatta/eval/_editor_${s.name}.png` });
    const panel = await p.locator(`.mode-panel[data-layer="${s.mode}"]`).boundingBox();
    if (panel) await p.screenshot({ path: `regatta/eval/_editor_${s.name}_panel.png`,
      clip: { x: Math.max(0, panel.x - 8), y: Math.max(0, panel.y - 8),
              width: panel.width + 16, height: Math.min(panel.height + 16, 1020) } });
  }
  // The right-hand Overview, and the Checks pane that used to blank the page.
  await p.screenshot({ path: 'regatta/eval/_editor_overview.png',
      clip: { x: 1800 - 380, y: 40, width: 380, height: 1000 } });
  await p.click('#btn-drawer');
  await p.waitForTimeout(250);
  const stillThere = await p.evaluate(() => ({
      courseVisible: !document.getElementById('view-course').classList.contains('hidden'),
      checksVisible: !document.getElementById('pane-checks').classList.contains('hidden'),
      controls: !document.getElementById('course-controls').classList.contains('hidden')
  }));
  console.log('checks tab:', JSON.stringify(stillThere));
  await p.screenshot({ path: 'regatta/eval/_editor_checks.png',
      clip: { x: 1800 - 380, y: 40, width: 380, height: 1000 } });
  console.log('errors:', errs.length ? errs.slice(0, 3) : 'none');
  await b.close();
})();
