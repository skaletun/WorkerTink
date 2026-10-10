import type {State,Period,PaymentDates,ShiftValue} from './types';
import {addDays,daysBetween,isHoliday,isValidYmd,monthKey,parseYmd,ymd} from './foundation';
import {getCycleShift,getScheduledShift,getShift} from './schedule';

function monthIndex(year:number,month:number){return year*12+month}
function historyValue(state:State,index:number){const y=Math.floor(index/12),m=((index%12)+12)%12,key=monthKey(y,m),value=state.incomeHistory[key];return Number.isFinite(value)&&value>=0?value:state.salary}
export function avgIncome(state:State,months=12,throughMonth?:string){
 const upper=throughMonth&&/^\d{4}-\d{2}$/.test(throughMonth)?throughMonth:'9999-12';
 const entries=Object.entries(state.incomeHistory).filter(([key,v])=>/^\d{4}-\d{2}$/.test(key)&&Number.isFinite(v)&&v>=0&&key<upper).sort(([a],[b])=>a.localeCompare(b));
 const take=entries.slice(-Math.max(1,Math.floor(months))).map(([,v])=>v);
 return take.length?take.reduce((a,b)=>a+b,0)/take.length:state.salary;
}
function payrollAverageMonthlyIncome(state:State,months:number,throughMonth:string){
 const [y,m]=throughMonth.split('-').map(Number),through=monthIndex(y,m-1),count=Math.max(1,Math.floor(months));let sum=0;
 for(let i=count;i>=1;i--)sum+=historyValue(state,through-i);
 return sum/count;
}
function vacationDailyAverage(state:State,throughMonth:string){
 const [y,m]=throughMonth.split('-').map(Number);
 const endExclusive=new Date(y,m-1,1),windowStart=new Date(y,m-13,1),employmentStart=parseYmd(state.startDate);
 let incomeTotal=0,dayFactorTotal=0;
 for(let cursor=new Date(windowStart);cursor<endExclusive;cursor.setMonth(cursor.getMonth()+1)){
   const monthStart=new Date(cursor.getFullYear(),cursor.getMonth(),1),monthEnd=new Date(cursor.getFullYear(),cursor.getMonth()+1,0);
   if(monthEnd<employmentStart)continue;
   const employedStart=monthStart<employmentStart?employmentStart:monthStart;
   const calendarDays=monthEnd.getDate(),employedDays=Math.max(0,calendarDays-(employedStart.getDate()-1));
   if(!employedDays)continue;
   const key=monthKey(cursor.getFullYear(),cursor.getMonth()),raw=state.incomeHistory[key];
   const monthlyIncome=Number.isFinite(raw)&&raw>=0?raw:state.salary*(employedDays/calendarDays);
   const factor=employedDays===calendarDays?1:employedDays/calendarDays;
   incomeTotal+=monthlyIncome;dayFactorTotal+=29.3*factor;
 }
 return dayFactorTotal>0?incomeTotal/dayFactorTotal:state.salary/29.3;
}

function shiftHours(state:State,shift:ShiftValue){return shift==='full'?(state.scheduleType==='7/0'?24:8):shift==='off'?0:8}
function periodSet(periods:Period[],start:Date,end:Date){const out=new Set<string>();for(const p of periods){if(!isValidYmd(p.start)||!isValidYmd(p.end)||p.end<p.start)continue;const a=parseYmd(p.start)>start?parseYmd(p.start):start,b=parseYmd(p.end)<end?parseYmd(p.end):end;if(a>b)continue;for(let d=new Date(a);d<=b;d=addDays(d,1))out.add(ymd(d))}return out}
function sickRateForStage(stage:number){return stage<8?(stage<5?.6:.8):1}
export function sickPayForDays(state:State,year:number,month:number,days:number){
 const safeDays=Math.max(0,Math.floor(Number(days)||0));if(!safeDays)return 0;
 const end=new Date(year,month+1,0),dailyBase=payrollAverageMonthlyIncome(state,24,monthKey(year,month))*24/730*sickRateForStage(state.stage);
 const minDaily=year===2026?27093/end.getDate():0;
 const maxDaily=year===2026?6827.40:Infinity;
 return Math.round(Math.min(maxDaily,Math.max(minDaily,dailyBase))*safeDays);
}

type GrossCalc={
 year:number;month:number;work:number;nightWork:number;holidayWork:number;vacDays:number;sickDays:number;
 base:number;extraPay:number;holidayExtra:number;nightExtra:number;vacPay:number;sickPay:number;gross:number;
 sickRate:number;scheduled:number;scheduledHours:number;workHours:number;plannedWorkHours:number;extraWorkHours:number;
};
function calcMonthGross(state:State,year:number,month:number):GrossCalc{
 const start=new Date(year,month,1),end=new Date(year,month+1,0),employmentStart=parseYmd(state.startDate);
 const sickRate=sickRateForStage(state.stage);
 if(!Number.isFinite(employmentStart.getTime())||end<employmentStart)return {year,month,work:0,nightWork:0,holidayWork:0,vacDays:0,sickDays:0,base:0,extraPay:0,holidayExtra:0,nightExtra:0,vacPay:0,sickPay:0,gross:0,sickRate,scheduled:0,scheduledHours:0,workHours:0,plannedWorkHours:0,extraWorkHours:0};
 let scheduled=0,scheduledHours=0,work=0,nightWork=0,holidayWork=0,holidayWorkHours=0,workHours=0,plannedWorkHours=0,extraWorkHours=0,vacDays=0,sickDays=0;
 for(let d=new Date(start);d<=end;d=addDays(d,1)){const scheduledShift=getCycleShift(state,d);if(scheduledShift!=='off'){scheduled++;scheduledHours+=shiftHours(state,scheduledShift)}}
 const accrualStart=start<employmentStart?employmentStart:start;
 const vacations=periodSet(state.vacations,start,end),sicks=periodSet(state.sickLeaves,start,end);
 for(let d=new Date(accrualStart);d<=end;d=addDays(d,1)){
   const key=ymd(d),onSick=sicks.has(key),onVacation=!onSick&&vacations.has(key),shift=getShift(state,d),scheduledShift=getScheduledShift(state,d);
   if(onVacation&&!isHoliday(d))vacDays++;
   if(onSick)sickDays++;
   if(shift!=='off'&&!onVacation&&!onSick){
     const hours=shiftHours(state,shift);work++;workHours+=hours;
     if(scheduledShift!=='off')plannedWorkHours+=hours;else extraWorkHours+=hours;
     if(shift==='night')nightWork++;
     if(isHoliday(d)){holidayWork++;holidayWorkHours+=hours}
   }
 }
 const scheduledSafe=Math.max(1,scheduled),scheduledHoursSafe=Math.max(1,scheduledHours),rateHours=scheduledHours>0?scheduledHours:state.scheduleType==='7/0'?Math.max(1,end.getDate()*shiftHours(state,state.scheduleShift)):1,hourValue=state.salary/rateHours;
 const base=Math.round(state.salary*plannedWorkHours/scheduledHoursSafe);
 const extraPay=Math.round(hourValue*extraWorkHours);
 const holidayExtra=Math.round(hourValue*holidayWorkHours*Math.max(0,state.holidayCoeff-1));
 const nightExtra=Math.round(hourValue*nightWork*8*Math.max(0,state.nightExtraPercent)/100);
 const vacPay=Math.round(vacationDailyAverage(state,monthKey(year,month))*vacDays);
 const sickPay=sickPayForDays(state,year,month,sickDays);
 return {year,month,work,nightWork,holidayWork,vacDays,sickDays,base,extraPay,holidayExtra,nightExtra,vacPay,sickPay,gross:base+extraPay+holidayExtra+nightExtra+vacPay+sickPay,sickRate,scheduled:scheduledSafe,scheduledHours:scheduledHoursSafe,workHours,plannedWorkHours,extraWorkHours};
}

function progressiveNdfL(base:number){
 const x=Math.max(0,base);
 const tiers=[[2400000,.13],[5000000,.15],[20000000,.18],[50000000,.20],[Infinity,.22]] as const;
 let prev=0,tax=0;for(const [limit,rate] of tiers){const part=Math.max(0,Math.min(x,limit)-prev);tax+=part*rate;prev=limit;if(x<=limit)break}return Math.round(tax);
}
function monthTax(state:State,year:number,month:number,currentGross:number){
 const rate=Number(state.taxRate);
 if(!Number.isFinite(rate)||rate<=0)return 0;
 if([13,15,18,20,22].includes(rate)){
   let previousGross=0;for(let m=0;m<month;m++)previousGross+=calcMonthGross(state,year,m).gross;
   return Math.max(0,progressiveNdfL(previousGross+currentGross)-progressiveNdfL(previousGross));
 }
 return Math.round(currentGross*rate/100);
}

export function calcMonth(state:State,year:number,month:number){
 const grossCalc=calcMonthGross(state,year,month),tax=monthTax(state,year,month,grossCalc.gross),net=Math.max(0,grossCalc.gross-tax),key=monthKey(year,month),pd=getPaymentDates(state,year,month);
 const advanceIsCustom=Object.prototype.hasOwnProperty.call(state.advances,key),defaultAdvance=Math.min(net,Math.max(0,state.salary*0.5)),customAdvance=Math.max(0,Number(state.advances[key])||0),advance=Math.min(net,advanceIsCustom?customAdvance:defaultAdvance);
 return {...grossCalc,tax,net,advance,remainder:Math.max(0,net-advance),paymentDates:pd,advanceIsCustom};
}
export interface AnnualCalc {year:number;months:ReturnType<typeof calcMonth>[];work:number;nightWork:number;holidayWork:number;vacDays:number;sickDays:number;base:number;extraPay:number;holidayExtra:number;nightExtra:number;vacPay:number;sickPay:number;gross:number;tax:number;net:number;advance:number;remainder:number;averageMonthlyNet:number;}
export function calcYear(state:State,year:number):AnnualCalc{const months=Array.from({length:12},(_,month)=>calcMonth(state,year,month));const sum=(key:keyof ReturnType<typeof calcMonth>)=>months.reduce((total,item)=>total+Number(item[key]||0),0);const net=sum('net');return {year,months,work:sum('work'),nightWork:sum('nightWork'),holidayWork:sum('holidayWork'),vacDays:sum('vacDays'),sickDays:sum('sickDays'),base:sum('base'),extraPay:sum('extraPay'),holidayExtra:sum('holidayExtra'),nightExtra:sum('nightExtra'),vacPay:sum('vacPay'),sickPay:sum('sickPay'),gross:sum('gross'),tax:sum('tax'),net,advance:sum('advance'),remainder:sum('remainder'),averageMonthlyNet:Math.round(net/12)}}
export function getAvgShiftsPerMonth(s:State){if(s.scheduleType==='7/0')return 30;const [w,o]=s.scheduleType.split('/').map(Number);return 30*w/(w+o)}
const EMPTY_PAYMENT_DATES:PaymentDates={advanceDate:'',remainderDate:''};
function shiftDateByMonths(value:string,delta:number){if(!isValidYmd(value)||!delta)return value;const [y,m,d]=value.split('-').map(Number);const target=new Date(y,m-1+delta,1),lastDay=new Date(target.getFullYear(),target.getMonth()+1,0).getDate();return `${target.getFullYear()}-${pad(target.getMonth()+1)}-${pad(Math.min(d,lastDay))}`}
function paymentFieldFromHistory(state:State,year:number,month:number,field:'advanceDate'|'remainderDate'){const targetIndex=year*12+month;for(let index=targetIndex-1;index>=targetIndex-120;index--){const sourceYear=Math.floor(index/12),sourceMonth=((index%12)+12)%12,source=state.paymentDates[monthKey(sourceYear,sourceMonth)],value=source?.[field];if(value&&isValidYmd(value))return shiftDateByMonths(value,targetIndex-index)}return ''}
export function getPaymentDates(state:State,year:number,month:number):PaymentDates{const explicit=state.paymentDates[monthKey(year,month)]||EMPTY_PAYMENT_DATES;return {advanceDate:isValidYmd(explicit.advanceDate)?explicit.advanceDate:paymentFieldFromHistory(state,year,month,'advanceDate'),remainderDate:isValidYmd(explicit.remainderDate)?explicit.remainderDate:paymentFieldFromHistory(state,year,month,'remainderDate')}}
export function formatMoney(n:number){return new Intl.NumberFormat('ru-RU').format(Math.round(n))+' ₽'}
export function shiftLabel(v:ShiftValue){return v==='day'?'День':v==='night'?'Ночь':v==='full'?'Сутки':'Выходной'}
