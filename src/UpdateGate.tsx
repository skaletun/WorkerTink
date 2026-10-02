import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Icon} from './Icon';
import {registerSW} from 'virtual:pwa-register';

type Phase='ready'|'updating';
type UpdateGateProps={children:ReactNode};

const BUILD_ID=import.meta.env.VITE_BUILD_ID||'dev';
const BUILD_STORAGE_KEY='workertink:last-seen-build';
const RELOAD_KEY='workertink:update-reload';

export default function UpdateGate({children}:UpdateGateProps){
 const [needRefresh,setNeedRefresh]=useState(false);
 const [phase,setPhase]=useState<Phase>('ready');
 const registrationRef=useRef<ServiceWorkerRegistration|null>(null);
 const updateSWRef=useRef<(reloadPage?:boolean)=>Promise<void>>(async()=>{});
 const disposedRef=useRef(false);
 const updatingRef=useRef(false);

 const finishReload=async()=>{
   try{localStorage.setItem(BUILD_STORAGE_KEY,BUILD_ID);sessionStorage.setItem(RELOAD_KEY,BUILD_ID)}catch{}
   const registration=registrationRef.current;
   if(registration){
     try{
       const keys=await caches.keys();
       await Promise.all(keys.filter(key=>!key.includes('precache')).map(key=>caches.delete(key)));
     }catch{}
     if(registration.waiting){
       registration.waiting.postMessage({type:'SKIP_WAITING'});
       await new Promise<void>(resolve=>{
         let done=false;
         const complete=()=>{if(done)return;done=true;resolve()};
         navigator.serviceWorker.addEventListener('controllerchange',complete,{once:true});
         window.setTimeout(complete,1200);
       });
     }
   }
   window.location.reload();
 };

 const requestReload=()=>{
   if(updatingRef.current)return;
   updatingRef.current=true;
   setPhase('updating');
   void (async()=>{
     try{
       const registration=registrationRef.current;
       if(registration){
         await registration.update().catch(()=>{});
         if(registration.waiting){
           registration.waiting.postMessage({type:'SKIP_WAITING'});
           await new Promise<void>(resolve=>{
             let done=false;
             const complete=()=>{if(done)return;done=true;resolve()};
             navigator.serviceWorker.addEventListener('controllerchange',complete,{once:true});
             window.setTimeout(complete,1500);
           });
         }else{
           await updateSWRef.current(true).catch(()=>{});
         }
       }
       await finishReload();
     }catch{
       updatingRef.current=false;
       setPhase('ready');
       try{localStorage.removeItem(BUILD_STORAGE_KEY);localStorage.removeItem(RELOAD_KEY)}catch{}
     }
   })();
 };

 useEffect(()=>{
   if(sessionStorage.getItem(RELOAD_KEY)===BUILD_ID){
     try{sessionStorage.removeItem(RELOAD_KEY)}catch{}
     try{localStorage.setItem(BUILD_STORAGE_KEY,BUILD_ID)}catch{}
   }
   try{
     const previous=localStorage.getItem(BUILD_STORAGE_KEY);
     if(previous===null)localStorage.setItem(BUILD_STORAGE_KEY,BUILD_ID);
     else if(previous!==BUILD_ID)setNeedRefresh(true);
   }catch{}
   if(!('serviceWorker' in navigator))return;
   let disposed=false;
   const cleanup:{interval?:number;check?:()=>void}={};
   updateSWRef.current=registerSW({
     immediate:true,
     onNeedRefresh(){
       if(disposed||disposedRef.current)return;
       setNeedRefresh(true);
       setPhase('ready');
       updatingRef.current=false;
     },
     onOfflineReady(){},
     onRegistered(registration){
       if(!registration)return;
       registrationRef.current=registration;
       const check=()=>registration.update().catch(()=>{});
       cleanup.check=check;
       cleanup.interval=window.setInterval(check,2*60*1000);
       window.addEventListener('focus',check);
       window.addEventListener('online',check);
       void check();
     },
     onRegisterError(error){console.warn('[WTinker] Service Worker registration failed',error)}
   });
   return()=>{
     disposed=true;
     disposedRef.current=true;
     if(cleanup.interval)window.clearInterval(cleanup.interval);
     if(cleanup.check){
       window.removeEventListener('focus',cleanup.check);
       window.removeEventListener('online',cleanup.check);
     }
   };
 },[]);

 return <>
  {children}
  {needRefresh&&<div className="update-gate" role="dialog" aria-modal="true" aria-labelledby="update-gate-title">
   <div className="update-gate-backdrop"/>
   <section className="update-gate-card">
    <div className="update-gate-icon" aria-hidden="true"><span className="update-gate-icon-ring"/><span className="update-gate-icon-arrow"><Icon name="refresh" size={18}/></span></div>
    <div className="update-gate-copy">
     <span className="update-gate-eyebrow">WTINKER</span>
     <h2 id="update-gate-title">{phase==='updating'?'Обновляем WTinker':'Доступно важное обновление'}</h2>
     <p>{phase==='updating'?'Устанавливаем новую версию и переключаем приложение на новую версию Service Worker.':'Вышла новая версия приложения. Обновление нужно, чтобы продолжить работу на актуальной версии.'}</p>
    </div>
    <div className="update-gate-progress" aria-hidden="true"><span className={phase==='updating'?'is-active':''}/><span className={phase==='updating'?'is-active':''}/><span className={phase==='updating'?'is-active':''}/></div>
    <button className="btn primary update-gate-action" type="button" disabled={phase==='updating'} onClick={requestReload}>{phase==='updating'?'Обновление…':'Обновить сейчас'}</button>
    <small className="update-gate-note">Ваши настройки, профиль и рабочие данные сохраняются.</small>
   </section>
  </div>}
 </>;
}