import { actorList } from './discover.js';
import {
  getPos, getHp, getMaxHp, setHp, isAlive, getHeight, eyePos, lookDir,
  getPlayer, enemies, getCamera, getModelRoot, losClear, worldToScreen,
  shortestAngle, clamp, distFlat, getWeaponName, getArmor, isTeammate,
  colorForActor, chamsHex, setPos, zeroVel, aimAt, allActors,
} from './bridge.js';
import { countActiveFeatures } from './config.js';
import { applyCustomAssets } from './customAssets.js';

const wrappedDmg = new WeakSet();
const wrappedRecoil = new WeakSet();
const wrappedPhys = new WeakSet();
const chamsOrig = new WeakMap();
const speedState = new WeakMap();

let wasGrounded = false;
let lastPlayer = null;
let triggerSince = 0;
let triggerTarget = null;
let tpQueue = null;

const _eye = { x: 0, y: 0, z: 0 };
const _dir = { x: 0, y: 0, z: 0 };
const _tgt = { x: 0, y: 0, z: 0 };
const _vel = { x: 0, y: 0, z: 0 };

export function requestTeleport(actor) {
  tpQueue = { type: 'actor', actor };
}

export function requestTeleportForward() {
  tpQueue = { type: 'forward' };
}

export function buildActorRows(game, player) {
  if (!game || !player) return [];
  const pp = getPos(player);
  const rows = [];
  for (const a of actorList(game)) {
    if (!a || a === player || !isAlive(a)) continue;
    const p = getPos(a);
    if (!p) continue;
    rows.push({
      id: a.id,
      name: a.name || 'Player',
      hp: getHp(a),
      maxHp: getMaxHp(a),
      team: a.team || '?',
      dist: pp ? Math.round(distFlat(pp, p)) : 0,
      enemy: !isTeammate(game, player, a),
      actor: a,
    });
  }
  rows.sort((a, b) => a.dist - b.dist);
  return rows;
}

function wrapGod(player) {
  if (!player || wrappedDmg.has(player)) return;
  if (typeof player.applyDamage !== 'function') return;
  wrappedDmg.add(player);
  const orig = player.applyDamage.bind(player);
  player.applyDamage = function(amount) {
    if (wrapGod._on) return false;
    return orig(amount);
  };
}

function wrapRecoil(player) {
  if (!player || wrappedRecoil.has(player)) return;
  if (typeof player.addRecoil !== 'function') return;
  wrappedRecoil.add(player);
  const orig = player.addRecoil.bind(player);
  player.addRecoil = function(v, h) {
    if (wrapRecoil._on) return;
    return orig(v, h);
  };
}

function wrapPhysics(player) {
  if (!player || wrappedPhys.has(player)) return;
  if (typeof player.updatePhysics !== 'function') return;
  wrappedPhys.add(player);
  const orig = player.updatePhysics.bind(player);
  player.updatePhysics = function(dt, world) {
    if (wrapPhysics._on && flyCfg._on) {
      applyNoclip(this, dt);
      return;
    }
    return orig(dt, world);
  };
}

function applyNoclip(player, dt) {
  const it = player.intent || {};
  const dir = lookDir(player, _dir);
  const speed = flyCfg._speed * dt;
  const p = getPos(player);
  if (!p || !player.vel) return;

  let mx = 0, mz = 0;
  if (it.fwd) { mx += dir.x * it.fwd; mz += dir.z * it.fwd; }
  if (it.side) {
    const rx = -dir.z, rz = dir.x;
    mx += rx * it.side; mz += rz * it.side;
  }
  const len = Math.hypot(mx, mz);
  if (len > 0) { mx = mx / len * speed; mz = mz / len * speed; }

  p.x += mx; p.z += mz;
  if (it.jump) p.y += speed;
  if (it.crouch) p.y -= speed;
  player.vel.x = player.vel.y = player.vel.z = 0;
  player.grounded = false;
}

const flyCfg = { _on: false, _speed: 18 };

function refillAmmo(player) {
  const slots = player.slots;
  if (Array.isArray(slots)) {
    for (const s of slots) {
      if (!s) continue;
      const w = s.w || s.weapon;
      if (w && w.mag !== Infinity && typeof s.mag === 'number') s.mag = w.mag;
      if (w && typeof s.reserve === 'number' && typeof w.reserve === 'number') s.reserve = w.reserve;
    }
  }
  const ammo = player.ammo;
  if (ammo && typeof ammo === 'object') {
    const w = player.weapon || ammo.w;
    if (w && w.mag !== Infinity && typeof ammo.mag === 'number') ammo.mag = w.mag;
    if (w && typeof ammo.reserve === 'number') ammo.reserve = w.reserve;
  }
  if (typeof player.nades === 'number') {
    player.nades = typeof player.maxNades === 'number' ? player.maxNades : Math.max(player.nades, 2);
  }
  if (typeof player.reloadTimer === 'number') player.reloadTimer = 0;
}

function zeroRecoil(player) {
  if ('recoilQueueP' in player) player.recoilQueueP = 0;
  if ('recoilQueueY' in player) player.recoilQueueY = 0;
  if ('recoilAccP' in player) player.recoilAccP = 0;
  if ('recoilAccY' in player) player.recoilAccY = 0;
  if ('punch' in player) player.punch = 0;
  if ('punchV' in player) player.punchV = 0;
  if ('spread' in player) player.spread = 0;
}

function applySpeed(player, cfg) {
  if (typeof player.speedMult !== 'number') return;
  let st = speedState.get(player);
  if (!st) { st = { base: player.speedMult, applied: player.speedMult }; speedState.set(player, st); }
  if (!cfg.speed) {
    if (st.applied !== st.base && Math.abs(player.speedMult - st.applied) < 0.001) {
      player.speedMult = st.base;
    }
    st.base = player.speedMult;
    st.applied = player.speedMult;
    return;
  }
  if (Math.abs(player.speedMult - st.applied) > 0.02) st.base = player.speedMult;
  st.applied = st.base * cfg.speedMult;
  player.speedMult = st.applied;
}

function applyJump(player, cfg) {
  const grounded = !!player.grounded;
  if (player !== lastPlayer) { wasGrounded = grounded; lastPlayer = player; }
  if (cfg.superJump && wasGrounded && !grounded && player.vel) {
    const vy = player.vel.y;
    if (vy > 7 && vy < 22) player.vel.y = vy * cfg.jumpBoost;
  }
  wasGrounded = grounded;
}

function bonePos(actor, bone, out) {
  const p = getPos(actor);
  if (!p) return null;
  out.x = p.x;
  out.z = p.z;
  const head = bone === 'head' || (bone !== 'body' && bone !== false);
  out.y = p.y + (head ? eyeHeightOf(actor) : getHeight(actor) * 0.62);
  return out;
}

function eyeHeightOf(actor) {
  if (typeof actor.eyeHeight === 'function') {
    try { return actor.eyeHeight(); } catch (e) { /* ignore */ }
  }
  return getHeight(actor) * (actor.crouching ? 0.53 : 0.87);
}

function predictPos(actor, bone, dist, out) {
  bonePos(actor, bone, out);
  if (!actor.vel) return out;
  const bulletSpeed = (actor.weapon && actor.weapon.projectile && actor.weapon.projectile.speed) || 800;
  const t = clamp(dist / bulletSpeed, 0, 0.35);
  out.x += actor.vel.x * t;
  out.y += actor.vel.y * t;
  out.z += actor.vel.z * t;
  return out;
}

function aimAngles(ex, ey, ez, tx, ty, tz) {
  const dx = tx - ex, dy = ty - ey, dz = tz - ez;
  const len = Math.hypot(dx, dy, dz) || 1e-6;
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.asin(clamp(dy / len, -1, 1)), dist: len };
}

function fovDeg(dir, toX, toY, toZ) {
  const len = Math.hypot(toX, toY, toZ) || 1e-6;
  const dot = clamp((dir.x * toX + dir.y * toY + dir.z * toZ) / len, -1, 1);
  return Math.acos(dot) * 180 / Math.PI;
}

function aimKeyHeld(cfg, player, input) {
  if (cfg.aimKey === 'always') return true;
  if (cfg.aimKey === 'aim') {
    if (player.intent && player.intent.ads) return true;
    if (input && input.mouse && input.mouse[1]) return true;
    return false;
  }
  if (cfg.aimKey === 'fire') {
    if (player.intent && player.intent.fire) return true;
    if (input && input.mouse && input.mouse[0]) return true;
    return false;
  }
  return true;
}

function pickTarget(game, player, cfg, world) {
  const list = enemies(game, player);
  if (!list.length) return null;
  const eye = eyePos(player, _eye);
  const dir = lookDir(player, _dir);
  const bone = cfg.aimBone || (cfg.aimHead ? 'head' : 'body');
  let best = null, bestFov = cfg.aimFov;

  for (const a of list) {
    bonePos(a, bone, _tgt);
    const dist = distFlat(eye, _tgt);
    if (dist > cfg.aimDist) continue;
    if (cfg.aimVisibleOnly && !losClear(world, eye.x, eye.y, eye.z, _tgt.x, _tgt.y, _tgt.z)) continue;
    if (cfg.aimPredict) predictPos(a, bone, dist, _tgt);
    const toX = _tgt.x - eye.x, toY = _tgt.y - eye.y, toZ = _tgt.z - eye.z;
    const fov = fovDeg(dir, toX, toY, toZ);
    if (fov <= bestFov) { bestFov = fov; best = a; }
  }
  return best;
}

function applyAim(game, player, cfg, world, dt) {
  if (typeof player.yaw !== 'number' || typeof player.pitch !== 'number') return;
  const target = pickTarget(game, player, cfg, world);
  if (!target) return;
  const eye = eyePos(player, _eye);
  const bone = cfg.aimBone || (cfg.aimHead ? 'head' : 'body');
  bonePos(target, bone, _tgt);
  const dist = distFlat(eye, _tgt);
  if (cfg.aimPredict) predictPos(target, bone, dist, _tgt);
  const ang = aimAngles(eye.x, eye.y, eye.z, _tgt.x, _tgt.y, _tgt.z);
  const dyaw = shortestAngle(player.yaw, ang.yaw);
  const dpitch = ang.pitch - player.pitch;
  const smooth = Math.max(1, cfg.aimSmooth);
  const k = smooth <= 1.05 ? 1 : 1 - Math.exp(-dt * (18 / smooth));
  player.yaw += dyaw * k;
  player.pitch = clamp(player.pitch + dpitch * k, -1.55, 1.55);
}

function applyTrigger(game, player, cfg, camera, world, W, H, now) {
  const list = enemies(game, player);
  const intent = player.intent;
  if (!intent) return;
  const r = 14;
  const cx = W * 0.5, cy = H * 0.5;
  let hitActor = null;
  for (const a of list) {
    if (!bonePos(a, 'head', _tgt)) continue;
    const eye = eyePos(player, _eye);
    if (cfg.triggerVisible && !losClear(world, eye.x, eye.y, eye.z, _tgt.x, _tgt.y, _tgt.z)) continue;
    const s = worldToScreen(camera, _tgt.x, _tgt.y, _tgt.z, W, H);
    if (!s) continue;
    const dx = s.x - cx, dy = s.y - cy;
    if (dx * dx + dy * dy <= r * r) { hitActor = a; break; }
  }
  if (!hitActor) { triggerSince = 0; triggerTarget = null; return; }
  if (cfg.triggerOnAds && !(intent.ads || player.ads)) return;
  if (triggerTarget !== hitActor) { triggerTarget = hitActor; triggerSince = now; }
  if (now - triggerSince >= cfg.triggerDelay) intent.fire = true;
}

function setChamsMaterial(mat, on, color) {
  if (!mat) return;
  if (!chamsOrig.has(mat)) {
    chamsOrig.set(mat, {
      depthTest: mat.depthTest,
      depthWrite: mat.depthWrite,
      emissive: mat.emissive && mat.emissive.clone ? mat.emissive.clone() : null,
      emissiveIntensity: mat.emissiveIntensity,
    });
  }
  if (on) {
    mat.depthTest = false;
    if ('emissiveIntensity' in mat) mat.emissiveIntensity = Math.max(mat.emissiveIntensity || 0, 0.55);
    if (mat.emissive && mat.emissive.setHex) mat.emissive.setHex(color);
  } else {
    const o = chamsOrig.get(mat);
    if (!o) return;
    mat.depthTest = o.depthTest;
    mat.depthWrite = o.depthWrite;
    if (o.emissive && mat.emissive && mat.emissive.copy) mat.emissive.copy(o.emissive);
    if ('emissiveIntensity' in mat) mat.emissiveIntensity = o.emissiveIntensity;
  }
}

function applyChams(game, self, cfg) {
  if (!cfg.chams) {
    for (const a of actorList(game)) restoreChams(a);
    return;
  }
  for (const a of actorList(game)) {
    const root = getModelRoot(a);
    if (!root) continue;
    const enemy = a !== self && isAlive(a) && !isTeammate(game, self, a);
    const teamOk = cfg.chamsTeam || enemy;
    const want = teamOk && isAlive(a);
    const color = chamsHex(cfg, a);
    root.traverse((obj) => {
      if (!obj.isMesh || obj.isSprite) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) setChamsMaterial(m, want, color);
      obj.renderOrder = want ? 9 : 0;
    });
  }
}

function restoreChams(actor) {
  const root = getModelRoot(actor);
  if (!root) return;
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) setChamsMaterial(m, false, 0);
    if (obj.renderOrder === 9) obj.renderOrder = 0;
  });
}

function applyTeleport(player) {
  if (!tpQueue || !player) return;
  const q = tpQueue;
  tpQueue = null;
  if (q.type === 'actor' && q.actor) {
    const p = getPos(q.actor);
    if (!p) return;
    setPos(player, p.x, p.y + 0.2, p.z);
    zeroVel(player);
    aimAt(player, p.x, p.y + eyeHeightOf(q.actor), p.z);
    return;
  }
  if (q.type === 'forward') {
    const p = getPos(player);
    const d = lookDir(player, _dir);
    if (!p) return;
    setPos(player, p.x + d.x * 8, p.y + d.y * 8 + 0.2, p.z + d.z * 8);
    zeroVel(player);
  }
}

function applyThirdPerson(player, cfg) {
  const on = !!(cfg.thirdPerson || cfg.customPlayer);
  player.thirdPerson = on;
  try {
    const settings = window.__FRAGSTORM__ && window.__FRAGSTORM__.settings;
    if (settings) settings.thirdPerson = on;
  } catch (e) { /* ignore */ }
}

function applySpinbot(player, cfg, dt) {
  if (!cfg.spinbot || !player.alive) return;
  if (typeof player.yaw !== 'number') return;
  const speed = (cfg.spinSpeed || 10) * dt;
  player.yaw += speed;
  while (player.yaw > Math.PI) player.yaw -= Math.PI * 2;
  while (player.yaw < -Math.PI) player.yaw += Math.PI * 2;
}

function suppressFire(player, input) {
  if (input) {
    if (input.mouse) input.mouse[0] = false;
    if (input.mousePressed) input.mousePressed[0] = false;
    input.dx = 0;
    input.dy = 0;
  }
  if (player && player.intent) player.intent.fire = false;
}

export function applyFeatures(dt, ctx) {
  const { cfg, game, input, menuOpen, canvas } = ctx;
  const now = performance.now();
  wrapGod._on = !!(cfg && cfg.godmode);
  wrapRecoil._on = !!(cfg && cfg.noRecoil);
  flyCfg._on = !!(cfg && (cfg.noclip || cfg.fly));
  flyCfg._speed = cfg ? cfg.flySpeed : 18;

  if (!game || !cfg) {
    if (canvas) clearCanvas(canvas);
    return { actors: 0, player: false, active: 0, rows: [] };
  }

  const player = getPlayer(game);
  const camera = getCamera(game);
  const world = game.world || null;
  const n = actorList(game).length;
  const rows = buildActorRows(game, player);

  if (player) {
    wrapGod(player);
    wrapRecoil(player);
    wrapPhysics(player);

    if (cfg.godmode && isAlive(player)) {
      setHp(player, getMaxHp(player));
      if (typeof player.armor === 'number') {
        const maxA = typeof player.maxArmor === 'number' ? player.maxArmor : player.armor;
        player.armor = Math.max(player.armor, maxA);
      }
    }
    if (cfg.infAmmo) refillAmmo(player);
    if (cfg.noRecoil) zeroRecoil(player);
    if (cfg.rapidFire && typeof player.fireTimer === 'number') player.fireTimer = 0;
    if (cfg.infDash && typeof player.dashCooldown === 'number') player.dashCooldown = 0;
    if (cfg.autoBhop && player.intent) player.intent.autoJump = true;
    applyThirdPerson(player, cfg);
    applySpinbot(player, cfg, dt);
    applySpeed(player, cfg);
    applyJump(player, cfg);
    applyTeleport(player);
    applyCustomAssets(game, player, cfg);

    if (menuOpen) suppressFire(player, input);
    else {
      if (cfg.aimbot && aimKeyHeld(cfg, player, input)) applyAim(game, player, cfg, world, dt);
      if (cfg.triggerbot && camera && canvas) {
        applyTrigger(game, player, cfg, camera, world, canvas.clientWidth, canvas.clientHeight, now);
      }
    }
  }

  applyChams(game, player, cfg);

  if (canvas) drawVisuals(canvas, cfg, game, player, camera, menuOpen);

  return { actors: n, player: !!player, active: countActiveFeatures(cfg), rows };
}

function clearCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawVisuals(canvas, cfg, game, player, camera, menuOpen) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  if (canvas.width !== (W * dpr | 0) || canvas.height !== (H * dpr | 0)) {
    canvas.width = W * dpr | 0;
    canvas.height = H * dpr | 0;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  if (cfg.fovCircle && cfg.aimbot && !menuOpen) {
    const radius = fovToPixels(cfg.aimFov, camera, H);
    ctx.beginPath();
    ctx.arc(W * 0.5, H * 0.5, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(80, 220, 200, 0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  if (cfg.radar && player) drawRadar(ctx, cfg, game, player, W, H);
  if (!cfg.esp || !camera || !player) return;

  for (const a of enemies(game, player)) {
    const p = getPos(a);
    if (!p) continue;
    const pp = getPos(player);
    const dist = pp ? distFlat(pp, p) : 0;
    if (dist > cfg.espDistMax) continue;

    const h = getHeight(a);
    const feet = worldToScreen(camera, p.x, p.y, p.z, W, H);
    const head = worldToScreen(camera, p.x, p.y + h, p.z, W, H);
    const col = colorForActor(cfg, a, true);

    if ((!feet || !head) && cfg.espOffscreen) {
      drawOffscreen(ctx, player, a, W, H, col);
      continue;
    }
    if (!feet || !head) continue;

    const boxH = Math.abs(head.y - feet.y);
    const boxW = Math.max(14, boxH * 0.42);
    const x = (feet.x + head.x) * 0.5 - boxW * 0.5;
    const y = Math.min(head.y, feet.y);
    const hp = getHp(a);
    const maxHp = getMaxHp(a);
    const ratio = maxHp > 0 ? clamp(hp / maxHp, 0, 1) : 0;

    if (cfg.espSnap) {
      ctx.beginPath();
      ctx.moveTo(W * 0.5, H);
      ctx.lineTo(feet.x, feet.y);
      ctx.strokeStyle = col + '99';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    if (cfg.espBox) {
      if (cfg.espCorner) drawCornerBox(ctx, x, y, boxW, boxH, col);
      else {
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.4;
        ctx.strokeRect(x, y, boxW, boxH);
      }
    }

    if (cfg.espHp) {
      const bh = boxH;
      const bx = x - 5;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(bx, y, 3, bh);
      ctx.fillStyle = ratio > 0.45 ? '#5dff7a' : ratio > 0.2 ? '#ffd24a' : '#ff4d4d';
      ctx.fillRect(bx, y + bh * (1 - ratio), 3, bh * ratio);
    }

    const parts = [];
    if (cfg.espName && a.name) parts.push(String(a.name));
    if (cfg.espHpText) parts.push(Math.round(hp) + ' HP');
    if (cfg.espDist) parts.push(Math.round(dist) + 'm');
    if (cfg.espWeapon) {
      const wn = getWeaponName(a);
      if (wn) parts.push(wn);
    }
    if (getArmor(a) > 0) parts.push('AP ' + Math.round(getArmor(a)));
    if (parts.length) {
      ctx.font = '600 11px Rajdhani, Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillText(parts.join('  '), (x + boxW * 0.5) + 1, y - 6);
      ctx.fillStyle = col;
      ctx.fillText(parts.join('  '), x + boxW * 0.5, y - 7);
    }
  }
}

function drawCornerBox(ctx, x, y, w, h, col) {
  const l = Math.min(w, h) * 0.28;
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x, y + l); ctx.lineTo(x, y); ctx.lineTo(x + l, y);
  ctx.moveTo(x + w - l, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + l);
  ctx.moveTo(x + w, y + h - l); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - l, y + h);
  ctx.moveTo(x + l, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - l);
  ctx.stroke();
}

function drawOffscreen(ctx, player, actor, W, H, col) {
  const pp = getPos(player);
  const ap = getPos(actor);
  if (!pp || !ap) return;
  const dx = ap.x - pp.x, dz = ap.z - pp.z;
  const yaw = player.yaw || 0;
  const rx = dx * Math.cos(yaw) - dz * Math.sin(yaw);
  const rz = dx * Math.sin(yaw) + dz * Math.cos(yaw);
  const ang = Math.atan2(rx, -rz);
  const cx = W * 0.5, cy = H * 0.5;
  const pad = 28;
  const px = cx + Math.sin(ang) * (Math.min(W, H) * 0.42);
  const py = cy - Math.cos(ang) * (Math.min(W, H) * 0.42);
  const sx = clamp(px, pad, W - pad);
  const sy = clamp(py, pad, H - pad);
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(ang);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(7, 8);
  ctx.lineTo(-7, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawRadar(ctx, cfg, game, player, W, H) {
  const size = cfg.radarSize || 110;
  const pad = 16;
  const cx = W - pad - size * 0.5;
  const cy = H - pad - size * 0.5;
  const r = size * 0.5;
  ctx.save();
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = 'rgba(8,12,18,0.72)';
  ctx.strokeStyle = 'rgba(90,230,210,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#5ae6d2';
  ctx.beginPath();
  ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
  ctx.fill();
  const pp = getPos(player);
  const yaw = player.yaw || 0;
  for (const a of allActors(game, player)) {
    const p = getPos(a);
    if (!p || !pp) continue;
    const dx = p.x - pp.x, dz = p.z - pp.z;
    const dist = Math.hypot(dx, dz);
    if (dist > cfg.espDistMax) continue;
    const lx = dx * Math.cos(yaw) - dz * Math.sin(yaw);
    const lz = dx * Math.sin(yaw) + dz * Math.cos(yaw);
    const scale = (r - 8) / cfg.espDistMax;
    const sx = cx + lx * scale;
    const sy = cy - lz * scale;
    if ((sx - cx) ** 2 + (sy - cy) ** 2 > (r - 4) ** 2) continue;
    ctx.fillStyle = isTeammate(game, player, a) ? '#7dff5a' : '#ff4d4d';
    ctx.beginPath();
    ctx.arc(sx, sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function fovToPixels(fovDeg, camera, H) {
  const vfov = (camera && camera.fov) ? camera.fov * Math.PI / 180 : 1.2;
  const ang = fovDeg * Math.PI / 180;
  return Math.max(8, Math.tan(ang) / Math.tan(vfov * 0.5) * (H * 0.5));
}
