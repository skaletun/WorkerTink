export type UpdateActivation='activated'|'already-active'|'unavailable';

export class UpdateError extends Error{
 constructor(public readonly code:'NO_NETWORK'|'ACTIVATION_TIMEOUT'|'REGISTRATION_UPDATE_FAILED',cause?:unknown){
  super(code,{cause});this.name='UpdateError';
 }
}

async function waitForControllerChange(container:ServiceWorkerContainer,previous:ServiceWorker|null,timeoutMs:number){
 if(container.controller!==previous)return true;
 return new Promise<boolean>(resolve=>{
  let settled=false;
  const done=(value:boolean)=>{
   if(settled)return;
   settled=true;clearTimeout(timer);container.removeEventListener('controllerchange',changed);resolve(value);
  };
  const changed=()=>done(true);
  const timer=setTimeout(()=>done(false),timeoutMs);
  container.addEventListener('controllerchange',changed);
  if(container.controller!==previous)done(true);
 });
}

/** The page must NEVER clear a cache, IndexedDB, or localStorage to switch
 * worker versions. A waiting worker can already be activated while offline.
 * We do not navigate on timeout: the user must be able to retry safely.
 */
export async function activateUpdate(
 registration:ServiceWorkerRegistration|null,
 container:ServiceWorkerContainer|null,
 timeoutMs=12000
):Promise<UpdateActivation>{
 if(!registration||!container)return 'unavailable';
 const previous=container.controller;
 let worker=registration.waiting;
 if(!worker){
  if(typeof navigator!=='undefined'&&!navigator.onLine)throw new UpdateError('NO_NETWORK');
  try{
   await Promise.race([
    registration.update(),
    new Promise<never>((_,reject)=>setTimeout(()=>reject(new UpdateError('REGISTRATION_UPDATE_FAILED')),timeoutMs))
   ]);
  }catch(error){throw error instanceof UpdateError?error:new UpdateError('REGISTRATION_UPDATE_FAILED',error)}
  worker=registration.waiting;
 }
 if(worker){
  const change=waitForControllerChange(container,previous,timeoutMs);
  worker.postMessage({type:'SKIP_WAITING'});
  if(!(await change))throw new UpdateError('ACTIVATION_TIMEOUT');
  return 'activated';
 }
 // With skipWaiting()+clients.claim() in the injected worker, the newly
 // installed SW may have already activated before the user taps Update.
 if(container.controller!==previous||registration.active)return 'already-active';
 return 'unavailable';
}

/** Synchronous application checkpoint. Consumers (editors) may cancel on
 * actual write failure. This does not discard or mutate any chat credentials.
 */
export function checkpointOpenEditors(target:Pick<Window,'dispatchEvent'>=window):boolean{
 return target.dispatchEvent(new Event('wtinker:before-update',{cancelable:true}));
}
