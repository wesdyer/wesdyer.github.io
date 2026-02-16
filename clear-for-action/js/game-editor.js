// ============================================
// Clear for Action! — Game Editor
// ============================================

import { getGame, getShips, saveGame } from './storage.js';
import { WIND_STRENGTHS } from './data.js';
import { createGameShip } from './data.js';
import { createCompassPicker, showToast } from './components.js';
import { uuid, escapeHtml, nationalityFlag } from './utils.js';

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
      createdAt: new Date().toISOString(),
      lastPlayed: new Date().toISOString(),
      round: 1,
      wind: { direction: 'N', strength: 'moderate' },
      notes: '',
      ships: [],
    };
  }

  // Track which ships from the library are selected
  const allShips = getShips();
  const selectedShipIds = new Set(isNew ? [] : game.ships.map(s => s.sourceShipId));

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
      </div>
      <div class="form-section">
        <div class="form-section-title">Wind</div>
        <div class="form-group">
          <label class="form-label">Direction</label>
          <div id="compass-container"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Strength</label>
          <select class="form-select" id="wind-strength">
            ${WIND_STRENGTHS.map(w =>
              `<option value="${w.id}" ${game.wind.strength === w.id ? 'selected' : ''}>${w.name}</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <div class="form-section">
        <div class="form-section-title">Ships</div>
        <p class="form-hint mb-md">Select ships from your library to add to this game. Each ship becomes an independent copy.</p>
        <div class="ship-selector" id="ship-selector">
          ${allShips.length === 0
            ? '<p class="text-muted">No ships in your library. <a href="#/ships/new">Create one first.</a></p>'
            : allShips.map(s => shipSelectorItem(s, selectedShipIds.has(s.id))).join('')}
        </div>
      </div>
      <div class="form-section">
        <div class="form-section-title">Notes</div>
        <div class="form-group">
          <textarea class="form-textarea" id="game-notes" placeholder="Scenario notes, house rules, etc.">${escapeHtml(game.notes || '')}</textarea>
        </div>
      </div>
    `;

    // Compass picker
    const compassContainer = container.querySelector('#compass-container');
    compassContainer.appendChild(createCompassPicker({
      value: game.wind.direction,
      onChange: (dir) => { game.wind.direction = dir; },
    }));

    // Wind strength
    container.querySelector('#wind-strength').addEventListener('change', (e) => {
      game.wind.strength = e.target.value;
    });

    // Ship selector
    container.querySelectorAll('.ship-selector-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        if (selectedShipIds.has(id)) {
          selectedShipIds.delete(id);
          item.classList.remove('selected');
          item.querySelector('.ship-selector-check').textContent = '';
        } else {
          selectedShipIds.add(id);
          item.classList.add('selected');
          item.querySelector('.ship-selector-check').textContent = '\u2713';
        }
      });
    });

    // Save
    container.querySelector('#save-game').addEventListener('click', () => {
      const name = container.querySelector('#game-name').value.trim();
      if (!name) {
        showToast('Game name is required', 'error');
        return;
      }
      game.name = name;
      game.notes = container.querySelector('#game-notes').value;

      if (isNew) {
        // Create game ships from selected library ships
        game.ships = allShips
          .filter(s => selectedShipIds.has(s.id))
          .map(s => createGameShip(s));
      } else {
        // For editing, add new ships and keep existing ones
        const existingSourceIds = new Set(game.ships.map(s => s.sourceShipId));
        // Add newly selected ships
        allShips.filter(s => selectedShipIds.has(s.id) && !existingSourceIds.has(s.id))
          .forEach(s => game.ships.push(createGameShip(s)));
        // Remove deselected ships
        game.ships = game.ships.filter(s => selectedShipIds.has(s.sourceShipId));
      }

      saveGame(game);
      showToast(isNew ? 'Game created' : 'Game saved', 'success');
      location.hash = isNew ? `#/games/${game.id}` : `#/games/${gameId}`;
    });
  };

  render();
}

function shipSelectorItem(ship, selected) {
  return `
    <div class="ship-selector-item ${selected ? 'selected' : ''}" data-id="${ship.id}">
      <div class="ship-selector-check">${selected ? '\u2713' : ''}</div>
      <span class="ship-name">${nationalityFlag(ship.nationality)} ${escapeHtml(ship.name || 'Untitled')}</span>
      <span class="ship-class">${escapeHtml(ship.classAndRating || '')}</span>
    </div>
  `;
}
