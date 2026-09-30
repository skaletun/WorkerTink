import assert from 'node:assert/strict';
import {DEFAULT,calcMonth,calcYear,getScheduledShift,avgIncome,vacationCalendarDays,vacationUsedDays,vacationProjectedUsedDays,isValidYmd,sickPayForDays} from '../src/core.ts';

const base={...DEFAULT,startDate:'2026-09-01',scheduleType:'5/2',taxRate:0,salary:100000};
const normal=calcMonth(base,2026,8);
const vacation=calcMonth({...base,vacations:[{start:'2026-09-07',end:'2026-09-11'}]},2026,8);
assert.ok(vacation.vacDays>0);
assert.ok(vacation.base<normal.base);
assert.ok(vacation.vacPay>0);
const sick=calcMonth({...base,sickLeaves:[{start:'2026-09-07',end:'2026-09-09'}]},2026,8);
assert.equal(sick.sickDays,3);
assert.ok(sick.base<normal.base);
const manual=calcMonth({...base,advances:{'2026-09':25000},paymentDates:{'2026-09':{advanceDate:'2026-09-15',remainderDate:'2026-10-05'}}},2026,8);
assert.equal(manual.advance,25000);
assert.equal(manual.remainder,manual.net-25000);
assert.equal(manual.paymentDates.remainderDate,'2026-10-05');
console.log('WorkerTink regression tests: OK');


// Зарплата не начисляется до даты выхода, а в месяце выхода считается только с этой даты.
const lateStart={...base,startDate:'2026-09-15'};
const beforeStart=calcMonth(lateStart,2026,7);
assert.equal(beforeStart.net,0);
const afterStart=calcMonth(lateStart,2026,8);
assert.ok(afterStart.work>0);
assert.ok(afterStart.work < normal.work);
// Неполный первый месяц оплачивается пропорционально полному числу смен месяца.
// Дата выхода — произвольная пользовательская дата, а не фиксированное значение.
for(const startDate of ['2026-09-03','2026-09-15','2026-09-22','2026-09-28']){
 const partialStart={...base,startDate,scheduleType:'5/2',salary:100000,taxRate:0};
 const fullSeptember=calcMonth({...partialStart,startDate:'2026-09-01'},2026,8);
 const partialSeptember=calcMonth(partialStart,2026,8);
 assert.equal(partialSeptember.base,Math.round(100000*partialSeptember.work/partialSeptember.scheduled));
 if(partialSeptember.work<partialSeptember.scheduled) assert.ok(partialSeptember.base<100000,`Если часть смен до выхода пропущена, оклад должен быть уменьшен: ${startDate}`);
}
// Если дата выхода — первое число месяца, месяц считается полностью.
const firstDay=calcMonth({...base,startDate:'2026-09-01',scheduleType:'5/2',salary:100000,taxRate:0},2026,8);
assert.equal(firstDay.base,100000);

// По умолчанию аванс равен половине указанного оклада и доступен для ручного переопределения.
const defaultAdvance=calcMonth({...base,salary:100000,advances:{}},2026,8);
assert.equal(defaultAdvance.advance,Math.min(defaultAdvance.net,50000));
assert.equal(defaultAdvance.advanceIsCustom,false);
const customAdvance=calcMonth({...base,salary:100000,advances:{'2026-09':30000}},2026,8);
assert.equal(customAdvance.advance,30000);
assert.equal(customAdvance.advanceIsCustom,true);
assert.equal(customAdvance.advance+customAdvance.remainder,customAdvance.net);
console.log('WorkerTink start-date and default-advance tests: OK');

// 2/2 всегда сохраняет два рабочих дня + два выходных.
// Для Д/Н смены внутри рабочей пары: День, Ночь, затем два выходных.
const dayNight={...base,startDate:'2026-09-01',scheduleType:'2/2',schedulePairType:'day-night'};
const sequence=[1,2,3,4,5,6,7,8].map(day=>getScheduledShift(dayNight,new Date(2026,8,day)));
assert.deepEqual(sequence,['day','night','off','off','day','night','off','off']);

const dayDay={...base,startDate:'2026-09-01',scheduleType:'2/2',schedulePairType:'day-day'};
assert.deepEqual([1,2,3,4,5,6,7,8].map(day=>getScheduledShift(dayDay,new Date(2026,8,day))),['day','day','off','off','day','day','off','off']);

const nightNight={...base,startDate:'2026-09-01',scheduleType:'2/2',schedulePairType:'night-night'};
assert.deepEqual([1,2,3,4,5,6,7,8].map(day=>getScheduledShift(nightNight,new Date(2026,8,day))),['night','night','off','off','night','night','off','off']);

// Проверяем все остальные циклические графики: количество рабочих и выходных
// дней в одном полном цикле должно соответствовать названию графика.
for(const [type,expected] of [['5/2', ['day','day','day','day','day','off','off']],['4/1',['day','day','day','day','off']],['3/2',['day','day','day','off','off']],['3/1',['day','day','day','off']],['6/1',['day','day','day','day','day','day','off']]]){
 const state={...base,startDate:'2026-09-01',scheduleType:type};
 assert.deepEqual(Array.from({length:expected.length},(_,i)=>getScheduledShift(state,new Date(2026,8,1+i))),expected,type);
}

// 7/0 не должен внезапно превращаться в цикл "вахта / такой же отдых": выходных в цикле нет.
const vakhta={...base,startDate:'2026-09-01',scheduleType:'7/0',scheduleShift:'day',scheduleVakhtaMonths:3};
assert.deepEqual(Array.from({length:14},(_,i)=>getScheduledShift(vakhta,new Date(2026,8,1+i))),Array(14).fill('day'));

// Даты выплат наследуются от последнего явно заданного месяца и автоматически сдвигаются на месяц.
const dated={...base,paymentDates:{
  '2026-09':{advanceDate:'2026-09-15',remainderDate:'2026-09-30'}
}};
assert.deepEqual(calcMonth(dated,2026,8).paymentDates,{advanceDate:'2026-09-15',remainderDate:'2026-09-30'});
assert.deepEqual(calcMonth(dated,2026,9).paymentDates,{advanceDate:'2026-10-15',remainderDate:'2026-10-30'});
assert.deepEqual(calcMonth(dated,2026,10).paymentDates,{advanceDate:'2026-11-15',remainderDate:'2026-11-30'});
const explicitOctober={...dated,paymentDates:{...dated.paymentDates,'2026-10':{advanceDate:'2026-10-14',remainderDate:'2026-10-29'}}};
assert.deepEqual(calcMonth(explicitOctober,2026,10).paymentDates,{advanceDate:'2026-11-14',remainderDate:'2026-11-29'});
console.log('WorkerTink 2/2 day-night and payment-date inheritance tests: OK');

// Ночные смены дают отдельную настраиваемую доплату, не меняя базовый оклад.
const nightPayState={...base,startDate:'2026-09-01',scheduleType:'2/2',schedulePairType:'day-night',salary:100000,taxRate:0,nightExtraPercent:20};
const nightPay=calcMonth(nightPayState,2026,8);
assert.ok(nightPay.nightWork>0);
assert.ok(nightPay.nightExtra>0);
assert.equal(nightPay.base,100000);

// Ручная смена в изначально выходной день считается отдельной сменой, а не ломает знаменатель оклада.
const extraShift=calcMonth({...base,startDate:'2026-09-01',scheduleType:'5/2',salary:100000,taxRate:0,shiftOverrides:{'2026-09-06':'day'}},2026,8);
assert.equal(extraShift.scheduled,normal.scheduled);
assert.ok(extraShift.extraPay>0);
assert.equal(extraShift.base,normal.base);

// История доходов выбирается хронологически, а не по порядку ключей объекта.
const incomeState={...base,incomeHistory:{'2026-01':100,'2026-03':300,'2026-02':200,'2026-04':400}};
assert.equal(Math.round(avgIncome(incomeState,3,'2026-05')),300);
assert.equal(Math.round(avgIncome(incomeState,3,'2026-04')),200);

// Отпуск: федеральный праздник внутри периода не расходует день отпуска.
const vacationPeriod={start:'2026-05-01',end:'2026-05-03'};
assert.equal(vacationCalendarDays(base,vacationPeriod),2);
console.log('WorkerTink payroll edge-case tests: OK');


// Некорректные календарные даты не принимаются.
assert.equal(isValidYmd('2026-02-28'),true);
assert.equal(isValidYmd('2026-02-29'),false);
assert.equal(isValidYmd('2026-13-01'),false);

// Пересечение отпуска и больничного не должно давать двойного начисления.
const overlap={...base,vacations:[{start:'2026-09-07',end:'2026-09-11'}],sickLeaves:[{start:'2026-09-09',end:'2026-09-10'}]};
const overlapCalc=calcMonth(overlap,2026,8);
assert.equal(overlapCalc.sickDays,2);
assert.equal(overlapCalc.vacDays,3);

// Остаток отпуска считает объединение периодов, а не сумму пересекающихся диапазонов.
const overlappingVacations={...base,vacations:[{start:'2026-09-07',end:'2026-09-11'},{start:'2026-09-09',end:'2026-09-15'}]};
assert.equal(vacationUsedDays(overlappingVacations),9);
assert.equal(vacationProjectedUsedDays({...base,vacations:[{start:'2026-09-07',end:'2026-09-11'}]},{start:'2026-09-10',end:'2026-09-15'}),9);

// Больничный симулятор использует тот же расчётный путь и ограничения, что и месячный payroll.
const sickState={...base,salary:100000,taxRate:0,stage:10};
assert.equal(sickPayForDays(sickState,2026,8,5),Math.round((100000*24/730)*5));
const sickLowIncome={...sickState,salary:1000};
assert.equal(sickPayForDays(sickLowIncome,2026,8,30),27093);

// Прогрессивный НДФЛ применяется нарастающим итогом для основной налоговой базы.
const highIncome={...base,salary:250000,taxRate:13,startDate:'2026-01-01',scheduleType:'5/2',holidayCoeff:1,nightExtraPercent:0};
const highYear=calcYear(highIncome,2026);
assert.equal(highYear.gross,3000000);
assert.equal(highYear.tax,402000);
assert.equal(highYear.net,2598000);
console.log('WorkerTink payroll hardening tests: OK');


// Ручная смена после завершения 7/0 не должна использовать делитель 1 час и раздувать выплату.
const endedVakhta={...base,startDate:'2026-01-01',scheduleType:'7/0',scheduleShift:'day',scheduleVakhtaMonths:1,salary:100000,taxRate:0,shiftOverrides:{'2026-02-02':'day'}};
const endedVakhtaCalc=calcMonth(endedVakhta,2026,1);
assert.equal(endedVakhtaCalc.scheduled,1);
assert.equal(endedVakhtaCalc.scheduledHours,1);
assert.equal(endedVakhtaCalc.extraPay,Math.round(100000/(28*8)*8));
