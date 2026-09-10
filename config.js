const STORAGE_KEY = 'fs.menu.cfg.v3';

export const DEFAULTS = {
  // Aim
  aimbot: false,
  aimlock: false,
  aimFov: 25,
  aimSmooth: 0.8,
  aimlockSmooth: 0.1,
  aimlockSticky: true,
  aimHead: true,
  aimBone: 'head',
  aimDist: 120,
  aimPredict: true,
  aimPredictLead: 1,
  aimVisibleOnly: false,
  aimPriority: 'crosshair',
  aimKey: 'always',
  aimlockKey: 'always',
  triggerbot: false,
  triggerOnAds: false,
  triggerDelay: 80,
  triggerVisible: true,

  // Visuals
  esp: false,
  espBox: true,
  espCorner: true,
  espName: true,
  espHp: true,
  espHpText: true,
  espDist: true,
  espWeapon: true,
  espSnap: false,
  espOffscreen: true,
  espDistMax: 200,
  espColor: 'team',
  chams: false,
  chamsTeam: false,
  chamsColor: 'team',
  fovCircle: true,
  fovCircleLock: true,
  radar: true,
  radarSize: 110,

  // Misc
  godmode: false,
  infAmmo: false,
  noRecoil: false,
  rapidFire: false,
  ghostshot: false,
  infDash: false,
  autoBhop: false,
  automove: false,
  automoveStrength: 0.85,
  automoveRange: 14,
  rapidmove: false,
  rapidmoveStrength: 1.25,
  rapidmoveTurn: 1.35,
  rapidmoveAir: 1.45,
  thirdPerson: false,
  noclip: false,
  fly: false,
  flySpeed: 18,
  spinbot: false,
  spinSpeed: 10,
  customWeapon: false,
  customPlayer: false,
  customWeaponName: '',
  customPlayerName: '',
  vmScale: 1,
  vmPosX: 0,
  vmPosY: 0,
  vmPosZ: 0,
  vmRotX: 0,
  vmRotY: 0,
  vmRotZ: 0,
  pmScale: 1,
  pmPosX: 0,
  pmPosY: 0,
  pmPosZ: 0,
  pmRotX: 0,
  pmRotY: 0,
  pmRotZ: 0,
  speed: false,
  speedMult: 1.55,
  superJump: false,
  jumpBoost: 1.4,

  // UI
  panelX: 72,
  panelY: 72,
  panelOpacity: 0.94,
  activePreset: '',
  hkGod: 'F1',
  hkEsp: 'F2',
  hkAim: 'F3',
  hkLock: 'F5',
  hkSpeed: 'F4',
};

const CUSTOM_PRESET_KEY = 'fs.menu.preset.custom';
export const PRESET_FILE_KIND = 'fragtrainer-preset';
const PRESET_EXPORT_SKIP = new Set(['panelX', 'panelY']);

const FEATURE_KEYS = [
  'aimbot', 'aimlock', 'triggerbot', 'esp', 'chams', 'radar', 'fovCircle',
  'godmode', 'infAmmo', 'noRecoil', 'rapidFire', 'ghostshot', 'infDash', 'autoBhop',
  'thirdPerson', 'noclip', 'fly', 'spinbot', 'automove', 'rapidmove', 'speed', 'superJump',
  'customWeapon', 'customPlayer',
];

/** Vollständige Preset-Profile — überschreiben nur gelistete Keys. */
export const PRESETS = {
  legit: {
    label: 'Legit',
    desc: 'Dezenter Aim beim Zielen, minimales ESP',
    aimbot: true, aimlock: false,
    aimFov: 14, aimSmooth: 5.5, aimBone: 'body', aimDist: 90,
    aimPredict: true, aimVisibleOnly: true, aimPriority: 'crosshair', aimKey: 'aim',
    triggerbot: false, fovCircle: true, fovCircleLock: true,
    esp: true, espBox: true, espCorner: true, espName: false, espHp: true,
    espHpText: false, espDist: true, espWeapon: false, espSnap: false, espOffscreen: true,
    espDistMax: 120, radar: true, radarSize: 95, chams: false,
    godmode: false, noRecoil: false, speed: false,
  },
  rage: {
    label: 'Rage',
    desc: 'Aimlock + volle Visuals, maximale Aggression',
    aimbot: false, aimlock: true,
    aimFov: 65, aimlockSmooth: 0.06, aimlockSticky: true, aimBone: 'head',
    aimDist: 200, aimPredict: true, aimVisibleOnly: false, aimPriority: 'crosshair',
    aimlockKey: 'always', fovCircle: true, fovCircleLock: true,
    esp: true, espBox: true, espCorner: true, espName: true, espHp: true,
    espHpText: true, espDist: true, espWeapon: true, espSnap: true, espOffscreen: true,
    espDistMax: 250, radar: true, chams: true, chamsTeam: false,
    godmode: true, infAmmo: true, noRecoil: true, rapidFire: true, speed: true, speedMult: 1.65,
  },
  visuals: {
    label: 'Visuals',
    desc: 'Nur ESP, Radar & Chams — kein Aim',
    aimbot: false, aimlock: false, triggerbot: false, fovCircle: false,
    esp: true, espBox: true, espCorner: true, espName: true, espHp: true,
    espHpText: true, espDist: true, espWeapon: true, espSnap: false, espOffscreen: true,
    espDistMax: 200, radar: true, radarSize: 120, chams: true, chamsTeam: true,
    godmode: false, noRecoil: false, speed: false,
  },
  training: {
    label: 'Training',
    desc: 'Aimbot + Godmode zum Üben',
    aimbot: true, aimlock: false,
    aimFov: 32, aimSmooth: 2.2, aimBone: 'head', aimDist: 160,
    aimPredict: true, aimVisibleOnly: false, aimPriority: 'crosshair', aimKey: 'always',
    fovCircle: true, fovCircleLock: true,
    esp: true, espBox: true, espCorner: true, espName: true, espHp: true,
    espDist: true, radar: true, chams: false,
    godmode: true, infAmmo: true, noRecoil: true, infDash: true, autoBhop: true, automove: true, rapidmove: true,
  },
  trigger: {
    label: 'Trigger',
    desc: 'Automatisches Schießen bei Ziel im Fadenkreuz',
    aimbot: false, aimlock: false,
    triggerbot: true, triggerDelay: 95, triggerVisible: true, triggerOnAds: false,
    fovCircle: false,
    esp: true, espBox: true, espCorner: false, espName: false, espHp: false,
    espDist: true, espDistMax: 100, radar: true, radarSize: 85,
    godmode: false, noRecoil: false,
  },
  hvh: {
    label: 'HvH',
    desc: 'Sticky Aimlock, schnelle TTK, Anti-Recoil',
    aimbot: true, aimlock: true,
    aimFov: 55, aimSmooth: 1.2, aimlockSmooth: 0.04, aimlockSticky: true,
    aimBone: 'head', aimDist: 180, aimPredict: true, aimVisibleOnly: false,
    aimPriority: 'health', aimKey: 'always', aimlockKey: 'always',
    fovCircle: true, fovCircleLock: true,
    esp: true, espBox: true, espCorner: true, espName: true, espHp: true,
    espDist: true, radar: true, chams: true,
    godmode: false, noRecoil: true, rapidFire: true, infAmmo: true, speed: false,
  },
};

export const WEAPON_TRANSFORM_DEFAULTS = {
  vmScale: 1, vmPosX: 0, vmPosY: 0, vmPosZ: 0, vmRotX: 0, vmRotY: 0, vmRotZ: 0,
};

export const PLAYER_TRANSFORM_DEFAULTS = {
  pmScale: 1, pmPosX: 0, pmPosY: 0, pmPosZ: 0, pmRotX: 0, pmRotY: 0, pmRotZ: 0,
};

export function resetWeaponTransform(cfg) {
  Object.assign(cfg, WEAPON_TRANSFORM_DEFAULTS);
  saveConfig(cfg);
}

export function resetPlayerTransform(cfg) {
  Object.assign(cfg, PLAYER_TRANSFORM_DEFAULTS);
  saveConfig(cfg);
}

export function applyPreset(cfg, id) {
  if (id === 'custom') return loadCustomPreset(cfg);
  const preset = PRESETS[id];
  if (!preset) return false;
  for (const k of Object.keys(preset)) {
    if (k === 'label' || k === 'desc') continue;
    if (DEFAULTS[k] !== undefined) cfg[k] = preset[k];
  }
  cfg.activePreset = id;
  saveConfig(cfg);
  return true;
}

export function snapshotSettings(cfg) {
  const snap = {};
  for (const k of Object.keys(DEFAULTS)) snap[k] = cfg[k];
  return snap;
}

export function applySettingsSnapshot(cfg, snap) {
  if (!snap) return false;
  for (const k of Object.keys(DEFAULTS)) {
    if (snap[k] !== undefined) cfg[k] = snap[k];
  }
  return true;
}

export async function saveCustomPreset(cfg) {
  try {
    const { snapshotModelsForPreset } = await import('./customAssets.js');
    const models = await snapshotModelsForPreset(cfg);
    localStorage.setItem(CUSTOM_PRESET_KEY, JSON.stringify({
      savedAt: Date.now(),
      settings: snapshotSettings(cfg),
      models,
    }));
    cfg.activePreset = 'custom';
    saveConfig(cfg);
    return true;
  } catch (e) {
    return false;
  }
}

export async function loadCustomPreset(cfg) {
  try {
    const raw = localStorage.getItem(CUSTOM_PRESET_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || !data.settings) return false;
    applySettingsSnapshot(cfg, data.settings);
    const { restoreModelsFromPreset, syncCustomAssetState } = await import('./customAssets.js');
    await restoreModelsFromPreset(cfg);
    await syncCustomAssetState(cfg);
    cfg.activePreset = 'custom';
    saveConfig(cfg);
    return true;
  } catch (e) {
    return false;
  }
}

export function hasCustomPreset() {
  try { return !!localStorage.getItem(CUSTOM_PRESET_KEY); } catch (e) { return false; }
}

export function getCustomPresetMeta() {
  try {
    const raw = localStorage.getItem(CUSTOM_PRESET_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.savedAt) return null;
    const m = data.models || {};
    const parts = [];
    if (m.weapon) parts.push('Waffe');
    if (m.player) parts.push('Spieler');
    return { savedAt: data.savedAt, models: parts.join(' + ') || null };
  } catch (e) {
    return null;
  }
}

export function buildPresetExport(cfg, models) {
  const settings = snapshotSettings(cfg);
  for (const k of PRESET_EXPORT_SKIP) delete settings[k];
  return {
    kind: PRESET_FILE_KIND,
    version: 1,
    exportedAt: Date.now(),
    name: cfg.activePreset || 'custom',
    settings,
    models: models || { weapon: null, player: null },
  };
}

export function presetExportFilename(cfg) {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const name = String(cfg.activePreset || 'custom').replace(/[^a-z0-9_-]+/gi, '').toLowerCase();
  return `fragtrainer-${name || 'preset'}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`;
}

export function parsePresetPayload(data) {
  if (!data || typeof data !== 'object') return null;
  if (data.kind === PRESET_FILE_KIND && data.settings && typeof data.settings === 'object') {
    return { settings: data.settings, models: data.models || null, name: data.name || 'custom' };
  }
  if (data.settings && typeof data.settings === 'object') {
    return { settings: data.settings, models: data.models || null, name: data.name || 'custom' };
  }
  if ('aimbot' in data || 'esp' in data || 'godmode' in data || 'aimlock' in data) {
    return { settings: data, models: data.models || null, name: 'custom' };
  }
  return null;
}

export async function applyImportedPreset(cfg, data) {
  const parsed = parsePresetPayload(data);
  if (!parsed) return false;
  applySettingsSnapshot(cfg, parsed.settings);
  const { applyModelsFromExport, syncCustomAssetState } = await import('./customAssets.js');
  await applyModelsFromExport(parsed.models, cfg);
  await syncCustomAssetState(cfg);
  cfg.activePreset = 'custom';
  saveConfig(cfg);
  return saveCustomPreset(cfg);
}

export async function exportPresetPayload(cfg) {
  const { encodeModelsForExport } = await import('./customAssets.js');
  const models = await encodeModelsForExport(cfg);
  return buildPresetExport(cfg, models);
}

export function loadConfig() {
  const cfg = { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
      || localStorage.getItem('fs.menu.cfg.v2')
      || localStorage.getItem('fs.menu.cfg');
    if (!raw) return cfg;
    const saved = JSON.parse(raw);
    for (const k of Object.keys(DEFAULTS)) {
      if (saved[k] !== undefined) cfg[k] = saved[k];
    }
    if (saved.aimHead !== undefined && saved.aimBone === undefined) {
      cfg.aimBone = saved.aimHead ? 'head' : 'body';
    }
  } catch (e) { /* ignore */ }
  if (typeof cfg.aimFov === 'number') cfg.aimFov = Math.max(0, Math.min(100, cfg.aimFov));
  if (typeof cfg.aimSmooth === 'number') cfg.aimSmooth = Math.max(0, Math.min(20, cfg.aimSmooth));
  if (typeof cfg.aimlockSmooth === 'number') cfg.aimlockSmooth = Math.max(0, Math.min(5, cfg.aimlockSmooth));
  return cfg;
}

export function saveConfig(cfg) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch (e) { /* ignore */ }
}

export function resetConfig(cfg) {
  for (const k of Object.keys(DEFAULTS)) cfg[k] = DEFAULTS[k];
  saveConfig(cfg);
}

export function anyFeatureOn(cfg) {
  return FEATURE_KEYS.some((k) => !!cfg[k]);
}

export function countActiveFeatures(cfg) {
  let n = 0;
  for (const k of FEATURE_KEYS) if (cfg[k]) n++;
  return n;
}

export function toggleHotkey(cfg, code) {
  const map = {
    [cfg.hkGod]: 'godmode',
    [cfg.hkEsp]: 'esp',
    [cfg.hkAim]: 'aimbot',
    [cfg.hkLock]: 'aimlock',
    [cfg.hkSpeed]: 'speed',
  };
  const key = map[code];
  if (!key) return false;
  cfg[key] = !cfg[key];
  saveConfig(cfg);
  return key;
}
