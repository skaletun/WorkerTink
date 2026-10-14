import {isValidYmd,normalizeWTinkId,type State} from './core.ts';
import type {SetupData} from './directory/types.ts';

export const WORK_FIELDS=['salary','taxRate','stage','vacTotal','startDate','scheduleType','scheduleShift','scheduleVakhtaMonths','schedulePairType','holidayCoeff','nightExtraPercent'] as const;

export function workSetupFromState(state:Pick<State,typeof WORK_FIELDS[number]>):SetupData{
 return {
  salary:state.salary,taxRate:state.taxRate,stage:state.stage,vacTotal:state.vacTotal,
  startDate:state.startDate,scheduleType:state.scheduleType,scheduleShift:state.scheduleShift,
  scheduleVakhtaMonths:state.scheduleVakhtaMonths,schedulePairType:state.schedulePairType,
  holidayCoeff:state.holidayCoeff,nightExtraPercent:state.nightExtraPercent
 };
}

export function validateWorkSetup(input:SetupData):string{
 const bounded=(value:number,min:number,max:number)=>Number.isFinite(value)&&value>=min&&value<=max;
 if(!bounded(input.salary,0,100_000_000))return 'Оклад должен быть от 0 до 100 000 000 ₽.';
 if(!bounded(input.taxRate,0,100))return 'НДФЛ должен быть от 0 до 100%.';
 if(!bounded(input.stage,0,60))return 'Стаж должен быть от 0 до 60 лет.';
 if(!bounded(input.vacTotal,0,365))return 'Количество дней отпуска должно быть от 0 до 365.';
 if(!isValidYmd(input.startDate))return 'Укажите корректную дату начала рабочего цикла.';
 if(!['5/2','4/1','3/2','3/1','6/1','2/2','7/0'].includes(input.scheduleType))return 'Выберите рабочий график.';
 if(!['day','night','full'].includes(input.scheduleShift)||input.scheduleShift==='full'&&input.scheduleType!=='7/0')return 'Выберите допустимый тип смены.';
 if(!['day-day','day-night','night-night'].includes(input.schedulePairType))return 'Выберите допустимую пару смен.';
 if(!Number.isInteger(input.scheduleVakhtaMonths)||!bounded(input.scheduleVakhtaMonths,1,6))return 'Вахта должна длиться от 1 до 6 месяцев.';
 if(!bounded(input.holidayCoeff,1,10))return 'Праздничный коэффициент должен быть от 1 до 10.';
 if(!bounded(input.nightExtraPercent,0,200))return 'Доплата за ночные смены должна быть от 0 до 200%.';
 return '';
}

const pendingKey=(profileId:string)=>{
 const id=normalizeWTinkId(profileId);
 return id?'workertink:work-settings:pending:'+id.toUpperCase():'';
};

export type PendingWorkSetup={setup:SetupData;updatedAt:number};

// Keep changes separate from account profile data, scoped to the signed-in WTinkID.
export function readPendingWorkSetup(profileId:string):PendingWorkSetup|null{
 const key=pendingKey(profileId);
 if(!key)return null;
 try{
  const raw=localStorage.getItem(key);
  if(!raw)return null;
  const value=JSON.parse(raw) as PendingWorkSetup;
  if(!value||!value.setup||!Number.isFinite(value.updatedAt)||validateWorkSetup(value.setup))return null;
  return value;
 }catch{return null}
}

export function queueWorkSetup(profileId:string,setup:SetupData):number|null{
 const key=pendingKey(profileId);
 if(!key||validateWorkSetup(setup))return null;
 const updatedAt=Date.now();
 try{
  localStorage.setItem(key,JSON.stringify({setup,updatedAt}));
  return updatedAt;
 }catch{return null}
}

// Guard against deleting a newer edit while an older request is still in flight.
export function clearPendingWorkSetup(profileId:string,updatedAt:number):boolean{
 const key=pendingKey(profileId);
 if(!key)return false;
 try{
  const pending=readPendingWorkSetup(profileId);
  if(!pending)return true;
  if(pending.updatedAt!==updatedAt)return false;
  localStorage.removeItem(key);
  return true;
 }catch{return false}
}
