import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import worker from '../directory-api/src/index.js';

const db=new DatabaseSync(':memory:');
const migration=name=>readFileSync(new URL('../directory-api/migrations/'+name,import.meta.url),'utf8');

// Run the actual chat schema migrations, not a hand-written table containing
// the misspelled reply_receiver_id column.
db.exec(migration('0001_initial.sql'));
db.exec(migration('0010_social_network.sql'));
db.exec(migration('0012_chat_e2ee_qr.sql'));
db.exec(migration('0013_chat_controls.sql'));
db.exec(migration('0021_chat_pins.sql'));
const network=migration('0018_network_identity_channels.sql');
for(const table of ['chat_groups','chat_group_members','chat_group_messages','chat_group_message_deletions']){
 const match=network.match(new RegExp('CREATE TABLE IF NOT EXISTS '+table+' \\([\\s\\S]*?\\);'));
 assert.ok(match,'Missing table in actual migration: '+table);
 db.exec(match[0]);
}
for(const [column,type] of [
 ['banner','TEXT'],['username','TEXT'],['is_dev','INTEGER'],['is_admin','INTEGER'],
 ['is_official','INTEGER'],['is_verified','INTEGER'],['pin_hash','TEXT'],['pin_salt','TEXT'],
 ['pin_failed_attempts','INTEGER'],['pin_locked_until','INTEGER'],['webauthn_user_id','TEXT'],
 ['last_seen','INTEGER']
])db.exec('ALTER TABLE profiles ADD COLUMN '+column+' '+type);
for(const [column,type] of [['session_id','TEXT'],['device_name','TEXT'],['last_seen','INTEGER']])
 db.exec('ALTER TABLE auth_sessions ADD COLUMN '+column+' '+type);
db.exec('CREATE TABLE push_subscriptions(endpoint TEXT PRIMARY KEY,profile_id TEXT,expiration_time INTEGER,p256dh TEXT,auth TEXT,preferences TEXT)');
assert.ok(db.prepare("PRAGMA table_info(social_messages)").all().some(c=>c.name==='reply_to_id'));
assert.ok(!db.prepare("PRAGMA table_info(social_messages)").all().some(c=>c.name==='reply_receiver_id'));
assert.ok(db.prepare("PRAGMA table_info(chat_group_messages)").all().some(c=>c.name==='reply_to_id'));

const now=Date.now();
const ids={alice:'WTINKID-111111',bob:'WTINKID-222222',unrelated:'WTINKID-333333'};
for(const [user,id] of Object.entries(ids)){
 const tokenHash=createHash('sha256').update(user+'-token').digest('hex');
 db.prepare('INSERT INTO profiles(wtink_id,name,position,avatar,token_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?)')
 .run(id,user,'Engineer','',tokenHash,now,now);
 db.prepare('INSERT INTO auth_sessions(token_hash,profile_id,created_at,expires_at,session_id,device_name,last_seen) VALUES(?,?,?,?,?,?,?)')
 .run(tokenHash,id,now,now+86400000,user+'-session','Test',now);
}
db.prepare("INSERT INTO friend_requests(id,sender_id,receiver_id,pair_key,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)")
 .run('accepted',ids.alice,ids.bob,[ids.alice,ids.bob].sort().join(':'),'accepted',now,now);

const env={DB:{prepare(sql){
 const stmt=db.prepare(sql);
 return {bind(...args){
  return {
   first:async()=>stmt.get(...args)??null,
   all:async()=>({results:stmt.all(...args)}),
   run:async()=>({meta:{changes:Number(stmt.run(...args).changes)}})
  };
 }};
}}};
async function call(method,path,actor,body){
 const response=await worker.fetch(new Request('https://directory.example'+path,{
  method,headers:{...(actor?{Authorization:'Bearer '+actor+'-token'}:{}),...(body?{'Content-Type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
 }),env,{});
 return {status:response.status,data:await response.json()};
}
const url='/chat/messages/';
assert.equal((await call('GET',url+ids.bob,null)).status,401);
assert.equal((await call('GET',url+ids.bob,'unrelated')).status,403);

let history=await call('GET',url+ids.bob,'alice');
assert.equal(history.status,200,JSON.stringify(history.data));
assert.deepEqual(history.data.messages,[]);

const first=await call('POST','/chat/messages','alice',{to:ids.bob,kind:'text',body:'{"v":1,"iv":"test","data":"ciphertext"}'});
assert.equal(first.status,201,JSON.stringify(first.data));
assert.ok(first.data.message.id);
const sentId=first.data.message.id;
history=await call('GET',url+ids.bob,'alice');
assert.equal(history.status,200,JSON.stringify(history.data));
assert.equal(history.data.messages.length,1);
assert.equal(history.data.messages[0].from,'WTinkID-111111');
assert.equal(history.data.messages[0].readAt,null);
history=await call('GET',url+ids.alice,'bob');
assert.equal(history.status,200,JSON.stringify(history.data));
assert.ok(history.data.messages[0].readAt,'Receiver should mark delivered messages read');

const reply=await call('POST','/chat/messages','bob',{to:ids.alice,kind:'text',body:'{"v":1,"iv":"test","data":"reply"}',replyToId:sentId,replyPreview:'Ответ на смену'});
assert.equal(reply.status,201,JSON.stringify(reply.data));
assert.equal(reply.data.message.replyToId,sentId);
history=await call('GET',url+ids.bob,'alice');
assert.equal(history.status,200,JSON.stringify(history.data));
assert.equal(history.data.messages[1].replyToId,sentId);
assert.equal(history.data.messages[1].replyPreview,'Ответ на смену');

const searched=await call('GET',url+ids.bob+'/search?q='+encodeURIComponent('смену'),'alice');
assert.equal(searched.status,200,JSON.stringify(searched.data));
assert.equal(searched.data.messages[0].replyToId,sentId);

const pin=await call('PUT',url+reply.data.message.id+'/pin','alice');
assert.equal(pin.status,200,JSON.stringify(pin.data));
const pins=await call('GET',url+ids.bob+'/pins','alice');
assert.equal(pins.status,200,JSON.stringify(pins.data));
assert.equal(pins.data.pins.length,1);
assert.equal(pins.data.pins[0].message.replyToId,sentId);

assert.equal((await call('DELETE',url+sentId+'/me','alice')).status,200);
history=await call('GET',url+ids.bob,'alice');
assert.equal(history.status,200);
assert.equal(history.data.messages[0].deletedForMe,true);
assert.equal((await call('GET',url+ids.alice,'bob')).data.messages[0].deletedForMe,false);

const groupId='team-chat';
db.prepare("INSERT INTO chat_groups(id,name,owner_id,created_at,updated_at) VALUES(?,?,?,?,?)")
 .run(groupId,'Team',ids.alice,now,now);
db.prepare("INSERT INTO chat_group_members(group_id,profile_id,role,joined_at) VALUES(?,?,?,?)")
 .run(groupId,ids.alice,'owner',now);
db.prepare("INSERT INTO chat_group_members(group_id,profile_id,role,joined_at) VALUES(?,?,?,?)")
 .run(groupId,ids.bob,'member',now);
db.prepare("INSERT INTO chat_group_messages(id,group_id,sender_id,body,kind,created_at,reply_to_id,reply_preview) VALUES(?,?,?,?,?,?,?,?)")
 .run('group-msg',groupId,ids.alice,'{"v":1}', 'text',now,sentId,'group reply');

const group=await call('GET','/chat/groups/'+groupId+'/messages','bob');
assert.equal(group.status,200,JSON.stringify(group.data));
assert.equal(group.data.messages.length,1);
assert.equal(group.data.messages[0].replyToId,sentId);
assert.equal(group.data.messages[0].replyPreview,'group reply');
assert.equal((await call('GET','/chat/groups/'+groupId+'/messages','unrelated')).status,403);
console.log('WorkerTink chat lifecycle integration tests: OK');
