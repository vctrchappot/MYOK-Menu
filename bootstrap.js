import { loadConfig, toggleHotkey, saveConfig, hasCustomPreset, loadCustomPreset } from './config.js';
import { discover, actorList } from './discover.js';
import { applyFeatures, requestTeleport, requestTeleportForward, setAimContext } from './features.js';
import {
  initCustomAssets, uploadWeapon, uploadPlayerModel,
  removeWeapon, removePlayerModel, getAssetStatus,
} from './customAssets.js';
import { createOverlay } from './overlay.js';

const cfg = loadConfig();

const overlay = createOverlay(cfg, {
  hotkey(code) { return toggleHotkey(cfg, code); },
  teleportTo(actor) { requestTeleport(actor); },
  teleportForward() { requestTeleportForward(); },
  async pickWeapon(file) {
    await uploadWeapon(file);
    cfg.customWeapon = true;
    cfg.customWeaponName = file.name;
    saveConfig(cfg);
    return getAssetStatus();
  },
  async pickPlayer(file) {
    await uploadPlayerModel(file);
    cfg.customPlayer = true;
    cfg.customPlayerName = file.name;
    saveConfig(cfg);
    return getAssetStatus();
  },
  async clearWeapon() {
    await removeWeapon();
    cfg.customWeapon = false;
    cfg.customWeaponName = '';
    saveConfig(cfg);
    return getAssetStatus();
  },
  async clearPlayer() {
    await removePlayerModel();
    cfg.customPlayer = false;
    cfg.customPlayerName = '';
    saveConfig(cfg);
    return getAssetStatus();
  },
});

initCustomAssets(cfg).then(async () => {
  if (cfg.activePreset === 'custom' && hasCustomPreset()) {
    await loadCustomPreset(cfg);
  }
  overlay.refreshAssetLabels(cfg);
});

let last = performance.now();

function loop(now) {
  requestAnimationFrame(loop);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.08) dt = 0.08;

  let found = null;
  let game = null;
  let info = { actors: 0, active: 0, rows: [] };

  try {
    found = discover(now);
    game = found && found.game;
    setAimContext({ cfg, menuOpen: overlay.open, game });
    info = applyFeatures(dt, {
      cfg,
      game,
      input: found && found.input,
      menuOpen: overlay.open,
      canvas: overlay.canvas,
    }) || info;
  } catch (err) {
    console.error('[FRAGTRAINER]', err);
  }

  const host = !!(window.__FRAGSTORM__ || window.__KRUNKER__);
  const inMatch = !!(game && game.running && game.world);

  overlay.frame({
    host,
    found: !!game,
    inMatch,
    source: found ? found.source : '',
    actors: info.actors || (game ? actorList(game).length : 0),
    active: info.active || 0,
    rows: info.rows || [],
  });
}

requestAnimationFrame(loop);
