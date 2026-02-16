// ============================================
// Clear for Action! — Battle Library View
// ============================================

import { getGames, deleteGame, saveGame } from './storage.js';
import { confirmDialog, showToast } from './components.js';
import { formatDate, uuid, escapeHtml, deepClone, windArrow } from './utils.js';

export function renderGameList(container) {
  let searchQuery = '';

  const render = () => {
    const hasFilter = !!searchQuery;
    const games = getGames()
      .filter(g => {
        if (!searchQuery) return true;
        const words = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
        const shipNames = (g.ships || []).map(s => s.name || '').join(' ');
        const haystack = [g.name, shipNames].filter(Boolean).join(' ').toLowerCase();
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
          <div class="empty-state-icon"><img src="battle-icon.png" alt="" style="height:80px;width:auto;opacity:0.6"></div>
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
      card.addEventListener('click', (e) => {
        if (e.target.closest('.battle-card-actions')) return;
        location.hash = `#/games/${card.dataset.id}`;
      });
    });

    // Edit buttons
    container.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        location.hash = `#/games/${btn.dataset.id}/edit`;
      });
    });

    // Duplicate buttons
    container.querySelectorAll('[data-action="duplicate"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const game = getGames().find(g => g.id === id);
        if (!game) return;
        const ok = await confirmDialog(
          `Duplicate "${game.name || 'this battle'}"?`,
          { title: 'Duplicate Battle', confirmText: 'Duplicate' }
        );
        if (!ok) return;
        const copy = deepClone(game);
        copy.id = uuid();
        copy.name = (game.name || 'Untitled') + ' (copy)';
        copy.createdAt = new Date().toISOString();
        copy.lastPlayed = new Date().toISOString();
        saveGame(copy);
        showToast('Battle duplicated');
        render();
      });
    });

    // Delete buttons
    container.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const game = getGames().find(g => g.id === id);
        const ok = await confirmDialog(
          `Delete battle "${game?.name || 'Untitled'}"? All tracked state will be lost.`,
          { title: 'Delete Battle', confirmText: 'Delete', danger: true }
        );
        if (ok) {
          deleteGame(id);
          showToast('Battle deleted');
          render();
        }
      });
    });
  };

  render();
}

function battleCardHtml(game) {
  const shipCount = game.ships?.length || 0;
  const windDir = game.wind?.direction || 'N';
  const windStr = game.wind?.strength || 'moderate';
  const round = game.round || 1;

  // Ship roster: first 4 names, then "+N more"
  const shipNames = (game.ships || []).map(s => escapeHtml(s.name || 'Untitled'));
  const displayNames = shipNames.slice(0, 4);
  const moreCount = shipNames.length - 4;
  const rosterHtml = displayNames.length > 0
    ? displayNames.join(', ') + (moreCount > 0 ? ` +${moreCount} more` : '')
    : '';

  return `
    <div class="battle-card" data-id="${game.id}">
      <div class="battle-card-body">
        <div class="battle-card-title">${escapeHtml(game.name || 'Untitled Battle')}</div>
        <div class="battle-card-meta">
          Round ${round} &middot; ${shipCount} ship${shipCount !== 1 ? 's' : ''} &middot;
          ${windArrow(windDir)} ${windDir} ${windStr} &middot;
          ${formatDate(game.lastPlayed || game.createdAt)}
        </div>
        ${rosterHtml ? `<div class="battle-card-ships">${rosterHtml}</div>` : ''}
      </div>
      <div class="battle-card-actions">
        <button class="btn btn-ghost btn-sm card-action-btn" data-action="edit" data-id="${game.id}" title="Edit"><img src="quill-navy.png" alt="Edit" class="card-action-icon"></button>
        <button class="btn btn-ghost btn-sm card-action-btn" data-action="duplicate" data-id="${game.id}" title="Duplicate"><img src="duplicate-icon.png" alt="Duplicate" class="card-action-icon"></button>
        <span class="spacer"></span>
        <button class="btn btn-ghost btn-sm card-action-btn" data-action="delete" data-id="${game.id}" title="Delete" style="color:var(--red)" aria-label="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
      </div>
    </div>`;
}
