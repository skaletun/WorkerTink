import {useEffect,useState} from 'react';
import {Icon} from '../../Icon.tsx';
import {checkE2EHealth,redactedE2EHealthReport,type E2EHealth} from '../../e2eHealth.ts';

type Props={profileId:string;token:string};
const labels={
 local:{ready:'Локальные ключи доступны',missing:'На устройстве нет E2E-ключей',invalid:'Локальные ключи повреждены',unavailable:'Не удалось прочитать локальное хранилище'},
 remote:{matched:'Ключ подтверждён сервером',mismatch:'Зарегистрированный ключ отсутствует на этом устройстве',offline:'Сервер недоступен',unavailable:'Проверка сервера не выполнена', 'not-registered':'Ключ аккаунта ещё не зарегистрирован','not-checked':'Сервер не проверялся'}
};
export default function E2EIntegrityCard({profileId,token}:Props){
 const [health,setHealth]=useState<E2EHealth|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const run=async()=>{
  if(!profileId)return;
  setBusy(true);setError('');
  try{setHealth(await checkE2EHealth(profileId,token))}
  catch{setError('Не удалось завершить локальную диагностику. Данные не изменялись.')}
  finally{setBusy(false)}
 };
 useEffect(()=>{setHealth(null)},[profileId,token]);
 const download=()=>{
  if(!health)return;
  const content=redactedE2EHealthReport(health);
  const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));
  const link=document.createElement('a');
  link.href=url;link.download='wtinker-e2e-diagnostics.json';link.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 return <section className="settings-card full-width wt-e2e-integrity" data-settings-section="account" aria-labelledby="wt-integrity-title">
  <div className="wt-e2e-backup-heading"><span className="wt-e2e-backup-icon"><Icon name="shield" size={21}/></span><div><span className="canva-kicker">Secure Sync · сохранность E2E</span><h2 id="wt-integrity-title">Диагностика шифрования</h2></div></div>
  <p className="hint">Проверьте доступность локальных ключей и совпадение с зарегистрированным ключом аккаунта. Диагностика ничего не записывает, не заменяет ключи и не отправляет секретный материал на сервер.</p>
  <div className="wt-e2e-backup-actions"><button type="button" className="btn primary" onClick={()=>void run()} disabled={busy||!profileId}>{busy?'Проверяем…':'Проверить ключи'}</button>{health&&<button type="button" className="btn quiet" onClick={download}>Экспорт безопасного отчёта</button>}</div>
  {error&&<p className="wt-e2e-backup-status is-error" role="alert">{error}</p>}
  {health&&<div className="wt-e2e-integrity-results" role="status">
   <div><span>Локальное хранилище</span><b>{labels.local[health.local]}</b></div>
   <div><span>Сверка с аккаунтом</span><b>{labels.remote[health.remote]}</b></div>
   <div><span>Доступно ключей, включая историю</span><b>{health.recoverableIdentities}</b></div>
   {health.malformedIdentities>0&&<div><span>Ключей, не прошедших проверку</span><b>{health.malformedIdentities}</b></div>}
   {health.remote==='mismatch'&&<p className="wt-e2e-backup-status is-error">Ключ, зарегистрированный на сервере, не найден среди сохранённых в браузере. Не создавайте новый ключ: восстановите прежний через Secure Sync или зашифрованный файл.</p>}
   {health.remote==='offline'&&<p className="hint">Сервер недоступен. Проверка локальных ключей проведена отдельно, а сопоставление можно повторить позже.</p>}
   <small>Проверено: {new Date(health.checkedAt).toLocaleString('ru-RU')}</small>
  </div>}
 </section>;
}
