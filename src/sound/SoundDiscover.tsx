import {useEffect,useState} from 'react';
import {useSound} from './SoundProvider.tsx';

type Result={title:string;url:string;mime:string;size:number;page:string;license:string;author:string};
const endpoint='https://commons.wikimedia.org/w/api.php';
export async function searchCommons(term:string,signal?:AbortSignal):Promise<Result[]>{
 const q=term.trim();if(q.length<2)return [];
 const params=new URLSearchParams({action:'query',format:'json',origin:'*',generator:'search',gsrsearch:'filetype:audio '+q,gsrnamespace:'6',gsrlimit:'30',prop:'imageinfo',iiprop:'url|mime|size|extmetadata',iilimit:'1'});
 const response=await fetch(endpoint+'?'+params,{signal});if(!response.ok)throw new Error('Каталог Wikimedia Commons временно недоступен');
 const data=await response.json() as {query?:{pages?:Record<string,{title:string;fullurl?:string;imageinfo?:Array<{url:string;mime:string;size:number;descriptionurl?:string;extmetadata?:Record<string,{value?:string}>}>}>}};
 return Object.values(data.query?.pages||{}).flatMap(page=>{
  const info=page.imageinfo?.[0];if(!info||!info.mime?.startsWith('audio/')||!info.url?.startsWith('https://'))return [];
  const meta=info.extmetadata||{};
  const plain=(value?:string)=>value?.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').trim()||'';
  return [{title:page.title.replace(/^File:/,'').replace(/\.[^.]+$/,'').replace(/_/g,' '),url:info.url,mime:info.mime,size:info.size,page:info.descriptionurl||'https://commons.wikimedia.org/wiki/'+encodeURIComponent(page.title.replace(/ /g,'_')),license:plain(meta.LicenseShortName?.value)||'См. условия на странице файла',author:plain(meta.Artist?.value)||'Автор указан в источнике'}];
 });
}
export async function searchJamendo(term:string,signal?:AbortSignal):Promise<Result[]>{
 const clientId=import.meta.env.VITE_JAMENDO_CLIENT_ID as string|undefined;
 if(!clientId)throw new Error('Для Jamendo настройте VITE_JAMENDO_CLIENT_ID');
 const params=new URLSearchParams({client_id:clientId,format:'json',search:term,limit:'30',include:'licenses',order:'relevance'});
 const response=await fetch('https://api.jamendo.com/v3.0/tracks/?'+params,{signal});
 if(!response.ok)throw new Error('Jamendo временно недоступен');
 const data=await response.json() as {headers?:{status?:string;error_message?:string};results?:Array<{id:string;name:string;artist_name:string;audiodownload:string;audiodownload_allowed:boolean;license_ccurl:string}>};
 if(data.headers?.status!=='success')throw new Error(data.headers?.error_message||'Ошибка Jamendo');
 return (data.results||[]).filter(t=>t.audiodownload_allowed&&t.audiodownload?.startsWith('https://')).map(t=>({title:t.name,author:t.artist_name,url:t.audiodownload,mime:'audio/mpeg',size:0,page:'https://www.jamendo.com/track/'+encodeURIComponent(t.id),license:t.license_ccurl||'Условия на странице трека'}));
}
export default function SoundDiscover(){
 const {controller,busy,online}=useSound();
 const [source,setSource]=useState('commons'),[query,setQuery]=useState(''),[submitted,setSubmitted]=useState(''),[results,setResults]=useState<Result[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(''),[adding,setAdding]=useState('');
 useEffect(()=>{if(!submitted)return;const abort=new AbortController();setLoading(true);setError('');setResults([]);
  (source==='jamendo'?searchJamendo(submitted,abort.signal):searchCommons(submitted,abort.signal)).then(setResults).catch(e=>{if(!abort.signal.aborted)setError(String(e instanceof Error?e.message:e))}).finally(()=>{if(!abort.signal.aborted)setLoading(false)});
  return ()=>abort.abort();
 },[submitted,source]);
 const add=async(track:Result)=>{
  setAdding(track.url);setError('');
  try{
   if(track.size>100*1024*1024)throw new Error('Файл больше допустимых 100 МБ');
   const response=await fetch(track.url);if(!response.ok)throw new Error('Не удалось получить аудиофайл с Wikimedia Commons');
   const blob=await response.blob();if(blob.size>100*1024*1024)throw new Error('Файл больше допустимых 100 МБ');
   const extension=source==='jamendo'?'mp3':new URL(track.url).pathname.split('.').pop()?.toLowerCase()||'ogg';
   const file=new File([blob],track.title+'.'+extension,{type:track.mime});
   await controller.upload([file]);
   if(controller.snapshot().error)throw new Error(controller.snapshot().error);
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setAdding('')}
 };
 return <section className="sound-section sound-discover" aria-label="Поиск открытой музыки">
  <h2>Найти музыку</h2><p>Поиск аудиозаписей Wikimedia Commons и Jamendo. Перед использованием проверьте лицензию и автора на странице файла.</p>
  <div className="sound-filters"><label>Источник <select value={source} onChange={e=>setSource(e.target.value)}><option value="commons">Wikimedia Commons</option><option value="jamendo">Jamendo</option></select></label></div><form className="sound-filters" onSubmit={e=>{e.preventDefault();setSubmitted(query.trim())}}>
   <label className="sound-search"><span className="sound-visually-hidden">Название или исполнитель</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Название, исполнитель или жанр" minLength={2} required/></label>
   <button className="sound-button sound-primary" type="submit" disabled={!online||loading||query.trim().length<2}>Найти</button>
  </form>
  {!online&&<p role="status">Для поиска требуется интернет. Сохранённая музыка доступна офлайн.</p>}
  {loading&&<p role="status">Ищем записи…</p>}
  {error&&<p className="sound-error" role="alert">{error}</p>}
  {!loading&&submitted&&!results.length&&!error&&<p role="status">Аудиозаписей по запросу не найдено.</p>}
  <div className="sound-discover-results">{results.map(track=><article className="sound-discover-result" key={track.url}>
   <div><strong>{track.title}</strong><small>{track.author} · {track.license} · {(track.size/1024/1024).toFixed(1)} МБ</small><a href={track.page} target="_blank" rel="noopener noreferrer">Источник и условия лицензии ↗</a></div>
   <button className="sound-button" disabled={Boolean(busy)||Boolean(adding)||track.size>100*1024*1024} onClick={()=>void add(track)}>{adding===track.url?'Добавляем…':'Добавить в медиатеку'}</button>
  </article>)}</div>
 </section>;
}
