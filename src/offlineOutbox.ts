import {sendChatMessage} from './directory/chat.ts';
import type {ChatServerMessage} from './directory/types.ts';

const DB='workertink-offline-outbox';
const STORE='chat-messages';
const MAX_ITEMS=200;
const BASE_DELAY_MS=2000;
export type OutboxMessage={
 id:string;ownerId:string;to:string;body:string;kind:ChatServerMessage['kind'];
 mime?:string;name?:string;replyToId?:string;replyPreview?:string;noteDate?:string;noteShift?:string;
 createdAt:number;attempts:number;nextAttemptAt:number;status:'pending'|'blocked';lastError:string;
};
export type NewOutboxMessage=Omit<OutboxMessage,'id'|'createdAt'|'attempts'|'nextAttemptAt'|'status'|'lastError'>;
const normalize=(v:string)=>v.trim().toUpperCase();
let inFlight:Promise<void>|null=null;
function open():Promise<IDBDatabase>{
 if(typeof indexedDB==='undefined')return Promise.reject(new Error('OFFLINE_STORAGE_UNAVAILABLE'));
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'id'})};
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(new Error('OFFLINE_STORAGE_UNAVAILABLE'));
  req.onblocked=()=>reject(new Error('OFFLINE_STORAGE_BLOCKED'));
 });
}
async function readAll():Promise<OutboxMessage[]>{
 const db=await open();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readonly');
  const request=tx.objectStore(STORE).getAll();
  let result:OutboxMessage[]=[];
  request.onsuccess=()=>{result=request.result as OutboxMessage[]};
  tx.oncomplete=()=>{db.close();resolve(result)};
  tx.onerror=tx.onabort=()=>{db.close();reject(new Error('OFFLINE_READ_FAILED'))};
 });
}
async function writeOne(record:OutboxMessage):Promise<void>{
 const db=await open();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readwrite');
  tx.objectStore(STORE).put(record);
  tx.oncomplete=()=>{db.close();resolve()};
  tx.onerror=tx.onabort=()=>{db.close();reject(new Error('OFFLINE_WRITE_FAILED'))};
 });
}
async function removeOne(id:string):Promise<void>{
 const db=await open();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readwrite');
  tx.objectStore(STORE).delete(id);
  tx.oncomplete=()=>{db.close();resolve()};
  tx.onerror=tx.onabort=()=>{db.close();reject(new Error('OFFLINE_DELETE_FAILED'))};
 });
}
export async function queueEncryptedMessage(item:NewOutboxMessage):Promise<OutboxMessage>{
 const id=crypto.randomUUID(),ownerId=normalize(item.ownerId),to=normalize(item.to);
 let envelope:{v?:unknown;iv?:unknown;data?:unknown;mediaId?:unknown};
 try{envelope=JSON.parse(item.body)}catch{throw new Error('OUTBOX_CIPHERTEXT_REQUIRED')}
 if(envelope.v!==1||typeof envelope.iv!=='string'||typeof envelope.data!=='string'&&typeof envelope.mediaId!=='string')throw new Error('OUTBOX_CIPHERTEXT_REQUIRED');
 if(!/^WTINKID-\d{6}$/.test(ownerId)||!/^WTINKID-\d{6}$/.test(to)||ownerId===to)throw new Error('OUTBOX_ACCOUNT_INVALID');
 if((await readAll()).filter(record=>record.ownerId===ownerId).length>=MAX_ITEMS)throw new Error('OUTBOX_LIMIT_REACHED');
 const record:OutboxMessage={...item,id,ownerId,to,createdAt:Date.now(),attempts:0,nextAttemptAt:0,status:'pending',lastError:''};
 await writeOne(record);
 return record;
}
export async function pendingEncryptedMessages(ownerId:string):Promise<OutboxMessage[]>{
 return (await readAll()).filter(r=>r.ownerId===normalize(ownerId)).sort((a,b)=>a.createdAt-b.createdAt);
}
export function retryBackoff(attempts:number):number{
 return Math.min(10*60*1000,BASE_DELAY_MS*2**Math.min(8,Math.max(0,attempts-1)));
}
const isTransient=(error:string)=>/Failed to fetch|NetworkError|Load failed|HTTP_5\d\d|HTTP_429|AbortError|TIMEOUT|OFFLINE|network/i.test(error);
function emitted(id:string,message:ChatServerMessage){
 if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('wtinker:outbox-delivered',{detail:{id,message}}));
}
export async function sendQueuedEncryptedMessage(record:OutboxMessage,token:string):Promise<ChatServerMessage|null>{
 if(!token||typeof navigator!=='undefined'&&!navigator.onLine)return null;
 try{
  const response=await sendChatMessage(record.to,record.body,record.kind,token,record.mime,record.name,record.replyToId,record.replyPreview,record.noteDate,record.noteShift,record.id);
  await removeOne(record.id);
  emitted(record.id,response.message);
  return response.message;
 }catch(error){
  const code=String(error),attempts=record.attempts+1;
  await writeOne({...record,attempts,status:isTransient(code)?'pending':'blocked',nextAttemptAt:Date.now()+retryBackoff(attempts),lastError:code.slice(0,130)});
  return null;
 }
}
/** Never persists auth tokens: the current logged-in session is supplied at
 * delivery time. Each item keeps its original client id across retries.
 */
export async function flushEncryptedOutbox(ownerId:string,token:string):Promise<void>{
 if(!token||!ownerId||typeof navigator!=='undefined'&&!navigator.onLine)return;
 if(inFlight)return inFlight;
 inFlight=(async()=>{
  const queue=await pendingEncryptedMessages(ownerId);
  for(const record of queue){
   if(record.status!=='pending'||record.nextAttemptAt>Date.now())continue;
   const delivered=await sendQueuedEncryptedMessage(record,token);
   if(!delivered){
    // Preserve FIFO for transient errors; permanently blocked items stay
    // visible for explicit retry or discard in the user-facing queue.
    const updated=(await pendingEncryptedMessages(ownerId)).find(item=>item.id===record.id);
    if(updated?.status==='pending')break;
   }
  }
 })().finally(()=>{inFlight=null});
 return inFlight;
}
export async function retryBlockedOutboxMessage(ownerId:string,id:string){
 const record=(await pendingEncryptedMessages(ownerId)).find(item=>item.id===id);
 if(!record)throw new Error('OUTBOX_ITEM_NOT_FOUND');
 await writeOne({...record,status:'pending',nextAttemptAt:0,lastError:''});
}
export async function discardOutboxMessage(ownerId:string,id:string){
 if(!(await pendingEncryptedMessages(ownerId)).some(item=>item.id===id))throw new Error('OUTBOX_ITEM_NOT_FOUND');
 await removeOne(id);
}
