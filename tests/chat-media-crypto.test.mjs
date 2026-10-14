import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const data=new Map();
globalThis.localStorage={
 getItem:key=>data.get(key)??null,
 setItem:(key,value)=>{data.set(key,String(value))},
 removeItem:key=>{data.delete(key)},
 key:i=>[...data.keys()][i]??null,
 get length(){return data.size}
};
const {getChatIdentity,encryptChatMedia,decryptChatMediaCandidates}=await import('../src/chatCrypto.ts');
const alice='WTinkID-111111',bob='WTinkID-222222';
const [aliceIdentity,bobIdentity]=await Promise.all([getChatIdentity(alice),getChatIdentity(bob)]);
const bytes=new Uint8Array([0,3,8,17,34,55,89,144,233]);
const envelope=await encryptChatMedia(alice,bobIdentity.publicKey,{kind:'file',blob:bytes.buffer});
const clear=await decryptChatMediaCandidates(bob,aliceIdentity.publicKey,envelope.iv,envelope.ciphertext);
assert.deepEqual([...new Uint8Array(clear)],[...bytes]);
await assert.rejects(()=>decryptChatMediaCandidates(bob,bobIdentity.publicKey,envelope.iv,envelope.ciphertext));
// A device that retained an older key must still be able to open its old attachments.
const replacement=await getChatIdentity('WTinkID-333333');
data.set('workertink:chat-e2e:WTINKID-222222',JSON.stringify(bobIdentity));
data.set('workertink:chat-e2e:v1:WTINKID-222222',JSON.stringify(replacement));
const restored=await decryptChatMediaCandidates(bob,aliceIdentity.publicKey,envelope.iv,envelope.ciphertext);
assert.deepEqual([...new Uint8Array(restored)],[...bytes]);
delete globalThis.localStorage;
console.log('WTinker cross-account E2E attachment encrypt/decrypt tests: OK');
