import {useEffect,useRef,useState,type ReactNode} from 'react';
import {registerSW} from 'virtual:pwa-register';
import {Icon} from './Icon';
import {protectE2EBeforeUpdate,type E2EUpdateHealth} from './e2eUpdateSafety.ts';
import {activateUpdate,checkpointOpenEditors} from './updateCoordinator.ts';

type Phase='ready'|'updating';
type UpdateGateProps={children:ReactNode};

const BUILD_ID=import.meta.env.VITE_BUILD_ID||'dev';
const BUILD_STORAGE_KEY='workertink:last-seen-build';
const DISMISS_KEY='workertink:update-dismissed-until';
const UPDATE_CHECK_INTERVAL=2*60*1000;
const DISMISS_FOR_MS=5*60*1000;
const warning=(error:unknown)=>{
 const code=String(error);
 if(code.includes('NO_NETWORK'))return 'Подключение недоступно. Если обновление ещё не загружено, подключитесь к интернету и повторите попытку. Личные данные и E2E-ключи не затронуты.';
 if(code.includes('ACTIVATION_TIMEOUT'))return 'Новый Service Worker не подтвердил активацию. Обновление не прервано и данные не очищались. Закройте другие вкладки WTinker и повторите попытку.';
 if(code.includes('UPDATE_EDITOR_NOT_SAVED'))return 'Не удалось надёжно сохранить открытый редактор. Проверьте свободное место в браузере и повторите попытку. Не закрывайте редактор до сохранения.';
 return 'Не удалось переключить версию приложения. Данные и ключи не удалялись. Проверьте интернет и повторите попытку.';
};

export default function UpdateGate({children}:UpdateGateProps){
 const [needRefresh,setNeedRefresh]=useState(false);
 const [phase,setPhase]=useState<Phase>('ready');
 const [keySafetyError,setKeySafetyError]=useState('');
 const [keyHealth,setKeyHealth]=useState<E2EUpdateHealth|null>(null);
 const registrationRef=useRef<ServiceWorkerRegistration|null>(null);
 const disposedRef=useRef(false);
 const updatingRef=useRef(false);
 const alreadyActivatedRef=useRef(false);

 const dismissUpdate=()=>{
  setNeedRefresh(false);setPhase('ready');setKeySafetyError('');
  updatingRef.current=false;
  try{sessionStorage.setItem(DISMISS_KEY,String(Date.now()+DISMISS_FOR_MS))}catch{}
 };

 const requestReload=async()=>{
  if(updatingRef.current)return;
  updatingRef.current=true;setPhase('updating');setKeySafetyError('');
  try{
   // Preflight only READS E2E keys. Missing keys on a new browser or an
   // inaccessible vault do not become a permanent software-update deadlock.
   const health=await protectE2EBeforeUpdate();
   setKeyHealth(health);
   if(!checkpointOpenEditors())throw new Error('UPDATE_EDITOR_NOT_SAVED');
   const serviceWorker='serviceWorker' in navigator?navigator.serviceWorker:null;
   const registration=registrationRef.current||(serviceWorker?await serviceWorker.getRegistration():null);
   if(serviceWorker&&registration){
    const result=alreadyActivatedRef.current&&registration.active?'already-active':await activateUpdate(registration,serviceWorker);
    if(result==='unavailable')throw new Error('UPDATE_WORKER_UNAVAILABLE');
   }else if(!navigator.onLine){
    throw new Error('NO_NETWORK');
   }
   // The new version records its own build identifier only after the
   // replacement bundle actually loads. Never acknowledge an old build here.
   window.location.reload();
  }catch(error){
   console.error('[WTinker] PWA update could not complete:',error);
   setKeySafetyError(warning(error));
   setPhase('ready');updatingRef.current=false;
  }
 };

 useEffect(()=>{
  disposedRef.current=false;
  // Recording a loaded build is safe. It is not a signal that a waiting
  // worker installed successfully and is never used to clear private data.
  try{localStorage.setItem(BUILD_STORAGE_KEY,BUILD_ID)}catch{}
  if(!('serviceWorker' in navigator))return;
  let intervalId:number|undefined;
  let controllerKnown=Boolean(navigator.serviceWorker.controller);
  const onControllerChange=()=>{
   if(disposedRef.current)return;
   if(controllerKnown){
    alreadyActivatedRef.current=true;
    setNeedRefresh(true);setPhase('ready');
   }
   controllerKnown=true;
  };
  navigator.serviceWorker.addEventListener('controllerchange',onControllerChange);
  let runCheckOnFocus=()=>{};
  const check=async(registration:ServiceWorkerRegistration)=>{
   if(disposedRef.current||registration.installing||!navigator.onLine)return;
   try{await registration.update()}catch{}
  };
  registerSW({
   immediate:true,
   onNeedRefresh(){
    if(disposedRef.current)return;
    let delayed=false;
    try{delayed=Number(sessionStorage.getItem(DISMISS_KEY)||0)>Date.now()}catch{}
    if(delayed)return;
    setNeedRefresh(true);setPhase('ready');
   },
   onOfflineReady(){},
   onRegisteredSW(_url,registration){
    if(disposedRef.current||!registration)return;
    registrationRef.current=registration;
    const runCheck=()=>void check(registration);
    runCheckOnFocus=runCheck;
    intervalId=window.setInterval(runCheck,UPDATE_CHECK_INTERVAL);
    window.addEventListener('focus',runCheck);
    window.addEventListener('online',runCheck);
    runCheck();
   },
   onRegisterError(error){console.warn('[WTinker] Service Worker registration failed',error)}
  });
  return()=>{
   disposedRef.current=true;
   if(intervalId!==undefined)window.clearInterval(intervalId);
   window.removeEventListener('focus',runCheckOnFocus);
   window.removeEventListener('online',runCheckOnFocus);
   navigator.serviceWorker.removeEventListener('controllerchange',onControllerChange);
  };
 },[]);

 return <>
  {children}
  {needRefresh&&<div className="update-gate" role="dialog" aria-modal="true" aria-labelledby="update-gate-title">
   <div className="update-gate-backdrop"/>
   <section className="update-gate-card">
    <button className="update-gate-dismiss" type="button" onClick={dismissUpdate} disabled={phase==='updating'} aria-label="Закрыть уведомление об обновлении"><Icon name="close" size={18}/></button>
    <div className="update-gate-icon" aria-hidden="true"><span className="update-gate-icon-ring"/><span className="update-gate-icon-arrow"><Icon name="refresh" size={18}/></span></div>
    <div className="update-gate-copy">
     <span className="update-gate-eyebrow">WTINKER</span>
     <h2 id="update-gate-title">{phase==='updating'?'Обновляем WTinker':'Доступно важное обновление'}</h2>
     <p>{phase==='updating'?'Проверяем локальные данные и переключаем приложение на новую версию.':'Вышла новая версия приложения. Для продолжения работы установите её без удаления переписки и ключей.'}</p>
    </div>
    {keySafetyError&&<p role="alert" className="update-gate-key-warning">{keySafetyError}</p>}
    {keyHealth==='unverified'&&!keySafetyError&&<p role="status" className="update-gate-key-warning">Доступность локального E2E-хранилища проверить не удалось. Само обновление не очищает ключи. Для старых сообщений может потребоваться восстановление ключа.</p>}
    <div className="update-gate-progress" aria-hidden="true"><span className={phase==='updating'?'is-active':''}/><span className={phase==='updating'?'is-active':''}/><span className={phase==='updating'?'is-active':''}/></div>
    <button className="btn primary update-gate-action" type="button" disabled={phase==='updating'} onClick={()=>void requestReload()}>{phase==='updating'?'Обновление…':'Обновить сейчас'}</button>
    <button className="btn quiet update-gate-later" type="button" disabled={phase==='updating'} onClick={dismissUpdate}>Позже</button>
    <small className="update-gate-note">Приложение не удаляет E2E-ключи и очередь отправки. Если ключ отсутствовал до обновления, восстановите его через Secure Sync или резервную копию.</small>
   </section>
  </div>}
 </>;
}
