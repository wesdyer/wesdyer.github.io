// ============================================
// Clear for Action! — Ship Library View
// ============================================

import { getShips } from './storage.js';
import { escapeHtml, shipCardHtml, calculatePoints } from './utils.js';
import { NATIONALITIES } from './data.js';

const SORT_OPTIONS = [
  { id: 'recent-desc', label: 'Recent', field: 'updatedAt', dir: -1, parse: v => new Date(v || 0).getTime() },
  { id: 'recent-asc', label: 'Oldest', field: 'updatedAt', dir: 1, parse: v => new Date(v || 0).getTime() },
  { id: 'name-asc', label: 'A\u2013Z', field: 'name', dir: 1, parse: v => (v || '').toLowerCase() },
  { id: 'name-desc', label: 'Z\u2013A', field: 'name', dir: -1, parse: v => (v || '').toLowerCase() },
  { id: 'tonnage-desc', label: 'Size \u2193', field: 'tonnage', dir: -1, parse: v => parseInt(v) || 0 },
  { id: 'tonnage-asc', label: 'Size \u2191', field: 'tonnage', dir: 1, parse: v => parseInt(v) || 0 },
  { id: 'broadside-desc', label: 'Broadside \u2193', field: 'broadsideWeight', dir: -1, parse: v => v || 0 },
  { id: 'broadside-asc', label: 'Broadside \u2191', field: 'broadsideWeight', dir: 1, parse: v => v || 0 },
  { id: 'points-desc', label: 'Points \u2193', field: '_points', dir: -1, parse: v => v || 0 },
  { id: 'points-asc', label: 'Points \u2191', field: '_points', dir: 1, parse: v => v || 0 },
];

let persistedSort = 'recent-desc';

export function renderShipList(container) {
  let searchQuery = '';
  let nationalityFilter = '';
  let sortId = persistedSort;

  const render = () => {
    const hasFilter = searchQuery || nationalityFilter;
    const sort = SORT_OPTIONS.find(s => s.id === sortId) || SORT_OPTIONS[0];
    const isString = sortId.startsWith('name');

    const ships = getShips()
      .map(s => { s._points = calculatePoints(s); return s; })
      .filter(s => {
        if (nationalityFilter && s.nationality !== nationalityFilter) return false;
        if (!searchQuery) return true;
        const words = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
        const haystack = [
          s.name, s.classAndRating, s.nationality,
          s.captain?.name, s.captain?.rank, s.yearLaunched
        ].filter(Boolean).join(' ').toLowerCase();
        return words.every(w => haystack.includes(w));
      })
      .sort((a, b) => {
        const va = sort.parse(a[sort.field]);
        const vb = sort.parse(b[sort.field]);
        if (isString) return sort.dir * va.localeCompare(vb);
        return sort.dir * (va - vb);
      });

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
        <div class="sort-row">
          <select class="search-sort">
            ${SORT_OPTIONS.map(s => `<option value="${s.id}" ${s.id === sortId ? 'selected' : ''}>${s.label}</option>`).join('')}
          </select>
        </div>
      </div>
      ${ships.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon"><img src="ship-silhouette.png" alt="" style="height:80px;width:auto;opacity:0.6" loading="lazy"></div>
          <div class="empty-state-title">${searchQuery ? 'No ships found' : 'No ships yet'}</div>
          <div class="empty-state-text">${searchQuery ? 'Try a different search.' : 'Create your first ship to get started.'}</div>
          ${!searchQuery ? '<a href="#/ships/new" class="btn btn-primary">Create Ship</a>' : ''}
        </div>
      ` : `
        <div class="ship-grid">
          ${ships.map(s => shipCardHtml(s, { showActions: false })).join('')}
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

    // Sort
    container.querySelector('.search-sort')?.addEventListener('change', (e) => {
      sortId = e.target.value;
      persistedSort = sortId;
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
      card.addEventListener('click', () => {
        location.hash = `#/ships/${card.dataset.id}`;
      });
    });

  };

  render();
}