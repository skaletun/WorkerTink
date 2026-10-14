import assert from 'node:assert/strict';
import {DEFAULT} from '../src/core.ts';
import {normalizeState} from '../src/storage.ts';

const legacy={...DEFAULT,setupComplete:true,schemaVersion:3,scheduleType:'5/2',scheduleShift:'full',nightExtraPercent:undefined};
const normalized=normalizeState(legacy);
assert.equal(normalized.schemaVersion,8);
assert.equal(normalized.scheduleShift,'day');
assert.equal(normalized.nightExtraPercent,20);
assert.equal(normalized.scheduleType,'5/2');
assert.equal(normalized.setupComplete,true);
assert.equal(normalized.profile.name,'');
const withUsername=normalizeState({...DEFAULT,profile:{...DEFAULT.profile,profileId:'WTinkID-123456',name:'Тест',username:'test_worker'}});
assert.equal(withUsername.profile.username,'test_worker');
assert.equal(withUsername.profile.isOfficial,false);
assert.equal(withUsername.profile.isVerified,false);
const invalidUsername=normalizeState({...DEFAULT,profile:{...DEFAULT.profile,profileId:'WTinkID-123456',name:'Тест',username:'плохой username'}});
assert.equal(invalidUsername.profile.username,null);
assert.deepEqual(normalized.friends,{});
assert.deepEqual(normalized.friendRequestsIncoming,[]);
assert.deepEqual(normalized.friendRequestsOutgoing,[]);
assert.match(normalized.profile.profileId,/^WTinkID-\d{6}$/);
assert.deepEqual(normalized.chats,{});
assert.equal(normalized.notifications.enabled,true);
assert.equal(normalized.notifications.messages,true);
assert.equal(normalized.onePassEnabled,false);
const verified=normalizeState({...DEFAULT,profile:{...DEFAULT.profile,profileId:'WTinkID-123456',name:'Тест',username:'Test_Worker',isOfficial:true,isVerified:true}});
assert.equal(verified.profile.username,'test_worker');
assert.equal(verified.profile.isOfficial,true);
assert.equal(verified.profile.isVerified,true);
const invalidDates=normalizeState({...DEFAULT,startDate:'2026-02-31',vacations:[{start:'2026-02-31',end:'2026-03-02'}],sickLeaves:[{start:'2026-03-01',end:'2026-02-31'}]});
assert.equal(invalidDates.startDate,DEFAULT.startDate);
assert.deepEqual(invalidDates.vacations,[]);
assert.deepEqual(invalidDates.sickLeaves,[]);
console.log('WorkerTink storage migration tests: OK');

 
// Некорректные числа и месяцы в импортируемых данных не портят расчёты.
const invalidNumbers=normalizeState({...DEFAULT,salary:Infinity,taxRate:Infinity,stage:Infinity,vacTotal:Infinity,scheduleVakhtaMonths:Infinity,holidayCoeff:Infinity,nightExtraPercent:Infinity,advances:{'2026-13':3000,'2026-09':1500},incomeHistory:{'2026-00':500,'2026-08':null,'2026-09':200}});
assert.equal(invalidNumbers.salary,0);
assert.equal(invalidNumbers.taxRate,0);
assert.equal(invalidNumbers.stage,0);
assert.equal(invalidNumbers.vacTotal,0);
assert.equal(invalidNumbers.scheduleVakhtaMonths,1);
assert.equal(invalidNumbers.holidayCoeff,1);
assert.equal(invalidNumbers.nightExtraPercent,20);
assert.deepEqual(invalidNumbers.advances,{'2026-09':1500});
assert.deepEqual(invalidNumbers.incomeHistory,{'2026-09':200});

// Резервные копии не содержат сессии; повреждённая запись не блокирует миграцию.
const {exportableState,loadState,STORAGE_KEY,getRecoverySnapshot}=await import('../src/storage.ts');
const exported=exportableState({...DEFAULT,directoryToken:'secret-bearer-token'});
assert.equal(exported.directoryToken,'');
const data=new Map([[STORAGE_KEY,'{broken'],['workertink:v5',JSON.stringify({...DEFAULT,salary:123456,setupComplete:true})]]);
globalThis.localStorage={getItem:key=>data.get(key)??null,setItem:(key,value)=>{data.set(key,String(value))},removeItem:key=>{data.delete(key)}};
const restored=loadState();
assert.equal(restored.salary,123456);
assert.equal(restored.setupComplete,true);
assert.equal(JSON.parse(data.get(STORAGE_KEY)).salary,123456);
assert.equal(getRecoverySnapshot(),'{broken');
delete globalThis.localStorage;
