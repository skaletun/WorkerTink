import {useCallback,useEffect,useState} from 'react';
import {Icon} from '../Icon.tsx';
import {useSound} from './SoundProvider.tsx';
import {formatTime} from './model.ts';
import {Cover,SoundButton} from './components.tsx';
import SoundEqualizer from './SoundEqualizer.tsx';

const key='wtsound:miniplayer-collapsed';
export default function SoundPlayer({openLibrary}:{openLibrary:()=>void}){
 const {controller,library,playing,buffering,time,duration,error,offline}=useSound();
 const [expanded,setExpanded]=useState(false),[panel,setPanel]=useState<'queue'|'eq'|null>(null);
 const [collapsed,setCollapsed]=useState(()=>{try{return localStorage.getItem(key)==='1'}catch{return false}});
 const [scrub,setScrub]=useState<number|null>(null);
 const current=library.tracks.find(t=>t.id===library.currentId);
 const close=useCallback(()=>{setExpanded(false);setPanel(null);setScrub(null)},[]);
 useEffect(()=>{try{localStorage.setItem(key,collapsed?'1':'0')}catch{}},[collapsed]);
 useEffect(()=>{
  if(!expanded)return;
  const previous=document.body.style.overflow;document.body.style.overflow='hidden';
  const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();close()}};
  window.addEventListener('keydown',onKey);
  return()=>{document.body.style.overflow=previous;window.removeEventListener('keydown',onKey)};
 },[expanded,close]);
 useEffect(()=>{setScrub(null)},[library.currentId]);
 if(!current)return null;
 const durationValue=Math.max(0,duration||current.duration||0);
 const shownTime=Math.max(0,Math.min(scrub??time,durationValue||0));
 const canChange=library.queue.filter(id=>library.tracks.some(t=>t.id===id&&controller.playable(t))).length>1;
 const action=(job:Promise<unknown>)=>{void job.catch(controller.report)};
 const toggleCollapsed=()=>setCollapsed(v=>!v);
 const stop=()=>{close();setCollapsed(false);action(controller.stop())};
 const back=()=>{if(canChange)action(controller.previous())};
 const next=()=>{if(canChange)action(controller.next())};
 const seekControl=<div className="sound-seek sound-seek-large">
  <span className="sound-seek-elapsed">{formatTime(shownTime)}</span>
  <input type="range" aria-label="Позиция воспроизведения" aria-valuetext={formatTime(shownTime)}
   min={0} max={Math.max(1,durationValue)} step={0.1} value={shownTime} disabled={!durationValue}
   onChange={e=>{const value=Number(e.target.value);setScrub(value);controller.seek(value)}}
   onPointerUp={()=>setScrub(null)} onKeyUp={()=>setScrub(null)} onBlur={()=>setScrub(null)}/>
  <span className="sound-seek-total">{formatTime(durationValue)}</span>
 </div>;
 const playback=<div className="sound-transport sound-transport-large">
  <SoundButton name="shuffle" label="Случайный порядок" active={library.shuffle} onClick={()=>action(controller.settings({shuffle:!library.shuffle}))}/>
  <SoundButton name="previous" label="Предыдущий трек" disabled={!canChange} onClick={back}/>
  <button type="button" className="sound-big-play" aria-label={playing?'Пауза':'Воспроизвести'} onClick={controller.toggle}><Icon name={playing?'pause':'play'} size={32}/></button>
  <SoundButton name="next" label="Следующий трек" disabled={!canChange} onClick={next}/>
  <SoundButton name="repeat" label={`Повтор: ${library.repeat==='off'?'выключен':library.repeat==='one'?'один трек':'все'}`} active={library.repeat!=='off'} onClick={()=>action(controller.settings({repeat:library.repeat==='off'?'all':library.repeat==='all'?'one':'off'}))}/>
  {library.repeat==='one'&&<span className="sound-repeat-one">1</span>}
 </div>;
 return <>
  <aside className={`sound-player sound-player-top ${collapsed?'is-collapsed':''} ${expanded?'is-expanded':''}`} aria-label="Мини-плеер WTSound">
   {collapsed?
    <button type="button" className="sound-mini-restore" aria-label="Показать мини-плеер" onClick={toggleCollapsed} title={current.title}><Icon name={playing?'sound':'play'} size={20}/><span>{playing?'Сейчас играет':'Плеер'}</span><Icon name="chevronDown" size={16}/></button>
   :<>
    <button type="button" className="sound-player-info" onClick={()=>setExpanded(true)} aria-label={`Открыть плеер: ${current.title}`}><Cover track={current}/><span><b>{current.title}</b><small>{buffering?'Загрузка…':current.artist}</small></span></button>
    <div className="sound-mini-controls">
     <SoundButton name="previous" label="Предыдущий трек" disabled={!canChange} onClick={back}/>
     <SoundButton name={playing?'pause':'play'} label={playing?'Пауза':'Воспроизвести'} onClick={controller.toggle}/>
     <SoundButton name="next" label="Следующий трек" disabled={!canChange} onClick={next}/>
    </div>
    <div className="sound-mini-timeline">
     <input type="range" aria-label="Перемотать мини-плеер" min={0} max={Math.max(1,durationValue)} step={0.1}
      value={Math.min(time,durationValue||0)} disabled={!durationValue} onChange={e=>controller.seek(Number(e.target.value))}/>
     <span>{formatTime(time)} / {formatTime(durationValue)}</span>
    </div>
    <button type="button" className="sound-mini-expand" aria-label="Развернуть плеер на весь экран" onClick={()=>setExpanded(true)}><Icon name="chevronDown" size={20}/></button>
    <button type="button" className="sound-mini-collapse" aria-label="Скрыть мини-плеер" onClick={toggleCollapsed}><Icon name="chevronDown" size={18}/></button>
   </>}
   <button type="button" className="sound-mini-close" aria-label="Закрыть плеер и остановить музыку" onClick={stop}><Icon name="close" size={18}/></button>
  </aside>
  {expanded&&<div className="sound-fullscreen" role="dialog" aria-modal="true" aria-label="Полноэкранный плеер WTSound">
   <header className="sound-fullscreen-head">
    <button type="button" aria-label="Свернуть полноэкранный плеер" onClick={close}><Icon name="chevronDown" size={25}/></button>
    <span><Icon name="sound" size={17}/> WTSOUND <small>СЕЙЧАС ИГРАЕТ</small></span>
    <button type="button" aria-label="Закрыть плеер и остановить музыку" onClick={stop}><Icon name="close" size={24}/></button>
   </header>
   <main className="sound-fullscreen-body">
    <div className="sound-full-art"><Cover track={current}/></div>
    <div className="sound-full-meta">
     <div><h2>{current.title}</h2><p>{current.artist}</p></div>
     <SoundButton name="heart" label={current.liked?'Убрать из избранного':'В избранное'} active={current.liked} onClick={()=>action(controller.like(current.id))}/>
    </div>
    {seekControl}
    {playback}
    <div className="sound-full-actions">
     <button type="button" aria-pressed={panel==='queue'} onClick={()=>setPanel(v=>v==='queue'?null:'queue')}><Icon name="queue" size={20}/> Очередь <span>{library.queue.length}</span></button>
     <button type="button" aria-pressed={panel==='eq'} onClick={()=>setPanel(v=>v==='eq'?null:'eq')}><Icon name="equalizer" size={20}/> Эквалайзер</button>
     <button type="button" onClick={()=>{close();openLibrary()}}><Icon name="sound" size={20}/> Моя коллекция</button>
    </div>
    {buffering&&<p role="status" className="sound-full-status">Подготавливаем следующий трек…</p>}
    {error&&<p role="alert" className="sound-error">{error}</p>}
    {panel==='eq'&&<section className="sound-full-panel" aria-label="Эквалайзер"><SoundEqualizer/></section>}
    {panel==='queue'&&<section className="sound-full-panel" aria-label="Очередь воспроизведения">
     <h3>Очередь воспроизведения</h3>
     <ol className="sound-queue">{library.queue.map((id,i)=>{const t=library.tracks.find(t=>t.id===id);return t?<li key={id+'-'+i} className={i===library.queueIndex?'is-active':''}>
      <button type="button" disabled={!controller.playable(t)} onClick={()=>action(controller.play(id,undefined,i))}><b>{t.title}</b><small>{t.artist}{offline.has(t.id)?' · офлайн':''}</small></button>
      <SoundButton name="close" label={`Убрать ${t.title} из очереди`} onClick={()=>action(controller.removeQueue(i))}/>
     </li>:null})}</ol>
    </section>}
   </main>
  </div>}
 </>;
}
