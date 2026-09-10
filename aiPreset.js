import { DEFAULTS, PRESETS, AI_SKIP_KEYS, applySettingsSnapshot, saveCustomPreset } from './config.js';

const STORAGE_KEY = 'fs.menu.ai.v1';

export const AI_PROVIDERS = [
  {
    id: 'openai',
    label: 'OpenAI',
    kind: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    keyHint: 'sk-…',
    hint: 'Key von platform.openai.com',
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    kind: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-4-5',
    keyHint: 'sk-ant-…',
    hint: 'Key von console.anthropic.com — Browser-CORS kann blocken, dann OpenRouter nutzen',
  },
  {
    id: 'google',
    label: 'Google Gemini',
    kind: 'google',
    defaultModel: 'gemini-2.0-flash',
    keyHint: 'AIza…',
    hint: 'Key von aistudio.google.com',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    kind: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    keyHint: 'sk-…',
    hint: 'Key von platform.deepseek.com · Modell deepseek-chat oder deepseek-reasoner',
  },
  {
    id: 'xai',
    label: 'xAI (Grok)',
    kind: 'openai',
    baseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-3-mini',
    keyHint: 'xai-…',
    hint: 'Key von console.x.ai',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    kind: 'openai',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-small-latest',
    keyHint: '…',
    hint: 'Key von console.mistral.ai',
  },
  {
    id: 'groq',
    label: 'Groq',
    kind: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    jsonMode: false,
    keyHint: 'gsk_…',
    hint: 'Schnell, Key von console.groq.com',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    kind: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o-mini',
    keyHint: 'sk-or-…',
    hint: 'Ein Key, viele Modelle (auch Claude/DeepSeek) — openrouter.ai',
  },
  {
    id: 'together',
    label: 'Together AI',
    kind: 'openai',
    baseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    keyHint: '…',
    hint: 'Key von api.together.xyz',
  },
  {
    id: 'perplexity',
    label: 'Perplexity',
    kind: 'openai',
    baseUrl: 'https://api.perplexity.ai',
    defaultModel: 'sonar',
    jsonMode: false,
    verify: 'chat',
    keyHint: 'pplx-…',
    hint: 'Key von perplexity.ai/settings/api',
  },
  {
    id: 'cohere',
    label: 'Cohere',
    kind: 'openai',
    baseUrl: 'https://api.cohere.com/compatibility/v1',
    defaultModel: 'command-r-plus',
    keyHint: '…',
    hint: 'Key von dashboard.cohere.com',
  },
  {
    id: 'custom',
    label: 'Custom (OpenAI-kompatibel)',
    kind: 'custom',
    defaultModel: 'local-model',
    jsonMode: false,
    keyHint: 'sk-…',
    hint: 'z. B. LM Studio / vLLM: http://localhost:1234/v1',
  },
];

const ENUMS = {
  aimBone: ['head', 'body'],
  triggerBone: ['any', 'head', 'body'],
  aimPriority: ['crosshair', 'distance', 'health'],
  aimKey: ['always', 'aim', 'fire'],
  aimlockKey: ['always', 'aim', 'fire'],
  espColor: ['team', 'red', 'blue', 'lime', 'cyan'],
  chamsColor: ['team', 'red', 'blue', 'lime', 'cyan'],
};

const RANGES = {
  aimFov: [0, 100],
  aimSmooth: [0, 20],
  aimlockSmooth: [0, 5],
  aimDist: [20, 250],
  aimPredictLead: [0.6, 1.5],
  triggerDelay: [0, 200],
  triggerPad: [0, 24],
  espDistMax: [30, 400],
  radarSize: [70, 160],
  automoveStrength: [0.55, 0.95],
  automoveRange: [8, 22],
  rapidmoveStrength: [1, 1.6],
  rapidmoveTurn: [1, 1.8],
  rapidmoveAir: [1, 2.2],
  speedMult: [1, 3],
  jumpBoost: [1, 2.4],
  flySpeed: [6, 40],
  spinSpeed: [2, 30],
};

function providerById(id) {
  return AI_PROVIDERS.find((p) => p.id === id) || AI_PROVIDERS[0];
}

export function loadAiConfig() {
  const base = {
    provider: 'openai',
    key: '',
    model: '',
    baseUrl: '',
    verified: false,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== 'object') return base;
    if (typeof saved.provider === 'string') base.provider = saved.provider;
    if (typeof saved.key === 'string') base.key = saved.key;
    if (typeof saved.model === 'string') base.model = saved.model;
    if (typeof saved.baseUrl === 'string') base.baseUrl = saved.baseUrl;
    base.verified = !!saved.verified;
  } catch (e) { /* ignore */ }
  return base;
}

export function saveAiConfig(ai) {
  const next = {
    provider: ai.provider || 'openai',
    key: ai.key || '',
    model: ai.model || '',
    baseUrl: ai.baseUrl || '',
    verified: !!ai.verified,
  };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (e) { /* ignore */ }
  return next;
}

export function clearAiConfig() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  return loadAiConfig();
}

export function isAiConfigured(ai) {
  const cfg = ai || loadAiConfig();
  if (!cfg.key) return false;
  if (cfg.provider === 'custom' && !String(cfg.baseUrl || '').trim()) return false;
  return true;
}

export function resolvedModel(ai) {
  const cfg = ai || loadAiConfig();
  return String(cfg.model || '').trim() || providerById(cfg.provider).defaultModel;
}

function httpError(res, body) {
  const msg = (body && (body.error && (body.error.message || body.error)) || body.message) || res.statusText;
  return new Error((msg && String(msg)) || ('HTTP ' + res.status));
}

async function readJson(res) {
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (e) { body = { message: text.slice(0, 240) }; }
  if (!res.ok) throw httpError(res, body);
  return body;
}

function corsHint(err, provider) {
  const s = String(err && err.message || err || '');
  if (/Failed to fetch|NetworkError|CORS|Load failed/i.test(s)) {
    if (provider === 'custom') {
      return new Error('Kein Zugriff auf die Custom-URL (CORS oder Server offline).');
    }
    if (provider === 'anthropic') {
      return new Error('Anthropic blockiert oft direkte Browser-Aufrufe. Über OpenRouter (anthropic/claude-sonnet-4-5) geht es meist.');
    }
    return new Error('Der Anbieter blockiert Browser-Aufrufe oder ist nicht erreichbar. OpenRouter oder Custom (lokal) funktionieren meist besser.');
  }
  return err instanceof Error ? err : new Error(s);
}

function openaiUrl(ai) {
  const p = providerById(ai.provider);
  if (p.kind === 'custom' || ai.provider === 'custom') {
    return String(ai.baseUrl || '').trim().replace(/\/+$/, '');
  }
  return p.baseUrl || 'https://api.openai.com/v1';
}

function openaiHeaders(ai) {
  const h = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + ai.key,
  };
  if (ai.provider === 'openrouter') {
    h['HTTP-Referer'] = location.origin || 'http://localhost';
    h['X-Title'] = 'FRAGTRAINER';
  }
  return h;
}

function anthropicHeaders(ai) {
  return {
    'Content-Type': 'application/json',
    'x-api-key': ai.key,
    'anthropic-version': '2023-06-01',
  };
}

async function verifyChatPing(ai) {
  const res = await fetch(openaiUrl(ai) + '/chat/completions', {
    method: 'POST',
    headers: openaiHeaders(ai),
    body: JSON.stringify({
      model: resolvedModel(ai),
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ok' }],
    }),
  });
  await readJson(res);
}

export async function verifyAiConnection(ai) {
  const cfg = ai || loadAiConfig();
  if (!isAiConfigured(cfg)) throw new Error('API-Key fehlt.');
  const p = providerById(cfg.provider);
  try {
    if (p.kind === 'google') {
      const model = encodeURIComponent(resolvedModel(cfg));
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}?key=${encodeURIComponent(cfg.key)}`;
      await readJson(await fetch(url));
    } else if (p.kind === 'anthropic') {
      await readJson(await fetch(p.baseUrl + '/v1/models', { headers: anthropicHeaders(cfg) }));
    } else if (p.verify === 'chat') {
      await verifyChatPing(cfg);
    } else {
      await readJson(await fetch(openaiUrl(cfg) + '/models', { headers: openaiHeaders(cfg) }));
    }
    cfg.verified = true;
    saveAiConfig(cfg);
    return { ok: true, model: resolvedModel(cfg), provider: p.label };
  } catch (err) {
    cfg.verified = false;
    saveAiConfig(cfg);
    throw corsHint(err, cfg.provider);
  }
}

function schemaForPrompt() {
  const keys = {};
  for (const [k, v] of Object.entries(DEFAULTS)) {
    if (AI_SKIP_KEYS.has(k)) continue;
    const row = { type: typeof v, default: v };
    if (ENUMS[k]) row.enum = ENUMS[k];
    if (RANGES[k]) row.range = RANGES[k];
    keys[k] = row;
  }
  const examples = {};
  for (const [id, p] of Object.entries(PRESETS)) {
    const slim = { label: p.label, desc: p.desc };
    for (const [k, v] of Object.entries(p)) {
      if (k === 'label' || k === 'desc' || AI_SKIP_KEYS.has(k)) continue;
      slim[k] = v;
    }
    examples[id] = slim;
  }
  return { keys, examples };
}

function systemPrompt() {
  const schema = schemaForPrompt();
  return [
    'Du erzeugst FRAGTRAINER-Presets für einen Browser-FPS-Trainer.',
    'Antworte NUR mit einem JSON-Objekt: {"name":string,"desc":string,"settings":{...}}.',
    'settings darf ausschließlich bekannte Keys enthalten. Keine Kommentare, kein Markdown.',
    'Unbekannte Keys weglassen. UI-, Hotkey- und 3D-Modell-Keys niemals setzen.',
    'Nicht erwähnte Combat-Features auf false. Godmode/Noclip/Fly/Ghostshot/Spinbot nur wenn klar gewünscht.',
    'Legit: kleiner FOV, hohes Smooth, aimKey=aim, aimVisibleOnly true, kein Aimlock.',
    'Rage/HvH: Aimlock, größerer FOV, niedriges Smooth, Visuals an.',
    'Trigger: triggerbot an, Delay 0–30, Hitbox any, LOS nur wenn gewünscht.',
    'ESP/Radar an, wenn der Nutzer Awareness, Rage oder Training will.',
    'Schema:',
    JSON.stringify(schema.keys),
    'Beispiele (Stil, nicht kopieren wenn der Wunsch anders ist):',
    JSON.stringify(schema.examples),
  ].join('\n');
}

function extractJson(text) {
  if (!text || typeof text !== 'string') throw new Error('Leere Modell-Antwort.');
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const s = fence ? fence[1] : text;
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Kein JSON in der Modell-Antwort.');
  return JSON.parse(s.slice(start, end + 1));
}

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

export function sanitizeAiSettings(raw) {
  const src = raw && typeof raw === 'object' ? (raw.settings && typeof raw.settings === 'object' ? raw.settings : raw) : {};
  const out = {};
  for (const [k, def] of Object.entries(DEFAULTS)) {
    if (AI_SKIP_KEYS.has(k)) continue;
    if (src[k] === undefined) continue;
    let v = src[k];
    if (typeof def === 'boolean') {
      out[k] = v === true || v === 'true' || v === 1 || v === '1';
      continue;
    }
    if (typeof def === 'number') {
      const n = Number(v);
      if (!Number.isFinite(n)) continue;
      const range = RANGES[k];
      out[k] = range ? clamp(n, range[0], range[1]) : n;
      continue;
    }
    if (typeof def === 'string') {
      v = String(v);
      if (ENUMS[k] && ENUMS[k].indexOf(v) < 0) continue;
      out[k] = v;
    }
  }
  return out;
}

async function completeOpenAi(ai, system, user, useJson) {
  const p = providerById(ai.provider);
  const json = useJson !== false && p.jsonMode !== false;
  const body = {
    model: resolvedModel(ai),
    temperature: 0.25,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };
  if (json) body.response_format = { type: 'json_object' };
  try {
    const res = await fetch(openaiUrl(ai) + '/chat/completions', {
      method: 'POST',
      headers: openaiHeaders(ai),
      body: JSON.stringify(body),
    });
    const data = await readJson(res);
    const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    return String(text || '');
  } catch (err) {
    const msg = String(err && err.message || '');
    if (json && /response_format|json_object|json mode/i.test(msg)) {
      return completeOpenAi(ai, system, user, false);
    }
    throw err;
  }
}

async function completeAnthropic(ai, system, user) {
  const p = providerById(ai.provider);
  const res = await fetch(p.baseUrl + '/v1/messages', {
    method: 'POST',
    headers: anthropicHeaders(ai),
    body: JSON.stringify({
      model: resolvedModel(ai),
      max_tokens: 2048,
      temperature: 0.25,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  const data = await readJson(res);
  const parts = data && data.content;
  if (!Array.isArray(parts)) return '';
  return parts.map((c) => c && c.text ? c.text : '').join('\n');
}

async function completeGemini(ai, system, user) {
  const model = encodeURIComponent(resolvedModel(ai));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(ai.key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature: 0.25, responseMimeType: 'application/json' },
    }),
  });
  const data = await readJson(res);
  const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
  return Array.isArray(parts) ? parts.map((p) => p.text || '').join('\n') : '';
}

export async function generateAiPreset(prompt, ai) {
  const cfg = ai || loadAiConfig();
  const text = String(prompt || '').trim();
  if (!text) throw new Error('Bitte beschreibe das Preset in einem Satz.');
  if (!isAiConfigured(cfg)) throw new Error('Zuerst Anbieter und API-Key speichern.');

  const user = 'Erzeuge ein Preset für diese Beschreibung:\n' + text;
  let raw;
  try {
    const p = providerById(cfg.provider);
    let reply;
    if (p.kind === 'google') reply = await completeGemini(cfg, systemPrompt(), user);
    else if (p.kind === 'anthropic') reply = await completeAnthropic(cfg, systemPrompt(), user);
    else reply = await completeOpenAi(cfg, systemPrompt(), user);
    raw = extractJson(reply);
  } catch (err) {
    throw corsHint(err, cfg.provider);
  }

  const settings = sanitizeAiSettings(raw);
  if (!Object.keys(settings).length) throw new Error('Das Modell hat keine gültigen Einstellungen geliefert.');
  const name = String((raw && raw.name) || text.slice(0, 42)).trim() || 'KI-Preset';
  const desc = String((raw && (raw.desc || raw.description)) || text).trim().slice(0, 160);
  return { name, desc, settings, prompt: text };
}

export async function applyGeneratedPreset(cfg, generated) {
  if (!generated || !generated.settings) return false;
  const base = {};
  for (const k of Object.keys(DEFAULTS)) {
    if (AI_SKIP_KEYS.has(k)) continue;
    base[k] = DEFAULTS[k];
  }
  Object.assign(base, generated.settings);
  applySettingsSnapshot(cfg, base);
  return saveCustomPreset(cfg, {
    ai: {
      name: generated.name || 'KI-Preset',
      desc: generated.desc || '',
      prompt: generated.prompt || '',
      provider: loadAiConfig().provider,
      model: resolvedModel(),
    },
  });
}
