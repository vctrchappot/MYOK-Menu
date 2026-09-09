import * as THREE from '../libs/three.module.js';

const DB_NAME = 'fs-menu-assets';
const STORE = 'models';
const PRESET_WEAPON = 'preset_weapon';
const PRESET_PLAYER = 'preset_player';
const DEG = Math.PI / 180;

let weaponGroup = null;
let playerGroup = null;
let weaponHolder = null;
let playerHolder = null;
let weaponHidden = [];
let playerHidden = [];
let statusMsg = '';
let loadersPromise = null;

async function getLoaders() {
  if (!loadersPromise) {
    loadersPromise = Promise.all([
      import('./loaders/GLTFLoader.js'),
      import('./loaders/OBJLoader.js'),
    ]).then(([{ GLTFLoader }, { OBJLoader }]) => ({
      gltf: new GLTFLoader(),
      obj: new OBJLoader(),
    })).catch((err) => {
      loadersPromise = null;
      throw err;
    });
  }
  return loadersPromise;
}

function ext(name) {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

function normalizeGroup(group, targetHeight) {
  const box = new THREE.Box3().setFromObject(group);
  if (box.isEmpty()) return group;
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);
  group.position.sub(center);
  const h = Math.max(size.y, size.x, size.z, 0.001);
  const s = targetHeight / h;
  group.scale.setScalar(s);
  return group;
}

function readWeaponTransform(cfg) {
  return {
    scale: cfg.vmScale ?? 1,
    px: cfg.vmPosX ?? 0,
    py: cfg.vmPosY ?? 0,
    pz: cfg.vmPosZ ?? 0,
    rx: cfg.vmRotX ?? 0,
    ry: cfg.vmRotY ?? 0,
    rz: cfg.vmRotZ ?? 0,
  };
}

function readPlayerTransform(cfg) {
  return {
    scale: cfg.pmScale ?? 1,
    px: cfg.pmPosX ?? 0,
    py: cfg.pmPosY ?? 0,
    pz: cfg.pmPosZ ?? 0,
    rx: cfg.pmRotX ?? 0,
    ry: cfg.pmRotY ?? 0,
    rz: cfg.pmRotZ ?? 0,
  };
}

function applyHolderTransform(holder, t) {
  if (!holder) return;
  holder.position.set(t.px, t.py, t.pz);
  holder.rotation.set(t.rx * DEG, t.ry * DEG, t.rz * DEG);
}

async function parseFile(file) {
  const e = ext(file.name);
  const { gltf, obj } = await getLoaders();
  if (e === 'obj') {
    const text = await file.text();
    return obj.parse(text);
  }
  if (e === 'glb' || e === 'gltf') {
    const buf = await file.arrayBuffer();
    return new Promise((resolve, reject) => {
      gltf.parse(buf, '', (data) => resolve(data.scene || data.scenes[0]), reject);
    });
  }
  throw new Error('Format: .obj, .glb oder .gltf');
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveBlob(key, blob, name) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ blob, name, at: Date.now() }, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function loadBlob(key) {
  const db = await openDb();
  const row = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return row;
}

async function deleteBlob(key) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

function hideVmParts(vm) {
  weaponHidden.length = 0;
  if (!vm) return;
  for (const part of [vm.mesh, vm.armR, vm.armL]) {
    if (part && part.visible) { part.visible = false; weaponHidden.push(part); }
  }
}

function restoreVmParts() {
  for (const p of weaponHidden) p.visible = true;
  weaponHidden.length = 0;
}

function hidePlayerParts(model) {
  playerHidden.length = 0;
  if (!model) return;
  const parts = [model.legL, model.legR, model.torso, model.head, model.armL, model.armR, model.weaponMesh];
  for (const p of parts) {
    if (p && p.visible) { p.visible = false; playerHidden.push(p); }
  }
  if (model.tag && model.tag.sprite) model.tag.sprite.visible = false;
}

function restorePlayerParts(model) {
  for (const p of playerHidden) p.visible = true;
  playerHidden.length = 0;
}

const wrappedVm = new WeakSet();

function wrapViewModel(vm) {
  if (!vm || wrappedVm.has(vm)) return;
  wrappedVm.add(vm);
  const orig = vm.setWeapon.bind(vm);
  vm.setWeapon = function(...args) {
    orig(...args);
    if (weaponHolder) hideVmParts(vm);
  };
}

function attachWeapon(vm, group, t) {
  if (!vm || !vm.root) return;
  wrapViewModel(vm);
  clearWeapon();
  weaponGroup = group.clone(true);
  normalizeGroup(weaponGroup, 0.45);
  weaponGroup.scale.multiplyScalar(t.scale || 1);
  weaponHolder = new THREE.Group();
  weaponHolder.userData.baseScale = t.scale;
  weaponHolder.add(weaponGroup);
  applyHolderTransform(weaponHolder, t);
  vm.root.add(weaponHolder);
  hideVmParts(vm);
}

function attachPlayer(model, group, t) {
  if (!model || !model.pivot) return;
  clearPlayer();
  playerGroup = group.clone(true);
  normalizeGroup(playerGroup, 2.2);
  playerGroup.scale.multiplyScalar(t.scale || 1);
  playerHolder = new THREE.Group();
  playerHolder.userData.baseScale = t.scale;
  playerHolder.add(playerGroup);
  applyHolderTransform(playerHolder, t);
  model.pivot.add(playerHolder);
  hidePlayerParts(model);
}

function updateWeaponTransform(cfg, vm) {
  const t = readWeaponTransform(cfg);
  if (!weaponHolder || weaponHolder.userData.baseScale !== t.scale) {
    if (pendingWeapon && vm) attachWeapon(vm, pendingWeapon.group, t);
    return;
  }
  applyHolderTransform(weaponHolder, t);
}

function allowModelClip(cfg) {
  return !!(cfg && (cfg.noclip || cfg.fly));
}

function clampPlayerModelToWorld(game, player, cfg) {
  if (!playerHolder || !playerGroup || !game || allowModelClip(cfg)) return;
  const world = game.world;
  const pos = player && player.pos;
  if (!world || !pos || typeof world.groundAt !== 'function') return;

  applyHolderTransform(playerHolder, readPlayerTransform(cfg));
  playerHolder.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(playerGroup);
  if (box.isEmpty()) return;

  const t = readPlayerTransform(cfg);
  let adjY = 0;
  let adjX = t.px;
  let adjZ = t.pz;

  const groundY = world.groundAt(pos.x, pos.z, pos.y + 8);
  if (typeof groundY === 'number') {
    const lift = (groundY + 0.04) - box.min.y;
    if (lift > 0) adjY = lift;
  }

  const bodyY = pos.y + (player.height || 2.2) * 0.45 + t.py;
  const offLen = Math.hypot(t.px, t.pz);
  if (offLen > 0.02 && typeof world.raycast === 'function') {
    const dx = t.px / offLen, dz = t.pz / offLen;
    const hit = world.raycast(pos.x, bodyY, pos.z, dx, 0, dz, offLen + 0.35);
    if (hit && hit.t < offLen + 0.1) {
      const allowed = Math.max(0, hit.t - 0.25);
      const s = allowed / offLen;
      adjX = t.px * s;
      adjZ = t.pz * s;
    }
  }

  playerHolder.position.set(adjX, t.py + adjY, adjZ);
  playerHolder.rotation.set(t.rx * DEG, t.ry * DEG, t.rz * DEG);
}

function updatePlayerTransform(cfg, model, game, player) {
  const t = readPlayerTransform(cfg);
  if (!playerHolder || playerHolder.userData.baseScale !== t.scale) {
    if (pendingPlayer && model) attachPlayer(model, pendingPlayer.group, t);
  } else {
    applyHolderTransform(playerHolder, t);
  }
  clampPlayerModelToWorld(game, player, cfg);
}

export function clearWeapon() {
  restoreVmParts();
  if (weaponHolder && weaponHolder.parent) weaponHolder.parent.remove(weaponHolder);
  weaponHolder = null;
  weaponGroup = null;
}

export function clearPlayer() {
  restorePlayerParts();
  if (playerHolder && playerHolder.parent) playerHolder.parent.remove(playerHolder);
  playerHolder = null;
  playerGroup = null;
}

export async function uploadWeapon(file) {
  const group = await parseFile(file);
  await saveBlob('weapon', file, file.name);
  pendingWeapon = { group, name: file.name };
  clearWeapon();
  statusMsg = 'Waffe: ' + file.name;
  return pendingWeapon;
}

export async function uploadPlayerModel(file) {
  const group = await parseFile(file);
  await saveBlob('player', file, file.name);
  pendingPlayer = { group, name: file.name };
  clearPlayer();
  statusMsg = 'Modell: ' + file.name;
  return pendingPlayer;
}

export async function removeWeapon() {
  await deleteBlob('weapon');
  clearWeapon();
  statusMsg = 'Waffe entfernt';
}

export async function removePlayerModel() {
  await deleteBlob('player');
  clearPlayer();
  statusMsg = 'Modell entfernt';
}

let pendingWeapon = null;
let pendingPlayer = null;

export async function loadWeaponFromStore() {
  const w = await loadBlob('weapon');
  if (!w) return null;
  const f = new File([w.blob], w.name);
  const group = await parseFile(f);
  pendingWeapon = { group, name: w.name };
  return pendingWeapon;
}

export async function loadPlayerFromStore() {
  const p = await loadBlob('player');
  if (!p) return null;
  const f = new File([p.blob], p.name);
  const group = await parseFile(f);
  pendingPlayer = { group, name: p.name };
  return pendingPlayer;
}

export function applyCustomAssets(game, player, cfg) {
  if (!game || !player) return;

  const vm = game.viewmodel;
  const model = player.model;

  if (cfg.customWeapon && pendingWeapon && vm) {
    updateWeaponTransform(cfg, vm);
  } else if (!cfg.customWeapon) {
    clearWeapon();
  }

  if (cfg.customPlayer && pendingPlayer && model) {
    updatePlayerTransform(cfg, model, game, player);
    model.setVisible(true);
    if (model.tag && model.tag.sprite) model.tag.sprite.visible = false;
  } else if (!cfg.customPlayer) {
    clearPlayer();
  }
}

export function setPendingWeapon(data) { pendingWeapon = data; }
export function setPendingPlayer(data) { pendingPlayer = data; }
export function getAssetStatus() { return statusMsg; }

async function copyBlobEntry(fromKey, toKey) {
  const row = await loadBlob(fromKey);
  if (row && row.blob) {
    await saveBlob(toKey, row.blob, row.name);
    return { name: row.name };
  }
  await deleteBlob(toKey);
  return null;
}

/** Modelle + Metadaten für Custom-Preset sichern. */
export async function snapshotModelsForPreset() {
  const weapon = await copyBlobEntry('weapon', PRESET_WEAPON);
  const player = await copyBlobEntry('player', PRESET_PLAYER);
  return {
    weapon: weapon ? { name: weapon.name } : null,
    player: player ? { name: player.name } : null,
  };
}

async function restoreWeaponFromPreset(enabled) {
  clearWeapon();
  pendingWeapon = null;
  if (!enabled) {
    await deleteBlob('weapon');
    return null;
  }
  const snap = await loadBlob(PRESET_WEAPON);
  if (!snap || !snap.blob) {
    await deleteBlob('weapon');
    return null;
  }
  await saveBlob('weapon', snap.blob, snap.name);
  return loadWeaponFromStore();
}

async function restorePlayerFromPreset(enabled) {
  clearPlayer();
  pendingPlayer = null;
  if (!enabled) {
    await deleteBlob('player');
    return null;
  }
  const snap = await loadBlob(PRESET_PLAYER);
  if (!snap || !snap.blob) {
    await deleteBlob('player');
    return null;
  }
  await saveBlob('player', snap.blob, snap.name);
  return loadPlayerFromStore();
}

/** Modelle aus Custom-Preset wiederherstellen (nach applySettingsSnapshot). */
export async function restoreModelsFromPreset(cfg) {
  try {
    if (cfg.customWeapon) {
      const w = await restoreWeaponFromPreset(true);
      if (w) cfg.customWeaponName = w.name;
      else { cfg.customWeapon = false; cfg.customWeaponName = ''; }
    } else {
      await restoreWeaponFromPreset(false);
    }

    if (cfg.customPlayer) {
      const p = await restorePlayerFromPreset(true);
      if (p) cfg.customPlayerName = p.name;
      else { cfg.customPlayer = false; cfg.customPlayerName = ''; }
    } else {
      await restorePlayerFromPreset(false);
    }
  } catch (e) {
    statusMsg = 'Preset-Modelle konnten nicht geladen werden';
  }
}

export async function initCustomAssets(cfg) {
  try {
    if (cfg.customWeapon) {
      const w = await loadWeaponFromStore();
      if (w) cfg.customWeaponName = w.name;
    } else {
      const w = await loadBlob('weapon');
      if (w) cfg.customWeaponName = w.name;
    }
    if (cfg.customPlayer) {
      const p = await loadPlayerFromStore();
      if (p) cfg.customPlayerName = p.name;
    } else {
      const p = await loadBlob('player');
      if (p) cfg.customPlayerName = p.name;
    }
  } catch (e) {
    statusMsg = 'Asset-Laden fehlgeschlagen';
  }
}
