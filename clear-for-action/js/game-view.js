// ============================================
// Clear for Action! — Game Tracker View
// ============================================

import { getGame, autoSave } from './storage.js';
import { SAIL_SETTINGS, WIND_STRENGTHS } from './data.js';
import {
  createHealthBar, createInteractiveHealthBar, createCheckboxRow,
  createSegmentedControl, createToggle, showModal, createCompassPicker,
} from './components.js';
import { escapeHtml, nationalityFlag, sailIcon, windArrow, clamp, getSpeedForSail } from './utils.js';

export function renderGameView(container, gameId) {
  let game = getGame(gameId);
  if (!game) {
    container.innerHTML = '<p>Game not found. <a href="#/games">Back to games</a></p>';
    return;
  }

  const save = () => autoSave(game);

  const render = () => {
    container.innerHTML = '';

    // --- Top Bar ---
    const topbar = document.createElement('div');
    topbar.className = 'game-topbar';
    topbar.innerHTML = `
      <div class="game-topbar-title">${escapeHtml(game.name)}</div>
      <div class="game-topbar-controls">
        <div class="round-counter">
          <button class="stepper-btn" id="round-dec">\u2212</button>
          <span>Rd <strong id="round-val">${game.round}</strong></span>
          <button class="stepper-btn" id="round-inc">+</button>
        </div>
        <div class="wind-indicator" id="wind-btn">
          ${windArrow(game.wind.direction)} ${game.wind.direction} ${game.wind.strength}
        </div>
        <a href="#/games/${gameId}/edit" class="btn btn-ghost btn-sm">Edit</a>
      </div>
    `;
    container.appendChild(topbar);

    // Round counter
    topbar.querySelector('#round-dec').addEventListener('click', () => {
      game.round = Math.max(1, game.round - 1);
      topbar.querySelector('#round-val').textContent = game.round;
      save();
    });
    topbar.querySelector('#round-inc').addEventListener('click', () => {
      game.round++;
      topbar.querySelector('#round-val').textContent = game.round;
      save();
    });

    // Wind picker
    topbar.querySelector('#wind-btn').addEventListener('click', () => {
      openWindPicker(game, save, render);
    });

    // --- Ship Cards ---
    if (!game.ships?.length) {
      container.innerHTML += `
        <div class="empty-state">
          <div class="empty-state-icon">\u{26F5}</div>
          <div class="empty-state-title">No ships in this game</div>
          <div class="empty-state-text"><a href="#/games/${gameId}/edit">Add ships</a> to start tracking.</div>
        </div>
      `;
      return;
    }

    game.ships.forEach((ship, idx) => {
      const card = buildShipCard(ship, idx, game, save);
      container.appendChild(card);
    });
  };

  render();
}

function buildShipCard(ship, idx, game, save) {
  const card = document.createElement('div');
  card.className = `card ship-card ${ship.status?.struck ? 'struck' : ''}`;

  const isCollapsed = ship.collapsed !== false;

  // --- Header (always visible) ---
  const header = document.createElement('div');
  header.className = 'ship-card-header';

  const nameSpan = document.createElement('span');
  nameSpan.className = 'ship-card-name';
  nameSpan.textContent = `${nationalityFlag(ship.nationality)} ${ship.displayName || ship.name || 'Ship'}`;

  const miniBars = document.createElement('div');
  miniBars.className = 'ship-card-mini-bars';
  const vitals = [
    { key: 'morale', max: ship.vitals.morale, cur: ship.currentVitals.morale, color: 'var(--morale-color)' },
    { key: 'crew', max: ship.vitals.crew, cur: ship.currentVitals.crew, color: 'var(--crew-color)' },
    { key: 'rigging', max: ship.vitals.rigging, cur: ship.currentVitals.rigging, color: 'var(--rigging-color)' },
    { key: 'hull', max: ship.vitals.hull, cur: ship.currentVitals.hull, color: 'var(--hull-color)' },
  ];
  miniBars.innerHTML = vitals.map(v => createHealthBar({ label: v.key, current: v.cur, max: v.max, mini: true })).join('');

  const badges = document.createElement('div');
  badges.className = 'ship-card-badges';
  const sailSetting = ship.sailSetting || 'battle';
  badges.innerHTML = `<span class="badge">${sailIcon(sailSetting)} ${SAIL_SETTINGS.find(s => s.id === sailSetting)?.name || ''}</span>`;
  if (ship.status?.grappled) badges.innerHTML += '<span class="badge badge-warning">Grappled</span>';
  if (ship.status?.aground) badges.innerHTML += '<span class="badge badge-danger">Aground</span>';
  if (ship.status?.struck) badges.innerHTML += '<span class="badge badge-danger">Struck</span>';

  const expandIcon = document.createElement('span');
  expandIcon.className = `ship-card-expand ${isCollapsed ? '' : 'open'}`;
  expandIcon.textContent = '\u25BC';

  header.append(nameSpan, miniBars, badges, expandIcon);

  // --- Body ---
  const body = document.createElement('div');
  body.className = `card-body ${isCollapsed ? 'collapsed' : ''}`;

  // Toggle collapse
  header.addEventListener('click', () => {
    ship.collapsed = !ship.collapsed;
    body.classList.toggle('collapsed', ship.collapsed);
    expandIcon.classList.toggle('open', !ship.collapsed);
    save();
    // Re-render body content when expanding
    if (!ship.collapsed) {
      buildCardBody(body, ship, game, save);
    }
  });

  if (!isCollapsed) {
    buildCardBody(body, ship, game, save);
  }

  card.append(header, body);
  return card;
}

function buildCardBody(body, ship, game, save) {
  body.innerHTML = '';

  // --- Vitals Section ---
  const vitalsSection = makeSection('Vitals');
  ['morale', 'crew', 'rigging', 'hull'].forEach(key => {
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    const bar = createInteractiveHealthBar({
      label,
      current: ship.currentVitals[key],
      max: ship.vitals[key],
      vitalKey: key,
      onUpdate: (k, v) => {
        ship.currentVitals[k] = v;
        save();
      },
    });
    vitalsSection.appendChild(bar);
  });
  body.appendChild(vitalsSection);

  // --- Guns Section ---
  if (ship.guns?.length) {
    const gunsSection = makeSection('Guns');

    ship.guns.forEach((gun, gi) => {
      const gunState = ship.currentGuns?.find(g => g.gunId === gun.id);
      const remaining = gunState ? gunState.remainingCount : gun.count;

      const row = document.createElement('div');
      row.className = 'gun-row';

      row.innerHTML = `
        <div class="gun-info">
          <div class="gun-type">${gun.count}x ${escapeHtml(gun.type)} ${gun.facing || 'BS'}</div>
          <div class="gun-detail">Dmg ${gun.damage} | R: ${gun.rangeShort || '-'}/${gun.rangeMedium || '-'}/${gun.rangeLong || '-'}</div>
        </div>
        <button class="health-btn" data-dir="-1" data-gi="${gi}">\u2212</button>
        <span class="gun-count">${remaining}/${gun.count}</span>
        <button class="health-btn" data-dir="1" data-gi="${gi}">+</button>
      `;

      row.querySelectorAll('.health-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const dir = parseInt(btn.dataset.dir);
          if (!gunState) return;
          gunState.remainingCount = clamp(gunState.remainingCount + dir, 0, gun.count);
          row.querySelector('.gun-count').textContent = `${gunState.remainingCount}/${gun.count}`;
          save();
        });
      });

      gunsSection.appendChild(row);
    });

    // First broadside indicators
    const broadsideRow = document.createElement('div');
    broadsideRow.className = 'gun-row';
    broadsideRow.innerHTML = '<div class="gun-info"><div class="gun-type">First Broadside</div></div>';

    ['port', 'starboard'].forEach(side => {
      const avail = ship.status?.firstBroadside?.[side] !== false;
      const dot = document.createElement('div');
      dot.className = 'broadside-indicator';
      dot.innerHTML = `
        <div class="broadside-dot ${avail ? 'available' : ''}" data-side="${side}"></div>
        <span class="text-small">${side.charAt(0).toUpperCase() + side.slice(1)}</span>
      `;
      dot.querySelector('.broadside-dot').addEventListener('click', () => {
        if (!ship.status.firstBroadside) ship.status.firstBroadside = { port: true, starboard: true };
        ship.status.firstBroadside[side] = !ship.status.firstBroadside[side];
        dot.querySelector('.broadside-dot').classList.toggle('available', ship.status.firstBroadside[side]);
        save();
      });
      broadsideRow.appendChild(dot);
    });
    gunsSection.appendChild(broadsideRow);

    // Broadside weight
    if (ship.broadsideWeight) {
      const bw = document.createElement('div');
      bw.className = 'text-small text-muted mt-sm';
      bw.textContent = `Broadside weight: ${ship.broadsideWeight} lbs`;
      gunsSection.appendChild(bw);
    }

    body.appendChild(gunsSection);
  }

  // --- Criticals Section ---
  const critSection = makeSection('Criticals');
  ['fire', 'leak', 'steering', 'mast', 'officer'].forEach(key => {
    const total = ship.criticals?.[key] || 0;
    if (total === 0) return;
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    const checked = ship.currentCriticals?.[key] || 0;
    critSection.appendChild(createCheckboxRow({
      label,
      total,
      checked,
      onChange: (v) => {
        if (!ship.currentCriticals) ship.currentCriticals = { fire: 0, leak: 0, steering: 0, mast: 0, officer: 0 };
        ship.currentCriticals[key] = v;
        save();
      },
    }));
  });
  body.appendChild(critSection);

  // --- Sail Setting ---
  const sailSection = makeSection('Sail Setting');
  sailSection.appendChild(createSegmentedControl({
    options: SAIL_SETTINGS,
    value: ship.sailSetting || 'battle',
    onChange: (v) => {
      ship.sailSetting = v;
      save();
    },
  }));

  // Speed reference table
  if (ship.speed) {
    const speedTable = document.createElement('table');
    speedTable.className = 'speed-table mt-sm';
    const currentSail = ship.sailSetting || 'battle';
    speedTable.innerHTML = `
      <tr>
        <th></th><th>Close Hauled</th><th>Reaching</th><th>Running</th>
      </tr>
      ${['full', 'battle', 'reefed'].map(setting => {
        const s = getSpeedForSail(ship.speed, setting);
        return `
        <tr class="${setting === currentSail ? 'current-sail' : ''}">
          <th>${setting.charAt(0).toUpperCase() + setting.slice(1)}</th>
          <td>${s.closeHauled}</td>
          <td>${s.reaching}</td>
          <td>${s.running}</td>
        </tr>`;
      }).join('')}
    `;
    sailSection.appendChild(speedTable);
  }
  body.appendChild(sailSection);

  // --- Status Toggles ---
  const statusSection = makeSection('Status');
  const toggles = document.createElement('div');
  toggles.className = 'status-toggles';

  ['grappled', 'aground', 'struck'].forEach(key => {
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    toggles.appendChild(createToggle({
      label,
      value: ship.status?.[key] || false,
      onChange: (v) => {
        if (!ship.status) ship.status = { grappled: false, aground: false, struck: false, firstBroadside: { port: true, starboard: true } };
        ship.status[key] = v;
        save();
      },
    }));
  });
  statusSection.appendChild(toggles);
  body.appendChild(statusSection);

  // --- Skills Reference ---
  const skillsSection = makeSection('Skills');
  const skillsRef = document.createElement('div');
  skillsRef.className = 'skills-ref';
  [
    { key: 'command', label: 'Command' },
    { key: 'seamanship', label: 'Seamanship' },
    { key: 'gunnery', label: 'Gunnery' },
    { key: 'closeAction', label: 'Close Action' },
  ].forEach(({ key, label }) => {
    skillsRef.innerHTML += `
      <div class="skill-ref-item">
        <span class="skill-ref-label">${label}</span>
        <span class="skill-ref-value">${ship.skills?.[key] ?? '-'}</span>
      </div>
    `;
  });
  skillsSection.appendChild(skillsRef);

  // Movement reference
  if (ship.movement) {
    const movRef = document.createElement('div');
    movRef.className = 'skills-ref mt-sm';
    movRef.innerHTML = `
      <div class="skill-ref-item">
        <span class="skill-ref-label">Maneuver</span>
        <span class="skill-ref-value">${ship.movement.maneuver ?? '-'}</span>
      </div>
      <div class="skill-ref-item">
        <span class="skill-ref-label">Defense</span>
        <span class="skill-ref-value">${ship.movement.defense ?? '-'}</span>
      </div>
    `;
    skillsSection.appendChild(movRef);
  }
  body.appendChild(skillsSection);

  // --- Abilities ---
  if (ship.abilities?.length) {
    const abilitiesSection = makeSection('Abilities');
    const chipGroup = document.createElement('div');
    chipGroup.className = 'chip-group';
    ship.abilities.forEach(ability => {
      const chip = document.createElement('span');
      chip.className = 'chip selected';
      if (typeof ability === 'object') {
        chip.textContent = ability.name;
        if (ability.effect) chip.title = ability.effect;
      } else {
        chip.textContent = ability.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      }
      chipGroup.appendChild(chip);
    });
    abilitiesSection.appendChild(chipGroup);
    body.appendChild(abilitiesSection);
  }

  // --- Notes ---
  const notesSection = makeSection('Notes');
  const notesArea = document.createElement('textarea');
  notesArea.className = 'ship-notes';
  notesArea.placeholder = 'Battle notes...';
  notesArea.value = ship.notes || '';
  notesArea.addEventListener('input', () => {
    ship.notes = notesArea.value;
    save();
  });
  notesSection.appendChild(notesArea);
  body.appendChild(notesSection);
}

function makeSection(title) {
  const section = document.createElement('div');
  section.className = 'ship-card-section';
  section.innerHTML = `<div class="ship-card-section-title">${escapeHtml(title)}</div>`;
  return section;
}

function openWindPicker(game, save, renderParent) {
  const body = document.createElement('div');

  // Direction
  const dirLabel = document.createElement('div');
  dirLabel.className = 'form-label';
  dirLabel.textContent = 'Direction';
  body.appendChild(dirLabel);

  body.appendChild(createCompassPicker({
    value: game.wind.direction,
    onChange: (dir) => { game.wind.direction = dir; },
  }));

  // Strength
  const strLabel = document.createElement('div');
  strLabel.className = 'form-label mt-md';
  strLabel.textContent = 'Strength';
  body.appendChild(strLabel);

  const strSelect = document.createElement('select');
  strSelect.className = 'form-select';
  strSelect.innerHTML = WIND_STRENGTHS.map(w =>
    `<option value="${w.id}" ${game.wind.strength === w.id ? 'selected' : ''}>${w.name}</option>`
  ).join('');
  strSelect.addEventListener('change', () => { game.wind.strength = strSelect.value; });
  body.appendChild(strSelect);

  const footer = document.createElement('div');
  footer.style.display = 'flex';
  footer.style.justifyContent = 'flex-end';
  footer.style.width = '100%';

  const doneBtn = document.createElement('button');
  doneBtn.className = 'btn btn-primary';
  doneBtn.textContent = 'Done';
  footer.appendChild(doneBtn);

  const { close } = showModal({ title: 'Wind', body, footer });
  doneBtn.addEventListener('click', () => {
    close();
    save();
    renderParent();
  });
}
