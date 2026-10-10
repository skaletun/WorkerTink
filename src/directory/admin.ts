import type {AdminProfile,VerificationRequest} from './types.ts';
import type {UserProfile} from '../core.ts';
import {request} from './client.ts';

export function getAdminOverview(token:string){return request<{stats:{profiles:number;friendships:number;pendingRequests:number;pendingVerification:number;official:number;verified:number;posts:number;communities:number;channels:number;messages:number;media:number}}>('/admin/overview',{headers:{Authorization:`Bearer ${token}`}})}

export function getAdminVerification(token:string){return request<{requests:VerificationRequest[]}>(`/admin/verification`,{headers:{Authorization:`Bearer ${token}`}})}

export function reviewVerification(id:string,action:'approve'|'reject',token:string,note=''){return request<{ok:boolean;request:VerificationRequest}>(`/admin/verification/${encodeURIComponent(id)}/${action}`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({note})})}

export function setOfficialStatus(profileId:string,official:boolean,token:string){return request<{ok:boolean;profile:UserProfile}>(`/admin/profiles/${encodeURIComponent(profileId)}/official`,{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({official})})}

export function getAdminSpaces(token:string){return request<{communities:unknown[];channels:unknown[]}>(`/admin/spaces`,{headers:{Authorization:`Bearer ${token}`}})}

export function getAdminProfiles(token:string,query=''){return request<{profiles:AdminProfile[]}>(`/admin/profiles?query=${encodeURIComponent(query)}`,{headers:{Authorization:`Bearer ${token}`}})}

export function getAdminProfileDetail(profileId:string,token:string){return request<{profile:AdminProfile;stats:{friends:number;requests:number;onePass:number;blocks:number;media:number};devices:{id:string;deviceName:string;deviceType:string;backedUp:boolean;createdAt:number;updatedAt:number}[]}>(`/admin/profiles/${encodeURIComponent(profileId)}`,{headers:{Authorization:`Bearer ${token}`}})}

export function revokeAdminSession(profileId:string,token:string){return request<{ok:boolean}>(`/admin/profiles/${encodeURIComponent(profileId)}/revoke`,{method:'POST',headers:{Authorization:`Bearer ${token}`}})}

export function deleteAdminProfile(profileId:string,token:string){return request<{ok:boolean}>(`/admin/profiles/${encodeURIComponent(profileId)}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}
