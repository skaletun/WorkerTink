import {useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import {Icon} from '../Icon.tsx';
import {useSound} from './SoundProvider.tsx';
import {
 CATALOG_NAMES,MAX_REMOTE_BYTES,downloadDiscoveryTrack,searchAll,searchArchives,searchCatalog,searchMusic,
 type Catalog,type DiscoveryTrack,type SearchAll
} from './discovery.ts';

type SearchSelection='music'|'archives'|'all'|Catalog;
type Request={term:string;source:SearchSelection;page:number};
const CLIENT_ID=(import.meta.env.VITE_JAMENDO_CLIENT_ID as string|undefined)?.trim()||'';
const sources:{id:SearchSelection;name:string}[]=[
 {id:'music',name:'Музыка — Audius и Jamendo'},
 {id:'archives',name:'Свободные записи — каталоги'},
 {id:'all',name:'Все источники'},
 {id:'audius',name:'Audius'},
 {id:'jamendo',name:'Jamendo'},
 {id:'openverse',name:'Openverse'},
 {id:'commons',name:'Wikimedia Commons'},
 {id:'archive',name:'Internet Archive'}
];
const genres=['lofi','ambient','jazz','electronic'];
function readableBytes(value:number|null):string{return value===null?'Размер при загрузке':(value/1024/1024).toFixed(1)+' МБ'}
function formatDuration(value:number|null|undefined):string{
 if(!value||!Number.isFinite(value))return '';
 const seconds=Math.floor(value);
 return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
}
function friendlyError(error:unknown):string{
 if(error instanceof DOMException&&error.name==='AbortError')return 'Скачивание отменено';
 if(error instanceof TypeError)return 'Источник не разрешает скачивание через браузер (CORS) или соединение прервалось. Откройте страницу трека.';
 return error instanceof Error?error.message:String(error);
}
async function find(term:string,source:SearchSelection,options:{page:number;signal:AbortSignal;jamendoClientId:string}):Promise<SearchAll>{
 if(source==='music')return searchMusic(term,options);
 if(source==='archives')return searchArchives(term,options);
 if(source==='all')return searchAll(term,options);
 const page=await searchCatalog(source,term,options);
 return {...page,errors:[]};
}

export default function SoundDiscover(){
 const {controller,busy,online,library}=useSound();
 const [query,setQuery]=useState(''),[source,setSource]=useState<SearchSelection>('music'),[request,setRequest]=useState<Request|null>(null);
 const [results,setResults]=useState<DiscoveryTrack[]>([]),[loading,setLoading]=useState(false),[hasMore,setHasMore]=useState(false);
 const [warnings,setWarnings]=useState<string[]>([]),[error,setError]=useState(''),[added,setAdded]=useState<Record<string,string>>({});
 const [adding,setAdding]=useState(''),[downloaded,setDownloaded]=useState(0),[total,setTotal]=useState<number|null>(null);
 const [preview,setPreview]=useState(''),[previewError,setPreviewError]=useState(''),[onlyDownloads,setOnlyDownloads]=useState(false);
 const downloadAbort=useRef<AbortController|null>(null);
 useEffect(()=>()=>downloadAbort.current?.abort(),[]);
 useEffect(()=>{
  if(!request)return;
  const abort=new AbortController();setLoading(true);setError('');setWarnings([]);
  if(request.page===1){setResults([]);setHasMore(false)}
  find(request.term,request.source,{page:request.page,signal:abort.signal,jamendoClientId:CLIENT_ID}).then(result=>{
   if(abort.signal.aborted)return;
   setResults(current=>{
    const unique=new Map((request.page===1?result.tracks:[...current,...result.tracks]).map(t=>[t.id,t]));
    return [...unique.values()];
   });
   setHasMore(result.hasMore);setWarnings(result.errors);
  }).catch(e=>{if(!abort.signal.aborted)setError(friendlyError(e))}).finally(()=>{if(!abort.signal.aborted)setLoading(false)});
  return ()=>abort.abort();
 },[request]);
 const runSearch=(term:string,nextSource:SearchSelection=source)=>{
  const clean=term.trim();if(clean.length<2||!online)return;
  setPreview('');setPreviewError('');setAdded({});
  setQuery(clean);setRequest({term:clean,source:nextSource,page:1});
 };
 const submit=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();runSearch(query)};
 const changeSource=(value:SearchSelection)=>{
  setSource(value);setPreview('');setPreviewError('');setAdded({});
  if(request)setRequest({term:request.term,source:value,page:1});
 };
 const add=async(track:DiscoveryTrack)=>{
  if(adding||busy||!online||track.downloadable===false)return;
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
 const known=useMemo(()=>new Set(library.tracks.filter(t=>Boolean(t.fileHash)).map(t=>t.source?.id).filter(Boolean)),[library.tracks]);
 const visible=useMemo(()=>results.filter(t=>!onlyDownloads||t.downloadable!==false),[results,onlyDownloads]);
 const activeMode=source==='music'||source==='audius'||source==='jamendo'?'music':source==='archives'||source==='openverse'||source==='commons'||source==='archive'?'archives':'all';
 return <section className="sound-section sound-discover" aria-label="Поиск музыки">
  <div className="sound-discover-hero">
   <div className="sound-discover-hero-copy">
    <span className="sound-discover-overline">WTSOUND / DISCOVER</span>
    <h2>Найди свою музыку.</h2>
    <p>Настоящие треки и исполнители. Слушай онлайн и сохраняй записи, если автор разрешил скачивание.</p>
   </div>
   <div className="sound-discover-hero-mark" aria-hidden="true"><Icon name="sound" size={82}/></div>
  </div>
  <div className="sound-discover-toolbar">
   <form className="sound-discover-form" onSubmit={submit}>
    <label className="sound-discover-query">
     <span className="sound-visually-hidden">Название, исполнитель или жанр</span>
     <Icon name="search" size={20}/>
     <input type="search" value={query} maxLength={200} minLength={2} onChange={e=>setQuery(e.target.value)} placeholder="Название, исполнитель или жанр" required/>
    </label>
    <button className="sound-button sound-primary sound-discover-submit" type="submit" disabled={!online||loading||query.trim().length<2}>Найти музыку</button>
   </form>
   <div className="sound-discover-pills" role="group" aria-label="Режим поиска">
    <button type="button" className={activeMode==='music'?'is-active':''} aria-pressed={activeMode==='music'} onClick={()=>changeSource('music')}>Музыка</button>
    <button type="button" className={activeMode==='archives'?'is-active':''} aria-pressed={activeMode==='archives'} onClick={()=>changeSource('archives')}>Свободные записи</button>
    <button type="button" className={activeMode==='all'?'is-active':''} aria-pressed={activeMode==='all'} onClick={()=>changeSource('all')}>Везде</button>
   </div>
   <div className="sound-discover-options">
    <label>Источник
     <select aria-label="Источник поиска" value={source} onChange={e=>changeSource(e.target.value as SearchSelection)}>
      {sources.map(item=><option value={item.id} key={item.id} disabled={item.id==='jamendo'&&!CLIENT_ID}>{item.name}{item.id==='jamendo'&&!CLIENT_ID?' · нужен ключ':''}</option>)}
     </select>
    </label>
    <label className="sound-discover-download-toggle"><input type="checkbox" checked={onlyDownloads} onChange={e=>setOnlyDownloads(e.target.checked)}/> Только доступные для сохранения</label>
   </div>
  </div>
  {!CLIENT_ID&&<p className="sound-discover-hint">Jamendo подключается отдельно через ключ разработчика. Audius работает без него.</p>}
  {!online&&<p role="status" className="sound-discover-notice">Поиск требует интернет. Сохранённые треки доступны офлайн.</p>}
  {error&&<div className="sound-error" role="alert">{error}</div>}
  {warnings.length>0&&<div className="sound-discover-warnings" role="status">Часть источников сейчас недоступна — показываем остальные.{warnings.map((w,i)=><small key={i}>{w}</small>)}</div>}
  {request&&<div className="sound-discover-summary">
   <div><h3>Результаты <span>«{request.term}»</span></h3><p>{loading?'Ищем музыку…':visible.length+' записей'+(onlyDownloads?' с разрешённым скачиванием':'')}{hasMore&&!loading?' · есть ещё':''}</p></div>
   {loading&&<span className="sound-discover-spinner" role="status">Поиск…</span>}
  </div>}
  {!request&&<div className="sound-discover-empty"><Icon name="sound" size={35}/><h3>Что будем слушать?</h3><p>Попробуй название трека, имя исполнителя или музыкальное настроение.</p><div className="sound-discover-suggestions">{genres.map(name=><button className="sound-button" key={name} type="button" onClick={()=>runSearch(name,'music')}>{name}</button>)}</div></div>}
  {loading&&results.length===0&&<div className="sound-discover-skeleton" role="status" aria-label="Загружаем результаты"><span/><span/><span/></div>}
  {!loading&&request&&visible.length===0&&!error&&<div className="sound-discover-empty"><Icon name="search" size={28}/><h3>Пока ничего не найдено</h3><p>{onlyDownloads&&results.length?'Есть записи, но автор не разрешил их скачивать. Отключи фильтр.':'Попробуй другое написание или переключи источник поиска.'}</p></div>}
  <div className="sound-discover-results">
   {visible.map(track=>{
    const processing=adding===track.id,overLimit=track.size!==null&&track.size>MAX_REMOTE_BYTES;
    const saved=Boolean(known.has(track.id)||added[track.id]);
    const blocked=track.downloadable===false;
    const canPlay=Boolean(track.previewUrl||track.url);
    const showPreview=preview===track.id;
    return <article className="sound-discover-result" key={track.id}>
     <div className="sound-discover-cover">
      <Icon name="sound" size={24}/>
      {track.artwork&&<img src={track.artwork} alt="" loading="lazy" onError={e=>{e.currentTarget.hidden=true}}/>}
     </div>
     <div className="sound-discover-copy">
      <strong title={track.title}>{track.title}</strong>
      <span className="sound-discover-artist" title={track.artist}>{track.artist}{track.album&&<span> · {track.album}</span>}</span>
      <div className="sound-discover-secondary">
       <span className="sound-discover-platform">{CATALOG_NAMES[track.catalog]}</span>
       {track.genre&&<span>{track.genre}</span>}
       {track.license&&track.catalog!=='audius'&&<span>{track.license}</span>}
       {blocked&&<span className="sound-discover-stream-only">Только прослушивание</span>}
      </div>
     </div>
     <span className="sound-discover-duration">{formatDuration(track.duration)||'—'}</span>
     <div className="sound-discover-actions">
      <button className="sound-button sound-discover-play" type="button" disabled={!canPlay} onClick={()=>{setPreview(p=>p===track.id?'':track.id);setPreviewError('')}} aria-label={'Предпрослушивание: '+track.title} title="Предпрослушивание">
       <Icon name="play" size={17}/> <span>{showPreview?'Скрыть':'Слушать'}</span>
      </button>
      <button className="sound-button sound-primary sound-discover-add" type="button"
       disabled={!online||Boolean(busy)||Boolean(adding)||overLimit||blocked||saved}
       onClick={()=>void add(track)}
       title={blocked?'Автор не разрешил скачивание':overLimit?'Файл превышает 100 МБ':''}>
       <Icon name={saved?'check':'plus'} size={17}/>
       {processing?'Скачиваем…':blocked?'Без скачивания':overLimit?'Больше 100 МБ':added[track.id]|| (saved?'Уже в медиатеке':'Добавить в медиатеку')}
      </button>
     </div>
     {showPreview&&<div className="sound-discover-preview">
      <audio controls autoPlay preload="none" src={track.previewUrl||track.url} aria-label={'Прослушать '+track.title} onError={()=>setPreviewError(track.id)}>Браузер не поддерживает аудио.</audio>
      {previewError===track.id&&<small role="status">Поток недоступен в браузере. Можно слушать на сайте источника.</small>}
      <a href={track.page} target="_blank" rel="noopener noreferrer">Открыть оригинал ↗</a>
      {track.licenseUrl&&<a href={track.licenseUrl} target="_blank" rel="noopener noreferrer">Лицензия ↗</a>}
     </div>}
     {processing&&<div className="sound-discover-transfer"><span role="status">Получено {readableBytes(downloaded)} / {readableBytes(total)}</span><button type="button" className="sound-button" onClick={()=>downloadAbort.current?.abort()}>Отмена</button></div>}
    </article>;
   })}
  </div>
  {request&&hasMore&&<button className="sound-button sound-discover-more" type="button" disabled={loading||!online||Boolean(adding)} onClick={()=>setRequest({...request,page:request.page+1})}>{loading?'Загружаем…':'Показать ещё'}</button>}
  {request&&visible.length>0&&<p className="sound-discover-rights">Записи принадлежат авторам. Возможность прослушивания не означает разрешения на скачивание или повторное использование. Условия смотри на странице <a href={visible[0].page} target="_blank" rel="noopener noreferrer">источника</a> каждого трека.</p>}
 </section>;
}
