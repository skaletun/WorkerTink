import {checkpointChatIdentityForUpdate,getChatIdentityCandidates} from './chatCrypto';
import {getOwnChatKey} from './directory';
import {getAuthToken,STORAGE_KEY} from './storage';

/**
 * UpdateGate only reads and checkpoints existing keys. It never calls
 * getChatIdentity(), so a software update cannot create or rotate keys.
 */
export async function protectE2EBeforeUpdate():Promise<void>{
 let id='';
 try{
  const raw=localStorage.getItem(STORAGE_KEY);
  if(!raw)return;
  const parsed=JSON.parse(raw) as {profile?:{profileId?:string}};
  id=typeof parsed?.profile?.profileId==='string'?parsed.profile.profileId.trim():'';
 }catch{throw new Error('E2E_UPDATE_PROFILE_UNAVAILABLE')}
 if(!id)return;
 const token=getAuthToken();
 let expected:JsonWebKey|undefined;
 if(token){
  try{expected=(await getOwnChatKey(token)).key.publicKey}
  catch(error){
   const code=String(error);
   if(!code.includes('CHAT_KEY_NOT_READY')&&!code.includes('UNAUTHORIZED')&&!code.includes('HTTP_401')){
    // If the API is temporarily unavailable, an existing local identity can
    // still be preserved; a missing identity must not be hidden by a reload.
    if(!(await getChatIdentityCandidates(id)).length)throw new Error('E2E_UPDATE_CHECK_UNAVAILABLE');
   }
  }
 }
 await checkpointChatIdentityForUpdate(id,expected);
}
