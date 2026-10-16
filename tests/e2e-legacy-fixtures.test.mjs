import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/e2e-legacy-v1.json',import.meta.url),'utf8'));
assert.equal(fixtures.format,'wtinker-e2e-compatibility');
assert.equal(fixtures.version,1);
assert.equal(fixtures.fixtureOnly,true,'never put real user keys in compatibility fixtures');
const store=new Map();
globalThis.localStorage={
 getItem:key=>store.get(key)??null,
 setItem:(key,value)=>store.set(key,String(value)),
 removeItem:key=>store.delete(key),
 key:index=>[...store.keys()][index]??null,
 get length(){return store.size}
};
const {
 importChatIdentity,getChatIdentity,
 decryptChatWithCandidates,decryptChatMediaPeerCandidates,
 decryptGroupKeyForSelf,decryptGroupEnvelope,getChatIdentityCandidates
}=await import('../src/chatCrypto.ts');
const recipient='WTinkID-812345';
await importChatIdentity(recipient,fixtures.recipient);
const senders=[fixtures.sender.publicKey];
const text=await decryptChatWithCandidates(recipient,fixtures.legacy.text,senders);
assert.equal(text.text,'Legacy hello from 2025!');
const note=await decryptChatWithCandidates(recipient,fixtures.legacy.note,senders);
assert.equal(note.kind,'note');
assert.equal(note.text,'Old shift note № 4');
const media=fixtures.legacy.media;
const mediaBytes=Uint8Array.from(Buffer.from(media.ciphertext,'base64')).buffer;
const result=await decryptChatMediaPeerCandidates(recipient,senders,media.iv,mediaBytes);
assert.deepEqual(Buffer.from(result),Buffer.from(media.expected,'base64'));
const groupKey=await decryptGroupKeyForSelf(recipient,fixtures.sender.publicKey,fixtures.legacy.groupWrappedKey);
const group=await decryptGroupEnvelope(groupKey,fixtures.legacy.groupEnvelope);
assert.equal(group.text,'Legacy group message');
const corrupted={...fixtures.legacy.text,data:fixtures.legacy.text.data.slice(0,-6)+'AAAAAA'};
await assert.rejects(()=>decryptChatWithCandidates(recipient,corrupted,senders));

// Key migration may change the current local key while retaining the
// historic version. Old messages, media and group packets must remain usable.
const newIdentity=await getChatIdentity('WTinkID-812346');
await importChatIdentity(recipient,newIdentity);
assert.ok((await getChatIdentityCandidates(recipient)).length>=2);
assert.equal((await decryptChatWithCandidates(recipient,fixtures.legacy.text,senders)).text,'Legacy hello from 2025!');
assert.deepEqual(Buffer.from(await decryptChatMediaPeerCandidates(recipient,senders,media.iv,mediaBytes)),Buffer.from(media.expected,'base64'));
const historyKey=await decryptGroupKeyForSelf(recipient,fixtures.sender.publicKey,fixtures.legacy.groupWrappedKey);
assert.equal((await decryptGroupEnvelope(historyKey,fixtures.legacy.groupEnvelope)).text,'Legacy group message');
// Simulate app bundle reload: no key material in memory should be required
// beyond the documented device store.
const reloaded=await import('../src/chatCrypto.ts?compatibility-reload=1');
assert.equal((await reloaded.decryptChatWithCandidates(recipient,fixtures.legacy.text,senders)).text,'Legacy hello from 2025!');
delete globalThis.localStorage;
console.log('WTinker E2E golden v1 fixtures: 2025 text, note, binary media, group key, tamper protection and history: OK');
