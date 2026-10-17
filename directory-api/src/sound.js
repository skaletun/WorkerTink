const MAX_IMPORT_BYTES=8_000_000,MAX_AUDIO_BYTES=50*1024*1024;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clean=(value,max=300)=>String(value||'').trim().slice(0,max);
class SoundError extends Error{constructor(message,status=400){super(message);this.status=status}}
export function parseProviderURL(provider,raw){
 let url;try{url=new URL(raw)}catch{throw new SoundError('Введите корректную ссылку на плейлист')}
 if(url.protocol!=='https:'||url.username||url.password||url.port)throw new SoundError('Нужна HTTPS-ссылка на плейлист');
 if(provider==='yandex'){
  if(!['music.yandex.ru','music.yandex.com','music.yandex.by','music.yandex.kz','music.yandex.uz'].includes(url.hostname))throw new SoundError('Укажите ссылку Яндекс Музыки');
  const old=url.pathname.match(/^\/users\/([\w.@-]{1,160})\/playlists\/(\d{1,16})\/?$/);
  if(old)return {url:`https://api.music.yandex.net/users/${encodeURIComponent(old[1])}/playlists/${old[2]}`,canonical:url.origin+url.pathname};
  const modern=url.pathname.match(/^\/playlists\/([\w-]{8,120})\/?$/);
  if(modern)return {url:`https://api.music.yandex.net/playlist/${encodeURIComponent(modern[1])}`,canonical:url.origin+url.pathname};
  throw new SoundError('Нужна ссылка на плейлист Яндекс Музыки');
 }
 if(provider==='vk'){
  if(!['vk.com','m.vk.com','vk.ru','m.vk.ru'].includes(url.hostname))throw new SoundError('Укажите ссылку ВК');
  const path=url.searchParams.get('z')||url.pathname;
  const match=path.match(/(?:audio_playlist|music\/playlist\/)(-?\d{1,16})_(\d{1,16})(?:_([\w-]{1,100}))?/);
  if(!match)throw new SoundError('Нужна ссылка на плейлист ВК');
  return {ownerId:match[1],albumId:match[2],accessKey:match[3]||'',canonical:url.origin+url.pathname+url.search};
 }
 throw new SoundError('Выберите ВК или Яндекс Музыку');
}
async function readLimited(response,max){
 const length=Number(response.headers.get('content-length'));if(length>max)throw new SoundError('Список слишком большой',413);
 const reader=response.body?.getReader();if(!reader)throw new SoundError('Провайдер вернул пустой ответ',502);
 let size=0;const decoder=new TextDecoder();let text='';try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new SoundError('Список слишком большой',413)}text+=decoder.decode(value,{stream:true})}text+=decoder.decode();return JSON.parse(text)}catch(e){if(e instanceof SoundError)throw e;throw new SoundError('Провайдер не вернул список. Используйте импорт из файла',502)}finally{reader.releaseLock()}
}
export async function fetchProviderPlaylist(provider,raw,env,fetcher=fetch){
 const target=parseProviderURL(provider,raw);let data;
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
 try{
  if(provider==='vk'){
   if(!env.WTSOUND_VK_TOKEN)throw new SoundError('Доступ к VK Audio API не настроен. Перенесите плейлист из файла',503);
   const payload=new URLSearchParams({owner_id:target.ownerId,album_id:target.albumId,access_key:target.accessKey,count:'1000',offset:'0',v:'5.199',access_token:env.WTSOUND_VK_TOKEN});
   const items=[];let count=1;
   for(let offset=0;offset<count;offset+=1000){
    payload.set('offset',String(offset));const response=await fetcher('https://api.vk.com/method/audio.get',{method:'POST',body:payload,signal:controller.signal,redirect:'error'});
    if(!response.ok)throw new SoundError('ВК временно недоступен. Повторите позже или используйте файл',502);
    const page=await readLimited(response,MAX_IMPORT_BYTES);if(page.error)throw new SoundError('ВК не разрешил чтение плейлиста. Проверьте доступ или используйте файл',502);
    count=Number(page.response?.count)||0;if(count>10000)throw new SoundError('Максимум 10 000 треков в плейлисте',413);
    const batch=page.response?.items;if(!Array.isArray(batch))throw new SoundError('Некорректный ответ ВК',502);items.push(...batch);if(batch.length===0)break;
   }
   data={title:'Плейлист ВК',tracks:items};
  }else{
   const response=await fetcher(target.url,{headers:{Accept:'application/json'},signal:controller.signal,redirect:'error'});
   if(!response.ok)throw new SoundError('Яндекс Музыка не открыла плейлист. Проверьте его публичность или используйте файл',502);
   const json=await readLimited(response,MAX_IMPORT_BYTES);data=json.result;
   if(!data||json.error)throw new SoundError('Яндекс Музыка не открыла плейлист. Используйте импорт из файла',502);
   if(data.trackCount>10000||data.tracks?.length<data.trackCount)throw new SoundError('Провайдер вернул неполный список. Используйте полный экспорт из файла',422);
  }
 }catch(e){if(e instanceof SoundError)throw e;throw new SoundError('Не удалось подключиться к музыкальному сервису. Используйте импорт из файла',502)}finally{clearTimeout(timeout)}
 if(!Array.isArray(data.tracks)||data.tracks.length>10000)throw new SoundError('Некорректный список треков',502);
 const tracks=data.tracks.map(entry=>{const t=entry.track||entry;return {title:clean(t.title),artist:clean(t.artist||t.artists?.map(a=>a.name).join(', ')),album:clean(t.albums?.[0]?.title),duration:Math.max(0,Number(t.durationMs)/1000||Number(t.duration)||0),sourceId:clean(t.id,100)}});
 if(!tracks.length)throw new SoundError('Плейлист пуст или недоступен',422);
 if(tracks.some(t=>!t.title||!t.artist))throw new SoundError('Некоторые записи недоступны. Используйте полный экспорт из файла',422);
 return {title:clean(data.title,200)||'Перенесённый плейлист',provider,url:target.canonical,tracks};
}
async function uploadBody(request,limit){
 const reader=request.body?.getReader();if(!reader)throw new SoundError('Аудиофайл пуст');
 let size=0;const chunks=[];try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new SoundError('В облако можно загрузить трек размером до 50 МБ',413)}chunks.push(value)}}finally{reader.releaseLock()}
 if(!size)throw new SoundError('Аудиофайл пуст');const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}return bytes;
}
export async function handleSound(request,env,{path,origin,authProfile,json}){
 const owner=await authProfile(request,env);if(!owner)return json({error:'UNAUTHORIZED'},401,origin);
 try{
  if(path==='/sound/capabilities'&&request.method==='GET')return json({cloud:Boolean(env.SOUND_BUCKET),vk:false,yandex:false},200,origin);
  if(path==='/sound/import'&&request.method==='POST')return json({error:'Перенос музыки — В разработке'},503,origin);
  if(path==='/sound/tracks'&&request.method==='GET'){
   const rows=await env.DB.prepare('SELECT id,metadata,size,mime,created_at FROM sound_tracks WHERE owner_id=?1 ORDER BY created_at DESC LIMIT 10000').bind(owner.wtink_id).all();
   return json({tracks:(rows.results||[]).map(row=>({...JSON.parse(row.metadata),id:row.id,size:row.size,mime:row.mime,addedAt:row.created_at,liked:false,plays:0,lastPlayed:0,cloud:true}))},200,origin);
  }
  const match=path.match(/^\/sound\/tracks\/([^/]+)(\/audio)?$/);if(!match||!UUID.test(match[1]))return json({error:'NOT_FOUND'},404,origin);
  const id=match[1],key=`${owner.wtink_id}/${id}`;
  if(match[2]&&request.method==='PUT'){
   if(!env.SOUND_BUCKET)throw new SoundError('Облачное хранение WTSound не подключено',503);
   if(Number(request.headers.get('content-length'))>MAX_AUDIO_BYTES)throw new SoundError('Максимум 50 МБ для облачного трека',413);
   const mime=request.headers.get('content-type')?.split(';')[0]||'';if(!/^audio\/[a-zA-Z0-9.+-]+$/.test(mime))throw new SoundError('Нужен аудиофайл');
   let input;try{const header=request.headers.get('X-WTSound-Metadata')||'';if(header.length>12000)throw new Error();input=JSON.parse(decodeURIComponent(header))}catch{throw new SoundError('Некорректные теги трека')}
   const metadata={title:clean(input.title),artist:clean(input.artist),album:clean(input.album),genre:clean(input.genre,100),year:Math.max(0,Math.min(9999,Number(input.year)||0)),duration:Math.max(0,Math.min(86400,Number(input.duration)||0)),fileHash:/^[a-f0-9]{64}$/.test(input.fileHash)?input.fileHash:'',fileName:clean(input.fileName,255)};
   if(!metadata.title||!metadata.artist)throw new SoundError('Укажите название и исполнителя');
   const existing=await env.DB.prepare('SELECT metadata FROM sound_tracks WHERE owner_id=?1 AND id=?2').bind(owner.wtink_id,id).first();
   if(existing){if(metadata.fileHash&&JSON.parse(existing.metadata).fileHash===metadata.fileHash)return json({ok:true,replayed:true},200,origin);throw new SoundError('Этот трек уже сохранён в облаке',409)}
   const quota=await env.DB.prepare('SELECT COUNT(*) AS count,COALESCE(SUM(size),0) AS bytes FROM sound_tracks WHERE owner_id=?1').bind(owner.wtink_id).first();
   const maxBytes=5*1024*1024*1024;
   if(quota.count>=10000||quota.bytes>=maxBytes)throw new SoundError('Лимит облачной коллекции: 10 000 треков и 5 ГБ',413);
   const bytes=await uploadBody(request,Math.min(MAX_AUDIO_BYTES,maxBytes-quota.bytes));
   // Immutable object names keep in-flight streams stable during replacement.
   const objectKey=key+'/'+crypto.randomUUID();
   await env.SOUND_BUCKET.put(objectKey,bytes,{httpMetadata:{contentType:mime}});
   try{await env.DB.prepare('INSERT INTO sound_tracks(id,owner_id,metadata,object_key,size,mime,created_at) VALUES(?1,?2,?3,?4,?5,?6,?7)').bind(id,owner.wtink_id,JSON.stringify(metadata),objectKey,bytes.byteLength,mime,Date.now()).run()}catch(e){await env.SOUND_BUCKET.delete(objectKey);throw e}
   return json({ok:true},201,origin);
  }
  const row=await env.DB.prepare('SELECT object_key,size,mime FROM sound_tracks WHERE owner_id=?1 AND id=?2').bind(owner.wtink_id,id).first();if(!row)return json({error:'NOT_FOUND'},404,origin);
  if(!env.SOUND_BUCKET)throw new SoundError('Облачное хранение WTSound не подключено',503);
  if(match[2]&&request.method==='GET'){
   const object=await env.SOUND_BUCKET.get(row.object_key);if(!object)return json({error:'AUDIO_NOT_FOUND'},404,origin);
   return new Response(object.body,{headers:{'Content-Type':row.mime,'Content-Length':String(row.size),'Cache-Control':'private, no-store','Access-Control-Allow-Origin':origin,'X-Content-Type-Options':'nosniff',Vary:'Origin'}});
  }
  if(!match[2]&&request.method==='DELETE'){
   await env.SOUND_BUCKET.delete(row.object_key);await env.DB.prepare('DELETE FROM sound_tracks WHERE owner_id=?1 AND id=?2').bind(owner.wtink_id,id).run();return json({ok:true},200,origin);
  }
  return json({error:'METHOD_NOT_ALLOWED'},405,origin);
 }catch(e){return json({error:e instanceof SoundError?e.message:'Музыкальный сервис временно недоступен'},e instanceof SoundError?e.status:500,origin)}
}
