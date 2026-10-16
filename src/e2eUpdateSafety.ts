import {checkpointChatIdentityForUpdate} from './chatCrypto.ts';
import {STORAGE_KEY} from './storage.ts';

/**
 * Software updates do not change E2E identity, so safety is established
 * locally, independent of network, session validity or a remote public key.
 *
 * A previously registered key may be intentionally absent on a new browser:
 * forcing its existence would deadlock every future PWA update without
 * recovering any missing key. The chat UI independently blocks decryption
 * until the matching key is restored via encrypted backup or Secure Sync.
 *
 * Only fail an update if an existing local identity cannot be checkpointed
 * and read back from durable storage, or the account cannot be identified.
 * Never generate or rotate keys during an update.
 */
export async function protectE2EBeforeUpdate():Promise<'preserved'|'not-initialized'>{
 let id='';
 try{
  const raw=localStorage.getItem(STORAGE_KEY);
  if(!raw)return 'not-initialized';
  const state=JSON.parse(raw) as {profile?:{profileId?:unknown}};
  if(typeof state?.profile?.profileId==='string')id=state.profile.profileId.trim();
 }catch{
  throw new Error('E2E_UPDATE_PROFILE_UNAVAILABLE');
 }
 if(!id)return 'not-initialized';
 return checkpointChatIdentityForUpdate(id);
}
