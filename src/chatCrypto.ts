const KEY_PREFIX='workertink:chat-e2e:v1:';
const LEGACY_PREFIXES=['workertink:chat-e2e:v1:','workertink:chat-e2e:'];
const DB_NAME='workertink-e2e-vault';
const DB_VERSION=1;
const STORE='identities';
const enc=new TextEncoder();
const dec=new TextDecoder();

type StoredIdentity={privateKey:JsonWebKey;publicKey:JsonWebKey};
export type ChatEnvelope={v:1;kind:'text'|'voice'|'image'|'video'|'file'|'note';iv:string;data:string;name?:string;mime?:string;mediaId?:string;size?:number;caption?:string;senderPublicKey?:JsonWebKey;recipientPublicKey?:JsonWebKey};
export type EncryptedChatMedia={iv:string;ciphertext:ArrayBuffer};

const b64=(bytes:ArrayBuffer|Uint8Array)=>{const a=new Uint8Array(bytes);let s='';for(const b of a)s+=String.fromCharCode(b);return btoa(s)};
const unb64=(value:string)=>{const s=atob(value);const a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return a};
const canonicalId=(profileId:string)=>String(profileId||'').trim().toUpperCase();
const storageKey=(profileId:string)=>KEY_PREFIX+canonicalId(profileId);

function samePublicKey(a:JsonWebKey,b:JsonWebKey){
 return a?.kty==='EC'&&b?.kty==='EC'&&a.crv==='P-256'&&b.crv==='P-256'&&a.x===b.x&&a.y===b.y;
}
function isIdentity(value:unknown):value is StoredIdentity{
 if(!value||typeof value!=='object')return false;
 const v=value as Record<string,unknown>;
 const priv=v.privateKey as JsonWebKey|null;
 const pub=v.publicKey as JsonWebKey|null;
 return Boolean(priv&&pub&&samePublicKey(priv,pub)&&typeof priv.d==='string'&&priv.d.length>10&&typeof pub.x==='string'&&pub.x.length>10&&typeof pub.y==='string'&&pub.y.length>10);
}
const fingerprint=(key:JsonWebKey)=>[key.x,key.y].join('.').replace(/[^A-Za-z0-9_.-]/g,'').slice(0,128);
const historyKey=(id:string,key:JsonWebKey)=>'HISTORY:'+canonicalId(id)+':'+fingerprint(key);
const identityLocks=new Map<string,Promise<void>>();
async function lockIdentity<T>(profileId:string,work:()=>Promise<T>):Promise<T>{
 const id=canonicalId(profileId);
 const previous=identityLocks.get(id)||Promise.resolve();
 let release!:()=>void;
 const next=new Promise<void>(resolve=>{release=resolve});
 identityLocks.set(id,next);
 await previous;
 try{return await work()}
 finally{if(identityLocks.get(id)===next)identityLocks.delete(id);release()}
}
function openVault():Promise<IDBDatabase|null>{
 if(typeof indexedDB==='undefined')return Promise.resolve(null);
 return new Promise(resolve=>{
  try{
   const req=indexedDB.open(DB_NAME,DB_VERSION);
   req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'profileId'})};
   req.onsuccess=()=>resolve(req.result);
   req.onerror=()=>resolve(null);
   req.onblocked=()=>resolve(null);
  }catch{resolve(null)}
 });
}
async function vaultGet(profileId:string):Promise<StoredIdentity|null>{
 const db=await openVault();if(!db)return null;
 return new Promise(resolve=>{
  try{
   const tx=db.transaction(STORE,'readonly');
   const req=tx.objectStore(STORE).get(canonicalId(profileId));
   let found:StoredIdentity|null=null;
   req.onsuccess=()=>{const value=req.result?.identity;found=isIdentity(value)?value:null};
   tx.oncomplete=()=>{db.close();resolve(found)};
   tx.onabort=tx.onerror=()=>{db.close();resolve(null)};
  }catch{db.close();resolve(null)}
 });
}
async function vaultHistorical(profileId:string):Promise<StoredIdentity[]>{
 const db=await openVault();if(!db)return [];
 const id=canonicalId(profileId);
 return new Promise(resolve=>{
  try{
   const tx=db.transaction(STORE,'readonly');
   const req=tx.objectStore(STORE).getAll();
   let found:StoredIdentity[]=[];
   req.onsuccess=()=>{found=(req.result||[]).filter(row=>typeof row?.profileId==='string'&&row.profileId.startsWith('HISTORY:'+id+':')&&isIdentity(row.identity)).map(row=>row.identity as StoredIdentity)};
   tx.oncomplete=()=>{db.close();resolve(found)};
   tx.onabort=tx.onerror=()=>{db.close();resolve([])};
  }catch{db.close();resolve([])}
 });
}
async function vaultPut(profileId:string,identity:StoredIdentity):Promise<boolean>{
 const db=await openVault();if(!db)return false;
 return new Promise(resolve=>{
  try{
   const id=canonicalId(profileId);
   const tx=db.transaction(STORE,'readwrite');
   const store=tx.objectStore(STORE);
   const existing=store.get(id);
   existing.onsuccess=()=>{
    const old=existing.result?.identity;
    if(isIdentity(old)&&!samePublicKey(old.publicKey,identity.publicKey)){
     store.put({profileId:historyKey(id,old.publicKey),identity:old,updatedAt:Date.now()});
    }
    store.put({profileId:id,identity,updatedAt:Date.now()});
   };
   tx.oncomplete=()=>{db.close();resolve(true)};
   tx.onerror=tx.onabort=()=>{db.close();resolve(false)};
  }catch{db.close();resolve(false)}
 });
}
/** The first persisted identity wins, even if two browser tabs initialize at once. */
async function vaultCreateIfMissing(profileId:string,proposed:StoredIdentity):Promise<StoredIdentity|null>{
 const db=await openVault();if(!db)return null;
 return new Promise(resolve=>{
  try{
   const id=canonicalId(profileId);
   const tx=db.transaction(STORE,'readwrite');
   const store=tx.objectStore(STORE);
   let result:StoredIdentity|null=null;
   const req=store.get(id);
   req.onsuccess=()=>{
    const old=req.result?.identity;
    if(isIdentity(old))result=old;
    else{result=proposed;store.put({profileId:id,identity:proposed,updatedAt:Date.now()})}
   };
   tx.oncomplete=()=>{db.close();resolve(result)};
   tx.onerror=tx.onabort=()=>{db.close();resolve(null)};
  }catch{db.close();resolve(null)}
 });
}
function localCandidates(profileId:string):StoredIdentity[]{
 const out:StoredIdentity[]=[];const seen=new Set<string>();
 try{
  for(let i=0;i<localStorage.length;i++){
   const key=localStorage.key(i)||'';
   if(!LEGACY_PREFIXES.some(prefix=>key.startsWith(prefix)))continue;
   if(canonicalId(key.split(':').pop()||'')!==canonicalId(profileId))continue;
   const parsed=JSON.parse(localStorage.getItem(key)||'null');
   if(isIdentity(parsed)){
    const marker=fingerprint(parsed.publicKey);
    if(!seen.has(marker)){seen.add(marker);out.push(parsed)}
   }
  }
 }catch{}
 return out;
}
function localGet(profileId:string):StoredIdentity|null{
 try{const current=JSON.parse(localStorage.getItem(storageKey(profileId))||'null');if(isIdentity(current))return current}catch{}
 return localCandidates(profileId)[0]||null;
}
function localPut(profileId:string,identity:StoredIdentity):boolean{
 try{
  const key=storageKey(profileId);
  const previous=JSON.parse(localStorage.getItem(key)||'null');
  if(isIdentity(previous)&&!samePublicKey(previous.publicKey,identity.publicKey)){
   try{localStorage.setItem('workertink:chat-e2e:history:'+fingerprint(previous.publicKey)+':'+canonicalId(profileId),JSON.stringify(previous))}catch{}
  }
  localStorage.setItem(key,JSON.stringify(identity));
  return true;
 }catch{return false}
}
async function persistIdentity(profileId:string,identity:StoredIdentity):Promise<void>{
 // IndexedDB is authoritative, localStorage is an independently recoverable mirror.
 // Never acknowledge a generated/imported key unless at least one persistent write committed.
 const vaultSaved=await vaultPut(profileId,identity);
 const localSaved=localPut(profileId,identity);
 if(!vaultSaved&&!localSaved)throw new Error('E2E_KEY_PERSISTENCE_FAILED');
}
async function identityCandidates(profileId:string):Promise<StoredIdentity[]>{
 const id=canonicalId(profileId);
 const out:StoredIdentity[]=[];const seen=new Set<string>();
 const add=(identity:StoredIdentity|null)=>{if(!identity)return;const marker=fingerprint(identity.publicKey);if(!seen.has(marker)){seen.add(marker);out.push(identity)}};
 add(await vaultGet(id));
 for(const candidate of await vaultHistorical(id))add(candidate);
 for(const candidate of localCandidates(id))add(candidate);
 return out;
}

async function generateIdentity():Promise<StoredIdentity>{
 const pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveKey']);
 return {privateKey:await crypto.subtle.exportKey('jwk',pair.privateKey),publicKey:await crypto.subtle.exportKey('jwk',pair.publicKey)};
}

/**
 * Identity continuity is deliberately independent from the application build.
 * A deploy must never generate a new E2E identity. IndexedDB is the durable
 * vault, localStorage is a migration/backup mirror. Existing v1 localStorage
 * identities are imported before a new identity is ever generated.
 */
export async function getChatIdentity(profileId:string):Promise<StoredIdentity>{
 const id=canonicalId(profileId);if(!id)throw new Error('E2E_PROFILE_ID_REQUIRED');
 return lockIdentity(id,async()=>{
  const vault=await vaultGet(id);
  if(vault){localPut(id,vault);return vault}
  const local=localGet(id);
  if(local){await persistIdentity(id,local);return local}
  // A single in-flight creation per account prevents StrictMode/components
  // from racing to overwrite the initial E2E identity during an update.
  const localBeforeCreate=localGet(id);
  if(localBeforeCreate){await persistIdentity(id,localBeforeCreate);return localBeforeCreate}
  const proposed=await generateIdentity();
  const committed=await vaultCreateIfMissing(id,proposed);
  const identity=committed||localGet(id)||proposed;
  await persistIdentity(id,identity);
  return identity;
 });
}

/** Restore an existing identity matching the server's immutable public key.
 * This operation never generates or rotates a key.
 */
export async function getChatIdentityMatching(profileId:string,expectedPublicKey:JsonWebKey):Promise<StoredIdentity>{
 const id=canonicalId(profileId);if(!id)throw new Error('E2E_PROFILE_ID_REQUIRED');
 return lockIdentity(id,async()=>{
  const candidates=await identityCandidates(id);
  const match=candidates.find(candidate=>samePublicKey(candidate.publicKey,expectedPublicKey));
  if(!match)throw new Error('E2E_IDENTITY_MISMATCH');
  await persistIdentity(id,match);
  return match;
 });
}
export async function getChatIdentityCandidates(profileId:string):Promise<StoredIdentity[]>{
 const id=canonicalId(profileId);if(!id)throw new Error('E2E_PROFILE_ID_REQUIRED');
 return lockIdentity(id,()=>identityCandidates(id));
}

/** A read-only pre-reload continuity check: do not create keys during updates.
 * If the backend has a public key, insist on retaining the matching private key.
 * Keep all historical keys in the vault; never prune them on a new deployment.
 */
export async function checkpointChatIdentityForUpdate(profileId:string,expectedPublicKey?:JsonWebKey):Promise<'preserved'|'not-initialized'>{
 const id=canonicalId(profileId);if(!id)throw new Error('E2E_PROFILE_ID_REQUIRED');
 return lockIdentity(id,async()=>{
  const candidates=await identityCandidates(id);
  if(!candidates.length){
   if(expectedPublicKey)throw new Error('E2E_UPDATE_BLOCKED_KEY_MISSING');
   return 'not-initialized';
  }
  const selected=expectedPublicKey?candidates.find(candidate=>samePublicKey(candidate.publicKey,expectedPublicKey)):candidates[0];
  if(!selected)throw new Error('E2E_UPDATE_BLOCKED_KEY_MISMATCH');
  await persistIdentity(id,selected);
  const verification=await identityCandidates(id);
  if(!verification.some(candidate=>samePublicKey(candidate.publicKey,selected.publicKey)))throw new Error('E2E_UPDATE_BLOCKED_STORAGE_UNAVAILABLE');
  return 'preserved';
 });
}

async function deriveWithIdentity(identity:StoredIdentity,peerPublicKey:JsonWebKey){
 const privateKey=await crypto.subtle.importKey('jwk',identity.privateKey,{name:'ECDH',namedCurve:'P-256'},false,['deriveKey']);
 const publicKey=await crypto.subtle.importKey('jwk',peerPublicKey,{name:'ECDH',namedCurve:'P-256'},false,[]);
 return crypto.subtle.deriveKey({name:'ECDH',public:publicKey},privateKey,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function decryptChatWithIdentity(identity:StoredIdentity,peerPublicKey:JsonWebKey,envelope:ChatEnvelope):Promise<{kind:ChatEnvelope['kind'];text?:string;blob?:ArrayBuffer;name?:string;mime?:string}>{
 const key=await deriveWithIdentity(identity,peerPublicKey);
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(envelope.iv)},key,unb64(envelope.data));
 if(envelope.kind==='text'||envelope.kind==='note'){const parsed=JSON.parse(dec.decode(plain)) as {text?:string};return {kind:envelope.kind,text:parsed.text??''}}
 return {kind:envelope.kind,blob:plain,name:envelope.name,mime:envelope.mime};
}

export async function importChatIdentity(profileId:string,identity:StoredIdentity){
 if(!isIdentity(identity))throw new Error('E2E_IDENTITY_INVALID');
 const id=canonicalId(profileId);if(!id)throw new Error('E2E_PROFILE_ID_REQUIRED');
 return lockIdentity(id,async()=>{await persistIdentity(id,identity);return identity});
}
export const exportChatIdentity=async(profileId:string)=>getChatIdentity(profileId);

async function derive(profileId:string,peerPublicKey:JsonWebKey){
 const own=await getChatIdentity(profileId);
 const privateKey=await crypto.subtle.importKey('jwk',own.privateKey,{name:'ECDH',namedCurve:'P-256'},false,['deriveKey']);
 const publicKey=await crypto.subtle.importKey('jwk',peerPublicKey,{name:'ECDH',namedCurve:'P-256'},false,[]);
 return crypto.subtle.deriveKey({name:'ECDH',public:publicKey},privateKey,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}

export async function encryptChatMedia(profileId:string,peerPublicKey:JsonWebKey,payload:{kind:'voice'|'image'|'video'|'file';blob:ArrayBuffer}):Promise<EncryptedChatMedia>{
 const key=await derive(profileId,peerPublicKey);
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,payload.blob);
 return {iv:b64(iv),ciphertext};
}

export async function decryptChatMedia(profileId:string,peerPublicKey:JsonWebKey,iv:string,ciphertext:ArrayBuffer):Promise<ArrayBuffer>{
 const key=await derive(profileId,peerPublicKey);
 return crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(iv)},key,ciphertext);
}

// Chat identities can be rotated/restored on a device. Try every locally
// retained identity when decrypting older media, without ever uploading keys.
export async function decryptChatMediaCandidates(profileId:string,peerPublicKey:JsonWebKey,iv:string,ciphertext:ArrayBuffer):Promise<ArrayBuffer>{
 const candidates=await getChatIdentityCandidates(profileId);
 if(!candidates.length)throw new Error('E2E_IDENTITY_MISSING');
 const peer=await crypto.subtle.importKey('jwk',peerPublicKey,{name:'ECDH',namedCurve:'P-256'},false,[]);
 let lastError:unknown=new Error('E2E_DECRYPT_FAILED');
 for(const identity of candidates){
  try{
   const privateKey=await crypto.subtle.importKey('jwk',identity.privateKey,{name:'ECDH',namedCurve:'P-256'},false,['deriveKey']);
   const key=await crypto.subtle.deriveKey({name:'ECDH',public:peer},privateKey,{name:'AES-GCM',length:256},false,['decrypt']);
   return await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(iv)},key,ciphertext);
  }catch(error){lastError=error}
 }
 throw lastError;
}

export async function encryptChat(profileId:string,peerPublicKey:JsonWebKey,payload:{kind:ChatEnvelope['kind'];text?:string;blob?:ArrayBuffer;name?:string;mime?:string}):Promise<ChatEnvelope>{
 const key=await derive(profileId,peerPublicKey);
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const plain=payload.blob??enc.encode(JSON.stringify({text:payload.text??''})).buffer;
 const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plain);
 return {v:1,kind:payload.kind,iv:b64(iv),data:b64(cipher),name:payload.name,mime:payload.mime,senderPublicKey:(await getChatIdentity(profileId)).publicKey,recipientPublicKey:peerPublicKey};
}

export async function decryptChat(profileId:string,peerPublicKey:JsonWebKey,envelope:ChatEnvelope):Promise<{kind:ChatEnvelope['kind'];text?:string;blob?:ArrayBuffer;name?:string;mime?:string}>{
 const key=await derive(profileId,peerPublicKey);
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(envelope.iv)},key,unb64(envelope.data));
 if(envelope.kind==='text'||envelope.kind==='note'){const parsed=JSON.parse(dec.decode(plain)) as {text?:string};return {kind:envelope.kind,text:parsed.text??''}}
 return {kind:envelope.kind,blob:plain,name:envelope.name,mime:envelope.mime};
}

/** Decrypt a conversation across stored local identity versions and the peer keys
 * attached to messages. Legacy envelopes can use the extra peer candidates.
 * Without either party's original private key AES-GCM data cannot be recovered.
 */
export async function decryptChatWithCandidates(profileId:string,envelope:ChatEnvelope,peerKeys:JsonWebKey[]){
 const identities=await getChatIdentityCandidates(profileId);
 if(!identities.length)throw new Error('E2E_IDENTITY_MISSING');
 const keys=peerKeys.filter((key,index,list)=>key?.kty==='EC'&&key.crv==='P-256'&&list.findIndex(candidate=>samePublicKey(candidate,key))===index);
 if(!keys.length)throw new Error('E2E_PEER_KEY_MISSING');
 let lastError:unknown=new Error('E2E_DECRYPT_FAILED');
 for(const key of keys)for(const identity of identities){
  try{return await decryptChatWithIdentity(identity,key,envelope)}catch(error){lastError=error}
 }
 throw lastError;
}

export async function decryptChatMediaPeerCandidates(profileId:string,peerKeys:JsonWebKey[],iv:string,ciphertext:ArrayBuffer):Promise<ArrayBuffer>{
 const keys=peerKeys.filter((key,index,list)=>key?.kty==='EC'&&key.crv==='P-256'&&list.findIndex(candidate=>samePublicKey(candidate,key))===index);
 let lastError:unknown=new Error('E2E_PEER_KEY_MISSING');
 for(const key of keys){
  try{return await decryptChatMediaCandidates(profileId,key,iv,ciphertext)}catch(error){lastError=error}
 }
 throw lastError;
}

export async function exportPublicKey(profileId:string){return (await getChatIdentity(profileId)).publicKey}

export const blobToArrayBuffer=(blob:Blob)=>blob.arrayBuffer();
export async function importIdentityPrivateKey(identity:StoredIdentity){return crypto.subtle.importKey('jwk',identity.privateKey,{name:'ECDH',namedCurve:'P-256'},false,['deriveKey'])}


export type GroupKeyPacket={iv:string;data:string;senderPublicKey?:JsonWebKey};
export async function generateGroupKey(){
  const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']);
  return key;
}
export async function exportGroupKey(key:CryptoKey){return crypto.subtle.exportKey('raw',key)}
export async function importGroupKey(raw:ArrayBuffer){return crypto.subtle.importKey('raw',raw,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
export async function encryptGroupKeyForMember(profileId:string,peerPublicKey:JsonWebKey,groupKey:CryptoKey):Promise<GroupKeyPacket>{
  const own=await getChatIdentity(profileId);
  const privateKey=await crypto.subtle.importKey('jwk',own.privateKey,{name:'ECDH',namedCurve:'P-256'},false,['deriveKey']);
  const peer=await crypto.subtle.importKey('jwk',peerPublicKey,{name:'ECDH',namedCurve:'P-256'},false,[]);
  const wrappingKey=await crypto.subtle.deriveKey({name:'ECDH',public:peer},privateKey,{name:'AES-GCM',length:256},false,['encrypt']);
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const raw=await exportGroupKey(groupKey);
  const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},wrappingKey,raw);
  return {iv:b64(iv),data:b64(data),senderPublicKey:own.publicKey};
}
export async function decryptGroupKeyForSelf(profileId:string,peerPublicKey:JsonWebKey,packet:GroupKeyPacket){
 const identities=await getChatIdentityCandidates(profileId);
 if(!identities.length)throw new Error('E2E_IDENTITY_MISSING');
 let lastError:unknown=new Error('E2E_GROUP_KEY_UNAVAILABLE');
 for(const identity of identities){
  try{
   const wrappingKey=await deriveWithIdentity(identity,peerPublicKey);
   const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(packet.iv)},wrappingKey,unb64(packet.data));
   return importGroupKey(raw);
  }catch(error){lastError=error}
 }
 throw lastError;
}
export async function encryptGroupEnvelope(groupKey:CryptoKey,kind:ChatEnvelope['kind'],text?:string,blob?:ArrayBuffer,name?:string,mime?:string,meta?:Record<string,unknown>):Promise<ChatEnvelope&{meta?:Record<string,unknown>}>{
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const plain=blob??enc.encode(JSON.stringify({text:text??'',meta:meta??{}})).buffer;
  const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},groupKey,plain);
  return {v:1,kind,iv:b64(iv),data:b64(data),name,mime,meta};
}
export async function decryptGroupEnvelope(groupKey:CryptoKey,envelope:ChatEnvelope&{meta?:Record<string,unknown>}):Promise<{kind:ChatEnvelope['kind'];text?:string;blob?:ArrayBuffer;name?:string;mime?:string;meta?:Record<string,unknown>}>{
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(envelope.iv)},groupKey,unb64(envelope.data));
  if(envelope.kind==='text'||envelope.kind==='note'){const parsed=JSON.parse(dec.decode(plain)) as {text?:string;meta?:Record<string,unknown>};return {kind:envelope.kind,text:parsed.text??'',meta:parsed.meta};}
  return {kind:envelope.kind,blob:plain,name:envelope.name,mime:envelope.mime,meta:envelope.meta};
}
export async function encryptGroupMedia(groupKey:CryptoKey,blob:ArrayBuffer):Promise<EncryptedChatMedia>{
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},groupKey,blob);
 return {iv:b64(iv),ciphertext};
}
export async function decryptGroupMedia(groupKey:CryptoKey,iv:string,ciphertext:ArrayBuffer){
 return crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(iv)},groupKey,ciphertext);
}
