const GLOBAL_KEYS = [
  '__FRAGSTORM__', '__KRUNKER__', '__GAME__', 'FRAGSTORM', 'gameApp',
];

const ACTOR_ARRAY_KEYS = ['actors', 'players', 'entities', 'bots', 'characters'];

const SKIP_WINDOW = new Set([
  'window', 'self', 'top', 'parent', 'frames', 'document', 'location',
  'navigator', 'chrome', 'external', 'visualViewport', 'clientInformation',
  'performance', 'crypto', 'caches', 'indexedDB', 'localStorage', 'sessionStorage',
  'history', 'screen', 'speechSynthesis', 'customElements', 'styleMedia',
  'webkitStorageInfo', 'webkitRequestFileSystem', 'onbeforeunload', 'onunload',
]);

function isVec3(o) {
  return !!o && typeof o === 'object' &&
    typeof o.x === 'number' && typeof o.y === 'number' && typeof o.z === 'number';
}

export function looksLikeActor(o) {
  if (!o || typeof o !== 'object') return false;
  const pos = o.pos || o.position;
  if (!isVec3(pos)) return false;
  const hp = o.hp ?? o.health ?? o.hitpoints;
  return typeof hp === 'number';
}

export function looksLikeCamera(o) {
  return !!o && typeof o === 'object' &&
    o.projectionMatrix && o.matrixWorldInverse && isVec3(o.position);
}

function getActorArray(obj) {
  if (!obj || typeof obj !== 'object') return null;
  for (const k of ACTOR_ARRAY_KEYS) {
    const a = obj[k];
    if (!Array.isArray(a)) continue;
    if (a.length === 0 || a.some(looksLikeActor)) return a;
  }
  return null;
}

function looksLikeGame(o) {
  if (!o || typeof o !== 'object') return false;
  if (!looksLikeCamera(o.camera)) return false;
  return Array.isArray(o.actors) || Array.isArray(o.players) || Array.isArray(o.entities) || looksLikeActor(o.player);
}

function readGame(holder) {
  if (!holder) return null;
  try {
    if (looksLikeGame(holder)) return holder;
    const g = holder.game;
    if (looksLikeGame(g)) return g;
  } catch (e) { /* getter kann werfen */ }
  return null;
}

function readInput(holder, game) {
  try {
    if (holder && holder.input && typeof holder.input === 'object') return holder.input;
  } catch (e) { /* ignore */ }
  if (game && game.input && typeof game.input === 'object') return game.input;
  return null;
}

function pack(holder, game, source) {
  return {
    holder,
    game,
    input: readInput(holder, game),
    world: game.world || null,
    source,
  };
}

function scanWindow() {
  let names;
  try { names = Object.getOwnPropertyNames(window); } catch (e) { return null; }

  for (const name of names) {
    if (SKIP_WINDOW.has(name)) continue;
    let val;
    try { val = window[name]; } catch (e) { continue; }
    if (!val || typeof val !== 'object') continue;
    const game = readGame(val);
    if (game) return pack(val, game, 'window.' + name);

    try {
      const keys = Object.keys(val);
      for (let i = 0; i < keys.length && i < 40; i++) {
        const inner = val[keys[i]];
        if (!inner || typeof inner !== 'object') continue;
        const g2 = readGame(inner);
        if (g2) return pack(inner, g2, 'window.' + name + '.' + keys[i]);
      }
    } catch (e) { /* ignore */ }
  }
  return null;
}

function scanActorFallback() {
  let names;
  try { names = Object.getOwnPropertyNames(window); } catch (e) { return null; }

  for (const name of names) {
    if (SKIP_WINDOW.has(name)) continue;
    let val;
    try { val = window[name]; } catch (e) { continue; }
    if (!val || typeof val !== 'object') continue;

    const candidates = [val, val.game].filter(Boolean);
    try {
      for (const k of Object.keys(val).slice(0, 30)) candidates.push(val[k]);
    } catch (e) { /* ignore */ }

    for (const c of candidates) {
      if (!c || typeof c !== 'object') continue;
      const arr = getActorArray(c);
      if (!arr) continue;
      const cam = looksLikeCamera(c.camera) ? c.camera : null;
      if (cam) return pack(c, c, 'actors:' + name);
      if (c.player && looksLikeActor(c.player)) {
        return {
          holder: c,
          game: c,
          input: readInput(c, c),
          world: c.world || null,
          source: 'actors-only:' + name,
        };
      }
    }
  }
  return null;
}

let cache = null;
let cacheAt = 0;
let missAt = 0;

export function discover(now) {
  const t = now || performance.now();
  const ttl = cache && cache.game ? 1800 : 400;
  if (cache && t - cacheAt < ttl) {
    if (cache.game && looksLikeCamera(cache.game.camera)) return cache;
  }
  if (!cache && t - missAt < 250) return null;

  for (const k of GLOBAL_KEYS) {
    let holder;
    try { holder = window[k]; } catch (e) { continue; }
    const game = readGame(holder);
    if (game) {
      cache = pack(holder, game, k);
      cacheAt = t;
      return cache;
    }
  }

  const scanned = scanWindow() || scanActorFallback();
  if (scanned) {
    cache = scanned;
    cacheAt = t;
    return cache;
  }

  cache = null;
  missAt = t;
  return null;
}

export function invalidate() {
  cache = null;
  cacheAt = 0;
}

function syncTrainingActor(t, index) {
  let a = t._fsActor;
  if (!a) {
    a = {
      id: 'fs-tr-' + index,
      name: 'Ziel',
      isBot: true,
      isLocal: false,
      team: 'target',
      pos: { x: 0, y: 0, z: 0 },
      vel: { x: 0, y: 0, z: 0 },
      hp: 100,
      maxHp: 100,
      alive: true,
      grounded: true,
      height: 1,
      yaw: 0,
      pitch: 0,
      model: null,
      _fsTraining: true,
    };
    a.eyeHeight = function () { return this.height * 0.5; };
    a.eyePos = function (out) {
      const o = out || { x: 0, y: 0, z: 0 };
      o.x = this.pos.x;
      o.y = this.pos.y + this.height * 0.5;
      o.z = this.pos.z;
      return o;
    };
    t._fsActor = a;
  }

  const r = t.r > 0.05 ? t.r : 0.5;
  const now = performance.now();
  if (a._fsT) {
    const dt = Math.max(0.001, (now - a._fsT) / 1000);
    a.vel.x = (t.x - a._fsX) / dt;
    a.vel.y = (t.y - a._fsY) / dt;
    a.vel.z = (t.z - a._fsZ) / dt;
  }
  a._fsT = now;
  a._fsX = t.x;
  a._fsY = t.y;
  a._fsZ = t.z;

  a.pos.x = t.x;
  a.pos.y = t.y - r;
  a.pos.z = t.z;
  a.height = r * 2;
  a.alive = true;
  a.hp = 100;
  a.model = t.group ? { root: t.group } : null;
  return a;
}

function trainingActors(game) {
  const tr = game && game.training;
  if (!tr || !Array.isArray(tr.targets)) return [];
  const out = [];
  for (let i = 0; i < tr.targets.length; i++) {
    const t = tr.targets[i];
    if (!t || !t.active) continue;
    out.push(syncTrainingActor(t, i));
  }
  return out;
}

export function actorList(game) {
  if (!game) return [];
  let list = [];
  for (const k of ACTOR_ARRAY_KEYS) {
    const a = game[k];
    if (Array.isArray(a)) { list = a; break; }
  }
  const extra = trainingActors(game);
  if (!extra.length) return list;
  return list.concat(extra);
}
