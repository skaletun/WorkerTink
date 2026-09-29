import type {FriendRequest, UserProfile, State} from './core.ts';

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
export type DirectoryFriend={profile:UserProfile;addedAt:number;lastSeen:number;online:boolean};
export type AdminProfile=UserProfile & {createdAt:number;updatedAt:number;lastSeen:number;online:boolean};
export type RegisterResult={profile:UserProfile;token:string;security?:{pinSet:boolean;onePassAvailable:boolean}};
export type SetupData={salary:number;taxRate:number;stage:number;vacTotal:number;startDate:string;scheduleType:State['scheduleType'];scheduleShift:State['scheduleShift'];scheduleVakhtaMonths:number;schedulePairType:State['schedulePairType'];holidayCoeff:number;nightExtraPercent:number};
export type LoginResult={profile:UserProfile;token:string;setup:SetupData|null;security:{pinSet:boolean;onePassAvailable:boolean}};
export type RequestResult={request:FriendRequest};

export function searchUser(profileId:string){return request<SearchResult>(`/profiles/${encodeURIComponent(profileId.trim().toUpperCase())}`)}
export function registerProfile(profile:UserProfile,pin:string){return request<RegisterResult>('/profiles',{method:'POST',body:JSON.stringify({profile,pin})})}
export function loginAccount(profileId:string,pin:string){return request<LoginResult>('/auth/login',{method:'POST',body:JSON.stringify({profileId,pin})})}
export function saveAccountSetup(setup:SetupData,token:string){return request<{ok:boolean;configured:boolean;setup:SetupData}>('/account/setup',{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({setup})})}
export function getAccountSetup(token:string){return request<{configured:boolean;setup:SetupData|null}>('/account/setup',{headers:{Authorization:`Bearer ${token}`}})}
export function setAccountPin(pin:string,token:string){return request<{ok:boolean}>('/auth/pin',{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({pin})})}
export function getAuthStatus(token:string){return request<{profile:UserProfile;setup:SetupData|null;security:{pinSet:boolean;onePassAvailable:boolean}}>('/auth/status',{headers:{Authorization:`Bearer ${token}`}})}
export function getOnePassOptions(token:string){return request<Record<string,unknown>>('/auth/onepass/register/options',{method:'POST',headers:{Authorization:`Bearer ${token}`}})}
export function verifyOnePassRegistration(response:unknown,token:string){return request<{ok:boolean}>('/auth/onepass/register/verify',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({response})})}
export function getOnePassAvailability(profileId:string){return request<{available:boolean}>(`/auth/onepass/available?profileId=${encodeURIComponent(profileId)}`,{method:'GET'}).then(x=>x.available)}
export function getOnePassLoginOptions(profileId:string){return request<Record<string,unknown>>(`/auth/onepass/login/options?profileId=${encodeURIComponent(profileId)}`,{method:'GET'})}
export function verifyOnePassLogin(response:unknown){return request<LoginResult>('/auth/onepass/login/verify',{method:'POST',body:JSON.stringify({response})})}
export function removeOnePass(token:string){return request<{ok:boolean}>('/auth/onepass',{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}
export function heartbeatPresence(token:string){return request<{ok:boolean;lastSeen:number}>('/presence/heartbeat',{method:'POST',headers:{Authorization:`Bearer ${token}`}})}
export function getDirectoryFriends(token:string){return request<{friends:DirectoryFriend[]}>('/friends',{headers:{Authorization:`Bearer ${token}`}})}
export function getAdminOverview(token:string){return request<{stats:{profiles:number;friendships:number;pendingRequests:number}}>('/admin/overview',{headers:{Authorization:`Bearer ${token}`}})}
export function getAdminProfiles(token:string,query=''){return request<{profiles:AdminProfile[]}>(`/admin/profiles?query=${encodeURIComponent(query)}`,{headers:{Authorization:`Bearer ${token}`}})}
export function revokeAdminSession(profileId:string,token:string){return request<{ok:boolean}>(`/admin/profiles/${encodeURIComponent(profileId)}/revoke`,{method:'POST',headers:{Authorization:`Bearer ${token}`}})}
export function deleteAdminProfile(profileId:string,token:string){return request<{ok:boolean}>(`/admin/profiles/${encodeURIComponent(profileId)}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}
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
export function declinePeerSession(id:string,token:string){return request<{session:PeerSession}>(`/peer-sessions/${encodeURIComponent(id)}/decline`,{method:'POST',headers:{Authorization:`Bearer ${token}`}})}

export function getIceServers(token:string){return request<{iceServers:RTCIceServer[]}>('/webrtc/ice-servers',{headers:{Authorization:`Bearer ${token}`}})}

export type PushSubscriptionData={endpoint:string;expirationTime:number|null;keys:{p256dh:string;auth:string}};
export function getPushPublicKey(token:string){return request<{publicKey:string}>('/push/public-key',{headers:{Authorization:`Bearer ${token}`}}).then(x=>x.publicKey)}
export function savePushSubscription(subscription:PushSubscriptionData,preferences:unknown,token:string){return request<{ok:boolean}>('/push/subscriptions',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({subscription,preferences})})}
export function removePushSubscription(endpoint:string,token:string){return request<{ok:boolean}>('/push/subscriptions',{method:'DELETE',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({endpoint})})}
export function updatePushPreferences(endpoint:string,preferences:unknown,token:string){return request<{ok:boolean}>('/push/subscriptions/preferences',{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({endpoint,preferences})})}
export function sendPushEvent(to:string,kind:'message'|'friendRequest'|'friendAccepted',token:string){return request<{ok:boolean}>('/push/events',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({to,kind})})}
export function sendTestPush(token:string){return request<{ok:boolean}>('/push/test',{method:'POST',headers:{Authorization:`Bearer ${token}`}})}
export function syncPushReminders(reminders:unknown[],token:string){return request<{ok:boolean}>('/push/reminders',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({reminders})})}
export function deleteProfile(token:string){return request<{ok:boolean}>('/profiles',{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}

export type SocialPost={id:string;body:string;createdAt:number;updatedAt:number;author:UserProfile;likes:number;comments:number;liked:boolean};
export type SocialComment={id:string;body:string;createdAt:number;author:UserProfile};
export type SocialNotification={id:string;kind:string;entityId:string|null;title:string;body:string;url:string;readAt:number|null;createdAt:number;actor:UserProfile|null};
export type SocialMessage={id:string;from:string;to:string;body:string;createdAt:number;readAt:number|null};
export function getSocialFeed(token:string,limit=20){return request<{posts:SocialPost[]}>(`/social/feed?limit=${limit}`,{headers:{Authorization:`Bearer ${token}`}})}
export function createSocialPost(body:string,token:string){return request<{ok:boolean;id:string;createdAt:number}>('/social/posts',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({body})})}
export function deleteSocialPost(id:string,token:string){return request<{ok:boolean}>(`/social/posts/${encodeURIComponent(id)}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}
export function toggleSocialLike(id:string,token:string){return request<{liked:boolean;likes:number}>(`/social/posts/${encodeURIComponent(id)}/like`,{method:'POST',headers:{Authorization:`Bearer ${token}`}})}
export function getSocialComments(id:string,token:string){return request<{comments:SocialComment[]}>(`/social/posts/${encodeURIComponent(id)}/comments`,{headers:{Authorization:`Bearer ${token}`}})}
export function addSocialComment(id:string,body:string,token:string){return request<{ok:boolean;id:string;createdAt:number}>(`/social/posts/${encodeURIComponent(id)}/comments`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({body})})}
export function getSocialNotifications(token:string){return request<{unread:number;notifications:SocialNotification[]}>('/social/notifications',{headers:{Authorization:`Bearer ${token}`}})}
export function readSocialNotification(id:string,token:string){return request<{ok:boolean}>(`/social/notifications/${encodeURIComponent(id)}/read`,{method:'POST',headers:{Authorization:`Bearer ${token}`}})}
export function readAllSocialNotifications(token:string){return request<{ok:boolean}>('/social/notifications/read-all',{method:'POST',headers:{Authorization:`Bearer ${token}`}})}
export function getSocialMessages(profileId:string,token:string){return request<{messages:SocialMessage[]}>(`/social/messages/${encodeURIComponent(profileId)}`,{headers:{Authorization:`Bearer ${token}`}})}
export function sendSocialMessage(to:string,body:string,token:string){return request<{ok:boolean;message:SocialMessage}>('/social/messages',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({to,body})})}

export type ChatKey={profileId:string;publicKey:JsonWebKey;updatedAt:number};
export type ChatServerMessage={id:string;from:string;to:string;body:string;kind:'text'|'voice'|'image'|'video';mime?:string|null;name?:string|null;createdAt:number;readAt:number|null};
export function putChatKey(publicKey:JsonWebKey,token:string){return request<{ok:boolean;key:ChatKey}>('/chat/keys',{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({publicKey})})}
export function getChatKey(profileId:string,token:string){return request<{key:ChatKey}>(`/chat/keys/${encodeURIComponent(profileId)}`,{headers:{Authorization:`Bearer ${token}`}})}
export function getChatMessages(profileId:string,token:string){return request<{messages:ChatServerMessage[]}>(`/chat/messages/${encodeURIComponent(profileId)}`,{headers:{Authorization:`Bearer ${token}`}})}
export function sendChatMessage(to:string,body:string,kind:'text'|'voice'|'image'|'video',token:string,mime?:string,name?:string){return request<{ok:boolean;message:ChatServerMessage}>('/chat/messages',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({to,body,kind,mime,name})})}
export function startQrLogin(publicKey:JsonWebKey){return request<{session:string;secret:string;publicKey:JsonWebKey;expiresAt:number}>('/auth/qr/start',{method:'POST',body:JSON.stringify({publicKey})})}
export function pollQrLogin(session:string,secret:string){return request<{status:'pending'|'approved'|'expired';profile?:UserProfile;token?:string;setup?:SetupData|null;security?:{pinSet:boolean;onePassAvailable:boolean};transfer?:{iv:string;data:string;peerPublicKey:JsonWebKey}}>(`/auth/qr/poll?session=${encodeURIComponent(session)}&secret=${encodeURIComponent(secret)}`)}
export function approveQrLogin(session:string,secret:string,transfer:{iv:string;data:string;peerPublicKey:JsonWebKey},token:string){return request<{ok:boolean}>('/auth/qr/approve',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({session,secret,transfer})})}
