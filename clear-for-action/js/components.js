// ============================================
// Clear for Action! — Reusable UI Components
// ============================================

import { escapeHtml, clamp, sailIcon, windArrow } from './utils.js';

// --- Toast ---
export function showToast(message, type = 'info', duration = 2500) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toast-out 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

// --- Modal ---
export function showModal({ title, body, footer, onClose }) {
  const overlay = document.getElementById('modal-overlay');
  overlay.innerHTML = '';
  overlay.classList.remove('hidden');

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-header">
      <span class="modal-title">${escapeHtml(title)}</span>
      <button class="modal-close" aria-label="Close">&times;</button>
    </div>
    <div class="modal-body"></div>
    ${footer ? '<div class="modal-footer"></div>' : ''}
  `;

  const bodyEl = modal.querySelector('.modal-body');
  if (typeof body === 'string') bodyEl.innerHTML = body;
  else if (body instanceof HTMLElement) bodyEl.appendChild(body);

  if (footer) {
    const footerEl = modal.querySelector('.modal-footer');
    if (typeof footer === 'string') footerEl.innerHTML = footer;
    else if (footer instanceof HTMLElement) footerEl.appendChild(footer);
  }

  const close = () => {
    overlay.classList.add('hidden');
    overlay.innerHTML = '';
    onClose?.();
  };

  modal.querySelector('.modal-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  overlay.appendChild(modal);
  return { close, modal };
}

// --- Confirm Dialog ---
export function confirmDialog(message, { title = 'Confirm', confirmText = 'Confirm', cancelText = 'Cancel', danger = false } = {}) {
  return new Promise(resolve => {
    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.gap = '8px';
    footer.style.justifyContent = 'flex-end';
    footer.style.width = '100%';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = cancelText;

    const confirmBtn = document.createElement('button');
    confirmBtn.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;
    confirmBtn.textContent = confirmText;

    footer.appendChild(cancelBtn);
    footer.appendChild(confirmBtn);

    const { close } = showModal({
      title,
      body: `<p>${escapeHtml(message)}</p>`,
      footer,
    });

    cancelBtn.addEventListener('click', () => { close(); resolve(false); });
    confirmBtn.addEventListener('click', () => { close(); resolve(true); });
  });
}

// --- Stepper Component ---
export function createStepper({ value = 0, min = 0, max = 99, step = 1, onChange, label = '' }) {
  const wrapper = document.createElement('div');
  if (label) {
    const lbl = document.createElement('label');
    lbl.className = 'form-label';
    lbl.textContent = label;
    wrapper.appendChild(lbl);
  }

  const stepper = document.createElement('div');
  stepper.className = 'stepper';

  const minusBtn = document.createElement('button');
  minusBtn.className = 'stepper-btn';
  minusBtn.textContent = '\u2212';
  minusBtn.type = 'button';

  const valSpan = document.createElement('span');
  valSpan.className = 'stepper-value';
  valSpan.textContent = value;

  const plusBtn = document.createElement('button');
  plusBtn.className = 'stepper-btn';
  plusBtn.textContent = '+';
  plusBtn.type = 'button';

  let current = value;
  const update = (v) => {
    current = clamp(v, min, max);
    valSpan.textContent = current;
    onChange?.(current);
  };

  minusBtn.addEventListener('click', () => update(current - step));
  plusBtn.addEventListener('click', () => update(current + step));

  stepper.append(minusBtn, valSpan, plusBtn);
  wrapper.appendChild(stepper);

  wrapper.setValue = (v) => { current = v; valSpan.textContent = v; };
  wrapper.getValue = () => current;
  return wrapper;
}

// --- Health Bar ---
export function createHealthBar({ label, current, max, color = 'green', mini = false }) {
  const pct = max > 0 ? (current / max) * 100 : 0;
  const colorClass = pct > 66 ? 'green' : pct > 33 ? 'yellow' : 'red';

  if (mini) {
    return `<div class="health-bar health-bar-mini">
      <div class="health-bar-fill ${colorClass}" style="width:${pct}%"></div>
    </div>`;
  }

  return `<div class="health-bar-container">
    <div class="health-bar-label">
      <span>${escapeHtml(label)}</span>
      <span>${current}/${max}</span>
    </div>
    <div class="health-bar">
      <div class="health-bar-fill ${colorClass}" style="width:${pct}%"></div>
    </div>
  </div>`;
}

// --- Interactive Health Bar (for game view) ---
export function createInteractiveHealthBar({ label, current, max, vitalKey, color, onUpdate }) {
  const container = document.createElement('div');
  container.className = 'health-bar-container';

  const render = () => {
    const pct = max > 0 ? (current / max) * 100 : 0;
    const colorClass = pct > 66 ? 'green' : pct > 33 ? 'yellow' : 'red';
    container.innerHTML = `
      <div class="health-bar-label">
        <span>${escapeHtml(label)}</span>
        <span>${current}/${max}</span>
      </div>
      <div class="health-bar-interactive">
        <button class="health-btn" data-dir="-1">\u2212</button>
        <div class="health-bar-track">
          <div class="health-bar">
            <div class="health-bar-fill ${colorClass}" style="width:${pct}%"></div>
          </div>
        </div>
        <button class="health-btn" data-dir="1">+</button>
      </div>
    `;
    container.querySelectorAll('.health-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const dir = parseInt(btn.dataset.dir);
        current = clamp(current + dir, 0, max);
        onUpdate?.(vitalKey, current);
        render();
      });
    });
  };
  render();
  return container;
}

// --- Checkbox Row (for criticals) ---
export function createCheckboxRow({ label, total, checked = 0, onChange }) {
  const row = document.createElement('div');
  row.className = 'checkbox-row';

  const render = () => {
    row.innerHTML = `<span class="checkbox-row-label">${escapeHtml(label)}</span>
      <div class="checkbox-boxes">
        ${Array.from({ length: total }, (_, i) =>
          `<div class="checkbox-box ${i < checked ? 'checked' : ''}" data-idx="${i}">${i < checked ? '\u2717' : ''}</div>`
        ).join('')}
      </div>`;

    row.querySelectorAll('.checkbox-box').forEach(box => {
      box.addEventListener('click', () => {
        const idx = parseInt(box.dataset.idx);
        if (idx < checked) checked = idx;
        else checked = idx + 1;
        onChange?.(checked);
        render();
      });
    });
  };
  render();
  return row;
}

// --- Segmented Control ---
export function createSegmentedControl({ options, value, onChange }) {
  const control = document.createElement('div');
  control.className = 'segmented-control';

  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = `segmented-option ${opt.id === value ? 'active' : ''}`;
    btn.textContent = opt.name;
    btn.type = 'button';
    btn.addEventListener('click', () => {
      control.querySelectorAll('.segmented-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onChange?.(opt.id);
    });
    control.appendChild(btn);
  });

  return control;
}

// --- Chip Selector ---
export function createChipSelector({ options, selected = [], onChange }) {
  const group = document.createElement('div');
  group.className = 'chip-group';

  const render = () => {
    group.innerHTML = '';
    options.forEach(opt => {
      const chip = document.createElement('button');
      chip.className = `chip ${selected.includes(opt.id) ? 'selected' : ''}`;
      chip.type = 'button';
      chip.textContent = opt.name;
      chip.title = opt.effect || '';
      chip.addEventListener('click', () => {
        if (selected.includes(opt.id)) {
          selected = selected.filter(s => s !== opt.id);
        } else {
          selected = [...selected, opt.id];
        }
        onChange?.(selected);
        render();
      });
      group.appendChild(chip);
    });
  };
  render();

  group.setSelected = (s) => { selected = s; render(); };
  return group;
}

// --- Image Picker ---
export function createImagePicker({ currentImage, onImageChange, label = 'Image' }) {
  const container = document.createElement('div');
  container.className = 'image-picker';

  const preview = document.createElement('div');
  preview.className = 'image-preview';

  const controls = document.createElement('div');
  controls.className = 'image-picker-controls';

  const uploadBtn = document.createElement('button');
  uploadBtn.className = 'btn btn-secondary btn-sm';
  uploadBtn.textContent = 'Upload';
  uploadBtn.type = 'button';

  const removeBtn = document.createElement('button');
  removeBtn.className = 'btn btn-ghost btn-sm';
  removeBtn.type = 'button';
  removeBtn.style.cssText = 'color:var(--red);background:transparent;padding:4px';
  removeBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.style.display = 'none';

  const handleFile = async (file) => {
    if (!file) return;
    try {
      const { compressImage } = await import('./utils.js');
      const dataUrl = await compressImage(file, 600);
      currentImage = { type: 'dataUrl', data: dataUrl };
      onImageChange?.(currentImage);
      render();
    } catch {
      showToast('Failed to load image', 'error');
    }
  };

  const render = () => {
    if (currentImage?.data) {
      preview.innerHTML = `<img src="${currentImage.data}" alt="${label}">`;
      removeBtn.style.display = '';
    } else {
      preview.innerHTML = `<span class="placeholder-icon">\u{1F6A2}</span><span class="drop-hint">Drop image here</span>`;
      removeBtn.style.display = 'none';
    }
  };

  uploadBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => handleFile(fileInput.files?.[0]));

  // Drag & drop
  preview.addEventListener('dragover', (e) => { e.preventDefault(); preview.classList.add('drag-over'); });
  preview.addEventListener('dragleave', () => preview.classList.remove('drag-over'));
  preview.addEventListener('drop', (e) => {
    e.preventDefault();
    preview.classList.remove('drag-over');
    handleFile(e.dataTransfer.files?.[0]);
  });

  removeBtn.addEventListener('click', () => {
    currentImage = null;
    onImageChange?.(null);
    render();
  });

  controls.append(uploadBtn, removeBtn, fileInput);
  container.append(preview, controls);
  render();

  return container;
}

// --- Compass Picker (for wind direction) ---
export function createCompassPicker({ value, onChange }) {
  const directions = [
    ['NW', 'N', 'NE'],
    ['W',  '',  'E'],
    ['SW', 'S', 'SE'],
  ];

  const compass = document.createElement('div');
  compass.className = 'compass';

  directions.flat().forEach(dir => {
    if (!dir) {
      const center = document.createElement('div');
      center.className = 'compass-center';
      center.textContent = '\u{1F9ED}';
      compass.appendChild(center);
      return;
    }
    const btn = document.createElement('button');
    btn.className = `compass-btn ${dir === value ? 'active' : ''}`;
    btn.textContent = dir;
    btn.type = 'button';
    btn.addEventListener('click', () => {
      compass.querySelectorAll('.compass-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onChange?.(dir);
    });
    compass.appendChild(btn);
  });

  return compass;
}

// --- Toggle Switch ---
export function createToggle({ label, value = false, onChange }) {
  const toggle = document.createElement('div');
  toggle.className = `toggle ${value ? 'active' : ''}`;
  toggle.innerHTML = `
    <div class="toggle-track"><div class="toggle-thumb"></div></div>
    <span class="toggle-label">${escapeHtml(label)}</span>
  `;
  toggle.addEventListener('click', () => {
    value = !value;
    toggle.classList.toggle('active', value);
    onChange?.(value);
  });
  toggle.setValue = (v) => { value = v; toggle.classList.toggle('active', v); };
  return toggle;
}
