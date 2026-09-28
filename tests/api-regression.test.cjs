const fs=require('fs');
const assert=require('assert');
const path=require('path');
const root=path.join(__dirname,'..');
const api=fs.readFileSync(path.join(root,'directory-api/src/index.js'),'utf8');
const legacy=fs.readFileSync(path.join(root,'server/index.mjs'),'utf8');

assert.match(api,/access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS'/);
assert.doesNotMatch(api,/console\.error\(['"]INVALID_JSON_BODY/);
assert.match(api,/async function body\(request\) \{[\s\S]*?return JSON\.parse\(await request\.text\(\)\);[\s\S]*?catch/);
assert.match(legacy,/Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS'/);
assert.match(api,/notifyProfile\(env, target, 'peerRequest'/);
assert.match(api,/workertink-peer-request-\$\{id\}/);
assert.match(api,/DEV_WTINK_ID = 'WTINKID-214994'/);
assert.match(api,/presence\/heartbeat/);
assert.match(api,/admin\/overview/);
assert.ok(api.includes("peerSessionAction = path.match"));
assert.match(api,/status = 'cancelled'/);
assert.match(api,/function roleFlags\(row\)/);
assert.match(api,/const id = normalizeId\(row\?\.wtink_id\)/);
assert.match(api,/normalizeId\(owner\.wtink_id\) !== DEV_WTINK_ID && Number\(owner\.is_admin \|\| 0\) !== 1/);
assert.match(api,/SELECT wtink_id,name,position,avatar,is_dev,is_admin FROM profiles WHERE wtink_id = \?1/);
assert.match(api,/s\.is_dev AS s_is_dev, s\.is_admin AS s_is_admin/);
assert.match(api,/t\.is_dev AS t_is_dev, t\.is_admin AS t_is_admin/);


const app=fs.readFileSync(path.join(root,'src/App.tsx'),'utf8');
assert.match(app,/Входящий P2P-запрос/);
assert.match(app,/Подключиться к <NameWithBadge profile=\{user\}\/>/);
assert.match(app,/workertink:peer-action/);
const sw=fs.readFileSync(path.join(root,'src/sw.js'),'utf8');
assert.match(sw,/peerSessionId: payload\.peerSessionId/);

console.log('WorkerTink API regression tests: OK');

assert.match(app,/openPeerRequest=async\(preferredId\?\:string\)/);
assert.match(app,/workertink:peer-request/);
assert.match(app,/peer-in-app-notice/);

const repair=fs.readFileSync(path.join(root,'directory-api/migrations/0009_dev_role_repair.sql'),'utf8');
assert.match(repair,/WTINKID-214994/);
assert.match(repair,/is_dev = 1/);
assert.match(repair,/is_admin = 1/);
