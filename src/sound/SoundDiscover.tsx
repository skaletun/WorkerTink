import {useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import {Icon} from '../Icon.tsx';
import {useSound} from './SoundProvider.tsx';
import {CATALOGS,CATALOG_NAMES,type Catalog,type DiscoveryTrack} from './discovery.ts';
import {formatTime,trackKey} from './model.ts';

type Selection='all'|Catalog;
type Request={term:string;source:Selection;page:number};
export default function SoundDiscover(){
 const {controller,online,library,playing}=useSound();
 const [query,setQuery]=useState(''),[source,setSource]=useState<Selection>('all'),[request,setRequest]=useState<Request|null>(null);
 const [results,setResults]=useState<DiscoveryTrack[]>([]),[loading,setLoading]=useState(false),[hasMore,setHasMore]=useState(false);
 const [warnings,setWarnings]=useState<string[]>([]),[error,setError]=useState(''),[adding,setAdding]=useState('');
 const [preview,setPreview]=useState(''),[previewError,setPreviewError]=useState('');
 const previewAudio=useRef<HTMLAudioElement|null>(null);
 useEffect(()=>{
  if(playing){previewAudio.current?.pause();setPreview('')}
 },[playing]);
 useEffect(()=>{
  if(!request)return;
  const abort=new AbortController();setLoading(true);setError('');setWarnings([]);
  if(request.page===1){setResults([]);setHasMore(false)}
  controller.search(request.term,request.source==='all'?CATALOGS:[request.source],request.page,abort.signal).then(result=>{
   if(abort.signal.aborted)return;
   setResults(current=>[...new Map((request.page===1?result.tracks:[...current,...result.tracks]).map(t=>[t.id,t])).values()]);
   setHasMore(result.hasMore);setWarnings(result.errors);
  }).catch(e=>{if(!abort.signal.aborted)setError(e instanceof Error?e.message:'Не удалось выполнить поиск')}).finally(()=>{if(!abort.signal.aborted)setLoading(false)});
  return()=>abort.abort();
 },[controller,request]);
 const search=(term:string,nextSource:Selection=source)=>{
  const clean=term.trim();if(clean.length<2||!online)return;
  setPreview('');setPreviewError('');setQuery(clean);setRequest({term:clean,source:nextSource,page:1});
 };
 const submit=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();search(query)};
 const changeSource=(value:Selection)=>{setSource(value);setPreview('');setPreviewError('');if(request)search(request.term,value)};
 const known=useMemo(()=>{const ids=new Set<string>(),durations=new Map<string,number[]>();for(const t of library.tracks){if(t.source?.id)ids.add(t.source.id);const k=trackKey(t);durations.set(k,[...(durations.get(k)||[]),t.duration])}return {ids,durations}},[library.tracks]);
 const add=async(track:DiscoveryTrack)=>{
  if(adding)return;setAdding(track.id);setError('');
  try{await controller.saveCatalog(track)}catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить запись')}finally{setAdding('')}
 };
 const listen=(track:DiscoveryTrack)=>{
  if(preview===track.id){setPreview('');return}
  controller.pause();setPreviewError('');setPreview(track.id);
 };
 return <section className="sound-section sound-discover" aria-label="Поиск музыки">
  <div className="sound-discover-hero">
   <div className="sound-discover-hero-copy">
    <span className="sound-discover-overline">WTSOUND / ПОИСК</span>
    <h2>Найди свою музыку.</h2>
    <p>Треки, исполнители и альбомы из Deezer и iTunes. Сохраняй найденное в свою коллекцию.</p>
   </div>
   <div className="sound-discover-hero-mark" aria-hidden="true"><Icon name="sound" size={82}/></div>
  </div>
  <div className="sound-discover-toolbar">
   <form className="sound-discover-form" onSubmit={submit}>
    <label className="sound-discover-query">
     <span className="sound-visually-hidden">Название или исполнитель</span><Icon name="search" size={20}/>
     <input type="search" value={query} maxLength={200} minLength={2} onChange={e=>setQuery(e.target.value)} placeholder="Название или исполнитель" required/>
    </label>
    <button className="sound-button sound-primary sound-discover-submit" type="submit" disabled={!online||query.trim().length<2}>Найти музыку</button>
   </form>
   <div className="sound-discover-options"><label>Источник
    <select aria-label="Источник поиска" value={source} onChange={e=>changeSource(e.target.value as Selection)}>
     <option value="all">Deezer и iTunes</option><option value="deezer">Deezer</option><option value="itunes">iTunes</option>
    </select>
   </label></div>
  </div>
  <p className="sound-discover-hint">Предпрослушивание — фрагмент записи. В коллекцию сохраняются данные трека и ссылка. Для полного воспроизведения в WTSound прикрепи свой аудиофайл.</p>
  {!online&&<p role="status" className="sound-discover-notice">Для поиска нужен интернет. Загруженная музыка доступна офлайн.</p>}
  {error&&<p className="sound-error" role="alert">{error}</p>}
  {warnings.length>0&&<div className="sound-discover-warnings" role="status">{warnings.length===(source==='all'?2:1)?'Поиск сейчас недоступен. Повтори запрос.':'Один из каталогов недоступен — показываем результаты другого.'}{warnings.map(w=><small key={w}>{w}</small>)}</div>}
  {request&&<div className="sound-discover-summary"><div><h3>Результаты <span>«{request.term}»</span></h3><p>{loading?'Ищем музыку…':results.length+' записей'}{hasMore&&!loading?' · есть ещё':''}</p></div>{loading&&<span role="status">Поиск…</span>}</div>}
  {!request&&<div className="sound-discover-empty"><Icon name="search" size={35}/><h3>Что будем слушать?</h3><p>Введи имя исполнителя или название песни.</p></div>}
  {loading&&results.length===0&&<div className="sound-discover-skeleton" role="status" aria-label="Загружаем результаты"><span/><span/><span/></div>}
  {!loading&&request&&results.length===0&&!error&&warnings.length===0&&<div className="sound-discover-empty"><Icon name="search" size={28}/><h3>Ничего не найдено</h3><p>Уточни название или выбери другой источник.</p></div>}
  <div className="sound-discover-results">
   {results.map(track=>{
    const saved=known.ids.has(track.id)||Boolean(known.durations.get(trackKey(track))?.some(d=>!d||!track.duration||Math.abs(d-track.duration)<3));
    return <article className="sound-discover-result" key={track.id}>
     <div className="sound-discover-cover"><Icon name="sound" size={24}/>{track.artwork&&<img src={track.artwork} alt="" loading="lazy" onError={e=>{e.currentTarget.hidden=true}}/>}</div>
     <div className="sound-discover-copy">
      <strong title={track.title}>{track.title}{track.explicit&&<small aria-label="Ненормативная лексика"> · E</small>}</strong>
      <span className="sound-discover-artist" title={track.artist}>{track.artist}</span>
      <div className="sound-discover-secondary"><span className="sound-discover-platform">{CATALOG_NAMES[track.catalog]}</span>{track.album&&<span>{track.album}</span>}{track.year>0&&<span>{track.year}</span>}</div>
      <a className="sound-discover-origin" href={track.page} target="_blank" rel="noopener noreferrer">{track.catalog==='itunes'?'Открыть в iTunes':'Слушать в Deezer'} ↗</a>
     </div>
     <span className="sound-discover-duration">{track.duration?formatTime(track.duration):'—'}</span>
     <div className="sound-discover-actions">
      <button className="sound-button sound-discover-play" type="button" disabled={!track.previewUrl||!online} onClick={()=>listen(track)} aria-label={'Предпрослушивание: '+track.title}>
       <Icon name={preview===track.id?'pause':'play'} size={17}/><span>{preview===track.id?'Закрыть фрагмент':'Фрагмент'}</span>
      </button>
      <button className="sound-button sound-primary sound-discover-add" type="button" disabled={Boolean(adding)||saved} onClick={()=>void add(track)} title="Сохранить данные трека и ссылку в коллекцию">
       <Icon name={saved?'check':'plus'} size={17}/>{adding===track.id?'Сохраняем…':saved?'В коллекции':'В коллекцию'}
      </button>
     </div>
     {preview===track.id&&<div className="sound-discover-preview">
      <audio ref={previewAudio} controls autoPlay preload="none" src={track.previewUrl} aria-label={'Фрагмент: '+track.title} onError={()=>setPreviewError(track.id)}>Браузер не поддерживает аудио.</audio>
      <small>Аудиофрагмент · {track.catalog==='itunes'?'provided courtesy of iTunes':'Deezer'}</small>
      <a href={track.page} target="_blank" rel="noopener noreferrer">{track.catalog==='itunes'?'Купить в iTunes':'Полная запись в Deezer'} ↗</a>
      {previewError===track.id&&<small role="status">Фрагмент недоступен. Открой запись на сайте сервиса.</small>}
     </div>}
    </article>;
   })}
  </div>
  {request&&hasMore&&<button className="sound-button sound-discover-more" type="button" disabled={loading||!online} onClick={()=>{setPreview('');setRequest({...request,page:request.page+1})}}>{loading?'Загружаем…':'Показать ещё'}</button>}
 </section>;
}
