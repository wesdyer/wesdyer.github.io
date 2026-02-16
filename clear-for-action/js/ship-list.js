// ============================================
// Clear for Action! — Ship Library View
// ============================================

import { getShips, deleteShip, saveShip } from './storage.js';
import { confirmDialog, showToast } from './components.js';
import { formatDate, uuid, escapeHtml, nationalityFlag, deepClone, shipCardHtml } from './utils.js';
import { NATIONALITIES } from './data.js';

export function renderShipList(container) {
  let searchQuery = '';
  let nationalityFilter = '';

  const render = () => {
    const hasFilter = searchQuery || nationalityFilter;
    const ships = getShips()
      .filter(s => {
        if (nationalityFilter && s.nationality !== nationalityFilter) return false;
        if (!searchQuery) return true;
        const words = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
        const haystack = [
          s.name, s.classAndRating, s.nationality,
          s.captain?.name, s.captain?.rank
        ].filter(Boolean).join(' ').toLowerCase();
        return words.every(w => haystack.includes(w));
      })
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    container.innerHTML = `
      <div class="search-bar">
        <div class="search-row">
          <input type="text" class="search-input" placeholder="Search ships..." value="${escapeHtml(searchQuery)}">
          <select class="search-nationality">
            <option value="">All nations</option>
            ${NATIONALITIES.map(n => `<option value="${n.id}" ${n.id === nationalityFilter ? 'selected' : ''}>${n.id}</option>`).join('')}
          </select>
          ${hasFilter ? '<button class="btn btn-ghost btn-sm search-clear" type="button">Clear</button>' : ''}
        </div>
      </div>
      ${ships.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon"><img src="ship-silhouette.png" alt="" style="height:80px;width:auto;opacity:0.6"></div>
          <div class="empty-state-title">${searchQuery ? 'No ships found' : 'No ships yet'}</div>
          <div class="empty-state-text">${searchQuery ? 'Try a different search.' : 'Create your first ship to get started.'}</div>
          ${!searchQuery ? '<a href="#/ships/new" class="btn btn-accent">Create Ship</a>' : ''}
        </div>
      ` : `
        <div class="ship-grid">
          ${ships.map(s => shipCardHtml(s)).join('')}
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

    // Nationality filter
    container.querySelector('.search-nationality')?.addEventListener('change', (e) => {
      nationalityFilter = e.target.value;
      render();
    });

    // Clear button
    container.querySelector('.search-clear')?.addEventListener('click', () => {
      searchQuery = '';
      nationalityFilter = '';
      render();
    });

    // Card clicks
    container.querySelectorAll('.ship-grid-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.ship-grid-card-actions')) return;
        location.hash = `#/ships/${card.dataset.id}`;
      });
    });

    // Edit buttons
    container.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        location.hash = `#/ships/${btn.dataset.id}/edit`;
      });
    });

    // Delete buttons
    container.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const ship = getShips().find(s => s.id === id);
        const ok = await confirmDialog(
          `Delete "${ship?.name || 'Untitled'}"? This cannot be undone.`,
          { title: 'Delete Ship', confirmText: 'Delete', danger: true }
        );
        if (ok) {
          deleteShip(id);
          showToast('Ship deleted');
          render();
        }
      });
    });

    container.querySelectorAll('[data-action="duplicate"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const ship = getShips().find(s => s.id === id);
        if (!ship) return;
        const copy = deepClone(ship);
        copy.id = uuid();
        copy.name = ship.name + ' (copy)';
        copy.createdAt = new Date().toISOString();
        copy.updatedAt = new Date().toISOString();
        saveShip(copy);
        showToast('Ship duplicated');
        render();
      });
    });
  };

  render();
}