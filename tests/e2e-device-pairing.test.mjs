import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const store=new Map();
globalThis.localStorage={
 getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,String(value)),
 removeItem:key=>store.delete(key),key:index=>[...store.keys()][index]??null,
 get length(){return store.size}
};
const {generatePairingIdentity,pairingVerificationCode,encryptPairingPayload,decryptPairingPayload}=await import('../src/securePairing.ts');
const {getChatIdentity,getChatIdentityCandidates,getChatIdentityMatching,encryptChat,decryptChatWithCandidates}=await import('../src/chatCrypto.ts');
const source='WTinkID-741100',contact='WTinkID-741101',history='WTinkID-741102';
const actual=await getChatIdentity(source);
const peer=await getChatIdentity(contact);
const older=await getChatIdentity(history);
const {importChatIdentity}=await import('../src/chatCrypto.ts');
const message=await encryptChat(contact,actual.publicKey,{kind:'text',text:'Накопленная переписка'});
await importChatIdentity(source,older);
const pairA=await generatePairingIdentity(),pairB=await generatePairingIdentity(),intruder=await generatePairingIdentity();
const session='2b0568f8-e18c-4847-b11c-e0c10628dc65';
const codeA=await pairingVerificationCode(pairA,pairB.publicKey,session);
const codeB=await pairingVerificationCode(pairB,pairA.publicKey,session);
assert.equal(codeA,codeB);
assert.match(codeA,/^\d{6}$/);
assert.notEqual(await pairingVerificationCode(intruder,pairA.publicKey,session),codeB);
const payload=await encryptPairingPayload(pairA,pairB.publicKey,session,source,actual.publicKey);
assert.ok(!payload.includes(actual.privateKey.d),'server ciphertext must not expose secret');
await assert.rejects(()=>decryptPairingPayload(intruder,pairA.publicKey,session,source,actual.publicKey,payload),/TRANSFER_DECRYPT_FAILED/);
await assert.rejects(()=>decryptPairingPayload(pairB,pairA.publicKey,'different-session',source,actual.publicKey,payload),/TRANSFER_DECRYPT_FAILED/);
await assert.rejects(()=>decryptPairingPayload(pairB,pairA.publicKey,session,contact,actual.publicKey,payload),/TRANSFER_DECRYPT_FAILED/);
store.clear();
assert.equal((await getChatIdentityCandidates(source)).length,0);
const result=await decryptPairingPayload(pairB,pairA.publicKey,session,source,actual.publicKey,payload);
assert.equal(result.restored,2);
assert.equal((await getChatIdentityMatching(source,actual.publicKey)).privateKey.d,actual.privateKey.d);
assert.equal((await decryptChatWithCandidates(source,message,[peer.publicKey])).text,'Накопленная переписка');
await assert.rejects(()=>decryptPairingPayload(pairB,pairA.publicKey,session,source,peer.publicKey,payload),/E2E_BACKUP_SERVER_KEY_MISMATCH/);
delete globalThis.localStorage;
console.log('WTinker E2E QR pairing crypto: session binding, MITM mismatch, history and no plaintext: OK');
