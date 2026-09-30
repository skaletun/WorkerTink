import type {FriendRequest, UserProfile, State} from './core.ts';

const viteEnv=(import.meta as ImportMeta & {env?:Record<string,string|undefined>}).env;
export const DIRECTORY_URL=((globalThis as {__WTINK_DIRECTORY_URL?:string}).__WTINK_DIRECTORY_URL||viteEnv?.VITE_WTINK_DIRECTORY_URL||(viteEnv?.PROD?'https://workertink-directory.workertink-directory.workers.dev':'' )).replace(/\/$/,'');
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
export type ChatMute={peerId:string;mutedUntil:number|null};
export type AdminProfile=UserProfile & {createdAt:number;updatedAt:number;lastSeen:number;online:boolean};
export type RegisterResult={profile:UserProfile;token:string;security?:{pinSet:boolean;onePassAvailable:boolean}};
export type SetupData={salary:number;taxRate:number;stage:number;vacTotal:number;startDate:string;scheduleType:State['scheduleType'];scheduleShift:State['scheduleShift'];scheduleVakhtaMonths:number;schedulePairType:State['schedulePairType'];holidayCoeff:number;nightExtraPercent:number};
export type LoginResult={profile:UserProfile;token:string;setup:SetupData|null;security:{pinSet:boolean;onePassAvailable:boolean}};
export type RequestResult={request:FriendRequest};

export function searchUser(profileId:string){return request<SearchResult>(`/profiles/${encodeURIComponent(profileId.trim())}`)}
export function getUserByUsername(username:string){return request<SearchResult>(`/user?username=${encodeURIComponent(username.replace(/^@/,''))}`)}
export function checkUsername(username:string){return request<{valid:boolean;available:boolean}>(`/username/check?username=${encodeURIComponent(username.replace(/^@/,''))}`)}
export function updateUsername(username:string,token:string){return request<SearchResult>('/profiles',{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({profile:{username}})})}
export function registerProfile(profile:UserProfile,pin:string){return request<RegisterResult>('/profiles',{method:'POST',body:JSON.stringify({profile,pin})})}
export function loginAccount(profileId:string,pin:string,deviceName?:string){return request<LoginResult>('/auth/login',{method:'POST',body:JSON.stringify({profileId,pin,deviceName:deviceName||((navigator as any).userAgentData?.platform||navigator.platform||'Устройство')})})}
export function saveAccountSetup(setup:SetupData,token:string){return request<{ok:boolean;configured:boolean;setup:SetupData}>('/account/setup',{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({setup})})}
export function getAccountSetup(token:string){return request<{configured:boolean;setup:SetupData|null}>('/account/setup',{headers:{Authorization:`Bearer ${token}`}})}
export function setAccountPin(pin:string,token:string){return request<{ok:boolean}>('/auth/pin',{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({pin})})}
export type AuthSession={sessionId:string;deviceName:string;createdAt:number;expiresAt:number;lastSeen:number;current:boolean};
export function getAuthSessions(token:string){return request<{sessions:AuthSession[]}>('/auth/sessions',{headers:{Authorization:`Bearer ${token}`}})}
export function revokeAuthSession(sessionId:string,token:string){return request<{ok:boolean}>(`/auth/sessions/${encodeURIComponent(sessionId)}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}
export function getAuthStatus(token:string){return request<{profile:UserProfile;setup:SetupData|null;security:{pinSet:boolean;onePassAvailable:boolean}}>('/auth/status',{headers:{Authorization:`Bearer ${token}`}})}
export function getOnePassOptions(token:string){return request<Record<string,unknown>>('/auth/onepass/register/options',{method:'POST',headers:{Authorization:`Bearer ${token}`}})}
export function verifyOnePassRegistration(response:unknown,token:string,deviceName?:string){return request<{ok:boolean}>('/auth/onepass/register/verify',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({response,deviceName})})}
export function getOnePassAvailability(profileId:string){return request<{available:boolean}>(`/auth/onepass/available?profileId=${encodeURIComponent(profileId)}`,{method:'GET'}).then(x=>x.available)}
export function getOnePassLoginOptions(profileId:string){return request<Record<string,unknown>>(`/auth/onepass/login/options?profileId=${encodeURIComponent(profileId)}`,{method:'GET'})}
export function verifyOnePassLogin(response:unknown,deviceName?:string){return request<LoginResult>('/auth/onepass/login/verify',{method:'POST',body:JSON.stringify({response,deviceName:deviceName||((navigator as any).userAgentData?.platform||navigator.platform||'OnePass устройство')})})}
export type OnePassDevice={id:string;deviceType:string;backedUp:boolean;transports:string[];deviceName:string;createdAt:number;updatedAt:number};
export function getOnePassDevices(token:string){return request<{devices:OnePassDevice[]}>('/auth/onepass',{headers:{Authorization:`Bearer ${token}`}})}
export function removeOnePassDevice(id:string,token:string){return request<{ok:boolean}>(`/auth/onepass/${encodeURIComponent(id)}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}
export function removeOnePass(token:string){return request<{ok:boolean}>('/auth/onepass',{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}
export function heartbeatPresence(token:string){return request<{ok:boolean;lastSeen:number}>('/presence/heartbeat',{method:'POST',headers:{Authorization:`Bearer ${token}`}})}
export function getDirectoryFriends(token:string){return request<{friends:DirectoryFriend[]}>('/friends',{headers:{Authorization:`Bearer ${token}`}})}
export function getAdminOverview(token:string){return request<{stats:{profiles:number;friendships:number;pendingRequests:number}}>('/admin/overview',{headers:{Authorization:`Bearer ${token}`}})}
export function getAdminProfiles(token:string,query=''){return request<{profiles:AdminProfile[]}>(`/admin/profiles?query=${encodeURIComponent(query)}`,{headers:{Authorization:`Bearer ${token}`}})}
export function getAdminProfileDetail(profileId:string,token:string){return request<{profile:AdminProfile;stats:{friends:number;requests:number;onePass:number;blocks:number;media:number};devices:{id:string;deviceName:string;deviceType:string;backedUp:boolean;createdAt:number;updatedAt:number}[]}>(`/admin/profiles/${encodeURIComponent(profileId)}`,{headers:{Authorization:`Bearer ${token}`}})}
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
export function logoutSession(token:string){return request<{ok:boolean}>('/auth/session',{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}
export function deleteProfile(token:string){return request<{ok:boolean}>('/profiles',{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}

export type SocialPost={id:string;body:string;kind?:'post'|'announcement'|'question'|'shift';groupId?:string|null;visibility?:'network'|'friends';createdAt:number;updatedAt:number;author:UserProfile;likes:number;comments:number;liked:boolean};
export type SocialComment={id:string;body:string;createdAt:number;author:UserProfile};
export type SocialNotification={id:string;kind:string;entityId:string|null;title:string;body:string;url:string;readAt:number|null;createdAt:number;actor:UserProfile|null};
export type SocialMessage={id:string;from:string;to:string;body:string;createdAt:number;readAt:number|null};
export function getSocialFeed(token:string,limit=20){return request<{posts:SocialPost[]}>(`/social/feed?limit=${limit}`,{headers:{Authorization:`Bearer ${token}`}})}
export function createSocialPost(body:string,token:string,options?:{kind?:'post'|'announcement'|'question'|'shift';groupId?:string|null;visibility?:'network'|'friends'}){return request<{ok:boolean;id:string;createdAt:number}>('/social/posts',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({body,...options})})}
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
export type ChatServerMessage={id:string;from:string;to:string;body:string;kind:'text'|'voice'|'image'|'video'|'file'|'note';mime?:string|null;name?:string|null;createdAt:number;readAt:number|null;editedAt?:number|null;deletedAt?:number|null;replyToId?:string|null;replyPreview?:string|null;noteDate?:string|null;noteShift?:string|null;deletedForMe?:boolean};
export function putChatKey(publicKey:JsonWebKey,token:string){return request<{ok:boolean;key:ChatKey}>('/chat/keys',{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({publicKey})})}
export function getChatKey(profileId:string,token:string){return request<{key:ChatKey}>(`/chat/keys/${encodeURIComponent(profileId)}`,{headers:{Authorization:`Bearer ${token}`}})}
export function getOwnChatKey(token:string){return request<{key:ChatKey}>('/chat/keys/me',{headers:{Authorization:`Bearer ${token}`}})}
export function getChatMessages(profileId:string,token:string){return request<{messages:ChatServerMessage[]}>(`/chat/messages/${encodeURIComponent(profileId)}`,{headers:{Authorization:`Bearer ${token}`}})}
export type ChatPin={messageId:string;pinnedBy:string;pinnedAt:number;message:ChatServerMessage};
export function getChatPins(profileId:string,token:string){return request<{pins:ChatPin[]}>(`/chat/messages/${encodeURIComponent(profileId)}/pins`,{headers:{Authorization:`Bearer ${token}`}})}
export function pinChatMessage(messageId:string,token:string){return request<{ok:boolean;messageId:string;pinnedBy:string}>(`/chat/messages/${encodeURIComponent(messageId)}/pin`,{method:'PUT',headers:{Authorization:`Bearer ${token}`}})}
export function unpinChatMessage(messageId:string,token:string){return request<{ok:boolean}>(`/chat/messages/${encodeURIComponent(messageId)}/pin`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}
export function sendChatMessage(to:string,body:string,kind:'text'|'voice'|'image'|'video'|'file'|'note',token:string,mime?:string,name?:string,replyToId?:string,replyPreview?:string,noteDate?:string,noteShift?:string){return request<{ok:boolean;message:ChatServerMessage}>('/chat/messages',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({to,body,kind,mime,name,replyToId,replyPreview,noteDate,noteShift})})}
export async function uploadChatMedia(to:string,kind:'voice'|'image'|'video'|'file',payload:{iv:string;ciphertext:ArrayBuffer;mime?:string;name?:string;size:number;groupId?:string},token:string){
 const init=await request<{id:string;chunkSize:number}>('/chat/media/init',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({to,groupId:payload.groupId||'',kind,iv:payload.iv,mime:payload.mime||'',name:payload.name||'',size:payload.size})});
 const chunkSize=init.chunkSize||512*1024;
 for(let offset=0,index=0;offset<payload.ciphertext.byteLength;offset+=chunkSize,index++){const chunk=payload.ciphertext.slice(offset,Math.min(offset+chunkSize,payload.ciphertext.byteLength));const response=await fetch(`${DIRECTORY_URL}/chat/media/${encodeURIComponent(init.id)}/${index}`,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/octet-stream'},body:chunk});if(!response.ok)throw new Error((await response.json().catch(()=>({})))?.error||`HTTP_${response.status}`)}
 await request<{ok:boolean}>(`/chat/media/${encodeURIComponent(init.id)}/complete`,{method:'POST',headers:{Authorization:`Bearer ${token}`}});
 return init.id;
}
export async function getChatMedia(id:string,token:string){if(!DIRECTORY_URL)throw new Error('DIRECTORY_NOT_CONFIGURED');const response=await fetch(`${DIRECTORY_URL}/chat/media/${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${token}`}});if(!response.ok)throw new Error((await response.json().catch(()=>({})))?.error||`HTTP_${response.status}`);return response.arrayBuffer()} 
export type ChatReaction={emoji:string;profileId:string};
export function getChatReactions(messageId:string,token:string){return request<{reactions:ChatReaction[]}>(`/chat/messages/${encodeURIComponent(messageId)}/reactions`,{headers:{Authorization:`Bearer ${token}`}})}
export function setChatReaction(messageId:string,emoji:string,token:string){return request<{ok:boolean;reaction:ChatReaction}>(`/chat/messages/${encodeURIComponent(messageId)}/reactions`,{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({emoji})})}
export function removeChatReaction(messageId:string,token:string){return request<{ok:boolean}>(`/chat/messages/${encodeURIComponent(messageId)}/reactions`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}
export function getGroupChatReactions(groupId:string,messageId:string,token:string){return request<{reactions:ChatReaction[]}>(`/chat/groups/${encodeURIComponent(groupId)}/messages/${encodeURIComponent(messageId)}/reactions`,{headers:{Authorization:`Bearer ${token}`}})}
export function setGroupChatReaction(groupId:string,messageId:string,emoji:string,token:string){return request<{ok:boolean;reaction:ChatReaction}>(`/chat/groups/${encodeURIComponent(groupId)}/messages/${encodeURIComponent(messageId)}/reactions`,{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({emoji})})}
export function removeGroupChatReaction(groupId:string,messageId:string,token:string){return request<{ok:boolean}>(`/chat/groups/${encodeURIComponent(groupId)}/messages/${encodeURIComponent(messageId)}/reactions`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}
export function deleteChatMessage(id:string,mode:'me'|'both',token:string){return request<{ok:boolean}>(`/chat/messages/${encodeURIComponent(id)}/${mode}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}
export function clearChat(peerId:string,token:string){return request<{ok:boolean;count:number}>(`/chat/messages/${encodeURIComponent(peerId)}/clear`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}
export function editChatMessage(id:string,body:string,token:string){return request<{ok:boolean;message:ChatServerMessage}>(`/chat/messages/${encodeURIComponent(id)}`,{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({body})})}
export function setChatMute(peerId:string,mutedUntil:number|null,token:string){return request<{ok:boolean;mute:ChatMute}>('/chat/mute',{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({peerId,mutedUntil})})}
export function getChatMute(peerId:string,token:string){return request<{mute:ChatMute}>(`/chat/mute/${encodeURIComponent(peerId)}`,{headers:{Authorization:`Bearer ${token}`}})}
export function removeFriend(profileId:string,token:string){return request<{ok:boolean}>(`/friends/${encodeURIComponent(profileId)}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}
export function blockProfile(profileId:string,token:string){return request<{ok:boolean}>(`/friends/${encodeURIComponent(profileId)}/block`,{method:'POST',headers:{Authorization:`Bearer ${token}`}})}
export function unblockProfile(profileId:string,token:string){return request<{ok:boolean}>(`/friends/${encodeURIComponent(profileId)}/block`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}


export type GroupChat={id:string;name:string;description:string;avatar:string;ownerId:string;visibility:'public'|'private';members:number;role:string;createdAt:number};
export type GroupChatMember={profile:UserProfile;role:string;joinedAt:number};
export type GroupChatDetail={group:GroupChat;members:GroupChatMember[];key:{iv:string;data:string}|null};
export type GroupChatMessage=ChatServerMessage;
export function getChatGroups(token:string){return request<{groups:GroupChat[]}>('/chat/groups',{headers:{Authorization:`Bearer ${token}`}})}
export function createChatGroup(name:string,description:string,visibility:'public'|'private',token:string){return request<{group:GroupChat}>('/chat/groups',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({name,description,visibility})})}
export function getChatGroup(id:string,token:string){return request<GroupChatDetail>(`/chat/groups/${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${token}`}})}
export function getChatGroupLink(id:string,token:string){return request<{group:GroupChat & {joined:boolean}}>(`/chat/groups/link/${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${token}`}})}
export function joinChatGroup(id:string,token:string){return request<{ok:boolean}>(`/chat/groups/${encodeURIComponent(id)}/join`,{method:'POST',headers:{Authorization:`Bearer ${token}`}})}
export function putChatGroupKey(id:string,packet:{iv:string;data:string},token:string){return request<{ok:boolean}>(`/chat/groups/${encodeURIComponent(id)}/keys`,{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify(packet)})}
export function addChatGroupMember(id:string,profileId:string,token:string){return request<{ok:boolean;profile:UserProfile;role:string}>(`/chat/groups/${encodeURIComponent(id)}/members`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({profileId})})}
export function removeChatGroupMember(id:string,profileId:string,token:string){return request<{ok:boolean}>(`/chat/groups/${encodeURIComponent(id)}/members`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({profileId})})}
export function putChatGroupMemberKey(id:string,profileId:string,packet:{iv:string;data:string},token:string){return request<{ok:boolean}>(`/chat/groups/${encodeURIComponent(id)}/keys/${encodeURIComponent(profileId)}`,{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify(packet)})}
export function getChatGroupMessages(id:string,token:string){return request<{messages:GroupChatMessage[]}>(`/chat/groups/${encodeURIComponent(id)}/messages`,{headers:{Authorization:`Bearer ${token}`}})}
export function sendChatGroupMessage(id:string,body:string,kind:ChatServerMessage['kind'],token:string,mime?:string,name?:string,replyToId?:string,replyPreview?:string){return request<{ok:boolean;message:GroupChatMessage}>(`/chat/groups/${encodeURIComponent(id)}/messages`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({body,kind,mime,name,replyToId,replyPreview})})}
export function deleteChatGroupMessage(id:string,mode:'me'|'both',token:string){return request<{ok:boolean}>(`/chat/groups/messages/${encodeURIComponent(id)}/${mode}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}
export function clearChatGroup(id:string,token:string){return request<{ok:boolean;count:number}>(`/chat/groups/${encodeURIComponent(id)}/clear`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}

export type CompanyChannel={id:string;name:string;slug:string;description:string;companyName:string;ownerId:string;visibility:'public'|'private';members:number;roleId:string|null;createdAt:number};
export type ChannelRole={id:string;name:string;permissions:Record<string,boolean>};
export type ChannelPost={id:string;body:string;createdAt:number;updatedAt:number;author:UserProfile};
export type CompanyInvite={id:string;channelId:string;channelName:string;companyName:string;createdAt:number;sender:UserProfile};
export function getCompanyChannels(token:string){return request<{channels:CompanyChannel[]}>('/company/channels',{headers:{Authorization:`Bearer ${token}`}})}
export function getCompanyInvites(token:string){return request<{invites:CompanyInvite[]}>('/company/invites',{headers:{Authorization:`Bearer ${token}`}})}
export function createCompanyChannel(input:{name:string;companyName:string;description?:string;slug?:string;visibility?:'public'|'private'},token:string){return request<{channel:CompanyChannel}>('/company/channels',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify(input)})}
export function getCompanyChannelLink(slug:string,token:string){return request<{channel:CompanyChannel & {joined:boolean}}>(`/company/channels/link/${encodeURIComponent(slug)}`,{headers:{Authorization:`Bearer ${token}`}})}
export function joinCompanyChannel(id:string,token:string){return request<{ok:boolean}>(`/company/channels/${encodeURIComponent(id)}/join`,{method:'POST',headers:{Authorization:`Bearer ${token}`}})}
export function inviteCompanyChannel(channelId:string,profileId:string,token:string){return request<{ok:boolean;id:string}>(`/company/channels/${encodeURIComponent(channelId)}/invite`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({profileId})})}
export function respondCompanyInvite(id:string,action:'accept'|'decline',token:string){return request<{ok:boolean}>(`/company/invites/${encodeURIComponent(id)}/${action}`,{method:'POST',headers:{Authorization:`Bearer ${token}`}})}
export function getCompanyChannelPosts(channelId:string,token:string){return request<{posts:ChannelPost[]}>(`/company/channels/${encodeURIComponent(channelId)}/posts`,{headers:{Authorization:`Bearer ${token}`}})}
export function createCompanyChannelPost(channelId:string,body:string,token:string){return request<{ok:boolean;id:string;createdAt:number}>(`/company/channels/${encodeURIComponent(channelId)}/posts`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({body})})}
export function getCompanyChannelRoles(channelId:string,token:string){return request<{roles:ChannelRole[]}>(`/company/channels/${encodeURIComponent(channelId)}/roles`,{headers:{Authorization:`Bearer ${token}`}})}
export function createCompanyChannelRole(channelId:string,name:string,permissions:Record<string,boolean>,token:string){return request<{ok:boolean;role:ChannelRole}>(`/company/channels/${encodeURIComponent(channelId)}/roles`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({name,permissions})})}
export function updateCompanyChannelRole(channelId:string,roleId:string,name:string,permissions:Record<string,boolean>,token:string){return request<{ok:boolean}>(`/company/channels/${encodeURIComponent(channelId)}/roles/${encodeURIComponent(roleId)}`,{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({name,permissions})})}
export function transferCompanyChannelOwner(channelId:string,profileId:string,token:string){return request<{ok:boolean}>(`/company/channels/${encodeURIComponent(channelId)}/transfer-owner`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({profileId})})}

export type NetworkGroup={id:string;name:string;slug:string;description:string;visibility:'public'|'private';owner:UserProfile;members:number;joined:boolean;role?:string;createdAt:number};
export type NetworkEvent={id:string;title:string;description:string;kind:string;startsAt:number;endsAt:number|null;location:string;owner:UserProfile;groupId:string|null;going:number;joined:boolean};
export type ShiftSwap={id:string;date:string;shift:string;requestedShift:string;note:string;status:'open'|'claimed'|'cancelled';owner:UserProfile;claimedBy:UserProfile|null;createdAt:number};
export type NetworkPerson={profile:UserProfile;online:boolean;mutualFriends:number;connected:boolean};
export type NetworkHome={groups:NetworkGroup[];events:NetworkEvent[];swaps:ShiftSwap[];people:NetworkPerson[]};
export function getNetworkHome(token:string){return request<NetworkHome>('/network/home',{headers:{Authorization:`Bearer ${token}`}})}
export function searchNetworkPeople(query:string,token:string){return request<{people:NetworkPerson[]}>(`/network/people?query=${encodeURIComponent(query)}`,{headers:{Authorization:`Bearer ${token}`}})}
export function getNetworkGroups(token:string){return request<{groups:NetworkGroup[]}>('/network/groups',{headers:{Authorization:`Bearer ${token}`}})}
export function createNetworkGroup(input:{name:string;description:string;visibility:'public'|'private'},token:string){return request<{group:NetworkGroup}>('/network/groups',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify(input)})}
export function updateNetworkGroup(id:string,input:{name:string;description:string;visibility:'public'|'private'},token:string){return request<{group:NetworkGroup}>(`/network/groups/${encodeURIComponent(id)}`,{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify(input)})}
export type NetworkGroupDetail={group:NetworkGroup;members:{profile:UserProfile;role:string}[]};
export function getNetworkGroup(idOrSlug:string,token:string){return request<NetworkGroupDetail>(`/network/groups/${encodeURIComponent(idOrSlug)}`,{headers:{Authorization:`Bearer ${token}`}})}
export function joinNetworkGroup(id:string,token:string){return request<{ok:boolean}>(`/network/groups/${encodeURIComponent(id)}/join`,{method:'POST',headers:{Authorization:`Bearer ${token}`}})}
export function leaveNetworkGroup(id:string,token:string){return request<{ok:boolean}>(`/network/groups/${encodeURIComponent(id)}/join`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}
export function createNetworkEvent(input:{title:string;description:string;kind:string;startsAt:number;endsAt?:number|null;location?:string;groupId?:string|null},token:string){return request<{event:NetworkEvent}>('/network/events',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify(input)})}
export function joinNetworkEvent(id:string,status:'going'|'interested'|'declined',token:string){return request<{ok:boolean}>(`/network/events/${encodeURIComponent(id)}/rsvp`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({status})})}
export function saveNetworkPost(id:string,saved:boolean,token:string){return request<{saved:boolean}>(`/network/posts/${encodeURIComponent(id)}/save`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({saved})})}
export function getSavedNetworkPosts(token:string){return request<{posts:SocialPost[]}>(`/network/posts/saved`,{headers:{Authorization:`Bearer ${token}`}})}
export function createShiftSwap(input:{date:string;shift:string;requestedShift:string;note?:string},token:string){return request<{swap:ShiftSwap}>('/network/swaps',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify(input)})}
export function claimShiftSwap(id:string,token:string){return request<{ok:boolean}>(`/network/swaps/${encodeURIComponent(id)}/claim`,{method:'POST',headers:{Authorization:`Bearer ${token}`}})}


export type WorkTeam={id:string;name:string;description:string;owner:UserProfile;members:number;role:string;createdAt:number};
export type WorkDocument={id:string;teamId:string;title:string;description:string;url:string;owner:UserProfile;createdAt:number;updatedAt:number};
export function getWorkTeams(token:string){return request<{teams:WorkTeam[]}>('/work/teams',{headers:{Authorization:`Bearer ${token}`}})}
export function createWorkTeam(input:{name:string;description?:string},token:string){return request<{team:WorkTeam}>('/work/teams',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify(input)})}
export function addWorkTeamMember(teamId:string,profileId:string,token:string){return request<{ok:boolean}>(`/work/teams/${encodeURIComponent(teamId)}/members`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({profileId})})}
export function removeWorkTeamMember(teamId:string,profileId:string,token:string){return request<{ok:boolean}>(`/work/teams/${encodeURIComponent(teamId)}/members`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({profileId})})}
export function getWorkDocuments(teamId:string,token:string){return request<{documents:WorkDocument[]}>(`/work/teams/${encodeURIComponent(teamId)}/documents`,{headers:{Authorization:`Bearer ${token}`}})}
export function createWorkDocument(teamId:string,input:{title:string;description?:string;url:string},token:string){return request<{document:WorkDocument}>(`/work/teams/${encodeURIComponent(teamId)}/documents`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify(input)})}
export function deleteWorkDocument(id:string,token:string){return request<{ok:boolean}>(`/work/documents/${encodeURIComponent(id)}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}
