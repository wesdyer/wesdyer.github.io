// ============================================
// Clear for Action! — Utility Functions
// ============================================

export function uuid() {
  return crypto.randomUUID?.() ??
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

export function deepClone(obj) {
  return structuredClone?.(obj) ?? JSON.parse(JSON.stringify(obj));
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function compressImage(file, maxSize = 400, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
          else { w = Math.round(w * maxSize / h); h = maxSize; }
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export function nationalityFlag(nationality) {
  const flagFiles = {
    'British': 'british',
    'French': 'french',
    'Spanish': 'spanish',
    'Dutch': 'dutch',
    'American': 'american',
    'Ottoman': 'ottoman',
    'Pirates': 'pirate',
    'Privateers': 'pirate',
  };
  const file = flagFiles[nationality];
  if (file) return `<img src="flags/${file}.png" alt="${nationality}" class="nationality-flag">`;
  return '';
}

export function crewRatingTag(crewRating) {
  const ratings = {
    'landsmen':  { label: 'Landsmen Crew', color: 'crew-green' },
    'ordinary':  { label: 'Ordinary Crew', color: 'crew-blue' },
    'able':      { label: 'Able Crew',     color: 'crew-purple' },
    'crack':     { label: 'Crack Crew',    color: 'crew-red' },
  };
  const r = ratings[crewRating];
  if (!r) return '';
  return `<span class="crew-tag ${r.color}">${r.label}</span>`;
}

export function shipCardHtml(ship, { showActions = true } = {}) {
  const imageHtml = ship.shipImage?.data
    ? `<img src="${ship.shipImage.data}" alt="${escapeHtml(ship.name)}">`
    : `<img src="ship-silhouette.png" alt="Ship" class="placeholder-silhouette">`;
  const flagHtml = nationalityFlag(ship.nationality);
  const crewTag = crewRatingTag(ship.captain?.crewRating);

  return `
    <div class="ship-grid-card" data-id="${ship.id}">
      <div class="ship-grid-card-header">
        <div class="ship-grid-card-image">${imageHtml}</div>
        <div class="ship-grid-card-info">
          <div class="ship-grid-card-title">${escapeHtml(ship.name || 'Untitled')}</div>
          <div class="ship-grid-card-subtitle">${escapeHtml(ship.classAndRating || 'Unknown class')}${ship.yearLaunched ? ` (${escapeHtml(ship.yearLaunched)})` : ''}</div>
          ${ship.captain?.name ? `<div class="ship-grid-card-captain">${ship.captain.rank ? escapeHtml(ship.captain.rank) + ' ' : ''}${escapeHtml(ship.captain.name)}</div>` : ''}
          ${crewTag ? `<div class="ship-grid-card-crew">${crewTag}</div>` : ''}
        </div>
        ${flagHtml ? `<div class="ship-grid-card-flag">${flagHtml}</div>` : ''}
      </div>
      ${showActions ? `
      <div class="ship-grid-card-actions">
        <button class="btn btn-ghost btn-sm card-action-btn" data-action="edit" data-id="${ship.id}" title="Edit"><img src="quill-navy.png" alt="Edit" class="card-action-icon"></button>
        <button class="btn btn-ghost btn-sm card-action-btn" data-action="duplicate" data-id="${ship.id}" title="Duplicate"><img src="duplicate-icon.png" alt="Duplicate" class="card-action-icon"></button>
        <span class="spacer"></span>
        <button class="btn btn-ghost btn-sm card-action-btn" data-action="delete" data-id="${ship.id}" title="Delete" style="color:var(--red)" aria-label="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
      </div>` : ''}
    </div>`;
}

export function getSpeedForSail(speed, setting) {
  if (!speed) return { closeHauled: 0, reaching: 0, running: 0 };
  // Support legacy format { full: {...}, battle: {...}, reefed: {...} }
  const full = speed.full || speed;
  if (setting === 'full') return { ...full };
  const derive = (v) => {
    if (setting === 'battle') return Math.round(v * 2 / 3);
    if (setting === 'reefed') return Math.round(v / 3);
    return 0; // hoveTo
  };
  return {
    closeHauled: derive(full.closeHauled || 0),
    reaching: derive(full.reaching || 0),
    running: derive(full.running || 0),
  };
}

export function sailIcon(setting) {
  const icons = {
    'hoveTo': '\u{2693}',
    'reefed': '\u{26F5}',
    'battle': '\u{1F6A2}',
    'full': '\u{1F4A8}',
  };
  return icons[setting] || '\u{26F5}';
}

export function getGameShips(game) {
  if (game.forces) {
    return game.forces.flatMap(f => f.ships || []);
  }
  return game.ships || [];
}

export function windArrow(direction) {
  const arrows = {
    'N': '\u{2B07}', 'NE': '\u{2199}', 'E': '\u{2B05}', 'SE': '\u{2196}',
    'S': '\u{2B06}', 'SW': '\u{2197}', 'W': '\u{27A1}', 'NW': '\u{2198}',
  };
  return arrows[direction] || '\u{1F4A8}';
}
