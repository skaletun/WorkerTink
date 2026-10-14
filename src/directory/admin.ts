import type {AdminProfile,VerificationRequest} from './types.ts';
import type {UserProfile} from '../core.ts';
import {request} from './client.ts';

export function getAdminOverview(token:string){return request<{stats:{profiles:number;friendships:number;pendingRequests:number;pendingVerification:number;official:number;verified:number;posts:number;communities:number;channels:number;messages:number;media:number;online:number;activeSessions:number}}>('/admin/overview',{headers:{Authorization:`Bearer ${token}`}})}

export function getAdminVerification(token:string){return request<{requests:VerificationRequest[]}>(`/admin/verification`,{headers:{Authorization:`Bearer ${token}`}})}

export function reviewVerification(id:string,action:'approve'|'reject',token:string,note=''){return request<{ok:boolean;request:VerificationRequest}>(`/admin/verification/${encodeURIComponent(id)}/${action}`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({note})})}

export function setOfficialStatus(profileId:string,official:boolean,token:string){return request<{ok:boolean;profile:UserProfile}>(`/admin/profiles/${encodeURIComponent(profileId)}/official`,{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({official})})}

export function getAdminSpaces(token:string){return request<{communities:unknown[];channels:unknown[]}>(`/admin/spaces`,{headers:{Authorization:`Bearer ${token}`}})}

export function getAdminProfiles(token:string,query='',offset=0){return request<{profiles:AdminProfile[];nextOffset:number|null}>(`/admin/profiles?query=${encodeURIComponent(query)}&offset=${offset}&limit=50`,{headers:{Authorization:`Bearer ${token}`}})}

export function getAdminProfileDetail(profileId:string,token:string){return request<{profile:AdminProfile;stats:{friends:number;requests:number;onePass:number;blocks:number;media:number};devices:{id:string;deviceName:string;deviceType:string;backedUp:boolean;createdAt:number;updatedAt:number}[]}>(`/admin/profiles/${encodeURIComponent(profileId)}`,{headers:{Authorization:`Bearer ${token}`}})}

export function revokeAdminSession(profileId:string,token:string){return request<{ok:boolean}>(`/admin/profiles/${encodeURIComponent(profileId)}/revoke`,{method:'POST',headers:{Authorization:`Bearer ${token}`}})}

export function deleteAdminProfile(profileId:string,token:string){return request<{ok:boolean}>(`/admin/profiles/${encodeURIComponent(profileId)}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}

export type AdminContentPost={id:string;body:string;kind:string;visibility:string;createdAt:number;authorId:string;authorName:string;authorUsername:string|null};
export type AdminAuditEvent={id:string;adminId:string;adminName:string;action:string;targetKind:string;targetId:string;note:string;createdAt:number};
export function getAdminContent(token:string,query='',offset=0){return request<{posts:AdminContentPost[];nextOffset:number|null}>(`/admin/content?query=${encodeURIComponent(query)}&offset=${offset}`,{headers:{Authorization:`Bearer ${token}`}})}
export function deleteAdminPost(id:string,token:string){return request<{ok:boolean}>(`/admin/content/posts/${encodeURIComponent(id)}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}
export function getAdminAudit(token:string){return request<{events:AdminAuditEvent[]}>('/admin/audit',{headers:{Authorization:`Bearer ${token}`}})}
