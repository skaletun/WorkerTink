const KEY_PREFIX='workertink:chat-e2e:v1:';
const enc=new TextEncoder();
const dec=new TextDecoder();

type StoredIdentity={privateKey:JsonWebKey;publicKey:JsonWebKey};
export type ChatEnvelope={v:1;kind:'text'|'voice'|'image'|'video'|'file'|'note';iv:string;data:string;name?:string;mime?:string;mediaId?:string;size?:number;caption?:string};
export type EncryptedChatMedia={iv:string;ciphertext:ArrayBuffer};

const b64=(bytes:ArrayBuffer|Uint8Array)=>{const a=new Uint8Array(bytes);let s='';for(const b of a)s+=String.fromCharCode(b);return btoa(s)};
const unb64=(value:string)=>{const s=atob(value);const a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return a};

async function generateIdentity():Promise<StoredIdentity>{
 const pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveKey']);
 return {privateKey:await crypto.subtle.exportKey('jwk',pair.privateKey),publicKey:await crypto.subtle.exportKey('jwk',pair.publicKey)};
}

export async function getChatIdentity(profileId:string):Promise<StoredIdentity>{
 const key=KEY_PREFIX+profileId.toUpperCase();
 try{const raw=localStorage.getItem(key);if(raw)return JSON.parse(raw) as StoredIdentity}catch{}
 const identity=await generateIdentity();localStorage.setItem(key,JSON.stringify(identity));return identity;
}

export async function importChatIdentity(profileId:string,identity:StoredIdentity){localStorage.setItem(KEY_PREFIX+profileId.toUpperCase(),JSON.stringify(identity));return identity}
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

export async function encryptChat(profileId:string,peerPublicKey:JsonWebKey,payload:{kind:ChatEnvelope['kind'];text?:string;blob?:ArrayBuffer;name?:string;mime?:string}):Promise<ChatEnvelope>{
 const key=await derive(profileId,peerPublicKey);
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const plain=payload.blob??enc.encode(JSON.stringify({text:payload.text??''})).buffer;
 const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plain);
 return {v:1,kind:payload.kind,iv:b64(iv),data:b64(cipher),name:payload.name,mime:payload.mime};
}

export async function decryptChat(profileId:string,peerPublicKey:JsonWebKey,envelope:ChatEnvelope):Promise<{kind:ChatEnvelope['kind'];text?:string;blob?:ArrayBuffer;name?:string;mime?:string}>{
 const key=await derive(profileId,peerPublicKey);
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(envelope.iv)},key,unb64(envelope.data));
 if(envelope.kind==='text'||envelope.kind==='note'){const parsed=JSON.parse(dec.decode(plain)) as {text?:string};return {kind:envelope.kind,text:parsed.text??''}}
 return {kind:envelope.kind,blob:plain,name:envelope.name,mime:envelope.mime};
}

export async function exportPublicKey(profileId:string){return (await getChatIdentity(profileId)).publicKey}

export async function createQrTransferKey(){
 const pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveKey']);
 return {privateKey:pair.privateKey,publicKey:await crypto.subtle.exportKey('jwk',pair.publicKey)};
}

export async function encryptKeyTransfer(privateKey:CryptoKey,peerPublicJwk:JsonWebKey,identity:StoredIdentity){
 const peer=await crypto.subtle.importKey('jwk',peerPublicJwk,{name:'ECDH',namedCurve:'P-256'},false,[]);
 const key=await crypto.subtle.deriveKey({name:'ECDH',public:peer},privateKey,{name:'AES-GCM',length:256},false,['encrypt']);
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(JSON.stringify(identity)));
 return {iv:b64(iv),data:b64(data)};
}

export async function decryptKeyTransfer(privateKey:CryptoKey,peerPublicJwk:JsonWebKey,packet:{iv:string;data:string}):Promise<StoredIdentity>{
 const peer=await crypto.subtle.importKey('jwk',peerPublicJwk,{name:'ECDH',namedCurve:'P-256'},false,[]);
 const key=await crypto.subtle.deriveKey({name:'ECDH',public:peer},privateKey,{name:'AES-GCM',length:256},false,['decrypt']);
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(packet.iv)},key,unb64(packet.data));
 return JSON.parse(dec.decode(plain)) as StoredIdentity;
}

export const blobToArrayBuffer=(blob:Blob)=>blob.arrayBuffer();
export async function importIdentityPrivateKey(identity:StoredIdentity){return crypto.subtle.importKey('jwk',identity.privateKey,{name:'ECDH',namedCurve:'P-256'},false,['deriveKey'])}


export type GroupKeyPacket={iv:string;data:string};
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
  return {iv:b64(iv),data:b64(data)};
}
export async function decryptGroupKeyForSelf(profileId:string,peerPublicKey:JsonWebKey,packet:GroupKeyPacket){
  const own=await getChatIdentity(profileId);
  const privateKey=await crypto.subtle.importKey('jwk',own.privateKey,{name:'ECDH',namedCurve:'P-256'},false,['deriveKey']);
  const peer=await crypto.subtle.importKey('jwk',peerPublicKey,{name:'ECDH',namedCurve:'P-256'},false,[]);
  const wrappingKey=await crypto.subtle.deriveKey({name:'ECDH',public:peer},privateKey,{name:'AES-GCM',length:256},false,['decrypt']);
  const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(packet.iv)},wrappingKey,unb64(packet.data));
  return importGroupKey(raw);
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
