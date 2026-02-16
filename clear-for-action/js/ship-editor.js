// ============================================
// Clear for Action! — Ship Editor
// ============================================

import { getShip, saveShip, deleteShip } from './storage.js';
import { NATIONALITIES, CREW_RATINGS, ABILITIES, GUN_TYPES, GUN_FACINGS, SHIP_TEMPLATES, createShipFromTemplate, createBlankShip } from './data.js';
import { createStepper, createChipSelector, createImagePicker, showToast, confirmDialog } from './components.js';
import { uuid, escapeHtml, debounce, deepClone, calculatePoints } from './utils.js';

export function renderShipEditor(container, shipId, queryParams) {
  let ship;

  if (shipId) {
    ship = getShip(shipId);
    if (!ship) {
      container.innerHTML = '<p>Ship not found. <a href="#/ships">Back to ships</a></p>';
      return;
    }
  } else {
    const templateId = queryParams?.get('template');
    ship = templateId ? createShipFromTemplate(templateId) : createBlankShip();
    ship.id = uuid();
    ship.createdAt = new Date().toISOString();
    // Apply nationality defaults
    const nat = NATIONALITIES.find(n => n.id === ship.nationality);
    if (nat && !shipId) {
      ship.skills = { command: nat.command, seamanship: nat.seamanship, gunnery: nat.gunnery, closeAction: nat.closeAction };
    }
  }

  const isNew = !shipId;
  let dirty = !isNew; // existing ships are always saveable

  const autoSave = debounce(() => {
    if (!dirty) return; // don't save untouched new ships
    ship.updatedAt = new Date().toISOString();
    saveShip(ship);
  }, 400);

  container.innerHTML = `<form id="ship-form" class="editor-form" autocomplete="off"></form>`;

  const form = container.querySelector('#ship-form');
  buildForm(form, ship, isNew, autoSave);

  // Defer listeners so initialization events don't mark as dirty
  setTimeout(() => {
    form.addEventListener('input', () => { dirty = true; autoSave(); form._updatePoints?.(); });
    form.addEventListener('change', () => { dirty = true; autoSave(); form._updatePoints?.(); });
  }, 0);
}

function buildForm(form, ship, isNew, autoSave) {
  form.innerHTML = '';

  // --- Template Selector (new ships only) ---
  if (isNew) {
    const section = makeSection('Template');
    const templateSelect = el('select', { className: 'form-select', id: 'template-select' });
    templateSelect.innerHTML = `<option value="">-- No template (blank) --</option>
      <optgroup label="Warships">${SHIP_TEMPLATES.filter(t => t.category === 'warship').map(t =>
        `<option value="${t.id}" ${ship.sourceTemplate === t.id ? 'selected' : ''}>${t.name} (${t.gunRange})</option>`
      ).join('')}</optgroup>
      <optgroup label="Merchants & Traders">${SHIP_TEMPLATES.filter(t => t.category === 'merchant').map(t =>
        `<option value="${t.id}" ${ship.sourceTemplate === t.id ? 'selected' : ''}>${t.name} (${t.gunRange})</option>`
      ).join('')}</optgroup>`;

    templateSelect.addEventListener('change', () => {
      const t = templateSelect.value;
      if (!t) return;
      const tpl = createShipFromTemplate(t);
      Object.assign(ship, tpl, { id: ship.id, name: ship.name, createdAt: ship.createdAt, nationality: ship.nationality });
      // Re-apply nationality skills
      const nat = NATIONALITIES.find(n => n.id === ship.nationality);
      if (nat) ship.skills = { command: nat.command, seamanship: nat.seamanship, gunnery: nat.gunnery, closeAction: nat.closeAction };
      form.dataset.activeTab = 'overview';
      buildForm(form, ship, isNew);
    });

    section.appendChild(formGroup('Template', templateSelect));
    form.__templateSection = section;
  }

  // --- Overview ---
  const overview = makeSection('Ship Overview');
  overview.appendChild(formRow(
    formGroup('Name *', input('text', ship.name, v => ship.name = v, 'e.g. HMS Surprise')),
    formGroup('Nationality', nationalitySelect(ship, form, isNew)),
  ));
  overview.appendChild(formRow(
    formGroup('Class & Rating', input('text', ship.classAndRating, v => ship.classAndRating = v, 'e.g. 28-gun 6th rate')),
    formGroup('Year Launched', input('text', ship.yearLaunched, v => ship.yearLaunched = v, '1794')),
  ));
  overview.appendChild(formRow(
    formGroup('Tonnage', input('text', ship.tonnage, v => ship.tonnage = v, '578')),
    formGroup('Complement', input('text', ship.complement, v => ship.complement = v, '197')),
  ));
  overview.appendChild(formGroup('Description', textarea(ship.description, v => ship.description = v, 'Brief description...')));
  overview.appendChild(formGroup('Details Link', input('url', ship.detailsUrl || '', v => ship.detailsUrl = v, 'https://en.wikipedia.org/wiki/...')));

  const shipImagePicker = createImagePicker({
    currentImage: ship.shipImage,
    onImageChange: (img) => { ship.shipImage = img; },
    label: 'Ship',
  });
  overview.appendChild(formGroup('Ship Image', shipImagePicker));
  // --- Captain ---
  const captain = makeSection('Captain & Crew');
  captain.appendChild(formRow(
    formGroup('Captain Name', input('text', ship.captain.name, v => ship.captain.name = v, 'Jack Aubrey')),
    formGroup('Rank', input('text', ship.captain.rank, v => ship.captain.rank = v, 'Post-Captain')),
  ));

  const crewSelect = el('select', { className: 'form-select' });
  crewSelect.innerHTML = CREW_RATINGS.map(r =>
    `<option value="${r.id}" ${ship.captain.crewRating === r.id ? 'selected' : ''}>${r.name}</option>`
  ).join('');
  crewSelect.addEventListener('change', () => ship.captain.crewRating = crewSelect.value);
  captain.appendChild(formGroup('Crew Rating', crewSelect));

  const captainImagePicker = createImagePicker({
    currentImage: ship.captain.image,
    onImageChange: (img) => { ship.captain.image = img; },
    label: 'Captain',
  });
  captain.appendChild(formGroup('Captain Image', captainImagePicker));
  // --- Abilities ---
  const abilities = makeSection('Abilities');
  // Migrate legacy format (array of string IDs → array of objects)
  if (ship.abilities?.length && typeof ship.abilities[0] === 'string') {
    ship.abilities = ship.abilities.map(id => {
      const ref = ABILITIES.find(a => a.id === id);
      return ref ? { id: ref.id, name: ref.name, effect: ref.effect } : { id, name: id, effect: '' };
    });
  }
  if (!ship.abilities) ship.abilities = [];

  const abilitiesList = el('div', { className: 'abilities-list' });
  const renderAbilities = () => {
    abilitiesList.innerHTML = '';
    if (!ship.abilities.length) {
      abilitiesList.innerHTML = '<p class="text-muted text-small">No abilities. Use the controls below to add one.</p>';
      return;
    }
    ship.abilities.forEach((ability, idx) => {
      const item = el('div', { className: 'ability-item' });
      const info = el('div');
      const nameEl = el('strong');
      nameEl.textContent = ability.name;
      info.appendChild(nameEl);
      if (ability.effect) {
        const effectEl = el('div', { className: 'text-small text-muted' });
        effectEl.textContent = ability.effect;
        info.appendChild(effectEl);
      }
      const removeBtn = el('button', { className: 'btn btn-ghost btn-sm', type: 'button', style: 'color:var(--red);background:transparent;padding:4px' });
      removeBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
      removeBtn.addEventListener('click', () => {
        ship.abilities.splice(idx, 1);
        renderAbilities();
        autoSave?.();
      });
      item.append(info, removeBtn);
      abilitiesList.appendChild(item);
    });
  };
  renderAbilities();
  abilities.appendChild(abilitiesList);

  // Add from preexisting
  const addRow = el('div', { className: 'flex gap-sm mt-sm', style: 'align-items:end;flex-wrap:wrap' });
  const presetSelect = el('select', { className: 'form-select', style: 'flex:1;min-width:200px' });
  presetSelect.innerHTML = `<option value="">-- Add existing ability --</option>` +
    [...ABILITIES].sort((a, b) => a.name.localeCompare(b.name)).map(a => `<option value="${a.id}">${a.name}</option>`).join('');
  const addPresetBtn = el('button', { className: 'btn btn-secondary btn-sm', type: 'button' });
  addPresetBtn.textContent = 'Add';
  addPresetBtn.addEventListener('click', () => {
    const id = presetSelect.value;
    if (!id) return;
    const ref = ABILITIES.find(a => a.id === id);
    if (!ref) return;
    ship.abilities.push({ id: ref.id, name: ref.name, effect: ref.effect });
    presetSelect.value = '';
    renderAbilities();
    autoSave?.();
  });
  addRow.append(presetSelect, addPresetBtn);
  abilities.appendChild(addRow);

  // Add custom
  const customRow = el('div', { className: 'mt-sm' });
  const customTopRow = el('div', { className: 'flex gap-sm', style: 'align-items:end' });
  const customName = el('input', { type: 'text', className: 'form-input', placeholder: 'Custom name', style: 'flex:1' });
  const addCustomBtn = el('button', { className: 'btn btn-secondary btn-sm', type: 'button' });
  addCustomBtn.textContent = 'Add Custom';
  customTopRow.append(customName, addCustomBtn);
  const customEffect = el('textarea', { className: 'form-textarea mt-sm', placeholder: 'Effect description', rows: 2, style: 'width:100%' });
  addCustomBtn.addEventListener('click', () => {
    const name = customName.value.trim();
    if (!name) return;
    ship.abilities.push({ id: 'custom-' + uuid(), name, effect: customEffect.value.trim() });
    customName.value = '';
    customEffect.value = '';
    renderAbilities();
    autoSave?.();
  });
  customRow.append(customTopRow, customEffect);
  abilities.appendChild(customRow);

  // --- Skills ---
  const skills = makeSection('Skills');
  const skillsGrid = el('div', { className: 'grid-4' });
  ['command', 'seamanship', 'gunnery', 'closeAction'].forEach(key => {
    const label = key === 'closeAction' ? 'Close Action' : key.charAt(0).toUpperCase() + key.slice(1);
    const stepper = createStepper({
      value: ship.skills[key],
      min: 1, max: 20,
      onChange: v => ship.skills[key] = v,
      label,
    });
    skillsGrid.appendChild(stepper);
  });
  skills.appendChild(skillsGrid);
  // --- Movement ---
  // Migrate legacy format { full: {...}, battle: {...}, reefed: {...} }
  if (ship.speed?.full) ship.speed = { ...ship.speed.full };

  const movement = makeSection('Movement');

  const row = el('div', { className: 'form-row-3 mb-md' });
  ['closeHauled', 'reaching', 'running'].forEach(pos => {
    const posLabel = pos === 'closeHauled' ? 'Close Hauled' : pos.charAt(0).toUpperCase() + pos.slice(1);
    row.appendChild(createStepper({
      value: ship.speed?.[pos] || 0,
      min: 0, max: 20,
      onChange: v => {
        if (!ship.speed) ship.speed = {};
        ship.speed[pos] = v;
      },
      label: posLabel,
    }));
  });
  movement.appendChild(row);
  const maneuverGrid = el('div', { className: 'grid-2' });
  maneuverGrid.appendChild(createStepper({ value: ship.movement.maneuver, min: 0, max: 10, onChange: v => ship.movement.maneuver = v, label: 'Maneuver' }));
  movement.appendChild(maneuverGrid);
  // --- Vitals ---
  const vitals = makeSection('Vitals');
  const defRow = el('div', { className: 'grid-4 mb-md' });
  defRow.appendChild(createStepper({ value: ship.movement.defense, min: 0, max: 30, onChange: v => ship.movement.defense = v, label: 'Defense' }));
  vitals.appendChild(defRow);
  const vitalsGrid = el('div', { className: 'grid-4' });
  [
    { key: 'morale', label: 'Morale' },
    { key: 'crew', label: 'Crew' },
    { key: 'rigging', label: 'Rigging' },
    { key: 'hull', label: 'Hull' },
  ].forEach(({ key, label }) => {
    vitalsGrid.appendChild(createStepper({
      value: ship.vitals[key],
      min: 0, max: 99,
      onChange: v => ship.vitals[key] = v,
      label,
    }));
  });
  vitals.appendChild(vitalsGrid);
  // --- Points display (live-updating) ---
  const pointsDisplay = el('div', { className: 'editor-points-display' });
  const updatePointsDisplay = () => {
    pointsDisplay.innerHTML = `<span class="points-badge points-badge-lg">${calculatePoints(ship)} pts</span>`;
  };
  updatePointsDisplay();
  form._updatePoints = updatePointsDisplay;

  // --- Guns ---
  const guns = makeSection('Guns');
  const gunsContainer = el('div', { id: 'guns-container' });
  const bwDisplay = el('div', { className: 'form-label', style: 'font-size:1.1rem;font-weight:700;color:var(--navy)' });

  const updateBroadsideWeight = () => {
    const weight = ship.guns
      .filter(g => g.facing === 'broadside')
      .reduce((sum, g) => {
        const pdr = parseInt(g.type) || 0;
        return sum + (g.count / 2) * pdr;
      }, 0);
    ship.broadsideWeight = Math.round(weight);
    bwDisplay.textContent = `Broadside Weight: ${ship.broadsideWeight} lbs`;
    updatePointsDisplay();
    autoSave?.();
  };

  const addGunBtn = el('button', { className: 'btn btn-secondary btn-sm mt-sm', type: 'button' });
  addGunBtn.textContent = '+ Add Battery';
  addGunBtn.addEventListener('click', () => {
    ship.guns.push({
      id: uuid(),
      count: 2,
      facing: 'broadside',
      type: '9-pdr',
      isCarronade: false,
      damage: 19,
      rangeShort: 3,
      rangeMedium: 9,
      rangeLong: 21,
    });
    renderGuns(gunsContainer, ship, updateBroadsideWeight);
    updateBroadsideWeight();
  });

  renderGuns(gunsContainer, ship, updateBroadsideWeight);
  updateBroadsideWeight();
  guns.appendChild(bwDisplay);
  guns.appendChild(gunsContainer);
  guns.appendChild(addGunBtn);
  // --- Criticals ---
  const criticals = makeSection('Criticals');
  const critGrid = el('div', { className: 'grid-3' });
  ['fire', 'leak', 'steering', 'mast', 'officer'].forEach(key => {
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    critGrid.appendChild(createStepper({
      value: ship.criticals[key],
      min: 0, max: 20,
      onChange: v => ship.criticals[key] = v,
      label,
    }));
  });
  criticals.appendChild(critGrid);

  // --- Tab definitions ---
  const tabDefs = [
    { id: 'overview', label: 'Overview', sections: isNew ? [form.__templateSection, overview] : [overview] },
    { id: 'crew', label: 'Crew', sections: [captain, skills] },
    { id: 'stats', label: 'Stats', sections: [vitals, criticals] },
    { id: 'movement', label: 'Movement', sections: [movement] },
    { id: 'guns', label: 'Guns', sections: [guns] },
    { id: 'abilities', label: 'Abilities', sections: [abilities] },
  ];

  const activeTabId = form.dataset.activeTab || 'overview';
  const { container: tabbedContainer, activateTab, dots } = createTabbedLayout(tabDefs, activeTabId);

  form.appendChild(pointsDisplay);
  form.appendChild(tabbedContainer);

  // Persist active tab across rebuilds
  form.dataset.activeTab = activeTabId;

  // --- Validation: red dot on Overview when Name is empty ---
  const nameInput = overview.querySelector('input[type="text"]');
  const updateValidationDots = () => {
    const empty = !ship.name?.trim();
    if (dots.overview) dots.overview.classList.toggle('hidden', !empty);
  };
  if (nameInput) {
    nameInput.addEventListener('input', updateValidationDots);
  }
  updateValidationDots();

  // --- Done / Delete ---
  const bottomSection = el('div', { className: 'editor-bottom' });
  const doneBtn = el('button', { className: 'btn btn-primary', type: 'button' });
  doneBtn.textContent = 'Done';
  doneBtn.addEventListener('click', () => {
    if (!ship.name?.trim()) {
      activateTab('overview');
      form.dataset.activeTab = 'overview';
      const nameField = overview.querySelector('input[type="text"]');
      if (nameField) {
        nameField.focus();
        nameField.classList.add('input-error');
        setTimeout(() => nameField.classList.remove('input-error'), 1200);
      }
      showToast('Ship name is required', 'error');
      return;
    }
    ship.updatedAt = new Date().toISOString();
    saveShip(ship);
    location.hash = '#/ships';
  });
  const duplicateBtn = el('button', { className: 'btn btn-secondary', type: 'button' });
  duplicateBtn.textContent = 'Duplicate';
  duplicateBtn.addEventListener('click', async () => {
    const ok = await confirmDialog(
      `Duplicate "${ship.name || 'this ship'}"?`,
      { title: 'Duplicate Ship', confirmText: 'Duplicate' }
    );
    if (!ok) return;
    const copy = deepClone(ship);
    copy.id = uuid();
    copy.name = (ship.name || 'Untitled') + ' Copy';
    copy.createdAt = new Date().toISOString();
    copy.updatedAt = new Date().toISOString();
    saveShip(copy);
    showToast('Ship duplicated', 'success');
    location.hash = `#/ships/${copy.id}/edit`;
  });
  const deleteBtn = el('button', { className: 'btn btn-danger', type: 'button' });
  deleteBtn.textContent = 'Delete';
  deleteBtn.addEventListener('click', async () => {
    const ok = await confirmDialog(
      `Delete "${ship.name || 'this ship'}"? This cannot be undone.`,
      { title: 'Delete Ship', confirmText: 'Delete', danger: true }
    );
    if (ok) {
      deleteShip(ship.id);
      showToast('Ship deleted', 'success');
      location.hash = '#/ships';
    }
  });
  bottomSection.append(doneBtn, duplicateBtn, deleteBtn);
  form.appendChild(bottomSection);
}

function gunLabel(g) {
  return g.isCarronade ? g.type.replace(' carr.', '') + ' carronade' : g.type + ' long gun';
}

function renderGuns(container, ship, onChanged) {
  container.innerHTML = '';
  if (!ship.guns.length) {
    container.innerHTML = '<p class="text-muted text-small">No gun batteries. Click "Add Battery" to add one.</p>';
    return;
  }

  ship.guns.forEach((gun, idx) => {
    const row = el('div', { className: 'gun-battery-row' });

    // Count
    const countInput = el('input', { type: 'number', className: 'form-input', value: gun.count, min: 1, max: 100 });
    countInput.addEventListener('change', () => { gun.count = parseInt(countInput.value) || 1; onChanged?.(); });

    // Type select
    const typeSelect = el('select', { className: 'form-select' });
    typeSelect.innerHTML = GUN_TYPES.map(g =>
      `<option value="${g.type}" ${gun.type === g.type ? 'selected' : ''}>${gunLabel(g)}</option>`
    ).join('');
    typeSelect.addEventListener('change', () => {
      gun.type = typeSelect.value;
      const ref = GUN_TYPES.find(g => g.type === gun.type);
      if (ref) {
        gun.damage = ref.damage;
        gun.isCarronade = ref.isCarronade;
        gun.rangeShort = ref.short;
        gun.rangeMedium = ref.medium;
        gun.rangeLong = ref.long;
      }
      onChanged?.();
    });

    // Facing select
    const facingSelect = el('select', { className: 'form-select' });
    facingSelect.innerHTML = GUN_FACINGS.map(f =>
      `<option value="${f.id}" ${gun.facing === f.id ? 'selected' : ''}>${f.name}</option>`
    ).join('');
    facingSelect.addEventListener('change', () => { gun.facing = facingSelect.value; onChanged?.(); });

    // Remove button
    const removeBtn = el('button', { className: 'btn btn-ghost btn-sm', type: 'button', style: 'color:var(--red);font-size:1.1rem;background:transparent;padding:4px' });
    removeBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
    removeBtn.addEventListener('click', () => {
      ship.guns.splice(idx, 1);
      renderGuns(container, ship, onChanged);
      onChanged?.();
    });

    row.append(countInput, typeSelect, facingSelect, removeBtn);
    container.appendChild(row);
  });
}

function readFormIntoShip(form, ship) {
  // Most values are written directly via event handlers, but ensure any missed inputs get read
  // Broadside weight is handled via its input handler
}

// --- Tabbed Layout ---
function createTabbedLayout(tabDefs, activeTabId) {
  const wrapper = document.createDocumentFragment();
  const dots = {};  // tabId → dot element (for validation)

  // --- Tab bar (desktop) ---
  const tabBar = el('div', { className: 'editor-tabs' });
  const panels = [];
  const tabBtns = [];

  const activateTab = (id) => {
    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === id));
    panels.forEach(p => {
      const isTarget = p.dataset.panel === id;
      p.classList.toggle('active', isTarget);
      p.classList.toggle('expanded', isTarget);
    });
    // Persist for rebuilds
    const form = tabBar.closest('form');
    if (form) form.dataset.activeTab = id;
  };

  tabDefs.forEach(tab => {
    // Tab button
    const btn = el('button', { type: 'button', className: 'editor-tab' + (tab.id === activeTabId ? ' active' : '') });
    btn.dataset.tab = tab.id;
    const labelSpan = document.createElement('span');
    labelSpan.textContent = tab.label;
    const dot = el('span', { className: 'tab-dot hidden' });
    dots[tab.id] = dot;
    btn.append(labelSpan, dot);
    btn.addEventListener('click', () => activateTab(tab.id));
    tabBar.appendChild(btn);
    tabBtns.push(btn);

    // Panel
    const panel = el('div', { className: 'editor-panel' + (tab.id === activeTabId ? ' active expanded' : '') });
    panel.dataset.panel = tab.id;

    // Accordion header (mobile)
    const accHeader = el('button', { type: 'button', className: 'accordion-header' });
    const accLeft = el('span', { className: 'accordion-header-left' });
    const accLabel = document.createElement('span');
    accLabel.textContent = tab.label;
    const accDot = el('span', { className: 'tab-dot hidden' });
    // Share dot state: sync with tab dot
    const origDot = dot;
    const syncDots = () => { accDot.className = origDot.className; };
    // We'll use a MutationObserver to keep them in sync
    const observer = new MutationObserver(syncDots);
    observer.observe(origDot, { attributes: true, attributeFilter: ['class'] });
    accLeft.append(accLabel, accDot);
    const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chevron.setAttribute('width', '20');
    chevron.setAttribute('height', '20');
    chevron.setAttribute('viewBox', '0 0 24 24');
    chevron.setAttribute('fill', 'none');
    chevron.setAttribute('stroke', 'currentColor');
    chevron.setAttribute('stroke-width', '2');
    chevron.setAttribute('stroke-linecap', 'round');
    chevron.setAttribute('stroke-linejoin', 'round');
    chevron.classList.add('accordion-chevron');
    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('points', '6 9 12 15 18 9');
    chevron.appendChild(polyline);
    accHeader.append(accLeft, chevron);

    accHeader.addEventListener('click', () => {
      const isExpanded = panel.classList.contains('expanded');
      // Collapse all, then expand this one only if it wasn't already open
      panels.forEach(p => p.classList.remove('expanded'));
      if (!isExpanded) {
        panel.classList.add('expanded');
      }
      // Sync active tab state for desktop consistency
      tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tab.id));
      panels.forEach(p => p.classList.toggle('active', p.dataset.panel === tab.id));
      const form = tabBar.closest('form');
      if (form) form.dataset.activeTab = tab.id;
    });

    // Panel body
    const body = el('div', { className: 'editor-panel-body' });
    tab.sections.filter(Boolean).forEach(s => body.appendChild(s));

    panel.append(accHeader, body);
    panels.push(panel);
  });

  wrapper.appendChild(tabBar);
  panels.forEach(p => wrapper.appendChild(p));

  return { container: wrapper, activateTab, dots };
}

// --- Helpers ---
function el(tag, props = {}) {
  const elem = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'style' && typeof v === 'string') elem.setAttribute('style', v);
    else elem[k] = v;
  });
  return elem;
}

function makeSection(title) {
  const section = el('div', { className: 'form-section' });
  const titleEl = el('div', { className: 'form-section-title' });
  titleEl.textContent = title;
  section.appendChild(titleEl);
  return section;
}

function formGroup(label, inputEl) {
  const group = el('div', { className: 'form-group' });
  const lbl = el('label', { className: 'form-label' });
  lbl.textContent = label;
  group.appendChild(lbl);
  if (typeof inputEl === 'string') {
    const wrapper = el('div');
    wrapper.innerHTML = inputEl;
    group.appendChild(wrapper.firstElementChild || wrapper);
  } else {
    group.appendChild(inputEl);
  }
  return group;
}

function formRow(...items) {
  const row = el('div', { className: 'form-row' });
  items.forEach(item => row.appendChild(item));
  return row;
}

function input(type, value, onChange, placeholder = '') {
  const inp = el('input', {
    type,
    className: 'form-input',
    value: value ?? '',
    placeholder,
  });
  inp.addEventListener('input', () => onChange(inp.value));
  return inp;
}

function textarea(value, onChange, placeholder = '') {
  const ta = el('textarea', {
    className: 'form-textarea',
    value: value ?? '',
    placeholder,
  });
  ta.textContent = value ?? '';
  ta.addEventListener('input', () => onChange(ta.value));
  return ta;
}

function nationalitySelect(ship, form, isNew) {
  const select = el('select', { className: 'form-select' });
  select.innerHTML = NATIONALITIES.map(n =>
    `<option value="${n.id}" ${ship.nationality === n.id ? 'selected' : ''}>${n.name}</option>`
  ).join('');
  select.addEventListener('change', () => {
    ship.nationality = select.value;
    // Auto-fill skill defaults for new ships
    if (isNew) {
      const nat = NATIONALITIES.find(n => n.id === select.value);
      if (nat) {
        ship.skills = { command: nat.command, seamanship: nat.seamanship, gunnery: nat.gunnery, closeAction: nat.closeAction };
        buildForm(form, ship, isNew);
      }
    }
  });
  return select;
}
