// ============================================
// Clear for Action! — Game Library View
// ============================================

import { getGames, deleteGame } from './storage.js';
import { confirmDialog, showToast } from './components.js';
import { formatDate, escapeHtml, windArrow } from './utils.js';

export function renderGameList(container) {
  const render = () => {
    const games = getGames().sort((a, b) => new Date(b.lastPlayed || b.createdAt) - new Date(a.lastPlayed || a.createdAt));

    container.innerHTML = `
      <div class="page-header">
        <h1>Games</h1>
        <a href="#/games/new" class="btn btn-primary">+ New Game</a>
      </div>
      ${games.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">\u{2693}</div>
          <div class="empty-state-title">No games yet</div>
          <div class="empty-state-text">Create a game to start tracking your battles.</div>
          <a href="#/games/new" class="btn btn-accent">New Game</a>
        </div>
      ` : `
        <div>
          ${games.map(g => gameListItem(g)).join('')}
        </div>
      `}
    `;

    // Resume game
    container.querySelectorAll('.game-list-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.game-list-actions')) return;
        location.hash = `#/games/${item.dataset.id}`;
      });
    });

    // Edit button
    container.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        location.hash = `#/games/${btn.dataset.id}/edit`;
      });
    });

    // Delete button
    container.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const game = getGames().find(g => g.id === id);
        const ok = await confirmDialog(
          `Delete game "${game?.name || 'Untitled'}"? All tracked state will be lost.`,
          { title: 'Delete Game', confirmText: 'Delete', danger: true }
        );
        if (ok) {
          deleteGame(id);
          showToast('Game deleted');
          render();
        }
      });
    });
  };

  render();
}

function gameListItem(game) {
  const shipCount = game.ships?.length || 0;
  const windDir = game.wind?.direction || 'N';
  const windStr = game.wind?.strength || 'moderate';
  const round = game.round || 1;

  return `
    <div class="game-list-item" data-id="${game.id}">
      <div class="game-list-info">
        <div class="game-list-title">${escapeHtml(game.name || 'Untitled Game')}</div>
        <div class="game-list-meta">
          Round ${round} &middot; ${shipCount} ship${shipCount !== 1 ? 's' : ''} &middot;
          Wind ${windArrow(windDir)} ${windDir} ${windStr} &middot;
          ${formatDate(game.lastPlayed || game.createdAt)}
        </div>
      </div>
      <div class="game-list-actions">
        <button class="btn btn-ghost btn-sm" data-action="edit" data-id="${game.id}">Edit</button>
        <button class="btn btn-ghost btn-sm" data-action="delete" data-id="${game.id}" style="color:var(--red)">Del</button>
      </div>
    </div>
  `;
}
