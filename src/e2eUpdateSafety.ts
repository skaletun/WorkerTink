import {getChatIdentityCandidates} from './chatCrypto.ts';
import {STORAGE_KEY} from './storage.ts';

/** Updates never change IndexedDB or local E2E keys. The diagnostic is read-only
 * and deliberately does not depend on network access or API registration.
 * A missing historical private key cannot be fixed by blocking a new PWA build.
 */
export type E2EUpdateHealth='preserved'|'not-initialized'|'unverified';

export async function protectE2EBeforeUpdate():Promise<E2EUpdateHealth>{
 let id='';
 try{
  const raw=localStorage.getItem(STORAGE_KEY);
  if(!raw)return 'not-initialized';
  const parsed=JSON.parse(raw) as {profile?:{profileId?:unknown}};
  if(typeof parsed?.profile?.profileId==='string')id=parsed.profile.profileId.trim();
 }catch{
  // Malformed account state, Safari storage failures and transient quota errors
  // must not trap users forever in an obsolete Service Worker. Updating itself
  // will not erase any persisted E2E data or attempt to issue a new identity.
  return 'unverified';
 }
 if(!id)return 'not-initialized';
 try{
  const result=await Promise.race<E2EUpdateHealth>([
   getChatIdentityCandidates(id).then(keys=>keys.length?'preserved':'not-initialized'),
   new Promise<E2EUpdateHealth>(resolve=>setTimeout(()=>resolve('unverified'),3500))
  ]);
  return result;
 }catch{
  return 'unverified';
 }
}
