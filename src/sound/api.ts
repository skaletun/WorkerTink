import {DIRECTORY_URL,request} from '../directory/client.ts';
import type {Track} from './model.ts';
export const soundCapabilities=(token:string)=>request<{cloud:boolean;yandex:boolean;vk:boolean}>('/sound/capabilities',{headers:{Authorization:`Bearer ${token}`}});
export async function uploadCloud(token:string,track:Track,blob:Blob){
 const response=await fetch(`${DIRECTORY_URL}/sound/tracks/${encodeURIComponent(track.id)}/audio`,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':track.mime||blob.type||'audio/mpeg','X-WTSound-Metadata':encodeURIComponent(JSON.stringify({title:track.title,artist:track.artist,album:track.album,duration:track.duration,genre:track.genre,year:track.year,fileHash:track.fileHash,fileName:track.fileName}))},body:blob});
 if(!response.ok)throw new Error((await response.json().catch(()=>({}))).error||'Не удалось загрузить трек в облако');
}
export async function downloadCloud(token:string,id:string){const response=await fetch(`${DIRECTORY_URL}/sound/tracks/${encodeURIComponent(id)}/audio`,{headers:{Authorization:`Bearer ${token}`}});if(!response.ok)throw new Error('Не удалось скачать трек из облака');return response.blob()}
export const cloudTracks=(token:string)=>request<{tracks:Track[]}>('/sound/tracks',{headers:{Authorization:`Bearer ${token}`}});
export const deleteCloud=(token:string,id:string)=>request('/sound/tracks/'+encodeURIComponent(id),{method:'DELETE',headers:{Authorization:`Bearer ${token}`}});
