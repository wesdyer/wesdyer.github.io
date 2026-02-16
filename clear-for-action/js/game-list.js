// ============================================
// Clear for Action! — Battle Library View
// ============================================

import { getGames } from './storage.js';
import { formatDate, escapeHtml, getGameShips, nationalityFlag, calculatePoints } from './utils.js';

export function renderGameList(container) {
  let searchQuery = '';

  const render = () => {
    const hasFilter = !!searchQuery;
    const games = getGames()
      .filter(g => {
        if (!searchQuery) return true;
        const words = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
        const ships = getGameShips(g);
        const shipNames = ships.map(s => s.name || '').join(' ');
        const forceNames = (g.forces || []).map(f => f.name || '').join(' ');
        const haystack = [g.name, shipNames, forceNames].filter(Boolean).join(' ').toLowerCase();
        return words.every(w => haystack.includes(w));
      })
      .sort((a, b) => new Date(b.lastPlayed || b.createdAt) - new Date(a.lastPlayed || a.createdAt));

    container.innerHTML = `
      <div class="search-bar">
        <div class="search-row">
          <input type="text" class="search-input" placeholder="Search battles..." value="${escapeHtml(searchQuery)}">
          ${hasFilter ? '<button class="btn btn-ghost btn-sm search-clear" type="button">Clear</button>' : ''}
        </div>
      </div>
      ${games.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon"><img src="battle-icon.png" alt="" style="height:80px;width:auto;opacity:0.6" loading="lazy"></div>
          <div class="empty-state-title">${hasFilter ? 'No battles found' : 'No battles yet'}</div>
          <div class="empty-state-text">${hasFilter ? 'Try a different search.' : 'Create your first battle to get started.'}</div>
          ${!hasFilter ? '<a href="#/games/new" class="btn btn-primary">Create Battle</a>' : ''}
        </div>
      ` : `
        <div class="battle-grid">
          ${games.map(g => battleCardHtml(g)).join('')}
        </div>
      `}
    `;

    // Search
    const searchInput = container.querySelector('.search-input');
    searchInput?.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      render();
      const newInput = container.querySelector('.search-input');
      newInput?.focus();
      newInput.selectionStart = newInput.selectionEnd = newInput.value.length;
    });

    // Clear button
    container.querySelector('.search-clear')?.addEventListener('click', () => {
      searchQuery = '';
      render();
    });

    // Card clicks
    container.querySelectorAll('.battle-card').forEach(card => {
      card.addEventListener('click', () => {
        location.hash = `#/games/${card.dataset.id}`;
      });
    });
  };

  render();
}

export function battleCardHtml(game) {
  const allShips = getGameShips(game);
  const shipCount = allShips.length;
  const round = game.round || 1;

  // Force roster: order of battle
  const forceLines = (game.forces || [])
    .filter(f => f.ships?.length)
    .map(f => {
      const count = f.ships.length;
      const totalBroadside = f.ships.reduce((sum, s) => sum + (s.broadsideWeight || 0), 0);
      const totalPoints = f.ships.reduce((sum, s) => sum + calculatePoints(s), 0);
      return `<div class="battle-card-force-line">
        <span class="force-line-flag">${nationalityFlag(f.nationality)}</span>
        <span class="force-line-name">${escapeHtml(f.name || f.nationality)}</span>
        <span class="force-line-ships"><strong>${count}</strong> ship${count !== 1 ? 's' : ''}</span>
        <span class="force-line-broadside">${totalBroadside ? `<strong>${totalBroadside}</strong> lbs` : ''}</span>
        <span class="force-line-points"><span class="points-badge">${totalPoints} pts</span></span>
      </div>`;
    })
    .join('');
  const rosterHtml = forceLines || '';

  return `
    <div class="battle-card" data-id="${game.id}">
      <div class="battle-card-body">
        <div class="battle-card-title">${escapeHtml(game.name || 'Untitled Battle')}</div>
        ${rosterHtml ? `<div class="battle-card-forces">${rosterHtml}</div>` : ''}
      </div>
    </div>`;
}
