import {useEffect,useState} from 'react';
import {pendingEncryptedMessages,flushEncryptedOutbox,retryBlockedOutboxMessage,discardOutboxMessage,type OutboxMessage} from '../../offlineOutbox.ts';
import {pendingGroupMessages,flushGroupOutbox,retryGroupMessage,discardGroupMessage,type PendingGroupMessage} from '../../offlineGroupOutbox.ts';
import {Icon} from '../../Icon.tsx';

export default function OfflineQueueCard({ownerId,token}:{ownerId:string;token:string}){
 const [items,setItems]=useState<OutboxMessage[]>([]);
 const [groupItems,setGroupItems]=useState<PendingGroupMessage[]>([]);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const [error,setError]=useState(false);
 const refresh=async()=>{
  try{const [personal,groups]=await Promise.all([pendingEncryptedMessages(ownerId),pendingGroupMessages(ownerId)]);setItems(personal);setGroupItems(groups);setError(false)}
  catch{setNotice('Не удалось прочитать очередь браузера.');setError(true)}
 };
 useEffect(()=>{
  void refresh();
  const update=()=>void refresh();
  window.addEventListener('wtinker:outbox-delivered',update);
  window.addEventListener('wtinker:group-outbox-delivered',update);
  const timer=window.setInterval(update,10000);
  return()=>{window.removeEventListener('wtinker:outbox-delivered',update);window.removeEventListener('wtinker:group-outbox-delivered',update);window.clearInterval(timer)};
 },[ownerId]);
 const send=async()=>{
  setBusy(true);setNotice('');
  try{await flushEncryptedOutbox(ownerId,token,true);await flushGroupOutbox(ownerId,token,true);await refresh();setNotice('Проверили очередь отправки. Неотправленные сообщения сохраняются на устройстве.')}
  catch{setNotice('Не удалось отправить очередь. Сообщения сохранены.');setError(true)}
  finally{setBusy(false)}
 };
 const retry=async(id:string)=>{
  setBusy(true);try{await retryBlockedOutboxMessage(ownerId,id);await flushEncryptedOutbox(ownerId,token);await refresh();setNotice('Повторная отправка запущена.')}catch{setNotice('Не удалось повторить отправку.');setError(true)}finally{setBusy(false)}
 };
 const retryGroup=async(id:string)=>{
  setBusy(true);try{await retryGroupMessage(ownerId,id);await flushGroupOutbox(ownerId,token,true);await refresh();setNotice('Повторная отправка группового сообщения запущена.')}catch{setNotice('Не удалось повторить отправку группового сообщения.');setError(true)}finally{setBusy(false)}
 };
 const discardGroup=async(id:string)=>{
  if(!window.confirm('Удалить это зашифрованное групповое сообщение из локальной очереди?'))return;
  setBusy(true);try{await discardGroupMessage(ownerId,id);await refresh();setNotice('Сообщение удалено из локальной очереди.')}catch{setNotice('Не удалось удалить сообщение.');setError(true)}finally{setBusy(false)}
 };
 const discard=async(id:string)=>{
  if(!window.confirm('Удалить это сообщение из локальной очереди? Оно не будет отправлено.'))return;
  setBusy(true);try{await discardOutboxMessage(ownerId,id);await refresh();setNotice('Сообщение удалено из локальной очереди.')}catch{setNotice('Не удалось удалить сообщение.');setError(true)}finally{setBusy(false)}
 };
 return <section className="settings-card full-width wt-offline-queue" data-settings-section="data" aria-labelledby="wt-offline-queue-title">
  <div className="wt-e2e-backup-heading"><span className="wt-e2e-backup-icon"><Icon name="refresh" size={21}/></span><div><span className="canva-kicker">Offline First · доставка сообщений</span><h2 id="wt-offline-queue-title">Очередь отправки</h2></div></div>
  <p className="hint">Зашифрованные сообщения остаются на устройстве до подтверждения сервера. При возвращении интернета доставка возобновится автоматически. Повторные запросы используют один и тот же идентификатор, чтобы не создавать копии.</p>
  {items.length?<div className="wt-offline-queue-list">{items.map(item=><div className="wt-offline-queue-item" key={item.id}>
   <div><b>{item.to}</b><small>{new Date(item.createdAt).toLocaleString('ru-RU')} · {item.status==='blocked'?'Требует внимания':'Ожидает отправки'}{item.attempts?' · попыток: '+item.attempts:''}</small></div>
   <div className="wt-offline-queue-actions">{item.status==='blocked'&&<button type="button" className="btn quiet" disabled={busy} onClick={()=>void retry(item.id)}>Повторить</button>}<button type="button" className="btn quiet" disabled={busy} onClick={()=>void discard(item.id)}>Удалить</button></div>
  </div>)}</div>:null}
  {groupItems.length>0&&<div className="wt-offline-queue-list">{groupItems.map(item=><div className="wt-offline-queue-item" key={item.id}><div><b>Группа · {item.groupId}</b><small>{new Date(item.createdAt).toLocaleString('ru-RU')} · {item.status==='blocked'?'Требует внимания':'Ожидает отправки'}{item.attempts?' · попыток: '+item.attempts:''}</small></div><div className="wt-offline-queue-actions">{item.status==='blocked'&&<button className="btn quiet" type="button" disabled={busy} onClick={()=>void retryGroup(item.id)}>Повторить</button>}<button className="btn quiet" type="button" disabled={busy} onClick={()=>void discardGroup(item.id)}>Удалить</button></div></div>)}</div>}
  {!items.length&&!groupItems.length&&<p className="wt-offline-queue-empty">Очередь пуста. Все ранее отправленные сообщения подтверждены или новых сообщений нет.</p>}
  <div className="wt-e2e-backup-actions"><button className="btn primary" type="button" disabled={busy||(!items.length&&!groupItems.length)||!token} onClick={()=>void send()}>{busy?'Отправляем…':'Отправить сейчас'}</button><button className="btn quiet" type="button" disabled={busy} onClick={()=>void refresh()}>Обновить список</button></div>
  {notice&&<p className={'wt-e2e-backup-status'+(error?' is-error':'')} role={error?'alert':'status'}>{notice}</p>}
 </section>;
}
