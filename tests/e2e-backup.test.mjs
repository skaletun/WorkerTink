import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const entries=new Map();
globalThis.localStorage={
 getItem:key=>entries.get(key)??null,
 setItem(key,value){entries.set(key,String(value))},
 removeItem:key=>entries.delete(key),
 key:index=>[...entries.keys()][index]??null,
 get length(){return entries.size}
};
const {
 getChatIdentity,importChatIdentity,getChatIdentityMatching,getChatIdentityCandidates,
 encryptChat,decryptChatWithCandidates,encryptChatMedia,decryptChatMediaCandidates
}=await import('../src/chatCrypto.ts');
const {createEncryptedE2EBackup,restoreEncryptedE2EBackup}=await import('../src/e2eBackup.ts');

const alice='WTinkID-731001',bob='WTinkID-731002',aliceKey=await getChatIdentity(alice);
const bobKey=await getChatIdentity(bob);
const before=await encryptChat(bob,aliceKey.publicKey,{kind:'text',text:'Старое сообщение сохранилось'});
const file=await encryptChatMedia(bob,aliceKey.publicKey,{kind:'file',blob:new Uint8Array([2,5,8,13,21,34]).buffer});
const historicText=await decryptChatWithCandidates(alice,before,[bobKey.publicKey]);
assert.equal(historicText.text,'Старое сообщение сохранилось');
// Exercise preservation of a second, legacy identity in the same backup.
const alternate=await getChatIdentity('WTinkID-731003');
await importChatIdentity(alice,alternate);
const candidates=await getChatIdentityCandidates(alice);
assert.equal(candidates.length,2);
const passphrase='Unique safe password, 2026';
const exported=await createEncryptedE2EBackup(alice,aliceKey.publicKey,passphrase);
const container=JSON.parse(exported);
assert.equal(container.format,'wtinker-e2e-recovery');
assert.equal(container.version,1);
assert.equal(container.profileId,alice.toUpperCase());
assert.equal(container.kdf.iterations,310000);
assert.equal(container.cipher.name,'AES-256-GCM');
assert.ok(!exported.includes(aliceKey.privateKey.d));
assert.ok(!exported.includes('privateKey'));
assert.ok(!exported.includes('Старое сообщение сохранилось'));
assert.ok(!exported.includes(passphrase));
assert.notEqual((await createEncryptedE2EBackup(alice,aliceKey.publicKey,passphrase)),exported,'Each export needs fresh salt and IV');
await assert.rejects(()=>createEncryptedE2EBackup(alice,aliceKey.publicKey,'short'),/E2E_BACKUP_WEAK_PASSWORD/);
await assert.rejects(()=>createEncryptedE2EBackup(alice,bobKey.publicKey,passphrase),/E2E_IDENTITY_MISMATCH/);
await assert.rejects(()=>restoreEncryptedE2EBackup(exported,bob,bobKey.publicKey,passphrase),/E2E_BACKUP_ACCOUNT_MISMATCH/);
await assert.rejects(()=>restoreEncryptedE2EBackup(exported,alice,bobKey.publicKey,passphrase),/E2E_BACKUP_SERVER_KEY_MISMATCH/);
await assert.rejects(()=>restoreEncryptedE2EBackup(exported,alice,aliceKey.publicKey,'wrong password'),/E2E_BACKUP_DECRYPT_FAILED/);
await assert.rejects(()=>restoreEncryptedE2EBackup('not json',alice,aliceKey.publicKey,passphrase),/E2E_BACKUP_CORRUPT/);
await assert.rejects(()=>restoreEncryptedE2EBackup(JSON.stringify({...container,version:999}),alice,aliceKey.publicKey,passphrase),/E2E_BACKUP_VERSION_UNSUPPORTED/);
await assert.rejects(()=>restoreEncryptedE2EBackup(JSON.stringify({...container,profileId:bob.toUpperCase()}),alice,aliceKey.publicKey,passphrase),/E2E_BACKUP_ACCOUNT_MISMATCH/);
await assert.rejects(()=>restoreEncryptedE2EBackup(JSON.stringify({...container,ciphertext:'AAAAAAAA'+container.ciphertext.slice(8)}),alice,aliceKey.publicKey,passphrase),/E2E_BACKUP_DECRYPT_FAILED/);
await assert.rejects(()=>restoreEncryptedE2EBackup('x'.repeat(512*1024+1),alice,aliceKey.publicKey,passphrase),/E2E_BACKUP_TOO_LARGE/);

// Simulate transfer to a newly initialized browser with no private key.
entries.clear();
assert.equal((await getChatIdentityCandidates(alice)).length,0);
const recovered=await restoreEncryptedE2EBackup(exported,alice,aliceKey.publicKey,passphrase);
assert.equal(recovered.restored,2);
assert.equal((await getChatIdentityMatching(alice,aliceKey.publicKey)).privateKey.d,aliceKey.privateKey.d);
assert.equal((await getChatIdentityCandidates(alice)).length,2);
assert.equal((await decryptChatWithCandidates(alice,before,[bobKey.publicKey])).text,'Старое сообщение сохранилось');
const restoredMedia=await decryptChatMediaCandidates(alice,bobKey.publicKey,file.iv,file.ciphertext);
assert.deepEqual([...new Uint8Array(restoredMedia)],[2,5,8,13,21,34]);
const repeated=await restoreEncryptedE2EBackup(exported,alice,aliceKey.publicKey,passphrase);
assert.equal(repeated.restored,2);
assert.equal((await getChatIdentityCandidates(alice)).length,2,'Repeated restore must not duplicate keys');

delete globalThis.localStorage;
console.log('E2E portable encrypted backup: round-trip, legacy history, wrong password, account mismatch, tampering, file bounds OK');
