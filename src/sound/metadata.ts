import type {Track} from './model.ts';
const MAX_SIZE=100*1024*1024;
export async function inspectAudio(file:File):Promise<{track:Track;cover?:Blob}>{
 if(!file.size||file.size>MAX_SIZE)throw new Error(`${file.name}: максимальный размер трека — 100 МБ`);
 if(!/\.(mp3|m4a|aac|wav|flac|ogg|opus|aiff|aif|webm)$/i.test(file.name)&&!file.type.startsWith('audio/'))throw new Error(`${file.name}: выберите аудиофайл`);
 const {parseBlob}=await import('music-metadata');
 const metadata=await parseBlob(file,{skipCovers:false,duration:true}).catch(()=>null);
 const fallback=file.name.replace(/\.[^.]+$/,'').split(/\s+[–—-]\s+/);
 const title=metadata?.common.title||((fallback.length>1?fallback.slice(1).join(' — '):fallback[0])||file.name);
 const artist=metadata?.common.artist||(fallback.length>1?fallback[0]:'Неизвестный исполнитель');
 const bytes=await file.arrayBuffer();const digest=await crypto.subtle.digest('SHA-256',bytes);const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 const picture=metadata?.common.picture?.[0];let cover:Blob|undefined;
 if(picture&&picture.data.byteLength<4*1024*1024&&/^image\/(jpeg|png|webp)$/.test(picture.format))cover=new Blob([new Uint8Array(picture.data)],{type:picture.format});
 return {track:{id:crypto.randomUUID(),title:title.slice(0,300),artist:artist.slice(0,300),album:metadata?.common.album?.slice(0,300)||'',genre:metadata?.common.genre?.[0]||'',year:metadata?.common.year||0,duration:metadata?.format.duration||0,addedAt:Date.now(),liked:false,plays:0,lastPlayed:0,fileHash:hash,fileName:file.name,mime:file.type||({wav:'audio/wav',flac:'audio/flac',m4a:'audio/mp4',aac:'audio/aac',ogg:'audio/ogg',opus:'audio/ogg',aiff:'audio/aiff',aif:'audio/aiff',webm:'audio/webm'} as Record<string,string>)[file.name.split('.').pop()!.toLowerCase()]||'audio/mpeg',size:file.size},cover};
}
