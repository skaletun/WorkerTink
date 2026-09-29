const ID_RE = /^WTINKID-\d{6}$/i;
const displayId = (value) => { const match = String(value || '').match(/^(?:WTINKID)-(\d{6})$/i); return match ? `WTinkID-${match[1]}` : String(value || ''); };
const NAME_MAX = 80;
const POSITION_MAX = 120;
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
  return String(request.headers.get('Origin') || env.WEBAUTHN_ORIGIN || '').replace(/\/$/, '');
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

async function authProfile(request, env) {
  const token = bearer(request);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const direct = await env.DB.prepare('SELECT wtink_id, name, position, avatar, is_dev, is_admin, token_hash, pin_hash, pin_salt, pin_failed_attempts, pin_locked_until, webauthn_user_id, created_at, updated_at, last_seen FROM profiles WHERE token_hash = ?1').bind(tokenHash).first();
  if (direct) return direct;
  const session = await env.DB.prepare('SELECT profile_id FROM auth_sessions WHERE token_hash = ?1 AND expires_at > ?2').bind(tokenHash,Date.now()).first();
  if (!session) return null;
  return env.DB.prepare('SELECT wtink_id, name, position, avatar, is_dev, is_admin, token_hash, pin_hash, pin_salt, pin_failed_attempts, pin_locked_until, webauthn_user_id, created_at, updated_at, last_seen FROM profiles WHERE wtink_id = ?1').bind(session.profile_id).first();
}


const DEFAULT_PUSH_PREFERENCES = {friendRequests:true,friendAccepted:true,messages:true,shifts:true,absences:true,payroll:true};
function cleanPushPreferences(value) {
  const input = value && typeof value === 'object' ? value : {};
  return {
    friendRequests: input.friendRequests !== false,
    friendAccepted: input.friendAccepted !== false,
    messages: input.messages !== false,
    shifts: input.shifts !== false,
    absences: input.absences !== false,
    payroll: input.payroll !== false,
  };
}
function pushEnabledFor(preferences, kind) {
  if (!preferences || preferences.enabled === false) return false;
  const key = kind === 'friendRequest' || kind === 'peerRequest' ? 'friendRequests' : kind === 'friendAccepted' ? 'friendAccepted' : kind === 'message' ? 'messages' : kind;
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
    const row = await env.DB.prepare(`SELECT wtink_id, name, position, avatar, is_dev, is_admin, pin_hash, pin_salt, pin_failed_attempts, pin_locked_until, last_seen FROM profiles WHERE wtink_id = ?1`).bind(wtinkId).first();
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
    await env.DB.prepare('UPDATE profiles SET token_hash = ?1, pin_failed_attempts = 0, pin_locked_until = 0, updated_at = ?2, last_seen = ?2 WHERE wtink_id = ?3').bind(await sha256(token),Date.now(),wtinkId).run();
    const passkey = await env.DB.prepare('SELECT COUNT(*) AS count FROM webauthn_credentials WHERE profile_id = ?1').bind(wtinkId).first();
    const setupRow = await env.DB.prepare('SELECT setup_ciphertext, setup_iv FROM account_setup WHERE wtink_id = ?1').bind(wtinkId).first();
    let setup = null;
    if (setupRow) setup = await decryptSetup(env, setupRow.setup_ciphertext, setupRow.setup_iv);
    return json({profile:publicProfile(row),token,setup,security:{pinSet:true,onePassAvailable:Number(passkey?.count||0)>0}},200,origin);
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
    if (!Number.isFinite(Number(clean.salary)) || Number(clean.salary) < 0 || !Number.isFinite(Number(clean.taxRate)) || Number(clean.taxRate) < 0 || Number(clean.taxRate) > 100 || !Number.isFinite(Number(clean.stage)) || Number(clean.stage) < 0 || !Number.isFinite(Number(clean.vacTotal)) || Number(clean.vacTotal) < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(String(clean.startDate||'')) || !['5/2','4/1','3/2','3/1','6/1','2/2','7/0'].includes(String(clean.scheduleType)) || !['day','night','full'].includes(String(clean.scheduleShift)) || !Number.isFinite(Number(clean.scheduleVakhtaMonths)) || Number(clean.scheduleVakhtaMonths) < 1 || Number(clean.scheduleVakhtaMonths) > 6 || !['day-day','day-night','night-night'].includes(String(clean.schedulePairType)) || !Number.isFinite(Number(clean.holidayCoeff)) || !Number.isFinite(Number(clean.nightExtraPercent))) return json({error:'INVALID_SETUP'},400,origin);
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
    const pin = String(input?.pin || '');
    if (!validId(wtinkId) || !name || !position || !validPin(pin)) return json({error: !validPin(pin) ? 'INVALID_PIN' : 'INVALID_PROFILE'}, 400, origin);

    const existing = await env.DB.prepare('SELECT wtink_id FROM profiles WHERE wtink_id = ?1').bind(wtinkId).first();
    if (existing) return json({error: 'WTINK_ID_TAKEN'}, 409, origin);

    const token = randomToken();
    const tokenHash = await sha256(token);
    const pinData = await hashPin(pin);
    const webauthnUserId = randomToken();
    const now = Date.now();
    try {
      await env.DB.prepare(`
        INSERT INTO profiles (wtink_id, name, position, avatar, is_dev, is_admin, token_hash, pin_hash, pin_salt, webauthn_user_id, created_at, updated_at, last_seen)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11, ?11)
      `).bind(wtinkId, name, position, avatar, wtinkId === DEV_WTINK_ID ? 1 : 0, wtinkId === DEV_WTINK_ID ? 1 : 0, tokenHash, pinData.hash, pinData.salt, webauthnUserId, now).run();
    } catch (error) {
      if (String(error).toLowerCase().includes('unique')) return json({error: 'WTINK_ID_TAKEN'}, 409, origin);
      throw error;
    }
    return json({profile: publicProfile({wtink_id:wtinkId,name,position,avatar}), token, security:{pinSet:true,onePassAvailable:false}}, 201, origin);
  }

  if (request.method === 'POST' && path === '/auth/onepass/register/options') {
    const owner = await authProfile(request, env);
    if (!owner) return json({error:'UNAUTHORIZED'},401,origin);
    const {generateRegistrationOptions} = await import('@simplewebauthn/server');
    const rpID = webAuthnRpId(request,env);
    const webOrigin = webAuthnOrigin(request,env);
    if (!rpID || !webOrigin) return json({error:'WEBAUTHN_ORIGIN_REQUIRED'},400,origin);
    const credentials = await env.DB.prepare('SELECT id, transports FROM webauthn_credentials WHERE profile_id = ?1').bind(owner.wtink_id).all();
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
      excludeCredentials:(credentials.results||[]).map(item=>({id:item.id,transports:JSON.parse(item.transports||'[]')})),
      authenticatorSelection:{residentKey:'required',userVerification:'preferred',authenticatorAttachment:'platform'}
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
    const challenge = await env.DB.prepare(`SELECT id, challenge FROM auth_challenges WHERE profile_id = ?1 AND kind = 'onepass_register' AND expires_at > ?2 ORDER BY created_at DESC LIMIT 1`).bind(owner.wtink_id,Date.now()).first();
    if (!challenge) return json({error:'ONEPASS_CHALLENGE_EXPIRED'},410,origin);
    const {verifyRegistrationResponse} = await import('@simplewebauthn/server');
    const rpID = webAuthnRpId(request,env);
    const webOrigin = webAuthnOrigin(request,env);
    let verification;
    try {
      verification = await verifyRegistrationResponse({response,expectedChallenge:challenge.challenge,expectedOrigin:webOrigin,expectedRPID:rpID});
    } catch { return json({error:'ONEPASS_VERIFICATION_FAILED'},400,origin); }
    if (!verification.verified || !verification.registrationInfo) return json({error:'ONEPASS_VERIFICATION_FAILED'},400,origin);
    const {credential,credentialDeviceType,credentialBackedUp}=verification.registrationInfo;
    const now=Date.now();
    await env.DB.batch([
      env.DB.prepare(`INSERT OR REPLACE INTO webauthn_credentials(id,profile_id,user_id,public_key,counter,device_type,backed_up,transports,device_name,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?9)`).bind(credential.id,owner.wtink_id,owner.webauthn_user_id || owner.wtink_id,base64Url(credential.publicKey),credential.counter,credentialDeviceType,credentialBackedUp?1:0,JSON.stringify(credential.transports||[]),deviceName,now),
      env.DB.prepare('DELETE FROM auth_challenges WHERE id = ?1').bind(challenge.id)
    ]);
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
      env.DB.prepare('DELETE FROM auth_challenges WHERE profile_id = ?1 AND kind = ?2').bind(wtinkId,'onepass_login'),
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
    const challenge=await env.DB.prepare(`SELECT id, challenge FROM auth_challenges WHERE profile_id = ?1 AND kind = 'onepass_login' AND expires_at > ?2 ORDER BY created_at DESC LIMIT 1`).bind(credential.profile_id,Date.now()).first();
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
    await env.DB.batch([
      env.DB.prepare('UPDATE webauthn_credentials SET counter = ?1, updated_at = ?2 WHERE id = ?3').bind(verification.authenticationInfo.newCounter,now,credential.id),
      env.DB.prepare('UPDATE profiles SET token_hash = ?1, updated_at = ?2, last_seen = ?2 WHERE wtink_id = ?3').bind(await sha256(token),now,owner.wtink_id),
      env.DB.prepare('DELETE FROM auth_challenges WHERE id = ?1').bind(challenge.id)
    ]);
    return json({profile:publicProfile(owner),token,security:{pinSet:true,onePassAvailable:true}},200,origin);
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
    await env.DB.prepare(`INSERT INTO chat_device_keys(profile_id,public_key,updated_at) VALUES (?1,?2,?3) ON CONFLICT(profile_id) DO UPDATE SET public_key=excluded.public_key,updated_at=excluded.updated_at`).bind(owner.wtink_id,JSON.stringify(publicKey),now).run();
    return json({ok:true,key:{profileId:displayId(owner.wtink_id),publicKey,updatedAt:now}},200,origin);
  }
  const chatKeyMatch=path.match(/^\/chat\/keys\/([^/]+)$/);
  if(chatKeyMatch&&request.method==='GET'){
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin); const target=normalizeId(decodeURIComponent(chatKeyMatch[1]));
    if(!validId(target))return json({error:'INVALID_ID'},400,origin);
    const friend=await env.DB.prepare(`SELECT 1 FROM friend_requests WHERE status='accepted' AND ((sender_id=?1 AND receiver_id=?2) OR (sender_id=?2 AND receiver_id=?1)) LIMIT 1`).bind(owner.wtink_id,target).first();
    if(!friend)return json({error:'NOT_FRIENDS'},403,origin);
    const row=await env.DB.prepare('SELECT public_key,updated_at FROM chat_device_keys WHERE profile_id=?1').bind(target).first();
    if(!row)return json({error:'CHAT_KEY_NOT_READY'},404,origin);
    return json({key:{profileId:displayId(target),publicKey:JSON.parse(row.public_key),updatedAt:Number(row.updated_at)}},200,origin);
  }
  if(request.method==='POST'&&path==='/auth/qr/start'){
    const input=await body(request); const publicKey=input?.publicKey;
    if(!publicKey||publicKey.kty!=='EC'||publicKey.crv!=='P-256'||typeof publicKey.x!=='string'||typeof publicKey.y!=='string')return json({error:'INVALID_QR_KEY'},400,origin);
    const session=crypto.randomUUID(),secret=randomToken(),now=Date.now(),expiresAt=now+2*60*1000;
    await env.DB.prepare(`INSERT INTO qr_login_sessions(id,secret_hash,pc_public_key,status,expires_at,created_at) VALUES (?1,?2,?3,'pending',?4,?5)`).bind(session,await sha256(secret),JSON.stringify(publicKey),expiresAt,now).run();
    return json({session,secret,publicKey,expiresAt},201,origin);
  }
  if(request.method==='GET'&&path==='/auth/qr/poll'){
    const session=String(url.searchParams.get('session')||''),secret=String(url.searchParams.get('secret')||'');
    if(!session||!secret)return json({error:'INVALID_QR_SESSION'},400,origin);
    const row=await env.DB.prepare('SELECT * FROM qr_login_sessions WHERE id=?1').bind(session).first();
    if(!row)return json({status:'expired'},200,origin);
    if(Number(row.expires_at)<Date.now()){await env.DB.prepare("UPDATE qr_login_sessions SET status='expired' WHERE id=?1").bind(session).run();return json({status:'expired'},200,origin)}
    if(await sha256(secret)!==row.secret_hash)return json({error:'INVALID_QR_SESSION'},403,origin);
    if(row.status!=='approved')return json({status:row.status},200,origin);
    const profile=await env.DB.prepare('SELECT wtink_id,name,position,avatar,is_dev,is_admin,pin_hash FROM profiles WHERE wtink_id=?1').bind(row.profile_id).first();
    if(!profile)return json({status:'expired'},200,origin);
    const setupRow=await env.DB.prepare('SELECT setup_ciphertext,setup_iv FROM account_setup WHERE wtink_id=?1').bind(row.profile_id).first();
    const setup=setupRow?await decryptSetup(env,setupRow.setup_ciphertext,setupRow.setup_iv):null;
    const passkey=await env.DB.prepare('SELECT COUNT(*) AS count FROM webauthn_credentials WHERE profile_id=?1').bind(row.profile_id).first();
    return json({status:'approved',profile:publicProfile(profile),token:row.login_token,setup,security:{pinSet:Boolean(profile.pin_hash),onePassAvailable:Number(passkey?.count||0)>0},transfer:{iv:row.transfer_iv,data:row.transfer_data,peerPublicKey:JSON.parse(row.transfer_peer_public_key)}},200,origin);
  }
  if(request.method==='POST'&&path==='/auth/qr/approve'){
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin);
    const input=await body(request),session=String(input?.session||''),secret=String(input?.secret||''),transfer=input?.transfer;
    if(!session||!secret||!transfer?.iv||!transfer?.data||!transfer?.peerPublicKey)return json({error:'INVALID_QR_APPROVAL'},400,origin);
    const row=await env.DB.prepare('SELECT id,secret_hash,status,expires_at FROM qr_login_sessions WHERE id=?1').bind(session).first();
    if(!row||row.status!=='pending'||Number(row.expires_at)<Date.now()||await sha256(secret)!==row.secret_hash)return json({error:'INVALID_QR_SESSION'},403,origin);
    const token=randomToken(),now=Date.now(),tokenHash=await sha256(token);
    await env.DB.batch([
      env.DB.prepare('INSERT INTO auth_sessions(token_hash,profile_id,created_at,expires_at) VALUES (?1,?2,?3,?4)').bind(tokenHash,owner.wtink_id,now,now+30*24*60*60*1000),
      env.DB.prepare(`UPDATE qr_login_sessions SET status='approved',profile_id=?1,transfer_iv=?2,transfer_data=?3,transfer_peer_public_key=?4,login_token=?5 WHERE id=?6`).bind(owner.wtink_id,String(transfer.iv),String(transfer.data),JSON.stringify(transfer.peerPublicKey),token,session)
    ]);
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
    const row = await env.DB.prepare('SELECT wtink_id, name, position, avatar, is_dev, is_admin FROM profiles WHERE wtink_id = ?1').bind(wtinkId).first();
    if (!row) return json({error: 'USER_NOT_FOUND'}, 404, origin);
    return json({profile: publicProfile(row)}, 200, origin);
  }

  if (request.method === 'PUT' && path === '/profiles') {
    const owner = await authProfile(request, env);
    if (!owner) return json({error: 'UNAUTHORIZED'}, 401, origin);
    const input = await body(request);
    const raw = input?.profile || {};
    const wtinkId = normalizeId(raw.profileId);
    const name = cleanText(raw.name, NAME_MAX);
    const position = cleanText(raw.position, POSITION_MAX);
    const avatar = cleanAvatar(raw.avatar);
    if (wtinkId !== owner.wtink_id || !name || !position) return json({error: 'INVALID_PROFILE'}, 400, origin);
    const now = Date.now();
    await env.DB.prepare(`UPDATE profiles SET name = ?1, position = ?2, avatar = ?3, updated_at = ?4, last_seen = ?4 WHERE wtink_id = ?5`)
      .bind(name, position, avatar, now, owner.wtink_id).run();
    return json({profile: publicProfile({...owner,wtink_id:wtinkId,name,position,avatar})}, 200, origin);
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
    const targetProfile = await env.DB.prepare('SELECT wtink_id, name, position, avatar, is_dev, is_admin FROM profiles WHERE wtink_id = ?1').bind(target).first();
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
    await createSocialNotification(env, target, owner.wtink_id, 'friendRequest', id, 'Новая заявка в друзья', `${owner.name} хочет добавить вас в друзья`, './?tab=social');
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
    if (status === 'accepted') { await createSocialNotification(env, row.sender_id, owner.wtink_id, 'friendAccepted', action[1], 'Заявка принята', `${owner.name} принял(а) вашу заявку в друзья`); await notifyProfile(env, row.sender_id, 'friendAccepted', {title:'Заявка принята',body:`${owner.name} принял(а) вашу заявку в друзья`,url:'./?tab=social',tag:`workertink-friend-accepted-${owner.wtink_id}`}); }
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
      SELECT p.id,p.body,p.created_at,p.updated_at,
        a.wtink_id AS a_id,a.name AS a_name,a.position AS a_position,a.avatar AS a_avatar,a.is_dev AS a_is_dev,a.is_admin AS a_is_admin,
        (SELECT COUNT(*) FROM social_post_likes l WHERE l.post_id=p.id) AS likes,
        (SELECT COUNT(*) FROM social_post_comments c WHERE c.post_id=p.id) AS comments,
        EXISTS(SELECT 1 FROM social_post_likes ml WHERE ml.post_id=p.id AND ml.profile_id=?1) AS liked
      FROM social_posts p JOIN profiles a ON a.wtink_id=p.author_id
      ORDER BY p.created_at DESC LIMIT ?2`).bind(owner.wtink_id,limit).all();
    return json({posts:(rows.results||[]).map(r=>({id:r.id,body:r.body,createdAt:Number(r.created_at),updatedAt:Number(r.updated_at),author:socialProfile({wtink_id:r.a_id,name:r.a_name,position:r.a_position,avatar:r.a_avatar,is_dev:r.a_is_dev,is_admin:r.a_is_admin}),likes:Number(r.likes||0),comments:Number(r.comments||0),liked:Boolean(r.liked)}))},200,origin);
  }

  if (path === '/social/posts' && request.method === 'POST') {
    const owner = await authProfile(request, env); if (!owner) return json({error:'UNAUTHORIZED'},401,origin);
    const input=await body(request); const text=cleanText(input?.body,4000);
    if (!text) return json({error:'EMPTY_POST'},400,origin);
    const id=crypto.randomUUID(),now=Date.now();
    await env.DB.prepare('INSERT INTO social_posts (id,author_id,body,created_at,updated_at) VALUES (?1,?2,?3,?4,?4)').bind(id,owner.wtink_id,text,now).run();
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
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin); const input=await body(request); const target=normalizeId(input?.to); const kind=String(input?.kind||''); const size=Number(input?.size||0);
    if(!validId(target)||target===owner.wtink_id||!['voice','image','video'].includes(kind)||!Number.isFinite(size)||size<=0||size>20*1024*1024)return json({error:'MEDIA_TOO_LARGE'},400,origin);
    const friend=await env.DB.prepare(`SELECT 1 FROM friend_requests WHERE status='accepted' AND ((sender_id=?1 AND receiver_id=?2) OR (sender_id=?2 AND receiver_id=?1)) LIMIT 1`).bind(owner.wtink_id,target).first(); if(!friend)return json({error:'NOT_FRIENDS'},403,origin);
    const id=crypto.randomUUID(),chunkSize=524288,totalChunks=Math.ceil(size/chunkSize),now=Date.now();
    await env.DB.prepare('INSERT INTO chat_media(id,sender_id,receiver_id,kind,mime,name,iv,size,chunk_size,total_chunks,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)').bind(id,owner.wtink_id,target,kind,cleanText(input?.mime,120),cleanText(input?.name,160),cleanText(input?.iv,80),size,chunkSize,totalChunks,now).run();
    return json({id,chunkSize,totalChunks},201,origin);
  }

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
    const owner=await authProfile(request,env); if(!owner)return json({error:'UNAUTHORIZED'},401,origin); const input=await body(request); const target=normalizeId(input?.to); const text=cleanText(input?.body,28000000); const kind=['text','voice','image','video','note'].includes(String(input?.kind))?String(input.kind):'text'; const mime=typeof input?.mime==='string'?String(input.mime).slice(0,120):null; const name=typeof input?.name==='string'?String(input.name).slice(0,160):null; const replyToId=typeof input?.replyToId==='string'?String(input.replyToId).slice(0,80):null; const replyPreview=cleanText(input?.replyPreview,500); const noteDate=cleanText(input?.noteDate,20); const noteShift=cleanText(input?.noteShift,80);
    if(!validId(target)||!text||target===owner.wtink_id)return json({error:'INVALID_MESSAGE'},400,origin);
    const blocked=await env.DB.prepare('SELECT 1 FROM blocked_profiles WHERE (profile_id=?1 AND blocked_id=?2) OR (profile_id=?2 AND blocked_id=?1) LIMIT 1').bind(owner.wtink_id,target).first(); if(blocked)return json({error:'BLOCKED'},403,origin);
    const friend=await env.DB.prepare(`SELECT 1 FROM friend_requests WHERE status='accepted' AND ((sender_id=?1 AND receiver_id=?2) OR (sender_id=?2 AND receiver_id=?1)) LIMIT 1`).bind(owner.wtink_id,target).first(); if(!friend)return json({error:'NOT_FRIENDS'},403,origin);
    if(replyToId){const replyRow=await env.DB.prepare('SELECT 1 FROM social_messages WHERE id=?1 AND ((sender_id=?2 AND receiver_id=?3) OR (sender_id=?3 AND receiver_id=?2))').bind(replyToId,owner.wtink_id,target).first();if(!replyRow)return json({error:'INVALID_REPLY'},400,origin)}
    const id=crypto.randomUUID(),now=Date.now(); await env.DB.prepare('INSERT INTO social_messages (id,sender_id,receiver_id,body,kind,mime,name,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)').bind(id,owner.wtink_id,target,text,kind,mime,name,now).run();
    await env.DB.prepare('UPDATE social_messages SET reply_to_id=?1,reply_preview=?2,note_date=?3,note_shift=?4 WHERE id=?5').bind(replyToId,replyPreview,noteDate,noteShift,id).run();
    await createSocialNotification(env,target,owner.wtink_id,'message',id,'Новое сообщение',`${owner.name}: ${kind==='text'?text.slice(0,120):kind==='note'?'Заметка смены':'Вложение'}`,'./?tab=chat');
    await notifyProfile(env,target,'message',{actorId:owner.wtink_id,title:`Сообщение от ${owner.name}`,body:kind==='text'?text.slice(0,120):kind==='note'?'Заметка смены':'Новое зашифрованное вложение',url:'./?tab=chat',tag:`wtink-message-${id}`,urgency:'high'});
    return json({ok:true,message:{id,from:displayId(owner.wtink_id),to:displayId(target),body:text,kind,mime,name,createdAt:now,readAt:null,editedAt:null,deletedAt:null,replyToId,replyPreview,noteDate,noteShift}},201,origin);
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
