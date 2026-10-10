import type {SocialPost,NetworkGroup,NetworkEvent,ShiftSwap,NetworkPerson,NetworkHome,NetworkGroupDetail} from './types.ts';
import {request} from './client.ts';

export function getNetworkHome(token:string){return request<NetworkHome>('/network/home',{headers:{Authorization:`Bearer ${token}`}})}

export function searchNetworkPeople(query:string,token:string){return request<{people:NetworkPerson[]}>(`/network/people?query=${encodeURIComponent(query)}`,{headers:{Authorization:`Bearer ${token}`}})}

export function getNetworkGroups(token:string){return request<{groups:NetworkGroup[]}>('/network/groups',{headers:{Authorization:`Bearer ${token}`}})}

export function createNetworkGroup(input:{name:string;description:string;visibility:'public'|'private';icon?:string;accent?:string;cover?:string;rules?:string},token:string){return request<{group:NetworkGroup}>('/network/groups',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify(input)})}

export function updateNetworkGroup(id:string,input:{name:string;description:string;visibility:'public'|'private';icon?:string;accent?:string;cover?:string;rules?:string},token:string){return request<{group:NetworkGroup}>(`/network/groups/${encodeURIComponent(id)}`,{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify(input)})}

export function deleteNetworkGroup(id:string,token:string){return request<{ok:boolean}>(`/network/groups/${encodeURIComponent(id)}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}

export function getNetworkGroup(idOrSlug:string,token:string){return request<NetworkGroupDetail>(`/network/groups/${encodeURIComponent(idOrSlug)}`,{headers:{Authorization:`Bearer ${token}`}})}

export function joinNetworkGroup(id:string,token:string){return request<{ok:boolean}>(`/network/groups/${encodeURIComponent(id)}/join`,{method:'POST',headers:{Authorization:`Bearer ${token}`}})}

export function leaveNetworkGroup(id:string,token:string){return request<{ok:boolean}>(`/network/groups/${encodeURIComponent(id)}/join`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}

export function createNetworkEvent(input:{title:string;description:string;kind:string;startsAt:number;endsAt?:number|null;location?:string;groupId?:string|null},token:string){return request<{event:NetworkEvent}>('/network/events',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify(input)})}

export function joinNetworkEvent(id:string,status:'going'|'interested'|'declined',token:string){return request<{ok:boolean}>(`/network/events/${encodeURIComponent(id)}/rsvp`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({status})})}

export function saveNetworkPost(id:string,saved:boolean,token:string){return request<{saved:boolean}>(`/network/posts/${encodeURIComponent(id)}/save`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({saved})})}

export function getSavedNetworkPosts(token:string){return request<{posts:SocialPost[]}>(`/network/posts/saved`,{headers:{Authorization:`Bearer ${token}`}})}

export function createShiftSwap(input:{date:string;shift:string;requestedShift:string;note?:string},token:string){return request<{swap:ShiftSwap}>('/network/swaps',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify(input)})}

export function claimShiftSwap(id:string,token:string){return request<{ok:boolean}>(`/network/swaps/${encodeURIComponent(id)}/claim`,{method:'POST',headers:{Authorization:`Bearer ${token}`}})}
