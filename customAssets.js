import * as THREE from '../libs/three.module.js';

const DB_NAME = 'fs-menu-assets';
const STORE = 'models';

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

function attachWeapon(vm, group, scale) {
  if (!vm || !vm.root) return;
  wrapViewModel(vm);
  clearWeapon();
  weaponGroup = group.clone(true);
  normalizeGroup(weaponGroup, 0.45);
  weaponGroup.scale.multiplyScalar(scale || 1);
  weaponHolder = new THREE.Group();
  weaponHolder.add(weaponGroup);
  vm.root.add(weaponHolder);
  hideVmParts(vm);
}

function attachPlayer(model, group, scale) {
  if (!model || !model.pivot) return;
  clearPlayer();
  playerGroup = group.clone(true);
  normalizeGroup(playerGroup, 2.2);
  playerGroup.scale.multiplyScalar(scale || 1);
  playerHolder = new THREE.Group();
  playerHolder.add(playerGroup);
  model.pivot.add(playerHolder);
  hidePlayerParts(model);
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
  statusMsg = 'Waffe: ' + file.name;
  return pendingWeapon;
}

export async function uploadPlayerModel(file) {
  const group = await parseFile(file);
  await saveBlob('player', file, file.name);
  pendingPlayer = { group, name: file.name };
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
    if (!weaponHolder || weaponHolder.userData.scale !== cfg.vmScale) {
      attachWeapon(vm, pendingWeapon.group, cfg.vmScale || 1);
      if (weaponHolder) weaponHolder.userData.scale = cfg.vmScale;
    }
  } else if (!cfg.customWeapon) {
    clearWeapon();
  }

  if (cfg.customPlayer && pendingPlayer && model) {
    if (!playerHolder || playerHolder.userData.scale !== cfg.pmScale) {
      attachPlayer(model, pendingPlayer.group, cfg.pmScale || 1);
      if (playerHolder) playerHolder.userData.scale = cfg.pmScale;
    }
    model.setVisible(true);
    if (model.tag && model.tag.sprite) model.tag.sprite.visible = false;
  } else if (!cfg.customPlayer) {
    clearPlayer();
  }
}

export function setPendingWeapon(data) { pendingWeapon = data; }
export function setPendingPlayer(data) { pendingPlayer = data; }
export function getAssetStatus() { return statusMsg; }

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
