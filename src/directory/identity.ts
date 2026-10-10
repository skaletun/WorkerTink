import type {SearchResult,VerificationRequest,RegisterResult,SetupData,LoginResult,AuthSession,OnePassDevice} from './types.ts';
import type {UserProfile} from '../core.ts';
import {request} from './client.ts';

export function searchUser(profileId:string){return request<SearchResult>(`/profiles/${encodeURIComponent(profileId.trim())}`)}

export function getUserByUsername(username:string){return request<SearchResult>(`/user?username=${encodeURIComponent(username.replace(/^@/,''))}`)}

export function getOwnVerificationStatus(token:string){return request<{status:'none'|'pending'|'approved'|'rejected';requestId:string|null}>(`/verification/status`,{headers:{Authorization:`Bearer ${token}`}})}

export function submitVerificationRequest(note:string,token:string){return request<{request:VerificationRequest}>(`/verification/request`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({note})})}

export function checkUsername(username:string){return request<{valid:boolean;available:boolean}>(`/username/check?username=${encodeURIComponent(username.replace(/^@/,''))}`)}

export function updateUsername(username:string,token:string){return request<SearchResult>('/profiles',{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({profile:{username}})})}

export function registerProfile(profile:UserProfile,pin:string){return request<RegisterResult>('/profiles',{method:'POST',body:JSON.stringify({profile,pin,privacyPolicyVersion:'1.0',termsVersion:'1.0'})})}

export function loginAccount(profileId:string,pin:string,deviceName?:string){return request<LoginResult>('/auth/login',{method:'POST',body:JSON.stringify({profileId,pin,deviceName:deviceName||((navigator as any).userAgentData?.platform||navigator.platform||'Устройство')})})}

export function saveAccountSetup(setup:SetupData,token:string){return request<{ok:boolean;configured:boolean;setup:SetupData}>('/account/setup',{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({setup})})}

export function getAccountSetup(token:string){return request<{configured:boolean;setup:SetupData|null}>('/account/setup',{headers:{Authorization:`Bearer ${token}`}})}

export function setAccountPin(pin:string,token:string){return request<{ok:boolean}>('/auth/pin',{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({pin})})}

export function getAuthSessions(token:string){return request<{sessions:AuthSession[]}>('/auth/sessions',{headers:{Authorization:`Bearer ${token}`}})}

export function revokeAuthSession(sessionId:string,token:string){return request<{ok:boolean}>(`/auth/sessions/${encodeURIComponent(sessionId)}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}

export function getAuthStatus(token:string){return request<{profile:UserProfile;setup:SetupData|null;security:{pinSet:boolean;onePassAvailable:boolean}}>('/auth/status',{headers:{Authorization:`Bearer ${token}`}})}

export function getOnePassOptions(token:string){return request<Record<string,unknown>>('/auth/onepass/register/options',{method:'POST',headers:{Authorization:`Bearer ${token}`}})}

export function verifyOnePassRegistration(response:unknown,token:string,deviceName?:string){return request<{ok:boolean}>('/auth/onepass/register/verify',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({response,deviceName})})}

export function getOnePassAvailability(profileId:string){return request<{available:boolean}>(`/auth/onepass/available?profileId=${encodeURIComponent(profileId)}`,{method:'GET'}).then(x=>x.available)}

export function getOnePassLoginOptions(profileId:string){return request<Record<string,unknown>>(`/auth/onepass/login/options?profileId=${encodeURIComponent(profileId)}`,{method:'GET'})}

export function verifyOnePassLogin(response:unknown,deviceName?:string){return request<LoginResult>('/auth/onepass/login/verify',{method:'POST',body:JSON.stringify({response,deviceName:deviceName||((navigator as any).userAgentData?.platform||navigator.platform||'OnePass устройство')})})}

export function getOnePassDevices(token:string){return request<{devices:OnePassDevice[]}>('/auth/onepass',{headers:{Authorization:`Bearer ${token}`}})}

export function removeOnePassDevice(id:string,token:string){return request<{ok:boolean}>(`/auth/onepass/${encodeURIComponent(id)}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}

export function removeOnePass(token:string){return request<{ok:boolean}>('/auth/onepass',{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}

export function updateProfile(profile:UserProfile,token:string){return request<SearchResult>('/profiles',{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({profile})})}

export function logoutSession(token:string){return request<{ok:boolean}>('/auth/session',{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}

export function deleteProfile(token:string){return request<{ok:boolean}>('/profiles',{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}
