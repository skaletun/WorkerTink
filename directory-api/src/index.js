const ID_RE = /^WTINKID-\d{6}$/i;
const displayId = (value) => { const match = String(value || '').match(/^(?:WTINKID)-(\d{6})$/i); return match ? `WTinkID-${match[1]}` : String(value || ''); };
const NAME_MAX = 80;
const POSITION_MAX = 120;
const USERNAME_MAX = 32;
const USERNAME_RE = /^[A-Za-z0-9_]{3,32}$/;
const AVATAR_MAX = 180_000;
const TOKEN_BYTES = 32;
const PIN_LENGTH = 6;
const PIN_ITERATIONS = 100000;
const DEV_WTINK_ID = 'WTINKID-214994';
const ONLINE_WINDOW_MS = 75 * 1000;
const PEER_SESSION_TTL_MS = 30 * 1000;


function json(data, status = 200, origin = '*') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': origin,
      'access-control-allow-headers': 'Content-Type, Authorization',
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'vary': 'Origin'
    }
  });
}

function binary(data, status = 200, origin = '*', contentType = 'application/octet-stream') {
  return new Response(data, {status, headers: {'content-type': contentType, 'cache-control': 'no-store', 'access-control-allow-origin': origin, 'access-control-allow-headers': 'Content-Type, Authorization', 'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS', 'vary': 'Origin'}});
}

function bytesToBase64(bytes) {
  let binary = '';
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const step = 0x8000;
  for (let i = 0; i < view.length; i += step) binary += String.fromCharCode(...view.subarray(i, i + step));
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(String(value || ''));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function corsOrigin(request, env) {
  const configured = String(env.ALLOWED_ORIGIN || '*').trim();
  if (configured === '*') return '*';
  const requestOrigin = request.headers.get('Origin') || '';
  return requestOrigin === configured ? configured : '';
}

function corsError(request, env) {
  return json({error: 'CORS_ORIGIN_NOT_ALLOWED'}, 403, corsOrigin(request, env) || 'null');
}

function normalizeId(value) {
  return String(value || '').trim().toUpperCase();
}

function validId(value) {
  return ID_RE.test(value);
}

function cleanText(value, max) {
  return String(value || '').trim().slice(0, max);
}

function validCalendarDate(value) {
  const input = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return false;
  const [year, month, day] = input.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function cleanUsername(value) {
  const username = String(value || '').trim().replace(/^@+/, '');
  return USERNAME_RE.test(username) ? username : '';
}

async function uniqueUsername(env, preferred='') {
  const clean = cleanUsername(preferred);
  if (clean) {
    const exists = await env.DB.prepare('SELECT 1 FROM profiles WHERE username = ?1').bind(clean).first();
    if (!exists) return clean;
  }
  for (let i=0;i<20;i++) {
    const generated = `WTinker_${Math.random().toString(36).slice(2,8)}`;
    const exists = await env.DB.prepare('SELECT 1 FROM profiles WHERE username = ?1').bind(generated).first();
    if (!exists) return generated;
  }
  throw new Error('USERNAME_GENERATION_FAILED');
}

function cleanAvatar(value) {
  const avatar = typeof value === 'string' && value.startsWith('data:image/') ? value : '';
  return avatar.length <= AVATAR_MAX ? avatar : '';
}

function roleFlags(row) {
  const id = normalizeId(row?.wtink_id);
  // Roles are canonical: only the fixed development account can be dev/admin.
  // Persisted role columns are retained for compatibility but never grant UI/API access.
  const isDev = id === DEV_WTINK_ID;
  const isAdmin = id === DEV_WTINK_ID;
  return {isDev, isAdmin};
}

function publicProfile(row) {
  if (!row) return null;
  const roles = roleFlags(row);
  return {
    profileId: displayId(row.wtink_id),
    name: row.name,
    position: row.position,
    avatar: row.avatar,
    username: row.username || null,
    isDev: roles.isDev,
    isAdmin: roles.isAdmin
  };
}

function pairKey(a, b) {
  return [a, b].sort().join(':');
}

function randomToken() {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function base64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function setupCryptoKey(env) {
  const secret = String(env.SETUP_ENCRYPTION_KEY || '');
  if (!secret) throw new Error('SETUP_ENCRYPTION_KEY_NOT_CONFIGURED');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, {name:'AES-GCM'}, false, ['encrypt','decrypt']);
}

async function encryptSetup(env, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await setupCryptoKey(env);
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({name:'AES-GCM',iv}, key, plaintext);
  return {ciphertext:base64Url(new Uint8Array(ciphertext)), iv:base64Url(iv)};
}

async function decryptSetup(env, ciphertext, iv) {
  const key = await setupCryptoKey(env);
  const plaintext = await crypto.subtle.decrypt({name:'AES-GCM',iv:fromBase64Url(iv)}, key, fromBase64Url(ciphertext));
  return JSON.parse(new TextDecoder().decode(plaintext));
}

function fromBase64Url(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function webAuthnClientChallenge(response) {
  try {
    const raw = response?.response?.clientDataJSON;
    if (!raw) return '';
    const json = JSON.parse(new TextDecoder().decode(fromBase64Url(raw)));
    return typeof json?.challenge === 'string' ? json.challenge : '';
  } catch {
    return '';
  }
}

function validPin(value) {
  return /^\d{6}$/.test(String(value || ''));
}

function secureEqualBytes(a, b) {
  if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array) || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hashPin(pin, saltBytes) {
  const salt = saltBytes || crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:PIN_ITERATIONS,hash:'SHA-256'}, key, 256);
  return {hash:base64Url(new Uint8Array(bits)), salt:base64Url(salt)};
}

async function verifyPin(pin, hash, salt) {
  try {
    const result = await hashPin(pin, fromBase64Url(salt));
    return secureEqualBytes(fromBase64Url(result.hash), fromBase64Url(hash));
  } catch {
    return false;
  }
}

function webAuthnOrigin(request, env) {
  const requestOrigin=String(request.headers.get('Origin')||'').replace(/\/$/,'');
  if(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(requestOrigin)) return requestOrigin;
  return String(env.WEBAUTHN_ORIGIN || requestOrigin || 'https://skaletun.github.io').replace(/\/$/, '');
}

function webAuthnRpId(request, env) {
  if (env.WEBAUTHN_RP_ID) return String(env.WEBAUTHN_RP_ID).trim();
  const origin = webAuthnOrigin(request, env);
  try { return new URL(origin).hostname; } catch { return ''; }
}

function bearer(request) {
  const value = request.headers.get('Authorization') || '';
  return value.replace(/^Bearer\s+/i, '').trim();
}

async function body(request) {
  try {
    return JSON.parse(await request.text());
  } catch {
    return {};
  }
}

const AUTH_SESSION_TTL = 30 * 24 * 60 * 60 * 1000;

async function createAuthSession(env, profileId, token, now = Date.now(), deviceName = 'Устройство') {
  const tokenHash = await sha256(token);
  const sessionId = crypto.randomUUID();
  await env.DB.prepare('INSERT OR REPLACE INTO auth_sessions(token_hash,profile_id,created_at,expires_at,session_id,device_name,last_seen) VALUES (?1,?2,?3,?4,?5,?6,?3)')
    .bind(tokenHash, profileId, now, now + AUTH_SESSION_TTL, sessionId, cleanText(deviceName, 120) || 'Устройство').run();
  return {tokenHash, sessionId};
}

async function authProfile(request, env) {
  const token = bearer(request);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const session = await env.DB.prepare('SELECT profile_id,session_id,device_name FROM auth_sessions WHERE token_hash = ?1 AND expires_at > ?2').bind(tokenHash,Date.now()).first();
  if (session) {
    await env.DB.prepare('UPDATE auth_sessions SET last_seen = ?1 WHERE token_hash = ?2').bind(Date.now(), tokenHash).run();
    return env.DB.prepare('SELECT wtink_id, name, position, avatar, username, is_dev, is_admin, token_hash, pin_hash, pin_salt, pin_failed_attempts, pin_locked_until, webauthn_user_id, created_at, updated_at, last_seen FROM profiles WHERE wtink_id = ?1').bind(session.profile_id).first();
  }
  // Backward compatibility for the original single-token sessions.
  return env.DB.prepare('SELECT wtink_id, name, position, avatar, username, is_dev, is_admin, token_hash, pin_hash, pin_salt, pin_failed_attempts, pin_locked_until, webauthn_user_id, created_at, updated_at, last_seen FROM profiles WHERE token_hash = ?1').bind(tokenHash).first();
}


const DEFAULT_PUSH_PREFERENCES = {friendRequests:true,friendAccepted:true,messages:true,groupMessages:true,channelInvites:true,social:true,events:true,shifts:true,absences:true,payroll:true};
function cleanPushPreferences(value) {
  const input = value && typeof value === 'object' ? value : {};
  return {
    friendRequests: input.friendRequests !== false,
    friendAccepted: input.friendAccepted !== false,
    messages: input.messages !== false,
    groupMessages: input.groupMessages !== false,
    channelInvites: input.channelInvites !== false,
    social: input.social !== false,
    events: input.events !== false,
    shifts: input.shifts !== false,
    absences: input.absences !== false,
    payroll: input.payroll !== false,
  };
}
function pushEnabledFor(preferences, kind) {
  if (!preferences || preferences.enabled === false) return false;
  const key = kind === 'friendRequest' || kind === 'peerRequest' ? 'friendRequests' : kind === 'friendAccepted' ? 'friendAccepted' : kind === 'groupMessage' ? 'groupMessages' : kind === 'channelInvite' ? 'channelInvites' : ['like','comment','post'].includes(kind) ? 'social' : ['event','workEvent'].includes(kind) ? 'events' : kind === 'message' ? 'messages' : kind;
  return preferences[key] !== false;
}
async function sendPush(env, subscription, payload) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) return {sent:false,reason:'PUSH_NOT_CONFIGURED'};
  const {buildPushPayload} = await import('@block65/webcrypto-web-push');
  const pushSubscription = {endpoint:subscription.endpoint,expirationTime:subscription.expiration_time || null,keys:{p256dh:subscription.p256dh,auth:subscription.auth}};
  const request = await buildPushPayload({data:JSON.stringify(payload),options:{ttl:payload.ttl || 3600,urgency:payload.urgency || 'normal'}}, pushSubscription, {subject:env.VAPID_SUBJECT,publicKey:env.VAPID_PUBLIC_KEY,privateKey:env.VAPID_PRIVATE_KEY});
  const response = await fetch(subscription.endpoint, request);
  if (response.status === 404 || response.status === 410) return {sent:false,gone:true};
  if (!response.ok) return {sent:false,status:response.status};
  return {sent:true};
}
async function notifyProfile(env, profileId, kind, payload) {
  if (kind === 'message' && payload?.actorId) {
    const mute = await env.DB.prepare('SELECT muted_until FROM chat_mutes WHERE profile_id=?1 AND peer_id=?2').bind(profileId, normalizeId(payload.actorId)).first();
    if (mute && (Number(mute.muted_until) === 0 || Number(mute.muted_until) > Date.now())) return {sent:false,reason:'CHAT_MUTED'};
  }
  const rows = await env.DB.prepare('SELECT endpoint, expiration_time, p256dh, auth, preferences FROM push_subscriptions WHERE profile_id = ?1').bind(profileId).all();
  const gone=[];
  for (const row of rows.results || []) {
    let preferences = DEFAULT_PUSH_PREFERENCES;
    try { preferences = {...DEFAULT_PUSH_PREFERENCES, ...JSON.parse(row.preferences || '{}')}; } catch {}
    if (!pushEnabledFor(preferences, kind)) continue;
    try {
      const result = await sendPush(env, row, payload);
      if (result.gone) gone.push(row.endpoint);
    } catch {}
  }
  if (gone.length) for (const endpoint of gone) await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?1').bind(endpoint).run();
}

async function createSocialNotification(env, profileId, actorId, kind, entityId, title, bodyText, url='./?tab=social') {
  const now = Date.now();
  const id = crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO social_notifications (id, profile_id, actor_id, kind, entity_id, title, body, url, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)`).bind(id, profileId, actorId || null, kind, entityId || null, title, bodyText, url, now).run();
  return id;
}

function socialProfile(row) { return publicProfile(row); }

function requestView(row, from, to) {
  return {
    id: row.id,
    from: publicProfile(from),
    to: publicProfile(to),
    createdAt: row.created_at,
    status: row.status
  };
}

async function loadRequest(env, id) {
  return env.DB.prepare(`
    SELECT
      r.id, r.sender_id, r.receiver_id, r.status, r.created_at, r.updated_at,
      s.wtink_id AS s_id, s.name AS s_name, s.position AS s_position, s.avatar AS s_avatar, s.is_dev AS s_is_dev, s.is_admin AS s_is_admin,
      t.wtink_id AS t_id, t.name AS t_name, t.position AS t_position, t.avatar AS t_avatar, t.is_dev AS t_is_dev, t.is_admin AS t_is_admin
    FROM friend_requests r
    JOIN profiles s ON s.wtink_id = r.sender_id
    JOIN profiles t ON t.wtink_id = r.receiver_id
    WHERE r.id = ?1
  `).bind(id).first();
}

function profileFromJoined(row, prefix) {
  return {
    wtink_id: row[`${prefix}_id`],
    name: row[`${prefix}_name`],
    position: row[`${prefix}_position`],
    avatar: row[`${prefix}_avatar`],
    is_dev: row[`${prefix}_is_dev`],
    is_admin: row[`${prefix}_is_admin`]
  };
}


function peerSessionView(row) {
  if (!row) return null;
  return {
    id: row.id,
    from: profileFromJoined(row, 's'),
    to: profileFromJoined(row, 't'),
    offer: row.offer_sdp,
    answer: row.answer_sdp || null,
    status: row.status,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    expiresAt: Number(row.expires_at)
  };
}

async function loadPeerSession(env, id) {
  return env.DB.prepare(`
    SELECT
      p.id, p.initiator_id, p.receiver_id, p.offer_sdp, p.answer_sdp, p.status, p.created_at, p.updated_at, p.expires_at,
      s.wtink_id AS s_id, s.name AS s_name, s.position AS s_position, s.avatar AS s_avatar, s.is_dev AS s_is_dev, s.is_admin AS s_is_admin,
      t.wtink_id AS t_id, t.name AS t_name, t.position AS t_position, t.avatar AS t_avatar, t.is_dev AS t_is_dev, t.is_admin AS t_is_admin
    FROM peer_sessions p
    JOIN profiles s ON s.wtink_id = p.initiator_id
    JOIN profiles t ON t.wtink_id = p.receiver_id
    WHERE p.id = ?1
  `).bind(id).first();
}

async function handle(request, env) {
  const origin = corsOrigin(request, env);
  if (!origin) return corsError(request, env);
  if (request.method === 'OPTIONS') return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': origin,
      'access-control-allow-headers': 'Content-Type, Authorization',
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'access-control-max-age': '86400',
      'vary': 'Origin'
    }
  });

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  if (request.method === 'GET' && path === '/health') {
    const row = await env.DB.prepare('SELECT COUNT(*) AS count FROM profiles').first();
    return json({ok: true, profiles: Number(row?.count || 0)}, 200, origin);
  }

  if (request.method === 'POST' && path === '/auth/login') {
    const input = await body(request);
    const wtinkId = normalizeId(input?.profileId);
    const pin = String(input?.pin || '');
    if (!validId(wtinkId) || !validPin(pin)) return json({error:'INVALID_CREDENTIALS'},400,origin);
    const row = await env.DB.prepare(`SELECT wtink_id, name, position, avatar, username, is_dev, is_admin, pin_hash, pin_salt, pin_failed_attempts, pin_locked_until, last_seen FROM profiles WHERE wtink_id = ?1`).bind(wtinkId).first();
    if (!row) return json({error:'INVALID_CREDENTIALS'},401,origin);
    const lockedUntil = Number(row.pin_locked_until || 0);
    if (lockedUntil > Date.now()) return json({error:'PIN_LOCKED',retryAfter:Math.ceil((lockedUntil-Date.now())/1000)},429,origin);
    if (!row.pin_hash || !row.pin_salt) return json({error:'PIN_NOT_SET'},409,origin);
    const valid = await verifyPin(pin,row.pin_hash,row.pin_salt);
    if (!valid) {
      const failed = Number(row.pin_failed_attempts || 0) + 1;
      const lock = failed >= 5 ? Date.now() + 15*60*1000 : 0;
      await env.DB.prepare('UPDATE profiles SET pin_failed_attempts = ?1, pin_locked_until = ?2 WHERE wtink_id = ?3').bind(failed >= 5 ? 0 : failed,lock,wtinkId).run();
      return json({error:failed >= 5 ? 'PIN_LOCKED' : 'INVALID_CREDENTIALS',retryAfter:failed >= 5 ? 900 : 0},401,origin);
    }
    const token = randomToken();
    const now = Date.now();
    const deviceName = cleanText(input?.deviceName, 120) || 'Устройство';
    const session = await createAuthSession(env, wtinkId, token, now, deviceName);
    await env.DB.prepare('UPDATE profiles SET pin_failed_attempts = 0, pin_locked_until = 0, updated_at = ?1, last_seen = ?1 WHERE wtink_id = ?2').bind(now,wtinkId).run();
    const passkey = await env.DB.prepare('SELECT COUNT(*) AS count FROM webauthn_credentials WHERE profile_id = ?1').bind(wtinkId).first();
    const setupRow = await env.DB.prepare('SELECT setup_ciphertext, setup_iv FROM account_setup WHERE wtink_id = ?1').bind(wtinkId).first();
    let setup = null;
    if (setupRow) setup = await decryptSetup(env, setupRow.setup_ciphertext, setupRow.setup_iv);
    return json({profile:publicProfile(row),token,sessionId:session.sessionId,deviceName,setup,security:{pinSet:true,onePassAvailable:Number(passkey?.count||0)>0}},200,origin);
  }

  if (request.method === 'GET' && path === '/auth/sessions') {
    const owner = await authProfile(request, env);
    if (!owner) return json({error:'UNAUTHORIZED'},401,origin);
    const token = bearer(request);
    const tokenHash = await sha256(token);
    const rows = await env.DB.prepare('SELECT session_id, device_name, created_at, expires_at, last_seen, token_hash FROM auth_sessions WHERE profile_id = ?1 AND expires_at > ?2 AND session_id IS NOT NULL ORDER BY last_seen DESC').bind(owner.wtink_id, Date.now()).all();
    return json({sessions:(rows.results||[]).map(r=>({sessionId:r.session_id,deviceName:r.device_name||'Устройство',createdAt:Number(r.created_at||0),expiresAt:Number(r.expires_at||0),lastSeen:Number(r.last_seen||r.created_at||0),current:r.token_hash===tokenHash}))},200,origin);
  }

  const authSessionMatch=path.match(/^\/auth\/sessions\/([^/]+)$/);
  if (authSessionMatch && request.method === 'DELETE') {
    const owner = await authProfile(request, env);
    if (!owner) return json({error:'UNAUTHORIZED'},401,origin);
    const sessionId=decodeURIComponent(authSessionMatch[1]);
    const currentHash=await sha256(bearer(request));
    const row=await env.DB.prepare('SELECT token_hash FROM auth_sessions WHERE session_id = ?1 AND profile_id = ?2').bind(sessionId,owner.wtink_id).first();
    if(!row)return json({error:'SESSION_NOT_FOUND'},404,origin);
    if(row.token_hash===currentHash)return json({error:'CURRENT_SESSION'},409,origin);
    await env.DB.prepare('DELETE FROM auth_sessions WHERE session_id = ?1 AND profile_id = ?2').bind(sessionId,owner.wtink_id).run();
    return json({ok:true},200,origin);
  }

  if (request.method === 'GET' && path === '/auth/status') {
    const owner = await authProfile(request, env);
    if (!owner) return json({error:'UNAUTHORIZED'},401,origin);
    const passkey = await env.DB.prepare('SELECT COUNT(*) AS count FROM webauthn_credentials WHERE profile_id = ?1').bind(owner.wtink_id).first();
    const setupRow = await env.DB.prepare('SELECT setup_ciphertext, setup_iv FROM account_setup WHERE wtink_id = ?1').bind(owner.wtink_id).first();
    let setup = null;
    if (setupRow) setup = await decryptSetup(env, setupRow.setup_ciphertext, setupRow.setup_iv);
    return json({profile:publicProfile(owner),setup,security:{pinSet:Boolean(owner.pin_hash),onePassAvailable:Number(passkey?.count||0)>0}},200,origin);
  }

  if (request.method === 'GET' && path === '/account/setup') {
    const owner = await authProfile(request, env);
    if (!owner) return json({error:'UNAUTHORIZED'},401,origin);
    const row = await env.DB.prepare('SELECT setup_ciphertext, setup_iv, updated_at FROM account_setup WHERE wtink_id = ?1').bind(owner.wtink_id).first();
    if (!row) return json({configured:false,setup:null},200,origin);
    return json({configured:true,setup:await decryptSetup(env,row.setup_ciphertext,row.setup_iv),updatedAt:Number(row.updated_at||0)},200,origin);
  }

  if (request.method === 'PUT' && path === '/account/setup') {
    const owner = await authProfile(request, env);
    if (!owner) return json({error:'UNAUTHORIZED'},401,origin);
    const input = await body(request);
    const setup = input?.setup;
    if (!setup || typeof setup !== 'object') return json({error:'INVALID_SETUP'},400,origin);
    const allowed = ['salary','taxRate','stage','vacTotal','startDate','scheduleType','scheduleShift','scheduleVakhtaMonths','schedulePairType','holidayCoeff','nightExtraPercent'];
    const clean = Object.fromEntries(allowed.map(key => [key, setup[key]]));
    if (!Number.isFinite(Number(clean.salary)) || Number(clean.salary) < 0 || !Number.isFinite(Number(clean.taxRate)) || Number(clean.taxRate) < 0 || Number(clean.taxRate) > 100 || !Number.isFinite(Number(clean.stage)) || Number(clean.stage) < 0 || !Number.isFinite(Number(clean.vacTotal)) || Number(clean.vacTotal) < 0 || !validCalendarDate(clean.startDate) || !['5/2','4/1','3/2','3/1','6/1','2/2','7/0'].includes(String(clean.scheduleType)) || !['day','night','full'].includes(String(clean.scheduleShift)) || !Number.isFinite(Number(clean.scheduleVakhtaMonths)) || Number(clean.scheduleVakhtaMonths) < 1 || Number(clean.scheduleVakhtaMonths) > 6 || !['day-day','day-night','night-night'].includes(String(clean.schedulePairType)) || !Number.isFinite(Number(clean.holidayCoeff)) || !Number.isFinite(Number(clean.nightExtraPercent))) return json({error:'INVALID_SETUP'},400,origin);
    clean.salary=Number(clean.salary); clean.taxRate=Number(clean.taxRate); clean.stage=Number(clean.stage); clean.vacTotal=Number(clean.vacTotal); clean.scheduleVakhtaMonths=Number(clean.scheduleVakhtaMonths); clean.holidayCoeff=Number(clean.holidayCoeff); clean.nightExtraPercent=Number(clean.nightExtraPercent);
    const encrypted = await encryptSetup(env, clean);
    const now = Date.now();
    await env.DB.prepare(`INSERT INTO account_setup (wtink_id, setup_ciphertext, setup_iv, updated_at) VALUES (?1,?2,?3,?4) ON CONFLICT(wtink_id) DO UPDATE SET setup_ciphertext=excluded.setup_ciphertext, setup_iv=excluded.setup_iv, updated_at=excluded.updated_at`).bind(owner.wtink_id,encrypted.ciphertext,encrypted.iv,now).run();
    return json({ok:true,configured:true,setup:clean,updatedAt:now},200,origin);
  }

  if (request.method === 'PUT' && path === '/auth/pin') {
    const owner = await authProfile(request, env);
    if (!owner) return json({error:'UNAUTHORIZED'},401,origin);
    const input = await body(request);
    const pin = String(input?.pin || '');
    if (!validPin(pin)) return json({error:'INVALID_PIN'},400,origin);
    const result = await hashPin(pin);
    await env.DB.prepare('UPDATE profiles SET pin_hash = ?1, pin_salt = ?2, pin_failed_attempts = 0, pin_locked_until = 0, updated_at = ?3 WHERE wtink_id = ?4').bind(result.hash,result.salt,Date.now(),owner.wtink_id).run();
    return json({ok:true},200,origin);
  }

  if (request.method === 'POST' && path === '/profiles') {
    const input = await body(request);
    const raw = input?.profile || {};
    const wtinkId = normalizeId(raw.profileId);
    const name = cleanText(raw.name, NAME_MAX);
    const position = cleanText(raw.position, POSITION_MAX);
    const avatar = cleanAvatar(raw.avatar);
    const requestedUsername = cleanUsername(raw.username);
    const pin = String(input?.pin || '');
    if (!validId(wtinkId) || !name || !position || !validPin(pin) || (raw.username && !requestedUsername)) return json({error: !validPin(pin) ? 'INVALID_PIN' : 'INVALID_USERNAME'}, 400, origin);

    const existing = await env.DB.prepare('SELECT wtink_id FROM profiles WHERE wtink_id = ?1').bind(wtinkId).first();
    if (existing) return json({error: 'WTINK_ID_TAKEN'}, 409, origin);

    const token = randomToken();
    const tokenHash = await sha256(token);
    const pinData = await hashPin(pin);
    const webauthnUserId = randomToken();
    const now = Date.now();
    const username = await uniqueUsername(env, requestedUsername);
    try {
      await env.DB.prepare(`
        INSERT INTO profiles (wtink_id, name, position, avatar, username, is_dev, is_admin, token_hash, pin_hash, pin_salt, webauthn_user_id, created_at, updated_at, last_seen)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12, ?12)
      `).bind(wtinkId, name, position, avatar, username, wtinkId === DEV_WTINK_ID ? 1 : 0, wtinkId === DEV_WTINK_ID ? 1 : 0, tokenHash, pinData.hash, pinData.salt, webauthnUserId, now).run();
    } catch (error) {
      if (String(error).toLowerCase().includes('unique')) return json({error: 'WTINK_ID_TAKEN'}, 409, origin);
      throw error;
    }
    const session = await createAuthSession(env, wtinkId, token, now, String(input?.deviceName || 'Устройство'));
    return json({profile: publicProfile({wtink_id:wtinkId,name,position,avatar,username}), token, sessionId:session.sessionId, security:{pinSet:true,onePassAvailable:false}}, 201, origin);
  }

  const chatSearchMatch = path.match(/^\/chat\/messages\/([^/]+)\/search$/);
  if (chatSearchMatch && request.method === 'GET') {
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin);
    const peerId=decodeURIComponent(chatSearchMatch[1]); const url=new URL(request.url);
    const q=(url.searchParams.get('q')||'').trim().slice(0,120); const limit=Math.min(Math.max(Number(url.searchParams.get('limit')||30),1),100);
    if(!q)return json({messages:[]},200,origin);
    const peer=await env.DB.prepare('SELECT 1 FROM profiles WHERE wtink_id=?1').bind(peerId).first();
    if(!peer)return json({error:'PROFILE_NOT_FOUND'},404,origin);
    const rows=await env.DB.prepare("SELECT id,from_id,to_id,body,kind,mime,name,created_at,read_at,edited_at,deleted_at,reply_to_id,reply_preview,note_date,note_shift FROM social_messages WHERE ((from_id=?1 AND to_id=?2) OR (from_id=?2 AND to_id=?1)) AND deleted_at IS NULL AND lower(COALESCE(reply_preview,'')) LIKE lower(?3) ORDER BY created_at DESC LIMIT ?4").bind(owner.wtink_id,peerId,'%'+q+'%',limit).all();
    return json({messages:(rows.results||[]).map(m=>({id:m.id,from:displayId(m.from_id),to:displayId(m.to_id),body:m.body,kind:m.kind,mime:m.mime,name:m.name,createdAt:m.created_at,readAt:m.read_at,editedAt:m.edited_at,deletedAt:m.deleted_at,replyToId:m.reply_to_id,replyPreview:m.reply_preview,noteDate:m.note_date,noteShift:m.note_shift}))},200,origin);
  }
  const chatReactionMatch = path.match(/^\/chat\/messages\/([^/]+)\/reactions$/);
  if (chatReactionMatch && request.method === 'GET') {
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin);
    const messageId=decodeURIComponent(chatReactionMatch[1]);
    const message=await env.DB.prepare('SELECT id,from_id,to_id FROM social_messages WHERE id=?1').bind(messageId).first();
    if(!message)return json({error:'MESSAGE_NOT_FOUND'},404,origin);
    if(message.from_id!==owner.wtink_id && message.to_id!==owner.wtink_id)return json({error:'FORBIDDEN'},403,origin);
    const rows=await env.DB.prepare('SELECT emoji,profile_id FROM chat_message_reactions WHERE message_id=?1 ORDER BY created_at ASC').bind(messageId).all();
    return json({reactions:(rows.results||[]).map(r=>({emoji:r.emoji,profileId:displayId(r.profile_id)}))},200,origin);
  }
  if (chatReactionMatch && request.method === 'PUT') {
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin);
    const messageId=decodeURIComponent(chatReactionMatch[1]); const input=await body(request);
    const emoji=cleanText(input?.emoji,16);
    if(!emoji)return json({error:'INVALID_REACTION'},400,origin);
    const message=await env.DB.prepare('SELECT id,from_id,to_id FROM social_messages WHERE id=?1').bind(messageId).first();
    if(!message)return json({error:'MESSAGE_NOT_FOUND'},404,origin);
    if(message.from_id!==owner.wtink_id && message.to_id!==owner.wtink_id)return json({error:'FORBIDDEN'},403,origin);
    const now=Date.now();
    await env.DB.prepare('INSERT INTO chat_message_reactions(message_id,profile_id,emoji,created_at) VALUES(?1,?2,?3,?4) ON CONFLICT(message_id,profile_id) DO UPDATE SET emoji=excluded.emoji,created_at=excluded.created_at').bind(messageId,owner.wtink_id,emoji,now).run();
    return json({ok:true,reaction:{emoji,profileId:displayId(owner.wtink_id)}},200,origin);
  }
  if (chatReactionMatch && request.method === 'DELETE') {
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin);
    const messageId=decodeURIComponent(chatReactionMatch[1]);
    await env.DB.prepare('DELETE FROM chat_message_reactions WHERE message_id=?1 AND profile_id=?2').bind(messageId,owner.wtink_id).run();
    return json({ok:true},200,origin);
  }
  const chatPinListMatch = path.match(/^\/chat\/messages\/([^/]+)\/pins$/);
  if (chatPinListMatch && request.method === 'GET') {
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin);
    const peerId=normalizeId(decodeURIComponent(chatPinListMatch[1]));
    if(!validId(peerId))return json({error:'INVALID_ID'},400,origin);
    const peer=await env.DB.prepare('SELECT wtink_id FROM profiles WHERE wtink_id=?1').bind(peerId).first();
    if(!peer)return json({error:'PROFILE_NOT_FOUND'},404,origin);
    const rows=await env.DB.prepare('SELECT p.message_id,p.profile_id,p.created_at,m.sender_id,m.receiver_id,m.body,m.kind,mime,name,m.created_at AS message_created_at,m.reply_to_id,m.reply_preview,m.note_date,m.note_shift FROM chat_message_pins p JOIN social_messages m ON m.id=p.message_id WHERE ((m.sender_id=?1 AND m.receiver_id=?2) OR (m.sender_id=?2 AND m.receiver_id=?1)) ORDER BY p.created_at DESC LIMIT 100').bind(owner.wtink_id,peerId).all();
    return json({pins:(rows.results||[]).map(r=>({messageId:r.message_id,pinnedBy:displayId(r.profile_id),pinnedAt:Number(r.created_at),message:{id:r.message_id,from:displayId(r.sender_id),to:displayId(r.receiver_id),body:r.body,kind:r.kind||'text',mime:r.mime||null,name:r.name||null,createdAt:Number(r.message_created_at),replyToId:r.reply_to_id||null,replyPreview:r.reply_preview||null,noteDate:r.note_date||null,noteShift:r.note_shift||null}}))},200,origin);
  }
  const chatPinMatch = path.match(/^\/chat\/messages\/([^/]+)\/pin$/);
  if (chatPinMatch && (request.method === 'PUT' || request.method === 'DELETE')) {
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin);
    const messageId=decodeURIComponent(chatPinMatch[1]);
    const message=await env.DB.prepare('SELECT id,sender_id,receiver_id FROM social_messages WHERE id=?1').bind(messageId).first();
    if(!message)return json({error:'MESSAGE_NOT_FOUND'},404,origin);
    if(message.sender_id!==owner.wtink_id && message.receiver_id!==owner.wtink_id)return json({error:'FORBIDDEN'},403,origin);
    if(request.method==='DELETE'){
      await env.DB.prepare('DELETE FROM chat_message_pins WHERE message_id=?1').bind(messageId).run();
      return json({ok:true},200,origin);
    }
    await env.DB.prepare('INSERT OR REPLACE INTO chat_message_pins(message_id,profile_id,created_at) VALUES(?1,?2,?3)').bind(messageId,owner.wtink_id,Date.now()).run();
    return json({ok:true,messageId,pinnedBy:displayId(owner.wtink_id)},200,origin);
  }
  const groupReactionMatch = path.match(/^\/chat\/groups\/([^/]+)\/messages\/([^/]+)\/reactions$/);
  if (groupReactionMatch && request.method === 'GET') {
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin);
    const groupId=decodeURIComponent(groupReactionMatch[1]),messageId=decodeURIComponent(groupReactionMatch[2]);
    const member=await env.DB.prepare('SELECT 1 FROM chat_group_members WHERE group_id=?1 AND profile_id=?2').bind(groupId,owner.wtink_id).first();
    if(!member)return json({error:'NOT_GROUP_MEMBER'},403,origin);
    const rows=await env.DB.prepare('SELECT emoji,profile_id FROM chat_group_message_reactions WHERE message_id=?1 ORDER BY created_at ASC').bind(messageId).all();
    return json({reactions:(rows.results||[]).map(r=>({emoji:r.emoji,profileId:displayId(r.profile_id)}))},200,origin);
  }
  if (groupReactionMatch && request.method === 'PUT') {
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin);
    const groupId=decodeURIComponent(groupReactionMatch[1]),messageId=decodeURIComponent(groupReactionMatch[2]); const input=await body(request);
    const emoji=cleanText(input?.emoji,16); if(!emoji)return json({error:'INVALID_REACTION'},400,origin);
    const member=await env.DB.prepare('SELECT 1 FROM chat_group_members WHERE group_id=?1 AND profile_id=?2').bind(groupId,owner.wtink_id).first();
    if(!member)return json({error:'NOT_GROUP_MEMBER'},403,origin);
    const message=await env.DB.prepare('SELECT id FROM chat_group_messages WHERE id=?1 AND group_id=?2').bind(messageId,groupId).first();
    if(!message)return json({error:'MESSAGE_NOT_FOUND'},404,origin);
    await env.DB.prepare('INSERT INTO chat_group_message_reactions(message_id,profile_id,emoji,created_at) VALUES(?1,?2,?3,?4) ON CONFLICT(message_id,profile_id) DO UPDATE SET emoji=excluded.emoji,created_at=excluded.created_at').bind(messageId,owner.wtink_id,emoji,Date.now()).run();
    return json({ok:true,reaction:{emoji,profileId:displayId(owner.wtink_id)}},200,origin);
  }
  if (groupReactionMatch && request.method === 'DELETE') {
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin);
    const messageId=decodeURIComponent(groupReactionMatch[2]);
    await env.DB.prepare('DELETE FROM chat_group_message_reactions WHERE message_id=?1 AND profile_id=?2').bind(messageId,owner.wtink_id).run();
    return json({ok:true},200,origin);
  }

  if (request.method === 'POST' && path === '/auth/onepass/register/options') {
    const owner = await authProfile(request, env);
    if (!owner) return json({error:'UNAUTHORIZED'},401,origin);
    const {generateRegistrationOptions} = await import('@simplewebauthn/server');
    const rpID = webAuthnRpId(request,env);
    const webOrigin = webAuthnOrigin(request,env);
    if (!rpID || !webOrigin) return json({error:'WEBAUTHN_ORIGIN_REQUIRED'},400,origin);
    const webauthnUserId = owner.webauthn_user_id || randomToken();
    if (!owner.webauthn_user_id) await env.DB.prepare('UPDATE profiles SET webauthn_user_id = ?1 WHERE wtink_id = ?2').bind(webauthnUserId,owner.wtink_id).run();
    const options = await generateRegistrationOptions({
      rpName:'WorkerTink',
      rpID,
      userID:new TextEncoder().encode(webauthnUserId),
      userName:owner.wtink_id,
      userDisplayName:owner.name,
      attestationType:'none',
      supportedAlgorithmIDs:[-7,-257],
      authenticatorSelection:{residentKey:'preferred',userVerification:'preferred'},
      excludeCredentials:(await env.DB.prepare('SELECT id,transports FROM webauthn_credentials WHERE profile_id = ?1').bind(owner.wtink_id).all()).results.map(item=>({id:item.id,transports:JSON.parse(item.transports||'[]')}))
    });
    const now=Date.now();
    await env.DB.batch([
      env.DB.prepare('DELETE FROM auth_challenges WHERE profile_id = ?1 AND kind = ?2').bind(owner.wtink_id,'onepass_register'),
      env.DB.prepare('INSERT INTO auth_challenges(id,profile_id,kind,challenge,expires_at,created_at) VALUES (?1,?2,?3,?4,?5,?6)').bind(crypto.randomUUID(),owner.wtink_id,'onepass_register',options.challenge,now+5*60*1000,now)
    ]);
    return json(options,200,origin);
  }

  if (request.method === 'POST' && path === '/auth/onepass/register/verify') {
    const owner = await authProfile(request, env);
    if (!owner) return json({error:'UNAUTHORIZED'},401,origin);
    const input = await body(request);
    const response = input?.response;
    const deviceName = cleanText(input?.deviceName, 120) || 'Устройство';
    if (!response?.id) return json({error:'INVALID_ONEPASS_RESPONSE'},400,origin);
    const clientChallenge = webAuthnClientChallenge(response);
    const challenge = await env.DB.prepare(`SELECT id, challenge FROM auth_challenges WHERE profile_id = ?1 AND kind = 'onepass_register' AND challenge = ?2 AND expires_at > ?3 LIMIT 1`).bind(owner.wtink_id,clientChallenge,Date.now()).first();
    if (!challenge) return json({error:'ONEPASS_CHALLENGE_EXPIRED'},410,origin);
    const {verifyRegistrationResponse} = await import('@simplewebauthn/server');
    const rpID = webAuthnRpId(request,env);
    const webOrigin = webAuthnOrigin(request,env);
    let verification;
    try {
      verification = await verifyRegistrationResponse({response,expectedChallenge:challenge.challenge,expectedOrigin:webOrigin,expectedRPID:rpID});
    } catch (error) {
      console.error('[ONEPASS REGISTER] verification failed', {
        name: error instanceof Error ? error.name : typeof error,
        message: error instanceof Error ? error.message : String(error),
        rpID,
        webOrigin,
        responseId: response?.id || null
      });
      return json({error:'ONEPASS_VERIFICATION_FAILED'},400,origin);
    }
    if (!verification.verified || !verification.registrationInfo) {
      console.error('[ONEPASS REGISTER] verification returned unverified', {
        verified: Boolean(verification?.verified),
        hasRegistrationInfo: Boolean(verification?.registrationInfo),
        rpID,
        webOrigin,
        responseId: response?.id || null
      });
      return json({error:'ONEPASS_VERIFICATION_FAILED'},400,origin);
    }
    const {credential,credentialDeviceType,credentialBackedUp}=verification.registrationInfo;
    if(!credential?.id || !credential?.publicKey) return json({error:'ONEPASS_CREDENTIAL_INVALID'},400,origin);
    const now=Date.now();
    try {
      await env.DB.batch([
        env.DB.prepare(`INSERT OR REPLACE INTO webauthn_credentials(id,profile_id,user_id,public_key,counter,device_type,backed_up,transports,device_name,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)`).bind(credential.id,owner.wtink_id,owner.webauthn_user_id || owner.wtink_id,base64Url(credential.publicKey),credential.counter,credentialDeviceType,credentialBackedUp?1:0,JSON.stringify(credential.transports||[]),deviceName,now,now),
        env.DB.prepare('DELETE FROM auth_challenges WHERE id = ?1').bind(challenge.id)
      ]);
    } catch(error) {
      return json({error:'ONEPASS_STORAGE_FAILED',detail:String(error).slice(0,220)},500,origin);
    }
    return json({ok:true},200,origin);
  }

  if (request.method === 'GET' && path === '/auth/onepass') {
    const owner = await authProfile(request, env);
    if (!owner) return json({error:'UNAUTHORIZED'},401,origin);
    const rows = await env.DB.prepare('SELECT id, device_type, backed_up, transports, device_name, created_at, updated_at FROM webauthn_credentials WHERE profile_id = ?1 ORDER BY created_at DESC').bind(owner.wtink_id).all();
    return json({devices:(rows.results||[]).map(r=>({id:r.id,deviceType:r.device_type||'singleDevice',backedUp:Boolean(r.backed_up),transports:JSON.parse(r.transports||'[]'),deviceName:r.device_name||'Устройство',createdAt:Number(r.created_at||0),updatedAt:Number(r.updated_at||0)}))},200,origin);
  }

  if (request.method === 'GET' && path === '/auth/onepass/available') {
    const wtinkId = normalizeId(url.searchParams.get('profileId'));
    if (!validId(wtinkId)) return json({available:false},200,origin);
    const row = await env.DB.prepare('SELECT COUNT(*) AS count FROM webauthn_credentials WHERE profile_id = ?1').bind(wtinkId).first();
    return json({available:Number(row?.count||0)>0},200,origin);
  }

  if (request.method === 'GET' && path === '/auth/onepass/login/options') {
    const wtinkId = normalizeId(url.searchParams.get('profileId'));
    if (!validId(wtinkId)) return json({error:'INVALID_CREDENTIALS'},400,origin);
    const owner = await env.DB.prepare('SELECT wtink_id FROM profiles WHERE wtink_id = ?1').bind(wtinkId).first();
    if (!owner) return json({error:'INVALID_CREDENTIALS'},401,origin);
    const credentials = await env.DB.prepare('SELECT id, transports FROM webauthn_credentials WHERE profile_id = ?1').bind(wtinkId).all();
    if (!(credentials.results||[]).length) return json({error:'ONEPASS_NOT_ENABLED'},404,origin);
    const {generateAuthenticationOptions}=await import('@simplewebauthn/server');
    const rpID=webAuthnRpId(request,env);
    const webOrigin=webAuthnOrigin(request,env);
    if(!rpID||!webOrigin)return json({error:'WEBAUTHN_ORIGIN_REQUIRED'},400,origin);
    const options=await generateAuthenticationOptions({rpID,userVerification:'preferred',allowCredentials:(credentials.results||[]).map(item=>({id:item.id,transports:JSON.parse(item.transports||'[]')}))});
    const now=Date.now();
    await env.DB.batch([
      env.DB.prepare('DELETE FROM auth_challenges WHERE profile_id = ?1 AND kind = ?2 AND expires_at <= ?3').bind(wtinkId,'onepass_login',now),
      env.DB.prepare('INSERT INTO auth_challenges(id,profile_id,kind,challenge,expires_at,created_at) VALUES (?1,?2,?3,?4,?5,?6)').bind(crypto.randomUUID(),wtinkId,'onepass_login',options.challenge,now+5*60*1000,now)
    ]);
    return json(options,200,origin);
  }

  if (request.method === 'POST' && path === '/auth/onepass/login/verify') {
    const input=await body(request);
    const response=input?.response;
    if(!response?.id)return json({error:'INVALID_ONEPASS_RESPONSE'},400,origin);
    const credential=await env.DB.prepare(`SELECT id, profile_id, user_id, public_key, counter, transports FROM webauthn_credentials WHERE id = ?1`).bind(response.id).first();
    if(!credential)return json({error:'INVALID_CREDENTIALS'},401,origin);
    const clientChallenge=webAuthnClientChallenge(response);
    const challenge=await env.DB.prepare(`SELECT id, challenge FROM auth_challenges WHERE profile_id = ?1 AND kind = 'onepass_login' AND challenge = ?2 AND expires_at > ?3 LIMIT 1`).bind(credential.profile_id,clientChallenge,Date.now()).first();
    if(!challenge)return json({error:'ONEPASS_CHALLENGE_EXPIRED'},410,origin);
    const {verifyAuthenticationResponse}=await import('@simplewebauthn/server');
    const rpID=webAuthnRpId(request,env);
    const webOrigin=webAuthnOrigin(request,env);
    let verification;
    try {
      verification=await verifyAuthenticationResponse({response,expectedChallenge:challenge.challenge,expectedOrigin:webOrigin,expectedRPID:rpID,credential:{id:credential.id,publicKey:fromBase64Url(credential.public_key),counter:Number(credential.counter||0),transports:JSON.parse(credential.transports||'[]')}});
    } catch { return json({error:'ONEPASS_VERIFICATION_FAILED'},401,origin); }
    if(!verification.verified)return json({error:'ONEPASS_VERIFICATION_FAILED'},401,origin);
    const owner=await env.DB.prepare('SELECT wtink_id,name,position,avatar,is_dev,is_admin FROM profiles WHERE wtink_id = ?1').bind(credential.profile_id).first();
    if(!owner)return json({error:'INVALID_CREDENTIALS'},401,origin);
    const token=randomToken();
    const now=Date.now();
    const session=await createAuthSession(env,owner.wtink_id,token,now,String(input?.deviceName||'OnePass устройство'));
    await env.DB.batch([
      env.DB.prepare('UPDATE webauthn_credentials SET counter = ?1, updated_at = ?2 WHERE id = ?3').bind(verification.authenticationInfo.newCounter,now,credential.id),
      env.DB.prepare('UPDATE profiles SET updated_at = ?1, last_seen = ?1 WHERE wtink_id = ?2').bind(now,owner.wtink_id),
      env.DB.prepare('DELETE FROM auth_challenges WHERE id = ?1').bind(challenge.id)
    ]);
    return json({profile:publicProfile(owner),token,sessionId:session.sessionId,deviceName:String(input?.deviceName||'OnePass устройство'),security:{pinSet:true,onePassAvailable:true}},200,origin);
  }

  const onePassDeleteMatch = path.match(/^\/auth\/onepass\/([^/]+)$/);
  if (onePassDeleteMatch && request.method === 'DELETE') {
    const owner=await authProfile(request,env);
    if(!owner)return json({error:'UNAUTHORIZED'},401,origin);
    const credentialId=decodeURIComponent(onePassDeleteMatch[1]);
    const row=await env.DB.prepare('SELECT id FROM webauthn_credentials WHERE id=?1 AND profile_id=?2').bind(credentialId,owner.wtink_id).first();
    if(!row)return json({error:'ONEPASS_DEVICE_NOT_FOUND'},404,origin);
    await env.DB.prepare('DELETE FROM webauthn_credentials WHERE id=?1').bind(credentialId).run();
    return json({ok:true},200,origin);
  }
  if (request.method === 'DELETE' && path === '/auth/onepass') {
    const owner=await authProfile(request,env);
    if(!owner)return json({error:'UNAUTHORIZED'},401,origin);
    await env.DB.prepare('DELETE FROM webauthn_credentials WHERE profile_id = ?1').bind(owner.wtink_id).run();
    return json({ok:true},200,origin);
  }

  if (request.method === 'PUT' && path === '/chat/keys') {
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin);
    const input=await body(request); const publicKey=input?.publicKey;
    if(!publicKey||publicKey.kty!=='EC'||publicKey.crv!=='P-256'||typeof publicKey.x!=='string'||typeof publicKey.y!=='string')return json({error:'INVALID_CHAT_KEY'},400,origin);
    const now=Date.now();
    const existing=await env.DB.prepare('SELECT public_key,updated_at FROM chat_device_keys WHERE profile_id=?1').bind(owner.wtink_id).first();
    const incoming=JSON.stringify(publicKey);
    if(existing && String(existing.public_key)!==incoming){
      return json({error:'CHAT_KEY_ROTATION_BLOCKED',key:{profileId:displayId(owner.wtink_id),publicKey:JSON.parse(existing.public_key),updatedAt:Number(existing.updated_at||0)}},409,origin);
    }
    await env.DB.prepare(`INSERT INTO chat_device_keys(profile_id,public_key,updated_at) VALUES (?1,?2,?3) ON CONFLICT(profile_id) DO UPDATE SET updated_at=excluded.updated_at`).bind(owner.wtink_id,incoming,now).run();
    return json({ok:true,key:{profileId:displayId(owner.wtink_id),publicKey,updatedAt:now}},200,origin);
  }
  if(request.method==='GET'&&path==='/chat/keys/me'){
    const owner=await authProfile(request,env);if(!owner)return json({error:'UNAUTHORIZED'},401,origin);
    const row=await env.DB.prepare('SELECT public_key,updated_at FROM chat_device_keys WHERE profile_id=?1').bind(owner.wtink_id).first();
    if(!row)return json({error:'CHAT_KEY_NOT_READY'},404,origin);
    return json({key:{profileId:displayId(owner.wtink_id),publicKey:JSON.parse(row.public_key),updatedAt:Number(row.updated_at||0)}},200,origin);
  }
  const chatKeyMatch=path.match(/^\/chat\/keys\/([^/]+)$/);
  if(chatKeyMatch&&request.method==='GET'){
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin); const target=normalizeId(decodeURIComponent(chatKeyMatch[1]));
    if(!validId(target))return json({error:'INVALID_ID'},400,origin);
    const isSelf=target===normalizeId(owner.wtink_id);
    const groupMember=await env.DB.prepare('SELECT 1 FROM chat_group_members WHERE group_id IN (SELECT group_id FROM chat_group_members WHERE profile_id=?1) AND profile_id=?2 LIMIT 1').bind(owner.wtink_id,target).first();
    const friend=await env.DB.prepare(`SELECT 1 FROM friend_requests WHERE status='accepted' AND ((sender_id=?1 AND receiver_id=?2) OR (sender_id=?2 AND receiver_id=?1)) LIMIT 1`).bind(owner.wtink_id,target).first();
    if(!isSelf&&!friend&&!groupMember)return json({error:'NOT_FRIENDS'},403,origin);
    const row=await env.DB.prepare('SELECT public_key,updated_at FROM chat_device_keys WHERE profile_id=?1').bind(target).first();
    if(!row)return json({error:'CHAT_KEY_NOT_READY'},404,origin);
    return json({key:{profileId:displayId(target),publicKey:JSON.parse(row.public_key),updatedAt:Number(row.updated_at)}},200,origin);
  }
  if (request.method === 'DELETE' && path === '/auth/session') {
    const token = bearer(request);
    if (!token) return json({error:'UNAUTHORIZED'},401,origin);
    const tokenHash = await sha256(token);
    await env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash = ?1').bind(tokenHash).run();
    return json({ok:true},200,origin);
  }

  if (request.method === 'DELETE' && path === '/profiles') {
    const owner = await authProfile(request, env);
    if (!owner) return json({error: 'UNAUTHORIZED'}, 401, origin);
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare('DELETE FROM peer_sessions WHERE initiator_id = ?1 OR receiver_id = ?1').bind(owner.wtink_id),
      env.DB.prepare('DELETE FROM friend_requests WHERE sender_id = ?1 OR receiver_id = ?1').bind(owner.wtink_id),
      env.DB.prepare('DELETE FROM push_subscriptions WHERE profile_id = ?1').bind(owner.wtink_id),
      env.DB.prepare('DELETE FROM auth_challenges WHERE profile_id = ?1').bind(owner.wtink_id),
      env.DB.prepare('DELETE FROM auth_sessions WHERE profile_id = ?1').bind(owner.wtink_id),
      env.DB.prepare('DELETE FROM webauthn_credentials WHERE profile_id = ?1').bind(owner.wtink_id),
      env.DB.prepare('DELETE FROM profiles WHERE wtink_id = ?1').bind(owner.wtink_id)
    ]);
    return json({ok: true, deletedAt: now}, 200, origin);
  }

  const profileMatch = path.match(/^\/profiles\/([^/]+)$/);
  if (request.method === 'GET' && profileMatch) {
    const wtinkId = normalizeId(decodeURIComponent(profileMatch[1]));
    if (!validId(wtinkId)) return json({error: 'USER_NOT_FOUND'}, 404, origin);
    const row = await env.DB.prepare('SELECT wtink_id, name, position, avatar, username, is_dev, is_admin FROM profiles WHERE wtink_id = ?1').bind(wtinkId).first();
    if (!row) return json({error: 'USER_NOT_FOUND'}, 404, origin);
    return json({profile: publicProfile(row)}, 200, origin);
  }

  if (request.method === 'PUT' && path === '/profiles') {
    const owner = await authProfile(request, env);
    if (!owner) return json({error: 'UNAUTHORIZED'}, 401, origin);
    const input = await body(request);
    const raw = input?.profile || {};
    const wtinkId = normalizeId(raw.profileId) || owner.wtink_id;
    const name = cleanText(raw.name, NAME_MAX) || owner.name;
    const position = cleanText(raw.position, POSITION_MAX) || owner.position;
    const avatar = raw.avatar === undefined ? (owner.avatar || '') : cleanAvatar(raw.avatar);
    const requestedUsername = cleanUsername(raw.username);
    if (wtinkId !== owner.wtink_id || !name || !position || (raw.username && !requestedUsername)) return json({error: 'INVALID_PROFILE'}, 400, origin);
    const current = await env.DB.prepare('SELECT username FROM profiles WHERE wtink_id=?1').bind(owner.wtink_id).first();
    const username = requestedUsername || current?.username || null;
    const conflict = username ? await env.DB.prepare('SELECT wtink_id FROM profiles WHERE LOWER(username)=LOWER(?1) AND wtink_id<>?2').bind(username,owner.wtink_id).first() : null;
    if(conflict)return json({error:'USERNAME_TAKEN'},409,origin);
    const now = Date.now();
    await env.DB.prepare(`UPDATE profiles SET name = ?1, position = ?2, avatar = ?3, username = ?4, updated_at = ?5, last_seen = ?5 WHERE wtink_id = ?6`)
      .bind(name, position, avatar, username, now, owner.wtink_id).run();
    return json({profile: publicProfile({...owner,wtink_id:wtinkId,name,position,avatar,username})}, 200, origin);
  }

  if (request.method === 'GET' && path === '/user') {
    const username = cleanUsername(url.searchParams.get('username'));
    if(!username)return json({error:'INVALID_USERNAME'},400,origin);
    const row=await env.DB.prepare('SELECT wtink_id,name,position,avatar,username,is_dev,is_admin FROM profiles WHERE LOWER(username)=LOWER(?1)').bind(username).first();
    if(!row)return json({error:'USER_NOT_FOUND'},404,origin);
    return json({profile:publicProfile(row)},200,origin);
  }

  if (request.method === 'GET' && path === '/username/check') {
    const username=cleanUsername(url.searchParams.get('username'));
    if(!username)return json({valid:false,available:false},200,origin);
    const row=await env.DB.prepare('SELECT wtink_id FROM profiles WHERE LOWER(username)=LOWER(?1)').bind(username).first();
    return json({valid:true,available:!row},200,origin);
  }

  if (request.method === 'GET' && path === '/push/public-key') {
    const owner = await authProfile(request, env);
    if (!owner) return json({error: 'UNAUTHORIZED'}, 401, origin);
    if (!env.VAPID_PUBLIC_KEY) return json({error: 'PUSH_NOT_CONFIGURED'}, 503, origin);
    return json({publicKey: env.VAPID_PUBLIC_KEY}, 200, origin);
  }

  if (request.method === 'POST' && path === '/push/subscriptions') {
    const owner = await authProfile(request, env);
    if (!owner) return json({error: 'UNAUTHORIZED'}, 401, origin);
    const input = await body(request);
    const subscription = input?.subscription || {};
    const endpoint = typeof subscription.endpoint === 'string' ? subscription.endpoint.slice(0, 2048) : '';
    const p256dh = typeof subscription.keys?.p256dh === 'string' ? subscription.keys.p256dh.slice(0, 256) : '';
    const auth = typeof subscription.keys?.auth === 'string' ? subscription.keys.auth.slice(0, 256) : '';
    if (!/^https:\/\//.test(endpoint) || !p256dh || !auth) return json({error:'INVALID_PUSH_SUBSCRIPTION'},400,origin);
    const preferences = JSON.stringify(cleanPushPreferences(input?.preferences));
    const now = Date.now();
    await env.DB.prepare(`
      INSERT INTO push_subscriptions(endpoint, profile_id, expiration_time, p256dh, auth, preferences, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, COALESCE((SELECT created_at FROM push_subscriptions WHERE endpoint = ?1), ?7), ?7)
      ON CONFLICT(endpoint) DO UPDATE SET profile_id = excluded.profile_id, expiration_time = excluded.expiration_time, p256dh = excluded.p256dh, auth = excluded.auth, preferences = excluded.preferences, updated_at = excluded.updated_at
    `).bind(endpoint, owner.wtink_id, Number(subscription.expirationTime)||null, p256dh, auth, preferences, now).run();
    return json({ok:true}, 200, origin);
  }

  if (request.method === 'DELETE' && path === '/push/subscriptions') {
    const owner = await authProfile(request, env);
    if (!owner) return json({error: 'UNAUTHORIZED'}, 401, origin);
    const input = await body(request);
    const endpoint = typeof input?.endpoint === 'string' ? input.endpoint : '';
    await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?1 AND profile_id = ?2').bind(endpoint, owner.wtink_id).run();
    return json({ok:true}, 200, origin);
  }

  if (request.method === 'PUT' && path === '/push/subscriptions/preferences') {
    const owner = await authProfile(request, env);
    if (!owner) return json({error: 'UNAUTHORIZED'}, 401, origin);
    const input = await body(request);
    const endpoint = typeof input?.endpoint === 'string' ? input.endpoint : '';
    const preferences = JSON.stringify(cleanPushPreferences(input?.preferences));
    await env.DB.prepare('UPDATE push_subscriptions SET preferences = ?1, updated_at = ?2 WHERE endpoint = ?3 AND profile_id = ?4').bind(preferences, Date.now(), endpoint, owner.wtink_id).run();
    return json({ok:true}, 200, origin);
  }

  if (request.method === 'POST' && path === '/push/reminders') {
    const owner = await authProfile(request, env);
    if (!owner) return json({error:'UNAUTHORIZED'},401,origin);
    const input = await body(request);
    const reminders = Array.isArray(input?.reminders) ? input.reminders.slice(0,200) : [];
    const now = Date.now();
    const statements = [env.DB.prepare('DELETE FROM push_reminders WHERE profile_id = ?1').bind(owner.wtink_id)];
    for (const item of reminders) {
      if (!item || typeof item.id !== 'string' || !['shift','absence','payroll'].includes(item.kind)) continue;
      const dueAt = Number(item.dueAt);
      if (!Number.isFinite(dueAt) || dueAt < now - 24*60*60*1000 || dueAt > now + 120*24*60*60*1000) continue;
      const title = cleanText(item.title,120);
      const bodyText = cleanText(item.body,240);
      const tag = cleanText(item.tag,80);
      if (!title || !bodyText || !tag) continue;
      statements.push(env.DB.prepare(`INSERT INTO push_reminders(id,profile_id,kind,due_at,title,body,tag,sent_at,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,NULL,?8,?8)`).bind(item.id,owner.wtink_id,item.kind,Math.round(dueAt),title,bodyText,tag,now));
    }
    await env.DB.batch(statements);
    return json({ok:true},200,origin);
  }

  if (request.method === 'POST' && path === '/push/test') {
    const owner = await authProfile(request, env);
    if (!owner) return json({error:'UNAUTHORIZED'},401,origin);
    await notifyProfile(env, owner.wtink_id, 'test', {title:'WorkerTink',body:'Push-уведомления работают.',url:'./?tab=settings',tag:'workertink-test',urgency:'high'});
    return json({ok:true},200,origin);
  }

  if (request.method === 'POST' && path === '/presence/heartbeat') {
    const owner = await authProfile(request, env);
    if (!owner) return json({error: 'UNAUTHORIZED'}, 401, origin);
    const now = Date.now();
    await env.DB.prepare('UPDATE profiles SET last_seen = ?1 WHERE wtink_id = ?2').bind(now, owner.wtink_id).run();
    return json({ok:true,lastSeen:now}, 200, origin);
  }

  if (request.method === 'POST' && path === '/push/events') {
    const owner = await authProfile(request, env);
    if (!owner) return json({error:'UNAUTHORIZED'},401,origin);
    const input = await body(request);
    const target = normalizeId(input?.to);
    const kind = ['message','friendRequest','friendAccepted'].includes(String(input?.kind)) ? input.kind : '';
    if (!validId(target) || !kind || target === owner.wtink_id) return json({error:'INVALID_PUSH_EVENT'},400,origin);
    const friend = await env.DB.prepare(`SELECT 1 FROM friend_requests WHERE status='accepted' AND ((sender_id=?1 AND receiver_id=?2) OR (sender_id=?2 AND receiver_id=?1)) LIMIT 1`).bind(owner.wtink_id,target).first();
    if (!friend) return json({error:'NOT_FRIENDS'},403,origin);
    const titles={message:'Новое сообщение',friendRequest:'Новая заявка в друзья',friendAccepted:'Заявка принята'};
    const bodies={message:`Новое сообщение от ${displayId(owner.wtink_id)}`,friendRequest:`${owner.name} отправил(а) вам заявку в друзья`,friendAccepted:`${owner.name} принял(а) вашу заявку в друзья`};
    await notifyProfile(env,target,kind,{title:titles[kind],body:bodies[kind],url:'./?tab=friends',tag:`workertink-${kind}-${owner.wtink_id}`,urgency:kind==='message'?'high':'normal'});
    return json({ok:true},200,origin);
  }

  if (request.method === 'POST' && path === '/friend-requests') {
    const owner = await authProfile(request, env);
    if (!owner) return json({error: 'UNAUTHORIZED'}, 401, origin);
    const input = await body(request);
    const target = normalizeId(input?.to);
    if (!validId(target)) return json({error: 'USER_NOT_FOUND'}, 404, origin);
    if (target === owner.wtink_id) return json({error: 'SELF_REQUEST'}, 400, origin);
    const targetProfile = await env.DB.prepare('SELECT wtink_id, name, position, avatar, username, is_dev, is_admin FROM profiles WHERE wtink_id = ?1').bind(target).first();
    if (!targetProfile) return json({error: 'USER_NOT_FOUND'}, 404, origin);

    const existing = await env.DB.prepare(`
      SELECT id, sender_id, receiver_id, status, created_at, updated_at
      FROM friend_requests
      WHERE pair_key = ?1
      ORDER BY created_at DESC LIMIT 1
    `).bind(pairKey(owner.wtink_id, target)).first();
    if (existing?.status === 'pending') {
      const loaded = await loadRequest(env, existing.id);
      return json({error: 'REQUEST_EXISTS', request: requestView(loaded, profileFromJoined(loaded, 's'), profileFromJoined(loaded, 't'))}, 409, origin);
    }
    if (existing?.status === 'accepted') return json({error: 'ALREADY_FRIENDS'}, 409, origin);

    const id = crypto.randomUUID();
    const now = Date.now();
    try {
      await env.DB.prepare(`
        INSERT INTO friend_requests (id, sender_id, receiver_id, pair_key, status, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, 'pending', ?5, ?5)
      `).bind(id, owner.wtink_id, target, pairKey(owner.wtink_id, target), now).run();
    } catch (error) {
      if (String(error).toLowerCase().includes('unique')) return json({error: 'REQUEST_EXISTS'}, 409, origin);
      throw error;
    }
    const loaded = await loadRequest(env, id);
    await createSocialNotification(env, target, owner.wtink_id, 'friendRequest', id, 'Новая заявка в друзья', `${owner.name} хочет добавить вас в друзья`, './?tab=friends');
    await notifyProfile(env, target, 'friendRequest', {title:'Новая заявка в друзья', body:`${owner.name} хочет добавить вас в друзья`, url:'./?tab=social', tag:`wtink-friend-request-${id}`, urgency:'high'});
    return json({request: requestView(loaded, profileFromJoined(loaded, 's'), profileFromJoined(loaded, 't'))}, 201, origin);
  }

  const incoming = path === '/friend-requests/incoming';
  const outgoing = path === '/friend-requests/outgoing';
  if (request.method === 'GET' && (incoming || outgoing)) {
    const owner = await authProfile(request, env);
    if (!owner) return json({error: 'UNAUTHORIZED'}, 401, origin);
    const column = incoming ? 'receiver_id' : 'sender_id';
    const rows = await env.DB.prepare(`
      SELECT
        r.id, r.sender_id, r.receiver_id, r.status, r.created_at, r.updated_at,
        s.wtink_id AS s_id, s.name AS s_name, s.position AS s_position, s.avatar AS s_avatar, s.is_dev AS s_is_dev, s.is_admin AS s_is_admin,
        t.wtink_id AS t_id, t.name AS t_name, t.position AS t_position, t.avatar AS t_avatar, t.is_dev AS t_is_dev, t.is_admin AS t_is_admin
      FROM friend_requests r
      JOIN profiles s ON s.wtink_id = r.sender_id
      JOIN profiles t ON t.wtink_id = r.receiver_id
      WHERE r.${column} = ?1
      ORDER BY r.created_at DESC
      LIMIT 100
    `).bind(owner.wtink_id).all();
    return json({requests: (rows.results || []).map(row => requestView(row, profileFromJoined(row, 's'), profileFromJoined(row, 't')))}, 200, origin);
  }

  const action = path.match(/^\/friend-requests\/([^/]+)\/(accept|decline)$/);
  if (request.method === 'POST' && action) {
    const owner = await authProfile(request, env);
    if (!owner) return json({error: 'UNAUTHORIZED'}, 401, origin);
    const row = await loadRequest(env, action[1]);
    if (!row) return json({error: 'REQUEST_NOT_FOUND'}, 404, origin);
    if (row.receiver_id !== owner.wtink_id) return json({error: 'FORBIDDEN'}, 403, origin);
    if (row.status !== 'pending') return json({error: 'REQUEST_ALREADY_HANDLED'}, 409, origin);
    const status = action[2] === 'accept' ? 'accepted' : 'declined';
    await env.DB.prepare('UPDATE friend_requests SET status = ?1, updated_at = ?2 WHERE id = ?3 AND status = \'pending\'')
      .bind(status, Date.now(), action[1]).run();
    const updated = await loadRequest(env, action[1]);
    if (status === 'accepted') { await createSocialNotification(env, row.sender_id, owner.wtink_id, 'friendAccepted', action[1], 'Заявка принята', `${owner.name} принял(а) вашу заявку в друзья`, './?tab=friends'); await notifyProfile(env, row.sender_id, 'friendAccepted', {title:'Заявка принята',body:`${owner.name} принял(а) вашу заявку в друзья`,url:'./?tab=social',tag:`workertink-friend-accepted-${owner.wtink_id}`}); }
    return json({request: requestView(updated, profileFromJoined(updated, 's'), profileFromJoined(updated, 't'))}, 200, origin);
  }


  const peerSessionPath = path.match(/^\/peer-sessions\/([^/]+)\/answer$/);

  if (request.method === 'GET' && path === '/webrtc/ice-servers') {
    const owner = await authProfile(request, env);
    if (!owner) return json({error: 'UNAUTHORIZED'}, 401, origin);
    const fallback = [
      {urls: 'stun:stun.cloudflare.com:3478'},
      {urls: 'stun:stun.l.google.com:19302'},
      {urls: 'stun:stun1.l.google.com:19302'}
    ];
    if (!env.TURN_KEY_ID || !env.TURN_KEY_TOKEN) return json({iceServers: fallback}, 200, origin);
    try {
      const response = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(env.TURN_KEY_ID)}/credentials/generate-ice-servers`, {
        method: 'POST',
        headers: {'Authorization': `Bearer ${env.TURN_KEY_TOKEN}`, 'Content-Type': 'application/json'},
        body: JSON.stringify({ttl: 3600})
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(data?.iceServers)) return json({iceServers: fallback}, 200, origin);
      const iceServers = data.iceServers.filter((server) => server && server.urls && server.username && server.credential);
      return json({iceServers: [...fallback, ...iceServers]}, 200, origin);
    } catch {
      return json({iceServers: fallback}, 200, origin);
    }
  }

  const friendAction=path.match(/^\/friends\/([^/]+)(?:\/(block))?$/);
  if(friendAction && request.method==='DELETE' && !friendAction[2]){const owner=await authProfile(request,env);if(!owner)return json({error:'UNAUTHORIZED'},401,origin);const target=normalizeId(decodeURIComponent(friendAction[1]));await env.DB.prepare(`DELETE FROM friend_requests WHERE status='accepted' AND ((sender_id=?1 AND receiver_id=?2) OR (sender_id=?2 AND receiver_id=?1))`).bind(owner.wtink_id,target).run();return json({ok:true},200,origin)}
  if(friendAction && request.method==='POST' && friendAction[2]){const owner=await authProfile(request,env);if(!owner)return json({error:'UNAUTHORIZED'},401,origin);const target=normalizeId(decodeURIComponent(friendAction[1]));await env.DB.prepare('INSERT OR REPLACE INTO blocked_profiles(profile_id,blocked_id,created_at) VALUES (?1,?2,?3)').bind(owner.wtink_id,target,Date.now()).run();await env.DB.prepare(`DELETE FROM friend_requests WHERE (sender_id=?1 AND receiver_id=?2) OR (sender_id=?2 AND receiver_id=?1)`).bind(owner.wtink_id,target).run();return json({ok:true},200,origin)}
  if(friendAction && request.method==='DELETE' && friendAction[2]){const owner=await authProfile(request,env);if(!owner)return json({error:'UNAUTHORIZED'},401,origin);const target=normalizeId(decodeURIComponent(friendAction[1]));await env.DB.prepare('DELETE FROM blocked_profiles WHERE profile_id=?1 AND blocked_id=?2').bind(owner.wtink_id,target).run();return json({ok:true},200,origin)}
  if(path==='/chat/mute' && request.method==='PUT'){const owner=await authProfile(request,env);if(!owner)return json({error:'UNAUTHORIZED'},401,origin);const input=await body(request);const target=normalizeId(input?.peerId);let until=input?.mutedUntil===null?null:Number(input?.mutedUntil||0);if(until===0)until=0;if(!validId(target))return json({error:'INVALID_ID'},400,origin);await env.DB.prepare('INSERT OR REPLACE INTO chat_mutes(profile_id,peer_id,muted_until,updated_at) VALUES (?1,?2,?3,?4)').bind(owner.wtink_id,target,until,Date.now()).run();return json({ok:true,mute:{peerId:displayId(target),mutedUntil:until}},200,origin)}
  const muteMatch=path.match(/^\/chat\/mute\/([^/]+)$/); if(muteMatch&&request.method==='GET'){const owner=await authProfile(request,env);if(!owner)return json({error:'UNAUTHORIZED'},401,origin);const target=normalizeId(decodeURIComponent(muteMatch[1]));const row=await env.DB.prepare('SELECT muted_until FROM chat_mutes WHERE profile_id=?1 AND peer_id=?2').bind(owner.wtink_id,target).first();const until=row?.muted_until===null?null:Number(row?.muted_until||0);return json({mute:{peerId:displayId(target),mutedUntil:until}},200,origin)}

  if (request.method === 'POST' && path === '/peer-sessions') {
    const owner = await authProfile(request, env);
    if (!owner) return json({error: 'UNAUTHORIZED'}, 401, origin);
    const input = await body(request);
    const target = normalizeId(input?.to);
    const offer = typeof input?.offer === 'string' ? input.offer.slice(0, 200000) : '';
    if (!validId(target) || !offer) return json({error: 'INVALID_SESSION'}, 400, origin);
    if (target === owner.wtink_id) return json({error: 'SELF_SESSION'}, 400, origin);
    const friend = await env.DB.prepare(`
      SELECT 1 FROM friend_requests
      WHERE status = 'accepted' AND ((sender_id = ?1 AND receiver_id = ?2) OR (sender_id = ?2 AND receiver_id = ?1))
      LIMIT 1
    `).bind(owner.wtink_id, target).first();
    if (!friend) return json({error: 'NOT_FRIENDS'}, 403, origin);
    const now = Date.now();
    const expires = now + PEER_SESSION_TTL_MS;
    await env.DB.prepare(`UPDATE peer_sessions SET status = 'expired', updated_at = ?1 WHERE expires_at < ?1 AND status = 'pending'`).bind(now).run();
    // A new connection attempt supersedes every older signaling session for this pair.
    // This prevents stale answers/offers from racing with the current WebRTC handshake.
    await env.DB.prepare(`
      UPDATE peer_sessions
      SET status = 'cancelled', updated_at = ?1
      WHERE status IN ('pending','answered')
        AND ((initiator_id = ?2 AND receiver_id = ?3) OR (initiator_id = ?3 AND receiver_id = ?2))
    `).bind(now, owner.wtink_id, target).run();
    const id = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO peer_sessions (id, initiator_id, receiver_id, offer_sdp, status, created_at, updated_at, expires_at)
      VALUES (?1, ?2, ?3, ?4, 'pending', ?5, ?5, ?6)
    `).bind(id, owner.wtink_id, target, offer, now, expires).run();
    const row = await loadPeerSession(env, id);
    await createSocialNotification(env, target, owner.wtink_id, 'peerRequest', id, 'Входящий P2P-запрос', `${owner.name || displayId(owner.wtink_id)} хочет подключиться к вам`, `./?tab=friends&peerSession=${encodeURIComponent(id)}`);
    await notifyProfile(env, target, 'peerRequest', {
      title: `Входящий запрос P2P${normalizeId(owner.wtink_id) === DEV_WTINK_ID ? ' · dev' : ''}`,
      body: `${owner.name || displayId(owner.wtink_id)}${normalizeId(owner.wtink_id) === DEV_WTINK_ID ? ' · dev' : ''} хочет подключиться к вам`,
      url: `./?tab=friends&peerSession=${encodeURIComponent(id)}`,
      tag: `workertink-peer-request-${id}`,
      urgency: 'high',
      ttl: 30,
      type: 'peerRequest',
      peerSessionId: id
    });
    return json({session: peerSessionView(row)}, 201, origin);
  }

  if (request.method === 'GET' && (path === '/peer-sessions/incoming' || path === '/peer-sessions/outgoing')) {
    const owner = await authProfile(request, env);
    if (!owner) return json({error: 'UNAUTHORIZED'}, 401, origin);
    const now = Date.now();
    await env.DB.prepare(`UPDATE peer_sessions SET status = 'expired', updated_at = ?1 WHERE expires_at < ?1 AND status = 'pending'`).bind(now).run();
    const incoming = path.endsWith('/incoming');
    const column = incoming ? 'receiver_id' : 'initiator_id';
    const rows = await env.DB.prepare(`
      SELECT
        p.id, p.initiator_id, p.receiver_id, p.offer_sdp, p.answer_sdp, p.status, p.created_at, p.updated_at, p.expires_at,
        s.wtink_id AS s_id, s.name AS s_name, s.position AS s_position, s.avatar AS s_avatar, s.is_dev AS s_is_dev, s.is_admin AS s_is_admin,
        t.wtink_id AS t_id, t.name AS t_name, t.position AS t_position, t.avatar AS t_avatar, t.is_dev AS t_is_dev, t.is_admin AS t_is_admin
      FROM peer_sessions p
      JOIN profiles s ON s.wtink_id = p.initiator_id
      JOIN profiles t ON t.wtink_id = p.receiver_id
      WHERE p.${column} = ?1 AND p.status IN ('pending','answered') AND p.expires_at >= ?2
      ORDER BY p.created_at DESC LIMIT 20
    `).bind(owner.wtink_id, now).all();
    return json({sessions: (rows.results || []).map(peerSessionView)}, 200, origin);
  }

  if (request.method === 'POST' && peerSessionPath) {
    const owner = await authProfile(request, env);
    if (!owner) return json({error: 'UNAUTHORIZED'}, 401, origin);
    const id = decodeURIComponent(peerSessionPath[1]);
    const row = await loadPeerSession(env, id);
    if (!row) return json({error: 'SESSION_NOT_FOUND'}, 404, origin);
    if (row.receiver_id !== owner.wtink_id) return json({error: 'FORBIDDEN'}, 403, origin);
    if (row.expires_at < Date.now()) {
      await env.DB.prepare(`UPDATE peer_sessions SET status = 'expired', updated_at = ?1 WHERE id = ?2`).bind(Date.now(), id).run();
      return json({error: 'SESSION_EXPIRED'}, 410, origin);
    }
    const input = await body(request);
    const answer = typeof input?.answer === 'string' ? input.answer.slice(0, 200000) : '';
    if (!answer) return json({error: 'INVALID_ANSWER'}, 400, origin);
    const updatedAt = Date.now();
    const result = await env.DB.prepare(`UPDATE peer_sessions SET answer_sdp = ?1, status = 'answered', updated_at = ?2 WHERE id = ?3 AND status = 'pending'`)
      .bind(answer, updatedAt, id).run();
    if (!result.meta?.changes) {
      const current = await loadPeerSession(env, id);
      if (!current) return json({error: 'SESSION_NOT_FOUND'}, 404, origin);
      if (current.receiver_id !== owner.wtink_id) return json({error: 'FORBIDDEN'}, 403, origin);
      if (current.status === 'answered' && current.answer_sdp === answer) return json({session: peerSessionView(current)}, 200, origin);
      return json({error: current.status === 'cancelled' ? 'SESSION_CANCELLED' : 'SESSION_NOT_PENDING'}, 409, origin);
    }
    const updated = await loadPeerSession(env, id);
    return json({session: peerSessionView(updated)}, 200, origin);
  }

  const peerSessionAction = path.match(/^\/peer-sessions\/([^/]+)\/(decline)$/);
  if (request.method === 'POST' && peerSessionAction) {
    const owner = await authProfile(request, env);
    if (!owner) return json({error: 'UNAUTHORIZED'}, 401, origin);
    const id = decodeURIComponent(peerSessionAction[1]);
    const row = await loadPeerSession(env, id);
    if (!row) return json({error: 'SESSION_NOT_FOUND'}, 404, origin);
    if (row.receiver_id !== owner.wtink_id) return json({error: 'FORBIDDEN'}, 403, origin);
    if (row.status !== 'pending') return json({error: row.status === 'expired' ? 'SESSION_EXPIRED' : 'SESSION_NOT_PENDING'}, 409, origin);
    await env.DB.prepare(`UPDATE peer_sessions SET status = 'cancelled', updated_at = ?1 WHERE id = ?2 AND status = 'pending'`)
      .bind(Date.now(), id).run();
    const updated = await loadPeerSession(env, id);
    return json({session: peerSessionView(updated)}, 200, origin);
  }

  if (request.method === 'GET' && path.startsWith('/peer-sessions/')) {
    const owner = await authProfile(request, env);
    if (!owner) return json({error: 'UNAUTHORIZED'}, 401, origin);
    const id = decodeURIComponent(path.split('/').pop() || '');
    const row = await loadPeerSession(env, id);
    if (!row) return json({error: 'SESSION_NOT_FOUND'}, 404, origin);
    if (row.initiator_id !== owner.wtink_id && row.receiver_id !== owner.wtink_id) return json({error: 'FORBIDDEN'}, 403, origin);
    return json({session: peerSessionView(row)}, 200, origin);
  }

  // Social network: server-backed feed, comments, likes, inbox and notifications.
  if (path === '/social/feed' && request.method === 'GET') {
    const owner = await authProfile(request, env);
    if (!owner) return json({error:'UNAUTHORIZED'},401,origin);
    const u = new URL(request.url);
    const limit = Math.min(50, Math.max(1, Number(u.searchParams.get('limit') || 20)));
    const rows = await env.DB.prepare(`
      SELECT p.id,p.body,p.kind,p.group_id,p.visibility,p.created_at,p.updated_at,
        a.wtink_id AS a_id,a.name AS a_name,a.position AS a_position,a.avatar AS a_avatar,a.is_dev AS a_is_dev,a.is_admin AS a_is_admin,
        (SELECT COUNT(*) FROM social_post_likes l WHERE l.post_id=p.id) AS likes,
        (SELECT COUNT(*) FROM social_post_comments c WHERE c.post_id=p.id) AS comments,
        EXISTS(SELECT 1 FROM social_post_likes ml WHERE ml.post_id=p.id AND ml.profile_id=?1) AS liked
      FROM social_posts p JOIN profiles a ON a.wtink_id=p.author_id
      WHERE p.visibility='network' OR p.author_id=?1 OR (p.visibility='friends' AND EXISTS(SELECT 1 FROM friend_requests fr WHERE fr.status='accepted' AND ((fr.sender_id=?1 AND fr.receiver_id=p.author_id) OR (fr.sender_id=p.author_id AND fr.receiver_id=?1)))) OR (p.group_id IS NOT NULL AND EXISTS(SELECT 1 FROM social_group_members gm WHERE gm.group_id=p.group_id AND gm.profile_id=?1))
      ORDER BY p.created_at DESC LIMIT ?2`).bind(owner.wtink_id,limit).all();
    return json({posts:(rows.results||[]).map(r=>({id:r.id,body:r.body,kind:r.kind||'post',groupId:r.group_id||null,visibility:r.visibility||'network',createdAt:Number(r.created_at),updatedAt:Number(r.updated_at),author:socialProfile({wtink_id:r.a_id,name:r.a_name,position:r.a_position,avatar:r.a_avatar,is_dev:r.a_is_dev,is_admin:r.a_is_admin}),likes:Number(r.likes||0),comments:Number(r.comments||0),liked:Boolean(r.liked)}))},200,origin);
  }

  if (path === '/social/posts' && request.method === 'POST') {
    const owner = await authProfile(request, env); if (!owner) return json({error:'UNAUTHORIZED'},401,origin);
    const input=await body(request); const text=cleanText(input?.body,4000); const kind=['post','announcement','question','shift'].includes(input?.kind)?input.kind:'post'; const visibility=input?.visibility==='friends'?'friends':'network'; const groupId=input?.groupId?String(input.groupId):null;
    if (!text) return json({error:'EMPTY_POST'},400,origin);
    if(groupId){const member=await env.DB.prepare('SELECT 1 FROM social_group_members WHERE group_id=?1 AND profile_id=?2').bind(groupId,owner.wtink_id).first();if(!member)return json({error:'GROUP_MEMBERSHIP_REQUIRED'},403,origin)}
    const id=crypto.randomUUID(),now=Date.now();
    await env.DB.prepare('INSERT INTO social_posts (id,author_id,body,kind,group_id,visibility,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?7)').bind(id,owner.wtink_id,text,kind,groupId,visibility,now).run();
    return json({ok:true,id,createdAt:now},201,origin);
  }

  const postMatch=path.match(/^\/social\/posts\/([^/]+)$/);
  if (postMatch && request.method === 'DELETE') {
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin);
    const id=decodeURIComponent(postMatch[1]);
    const post=await env.DB.prepare('SELECT author_id FROM social_posts WHERE id=?1').bind(id).first();
    if(!post)return json({error:'POST_NOT_FOUND'},404,origin);
    if(post.author_id!==owner.wtink_id && roleFlags(owner).isAdmin===false)return json({error:'FORBIDDEN'},403,origin);
    await env.DB.prepare('DELETE FROM social_posts WHERE id=?1').bind(id).run(); return json({ok:true},200,origin);
  }

  const likeMatch=path.match(/^\/social\/posts\/([^/]+)\/like$/);
  if(likeMatch && request.method==='POST'){
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin);
    const id=decodeURIComponent(likeMatch[1]); const post=await env.DB.prepare('SELECT id,author_id FROM social_posts WHERE id=?1').bind(id).first();
    if(!post)return json({error:'POST_NOT_FOUND'},404,origin);
    const existing=await env.DB.prepare('SELECT 1 FROM social_post_likes WHERE post_id=?1 AND profile_id=?2').bind(id,owner.wtink_id).first();
    if(existing){await env.DB.prepare('DELETE FROM social_post_likes WHERE post_id=?1 AND profile_id=?2').bind(id,owner.wtink_id).run();}
    else {await env.DB.prepare('INSERT INTO social_post_likes (post_id,profile_id,created_at) VALUES (?1,?2,?3)').bind(id,owner.wtink_id,Date.now()).run(); if(post.author_id!==owner.wtink_id) {await createSocialNotification(env,post.author_id,owner.wtink_id,'like',id,'Новая реакция',`${owner.name} отметил(а) вашу публикацию`); await notifyProfile(env,post.author_id,'message',{title:'Новая реакция',body:`${owner.name} отметил(а) вашу публикацию`,url:`./?tab=social&post=${encodeURIComponent(id)}`,tag:`wtink-like-${id}-${owner.wtink_id}`});}}
    const count=await env.DB.prepare('SELECT COUNT(*) AS count FROM social_post_likes WHERE post_id=?1').bind(id).first(); return json({liked:!existing,likes:Number(count?.count||0)},200,origin);
  }

  const commentsMatch=path.match(/^\/social\/posts\/([^/]+)\/comments$/);
  if(commentsMatch && request.method==='GET'){
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin);
    const id=decodeURIComponent(commentsMatch[1]);
    const rows=await env.DB.prepare(`SELECT c.id,c.body,c.created_at,a.wtink_id AS a_id,a.name AS a_name,a.position AS a_position,a.avatar AS a_avatar,a.is_dev AS a_is_dev,a.is_admin AS a_is_admin FROM social_post_comments c JOIN profiles a ON a.wtink_id=c.author_id WHERE c.post_id=?1 ORDER BY c.created_at ASC LIMIT 100`).bind(id).all();
    return json({comments:(rows.results||[]).map(r=>({id:r.id,body:r.body,createdAt:Number(r.created_at),author:socialProfile({wtink_id:r.a_id,name:r.a_name,position:r.a_position,avatar:r.a_avatar,is_dev:r.a_is_dev,is_admin:r.a_is_admin})}))},200,origin);
  }
  if(commentsMatch && request.method==='POST'){
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin);
    const id=decodeURIComponent(commentsMatch[1]); const post=await env.DB.prepare('SELECT id,author_id FROM social_posts WHERE id=?1').bind(id).first(); if(!post)return json({error:'POST_NOT_FOUND'},404,origin);
    const text=cleanText((await body(request))?.body,1000); if(!text)return json({error:'EMPTY_COMMENT'},400,origin);
    const cid=crypto.randomUUID(),now=Date.now(); await env.DB.prepare('INSERT INTO social_post_comments (id,post_id,author_id,body,created_at) VALUES (?1,?2,?3,?4,?5)').bind(cid,id,owner.wtink_id,text,now).run();
    if(post.author_id!==owner.wtink_id){await createSocialNotification(env,post.author_id,owner.wtink_id,'comment',id,'Новый комментарий',`${owner.name} прокомментировал(а) вашу публикацию`); await notifyProfile(env,post.author_id,'message',{title:'Новый комментарий',body:`${owner.name} прокомментировал(а) вашу публикацию`,url:`./?tab=social&post=${encodeURIComponent(id)}`,tag:`wtink-comment-${cid}`});}
    return json({ok:true,id:cid,createdAt:now},201,origin);
  }

  if(path==='/social/notifications' && request.method==='GET'){
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin);
    const rows=await env.DB.prepare(`SELECT n.id,n.kind,n.entity_id,n.title,n.body,n.url,n.read_at,n.created_at,a.wtink_id AS a_id,a.name AS a_name,a.position AS a_position,a.avatar AS a_avatar,a.is_dev AS a_is_dev,a.is_admin AS a_is_admin FROM social_notifications n LEFT JOIN profiles a ON a.wtink_id=n.actor_id WHERE n.profile_id=?1 ORDER BY n.created_at DESC LIMIT 100`).bind(owner.wtink_id).all();
    const unread=await env.DB.prepare('SELECT COUNT(*) AS count FROM social_notifications WHERE profile_id=?1 AND read_at IS NULL').bind(owner.wtink_id).first();
    return json({unread:Number(unread?.count||0),notifications:(rows.results||[]).map(r=>({id:r.id,kind:r.kind,entityId:r.entity_id,title:r.title,body:r.body,url:r.url,readAt:r.read_at?Number(r.read_at):null,createdAt:Number(r.created_at),actor:r.a_id?socialProfile({wtink_id:r.a_id,name:r.a_name,position:r.a_position,avatar:r.a_avatar,is_dev:r.a_is_dev,is_admin:r.a_is_admin}):null}))},200,origin);
  }
  const notificationMatch=path.match(/^\/social\/notifications\/([^/]+)\/read$/);
  if(notificationMatch && request.method==='POST'){
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin); await env.DB.prepare('UPDATE social_notifications SET read_at=?1 WHERE id=?2 AND profile_id=?3').bind(Date.now(),decodeURIComponent(notificationMatch[1]),owner.wtink_id).run(); return json({ok:true},200,origin);
  }
  if(path==='/social/notifications/read-all' && request.method==='POST'){
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin); await env.DB.prepare('UPDATE social_notifications SET read_at=?1 WHERE profile_id=?2 AND read_at IS NULL').bind(Date.now(),owner.wtink_id).run(); return json({ok:true},200,origin);
  }

  const chatMediaChunkMatch = path.match(/^\/chat\/media\/([^/]+)\/(\d+)$/);
  if (chatMediaChunkMatch && request.method === 'PUT') {
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin);
    const mediaId=decodeURIComponent(chatMediaChunkMatch[1]); const index=Number(chatMediaChunkMatch[2]);
    const media=await env.DB.prepare('SELECT id,sender_id,total_chunks,complete FROM chat_media WHERE id=?1').bind(mediaId).first();
    if(!media||normalizeId(media.sender_id)!==normalizeId(owner.wtink_id))return json({error:'MEDIA_NOT_FOUND'},404,origin);
    if(Number(media.complete))return json({error:'MEDIA_COMPLETE'},409,origin);
    if(!Number.isInteger(index)||index<0||index>=Number(media.total_chunks))return json({error:'INVALID_MEDIA_CHUNK'},400,origin);
    const bytes=new Uint8Array(await request.arrayBuffer()); if(!bytes.length||bytes.length>600000)return json({error:'INVALID_MEDIA_CHUNK'},400,origin);
    await env.DB.prepare('INSERT OR REPLACE INTO chat_media_chunks(media_id,chunk_index,data,created_at) VALUES (?1,?2,?3,?4)').bind(mediaId,index,bytesToBase64(bytes),Date.now()).run();
    const count=await env.DB.prepare('SELECT COUNT(*) AS count FROM chat_media_chunks WHERE media_id=?1').bind(mediaId).first();
    await env.DB.prepare('UPDATE chat_media SET uploaded_chunks=?1 WHERE id=?2').bind(Number(count?.count||0),mediaId).run();
    return json({ok:true,index},200,origin);
  }

  const chatMediaAction = path.match(/^\/chat\/media\/([^/]+)(?:\/(complete))?$/);
  if (chatMediaAction && request.method === 'POST' && chatMediaAction[2] === 'complete') {
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin); const mediaId=decodeURIComponent(chatMediaAction[1]);
    const media=await env.DB.prepare('SELECT id,sender_id,total_chunks,uploaded_chunks FROM chat_media WHERE id=?1').bind(mediaId).first();
    if(!media||normalizeId(media.sender_id)!==normalizeId(owner.wtink_id))return json({error:'MEDIA_NOT_FOUND'},404,origin);
    if(Number(media.uploaded_chunks)!==Number(media.total_chunks))return json({error:'MEDIA_INCOMPLETE'},409,origin);
    await env.DB.prepare('UPDATE chat_media SET complete=1,completed_at=?1 WHERE id=?2').bind(Date.now(),mediaId).run(); return json({ok:true},200,origin);
  }
  if (chatMediaAction && request.method === 'GET' && !chatMediaAction[2]) {
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin); const mediaId=decodeURIComponent(chatMediaAction[1]);
    const media=await env.DB.prepare('SELECT id,sender_id,receiver_id,mime,size,total_chunks,complete FROM chat_media WHERE id=?1').bind(mediaId).first();
    if(!media||!Number(media.complete))return json({error:'MEDIA_NOT_FOUND'},404,origin);
    const participant=normalizeId(media.sender_id)===normalizeId(owner.wtink_id)||normalizeId(media.receiver_id)===normalizeId(owner.wtink_id); if(!participant)return json({error:'FORBIDDEN'},403,origin);
    const rows=await env.DB.prepare('SELECT chunk_index,data FROM chat_media_chunks WHERE media_id=?1 ORDER BY chunk_index ASC').bind(mediaId).all();
    const parts=(rows.results||[]).map(r=>base64ToBytes(r.data)); const total=parts.reduce((n,p)=>n+p.length,0); const out=new Uint8Array(total); let offset=0; for(const part of parts){out.set(part,offset);offset+=part.length;}
    return binary(out,200,origin,media.mime||'application/octet-stream');
  }
  if (path === '/chat/media/init' && request.method === 'POST') {
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin); const input=await body(request); const target=normalizeId(input?.to); const groupId=typeof input?.groupId==='string'?String(input.groupId):''; const kind=String(input?.kind||''); const size=Number(input?.size||0);
    if((!validId(target)&&!groupId)||!['voice','image','video','file'].includes(kind)||!Number.isFinite(size)||size<=0||size>20*1024*1024)return json({error:'MEDIA_TOO_LARGE'},400,origin);
    if(groupId){const member=await env.DB.prepare('SELECT 1 FROM chat_group_members WHERE group_id=?1 AND profile_id=?2').bind(groupId,owner.wtink_id).first();if(!member)return json({error:'NOT_GROUP_MEMBER'},403,origin);}else{if(target===owner.wtink_id)return json({error:'INVALID_MESSAGE'},400,origin);const friend=await env.DB.prepare(`SELECT 1 FROM friend_requests WHERE status='accepted' AND ((sender_id=?1 AND receiver_id=?2) OR (sender_id=?2 AND receiver_id=?1)) LIMIT 1`).bind(owner.wtink_id,target).first(); if(!friend)return json({error:'NOT_FRIENDS'},403,origin);}
    const id=crypto.randomUUID(),chunkSize=524288,totalChunks=Math.ceil(size/chunkSize),now=Date.now();
    await env.DB.prepare('INSERT INTO chat_media(id,sender_id,receiver_id,group_id,kind,mime,name,iv,size,chunk_size,total_chunks,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)').bind(id,owner.wtink_id,target||owner.wtink_id,groupId||null,kind,cleanText(input?.mime,120),cleanText(input?.name,160),cleanText(input?.iv,80),size,chunkSize,totalChunks,now).run();
    return json({id,chunkSize,totalChunks},201,origin);
  }

  const clearChatMatch=path.match(/^\/chat\/messages\/([^/]+)\/clear$/);
  if(clearChatMatch && request.method==='DELETE'){const owner=await authProfile(request,env);if(!owner)return json({error:'UNAUTHORIZED'},401,origin);const target=normalizeId(decodeURIComponent(clearChatMatch[1]));const friend=await env.DB.prepare(`SELECT 1 FROM friend_requests WHERE status='accepted' AND ((sender_id=?1 AND receiver_id=?2) OR (sender_id=?2 AND receiver_id=?1)) LIMIT 1`).bind(owner.wtink_id,target).first();if(!friend)return json({error:'NOT_FRIENDS'},403,origin);const rows=await env.DB.prepare('SELECT id FROM social_messages WHERE (sender_id=?1 AND receiver_id=?2) OR (sender_id=?2 AND receiver_id=?1)').bind(owner.wtink_id,target).all();const statements=(rows.results||[]).map(r=>env.DB.prepare('INSERT OR REPLACE INTO social_message_deletions(message_id,profile_id,deleted_at) VALUES(?1,?2,?3)').bind(r.id,owner.wtink_id,Date.now()));if(statements.length)await env.DB.batch(statements);return json({ok:true,count:statements.length},200,origin);}

  const messagesMatch=path.match(/^\/(?:social\/|chat\/)messages\/([^/]+)$/);
  if(messagesMatch && request.method==='GET'){
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin); const target=normalizeId(decodeURIComponent(messagesMatch[1]));
    const friend=await env.DB.prepare(`SELECT 1 FROM friend_requests WHERE status='accepted' AND ((sender_id=?1 AND receiver_id=?2) OR (sender_id=?2 AND receiver_id=?1)) LIMIT 1`).bind(owner.wtink_id,target).first(); if(!friend)return json({error:'NOT_FRIENDS'},403,origin);
    const now=Date.now();
    await env.DB.prepare('UPDATE social_messages SET read_at=?1 WHERE receiver_id=?2 AND sender_id=?3 AND read_at IS NULL AND deleted_at IS NULL').bind(now,owner.wtink_id,target).run();
    const rows=await env.DB.prepare(`SELECT m.id,m.sender_id,m.receiver_id,m.body,m.kind,mime,name,m.created_at,m.read_at,m.edited_at,m.deleted_at,m.reply_to_id,m.reply_preview,m.note_date,m.note_shift,CASE WHEN d.message_id IS NULL THEN 0 ELSE 1 END AS deleted_for_me FROM social_messages m LEFT JOIN social_message_deletions d ON d.message_id=m.id AND d.profile_id=?1 WHERE (m.sender_id=?1 AND m.receiver_id=?2) OR (m.sender_id=?2 AND m.receiver_id=?1) ORDER BY m.created_at ASC LIMIT 500`).bind(owner.wtink_id,target).all();
    return json({messages:(rows.results||[]).map(r=>({id:r.id,from:displayId(r.sender_id),to:displayId(r.receiver_id),body:r.body,kind:r.kind||'text',mime:r.mime||null,name:r.name||null,createdAt:Number(r.created_at),readAt:r.read_at?Number(r.read_at):null,editedAt:r.edited_at?Number(r.edited_at):null,deletedAt:r.deleted_at?Number(r.deleted_at):null,replyToId:r.reply_to_id||null,replyPreview:r.reply_preview||null,noteDate:r.note_date||null,noteShift:r.note_shift||null,deletedForMe:Boolean(r.deleted_for_me)}))},200,origin);
  }
  const messageAction=path.match(/^\/chat\/messages\/([^/]+)(?:\/(me|both))?$/);
  if(messageAction && request.method==='PUT' && !messageAction[2]){
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin); const id=decodeURIComponent(messageAction[1]); const input=await body(request); const text=cleanText(input?.body,12000);
    const row=await env.DB.prepare('SELECT id,sender_id,receiver_id,kind,created_at FROM social_messages WHERE id=?1').bind(id).first(); if(!row)return json({error:'MESSAGE_NOT_FOUND'},404,origin);
    if(normalizeId(row.sender_id)!==normalizeId(owner.wtink_id)||row.kind!=='text')return json({error:'EDIT_NOT_ALLOWED'},403,origin); if(!text)return json({error:'INVALID_MESSAGE'},400,origin);
    const now=Date.now(); await env.DB.prepare('UPDATE social_messages SET body=?1,edited_at=?2 WHERE id=?3').bind(text,now,id).run();
    return json({ok:true,message:{id,from:displayId(row.sender_id),to:displayId(row.receiver_id),body:text,kind:'text',createdAt:Number(row.created_at),readAt:null,editedAt:now,deletedAt:null}},200,origin);
  }
  if(messageAction && request.method==='DELETE'){
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin); const id=decodeURIComponent(messageAction[1]); const mode=messageAction[2]||'me'; const row=await env.DB.prepare('SELECT sender_id,receiver_id FROM social_messages WHERE id=?1').bind(id).first(); if(!row)return json({error:'MESSAGE_NOT_FOUND'},404,origin);
    const isParticipant=normalizeId(row.sender_id)===normalizeId(owner.wtink_id)||normalizeId(row.receiver_id)===normalizeId(owner.wtink_id); if(!isParticipant)return json({error:'FORBIDDEN'},403,origin);
    if(mode==='both'){if(normalizeId(row.sender_id)!==normalizeId(owner.wtink_id))return json({error:'ONLY_SENDER_CAN_DELETE_BOTH'},403,origin); await env.DB.prepare('UPDATE social_messages SET deleted_at=?1,body=\'\',edited_at=NULL WHERE id=?2').bind(Date.now(),id).run();}
    else await env.DB.prepare('INSERT OR REPLACE INTO social_message_deletions(message_id,profile_id,deleted_at) VALUES (?1,?2,?3)').bind(id,owner.wtink_id,Date.now()).run();
    return json({ok:true},200,origin);
  }
  if((path==='/social/messages'||path==='/chat/messages') && request.method==='POST'){
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin); const input=await body(request); const target=normalizeId(input?.to); const text=cleanText(input?.body,28000000); const kind=['text','voice','image','video','file','note'].includes(String(input?.kind))?String(input.kind):'text'; const mime=typeof input?.mime==='string'?String(input.mime).slice(0,120):null; const name=typeof input?.name==='string'?String(input.name).slice(0,160):null; const replyToId=typeof input?.replyToId==='string'?String(input.replyToId).slice(0,80):null; const replyPreview=cleanText(input?.replyPreview,500); const noteDate=cleanText(input?.noteDate,20); const noteShift=cleanText(input?.noteShift,80);
    if(!validId(target)||!text||target===owner.wtink_id)return json({error:'INVALID_MESSAGE'},400,origin);
    const blocked=await env.DB.prepare('SELECT 1 FROM blocked_profiles WHERE (profile_id=?1 AND blocked_id=?2) OR (profile_id=?2 AND blocked_id=?1) LIMIT 1').bind(owner.wtink_id,target).first(); if(blocked)return json({error:'BLOCKED'},403,origin);
    const friend=await env.DB.prepare(`SELECT 1 FROM friend_requests WHERE status='accepted' AND ((sender_id=?1 AND receiver_id=?2) OR (sender_id=?2 AND receiver_id=?1)) LIMIT 1`).bind(owner.wtink_id,target).first(); if(!friend)return json({error:'NOT_FRIENDS'},403,origin);
    if(replyToId){const replyRow=await env.DB.prepare('SELECT 1 FROM social_messages WHERE id=?1 AND ((sender_id=?2 AND receiver_id=?3) OR (sender_id=?3 AND receiver_id=?2))').bind(replyToId,owner.wtink_id,target).first();if(!replyRow)return json({error:'INVALID_REPLY'},400,origin)}
    const id=crypto.randomUUID(),now=Date.now(); await env.DB.prepare('INSERT INTO social_messages (id,sender_id,receiver_id,body,kind,mime,name,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)').bind(id,owner.wtink_id,target,text,kind,mime,name,now).run();
    await env.DB.prepare('UPDATE social_messages SET reply_to_id=?1,reply_preview=?2,note_date=?3,note_shift=?4 WHERE id=?5').bind(replyToId,replyPreview,noteDate,noteShift,id).run();
    await createSocialNotification(env,target,owner.wtink_id,'message',id,'Новое сообщение',`${owner.name}: ${kind==='text'?text.slice(0,120):kind==='note'?'Заметка смены':'Вложение'}`,`./?tab=chat&chatWith=${encodeURIComponent(owner.wtink_id)}`);
    await notifyProfile(env,target,'message',{actorId:owner.wtink_id,title:`Сообщение от ${owner.name}`,body:kind==='text'?text.slice(0,120):kind==='note'?'Заметка смены':'Новое зашифрованное вложение',url:'./?tab=chat',tag:`wtink-message-${id}`,urgency:'high'});
    return json({ok:true,message:{id,from:displayId(owner.wtink_id),to:displayId(target),body:text,kind,mime,name,createdAt:now,readAt:null,editedAt:null,deletedAt:null,replyToId,replyPreview,noteDate,noteShift}},201,origin);
  }

  // 2.22 group chats and corporate invite-only channels.
  if(path==='/chat/groups' && request.method==='GET'){
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin);
    const rows=await env.DB.prepare(`SELECT g.id,g.name,g.description,g.avatar,g.owner_id,g.visibility,g.created_at,
      (SELECT COUNT(*) FROM chat_group_members m WHERE m.group_id=g.id) AS members,
      (SELECT role FROM chat_group_members m2 WHERE m2.group_id=g.id AND m2.profile_id=?1) AS role
      FROM chat_groups g JOIN chat_group_members me ON me.group_id=g.id AND me.profile_id=?1 ORDER BY g.updated_at DESC`).bind(owner.wtink_id).all();
    return json({groups:(rows.results||[]).map(r=>({id:r.id,name:r.name,description:r.description,avatar:r.avatar||'',ownerId:displayId(r.owner_id),visibility:r.visibility==='public'?'public':'private',members:Number(r.members||0),role:r.role,createdAt:Number(r.created_at)}))},200,origin);
  }
  if(path==='/chat/groups' && request.method==='POST'){
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin); const input=await body(request); const name=cleanText(input?.name,80); const description=cleanText(input?.description,300); if(!name)return json({error:'INVALID_GROUP'},400,origin);
    const visibility=input?.visibility==='public'?'public':'private'; const id=crypto.randomUUID(),now=Date.now(); await env.DB.batch([env.DB.prepare('INSERT INTO chat_groups(id,name,description,owner_id,visibility,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?6)').bind(id,name,description,owner.wtink_id,visibility,now),env.DB.prepare("INSERT INTO chat_group_members(group_id,profile_id,role,joined_at) VALUES(?1,?2,'owner',?3)").bind(id,owner.wtink_id,now)]); return json({group:{id,name,description,ownerId:displayId(owner.wtink_id),visibility,members:1,role:'owner',createdAt:now}},201,origin);
  }
  const groupLinkMatch=path.match(/^\/chat\/groups\/link\/([^/]+)$/);
  if(groupLinkMatch && request.method==='GET'){
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin); const id=decodeURIComponent(groupLinkMatch[1]);
    const g=await env.DB.prepare('SELECT id,name,description,avatar,owner_id,visibility,created_at FROM chat_groups WHERE id=?1').bind(id).first(); if(!g)return json({error:'GROUP_NOT_FOUND'},404,origin);
    const member=await env.DB.prepare('SELECT role FROM chat_group_members WHERE group_id=?1 AND profile_id=?2').bind(id,owner.wtink_id).first();
    return json({group:{id:g.id,name:g.name,description:g.description,avatar:g.avatar||'',ownerId:displayId(g.owner_id),visibility:g.visibility==='public'?'public':'private',createdAt:Number(g.created_at),joined:Boolean(member),role:member?.role||null}},200,origin);
  }
  const groupJoinMatch=path.match(/^\/chat\/groups\/([^/]+)\/join$/);
  if(groupJoinMatch && request.method==='POST'){
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin); const id=decodeURIComponent(groupJoinMatch[1]);
    const group=await env.DB.prepare('SELECT id,visibility FROM chat_groups WHERE id=?1').bind(id).first(); if(!group)return json({error:'GROUP_NOT_FOUND'},404,origin);
    if(group.visibility!=='public')return json({error:'INVITE_REQUIRED'},403,origin);
    await env.DB.prepare("INSERT OR IGNORE INTO chat_group_members(group_id,profile_id,role,joined_at) VALUES(?1,?2,'member',?3)").bind(id,owner.wtink_id,Date.now()).run();
    return json({ok:true},200,origin);
  }
  const groupMatch=path.match(/^\/chat\/groups\/([^/]+)$/);
  if(groupMatch && request.method==='GET'){
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin); const id=decodeURIComponent(groupMatch[1]); const member=await env.DB.prepare('SELECT role FROM chat_group_members WHERE group_id=?1 AND profile_id=?2').bind(id,owner.wtink_id).first(); if(!member)return json({error:'NOT_GROUP_MEMBER'},403,origin);
    const [g, members, keys]=await Promise.all([env.DB.prepare('SELECT id,name,description,avatar,owner_id,visibility,created_at FROM chat_groups WHERE id=?1').bind(id).first(),env.DB.prepare('SELECT m.profile_id,m.role,m.joined_at,p.name,p.position,p.avatar,p.username,p.is_dev,p.is_admin FROM chat_group_members m JOIN profiles p ON p.wtink_id=m.profile_id WHERE m.group_id=?1 ORDER BY m.joined_at ASC').bind(id).all(),env.DB.prepare('SELECT iv,data,updated_at FROM chat_group_keys WHERE group_id=?1 AND profile_id=?2').bind(id,owner.wtink_id).first()]); if(!g)return json({error:'GROUP_NOT_FOUND'},404,origin); return json({group:{id:g.id,name:g.name,description:g.description,avatar:g.avatar||'',ownerId:displayId(g.owner_id),visibility:g.visibility==='public'?'public':'private',createdAt:Number(g.created_at),role:member.role},members:(members.results||[]).map(r=>({profile:publicProfile({wtink_id:r.profile_id,name:r.name,position:r.position,avatar:r.avatar,username:r.username,is_dev:r.is_dev,is_admin:r.is_admin}),role:r.role,joinedAt:Number(r.joined_at)})),key:keys?{iv:keys.iv,data:keys.data}:null},200,origin);
  }
  const groupMemberMatch=path.match(/^\/chat\/groups\/([^/]+)\/members$/);
  if(groupMemberMatch && request.method==='POST'){
    const owner=await authProfile(request,env);if(!owner)return json({error:'UNAUTHORIZED'},401,origin);const id=decodeURIComponent(groupMemberMatch[1]);const current=await env.DB.prepare("SELECT role FROM chat_group_members WHERE group_id=?1 AND profile_id=?2").bind(id,owner.wtink_id).first();if(!current||!['owner','admin'].includes(current.role))return json({error:'FORBIDDEN'},403,origin);const target=normalizeId((await body(request))?.profileId);if(!validId(target)||target===owner.wtink_id)return json({error:'INVALID_PROFILE'},400,origin);const friend=await env.DB.prepare(`SELECT 1 FROM friend_requests WHERE status='accepted' AND ((sender_id=?1 AND receiver_id=?2) OR (sender_id=?2 AND receiver_id=?1)) LIMIT 1`).bind(owner.wtink_id,target).first();if(!friend)return json({error:'NOT_FRIENDS'},403,origin);const profile=await env.DB.prepare('SELECT wtink_id,name,position,avatar,username,is_dev,is_admin FROM profiles WHERE wtink_id=?1').bind(target).first();if(!profile)return json({error:'USER_NOT_FOUND'},404,origin);await env.DB.prepare("INSERT OR IGNORE INTO chat_group_members(group_id,profile_id,role,joined_at) VALUES(?1,?2,'member',?3)").bind(id,target,Date.now()).run();return json({ok:true,profile:publicProfile(profile),role:'member'},201,origin);
  }
  if(groupMemberMatch && request.method==='DELETE'){
    const owner=await authProfile(request,env);if(!owner)return json({error:'UNAUTHORIZED'},401,origin);const id=decodeURIComponent(groupMemberMatch[1]);const target=normalizeId((await body(request))?.profileId);const current=await env.DB.prepare("SELECT role FROM chat_group_members WHERE group_id=?1 AND profile_id=?2").bind(id,owner.wtink_id).first();if(!current||!['owner','admin'].includes(current.role))return json({error:'FORBIDDEN'},403,origin);if(target===owner.wtink_id)return json({error:'INVALID_PROFILE'},400,origin);await env.DB.prepare('DELETE FROM chat_group_members WHERE group_id=?1 AND profile_id=?2').bind(id,target).run();await env.DB.prepare('DELETE FROM chat_group_keys WHERE group_id=?1 AND profile_id=?2').bind(id,target).run();return json({ok:true},200,origin);
  }
  const groupKeyMember=path.match(/^\/chat\/groups\/([^/]+)\/keys\/([^/]+)$/);
  if(groupKeyMember && request.method==='PUT'){
    const owner=await authProfile(request,env);if(!owner)return json({error:'UNAUTHORIZED'},401,origin);const id=decodeURIComponent(groupKeyMember[1]);const target=normalizeId(decodeURIComponent(groupKeyMember[2]));const current=await env.DB.prepare("SELECT role FROM chat_group_members WHERE group_id=?1 AND profile_id=?2").bind(id,owner.wtink_id).first();if(!current||!['owner','admin'].includes(current.role))return json({error:'FORBIDDEN'},403,origin);const targetMember=await env.DB.prepare('SELECT 1 FROM chat_group_members WHERE group_id=?1 AND profile_id=?2').bind(id,target).first();if(!targetMember)return json({error:'MEMBER_REQUIRED'},400,origin);const input=await body(request);await env.DB.prepare('INSERT OR REPLACE INTO chat_group_keys(group_id,profile_id,iv,data,updated_at) VALUES(?1,?2,?3,?4,?5)').bind(id,target,cleanText(input?.iv,200),cleanText(input?.data,50000),Date.now()).run();return json({ok:true},200,origin);
  }
  const groupKeysMatch=path.match(/^\/chat\/groups\/([^/]+)\/keys$/);
  if(groupKeysMatch && request.method==='PUT'){
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin); const id=decodeURIComponent(groupKeysMatch[1]); const input=await body(request); const member=await env.DB.prepare('SELECT 1 FROM chat_group_members WHERE group_id=?1 AND profile_id=?2').bind(id,owner.wtink_id).first(); if(!member)return json({error:'NOT_GROUP_MEMBER'},403,origin); if(typeof input?.iv!=='string'||typeof input?.data!=='string')return json({error:'INVALID_GROUP_KEY'},400,origin); await env.DB.prepare('INSERT OR REPLACE INTO chat_group_keys(group_id,profile_id,iv,data,updated_at) VALUES(?1,?2,?3,?4,?5)').bind(id,owner.wtink_id,input.iv,input.data,Date.now()).run(); return json({ok:true},200,origin);
  }
  const groupMessagesMatch=path.match(/^\/chat\/groups\/([^/]+)\/messages$/);
  if(groupMessagesMatch && request.method==='GET'){
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin); const id=decodeURIComponent(groupMessagesMatch[1]); const member=await env.DB.prepare('SELECT 1 FROM chat_group_members WHERE group_id=?1 AND profile_id=?2').bind(id,owner.wtink_id).first(); if(!member)return json({error:'NOT_GROUP_MEMBER'},403,origin); await env.DB.prepare('UPDATE chat_group_messages SET read_at=?1 WHERE group_id=?2 AND sender_id<>?3 AND read_at IS NULL').bind(Date.now(),id,owner.wtink_id).run(); const rows=await env.DB.prepare(`SELECT m.id,m.sender_id,m.body,m.kind,m.mime,m.name,m.created_at,m.read_at,m.edited_at,m.deleted_at,m.reply_to_id,m.reply_preview,CASE WHEN d.message_id IS NULL THEN 0 ELSE 1 END AS deleted_for_me FROM chat_group_messages m LEFT JOIN chat_group_message_deletions d ON d.message_id=m.id AND d.profile_id=?2 WHERE m.group_id=?1 ORDER BY m.created_at ASC LIMIT 1000`).bind(id,owner.wtink_id).all(); return json({messages:(rows.results||[]).map(r=>({id:r.id,from:displayId(r.sender_id),to:id,body:r.body,kind:r.kind,mime:r.mime||null,name:r.name||null,createdAt:Number(r.created_at),readAt:r.read_at?Number(r.read_at):null,editedAt:r.edited_at?Number(r.edited_at):null,deletedAt:r.deleted_at?Number(r.deleted_at):null,replyToId:r.reply_to_id||null,replyPreview:r.reply_preview||null,deletedForMe:Boolean(r.deleted_for_me)}))},200,origin);
  }
  if(groupMessagesMatch && request.method==='POST'){
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin); const id=decodeURIComponent(groupMessagesMatch[1]); const member=await env.DB.prepare('SELECT 1 FROM chat_group_members WHERE group_id=?1 AND profile_id=?2').bind(id,owner.wtink_id).first(); if(!member)return json({error:'NOT_GROUP_MEMBER'},403,origin); const input=await body(request); const kind=['text','voice','image','video','file','note'].includes(String(input?.kind))?String(input.kind):'text'; const bodyText=cleanText(input?.body,28000000); if(!bodyText)return json({error:'INVALID_MESSAGE'},400,origin); const msgId=crypto.randomUUID(),now=Date.now(); await env.DB.prepare('INSERT INTO chat_group_messages(id,group_id,sender_id,body,kind,mime,name,created_at,reply_to_id,reply_preview) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)').bind(msgId,id,owner.wtink_id,bodyText,kind,cleanText(input?.mime,120)||null,cleanText(input?.name,160)||null,now,input?.replyToId||null,cleanText(input?.replyPreview,500)).run(); const recipients=await env.DB.prepare('SELECT profile_id FROM chat_group_members WHERE group_id=?1 AND profile_id<>?2').bind(id,owner.wtink_id).all(); for(const r of recipients.results||[]) {await createSocialNotification(env,r.profile_id,owner.wtink_id,'groupMessage',msgId,`Новое сообщение в группе`,`Новое сообщение от ${owner.name}`,`./chat/group/${encodeURIComponent(id)}`); await notifyProfile(env,r.profile_id,'groupMessage',{actorId:owner.wtink_id,title:`${owner.name} в группе`,body:kind==='text'?bodyText.slice(0,120):'Новое вложение',url:`./?tab=chat&group=${encodeURIComponent(id)}`,tag:`wtink-group-${id}`,urgency:'high'});} return json({ok:true,message:{id,from:displayId(owner.wtink_id),to:id,body:bodyText,kind,mime:input?.mime||null,name:input?.name||null,createdAt:now,readAt:null}},201,origin);
  }
  const groupClear=path.match(/^\/chat\/groups\/([^/]+)\/clear$/);
  if(groupClear && request.method==='DELETE'){const owner=await authProfile(request,env);if(!owner)return json({error:'UNAUTHORIZED'},401,origin);const gid=decodeURIComponent(groupClear[1]);const member=await env.DB.prepare('SELECT 1 FROM chat_group_members WHERE group_id=?1 AND profile_id=?2').bind(gid,owner.wtink_id).first();if(!member)return json({error:'NOT_GROUP_MEMBER'},403,origin);const rows=await env.DB.prepare('SELECT id FROM chat_group_messages WHERE group_id=?1').bind(gid).all();const statements=(rows.results||[]).map(r=>env.DB.prepare('INSERT OR REPLACE INTO chat_group_message_deletions(message_id,profile_id,deleted_at) VALUES(?1,?2,?3)').bind(r.id,owner.wtink_id,Date.now()));if(statements.length)await env.DB.batch(statements);return json({ok:true,count:statements.length},200,origin);}

  const groupDelete=path.match(/^\/chat\/groups\/messages\/([^/]+)\/(me|both)$/);
  if(groupDelete && request.method==='DELETE'){const owner=await authProfile(request,env);if(!owner)return json({error:'UNAUTHORIZED'},401,origin);const row=await env.DB.prepare('SELECT sender_id FROM chat_group_messages WHERE id=?1').bind(decodeURIComponent(groupDelete[1])).first();if(!row)return json({error:'MESSAGE_NOT_FOUND'},404,origin);if(groupDelete[2]==='both'){if(row.sender_id!==owner.wtink_id)return json({error:'FORBIDDEN'},403,origin);await env.DB.prepare('UPDATE chat_group_messages SET deleted_at=?1,body=\'\' WHERE id=?2').bind(Date.now(),decodeURIComponent(groupDelete[1])).run();}else await env.DB.prepare('INSERT OR REPLACE INTO chat_group_message_deletions(message_id,profile_id,deleted_at) VALUES(?1,?2,?3)').bind(decodeURIComponent(groupDelete[1]),owner.wtink_id,Date.now()).run();return json({ok:true},200,origin);}

  if(path==='/company/invites' && request.method==='GET'){const owner=await authProfile(request,env);if(!owner)return json({error:'UNAUTHORIZED'},401,origin);const rows=await env.DB.prepare(`SELECT i.id,i.channel_id,i.created_at,c.name,c.company_name,p.wtink_id AS sender_id,p.name AS sender_name,p.position AS sender_position,p.avatar AS sender_avatar,p.username AS sender_username,p.is_dev AS sender_dev,p.is_admin AS sender_admin FROM company_channel_invites i JOIN company_channels c ON c.id=i.channel_id JOIN profiles p ON p.wtink_id=i.invited_by WHERE i.invited_profile_id=?1 AND i.status='pending' ORDER BY i.created_at DESC`).bind(owner.wtink_id).all();return json({invites:(rows.results||[]).map(r=>({id:r.id,channelId:r.channel_id,channelName:r.name,companyName:r.company_name,createdAt:Number(r.created_at),sender:publicProfile({wtink_id:r.sender_id,name:r.sender_name,position:r.sender_position,avatar:r.sender_avatar,username:r.sender_username,is_dev:r.sender_dev,is_admin:r.sender_admin})}))},200,origin)}

  if(path==='/company/channels' && request.method==='GET'){const owner=await authProfile(request,env);if(!owner)return json({error:'UNAUTHORIZED'},401,origin);const rows=await env.DB.prepare(`SELECT c.id,c.name,c.slug,c.description,c.company_name,c.owner_id,c.visibility,c.created_at,(SELECT COUNT(*) FROM company_channel_members m WHERE m.channel_id=c.id) members,(SELECT role_id FROM company_channel_members m2 WHERE m2.channel_id=c.id AND m2.profile_id=?1) role_id FROM company_channels c JOIN company_channel_members me ON me.channel_id=c.id AND me.profile_id=?1 ORDER BY c.updated_at DESC`).bind(owner.wtink_id).all();return json({channels:(rows.results||[]).map(r=>({id:r.id,name:r.name,slug:r.slug,description:r.description,companyName:r.company_name,ownerId:displayId(r.owner_id),visibility:r.visibility==='public'?'public':'private',members:Number(r.members||0),roleId:r.role_id||null,createdAt:Number(r.created_at)}))},200,origin)}
  if(path==='/company/channels' && request.method==='POST'){const owner=await authProfile(request,env);if(!owner)return json({error:'UNAUTHORIZED'},401,origin);const input=await body(request);const name=cleanText(input?.name,100),companyName=cleanText(input?.companyName,120),description=cleanText(input?.description,500),visibility=input?.visibility==='public'?'public':'private';if(!name||!companyName)return json({error:'INVALID_CHANNEL'},400,origin);let slug=(cleanText(input?.slug,60)||name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')).slice(0,60)||`channel-${Date.now()}`;let suffix=0,base=slug;while(await env.DB.prepare('SELECT 1 FROM company_channels WHERE slug=?1').bind(slug).first()){suffix++;slug=`${base}-${suffix}`;}const id=crypto.randomUUID(),roleId=crypto.randomUUID(),employeeRoleId=crypto.randomUUID(),now=Date.now();const perms=JSON.stringify({post:true,invite:true,manageMembers:true,manageRoles:true,deletePosts:true});await env.DB.batch([env.DB.prepare('INSERT INTO company_channels(id,name,slug,description,company_name,owner_id,visibility,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?8)').bind(id,name,slug,description,companyName,owner.wtink_id,visibility,now),env.DB.prepare('INSERT INTO company_channel_roles(id,channel_id,name,permissions,created_at) VALUES(?1,?2,?3,?4,?5)').bind(roleId,id,'Владелец',perms,now),env.DB.prepare('INSERT INTO company_channel_roles(id,channel_id,name,permissions,created_at) VALUES(?1,?2,?3,?4,?5)').bind(employeeRoleId,id,'Сотрудник',JSON.stringify({post:true}),now),env.DB.prepare('INSERT INTO company_channel_members(channel_id,profile_id,role_id,joined_at) VALUES(?1,?2,?3,?4)').bind(id,owner.wtink_id,roleId,now)]);return json({channel:{id,name,slug,description,companyName,ownerId:displayId(owner.wtink_id),visibility,roleId,members:1}},201,origin)}
  const channelInvite=path.match(/^\/company\/channels\/([^/]+)\/invite$/);if(channelInvite&&request.method==='POST'){const owner=await authProfile(request,env);if(!owner)return json({error:'UNAUTHORIZED'},401,origin);const id=decodeURIComponent(channelInvite[1]);const member=await env.DB.prepare(`SELECT m.role_id,r.permissions FROM company_channel_members m JOIN company_channel_roles r ON r.id=m.role_id WHERE m.channel_id=?1 AND m.profile_id=?2`).bind(id,owner.wtink_id).first();if(!member||!JSON.parse(member.permissions||'{}').invite)return json({error:'FORBIDDEN'},403,origin);const target=normalizeId((await body(request))?.profileId);if(!validId(target))return json({error:'INVALID_PROFILE'},400,origin);const exists=await env.DB.prepare('SELECT 1 FROM profiles WHERE wtink_id=?1').bind(target).first();if(!exists)return json({error:'USER_NOT_FOUND'},404,origin);const iid=crypto.randomUUID();await env.DB.prepare('INSERT INTO company_channel_invites(id,channel_id,invited_profile_id,invited_by,created_at) VALUES(?1,?2,?3,?4,?5)').bind(iid,id,target,owner.wtink_id,Date.now()).run();await createSocialNotification(env,target,owner.wtink_id,'channelInvite',iid,'Приглашение в корпоративный канал','Вас пригласили в рабочий канал','./?tab=chat');await notifyProfile(env,target,'channelInvite',{actorId:owner.wtink_id,title:'Приглашение в корпоративный канал',body:`${owner.name} приглашает вас в канал`,url:'./?tab=social',tag:`wtink-channel-invite-${iid}`,urgency:'high'});return json({ok:true,id:iid},201,origin)}
  const channelInviteAction=path.match(/^\/company\/invites\/([^/]+)\/(accept|decline)$/);if(channelInviteAction&&request.method==='POST'){const owner=await authProfile(request,env);if(!owner)return json({error:'UNAUTHORIZED'},401,origin);const inviteId=decodeURIComponent(channelInviteAction[1]);const invite=await env.DB.prepare('SELECT id,channel_id,status FROM company_channel_invites WHERE id=?1 AND invited_profile_id=?2').bind(inviteId,owner.wtink_id).first();if(!invite||invite.status!=='pending')return json({error:'INVITE_NOT_FOUND'},404,origin);const role=await env.DB.prepare("SELECT id FROM company_channel_roles WHERE channel_id=?1 AND name='Сотрудник' LIMIT 1").bind(invite.channel_id).first();if(channelInviteAction[2]==='accept'){let roleId=role?.id;if(!roleId){roleId=crypto.randomUUID();await env.DB.prepare('INSERT INTO company_channel_roles(id,channel_id,name,permissions,created_at) VALUES(?1,?2,\'Сотрудник\',\'{\"post\":true}\',?3)').bind(roleId,invite.channel_id,Date.now()).run();}await env.DB.prepare('INSERT OR REPLACE INTO company_channel_members(channel_id,profile_id,role_id,joined_at) VALUES(?1,?2,?3,?4)').bind(invite.channel_id,owner.wtink_id,roleId,Date.now()).run();}await env.DB.prepare('UPDATE company_channel_invites SET status=?1,responded_at=?2 WHERE id=?3').bind(channelInviteAction[2]==='accept'?'accepted':'declined',Date.now(),inviteId).run();return json({ok:true},200,origin)}
  const companyLinkMatch=path.match(/^\/company\/channels\/link\/([^/]+)$/);
  if(companyLinkMatch && request.method==='GET'){
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin); const slug=decodeURIComponent(companyLinkMatch[1]);
    const c=await env.DB.prepare('SELECT id,name,slug,description,company_name,owner_id,visibility,created_at FROM company_channels WHERE slug=?1').bind(slug).first(); if(!c)return json({error:'CHANNEL_NOT_FOUND'},404,origin);
    const member=await env.DB.prepare('SELECT role_id FROM company_channel_members WHERE channel_id=?1 AND profile_id=?2').bind(c.id,owner.wtink_id).first();
    return json({channel:{id:c.id,name:c.name,slug:c.slug,description:c.description,companyName:c.company_name,ownerId:displayId(c.owner_id),visibility:c.visibility==='public'?'public':'private',createdAt:Number(c.created_at),joined:Boolean(member),roleId:member?.role_id||null}},200,origin);
  }
  const companyJoinMatch=path.match(/^\/company\/channels\/([^/]+)\/join$/);
  if(companyJoinMatch && request.method==='POST'){
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin); const id=decodeURIComponent(companyJoinMatch[1]);
    const channel=await env.DB.prepare('SELECT id,visibility FROM company_channels WHERE id=?1').bind(id).first(); if(!channel)return json({error:'CHANNEL_NOT_FOUND'},404,origin);
    if(channel.visibility!=='public')return json({error:'INVITE_REQUIRED'},403,origin);
    const role=await env.DB.prepare("SELECT id FROM company_channel_roles WHERE channel_id=?1 AND name='Сотрудник' LIMIT 1").bind(id).first(); if(!role)return json({error:'ROLE_NOT_READY'},409,origin);
    await env.DB.prepare('INSERT OR IGNORE INTO company_channel_members(channel_id,profile_id,role_id,joined_at) VALUES(?1,?2,?3,?4)').bind(id,owner.wtink_id,role.id,Date.now()).run();
    return json({ok:true},200,origin);
  }
  const channelPosts=path.match(/^\/company\/channels\/([^/]+)\/posts$/);if(channelPosts&&request.method==='GET'){const owner=await authProfile(request,env);if(!owner)return json({error:'UNAUTHORIZED'},401,origin);const id=decodeURIComponent(channelPosts[1]);const member=await env.DB.prepare('SELECT 1 FROM company_channel_members WHERE channel_id=?1 AND profile_id=?2').bind(id,owner.wtink_id).first();if(!member)return json({error:'FORBIDDEN'},403,origin);const rows=await env.DB.prepare(`SELECT p.id,p.body,p.created_at,p.updated_at,a.wtink_id,a.name,a.position,a.avatar,a.username,a.is_dev,a.is_admin FROM company_channel_posts p JOIN profiles a ON a.wtink_id=p.author_id WHERE p.channel_id=?1 ORDER BY p.created_at DESC LIMIT 100`).bind(id).all();return json({posts:(rows.results||[]).map(r=>({id:r.id,body:r.body,createdAt:Number(r.created_at),updatedAt:Number(r.updated_at),author:publicProfile({wtink_id:r.wtink_id,name:r.name,position:r.position,avatar:r.avatar,username:r.username,is_dev:r.is_dev,is_admin:r.is_admin})}))},200,origin)}
  if(channelPosts&&request.method==='POST'){const owner=await authProfile(request,env);if(!owner)return json({error:'UNAUTHORIZED'},401,origin);const id=decodeURIComponent(channelPosts[1]);const member=await env.DB.prepare(`SELECT r.permissions FROM company_channel_members m JOIN company_channel_roles r ON r.id=m.role_id WHERE m.channel_id=?1 AND m.profile_id=?2`).bind(id,owner.wtink_id).first();if(!member||!JSON.parse(member.permissions||'{}').post)return json({error:'FORBIDDEN'},403,origin);const bodyText=cleanText((await body(request))?.body,12000);if(!bodyText)return json({error:'EMPTY_POST'},400,origin);const pid=crypto.randomUUID(),now=Date.now();await env.DB.prepare('INSERT INTO company_channel_posts(id,channel_id,author_id,body,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?5)').bind(pid,id,owner.wtink_id,bodyText,now).run();return json({ok:true,id:pid,createdAt:now},201,origin)}
  const channelRoles=path.match(/^\/company\/channels\/([^/]+)\/roles$/);if(channelRoles&&request.method==='GET'){const owner=await authProfile(request,env);if(!owner)return json({error:'UNAUTHORIZED'},401,origin);const rows=await env.DB.prepare('SELECT id,name,permissions,created_at FROM company_channel_roles WHERE channel_id=?1 ORDER BY created_at ASC').bind(decodeURIComponent(channelRoles[1])).all();return json({roles:(rows.results||[]).map(r=>({id:r.id,name:r.name,permissions:JSON.parse(r.permissions||'{}')}))},200,origin)}
  if(channelRoles&&request.method==='POST'){const owner=await authProfile(request,env);if(!owner)return json({error:'UNAUTHORIZED'},401,origin);const id=decodeURIComponent(channelRoles[1]);const member=await env.DB.prepare(`SELECT r.permissions FROM company_channel_members m JOIN company_channel_roles r ON r.id=m.role_id JOIN company_channels c ON c.id=m.channel_id WHERE c.id=?1 AND m.profile_id=?2`).bind(id,owner.wtink_id).first();if(!member||!JSON.parse(member.permissions||'{}').manageRoles)return json({error:'FORBIDDEN'},403,origin);const input=await body(request);const name=cleanText(input?.name,60);const permissions=input?.permissions&&typeof input.permissions==='object'?input.permissions:{};if(!name)return json({error:'INVALID_ROLE'},400,origin);const rid=crypto.randomUUID();await env.DB.prepare('INSERT INTO company_channel_roles(id,channel_id,name,permissions,created_at) VALUES(?1,?2,?3,?4,?5)').bind(rid,id,name,JSON.stringify(permissions),Date.now()).run();return json({ok:true,role:{id:rid,name,permissions}},201,origin)}
  const channelRoleAction=path.match(/^\/company\/channels\/([^/]+)\/roles\/([^/]+)$/);
  if(channelRoleAction&&request.method==='PUT'){const owner=await authProfile(request,env);if(!owner)return json({error:'UNAUTHORIZED'},401,origin);const id=decodeURIComponent(channelRoleAction[1]),roleId=decodeURIComponent(channelRoleAction[2]);const member=await env.DB.prepare(`SELECT r.permissions FROM company_channel_members m JOIN company_channel_roles r ON r.id=m.role_id WHERE m.channel_id=?1 AND m.profile_id=?2`).bind(id,owner.wtink_id).first();if(!member||!JSON.parse(member.permissions||'{}').manageRoles)return json({error:'FORBIDDEN'},403,origin);const input=await body(request);const name=cleanText(input?.name,60);const permissions=input?.permissions&&typeof input.permissions==='object'?input.permissions:{};await env.DB.prepare('UPDATE company_channel_roles SET name=?1,permissions=?2 WHERE id=?3 AND channel_id=?4').bind(name||'Сотрудник',JSON.stringify(permissions),roleId,id).run();return json({ok:true},200,origin)}
  const channelOwner=path.match(/^\/company\/channels\/([^/]+)\/transfer-owner$/);if(channelOwner&&request.method==='POST'){const owner=await authProfile(request,env);if(!owner)return json({error:'UNAUTHORIZED'},401,origin);const id=decodeURIComponent(channelOwner[1]);const channel=await env.DB.prepare('SELECT owner_id FROM company_channels WHERE id=?1').bind(id).first();if(!channel||channel.owner_id!==owner.wtink_id)return json({error:'FORBIDDEN'},403,origin);const target=normalizeId((await body(request))?.profileId);const targetMember=await env.DB.prepare('SELECT role_id FROM company_channel_members WHERE channel_id=?1 AND profile_id=?2').bind(id,target).first();if(!targetMember)return json({error:'MEMBER_REQUIRED'},400,origin);const ownerMember=await env.DB.prepare('SELECT role_id FROM company_channel_members WHERE channel_id=?1 AND profile_id=?2').bind(id,owner.wtink_id).first();const employeeRole=await env.DB.prepare("SELECT id FROM company_channel_roles WHERE channel_id=?1 AND name='Сотрудник' LIMIT 1").bind(id).first();if(!ownerMember||!employeeRole)return json({error:'ROLE_NOT_READY'},409,origin);await env.DB.batch([env.DB.prepare('UPDATE company_channels SET owner_id=?1,updated_at=?2 WHERE id=?3').bind(target,Date.now(),id),env.DB.prepare('UPDATE company_channel_members SET role_id=?1 WHERE channel_id=?2 AND profile_id=?3').bind(ownerMember.role_id,id,target),env.DB.prepare('UPDATE company_channel_members SET role_id=?1 WHERE channel_id=?2 AND profile_id=?3').bind(employeeRole.id,id,owner.wtink_id)]);return json({ok:true},200,origin)}

  // WorkerTink Network: groups, work events, shift swaps, people discovery and saved posts.
  if (path === '/network/home' && request.method === 'GET') {
    const owner = await authProfile(request, env); if (!owner) return json({error:'UNAUTHORIZED'},401,origin);
    const [groups, events, swaps, people] = await Promise.all([
      env.DB.prepare(`SELECT g.id,g.name,g.slug,g.description,g.visibility,g.created_at,g.owner_id,
        (SELECT COUNT(*) FROM social_group_members gm WHERE gm.group_id=g.id) AS members,
        EXISTS(SELECT 1 FROM social_group_members me WHERE me.group_id=g.id AND me.profile_id=?1) AS joined,
        CASE WHEN g.owner_id=?1 THEN 'owner' ELSE (SELECT role FROM social_group_members mr WHERE mr.group_id=g.id AND mr.profile_id=?1) END AS member_role,
        p.name AS o_name,p.position AS o_position,p.avatar AS o_avatar,p.is_dev AS o_is_dev,p.is_admin AS o_is_admin
        FROM social_groups g JOIN profiles p ON p.wtink_id=g.owner_id
        WHERE g.visibility='public' OR EXISTS(SELECT 1 FROM social_group_members gm2 WHERE gm2.group_id=g.id AND gm2.profile_id=?1)
        ORDER BY joined DESC,g.created_at DESC LIMIT 30`).bind(owner.wtink_id).all(),
      env.DB.prepare(`SELECT e.id,e.title,e.description,e.kind,e.starts_at,e.ends_at,e.location,e.group_id,e.created_at,
        e.owner_id,o.name AS o_name,o.position AS o_position,o.avatar AS o_avatar,o.is_dev AS o_is_dev,o.is_admin AS o_is_admin,
        (SELECT COUNT(*) FROM social_event_members em WHERE em.event_id=e.id AND em.status='going') AS going,
        EXISTS(SELECT 1 FROM social_event_members me WHERE me.event_id=e.id AND me.profile_id=?1 AND me.status='going') AS joined
        FROM social_events e JOIN profiles o ON o.wtink_id=e.owner_id
        WHERE e.starts_at>=?2 ORDER BY e.starts_at ASC LIMIT 30`).bind(owner.wtink_id,Date.now()).all(),
      env.DB.prepare(`SELECT s.id,s.date,s.shift,s.requested_shift,s.note,s.status,s.created_at,s.owner_id,s.claimed_by,
        o.name AS o_name,o.position AS o_position,o.avatar AS o_avatar,o.is_dev AS o_is_dev,o.is_admin AS o_is_admin,
        c.name AS c_name,c.position AS c_position,c.avatar AS c_avatar,c.is_dev AS c_is_dev,c.is_admin AS c_is_admin
        FROM work_shift_swaps s JOIN profiles o ON o.wtink_id=s.owner_id LEFT JOIN profiles c ON c.wtink_id=s.claimed_by
        WHERE s.status='open' AND s.date>=?1 ORDER BY s.date ASC,s.created_at DESC LIMIT 30`).bind(new Date().toISOString().slice(0,10)).all(),
      env.DB.prepare(`SELECT p.wtink_id,p.name,p.position,p.avatar,p.is_dev,p.is_admin,p.last_seen,
        EXISTS(SELECT 1 FROM friend_requests r WHERE r.status='accepted' AND ((r.sender_id=?1 AND r.receiver_id=p.wtink_id) OR (r.sender_id=p.wtink_id AND r.receiver_id=?1))) AS connected,
        (SELECT COUNT(*) FROM friend_requests m WHERE m.status='accepted' AND ((m.sender_id=p.wtink_id AND m.receiver_id IN (SELECT CASE WHEN r.sender_id=?1 THEN r.receiver_id ELSE r.sender_id END FROM friend_requests r WHERE r.status='accepted' AND (r.sender_id=?1 OR r.receiver_id=?1))) OR (m.receiver_id=p.wtink_id AND m.sender_id IN (SELECT CASE WHEN r.sender_id=?1 THEN r.receiver_id ELSE r.sender_id END FROM friend_requests r WHERE r.status='accepted' AND (r.sender_id=?1 OR r.receiver_id=?1))))) AS mutual
        FROM profiles p WHERE p.wtink_id<>?1 ORDER BY p.last_seen DESC,p.updated_at DESC LIMIT 24`).bind(owner.wtink_id).all()
    ]);
    return json({
      groups:(groups.results||[]).map(r=>({id:r.id,name:r.name,slug:r.slug,description:r.description,visibility:r.visibility,owner:socialProfile({wtink_id:r.owner_id,name:r.o_name,position:r.o_position,avatar:r.o_avatar,is_dev:r.o_is_dev,is_admin:r.o_is_admin}),members:Number(r.members||0),joined:Boolean(r.joined),role:r.member_role||undefined,createdAt:Number(r.created_at||0)})),
      events:(events.results||[]).map(r=>({id:r.id,title:r.title,description:r.description,kind:r.kind,startsAt:Number(r.starts_at),endsAt:r.ends_at?Number(r.ends_at):null,location:r.location,owner:socialProfile({wtink_id:r.owner_id,name:r.o_name,position:r.o_position,avatar:r.o_avatar,is_dev:r.o_is_dev,is_admin:r.o_is_admin}),groupId:r.group_id||null,going:Number(r.going||0),joined:Boolean(r.joined)})),
      swaps:(swaps.results||[]).map(r=>({id:r.id,date:r.date,shift:r.shift,requestedShift:r.requested_shift,note:r.note,status:r.status,owner:socialProfile({wtink_id:r.owner_id,name:r.o_name,position:r.o_position,avatar:r.o_avatar,is_dev:r.o_is_dev,is_admin:r.o_is_admin}),claimedBy:r.claimed_by?socialProfile({wtink_id:r.claimed_by,name:r.c_name,position:r.c_position,avatar:r.c_avatar,is_dev:r.c_is_dev,is_admin:r.c_is_admin}):null,createdAt:Number(r.created_at||0)})),
      people:(people.results||[]).map(r=>({profile:socialProfile(r),online:Number(r.last_seen||0)>=Date.now()-ONLINE_WINDOW_MS,mutualFriends:Number(r.mutual||0),connected:Boolean(r.connected)}))
    },200,origin);
  }

  if (path === '/network/people' && request.method === 'GET') {
    const owner = await authProfile(request, env); if (!owner) return json({error:'UNAUTHORIZED'},401,origin);
    const q=cleanText(new URL(request.url).searchParams.get('query'),100).replace(/^@+/, '');
    const pattern=`%${q}%`;
    const rows=await env.DB.prepare(`SELECT p.wtink_id,p.name,p.position,p.avatar,p.is_dev,p.is_admin,p.last_seen,
      EXISTS(SELECT 1 FROM friend_requests r WHERE r.status='accepted' AND ((r.sender_id=?1 AND r.receiver_id=p.wtink_id) OR (r.sender_id=p.wtink_id AND r.receiver_id=?1))) AS connected
      FROM profiles p WHERE p.wtink_id<>?1 AND (?2='' OR p.wtink_id LIKE ?3 OR UPPER(COALESCE(p.username,'')) LIKE UPPER(?3) OR UPPER(p.name) LIKE UPPER(?3) OR UPPER(COALESCE(p.position,'')) LIKE UPPER(?3))
      ORDER BY connected DESC,p.last_seen DESC,p.updated_at DESC LIMIT 60`).bind(owner.wtink_id,q,pattern).all();
    return json({people:(rows.results||[]).map(r=>({profile:socialProfile(r),online:Number(r.last_seen||0)>=Date.now()-ONLINE_WINDOW_MS,mutualFriends:0,connected:Boolean(r.connected)}))},200,origin);
  }

  if (path === '/network/groups' && request.method === 'GET') {
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin);
    const rows=await env.DB.prepare(`SELECT g.id,g.name,g.slug,g.description,g.visibility,g.created_at,g.owner_id,
      (SELECT COUNT(*) FROM social_group_members gm WHERE gm.group_id=g.id) AS members,
      EXISTS(SELECT 1 FROM social_group_members me WHERE me.group_id=g.id AND me.profile_id=?1) AS joined,
      CASE WHEN g.owner_id=?1 THEN 'owner' ELSE (SELECT role FROM social_group_members mr WHERE mr.group_id=g.id AND mr.profile_id=?1) END AS member_role,
      p.name AS o_name,p.position AS o_position,p.avatar AS o_avatar,p.is_dev AS o_is_dev,p.is_admin AS o_is_admin
      FROM social_groups g JOIN profiles p ON p.wtink_id=g.owner_id WHERE g.visibility='public' OR EXISTS(SELECT 1 FROM social_group_members x WHERE x.group_id=g.id AND x.profile_id=?1) ORDER BY g.created_at DESC LIMIT 100`).bind(owner.wtink_id).all();
    return json({groups:(rows.results||[]).map(r=>({id:r.id,name:r.name,slug:r.slug,description:r.description,visibility:r.visibility,owner:socialProfile({wtink_id:r.owner_id,name:r.o_name,position:r.o_position,avatar:r.o_avatar,is_dev:r.o_is_dev,is_admin:r.o_is_admin}),members:Number(r.members||0),joined:Boolean(r.joined),role:r.member_role||undefined,createdAt:Number(r.created_at||0)}))},200,origin);
  }
  if (path === '/network/groups' && request.method === 'POST') {
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin); const input=await body(request);
    const name=cleanText(input?.name,80),description=cleanText(input?.description,500),visibility=input?.visibility==='private'?'private':'public'; if(name.length<2)return json({error:'INVALID_GROUP_NAME'},400,origin);
    const slug=(name.toLowerCase().replace(/[^a-zа-я0-9]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,50)||crypto.randomUUID().slice(0,8));
    const unique=`${slug}-${crypto.randomUUID().slice(0,6)}`; const id=crypto.randomUUID(),now=Date.now();
    await env.DB.batch([env.DB.prepare('INSERT INTO social_groups(id,name,slug,description,owner_id,visibility,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?7)').bind(id,name,unique,description,owner.wtink_id,visibility,now),env.DB.prepare('INSERT INTO social_group_members(group_id,profile_id,role,created_at) VALUES (?1,?2,?3,?4)').bind(id,owner.wtink_id,'owner',now)]);
    return json({group:{id,name,slug:unique,description,visibility,owner:publicProfile(owner),members:1,joined:true,role:'owner',createdAt:now}},201,origin);
  }
  const networkGroupUpdate=path.match(/^\/network\/groups\/([^/]+)$/);
  if(networkGroupUpdate && request.method==='PUT'){
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin);
    const id=decodeURIComponent(networkGroupUpdate[1]); const group=await env.DB.prepare('SELECT id,owner_id FROM social_groups WHERE id=?1').bind(id).first();
    if(!group)return json({error:'GROUP_NOT_FOUND'},404,origin); if(group.owner_id!==owner.wtink_id && !roleFlags(owner).isAdmin)return json({error:'FORBIDDEN'},403,origin);
    const input=await body(request); const name=cleanText(input?.name,80),description=cleanText(input?.description,500),visibility=input?.visibility==='private'?'private':'public';
    if(name.length<2)return json({error:'INVALID_GROUP_NAME'},400,origin);
    await env.DB.prepare('UPDATE social_groups SET name=?1,description=?2,visibility=?3,updated_at=?4 WHERE id=?5').bind(name,description,visibility,Date.now(),id).run();
    const row=await env.DB.prepare(`SELECT g.id,g.name,g.slug,g.description,g.visibility,g.created_at,g.owner_id,p.name AS o_name,p.position AS o_position,p.avatar AS o_avatar,p.username AS o_username,p.is_dev AS o_is_dev,p.is_admin AS o_is_admin,
      (SELECT COUNT(*) FROM social_group_members gm WHERE gm.group_id=g.id) AS members FROM social_groups g JOIN profiles p ON p.wtink_id=g.owner_id WHERE g.id=?1`).bind(id).first();
    return json({group:{id:row.id,name:row.name,slug:row.slug,description:row.description,visibility:row.visibility,owner:socialProfile({wtink_id:row.owner_id,name:row.o_name,position:row.o_position,avatar:row.o_avatar,username:row.o_username,is_dev:row.o_is_dev,is_admin:row.o_is_admin}),members:Number(row.members||0),joined:true,role:'owner',createdAt:Number(row.created_at||0)}},200,origin);
  }

  const networkGroupDetail=path.match(/^\/network\/groups\/([^/]+)$/);
  if(networkGroupDetail && request.method==='GET'){
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin); const key=decodeURIComponent(networkGroupDetail[1]);
    const g=await env.DB.prepare(`SELECT g.id,g.name,g.slug,g.description,g.visibility,g.created_at,g.owner_id,p.name AS o_name,p.position AS o_position,p.avatar AS o_avatar,p.is_dev AS o_is_dev,p.is_admin AS o_is_admin FROM social_groups g JOIN profiles p ON p.wtink_id=g.owner_id WHERE g.id=?1 OR g.slug=?1 LIMIT 1`).bind(key).first();
    if(!g)return json({error:'GROUP_NOT_FOUND'},404,origin);
    const member=await env.DB.prepare('SELECT role FROM social_group_members WHERE group_id=?1 AND profile_id=?2').bind(g.id,owner.wtink_id).first();
    if(g.visibility==='private'&&!member)return json({error:'INVITE_REQUIRED'},403,origin);
    const rows=await env.DB.prepare(`SELECT gm.role,gm.created_at,p.wtink_id,p.name,p.position,p.avatar,p.username,p.is_dev,p.is_admin FROM social_group_members gm JOIN profiles p ON p.wtink_id=gm.profile_id WHERE gm.group_id=?1 ORDER BY gm.created_at ASC LIMIT 200`).bind(g.id).all();
    return json({group:{id:g.id,name:g.name,slug:g.slug,description:g.description,visibility:g.visibility,owner:socialProfile({wtink_id:g.owner_id,name:g.o_name,position:g.o_position,avatar:g.o_avatar,is_dev:g.o_is_dev,is_admin:g.o_is_admin}),members:(rows.results||[]).length,joined:Boolean(member),role:member?.role||null,createdAt:Number(g.created_at||0)},members:(rows.results||[]).map(r=>({role:r.role,profile:socialProfile({wtink_id:r.wtink_id,name:r.name,position:r.position,avatar:r.avatar,username:r.username,is_dev:r.is_dev,is_admin:r.is_admin})}))},200,origin);
  }
  const groupJoin=path.match(/^\/network\/groups\/([^/]+)\/join$/);
  if(groupJoin && (request.method==='POST'||request.method==='DELETE')){
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin); const id=decodeURIComponent(groupJoin[1]); const group=await env.DB.prepare('SELECT id,visibility FROM social_groups WHERE id=?1').bind(id).first(); if(!group)return json({error:'GROUP_NOT_FOUND'},404,origin);
    if(request.method==='POST'){await env.DB.prepare('INSERT OR IGNORE INTO social_group_members(group_id,profile_id,role,created_at) VALUES (?1,?2,\'member\',?3)').bind(id,owner.wtink_id,Date.now()).run();}
    else await env.DB.prepare("DELETE FROM social_group_members WHERE group_id=?1 AND profile_id=?2 AND role<>'owner'").bind(id,owner.wtink_id).run();
    return json({ok:true},200,origin);
  }

  if (path === '/network/events' && request.method === 'POST') {
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin); const input=await body(request); const title=cleanText(input?.title,120),description=cleanText(input?.description,1200),kind=cleanText(input?.kind,40)||'work',location=cleanText(input?.location,160); const startsAt=Number(input?.startsAt); const endsAt=input?.endsAt==null?null:Number(input.endsAt); if(!title||!Number.isFinite(startsAt))return json({error:'INVALID_EVENT'},400,origin); const groupId=input?.groupId?String(input.groupId):null;
    if(groupId){const member=await env.DB.prepare('SELECT 1 FROM social_group_members WHERE group_id=?1 AND profile_id=?2').bind(groupId,owner.wtink_id).first();if(!member)return json({error:'GROUP_MEMBERSHIP_REQUIRED'},403,origin)}
    const id=crypto.randomUUID(),now=Date.now(); await env.DB.batch([env.DB.prepare('INSERT INTO social_events(id,owner_id,group_id,title,description,kind,starts_at,ends_at,location,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?10)').bind(id,owner.wtink_id,groupId,title,description,kind,startsAt,endsAt,location,now),env.DB.prepare("INSERT INTO social_event_members(event_id,profile_id,status,created_at) VALUES (?1,?2,'going',?3)").bind(id,owner.wtink_id,now)]); return json({event:{id,title,description,kind,startsAt,endsAt,location,owner:publicProfile(owner),groupId,going:1,joined:true}},201,origin);
  }
  const eventRsvp=path.match(/^\/network\/events\/([^/]+)\/rsvp$/);
  if(eventRsvp && request.method==='POST'){
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin); const id=decodeURIComponent(eventRsvp[1]); const input=await body(request); const status=['going','interested','declined'].includes(input?.status)?input.status:'going'; const event=await env.DB.prepare('SELECT id FROM social_events WHERE id=?1').bind(id).first(); if(!event)return json({error:'EVENT_NOT_FOUND'},404,origin); await env.DB.prepare('INSERT OR REPLACE INTO social_event_members(event_id,profile_id,status,created_at) VALUES (?1,?2,?3,?4)').bind(id,owner.wtink_id,status,Date.now()).run(); return json({ok:true},200,origin);
  }
  if (path === '/network/swaps' && request.method === 'POST') {
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin); const input=await body(request); const date=cleanText(input?.date,10),shift=cleanText(input?.shift,20),requestedShift=cleanText(input?.requestedShift,20),note=cleanText(input?.note,500); if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!shift||!requestedShift)return json({error:'INVALID_SHIFT_SWAP'},400,origin); const id=crypto.randomUUID(),now=Date.now(); await env.DB.prepare('INSERT INTO work_shift_swaps(id,owner_id,date,shift,requested_shift,note,status,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,\'open\',?7,?7)').bind(id,owner.wtink_id,date,shift,requestedShift,note,now).run(); return json({swap:{id,date,shift,requestedShift,note,status:'open',owner:publicProfile(owner),claimedBy:null,createdAt:now}},201,origin);
  }
  const swapClaim=path.match(/^\/network\/swaps\/([^/]+)\/claim$/);
  if(swapClaim && request.method==='POST'){
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin); const id=decodeURIComponent(swapClaim[1]); const swap=await env.DB.prepare("SELECT owner_id,status FROM work_shift_swaps WHERE id=?1").bind(id).first(); if(!swap)return json({error:'SWAP_NOT_FOUND'},404,origin); if(swap.owner_id===owner.wtink_id)return json({error:'CANNOT_CLAIM_OWN_SWAP'},400,origin); if(swap.status!=='open')return json({error:'SWAP_ALREADY_CLAIMED'},409,origin); await env.DB.prepare("UPDATE work_shift_swaps SET status='claimed',claimed_by=?1,updated_at=?2 WHERE id=?3 AND status='open'").bind(owner.wtink_id,Date.now(),id).run(); return json({ok:true},200,origin);
  }
  const savePost=path.match(/^\/network\/posts\/([^/]+)\/save$/);
  if(savePost && request.method==='POST'){
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin); const id=decodeURIComponent(savePost[1]); const input=await body(request); const post=await env.DB.prepare('SELECT id FROM social_posts WHERE id=?1').bind(id).first(); if(!post)return json({error:'POST_NOT_FOUND'},404,origin); if(input?.saved===false)await env.DB.prepare('DELETE FROM social_saved_posts WHERE post_id=?1 AND profile_id=?2').bind(id,owner.wtink_id).run(); else await env.DB.prepare('INSERT OR IGNORE INTO social_saved_posts(post_id,profile_id,created_at) VALUES (?1,?2,?3)').bind(id,owner.wtink_id,Date.now()).run(); return json({saved:input?.saved!==false},200,origin);
  }
  if(path==='/network/posts/saved' && request.method==='GET'){
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin); const rows=await env.DB.prepare(`SELECT p.id,p.body,p.created_at,p.updated_at,a.wtink_id AS a_id,a.name AS a_name,a.position AS a_position,a.avatar AS a_avatar,a.is_dev AS a_is_dev,a.is_admin AS a_is_admin,(SELECT COUNT(*) FROM social_post_likes l WHERE l.post_id=p.id) AS likes,(SELECT COUNT(*) FROM social_post_comments c WHERE c.post_id=p.id) AS comments,1 AS liked FROM social_posts p JOIN social_saved_posts s ON s.post_id=p.id AND s.profile_id=?1 JOIN profiles a ON a.wtink_id=p.author_id ORDER BY s.created_at DESC LIMIT 100`).bind(owner.wtink_id).all(); return json({posts:(rows.results||[]).map(r=>({id:r.id,body:r.body,createdAt:Number(r.created_at),updatedAt:Number(r.updated_at),author:socialProfile({wtink_id:r.a_id,name:r.a_name,position:r.a_position,avatar:r.a_avatar,is_dev:r.a_is_dev,is_admin:r.a_is_admin}),likes:Number(r.likes||0),comments:Number(r.comments||0),liked:true}))},200,origin);
  }

  const adminProfile = async () => {
    const owner = await authProfile(request, env);
    if (!owner || !roleFlags(owner).isAdmin) return null;
    return owner;
  };

  if (path === '/admin/overview' && request.method === 'GET') {
    if (!(await adminProfile())) return json({error:'FORBIDDEN'}, 403, origin);
    const [profiles, friends, pending] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) AS count FROM profiles').first(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM friend_requests WHERE status = 'accepted'").first(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM friend_requests WHERE status = 'pending'").first()
    ]);
    return json({stats:{profiles:Number(profiles?.count||0),friendships:Number(friends?.count||0),pendingRequests:Number(pending?.count||0)}},200,origin);
  }

  const adminDetailMatch = path.match(/^\/admin\/profiles\/([^/]+)$/);
  if (adminDetailMatch && request.method === 'GET') {
    if (!(await adminProfile())) return json({error:'FORBIDDEN'},403,origin);
    const target=normalizeId(decodeURIComponent(adminDetailMatch[1]));
    const profile=await env.DB.prepare('SELECT wtink_id,name,position,avatar,is_dev,is_admin,created_at,updated_at,last_seen FROM profiles WHERE wtink_id=?1').bind(target).first();
    if(!profile)return json({error:'USER_NOT_FOUND'},404,origin);
    const [friends,requests,devices,blocked,media,deviceRows]=await Promise.all([
      env.DB.prepare("SELECT COUNT(*) AS count FROM friend_requests WHERE status='accepted' AND (sender_id=?1 OR receiver_id=?1)").bind(target).first(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM friend_requests WHERE status='pending' AND (sender_id=?1 OR receiver_id=?1)").bind(target).first(),
      env.DB.prepare('SELECT COUNT(*) AS count FROM webauthn_credentials WHERE profile_id=?1').bind(target).first(),
      env.DB.prepare('SELECT COUNT(*) AS count FROM blocked_profiles WHERE profile_id=?1 OR blocked_id=?1').bind(target).first(),
      env.DB.prepare('SELECT COUNT(*) AS count FROM chat_media WHERE sender_id=?1 OR receiver_id=?1').bind(target).first(),
      env.DB.prepare('SELECT id,device_name,device_type,backed_up,created_at,updated_at FROM webauthn_credentials WHERE profile_id=?1 ORDER BY updated_at DESC').bind(target).all()
    ]);
    return json({profile:{...publicProfile(profile),createdAt:Number(profile.created_at||0),updatedAt:Number(profile.updated_at||0),lastSeen:Number(profile.last_seen||0),online:Number(profile.last_seen||0)>=Date.now()-ONLINE_WINDOW_MS},stats:{friends:Number(friends?.count||0),requests:Number(requests?.count||0),onePass:Number(devices?.count||0),blocks:Number(blocked?.count||0),media:Number(media?.count||0)},devices:(deviceRows.results||[]).map(r=>({id:r.id,deviceName:r.device_name||'Устройство',deviceType:r.device_type||'singleDevice',backedUp:Boolean(r.backed_up),createdAt:Number(r.created_at||0),updatedAt:Number(r.updated_at||0)}))},200,origin);
  }

  if (path === '/admin/profiles' && request.method === 'GET') {
    if (!(await adminProfile())) return json({error:'FORBIDDEN'}, 403, origin);
    const url = new URL(request.url);
    const query = normalizeId(url.searchParams.get('query') || '');
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 50)));
    const pattern = `%${query}%`;
    const rows = await env.DB.prepare(`SELECT wtink_id,name,position,avatar,is_dev,is_admin,created_at,updated_at,last_seen FROM profiles WHERE ?1 = '' OR wtink_id LIKE ?2 OR UPPER(name) LIKE UPPER(?2) ORDER BY updated_at DESC LIMIT ?3`).bind(query, pattern, limit).all();
    return json({profiles:(rows.results||[]).map(row=>({...publicProfile(row),createdAt:Number(row.created_at||0),updatedAt:Number(row.updated_at||0),lastSeen:Number(row.last_seen||0),online:Number(row.last_seen||0)>=Date.now()-ONLINE_WINDOW_MS}))},200,origin);
  }

  const adminProfilePath = path.match(/^\/admin\/profiles\/([^/]+)(?:\/(revoke))?$/);
  if (adminProfilePath && request.method === 'POST' && adminProfilePath[2] === 'revoke') {
    if (!(await adminProfile())) return json({error:'FORBIDDEN'}, 403, origin);
    const target = normalizeId(decodeURIComponent(adminProfilePath[1]));
    if (!validId(target)) return json({error:'INVALID_ID'},400,origin);
    const revokedTokenHash=await sha256(randomToken()); const revokedAt=Date.now();
    await env.DB.batch([
      env.DB.prepare('UPDATE profiles SET token_hash = ?1, updated_at = ?2, last_seen = ?2 WHERE wtink_id = ?3').bind(revokedTokenHash,revokedAt,target),
      env.DB.prepare('DELETE FROM auth_sessions WHERE profile_id = ?1').bind(target)
    ]);
    return json({ok:true},200,origin);
  }

  if (adminProfilePath && request.method === 'DELETE') {
    if (!(await adminProfile())) return json({error:'FORBIDDEN'}, 403, origin);
    const target = normalizeId(decodeURIComponent(adminProfilePath[1]));
    if (!validId(target) || target === DEV_WTINK_ID) return json({error:'FORBIDDEN'},403,origin);
    const exists = await env.DB.prepare('SELECT wtink_id FROM profiles WHERE wtink_id = ?1').bind(target).first();
    if (!exists) return json({error:'USER_NOT_FOUND'},404,origin);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM friend_requests WHERE sender_id = ?1 OR receiver_id = ?1').bind(target),
      env.DB.prepare('DELETE FROM peer_sessions WHERE initiator_id = ?1 OR receiver_id = ?1').bind(target),
      env.DB.prepare('DELETE FROM push_subscriptions WHERE profile_id = ?1').bind(target),
      env.DB.prepare('DELETE FROM push_reminders WHERE profile_id = ?1').bind(target),
      env.DB.prepare('DELETE FROM auth_challenges WHERE profile_id = ?1').bind(target),
      env.DB.prepare('DELETE FROM auth_sessions WHERE profile_id = ?1').bind(target),
      env.DB.prepare('DELETE FROM webauthn_credentials WHERE profile_id = ?1').bind(target),
      env.DB.prepare('DELETE FROM profiles WHERE wtink_id = ?1').bind(target)
    ]);
    return json({ok:true},200,origin);
  }


  // Work teams and shared document links.
  if (path === '/work/teams' && request.method === 'GET') {
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin);
    const rows=await env.DB.prepare(`SELECT t.id,t.name,t.description,t.owner_id,t.created_at,COUNT(m.profile_id) AS members,COALESCE((SELECT role FROM work_team_members wm WHERE wm.team_id=t.id AND wm.profile_id=?1),'') AS role FROM work_teams t JOIN work_team_members me ON me.team_id=t.id AND me.profile_id=?1 LEFT JOIN work_team_members m ON m.team_id=t.id GROUP BY t.id ORDER BY t.updated_at DESC`).bind(owner.wtink_id).all();
    const ownerIds=[...(rows.results||[])].map(r=>r.owner_id); const owners=new Map();
    if(ownerIds.length){const qs=ownerIds.map((_,i)=>`?${i+1}`).join(',');const os=await env.DB.prepare(`SELECT wtink_id,name,position,avatar,is_dev,is_admin,username FROM profiles WHERE wtink_id IN (${qs})`).bind(...ownerIds).all();for(const r of os.results||[])owners.set(r.wtink_id,publicProfile(r));}
    return json({teams:(rows.results||[]).map(r=>({id:r.id,name:r.name,description:r.description||'',owner:owners.get(r.owner_id)||null,members:Number(r.members||0),role:r.role||'member',createdAt:Number(r.created_at||0)}))},200,origin);
  }
  if (path === '/work/teams' && request.method === 'POST') {
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin); const input=await body(request); const name=cleanText(input?.name,100); const description=cleanText(input?.description,500);
    if(name.length<2)return json({error:'INVALID_TEAM'},400,origin); const id=crypto.randomUUID(),now=Date.now();
    await env.DB.batch([env.DB.prepare('INSERT INTO work_teams(id,owner_id,name,description,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?5)').bind(id,owner.wtink_id,name,description,now),env.DB.prepare("INSERT INTO work_team_members(team_id,profile_id,role,joined_at) VALUES(?1,?2,'owner',?3)").bind(id,owner.wtink_id,now)]);
    return json({team:{id,name,description,owner:publicProfile(owner),members:1,role:'owner',createdAt:now}},201,origin);
  }
  const workTeamMembers=path.match(/^\/work\/teams\/([^/]+)\/members$/);
  if(workTeamMembers && request.method==='POST'){
    const owner=await authProfile(request,env);if(!owner)return json({error:'UNAUTHORIZED'},401,origin);const teamId=decodeURIComponent(workTeamMembers[1]);const input=await body(request);const profileId=normalizeId(input?.profileId);
    const team=await env.DB.prepare('SELECT id,owner_id FROM work_teams WHERE id=?1').bind(teamId).first();if(!team)return json({error:'TEAM_NOT_FOUND'},404,origin);if(normalizeId(team.owner_id)!==normalizeId(owner.wtink_id))return json({error:'FORBIDDEN'},403,origin);if(!validId(profileId))return json({error:'INVALID_ID'},400,origin);const target=await env.DB.prepare('SELECT wtink_id FROM profiles WHERE wtink_id=?1').bind(profileId).first();if(!target)return json({error:'USER_NOT_FOUND'},404,origin);await env.DB.prepare("INSERT OR IGNORE INTO work_team_members(team_id,profile_id,role,joined_at) VALUES(?1,?2,'member',?3)").bind(teamId,profileId,Date.now()).run();return json({ok:true},200,origin);
  }
  if(workTeamMembers && request.method==='DELETE'){
    const owner=await authProfile(request,env);if(!owner)return json({error:'UNAUTHORIZED'},401,origin);const teamId=decodeURIComponent(workTeamMembers[1]);const input=await body(request);const profileId=normalizeId(input?.profileId);const team=await env.DB.prepare('SELECT owner_id FROM work_teams WHERE id=?1').bind(teamId).first();if(!team||normalizeId(team.owner_id)!==normalizeId(owner.wtink_id))return json({error:'FORBIDDEN'},403,origin);if(profileId===normalizeId(team.owner_id))return json({error:'OWNER_CANNOT_BE_REMOVED'},400,origin);await env.DB.prepare('DELETE FROM work_team_members WHERE team_id=?1 AND profile_id=?2').bind(teamId,profileId).run();return json({ok:true},200,origin);
  }
  const workTeamDocs=path.match(/^\/work\/teams\/([^/]+)\/documents$/);
  if(workTeamDocs && request.method==='GET'){
    const owner=await authProfile(request,env);if(!owner)return json({error:'UNAUTHORIZED'},401,origin);const teamId=decodeURIComponent(workTeamDocs[1]);const member=await env.DB.prepare('SELECT 1 FROM work_team_members WHERE team_id=?1 AND profile_id=?2').bind(teamId,owner.wtink_id).first();if(!member)return json({error:'FORBIDDEN'},403,origin);const rows=await env.DB.prepare(`SELECT d.id,d.team_id,d.title,d.description,d.url,d.created_at,d.updated_at,p.wtink_id,p.name,p.position,p.avatar,p.is_dev,p.is_admin,p.username FROM work_documents d JOIN profiles p ON p.wtink_id=d.owner_id WHERE d.team_id=?1 ORDER BY d.updated_at DESC LIMIT 200`).bind(teamId).all();return json({documents:(rows.results||[]).map(r=>({id:r.id,teamId:r.team_id,title:r.title,description:r.description||'',url:r.url,owner:publicProfile(r),createdAt:Number(r.created_at),updatedAt:Number(r.updated_at)}))},200,origin);
  }
  if(workTeamDocs && request.method==='POST'){
    const owner=await authProfile(request,env);if(!owner)return json({error:'UNAUTHORIZED'},401,origin);const teamId=decodeURIComponent(workTeamDocs[1]);const member=await env.DB.prepare('SELECT 1 FROM work_team_members WHERE team_id=?1 AND profile_id=?2').bind(teamId,owner.wtink_id).first();if(!member)return json({error:'FORBIDDEN'},403,origin);const input=await body(request);const title=cleanText(input?.title,160);const description=cleanText(input?.description,500);const url=String(input?.url||'').trim();if(title.length<2||!/^https?:\/\//i.test(url))return json({error:'INVALID_DOCUMENT'},400,origin);const id=crypto.randomUUID(),now=Date.now();await env.DB.prepare('INSERT INTO work_documents(id,team_id,owner_id,title,description,url,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?7)').bind(id,teamId,owner.wtink_id,title,description,url,now).run();return json({document:{id,teamId,title,description,url,owner:publicProfile(owner),createdAt:now,updatedAt:now}},201,origin);
  }
  const workDoc=path.match(/^\/work\/documents\/([^/]+)$/);
  if(workDoc && request.method==='DELETE'){
    const owner=await authProfile(request,env);if(!owner)return json({error:'UNAUTHORIZED'},401,origin);const id=decodeURIComponent(workDoc[1]);const row=await env.DB.prepare('SELECT d.id,d.owner_id,t.owner_id AS team_owner FROM work_documents d JOIN work_teams t ON t.id=d.team_id WHERE d.id=?1').bind(id).first();if(!row)return json({error:'DOCUMENT_NOT_FOUND'},404,origin);if(normalizeId(row.owner_id)!==normalizeId(owner.wtink_id)&&normalizeId(row.team_owner)!==normalizeId(owner.wtink_id))return json({error:'FORBIDDEN'},403,origin);await env.DB.prepare('DELETE FROM work_documents WHERE id=?1').bind(id).run();return json({ok:true},200,origin);
  }

  if (request.method === 'GET' && path === '/friends') {
    const owner = await authProfile(request, env);
    if (!owner) return json({error: 'UNAUTHORIZED'}, 401, origin);
    const rows = await env.DB.prepare(`
      SELECT
        CASE WHEN r.sender_id = ?1 THEN t.wtink_id ELSE s.wtink_id END AS wtink_id,
        CASE WHEN r.sender_id = ?1 THEN t.name ELSE s.name END AS name,
        CASE WHEN r.sender_id = ?1 THEN t.position ELSE s.position END AS position,
        CASE WHEN r.sender_id = ?1 THEN t.avatar ELSE s.avatar END AS avatar,
        CASE WHEN r.sender_id = ?1 THEN t.is_dev ELSE s.is_dev END AS is_dev,
        CASE WHEN r.sender_id = ?1 THEN t.is_admin ELSE s.is_admin END AS is_admin,
        CASE WHEN r.sender_id = ?1 THEN t.last_seen ELSE s.last_seen END AS last_seen,
        r.updated_at
      FROM friend_requests r
      JOIN profiles s ON s.wtink_id = r.sender_id
      JOIN profiles t ON t.wtink_id = r.receiver_id
      WHERE r.status = 'accepted' AND (r.sender_id = ?1 OR r.receiver_id = ?1)
      ORDER BY r.updated_at DESC
      LIMIT 200
    `).bind(owner.wtink_id).all();
    return json({friends: (rows.results || []).map(row => ({profile: publicProfile({wtink_id: row.wtink_id, name: row.name, position: row.position, avatar: row.avatar, is_dev: row.is_dev, is_admin: row.is_admin}), addedAt: Number(row.updated_at || Date.now()), lastSeen: Number(row.last_seen || row.updated_at || 0), online: Number(row.last_seen || 0) >= Date.now() - ONLINE_WINDOW_MS}))}, 200, origin);
  }

  return json({error: 'NOT_FOUND'}, 404, origin);
}

async function processPushReminders(env) {
  const now = Date.now();
  const rows = await env.DB.prepare(`SELECT id, profile_id, kind, due_at, title, body, tag FROM push_reminders WHERE sent_at IS NULL AND due_at <= ?1 ORDER BY due_at ASC LIMIT 100`).bind(now).all();
  for (const row of rows.results || []) {
    await notifyProfile(env, row.profile_id, row.kind, {title:row.title,body:row.body,url:'./',tag:row.tag,urgency:row.kind==='shift'?'high':'normal'});
    await env.DB.prepare('UPDATE push_reminders SET sent_at = ?1, updated_at = ?1 WHERE id = ?2 AND sent_at IS NULL').bind(Date.now(),row.id).run();
  }
  await env.DB.prepare('DELETE FROM push_reminders WHERE sent_at IS NOT NULL AND sent_at < ?1').bind(now - 7*24*60*60*1000).run();
}

export default {fetch: async (request, env, ctx) => { try { return await handle(request, env, ctx); } catch (error) { const origin = corsOrigin(request, env) || '*'; return json({error:'INTERNAL_ERROR'},500,origin); } }, async scheduled(controller, env) { await processPushReminders(env); }};
