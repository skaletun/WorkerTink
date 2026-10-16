import {useEffect,useMemo,useRef,useState} from 'react';
// @ts-ignore — qr exposes runtime API with a separate bundler-compatible type surface.
import encodeQR from 'qr';
import {Icon} from '../../Icon.tsx';
import {getOwnChatKey,createTransferSession,joinTransferSession,getTransferSession,confirmTransferSession,sendTransferPayload,receiveTransferPayload,acknowledgeTransferPayload,revokeTransferSession,type TransferSession} from '../../directory.ts';
import {generatePairingIdentity,pairingVerificationCode,encryptPairingPayload,decryptPairingPayload,type EphemeralPair} from '../../securePairing.ts';
import {getChatIdentityMatching} from '../../chatCrypto.ts';

type Props={profileId:string;token:string};
const transferParam=()=>new URLSearchParams(window.location.search).get('pair')||'';
const idPattern=/^[a-f0-9-]{36}$/i;
function qrSvg(url:string){
 const cells=encodeQR(url,'raw',{ecc:'medium',border:3}) as boolean[][];
 const size=cells.length,scale=5,rects=[];
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(cells[y][x])rects.push(`<rect x="${x*scale}" y="${y*scale}" width="${scale}" height="${scale}"/>`);
 return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="QR-код для переноса E2E-ключей" viewBox="0 0 ${size*scale} ${size*scale}"><rect width="100%" height="100%" fill="#fff"/><g fill="#173328">${rects.join('')}</g></svg>`;
}
const explain=(code:unknown)=>{
 const raw=String(code);
 if(raw.includes('TRANSFER_EXPIRED'))return 'Время соединения истекло. Создайте новую пару.';
 if(raw.includes('TRANSFER_CONSUMED'))return 'Этот перенос уже завершён и не может использоваться повторно.';
 if(raw.includes('TRANSFER_ALREADY_PAIRED'))return 'К этому устройству уже подключено другое. Создайте новую пару.';
 if(raw.includes('TRANSFER_FORBIDDEN')||raw.includes('TRANSFER_REQUIRES_SECOND_DEVICE'))return 'Откройте WTinker на другом устройстве и войдите в тот же аккаунт.';
 if(raw.includes('E2E_IDENTITY_MISMATCH'))return 'На исходном устройстве отсутствует зарегистрированный E2E-ключ.';
 if(raw.includes('TRANSFER_DECRYPT_FAILED'))return 'Устройства не смогли проверить зашифрованный пакет. Отмените перенос и начните снова.';
 if(raw.includes('E2E_BACKUP_SERVER_KEY_MISMATCH'))return 'Полученный ключ не соответствует вашему аккаунту. Перенос заблокирован.';
 if(raw.includes('TRANSFER_RATE_LIMIT'))return 'Слишком много активных попыток. Отмените одну из них или дождитесь истечения.';
 if(raw.includes('TRANSFER_NOT_FOUND'))return 'Сеанс не найден. Проверьте ссылку и аккаунт.';
 return 'Не удалось выполнить действие. Проверьте соединение и повторите попытку.';
};

export default function DevicePairingCard({profileId,token}:Props){
 const [mode,setMode]=useState<'target'|'source'|null>(null);
 const [session,setSession]=useState<TransferSession|null>(null);
 const [input,setInput]=useState(transferParam);
 const [verifyInput,setVerifyInput]=useState('');
 const [code,setCode]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [done,setDone]=useState('');
 const ephemeral=useRef<EphemeralPair|null>(null);
 const sessionRef=useRef<TransferSession|null>(null);
 const verifyRef=useRef('');
 const completing=useRef(false);
 const link=useMemo(()=>session&&mode==='target'?new URL(window.location.pathname+'?tab=settings&pair='+encodeURIComponent(session.id),window.location.origin).href:'',[session?.id,mode]);
 const qr=useMemo(()=>link?qrSvg(link):'', [link]);
 useEffect(()=>{sessionRef.current=session},[session]);
 useEffect(()=>{verifyRef.current=code},[code]);

 const stop=async()=>{
  const current=sessionRef.current;
  setMode(null);setSession(null);setCode('');setVerifyInput('');setError('');setDone('');ephemeral.current=null;completing.current=false;
  if(current&&token)try{await revokeTransferSession(current.id,token)}catch{}
 };
 const begin=async()=>{
  if(!token||!profileId)return;
  setBusy(true);setError('');setDone('');
  try{
   const pair=await generatePairingIdentity();
   const remote=await getOwnChatKey(token);
   if(!remote.key?.publicKey)throw Error('CHAT_KEY_NOT_READY');
   ephemeral.current=pair;
   const next=await createTransferSession(pair.publicKey,token);
   setSession(next.session);setMode('target');setCode('');setVerifyInput('');
  }catch(e){ephemeral.current=null;setError(explain(e))}finally{setBusy(false)}
 };
 const join=async()=>{
  if(!token||!profileId)return;
  const id=input.trim();
  if(!idPattern.test(id)){setError('Укажите корректный код соединения.');return}
  setBusy(true);setError('');setDone('');
  try{
   const registered=await getOwnChatKey(token);
   // Do not initiate transfer from a browser that lacks the original key.
   await getChatIdentityMatching(profileId,registered.key.publicKey);
   const pair=await generatePairingIdentity();
   ephemeral.current=pair;
   const next=await joinTransferSession(id,pair.publicKey,token);
   setSession(next.session);setMode('source');setCode('');setVerifyInput('');
  }catch(e){ephemeral.current=null;setError(explain(e))}finally{setBusy(false)}
 };
 useEffect(()=>{
  if(!session?.id||!ephemeral.current||done)return;
  let stopped=false;
  const refresh=async()=>{
   try{
    const response=await getTransferSession(session.id,token);
    if(stopped)return;
    setSession(response.session);
    const peer=mode==='target'?response.session.sourcePublicKey:response.session.targetPublicKey;
    if(peer&&ephemeral.current){
     const computed=await pairingVerificationCode(ephemeral.current,peer,response.session.id);
     if(!stopped)setCode(computed);
    }
   }catch(e){
    if(!stopped&&!String(e).includes('HTTP_429'))setError(explain(e));
   }
  };
  void refresh();
  const timer=window.setInterval(()=>void refresh(),2500);
  return()=>{stopped=true;window.clearInterval(timer)};
 },[session?.id,mode,token,done]);
 const confirm=async()=>{
  if(!session||!code||verifyInput.trim()!==code){setError('Сравните коды на обоих устройствах и введите совпадающие 6 цифр.');return}
  setBusy(true);setError('');
  try{setSession((await confirmTransferSession(session.id,token)).session);setVerifyInput('')}
  catch(e){setError(explain(e))}finally{setBusy(false)}
 };
 const send=async()=>{
  if(!session||!ephemeral.current||!session.targetPublicKey||!session.sourceConfirmed||!session.targetConfirmed||mode!=='source')return;
  if(completing.current)return;completing.current=true;setBusy(true);setError('');
  try{
   const remote=await getOwnChatKey(token);
   const cipher=await encryptPairingPayload(ephemeral.current,session.targetPublicKey,session.id,profileId,remote.key.publicKey);
   await sendTransferPayload(session.id,cipher,token);
   setDone('Зашифрованный пакет отправлен. Завершите восстановление на новом устройстве.');
  }catch(e){setError(explain(e));completing.current=false}finally{setBusy(false)}
 };
 const receive=async()=>{
  if(!session||!ephemeral.current||!session.sourcePublicKey||!session.sourceConfirmed||!session.targetConfirmed||mode!=='target'||!session.payloadReady)return;
  if(completing.current)return;completing.current=true;setBusy(true);setError('');
  try{
   const remote=await getOwnChatKey(token);
   const payload=await receiveTransferPayload(session.id,token);
   const result=await decryptPairingPayload(ephemeral.current,session.sourcePublicKey,session.id,profileId,remote.key.publicKey,payload.ciphertext);
   await acknowledgeTransferPayload(session.id,token);
   setDone('E2E-ключи восстановлены ('+result.restored+'). История личной переписки доступна на этом устройстве.');
  }catch(e){setError(explain(e));completing.current=false}finally{setBusy(false)}
 };
 const confirmed=mode==='target'?session?.targetConfirmed:session?.sourceConfirmed;
 const both=Boolean(session?.targetConfirmed&&session?.sourceConfirmed);
 return <section className="settings-card full-width wt-device-pairing" data-settings-section="account" aria-labelledby="wt-device-pairing-title">
  <div className="wt-e2e-backup-heading"><span className="wt-e2e-backup-icon"><Icon name="smartphone" size={21}/></span><div><span className="canva-kicker">Secure Sync · перенос между устройствами</span><h2 id="wt-device-pairing-title">Подключить другое устройство</h2></div></div>
  <p className="hint">Переносите существующие E2E-ключи между двумя авторизованными устройствами WTinker. QR действует 5 минут, ключи шифруются на исходном устройстве. На обоих экранах необходимо сравнить и подтвердить одинаковый код.</p>
  {!mode&&!done&&<div className="wt-e2e-backup-actions">
   <button type="button" className="btn primary" onClick={()=>void begin()} disabled={busy||!token}>Это новое устройство</button>
   <button type="button" className="btn quiet" onClick={()=>{setMode('source');setError('')}} disabled={busy||!token}>Перенести с этого устройства</button>
  </div>}
  {mode==='source'&&!session&&<div className="wt-e2e-backup-form">
   <label className="wt-transfer-label">Код соединения с нового устройства<input aria-label="Код соединения" value={input} onChange={event=>setInput(event.target.value)} placeholder="UUID из QR-кода" autoComplete="off"/></label>
   <div className="wt-e2e-backup-actions"><button type="button" className="btn primary" disabled={busy||!idPattern.test(input.trim())} onClick={()=>void join()}>Связать устройства</button><button type="button" className="btn quiet" onClick={()=>void stop()}>Отмена</button></div>
  </div>}
  {session&&<div className="wt-transfer-session">
   {mode==='target'&&qr&&<div className="wt-transfer-qr" dangerouslySetInnerHTML={{__html:qr}}/>}
   <div className="wt-transfer-steps">
    {mode==='target'&&<><b>Откройте эту ссылку на исходном устройстве</b><input aria-label="Ссылка переноса" value={link} readOnly onFocus={e=>e.target.select()}/><button className="btn quiet" type="button" onClick={()=>void navigator.clipboard?.writeText(link)}>Копировать ссылку</button></>}
    <p>Осталось времени: до {new Date(session.expiresAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}. Используйте только свой аккаунт.</p>
    {code?<><span className="wt-transfer-code" aria-label="Код подтверждения">{code}</span><p>Убедитесь, что на втором устройстве показаны точно такие же 6 цифр. Затем введите код для подтверждения.</p>
     {!confirmed&&<><input aria-label="Подтверждающий код" value={verifyInput} onChange={e=>setVerifyInput(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" autoComplete="off" maxLength={6} placeholder="6 цифр"/><button className="btn primary" type="button" disabled={busy||verifyInput!==code} onClick={()=>void confirm()}>Подтвердить совпадение кодов</button></>}
     {confirmed&&!both&&<span role="status">Подтверждено на этом устройстве. Ожидаем подтверждения на втором.</span>}
     {both&&mode==='source'&&!done&&<button className="btn primary" type="button" disabled={busy} onClick={()=>void send()}>Отправить зашифрованные ключи</button>}
     {both&&mode==='target'&&!done&&(session.payloadReady?<button className="btn primary" type="button" disabled={busy} onClick={()=>void receive()}>Получить и восстановить ключи</button>:<span role="status">Оба устройства подтверждены. Ожидаем зашифрованный пакет.</span>)}
    </>:<span role="status">Ожидаем подключения другого устройства по QR или ссылке.</span>}
    {!done&&<button type="button" className="btn quiet" disabled={busy} onClick={()=>void stop()}>Отменить соединение</button>}
   </div>
  </div>}
  {done&&<p className="wt-e2e-backup-status" role="status">{done}</p>}
  {error&&<p className="wt-e2e-backup-status is-error" role="alert">{error}</p>}
  {(done||(!mode&&Boolean(error)))&&<button type="button" className="btn quiet" onClick={()=>void stop()}>Новое соединение</button>}
  <p className="wt-e2e-backup-footnote"><Icon name="lock" size={15}/> Без сохранения закрытых ключей на сервере. При смене браузера без исходного устройства используйте зашифрованную резервную копию.</p>
 </section>;
}
