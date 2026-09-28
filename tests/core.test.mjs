import assert from 'node:assert/strict';
import {DEFAULT,isHoliday,parseYmd,getShift,getScheduledShift,calcMonth,calcYear,monthKey,shiftLabel} from '../src/core.ts';

assert.equal(isHoliday(parseYmd('2026-05-01')), true);
assert.equal(getScheduledShift({...DEFAULT,startDate:'2026-09-01',scheduleType:'5/2'},parseYmd('2026-09-06')), 'off');
assert.equal(getShift({...DEFAULT,startDate:'2026-09-01',scheduleType:'5/2',shiftOverrides:{'2026-09-06':'day'}},parseYmd('2026-09-06')), 'day');
const normal=calcMonth({...DEFAULT,startDate:'2026-05-01',scheduleType:'7/0',holidayCoeff:1},2026,4);
const premium=calcMonth({...DEFAULT,startDate:'2026-05-01',scheduleType:'7/0',holidayCoeff:2},2026,4);
assert.ok(premium.holidayWork>0);
assert.ok(premium.holidayExtra>normal.holidayExtra);
assert.equal(monthKey(2026,8),'2026-09');
console.log('WorkerTink core tests: OK');

// 7/0: пользовательский тип Сутки сохраняется и график остаётся непрерывным.
const fullState={...DEFAULT,setupComplete:true,scheduleType:'7/0',scheduleShift:'full',scheduleVakhtaMonths:1,startDate:'2026-09-01'};
assert.equal(getScheduledShift(fullState, new Date(2026,8,1)), 'full');
assert.equal(getScheduledShift(fullState, new Date(2026,8,60)), 'full');
assert.equal(shiftLabel('full'), 'Сутки');

const annual=calcYear({...DEFAULT,startDate:'2026-05-01',scheduleType:'7/0',holidayCoeff:2},2026);
assert.equal(annual.months.length,12);
assert.equal(annual.gross,annual.base+annual.holidayExtra+annual.vacPay+annual.sickPay);
assert.equal(annual.net,annual.gross-annual.tax);
assert.equal(annual.averageMonthlyNet,Math.round(annual.net/12));
assert.equal(annual.advance+annual.remainder,annual.net);
console.log('WorkerTink annual calculation tests: OK');
