import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const records=new Map();
let writable=true;
globalThis.localStorage={
 getItem:key=>records.get(key)??null,
 setItem(key,value){if(!writable)throw new Error('QuotaExceededError');records.set(key,String(value))},
 removeItem:key=>records.delete(key),
 key:index=>[...records.keys()][index]??null,
 get length(){return records.size}
};
const {
 getChatIdentity,getChatIdentityMatching,getChatIdentityCandidates,
 checkpointChatIdentityForUpdate,importChatIdentity,
 encryptChat,decryptChatWithCandidates,
 encryptChatMedia,decryptChatMediaCandidates
}=await import('../src/chatCrypto.ts');

const {protectE2EBeforeUpdate}=await import('../src/e2eUpdateSafety.ts');
const alice='WTinkID-987651';
const bob='WTinkID-987652';
const concurrent=await Promise.all(Array.from({length:36},()=>getChatIdentity(alice)));
const initial=concurrent[0];
for(const identity of concurrent)assert.deepEqual(identity.publicKey,initial.publicKey,'concurrent initializations must reuse the same identity');
assert.equal(records.has('workertink:chat-e2e:v1:'+alice.toUpperCase()),true);
const receiver=await getChatIdentity(bob);
const oldEnvelope=await encryptChat(alice,receiver.publicKey,{kind:'text',text:'Ключ не должен исчезнуть после обновления'});
const oldMedia=await encryptChatMedia(alice,receiver.publicKey,{kind:'file',blob:new Uint8Array([1,8,22,78,191]).buffer});
assert.equal((await decryptChatWithCandidates(bob,oldEnvelope,[initial.publicKey])).text,'Ключ не должен исчезнуть после обновления');
assert.equal(await checkpointChatIdentityForUpdate(alice,initial.publicKey),'preserved');
records.set('workertink:v6',JSON.stringify({profile:{profileId:alice},directoryToken:'stale-signed-in-session'}));
records.set('workertink:auth-token','stale-signed-in-session');
let fetches=0;
const previousFetch=globalThis.fetch;
globalThis.fetch=async()=>{fetches++;throw new Error('network unavailable')};
assert.equal(await protectE2EBeforeUpdate(),'preserved',
 'PWA update must rely on durable local keys, not a reachable directory API');
assert.equal(fetches,0,'update guard must not request a remote registered key');
records.set('workertink:v6',JSON.stringify({profile:{profileId:'WTinkID-956700'}}));
assert.equal(await protectE2EBeforeUpdate(),'not-initialized',
 'a newly signed-in browser with no local private key must still accept app updates');
assert.equal(records.has('workertink:chat-e2e:v1:WTINKID-956700'),false,
 'update guard cannot generate replacement keys');
records.set('workertink:v6',JSON.stringify({profile:{profileId:alice}}));
globalThis.fetch=previousFetch;

assert.deepEqual((await getChatIdentityMatching(alice,initial.publicKey)).publicKey,initial.publicKey);
assert.equal((await getChatIdentity(alice)).publicKey.x,initial.publicKey.x);

// Software updates must never issue a new private key when none exists.
const empty='WTinkID-987653';
assert.equal(await checkpointChatIdentityForUpdate(empty),'not-initialized');
assert.equal(records.has('workertink:chat-e2e:v1:'+empty.toUpperCase()),false);
await assert.rejects(()=>checkpointChatIdentityForUpdate(empty,initial.publicKey),/E2E_UPDATE_BLOCKED_KEY_MISSING/);
await assert.rejects(()=>checkpointChatIdentityForUpdate(alice,receiver.publicKey),/E2E_UPDATE_BLOCKED_KEY_MISMATCH/);
assert.equal((await getChatIdentityMatching(alice,initial.publicKey)).publicKey.x,initial.publicKey.x);

// A rotated browser mirror cannot erase a historical E2E private key.
const other=await getChatIdentity('WTinkID-987654');
await importChatIdentity(alice,other);
const known=await getChatIdentityCandidates(alice);
assert.equal(known.some(x=>x.publicKey.x===initial.publicKey.x),true);
await getChatIdentityMatching(alice,initial.publicKey);
assert.equal((await decryptChatWithCandidates(alice,oldEnvelope,[receiver.publicKey])).text,'Ключ не должен исчезнуть после обновления');
const output=await decryptChatMediaCandidates(bob,initial.publicKey,oldMedia.iv,oldMedia.ciphertext);
assert.deepEqual([...new Uint8Array(output)],[1,8,22,78,191]);

// QuotaExceeded on storage writes must not block a read-only update guard.
writable=false;
assert.equal(await protectE2EBeforeUpdate(),'preserved');
writable=true;
assert.equal(await protectE2EBeforeUpdate(),'preserved');
// Corrupt account state must not strand a user on an obsolete version.
records.set('workertink:v6','{invalid JSON');
assert.equal(await protectE2EBeforeUpdate(),'unverified');
records.set('workertink:v6',JSON.stringify({profile:{profileId:alice}}));
const getItem=localStorage.getItem;
localStorage.getItem=()=>{throw new Error('SecurityError')};
assert.equal(await protectE2EBeforeUpdate(),'unverified');
localStorage.getItem=getItem;

// A persistence failure must never make an ephemeral key appear registered.
writable=false;
await assert.rejects(()=>getChatIdentity('WTinkID-987655'),/E2E_KEY_PERSISTENCE_FAILED/);
writable=true;
assert.equal(records.has('workertink:chat-e2e:v1:WTINKID-987655'),false);
assert.equal(await checkpointChatIdentityForUpdate(alice,initial.publicKey),'preserved');
delete globalThis.localStorage;
console.log('WTinker E2E update continuity and persistence regression tests: OK');
