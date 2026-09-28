import type {FriendRequest, UserProfile} from './core.ts';

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
export type RegisterResult={profile:UserProfile;token:string};
export type RequestResult={request:FriendRequest};

export function searchUser(profileId:string){return request<SearchResult>(`/profiles/${encodeURIComponent(profileId.trim().toUpperCase())}`)}
export function registerProfile(profile:UserProfile){return request<RegisterResult>('/profiles',{method:'POST',body:JSON.stringify({profile})})}
export function updateProfile(profile:UserProfile,token:string){return request<SearchResult>('/profiles',{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({profile})})}
export function sendFriendRequest(from:UserProfile,to:string,token:string){return request<RequestResult>('/friend-requests',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({from,to})})}
export function getIncoming(profileId:string,token:string){return request<{requests:FriendRequest[]}>(`/friend-requests/incoming?userId=${encodeURIComponent(profileId)}`,{headers:{Authorization:`Bearer ${token}`}})}
export function getOutgoing(profileId:string,token:string){return request<{requests:FriendRequest[]}>(`/friend-requests/outgoing?userId=${encodeURIComponent(profileId)}`,{headers:{Authorization:`Bearer ${token}`}})}
export function respondFriendRequest(id:string,action:'accept'|'decline',token:string){return request<RequestResult>(`/friend-requests/${encodeURIComponent(id)}/${action}`,{method:'POST',headers:{Authorization:`Bearer ${token}`}})}
