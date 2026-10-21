/** Commercial catalog metadata and promotional previews. Audio is never imported. */
export const PAGE_SIZE=20;
export const CATALOGS=['deezer','itunes'] as const;
export type Catalog=typeof CATALOGS[number];
export const CATALOG_NAMES:Record<Catalog,string>={deezer:'Deezer',itunes:'iTunes'};
export type DiscoveryTrack={id:string;catalog:Catalog;title:string;artist:string;album:string;page:string;artwork:string;previewUrl:string;duration:number;genre:string;year:number;explicit:boolean};
export type SearchPage={tracks:DiscoveryTrack[];hasMore:boolean};
export type CatalogLoader=(catalog:Catalog,term:string,page:number,signal?:AbortSignal)=>Promise<unknown>;
export type SearchOptions={page?:number;signal?:AbortSignal;load:CatalogLoader};
export type SearchAll=SearchPage&{errors:string[]};
type ObjectMap=Record<string,unknown>;
const obj=(v:unknown):ObjectMap=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as ObjectMap:{};
const str=(v:unknown)=>typeof v==='string'?v.trim().slice(0,500):'';
const number=(v:unknown)=>Math.max(0,Number.isFinite(Number(v))?Number(v):0);
export function safeUrl(input:unknown):string{
 if(typeof input!=='string'||input.length>4096)return '';
 try{
  const u=new URL(input),h=u.hostname.toLowerCase();
  if(u.protocol!=='https:'||u.username||u.password||u.port||!h||h==='localhost'||h.endsWith('.localhost')||h.endsWith('.local')||h.endsWith('.internal')||/^(?:127|10|0|169\.254|192\.168)\./.test(h)||/^172\.(?:1[6-9]|2\d|3[01])\./.test(h)||h.startsWith('['))return '';
  return u.href;
 }catch{return ''}
}
function providerUrl(value:unknown,domains:string[]):string{
 const url=safeUrl(value);if(!url)return '';
 const host=new URL(url).hostname;
 return domains.some(domain=>host===domain||host.endsWith('.'+domain))?url:'';
}
export function parseCatalog(catalog:Catalog,input:unknown,page=1):SearchPage{
 const data=obj(input);
 if(data.error)throw new Error('Каталог временно недоступен');
 const entries=catalog==='deezer'?data.data:data.results;
 if(!Array.isArray(entries))throw new Error('Каталог вернул некорректный ответ');
 const tracks:DiscoveryTrack[]=[],seen=new Set<string>();
 // iTunes supports limit (up to 200), but not offset. Slice a growing result window.
 const items=catalog==='itunes'?entries.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE):entries;
 for(const value of items){
  const t=obj(value),album=obj(t.album),artist=obj(t.artist);
  if(catalog==='itunes'&&t.kind!=='song')continue;
  const rawId=catalog==='deezer'?t.id:t.trackId;
  if(!/^\d+$/.test(String(rawId)))continue;
  const id=catalog+':'+rawId,title=str(catalog==='deezer'?t.title:t.trackName),name=str(catalog==='deezer'?artist.name:t.artistName);
  const link=providerUrl(catalog==='deezer'?t.link:t.trackViewUrl,catalog==='deezer'?['deezer.com']:['apple.com']);
  if(!title||!name||!link||seen.has(id))continue;seen.add(id);
  const preview=providerUrl(catalog==='deezer'?t.preview:t.previewUrl,catalog==='deezer'?['dzcdn.net','deezer.com']:['itunes.apple.com','mzstatic.com']);
  const artwork=providerUrl(catalog==='deezer'?album.cover_big||album.cover_medium:t.artworkUrl100,catalog==='deezer'?['dzcdn.net','deezer.com']:['mzstatic.com']);
  tracks.push({id,catalog,title,artist:name,album:str(catalog==='deezer'?album.title:t.collectionName),page:link,previewUrl:preview,artwork,duration:catalog==='deezer'?number(t.duration):number(t.trackTimeMillis)/1000,genre:str(t.primaryGenreName),year:catalog==='itunes'?Number(str(t.releaseDate).slice(0,4))||0:0,explicit:catalog==='deezer'?t.explicit_lyrics===true:t.trackExplicitness==='explicit'});
 }
 return {tracks,hasMore:catalog==='deezer'?number(data.total)>page*PAGE_SIZE:page<10&&entries.length>page*PAGE_SIZE};
}
export async function searchCatalog(catalog:Catalog,term:string,opts:SearchOptions):Promise<SearchPage>{
 const q=term.trim().slice(0,200),page=Math.max(1,Math.min(10,Math.trunc(opts.page||1)));
 if(q.length<2)return {tracks:[],hasMore:false};
 if(!CATALOGS.includes(catalog))throw new Error('Неизвестный музыкальный каталог');
 const data=await opts.load(catalog,q,page,opts.signal);
 if(opts.signal?.aborted)throw new DOMException('Cancelled','AbortError');
 return parseCatalog(catalog,data,page);
}
export async function searchSources(term:string,sources:readonly Catalog[],opts:SearchOptions):Promise<SearchAll>{
 const available=[...new Set(sources)];
 const results=await Promise.allSettled(available.map(c=>searchCatalog(c,term,opts)));
 if(opts.signal?.aborted)throw new DOMException('Cancelled','AbortError');
 const tracks:DiscoveryTrack[]=[],errors:string[]=[];let hasMore=false;
 for(let i=0;i<results.length;i++){
  const result=results[i];
  if(result.status==='fulfilled'){tracks.push(...result.value.tracks);hasMore ||= result.value.hasMore}
  else errors.push(CATALOG_NAMES[available[i]]+': '+(result.reason instanceof Error?result.reason.message:'Не удалось подключиться'));
 }
 // Interleave providers; do not bury the second catalog behind an entire first page.
 const ordered:DiscoveryTrack[]=[];
 for(let row=0;row<PAGE_SIZE;row++)for(const catalog of available){const track=tracks.filter(t=>t.catalog===catalog)[row];if(track)ordered.push(track)}
 return {tracks:ordered,hasMore,errors};
}
