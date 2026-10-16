import {getChatIdentityCandidates} from './chatCrypto.ts';
import {getOwnChatKey} from './directory/chat.ts';

type Identity={privateKey:JsonWebKey;publicKey:JsonWebKey};
type ServerKeyResult={key:{publicKey:JsonWebKey}};
export type E2EHealth={
 version:1;
 checkedAt:number;
 local:'ready'|'missing'|'invalid'|'unavailable';
 remote:'matched'|'not-registered'|'mismatch'|'offline'|'unavailable'|'not-checked';
 recoverableIdentities:number;
 malformedIdentities:number;
};
export type E2EHealthDependencies={
 local:(id:string)=>Promise<Identity[]>;
 remote:(token:string)=>Promise<ServerKeyResult>;
 online:()=>boolean;
};

const dependencies:E2EHealthDependencies={
 local:getChatIdentityCandidates,
 remote:getOwnChatKey,
 online:()=>typeof navigator==='undefined'||navigator.onLine!==false
};
const same=(a:JsonWebKey,b:JsonWebKey)=>a?.kty==='EC'&&b?.kty==='EC'&&a.crv==='P-256'&&b.crv==='P-256'&&a.x===b.x&&a.y===b.y;
const reason=(error:unknown)=>{
 const value=String(error);
 if(/CHAT_KEY_NOT_READY|HTTP_404|NOT_FOUND/.test(value))return 'not-registered';
 if(/Failed to fetch|HTTP_5\d\d|HTTP_429|NetworkError|OFFLINE|Load failed/i.test(value))return 'offline';
 return 'unavailable';
};
/** Import-and-derive verification detects corrupt JWKs without exposing their
 * contents. No writes and no key creation or rotation are permitted.
 */
async function validIdentity(value:Identity):Promise<boolean>{
 try{
  if(!value||!same(value.privateKey,value.publicKey)||typeof value.privateKey.d!=='string')return false;
  // WTinker identities are generated with ['deriveKey']; attempting
  // ['deriveBits'] rejects their JWK key_ops on Safari and Chromium.
  const privateKey=await crypto.subtle.importKey('jwk',value.privateKey,{name:'ECDH',namedCurve:'P-256'},false,['deriveKey']);
  const publicKey=await crypto.subtle.importKey('jwk',value.publicKey,{name:'ECDH',namedCurve:'P-256'},false,[]);
  const derived=await crypto.subtle.deriveKey({name:'ECDH',public:publicKey},privateKey,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  return derived.algorithm.name==='AES-GCM';
 }catch{return false}
}
async function bounded<T>(task:Promise<T>,ms:number):Promise<T>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([
  task,new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>reject(new Error('E2E_HEALTH_TIMEOUT')),ms)})
 ])}finally{if(timer!==undefined)clearTimeout(timer)}
}
export async function checkE2EHealth(
 profileId:string,token:string,
 deps:E2EHealthDependencies=dependencies
):Promise<E2EHealth>{
 const result:E2EHealth={version:1,checkedAt:Date.now(),local:'unavailable',remote:'not-checked',recoverableIdentities:0,malformedIdentities:0};
 const id=profileId.trim().toUpperCase();
 if(!/^WTINKID-\d{6}$/.test(id))return result;
 let candidates:Identity[]=[];
 let verified:Identity[]=[];
 try{
  candidates=await bounded(deps.local(id),6000);
  const checks=await bounded(Promise.all(candidates.map(validIdentity)),6000);
  verified=candidates.filter((_,index)=>checks[index]);
  result.recoverableIdentities=verified.length;
  result.malformedIdentities=checks.length-result.recoverableIdentities;
  result.local=result.recoverableIdentities?'ready':checks.length?'invalid':'missing';
 }catch{
  result.local='unavailable';
 }
 if(!token||!deps.online()){result.remote='offline';return result}
 try{
  const remote=await bounded(deps.remote(token),8000);
  if(!remote.key?.publicKey)result.remote='not-registered';
  else result.remote=verified.some(identity=>same(identity.publicKey,remote.key.publicKey))?'matched':'mismatch';
 }catch(error){result.remote=reason(error)}
 // Only whitelisted status enums and counts leave this function. Neither
 // public nor private JWK material, user id or auth token enters diagnostics.
 return result;
}
export function redactedE2EHealthReport(health:E2EHealth):string{
 const allowedLocal=['ready','missing','invalid','unavailable'];
 const allowedRemote=['matched','not-registered','mismatch','offline','unavailable','not-checked'];
 return JSON.stringify({
  version:1,
  checkedAt:Number.isFinite(health.checkedAt)?health.checkedAt:0,
  local:allowedLocal.includes(health.local)?health.local:'unavailable',
  remote:allowedRemote.includes(health.remote)?health.remote:'unavailable',
  recoverableIdentities:Math.max(0,Math.min(250,Math.trunc(health.recoverableIdentities))),
  malformedIdentities:Math.max(0,Math.min(250,Math.trunc(health.malformedIdentities)))
 },null,2);
}
