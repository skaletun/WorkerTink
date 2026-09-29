import {directoryConfigured, getPushPublicKey, savePushSubscription, removePushSubscription, updatePushPreferences} from './directory';
import {isElectronDesktop, requestDesktopNotificationPermission} from './desktop';

export type NotificationSettings = {
  enabled:boolean;
  friendRequests:boolean;
  friendAccepted:boolean;
  messages:boolean;
  groupMessages:boolean;
  channelInvites:boolean;
  social:boolean;
  events:boolean;
  shifts:boolean;
  absences:boolean;
  payroll:boolean;
};

export const DEFAULT_NOTIFICATION_SETTINGS:NotificationSettings={
  enabled:true,
  friendRequests:true,
  friendAccepted:true,
  messages:true,
  groupMessages:true,
  channelInvites:true,
  social:true,
  events:true,
  shifts:true,
  absences:true,
  payroll:true,
};

function base64UrlToUint8Array(value:string){
  const padding='='.repeat((4-value.length%4)%4);
  const base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(base64);
  return Uint8Array.from(raw,c=>c.charCodeAt(0));
}

function serializeSubscription(subscription:PushSubscription){
  const json=subscription.toJSON();
  const p256dh=json.keys?.p256dh;
  const auth=json.keys?.auth;
  if(!json.endpoint||!p256dh||!auth)throw new Error('PUSH_SUBSCRIPTION_INVALID');
  return {endpoint:json.endpoint,expirationTime:json.expirationTime??null,keys:{p256dh,auth}};
}

export function pushSupported(){
  return typeof window!=='undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function getPushPermission(){
  if(!pushSupported())return 'unsupported' as const;
  return Notification.permission;
}

export async function enablePush(token:string,settings:NotificationSettings){
  if(isElectronDesktop && !('PushManager' in window)) {
    const permission=await requestDesktopNotificationPermission();
    if(permission!=='granted') throw new Error(permission==='denied'?'PUSH_PERMISSION_DENIED':'PUSH_PERMISSION_DISMISSED');
    return null;
  }
  if(!directoryConfigured||!token)throw new Error('PUSH_NOT_CONFIGURED');
  if(!pushSupported())throw new Error('PUSH_UNSUPPORTED');
  const permission=Notification.permission==='granted'? 'granted' : await Notification.requestPermission();
  if(permission!=='granted')throw new Error(permission==='denied'?'PUSH_PERMISSION_DENIED':'PUSH_PERMISSION_DISMISSED');
  try {
    const registration=await navigator.serviceWorker.ready;
    const publicKey=await getPushPublicKey(token);
    let subscription=await registration.pushManager.getSubscription();
    if(!subscription){
      subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:base64UrlToUint8Array(publicKey)});
    }
    await savePushSubscription(serializeSubscription(subscription),settings,token);
    return subscription;
  } catch(error) {
    if(isElectronDesktop){
      const permission=await requestDesktopNotificationPermission();
      if(permission==='granted') return null;
    }
    throw error;
  }
}

export async function disablePush(token:string){
  if(!pushSupported())return;
  const registration=await navigator.serviceWorker.ready;
  const subscription=await registration.pushManager.getSubscription();
  if(subscription){
    try{await removePushSubscription(subscription.endpoint,token)}catch{/* local unsubscribe still matters */}
    await subscription.unsubscribe();
  }
}

export async function syncPushPreferences(token:string,settings:NotificationSettings){
  if(isElectronDesktop && !('PushManager' in window)) return;

  if(!directoryConfigured||!token)return;
  const registration=await navigator.serviceWorker.ready.catch(()=>null);
  const subscription=registration?await registration.pushManager.getSubscription().catch(()=>null):null;
  if(subscription)await updatePushPreferences(subscription.endpoint,settings,token);
}
