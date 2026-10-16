import {exportTrustedE2EIdentities,restoreTrustedE2EIdentities} from './e2eBackup.ts';
import type {TransferPublicKey} from './directory/transfer.ts';

export type EphemeralPair={privateKey:CryptoKey;publicKey:TransferPublicKey};
const enc=new TextEncoder(),dec=new TextDecoder();
const b64=(bytes:Uint8Array)=>btoa(Array.from(bytes,byte=>String.fromCharCode(byte)).join(''));
const unb64=(value:string):Uint8Array<ArrayBuffer>=>{
 if(!/^[A-Za-z0-9+/]+={0,2}$/.test(value)||value.length%4!==0)throw new Error('TRANSFER_CORRUPT');
 let raw:string;try{raw=atob(value)}catch{throw new Error('TRANSFER_CORRUPT')}
 return Uint8Array.from(raw,c=>c.charCodeAt(0));
};
const identityId=(value:string)=>String(value||'').trim().toUpperCase();
export async function generatePairingIdentity():Promise<EphemeralPair>{
 const pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},false,['deriveBits']);
 const key=await crypto.subtle.exportKey('jwk',pair.publicKey);
 return {privateKey:pair.privateKey,publicKey:{kty:'EC',crv:'P-256',x:key.x!,y:key.y!}};
}
async function shared(pair:EphemeralPair,remote:TransferPublicKey,sessionId:string,info:string){
 const peer=await crypto.subtle.importKey('jwk',remote,{name:'ECDH',namedCurve:'P-256'},false,[]);
 const raw=await crypto.subtle.deriveBits({name:'ECDH',public:peer},pair.privateKey,256);
 const material=await crypto.subtle.importKey('raw',raw,'HKDF',false,['deriveBits']);
 return crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt:enc.encode('WTinker secure transfer '+sessionId),info:enc.encode(info)},material,256);
}
/** Compare this code manually on BOTH devices before either user confirms. */
export async function pairingVerificationCode(pair:EphemeralPair,remote:TransferPublicKey,id:string):Promise<string>{
 const bytes=new Uint8Array(await shared(pair,remote,id,'WTinker transfer verification code v1'));
 // Use 40 unbiased-ish bits from the HKDF output for display; verification
 // is a human out-of-band check, not the AES key or an authentication token.
 const n=bytes.slice(0,5).reduce((number,byte)=>number*256+byte,0);
 return String(n%1000000).padStart(6,'0');
}
async function aesKey(pair:EphemeralPair,remote:TransferPublicKey,id:string){
 return crypto.subtle.importKey('raw',await shared(pair,remote,id,'WTinker transfer payload AES-256-GCM v1'),{name:'AES-GCM'},false,['encrypt','decrypt']);
}
const aad=(id:string,profileId:string)=>enc.encode('WTinker E2E identity transfer v1:'+id+':'+identityId(profileId));
export async function encryptPairingPayload(pair:EphemeralPair,remote:TransferPublicKey,sessionId:string,profileId:string,registeredPublicKey:JsonWebKey):Promise<string>{
 const json=await exportTrustedE2EIdentities(profileId,registeredPublicKey);
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const key=await aesKey(pair,remote,sessionId);
 const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(sessionId,profileId),tagLength:128},key,enc.encode(json));
 const out=new Uint8Array(iv.byteLength+cipher.byteLength);
 out.set(iv);out.set(new Uint8Array(cipher),iv.length);
 const packed=b64(out);
 if(packed.length>170000)throw new Error('E2E_TRANSFER_TOO_LARGE');
 return packed;
}
export async function decryptPairingPayload(pair:EphemeralPair,remote:TransferPublicKey,sessionId:string,profileId:string,registeredPublicKey:JsonWebKey,payload:string):Promise<{restored:number}>{
 if(typeof payload!=='string'||payload.length>170000)throw new Error('TRANSFER_CORRUPT');
 const packed=unb64(payload);
 if(packed.length<29)throw new Error('TRANSFER_CORRUPT');
 const key=await aesKey(pair,remote,sessionId);
 let clear:ArrayBuffer;
 try{clear=await crypto.subtle.decrypt({name:'AES-GCM',iv:packed.slice(0,12),additionalData:aad(sessionId,profileId),tagLength:128},key,packed.slice(12))}catch{throw new Error('TRANSFER_DECRYPT_FAILED')}
 let parsed:unknown;try{parsed=JSON.parse(dec.decode(clear))}catch{throw new Error('TRANSFER_CORRUPT')}
 return restoreTrustedE2EIdentities(parsed,profileId,registeredPublicKey);
}
