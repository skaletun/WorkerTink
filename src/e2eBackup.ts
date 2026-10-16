import {getChatIdentityCandidates,getChatIdentityMatching,importChatIdentity} from './chatCrypto';

const FORMAT='wtinker-e2e-recovery';
const VERSION=1;
const ITERATIONS=310_000;
const MAX_BACKUP_BYTES=512*1024;
const enc=new TextEncoder();
const dec=new TextDecoder();

type RecoveryIdentity={privateKey:JsonWebKey;publicKey:JsonWebKey};
type RecoveryEnvelope={
 format:typeof FORMAT;
 version:typeof VERSION;
 profileId:string;
 createdAt:number;
 kdf:{name:'PBKDF2-SHA256';iterations:number;salt:string};
 cipher:{name:'AES-256-GCM';iv:string};
 ciphertext:string;
};

function b64(bytes:Uint8Array):string{
 let raw='';
 for(const byte of bytes)raw+=String.fromCharCode(byte);
 return btoa(raw);
}
function unb64(input:string,expectedSize?:number):Uint8Array<ArrayBuffer>{
 if(!/^[A-Za-z0-9+/]*={0,2}$/.test(input)||input.length%4!==0)throw new Error('E2E_BACKUP_CORRUPT');
 let binary:string;
 try{binary=atob(input)}catch{throw new Error('E2E_BACKUP_CORRUPT')}
 if(expectedSize!==undefined&&binary.length!==expectedSize)throw new Error('E2E_BACKUP_CORRUPT');
 const bytes=new Uint8Array(binary.length);
 for(let index=0;index<binary.length;index++)bytes[index]=binary.charCodeAt(index);
 return bytes;
}
const canonical=(id:string)=>String(id||'').trim().toUpperCase();
const matches=(a:JsonWebKey,b:JsonWebKey)=>a?.kty==='EC'&&a.crv==='P-256'&&a.x===b?.x&&a.y===b?.y;
function validatePassword(passphrase:string):void{
 if(Array.from(passphrase).length<12||passphrase.length>1024)throw new Error('E2E_BACKUP_WEAK_PASSWORD');
}
function assertIdentityShape(value:unknown):asserts value is RecoveryIdentity{
 if(!value||typeof value!=='object')throw new Error('E2E_BACKUP_CORRUPT');
 const pair=value as Partial<RecoveryIdentity>;
 const priv=pair.privateKey, pub=pair.publicKey;
 if(!priv||!pub||!matches(priv,pub)||typeof priv.d!=='string'||!priv.d)throw new Error('E2E_BACKUP_CORRUPT');
}
async function validateIdentity(value:unknown):Promise<RecoveryIdentity>{
 assertIdentityShape(value);
 try{
  const priv=await crypto.subtle.importKey('jwk',value.privateKey,{name:'ECDH',namedCurve:'P-256'},true,['deriveKey']);
  const pub=await crypto.subtle.importKey('jwk',value.publicKey,{name:'ECDH',namedCurve:'P-256'},true,[]);
  const exportedPrivate=await crypto.subtle.exportKey('jwk',priv);
  const exportedPublic=await crypto.subtle.exportKey('jwk',pub);
  if(!matches(exportedPrivate,exportedPublic)||exportedPrivate.d!==value.privateKey.d)throw new Error('E2E_BACKUP_CORRUPT');
  return value;
 }catch{throw new Error('E2E_BACKUP_CORRUPT')}
}
function metadata(file:RecoveryEnvelope):Uint8Array<ArrayBuffer>{
 return enc.encode(JSON.stringify({
  format:file.format,version:file.version,profileId:file.profileId,createdAt:file.createdAt,
  kdf:file.kdf,cipher:file.cipher
 }));
}
async function passwordKey(password:string,salt:Uint8Array<ArrayBuffer>,iterations:number):Promise<CryptoKey>{
 const material=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
function parseBackup(raw:string):RecoveryEnvelope{
 if(typeof raw!=='string'||raw.length>MAX_BACKUP_BYTES)throw new Error('E2E_BACKUP_TOO_LARGE');
 let file:RecoveryEnvelope;
 try{file=JSON.parse(raw) as RecoveryEnvelope}catch{throw new Error('E2E_BACKUP_CORRUPT')}
 if(!file||file.format!==FORMAT||file.version!==VERSION)throw new Error('E2E_BACKUP_VERSION_UNSUPPORTED');
 if(typeof file.profileId!=='string'||!/^[A-Z0-9-]{8,64}$/.test(file.profileId)||
  !Number.isSafeInteger(file.createdAt)||file.createdAt<0||
  file.kdf?.name!=='PBKDF2-SHA256'||file.kdf.iterations!==ITERATIONS||
  file.cipher?.name!=='AES-256-GCM'||typeof file.ciphertext!=='string'||file.ciphertext.length<24)
  throw new Error('E2E_BACKUP_CORRUPT');
 unb64(file.kdf.salt,16);
 unb64(file.cipher.iv,12);
 return file;
}

/** A portable encrypted file. Neither the passphrase nor any private key is uploaded. */
export async function createEncryptedE2EBackup(profileId:string,registeredPublicKey:JsonWebKey,passphrase:string):Promise<string>{
 validatePassword(passphrase);
 const id=canonical(profileId);
 const identities=await getChatIdentityCandidates(id);
 if(!identities.length)throw new Error('E2E_IDENTITY_MISSING');
 if(!identities.some(identity=>matches(identity.publicKey,registeredPublicKey)))throw new Error('E2E_IDENTITY_MISMATCH');
 const verified=await Promise.all(identities.map(validateIdentity));
 const salt=crypto.getRandomValues(new Uint8Array(16));
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const file:RecoveryEnvelope={
  format:FORMAT,version:VERSION,profileId:id,createdAt:Date.now(),
  kdf:{name:'PBKDF2-SHA256',iterations:ITERATIONS,salt:b64(salt)},
  cipher:{name:'AES-256-GCM',iv:b64(iv)},ciphertext:''
 };
 const key=await passwordKey(passphrase,salt,ITERATIONS);
 const plain=enc.encode(JSON.stringify({version:VERSION,profileId:id,identities:verified}));
 const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:metadata(file),tagLength:128},key,plain);
 file.ciphertext=b64(new Uint8Array(cipher));
 const encoded=JSON.stringify(file);
 if(encoded.length>MAX_BACKUP_BYTES)throw new Error('E2E_BACKUP_TOO_LARGE');
 return encoded;
}

/** Requires an authenticated server key; imports cannot replace that public identity. */
export async function restoreEncryptedE2EBackup(raw:string,profileId:string,registeredPublicKey:JsonWebKey,passphrase:string):Promise<{restored:number}>{
 const file=parseBackup(raw);
 const id=canonical(profileId);
 if(file.profileId!==id)throw new Error('E2E_BACKUP_ACCOUNT_MISMATCH');
 if(!registeredPublicKey||registeredPublicKey.kty!=='EC'||registeredPublicKey.crv!=='P-256')throw new Error('E2E_SERVER_KEY_REQUIRED');
 if(!passphrase)throw new Error('E2E_BACKUP_PASSWORD_REQUIRED');
 const salt=unb64(file.kdf.salt,16),iv=unb64(file.cipher.iv,12);
 const key=await passwordKey(passphrase,salt,ITERATIONS);
 let plaintext:ArrayBuffer;
 try{
  plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:metadata(file),tagLength:128},key,unb64(file.ciphertext));
 }catch{throw new Error('E2E_BACKUP_DECRYPT_FAILED')}
 let payload:unknown;
 try{payload=JSON.parse(dec.decode(plaintext))}catch{throw new Error('E2E_BACKUP_CORRUPT')}
 const contents=payload as {version?:unknown;profileId?:unknown;identities?:unknown};
 if(contents?.version!==VERSION||contents.profileId!==id||!Array.isArray(contents.identities)||
  !contents.identities.length||contents.identities.length>250)throw new Error('E2E_BACKUP_CORRUPT');
 const verified=await Promise.all(contents.identities.map(validateIdentity));
 const registered=verified.find(identity=>matches(identity.publicKey,registeredPublicKey));
 if(!registered)throw new Error('E2E_BACKUP_SERVER_KEY_MISMATCH');
 // Validate the complete file before the first persistence mutation.
 const unique=verified.filter((identity,index,all)=>all.findIndex(candidate=>matches(candidate.publicKey,identity.publicKey))===index);
 for(const historic of unique){
  if(!matches(historic.publicKey,registeredPublicKey))await importChatIdentity(id,historic);
 }
 await importChatIdentity(id,registered);
 await getChatIdentityMatching(id,registeredPublicKey);
 return {restored:unique.length};
}
