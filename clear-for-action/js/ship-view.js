// ============================================
// Clear for Action! — Ship View (Read-Only)
// ============================================

import { getShip } from './storage.js';
import { escapeHtml, nationalityFlag, getSpeedForSail, crewRatingTag } from './utils.js';
import { GUN_FACINGS } from './data.js';

export function renderShipView(container, shipId) {
  const ship = getShip(shipId);
  if (!ship) {
    container.innerHTML = '<p>Ship not found. <a href="#/ships">Back to ships</a></p>';
    return;
  }

  const flag = nationalityFlag(ship.nationality);
  // --- Header (card-style) ---
  const imageHtml = ship.shipImage?.data
    ? `<img src="${ship.shipImage.data}" alt="${escapeHtml(ship.name)}">`
    : `<span class="placeholder-icon">\u{1F6A2}</span>`;
  const crewTag = crewRatingTag(ship.captain?.crewRating);

  let headerHtml = `<div class="ship-view-card">
    <div class="ship-view-card-header">
      <div class="ship-view-card-image">${imageHtml}</div>
      <div class="ship-view-card-info">
        <div class="ship-view-name">${escapeHtml(ship.name || 'Untitled')}</div>
        <div class="ship-view-card-subtitle">${escapeHtml(ship.classAndRating || 'Unknown class')}${ship.yearLaunched ? ` (${escapeHtml(ship.yearLaunched)})` : ''}</div>
        ${ship.tonnage ? `<div class="ship-view-card-meta">${escapeHtml(ship.tonnage)} tons${ship.complement ? ` \u00b7 ${escapeHtml(ship.complement)} complement` : ''}</div>` : ''}
      </div>
      ${flag ? `<div class="ship-view-card-flag">${flag}</div>` : ''}
    </div>
    ${ship.description ? `<div class="ship-view-card-desc">${escapeHtml(ship.description)}</div>` : ''}
  </div>`;

  // --- Captain, Crew & Skills ---
  const skills = ship.skills || {};
  const captainHtml = `<div class="form-section">
    <div class="form-section-title">Captain & Crew</div>
    ${(ship.captain?.name || ship.captain?.rank || ship.captain?.crewRating) ? `
    <div class="ship-view-captain">
      ${ship.captain.image?.data ? `<div class="ship-view-captain-img"><img src="${ship.captain.image.data}" alt="${escapeHtml(ship.captain.name || 'Captain')}"></div>` : ''}
      <div>
        ${ship.captain.name ? `<div class="ship-view-stat-value">${ship.captain.rank ? escapeHtml(ship.captain.rank) + ' ' : ''}${escapeHtml(ship.captain.name)}</div>` : ''}
        ${crewTag ? `<div style="margin-top:4px">${crewTag}</div>` : ''}
      </div>
    </div>` : ''}
    <div class="ship-view-skills-bar">
      <div class="ship-view-skills-cell"><span class="ship-view-skills-label">Command</span><span class="ship-view-skills-value">${skills.command ?? 0}</span></div>
      <div class="ship-view-skills-cell"><span class="ship-view-skills-label">Seamanship</span><span class="ship-view-skills-value">${skills.seamanship ?? 0}</span></div>
      <div class="ship-view-skills-cell"><span class="ship-view-skills-label">Gunnery</span><span class="ship-view-skills-value">${skills.gunnery ?? 0}</span></div>
      <div class="ship-view-skills-cell"><span class="ship-view-skills-label">Close Action</span><span class="ship-view-skills-value">${skills.closeAction ?? 0}</span></div>
    </div>
  </div>`;

  // --- Vitals & Criticals (side by side) ---
  const vitals = ship.vitals || {};
  const defense = ship.movement?.defense ?? 0;
  const criticals = ship.criticals || {};
  const vitalsCriticalsHtml = `<div class="ship-view-two-col">
    <div class="form-section">
      <div class="form-section-title">Vitals</div>
      <div class="ship-view-stat"><span class="ship-view-stat-label">Defense</span><span class="ship-view-stat-value">${defense}</span></div>
      <div class="ship-view-stat"><span class="ship-view-stat-label">Morale</span><span class="ship-view-stat-value">${vitals.morale ?? 0}</span></div>
      <div class="ship-view-stat"><span class="ship-view-stat-label">Crew</span><span class="ship-view-stat-value">${vitals.crew ?? 0}</span></div>
      <div class="ship-view-stat"><span class="ship-view-stat-label">Rigging</span><span class="ship-view-stat-value">${vitals.rigging ?? 0}</span></div>
      <div class="ship-view-stat"><span class="ship-view-stat-label">Hull</span><span class="ship-view-stat-value">${vitals.hull ?? 0}</span></div>
    </div>
    <div class="form-section">
      <div class="form-section-title">Criticals</div>
      <div class="ship-view-stat"><span class="ship-view-stat-label">Fire</span><span class="ship-view-stat-value">${criticals.fire ?? 0}</span></div>
      <div class="ship-view-stat"><span class="ship-view-stat-label">Leak</span><span class="ship-view-stat-value">${criticals.leak ?? 0}</span></div>
      <div class="ship-view-stat"><span class="ship-view-stat-label">Steering</span><span class="ship-view-stat-value">${criticals.steering ?? 0}</span></div>
      <div class="ship-view-stat"><span class="ship-view-stat-label">Mast</span><span class="ship-view-stat-value">${criticals.mast ?? 0}</span></div>
      <div class="ship-view-stat"><span class="ship-view-stat-label">Officer</span><span class="ship-view-stat-value">${criticals.officer ?? 0}</span></div>
    </div>
  </div>`;

  // --- Movement / Speed Table ---
  const full = getSpeedForSail(ship.speed, 'full');
  const battle = getSpeedForSail(ship.speed, 'battle');
  const reefed = getSpeedForSail(ship.speed, 'reefed');
  const maneuver = ship.movement?.maneuver ?? 0;

  const movementHtml = `<div class="form-section">
    <div class="form-section-title">Movement</div>
    <table class="ship-view-speed-table">
      <thead>
        <tr><th></th><th>Close Hauled</th><th>Reaching</th><th>Running</th></tr>
      </thead>
      <tbody>
        <tr><td>Full</td><td>${full.closeHauled}</td><td>${full.reaching}</td><td>${full.running}</td></tr>
        <tr><td>Battle</td><td>${battle.closeHauled}</td><td>${battle.reaching}</td><td>${battle.running}</td></tr>
        <tr><td>Reefed</td><td>${reefed.closeHauled}</td><td>${reefed.reaching}</td><td>${reefed.running}</td></tr>
      </tbody>
    </table>
    <div class="ship-view-stat" style="margin-top:var(--space-lg)">
      <span class="ship-view-stat-label">Maneuver</span>
      <span class="ship-view-stat-value">${maneuver}</span>
    </div>
  </div>`;

  // --- Guns ---
  let gunsHtml = '';
  if (ship.guns?.length || ship.broadsideWeight) {
    const facingName = (id) => GUN_FACINGS.find(f => f.id === id)?.name || id;
    const gunLabel = (g) => g.isCarronade ? g.type.replace(' carr.', '') + ' carronade' : g.type + ' long gun';

    gunsHtml = `<div class="form-section">
      <div class="form-section-title">Guns</div>
      ${ship.broadsideWeight ? `<div class="ship-view-stat" style="margin-bottom:var(--space-sm);font-weight:700;color:var(--navy)">Broadside Weight: ${ship.broadsideWeight} lbs</div>` : ''}
      ${ship.guns?.length ? `<div class="ship-view-guns-list">
        ${ship.guns.map(g => `
          <div class="ship-view-gun-row">
            <span class="ship-view-gun-count">${g.count}x</span>
            <span class="ship-view-gun-type">${escapeHtml(gunLabel(g))}</span>
            <span class="ship-view-gun-facing text-muted">${escapeHtml(facingName(g.facing))}</span>
          </div>
        `).join('')}
      </div>` : ''}
    </div>`;
  }

  // --- Abilities ---
  let abilitiesHtml = '';
  if (ship.abilities?.length) {
    abilitiesHtml = `<div class="form-section">
      <div class="form-section-title">Abilities</div>
      <div class="ship-view-abilities">
        ${ship.abilities.map(a => `
          <div class="ship-view-ability">
            <strong>${escapeHtml(typeof a === 'string' ? a : a.name)}</strong>
            ${(typeof a !== 'string' && a.effect) ? `<div class="text-small text-muted">${escapeHtml(a.effect)}</div>` : ''}
          </div>
        `).join('')}
      </div>
    </div>`;
  }

  container.innerHTML = headerHtml + captainHtml + vitalsCriticalsHtml + movementHtml + gunsHtml + abilitiesHtml;
}
