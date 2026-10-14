import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import worker from '../directory-api/src/index.js';

const db=new DatabaseSync(':memory:');
db.exec(`
 CREATE TABLE profiles (
  wtink_id TEXT PRIMARY KEY, name TEXT NOT NULL, position TEXT NOT NULL DEFAULT '',
  avatar TEXT NOT NULL DEFAULT '', banner TEXT DEFAULT '', username TEXT,
  is_dev INTEGER DEFAULT 0, is_admin INTEGER DEFAULT 0, is_official INTEGER DEFAULT 0,
  is_verified INTEGER DEFAULT 0, token_hash TEXT, pin_hash TEXT, pin_salt TEXT,
  pin_failed_attempts INTEGER DEFAULT 0, pin_locked_until INTEGER DEFAULT 0,
  webauthn_user_id TEXT, created_at INTEGER, updated_at INTEGER, last_seen INTEGER
 );
 CREATE TABLE auth_sessions (
  token_hash TEXT PRIMARY KEY, profile_id TEXT, session_id TEXT, device_name TEXT,
  created_at INTEGER, expires_at INTEGER, last_seen INTEGER
 );
 CREATE TABLE friend_requests (
  id TEXT PRIMARY KEY, sender_id TEXT NOT NULL, receiver_id TEXT NOT NULL,
  pair_key TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL, updated_at INTEGER
 );
 CREATE UNIQUE INDEX idx_pending_pair ON friend_requests(pair_key) WHERE status='pending';
 CREATE TABLE blocked_profiles (
  profile_id TEXT, blocked_id TEXT, created_at INTEGER, PRIMARY KEY(profile_id,blocked_id)
 );
 CREATE TABLE social_notifications (
  id TEXT PRIMARY KEY, profile_id TEXT, actor_id TEXT, kind TEXT, entity_id TEXT,
  title TEXT, body TEXT, url TEXT, created_at INTEGER
 );
 CREATE TABLE push_subscriptions (
  endpoint TEXT PRIMARY KEY, profile_id TEXT, expiration_time INTEGER, p256dh TEXT,
  auth TEXT, preferences TEXT
 );
`);

const now=Date.now(), ids={alice:'WTINKID-111111',bob:'WTINKID-222222',eve:'WTINKID-333333'};
for(const [key,id] of Object.entries(ids)){
 const tokenHash=createHash('sha256').update(key+'-token').digest('hex');
 db.prepare('INSERT INTO profiles(wtink_id,name,position,avatar,banner,username,created_at,updated_at,last_seen) VALUES(?,?,?,?,?,?,?,?,?)')
  .run(id,key.toUpperCase(),'Engineer','','',key,now,now,now);
 db.prepare('INSERT INTO auth_sessions(token_hash,profile_id,session_id,device_name,created_at,expires_at,last_seen) VALUES(?,?,?,?,?,?,?)')
  .run(tokenHash,id,key+'-session','Test device',now,now+86400000,now);
}
const env={DB:{prepare(sql){
 const stmt=db.prepare(sql);
 return {bind(...params){
  return {
   first:async()=>stmt.get(...params)??null,
   all:async()=>({results:stmt.all(...params)}),
   run:async()=>({meta:{changes:Number(stmt.run(...params).changes)}})
  };
 }};
}}};

async function call(method,path,actor,body){
 const response=await worker.fetch(new Request('https://directory.example'+path,{
  method,headers:{...(actor?{Authorization:'Bearer '+actor+'-token'}:{}),...(body?{'Content-Type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
 }),env,{});
 const data=await response.json();
 return {status:response.status,data};
}

const alice=ids.alice,bob=ids.bob;
assert.equal((await call('GET','/friends','alice')).data.friends.length,0);
assert.equal((await call('POST','/friend-requests','alice',{to:alice})).data.error,'SELF_REQUEST');
let sent=await call('POST','/friend-requests','alice',{to:bob});
assert.equal(sent.status,201,JSON.stringify(sent.data));
assert.equal(sent.data.request.from.profileId,'WTinkID-111111');
const id=sent.data.request.id;
assert.equal((await call('GET','/friend-requests/outgoing','alice')).data.requests.length,1);
assert.equal((await call('GET','/friend-requests/incoming','bob')).data.requests.length,1);
assert.equal((await call('GET','/friend-requests/incoming','alice')).data.requests.length,0);
assert.equal((await call('POST','/friend-requests','alice',{to:bob})).data.error,'REQUEST_EXISTS');
assert.equal((await call('POST','/friend-requests/'+id+'/accept','alice')).status,403);
assert.equal((await call('DELETE','/friend-requests/'+id,'bob')).status,403);
assert.equal((await call('POST','/friend-requests/'+id+'/accept','bob')).status,200);
assert.equal((await call('GET','/friend-requests/incoming','bob')).data.requests.length,0);
assert.equal((await call('GET','/friend-requests/outgoing','alice')).data.requests.length,0);
assert.equal((await call('DELETE','/friend-requests/'+id,'alice')).status,409);
assert.equal((await call('POST','/friend-requests','bob',{to:alice})).data.error,'ALREADY_FRIENDS');
for(const user of ['alice','bob']){
 const result=await call('GET','/friends',user);
 assert.equal(result.status,200);
 assert.equal(result.data.friends.length,1);
 assert.equal(result.data.friends[0].profile.profileId,user==='alice'?'WTinkID-222222':'WTinkID-111111');
}
assert.equal((await call('DELETE','/friends/'+bob,'alice')).status,200);
assert.equal((await call('GET','/friends','bob')).data.friends.length,0);

sent=await call('POST','/friend-requests','bob',{to:alice});
assert.equal(sent.status,201);
assert.equal((await call('DELETE','/friend-requests/'+sent.data.request.id,'bob')).status,200);
assert.equal((await call('GET','/friend-requests/incoming','alice')).data.requests.length,0);
assert.equal((await call('DELETE','/friend-requests/'+sent.data.request.id,'bob')).status,404);

sent=await call('POST','/friend-requests','alice',{to:bob});
assert.equal(sent.status,201);
assert.equal((await call('POST','/friend-requests/'+sent.data.request.id+'/decline','bob')).status,200);
assert.equal((await call('GET','/friend-requests/outgoing','alice')).data.requests.length,0);
assert.equal((await call('POST','/friend-requests','alice',{to:bob})).status,201);
assert.equal((await call('POST','/friends/'+bob+'/block','alice')).status,200);
assert.equal((await call('GET','/friend-requests/incoming','bob')).data.requests.length,0);
assert.equal((await call('POST','/friend-requests','bob',{to:alice})).data.error,'PROFILE_BLOCKED');
assert.equal((await call('POST','/friend-requests','alice',{to:bob})).data.error,'PROFILE_BLOCKED');
assert.equal((await call('DELETE','/friends/'+bob+'/block','alice')).status,200);

// A notification storage outage must not roll back an already persisted request.
db.exec('DROP TABLE social_notifications');
sent=await call('POST','/friend-requests','alice',{to:bob});
assert.equal(sent.status,201);
assert.equal((await call('POST','/friend-requests/'+sent.data.request.id+'/accept','bob')).status,200);
assert.equal((await call('GET','/friends','alice')).data.friends.length,1);

console.log('WorkerTink friends API integration tests: OK');
