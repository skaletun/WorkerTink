export type Provider='vk'|'yandex'|'file';
export type Track={id:string;title:string;artist:string;album:string;duration:number;genre:string;year:number;addedAt:number;liked:boolean;plays:number;lastPlayed:number;fileHash?:string;fileName?:string;mime?:string;size?:number;artwork?:string;cloud?:boolean;source?:{provider:Provider;id:string;url?:string}};
export type Playlist={id:string;title:string;description:string;trackIds:string[];createdAt:number;updatedAt:number;source?:{provider:Provider;url?:string}};
export type Equalizer={enabled:boolean;preset:string;gains:number[];preamp:number};
export type Library={tracks:Track[];playlists:Playlist[];eq:Equalizer;volume:number;repeat:'off'|'all'|'one';shuffle:boolean;queue:string[];queueIndex:number;originalQueue:string[];currentId:string;position:number};
export const BANDS=[32,64,125,250,500,1000,2000,4000,8000,16000];
export const PRESETS:Record<string,number[]>={
 'Ровный':[0,0,0,0,0,0,0,0,0,0],
 'Больше баса':[6,5,4,2,0,0,0,0,0,0],
 'Рок':[4,3,1,-1,-2,1,3,4,4,3],
 'Поп':[0,2,3,2,0,-1,0,2,3,2],
 'Электроника':[5,4,1,0,-2,1,0,2,4,5],
 'Вокал':[-3,-2,-1,0,2,4,4,2,0,-1],
 'Джаз':[3,2,0,1,-1,-1,0,2,3,4],
 'Классика':[3,2,1,0,-1,-1,0,2,3,3]
};
export const emptyLibrary=():Library=>({tracks:[],playlists:[],eq:{enabled:false,preset:'Ровный',gains:[...PRESETS['Ровный']],preamp:0},volume:0.8,repeat:'off',shuffle:false,queue:[],queueIndex:0,originalQueue:[],currentId:'',position:0});
export const trackKey=(t:Pick<Track,'title'|'artist'>)=>[t.artist,t.title].map(x=>x.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,' ').trim()).join('\n');
export const formatTime=(value:number)=>{const sec=Math.max(0,Math.floor(Number.isFinite(value)?value:0));return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`};
export function normalizeLibrary(input:Partial<Library>):Library{
 const base=emptyLibrary(),eq=input.eq;
 return {...base,...input,tracks:Array.isArray(input.tracks)?input.tracks:[],playlists:Array.isArray(input.playlists)?input.playlists:[],volume:Number.isFinite(input.volume)?Math.max(0,Math.min(1,input.volume!)):base.volume,position:Number.isFinite(input.position)?Math.max(0,input.position!):0,eq:eq?{enabled:Boolean(eq.enabled),preset:String(eq.preset),gains:BANDS.map((_,i)=>Math.max(-12,Math.min(12,Number(eq.gains?.[i])||0))),preamp:Math.max(-24,Math.min(0,Number(eq.preamp)||0))}:base.eq};
}
export type ImportedTrack={title:string;artist:string;album?:string;duration?:number;sourceId?:string};
export type ImportResult={title:string;tracks:ImportedTrack[];provider:Provider;url?:string};
export function mergeImport(library:Library,input:ImportResult):{library:Library;matched:number;missing:number}{
 if(!input.tracks.length||input.tracks.length>10000)throw new Error('Плейлист должен содержать от 1 до 10 000 треков');
 const tracks=[...library.tracks],ids:string[]=[];let matched=0,missing=0;const byKey=new Map<string,Track[]>();for(const track of tracks){const key=trackKey(track);const entries=byKey.get(key)||[];entries.push(track);byKey.set(key,entries)}
 for(const item of input.tracks){
  const key=trackKey(item);let track=byKey.get(key)?.find(t=>(!item.duration||!t.duration||Math.abs(t.duration-item.duration)<3));
  if(track){if(track.fileHash||track.cloud)matched++;else missing++}else{
   track={id:crypto.randomUUID(),title:item.title.trim().slice(0,300),artist:item.artist.trim().slice(0,300),album:item.album?.slice(0,300)||'',duration:Math.max(0,Number(item.duration)||0),genre:'',year:0,addedAt:Date.now(),liked:false,plays:0,lastPlayed:0,source:{provider:input.provider,id:item.sourceId||key,url:input.url}};
   tracks.push(track);byKey.set(key,[...(byKey.get(key)||[]),track]);missing++;
  }
  ids.push(track.id);
 }
 const now=Date.now();const playlist:Playlist={id:crypto.randomUUID(),title:input.title.slice(0,200)||'Перенесённый плейлист',description:'',trackIds:ids,createdAt:now,updatedAt:now,source:{provider:input.provider,url:input.url}};
 return {library:{...library,tracks,playlists:[playlist,...library.playlists]},matched,missing};
}
/** Quoted CSV, including newlines and doubled quotes. Export URLs are never audio sources. */
function csvRows(text:string,delimiter:string){
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(c===delimiter&&!quoted){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell=''}else cell+=c}
 if(quoted)throw new Error('Незакрытая кавычка в CSV');row.push(cell);if(row.some(x=>x.trim()))rows.push(row);return rows;
}
export function parsePlaylistFile(raw:string,fileName:string,provider:Provider):ImportResult{
 if(raw.length>8_000_000)throw new Error('Размер списка не должен превышать 8 МБ');
 const text=raw.replace(/^\uFEFF/,'').trim();let title=fileName.replace(/\.[^.]+$/,''),items:unknown[]=[];
 if(text.startsWith('{')||text.startsWith('[')){
  let json;try{json=JSON.parse(text)}catch{throw new Error('Файл содержит некорректный JSON')}const data=json.result||json.response||json;
  title=data.title||data.name||title;items=Array.isArray(data)?data:data.tracks||data.items||[];
 }else if(/\.csv$/i.test(fileName)){
  const first=text.split(/\r?\n/)[0],delimiter=first.includes('\t')?'\t':first.split(';').length>first.split(',').length?';':',';
  const rows=csvRows(text,delimiter),header=(rows.shift()||[]).map(x=>x.trim().toLowerCase());
  const index=(names:string[])=>header.findIndex(x=>names.includes(x));
  const ti=index(['title','track','track name','track title','название','трек']),ar=index(['artist','artists','artist name','artist name(s)','исполнитель']),al=index(['album','album name','альбом']);
  if(ti<0||ar<0)throw new Error('CSV должен содержать колонки Title и Artist (Название и Исполнитель)');
  items=rows.map(row=>({title:row[ti],artist:row[ar],album:row[al]||''}));
 }else{
  items=text.split(/\r?\n/).flatMap(line=>{
   const entry=line.trim();if(!entry||entry.startsWith('#')&&!entry.startsWith('#EXTINF:'))return [];
   if(entry.startsWith('#EXTINF:')){const m=entry.match(/^#EXTINF:([\d.-]+),(.*)$/);if(!m)return [];const [artist,...parts]=m[2].split(/\s+[–—-]\s+/);return [{artist:parts.length?artist:'Неизвестный исполнитель',title:parts.length?parts.join(' — '):artist,duration:Math.max(0,Number(m[1])||0)}]}
   if(/^(https?:|file:|[A-Za-z]:[\\/]|\/)/.test(entry)||/\.(mp3|wav|flac|m4a|ogg)$/i.test(entry))return [];
   const [artist,...parts]=entry.split(/\s+[–—-]\s+/);return [{artist:parts.length?artist:'Неизвестный исполнитель',title:parts.length?parts.join(' — '):artist}];
  });
 }
 if(!Array.isArray(items)||items.length>10000)throw new Error('Максимум 10 000 треков в плейлисте');
 const tracks:ImportedTrack[]=items.map((entry:any)=>{
  const t=entry.track||entry;const artists=t.artist||t.artists;
  return {title:String(t.title||t.name||'').trim(),artist:typeof artists==='string'?artists:Array.isArray(artists)?artists.map(a=>typeof a==='string'?a:a.name).join(', '):'',album:typeof t.album==='string'?t.album:t.albums?.[0]?.title||'',duration:Number(t.durationMs)?Number(t.durationMs)/1000:Number(t.duration)||0,sourceId:String(t.id||'')};
 }).filter(t=>t.title&&t.artist);
 if(!tracks.length)throw new Error('В файле не найдены треки с названием и исполнителем');
 return {title:String(title),tracks,provider};
}
export function nextInQueue(queue:string[],currentId:string,repeat:Library['repeat'],direction=1):string|null{
 if(!queue.length)return null;const i=queue.indexOf(currentId);const next=i+direction;
 if(next>=0&&next<queue.length)return queue[next];return repeat==='all'?queue[(next+queue.length)%queue.length]:null;
}
