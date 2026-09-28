const ID_RE = /^WTINKID-\d{6}$/i;
const displayId = (value) => { const match = String(value || '').match(/^(?:WTINKID)-(\d{6})$/i); return match ? `WTinkID-${match[1]}` : String(value || ''); };
const NAME_MAX = 80;
const POSITION_MAX = 120;
const AVATAR_MAX = 180_000;
const TOKEN_BYTES = 32;
const PIN_LENGTH = 6;
const PIN_ITERATIONS = 120000;


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

function publicProfile(row) {
  if (!row) return null;
  return {
    profileId: displayId(row.wtink_id),
    name: row.name,
    position: row.position,
    avatar: row.avatar
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
    return await request.json();
  } catch {
    return {};
  }
}

async function authProfile(request, env) {
  const token = bearer(request);
  if (!token) return null;
  const tokenHash = await sha256(token);
  return env.DB.prepare(
    'SELECT wtink_id, name, position, avatar, token_hash, pin_hash, pin_salt, pin_failed_attempts, pin_locked_until, webauthn_user_id, created_at, updated_at FROM profiles WHERE token_hash = ?1'
  ).bind(tokenHash).first();
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
  const key = kind === 'friendRequest' ? 'friendRequests' : kind === 'friendAccepted' ? 'friendAccepted' : kind === 'message' ? 'messages' : kind;
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
      s.wtink_id AS s_id, s.name AS s_name, s.position AS s_position, s.avatar AS s_avatar,
      t.wtink_id AS t_id, t.name AS t_name, t.position AS t_position, t.avatar AS t_avatar
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
    avatar: row[`${prefix}_avatar`]
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
      s.wtink_id AS s_id, s.name AS s_name, s.position AS s_position, s.avatar AS s_avatar,
      t.wtink_id AS t_id, t.name AS t_name, t.position AS t_position, t.avatar AS t_avatar
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
    const row = await env.DB.prepare(`SELECT wtink_id, name, position, avatar, pin_hash, pin_salt, pin_failed_attempts, pin_locked_until FROM profiles WHERE wtink_id = ?1`).bind(wtinkId).first();
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
    await env.DB.prepare('UPDATE profiles SET token_hash = ?1, pin_failed_attempts = 0, pin_locked_until = 0, updated_at = ?2 WHERE wtink_id = ?3').bind(await sha256(token),Date.now(),wtinkId).run();
    const passkey = await env.DB.prepare('SELECT COUNT(*) AS count FROM webauthn_credentials WHERE profile_id = ?1').bind(wtinkId).first();
    return json({profile:{profileId:displayId(row.wtink_id),name:row.name,position:row.position,avatar:row.avatar},token,security:{pinSet:true,onePassAvailable:Number(passkey?.count||0)>0}},200,origin);
  }

  if (request.method === 'GET' && path === '/auth/status') {
    const owner = await authProfile(request, env);
    if (!owner) return json({error:'UNAUTHORIZED'},401,origin);
    const passkey = await env.DB.prepare('SELECT COUNT(*) AS count FROM webauthn_credentials WHERE profile_id = ?1').bind(owner.wtink_id).first();
    return json({security:{pinSet:Boolean(owner.pin_hash),onePassAvailable:Number(passkey?.count||0)>0}},200,origin);
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
        INSERT INTO profiles (wtink_id, name, position, avatar, token_hash, pin_hash, pin_salt, webauthn_user_id, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)
      `).bind(wtinkId, name, position, avatar, tokenHash, pinData.hash, pinData.salt, webauthnUserId, now).run();
    } catch (error) {
      if (String(error).toLowerCase().includes('unique')) return json({error: 'WTINK_ID_TAKEN'}, 409, origin);
      throw error;
    }
    return json({profile: {profileId: displayId(wtinkId), name, position, avatar}, token, security:{pinSet:true,onePassAvailable:false}}, 201, origin);
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
      env.DB.prepare('INSERT INTO auth_challenges(id,profile_id,kind,challenge,expires_at,created_at) VALUES (?1,?2,?3,?4,?5,?5)').bind(crypto.randomUUID(),owner.wtink_id,'onepass_register',options.challenge,now+5*60*1000,now)
    ]);
    return json(options,200,origin);
  }

  if (request.method === 'POST' && path === '/auth/onepass/register/verify') {
    const owner = await authProfile(request, env);
    if (!owner) return json({error:'UNAUTHORIZED'},401,origin);
    const input = await body(request);
    const response = input?.response;
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
      env.DB.prepare(`INSERT OR REPLACE INTO webauthn_credentials(id,profile_id,user_id,public_key,counter,device_type,backed_up,transports,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?9)`).bind(credential.id,owner.wtink_id,owner.webauthn_user_id || owner.wtink_id,base64Url(credential.publicKey),credential.counter,credentialDeviceType,credentialBackedUp?1:0,JSON.stringify(credential.transports||[]),now),
      env.DB.prepare('DELETE FROM auth_challenges WHERE id = ?1').bind(challenge.id)
    ]);
    return json({ok:true},200,origin);
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
      env.DB.prepare('INSERT INTO auth_challenges(id,profile_id,kind,challenge,expires_at,created_at) VALUES (?1,?2,?3,?4,?5,?5)').bind(crypto.randomUUID(),wtinkId,'onepass_login',options.challenge,now+5*60*1000,now)
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
    const owner=await env.DB.prepare('SELECT wtink_id,name,position,avatar FROM profiles WHERE wtink_id = ?1').bind(credential.profile_id).first();
    if(!owner)return json({error:'INVALID_CREDENTIALS'},401,origin);
    const token=randomToken();
    const now=Date.now();
    await env.DB.batch([
      env.DB.prepare('UPDATE webauthn_credentials SET counter = ?1, updated_at = ?2 WHERE id = ?3').bind(verification.authenticationInfo.newCounter,now,credential.id),
      env.DB.prepare('UPDATE profiles SET token_hash = ?1, updated_at = ?2 WHERE wtink_id = ?3').bind(await sha256(token),now,owner.wtink_id),
      env.DB.prepare('DELETE FROM auth_challenges WHERE id = ?1').bind(challenge.id)
    ]);
    return json({profile:{profileId:displayId(owner.wtink_id),name:owner.name,position:owner.position,avatar:owner.avatar},token,security:{pinSet:true,onePassAvailable:true}},200,origin);
  }

  if (request.method === 'DELETE' && path === '/auth/onepass') {
    const owner=await authProfile(request,env);
    if(!owner)return json({error:'UNAUTHORIZED'},401,origin);
    await env.DB.prepare('DELETE FROM webauthn_credentials WHERE profile_id = ?1').bind(owner.wtink_id).run();
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
      env.DB.prepare('DELETE FROM webauthn_credentials WHERE profile_id = ?1').bind(owner.wtink_id),
      env.DB.prepare('DELETE FROM profiles WHERE wtink_id = ?1').bind(owner.wtink_id)
    ]);
    return json({ok: true, deletedAt: now}, 200, origin);
  }

  const profileMatch = path.match(/^\/profiles\/([^/]+)$/);
  if (request.method === 'GET' && profileMatch) {
    const wtinkId = normalizeId(decodeURIComponent(profileMatch[1]));
    if (!validId(wtinkId)) return json({error: 'USER_NOT_FOUND'}, 404, origin);
    const row = await env.DB.prepare('SELECT wtink_id, name, position, avatar FROM profiles WHERE wtink_id = ?1').bind(wtinkId).first();
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
    await env.DB.prepare(`UPDATE profiles SET name = ?1, position = ?2, avatar = ?3, updated_at = ?4 WHERE wtink_id = ?5`)
      .bind(name, position, avatar, now, owner.wtink_id).run();
    return json({profile: {profileId: wtinkId, name, position, avatar}}, 200, origin);
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
    const targetProfile = await env.DB.prepare('SELECT wtink_id, name, position, avatar FROM profiles WHERE wtink_id = ?1').bind(target).first();
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
        s.wtink_id AS s_id, s.name AS s_name, s.position AS s_position, s.avatar AS s_avatar,
        t.wtink_id AS t_id, t.name AS t_name, t.position AS t_position, t.avatar AS t_avatar
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
    if (status === 'accepted') await notifyProfile(env, row.sender_id, 'friendAccepted', {title:'Заявка принята',body:`${owner.name} принял(а) вашу заявку в друзья`,url:'./?tab=friends',tag:`workertink-friend-accepted-${owner.wtink_id}`});
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
    const expires = now + 5 * 60 * 1000;
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
        s.wtink_id AS s_id, s.name AS s_name, s.position AS s_position, s.avatar AS s_avatar,
        t.wtink_id AS t_id, t.name AS t_name, t.position AS t_position, t.avatar AS t_avatar
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

  if (request.method === 'GET' && path.startsWith('/peer-sessions/')) {
    const owner = await authProfile(request, env);
    if (!owner) return json({error: 'UNAUTHORIZED'}, 401, origin);
    const id = decodeURIComponent(path.split('/').pop() || '');
    const row = await loadPeerSession(env, id);
    if (!row) return json({error: 'SESSION_NOT_FOUND'}, 404, origin);
    if (row.initiator_id !== owner.wtink_id && row.receiver_id !== owner.wtink_id) return json({error: 'FORBIDDEN'}, 403, origin);
    return json({session: peerSessionView(row)}, 200, origin);
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
        r.updated_at
      FROM friend_requests r
      JOIN profiles s ON s.wtink_id = r.sender_id
      JOIN profiles t ON t.wtink_id = r.receiver_id
      WHERE r.status = 'accepted' AND (r.sender_id = ?1 OR r.receiver_id = ?1)
      ORDER BY r.updated_at DESC
      LIMIT 200
    `).bind(owner.wtink_id).all();
    return json({friends: (rows.results || []).map(row => ({profile: publicProfile({wtink_id: row.wtink_id, name: row.name, position: row.position, avatar: row.avatar}), addedAt: Number(row.updated_at || Date.now()), lastSeen: Number(row.updated_at || Date.now())}))}, 200, origin);
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

export default {fetch: handle, async scheduled(controller, env) { await processPushReminders(env); }};
