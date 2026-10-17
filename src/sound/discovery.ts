/** Legal, user-initiated audio discovery. No provider login tokens or proxy endpoints. */
export const MAX_REMOTE_BYTES=100*1024*1024;
export const PAGE_SIZE=20;
export const CATALOGS=['audius','jamendo','openverse','commons','archive'] as const;
export const MUSIC_CATALOGS=['audius','jamendo'] as const;
export const ARCHIVE_CATALOGS=['openverse','commons','archive'] as const;
export type Catalog=typeof CATALOGS[number];
export const CATALOG_NAMES:Record<Catalog,string>={audius:'Audius',jamendo:'Jamendo',openverse:'Openverse',commons:'Wikimedia Commons',archive:'Internet Archive'};
export type DiscoveryTrack={
 id:string;catalog:Catalog;title:string;artist:string;album:string;url:string;page:string;
 license:string;licenseUrl:string;attribution:string;size:number|null;mime:string;extension:string;
 artwork?:string;previewUrl?:string;duration?:number|null;genre?:string;downloadable?:boolean;popularity?:number;
};
export type SearchPage={tracks:DiscoveryTrack[];hasMore:boolean};
export type SearchOptions={page?:number;signal?:AbortSignal;jamendoClientId?:string;fetcher?:typeof fetch};
type ObjectMap=Record<string,unknown>;

function obj(value:unknown):ObjectMap{return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as ObjectMap:{}}
function str(value:unknown):string{return typeof value==='string'?value.trim():''}
function positive(value:unknown):number|null{const n=Number(value);return value!==null&&value!==undefined&&Number.isFinite(n)&&n>0?n:null}
function decodeText(value:string):string{return value.replace(/<[^>]*>/g,' ').replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g,m=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'",'&nbsp;':' '}[m]||m)).replace(/\s+/g,' ').trim()}
export function safeUrl(input:unknown):string{
 if(typeof input!=='string'||input.length>4096)return '';
 try{const u=new URL(input);const h=u.hostname.toLowerCase();if(u.protocol!=='https:'||u.username||u.password||!h||h==='localhost'||h.endsWith('.localhost')||h.endsWith('.local')||h.endsWith('.internal')||/^(?:127|10|0|169\.254|192\.168)\./.test(h)||/^172\.(?:1[6-9]|2\d|3[01])\./.test(h)||h==='[::1]'||h==='::1'||/^\d+\.\d+\.\d+\.\d+$/.test(h)&&h.split('.').some(n=>Number(n)>255))return '';return u.href}catch{return ''}
}
function extFromUrl(url:string):string{return /\.(mp3|m4a|aac|ogg|opus|wav|flac|aif|aiff|webm)(?:$|[?#])/i.exec(url)?.[1]?.toLowerCase()||''}
function extension(value:string,mime:string):string{return /^(mp3|m4a|aac|ogg|opus|wav|flac|aif|aiff|webm)$/i.test(value)?value.toLowerCase():({'audio/mpeg':'mp3','audio/mp4':'m4a','audio/ogg':'ogg','audio/wav':'wav','audio/x-wav':'wav','audio/flac':'flac','audio/webm':'webm','audio/aac':'aac'} as Record<string,string>)[mime.toLowerCase()]||'mp3'}
function mimeFromExtension(ext:string):string{return ({mp3:'audio/mpeg',m4a:'audio/mp4',aac:'audio/aac',ogg:'audio/ogg',opus:'audio/ogg',wav:'audio/wav',flac:'audio/flac',aif:'audio/aiff',aiff:'audio/aiff',webm:'audio/webm'} as Record<string,string>)[ext]||'audio/mpeg'}
function pageNumber(value:number|undefined):number{return Math.max(1,Math.min(50,Math.trunc(value||1)))}
async function json(url:string,opts:SearchOptions):Promise<ObjectMap>{
 const response=await (opts.fetcher||fetch)(url,{signal:opts.signal,headers:{Accept:'application/json'}});
 if(!response.ok)throw new Error(response.status===429?'Каталог ограничил число запросов. Попробуйте позже.':`Ошибка каталога: HTTP ${response.status}`);
 return obj(await response.json());
}
function buildUrl(base:string,params:Record<string,string|number>):string{const u=new URL(base);for(const [k,v] of Object.entries(params))u.searchParams.set(k,String(v));return u.href}
function valid(track:DiscoveryTrack):boolean{return Boolean(track.title&&safeUrl(track.page)&&track.size!==0&&(safeUrl(track.url)||safeUrl(track.previewUrl)))}
function uniques(tracks:DiscoveryTrack[]):DiscoveryTrack[]{const seen=new Set<string>();return tracks.filter(t=>{if(!valid(t))return false;const key=t.url.split('#')[0];if(seen.has(key))return false;seen.add(key);return true})}
/** Official Audius public read-only search; downloadable is determined by each artist. */
export async function searchAudius(term:string,opts:SearchOptions={}):Promise<SearchPage>{
 const url=buildUrl('https://api.audius.co/v1/tracks/search',{
  query:term,limit:PAGE_SIZE,offset:(pageNumber(opts.page)-1)*PAGE_SIZE,sort_method:'relevant'
 });
 const response=await json(url,opts);
 const entries=Array.isArray(response.data)?response.data:[],tracks:DiscoveryTrack[]=[];
 for(const raw of entries){
  const t=obj(raw),id=str(t.id),title=str(t.title),user=obj(t.user);
  if(!id||!title||t.is_unlisted===true||t.is_stream_gated===true||t.is_delete===true)continue;
  const gate=obj(t.stream_conditions);
  if(Object.keys(gate).length&&str(gate.type)&&str(gate.type)!=='none')continue;
  const downloadGate=obj(t.download_conditions);
  const gated=Object.keys(downloadGate).length>0&&str(downloadGate.type)!=='none';
  const downloadable=t.is_downloadable===true&&!gated;
  const base='https://api.audius.co/v1/tracks/'+encodeURIComponent(id);
  const artwork=obj(t.artwork);
  const image=safeUrl(artwork['480x480'])||safeUrl(artwork['150x150'])||safeUrl(artwork['1000x1000']);
  const rawLink=str(t.permalink);
  const page=safeUrl(rawLink)||safeUrl('https://audius.co'+(rawLink.startsWith('/')?rawLink:'/tracks/'+encodeURIComponent(id)));
  if(!page)continue;
  const stream=base+'/stream';
  tracks.push({
   id:'audius:'+id,catalog:'audius',title,artist:str(user.name)||str(user.handle)||'Неизвестный исполнитель',
   album:str(t.album_name),url:downloadable?base+'/download':'',previewUrl:stream,
   page,license:str(t.license)||'Права принадлежат автору',licenseUrl:'',attribution:'',
   size:null,mime:'audio/mpeg',extension:'mp3',artwork:image,duration:positive(t.duration),
   genre:str(t.genre),downloadable,popularity:Number(t.play_count)||0
  });
 }
 return {tracks:uniques(tracks),hasMore:entries.length===PAGE_SIZE};
}
export async function searchCommons(term:string,opts:SearchOptions={}):Promise<SearchPage>{
 const page=pageNumber(opts.page),params={action:'query',format:'json',origin:'*',generator:'search',gsrsearch:'filetype:audio '+term,gsrnamespace:'6',gsrlimit:String(PAGE_SIZE),gsroffset:String((page-1)*PAGE_SIZE),prop:'imageinfo',iiprop:'url|mime|size|extmetadata',iilimit:'1'};
 const data=await json(buildUrl('https://commons.wikimedia.org/w/api.php',params),opts),pages=Object.values(obj(obj(data.query).pages)),tracks:DiscoveryTrack[]=[];
 for(const raw of pages){const entry=obj(raw),info=obj(Array.isArray(entry.imageinfo)?entry.imageinfo[0]:null),metadata=obj(info.extmetadata),read=(key:string)=>decodeText(str(obj(metadata[key]).value));
  const url=safeUrl(info.url),mime=str(info.mime);if(!url||!mime.startsWith('audio/'))continue;
  const original=str(entry.title),title=original.replace(/^File:/i,'').replace(/\.[^.]+$/,'').replace(/_/g,' ');
  const licenseUrl=safeUrl(read('LicenseUrl'));
  tracks.push({id:'commons:'+original,catalog:'commons',title,artist:read('Artist')||'Автор указан на странице файла',album:'',url,page:safeUrl(info.descriptionurl)||'https://commons.wikimedia.org/wiki/'+encodeURIComponent(original.replace(/ /g,'_')),license:read('LicenseShortName')||'Проверьте лицензию',licenseUrl,attribution:read('Attribution')||'',size:positive(info.size),mime,extension:extension(extFromUrl(url),mime)});
 }
 return {tracks:uniques(tracks),hasMore:Boolean(obj(data.continue).gsroffset!==undefined||obj(data.continue).gsrcontinue!==undefined)};
}
export async function searchJamendo(term:string,opts:SearchOptions={}):Promise<SearchPage>{
 if(!opts.jamendoClientId?.trim())throw new Error('Для Jamendo нужен VITE_JAMENDO_CLIENT_ID');
 const page=pageNumber(opts.page);
 const url=buildUrl('https://api.jamendo.com/v3.0/tracks/',{client_id:opts.jamendoClientId,format:'json',search:term,limit:PAGE_SIZE,offset:(page-1)*PAGE_SIZE,order:'relevance',type:'single albumtrack',audiodlformat:'mp32'});
 const data=await json(url,opts),headers=obj(data.headers);
 if(headers.status!=='success')throw new Error(str(headers.error_message)||'Каталог Jamendo вернул ошибку');
 const items=Array.isArray(data.results)?data.results:[],tracks:DiscoveryTrack[]=[];
 for(const raw of items){const t=obj(raw),url=safeUrl(t.audiodownload);if(t.audiodownload_allowed!==true||!url)continue;
  const id=str(t.id)||String(t.id||'');
  if(!id||!str(t.name))continue;
  const licenseUrl=safeUrl(t.license_ccurl);
  tracks.push({id:'jamendo:'+id,catalog:'jamendo',title:str(t.name),artist:str(t.artist_name)||'Исполнитель не указан',album:str(t.album_name),url,page:safeUrl(t.shareurl)||'https://www.jamendo.com/track/'+encodeURIComponent(id),license:licenseUrl?'Creative Commons':'Проверьте лицензию',licenseUrl,attribution:'',size:null,mime:'audio/mpeg',extension:'mp3',artwork:safeUrl(t.image)||safeUrl(t.album_image),previewUrl:safeUrl(t.audio),duration:positive(t.duration),genre:str(obj(t.musicinfo).genre)||str(t.genre),downloadable:true});
 }
 return {tracks:uniques(tracks),hasMore:items.length===PAGE_SIZE};
}
export async function searchOpenverse(term:string,opts:SearchOptions={}):Promise<SearchPage>{
 const data=await json(buildUrl('https://api.openverse.org/v1/audio/',{q:term,page:pageNumber(opts.page),page_size:PAGE_SIZE,mature:'false',filter_dead:'true'}),opts);
 const tracks:DiscoveryTrack[]=[];
 for(const raw of Array.isArray(data.results)?data.results:[]){const t=obj(raw);if(t.mature===true)continue;
  const url=safeUrl(t.url),page=safeUrl(t.foreign_landing_url)||safeUrl(t.detail_url),id=str(t.id);if(!url||!page||!id)continue;
  const rawExt=str(t.filetype).replace(/^\./,'').toLowerCase()||extFromUrl(url),mime=rawExt.startsWith('audio/')?rawExt:mimeFromExtension(rawExt),ext=extension(rawExt,mime);
  const size=positive(t.filesize);const licenseUrl=safeUrl(t.license_url),license=str(t.license).toUpperCase();
  if(!license&& !licenseUrl)continue;
  tracks.push({id:'openverse:'+id,catalog:'openverse',title:str(t.title)||'Без названия',artist:str(t.creator)||'Автор не указан',album:'',url,page,license:license||'См. лицензию',licenseUrl,attribution:str(t.attribution),size,mime,extension:ext,artwork:safeUrl(t.thumbnail),previewUrl:url,duration:positive(t.duration),downloadable:true});
 }
 return {tracks:uniques(tracks),hasMore:Boolean(data.next)};
}
const CC_URL=/^https:\/\/creativecommons\.org\/(?:licenses\/|publicdomain\/)/i;
function licensedArchiveUrl(value:unknown):string{const raw=Array.isArray(value)?value[0]:value;const normalized=typeof raw==='string'?raw.replace(/^http:\/\/creativecommons\.org\//i,'https://creativecommons.org/'):raw;const u=safeUrl(normalized);return CC_URL.test(u)?u:''}
export async function searchArchive(term:string,opts:SearchOptions={}):Promise<SearchPage>{
 // A listing is not proof of license. Download only metadata-confirmed CC/CC0 recordings.
 const words=term.replace(/[^\p{L}\p{N}\s_-]/gu,' ').trim().slice(0,150).split(/\s+/).filter(Boolean);
 const phrase=words.map(w=>w.replace(/[-_]/g,' ')).join(' ');
 if(!phrase)return {tracks:[],hasMore:false};
 const query='mediatype:audio AND ('+phrase.split(' ').map(w=>'('+w+'*)').join(' AND ')+')';
 const data=await json(buildUrl('https://archive.org/advancedsearch.php',{q:query,rows:PAGE_SIZE,page:pageNumber(opts.page),output:'json','fl[]':'identifier,title,creator'}),opts);
 const items=Array.isArray(obj(data.response).docs)?obj(data.response).docs as unknown[]:[];
 const found=Number(obj(data.response).numFound)||0,tracks:DiscoveryTrack[]=[];
 // Concurrency bounded: Archive metadata is per item; do not flood its API.
 for(let i=0;i<items.length;i+=4){
  const batch=await Promise.all(items.slice(i,i+4).map(async raw=>{
   const item=obj(raw),id=str(item.identifier);if(!/^[A-Za-z0-9_-]{1,120}$/.test(id))return null;
   try{
    const details=await json('https://archive.org/metadata/'+encodeURIComponent(id),opts);
    const metadata=obj(details.metadata),licenseUrl=licensedArchiveUrl(metadata.licenseurl);
    if(!licenseUrl)return null;
    const files=Array.isArray(details.files)?details.files.map(obj):[];
    const playable=files.filter(f=>{
     const name=str(f.name),size=positive(f.size),format=str(f.format).toLowerCase();
     return str(f.source)==='original'&&Boolean(size&&size<=MAX_REMOTE_BYTES)&&/\.(mp3|m4a|ogg|opus|wav|flac)$/i.test(name)&&!/(spectrogram|metadata|thumbnail|sample|preview)/i.test(format);
    }).sort((a,b)=>(Number(a.size)||0)-(Number(b.size)||0))[0];
    if(!playable)return null;
    const fileName=str(playable.name),ext=extFromUrl(fileName),url='https://archive.org/download/'+encodeURIComponent(id)+'/'+fileName.split('/').map(encodeURIComponent).join('/');
    const artist=Array.isArray(metadata.creator)?str(metadata.creator[0]):str(metadata.creator);
    return {id:'archive:'+id+':'+fileName,catalog:'archive' as Catalog,title:str(metadata.title)||str(item.title)||fileName.replace(/\.[^.]+$/,''),artist:artist||'Автор не указан',album:'',url,page:'https://archive.org/details/'+encodeURIComponent(id),license:'Creative Commons / Public Domain',licenseUrl,attribution:'',size:positive(playable.size),mime:mimeFromExtension(ext),extension:extension(ext,mimeFromExtension(ext)),artwork:'https://archive.org/services/img/'+encodeURIComponent(id),previewUrl:url,duration:positive(playable.length),downloadable:true} satisfies DiscoveryTrack;
   }catch(error){if(opts.signal?.aborted)throw error;return null}
  }));
  for(const t of batch)if(t)tracks.push(t);
 }
 return {tracks:uniques(tracks),hasMore:pageNumber(opts.page)*PAGE_SIZE<found};
}
export async function searchCatalog(catalog:Catalog,term:string,opts:SearchOptions={}):Promise<SearchPage>{
 const q=term.trim().slice(0,200);
 if(q.length<2)return {tracks:[],hasMore:false};
 if(catalog==='audius')return searchAudius(q,opts);
 if(catalog==='commons')return searchCommons(q,opts);
 if(catalog==='jamendo')return searchJamendo(q,opts);
 if(catalog==='openverse')return searchOpenverse(q,opts);
 return searchArchive(q,opts);
}
export type SearchAll={tracks:DiscoveryTrack[];hasMore:boolean;errors:string[]};
export async function searchSources(term:string,sources:readonly Catalog[],opts:SearchOptions={}):Promise<SearchAll>{
 const available=sources.filter(c=>c!=='jamendo'||Boolean(opts.jamendoClientId));
 const results=await Promise.allSettled(available.map(c=>searchCatalog(c,term,opts)));
 if(opts.signal?.aborted)throw new DOMException('Cancelled','AbortError');
 const tracks:DiscoveryTrack[]=[],errors:string[]=[];let hasMore=false;
 for(let i=0;i<results.length;i++){const result=results[i];if(result.status==='fulfilled'){tracks.push(...result.value.tracks);hasMore=hasMore||result.value.hasMore}else errors.push(CATALOG_NAMES[available[i]]+': '+(result.reason instanceof Error?result.reason.message:String(result.reason)))}
 return {tracks:uniques(tracks),hasMore,errors};
}
export const searchAll=(term:string,opts:SearchOptions={})=>searchSources(term,CATALOGS,opts);
export const searchMusic=(term:string,opts:SearchOptions={})=>searchSources(term,MUSIC_CATALOGS,opts);
export const searchArchives=(term:string,opts:SearchOptions={})=>searchSources(term,ARCHIVE_CATALOGS,opts);
export async function downloadDiscoveryTrack(track:DiscoveryTrack,opts:{signal?:AbortSignal;onProgress?:(received:number,total:number|null)=>void;fetcher?:typeof fetch}={}):Promise<File>{
 if(track.downloadable===false)throw new Error('Автор не разрешил скачивание этого трека. Используйте предпрослушивание или откройте страницу автора.');
 if(!safeUrl(track.url))throw new Error('Небезопасный адрес аудиофайла');
 if(track.size!==null&&track.size>MAX_REMOTE_BYTES)throw new Error('Размер файла превышает 100 МБ');
 const response=await (opts.fetcher||fetch)(track.url,{signal:opts.signal});
 if(!response.ok)throw new Error('Скачивание не удалось (HTTP '+response.status+')');
 if(response.url&&!safeUrl(response.url))throw new Error('Скачивание перенаправлено на небезопасный адрес');
 const headerSize=positive(response.headers.get('content-length'));
 if(headerSize!==null&&headerSize>MAX_REMOTE_BYTES)throw new Error('Размер файла превышает 100 МБ');
 const contentType=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
 if(contentType&&!(contentType.startsWith('audio/')||contentType==='application/octet-stream'||contentType==='binary/octet-stream'||contentType==='application/x-flac'))throw new Error('Источник вернул не аудиофайл ('+contentType+')');
 const reader=response.body?.getReader();if(!reader)throw new Error('Потоковое скачивание не поддерживается');
 const chunks:Uint8Array[]=[];let received=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;if(!value)continue;received+=value.byteLength;if(received>MAX_REMOTE_BYTES){await reader.cancel();throw new Error('Размер файла превышает 100 МБ')}chunks.push(value);opts.onProgress?.(received,headerSize)}}finally{reader.releaseLock()}
 if(!received)throw new Error('Источник вернул пустой аудиофайл');
 const name=(track.artist+' - '+track.title).replace(/[\\/<>:"|?*\x00-\x1f]/g,'_').trim().slice(0,175)||'Audio';
 const ext=extension(track.extension,track.mime);
 return new File(chunks as unknown as BlobPart[],name+'.'+ext,{type:contentType.startsWith('audio/')?contentType:track.mime});
}
