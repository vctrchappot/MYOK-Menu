import * as THREE from '../libs/three.module.js';

const DB_NAME = 'fs-menu-assets';
const STORE = 'models';
const PRESET_WEAPON = 'preset_weapon';
const PRESET_PLAYER = 'preset_player';
const DEG = Math.PI / 180;
const VM_SCALE = 0.53;
const WEAPON_LOCAL_HEIGHT = 0.45 / VM_SCALE;

let weaponGroup = null;
let playerGroup = null;
let weaponHolder = null;
let playerHolder = null;
let worldWeaponHolder = null;
let weaponHidden = [];
let playerHidden = [];
let playerMixer = null;
let attachedPlayerPivot = null;
let attachedCharModel = null;
let statusMsg = '';
let loadersPromise = null;
let lastWeaponTransform = readWeaponTransform({});
const wrappedCharModels = new WeakSet();

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

function maybeFixUpAxis(group) {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  if (box.isEmpty()) return;
  const size = new THREE.Vector3();
  box.getSize(size);
  if (size.z > size.y * 1.22 && size.z > 0.02) {
    group.rotation.x -= Math.PI / 2;
    group.updateMatrixWorld(true);
  }
}

function normalizeGroup(group, targetHeight, opts) {
  const feet = !!(opts && opts.feet);
  const fixUp = !opts || opts.fixUp !== false;
  if (fixUp) maybeFixUpAxis(group);
  group.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(group);
  if (box.isEmpty()) return group;
  const size = new THREE.Vector3();
  box.getSize(size);
  const h = feet ? Math.max(size.y, 0.001) : Math.max(size.y, size.x, size.z, 0.001);
  group.scale.multiplyScalar(targetHeight / h);
  group.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(group);
  if (box.isEmpty()) return group;
  const center = new THREE.Vector3();
  box.getCenter(center);
  group.position.x -= center.x;
  group.position.z -= center.z;
  group.position.y -= feet ? box.min.y : center.y;
  return group;
}

function cloneAsset(group) {
  const g = group.clone(true);
  g.userData.clips = group.userData.clips || [];
  return g;
}

function stopPlayerMixer() {
  if (playerMixer) {
    playerMixer.stopAllAction();
    playerMixer = null;
  }
}

function startPlayerMixer(root, clips, enabled) {
  stopPlayerMixer();
  if (!enabled || !root || !clips || !clips.length) return;
  try {
    playerMixer = new THREE.AnimationMixer(root);
    const clip = clips.find((c) => /idle|wait|stand/i.test(c.name)) || clips[0];
    const action = playerMixer.clipAction(clip);
    action.reset();
    action.play();
  } catch (e) {
    playerMixer = null;
  }
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
  const s = Number.isFinite(t.scale) ? t.scale : 1;
  holder.scale.setScalar(s);
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
      gltf.parse(buf, '', (data) => {
        const scene = data.scene || data.scenes[0];
        if (scene) scene.userData.clips = data.animations || [];
        resolve(scene);
      }, reject);
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

function hideDefaultWeaponMesh(mesh) {
  if (!mesh || mesh.userData.fsVmMeshHidden) return;
  mesh.userData.fsVmMeshHidden = true;
  mesh.userData.fsOrigMats = [];
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const m of mats) {
    if (!m) continue;
    mesh.userData.fsOrigMats.push({
      mat: m,
      transparent: m.transparent,
      opacity: m.opacity,
      depthWrite: m.depthWrite,
    });
    m.transparent = true;
    m.opacity = 0;
    m.depthWrite = false;
  }
}

function restoreDefaultWeaponMesh(mesh) {
  if (!mesh || !mesh.userData.fsVmMeshHidden) return;
  for (const { mat, transparent, opacity, depthWrite } of mesh.userData.fsOrigMats || []) {
    mat.transparent = transparent;
    mat.opacity = opacity;
    mat.depthWrite = depthWrite;
  }
  delete mesh.userData.fsVmMeshHidden;
  delete mesh.userData.fsOrigMats;
}

function prepareWeaponModel(group, vm) {
  const env = vm && vm.scene && vm.scene.environment;
  group.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.frustumCulled = false;
    obj.castShadow = true;
    obj.receiveShadow = true;
    obj.renderOrder = 10;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      if (!m) continue;
      m.side = THREE.FrontSide;
      m.depthTest = true;
      m.depthWrite = true;
      if (m.isMeshStandardMaterial && env && !m.envMap) {
        m.envMap = env;
        m.envMapIntensity = m.envMapIntensity || 0.55;
      }
    }
  });
}

function preparePlayerModel(group) {
  group.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.frustumCulled = false;
    obj.castShadow = true;
    obj.receiveShadow = true;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      if (!m) continue;
      m.side = THREE.FrontSide;
      m.depthTest = true;
      m.depthWrite = true;
    }
  });
}

function hideVmParts(vm) {
  if (!vm) return;
  if (vm.mesh) hideDefaultWeaponMesh(vm.mesh);
  for (const part of [vm.armR, vm.armL]) {
    if (part && part.visible) {
      part.visible = false;
      weaponHidden.push({ kind: 'part', obj: part });
    }
  }
}

function restoreVmParts() {
  for (const entry of weaponHidden) {
    if (entry.kind === 'part') entry.obj.visible = true;
  }
  weaponHidden.length = 0;
}

function hidePlayerParts(model, hideHolder) {
  if (!model) return;
  const parts = [
    model.legL, model.legR, model.torso, model.head, model.armL, model.armR,
    model.hatMesh, model.weaponMesh,
  ];
  for (const p of parts) {
    if (p && p.visible) { p.visible = false; playerHidden.push(p); }
  }
  if (hideHolder && model.weaponHolder && model.weaponHolder.visible) {
    model.weaponHolder.visible = false;
    playerHidden.push(model.weaponHolder);
  } else if (!hideHolder && model.weaponHolder) {
    const i = playerHidden.indexOf(model.weaponHolder);
    if (i >= 0) {
      model.weaponHolder.visible = true;
      playerHidden.splice(i, 1);
    }
  }
  if (model.tag && model.tag.sprite) model.tag.sprite.visible = false;
}

function restorePlayerParts() {
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
    if (pendingWeapon && vm.mesh) {
      attachWeapon(vm, pendingWeapon.group, lastWeaponTransform, false);
    }
  };
}

function attachWeapon(vm, group, t, doClear = true) {
  if (!vm || !vm.mesh) return;
  wrapViewModel(vm);
  if (doClear) {
    restoreVmParts();
    const mesh = weaponHolder && weaponHolder.parent && weaponHolder.parent.isMesh ? weaponHolder.parent : null;
    if (mesh && mesh !== vm.mesh) restoreDefaultWeaponMesh(mesh);
    if (weaponHolder && weaponHolder.parent) weaponHolder.parent.remove(weaponHolder);
  } else if (weaponHolder && weaponHolder.parent) {
    weaponHolder.parent.remove(weaponHolder);
  }
  weaponGroup = cloneAsset(group);
  prepareWeaponModel(weaponGroup, vm);
  normalizeGroup(weaponGroup, WEAPON_LOCAL_HEIGHT, { fixUp: t.fixUp !== false });
  weaponHolder = new THREE.Group();
  weaponHolder.add(weaponGroup);
  applyHolderTransform(weaponHolder, t);
  vm.mesh.add(weaponHolder);
  lastWeaponTransform = { ...t };
  hideVmParts(vm);
}

function attachPlayer(model, group, t, cfg) {
  if (!model || !model.pivot) return;
  clearPlayer();
  playerGroup = cloneAsset(group);
  preparePlayerModel(playerGroup);
  normalizeGroup(playerGroup, 2.2, { feet: true, fixUp: !cfg || cfg.pmFixUp !== false });
  playerHolder = new THREE.Group();
  playerHolder.add(playerGroup);
  applyHolderTransform(playerHolder, t);
  model.pivot.add(playerHolder);
  attachedPlayerPivot = model.pivot;
  hidePlayerParts(model, cfg ? shouldHideGunHolder(cfg) : true);
  startPlayerMixer(playerGroup, playerGroup.userData.clips, !cfg || cfg.pmAnim !== false);
}

function wrapCharacterModel(model) {
  if (!model || wrappedCharModels.has(model) || typeof model.setWeapon !== 'function') return;
  wrappedCharModels.add(model);
  const orig = model.setWeapon.bind(model);
  model.setWeapon = function (...args) {
    orig(...args);
    if (pendingWeapon && lastWeaponTransform && lastWeaponTransform.tp !== false) {
      attachWorldWeapon(this, pendingWeapon.group, lastWeaponTransform);
    }
  };
}

function clearWorldWeapon() {
  if (worldWeaponHolder && worldWeaponHolder.parent) worldWeaponHolder.parent.remove(worldWeaponHolder);
  worldWeaponHolder = null;
  if (attachedCharModel && attachedCharModel.weaponMesh) {
    attachedCharModel.weaponMesh.visible = true;
  }
  attachedCharModel = null;
}

function attachWorldWeapon(model, group, t) {
  if (!model || !model.weaponHolder) return;
  wrapCharacterModel(model);
  if (worldWeaponHolder && worldWeaponHolder.parent) worldWeaponHolder.parent.remove(worldWeaponHolder);
  const g = cloneAsset(group);
  prepareWeaponModel(g, null);
  normalizeGroup(g, 0.85, { fixUp: t.fixUp !== false });
  worldWeaponHolder = new THREE.Group();
  worldWeaponHolder.add(g);
  applyHolderTransform(worldWeaponHolder, {
    scale: t.scale || 1,
    px: (t.px || 0) * 0.45,
    py: (t.py || 0) * 0.45,
    pz: (t.pz || 0) * 0.45,
    rx: t.rx || 0,
    ry: t.ry || 0,
    rz: t.rz || 0,
  });
  model.weaponHolder.add(worldWeaponHolder);
  attachedCharModel = model;
  if (model.weaponMesh) model.weaponMesh.visible = false;
}

function updateWeaponTransform(cfg, vm, player) {
  if (!vm || !vm.mesh) return;
  const t = readWeaponTransform(cfg);
  t.fixUp = cfg.vmFixUp !== false;
  t.tp = cfg.customWeaponTp !== false;
  lastWeaponTransform = { ...t };
  if (!weaponHolder || weaponHolder.parent !== vm.mesh || weaponHolder.userData.fixUp !== t.fixUp) {
    if (pendingWeapon) attachWeapon(vm, pendingWeapon.group, t);
  } else {
    applyHolderTransform(weaponHolder, t);
    hideVmParts(vm);
  }
  if (weaponHolder) weaponHolder.userData.fixUp = t.fixUp;

  const model = player && player.model;
  if (t.tp && pendingWeapon && model && model.weaponHolder) {
    if (!worldWeaponHolder || worldWeaponHolder.parent !== model.weaponHolder || worldWeaponHolder.userData.fixUp !== t.fixUp) {
      attachWorldWeapon(model, pendingWeapon.group, t);
    } else {
      applyHolderTransform(worldWeaponHolder, {
        scale: t.scale || 1,
        px: (t.px || 0) * 0.45,
        py: (t.py || 0) * 0.45,
        pz: (t.pz || 0) * 0.45,
        rx: t.rx || 0,
        ry: t.ry || 0,
        rz: t.rz || 0,
      });
      if (model.weaponMesh) model.weaponMesh.visible = false;
    }
    if (worldWeaponHolder) worldWeaponHolder.userData.fixUp = t.fixUp;
  } else {
    clearWorldWeapon();
  }
}

function allowModelClip(cfg) {
  return !!(cfg && (cfg.noclip || cfg.fly));
}

function shouldHideGunHolder(cfg) {
  if (!cfg || cfg.pmHideGun === false) return false;
  if (cfg.customWeapon && cfg.customWeaponTp !== false) return false;
  return true;
}

function clampPlayerModelToWorld(game, player, cfg) {
  if (!playerHolder || !playerGroup || !game || allowModelClip(cfg)) return;
  if (cfg && cfg.pmClamp === false) return;
  const world = game.world;
  const pos = player && player.pos;
  if (!world || !pos || typeof world.groundAt !== 'function') return;

  const t = readPlayerTransform(cfg);
  applyHolderTransform(playerHolder, t);
  playerHolder.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(playerGroup);
  if (box.isEmpty()) return;

  const groundY = world.groundAt(pos.x, pos.z, pos.y + 8);
  if (typeof groundY !== 'number') return;
  const lift = (groundY + 0.04) - box.min.y;
  if (lift > 0.12) playerHolder.position.y = t.py + lift;
}

function updatePlayerTransform(cfg, model, game, player) {
  const t = readPlayerTransform(cfg);
  const parentOk = playerHolder && model && playerHolder.parent === model.pivot;
  const flags = (cfg.pmFixUp !== false) + ':' + (cfg.pmAnim !== false);
  if (!parentOk || (playerHolder && playerHolder.userData.flags !== flags)) {
    if (pendingPlayer && model) attachPlayer(model, pendingPlayer.group, t, cfg);
    if (playerHolder) playerHolder.userData.flags = flags;
  } else {
    applyHolderTransform(playerHolder, t);
    hidePlayerParts(model, shouldHideGunHolder(cfg));
  }
  clampPlayerModelToWorld(game, player, cfg);
}

export function clearWeapon(vm) {
  restoreVmParts();
  const mesh = vm && vm.mesh ? vm.mesh : (weaponHolder && weaponHolder.parent && weaponHolder.parent.isMesh ? weaponHolder.parent : null);
  if (mesh) restoreDefaultWeaponMesh(mesh);
  if (weaponHolder && weaponHolder.parent) weaponHolder.parent.remove(weaponHolder);
  weaponHolder = null;
  weaponGroup = null;
  clearWorldWeapon();
}

export function clearPlayer() {
  stopPlayerMixer();
  restorePlayerParts();
  if (playerHolder && playerHolder.parent) playerHolder.parent.remove(playerHolder);
  playerHolder = null;
  playerGroup = null;
  attachedPlayerPivot = null;
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
  pendingWeapon = null;
  clearWeapon();
  statusMsg = 'Waffe entfernt';
}

export async function removePlayerModel() {
  await deleteBlob('player');
  pendingPlayer = null;
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

/** Toggle/Init: nur aktive Slots laden, inaktive aus dem Speicher und der Szene entfernen. */
export async function syncCustomAssetState(cfg) {
  if (!cfg.customWeapon) {
    pendingWeapon = null;
    clearWeapon();
  } else if (!pendingWeapon) {
    const w = await loadWeaponFromStore();
    if (w) cfg.customWeaponName = w.name;
    else { cfg.customWeapon = false; cfg.customWeaponName = ''; }
  }

  if (!cfg.customPlayer) {
    pendingPlayer = null;
    clearPlayer();
  } else if (!pendingPlayer) {
    const p = await loadPlayerFromStore();
    if (p) cfg.customPlayerName = p.name;
    else { cfg.customPlayer = false; cfg.customPlayerName = ''; }
  }
}

export function applyCustomAssets(game, player, cfg, dt) {
  if (!game || !player) return;

  const vm = game.viewmodel;
  const model = player.model;

  if (cfg.customWeapon && pendingWeapon && vm) {
    updateWeaponTransform(cfg, vm, player);
  } else {
    clearWeapon(vm);
    if (!cfg.customWeapon) pendingWeapon = null;
  }

  if (cfg.customPlayer && pendingPlayer && model) {
    updatePlayerTransform(cfg, model, game, player);
    model.setVisible(true);
    if (model.tag && model.tag.sprite) model.tag.sprite.visible = false;
    if (playerMixer && dt > 0) {
      try { playerMixer.update(dt); } catch (e) { stopPlayerMixer(); }
    }
  } else {
    clearPlayer();
    if (!cfg.customPlayer) pendingPlayer = null;
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

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || '');
      const i = s.indexOf(',');
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function base64ToBlob(b64, type) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: type || 'application/octet-stream' });
}

async function encodeBlobKey(key) {
  const row = await loadBlob(key);
  if (!row || !row.blob) return null;
  return {
    name: row.name || key,
    type: row.blob.type || 'application/octet-stream',
    data: await blobToBase64(row.blob),
  };
}

/** Modelle als Base64 für eine exportierte Preset-Datei. */
export async function encodeModelsForExport(cfg) {
  return {
    weapon: cfg && cfg.customWeapon ? await encodeBlobKey('weapon') : null,
    player: cfg && cfg.customPlayer ? await encodeBlobKey('player') : null,
  };
}

async function restoreEncodedModel(slot, encoded) {
  const liveKey = slot === 'player' ? 'player' : 'weapon';
  const presetKey = slot === 'player' ? PRESET_PLAYER : PRESET_WEAPON;
  if (!encoded || !encoded.data) {
    await deleteBlob(liveKey);
    await deleteBlob(presetKey);
    if (slot === 'player') {
      pendingPlayer = null;
      clearPlayer();
    } else {
      pendingWeapon = null;
      clearWeapon();
    }
    return null;
  }
  const blob = base64ToBlob(encoded.data, encoded.type);
  const name = encoded.name || (slot === 'player' ? 'player.glb' : 'weapon.glb');
  await saveBlob(liveKey, blob, name);
  if (slot === 'player') return loadPlayerFromStore();
  return loadWeaponFromStore();
}

/** Modelle aus einer importierten Preset-Datei wiederherstellen. */
export async function applyModelsFromExport(models, cfg) {
  if (!models || typeof models !== 'object') {
    if (cfg && !cfg.customWeapon) {
      pendingWeapon = null;
      clearWeapon();
    }
    if (cfg && !cfg.customPlayer) {
      pendingPlayer = null;
      clearPlayer();
    }
    return;
  }

  if (cfg && cfg.customWeapon && models.weapon && models.weapon.data) {
    await restoreEncodedModel('weapon', models.weapon);
  } else {
    if (cfg) {
      cfg.customWeapon = false;
      cfg.customWeaponName = '';
    }
    await restoreEncodedModel('weapon', null);
  }

  if (cfg && cfg.customPlayer && models.player && models.player.data) {
    await restoreEncodedModel('player', models.player);
  } else {
    if (cfg) {
      cfg.customPlayer = false;
      cfg.customPlayerName = '';
    }
    await restoreEncodedModel('player', null);
  }
}

/** Modelle + Metadaten für Custom-Preset sichern (nur aktivierte Slots). */
export async function snapshotModelsForPreset(cfg) {
  let weapon = null;
  let player = null;
  if (cfg && cfg.customWeapon) {
    weapon = await copyBlobEntry('weapon', PRESET_WEAPON);
  } else {
    await deleteBlob(PRESET_WEAPON);
  }
  if (cfg && cfg.customPlayer) {
    player = await copyBlobEntry('player', PRESET_PLAYER);
  } else {
    await deleteBlob(PRESET_PLAYER);
  }
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
    const w = await loadBlob('weapon');
    if (w) cfg.customWeaponName = w.name;
    const p = await loadBlob('player');
    if (p) cfg.customPlayerName = p.name;
    await syncCustomAssetState(cfg);
  } catch (e) {
    statusMsg = 'Asset-Laden fehlgeschlagen';
  }
}
