export type DesktopNotification={title:string;body?:string;url?:string;tag?:string};
export const isElectronDesktop=typeof navigator!=='undefined' && /Electron\//i.test(navigator.userAgent);
export function desktopNotificationSupported(){return isElectronDesktop && typeof window!=='undefined' && 'Notification' in window;}
export async function requestDesktopNotificationPermission(){
 if(!desktopNotificationSupported()) return 'unsupported' as const;
 const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();
 return permission;
}
export function showDesktopNotification(input:DesktopNotification){
 const bridge=(window as Window & {workertinkDesktop?:{notify?: (payload:DesktopNotification)=>void}}).workertinkDesktop;
 if(isElectronDesktop && bridge?.notify){bridge.notify(input);return true;}
 if(!desktopNotificationSupported() || Notification.permission!=='granted') return false;
 const n=new Notification(input.title,{body:input.body||'',tag:input.tag||undefined,icon:'./icon-192.png'});
 if(input.url)n.onclick=()=>{window.focus();window.location.href=input.url!;};
 return true;
}
