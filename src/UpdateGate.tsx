import {useEffect,useRef,useState,type ReactNode} from 'react';
import {registerSW} from 'virtual:pwa-register';

type Phase='ready'|'updating';
type UpdateGateProps={children:ReactNode};

const BUILD_ID=import.meta.env.VITE_BUILD_ID||'dev';
const BUILD_STORAGE_KEY='workertink:last-seen-build';

export default function UpdateGate({children}:UpdateGateProps){
  const [needRefresh,setNeedRefresh]=useState(false);
  const [phase,setPhase]=useState<Phase>('ready');
  const updateSWRef=useRef<(reloadPage?:boolean)=>Promise<void>>(async()=>{});

  const requestReload=()=>{
    setPhase('updating');
    if(!('serviceWorker' in navigator)){try{localStorage.setItem(BUILD_STORAGE_KEY,BUILD_ID)}catch{};window.setTimeout(()=>window.location.reload(),250);return;}
    try{localStorage.setItem(BUILD_STORAGE_KEY,BUILD_ID)}catch{}
    
    let reloaded=false;
    const reload=async()=>{
      if(reloaded)return;
      reloaded=true;
      try{sessionStorage.clear()}catch{}
      try{
        const registrations=await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg=>reg.update().catch(()=>{})));
      }catch{}
      window.location.reload();
    };
    const onControllerChange=()=>{
      navigator.serviceWorker.removeEventListener('controllerchange',onControllerChange);
      void reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange',onControllerChange);
    void updateSWRef.current(false).then(()=>{
      const controller=navigator.serviceWorker.controller;
      if(controller)controller.postMessage({type:'workertink:cleanup-runtime-cache'});
      window.setTimeout(()=>{
        navigator.serviceWorker.removeEventListener('controllerchange',onControllerChange);
        void reload();
      },8000);
    }).catch(()=>{
      navigator.serviceWorker.removeEventListener('controllerchange',onControllerChange);
      setPhase('ready');
    });
  };

  useEffect(()=>{
    try{
      const previous=localStorage.getItem(BUILD_STORAGE_KEY);
      if(previous===null)localStorage.setItem(BUILD_STORAGE_KEY,BUILD_ID);
      else if(previous!==BUILD_ID){setNeedRefresh(true);setPhase('ready');}
    }catch{}
    if(!('serviceWorker' in navigator))return;
    let disposed=false;
    const registrationCleanup:{registration?:ServiceWorkerRegistration;interval?:number;check?:()=>void}={};
    updateSWRef.current=registerSW({
      immediate:true,
      onNeedRefresh(){
        if(disposed)return;
        setNeedRefresh(true);
        setPhase('ready');
      },
      onRegistered(registration){
        if(!registration)return;
        const check=()=>registration.update().catch(()=>{});
        registrationCleanup.registration=registration;
        registrationCleanup.check=check;
        registrationCleanup.interval=window.setInterval(check,5*60*1000);
        window.addEventListener('focus',check);
        window.addEventListener('online',check);
        void check();
      },
      onRegisterError(error){
        console.warn('[WTinker] Service Worker registration failed',error);
      },
    });
    return()=>{
      disposed=true;
      if(registrationCleanup.interval)window.clearInterval(registrationCleanup.interval);
      if(registrationCleanup.check){
        window.removeEventListener('focus',registrationCleanup.check);
        window.removeEventListener('online',registrationCleanup.check);
      }
    };
  },[]);

  return <>
    {children}
    {needRefresh&&(
      <div className="update-gate" role="dialog" aria-modal="true" aria-labelledby="update-gate-title">
        <div className="update-gate-backdrop"/>
        <section className="update-gate-card">
          <div className="update-gate-icon" aria-hidden="true">
            <span className="update-gate-icon-ring"/>
            <span className="update-gate-icon-arrow">↻</span>
          </div>
          <div className="update-gate-copy">
            <span className="update-gate-eyebrow">WTINKER</span>
            <h2 id="update-gate-title">{phase==='updating'?'Обновляем WTinker':'Доступно важное обновление'}</h2>
            <p>{phase==='updating'?'Устанавливаем новую версию и очищаем устаревшие данные. Это займёт несколько секунд.':'Вышла новая версия приложения. Обновление обязательно, чтобы продолжить работу без ошибок.'}</p>
          </div>
          <div className="update-gate-progress" aria-hidden="true">
            <span className={phase==='updating'?'is-active':''}/>
            <span className={phase==='updating'?'is-active':''}/>
            <span className={phase==='updating'?'is-active':''}/>
          </div>
          <button className="btn primary update-gate-action" type="button" disabled={phase==='updating'} onClick={requestReload}>
            {phase==='updating'?'Обновление…':'Обновить сейчас'}
          </button>
          <small className="update-gate-note">Ваши настройки, профиль и рабочие данные сохраняются.</small>
        </section>
      </div>
    )}
  </>;
}
