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
        pageTitle.innerHTML = 'Shipyard <a href="#/ships/new" class="btn btn-primary btn-add navbar-add" aria-label="New Ship">+</a>';
        renderShipList(view);
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
        pageTitle.innerHTML = `${escapeHtml(ship?.name || 'Ship')} <span class="navbar-actions"><a href="#/ships/${segments[1]}/edit" class="navbar-edit" aria-label="Edit ship"><img src="quill-white.png" alt="Edit" class="navbar-quill-icon"></a><button class="navbar-edit navbar-duplicate-btn" data-id="${segments[1]}" aria-label="Duplicate ship"><img src="duplicate-icon.png" alt="Duplicate" class="navbar-quill-icon"></button></span>`;
        renderShipView(view, segments[1]);
        // Duplicate button handler
        document.querySelector('.navbar-duplicate-btn')?.addEventListener('click', () => {
          const orig = getShip(segments[1]);
          if (!orig) return;
          const copy = deepClone(orig);
          copy.id = uuid();
          copy.name = (orig.name || 'Untitled') + ' Copy';
          copy.createdAt = new Date().toISOString();
          copy.updatedAt = new Date().toISOString();
          saveShip(copy);
          location.hash = `#/ships/${copy.id}`;
        });
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
        pageTitle.textContent = game?.name || 'Game';
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
      <div class="home-hero-tagline">Manage Ships. Fight Battles. Command the Seas.</div>
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
