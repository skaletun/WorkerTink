import {DEFAULT,State} from './core';
const KEY='workertink:v3';
const isDate=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s);
export function loadState():State{
 try{
  const raw=localStorage.getItem(KEY)??localStorage.getItem('workertink:v2')??localStorage.getItem('workertink');
  if(!raw)return structuredClone(DEFAULT);
  const parsed=JSON.parse(raw);const legacy=parsed.setupComplete===undefined;
  return normalize({...structuredClone(DEFAULT),...parsed,setupComplete:legacy?false:Boolean(parsed.setupComplete)});
 }catch{return structuredClone(DEFAULT)}
}
export function saveState(s:State){localStorage.setItem(KEY,JSON.stringify(s))}
function normalize(s:State):State{
 const scheduleTypes=['5/2','4/1','3/2','3/1','6/1','2/2','7/0'];
 const shifts=['day','night','full'];const pairs=['day-day','day-night','night-night'];
 return {...s,
  setupComplete:Boolean(s.setupComplete),salary:Math.max(0,Number(s.salary)||0),taxRate:Math.min(100,Math.max(0,Number(s.taxRate)||0)),stage:Math.min(60,Math.max(0,Number(s.stage)||0)),vacTotal:Math.max(0,Number(s.vacTotal)||0),startDate:isDate(s.startDate)?s.startDate:DEFAULT.startDate,
  scheduleType:scheduleTypes.includes(s.scheduleType)?s.scheduleType:DEFAULT.scheduleType,scheduleShift:(s.scheduleType==='7/0'&&shifts.includes(s.scheduleShift))||(['day','night'].includes(s.scheduleShift))?s.scheduleShift:DEFAULT.scheduleShift,schedulePairType:pairs.includes(s.schedulePairType)?s.schedulePairType:DEFAULT.schedulePairType,scheduleVakhtaMonths:Math.min(6,Math.max(1,Number(s.scheduleVakhtaMonths)||1)),holidayCoeff:Math.min(10,Math.max(1,Number(s.holidayCoeff)||1)),
  vacations:Array.isArray(s.vacations)?s.vacations.filter(p=>p&&isDate(p.start)&&isDate(p.end)&&p.start<=p.end):[],sickLeaves:Array.isArray(s.sickLeaves)?s.sickLeaves.filter(p=>p&&isDate(p.start)&&isDate(p.end)&&p.start<=p.end):[],
  advances:s.advances&&typeof s.advances==='object'?s.advances:{},paymentDates:s.paymentDates&&typeof s.paymentDates==='object'?s.paymentDates:{},incomeHistory:s.incomeHistory&&typeof s.incomeHistory==='object'?s.incomeHistory:{},
  shiftOverrides:s.shiftOverrides&&typeof s.shiftOverrides==='object'?s.shiftOverrides:{},shiftNotes:s.shiftNotes&&typeof s.shiftNotes==='object'?s.shiftNotes:{},theme:['auto','light','dark'].includes(s.theme)?s.theme:DEFAULT.theme
 };
}
