import type {ChatServerMessage,GroupChat,GroupChatDetail,GroupChatMessage} from './types.ts';
import type {UserProfile} from '../core.ts';
import {request} from './client.ts';

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
