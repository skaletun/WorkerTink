import {DEFAULT,createWTinkId,normalizeWTinkId,type State,type Period,type PaymentDates,type ShiftValue,type FriendRequest} from './core.ts';

export const STORAGE_KEY='workertink:v6';
const LEGACY_KEYS=['workertink:v5','workertink:v4','workertink:v3','workertink:v2','workertink'] as const;
const RECOVERY_KEY='workertink:recovery:last-invalid';
const isDate=(s:unknown):s is string=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s);
const isRecord=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const cloneDefault=()=>structuredClone(DEFAULT);

function migrate(raw:Record<string,unknown>):Record<string,unknown>{
 const sourceVersion=Number(raw.schemaVersion)||1;
 let next={...raw};
 if(sourceVersion<7){
  next={...next,schemaVersion:8,notifications:next.notifications??DEFAULT.notifications};
 }
 if(sourceVersion<8){
  next={...next,schemaVersion:8,onePassEnabled:Boolean(next.onePassEnabled)};
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
 const profileValue=(value:unknown):State['profile']=>{if(!isRecord(value))return cloneDefault().profile;const rawId=typeof value.profileId==='string'?value.profileId:'';return {profileId:normalizeWTinkId(rawId)||createWTinkId(),name:typeof value.name==='string'?value.name.trim().slice(0,80):'',position:typeof value.position==='string'?value.position.trim().slice(0,120):'',avatar:typeof value.avatar==='string'&&value.avatar.startsWith('data:image/')?value.avatar:''}};
 const friendsRecord=(value:unknown):State['friends']=>{if(!isRecord(value))return {};const out:State['friends']={};for(const [id,v] of Object.entries(value)){if(!isRecord(v)||!isRecord(v.profile))continue;const profile=v.profile;const profileId=typeof profile.profileId==='string'?profile.profileId:id;const name=typeof profile.name==='string'?profile.name.trim().slice(0,80):'';if(!profileId||!name)continue;out[id]={profile:{profileId,name,position:typeof profile.position==='string'?profile.position.slice(0,120):'',avatar:typeof profile.avatar==='string'&&profile.avatar.startsWith('data:image/')?profile.avatar:''},addedAt:Number(v.addedAt)||Date.now(),lastSeen:Number(v.lastSeen)||Date.now()}}return out};
 const request=(value:unknown):value is FriendRequest=>{if(!isRecord(value)||!isRecord(value.from)||!isRecord(value.to))return false;const profile=(p:Record<string,unknown>):boolean=>typeof p.profileId==='string'&&/^WTinkID-\d{6}$/.test(p.profileId)&&typeof p.name==='string'&&p.name.trim().length>0;return profile(value.from)&&profile(value.to)&&typeof value.id==='string'&&Number.isFinite(Number(value.createdAt))&&['pending','accepted','declined'].includes(String(value.status))};
 const requestsRecord=(value:unknown):FriendRequest[]=>Array.isArray(value)?value.filter(request).slice(-100):[];
 const chatsRecord=(value:unknown):State['chats']=>{if(!isRecord(value))return {};const out:State['chats']={};for(const [id,list] of Object.entries(value)){if(!Array.isArray(list))continue;out[id]=list.filter(isRecord).slice(-500).map(m=>{const type=['text','profile','note'].includes(String(m.type))?m.type as State['chats'][string][number]['type']:'text';const profile=isRecord(m.profile)?{profileId:typeof m.profile.profileId==='string'?m.profile.profileId:'',name:typeof m.profile.name==='string'?m.profile.name.slice(0,80):'',position:typeof m.profile.position==='string'?m.profile.position.slice(0,120):'',avatar:typeof m.profile.avatar==='string'&&m.profile.avatar.startsWith('data:image/')?m.profile.avatar:''}:undefined;const note=isRecord(m.note)&&typeof m.note.date==='string'&&typeof m.note.note==='string'?{date:m.note.date,note:m.note.note.slice(0,10000),shift:typeof m.note.shift==='string'?m.note.shift:''}:undefined;return {id:typeof m.id==='string'?m.id:`${Date.now()}-${Math.random()}`,from:typeof m.from==='string'?m.from:'',at:Number(m.at)||Date.now(),type,text:typeof m.text==='string'?m.text.slice(0,4000):undefined,profile,note}}) as State['chats'][string]}return out};
 const notesRecord=(value:unknown):Record<string,string>=>{if(!isRecord(value))return {};const out:Record<string,string>={};for(const [k,v] of Object.entries(value)){if(isDate(k)&&typeof v==='string')out[k]=v}return out};
 const scheduleType=scheduleTypes.includes(s.scheduleType as State['scheduleType'])?s.scheduleType as State['scheduleType']:DEFAULT.scheduleType;
 const requestedShift=String(s.scheduleShift);
 const scheduleShift=(shifts as readonly string[]).includes(requestedShift)?requestedShift as State['scheduleShift']:DEFAULT.scheduleShift;
 const safeShift=scheduleType==='7/0'?scheduleShift:(scheduleShift==='full'?'day':scheduleShift);
 return {
  ...cloneDefault(),
  ...s,
  schemaVersion:8,
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
  profile:profileValue(s.profile),
  directoryToken:typeof s.directoryToken==='string'?s.directoryToken.slice(0,300):'',
  friends:friendsRecord(s.friends),
  friendRequestsIncoming:requestsRecord(s.friendRequestsIncoming),
  friendRequestsOutgoing:requestsRecord(s.friendRequestsOutgoing),
  chats:chatsRecord(s.chats),
  notifications:(()=>{const n=isRecord(s.notifications)?s.notifications:{};return {enabled:n.enabled!==false,friendRequests:n.friendRequests!==false,friendAccepted:n.friendAccepted!==false,messages:n.messages!==false,shifts:n.shifts!==false,absences:n.absences!==false,payroll:n.payroll!==false}})(),
  onePassEnabled:Boolean(s.onePassEnabled),
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
