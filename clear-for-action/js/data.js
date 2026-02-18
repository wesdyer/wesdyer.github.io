// ============================================
// Clear for Action! — Static Game Data
// ============================================

// --- Nationalities & Force Default Ratings ---
export const NATIONALITIES = [
  { id: 'British',     name: 'British',   command: 13, seamanship: 13, gunnery: 13, closeAction: 11 },
  { id: 'French',      name: 'French',    command: 12, seamanship: 13, gunnery: 12, closeAction: 11 },
  { id: 'Spanish',     name: 'Spanish',   command: 10, seamanship: 11, gunnery: 10, closeAction: 12 },
  { id: 'American',    name: 'American',  command: 12, seamanship: 12, gunnery: 13, closeAction: 11 },
  { id: 'Dutch',       name: 'Dutch',     command: 12, seamanship: 13, gunnery: 12, closeAction: 11 },
  { id: 'Ottoman',     name: 'Ottoman',   command: 10, seamanship: 11, gunnery: 9,  closeAction: 12 },
  { id: 'Minor Power', name: 'Other',     command: 10, seamanship: 11, gunnery: 10, closeAction: 10 },
  { id: 'Pirates',     name: 'Pirates',   command: 10, seamanship: 12, gunnery: 10, closeAction: 13 },
];

// --- Ship Types (role/purpose) ---
export const SHIP_TYPES = [
  { id: 'navy',      name: 'Navy' },
  { id: 'privateer', name: 'Privateer', command: 11, seamanship: 13, gunnery: 12, closeAction: 11 },
  { id: 'merchant',  name: 'Merchant',  command: 9,  seamanship: 10, gunnery: 9,  closeAction: 9  },
];

// --- Crew Ratings ---
export const CREW_RATINGS = [
  { id: 'landsmen',  name: 'Landsmen (Green)' },
  { id: 'ordinary',  name: 'Ordinary (Regular)' },
  { id: 'able',      name: 'Able (Veteran)' },
  { id: 'crack',     name: 'Crack (Elite)' },
];

// --- Abilities ---
// Categories: ship, captain, crew, weakness
export const ABILITIES = [
  // — Ship —
  // points: always-on passives that define the ship's character
  { id: 'elusive',        name: 'Elusive',        category: 'ship', points: 4,  effect: '\u20131 Gunnery to all enemies firing at this ship.' },
  { id: 'flush-deck',     name: 'Flush Deck',     category: 'ship', points: 1,  effect: '+2 to tests to extinguish Fire criticals.' },
  { id: 'handy',          name: 'Handy',          category: 'ship', points: 2,  effect: 'Reroll failed Tacking tests. Must keep the new result.' },
  { id: 'sea-kindly',     name: 'Sea Kindly',     category: 'ship', points: 1,  effect: 'Treat weather one step calmer for movement purposes.' },
  { id: 'stout-hull',     name: 'Stout Hull',     category: 'ship', points: 2,  effect: 'Ignore the first Hull critical each game.' },
  { id: 'tumblehome',     name: 'Tumblehome',     category: 'ship', points: 2,  effect: 'Enemy boarding tests suffer \u20132 Close Action against this ship.' },

  // — Captain —
  // points: tactical choices and conditional bonuses
  { id: 'calculated-ambition', name: 'Calculated Ambition', category: 'captain', points: 1, effect: 'If the turn ends with no enemy within 6", gain +1 Command next turn.' },
  { id: 'corsair',             name: 'Corsair',             category: 'captain', points: 2, effect: '+1 Command for boarding and prize-taking. +1 Seamanship when disengaging.' },
  { id: 'crowd-on-sail',       name: 'Crowd On Sail',       category: 'captain', points: 1, effect: 'Gain +1" movement for two turns, but suffer \u20131 Command during that period.' },
  { id: 'cunning-maneuver',    name: 'Cunning Maneuver',    category: 'captain', points: 2, effect: 'Once per game, make one free turn before firing a broadside.' },
  { id: 'damn-the-risk',       name: 'Damn the Risk!',      category: 'captain', points: 2, effect: '+1 Gunnery when firing within 1" of the target.' },
  { id: 'devils-luck',         name: "Devil's Luck",        category: 'captain', points: 3, effect: 'Force a reroll on three dice per game (yours or opponent\'s).' },
  { id: 'flash-of-brilliance', name: 'Flash of Brilliance', category: 'captain', points: 2, effect: 'Once per game, roll twice for any test and keep the better result.' },
  { id: 'follow-me',           name: 'Follow Me!',          category: 'captain', points: 2, effect: 'Friendly ships within 6" gain +1 Command.' },
  { id: 'fox-of-the-sea',      name: 'Fox of the Sea',      category: 'captain', points: 2, effect: 'If this ship did not use all its maneuvers, it may make one after all other ships have moved.' },
  { id: 'hold-your-fire',      name: 'Hold Your Fire',      category: 'captain', points: 1, effect: 'Skip firing for a full turn to gain +2 Gunnery next broadside.' },
  { id: 'inspiring-leader',    name: 'Inspiring Leader',    category: 'captain', points: 1, effect: '+1 to Command tests to Rally.' },
  { id: 'local-pilot',         name: 'Local Pilot',         category: 'captain', points: 1, effect: 'Reroll all checks to run aground, strike reefs, or hit rocks.' },
  { id: 'no-retreat',          name: 'No Retreat',          category: 'captain', points: 2, effect: 'Ignore the first failed morale test (Strike or Rally) each game.' },
  { id: 'point-of-honor',      name: 'Point of Honor',      category: 'captain', points: 1, effect: 'When fighting a single opponent, gain +1 Gunnery if this ship took damage this turn.' },
  { id: 'press-home',          name: 'Press Home',          category: 'captain', points: 1, effect: '+1 Command when within 1" of an enemy ship.' },
  { id: 'sails-before-guns',   name: 'Sails Before Guns',   category: 'captain', points: 1, effect: 'If this ship does not fire this round, it may make one extra maneuver.' },
  { id: 'sang-froid',          name: 'Sang-Froid',          category: 'captain', points: 2, effect: 'Only suffer \u20131 Command when Unsteady (instead of normal penalty).' },
  { id: 'sea-wolf',            name: 'Sea Wolf',            category: 'captain', points: 1, effect: '+1 Command when within 6" of an enemy flagship.' },
  { id: 'strategist',          name: 'Strategist',          category: 'captain', points: 1, effect: "Once per game, choose this ship's place in the activation order." },

  // — Crew —
  // points: combat effectiveness modifiers
  { id: 'blood-up',            name: 'Blood Up',            category: 'crew', points: 1, effect: 'After successfully rallying, gain +1 Gunnery.' },
  { id: 'dead-eye',            name: 'Dead Eye',            category: 'crew', points: 1, effect: '+1 Gunnery at long range.' },
  { id: 'rolling-broadside',   name: 'Rolling Broadside',   category: 'crew', points: 4, effect: 'Once per game, fire a broadside twice in the same turn.' },
  { id: 'sharpshooters',       name: 'Sharpshooters',       category: 'crew', points: 2, effect: 'After firing a broadside at short range, make a Close Action test. On success, inflict one additional Officer critical.' },
  { id: 'broadside',           name: 'Broadside!',          category: 'crew', points: 4, effect: 'Once per game, when firing a broadside, reroll all failed Gunnery dice. Must keep the new results.' },
  { id: 'drilled-gunnery',     name: 'Drilled Gunnery',     category: 'crew', points: 2, effect: 'Reroll natural 20s on Gunnery tests (normally automatic misses). Must keep the new results.' },
  { id: 'boarders-away',       name: 'Boarders Away!',      category: 'crew', points: 2, effect: '+1 Close Action in boarding combat.' },
  { id: 'fire-eaters',         name: 'Fire-Eaters',         category: 'crew', points: 3, effect: '+2 Close Action when this ship initiates boarding.' },
  { id: 'unflinching',         name: 'Unflinching',         category: 'crew', points: 3, effect: 'No penalty for being Unsteady.' },
  { id: 'stout-hearts',        name: 'Stout Hearts',        category: 'crew', points: 2, effect: 'Reroll failed Rally tests. Must keep the new result.' },
  { id: 'stand-by-the-captain', name: 'Stand by the Captain', category: 'crew', points: 2, effect: 'Ignore the first Officer critical each game.' },
  { id: 'jury-rig',            name: 'Jury-Rig',            category: 'crew', points: 1, effect: 'Once per game, immediately repair one Rigging or Mast critical.' },
  { id: 'bosuns-pride',        name: "Bosun's Pride",       category: 'crew', points: 1, effect: '+1 to Command tests to repair damage.' },
  { id: 'boarding-nets',       name: 'Boarding Nets',       category: 'crew', points: 2, effect: 'When the enemy initiates boarding, make a Seamanship test. On success, the boarding is repelled \u2014 the enemy must try again next turn.' },
  { id: 'surgeon',             name: 'Surgeon',             category: 'crew', points: 1, effect: 'Once per game, test Command. On success, recover one Officer critical or 1 Crew damage.' },

  // — Weakness —
  // points: negative values reflecting the drawback severity
  { id: 'crank',           name: 'Crank',           category: 'weakness', points: -1, effect: 'In Heavy weather or above, \u20131 Maneuver and \u20131 to Seamanship tests.' },
  { id: 'dry-as-tinder',   name: 'Dry as Tinder',   category: 'weakness', points: -2, effect: 'After taking a Fire critical, test Command. If failed, take a second Fire critical immediately.' },
  { id: 'faint-heart',     name: 'Faint Heart',     category: 'weakness', points: -2, effect: 'Must pass a Command test to initiate boarding or close within short range of an enemy.' },
  { id: 'green-crew',      name: 'Green Crew',      category: 'weakness', points: -2, effect: 'First time this ship takes broadside damage, test Command. If failed, become Unsteady immediately. On natural 1, gain +1 Morale for the rest of the game.' },
  { id: 'hot-headed',      name: 'Hot-Headed',      category: 'weakness', points: -1, effect: 'At the start of activation, if an enemy is within 12", test Command. If failed, must move toward the nearest enemy this turn.' },
  { id: 'nerves-of-glass', name: 'Nerves of Glass', category: 'weakness', points: -2, effect: 'After taking broadside damage, test Command. If failed, make a random turn.' },
  { id: 'powder-keg',      name: 'Powder Keg',      category: 'weakness', points: -2, effect: 'When this ship suffers a Magazine result on the Hull critical table, the explosion occurs even if there is no active Fire critical.' },
  { id: 'rotten-timbers',  name: 'Rotten Timbers',  category: 'weakness', points: -2, effect: 'When this ship takes a Hull critical, test Seamanship. If failed, take one additional Hull critical.' },
  { id: 'wanting-hands',   name: 'Wanting Hands',   category: 'weakness', points: -3, effect: 'Cannot fire both broadsides in the same turn. Cannot initiate boarding.' },
];

// --- Gun Types Reference ---
// Columns: type, damage, short range, medium range, long range
export const GUN_TYPES = [
  { type: '1-pdr',         damage: 11, short: 1, medium: 3,  long: 6,  isCarronade: false },
  { type: '2-pdr',         damage: 13, short: 1, medium: 5,  long: 10, isCarronade: false },
  { type: '3-pdr',         damage: 14, short: 2, medium: 5,  long: 12, isCarronade: false },
  { type: '4-pdr',         damage: 15, short: 2, medium: 6,  long: 14, isCarronade: false },
  { type: '6-pdr',         damage: 17, short: 3, medium: 7,  long: 16, isCarronade: false },
  { type: '8-pdr',         damage: 18, short: 3, medium: 8,  long: 18, isCarronade: false },
  { type: '9-pdr',         damage: 19, short: 3, medium: 9,  long: 21, isCarronade: false },
  { type: '12-pdr',        damage: 21, short: 4, medium: 10, long: 23, isCarronade: false },
  { type: '18-pdr',        damage: 23, short: 4, medium: 12, long: 25, isCarronade: false },
  { type: '24-pdr',        damage: 26, short: 4, medium: 14, long: 27, isCarronade: false },
  { type: '32-pdr',        damage: 29, short: 5, medium: 15, long: 30, isCarronade: false },
  { type: '36-pdr',        damage: 30, short: 5, medium: 16, long: 32, isCarronade: false },
  { type: '42-pdr',        damage: 32, short: 5, medium: 17, long: 34, isCarronade: false },
  { type: '64-pdr',        damage: 36, short: 6, medium: 18, long: 36, isCarronade: false },
  { type: '6-pdr carr.',   damage: 20, short: 3, medium: 0,  long: 0,  isCarronade: true },
  { type: '12-pdr carr.',  damage: 24, short: 4, medium: 0,  long: 0,  isCarronade: true },
  { type: '18-pdr carr.',  damage: 26, short: 4, medium: 0,  long: 0,  isCarronade: true },
  { type: '24-pdr carr.',  damage: 28, short: 4, medium: 0,  long: 0,  isCarronade: true },
  { type: '32-pdr carr.',  damage: 30, short: 5, medium: 0,  long: 0,  isCarronade: true },
  { type: '36-pdr carr.',  damage: 31, short: 5, medium: 0,  long: 0,  isCarronade: true },
  { type: '42-pdr carr.',  damage: 32, short: 5, medium: 0,  long: 0,  isCarronade: true },
  { type: '64-pdr carr.',  damage: 38, short: 6, medium: 0,  long: 0,  isCarronade: true },
  { type: '68-pdr carr.',  damage: 40, short: 6, medium: 0,  long: 0,  isCarronade: true },
];

export const GUN_FACINGS = [
  { id: 'broadside', name: 'Broadside', abbr: 'BS' },
  { id: 'bow',       name: 'Bow Chase', abbr: 'Bow' },
  { id: 'stern',     name: 'Stern Chase', abbr: 'Stern' },
];

// --- Wind Settings ---
export const WIND_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export const WIND_STRENGTHS = [
  { id: 'calm',     name: 'Calm' },
  { id: 'light',    name: 'Light' },
  { id: 'moderate', name: 'Moderate' },
  { id: 'heavy',    name: 'Heavy' },
  { id: 'storm',    name: 'Storm' },
];

// --- Sail Settings ---
export const SAIL_SETTINGS = [
  { id: 'hoveTo', name: 'Hove To' },
  { id: 'reefed', name: 'Reefed' },
  { id: 'battle', name: 'Battle' },
  { id: 'full',   name: 'Full' },
];

// --- Ship Class Templates ---
// Stats from the rulebook "Ship Default Stats" table
// Columns: defense, morale, crew, rigging, hull, maneuver, fullCH, fullReach, fullRun, fire, leak, steering, mast, officer
export const SHIP_TEMPLATES = [
  // --- Warships ---
  {
    id: 'boat',
    name: 'Boat / Launch / Gunboat',
    gunRange: '1 - 2 guns',
    category: 'warship',
    tonnageRange: '20 - 110',
    defense: 3,
    morale: 5, crew: 1, rigging: 3, hull: 4,
    maneuver: 6,
    speed: { closeHauled: 4, reaching: 5, running: 4 },
    criticals: { fire: 1, leak: 1, steering: 1, mast: 0, officer: 1 },
  },
  {
    id: 'cutter',
    name: 'Cutter',
    gunRange: '2 - 6 guns',
    category: 'warship',
    tonnageRange: '80 - 180',
    defense: 4,
    morale: 6, crew: 1, rigging: 4, hull: 5,
    maneuver: 6,
    speed: { closeHauled: 5, reaching: 6, running: 5 },
    criticals: { fire: 2, leak: 2, steering: 1, mast: 1, officer: 1 },
  },
  {
    id: 'small-brig',
    name: 'Small Brig / Schooner',
    gunRange: '6 - 10 guns',
    category: 'warship',
    tonnageRange: '140 - 230',
    defense: 6,
    morale: 8, crew: 2, rigging: 5, hull: 6,
    maneuver: 5,
    speed: { closeHauled: 6, reaching: 7, running: 6 },
    criticals: { fire: 2, leak: 3, steering: 1, mast: 2, officer: 1 },
  },
  {
    id: 'brig-sloop',
    name: 'Brig / Sloop / Small Corvette',
    gunRange: '12 - 18 guns',
    category: 'warship',
    tonnageRange: '230 - 400',
    defense: 8,
    morale: 9, crew: 3, rigging: 6, hull: 11,
    maneuver: 4,
    speed: { closeHauled: 6, reaching: 8, running: 7 },
    criticals: { fire: 2, leak: 4, steering: 1, mast: 2, officer: 2 },
  },
  {
    id: 'light-frigate',
    name: 'Light Frigate / Corvette',
    gunRange: '20 - 28 guns',
    category: 'warship',
    tonnageRange: '450 - 650',
    defense: 10,
    morale: 12, crew: 4, rigging: 8, hull: 15,
    maneuver: 3,
    speed: { closeHauled: 7, reaching: 10, running: 9 },
    criticals: { fire: 3, leak: 5, steering: 2, mast: 3, officer: 2 },
  },
  {
    id: 'frigate',
    name: 'Frigate',
    gunRange: '30 - 40 guns',
    category: 'warship',
    tonnageRange: '900 - 1100',
    defense: 11,
    morale: 16, crew: 6, rigging: 9, hull: 23,
    maneuver: 3,
    speed: { closeHauled: 8, reaching: 11, running: 10 },
    criticals: { fire: 3, leak: 6, steering: 2, mast: 3, officer: 2 },
  },
  {
    id: 'heavy-frigate',
    name: 'Heavy Frigate',
    gunRange: '42 - 50 guns',
    category: 'warship',
    tonnageRange: '1200 - 1600',
    defense: 13,
    morale: 20, crew: 7, rigging: 12, hull: 28,
    maneuver: 3,
    speed: { closeHauled: 9, reaching: 12, running: 11 },
    criticals: { fire: 4, leak: 7, steering: 2, mast: 3, officer: 3 },
  },
  {
    id: '4th-rate',
    name: '4th Rate / Small 3rd Rate',
    gunRange: '50 - 64 guns',
    category: 'warship',
    tonnageRange: '1050 - 1700',
    defense: 16,
    morale: 22, crew: 8, rigging: 14, hull: 32,
    maneuver: 2,
    speed: { closeHauled: 7, reaching: 10, running: 9 },
    criticals: { fire: 4, leak: 9, steering: 3, mast: 3, officer: 3 },
  },
  {
    id: '3rd-rate',
    name: '3rd Rate',
    gunRange: '70 - 80 guns',
    category: 'warship',
    tonnageRange: '1600 - 2100',
    defense: 17,
    morale: 24, crew: 9, rigging: 15, hull: 34,
    maneuver: 2,
    speed: { closeHauled: 7, reaching: 10, running: 9 },
    criticals: { fire: 4, leak: 9, steering: 3, mast: 3, officer: 3 },
  },
  {
    id: '2nd-rate',
    name: '2nd Rate',
    gunRange: '82 - 100 guns',
    category: 'warship',
    tonnageRange: '2000 - 2300',
    defense: 18,
    morale: 30, crew: 10, rigging: 17, hull: 37,
    maneuver: 1,
    speed: { closeHauled: 7, reaching: 10, running: 9 },
    criticals: { fire: 5, leak: 10, steering: 3, mast: 3, officer: 4 },
  },
  {
    id: '1st-rate',
    name: '1st Rate',
    gunRange: '100+ guns',
    category: 'warship',
    tonnageRange: '2100 - 2500',
    defense: 19,
    morale: 32, crew: 12, rigging: 20, hull: 40,
    maneuver: 1,
    speed: { closeHauled: 7, reaching: 10, running: 9 },
    criticals: { fire: 5, leak: 10, steering: 3, mast: 3, officer: 4 },
  },

  // --- Merchants & Traders ---
  {
    id: 'merchant-boat',
    name: 'Boat / Launch / Lighter',
    gunRange: '0 guns',
    category: 'merchant',
    tonnageRange: '10 - 60',
    defense: 2,
    morale: 3, crew: 1, rigging: 2, hull: 3,
    maneuver: 6,
    speed: { closeHauled: 3, reaching: 4, running: 4 },
    criticals: { fire: 1, leak: 1, steering: 1, mast: 0, officer: 0 },
  },
  {
    id: 'smack',
    name: 'Smack',
    gunRange: '0 guns',
    category: 'merchant',
    tonnageRange: '20 - 60',
    defense: 3,
    morale: 4, crew: 1, rigging: 3, hull: 4,
    maneuver: 6,
    speed: { closeHauled: 4, reaching: 5, running: 4 },
    criticals: { fire: 1, leak: 1, steering: 1, mast: 1, officer: 0 },
  },
  {
    id: 'hoy',
    name: 'Hoy',
    gunRange: '0 guns',
    category: 'merchant',
    tonnageRange: '50 - 80',
    defense: 3,
    morale: 4, crew: 1, rigging: 3, hull: 4,
    maneuver: 5,
    speed: { closeHauled: 3, reaching: 5, running: 4 },
    criticals: { fire: 1, leak: 2, steering: 1, mast: 1, officer: 0 },
  },
  {
    id: 'felucca',
    name: 'Felucca / Tartane',
    gunRange: '0 guns',
    category: 'merchant',
    tonnageRange: '30 - 100',
    defense: 3,
    morale: 5, crew: 1, rigging: 3, hull: 4,
    maneuver: 6,
    speed: { closeHauled: 4, reaching: 6, running: 6 },
    criticals: { fire: 1, leak: 1, steering: 1, mast: 1, officer: 0 },
  },
  {
    id: 'lugger',
    name: 'Lugger',
    gunRange: '0 - 4 guns',
    category: 'merchant',
    tonnageRange: '50 - 120',
    defense: 4,
    morale: 6, crew: 1, rigging: 4, hull: 5,
    maneuver: 7,
    speed: { closeHauled: 4, reaching: 7, running: 6 },
    criticals: { fire: 1, leak: 2, steering: 1, mast: 1, officer: 0 },
  },
  {
    id: 'merchant-cutter',
    name: 'Cutter (merchant)',
    gunRange: '0 - 4 guns',
    category: 'merchant',
    tonnageRange: '80 - 150',
    defense: 4,
    morale: 6, crew: 1, rigging: 4, hull: 5,
    maneuver: 6,
    speed: { closeHauled: 5, reaching: 7, running: 6 },
    criticals: { fire: 2, leak: 2, steering: 1, mast: 1, officer: 0 },
  },
  {
    id: 'merchant-schooner',
    name: 'Schooner (merchant)',
    gunRange: '0 - 6 guns',
    category: 'merchant',
    tonnageRange: '100 - 200',
    defense: 5,
    morale: 6, crew: 1, rigging: 5, hull: 6,
    maneuver: 6,
    speed: { closeHauled: 5, reaching: 7, running: 6 },
    criticals: { fire: 2, leak: 2, steering: 1, mast: 1, officer: 0 },
  },
  {
    id: 'merchant-brigantine',
    name: 'Brigantine (merchant)',
    gunRange: '0 - 4 guns',
    category: 'merchant',
    tonnageRange: '50 - 150',
    defense: 5,
    morale: 6, crew: 1, rigging: 5, hull: 6,
    maneuver: 6,
    speed: { closeHauled: 4, reaching: 6, running: 6 },
    criticals: { fire: 2, leak: 2, steering: 1, mast: 1, officer: 0 },
  },
  {
    id: 'polacca-xebec',
    name: 'Polacca / Xebec',
    gunRange: '0 - 8 guns',
    category: 'merchant',
    tonnageRange: '100 - 250',
    defense: 5,
    morale: 6, crew: 1, rigging: 5, hull: 6,
    maneuver: 6,
    speed: { closeHauled: 5, reaching: 7, running: 8 },
    criticals: { fire: 2, leak: 2, steering: 1, mast: 1, officer: 0 },
  },
  {
    id: 'snow',
    name: 'Snow',
    gunRange: '0 - 6 guns',
    category: 'merchant',
    tonnageRange: '150 - 350',
    defense: 6,
    morale: 7, crew: 2, rigging: 6, hull: 8,
    maneuver: 4,
    speed: { closeHauled: 5, reaching: 7, running: 6 },
    criticals: { fire: 2, leak: 3, steering: 1, mast: 2, officer: 0 },
  },
  {
    id: 'merchant-brig',
    name: 'Brig (merchant)',
    gunRange: '0 - 8 guns',
    category: 'merchant',
    tonnageRange: '180 - 350',
    defense: 6,
    morale: 7, crew: 2, rigging: 6, hull: 9,
    maneuver: 4,
    speed: { closeHauled: 5, reaching: 7, running: 6 },
    criticals: { fire: 2, leak: 3, steering: 1, mast: 2, officer: 0 },
  },
  {
    id: 'collier',
    name: 'Collier',
    gunRange: '0 - 4 guns',
    category: 'merchant',
    tonnageRange: '280 - 380',
    defense: 6,
    morale: 7, crew: 2, rigging: 6, hull: 10,
    maneuver: 4,
    speed: { closeHauled: 5, reaching: 6, running: 6 },
    criticals: { fire: 2, leak: 4, steering: 1, mast: 2, officer: 0 },
  },
  {
    id: 'fluyt',
    name: 'Fluyt',
    gunRange: '0 - 6 guns',
    category: 'merchant',
    tonnageRange: '300 - 600',
    defense: 7,
    morale: 7, crew: 2, rigging: 7, hull: 10,
    maneuver: 3,
    speed: { closeHauled: 5, reaching: 7, running: 6 },
    criticals: { fire: 2, leak: 4, steering: 1, mast: 2, officer: 0 },
  },
  {
    id: 'barque',
    name: 'Barque / Small Ship-rigged Merchant',
    gunRange: '0 - 8 guns',
    category: 'merchant',
    tonnageRange: '300 - 700',
    defense: 7,
    morale: 7, crew: 2, rigging: 7, hull: 12,
    maneuver: 3,
    speed: { closeHauled: 6, reaching: 8, running: 7 },
    criticals: { fire: 2, leak: 5, steering: 2, mast: 2, officer: 0 },
  },
  {
    id: 'west-indiaman',
    name: 'West Indiaman',
    gunRange: '6 - 16 guns',
    category: 'merchant',
    tonnageRange: '400 - 800',
    defense: 8,
    morale: 8, crew: 3, rigging: 8, hull: 14,
    maneuver: 3,
    speed: { closeHauled: 6, reaching: 8, running: 7 },
    criticals: { fire: 3, leak: 6, steering: 2, mast: 2, officer: 0 },
  },
  {
    id: 'packet-ship',
    name: 'Packet Ship',
    gunRange: '4 - 12 guns',
    category: 'merchant',
    tonnageRange: '400 - 900',
    defense: 8,
    morale: 9, crew: 2, rigging: 8, hull: 13,
    maneuver: 4,
    speed: { closeHauled: 7, reaching: 9, running: 8 },
    criticals: { fire: 4, leak: 6, steering: 2, mast: 2, officer: 0 },
  },
  {
    id: 'east-indiaman',
    name: 'East Indiaman',
    gunRange: '20 - 36 guns',
    category: 'merchant',
    tonnageRange: '800 - 1400',
    defense: 9,
    morale: 9, crew: 4, rigging: 10, hull: 18,
    maneuver: 2,
    speed: { closeHauled: 6, reaching: 8, running: 7 },
    criticals: { fire: 3, leak: 7, steering: 2, mast: 3, officer: 1 },
  },
  {
    id: 'large-indiaman',
    name: 'Large Indiaman',
    gunRange: '30 - 50 guns',
    category: 'merchant',
    tonnageRange: '1200 - 1600',
    defense: 10,
    morale: 10, crew: 5, rigging: 11, hull: 20,
    maneuver: 2,
    speed: { closeHauled: 6, reaching: 9, running: 8 },
    criticals: { fire: 3, leak: 8, steering: 2, mast: 3, officer: 1 },
  },
];

// --- Helper: Create blank ship from template ---
export function createShipFromTemplate(templateId) {
  const t = SHIP_TEMPLATES.find(s => s.id === templateId);
  if (!t) return createBlankShip();
  return {
    ...createBlankShip(),
    classAndRating: t.name + (t.gunRange ? ` (${t.gunRange})` : ''),
    tonnage: t.tonnageRange,
    movement: { maneuver: t.maneuver, defense: t.defense },
    speed: { ...t.speed },
    vitals: { morale: t.morale, crew: t.crew, rigging: t.rigging, hull: t.hull },
    criticals: { ...t.criticals },
    sourceTemplate: t.id,
  };
}

export function createBlankShip() {
  return {
    id: '',  // set by caller
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    name: '',
    nationality: 'British',
    shipType: 'navy',
    isFictional: false,
    classAndRating: '',
    description: '',
    yearLaunched: '',
    yearRefit: '',
    tonnage: '',
    complement: '',
    shipImage: null,
    captain: { name: '', rank: '', image: null, crewRating: 'ordinary' },
    abilities: [],
    skills: { command: 13, seamanship: 13, gunnery: 13, closeAction: 11 },
    movement: { maneuver: 3, defense: 10 },
    speed: { closeHauled: 0, reaching: 0, running: 0, sweeps: 0 },
    vitals: { morale: 10, crew: 4, rigging: 6, hull: 10 },
    guns: [],
    criticals: { fire: 2, leak: 2, steering: 2, mast: 2, officer: 2 },
    broadsideWeight: 0,
    sourceTemplate: null,
  };
}

// --- Helper: Create GameShip from a Ship template ---
export function createGameShip(ship) {
  const { deepClone } = { deepClone: obj => JSON.parse(JSON.stringify(obj)) };
  const gs = deepClone(ship);
  gs.sourceShipId = ship.id;
  gs.displayName = ship.name;
  gs.currentVitals = { ...ship.vitals };
  gs.currentGuns = (ship.guns || []).map(g => {
    const entry = { gunId: g.id, remainingCount: g.count };
    if (g.facing === 'broadside' || !g.facing) {
      entry.remainingPort = Math.floor(g.count / 2);
      entry.remainingStarboard = g.count - entry.remainingPort;
    }
    return entry;
  });
  gs.currentCriticals = { fire: 0, leak: 0, steering: 0, mast: 0, officer: 0 };
  gs.sailSetting = 'battle';
  gs.status = { grappled: false, aground: false, struck: false, firstBroadside: { port: true, starboard: true } };
  gs.notes = '';
  gs.collapsed = true;
  return gs;
}
