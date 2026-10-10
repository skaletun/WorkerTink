import type {PostAttachment,ShiftNote,SocialPost,SocialComment,SocialNotification,SocialMessage} from './types.ts';
import {request} from './client.ts';

export function getSocialFeed(token:string,limit=20){return request<{posts:SocialPost[]}>(`/social/feed?limit=${limit}`,{headers:{Authorization:`Bearer ${token}`}})}

export function createSocialPost(body:string,token:string,options?:{kind?:'post'|'announcement'|'question'|'shift';groupId?:string|null;visibility?:'network'|'friends';attachments?:PostAttachment[];shiftNote?:ShiftNote|null}){return request<{ok:boolean;id:string;createdAt:number}>('/social/posts',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({body,...options})})}

export function deleteSocialPost(id:string,token:string){return request<{ok:boolean}>(`/social/posts/${encodeURIComponent(id)}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}

export function toggleSocialLike(id:string,token:string){return request<{liked:boolean;likes:number}>(`/social/posts/${encodeURIComponent(id)}/like`,{method:'POST',headers:{Authorization:`Bearer ${token}`}})}

export function getSocialComments(id:string,token:string){return request<{comments:SocialComment[]}>(`/social/posts/${encodeURIComponent(id)}/comments`,{headers:{Authorization:`Bearer ${token}`}})}

export function addSocialComment(id:string,body:string,token:string){return request<{ok:boolean;id:string;createdAt:number}>(`/social/posts/${encodeURIComponent(id)}/comments`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({body})})}

export function getSocialNotifications(token:string){return request<{unread:number;notifications:SocialNotification[]}>('/social/notifications',{headers:{Authorization:`Bearer ${token}`}})}

export function readSocialNotification(id:string,token:string){return request<{ok:boolean}>(`/social/notifications/${encodeURIComponent(id)}/read`,{method:'POST',headers:{Authorization:`Bearer ${token}`}})}

export function readAllSocialNotifications(token:string){return request<{ok:boolean}>('/social/notifications/read-all',{method:'POST',headers:{Authorization:`Bearer ${token}`}})}

export function getSocialMessages(profileId:string,token:string){return request<{messages:SocialMessage[]}>(`/social/messages/${encodeURIComponent(profileId)}`,{headers:{Authorization:`Bearer ${token}`}})}

export function sendSocialMessage(to:string,body:string,token:string){return request<{ok:boolean;message:SocialMessage}>('/social/messages',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({to,body})})}
