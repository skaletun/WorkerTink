import type {State} from '../core.ts';
import {getScheduledShift,ymd} from '../core.ts';

export function buildPushReminders(state:State){
 const reminders:{id:string;kind:'shift'|'absence'|'payroll';dueAt:number;title:string;body:string;tag:string}[]=[];
 const now=new Date();
 const pushAt=(date:Date,hour:number,minute:number)=>{const d=new Date(date);d.setHours(hour,minute,0,0);return d.getTime()};
 if(state.notifications.shifts){
  for(let i=0;i<90;i++){const date=new Date(now.getFullYear(),now.getMonth(),now.getDate()+i);const shift=getScheduledShift(state,date);if(shift==='off')continue;const hour=shift==='night'?20:8;const dueAt=pushAt(date,hour,0);if(dueAt<Date.now()+30*1000)continue;const dateKey=ymd(date);reminders.push({id:`shift:${dateKey}:${shift}`,kind:'shift',dueAt,title:'Предстоящая смена',body:`Сегодня ${shift==='night'?'ночная':shift==='full'?'суточная':'дневная'} смена.`,tag:`workertink-shift-${dateKey}`})}
 }
 if(state.notifications.absences){
  for(const period of [...state.vacations.map(p=>({...p,kind:'Отпуск'})),...state.sickLeaves.map(p=>({...p,kind:'Больничный'}))]){const dueAt=pushAt(new Date(`${period.start}T12:00:00`),9,0);if(dueAt>=Date.now()-24*60*60*1000)reminders.push({id:`absence:${period.kind}:${period.start}:${period.end}`,kind:'absence',dueAt,title:`Начало: ${period.kind}`,body:`Период начинается ${period.start}.`,tag:`workertink-absence-${period.start}-${period.kind}`})}
 }
 if(state.notifications.payroll){
  for(const [month,payment] of Object.entries(state.paymentDates)){for(const [kind,label] of [['advanceDate','Аванс'],['remainderDate','Остаток']] as const){const date=payment[kind];if(!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;const dueAt=pushAt(new Date(`${date}T12:00:00`),9,0);if(dueAt<Date.now()-24*60*60*1000)continue;reminders.push({id:`payroll:${month}:${kind}:${date}`,kind:'payroll',dueAt,title:`Дата выплаты: ${label}`,body:`Сегодня запланирована выплата — ${label.toLowerCase()}.`,tag:`workertink-pay-${month}-${kind}`})}}
 }
 return reminders.sort((a,b)=>a.dueAt-b.dueAt).slice(0,180);
}
