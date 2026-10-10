import type {CompanyChannel,ChannelRole,ChannelPost,CompanyInvite} from './types.ts';
import {request} from './client.ts';

export function getCompanyChannels(token:string){return request<{channels:CompanyChannel[]}>('/company/channels',{headers:{Authorization:`Bearer ${token}`}})}

export function getCompanyInvites(token:string){return request<{invites:CompanyInvite[]}>('/company/invites',{headers:{Authorization:`Bearer ${token}`}})}

export function createCompanyChannel(input:{name:string;companyName:string;description?:string;slug?:string;visibility?:'public'|'private';icon?:string;accent?:string;cover?:string;topic?:string},token:string){return request<{channel:CompanyChannel}>('/company/channels',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify(input)})}

export function getCompanyChannelLink(slug:string,token:string){return request<{channel:CompanyChannel & {joined:boolean}}>(`/company/channels/link/${encodeURIComponent(slug)}`,{headers:{Authorization:`Bearer ${token}`}})}

export function joinCompanyChannel(id:string,token:string){return request<{ok:boolean}>(`/company/channels/${encodeURIComponent(id)}/join`,{method:'POST',headers:{Authorization:`Bearer ${token}`}})}

export function inviteCompanyChannel(channelId:string,profileId:string,token:string){return request<{ok:boolean;id:string}>(`/company/channels/${encodeURIComponent(channelId)}/invite`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({profileId})})}

export function respondCompanyInvite(id:string,action:'accept'|'decline',token:string){return request<{ok:boolean}>(`/company/invites/${encodeURIComponent(id)}/${action}`,{method:'POST',headers:{Authorization:`Bearer ${token}`}})}

export function getCompanyChannelPosts(channelId:string,token:string){return request<{posts:ChannelPost[]}>(`/company/channels/${encodeURIComponent(channelId)}/posts`,{headers:{Authorization:`Bearer ${token}`}})}

export function updateCompanyChannel(channelId:string,input:{name:string;companyName:string;description:string;visibility:'public'|'private';icon?:string;accent?:string;cover?:string;topic?:string},token:string){return request<{ok:boolean}>(`/company/channels/${encodeURIComponent(channelId)}`,{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify(input)})}

export function deleteCompanyChannel(channelId:string,token:string){return request<{ok:boolean}>(`/company/channels/${encodeURIComponent(channelId)}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}

export function createCompanyChannelPost(channelId:string,body:string,token:string){return request<{ok:boolean;id:string;createdAt:number}>(`/company/channels/${encodeURIComponent(channelId)}/posts`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({body})})}

export function deleteCompanyChannelPost(channelId:string,postId:string,token:string){return request<{ok:boolean}>(`/company/channels/${encodeURIComponent(channelId)}/posts?postId=${encodeURIComponent(postId)}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}

export function getCompanyChannelRoles(channelId:string,token:string){return request<{roles:ChannelRole[]}>(`/company/channels/${encodeURIComponent(channelId)}/roles`,{headers:{Authorization:`Bearer ${token}`}})}

export function createCompanyChannelRole(channelId:string,name:string,permissions:Record<string,boolean>,token:string){return request<{ok:boolean;role:ChannelRole}>(`/company/channels/${encodeURIComponent(channelId)}/roles`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({name,permissions})})}

export function updateCompanyChannelRole(channelId:string,roleId:string,name:string,permissions:Record<string,boolean>,token:string){return request<{ok:boolean}>(`/company/channels/${encodeURIComponent(channelId)}/roles/${encodeURIComponent(roleId)}`,{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({name,permissions})})}

export function transferCompanyChannelOwner(channelId:string,profileId:string,token:string){return request<{ok:boolean}>(`/company/channels/${encodeURIComponent(channelId)}/transfer-owner`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({profileId})})}
