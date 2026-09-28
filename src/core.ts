export type ScheduleType='5/2'|'4/1'|'3/2'|'3/1'|'6/1'|'2/2'|'7/0';
export type ShiftType='day'|'night'|'full';
export type ShiftValue=ShiftType|'off';
export type PairType='day-day'|'day-night'|'night-night';
export interface Period {start:string; end:string}
export interface PaymentDates {advanceDate:string; remainderDate:string}
export interface IncomeHistory {[key:string]:number}
export interface State {
  setupComplete:boolean;
  salary:number; taxRate:number; stage:number; vacTotal:number; startDate:string;
  scheduleType:ScheduleType; scheduleShift:ShiftType; scheduleVakhtaMonths:number; schedulePairType:PairType;
  vacations:Period[]; sickLeaves:Period[];
  holidayCoeff:number;
  advances:Record<string,number>;
  paymentDates:Record<string,PaymentDates>;
  incomeHistory:IncomeHistory;
  shiftOverrides:Record<string,ShiftValue>;
  shiftNotes:Record<string,string>;
  theme:'auto'|'light'|'dark';
}
export const MONTHS=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
export const DOW=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const pad=(n:number)=>String(n).padStart(2,'0');
const todayYmd=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
export const DEFAULT:State={setupComplete:false,salary:95000,taxRate:13,stage:10,vacTotal:28,startDate:todayYmd(),scheduleType:'2/2',scheduleShift:'day',scheduleVakhtaMonths:1,schedulePairType:'day-night',vacations:[],sickLeaves:[],holidayCoeff:2,advances:{},paymentDates:{},incomeHistory:{},shiftOverrides:{},shiftNotes:{},theme:'auto'};
const HOLIDAYS=[[1,1,'Новогодние каникулы'],[1,2,'Новогодние каникулы'],[1,3,'Новогодние каникулы'],[1,4,'Новогодние каникулы'],[1,5,'Новогодние каникулы'],[1,6,'Новогодние каникулы'],[1,7,'Рождество Христово'],[1,8,'Новогодние каникулы'],[2,23,'День защитника Отечества'],[3,8,'Международный женский день'],[5,1,'Праздник Весны и Труда'],[5,9,'День Победы'],[6,12,'День России'],[11,4,'День народного единства']] as const;
export const TRANSFERS:Record<number,Record<string,string>>={2025:{'2025-01-02':'2025-05-02','2025-01-03':'2025-12-31','2025-02-23':'2025-05-08','2025-03-08':'2025-06-13','2025-11-01':'2025-11-03'},2026:{'2026-01-03':'2026-01-09','2026-01-04':'2026-12-31'}};
export const ymd=(d:Date)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
export const parseYmd=(s:string)=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
export const addDays=(d:Date,n:number)=>{const r=new Date(d);r.setDate(r.getDate()+n);return r};
export const daysBetween=(a:Date,b:Date)=>Math.round((Date.UTC(b.getFullYear(),b.getMonth(),b.getDate())-Date.UTC(a.getFullYear(),a.getMonth(),a.getDate()))/86400000);
export const isHoliday=(d:Date)=>HOLIDAYS.some(([m,day])=>m===d.getMonth()+1&&day===d.getDate());
export const holidayName=(d:Date)=>HOLIDAYS.find(([m,day])=>m===d.getMonth()+1&&day===d.getDate())?.[2]||'';
export const isTransferredWeekend=(d:Date)=>Object.values(TRANSFERS[d.getFullYear()]||{}).includes(ymd(d));
export function getScheduledShift(state:State,date:Date):ShiftValue{
 const diff=daysBetween(parseYmd(state.startDate),date),type=state.scheduleType;
 if(type==='7/0'){
  // 7/0 = непрерывная работа без выходных. Параметр длительности
  // вахты не меняет сам цикл: у графика 0 выходных дней.
  return state.scheduleShift as ShiftType;
 }
 if(type==='2/2'){
  // 2/2 всегда состоит из двух рабочих дней и двух выходных.
  // Вариант пары задаёт смены внутри рабочих двух дней:
  // Д/Д -> день, день, выходной, выходной
  // Д/Н -> день, ночь, выходной, выходной
  // Н/Н -> ночь, ночь, выходной, выходной
  const pos=((diff%4)+4)%4,
        pair=state.schedulePairType.split('-') as [ShiftType,ShiftType];
  if(pos<2)return pair[pos];
  return 'off';
 }
 const [w,o]=type.split('/').map(Number),cycle=w+o,pos=((diff%cycle)+cycle)%cycle;
 if(pos>=w)return'off';
 return state.scheduleShift;
}
export function getShift(state:State,date:Date):ShiftValue{return state.shiftOverrides[ymd(date)] ?? getScheduledShift(state,date)}
export function periodContains(p:Period,date:string){return p.start<=date&&date<=p.end}
export function periodDays(p:Period){return Math.max(0,daysBetween(parseYmd(p.start),parseYmd(p.end))+1)}
export function vacationCalendarDays(_state:State,p:Period){let n=0;for(let d=parseYmd(p.start);ymd(d)<=p.end;d=addDays(d,1)){if(!isHoliday(d))n++}return n}
export function avgIncome(state:State,months=12){const vals=Object.values(state.incomeHistory).filter(v=>Number.isFinite(v)&&v>=0);if(!vals.length)return state.salary;const take=vals.slice(-months);return take.reduce((a,b)=>a+b,0)/take.length}
export function calcMonth(state:State,year:number,month:number){
 const start=new Date(year,month,1),end=new Date(year,month+1,0),employmentStart=parseYmd(state.startDate);
 // До даты выхода зарплата не начисляется. В месяце выхода расчёт начинается именно с этой даты.
 if(end<employmentStart){
  const pd=getPaymentDates(state,year,month);
  return {year,month,work:0,holidayWork:0,vacDays:0,sickDays:0,base:0,holidayExtra:0,vacPay:0,sickPay:0,gross:0,tax:0,net:0,advance:0,remainder:0,paymentDates:pd,sickRate:state.stage<5?.6:state.stage<8?.8:1,scheduled:0,advanceIsCustom:false};
 }
 const accrualStart=start<employmentStart?employmentStart:start;
 // Знаменатель оклада всегда берём за полный календарный месяц по графику.
 // Иначе при выходе, например, 22.09, оставшиеся смены ошибочно дают 100% оклада.
 let scheduledFullMonth=0,scheduled=0,work=0,holidayWork=0,vacDays=0,sickDays=0;
 for(let d=new Date(start);d<=end;d=addDays(d,1)){if(getScheduledShift(state,d)!=='off')scheduledFullMonth++;}
 for(let d=new Date(accrualStart);d<=end;d=addDays(d,1)){const key=ymd(d),shift=getShift(state,d),onVacation=state.vacations.some(p=>periodContains(p,key)),onSick=state.sickLeaves.some(p=>periodContains(p,key));if(getScheduledShift(state,d)!=='off')scheduled++;if(onVacation&&!isHoliday(d))vacDays++;if(onSick)sickDays++;if(shift!=='off'&&!onVacation&&!onSick){work++;if(isHoliday(d))holidayWork++}}
 const scheduledDays=Math.max(1,scheduledFullMonth),shiftValue=state.salary/scheduledDays,base=Math.round(state.salary*work/scheduledDays);
 const holidayExtra=Math.round(shiftValue*holidayWork*Math.max(0,state.holidayCoeff-1));
 const vacPay=Math.round(avgIncome(state,12)/29.3*vacDays);
 // Стаж влияет на оплату больничного: <5 лет — 60%, 5–8 лет — 80%, 8+ — 100%.
 const sickRate=state.stage<5?.6:state.stage<8?.8:1;
 const sickPay=Math.round(avgIncome(state,24)/730*sickRate*sickDays);
 const gross=base+holidayExtra+vacPay+sickPay,tax=Math.round(gross*state.taxRate/100),net=Math.max(0,gross-tax),key=monthKey(year,month),pd=getPaymentDates(state,year,month);
 const advanceIsCustom=Object.prototype.hasOwnProperty.call(state.advances,key);
 // По умолчанию аванс = 50% указанного оклада. Для неполного месяца он не может превышать сумму на руки.
 const defaultAdvance=Math.min(net,Math.max(0,state.salary*0.5));
 const customAdvance=Math.max(0,Number(state.advances[key])||0);
 const advance=Math.min(net,advanceIsCustom?customAdvance:defaultAdvance);
 return {year,month,work,holidayWork,vacDays,sickDays,base,holidayExtra,vacPay,sickPay,gross,tax,net,advance,remainder:Math.max(0,net-advance),paymentDates:pd,sickRate,scheduled:scheduledDays,advanceIsCustom};
}
export interface AnnualCalc {
 year:number;
 months:ReturnType<typeof calcMonth>[];
 work:number;
 holidayWork:number;
 vacDays:number;
 sickDays:number;
 base:number;
 holidayExtra:number;
 vacPay:number;
 sickPay:number;
 gross:number;
 tax:number;
 net:number;
 advance:number;
 remainder:number;
 averageMonthlyNet:number;
}
export function calcYear(state:State,year:number):AnnualCalc{
 const months=Array.from({length:12},(_,month)=>calcMonth(state,year,month));
 const sum=(key:keyof ReturnType<typeof calcMonth>)=>months.reduce((total,item)=>total+Number(item[key]||0),0);
 const net=sum('net');
 return {year,months,work:sum('work'),holidayWork:sum('holidayWork'),vacDays:sum('vacDays'),sickDays:sum('sickDays'),base:sum('base'),holidayExtra:sum('holidayExtra'),vacPay:sum('vacPay'),sickPay:sum('sickPay'),gross:sum('gross'),tax:sum('tax'),net,advance:sum('advance'),remainder:sum('remainder'),averageMonthlyNet:Math.round(net/12)};
}
export function getAvgShiftsPerMonth(s:State){if(s.scheduleType==='7/0')return 30;const [w,o]=s.scheduleType.split('/').map(Number);return 30*w/(w+o)}
export function monthKey(y:number,m:number){return `${y}-${pad(m+1)}`}
const EMPTY_PAYMENT_DATES:PaymentDates={advanceDate:'',remainderDate:''};
function shiftDateByMonths(value:string,delta:number){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!delta)return value;
 const [y,m,d]=value.split('-').map(Number);
 const target=new Date(y,m-1+delta,1);
 const lastDay=new Date(target.getFullYear(),target.getMonth()+1,0).getDate();
 return `${target.getFullYear()}-${pad(target.getMonth()+1)}-${pad(Math.min(d,lastDay))}`;
}
function paymentFieldFromHistory(state:State,year:number,month:number,field:'advanceDate'|'remainderDate'){
 const targetIndex=year*12+month;
 for(let index=targetIndex-1;index>=targetIndex-120;index--){
  const sourceYear=Math.floor(index/12),sourceMonth=((index%12)+12)%12;
  const source=state.paymentDates[monthKey(sourceYear,sourceMonth)];
  const value=source?.[field];
  if(value)return shiftDateByMonths(value,targetIndex-index);
 }
 return '';
}
export function getPaymentDates(state:State,year:number,month:number):PaymentDates{
 const explicit=state.paymentDates[monthKey(year,month)]||EMPTY_PAYMENT_DATES;
 return {
  advanceDate:explicit.advanceDate||paymentFieldFromHistory(state,year,month,'advanceDate'),
  remainderDate:explicit.remainderDate||paymentFieldFromHistory(state,year,month,'remainderDate')
 };
}
export function formatMoney(n:number){return new Intl.NumberFormat('ru-RU').format(Math.round(n))+' ₽'}
export function shiftLabel(v:ShiftValue){return v==='day'?'День':v==='night'?'Ночь':v==='full'?'Сутки':'Выходной'}
