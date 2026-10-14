import {useEffect,useState} from 'react';
import {isValidYmd,type State} from '../../core.ts';
import {saveAccountSetup} from '../../directory.ts';
import {Button,Field,SectionTitle,scheduleTypeOptions,applyScheduleType} from '../../app/AppShared.tsx';
import {workSetupFromState,validateWorkSetup,queueWorkSetup,clearPendingWorkSetup,readPendingWorkSetup,type PendingWorkSetup} from '../../workSettings.ts';
import type {SetupData} from '../../directory/types.ts';

type Props={state:State;patch:(change:Partial<State>)=>void;onNotice:(message:string)=>void};

export function WorkSettingsEditor({state,patch,onNotice}:Props){
 const [draft,setDraft]=useState<SetupData>(()=>workSetupFromState(state));
 const [editing,setEditing]=useState(false);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [pending,setPending]=useState<PendingWorkSetup|null>(()=>readPendingWorkSetup(state.profile.profileId));
 const profileId=state.profile.profileId;

 useEffect(()=>{
  if(!editing)setDraft(workSetupFromState(state));
 },[state.salary,state.taxRate,state.stage,state.vacTotal,state.startDate,state.scheduleType,state.scheduleShift,state.schedulePairType,state.scheduleVakhtaMonths,state.holidayCoeff,state.nightExtraPercent,editing]);

 useEffect(()=>{
  const refresh=()=>setPending(readPendingWorkSetup(profileId));
  refresh();
  const onSync=()=>refresh();
  const timer=window.setInterval(refresh,10000);
  window.addEventListener('workertink:work-synced',onSync);
  return()=>{window.clearInterval(timer);window.removeEventListener('workertink:work-synced',onSync)};
 },[profileId]);

 const update=(change:Partial<SetupData>)=>{setDraft(prev=>({...prev,...change}));setEditing(true);setError('')};
 const reset=()=>{setDraft(workSetupFromState(state));setEditing(false);setError('')};
 const save=async()=>{
  if(saving)return;
  const validation=validateWorkSetup(draft);
  if(validation){setError(validation);return}
  if(!state.directoryToken){setError('Войдите в аккаунт, чтобы сохранить настройки работы.');return}
  const updatedAt=queueWorkSetup(profileId,draft);
  if(updatedAt===null){setError('Не удалось сохранить на устройстве. Проверьте доступность хранилища.');return}
  const submitted={...draft};
  patch(submitted);
  setEditing(false);setError('');
  setPending(readPendingWorkSetup(profileId));
  setSaving(true);
  try{
   await saveAccountSetup(submitted,state.directoryToken);
   clearPendingWorkSetup(profileId,updatedAt);
   setPending(readPendingWorkSetup(profileId));
   window.dispatchEvent(new Event('workertink:work-synced'));
   onNotice('Рабочие данные сохранены на устройстве и в аккаунте');
  }catch{
   setPending(readPendingWorkSetup(profileId));
   onNotice('Рабочие данные сохранены на устройстве. Синхронизация с аккаунтом повторится при подключении.');
  }finally{setSaving(false)}
 };
 const dirty=JSON.stringify(draft)!==JSON.stringify(workSetupFromState(state));
 return <>
  <div id="wt-settings-work" className="settings-card full-width" data-settings-section="work">
   <SectionTitle eyebrow="Условия работы" title="Изменить рабочие данные"/>
   <p className="hint">Вы можете менять условия работы в любое время. После сохранения календарь, смены, отпускные и расчёт зарплаты пересчитаются автоматически. Изменение даты начала или графика влияет и на прошедшие месяцы.</p>
   <div className="compact-fields">
    <Field label="Оклад, ₽"><input type="number" min="0" max="100000000" inputMode="decimal" value={draft.salary} onChange={e=>update({salary:Number(e.target.value)})}/></Field>
    <Field label="НДФЛ, %"><input type="number" min="0" max="100" step="0.1" inputMode="decimal" value={draft.taxRate} onChange={e=>update({taxRate:Number(e.target.value)})}/></Field>
    <Field label="Стаж, лет"><input type="number" min="0" max="60" step="1" value={draft.stage} onChange={e=>update({stage:Number(e.target.value)})}/></Field>
    <Field label="Отпуск, дней"><input type="number" min="0" max="365" step="1" value={draft.vacTotal} onChange={e=>update({vacTotal:Number(e.target.value)})}/></Field>
   </div>
  </div>
  <div className="settings-card full-width" data-settings-section="work">
   <SectionTitle eyebrow="Рабочий график" title="Цикл и доплаты"/>
   <div className="compact-fields">
    <Field label="Тип графика"><select value={draft.scheduleType} onChange={e=>setDraft(current=>{setEditing(true);setError('');return {...current,...applyScheduleType({...state,...current},e.target.value as State['scheduleType'])}})}>{scheduleTypeOptions.map(x=><option key={x}>{x}</option>)}</select></Field>
    <Field label="Дата начала цикла"><input type="date" value={draft.startDate} aria-invalid={draft.startDate!==''&&!isValidYmd(draft.startDate)} onChange={e=>update({startDate:e.target.value})}/></Field>
    {draft.scheduleType==='2/2'?<Field label="Пара смен"><select value={draft.schedulePairType} onChange={e=>update({schedulePairType:e.target.value as SetupData['schedulePairType']})}><option value="day-day">День / День</option><option value="day-night">День / Ночь</option><option value="night-night">Ночь / Ночь</option></select></Field>:<Field label={draft.scheduleType==='7/0'?'Тип вахты':'Смена'}><select value={draft.scheduleShift} onChange={e=>update({scheduleShift:e.target.value as SetupData['scheduleShift']})}><option value="day">День</option><option value="night">Ночь</option>{draft.scheduleType==='7/0'&&<option value="full">Сутки</option>}</select></Field>}
    {draft.scheduleType==='7/0'&&<Field label="Вахта, месяцев"><input type="number" min="1" max="6" step="1" value={draft.scheduleVakhtaMonths} onChange={e=>update({scheduleVakhtaMonths:Number(e.target.value)})}/></Field>}
    <Field label="Праздничный коэффициент, ×"><input type="number" min="1" max="10" step="0.1" value={draft.holidayCoeff} onChange={e=>update({holidayCoeff:Number(e.target.value)})}/></Field>
    <Field label="Ночная доплата, %"><input type="number" min="0" max="200" step="1" value={draft.nightExtraPercent} onChange={e=>update({nightExtraPercent:Number(e.target.value)})}/></Field>
   </div>
   {error&&<p className="form-error" role="alert">{error}</p>}
   {pending&&<p className="hint" role="status">Изменения сохранены на этом устройстве; ожидается синхронизация с аккаунтом.</p>}
   <div className="data-buttons">
    <Button primary onClick={()=>void save()} disabled={saving||!dirty}>{saving?'Синхронизируем…':'Сохранить изменения'}</Button>
    <Button quiet onClick={reset} disabled={saving||!editing}>Отменить правки</Button>
   </div>
   {!dirty&&!pending&&!saving&&<p className="hint" role="status">Все изменения применены. Данные сохраняются локально и синхронизируются с аккаунтом.</p>}
  </div>
 </>;
}
