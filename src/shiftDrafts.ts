import {isValidYmd,normalizeWTinkId,type ShiftValue,type State,getShift} from './core.ts';
import {STORAGE_KEY} from './storage.ts';

const PREFIX='workertink:shift-draft:v1:';
const MAX_TEXT_LENGTH=100_000;
const ALLOWED_SHIFTS:ShiftValue[]=['day','night','full','off'];

export type ShiftDraft={
 version:1;profileId:string;date:string;note:string;shift:ShiftValue;
 revision:string;updatedAt:number;phase:'editing'|'committing';
};

function makeKey(profileId:string,date:string){
 const id=normalizeWTinkId(profileId).toUpperCase();
 if(!/^WTINKID-\d{6}$/.test(id)||!isValidYmd(date))throw new Error('SHIFT_DRAFT_INVALID_ACCOUNT_OR_DATE');
 return {id,key:PREFIX+id+':'+date};
}
function valid(value:unknown,id:string,date:string):value is ShiftDraft{
 const draft=value as Partial<ShiftDraft>|null;
 return Boolean(draft&&draft.version===1&&draft.profileId===id&&draft.date===date&&
  typeof draft.note==='string'&&draft.note.length<=MAX_TEXT_LENGTH&&ALLOWED_SHIFTS.includes(draft.shift as ShiftValue)&&
  typeof draft.revision==='string'&&/^[a-f0-9-]{36}$/i.test(draft.revision)&&
  Number.isSafeInteger(draft.updatedAt)&&draft.updatedAt>0&&
  (draft.phase==='editing'||draft.phase==='committing'));
}
function persisted(state:Partial<State>|null,draft:ShiftDraft):boolean{
 if(!state||typeof state!=='object'||!state.shiftNotes||!state.shiftOverrides||!state.profile)return false;
 if(normalizeWTinkId(state.profile.profileId).toUpperCase()!==draft.profileId)return false;
 const note=state.shiftNotes[draft.date]||'';
 const shift=getShift(state as State,new Date(draft.date+'T12:00:00'));
 return note===draft.note&&shift===draft.shift;
}
/** A committed draft stays available until the canonical state has actually
 * reached localStorage. A UI-only setState() does not count as durable save.
 */
export function readShiftDraft(profileId:string,date:string):ShiftDraft|null{
 const {id,key}=makeKey(profileId,date);
 let draft:unknown;
 try{draft=JSON.parse(localStorage.getItem(key)||'null')}catch{return null}
 if(!valid(draft,id,date))return null;
 if(draft.phase==='committing'){
  let saved:Partial<State>|null=null;
  try{saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch{}
  if(persisted(saved,draft)){
   try{localStorage.removeItem(key)}catch{}
   return null;
  }
 }
 return draft;
}
/** Save on the source device, regardless of connectivity or PWA version. */
export function writeShiftDraft(profileId:string,date:string,note:string,shift:ShiftValue,phase:ShiftDraft['phase']='editing'):ShiftDraft{
 const {id,key}=makeKey(profileId,date);
 if(typeof note!=='string'||note.length>MAX_TEXT_LENGTH||!ALLOWED_SHIFTS.includes(shift))throw new Error('SHIFT_DRAFT_TOO_LARGE_OR_INVALID');
 const draft:ShiftDraft={version:1,profileId:id,date,note,shift,revision:crypto.randomUUID(),updatedAt:Date.now(),phase};
 try{localStorage.setItem(key,JSON.stringify(draft))}catch{throw new Error('SHIFT_DRAFT_STORAGE_UNAVAILABLE')}
 return draft;
}
export function deleteShiftDraft(profileId:string,date:string,expectedRevision?:string):boolean{
 const {key}=makeKey(profileId,date);
 try{
  if(expectedRevision){
   const existing=readShiftDraft(profileId,date);
   if(existing?.revision!==expectedRevision)return false;
  }
  localStorage.removeItem(key);return true;
 }catch{return false}
}
