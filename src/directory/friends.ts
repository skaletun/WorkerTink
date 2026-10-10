import type {DirectoryFriend,RequestResult} from './types.ts';
import type {FriendRequest,UserProfile} from '../core.ts';
import {request} from './client.ts';

export function heartbeatPresence(token:string){return request<{ok:boolean;lastSeen:number}>('/presence/heartbeat',{method:'POST',headers:{Authorization:`Bearer ${token}`}})}

export function getDirectoryFriends(token:string){return request<{friends:DirectoryFriend[]}>('/friends',{headers:{Authorization:`Bearer ${token}`}})}

export function sendFriendRequest(from:UserProfile,to:string,token:string){return request<RequestResult>('/friend-requests',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({from,to})})}

export function getIncoming(profileId:string,token:string){return request<{requests:FriendRequest[]}>(`/friend-requests/incoming?userId=${encodeURIComponent(profileId)}`,{headers:{Authorization:`Bearer ${token}`}})}

export function getOutgoing(profileId:string,token:string){return request<{requests:FriendRequest[]}>(`/friend-requests/outgoing?userId=${encodeURIComponent(profileId)}`,{headers:{Authorization:`Bearer ${token}`}})}

export function respondFriendRequest(id:string,action:'accept'|'decline',token:string){return request<RequestResult>(`/friend-requests/${encodeURIComponent(id)}/${action}`,{method:'POST',headers:{Authorization:`Bearer ${token}`}})}

export function removeFriend(profileId:string,token:string){return request<{ok:boolean}>(`/friends/${encodeURIComponent(profileId)}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}

export function blockProfile(profileId:string,token:string){return request<{ok:boolean}>(`/friends/${encodeURIComponent(profileId)}/block`,{method:'POST',headers:{Authorization:`Bearer ${token}`}})}

export function unblockProfile(profileId:string,token:string){return request<{ok:boolean}>(`/friends/${encodeURIComponent(profileId)}/block`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}
