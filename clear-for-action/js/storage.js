// ============================================
// Clear for Action! — Storage Layer
// ============================================

const SHIPS_KEY = 'cfa_ships';
const GAMES_KEY = 'cfa_games';

function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch { return []; }
}

function write(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      console.error('localStorage quota exceeded');
      return false;
    }
    throw e;
  }
}

// --- Ship Migration ---

function migrateShip(ship) {
  if (!ship) return ship;
  // isPrivateer → shipType: 'privateer'
  if (ship.isPrivateer) {
    ship.shipType = 'privateer';
    delete ship.isPrivateer;
  }
  // Merchants nationality → Minor Power + merchant type
  if (ship.nationality === 'Merchants') {
    ship.nationality = 'Minor Power';
    ship.shipType = 'merchant';
  }
  // Minor Navy → Minor Power
  if (ship.nationality === 'Minor Navy') {
    ship.nationality = 'Minor Power';
  }
  // Default shipType
  if (!ship.shipType) {
    ship.shipType = 'navy';
  }
  // Clean up legacy field
  if ('isPrivateer' in ship) {
    delete ship.isPrivateer;
  }
  return ship;
}

// --- Ships ---

export function getShips() {
  return read(SHIPS_KEY).map(migrateShip);
}

export function getShip(id) {
  return getShips().find(s => s.id === id) || null;
}

export function saveShip(ship) {
  const ships = getShips();
  const idx = ships.findIndex(s => s.id === ship.id);
  ship.updatedAt = new Date().toISOString();
  if (idx >= 0) ships[idx] = ship;
  else ships.push(ship);
  return write(SHIPS_KEY, ships);
}

export function deleteShip(id) {
  const ships = getShips().filter(s => s.id !== id);
  return write(SHIPS_KEY, ships);
}

// --- Games ---

function migrateGame(game) {
  if (!game) return game;
  if (!game.forces && game.ships) {
    const nationality = game.ships[0]?.nationality || 'British';
    game.forces = [{
      id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
      nationality,
      name: nationality,
      ships: game.ships,
    }];
    delete game.ships;
  }
  if (!game.forces) {
    game.forces = [];
  }
  if (game.notes !== undefined && game.description === undefined) {
    game.description = game.notes;
    delete game.notes;
  }
  // Migrate ships within forces
  game.forces.forEach(f => {
    if (f.nationality === 'Merchants') f.nationality = 'Minor Power';
    if (f.nationality === 'Minor Navy') f.nationality = 'Minor Power';
    (f.ships || []).forEach(migrateShip);
  });
  return game;
}

export function getGames() {
  return read(GAMES_KEY).map(migrateGame);
}

export function getGame(id) {
  return migrateGame(getGames().find(g => g.id === id) || null);
}

export function saveGame(game) {
  const games = getGames();
  const idx = games.findIndex(g => g.id === game.id);
  game.lastPlayed = new Date().toISOString();
  if (idx >= 0) games[idx] = game;
  else games.push(game);
  return write(GAMES_KEY, games);
}

export function deleteGame(id) {
  const games = getGames().filter(g => g.id !== id);
  return write(GAMES_KEY, games);
}

// --- Auto-save helper ---

let saveTimer = null;
export function autoSave(game) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!saveGame(game)) {
      import('./components.js').then(m => m.showToast('Save failed — storage full', 'error'));
    }
  }, 300);
}

// --- Storage stats ---

export function getStorageStats() {
  const shipsStr = localStorage.getItem(SHIPS_KEY) || '[]';
  const gamesStr = localStorage.getItem(GAMES_KEY) || '[]';
  const totalBytes = new Blob([shipsStr, gamesStr]).size;
  return {
    shipCount: read(SHIPS_KEY).length,
    gameCount: read(GAMES_KEY).length,
    bytesUsed: totalBytes,
    formattedSize: totalBytes < 1024 ? `${totalBytes} B`
      : totalBytes < 1048576 ? `${(totalBytes / 1024).toFixed(1)} KB`
      : `${(totalBytes / 1048576).toFixed(1)} MB`,
  };
}
