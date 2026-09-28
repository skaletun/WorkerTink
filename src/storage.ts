import {DEFAULT,type State,type Period,type PaymentDates,type ShiftValue} from './core.ts';

export const STORAGE_KEY='workertink:v4';
const LEGACY_KEYS=['workertink:v3','workertink:v2','workertink'] as const;
const RECOVERY_KEY='workertink:recovery:last-invalid';
const isDate=(s:unknown):s is string=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s);
const isRecord=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const cloneDefault=()=>structuredClone(DEFAULT);

function migrate(raw:Record<string,unknown>):Record<string,unknown>{
 const sourceVersion=Number(raw.schemaVersion)||1;
 let next={...raw};
 if(sourceVersion<4){
  next={...next,schemaVersion:4};
 }
 return next;
}

export function normalizeState(input:Partial<State>|Record<string,unknown>):State{
 const s=migrate(input as Record<string,unknown>);
 const scheduleTypes=['5/2','4/1','3/2','3/1','6/1','2/2','7/0'] as const;
 const shifts=['day','night','full'] as const;
 const pairs=['day-day','day-night','night-night'] as const;
 const period=(p:unknown):p is Period=>isRecord(p)&&isDate(p.start)&&isDate(p.end)&&p.start<=p.end;
 const numberRecord=(value:unknown):Record<string,number>=>isRecord(value)?Object.fromEntries(Object.entries(value).filter(([k,v])=>/^\d{4}-\d{2}$/.test(k)&&Number.isFinite(Number(v))&&Number(v)>=0).map(([k,v])=>[k,Number(v)])) as Record<string,number>:{};
 const paymentRecord=(value:unknown):Record<string,PaymentDates>=>{if(!isRecord(value))return {};const out:Record<string,PaymentDates>={};for(const [k,v] of Object.entries(value)){if(!/^\d{4}-\d{2}$/.test(k)||!isRecord(v))continue;out[k]={advanceDate:isDate(v.advanceDate)?v.advanceDate:'',remainderDate:isDate(v.remainderDate)?v.remainderDate:''}}return out};
 const shiftRecord=(value:unknown):Record<string,ShiftValue>=>isRecord(value)?Object.fromEntries(Object.entries(value).filter(([k,v])=>isDate(k)&&(['day','night','full','off'] as string[]).includes(String(v))).map(([k,v])=>[k,v as ShiftValue])):{};
 const notesRecord=(value:unknown):Record<string,string>=>{if(!isRecord(value))return {};const out:Record<string,string>={};for(const [k,v] of Object.entries(value)){if(isDate(k)&&typeof v==='string')out[k]=v}return out};
 const scheduleType=scheduleTypes.includes(s.scheduleType as State['scheduleType'])?s.scheduleType as State['scheduleType']:DEFAULT.scheduleType;
 const requestedShift=String(s.scheduleShift);
 const scheduleShift=(shifts as readonly string[]).includes(requestedShift)?requestedShift as State['scheduleShift']:DEFAULT.scheduleShift;
 const safeShift=scheduleType==='7/0'?scheduleShift:(scheduleShift==='full'?'day':scheduleShift);
 return {
  ...cloneDefault(),
  ...s,
  schemaVersion:4,
  setupComplete:Boolean(s.setupComplete),
  salary:Math.max(0,Number(s.salary)||0),
  taxRate:Math.min(100,Math.max(0,Number(s.taxRate)||0)),
  stage:Math.min(60,Math.max(0,Number(s.stage)||0)),
  vacTotal:Math.max(0,Number(s.vacTotal)||0),
  startDate:isDate(s.startDate)?s.startDate:DEFAULT.startDate,
  scheduleType,
  scheduleShift:safeShift,
  schedulePairType:(pairs as readonly string[]).includes(String(s.schedulePairType))?s.schedulePairType as State['schedulePairType']:DEFAULT.schedulePairType,
  scheduleVakhtaMonths:Math.min(6,Math.max(1,Number(s.scheduleVakhtaMonths)||1)),
  holidayCoeff:Math.min(10,Math.max(1,Number(s.holidayCoeff)||1)),
  nightExtraPercent:Math.min(200,Math.max(0,Number(s.nightExtraPercent??DEFAULT.nightExtraPercent)||0)),
  vacations:Array.isArray(s.vacations)?s.vacations.filter(period):[],
  sickLeaves:Array.isArray(s.sickLeaves)?s.sickLeaves.filter(period):[],
  advances:numberRecord(s.advances),
  paymentDates:paymentRecord(s.paymentDates),
  incomeHistory:numberRecord(s.incomeHistory),
  shiftOverrides:shiftRecord(s.shiftOverrides),
  shiftNotes:notesRecord(s.shiftNotes),
  theme:(['auto','light','dark'] as const).includes(s.theme as State['theme'])?s.theme as State['theme']:DEFAULT.theme,
 };
}

export function loadState():State{
 try{
  const raw=localStorage.getItem(STORAGE_KEY)??LEGACY_KEYS.map(key=>localStorage.getItem(key)).find(Boolean);
  if(!raw)return cloneDefault();
  const normalized=normalizeState(JSON.parse(raw));
  if(!localStorage.getItem(STORAGE_KEY)){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(normalized))}catch{/* keep normalized in memory */}}
  return normalized;
 }catch(error){
  try{
   const raw=localStorage.getItem(STORAGE_KEY)??LEGACY_KEYS.map(key=>localStorage.getItem(key)).find(Boolean);
   if(raw)localStorage.setItem(RECOVERY_KEY,raw);
  }catch{ /* storage may itself be unavailable/full */ }
  return cloneDefault();
 }
}

export function saveState(state:State){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(normalizeState(state)));return true}catch{return false}}
export function exportableState(state:State){return normalizeState(state)}
export function getRecoverySnapshot(){return localStorage.getItem(RECOVERY_KEY)}
