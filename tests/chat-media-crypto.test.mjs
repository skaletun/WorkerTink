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
const {getChatIdentity,encryptChatMedia,decryptChatMediaCandidates,decryptChatMediaPeerCandidates,encryptChat,decryptChatWithCandidates,importChatIdentity,generateGroupKey,encryptGroupKeyForMember,decryptGroupKeyForSelf,encryptGroupEnvelope,decryptGroupEnvelope}=await import('../src/chatCrypto.ts');
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
// Two-way E2E text survives the presence of unrelated, rotated key candidates.
const oldMessage=await encryptChat(alice,bobIdentity.publicKey,{kind:'text',text:'Привет, Bob!'});
assert.equal(oldMessage.v,1);
assert.deepEqual(oldMessage.senderPublicKey,aliceIdentity.publicKey);
assert.deepEqual(oldMessage.recipientPublicKey,bobIdentity.publicKey);
const incoming=await decryptChatWithCandidates(bob,oldMessage,[replacement.publicKey,oldMessage.senderPublicKey]);
assert.equal(incoming.text,'Привет, Bob!');
const outgoing=await decryptChatWithCandidates(alice,oldMessage,[oldMessage.recipientPublicKey]);
assert.equal(outgoing.text,'Привет, Bob!');
const noteMessage=await encryptChat(bob,aliceIdentity.publicKey,{kind:'note',text:'Ночная смена'});
assert.equal((await decryptChatWithCandidates(alice,noteMessage,[noteMessage.senderPublicKey])).text,'Ночная смена');
await assert.rejects(()=>decryptChatWithCandidates(alice,oldMessage,[aliceIdentity.publicKey]));

// A historical private key remains retrievable after an identity is replaced.
const historicIdentity=await getChatIdentity('WTinkID-444444');
const historicPeer=await getChatIdentity('WTinkID-555555');
const historicText=await encryptChat('WTinkID-444444',historicPeer.publicKey,{kind:'text',text:'История'});
const incomingHistoric=await encryptChat('WTinkID-555555',historicIdentity.publicKey,{kind:'text',text:'Старый ключ'});
const newIdentity=await getChatIdentity('WTinkID-666666');
await importChatIdentity('WTinkID-444444',newIdentity);
assert.equal((await decryptChatWithCandidates('WTinkID-444444',incomingHistoric,[historicPeer.publicKey])).text,'Старый ключ');
assert.equal((await decryptChatWithCandidates('WTinkID-555555',historicText,[historicIdentity.publicKey])).text,'История');

// Encrypted media can be opened by the recipient even after a local key change.
const rereadMedia=await decryptChatMediaPeerCandidates(bob,[replacement.publicKey,aliceIdentity.publicKey],envelope.iv,envelope.ciphertext);
assert.deepEqual([...new Uint8Array(rereadMedia)],[...bytes]);

// Wrapping group keys must use the original sender's public key, not the receiver's.
const groupKey=await generateGroupKey();
const packet=await encryptGroupKeyForMember(alice,bobIdentity.publicKey,groupKey);
assert.deepEqual(packet.senderPublicKey,aliceIdentity.publicKey);
const recoveredGroupKey=await decryptGroupKeyForSelf(bob,packet.senderPublicKey,packet);
const groupEnvelope=await encryptGroupEnvelope(groupKey,'text','Групповое сообщение');
assert.equal((await decryptGroupEnvelope(recoveredGroupKey,groupEnvelope)).text,'Групповое сообщение');
await assert.rejects(()=>decryptGroupKeyForSelf(bob,bobIdentity.publicKey,packet));
delete globalThis.localStorage;
console.log('WTinker cross-account E2E attachment encrypt/decrypt tests: OK');
