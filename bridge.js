import { looksLikeActor, looksLikeCamera, actorList } from './discover.js';

const _out = { x: 0, y: 0, z: 0 };

export function getPos(actor) {
  if (!actor) return null;
  return actor.pos || actor.position || null;
}

export function getHp(actor) {
  if (!actor) return 0;
  const v = actor.hp ?? actor.health ?? actor.hitpoints;
  return typeof v === 'number' ? v : 0;
}

export function getMaxHp(actor) {
  if (!actor) return 100;
  const v = actor.maxHp ?? actor.maxHealth ?? actor.maxHitpoints;
  return typeof v === 'number' && v > 0 ? v : 100;
}

export function setHp(actor, value) {
  if (!actor) return;
  if ('hp' in actor) actor.hp = value;
  else if ('health' in actor) actor.health = value;
  else if ('hitpoints' in actor) actor.hitpoints = value;
}

export function isAlive(actor) {
  if (!actor) return false;
  if (typeof actor.alive === 'boolean') return actor.alive;
  if (typeof actor.dead === 'boolean') return !actor.dead;
  return getHp(actor) > 0;
}

export function getHeight(actor) {
  if (!actor) return 2.4;
  if (typeof actor.height === 'number' && actor.height > 0.5) return actor.height;
  return 2.4;
}

export function eyeHeight(actor) {
  if (actor && typeof actor.eyeHeight === 'function') {
    try { return actor.eyeHeight(); } catch (e) { /* ignore */ }
  }
  const h = getHeight(actor);
  if (actor && actor.crouching) return h * 0.53;
  return h * 0.87;
}

export function eyePos(actor, out) {
  const p = getPos(actor);
  const o = out || _out;
  if (!p) { o.x = o.y = o.z = 0; return o; }
  o.x = p.x;
  o.y = p.y + eyeHeight(actor);
  o.z = p.z;
  return o;
}

export function lookDir(actor, out) {
  const o = out || { x: 0, y: 0, z: 1 };
  if (actor && typeof actor.lookDir === 'function') {
    try { return actor.lookDir(o); } catch (e) { /* ignore */ }
  }
  const yaw = actor && typeof actor.yaw === 'number' ? actor.yaw : 0;
  const pitch = actor && typeof actor.pitch === 'number' ? actor.pitch : 0;
  const cp = Math.cos(pitch);
  o.x = -Math.sin(yaw) * cp;
  o.y = Math.sin(pitch);
  o.z = -Math.cos(yaw) * cp;
  return o;
}

export function getPlayer(game) {
  if (!game) return null;
  if (looksLikeActor(game.player) && (game.player.isLocal || !game.player.isBot)) {
    return game.player;
  }
  const actors = actorList(game);
  const local = actors.find((a) => a && a.isLocal);
  if (local) return local;
  const human = actors.find((a) => a && a.isBot === false);
  if (human) return human;

  const cam = game.camera;
  if (!cam || !actors.length) return actors[0] || null;
  const cx = cam.position.x, cy = cam.position.y, cz = cam.position.z;
  let best = null, bestD = Infinity;
  for (const a of actors) {
    const p = getPos(a);
    if (!p) continue;
    const d = (p.x - cx) ** 2 + (p.y - cy) ** 2 + (p.z - cz) ** 2;
    if (d < bestD) { bestD = d; best = a; }
  }
  return best;
}

export function isEnemy(game, self, other) {
  if (!other || other === self) return false;
  if (!isAlive(other)) return false;
  if (game && typeof game.sameTeam === 'function') {
    try { return !game.sameTeam(self, other); } catch (e) { /* ignore */ }
  }
  if (self && self.team && other.team) {
    const t = String(self.team);
    if (t.startsWith('ffa')) return true;
    return self.team !== other.team;
  }
  return !other.isLocal;
}

export function enemies(game, self) {
  const out = [];
  for (const a of actorList(game)) {
    if (isEnemy(game, self, a)) out.push(a);
  }
  return out;
}

export function getCamera(game) {
  if (!game || !game.camera) return null;
  const c = game.camera;
  if (typeof c.fov === 'number' && c.position) return c;
  return looksLikeCamera(c) ? c : null;
}

export function getModelRoot(actor) {
  if (!actor) return null;
  const m = actor.model || actor.mesh || actor.character || actor.body;
  if (!m) return null;
  if (m.root && typeof m.root.traverse === 'function') return m.root;
  if (typeof m.traverse === 'function') return m;
  return null;
}

export function losClear(world, ax, ay, az, bx, by, bz) {
  if (!world) return true;
  if (typeof world.losClear === 'function') {
    try { return world.losClear(ax, ay, az, bx, by, bz); } catch (e) { return true; }
  }
  if (typeof world.raycast !== 'function') return true;
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-4) return true;
  try {
    const h = world.raycast(ax, ay, az, dx / len, dy / len, dz / len, len - 0.35);
    return !h;
  } catch (e) {
    return true;
  }
}

export function worldToScreen(camera, x, y, z, W, H) {
  if (!camera) return null;

  const Vec = camera.position && camera.position.constructor;
  if (Vec && typeof Vec.prototype.project === 'function') {
    try {
      const v = new Vec(x, y, z);
      v.project(camera);
      if (v.z > 1) return null;
      return {
        x: (v.x * 0.5 + 0.5) * W,
        y: (-v.y * 0.5 + 0.5) * H,
        z: v.z,
      };
    } catch (e) { /* fallback unten */ }
  }

  const mv = camera.matrixWorldInverse && camera.matrixWorldInverse.elements;
  const pj = camera.projectionMatrix && camera.projectionMatrix.elements;
  if (!mv || !pj) return null;

  const vx = mv[0] * x + mv[4] * y + mv[8] * z + mv[12];
  const vy = mv[1] * x + mv[5] * y + mv[9] * z + mv[13];
  const vz = mv[2] * x + mv[6] * y + mv[10] * z + mv[14];
  const vw = mv[3] * x + mv[7] * y + mv[11] * z + mv[15];

  const cx = pj[0] * vx + pj[4] * vy + pj[8] * vz + pj[12] * vw;
  const cy = pj[1] * vx + pj[5] * vy + pj[9] * vz + pj[13] * vw;
  const cz = pj[2] * vx + pj[6] * vy + pj[10] * vz + pj[14] * vw;
  const cw = pj[3] * vx + pj[7] * vy + pj[11] * vz + pj[15] * vw;
  if (Math.abs(cw) < 1e-8) return null;
  const ndcX = cx / cw, ndcY = cy / cw, ndcZ = cz / cw;
  if (ndcZ > 1) return null;
  return {
    x: (ndcX * 0.5 + 0.5) * W,
    y: (-ndcY * 0.5 + 0.5) * H,
    z: ndcZ,
  };
}

export function shortestAngle(from, to) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

export function dist3d(a, b) {
  if (!a || !b) return Infinity;
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  return Math.hypot(dx, dy, dz);
}

export function distFlat(a, b) {
  if (!a || !b) return Infinity;
  return Math.hypot(b.x - a.x, b.z - a.z);
}

export function getWeaponName(actor) {
  if (!actor) return '';
  try {
    const w = actor.weapon || (actor.slots && actor.slots[actor.slot] && actor.slots[actor.slot].w);
    if (!w) return '';
    return w.name || w.id || w.label || '';
  } catch (e) {
    return '';
  }
}

export function getArmor(actor) {
  if (!actor || typeof actor.armor !== 'number') return 0;
  return actor.armor;
}

export function getTeam(actor) {
  if (!actor || !actor.team) return '?';
  return String(actor.team);
}

export function isTeammate(game, self, other) {
  if (!other || other === self) return false;
  if (game && typeof game.sameTeam === 'function') {
    try { return game.sameTeam(self, other); } catch (e) { return false; }
  }
  return self && other && self.team === other.team;
}

export function allActors(game, self) {
  return actorList(game).filter((a) => a && a !== self && isAlive(a));
}

export function colorForActor(cfg, actor, enemy) {
  if (cfg.espColor === 'red') return '#ff4d4d';
  if (cfg.espColor === 'blue') return '#4aa3ff';
  if (cfg.espColor === 'lime') return '#7dff5a';
  if (cfg.espColor === 'cyan') return '#5ae6d2';
  if (actor.team === 'blue') return '#4aa3ff';
  if (actor.team === 'red') return '#ff4d4d';
  return enemy ? '#ff4d4d' : '#7dff5a';
}

export function chamsHex(cfg, actor) {
  if (cfg.chamsColor === 'red') return 0xff3a3a;
  if (cfg.chamsColor === 'blue') return 0x3399ff;
  if (cfg.chamsColor === 'lime') return 0x55ff44;
  if (cfg.chamsColor === 'cyan') return 0x44eedd;
  return actor.team === 'blue' ? 0x3399ff : 0xff3a3a;
}

export function setPos(actor, x, y, z) {
  const p = getPos(actor);
  if (!p) return;
  p.x = x; p.y = y; p.z = z;
}

export function zeroVel(actor) {
  if (!actor || !actor.vel) return;
  actor.vel.x = actor.vel.y = actor.vel.z = 0;
}

export function aimAt(player, tx, ty, tz) {
  const p = getPos(player);
  if (!p || typeof player.yaw !== 'number' || typeof player.pitch !== 'number') return;
  const dx = tx - p.x, dy = ty - (p.y + eyeHeight(player)), dz = tz - p.z;
  const len = Math.hypot(dx, dy, dz) || 1e-6;
  player.yaw = Math.atan2(-dx, -dz);
  player.pitch = clamp(Math.asin(dy / len), -1.55, 1.55);
}
