import {
  saveConfig, resetConfig, anyFeatureOn, PRESETS, applyPreset,
  resetWeaponTransform, resetPlayerTransform,
  saveCustomPreset, loadCustomPreset, hasCustomPreset, getCustomPresetMeta,
} from './config.js';

const TABS = [
  { id: 'presets', label: 'Presets' },
  { id: 'aim', label: 'Aim' },
  { id: 'visuals', label: 'Visuals' },
  { id: 'misc', label: 'Misc' },
  { id: 'assets', label: 'Assets' },
  { id: 'list', label: 'Liste' },
];

export function createOverlay(cfg, hooks) {
  const state = {
    open: false,
    tab: 'presets',
    cursor: { x: cfg.panelX || 72, y: cfg.panelY || 72 },
    dragging: null,
    dragPanel: false,
    dragOff: { x: 0, y: 0 },
    onChange: null,
    rows: [],
  };

  injectCss();
  const root = document.createElement('div');
  root.id = 'fs-root';
  root.innerHTML = `
    <canvas id="fs-esp"></canvas>
    <div id="fs-watermark"></div>
    <div id="fs-panel">
      <div class="fs-head" id="fs-drag">
        <div class="fs-brand">
          <div class="fs-title">FRAG<span>TRAINER</span></div>
          <span class="fs-ver">v2</span>
        </div>
        <div class="fs-head-right">
          <span class="fs-badge idle" id="fs-badge">0 aktiv</span>
          <div class="fs-keys"><kbd>Insert</kbd><kbd>Home</kbd></div>
        </div>
      </div>
      <div class="fs-tabs"></div>
      <div class="fs-body">
        <div class="fs-page" data-page="presets"></div>
        <div class="fs-page" data-page="aim"></div>
        <div class="fs-page" data-page="visuals"></div>
        <div class="fs-page" data-page="misc"></div>
        <div class="fs-page" data-page="assets"></div>
        <div class="fs-page" data-page="list">
          <div class="fs-section">
            <div class="fs-section-title">Spieler</div>
            <p class="fs-list-hint">Klick = Teleport &amp; Ziel anvisieren</p>
            <div class="fs-list" id="fs-list"></div>
            <button class="fs-btn" id="fs-tp-fwd" type="button">8m vorwärts</button>
          </div>
        </div>
      </div>
      <div class="fs-statusbar bad" id="fs-statusbar">
        <span class="fs-dot"></span>
        <span class="fs-status" id="fs-status">Suche Game…</span>
      </div>
      <div class="fs-foot">
        <button class="fs-btn danger" id="fs-reset" type="button">Einstellungen zurücksetzen</button>
      </div>
    </div>
    <div id="fs-cursor"></div>
  `;
  document.body.appendChild(root);

  const panel = root.querySelector('#fs-panel');
  const tabsEl = root.querySelector('.fs-tabs');
  for (const t of TABS) {
    const b = document.createElement('button');
    b.className = 'fs-tab' + (t.id === state.tab ? ' on' : '');
    b.dataset.tab = t.id;
    b.textContent = t.label;
    b.addEventListener('click', () => setTab(t.id));
    tabsEl.appendChild(b);
  }

  fillPresets(root.querySelector('[data-page="presets"]'), cfg, onField, root);
  fillAim(root.querySelector('[data-page="aim"]'), cfg, onField);
  fillVisuals(root.querySelector('[data-page="visuals"]'), cfg, onField);
  fillMisc(root.querySelector('[data-page="misc"]'), cfg, onField);
  fillAssets(root.querySelector('[data-page="assets"]'), cfg, onField, hooks);
  setTab(state.tab);
  applyPanelPos(cfg);

  const canvas = root.querySelector('#fs-esp');
  const cursorEl = root.querySelector('#fs-cursor');
  const watermark = root.querySelector('#fs-watermark');
  const statusEl = root.querySelector('#fs-status');
  const statusBar = root.querySelector('#fs-statusbar');
  const badgeEl = root.querySelector('#fs-badge');
  const listEl = root.querySelector('#fs-list');
  const dragHead = root.querySelector('#fs-drag');

  function onField() {
    saveConfig(cfg);
    updateConditionalVisibility(root, cfg);
    if (state.onChange) state.onChange();
    syncWatermark();
    applyPanelOpacity(cfg);
  }

  function setTab(id) {
    state.tab = id;
    root.querySelectorAll('.fs-tab').forEach((el) => el.classList.toggle('on', el.dataset.tab === id));
    root.querySelectorAll('.fs-page').forEach((el) => el.classList.toggle('on', el.dataset.page === id));
  }

  function applyPanelPos(c) {
    panel.style.left = (c.panelX || 72) + 'px';
    panel.style.top = (c.panelY || 72) + 'px';
  }

  function applyPanelOpacity(c) {
    const a = c.panelOpacity || 0.94;
    panel.style.setProperty('--fs-bg', `rgba(12, 16, 24, ${a})`);
    panel.style.setProperty('--fs-bg-2', `rgba(20, 26, 38, ${Math.min(1, a + 0.02)})`);
  }

  function syncOpen() {
    root.classList.toggle('fs-open', state.open);
    root.classList.toggle('fs-locked', !!document.pointerLockElement);
    if (state.open) {
      state.cursor.x = clamp(state.cursor.x, 0, innerWidth);
      state.cursor.y = clamp(state.cursor.y, 0, innerHeight);
    }
    syncWatermark();
  }

  function syncWatermark() {
    const on = anyFeatureOn(cfg) && !state.open;
    watermark.textContent = on ? 'FRAGTRAINER  ·  INSERT / HOME' : '';
  }

  function toggle() {
    state.open = !state.open;
    syncOpen();
  }

  root.querySelector('#fs-reset').addEventListener('click', () => {
    resetConfig(cfg);
    refreshAllInputs(root, cfg);
    onField();
  });

  root.querySelector('#fs-tp-fwd').addEventListener('click', () => {
    hooks && hooks.teleportForward && hooks.teleportForward();
  });

  dragHead.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    state.dragPanel = true;
    state.dragOff.x = e.clientX - cfg.panelX;
    state.dragOff.y = e.clientY - cfg.panelY;
  });

  addEventListener('mousemove', (e) => {
    if (state.dragPanel) {
      cfg.panelX = clamp(e.clientX - state.dragOff.x, 0, innerWidth - 120);
      cfg.panelY = clamp(e.clientY - state.dragOff.y, 0, innerHeight - 80);
      applyPanelPos(cfg);
      saveConfig(cfg);
      return;
    }
    if (!state.open) return;
    if (document.pointerLockElement) {
      state.cursor.x = clamp(state.cursor.x + e.movementX, 0, innerWidth);
      state.cursor.y = clamp(state.cursor.y + e.movementY, 0, innerHeight);
      if (state.dragging) writeRange(state.dragging, state.cursor.x, cfg, onField);
    } else {
      state.cursor.x = e.clientX;
      state.cursor.y = e.clientY;
    }
  }, true);

  addEventListener('mouseup', () => {
    state.dragging = null;
    state.dragPanel = false;
  }, true);

  addEventListener('keydown', (e) => {
    if (e.code === 'Insert' || e.code === 'Home') {
      if (e.repeat) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      e.preventDefault();
      e.stopPropagation();
      toggle();
      return;
    }
    if (hooks && hooks.hotkey && hooks.hotkey(e.code)) {
      e.preventDefault();
      refreshAllInputs(root, cfg);
      onField();
    }
  }, true);

  addEventListener('mousedown', (e) => {
    if (!state.open || e.button !== 0) return;
    if (state.dragPanel) return;
    if (!document.pointerLockElement) {
      // Toggles/Slider/Select nutzen natives Label-Verhalten — kein softwareClick (sonst Doppel-Toggle)
      if (e.target.closest && (
        e.target.closest('.fs-toggle-row') ||
        e.target.closest('.fs-slider') ||
        e.target.closest('select')
      )) return;
      const el = e.target.closest && e.target.closest('#fs-panel');
      if (el) softwareClick(e.target, state, cfg, onField, setTab, hooks);
      return;
    }
    const el = hit(state.cursor.x, state.cursor.y, cursorEl);
    if (!el || !panel.contains(el)) return;
    e.preventDefault();
    e.stopPropagation();
    softwareClick(el, state, cfg, onField, setTab, hooks);
  }, true);

  addEventListener('resize', () => {
    state.cursor.x = clamp(state.cursor.x, 0, innerWidth);
    state.cursor.y = clamp(state.cursor.y, 0, innerHeight);
  });

  document.addEventListener('pointerlockchange', () => {
    root.classList.toggle('fs-locked', !!document.pointerLockElement);
  });

  function renderList(rows) {
    state.rows = rows || [];
    if (!listEl) return;
    if (!rows || !rows.length) {
      listEl.innerHTML = '<div class="fs-list-empty">Keine Akteure im Match</div>';
      return;
    }
    listEl.innerHTML = '';
    for (const r of rows) {
      const row = document.createElement('div');
      row.className = 'fs-list-row ' + (r.enemy ? 'enemy' : 'team');
      row.innerHTML = `
        <span class="fs-pill ${r.enemy ? 'enemy' : 'team'}">${r.enemy ? 'Feind' : 'Team'}</span>
        <span class="fs-list-name">${esc(r.name)}</span>
        <span class="fs-list-meta">${r.hp}/${r.maxHp}</span>
        <span class="fs-list-meta">${r.dist}m</span>
      `;
      row.addEventListener('click', () => {
        if (hooks && hooks.teleportTo) hooks.teleportTo(r.actor);
      });
      listEl.appendChild(row);
    }
  }

  function frame(info) {
    cursorEl.style.transform = `translate(${state.cursor.x}px, ${state.cursor.y}px)`;
    if (info && info.rows) renderList(info.rows);
    const active = info && info.active ? info.active : 0;
    if (badgeEl) {
      badgeEl.textContent = active + ' aktiv';
      badgeEl.classList.toggle('idle', active === 0);
    }
    if (info && info.inMatch) {
      statusBar.className = 'fs-statusbar ok';
      statusEl.textContent = `Verbunden · ${info.actors} Akteure`;
    } else if (info && info.found) {
      statusBar.className = 'fs-statusbar warn';
      statusEl.textContent = 'Spiel bereit — Match starten';
    } else if (info && info.host) {
      statusBar.className = 'fs-statusbar warn';
      statusEl.textContent = 'FRAGSTORM geladen — Play drücken';
    } else {
      statusBar.className = 'fs-statusbar bad';
      statusEl.textContent = 'FRAGSTORM nicht gefunden — Server aus fake-krunker-main starten';
    }
  }

  applyPanelOpacity(cfg);
  syncWatermark();
  updateConditionalVisibility(root, cfg);

  return {
    canvas,
    get open() { return state.open; },
    toggle,
    frame,
    setOnChange(fn) { state.onChange = fn; },
    refreshAssetLabels(cfg) { refreshAssetLabels(cfg, root.querySelector('[data-page="assets"]')); },
  };
}

function injectCss() {
  if (document.getElementById('fs-overlay-css')) return;
  const link = document.createElement('link');
  link.id = 'fs-overlay-css';
  link.rel = 'stylesheet';
  link.href = new URL('./overlay.css', import.meta.url).href;
  document.head.appendChild(link);
}

function section(title) {
  const el = document.createElement('div');
  el.className = 'fs-section';
  el.innerHTML = `<div class="fs-section-title">${title}</div>`;
  return el;
}

/** Abhängige UI nur anzeigen, wenn Parent-Toggle(s) aktiv sind. */
function markCond(el, cond) {
  if (!el || !cond) return el;
  if (cond.any) el.dataset.showAny = cond.any;
  if (cond.all) el.dataset.showAll = cond.all;
  return el;
}

function condVisible(cfg, el) {
  const any = el.dataset.showAny;
  const all = el.dataset.showAll;
  if (!any && !all) return true;
  if (any && !any.split(',').some((k) => cfg[k.trim()])) return false;
  if (all && !all.split(',').every((k) => cfg[k.trim()])) return false;
  return true;
}

function updateConditionalVisibility(root, cfg) {
  root.querySelectorAll('[data-show-any], [data-show-all]').forEach((el) => {
    el.classList.toggle('fs-hidden', !condVisible(cfg, el));
  });
  root.querySelectorAll('.fs-section').forEach((sec) => {
    const children = [...sec.children].filter((c) => !c.classList.contains('fs-section-title'));
    const anyVisible = children.some((c) => !c.classList.contains('fs-hidden'));
    sec.classList.toggle('fs-hidden', children.length > 0 && !anyVisible);
  });
}

function fillPresets(el, cfg, onField, root) {
  const intro = document.createElement('p');
  intro.className = 'fs-list-hint';
  intro.textContent = 'Schnellprofile laden — überschreibt Aim-, Visual- und Misc-Einstellungen.';
  el.appendChild(intro);

  const grid = document.createElement('div');
  grid.className = 'fs-preset-grid';
  grid.id = 'fs-preset-grid';

  function setActivePreset(id) {
    grid.querySelectorAll('.fs-preset-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.preset === id);
    });
    const customCard = el.querySelector('.fs-custom-preset');
    if (customCard) customCard.classList.toggle('active', id === 'custom');
  }

  for (const [id, p] of Object.entries(PRESETS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fs-preset-btn' + (cfg.activePreset === id ? ' active' : '');
    b.dataset.preset = id;
    b.innerHTML = `<strong>${p.label}</strong><span>${p.desc}</span>`;
    b.addEventListener('click', () => {
      applyPreset(cfg, id);
      refreshAllInputs(root, cfg);
      setActivePreset(id);
      onField();
    });
    grid.appendChild(b);
  }

  const custom = document.createElement('div');
  custom.className = 'fs-custom-preset' + (cfg.activePreset === 'custom' ? ' active' : '');
  custom.innerHTML = `
    <div class="fs-custom-head">
      <strong>Custom</strong>
      <span id="fs-custom-meta">${formatCustomMeta()}</span>
    </div>
    <p class="fs-list-hint">Eigene Einstellungen speichern, laden und verwenden.</p>
    <div class="fs-custom-actions"></div>
  `;
  const actions = custom.querySelector('.fs-custom-actions');
  actions.append(
    btn('Speichern', '', async () => {
      if (await saveCustomPreset(cfg)) {
        custom.querySelector('#fs-custom-meta').textContent = formatCustomMeta();
        setActivePreset('custom');
        onField();
      } else {
        alert('Custom-Preset konnte nicht gespeichert werden.');
      }
    }),
    btn('Laden', '', () => { applyCustomPreset(); }),
    btn('Verwenden', 'primary', () => { applyCustomPreset(); }),
  );
  grid.appendChild(custom);
  el.appendChild(grid);

  function formatCustomMeta() {
    if (!hasCustomPreset()) return 'Noch nicht gespeichert';
    const meta = getCustomPresetMeta();
    if (!meta || !meta.savedAt) return 'Gespeichert';
    let s = new Date(meta.savedAt).toLocaleString('de-DE');
    if (meta.models) s += ' · ' + meta.models;
    return s;
  }

  async function applyCustomPreset() {
    if (!(await loadCustomPreset(cfg))) {
      alert('Noch kein Custom-Preset gespeichert.');
      return false;
    }
    refreshAllInputs(root, cfg);
    refreshAssetLabels(cfg, root.querySelector('[data-page="assets"]'));
    custom.querySelector('#fs-custom-meta').textContent = formatCustomMeta();
    setActivePreset('custom');
    onField();
    return true;
  }

  const hint = document.createElement('p');
  hint.className = 'fs-list-hint';
  hint.innerHTML = '<b>Aimbot</b> = sanftes Zielen · <b>Aimlock</b> = hartes Sticky-Tracking (wie in den meisten Cheats)';
  el.appendChild(hint);
}

function aimKeySelect(key, label, cfg, onField) {
  return select(key, label, cfg, onField, [
    ['always', 'Immer'],
    ['aim', 'Aim (RMB)'],
    ['fire', 'Feuer (LMB)'],
  ]);
}

function fillAim(el, cfg, onField) {
  const aimOn = { any: 'aimbot,aimlock' };
  const anyAim = { any: 'aimbot,aimlock,triggerbot' };

  const shared = markCond(section('Gemeinsam'), anyAim);
  shared.append(
    markCond(slider('aimFov', 'FOV-Radius', cfg, onField, 0, 100, 1), anyAim),
    markCond(slider('aimDist', 'Max-Distanz', cfg, onField, 20, 250, 5), aimOn),
    markCond(select('aimBone', 'Zielpunkt', cfg, onField, [['head', 'Kopf'], ['body', 'Körper']]), aimOn),
    markCond(select('aimPriority', 'Priorität', cfg, onField, [
      ['crosshair', 'Nächstes zum Fadenkreuz'],
      ['distance', 'Nächster Gegner'],
      ['health', 'Niedrigste HP'],
    ]), aimOn),
    markCond(check('aimPredict', 'Bewegungs-Prediction', cfg, onField), aimOn),
    markCond(check('aimVisibleOnly', 'Nur sichtbare Ziele (LOS)', cfg, onField), aimOn),
    markCond(check('fovCircle', 'FOV-Kreis anzeigen', cfg, onField), anyAim),
    markCond(check('fovCircleLock', 'Lock-Linie zum Ziel', cfg, onField), { all: 'fovCircle', any: 'aimbot,aimlock' }),
  );

  const aim = section('Aimbot — Smooth Assist');
  const aimHint = markCond(document.createElement('p'), { any: 'aimbot' });
  aimHint.className = 'fs-list-hint';
  aimHint.textContent = 'Sanftes Nachziehen zum Ziel. Typisch mit Smooth 2–8 für legit, 0–1 für semi-rage.';
  aim.append(
    check('aimbot', 'Aimbot', cfg, onField),
    aimHint,
    markCond(slider('aimSmooth', 'Smooth', cfg, onField, 0, 20, 0.5), { any: 'aimbot' }),
    markCond(aimKeySelect('aimKey', 'Aimbot-Taste', cfg, onField), { any: 'aimbot' }),
  );

  const lock = section('Aimlock — Sticky Track');
  const lockHint = markCond(document.createElement('p'), { any: 'aimlock' });
  lockHint.className = 'fs-list-hint';
  lockHint.textContent = 'Hält das Ziel konstant im Visier (Sticky Lock). Smooth 0 = Snap, 0.05–0.2 = harter Lock.';
  lock.append(
    check('aimlock', 'Aimlock', cfg, onField),
    lockHint,
    markCond(slider('aimlockSmooth', 'Lock-Stärke', cfg, onField, 0, 5, 0.05), { any: 'aimlock' }),
    markCond(check('aimlockSticky', 'Sticky Target (am Ziel bleiben)', cfg, onField), { any: 'aimlock' }),
    markCond(aimKeySelect('aimlockKey', 'Aimlock-Taste', cfg, onField), { any: 'aimlock' }),
  );

  const trig = section('Triggerbot');
  trig.append(
    check('triggerbot', 'Triggerbot', cfg, onField),
    markCond(slider('triggerDelay', 'Delay ms', cfg, onField, 0, 300, 10), { any: 'triggerbot' }),
    markCond(check('triggerVisible', 'LOS-Check', cfg, onField), { any: 'triggerbot' }),
    markCond(check('triggerOnAds', 'Nur bei ADS', cfg, onField), { any: 'triggerbot' }),
  );
  el.append(shared, aim, lock, trig);
}

function fillVisuals(el, cfg, onField) {
  const espOn = { any: 'esp' };
  const esp = section('ESP');
  esp.append(
    check('esp', 'ESP', cfg, onField),
    markCond(check('espBox', 'Box', cfg, onField), espOn),
    markCond(check('espCorner', 'Corner-Box', cfg, onField), espOn),
    markCond(check('espName', 'Name', cfg, onField), espOn),
    markCond(check('espHp', 'HP-Balken', cfg, onField), espOn),
    markCond(check('espHpText', 'HP-Zahl', cfg, onField), espOn),
    markCond(check('espDist', 'Distanz', cfg, onField), espOn),
    markCond(check('espWeapon', 'Waffe', cfg, onField), espOn),
    markCond(check('espSnap', 'Snaplines', cfg, onField), espOn),
    markCond(check('espOffscreen', 'Offscreen-Pfeile', cfg, onField), espOn),
    markCond(slider('espDistMax', 'Max-Distanz', cfg, onField, 30, 400, 10), espOn),
    markCond(select('espColor', 'Farbe', cfg, onField, [
      ['team', 'Team'], ['red', 'Rot'], ['blue', 'Blau'], ['lime', 'Lime'], ['cyan', 'Cyan'],
    ]), espOn),
    check('radar', 'Radar', cfg, onField),
    markCond(slider('radarSize', 'Radar-Größe', cfg, onField, 70, 160, 5), { any: 'radar' }),
  );
  const ch = section('Chams');
  ch.append(
    check('chams', 'Chams / Wallhack', cfg, onField),
    markCond(check('chamsTeam', 'Auch Teammates', cfg, onField), { any: 'chams' }),
    markCond(select('chamsColor', 'Chams-Farbe', cfg, onField, [
      ['team', 'Team'], ['red', 'Rot'], ['blue', 'Blau'], ['lime', 'Lime'], ['cyan', 'Cyan'],
    ]), { any: 'chams' }),
  );
  el.append(esp, ch);
}

function fillMisc(el, cfg, onField) {
  const combat = section('Kampf');
  combat.append(
    check('godmode', 'Godmode', cfg, onField),
    check('infAmmo', 'Unendlich Munition', cfg, onField),
    check('noRecoil', 'No Recoil / Spread', cfg, onField),
    check('rapidFire', 'Rapid Fire', cfg, onField),
    check('ghostshot', 'Ghostshot (durch Wände)', cfg, onField),
  );
  const move = section('Bewegung');
  move.append(
    check('speed', 'Speedhack', cfg, onField),
    markCond(slider('speedMult', 'Speed', cfg, onField, 1, 3, 0.05), { any: 'speed' }),
    check('superJump', 'Super-Jump', cfg, onField),
    markCond(slider('jumpBoost', 'Jump', cfg, onField, 1, 2.4, 0.05), { any: 'superJump' }),
    check('infDash', 'Infinite Dash', cfg, onField),
    check('autoBhop', 'Auto-Bhop', cfg, onField),
    check('noclip', 'NoClip', cfg, onField),
    markCond(slider('flySpeed', 'NoClip-Speed', cfg, onField, 6, 40, 1), { any: 'noclip,fly' }),
    check('thirdPerson', 'Third Person', cfg, onField),
    check('spinbot', 'Spinbot', cfg, onField),
    markCond(slider('spinSpeed', 'Spin-Geschw.', cfg, onField, 2, 30, 0.5), { any: 'spinbot' }),
  );
  const ui = section('UI / Hotkeys');
  ui.append(
    slider('panelOpacity', 'Menü-Opacity', cfg, onField, 0.6, 1, 0.02),
    select('hkGod', 'Hotkey God', cfg, onField, hotkeyOpts(), cfg.hkGod),
    select('hkEsp', 'Hotkey ESP', cfg, onField, hotkeyOpts(), cfg.hkEsp),
    select('hkAim', 'Hotkey Aimbot', cfg, onField, hotkeyOpts(), cfg.hkAim),
    select('hkLock', 'Hotkey Aimlock', cfg, onField, hotkeyOpts(), cfg.hkLock),
    select('hkSpeed', 'Hotkey Speed', cfg, onField, hotkeyOpts(), cfg.hkSpeed),
  );
  el.append(combat, move, ui);
}

function transformSliders(prefix, cfg, onField, opts) {
  const { scaleMin, scaleMax, posMin, posMax, posStep, rotMin, rotMax, showWhen } = opts;
  const wrap = document.createElement('div');
  wrap.className = 'fs-transform-group';
  if (showWhen) markCond(wrap, showWhen);
  wrap.append(
    slider(prefix + 'Scale', 'Größe', cfg, onField, scaleMin, scaleMax, 0.05),
  );
  const pos = document.createElement('div');
  pos.className = 'fs-subsection';
  pos.innerHTML = '<div class="fs-subsection-title">Position (X / Y / Z)</div>';
  pos.append(
    slider(prefix + 'PosX', 'Pos X', cfg, onField, posMin, posMax, posStep),
    slider(prefix + 'PosY', 'Pos Y', cfg, onField, posMin, posMax, posStep),
    slider(prefix + 'PosZ', 'Pos Z', cfg, onField, posMin, posMax, posStep),
  );
  const rot = document.createElement('div');
  rot.className = 'fs-subsection';
  rot.innerHTML = '<div class="fs-subsection-title">Rotation (Grad)</div>';
  rot.append(
    slider(prefix + 'RotX', 'Rot X (Pitch)', cfg, onField, rotMin, rotMax, 1),
    slider(prefix + 'RotY', 'Rot Y (Yaw)', cfg, onField, rotMin, rotMax, 1),
    slider(prefix + 'RotZ', 'Rot Z (Roll)', cfg, onField, rotMin, rotMax, 1),
  );
  wrap.append(pos, rot);
  return wrap;
}

function fillAssets(el, cfg, onField, hooks) {
  const wpn = section('Custom-Waffe (nur du)');
  wpn.append(
    fileRow('weapon-file', 'Waffe hochladen', '.obj,.glb,.gltf'),
    labelRow('customWeaponName', cfg.customWeaponName || 'Keine Datei'),
    check('customWeapon', 'Custom-Waffe an', cfg, onField),
    transformSliders('vm', cfg, onField, {
      scaleMin: 0.2, scaleMax: 3, posMin: -0.8, posMax: 0.8, posStep: 0.01, rotMin: -180, rotMax: 180,
      showWhen: { any: 'customWeapon' },
    }),
    markCond(btn('Transform zurücksetzen', '', () => {
      resetWeaponTransform(cfg);
      refreshAllInputs(el.closest('#fs-root'), cfg);
      onField();
    }), { any: 'customWeapon' }),
    btn('Waffe entfernen', 'danger', async () => {
      if (hooks && hooks.clearWeapon) await hooks.clearWeapon();
      cfg.customWeapon = false;
      refreshAssetLabels(cfg, el);
      onField();
    }),
  );
  const ply = section('Custom-Spieler (nur du)');
  ply.append(
    fileRow('player-file', 'Modell hochladen', '.obj,.glb,.gltf'),
    labelRow('customPlayerName', cfg.customPlayerName || 'Keine Datei'),
    check('customPlayer', 'Custom-Modell an', cfg, onField),
    transformSliders('pm', cfg, onField, {
      scaleMin: 0.2, scaleMax: 3, posMin: -2, posMax: 2, posStep: 0.02, rotMin: -180, rotMax: 180,
      showWhen: { any: 'customPlayer' },
    }),
    markCond(btn('Transform zurücksetzen', '', () => {
      resetPlayerTransform(cfg);
      refreshAllInputs(el.closest('#fs-root'), cfg);
      onField();
    }), { any: 'customPlayer' }),
    btn('Modell entfernen', 'danger', async () => {
      if (hooks && hooks.clearPlayer) await hooks.clearPlayer();
      cfg.customPlayer = false;
      refreshAssetLabels(cfg, el);
      onField();
    }),
  );
  const hint = document.createElement('p');
  hint.className = 'fs-list-hint';
  hint.textContent = 'Größe, Position und Rotation live anpassbar. Spielermodelle brauchen Third Person. Formate: OBJ, GLB, GLTF.';
  el.append(hint, wpn, ply);

  el.querySelector('#weapon-file').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f || !hooks || !hooks.pickWeapon) return;
    try {
      await hooks.pickWeapon(f);
      cfg.customWeapon = true;
      cfg.customWeaponName = f.name;
      refreshAssetLabels(cfg, el);
      onField();
    } catch (err) {
      alert('Waffe konnte nicht geladen werden: ' + (err.message || err));
    }
    e.target.value = '';
  });
  el.querySelector('#player-file').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f || !hooks || !hooks.pickPlayer) return;
    try {
      await hooks.pickPlayer(f);
      cfg.customPlayer = true;
      cfg.customPlayerName = f.name;
      refreshAssetLabels(cfg, el);
      onField();
    } catch (err) {
      alert('Modell konnte nicht geladen werden: ' + (err.message || err));
    }
    e.target.value = '';
  });
}

function fileRow(id, label, accept) {
  const row = document.createElement('div');
  row.className = 'fs-file-row';
  row.innerHTML = `<span class="fs-label">${label}</span>`;
  const input = document.createElement('input');
  input.type = 'file';
  input.id = id;
  input.className = 'fs-file';
  input.accept = accept;
  row.appendChild(input);
  return row;
}

function labelRow(key, text) {
  const row = document.createElement('div');
  row.className = 'fs-asset-name';
  row.dataset.assetKey = key;
  row.textContent = text;
  return row;
}

function btn(text, kind, fn) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'fs-btn' + (kind ? ' ' + kind : '');
  b.textContent = text;
  b.addEventListener('click', fn);
  return b;
}

function refreshAssetLabels(cfg, root) {
  const page = root || document;
  const w = page.querySelector('[data-asset-key="customWeaponName"]');
  const p = page.querySelector('[data-asset-key="customPlayerName"]');
  if (w) w.textContent = cfg.customWeaponName || 'Keine Datei';
  if (p) p.textContent = cfg.customPlayerName || 'Keine Datei';
}

function hotkeyOpts() {
  return ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12']
    .map((k) => [k, k]);
}

function syncToggleRow(input) {
  const row = input.closest('.fs-toggle-row');
  if (row) row.classList.toggle('on', input.checked);
}

function check(key, label, cfg, onField) {
  const row = document.createElement('label');
  row.className = 'fs-row fs-toggle-row' + (cfg[key] ? ' on' : '');
  row.innerHTML = `<span class="fs-label">${label}</span>`;

  const wrap = document.createElement('span');
  wrap.className = 'fs-switch';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.className = 'fs-check';
  input.dataset.key = key;
  input.checked = !!cfg[key];

  const track = document.createElement('span');
  track.className = 'fs-switch-track';
  track.innerHTML = '<span class="fs-switch-thumb"></span>';

  wrap.append(input, track);
  row.appendChild(wrap);

  input.addEventListener('change', () => {
    cfg[key] = input.checked;
    syncToggleRow(input);
    onField();
  });
  return row;
}

function slider(key, label, cfg, onField, min, max, step) {
  const block = document.createElement('div');
  block.className = 'fs-slide-block';
  const head = document.createElement('div');
  head.className = 'fs-slide-head';
  const cap = document.createElement('span');
  cap.className = 'fs-label';
  cap.textContent = label;
  const val = document.createElement('span');
  val.className = 'fs-val';
  val.textContent = fmt(cfg[key]);
  head.append(cap, val);
  const track = document.createElement('div');
  track.className = 'fs-slide-track';
  const input = document.createElement('input');
  input.type = 'range';
  input.className = 'fs-slider';
  input.dataset.key = key;
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(cfg[key]);
  input.addEventListener('input', () => {
    cfg[key] = parseFloat(input.value);
    val.textContent = fmt(cfg[key]);
    onField();
  });
  track.appendChild(input);
  block.append(head, track);
  return block;
}

function select(key, label, cfg, onField, options, selected) {
  const row = document.createElement('label');
  row.className = 'fs-row';
  row.innerHTML = `<span class="fs-label">${label}</span>`;
  const input = document.createElement('select');
  input.className = 'fs-select';
  input.dataset.key = key;
  for (const [v, t] of options) {
    const o = document.createElement('option');
    o.value = v; o.textContent = t;
    if ((selected || cfg[key]) === v) o.selected = true;
    input.appendChild(o);
  }
  input.addEventListener('change', () => { cfg[key] = input.value; onField(); });
  row.appendChild(input);
  return row;
}

function refreshAllInputs(root, cfg) {
  root.querySelectorAll('[data-key]').forEach((el) => {
    const k = el.dataset.key;
    if (el.type === 'checkbox') {
      el.checked = !!cfg[k];
      syncToggleRow(el);
    } else if (el.type === 'range') {
      el.value = String(cfg[k]);
      const val = el.closest('.fs-slide-block') && el.closest('.fs-slide-block').querySelector('.fs-val');
      if (val) val.textContent = fmt(cfg[k]);
    } else if (el.tagName === 'SELECT') {
      el.value = cfg[k];
    }
  });
  updateConditionalVisibility(root, cfg);
}

function hit(x, y, cursorEl) {
  cursorEl.style.display = 'none';
  const el = document.elementFromPoint(x, y);
  cursorEl.style.display = '';
  return el;
}

function softwareClick(el, state, cfg, onField, setTab, hooks) {
  const btn = el.closest && el.closest('.fs-btn');
  if (btn) { btn.click(); return; }

  const listRow = el.closest && el.closest('.fs-list-row');
  if (listRow) { listRow.click(); return; }

  const tab = el.closest && el.closest('.fs-tab');
  if (tab) { setTab(tab.dataset.tab); return; }

  const range = el.classList && el.classList.contains('fs-slider') ? el
    : (el.closest && (el.closest('.fs-slider') || el.closest('.fs-slide-track')));
  const rangeInput = range && (range.classList && range.classList.contains('fs-slider') ? range : range.querySelector && range.querySelector('.fs-slider'));
  if (rangeInput && rangeInput.type === 'range') {
    state.dragging = rangeInput;
    const r = rangeInput.getBoundingClientRect();
    writeRange(rangeInput, document.pointerLockElement ? state.cursor.x : r.left + r.width * 0.5, cfg, onField);
    return;
  }

  const toggleRow = el.closest && el.closest('.fs-toggle-row');
  const box = (el.classList && el.classList.contains('fs-check') ? el : null)
    || (toggleRow && toggleRow.querySelector('.fs-check'))
    || (el.closest && el.closest('.fs-switch') && el.closest('.fs-switch').querySelector('.fs-check'));
  if (box) {
    box.checked = !box.checked;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  const sel = el.tagName === 'SELECT' ? el : (el.closest && el.closest('select'));
  if (sel) {
    const i = sel.selectedIndex;
    sel.selectedIndex = (i + 1) % sel.options.length;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function writeRange(input, clientX, cfg, onField) {
  const r = input.getBoundingClientRect();
  const t = clamp((clientX - r.left) / Math.max(1, r.width), 0, 1);
  const min = parseFloat(input.min), max = parseFloat(input.max);
  const step = parseFloat(input.step) || 0.01;
  let v = min + t * (max - min);
  v = Math.round(v / step) * step;
  input.value = String(v);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function fmt(v) {
  if (typeof v !== 'number') return String(v);
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
