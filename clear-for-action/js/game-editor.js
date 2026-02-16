// ============================================
// Clear for Action! — Game Editor
// ============================================

import { getGame, getShips, saveGame } from './storage.js';
import { NATIONALITIES } from './data.js';
import { createGameShip } from './data.js';
import { showToast, showModal } from './components.js';
import { uuid, escapeHtml, nationalityFlag, getGameShips } from './utils.js';

export function renderGameEditor(container, gameId) {
  const isNew = !gameId;
  let game;

  if (gameId) {
    game = getGame(gameId);
    if (!game) {
      container.innerHTML = '<p>Game not found. <a href="#/games">Back to games</a></p>';
      return;
    }
  } else {
    game = {
      id: uuid(),
      name: '',
      description: '',
      createdAt: new Date().toISOString(),
      lastPlayed: new Date().toISOString(),
      round: 1,
      wind: { direction: 'N', strength: 'moderate' },
      forces: [],
    };
  }

  // In-memory forces state (deep copy)
  let forces = JSON.parse(JSON.stringify(game.forces || []));

  const render = () => {
    container.innerHTML = `
      <div class="page-header">
        <h1>${isNew ? 'New Game' : 'Edit Game'}</h1>
        <div class="flex gap-sm">
          <a href="${isNew ? '#/games' : '#/games/' + gameId}" class="btn btn-ghost">Cancel</a>
          <button id="save-game" class="btn btn-primary">Save</button>
        </div>
      </div>
      <div class="form-section">
        <div class="form-section-title">Game Details</div>
        <div class="form-group">
          <label class="form-label">Game Name *</label>
          <input type="text" class="form-input" id="game-name" value="${escapeHtml(game.name)}" placeholder="e.g. Battle of the Nile">
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-textarea" id="game-description" placeholder="Scenario notes, house rules, etc.">${escapeHtml(game.description || '')}</textarea>
        </div>
      </div>
      <div class="form-section">
        <div class="form-section-title">Forces</div>
        <div id="forces-container"></div>
        <button id="add-force" class="btn btn-secondary mt-md">+ Add Force</button>
      </div>
    `;

    renderForces();

    // Add force
    container.querySelector('#add-force').addEventListener('click', () => {
      forces.push({
        id: uuid(),
        nationality: 'British',
        name: 'British',
        ships: [],
      });
      renderForces();
    });

    // Save
    container.querySelector('#save-game').addEventListener('click', () => {
      const name = container.querySelector('#game-name').value.trim();
      if (!name) {
        showToast('Game name is required', 'error');
        return;
      }
      game.name = name;
      game.description = container.querySelector('#game-description').value;
      game.forces = forces;
      saveGame(game);
      showToast(isNew ? 'Game created' : 'Game saved', 'success');
      location.hash = isNew ? `#/games/${game.id}` : `#/games/${gameId}`;
    });
  };

  const renderForces = () => {
    const fc = container.querySelector('#forces-container');
    if (!fc) return;
    fc.innerHTML = '';

    if (forces.length === 0) {
      fc.innerHTML = '<p class="text-muted">No forces yet. Add a force to begin assigning ships.</p>';
      return;
    }

    forces.forEach((force, fi) => {
      const card = document.createElement('div');
      card.className = 'force-card';

      // Header: nationality + name
      const header = document.createElement('div');
      header.className = 'force-card-header';

      const natSelect = document.createElement('select');
      natSelect.className = 'form-select';
      natSelect.style.flex = '0 0 auto';
      natSelect.style.width = 'auto';
      natSelect.innerHTML = NATIONALITIES.map(n =>
        `<option value="${n.id}" ${force.nationality === n.id ? 'selected' : ''}>${n.id}</option>`
      ).join('');

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'form-input';
      nameInput.value = force.name;
      nameInput.placeholder = 'Force name';

      // Track if user has manually changed the name
      let nameManuallySet = force.name !== force.nationality;

      natSelect.addEventListener('change', () => {
        const oldNat = force.nationality;
        force.nationality = natSelect.value;
        if (!nameManuallySet || force.name === oldNat) {
          force.name = force.nationality;
          nameInput.value = force.name;
          nameManuallySet = false;
        }
      });

      nameInput.addEventListener('input', () => {
        force.name = nameInput.value;
        nameManuallySet = true;
      });

      header.append(natSelect, nameInput);
      card.appendChild(header);

      // Ship list
      const shipList = document.createElement('div');
      shipList.className = 'force-ship-list';

      if (force.ships.length === 0) {
        shipList.innerHTML = '<p class="text-muted text-small" style="padding:var(--space-sm) 0">No ships in this force.</p>';
      } else {
        force.ships.forEach((ship, si) => {
          const row = document.createElement('div');
          row.className = 'force-ship-row';
          row.innerHTML = `
            <span class="force-ship-flag">${nationalityFlag(ship.nationality)}</span>
            <span class="force-ship-name">${escapeHtml(ship.displayName || ship.name || 'Untitled')}</span>
            <span class="force-ship-class">${escapeHtml(ship.classAndRating || '')}</span>
            <button class="btn btn-ghost btn-sm force-ship-remove" title="Remove" aria-label="Remove ship" style="color:var(--red);padding:4px">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          `;
          row.querySelector('.force-ship-remove').addEventListener('click', () => {
            force.ships.splice(si, 1);
            renderForces();
          });
          shipList.appendChild(row);
        });
      }
      card.appendChild(shipList);

      // Actions row
      const actions = document.createElement('div');
      actions.className = 'force-actions';

      const addShipBtn = document.createElement('button');
      addShipBtn.className = 'btn btn-secondary btn-sm';
      addShipBtn.textContent = '+ Add Ship';
      addShipBtn.addEventListener('click', () => {
        openShipPicker(force);
      });

      const deleteForceBtn = document.createElement('button');
      deleteForceBtn.className = 'btn btn-ghost btn-sm';
      deleteForceBtn.style.color = 'var(--red)';
      deleteForceBtn.setAttribute('aria-label', 'Delete Force');
      deleteForceBtn.title = 'Delete Force';
      deleteForceBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
      deleteForceBtn.addEventListener('click', () => {
        forces.splice(fi, 1);
        renderForces();
      });

      actions.append(addShipBtn, deleteForceBtn);
      card.appendChild(actions);

      fc.appendChild(card);
    });
  };

  const openShipPicker = (force) => {
    const allShips = getShips();
    // Collect all ship sourceShipIds already in any force
    const usedShipIds = new Set();
    forces.forEach(f => {
      (f.ships || []).forEach(s => usedShipIds.add(s.sourceShipId));
    });

    let searchText = '';
    let filterNationality = force.nationality;

    const body = document.createElement('div');

    const renderPickerList = () => {
      body.innerHTML = '';

      // Search row
      const searchRow = document.createElement('div');
      searchRow.className = 'search-row mb-md';

      const searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.className = 'search-input';
      searchInput.placeholder = 'Search ships...';
      searchInput.value = searchText;

      const natFilter = document.createElement('select');
      natFilter.className = 'search-nationality';
      natFilter.innerHTML = `<option value="">All</option>` +
        NATIONALITIES.map(n =>
          `<option value="${n.id}" ${filterNationality === n.id ? 'selected' : ''}>${n.id}</option>`
        ).join('');

      searchRow.append(searchInput, natFilter);
      body.appendChild(searchRow);

      // Filter ships
      const filtered = allShips.filter(s => {
        if (filterNationality && s.nationality !== filterNationality) return false;
        if (searchText) {
          const hay = [s.name, s.classAndRating, s.nationality].filter(Boolean).join(' ').toLowerCase();
          return searchText.toLowerCase().split(/\s+/).every(w => hay.includes(w));
        }
        return true;
      });

      // Ship list
      const list = document.createElement('div');
      list.className = 'ship-selector';
      list.style.maxHeight = '400px';
      list.style.overflowY = 'auto';

      if (filtered.length === 0) {
        list.innerHTML = '<p class="text-muted text-small" style="padding:var(--space-md)">No ships match your search.</p>';
      } else {
        filtered.forEach(ship => {
          const used = usedShipIds.has(ship.id);
          const item = document.createElement('div');
          item.className = `ship-selector-item ${used ? 'selected' : ''}`;
          item.style.opacity = used ? '0.5' : '1';
          item.style.cursor = used ? 'not-allowed' : 'pointer';
          item.innerHTML = `
            <span class="ship-name">${nationalityFlag(ship.nationality)} ${escapeHtml(ship.name || 'Untitled')}</span>
            <span class="ship-class">${escapeHtml(ship.classAndRating || '')}</span>
            ${used ? '<span class="badge">In use</span>' : ''}
          `;
          if (!used) {
            item.addEventListener('click', () => {
              const gameShip = createGameShip(ship);
              force.ships.push(gameShip);
              usedShipIds.add(ship.id);
              close();
              renderForces();
            });
          }
          list.appendChild(item);
        });
      }
      body.appendChild(list);

      // Wire up search/filter events
      searchInput.addEventListener('input', (e) => {
        searchText = e.target.value;
        renderPickerList();
        // Restore focus
        const newInput = body.querySelector('.search-input');
        newInput?.focus();
        newInput.selectionStart = newInput.selectionEnd = newInput.value.length;
      });

      natFilter.addEventListener('change', (e) => {
        filterNationality = e.target.value;
        renderPickerList();
      });
    };

    renderPickerList();

    const { close } = showModal({
      title: 'Add Ship',
      body,
    });
  };

  render();
}
