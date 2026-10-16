import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const values=new Map();
let writable=true;
globalThis.localStorage={
 getItem:key=>values.get(key)??null,
 setItem(key,value){if(!writable)throw new Error('QuotaExceededError');values.set(key,String(value))},
 removeItem:key=>values.delete(key),
 key:index=>[...values.keys()][index]??null,
 get length(){return values.size}
};
const {DEFAULT,getShift}=await import('../src/core.ts');
const {STORAGE_KEY}=await import('../src/storage.ts');
const {readShiftDraft,writeShiftDraft,deleteShiftDraft}=await import('../src/shiftDrafts.ts');
const owner='WTinkID-465120',other='WTinkID-465121',date='2026-10-16';
const state={...structuredClone(DEFAULT),profile:{...DEFAULT.profile,profileId:owner},shiftNotes:{},shiftOverrides:{}};
const scheduled=getShift(state,new Date(date+'T12:00:00'));
values.set(STORAGE_KEY,JSON.stringify(state));
assert.equal(readShiftDraft(owner,date),null);
const working=writeShiftDraft(owner,date,'Материалы подготовлены',scheduled);
assert.equal(working.phase,'editing');
assert.equal(readShiftDraft(owner,date)?.note,'Материалы подготовлены');
assert.equal(readShiftDraft(other,date),null,'drafts never leak across accounts');
assert.equal(readShiftDraft(owner,'2026-10-17'),null);
assert.equal(deleteShiftDraft(owner,date,'wrong-revision'),false,'stale tab cannot erase newer draft');
assert.equal(readShiftDraft(owner,date)?.revision,working.revision);

// A Save only moves the local draft to committing: it must NOT erase it until
// the authoritative canonical app snapshot has been persisted.
const committed=writeShiftDraft(owner,date,'Материалы подготовлены',scheduled,'committing');
assert.equal(readShiftDraft(owner,date)?.revision,committed.revision);
assert.equal(readShiftDraft(owner,date)?.phase,'committing');
values.set(STORAGE_KEY,JSON.stringify({...state,shiftNotes:{[date]:'Материалы подготовлены'}}));
assert.equal(readShiftDraft(owner,date),null,'verified persistent state retires committed draft');
assert.equal(values.has('workertink:shift-draft:v1:'+owner.toUpperCase()+':'+date),false);

// If the PWA update interrupts a state write, retain the complete editor draft.
values.set(STORAGE_KEY,JSON.stringify(state));
writeShiftDraft(owner,date,'Изменение до обновления',scheduled,'committing');
assert.equal(readShiftDraft(owner,date)?.note,'Изменение до обновления');

// Invalid dates, corruption, account mismatch, and quota failures cannot
// silently acknowledge an unsaved draft.
assert.throws(()=>writeShiftDraft(owner,'2026-02-30','a',scheduled),/SHIFT_DRAFT_INVALID_ACCOUNT_OR_DATE/);
assert.throws(()=>writeShiftDraft(owner,date,'x'.repeat(100001),scheduled),/SHIFT_DRAFT_TOO_LARGE_OR_INVALID/);
values.set('workertink:shift-draft:v1:'+owner.toUpperCase()+':'+date,'{"wrong":true}');
assert.equal(readShiftDraft(owner,date),null);
writable=false;
assert.throws(()=>writeShiftDraft(owner,date,'Сохранить',scheduled),/SHIFT_DRAFT_STORAGE_UNAVAILABLE/);
writable=true;
writeShiftDraft(owner,date,'Отменить',scheduled);
assert.equal(deleteShiftDraft(owner,date),true);
assert.equal(readShiftDraft(owner,date),null);
delete globalThis.localStorage;
console.log('WTinker Shift offline drafts: recovery, commit checkpoint, account isolation, invalid data and quota: OK');
