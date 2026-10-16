import {sendChatGroupMessage} from './directory/groups.ts';
import type {GroupChatMessage} from './directory/types.ts';

const DB='workertink-offline-group-outbox',STORE='messages',MAX_ITEMS=200;
export type PendingGroupMessage={
 id:string;ownerId:string;groupId:string;body:string;kind:'text'|'note';
 createdAt:number;attempts:number;nextAttemptAt:number;status:'pending'|'blocked';lastError:string;
};
const normalize=(value:string)=>value.trim().toUpperCase();
let flushing:Promise<void>|null=null;

async function open():Promise<IDBDatabase>{
 if(typeof indexedDB==='undefined')throw new Error('OFFLINE_STORAGE_UNAVAILABLE');
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'id'})};
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(new Error('OFFLINE_STORAGE_UNAVAILABLE'));
  req.onblocked=()=>reject(new Error('OFFLINE_STORAGE_BLOCKED'));
 });
}
async function all():Promise<PendingGroupMessage[]>{
 const db=await open();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readonly');
  const req=tx.objectStore(STORE).getAll();
  let rows:PendingGroupMessage[]=[];
  req.onsuccess=()=>{rows=req.result as PendingGroupMessage[]};
  tx.oncomplete=()=>{db.close();resolve(rows)};
  tx.onabort=tx.onerror=()=>{db.close();reject(new Error('OFFLINE_READ_FAILED'))};
 });
}
async function write(record:PendingGroupMessage):Promise<void>{
 const db=await open();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(record);
  tx.oncomplete=()=>{db.close();resolve()};
  tx.onabort=tx.onerror=()=>{db.close();reject(new Error('OFFLINE_WRITE_FAILED'))};
 });
}
async function erase(id:string):Promise<void>{
 const db=await open();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(id);
  tx.oncomplete=()=>{db.close();resolve()};
  tx.onabort=tx.onerror=()=>{db.close();reject(new Error('OFFLINE_DELETE_FAILED'))};
 });
}
const transient=(message:string)=>/Failed to fetch|NetworkError|Load failed|HTTP_5\d\d|HTTP_429|AbortError|TIMEOUT|OFFLINE|network/i.test(message);
export async function pendingGroupMessages(ownerId:string,groupId?:string):Promise<PendingGroupMessage[]>{
 const owner=normalize(ownerId);
 return (await all()).filter(r=>r.ownerId===owner&&(!groupId||r.groupId===groupId)).sort((a,b)=>a.createdAt-b.createdAt);
}
export async function queueGroupMessage(ownerId:string,groupId:string,body:string,kind:'text'|'note'):Promise<PendingGroupMessage>{
 const id=normalize(ownerId);
 if(!/^WTINKID-\d{6}$/.test(id)||!groupId||groupId.length>120||!['text','note'].includes(kind))throw new Error('GROUP_OUTBOX_INVALID_ACCOUNT');
 if(body.length>150000)throw new Error('GROUP_OUTBOX_TOO_LARGE');
 let envelope:{v?:number;iv?:string;data?:string};
 try{envelope=JSON.parse(body)}catch{throw new Error('GROUP_OUTBOX_CIPHERTEXT_REQUIRED')}
 if(envelope.v!==1||typeof envelope.iv!=='string'||!envelope.iv||typeof envelope.data!=='string'||!envelope.data)throw new Error('GROUP_OUTBOX_CIPHERTEXT_REQUIRED');
 if((await pendingGroupMessages(id)).length>=MAX_ITEMS)throw new Error('GROUP_OUTBOX_LIMIT_REACHED');
 const record:PendingGroupMessage={id:crypto.randomUUID(),ownerId:id,groupId,body,kind,createdAt:Date.now(),attempts:0,nextAttemptAt:0,status:'pending',lastError:''};
 await write(record);
 return record;
}
export async function sendQueuedGroupMessage(record:PendingGroupMessage,token:string):Promise<GroupChatMessage|null>{
 if(!token||typeof navigator!=='undefined'&&!navigator.onLine)return null;
 try{
  const response=await sendChatGroupMessage(record.groupId,record.body,record.kind,token,undefined,undefined,undefined,undefined,record.id);
  await erase(record.id);
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('wtinker:group-outbox-delivered',{detail:{id:record.id,message:response.message}}));
  return response.message;
 }catch(error){
  const attempts=record.attempts+1,reason=String(error);
  await write({...record,attempts,status:transient(reason)?'pending':'blocked',nextAttemptAt:Date.now()+Math.min(600000,2000*2**Math.min(8,attempts-1)),lastError:reason.slice(0,130)});
  return null;
 }
}
export async function flushGroupOutbox(ownerId:string,token:string,force=false):Promise<void>{
 if(!ownerId||!token||typeof navigator!=='undefined'&&!navigator.onLine)return;
 if(flushing)return flushing;
 flushing=(async()=>{
  for(const record of await pendingGroupMessages(ownerId)){
   if(record.status!=='pending'||!force&&record.nextAttemptAt>Date.now())continue;
   const result=await sendQueuedGroupMessage(record,token);
   if(!result){
    const latest=(await pendingGroupMessages(ownerId,record.groupId)).find(row=>row.id===record.id);
    if(latest?.status==='pending')break;
   }
  }
 })().finally(()=>{flushing=null});
 return flushing;
}
export async function retryGroupMessage(ownerId:string,id:string){
 const record=(await pendingGroupMessages(ownerId)).find(row=>row.id===id);
 if(!record)throw new Error('GROUP_OUTBOX_NOT_FOUND');
 await write({...record,status:'pending',nextAttemptAt:0,lastError:''});
}
export async function discardGroupMessage(ownerId:string,id:string){
 if(!(await pendingGroupMessages(ownerId)).some(row=>row.id===id))throw new Error('GROUP_OUTBOX_NOT_FOUND');
 await erase(id);
}
