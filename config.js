const STORAGE_KEY = 'fs.menu.cfg.v2';

export const DEFAULTS = {
  // Aim
  aimbot: false,
  aimFov: 8,
  aimSmooth: 3,
  aimHead: true,
  aimBone: 'head',
  aimDist: 120,
  aimPredict: true,
  aimVisibleOnly: false,
  aimKey: 'always',
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
  radar: true,
  radarSize: 110,

  // Misc
  godmode: false,
  infAmmo: false,
  noRecoil: false,
  rapidFire: false,
  infDash: false,
  autoBhop: false,
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
  pmScale: 1,
  speed: false,
  speedMult: 1.55,
  superJump: false,
  jumpBoost: 1.4,

  // UI
  panelX: 72,
  panelY: 72,
  panelOpacity: 0.94,
  hkGod: 'F1',
  hkEsp: 'F2',
  hkAim: 'F3',
  hkSpeed: 'F4',
};

const FEATURE_KEYS = [
  'aimbot', 'triggerbot', 'esp', 'chams', 'radar', 'fovCircle',
  'godmode', 'infAmmo', 'noRecoil', 'rapidFire', 'infDash', 'autoBhop',
  'thirdPerson', 'noclip', 'fly', 'spinbot', 'speed', 'superJump',
  'customWeapon', 'customPlayer',
];

export function loadConfig() {
  const cfg = { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('fs.menu.cfg');
    if (!raw) return cfg;
    const saved = JSON.parse(raw);
    for (const k of Object.keys(DEFAULTS)) {
      if (saved[k] !== undefined) cfg[k] = saved[k];
    }
    if (saved.aimHead !== undefined && saved.aimBone === undefined) {
      cfg.aimBone = saved.aimHead ? 'head' : 'body';
    }
  } catch (e) { /* ignore */ }
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
    [cfg.hkSpeed]: 'speed',
  };
  const key = map[code];
  if (!key) return false;
  cfg[key] = !cfg[key];
  saveConfig(cfg);
  return key;
}
