import {request} from './client.ts';
export type ProfileQrStyle={shape:'Square'|'Rounded'|'Dots';foreground:string;background:string;card:'Minimal'|'Soft'|'Poster'};
export function getProfileQrStyle(profileId:string){
 return request<{style:ProfileQrStyle;updatedAt:number}>(`/profiles/${encodeURIComponent(profileId)}/qr-style`);
}
export function saveProfileQrStyle(style:ProfileQrStyle,token:string){
 return request<{ok:boolean;style:ProfileQrStyle;updatedAt:number}>('/profiles/me/qr-style',{
  method:'PUT',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({style})
 });
}
