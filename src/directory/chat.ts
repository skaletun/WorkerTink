import type {ChatMute,ChatKey,ChatServerMessage,ChatPin,ChatReaction} from './types';
import {DIRECTORY_URL,request} from './client';

export function putChatKey(publicKey:JsonWebKey,token:string){return request<{ok:boolean;key:ChatKey}>('/chat/keys',{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({publicKey})})}

export function getChatKey(profileId:string,token:string){return request<{key:ChatKey}>(`/chat/keys/${encodeURIComponent(profileId)}`,{headers:{Authorization:`Bearer ${token}`}})}

export function getOwnChatKey(token:string){return request<{key:ChatKey}>('/chat/keys/me',{headers:{Authorization:`Bearer ${token}`}})}

export function getChatMessages(profileId:string,token:string){return request<{messages:ChatServerMessage[]}>(`/chat/messages/${encodeURIComponent(profileId)}`,{headers:{Authorization:`Bearer ${token}`}})}

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
