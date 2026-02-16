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

// --- Ships ---

export function getShips() {
  return read(SHIPS_KEY);
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

export function getGames() {
  return read(GAMES_KEY);
}

export function getGame(id) {
  return getGames().find(g => g.id === id) || null;
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
