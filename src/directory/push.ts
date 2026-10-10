import type {PushSubscriptionData} from './types.ts';
import {request} from './client.ts';

export function getPushPublicKey(token:string){return request<{publicKey:string}>('/push/public-key',{headers:{Authorization:`Bearer ${token}`}}).then(x=>x.publicKey)}

export function savePushSubscription(subscription:PushSubscriptionData,preferences:unknown,token:string){return request<{ok:boolean}>('/push/subscriptions',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({subscription,preferences})})}

export function removePushSubscription(endpoint:string,token:string){return request<{ok:boolean}>('/push/subscriptions',{method:'DELETE',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({endpoint})})}

export function updatePushPreferences(endpoint:string,preferences:unknown,token:string){return request<{ok:boolean}>('/push/subscriptions/preferences',{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({endpoint,preferences})})}

export function sendPushEvent(to:string,kind:'message'|'friendRequest'|'friendAccepted',token:string){return request<{ok:boolean}>('/push/events',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({to,kind})})}

export function sendTestPush(token:string){return request<{ok:boolean}>('/push/test',{method:'POST',headers:{Authorization:`Bearer ${token}`}})}

export function syncPushReminders(reminders:unknown[],token:string){return request<{ok:boolean}>('/push/reminders',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({reminders})})}
