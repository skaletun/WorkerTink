export type ScheduleType='5/2'|'4/1'|'3/2'|'3/1'|'6/1'|'2/2'|'7/0';
export type ShiftType='day'|'night'|'full';
export type ShiftValue=ShiftType|'off';
export type PairType='day-day'|'day-night'|'night-night';
export interface Period {start:string; end:string}
export interface PaymentDates {advanceDate:string; remainderDate:string}
export interface IncomeHistory {[key:string]:number}
export interface UserProfile {profileId:string;name:string;position:string;avatar:string;username?:string|null;isDev?:boolean;isAdmin?:boolean}
export interface Friend {profile:UserProfile;addedAt:number;lastSeen:number;connected?:boolean;online?:boolean}
export interface FriendRequest {id:string;from:UserProfile;to:UserProfile;createdAt:number;status:'pending'|'accepted'|'declined'}
export interface ChatMessage {id:string;from:string;at:number;type:'text'|'profile'|'note';text?:string;profile?:UserProfile;note?:{date:string;note:string;shift?:string}}
export interface NotificationSettings {enabled:boolean;friendRequests:boolean;friendAccepted:boolean;messages:boolean;groupMessages:boolean;channelInvites:boolean;social:boolean;events:boolean;shifts:boolean;absences:boolean;payroll:boolean}
export interface State {
  schemaVersion:number; setupComplete:boolean;
  salary:number; taxRate:number; stage:number; vacTotal:number; startDate:string;
  scheduleType:ScheduleType; scheduleShift:ShiftType; scheduleVakhtaMonths:number; schedulePairType:PairType;
  vacations:Period[]; sickLeaves:Period[]; holidayCoeff:number; nightExtraPercent:number;
  advances:Record<string,number>; paymentDates:Record<string,PaymentDates>; incomeHistory:IncomeHistory;
  shiftOverrides:Record<string,ShiftValue>; shiftNotes:Record<string,string>;
  theme:'auto'|'light'|'dark'; profile:UserProfile; directoryToken:string;
  friends:Record<string,Friend>; friendRequestsIncoming:FriendRequest[]; friendRequestsOutgoing:FriendRequest[];
  chats:Record<string,ChatMessage[]>; notifications:NotificationSettings; onePassEnabled:boolean;
}
export const MONTHS=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
export const DOW=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const pad=(n:number)=>String(n).padStart(2,'0');
const todayYmd=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
export const createWTinkId=()=>`WTinkID-${Math.floor(100000+Math.random()*900000)}`;
export const normalizeWTinkId=(value:string)=>{const match=String(value||'').trim().match(/^WTINKID-(\d{6})$/i);return match?`WTinkID-${match[1]}`:''};
export const canonicalWTinkId=(value:string)=>{const normalized=normalizeWTinkId(value);return normalized?normalized.toUpperCase():''};
export const DEFAULT:State={schemaVersion:8,setupComplete:false,salary:95000,taxRate:13,stage:10,vacTotal:28,startDate:todayYmd(),scheduleType:'2/2',scheduleShift:'day',scheduleVakhtaMonths:1,schedulePairType:'day-night',vacations:[],sickLeaves:[],holidayCoeff:2,nightExtraPercent:20,advances:{},paymentDates:{},incomeHistory:{},shiftOverrides:{},shiftNotes:{},theme:'auto',profile:{profileId:'',name:'',position:'',avatar:'',isDev:false},directoryToken:'',friends:{},friendRequestsIncoming:[],friendRequestsOutgoing:[],chats:{},notifications:{enabled:true,friendRequests:true,friendAccepted:true,messages:true,groupMessages:true,channelInvites:true,social:true,events:true,shifts:true,absences:true,payroll:true},onePassEnabled:false};
const HOLIDAYS=[[1,1,'Новогодние каникулы'],[1,2,'Новогодние каникулы'],[1,3,'Новогодние каникулы'],[1,4,'Новогодние каникулы'],[1,5,'Новогодние каникулы'],[1,6,'Новогодние каникулы'],[1,7,'Рождество Христово'],[1,8,'Новогодние каникулы'],[2,23,'День защитника Отечества'],[3,8,'Международный женский день'],[5,1,'Праздник Весны и Труда'],[5,9,'День Победы'],[6,12,'День России'],[11,4,'День народного единства']] as const;
export const TRANSFERS:Record<number,Record<string,string>>={2025:{'2025-01-02':'2025-05-02','2025-01-03':'2025-12-31','2025-02-23':'2025-05-08','2025-03-08':'2025-06-13','2025-11-01':'2025-11-03'},2026:{'2026-01-03':'2026-01-09','2026-01-04':'2026-12-31'}};
export const ymd=(d:Date)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
export const isValidYmd=(value:string)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return false;const [y,m,d]=value.split('-').map(Number);const date=new Date(y,m-1,d);return date.getFullYear()===y&&date.getMonth()===m-1&&date.getDate()===d};
export const parseYmd=(s:string)=>{if(!isValidYmd(s))return new Date(NaN);const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
export const addDays=(d:Date,n:number)=>{const r=new Date(d);r.setDate(r.getDate()+n);return r};
export const addMonths=(d:Date,n:number)=>{const r=new Date(d);const day=r.getDate();r.setDate(1);r.setMonth(r.getMonth()+n);r.setDate(Math.min(day,new Date(r.getFullYear(),r.getMonth()+1,0).getDate()));return r};
export const daysBetween=(a:Date,b:Date)=>Math.round((Date.UTC(b.getFullYear(),b.getMonth(),b.getDate())-Date.UTC(a.getFullYear(),a.getMonth(),a.getDate()))/86400000);
export const isHoliday=(d:Date)=>HOLIDAYS.some(([m,day])=>m===d.getMonth()+1&&day===d.getDate());
export const holidayName=(d:Date)=>HOLIDAYS.find(([m,day])=>m===d.getMonth()+1&&day===d.getDate())?.[2]||'';
export const isTransferredWeekend=(d:Date)=>Object.values(TRANSFERS[d.getFullYear()]||{}).includes(ymd(d));

function getCycleShift(state:State,date:Date):ShiftValue{
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
 const scheduledSafe=Math.max(1,scheduled),scheduledHoursSafe=Math.max(1,scheduledHours),hourValue=state.salary/scheduledHoursSafe;
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
export function monthKey(y:number,m:number){return `${y}-${pad(m+1)}`}
const EMPTY_PAYMENT_DATES:PaymentDates={advanceDate:'',remainderDate:''};
function shiftDateByMonths(value:string,delta:number){if(!isValidYmd(value)||!delta)return value;const [y,m,d]=value.split('-').map(Number);const target=new Date(y,m-1+delta,1),lastDay=new Date(target.getFullYear(),target.getMonth()+1,0).getDate();return `${target.getFullYear()}-${pad(target.getMonth()+1)}-${pad(Math.min(d,lastDay))}`}
function paymentFieldFromHistory(state:State,year:number,month:number,field:'advanceDate'|'remainderDate'){const targetIndex=year*12+month;for(let index=targetIndex-1;index>=targetIndex-120;index--){const sourceYear=Math.floor(index/12),sourceMonth=((index%12)+12)%12,source=state.paymentDates[monthKey(sourceYear,sourceMonth)],value=source?.[field];if(value&&isValidYmd(value))return shiftDateByMonths(value,targetIndex-index)}return ''}
export function getPaymentDates(state:State,year:number,month:number):PaymentDates{const explicit=state.paymentDates[monthKey(year,month)]||EMPTY_PAYMENT_DATES;return {advanceDate:isValidYmd(explicit.advanceDate)?explicit.advanceDate:paymentFieldFromHistory(state,year,month,'advanceDate'),remainderDate:isValidYmd(explicit.remainderDate)?explicit.remainderDate:paymentFieldFromHistory(state,year,month,'remainderDate')}}
export function formatMoney(n:number){return new Intl.NumberFormat('ru-RU').format(Math.round(n))+' ₽'}
export function shiftLabel(v:ShiftValue){return v==='day'?'День':v==='night'?'Ночь':v==='full'?'Сутки':'Выходной'}
