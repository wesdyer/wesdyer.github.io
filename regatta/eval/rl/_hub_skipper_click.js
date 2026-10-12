// Change skipper on the hub: the button opens the picker, a pick updates the card.
const { chromium } = require('playwright'); const path = require('path');
(async () => {
    const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1440, height: 900 } });
    p.on('pageerror', e => console.log('PAGE ERROR', e.message));
    await p.goto('file://' + path.resolve(__dirname, '../../index.html')); await p.waitForTimeout(2000);
    const card = () => p.evaluate(() => ({ name: document.getElementById('hub-skipper-name').textContent, creature: document.getElementById('hub-skipper-creature').textContent, band: document.getElementById('hub-skipper-band').style.background }));
    console.log('before', await card());
    await p.click('#hub-skipper'); await p.waitForTimeout(500);
    const open = await p.evaluate(() => !UI.characterPicker.classList.contains('hidden'));
    const pick = await p.evaluate(() => [...document.querySelectorAll('#character-grid button[data-char]')].map(e => e.dataset.char).find(n => n !== settings.character));
    await p.click(`#character-grid button[data-char="${pick}"]`); await p.waitForTimeout(500);
    console.log('picker opened:', open, ' picked:', pick, ' after', await card());
    await b.close();
})();
