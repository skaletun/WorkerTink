import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {handleE2ETransfer} from '../directory-api/src/e2eTransfer.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const db=new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../directory-api/migrations/0028_e2e_device_transfer.sql',import.meta.url),'utf8'));
const wrap={prepare(sql){const statement=db.prepare(sql);return {bind(...params){return {
 first:async()=>statement.get(...params)||null,
 run:async()=>({meta:{changes:Number(statement.run(...params).changes)}})
}}}}};
const env={DB:wrap};
const users=new Map([['target','WTINKID-123456'],['source','WTINKID-123456'],['third','WTINKID-123456'],['outsider','WTINKID-999999']]);
const helpers={
 json:(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}}),
 authProfile:async request=>{const key=request.headers.get('Authorization')?.replace(/^Bearer /,'');return users.has(key)?{wtink_id:users.get(key)}:null},
 sha256:async token=>createHash('sha256').update(token).digest('hex'),
 bearer:request=>request.headers.get('Authorization')?.replace(/^Bearer /,'')||'',
 body:async request=>request.json()
};
const publicKey=await webcrypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
const senderKey=await webcrypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
const firstJwk=await webcrypto.subtle.exportKey('jwk',publicKey.publicKey);
const secondJwk=await webcrypto.subtle.exportKey('jwk',senderKey.publicKey);
async function call(method,path,token,body){
 const res=await handleE2ETransfer(new Request('https://wtinker.example'+path,{
  method,headers:{...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})
 }),env,'*',helpers);
 return {status:res.status,data:await res.json()};
}
const root='/chat/e2e-transfer';
assert.equal((await call('POST',root,'', {publicKey:firstJwk})).status,401);
assert.equal((await call('POST',root,'target',{publicKey:{x:'invalid'}})).status,400);
const initial=await call('POST',root,'target',{publicKey:firstJwk});
assert.equal(initial.status,201);
const id=initial.data.session.id,route=root+'/'+id;
assert.equal(initial.data.session.expiresAt-initial.data.session.createdAt,300000);
assert.equal((await call('GET',route,'outsider')).status,403);
assert.equal((await call('GET',route,'third')).status,403);
assert.equal((await call('POST',route,'target',{publicKey:secondJwk})).status,403);
assert.equal((await call('POST',route,'outsider',{publicKey:secondJwk})).status,404);
const joined=await call('POST',route,'source',{publicKey:secondJwk});
assert.equal(joined.status,200,JSON.stringify(joined.data));
assert.equal(joined.data.session.role,'source');
assert.equal((await call('POST',route,'third',{publicKey:secondJwk})).status,403);
assert.equal((await call('POST',route+'/payload','source',{ciphertext:'QUJDRA=='})).status,409);
assert.equal((await call('POST',route+'/confirm','target')).status,200);
assert.equal((await call('POST',route+'/payload','source',{ciphertext:'QUJDRA=='})).status,409);
assert.equal((await call('POST',route+'/confirm','source')).status,200);
assert.equal((await call('POST',route+'/confirm','source')).status,200);
assert.equal((await call('GET',route+'/payload','source')).status,403);
assert.equal((await call('GET',route+'/payload','target')).status,409);
const ciphertext='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef0123456789+/';
assert.equal((await call('POST',route+'/payload','source',{ciphertext})).status,200);
assert.equal((await call('POST',route+'/payload','source',{ciphertext})).status,409);
assert.equal((await call('POST',route+'/payload','target',{ciphertext})).status,403);
const download=await call('GET',route+'/payload','target');
assert.equal(download.status,200);
assert.equal(download.data.ciphertext,ciphertext);
assert.equal((await call('POST',route+'/ack','source')).status,403);
assert.equal((await call('POST',route+'/ack','target')).status,200);
assert.equal((await call('GET',route+'/payload','target')).status,410);
assert.equal((await call('GET',route,'source')).status,410);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM e2e_transfer_audit WHERE transfer_id=?').get(id).n,6);
const cancel=await call('POST',root,'target',{publicKey:firstJwk});
const cancelId=cancel.data.session.id;
assert.equal((await call('DELETE',root+'/'+cancelId,'target')).status,200);
assert.equal((await call('GET',root+'/'+cancelId,'target')).status,410);
const stale=await call('POST',root,'target',{publicKey:firstJwk});
db.prepare('UPDATE e2e_transfer_sessions SET expires_at=? WHERE id=?').run(Date.now()-1000,stale.data.session.id);
assert.equal((await call('GET',root+'/'+stale.data.session.id,'target')).status,410);
for(let i=0;i<3;i++){
 // Three active sessions at most, including any still active from the tests.
 const result=await call('POST',root,'target',{publicKey:firstJwk});
 if(i<2)assert.equal(result.status,201);
 else assert.equal(result.status,429);
}
db.close();
console.log('WTinker Secure Sync API: auth, two-device binding, confirmations, expiry, ciphertext, one-time acknowledgement: OK');
