// ============================================
// Clear for Action! — Game Tracker View
// ============================================

import { getGame, autoSave } from './storage.js';
import { SAIL_SETTINGS, ABILITIES } from './data.js';
import {
  createHealthBar, createInteractiveHealthBar, createCheckboxRow,
  createCriticalRow, createSegmentedControl, createToggle, vitalColor,
} from './components.js';
import { escapeHtml, nationalityFlag, sailIcon, clamp, getSpeedForSail, getGameShips, crewRatingTag, calculatePoints } from './utils.js';

// --- Condition Detection (Universal Modifiers) ---
function getActiveConditions(ship) {
  const conditions = [];
  const cv = ship.currentVitals || {};
  const v = ship.vitals || {};
  const cc = ship.currentCriticals || {};
  const cr = ship.criticals || {};

  // Crew & Officers — mutually exclusive tiers
  if (cc.officer > 0 && cr.officer > 0 && cc.officer >= cr.officer) {
    conditions.push({ name: 'Command Lost', mod: -4 });
  } else if (cc.officer > 0) {
    conditions.push({ name: 'Officer Down', mod: -1 });
  }

  if (cv.crew === 0 && v.crew > 0) {
    conditions.push({ name: 'Skeleton Crew', mod: -5 });
  } else if (v.crew > 0 && cv.crew <= Math.floor(v.crew / 2)) {
    conditions.push({ name: 'Shorthanded', mod: -2 });
  }

  if (cv.morale === 0 && v.morale > 0) {
    conditions.push({ name: 'Demoralized', mod: -4 });
  } else if (v.morale > 0 && cv.morale <= Math.floor(v.morale / 2)) {
    conditions.push({ name: 'Unsteady', mod: -2 });
  }

  // Ship Damage
  if (cc.fire > 0) conditions.push({ name: 'Fire Aboard', mod: -3 });
  if (cc.leak > 0) conditions.push({ name: 'Taking Water', mod: -1 });
  if (cc.mast > 0) conditions.push({ name: 'Dismasted', mod: -2 });

  // Rigging/Hull — crippled (0) vs battered (half)
  const riggingCrippled = v.rigging > 0 && cv.rigging === 0;
  const hullCrippled = v.hull > 0 && cv.hull === 0;
  const riggingBattered = v.rigging > 0 && cv.rigging <= Math.floor(v.rigging / 2) && cv.rigging > 0;
  const hullBattered = v.hull > 0 && cv.hull <= Math.floor(v.hull / 2) && cv.hull > 0;

  if (riggingCrippled || hullCrippled) conditions.push({ name: 'Crippled', mod: -2 });
  if (riggingBattered || hullBattered) conditions.push({ name: 'Battered', mod: -1 });

  // Steering
  if (cc.steering > 0 && cr.steering > 0 && cc.steering >= cr.steering) {
    conditions.push({ name: 'Steering Lost', mod: -4 });
  } else if (cc.steering > 0) {
    conditions.push({ name: 'Impaired Steering', mod: -2 });
  }

  return conditions;
}

export function renderGameView(container, gameId) {
  let game = getGame(gameId);
  if (!game) {
    container.innerHTML = '<p>Game not found. <a href="#/games">Back to games</a></p>';
    return;
  }

  const allShips = getGameShips(game);
  if (allShips.length === 0) {
    container.innerHTML += `
      <div class="empty-state">
        <div class="empty-state-icon"><img src="ship-silhouette.png" alt="" style="height:80px;width:auto;opacity:0.6" loading="lazy"></div>
        <div class="empty-state-title">No ships in this game</div>
        <div class="empty-state-text"><a href="#/games/${gameId}/edit">Add ships</a> to start tracking.</div>
      </div>
    `;
    return;
  }

  let flatIdx = 0;
  (game.forces || []).forEach(force => {
    if (!force.ships?.length) return;
    const forcePoints = force.ships.reduce((sum, s) => sum + calculatePoints(s), 0);
    const forceHeader = document.createElement('div');
    forceHeader.className = 'force-header';
    forceHeader.innerHTML = `${nationalityFlag(force.nationality)} <span>${escapeHtml(force.name || force.nationality)}</span><span class="points-badge force-header-points">${forcePoints} pts</span>`;
    container.appendChild(forceHeader);

    force.ships.forEach(ship => {
      const card = buildShipCard(ship, flatIdx, gameId);
      container.appendChild(card);
      flatIdx++;
    });
  });
}

let slideDirection = null; // 'left' or 'right'

export function setSlideDirection(dir) { slideDirection = dir; }

export function renderShipActionView(container, gameId, shipIndex) {
  let game = getGame(gameId);
  if (!game) {
    container.innerHTML = '<p>Game not found. <a href="#/games">Back to games</a></p>';
    return;
  }

  const allShips = getGameShips(game);
  const idx = parseInt(shipIndex);

  if (idx < 0 || idx >= allShips.length) {
    container.innerHTML = `<p>Ship not found. <a href="#/games/${gameId}">Back to battle</a></p>`;
    return;
  }

  const ship = allShips[idx];

  // --- Ship detail (no card wrapper — sits directly on background) ---
  const wrapper = document.createElement('div');
  wrapper.className = `ship-action-detail ${ship.status?.struck ? 'struck' : ''}`;

  const summary = document.createElement('div');
  summary.className = 'ship-action-header';
  const imageHtml = ship.shipImage?.data
    ? `<img src="${ship.shipImage.data}" alt="${escapeHtml(ship.name)}" loading="lazy">`
    : `<img src="ship-silhouette.png" alt="Ship" class="placeholder-silhouette" loading="lazy">`;
  const flagHtml = nationalityFlag(ship.nationality, ship.shipType);
  const crewTag = crewRatingTag(ship.captain?.crewRating);
  const captainName = ship.captain?.name ? `${ship.captain.rank ? escapeHtml(ship.captain.rank) + ' ' : ''}${escapeHtml(ship.captain.name)}` : '';
  summary.innerHTML = `
    <div class="ship-action-header-thumb">${imageHtml}</div>
    <div class="ship-card-info">
      <div class="ship-card-class">${escapeHtml(ship.classAndRating || '')}</div>
      ${captainName ? `<div class="ship-action-header-captain">${captainName}</div>` : ''}
    </div>
    ${flagHtml || crewTag ? `<div class="ship-action-header-badge">
      ${flagHtml ? `<div class="ship-action-header-flag">${flagHtml}</div>` : ''}
      ${crewTag ? `<div>${crewTag}</div>` : ''}
    </div>` : ''}
  `;

  // --- Skills bar ---
  const skillsBar = document.createElement('div');
  skillsBar.className = 'ship-action-skills-bar';

  // --- Conditions bar ---
  const conditionsBar = document.createElement('div');
  conditionsBar.className = 'conditions-bar';

  const skillsDef = [
    { key: 'command', label: 'Command', icon: 'captain-silhouette.png' },
    { key: 'seamanship', label: 'Seamanship', icon: 'anchor-white.png' },
    { key: 'gunnery', label: 'Gunnery', icon: 'cannon.png' },
    { key: 'closeAction', label: 'Close Action', icon: 'crossed-sabers.png' },
  ];

  const refreshConditions = () => {
    const conditions = getActiveConditions(ship);
    const totalMod = conditions.reduce((sum, c) => sum + c.mod, 0);

    skillsBar.innerHTML = '';
    skillsDef.forEach(({ key, label, icon }) => {
      const base = ship.skills?.[key] ?? 0;
      const effective = base + totalMod;
      const modified = totalMod !== 0;
      skillsBar.innerHTML += `<div class="ship-action-skills-cell">
        <span class="ship-action-skills-label">${label}</span>
        <img src="${icon}" alt="${label}" title="${label}" class="ship-action-skills-icon">
        <span class="ship-action-skills-value ${modified ? 'modified' : ''}">${effective}</span>
      </div>`;
    });

    conditionsBar.innerHTML = '';
    if (conditions.length > 0) {
      conditionsBar.classList.remove('hidden');
      conditions.forEach(c => {
        conditionsBar.innerHTML += `<span class="condition-tag"><span class="condition-name">${escapeHtml(c.name)}</span><span class="condition-mod">${c.mod}</span></span>`;
      });
    } else {
      conditionsBar.classList.add('hidden');
    }
  };
  refreshConditions();

  const save = () => { autoSave(game); refreshConditions(); };

  const body = document.createElement('div');
  body.className = 'ship-action-body';
  buildCardBody(body, ship, game, save);

  wrapper.append(summary, skillsBar, conditionsBar, body);

  // Apply slide animation if navigating between ships
  if (slideDirection) {
    wrapper.classList.add(slideDirection === 'left' ? 'slide-in-left' : 'slide-in-right');
    slideDirection = null;
  }

  container.appendChild(wrapper);

  // --- Swipe support ---
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let swiping = false;

  const onTouchStart = (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
    swiping = true;
  };

  const onTouchMove = (e) => {
    if (!swiping) return;
    // Cancel swipe if vertical movement dominates (user is scrolling)
    const deltaY = Math.abs(e.touches[0].clientY - touchStartY);
    const deltaX = Math.abs(e.touches[0].clientX - touchStartX);
    if (deltaY > 30 && deltaY > deltaX) {
      swiping = false;
    }
  };

  const onTouchEnd = (e) => {
    if (!swiping) return;
    swiping = false;
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    const deltaY = e.changedTouches[0].clientY - touchStartY;
    const elapsed = Date.now() - touchStartTime;
    // Require: >50px horizontal, mostly horizontal, within 500ms
    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) && elapsed < 500) {
      if (deltaX > 0 && idx > 0) {
        slideDirection = 'right';
        location.hash = `#/games/${gameId}/ship/${idx - 1}`;
      } else if (deltaX < 0 && idx < allShips.length - 1) {
        slideDirection = 'left';
        location.hash = `#/games/${gameId}/ship/${idx + 1}`;
      }
    }
  };

  wrapper.addEventListener('touchstart', onTouchStart, { passive: true });
  wrapper.addEventListener('touchmove', onTouchMove, { passive: true });
  wrapper.addEventListener('touchend', onTouchEnd, { passive: true });
}

function getOverallHealth(ship) {
  const v = ship.vitals || {};
  const cv = ship.currentVitals || {};
  // Weighted aggregate: crew and hull matter most, morale and rigging secondary
  const weights = { morale: 0.2, crew: 0.3, rigging: 0.2, hull: 0.3 };
  let totalWeight = 0;
  let weightedSum = 0;
  for (const key of ['morale', 'crew', 'rigging', 'hull']) {
    const max = v[key] || 0;
    if (max > 0) {
      weightedSum += (cv[key] / max) * weights[key];
      totalWeight += weights[key];
    }
  }
  return totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 100;
}

function buildShipCard(ship, flatIdx, gameId) {
  const card = document.createElement('div');
  card.className = `card ship-card ${ship.status?.struck ? 'struck' : ''} ${ship.status?.sunk ? 'sunk' : ''}`;

  const summary = document.createElement('div');
  summary.className = 'ship-card-summary';

  const imageHtml = ship.shipImage?.data
    ? `<img src="${ship.shipImage.data}" alt="${escapeHtml(ship.name)}" loading="lazy">`
    : `<img src="ship-silhouette.png" alt="Ship" class="placeholder-silhouette" loading="lazy">`;

  const crewTag = crewRatingTag(ship.captain?.crewRating);
  const pts = calculatePoints(ship);
  const conditions = getActiveConditions(ship);
  const healthPct = getOverallHealth(ship);
  const healthBg = vitalColor(healthPct);

  const conditionsHtml = conditions.length > 0
    ? `<div class="ship-card-conditions">${conditions.map(c =>
        `<span class="condition-tag-mini">${escapeHtml(c.name)}</span>`
      ).join('')}</div>`
    : '';

  summary.innerHTML = `
    <div class="ship-card-thumb">${imageHtml}</div>
    <div class="ship-card-info">
      <div class="ship-card-name-row">
        <span class="ship-card-name">${escapeHtml(ship.displayName || ship.name || 'Ship')}</span>
        ${crewTag ? `<span class="ship-card-crew-tag">${crewTag}</span>` : ''}
      </div>
      <div class="ship-card-class">${escapeHtml(ship.classAndRating || '')}</div>
      <div class="ship-card-health">
        <div class="health-bar health-bar-mini">
          <div class="health-bar-fill" style="width:${healthPct}%; background:${healthBg}"></div>
        </div>
        <span class="ship-card-health-pct">${Math.round(healthPct)}%</span>
      </div>
      ${conditionsHtml}
    </div>
    <div class="ship-card-right">
      <span class="points-badge">${pts} pts</span>
      <span class="ship-card-chevron">\u203A</span>
    </div>
  `;

  summary.addEventListener('click', () => {
    location.hash = `#/games/${gameId}/ship/${flatIdx}`;
  });

  card.appendChild(summary);
  return card;
}

function rangeVal(v) {
  return v ? `<span class="gun-stat-val">${v}</span>` : `<span class="gun-stat-val gun-stat-na">\u2014</span>`;
}

function buildCardBody(body, ship, game, save) {
  body.innerHTML = '';

  // --- Guns Section ---
  if (ship.guns?.length) {
    const gunsSection = document.createElement('div');
    gunsSection.className = 'ship-card-section';

    // Migrate gun state: ensure broadside guns have port/starboard counts
    migrateGunState(ship);

    // Group guns by facing
    const facingGroups = [
      { id: 'broadside', title: 'Broadside', halve: true },
      { id: 'bow', title: 'Bow Chasers', halve: false },
      { id: 'stern', title: 'Stern Chasers', halve: false },
    ];

    facingGroups.forEach(facing => {
      const guns = ship.guns.filter(g => facing.id === 'broadside'
        ? (g.facing === 'broadside' || !g.facing)
        : g.facing === facing.id);
      if (!guns.length) return;

      // Effective weight for this group
      const weight = Math.round(guns.reduce((sum, g) => {
        const pdr = parseInt(g.type) || 0;
        return sum + (facing.halve ? Math.floor(g.count / 2) : g.count) * pdr;
      }, 0));

      // Section header
      const header = document.createElement('div');
      header.className = 'gun-group-header';
      header.innerHTML = `<span>${facing.title}</span>${weight ? `<span class="gun-group-weight">${weight} lbs</span>` : ''}`;

      // First broadside toggle in the broadside header
      if (facing.id === 'broadside') {
        const fbAvail = ship.status?.firstBroadside?.port !== false || ship.status?.firstBroadside?.starboard !== false;
        const fbToggle = document.createElement('div');
        fbToggle.className = `gun-group-header-fb toggle-mini ${fbAvail ? 'active' : ''}`;
        fbToggle.innerHTML = `
          <span class="toggle-mini-label">Initial</span>
          <div class="toggle-mini-track"><div class="toggle-mini-thumb"></div></div>
        `;
        fbToggle.addEventListener('click', () => {
          if (!ship.status.firstBroadside) ship.status.firstBroadside = { port: true, starboard: true };
          const wasAvail = ship.status.firstBroadside.port !== false || ship.status.firstBroadside.starboard !== false;
          const newVal = !wasAvail;
          ship.status.firstBroadside.port = newVal;
          ship.status.firstBroadside.starboard = newVal;
          fbToggle.classList.toggle('active', newVal);
          save();
        });
        header.appendChild(fbToggle);
      }

      gunsSection.appendChild(header);

      if (facing.id === 'broadside') {
        // Column labels
        const colLabels = document.createElement('div');
        colLabels.className = 'gun-row-col-labels';
        colLabels.innerHTML = `<span class="gun-col-label">Port</span><span></span><span class="gun-col-label">Starboard</span>`;
        gunsSection.appendChild(colLabels);

        // Broadside gun rows
        guns.forEach(gun => {
          const gunState = ship.currentGuns?.find(g => g.gunId === gun.id);
          const portCount = gunState ? gunState.remainingPort : Math.floor(gun.count / 2);
          const stbdCount = gunState ? gunState.remainingStarboard : gun.count - Math.floor(gun.count / 2);
          const halfMax = Math.floor(gun.count / 2);
          const halfMaxStbd = gun.count - halfMax;

          const row = document.createElement('div');
          row.className = 'gun-row-broadside';

          row.innerHTML = `
            <div class="gun-type">${escapeHtml(gun.isCarronade ? gun.type.replace(' carr.', '') + ' carronade' : gun.type)}</div>
            <div class="gun-row-controls">
              <div class="gun-side gun-side-port">
                <button class="gun-side-btn" data-side="port" data-dir="-1">\u2212</button>
                <span class="gun-side-count" data-side="port">${portCount}</span>
                <button class="gun-side-btn" data-side="port" data-dir="1">+</button>
              </div>
              <div class="gun-stats">
                <div class="gun-stat-cell"><span class="gun-stat-label">Dmg</span><span class="gun-stat-val">${gun.damage}</span></div>
                <div class="gun-stat-cell"><span class="gun-stat-label range-short">S</span>${rangeVal(gun.rangeShort)}</div>
                <div class="gun-stat-cell"><span class="gun-stat-label range-medium">M</span>${rangeVal(gun.rangeMedium)}</div>
                <div class="gun-stat-cell"><span class="gun-stat-label range-long">L</span>${rangeVal(gun.rangeLong)}</div>
              </div>
              <div class="gun-side gun-side-stbd">
                <button class="gun-side-btn" data-side="starboard" data-dir="-1">\u2212</button>
                <span class="gun-side-count" data-side="starboard">${stbdCount}</span>
                <button class="gun-side-btn" data-side="starboard" data-dir="1">+</button>
              </div>
            </div>
          `;

          const updateBroadsideBtnState = () => {
            row.querySelectorAll('.gun-side-btn').forEach(b => {
              const s = b.dataset.side;
              const d = parseInt(b.dataset.dir);
              const cur = gunState ? gunState[s === 'port' ? 'remainingPort' : 'remainingStarboard'] : 0;
              const mx = s === 'port' ? halfMax : halfMaxStbd;
              b.disabled = (d === -1 && cur <= 0) || (d === 1 && cur >= mx);
            });
          };
          updateBroadsideBtnState();

          row.querySelectorAll('.gun-side-btn').forEach(btn => {
            btn.addEventListener('click', () => {
              if (!gunState) return;
              const side = btn.dataset.side;
              const dir = parseInt(btn.dataset.dir);
              const max = side === 'port' ? halfMax : halfMaxStbd;
              const key = side === 'port' ? 'remainingPort' : 'remainingStarboard';
              gunState[key] = clamp(gunState[key] + dir, 0, max);
              row.querySelector(`.gun-side-count[data-side="${side}"]`).textContent = gunState[key];
              updateBroadsideBtnState();
              save();
            });
          });

          gunsSection.appendChild(row);
        });

      } else {
        // Chaser gun rows (bow/stern)
        guns.forEach(gun => {
          const gunState = ship.currentGuns?.find(g => g.gunId === gun.id);
          const remaining = gunState ? gunState.remainingCount : gun.count;

          const row = document.createElement('div');
          row.className = 'gun-row-chaser';

          row.innerHTML = `
            <div class="gun-type">${escapeHtml(gun.isCarronade ? gun.type.replace(' carr.', '') + ' carronade' : gun.type)}</div>
            <div class="gun-row-controls">
              <div class="gun-chaser-count">
                <button class="gun-side-btn" data-dir="-1">\u2212</button>
                <span class="gun-count">${remaining}</span>
                <button class="gun-side-btn" data-dir="1">+</button>
              </div>
              <div class="gun-stats">
                <div class="gun-stat-cell"><span class="gun-stat-label">Dmg</span><span class="gun-stat-val">${gun.damage}</span></div>
                <div class="gun-stat-cell"><span class="gun-stat-label range-short">S</span>${rangeVal(gun.rangeShort)}</div>
                <div class="gun-stat-cell"><span class="gun-stat-label range-medium">M</span>${rangeVal(gun.rangeMedium)}</div>
                <div class="gun-stat-cell"><span class="gun-stat-label range-long">L</span>${rangeVal(gun.rangeLong)}</div>
              </div>
            </div>
          `;

          const updateChaserBtnState = () => {
            row.querySelectorAll('.gun-side-btn').forEach(b => {
              const d = parseInt(b.dataset.dir);
              const cur = gunState ? gunState.remainingCount : 0;
              b.disabled = (d === -1 && cur <= 0) || (d === 1 && cur >= gun.count);
            });
          };
          updateChaserBtnState();

          row.querySelectorAll('.gun-side-btn').forEach(btn => {
            btn.addEventListener('click', () => {
              if (!gunState) return;
              const dir = parseInt(btn.dataset.dir);
              gunState.remainingCount = clamp(gunState.remainingCount + dir, 0, gun.count);
              row.querySelector('.gun-count').textContent = gunState.remainingCount;
              updateChaserBtnState();
              save();
            });
          });

          gunsSection.appendChild(row);
        });
      }
    });

    body.appendChild(gunsSection);
  }

  // --- Sail Setting ---
  const sailSection = makeSection('Sails');
  const speedRef = document.createElement('div');
  speedRef.className = 'sail-speed-ref';

  const renderSpeedRef = () => {
    const currentSail = ship.sailSetting || 'battle';
    if (ship.speed) {
      const s = getSpeedForSail(ship.speed, currentSail);
      speedRef.innerHTML = `
        <div class="sail-speed-cell"><span class="sail-speed-label">Close Hauled</span><span class="sail-speed-val">${s.closeHauled}</span></div>
        <div class="sail-speed-cell"><span class="sail-speed-label">Reaching</span><span class="sail-speed-val">${s.reaching}</span></div>
        <div class="sail-speed-cell"><span class="sail-speed-label">Running</span><span class="sail-speed-val">${s.running}</span></div>
      `;
    }
  };

  sailSection.appendChild(createSegmentedControl({
    options: SAIL_SETTINGS,
    value: ship.sailSetting || 'battle',
    onChange: (v) => {
      ship.sailSetting = v;
      renderSpeedRef();
      save();
    },
  }));
  renderSpeedRef();
  sailSection.appendChild(speedRef);
  body.appendChild(sailSection);

  // --- Maneuver Section ---
  if (ship.movement?.maneuver) {
    const maneuverSection = makeSection('Maneuvers');
    const total = ship.movement.maneuver;
    const helmRow = document.createElement('div');
    helmRow.className = 'maneuver-helms';

    if (!ship.status) ship.status = {};
    if (!ship.status.maneuversUsedSet) ship.status.maneuversUsedSet = {};

    for (let i = 0; i < total; i++) {
      const helm = document.createElement('img');
      helm.src = 'helm.png';
      helm.alt = 'Maneuver';
      helm.className = 'maneuver-helm';
      if (ship.status.maneuversUsedSet[String(i)]) helm.classList.add('used');

      helm.addEventListener('click', () => {
        if (!ship.status.maneuversUsedSet) ship.status.maneuversUsedSet = {};
        const key = String(i);
        if (ship.status.maneuversUsedSet[key]) {
          delete ship.status.maneuversUsedSet[key];
          helm.classList.remove('used');
        } else {
          ship.status.maneuversUsedSet[key] = true;
          helm.classList.add('used');
        }
        save();
      });

      helmRow.appendChild(helm);
    }

    maneuverSection.appendChild(helmRow);
    body.appendChild(maneuverSection);
  }

  // --- Status Section (Defense + Vitals + Criticals + Toggles) ---
  const statusSection = makeSection('Status');

  // Defense
  if (ship.movement?.defense) {
    const defRef = document.createElement('div');
    defRef.className = 'status-defense';
    defRef.innerHTML = `
      <div class="defense-shield">
        <img src="shield.png" alt="Defense" class="defense-shield-img">
        <span class="defense-shield-val">${ship.movement.defense}</span>
      </div>
    `;
    statusSection.appendChild(defRef);
  }

  // Vitals
  const vitalsRow = document.createElement('div');
  vitalsRow.className = 'vitals-boxes';
  ['morale', 'crew', 'rigging', 'hull'].forEach(key => {
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    const max = ship.vitals[key];
    let current = ship.currentVitals[key];
    const box = document.createElement('div');
    box.className = 'vital-box-wrapper';

    const renderBox = () => {
      const pct = max > 0 ? (current / max) * 100 : 0;
      const bg = vitalColor(pct);
      box.innerHTML = `
        <div class="vital-box-label">${escapeHtml(label)}</div>
        <div class="vital-box-row">
          <button class="vital-box-btn" data-dir="-1" ${current <= 0 ? 'disabled' : ''}>\u2212</button>
          <div class="vital-box" style="background:${bg}">${current}</div>
          <button class="vital-box-btn" data-dir="1" ${current >= max ? 'disabled' : ''}>+</button>
        </div>
      `;
      box.querySelectorAll('.vital-box-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const dir = parseInt(btn.dataset.dir);
          current = Math.max(0, Math.min(max, current + dir));
          ship.currentVitals[key] = current;
          save();
          renderBox();
          const vb = box.querySelector('.vital-box');
          vb.classList.remove('pulse');
          void vb.offsetWidth;
          vb.classList.add('pulse');
        });
      });
    };
    renderBox();
    vitalsRow.appendChild(box);
  });
  statusSection.appendChild(vitalsRow);

  // Criticals
  const criticalKeys = ['fire', 'leak', 'steering', 'mast', 'officer'];
  const hasCriticals = criticalKeys.some(k => (ship.criticals?.[k] || 0) > 0);
  if (hasCriticals) {
    const critTracker = document.createElement('div');
    critTracker.className = 'critical-tracker';
    criticalKeys.forEach(key => {
      const total = ship.criticals?.[key] || 0;
      if (total === 0) return;
      const label = key.charAt(0).toUpperCase() + key.slice(1);
      const checked = ship.currentCriticals?.[key] || 0;
      critTracker.appendChild(createCriticalRow({
        key,
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
    statusSection.appendChild(critTracker);
  }
  const toggles = document.createElement('div');
  toggles.className = 'status-toggles';

  ['struck', 'sunk', 'aground'].forEach(key => {
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

  // --- Abilities ---
  if (ship.abilities?.length) {
    const abilitiesSection = makeSection('Abilities');
    const abilityList = document.createElement('div');
    abilityList.className = 'ability-cards';

    const categoryOrder = ['ship', 'captain', 'crew', 'weakness', '_custom'];
    const categoryLabels = { ship: 'Ship', captain: 'Captain', crew: 'Crew', weakness: 'Weakness', _custom: 'Custom' };
    const grouped = {};
    ship.abilities.forEach(ability => {
      const id = typeof ability === 'object' ? ability.id : ability;
      const ref = ABILITIES.find(r => r.id === id);
      const cat = ref?.category || '_custom';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(ability);
    });

    categoryOrder.forEach(cat => {
      if (!grouped[cat]?.length) return;
      const isWeakness = cat === 'weakness';
      const header = document.createElement('div');
      header.className = `ability-category-header ${isWeakness ? 'ability-category-header--weakness' : ''}`;
      header.textContent = categoryLabels[cat];
      abilityList.appendChild(header);

      grouped[cat].forEach(ability => {
        const card = document.createElement('div');
        card.className = `ability-card ${isWeakness ? 'ability-card--weakness' : ''}`;
        const name = typeof ability === 'object' ? ability.name : ability.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const effect = typeof ability === 'object' ? ability.effect : '';
        card.innerHTML = `<div class="ability-card-name">${escapeHtml(name)}</div>${effect ? `<div class="ability-card-effect">${escapeHtml(effect)}</div>` : ''}`;
        abilityList.appendChild(card);
      });
    });

    abilitiesSection.appendChild(abilityList);
    body.appendChild(abilitiesSection);
  }

}

function migrateGunState(ship) {
  if (!ship.currentGuns) return;
  ship.currentGuns.forEach(gs => {
    const gun = ship.guns?.find(g => g.id === gs.gunId);
    if (!gun) return;
    const isBroadside = gun.facing === 'broadside' || !gun.facing;
    if (isBroadside && gs.remainingPort === undefined) {
      const total = gs.remainingCount ?? gun.count;
      gs.remainingPort = Math.floor(total / 2);
      gs.remainingStarboard = total - gs.remainingPort;
    }
  });
}

function makeSection(title) {
  const section = document.createElement('div');
  section.className = 'ship-card-section';
  section.innerHTML = `<div class="ship-card-section-title">${escapeHtml(title)}</div>`;
  return section;
}
