const ID_RE = /^WTINKID-\d{6}$/;
const NAME_MAX = 80;
const POSITION_MAX = 120;
const AVATAR_MAX = 180_000;
const TOKEN_BYTES = 32;

function json(data, status = 200, origin = '*') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': origin,
      'access-control-allow-headers': 'Content-Type, Authorization',
      'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
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
    profileId: row.wtink_id,
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
    'SELECT wtink_id, name, position, avatar, token_hash, created_at, updated_at FROM profiles WHERE token_hash = ?1'
  ).bind(tokenHash).first();
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
      'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
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

  if (request.method === 'POST' && path === '/profiles') {
    const input = await body(request);
    const raw = input?.profile || {};
    const wtinkId = normalizeId(raw.profileId);
    const name = cleanText(raw.name, NAME_MAX);
    const position = cleanText(raw.position, POSITION_MAX);
    const avatar = cleanAvatar(raw.avatar);
    if (!validId(wtinkId) || !name || !position) return json({error: 'INVALID_PROFILE'}, 400, origin);

    const existing = await env.DB.prepare('SELECT wtink_id FROM profiles WHERE wtink_id = ?1').bind(wtinkId).first();
    if (existing) return json({error: 'WTINK_ID_TAKEN'}, 409, origin);

    const token = randomToken();
    const tokenHash = await sha256(token);
    const now = Date.now();
    try {
      await env.DB.prepare(`
        INSERT INTO profiles (wtink_id, name, position, avatar, token_hash, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
      `).bind(wtinkId, name, position, avatar, tokenHash, now).run();
    } catch (error) {
      if (String(error).toLowerCase().includes('unique')) return json({error: 'WTINK_ID_TAKEN'}, 409, origin);
      throw error;
    }
    return json({profile: {profileId: wtinkId, name, position, avatar}, token}, 201, origin);
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

export default {fetch: handle};
