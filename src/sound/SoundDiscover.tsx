import {useEffect,useRef,useState} from 'react';
import {useSound} from './SoundProvider.tsx';
import {CATALOG_NAMES,MAX_REMOTE_BYTES,downloadDiscoveryTrack,searchAll,searchCatalog,type Catalog,type DiscoveryTrack} from './discovery.ts';

type SearchSelection='all'|Catalog;
type Request={term:string;source:SearchSelection;page:number};
const CLIENT_ID=(import.meta.env.VITE_JAMENDO_CLIENT_ID as string|undefined)?.trim()||'';
const labels:{id:SearchSelection;name:string}[]=[
 {id:'all',name:'Все источники'},{id:'commons',name:'Wikimedia Commons'},
 {id:'openverse',name:'Openverse'},{id:'archive',name:'Internet Archive'},
 {id:'jamendo',name:'Jamendo'}
];
function readableBytes(value:number|null):string{return value===null?'Размер уточняется при загрузке':(value/1024/1024).toFixed(1)+' МБ'}
function friendlyError(error:unknown):string{
 if(error instanceof DOMException&&error.name==='AbortError')return 'Скачивание отменено';
 if(error instanceof TypeError)return 'Сайт не разрешил скачивание из браузера (CORS) или соединение прервалось. Откройте источник и скачайте файл вручную.';
 return error instanceof Error?error.message:String(error);
}
export default function SoundDiscover(){
 const {controller,busy,online,library}=useSound();
 const [query,setQuery]=useState(''),[source,setSource]=useState<SearchSelection>('all'),[request,setRequest]=useState<Request|null>(null);
 const [results,setResults]=useState<DiscoveryTrack[]>([]),[loading,setLoading]=useState(false),[hasMore,setHasMore]=useState(false);
 const [warnings,setWarnings]=useState<string[]>([]),[error,setError]=useState(''),[added,setAdded]=useState<Record<string,string>>({});
 const [adding,setAdding]=useState(''),[downloaded,setDownloaded]=useState(0),[total,setTotal]=useState<number|null>(null);
 const [preview,setPreview]=useState('');const downloadAbort=useRef<AbortController|null>(null);
 useEffect(()=>()=>downloadAbort.current?.abort(),[]);
 useEffect(()=>{
  if(!request)return;
  const abort=new AbortController();setLoading(true);setError('');setWarnings([]);
  if(request.page===1){setResults([]);setHasMore(false)}
  const options={page:request.page,signal:abort.signal,jamendoClientId:CLIENT_ID};
  const work=request.source==='all'?searchAll(request.term,options):searchCatalog(request.source,request.term,options).then(page=>({...page,errors:[] as string[]}));
  work.then(result=>{
   if(abort.signal.aborted)return;
   setResults(current=>{
    const next=request.page===1?result.tracks:[...current,...result.tracks];
    const unique=new Map(next.map(t=>[t.id,t]));
    return [...unique.values()];
   });
   setHasMore(result.hasMore);setWarnings(result.errors);
  }).catch(e=>{if(!abort.signal.aborted)setError(friendlyError(e))}).finally(()=>{if(!abort.signal.aborted)setLoading(false)});
  return ()=>abort.abort();
 },[request]);
 const submit=(event:React.FormEvent<HTMLFormElement>)=>{
  event.preventDefault();const term=query.trim();
  if(term.length<2||!online)return;
  setPreview('');setAdded({});setRequest({term,source,page:1});
 };
 const changeSource=(value:SearchSelection)=>{
  setSource(value);setPreview('');setAdded({});
  if(request)setRequest({term:request.term,source:value,page:1});
 };
 const add=async(track:DiscoveryTrack)=>{
  if(adding||busy||!online)return;
  const abort=new AbortController();downloadAbort.current=abort;setAdding(track.id);setDownloaded(0);setTotal(track.size);setError('');
  try{
   const file=await downloadDiscoveryTrack(track,{signal:abort.signal,onProgress:(n,size)=>{setDownloaded(n);setTotal(size)}});
   if(abort.signal.aborted)throw new DOMException('Cancelled','AbortError');
   const outcome=await controller.upload([file],undefined,{
    title:track.title,artist:track.artist,album:track.album,
    source:{provider:'file',id:track.id,url:track.page},
    license:track.license,licenseUrl:track.licenseUrl,attribution:track.attribution
   });
   if(outcome.failed.length)throw new Error(outcome.failed.join('\n'));
   setAdded(previous=>({...previous,[track.id]:outcome.skipped?'Уже в медиатеке':'Добавлено ✓'}));
  }catch(e){setError(friendlyError(e))}
  finally{downloadAbort.current=null;setAdding('');setDownloaded(0);setTotal(null)}
 };
 const alreadyPresent=(t:DiscoveryTrack)=>library.tracks.some(x=>x.source?.id===t.id&&Boolean(x.fileHash));
 return <section className="sound-section sound-discover" aria-label="Поиск музыки">
  <h2>Музыкальный каталог</h2>
  <p>Поиск аудио с открытыми лицензиями. Можно прослушать запись и сохранить её на устройстве. Учитывайте условия лицензии, включая указание автора и запрет коммерческого использования.</p>
  <form className="sound-discover-form" onSubmit={submit}>
   <label className="sound-discover-query"><span className="sound-visually-hidden">Название, исполнитель или жанр</span>
    <input type="search" value={query} maxLength={200} minLength={2} onChange={e=>setQuery(e.target.value)} placeholder="Название, исполнитель или жанр" required/>
   </label>
   <label className="sound-discover-source"><span className="sound-visually-hidden">Источник поиска</span>
    <select aria-label="Источник поиска" value={source} onChange={e=>changeSource(e.target.value as SearchSelection)}>
     {labels.map(item=><option value={item.id} key={item.id} disabled={item.id==='jamendo'&&!CLIENT_ID}>{item.name}{item.id==='jamendo'&&!CLIENT_ID?' · нужен API ID':''}</option>)}
    </select>
   </label>
   <button className="sound-button sound-primary" type="submit" disabled={!online||loading||query.trim().length<2}>Найти</button>
  </form>
  {!CLIENT_ID&&<p className="sound-discover-hint">Jamendo подключается через VITE_JAMENDO_CLIENT_ID. Остальные каталоги доступны без ключа.</p>}
  {!online&&<p role="status">Для нового поиска и загрузки требуется интернет. Сохранённые треки доступны офлайн.</p>}
  {loading&&<p role="status">Ищем записи…</p>}
  {error&&<p className="sound-error" role="alert">{error}</p>}
  {warnings.length>0&&<div role="status" className="sound-discover-warnings"><p>Некоторые каталоги не ответили. Доступные результаты показаны.</p>{warnings.map((w,i)=><small key={i}>{w}</small>)}</div>}
  {!loading&&request&&results.length===0&&!error&&<p role="status">По запросу ничего не найдено. Попробуйте другое название или каталог.</p>}
  {results.length>0&&<p className="sound-discover-count" role="status">Найдено записей: {results.length}{hasMore?' · есть ещё':''}</p>}
  <div className="sound-discover-results">
   {results.map(track=>{
    const processing=adding===track.id,overLimit=track.size!==null&&track.size>MAX_REMOTE_BYTES;
    const status=added[track.id]||(alreadyPresent(track)?'Уже в медиатеке':'Добавить в медиатеку');
    return <article className="sound-discover-result" key={track.id}>
     <div className="sound-discover-info">
      <strong>{track.title}</strong>
      <small>{CATALOG_NAMES[track.catalog]} · {track.artist}{track.album?' · '+track.album:''}</small>
      <small>{track.license} · {readableBytes(track.size)}</small>
      {track.attribution&&<small className="sound-discover-credit">{track.attribution}</small>}
      <div className="sound-discover-links"><a href={track.page} target="_blank" rel="noopener noreferrer">Оригинал ↗</a>{track.licenseUrl&&<a href={track.licenseUrl} target="_blank" rel="noopener noreferrer">Лицензия ↗</a>}</div>
      {preview===track.id&&<audio controls preload="none" src={track.url} aria-label={'Прослушать '+track.title}>Браузер не поддерживает аудио.</audio>}
     </div>
     <div className="sound-discover-actions">
      <button className="sound-button" type="button" onClick={()=>setPreview(p=>p===track.id?'':track.id)} aria-label={'Предпрослушивание: '+track.title}>{preview===track.id?'Скрыть плеер':'Слушать'}</button>
      <button className="sound-button sound-primary" type="button" disabled={!online||Boolean(busy)||Boolean(adding)||overLimit||Boolean(added[track.id])||alreadyPresent(track)} onClick={()=>void add(track)}>
       {processing?'Скачивание…':overLimit?'Больше 100 МБ':status}
      </button>
      {processing&&<><small role="status">{readableBytes(downloaded)} / {readableBytes(total)}</small><button className="sound-button" onClick={()=>downloadAbort.current?.abort()} type="button">Отмена</button></>}
     </div>
    </article>;
   })}
  </div>
  {request&&hasMore&&<button className="sound-button sound-discover-more" type="button" disabled={loading||!online||Boolean(adding)} onClick={()=>setRequest({...request,page:request.page+1})}>{loading?'Загружаем…':'Показать ещё'}</button>}
 </section>;
}
