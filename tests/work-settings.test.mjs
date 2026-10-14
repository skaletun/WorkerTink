import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT,calcMonth,getScheduledShift} from '../src/core.ts';
import {normalizeState,saveState,loadState} from '../src/storage.ts';

const store=new Map();
globalThis.localStorage={
 getItem:key=>store.get(key)??null,
 setItem:(key,value)=>{store.set(key,String(value))},
 removeItem:key=>{store.delete(key)}
};
globalThis.__WTINK_DIRECTORY_URL='https://directory.test';
const {workSetupFromState,validateWorkSetup,queueWorkSetup,readPendingWorkSetup,clearPendingWorkSetup,syncPendingWorkSetup}=await import('../src/workSettings.ts');

const profileId='WTinkID-123456';
const original=workSetupFromState(DEFAULT);
assert.deepEqual(Object.keys(original).sort(),['salary','taxRate','stage','vacTotal','startDate','scheduleType','scheduleShift','scheduleVakhtaMonths','schedulePairType','holidayCoeff','nightExtraPercent'].sort());
assert.equal(validateWorkSetup(original),'');
assert.match(validateWorkSetup({...original,startDate:'2026-02-30'}),/дату/);
assert.match(validateWorkSetup({...original,salary:Infinity}),/Оклад/);
assert.match(validateWorkSetup({...original,stage:-1}),/Стаж/);
assert.match(validateWorkSetup({...original,scheduleVakhtaMonths:0}),/Вахта/);
assert.match(validateWorkSetup({...original,scheduleType:'5/2',scheduleShift:'full'}),/смены/);
assert.match(validateWorkSetup({...original,nightExtraPercent:201}),/Доплата/);

const edited={...original,salary:145000,taxRate:15,stage:8,vacTotal:40,startDate:'2026-01-01',scheduleType:'2/2',scheduleShift:'day',schedulePairType:'day-night',scheduleVakhtaMonths:2,holidayCoeff:2.5,nightExtraPercent:45};
assert.equal(validateWorkSetup(edited),'');
const savedState=normalizeState({...DEFAULT,profile:{...DEFAULT.profile,profileId,name:'Тест'},setupComplete:true,...edited});
assert.equal(saveState(savedState),true);
const restarted=loadState();
assert.deepEqual(workSetupFromState(restarted),edited);
assert.deepEqual(workSetupFromState(normalizeState(restarted)),edited);
const first=calcMonth({...restarted,salary:0},2026,1),second=calcMonth(restarted,2026,1);
assert.notEqual(first.gross,second.gross,'Pay calculation must use the edited salary');
const firstWeeks=Array.from({length:14},(_,i)=>getScheduledShift(normalizeState({...restarted,scheduleType:'5/2'}),new Date(2026,0,i+1)));
const editedWeeks=Array.from({length:14},(_,i)=>getScheduledShift(restarted,new Date(2026,0,i+1)));
assert.notDeepEqual(firstWeeks,editedWeeks,'Calendar must use the edited schedule');

// Simulate an unavailable API, then a successful reconnect.
let requests=0,server=null,offline=true;
globalThis.fetch=async(url,options)=>{
 assert.equal(url,'https://directory.test/account/setup');
 assert.equal(options.method,'PUT');
 assert.equal(options.headers.Authorization,'Bearer session-token');
 requests++;
 if(offline)throw new TypeError('Network unavailable');
 server=JSON.parse(options.body).setup;
 return new Response(JSON.stringify({ok:true,setup:server}),{status:200,headers:{'Content-Type':'application/json'}});
};
const revision=queueWorkSetup(profileId,edited);
assert.equal(typeof revision,'number');
assert.deepEqual(readPendingWorkSetup(profileId)?.setup,edited);
assert.equal(await syncPendingWorkSetup(profileId,'session-token'),false);
assert.deepEqual(readPendingWorkSetup(profileId)?.setup,edited);
offline=false;
assert.equal(await syncPendingWorkSetup(profileId,'session-token'),true);
assert.deepEqual(server,edited);
assert.equal(readPendingWorkSetup(profileId),null);
assert.equal(requests,2);

// A slower older request must not overwrite newer values.
let releaseFirst;
let requestNumber=0;
const latest={...edited,salary:175000,scheduleType:'5/2'};
globalThis.fetch=async(url,options)=>{
 requestNumber++;
 const content=JSON.parse(options.body).setup;
 if(requestNumber===1)await new Promise(resolve=>{releaseFirst=resolve});
 server=content;
 return new Response(JSON.stringify({ok:true,setup:content}),{status:200});
};
const oldRevision=queueWorkSetup(profileId,edited);
const running=syncPendingWorkSetup(profileId,'session-token');
await Promise.resolve();
await Promise.resolve();
const nextRevision=queueWorkSetup(profileId,latest);
assert.ok(nextRevision>oldRevision);
assert.equal(clearPendingWorkSetup(profileId,oldRevision),false);
releaseFirst();
assert.equal(await running,true);
assert.deepEqual(server,latest);
assert.equal(readPendingWorkSetup(profileId),null);
assert.equal(requestNumber,2);

// The offline queue belongs to its owner, not a different signed-in account.
queueWorkSetup(profileId,edited);
assert.equal(readPendingWorkSetup('WTinkID-654321'),null);
assert.equal(clearPendingWorkSetup(profileId,readPendingWorkSetup(profileId).updatedAt),true);

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const editor=readFileSync(new URL('../src/views/settings/WorkSettingsEditor.tsx',import.meta.url),'utf8');
const auth=readFileSync(new URL('../src/views/auth/AuthViews.tsx',import.meta.url),'utf8');
const work=readFileSync(new URL('../src/WorkHubView.tsx',import.meta.url),'utf8');
assert.match(app,/readPendingWorkSetup\(result\.profile\.profileId\)/);
assert.match(auth,/readPendingWorkSetup\(result\.profile\.profileId\)/);
assert.match(app,/window\.addEventListener\('online'/);
assert.match(app,/syncPendingWorkSetup/);
assert.match(editor,/Сохранить изменения/);
assert.match(editor,/queueWorkSetup/);
assert.match(work,/Изменить условия работы/);
delete globalThis.fetch;
delete globalThis.__WTINK_DIRECTORY_URL;
delete globalThis.localStorage;
console.log('WorkerTink editable work settings persistence tests: OK');
