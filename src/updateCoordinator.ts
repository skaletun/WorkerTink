export type UpdateActivation='activated'|'already-active'|'unavailable';

export class UpdateError extends Error{
 readonly code:'NO_NETWORK'|'ACTIVATION_TIMEOUT'|'REGISTRATION_UPDATE_FAILED';
 constructor(code:'NO_NETWORK'|'ACTIVATION_TIMEOUT'|'REGISTRATION_UPDATE_FAILED',cause?:unknown){
  super(code,{cause});this.name='UpdateError';this.code=code;
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
async function withTimeout<T>(promise:Promise<T>,timeoutMs:number):Promise<T>{
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new UpdateError('REGISTRATION_UPDATE_FAILED')),timeoutMs);
  promise.then(value=>{clearTimeout(timer);resolve(value)},error=>{clearTimeout(timer);reject(new UpdateError('REGISTRATION_UPDATE_FAILED',error))});
 });
}

/** No cache/IDB/localStorage deletion. If there is no new worker, report a
 * retryable error rather than reloading the same obsolete application shell.
 */
export async function activateUpdate(
 registration:ServiceWorkerRegistration|null,
 container:ServiceWorkerContainer|null,
 timeoutMs=12000
):Promise<UpdateActivation>{
 if(!registration||!container)return 'unavailable';
 const previousController=container.controller;
 const previousActive=registration.active;
 let worker=registration.waiting;
 if(!worker){
  if(typeof navigator!=='undefined'&&navigator.onLine===false)throw new UpdateError('NO_NETWORK');
  await withTimeout(registration.update(),timeoutMs);
  // On iOS the update() promise can resolve before installing->installed.
  // A new SW may also auto-activate without entering the waiting state.
  const deadline=Date.now()+timeoutMs;
  while(!registration.waiting&&registration.active===previousActive&&container.controller===previousController&&Date.now()<deadline){
   await new Promise(resolve=>setTimeout(resolve,120));
  }
  worker=registration.waiting;
 }
 if(worker){
  const change=waitForControllerChange(container,previousController,timeoutMs);
  worker.postMessage({type:'SKIP_WAITING'});
  if(!(await change))throw new UpdateError('ACTIVATION_TIMEOUT');
  return 'activated';
 }
 if(container.controller!==previousController||registration.active!==previousActive&&Boolean(registration.active))return 'already-active';
 throw new UpdateError('REGISTRATION_UPDATE_FAILED');
}

/** Synchronous application checkpoint. Consumers (open editors) may cancel
 * when an actual local draft write fails. Keys and ciphertext are untouched.
 */
export function checkpointOpenEditors(target:Pick<Window,'dispatchEvent'>=window):boolean{
 return target.dispatchEvent(new Event('wtinker:before-update',{cancelable:true}));
}
