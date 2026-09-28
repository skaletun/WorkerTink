import type {FriendRequest, UserProfile} from './core.ts';

const viteEnv=(import.meta as ImportMeta & {env?:Record<string,string|undefined>}).env;
export const DIRECTORY_URL=((globalThis as {__WTINK_DIRECTORY_URL?:string}).__WTINK_DIRECTORY_URL||viteEnv?.VITE_WTINK_DIRECTORY_URL||'').replace(/\/$/,'');
export const directoryConfigured=Boolean(DIRECTORY_URL);

async function request<T>(path:string,options:RequestInit={}):Promise<T>{
 if(!DIRECTORY_URL)throw new Error('DIRECTORY_NOT_CONFIGURED');
 const response=await fetch(`${DIRECTORY_URL}${path}`,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(typeof data?.error==='string'?data.error:`HTTP_${response.status}`);
 return data as T;
}

export type SearchResult={profile:UserProfile};
<<<<<<< HEAD
export type RegisterResult={profile:UserProfile;token:string};
export type RequestResult={request:FriendRequest};

export function searchUser(profileId:string){return request<SearchResult>(`/profiles/${encodeURIComponent(profileId.trim().toUpperCase())}`)}
export function registerProfile(profile:UserProfile){return request<RegisterResult>('/profiles',{method:'POST',body:JSON.stringify({profile})})}
=======
export type RegisterResult={profile:UserProfile;token:string;security?:{pinSet:boolean;onePassAvailable:boolean}};
export type LoginResult={profile:UserProfile;token:string;security:{pinSet:boolean;onePassAvailable:boolean}};
export type RequestResult={request:FriendRequest};

export function searchUser(profileId:string){return request<SearchResult>(`/profiles/${encodeURIComponent(profileId.trim().toUpperCase())}`)}
export function registerProfile(profile:UserProfile,pin:string){return request<RegisterResult>('/profiles',{method:'POST',body:JSON.stringify({profile,pin})})}
export function loginAccount(profileId:string,pin:string){return request<LoginResult>('/auth/login',{method:'POST',body:JSON.stringify({profileId,pin})})}
export function setAccountPin(pin:string,token:string){return request<{ok:boolean}>('/auth/pin',{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({pin})})}
export function getAuthStatus(token:string){return request<{security:{pinSet:boolean;onePassAvailable:boolean}}>('/auth/status',{headers:{Authorization:`Bearer ${token}`}})}
export function getOnePassOptions(token:string){return request<Record<string,unknown>>('/auth/onepass/register/options',{method:'POST',headers:{Authorization:`Bearer ${token}`}})}
export function verifyOnePassRegistration(response:unknown,token:string){return request<{ok:boolean}>('/auth/onepass/register/verify',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({response})})}
export function getOnePassAvailability(profileId:string){return request<{available:boolean}>(`/auth/onepass/available?profileId=${encodeURIComponent(profileId)}`,{method:'GET'}).then(x=>x.available)}
export function getOnePassLoginOptions(profileId:string){return request<Record<string,unknown>>(`/auth/onepass/login/options?profileId=${encodeURIComponent(profileId)}`,{method:'GET'})}
export function verifyOnePassLogin(response:unknown){return request<LoginResult>('/auth/onepass/login/verify',{method:'POST',body:JSON.stringify({response})})}
export function removeOnePass(token:string){return request<{ok:boolean}>('/auth/onepass',{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}
>>>>>>> 5b4ad83 (feat: account auth with PIN and OnePass)
export function updateProfile(profile:UserProfile,token:string){return request<SearchResult>('/profiles',{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({profile})})}
export function sendFriendRequest(from:UserProfile,to:string,token:string){return request<RequestResult>('/friend-requests',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({from,to})})}
export function getIncoming(profileId:string,token:string){return request<{requests:FriendRequest[]}>(`/friend-requests/incoming?userId=${encodeURIComponent(profileId)}`,{headers:{Authorization:`Bearer ${token}`}})}
export function getOutgoing(profileId:string,token:string){return request<{requests:FriendRequest[]}>(`/friend-requests/outgoing?userId=${encodeURIComponent(profileId)}`,{headers:{Authorization:`Bearer ${token}`}})}
export function respondFriendRequest(id:string,action:'accept'|'decline',token:string){return request<RequestResult>(`/friend-requests/${encodeURIComponent(id)}/${action}`,{method:'POST',headers:{Authorization:`Bearer ${token}`}})}

export type PeerSession={id:string;from:UserProfile;to:UserProfile;offer:string;answer:string|null;status:'pending'|'answered'|'expired'|'cancelled';createdAt:number;updatedAt:number;expiresAt:number};
export function createPeerSession(target:string,offer:string,token:string){return request<{session:PeerSession}>('/peer-sessions',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({to:target,offer})})}
export function getIncomingPeerSessions(token:string){return request<{sessions:PeerSession[]}>(`/peer-sessions/incoming`,{headers:{Authorization:`Bearer ${token}`}})}
export function getOutgoingPeerSessions(token:string){return request<{sessions:PeerSession[]}>(`/peer-sessions/outgoing`,{headers:{Authorization:`Bearer ${token}`}})}
export function answerPeerSession(id:string,answer:string,token:string){return request<{session:PeerSession}>(`/peer-sessions/${encodeURIComponent(id)}/answer`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({answer})})}

export function getIceServers(token:string){return request<{iceServers:RTCIceServer[]}>('/webrtc/ice-servers',{headers:{Authorization:`Bearer ${token}`}})}
<<<<<<< HEAD
=======

export type PushSubscriptionData={endpoint:string;expirationTime:number|null;keys:{p256dh:string;auth:string}};
export function getPushPublicKey(token:string){return request<{publicKey:string}>('/push/public-key',{headers:{Authorization:`Bearer ${token}`}}).then(x=>x.publicKey)}
export function savePushSubscription(subscription:PushSubscriptionData,preferences:unknown,token:string){return request<{ok:boolean}>('/push/subscriptions',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({subscription,preferences})})}
export function removePushSubscription(endpoint:string,token:string){return request<{ok:boolean}>('/push/subscriptions',{method:'DELETE',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({endpoint})})}
export function updatePushPreferences(endpoint:string,preferences:unknown,token:string){return request<{ok:boolean}>('/push/subscriptions/preferences',{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({endpoint,preferences})})}
export function sendPushEvent(to:string,kind:'message'|'friendRequest'|'friendAccepted',token:string){return request<{ok:boolean}>('/push/events',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({to,kind})})}
export function sendTestPush(token:string){return request<{ok:boolean}>('/push/test',{method:'POST',headers:{Authorization:`Bearer ${token}`}})}
export function syncPushReminders(reminders:unknown[],token:string){return request<{ok:boolean}>('/push/reminders',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({reminders})})}
export function deleteProfile(token:string){return request<{ok:boolean}>('/profiles',{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}
>>>>>>> 5b4ad83 (feat: account auth with PIN and OnePass)
