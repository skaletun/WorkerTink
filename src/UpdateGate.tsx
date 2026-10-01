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
  const disposedRef=useRef(false);
  const updatingRef=useRef(false);

  const requestReload=()=>{
    if(updatingRef.current)return;
    updatingRef.current=true;
    setPhase('updating');
    try{localStorage.setItem(BUILD_STORAGE_KEY,BUILD_ID)}catch{}
    if(!('serviceWorker' in navigator)){
      window.setTimeout(()=>window.location.reload(),350);
      return;
    }
    void updateSWRef.current(true).catch(()=>{
      updatingRef.current=false;
      setPhase('ready');
      try{localStorage.removeItem(BUILD_STORAGE_KEY)}catch{}
    });
  };

  useEffect(()=>{
    try{
      const previous=localStorage.getItem(BUILD_STORAGE_KEY);
      if(previous===null)localStorage.setItem(BUILD_STORAGE_KEY,BUILD_ID);
      else if(previous!==BUILD_ID)setNeedRefresh(true);
    }catch{}
    if(!('serviceWorker' in navigator))return;
    let disposed=false;
    const registrationCleanup:{interval?:number;check?:()=>void}={};
    updateSWRef.current=registerSW({
      immediate:true,
      onNeedRefresh(){
        if(disposed||disposedRef.current)return;
        updatingRef.current=false;
        setNeedRefresh(true);
        setPhase('ready');
      },
      onRegistered(registration){
        if(!registration)return;
        const check=()=>registration.update().catch(()=>{});
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
      disposedRef.current=true;
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
            <p>{phase==='updating'?'Устанавливаем новую версию и переключаем приложение на новый Service Worker.':'Вышла новая версия приложения. Обновление нужно, чтобы продолжить работу на актуальной версии.'}</p>
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
