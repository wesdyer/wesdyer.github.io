// ============================================
// Clear for Action! — App Router & Init
// ============================================

import { getShip, getShips, getGame, getGames, getStorageStats } from './storage.js';
import { renderShipList } from './ship-list.js';
import { renderShipView } from './ship-view.js';
import { renderShipEditor } from './ship-editor.js';
import { renderGameList } from './game-list.js';
import { renderGameEditor } from './game-editor.js';
import { renderGameView } from './game-view.js';
import { formatDate, escapeHtml, shipCardHtml } from './utils.js';

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
        pageTitle.innerHTML = `${escapeHtml(ship?.name || 'Ship')} <a href="#/ships/${segments[1]}/edit" class="navbar-edit" aria-label="Edit ship"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></a>`;
        renderShipView(view, segments[1]);
      }
    }
    // Games
    else if (segments[0] === 'games') {
      if (segments.length === 1) {
        pageTitle.textContent = 'Games';
        renderGameList(view);
      } else if (segments[1] === 'new') {
        pageTitle.textContent = 'New Game';
        renderGameEditor(view, null);
      } else if (segments.length === 3 && segments[2] === 'edit') {
        const game = getGame(segments[1]);
        pageTitle.textContent = game?.name || 'Edit Game';
        renderGameEditor(view, segments[1]);
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
      <div class="recent-list">
        ${recentGames.map(g => `
          <a href="#/games/${g.id}" class="recent-item">
            <span class="recent-item-icon">\u{2694}\u{FE0F}</span>
            <div class="recent-item-info">
              <div class="recent-item-name">${escapeHtml(g.name || 'Untitled')}</div>
              <div class="recent-item-sub">Round ${g.round || 1} \u00b7 ${g.ships?.length || 0} ships</div>
            </div>
            <span class="recent-item-date">${formatDate(g.lastPlayed || g.createdAt)}</span>
          </a>
        `).join('')}
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
}

// --- Init ---
window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', route);
// Handle initial load if hash is already set
if (document.readyState !== 'loading') route();
