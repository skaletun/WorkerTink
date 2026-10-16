import assert from 'node:assert/strict';
import {activateUpdate,checkpointOpenEditors} from '../src/updateCoordinator.ts';

const controller=()=>({postMessage(){}});
const makeContainer=(initial=controller())=>{
 const listeners=new Set();
 return {
  controller:initial,
  addEventListener(type,fn){if(type==='controllerchange')listeners.add(fn)},
  removeEventListener(type,fn){if(type==='controllerchange')listeners.delete(fn)},
  change(next){this.controller=next;for(const fn of [...listeners])fn()},
  get listenerCount(){return listeners.size}
 };
};
const previousNavigator=globalThis.navigator;
try{
 Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
 const first=makeContainer();
 const old=first.controller;
 const waiting={postMessage({type}){
  assert.equal(type,'SKIP_WAITING');
  setTimeout(()=>first.change(controller()),1);
 }};
 const registration={waiting,active:old,update:async()=>{}};
 assert.equal(await activateUpdate(registration,first,100),'activated');
 assert.notEqual(first.controller,old);
 assert.equal(first.listenerCount,0,'controller listener must be removed after activation');

 const auto=makeContainer();
 const autoOld=auto.controller;
 const autoRegistration={waiting:null,active:autoOld,update:async()=>{
  setTimeout(()=>{autoRegistration.active=controller();auto.change(autoRegistration.active)},10);
 }};
 assert.equal(await activateUpdate(autoRegistration,auto,300),'already-active',
  'auto-activated SW must be detected after update() resolves');
 assert.equal(auto.listenerCount,0);

 const delayed=makeContainer();
 const delayedOld=delayed.controller;
 const delayedRegistration={waiting:null,active:delayedOld,update:async()=>{
  setTimeout(()=>{delayedRegistration.waiting={postMessage(){delayed.change(controller())}}},15);
 }};
 assert.equal(await activateUpdate(delayedRegistration,delayed,300),'activated',
  'worker installation may finish after registration.update() promise');
 assert.equal(delayed.listenerCount,0);

 const stuck=makeContainer();
 await assert.rejects(()=>activateUpdate({waiting:{postMessage(){}},active:stuck.controller,update:async()=>{}},stuck,25),/ACTIVATION_TIMEOUT/);
 assert.equal(stuck.listenerCount,0,'failed activation must not accumulate listeners');
 await assert.rejects(()=>activateUpdate({waiting:null,active:stuck.controller,update:async()=>{}},stuck,35),/REGISTRATION_UPDATE_FAILED/,
  'never report success while continuing to run the old worker');

 Object.defineProperty(globalThis,'navigator',{value:{onLine:false},configurable:true});
 const offline=makeContainer();
 await assert.rejects(()=>activateUpdate({waiting:null,active:offline.controller,update:async()=>{}},offline,50),/NO_NETWORK/);
 assert.equal(await activateUpdate(null,offline),'unavailable');

 const events=new EventTarget();
 assert.equal(checkpointOpenEditors(events),true);
 events.addEventListener('wtinker:before-update',event=>event.preventDefault());
 assert.equal(checkpointOpenEditors(events),false,'editor must veto a reload if its draft cannot be saved');
}finally{
 Object.defineProperty(globalThis,'navigator',{value:previousNavigator,configurable:true});
}
console.log('WTinker PWA updates: already-active, delayed-install, waiting, timeout, offline and editor checkpoints: OK');
