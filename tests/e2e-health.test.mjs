import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const {checkE2EHealth,redactedE2EHealthReport}=await import('../src/e2eHealth.ts');
const id='WTinkID-578420';
const first=await webcrypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveKey']);
const pair={privateKey:await webcrypto.subtle.exportKey('jwk',first.privateKey),publicKey:await webcrypto.subtle.exportKey('jwk',first.publicKey)};
const second=await webcrypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveKey']);
const other=await webcrypto.subtle.exportKey('jwk',second.publicKey);
const deps=(keys,server,online=true)=>({
 local:async profileId=>{assert.equal(profileId,id.toUpperCase());return keys},
 remote:async token=>{assert.equal(token,'test-auth-only');return {key:{publicKey:server}}},
 online:()=>online
});
const status=await checkE2EHealth(id,'test-auth-only',deps([pair],pair.publicKey));
assert.equal(status.local,'ready');
assert.equal(status.remote,'matched');
assert.equal(status.recoverableIdentities,1);
assert.equal(status.malformedIdentities,0);
const report=redactedE2EHealthReport(status);
assert.doesNotMatch(report,new RegExp(pair.privateKey.d));
assert.doesNotMatch(report,new RegExp(pair.publicKey.x));
assert.doesNotMatch(report,/test-auth-only|WTINKID-578420/);
assert.equal(JSON.parse(report).remote,'matched');
const noKey=await checkE2EHealth(id,'test-auth-only',deps([],pair.publicKey));
assert.equal(noKey.local,'missing');
assert.equal(noKey.remote,'mismatch');
assert.equal(noKey.recoverableIdentities,0);
const corrupt=await checkE2EHealth(id,'test-auth-only',deps([{privateKey:{...pair.privateKey,d:'BAD'},publicKey:pair.publicKey}],pair.publicKey));
assert.equal(corrupt.local,'invalid');
assert.equal(corrupt.malformedIdentities,1);
const mismatched=await checkE2EHealth(id,'test-auth-only',deps([pair],other));
assert.equal(mismatched.remote,'mismatch');
const off=await checkE2EHealth(id,'test-auth-only',deps([pair],pair.publicKey,false));
assert.equal(off.local,'ready');
assert.equal(off.remote,'offline');
const exception=await checkE2EHealth(id,'test-auth-only',{local:async()=>{throw Error('vault blocked')},remote:async()=>{throw Error('HTTP_503')},online:()=>true});
assert.equal(exception.local,'unavailable');
assert.equal(exception.remote,'offline');
const absent=await checkE2EHealth(id,'test-auth-only',{local:async()=>[],remote:async()=>{throw Error('CHAT_KEY_NOT_READY')},online:()=>true});
assert.equal(absent.remote,'not-registered');
assert.equal((await checkE2EHealth('invalid','',deps([],pair.publicKey))).remote,'not-checked');
console.log('WTinker E2E read-only diagnostics: matching, missing, corrupt, network, redaction: OK');
