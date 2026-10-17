import {isWebKit,rememberBytes} from './binary.ts';
import {emptyLibrary,normalizeLibrary,type Library} from './model.ts';
const DB_NAME='wtinker-wtsound';
function openDB():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>{req.result.createObjectStore('libraries');req.result.createObjectStore('audio');req.result.createObjectStore('artwork')};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);req.onblocked=()=>reject(new Error('Закройте старые вкладки WTinker и повторите попытку'))})}
async function transaction<T>(store:string,mode:IDBTransactionMode,action:(object:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
 const db=await openDB();return new Promise((resolve,reject)=>{
  const tx=db.transaction(store,mode);let req:IDBRequest<T>;
  try{req=action(tx.objectStore(store))}catch(error){tx.abort();db.close();reject(error);return}
  let value:T,failure:DOMException|null=null;
  req.onsuccess=()=>{value=req.result};req.onerror=()=>{failure=req.error};
  tx.oncomplete=()=>{db.close();resolve(value)};
  tx.onerror=()=>{db.close();reject(failure||tx.error||new Error('Не удалось записать данные в хранилище'))};
  tx.onabort=()=>{db.close();reject(failure||tx.error||new Error('Хранилище недоступно'))};
 });
}
export const readLibrary=async(owner:string):Promise<Library>=>normalizeLibrary(await transaction<Library|undefined>('libraries','readonly',s=>s.get(owner))||emptyLibrary());
export const writeLibrary=(owner:string,library:Library)=>transaction('libraries','readwrite',s=>s.put(library,owner));
const key=(owner:string,id:string)=>`${owner.toUpperCase()}:${id}`;
type StoredBinary=Blob|{bytes:ArrayBuffer;mime:string};
async function readBinary(store:string,owner:string,id:string):Promise<Blob|undefined>{const value=await transaction<StoredBinary|undefined>(store,'readonly',s=>s.get(key(owner,id)));return value instanceof Blob?value:value?rememberBytes(new Blob([value.bytes],{type:value.mime}),value.bytes):undefined}
async function writeBinary(store:string,owner:string,id:string,blob:Blob){
 try{if(isWebKit()){const value={bytes:await blob.arrayBuffer(),mime:blob.type};await transaction(store,'readwrite',s=>s.put(value,key(owner,id)));return}await transaction(store,'readwrite',s=>s.put(blob,key(owner,id)))}catch(error){
  if(error instanceof DOMException&&!['UnknownError','DataCloneError'].includes(error.name))throw error;
  // WebKit can refuse Blob serialization even when ordinary IndexedDB writes work.
  // An ArrayBuffer retains the original bytes and MIME without a lossy conversion.
  const value={bytes:await blob.arrayBuffer(),mime:blob.type};await transaction(store,'readwrite',s=>s.put(value,key(owner,id)));
 }
}
export const readAudio=(owner:string,id:string)=>readBinary('audio',owner,id);
export const writeAudio=(owner:string,id:string,blob:Blob)=>writeBinary('audio',owner,id,blob);
export const removeAudio=(owner:string,id:string)=>transaction('audio','readwrite',s=>s.delete(key(owner,id)));
export const writeArtwork=(owner:string,id:string,blob:Blob)=>writeBinary('artwork',owner,id,blob);
export const readArtwork=(owner:string,id:string)=>readBinary('artwork',owner,id);
export const removeArtwork=(owner:string,id:string)=>transaction('artwork','readwrite',s=>s.delete(key(owner,id)));
export async function audioIds(owner:string):Promise<Set<string>>{const keys=await transaction<IDBValidKey[]>('audio','readonly',s=>s.getAllKeys());const prefix=owner.toUpperCase()+':';return new Set(keys.filter(k=>typeof k==='string'&&k.startsWith(prefix)).map(k=>String(k).slice(prefix.length)))}
export async function ensureSpace(bytes:number){const estimate=await navigator.storage?.estimate?.();if(estimate?.quota&&estimate.usage&&estimate.quota-estimate.usage<bytes+1024*1024)throw new Error('Недостаточно места на устройстве. Освободите память и повторите загрузку')}
export async function persistStorage(){try{return await navigator.storage?.persist?.()||false}catch{return false}}
/** Read and update in one IDB transaction, preventing two tabs from replacing each other's uploads. */
export async function updateLibrary(owner:string,change:(current:Library)=>Library):Promise<Library>{
 const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction('libraries','readwrite'),store=tx.objectStore('libraries'),request=store.get(owner);let next:Library;
 request.onsuccess=()=>{try{next=change(normalizeLibrary(request.result||emptyLibrary()));store.put(next,owner)}catch(error){tx.abort();reject(error)}};
 tx.oncomplete=()=>{db.close();resolve(next)};tx.onerror=()=>{db.close();reject(tx.error)};tx.onabort=()=>{db.close();reject(tx.error||new Error('Изменение библиотеки отменено'))};
 });
}
