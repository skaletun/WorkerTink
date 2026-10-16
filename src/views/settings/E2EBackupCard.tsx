import {useState,type ChangeEvent} from 'react';
import {getOwnChatKey} from '../../directory';
import {createEncryptedE2EBackup,restoreEncryptedE2EBackup} from '../../e2eBackup';
import {Icon} from '../../Icon';

type Props={profileId:string;token:string};
const MAX_FILE_SIZE=512*1024;
function errorMessage(error:unknown):string{
 const code=String(error);
 if(code.includes('E2E_BACKUP_WEAK_PASSWORD'))return 'Для резервной копии требуется пароль не короче 12 символов.';
 if(code.includes('E2E_IDENTITY_MISSING')||code.includes('E2E_IDENTITY_MISMATCH'))return 'На этом устройстве нет исходного ключа аккаунта. Создайте копию на устройстве, где доступна переписка.';
 if(code.includes('E2E_BACKUP_DECRYPT_FAILED'))return 'Не удалось расшифровать файл. Проверьте пароль и целостность копии.';
 if(code.includes('E2E_BACKUP_ACCOUNT_MISMATCH'))return 'Эта копия принадлежит другому аккаунту.';
 if(code.includes('E2E_BACKUP_SERVER_KEY_MISMATCH'))return 'Ключ в копии не соответствует ключу вашего аккаунта на сервере. Восстановление отменено.';
 if(code.includes('E2E_BACKUP_TOO_LARGE'))return 'Файл резервной копии слишком большой.';
 if(code.includes('E2E_BACKUP_VERSION_UNSUPPORTED'))return 'Эта версия файла не поддерживается.';
 if(code.includes('E2E_BACKUP_CORRUPT'))return 'Файл повреждён или не является резервной копией WTinker.';
 if(code.includes('CHAT_KEY_NOT_READY'))return 'E2E-ключ аккаунта ещё не зарегистрирован. Откройте личные сообщения на исходном устройстве.';
 if(code.includes('UNAUTHORIZED')||code.includes('HTTP_401'))return 'Сессия истекла. Войдите в аккаунт повторно.';
 if(code.includes('E2E_KEY_PERSISTENCE_FAILED'))return 'Браузер не смог сохранить ключ. Проверьте доступное место и настройки хранилища.';
 return 'Операция не выполнена. Проверьте подключение и повторите попытку.';
}

export default function E2EBackupCard({profileId,token}:Props){
 const [mode,setMode]=useState<'export'|'import'|null>(null);
 const [exportPassword,setExportPassword]=useState('');
 const [exportConfirm,setExportConfirm]=useState('');
 const [importPassword,setImportPassword]=useState('');
 const [selectedFile,setSelectedFile]=useState<File|null>(null);
 const [busy,setBusy]=useState(false);
 const [status,setStatus]=useState('');
 const [error,setError]=useState(false);

 const notice=(message:string,failed:boolean)=>{setStatus(message);setError(failed)};
 const changeMode=(next:'export'|'import'|null)=>{
  if(busy)return;
  setMode(next);setStatus('');setError(false);setExportPassword('');setExportConfirm('');setImportPassword('');setSelectedFile(null);
 };
 const exportBackup=async()=>{
  if(!token||!profileId)return notice('Войдите в аккаунт, чтобы создать копию.',true);
  if(exportPassword!==exportConfirm)return notice('Пароли не совпадают.',true);
  setBusy(true);notice('',false);
  try{
   const remote=await getOwnChatKey(token);
   const result=await createEncryptedE2EBackup(profileId,remote.key.publicKey,exportPassword);
   const href=URL.createObjectURL(new Blob([result],{type:'application/json'}));
   try{
    const a=document.createElement('a');
    a.href=href;
    a.download='wtinker-e2e-'+new Date().toISOString().slice(0,10)+'.wte2e';
    document.body.appendChild(a);
    a.click();
    a.remove();
   }finally{window.setTimeout(()=>URL.revokeObjectURL(href),3000)}
   notice('Зашифрованная копия создана. Храните файл и пароль отдельно. Без пароля восстановление невозможно.',false);
  }catch(e){notice(errorMessage(e),true)}
  finally{setBusy(false);setExportPassword('');setExportConfirm('')}
 };
 const onFile=(event:ChangeEvent<HTMLInputElement>)=>{
  const file=event.target.files?.[0]||null;
  event.target.value='';
  if(file&&file.size>MAX_FILE_SIZE){setSelectedFile(null);notice('Файл превышает допустимый размер 512 КБ.',true);return}
  setSelectedFile(file);setStatus('');setError(false);
 };
 const restoreBackup=async()=>{
  if(!token||!profileId)return notice('Войдите в аккаунт, чтобы восстановить ключ.',true);
  if(!selectedFile)return notice('Выберите файл резервной копии.',true);
  setBusy(true);notice('',false);
  try{
   const remote=await getOwnChatKey(token);
   const raw=await selectedFile.text();
   const {restored}=await restoreEncryptedE2EBackup(raw,profileId,remote.key.publicKey,importPassword);
   notice('Ключи восстановлены ('+restored+'). Теперь можно открыть переписку, чтобы расшифровать историю.',false);
   setSelectedFile(null);
  }catch(e){notice(errorMessage(e),true)}
  finally{setBusy(false);setImportPassword('')}
 };
 return <section className="settings-card full-width wt-e2e-backup-card" data-settings-section="account" aria-labelledby="wt-e2e-backup-title">
  <div className="wt-e2e-backup-heading">
   <span className="wt-e2e-backup-icon"><Icon name="shield" size={21}/></span>
   <div><span className="canva-kicker">Secure Sync · первый этап</span><h2 id="wt-e2e-backup-title">Резервная копия переписки</h2></div>
  </div>
  <p className="hint">Создайте зашифрованную копию E2E-ключей перед сменой телефона или браузера. Она включает доступные исторические версии ключа, необходимые для старых сообщений и вложений. Сервер WTinker не получает файл, пароль или закрытые ключи.</p>
  <div className="wt-e2e-backup-actions">
   <button type="button" className={'btn '+(mode==='export'?'primary':'quiet')} onClick={()=>changeMode(mode==='export'?null:'export')} disabled={busy} aria-expanded={mode==='export'}>Сохранить ключи</button>
   <button type="button" className={'btn '+(mode==='import'?'primary':'quiet')} onClick={()=>changeMode(mode==='import'?null:'import')} disabled={busy} aria-expanded={mode==='import'}>Восстановить ключи</button>
  </div>
  {mode==='export'&&<div className="wt-e2e-backup-form">
   <p>Пароль шифрует резервную копию AES-256-GCM. Используйте отдельную надёжную парольную фразу от 12 символов — не PIN аккаунта.</p>
   <div className="wt-e2e-backup-fields">
    <label>Пароль резервной копии<input type="password" autoComplete="new-password" minLength={12} maxLength={1024} value={exportPassword} onChange={e=>setExportPassword(e.target.value)} placeholder="Не менее 12 символов"/></label>
    <label>Повторите пароль<input type="password" autoComplete="new-password" minLength={12} maxLength={1024} value={exportConfirm} onChange={e=>setExportConfirm(e.target.value)} placeholder="Повторите пароль"/></label>
   </div>
   <button className="btn primary" type="button" disabled={busy||exportPassword.length<12||!exportConfirm} onClick={()=>void exportBackup()}>{busy?'Шифруем копию…':'Скачать зашифрованную копию'}</button>
  </div>}
  {mode==='import'&&<div className="wt-e2e-backup-form">
   <p>Восстановление доступно только для текущего аккаунта. Ключ сверяется с уже зарегистрированным на сервере — чужой или несовместимый ключ не заменит ваш.</p>
   <div className="wt-e2e-backup-fields">
    <label>Файл резервной копии<input type="file" accept=".wte2e,.json,application/json" onChange={onFile} disabled={busy}/>{selectedFile&&<small>{selectedFile.name}</small>}</label>
    <label>Пароль резервной копии<input type="password" autoComplete="off" maxLength={1024} value={importPassword} onChange={e=>setImportPassword(e.target.value)} disabled={busy} placeholder="Пароль файла"/></label>
   </div>
   <button type="button" className="btn primary" disabled={busy||!selectedFile||!importPassword} onClick={()=>void restoreBackup()}>{busy?'Проверяем и восстанавливаем…':'Восстановить E2E-ключи'}</button>
  </div>}
  {status&&<p className={'wt-e2e-backup-status'+(error?' is-error':'')} role={error?'alert':'status'}>{status}</p>}
  <p className="wt-e2e-backup-footnote"><Icon name="lock" size={15}/> Резервная копия защищает ключи. Это не экспорт сообщений и не автоматическая синхронизация между устройствами.</p>
 </section>;
}
