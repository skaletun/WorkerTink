import {DIRECTORY_URL,request} from '../directory/client.ts';
import type {ImportResult,Provider,Track} from './model.ts';
export const soundCapabilities=(token:string)=>request<{cloud:boolean;yandex:boolean;vk:boolean}>('/sound/capabilities',{headers:{Authorization:`Bearer ${token}`}});
export async function importLink(token:string,provider:Provider,url:string){
 try{return await request<ImportResult>('/sound/import',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({provider,url})})}catch(error){
  const message=error instanceof Error?error.message:String(error);
  if(message==='UNAUTHORIZED'||message==='HTTP_401')throw new Error('Сессия истекла. Войдите в WTinker, чтобы перенести плейлист');
  if(message==='NOT_FOUND'||message.startsWith('HTTP_')||message==='DIRECTORY_NOT_CONFIGURED'||error instanceof TypeError)throw new Error('Перенос по ссылке сейчас недоступен. Используйте файл плейлиста');
  throw error;
 }
}
export async function uploadCloud(token:string,track:Track,blob:Blob){
 const response=await fetch(`${DIRECTORY_URL}/sound/tracks/${encodeURIComponent(track.id)}/audio`,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':track.mime||blob.type||'audio/mpeg','X-WTSound-Metadata':encodeURIComponent(JSON.stringify({title:track.title,artist:track.artist,album:track.album,duration:track.duration,genre:track.genre,year:track.year,fileHash:track.fileHash,fileName:track.fileName}))},body:blob});
 if(!response.ok)throw new Error((await response.json().catch(()=>({}))).error||'Не удалось загрузить трек в облако');
}
export async function downloadCloud(token:string,id:string){const response=await fetch(`${DIRECTORY_URL}/sound/tracks/${encodeURIComponent(id)}/audio`,{headers:{Authorization:`Bearer ${token}`}});if(!response.ok)throw new Error('Не удалось скачать трек из облака');return response.blob()}
export const cloudTracks=(token:string)=>request<{tracks:Track[]}>('/sound/tracks',{headers:{Authorization:`Bearer ${token}`}});
export const deleteCloud=(token:string,id:string)=>request('/sound/tracks/'+encodeURIComponent(id),{method:'DELETE',headers:{Authorization:`Bearer ${token}`}});
