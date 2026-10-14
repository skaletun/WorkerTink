import assert from 'node:assert/strict';
import {DEFAULT,ymd} from '../src/core.ts';
import {buildPushReminders} from '../src/app/reminders.ts';

const tomorrow=new Date();
tomorrow.setDate(tomorrow.getDate()+1);
const date=ymd(tomorrow);
const state={...DEFAULT,startDate:ymd(new Date()),scheduleType:'7/0',scheduleShift:'day',scheduleVakhtaMonths:6};
assert.equal(buildPushReminders(state).some(r=>r.id===`shift:${date}:day`),true);

const removed={...state,shiftOverrides:{[date]:'off'}};
assert.equal(buildPushReminders(removed).some(r=>r.tag===`workertink-shift-${date}`),false);

const vacation={...state,vacations:[{start:date,end:date}]};
assert.equal(buildPushReminders(vacation).some(r=>r.kind==='shift'&&r.tag===`workertink-shift-${date}`),false);

const sick={...state,sickLeaves:[{start:date,end:date}]};
assert.equal(buildPushReminders(sick).some(r=>r.kind==='shift'&&r.tag===`workertink-shift-${date}`),false);

const disabled={...state,notifications:{...state.notifications,enabled:false}};
assert.deepEqual(buildPushReminders(disabled),[]);
console.log('WorkerTink reminder tests: OK');
