import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import worker from '../directory-api/src/index.js';

const db=new DatabaseSync(':memory:');
db.exec(`
CREATE TABLE profiles(
 wtink_id TEXT PRIMARY KEY,name TEXT,position TEXT,avatar TEXT,banner TEXT,username TEXT,
 is_dev INTEGER DEFAULT 0,is_admin INTEGER DEFAULT 0,is_official INTEGER DEFAULT 0,is_verified INTEGER DEFAULT 0,
 token_hash TEXT,pin_hash TEXT,pin_salt TEXT,pin_failed_attempts INTEGER DEFAULT 0,
 pin_locked_until INTEGER DEFAULT 0,webauthn_user_id TEXT,created_at INTEGER,updated_at INTEGER,last_seen INTEGER
);
CREATE TABLE auth_sessions(token_hash TEXT PRIMARY KEY,profile_id TEXT,session_id TEXT,device_name TEXT,created_at INTEGER,expires_at INTEGER,last_seen INTEGER);
CREATE TABLE social_posts(id TEXT PRIMARY KEY,body TEXT,kind TEXT,visibility TEXT,created_at INTEGER,author_id TEXT);
CREATE TABLE friend_requests(id TEXT PRIMARY KEY,sender_id TEXT,receiver_id TEXT,status TEXT);
`);
for(const file of ['0025_profile_qr_styles.sql','0026_admin_audit.sql'])db.exec(readFileSync(new URL('../directory-api/migrations/'+file,import.meta.url),'utf8'));
const mediaSql=readFileSync(new URL('../directory-api/migrations/0014_chat_media.sql',import.meta.url),'utf8');
for(const table of ['chat_media','chat_media_chunks']){
 const found=mediaSql.match(new RegExp('CREATE TABLE IF NOT EXISTS '+table+' \\([\\s\\S]*?\\);'));
 assert.ok(found,table+' migration missing');
 db.exec(found[0]);
}
// Applied by the real 0018_network_identity_channels migration.
db.exec('ALTER TABLE chat_media ADD COLUMN group_id TEXT');
const now=Date.now();
const ids={admin:'WTINKID-214994',worker:'WTINKID-100001',friend:'WTINKID-100002'};
for(const [user,id] of Object.entries(ids)){
 const hash=createHash('sha256').update(user+'-token').digest('hex');
 db.prepare('INSERT INTO profiles(wtink_id,name,position,avatar,token_hash,created_at,updated_at,last_seen) VALUES(?,?,?,?,?,?,?,?)').run(id,user,'Engineer','',hash,now,now,now);
 db.prepare('INSERT INTO auth_sessions(token_hash,profile_id,created_at,expires_at,session_id) VALUES(?,?,?,?,?)').run(hash,id,now,now+86400000,user+'-sid');
}
db.prepare("INSERT INTO friend_requests(id,sender_id,receiver_id,status) VALUES(?,?,?,'accepted')").run('pair',ids.worker,ids.friend);
db.prepare("INSERT INTO social_posts(id,body,kind,visibility,created_at,author_id) VALUES(?,?,?,'network',?,?)").run('post-one','Test content','post',now,ids.worker);
const env={DB:{prepare(sql){const statement=db.prepare(sql);return {
 first:async()=>statement.get()??null,
 all:async()=>({results:statement.all()}),
 run:async()=>({meta:{changes:Number(statement.run().changes)}}),
 bind(...args){return {
 first:async()=>statement.get(...args)??null,
 all:async()=>({results:statement.all(...args)}),
 run:async()=>({meta:{changes:Number(statement.run(...args).changes)}})
}}
}}}};
async function call(method,path,actor,body,contentType){
 const response=await worker.fetch(new Request('https://directory.example'+path,{
  method,headers:{...(actor?{Authorization:'Bearer '+actor+'-token'}:{}),...(body?{'Content-Type':contentType||'application/json'}:{})},
  ...(body?{body:contentType==='application/octet-stream'?body:JSON.stringify(body)}:{})
 }),env,{});
 const type=response.headers.get('content-type')||'';
 return {status:response.status,data:type.includes('application/json')?await response.json():await response.arrayBuffer()};
}
const style={shape:'Dots',foreground:'#204d35',background:'#fffcee',card:'Poster'};
assert.equal((await call('GET','/profiles/'+ids.worker+'/qr-style','friend')).data.style.shape,'Rounded');
assert.equal((await call('PUT','/profiles/me/qr-style','friend',{style})).status,200);
assert.equal((await call('GET','/profiles/'+ids.friend+'/qr-style',null)).data.style.shape,'Dots');
assert.equal((await call('GET','/profiles/'+ids.worker+'/qr-style',null)).data.style.shape,'Rounded');
assert.equal((await call('PUT','/profiles/me/qr-style','friend',{style:{...style,foreground:'red'}})).status,400);
assert.equal((await call('PUT','/profiles/me/qr-style',null,{style})).status,401);
const posts=await call('GET','/admin/content','admin');
assert.equal(posts.status,200,JSON.stringify(posts.data));
assert.equal(posts.data.posts[0].id,'post-one');
assert.equal((await call('GET','/admin/content','worker')).status,403);
assert.equal((await call('DELETE','/admin/content/posts/post-one','worker')).status,403);
assert.equal((await call('DELETE','/admin/content/posts/post-one','admin')).status,200);
assert.equal((await call('GET','/admin/content','admin')).data.posts.length,0);
const audit=await call('GET','/admin/audit','admin');
assert.equal(audit.status,200);
assert.equal(audit.data.events.length,1);
assert.equal(audit.data.events[0].action,'delete_post');

const init=await call('POST','/chat/media/init','worker',{to:ids.friend,kind:'file',iv:'sample-iv',mime:'application/octet-stream',name:'test.bin',size:5});
assert.equal(init.status,201,JSON.stringify(init.data));
const id=init.data.id;
const bytes=new Uint8Array([5,4,3,2,1]);
assert.equal((await call('PUT','/chat/media/'+id+'/0','worker',bytes,'application/octet-stream')).status,200);
assert.equal((await call('POST','/chat/media/'+id+'/complete','worker')).status,200);
const file=await call('GET','/chat/media/'+id,'friend');
assert.equal(file.status,200,JSON.stringify(file.data));
assert.deepEqual([...new Uint8Array(file.data)],[5,4,3,2,1]);
assert.equal((await call('GET','/chat/media/'+id,'admin')).status,403);
assert.equal((await call('GET','/chat/media/'+id,null)).status,401);
console.log('WTinker public QR, admin moderation/audit and chat media API tests: OK');
