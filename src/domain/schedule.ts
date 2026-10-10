import type {State,Period,ShiftValue,ShiftType} from './types.ts';
import {addDays,addMonths,daysBetween,isHoliday,isValidYmd,parseYmd,ymd} from './foundation.ts';

export function getCycleShift(state:State,date:Date):ShiftValue{
 const start=parseYmd(state.startDate); if(!Number.isFinite(start.getTime()))return 'off';
 const diff=daysBetween(start,date),type=state.scheduleType;
 if(type==='7/0'){
   const months=Math.max(1,state.scheduleVakhtaMonths),endExclusive=addMonths(start,months);
   return date>=start&&date<endExclusive?state.scheduleShift:date<start?state.scheduleShift:'off';
 }
 if(type==='2/2'){
   const pos=((diff%4)+4)%4,pair=state.schedulePairType.split('-') as [ShiftType,ShiftType];
   if(pos===0)return pair[0]; if(pos===1)return pair[1]; return 'off';
 }
 const [w,o]=type.split('/').map(Number),cycle=w+o,pos=((diff%cycle)+cycle)%cycle;
 return pos>=w?'off':state.scheduleShift;
}
export function getScheduledShift(state:State,date:Date):ShiftValue{
 const start=parseYmd(state.startDate); if(!Number.isFinite(start.getTime())||date<start)return 'off';
 return getCycleShift(state,date);
}
export function getShift(state:State,date:Date):ShiftValue{return state.shiftOverrides[ymd(date)] ?? getScheduledShift(state,date)}
export function periodContains(p:Period,date:string){return p.start<=date&&date<=p.end}
export function periodDays(p:Period){return Math.max(0,daysBetween(parseYmd(p.start),parseYmd(p.end))+1)}
export function periodsOverlap(a:Period,b:Period){return a.start<=b.end&&b.start<=a.end}
export function vacationCalendarDays(_state:State,p:Period){if(!isValidYmd(p.start)||!isValidYmd(p.end)||p.end<p.start)return 0;let n=0;for(let d=parseYmd(p.start);ymd(d)<=p.end;d=addDays(d,1)){if(!isHoliday(d))n++}return n}
export function vacationUsedDays(state:State){const days=new Set<string>();for(const p of state.vacations){if(!isValidYmd(p.start)||!isValidYmd(p.end)||p.end<p.start)continue;for(let d=parseYmd(p.start);ymd(d)<=p.end;d=addDays(d,1)){const key=ymd(d);if(!isHoliday(d)&&!state.sickLeaves.some(s=>periodContains(s,key)))days.add(key)}}return days.size}
export function vacationProjectedUsedDays(state:State,period:Period){const days=new Set<string>();for(const p of [...state.vacations,period]){if(!isValidYmd(p.start)||!isValidYmd(p.end)||p.end<p.start)continue;for(let d=parseYmd(p.start);ymd(d)<=p.end;d=addDays(d,1)){const key=ymd(d);if(!isHoliday(d)&&!state.sickLeaves.some(s=>periodContains(s,key)))days.add(key)}}return days.size}

