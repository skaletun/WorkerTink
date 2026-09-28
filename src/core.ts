export type ScheduleType='5/2'|'4/1'|'3/2'|'3/1'|'6/1'|'2/2'|'7/0';
export type ShiftType='day'|'night'|'full';
export type ShiftValue=ShiftType|'off';
export type PairType='day-day'|'day-night'|'night-night';
export interface Period {start:string; end:string}
export interface PaymentDates {advanceDate:string; remainderDate:string}
export interface IncomeHistory {[key:string]:number}
export interface UserProfile {profileId:string;name:string;position:string;avatar:string}
export interface Friend {profile:UserProfile;addedAt:number;lastSeen:number;connected?:boolean}
export interface FriendRequest {id:string;from:UserProfile;to:UserProfile;createdAt:number;status:'pending'|'accepted'|'declined'}
export interface ChatMessage {id:string;from:string;at:number;type:'text'|'profile'|'note';text?:string;profile?:UserProfile;note?:{date:string;note:string;shift?:string}}
export interface NotificationSettings {enabled:boolean;friendRequests:boolean;friendAccepted:boolean;messages:boolean;shifts:boolean;absences:boolean;payroll:boolean}
export interface State {
  schemaVersion:number;
  setupComplete:boolean;
  salary:number; taxRate:number; stage:number; vacTotal:number; startDate:string;
  scheduleType:ScheduleType; scheduleShift:ShiftType; scheduleVakhtaMonths:number; schedulePairType:PairType;
  vacations:Period[]; sickLeaves:Period[];
  holidayCoeff:number; nightExtraPercent:number;
  advances:Record<string,number>;
  paymentDates:Record<string,PaymentDates>;
  incomeHistory:IncomeHistory;
  shiftOverrides:Record<string,ShiftValue>;
  shiftNotes:Record<string,string>;
  theme:'auto'|'light'|'dark';
  profile:UserProfile;
  directoryToken:string;
  friends:Record<string,Friend>;
  friendRequestsIncoming:FriendRequest[];
  friendRequestsOutgoing:FriendRequest[];
  chats:Record<string,ChatMessage[]>;
  notifications:NotificationSettings;
  onePassEnabled:boolean;
}
export const MONTHS=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
export const DOW=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const pad=(n:number)=>String(n).padStart(2,'0');
const todayYmd=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
export const createWTinkId=()=>`WTinkID-${Math.floor(100000+Math.random()*900000)}`;
export const normalizeWTinkId=(value:string)=>{const match=String(value||'').trim().match(/^WTINKID-(\d{6})$/i);return match?`WTinkID-${match[1]}`:''};
export const canonicalWTinkId=(value:string)=>{const normalized=normalizeWTinkId(value);return normalized?normalized.toUpperCase():''};
export const DEFAULT:State={schemaVersion:8,setupComplete:false,salary:95000,taxRate:13,stage:10,vacTotal:28,startDate:todayYmd(),scheduleType:'2/2',scheduleShift:'day',scheduleVakhtaMonths:1,schedulePairType:'day-night',vacations:[],sickLeaves:[],holidayCoeff:2,nightExtraPercent:20,advances:{},paymentDates:{},incomeHistory:{},shiftOverrides:{},shiftNotes:{},theme:'auto',profile:{profileId:'',name:'',position:'',avatar:''},directoryToken:'',friends:{},friendRequestsIncoming:[],friendRequestsOutgoing:[],chats:{},notifications:{enabled:true,friendRequests:true,friendAccepted:true,messages:true,shifts:true,absences:true,payroll:true},onePassEnabled:false};
const HOLIDAYS=[[1,1,'Новогодние каникулы'],[1,2,'Новогодние каникулы'],[1,3,'Новогодние каникулы'],[1,4,'Новогодние каникулы'],[1,5,'Новогодние каникулы'],[1,6,'Новогодние каникулы'],[1,7,'Рождество Христово'],[1,8,'Новогодние каникулы'],[2,23,'День защитника Отечества'],[3,8,'Международный женский день'],[5,1,'Праздник Весны и Труда'],[5,9,'День Победы'],[6,12,'День России'],[11,4,'День народного единства']] as const;
export const TRANSFERS:Record<number,Record<string,string>>={2025:{'2025-01-02':'2025-05-02','2025-01-03':'2025-12-31','2025-02-23':'2025-05-08','2025-03-08':'2025-06-13','2025-11-01':'2025-11-03'},2026:{'2026-01-03':'2026-01-09','2026-01-04':'2026-12-31'}};
export const ymd=(d:Date)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
export const parseYmd=(s:string)=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
export const addDays=(d:Date,n:number)=>{const r=new Date(d);r.setDate(r.getDate()+n);return r};
export const addMonths=(d:Date,n:number)=>{const r=new Date(d);const day=r.getDate();r.setDate(1);r.setMonth(r.getMonth()+n);r.setDate(Math.min(day,new Date(r.getFullYear(),r.getMonth()+1,0).getDate()));return r};
export const daysBetween=(a:Date,b:Date)=>Math.round((Date.UTC(b.getFullYear(),b.getMonth(),b.getDate())-Date.UTC(a.getFullYear(),a.getMonth(),a.getDate()))/86400000);
export const isHoliday=(d:Date)=>HOLIDAYS.some(([m,day])=>m===d.getMonth()+1&&day===d.getDate());
export const holidayName=(d:Date)=>HOLIDAYS.find(([m,day])=>m===d.getMonth()+1&&day===d.getDate())?.[2]||'';
export const isTransferredWeekend=(d:Date)=>Object.values(TRANSFERS[d.getFullYear()]||{}).includes(ymd(d));

/**
 * График 7/0 означает непрерывную работу без выходных внутри выбранной вахты.
 * scheduleVakhtaMonths задаёт длительность именно непрерывного периода вахты.
 * После его окончания календарь возвращает off — новую вахту пользователь начинает новой датой старта.
 */
function inVakhta(state:State,date:Date){
 if(state.scheduleType!=='7/0')return true;
 const start=parseYmd(state.startDate);
 const endExclusive=addMonths(start,Math.max(1,state.scheduleVakhtaMonths));
 return date>=start&&date<endExclusive;
}
export function getScheduledShift(state:State,date:Date):ShiftValue{
 const diff=daysBetween(parseYmd(state.startDate),date),type=state.scheduleType;
 if(date<parseYmd(state.startDate))return 'off';
 if(type==='7/0')return inVakhta(state,date)?state.scheduleShift:'off';
 if(type==='2/2'){
  const pos=((diff%4)+4)%4;
  const pair=state.schedulePairType.split('-') as [ShiftType,ShiftType];
  if(pos===0)return pair[0];
  if(pos===1)return pair[1];
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
export function avgIncome(state:State,months=12,throughMonth?:string){const entries=Object.entries(state.incomeHistory).filter(([key,v])=>/^\d{4}-\d{2}$/.test(key)&&Number.isFinite(v)&&v>=0&&(!throughMonth||key<throughMonth)).sort(([a],[b])=>a.localeCompare(b));const take=entries.slice(-months).map(([,v])=>v);return take.length?take.reduce((a,b)=>a+b,0)/take.length:state.salary}
export function calcMonth(state:State,year:number,month:number){
 const start=new Date(year,month,1),end=new Date(year,month+1,0),employmentStart=parseYmd(state.startDate);
 if(end<employmentStart){
  const pd=getPaymentDates(state,year,month);
  return {year,month,work:0,nightWork:0,holidayWork:0,vacDays:0,sickDays:0,base:0,extraPay:0,holidayExtra:0,nightExtra:0,vacPay:0,sickPay:0,gross:0,tax:0,net:0,advance:0,remainder:0,paymentDates:pd,sickRate:state.stage<5?.6:state.stage<8?.8:1,scheduled:0,scheduledHours:0,workHours:0,plannedWorkHours:0,extraWorkHours:0,advanceIsCustom:false};
 }
 const accrualStart=start<employmentStart?employmentStart:start;
 let scheduledFullMonth=0,scheduledHours=0,work=0,nightWork=0,holidayWork=0,holidayWorkHours=0,workHours=0,plannedWorkHours=0,extraWorkHours=0,vacDays=0,sickDays=0;
 const shiftHours=(shift:ShiftValue)=>shift==='full'?(state.scheduleType==='7/0'?24:8):shift==='off'?0:8;
 for(let d=new Date(start);d<=end;d=addDays(d,1)){const scheduledShift=getScheduledShift(state,d);if(scheduledShift!=='off'){scheduledFullMonth++;scheduledHours+=shiftHours(scheduledShift)}}
 for(let d=new Date(accrualStart);d<=end;d=addDays(d,1)){
  const key=ymd(d),shift=getShift(state,d),scheduledShift=getScheduledShift(state,d),onVacation=state.vacations.some(p=>periodContains(p,key)),onSick=state.sickLeaves.some(p=>periodContains(p,key));
  if(onVacation&&!isHoliday(d))vacDays++; if(onSick)sickDays++;
  if(shift!=='off'&&!onVacation&&!onSick){const hours=shiftHours(shift);work++;workHours+=hours;if(scheduledShift!=='off')plannedWorkHours+=hours;else extraWorkHours+=hours;if(shift==='night')nightWork++;if(isHoliday(d)){holidayWork++;holidayWorkHours+=hours}}
  // Ручной выходной/смена не меняет плановый знаменатель — он всё равно строится по графику месяца.
  void scheduledShift;
 }
 const scheduledDays=Math.max(1,scheduledFullMonth),scheduledHoursSafe=Math.max(1,scheduledHours),hourValue=state.salary/scheduledHoursSafe;
 const base=Math.round(state.salary*plannedWorkHours/scheduledHoursSafe),extraPay=Math.round(hourValue*extraWorkHours);
 const holidayExtra=Math.round(hourValue*holidayWorkHours*Math.max(0,state.holidayCoeff-1));
 const nightExtra=Math.round(hourValue*nightWork*8*Math.max(0,state.nightExtraPercent)/100);
 const vacPay=Math.round(avgIncome(state,12,monthKey(year,month))/29.3*vacDays);
 const sickRate=state.stage<5?.6:state.stage<8?.8:1;
 const sickPay=Math.round(avgIncome(state,24,monthKey(year,month))/730*sickRate*sickDays);
 const gross=base+extraPay+holidayExtra+nightExtra+vacPay+sickPay,tax=Math.round(gross*state.taxRate/100),net=Math.max(0,gross-tax),key=monthKey(year,month),pd=getPaymentDates(state,year,month);
 const advanceIsCustom=Object.prototype.hasOwnProperty.call(state.advances,key);
 const defaultAdvance=Math.min(net,Math.max(0,state.salary*0.5));
 const customAdvance=Math.max(0,Number(state.advances[key])||0);
 const advance=Math.min(net,advanceIsCustom?customAdvance:defaultAdvance);
 return {year,month,work,nightWork,holidayWork,vacDays,sickDays,base,extraPay,holidayExtra,nightExtra,vacPay,sickPay,gross,tax,net,advance,remainder:Math.max(0,net-advance),paymentDates:pd,sickRate,scheduled:scheduledDays,scheduledHours:scheduledHoursSafe,workHours,plannedWorkHours,extraWorkHours,advanceIsCustom};
}
export interface AnnualCalc {year:number;months:ReturnType<typeof calcMonth>[];work:number;nightWork:number;holidayWork:number;vacDays:number;sickDays:number;base:number;extraPay:number;holidayExtra:number;nightExtra:number;vacPay:number;sickPay:number;gross:number;tax:number;net:number;advance:number;remainder:number;averageMonthlyNet:number;}
export function calcYear(state:State,year:number):AnnualCalc{const months=Array.from({length:12},(_,month)=>calcMonth(state,year,month));const sum=(key:keyof ReturnType<typeof calcMonth>)=>months.reduce((total,item)=>total+Number(item[key]||0),0);const net=sum('net');return {year,months,work:sum('work'),nightWork:sum('nightWork'),holidayWork:sum('holidayWork'),vacDays:sum('vacDays'),sickDays:sum('sickDays'),base:sum('base'),extraPay:sum('extraPay'),holidayExtra:sum('holidayExtra'),nightExtra:sum('nightExtra'),vacPay:sum('vacPay'),sickPay:sum('sickPay'),gross:sum('gross'),tax:sum('tax'),net,advance:sum('advance'),remainder:sum('remainder'),averageMonthlyNet:Math.round(net/12)}}
export function getAvgShiftsPerMonth(s:State){if(s.scheduleType==='7/0'){const months=Math.max(1,s.scheduleVakhtaMonths);return 30*months/months}const [w,o]=s.scheduleType.split('/').map(Number);return 30*w/(w+o)}
export function monthKey(y:number,m:number){return `${y}-${pad(m+1)}`}
const EMPTY_PAYMENT_DATES:PaymentDates={advanceDate:'',remainderDate:''};
function shiftDateByMonths(value:string,delta:number){if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!delta)return value;const [y,m,d]=value.split('-').map(Number);const target=new Date(y,m-1+delta,1);const lastDay=new Date(target.getFullYear(),target.getMonth()+1,0).getDate();return `${target.getFullYear()}-${pad(target.getMonth()+1)}-${pad(Math.min(d,lastDay))}`}
function paymentFieldFromHistory(state:State,year:number,month:number,field:'advanceDate'|'remainderDate'){const targetIndex=year*12+month;for(let index=targetIndex-1;index>=targetIndex-120;index--){const sourceYear=Math.floor(index/12),sourceMonth=((index%12)+12)%12,source=state.paymentDates[monthKey(sourceYear,sourceMonth)],value=source?.[field];if(value)return shiftDateByMonths(value,targetIndex-index)}return ''}
export function getPaymentDates(state:State,year:number,month:number):PaymentDates{const explicit=state.paymentDates[monthKey(year,month)]||EMPTY_PAYMENT_DATES;return {advanceDate:explicit.advanceDate||paymentFieldFromHistory(state,year,month,'advanceDate'),remainderDate:explicit.remainderDate||paymentFieldFromHistory(state,year,month,'remainderDate')}}
export function formatMoney(n:number){return new Intl.NumberFormat('ru-RU').format(Math.round(n))+' ₽'}
export function shiftLabel(v:ShiftValue){return v==='day'?'День':v==='night'?'Ночь':v==='full'?'Сутки':'Выходной'}
