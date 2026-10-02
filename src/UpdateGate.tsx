import {useEffect,useRef,useState,type ReactNode} from 'react';
import {registerSW} from 'virtual:pwa-register';
import {Icon} from './Icon';

type Phase='ready'|'updating';
type UpdateGateProps={children:ReactNode};

const BUILD_ID=import.meta.env.VITE_BUILD_ID||'dev';
const BUILD_STORAGE_KEY='workertink:last-seen-build';
const RELOAD_KEY='workertink:update-reload';
const UPDATE_CHECK_INTERVAL=2*60*1000;

export default function UpdateGate({children}:UpdateGateProps){
 const [needRefresh,setNeedRefresh]=useState(false);
 const [phase,setPhase]=useState<Phase>('ready');
 const updateSWRef=useRef<(reloadPage?:boolean)=>Promise<void>>(async()=>{});
 const registrationRef=useRef<ServiceWorkerRegistration|null>(null);
 const disposedRef=useRef(false);
 const updatingRef=useRef(false);

 const markCurrentBuild=()=>{
   try{
     localStorage.setItem(BUILD_STORAGE_KEY,BUILD_ID);
     sessionStorage.setItem(RELOAD_KEY,BUILD_ID);
   }catch{}
 };

 const resetFailedUpdate=()=>{
   updatingRef.current=false;
   setPhase('ready');
   try{
     localStorage.removeItem(BUILD_STORAGE_KEY);
     sessionStorage.removeItem(RELOAD_KEY);
   }catch{}
 };

 const requestReload=()=>{
   if(updatingRef.current)return;
   updatingRef.current=true;
   setPhase('updating');
   markCurrentBuild();
   void updateSWRef.current(true).catch(async()=>{
     const registration=registrationRef.current;
     try{
       if(registration?.waiting){
         registration.waiting.postMessage({type:'SKIP_WAITING'});
         await new Promise<void>(resolve=>{
           let settled=false;
           const done=()=>{if(settled)return;settled=true;resolve()};
           navigator.serviceWorker.addEventListener('controllerchange',done,{once:true});
           window.setTimeout(done,1800);
         });
       }else if(registration){
         await registration.update();
       }
     }catch{}
     window.location.reload();
   }).catch(()=>resetFailedUpdate());
 };

 useEffect(()=>{
   disposedRef.current=false;
   try{
     const reloadedFor= sessionStorage.getItem(RELOAD_KEY);
     if(reloadedFor===BUILD_ID){
       sessionStorage.removeItem(RELOAD_KEY);
       localStorage.setItem(BUILD_STORAGE_KEY,BUILD_ID);
     }
   }catch{}

   try{
     const previous=localStorage.getItem(BUILD_STORAGE_KEY);
     if(previous===null){
       localStorage.setItem(BUILD_STORAGE_KEY,BUILD_ID);
     }else if(previous!==BUILD_ID){
       setNeedRefresh(true);
     }
   }catch{}

   if(!('serviceWorker' in navigator))return;

   let intervalId:number|undefined;
   const check=async(swUrl:string,registration:ServiceWorkerRegistration|undefined)=>{
     if(disposedRef.current||!registration||registration.installing||!navigator.onLine)return;
     try{
       const response=await fetch(swUrl,{cache:'no-store',headers:{cache:'no-store','cache-control':'no-cache'}});
       if(response.ok)await registration.update();
     }catch{}
   };

   updateSWRef.current=registerSW({
     immediate:true,
     onNeedRefresh(){
       if(disposedRef.current)return;
       setNeedRefresh(true);
       setPhase('ready');
       updatingRef.current=false;
     },
     onOfflineReady(){},
     onRegisteredSW(swUrl,registration){
       if(disposedRef.current||!registration)return;
       registrationRef.current=registration;
       const runCheck=()=>void check(swUrl,registration);
       intervalId=window.setInterval(runCheck,UPDATE_CHECK_INTERVAL);
       window.addEventListener('focus',runCheck);
       window.addEventListener('online',runCheck);
       runCheck();
     },
     onRegisterError(error){console.warn('[WTinker] Service Worker registration failed',error)}
   });

   return()=>{
     disposedRef.current=true;
     if(intervalId)window.clearInterval(intervalId);
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
