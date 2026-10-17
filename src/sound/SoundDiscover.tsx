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
export default function SoundDiscover(){
 const {controller,busy,offline,library,online}=useSound();
 const [query,setQuery]=useState(''),[submitted,setSubmitted]=useState(''),[results,setResults]=useState<Result[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(''),[adding,setAdding]=useState('');
 useEffect(()=>{if(!submitted)return;const abort=new AbortController();setLoading(true);setError('');setResults([]);
  searchCommons(submitted,abort.signal).then(setResults).catch(e=>{if(!abort.signal.aborted)setError(String(e instanceof Error?e.message:e))}).finally(()=>{if(!abort.signal.aborted)setLoading(false)});
  return ()=>abort.abort();
 },[submitted]);
 const add=async(track:Result)=>{
  setAdding(track.url);setError('');
  try{
   if(track.size>100*1024*1024)throw new Error('Файл больше допустимых 100 МБ');
   const response=await fetch(track.url);if(!response.ok)throw new Error('Не удалось получить аудиофайл с Wikimedia Commons');
   const blob=await response.blob();if(blob.size>100*1024*1024)throw new Error('Файл больше допустимых 100 МБ');
   const extension=new URL(track.url).pathname.split('.').pop()?.toLowerCase()||'ogg';
   const file=new File([blob],track.title+'.'+extension,{type:track.mime});
   await controller.upload([file]);
   if(controller.snapshot().error)throw new Error(controller.snapshot().error);
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setAdding('')}
 };
 return <section className="sound-section sound-discover" aria-label="Поиск открытой музыки">
  <h2>Найти музыку</h2><p>Поиск аудиозаписей Wikimedia Commons. Перед использованием проверьте лицензию и автора на странице файла.</p>
  <form className="sound-filters" onSubmit={e=>{e.preventDefault();setSubmitted(query.trim())}}>
   <label className="sound-search"><span className="sound-visually-hidden">Название или исполнитель</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Название, исполнитель или жанр" minLength={2} required/></label>
   <button className="sound-button sound-primary" type="submit" disabled={!online||loading||query.trim().length<2}>Найти</button>
  </form>
  {!online&&<p role="status">Для поиска требуется интернет. Сохранённая музыка доступна офлайн.</p>}
  {loading&&<p role="status">Ищем записи…</p>}
  {error&&<p className="sound-error" role="alert">{error}</p>}
  {!loading&&submitted&&!results.length&&!error&&<p role="status">Аудиозаписей по запросу не найдено.</p>}
  <div className="sound-discover-results">{results.map(track=><article className="sound-discover-result" key={track.url}>
   <div><strong>{track.title}</strong><small>{track.author} · {track.license} · {(track.size/1024/1024).toFixed(1)} МБ</small><a href={track.page} target="_blank" rel="noopener noreferrer">Источник и условия лицензии ↗</a></div>
   <button className="sound-button" disabled={Boolean(busy)||Boolean(adding)||offline.size>100000||track.size>100*1024*1024} onClick={()=>void add(track)}>{adding===track.url?'Добавляем…':library.tracks.some(t=>t.fileName===track.title+'.'+(track.url.split('.').pop()?.toLowerCase()||'ogg'))?'Добавить ещё':'Добавить в медиатеку'}</button>
  </article>)}</div>
 </section>;
}
