// ============================================
// Clear for Action! — App Router & Init
// ============================================

import { getShip, getShips, getGame, getGames, getStorageStats, saveShip } from './storage.js';
import { renderShipList } from './ship-list.js';
import { renderShipView } from './ship-view.js';
import { renderShipEditor } from './ship-editor.js';
import { renderGameList, battleCardHtml } from './game-list.js';
import { renderGameEditor } from './game-editor.js';
import { renderGameView, renderShipActionView } from './game-view.js';
import { formatDate, escapeHtml, shipCardHtml, getGameShips, uuid, deepClone } from './utils.js';
import { showToast, confirmDialog, showModal } from './components.js';

function setupShipyardImportExport(listContainer) {
  // Export
  document.getElementById('nav-export-ships')?.addEventListener('click', () => {
    const allShips = getShips();
    if (allShips.length === 0) {
      showToast('No ships to export', 'info');
      return;
    }
    const data = JSON.stringify(allShips, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cfa-shipyard-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${allShips.length} ship${allShips.length !== 1 ? 's' : ''}`, 'success');
  });

  // Import
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);

  document.getElementById('nav-import-ships')?.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      if (!Array.isArray(imported)) throw new Error('Invalid format');
      const valid = imported.filter(s => s && typeof s === 'object' && s.name);
      if (valid.length === 0) {
        showToast('No valid ships found in file', 'error');
        return;
      }
      const existingIds = new Set(getShips().map(s => s.id));
      const dupeCount = valid.filter(s => existingIds.has(s.id)).length;

      let dupMode = 'duplicate'; // default if no dupes
      if (dupeCount > 0) {
        dupMode = await new Promise(resolve => {
          const footer = document.createElement('div');
          footer.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;width:100%';
          const opts = [
            { id: 'duplicate', label: 'Duplicate', cls: 'btn btn-primary', desc: 'Add as new ships' },
            { id: 'replace', label: 'Replace', cls: 'btn btn-secondary', desc: 'Overwrite existing' },
            { id: 'ignore', label: 'Ignore', cls: 'btn btn-secondary', desc: 'Skip duplicates' },
          ];
          opts.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = opt.cls;
            btn.textContent = opt.label;
            btn.title = opt.desc;
            btn.addEventListener('click', () => { close(); resolve(opt.id); });
            footer.appendChild(btn);
          });
          const cancelBtn = document.createElement('button');
          cancelBtn.className = 'btn btn-ghost';
          cancelBtn.textContent = 'Cancel';
          cancelBtn.addEventListener('click', () => { close(); resolve(null); });
          footer.appendChild(cancelBtn);

          const { close } = showModal({
            title: 'Import Ships',
            body: `<p>${valid.length} ship${valid.length !== 1 ? 's' : ''} found, ${dupeCount} already in shipyard.</p><p>How should duplicates be handled?</p>`,
            footer,
          });
        });
        if (!dupMode) return;
      } else {
        const ok = await confirmDialog(
          `Import ${valid.length} ship${valid.length !== 1 ? 's' : ''}?`,
          { title: 'Import Ships', confirmText: 'Import' }
        );
        if (!ok) return;
      }

      let count = 0;
      for (const ship of valid) {
        if (existingIds.has(ship.id)) {
          if (dupMode === 'ignore') continue;
          if (dupMode === 'duplicate') ship.id = uuid();
          // 'replace' keeps same id, saveShip will overwrite
        }
        ship.updatedAt = new Date().toISOString();
        saveShip(ship);
        count++;
      }
      showToast(`Imported ${count} ship${count !== 1 ? 's' : ''}`, 'success');
      route(); // re-render the list
    } catch (e) {
      showToast('Failed to import: invalid file', 'error');
    }
    fileInput.value = '';
    fileInput.remove();
  });
}

// --- Router ---
function route() {
  const hash = location.hash || '#/';
  const view = document.getElementById('view');
  view.innerHTML = '';

  // Update active nav link
  document.querySelectorAll('.nav-link').forEach(link => {
    const linkRoute = link.dataset.route;
    if (linkRoute === 'home' && hash === '#/') link.classList.add('active');
    else if (linkRoute === 'ships' && hash.startsWith('#/ships')) link.classList.add('active');
    else if (linkRoute === 'games' && hash.startsWith('#/games')) link.classList.add('active');
    else link.classList.remove('active');
  });

  // Parse route
  const path = hash.slice(1); // remove #
  const segments = path.split('/').filter(Boolean);
  const pageTitle = document.getElementById('page-title');
  const backBtn = document.getElementById('back-btn');

  const navbarBrand = document.querySelector('.navbar-brand');

  // Determine back target based on route depth
  let backTarget = null;
  if (segments.length === 1) backTarget = '#/';
  else if (segments.length >= 2) backTarget = '#/' + segments.slice(0, -1).join('/');

  if (backTarget) {
    backBtn.classList.remove('hidden');
    backBtn.onclick = () => { location.hash = backTarget; };
    navbarBrand.classList.add('hidden');
  } else {
    backBtn.classList.add('hidden');
    backBtn.onclick = null;
    navbarBrand.classList.remove('hidden');
  }

  try {
    if (segments.length === 0) {
      pageTitle.textContent = '';
      renderHome(view);
    }
    // Ships
    else if (segments[0] === 'ships') {
      if (segments.length === 1) {
        pageTitle.innerHTML = 'Shipyard <span class="navbar-actions"><button class="navbar-icon-btn" id="nav-import-ships" aria-label="Import ships" title="Import"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></button><button class="navbar-icon-btn" id="nav-export-ships" aria-label="Export ships" title="Export"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button><a href="#/ships/new" class="btn btn-primary btn-add navbar-add" aria-label="New Ship">+</a></span>';
        renderShipList(view);
        setupShipyardImportExport(view);
      } else if (segments[1] === 'new') {
        pageTitle.textContent = 'New Ship';
        const params = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
        renderShipEditor(view, null, params);
      } else if (segments.length === 3 && segments[2] === 'edit') {
        const ship = getShip(segments[1]);
        pageTitle.textContent = ship?.name || 'Edit Ship';
        renderShipEditor(view, segments[1]);
      } else if (segments.length === 2) {
        const ship = getShip(segments[1]);
        pageTitle.innerHTML = `${escapeHtml(ship?.name || 'Ship')} <span class="navbar-actions"><a href="#/ships/${segments[1]}/edit" class="navbar-edit" aria-label="Edit ship"><img src="quill-white.png" alt="Edit" class="navbar-quill-icon"></a></span>`;
        renderShipView(view, segments[1]);
      }
    }
    // Games
    else if (segments[0] === 'games') {
      if (segments.length === 1) {
        pageTitle.innerHTML = 'Battles <a href="#/games/new" class="btn btn-primary btn-add navbar-add" aria-label="New Battle">+</a>';
        renderGameList(view);
      } else if (segments[1] === 'new') {
        pageTitle.textContent = 'New Game';
        renderGameEditor(view, null);
      } else if (segments.length === 3 && segments[2] === 'edit') {
        const game = getGame(segments[1]);
        pageTitle.textContent = game?.name || 'Edit Game';
        renderGameEditor(view, segments[1]);
      } else if (segments.length === 4 && segments[2] === 'ship') {
        const game = getGame(segments[1]);
        const allShips = getGameShips(game);
        const shipIdx = parseInt(segments[3]);
        const ship = allShips?.[shipIdx];
        const prevDisabled = shipIdx === 0 ? 'disabled' : '';
        const nextDisabled = shipIdx >= allShips.length - 1 ? 'disabled' : '';
        backBtn.onclick = () => { location.hash = `#/games/${segments[1]}`; };
        pageTitle.innerHTML = `${escapeHtml(ship?.displayName || ship?.name || 'Ship')} <span class="navbar-actions"><button class="navbar-nav-btn" ${prevDisabled} data-dir="prev" aria-label="Previous ship">\u2190</button><span class="navbar-nav-counter">${shipIdx + 1}/${allShips.length}</span><button class="navbar-nav-btn" ${nextDisabled} data-dir="next" aria-label="Next ship">\u2192</button></span>`;
        document.querySelector('.navbar-nav-btn[data-dir="prev"]')?.addEventListener('click', () => {
          if (shipIdx > 0) location.hash = `#/games/${segments[1]}/ship/${shipIdx - 1}`;
        });
        document.querySelector('.navbar-nav-btn[data-dir="next"]')?.addEventListener('click', () => {
          if (shipIdx < allShips.length - 1) location.hash = `#/games/${segments[1]}/ship/${shipIdx + 1}`;
        });
        renderShipActionView(view, segments[1], shipIdx);
      } else if (segments.length === 2) {
        const game = getGame(segments[1]);
        pageTitle.innerHTML = `${escapeHtml(game?.name || 'Game')} <span class="navbar-actions"><a href="#/games/${segments[1]}/edit" class="navbar-edit" aria-label="Edit battle"><img src="quill-white.png" alt="Edit" class="navbar-quill-icon"></a></span>`;
        renderGameView(view, segments[1]);
      }
    }
    else {
      pageTitle.textContent = '';
      view.innerHTML = '<div class="empty-state"><div class="empty-state-title">Page not found</div><p><a href="#/">Go home</a></p></div>';
    }
  } catch (err) {
    console.error('Route error:', err);
    view.innerHTML = `<div class="empty-state"><div class="empty-state-title">Something went wrong</div><p>${escapeHtml(err.message)}</p><p><a href="#/">Go home</a></p></div>`;
  }
}

// --- Home Dashboard ---
function renderHome(container) {
  const ships = getShips().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const games = getGames().sort((a, b) => new Date(b.lastPlayed || b.createdAt) - new Date(a.lastPlayed || a.createdAt));
  const recentShips = ships.slice(0, 3);
  const recentGames = games.slice(0, 3);

  container.innerHTML = `
    <div class="home-hero">
      <img src="pob.png" alt="Naval battle">
      <div class="home-hero-tagline">Build Ships. Fight Battles. Command the Seas.</div>
    </div>
    <div class="home-nav">
      <a href="#/ships" class="home-nav-card">
        <img src="ship-silhouette.png" class="home-nav-img home-nav-img-ship" alt="">
        <span class="home-nav-label">Shipyard</span>
        <span class="home-nav-sub">${ships.length ? `${ships.length} ship${ships.length !== 1 ? 's' : ''}` : 'Create a Ship'}</span>
      </a>
      <a href="#/games" class="home-nav-card">
        <img src="battle-icon.png" class="home-nav-img home-nav-img-battle" alt="">
        <span class="home-nav-label">Battles</span>
        <span class="home-nav-sub">${games.length ? `${games.length} battle${games.length !== 1 ? 's' : ''}` : 'Create a Battle'}</span>
      </a>
    </div>

    ${recentShips.length > 0 ? `
      <h2 style="margin-top:var(--space-xl);margin-bottom:var(--space-md)">Recent Ships</h2>
      <div class="ship-grid">
        ${recentShips.map(s => shipCardHtml(s, { showActions: false })).join('')}
      </div>
    ` : ''}

    ${recentGames.length > 0 ? `
      <h2 style="margin-top:var(--space-xl);margin-bottom:var(--space-md)">Recent Battles</h2>
      <div class="battle-grid">
        ${recentGames.map(g => battleCardHtml(g)).join('')}
      </div>
    ` : ''}
  `;

  // Ship card clicks
  container.querySelectorAll('.ship-grid-card').forEach(card => {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      location.hash = `#/ships/${card.dataset.id}`;
    });
  });

  // Battle card clicks
  container.querySelectorAll('.battle-card').forEach(card => {
    card.addEventListener('click', () => {
      location.hash = `#/games/${card.dataset.id}`;
    });
  });
}

// --- Init ---
window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', route);
// Handle initial load if hash is already set
if (document.readyState !== 'loading') route();
