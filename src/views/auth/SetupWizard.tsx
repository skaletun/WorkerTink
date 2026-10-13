import {useMemo, useState, type Dispatch, type SetStateAction} from 'react';
import {calcMonth, formatMoney, getScheduledShift, isValidYmd, MONTHS, type State} from '../../core.ts';
import {saveAccountSetup} from '../../directory.ts';
import {Icon} from '../../Icon.tsx';
import {applyScheduleType, scheduleTypeOptions} from '../../app/AppShared.tsx';

type Props = {state:State;setState:Dispatch<SetStateAction<State>>};
type Step = 1|2|3;
const names = ['Доход','График','Проверка'] as const;
const descriptions:Record<State['scheduleType'],string>={
 '5/2':'Пять рабочих, два выходных',
 '4/1':'Четыре рабочих, один выходной',
 '3/2':'Три рабочих, два выходных',
 '3/1':'Три рабочих, один выходной',
 '6/1':'Шесть рабочих, один выходной',
 '2/2':'Две смены, два выходных',
 '7/0':'Непрерывная вахта'
};
const shiftLabel=(value:string)=>value==='night'?'Ночь':value==='day'?'День':value==='full'?'Сутки':'Выходной';
const clamp=(value:string,max:number)=>Math.min(max,Math.max(0,Number(value)||0));

export default function SetupWizard({state,setState}:Props){
 const [step,setStep]=useState<Step>(1);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const patch=(change:Partial<State>)=>{setState(previous=>({...previous,...change}));setError('')};
 const previewMonth=useMemo(()=>{
  const now=new Date();
  try{return calcMonth(state,now.getFullYear(),now.getMonth())}catch{return null}
 },[state]);
 const previewDays=useMemo(()=>{
  if(!isValidYmd(state.startDate))return [];
  const start=new Date(state.startDate+'T12:00:00');
  return Array.from({length:7},(_,index)=>{
   const date=new Date(start);date.setDate(date.getDate()+index);
   return {day:date.toLocaleDateString('ru-RU',{weekday:'short'}),date:date.getDate(),shift:getScheduledShift(state,date)};
  });
 },[state.startDate,state.scheduleType,state.scheduleShift,state.schedulePairType,state.scheduleVakhtaMonths]);
 const valid=state.salary>=0&&Number.isFinite(state.salary)&&state.stage>=0&&state.stage<=60&&state.vacTotal>=0&&state.nightExtraPercent>=0&&state.nightExtraPercent<=200&&state.taxRate>=0&&state.taxRate<=100&&isValidYmd(state.startDate)&&state.scheduleVakhtaMonths>=1&&state.scheduleVakhtaMonths<=6;
 const next=async()=>{
  if(!valid){setError('Проверьте значения и дату начала графика.');return}
  if(step<3){setStep((step+1) as Step);setError('');return}
  if(!state.directoryToken){setError('Сессия аккаунта не найдена. Войдите снова.');return}
  setBusy(true);setError('');
  try{
   await saveAccountSetup({
    salary:state.salary,taxRate:state.taxRate,stage:state.stage,vacTotal:state.vacTotal,
    startDate:state.startDate,scheduleType:state.scheduleType,scheduleShift:state.scheduleShift,
    scheduleVakhtaMonths:state.scheduleVakhtaMonths,schedulePairType:state.schedulePairType,
    holidayCoeff:state.holidayCoeff,nightExtraPercent:state.nightExtraPercent
   },state.directoryToken);
   patch({setupComplete:true});
  }catch{setError('Не удалось сохранить настройки. Проверьте подключение и попробуйте снова.')}
  finally{setBusy(false)}
 };
 const goBack=()=>{if(step>1){setError('');setStep((step-1) as Step)}};
 const formatShift=()=>state.scheduleType==='2/2'
  ?({'day-day':'День / день','day-night':'День / ночь','night-night':'Ночь / ночь'}[state.schedulePairType])
  :shiftLabel(state.scheduleShift);
 return <div className="wt-setup-screen wt-wizard">
  <aside className="wt-wizard-aside">
   <div className="wt-wizard-brand"><span className="wt-wizard-logo">w</span><strong>wtinker<span>.</span></strong></div>
   <div className="wt-wizard-aside-main">
    <span className="wt-wizard-index">ПЕРСОНАЛЬНАЯ НАСТРОЙКА / 01—03</span>
    <h2>Всё работает<br/>по твоему<br/><em>ритму.</em></h2>
    <p>Пара минут — и календарь, зарплата и отпуск будут считаться под твои условия.</p>
    <div className="wt-wizard-preview-card">
     <span className="wt-wizard-preview-title"><Icon name="calendar" size={18}/> Твой рабочий ритм</span>
     <div className="wt-wizard-preview-grid">
      {previewDays.slice(0,5).map((item,index)=><span key={index} className={'wt-wizard-preview-day '+(item.shift==='off'?'is-off':item.shift==='night'?'is-night':'is-work')}><small>{item.day}</small><b>{item.date}</b></span>)}
     </div>
     <small>Предварительный график · {state.scheduleType}</small>
    </div>
   </div>
   <div className="wt-wizard-trust"><Icon name="shield" size={18}/><span>Расчёты и заметки хранятся на устройстве. Настройки можно изменить в любой момент.</span></div>
  </aside>
  <main className="wt-wizard-main">
   <div className="wt-wizard-mobile-brand"><span className="wt-wizard-logo">w</span><strong>wtinker<span>.</span></strong></div>
   <nav className="wt-wizard-steps" aria-label="Этапы настройки">
    {names.map((name,index)=>{
     const number=(index+1) as Step;
     return <button type="button" key={name} className={'wt-wizard-step '+(step===number?'is-current':step>number?'is-done':'')} disabled={busy||number>step} onClick={()=>{setStep(number);setError('')}} aria-current={step===number?'step':undefined}>
      <span className="wt-wizard-step-number">{step>number?<Icon name="check" size={14}/>:String(number).padStart(2,'0')}</span><span>{name}</span>
     </button>
    })}
   </nav>
   <div className="wt-wizard-content">
    {step===1&&<section aria-labelledby="wt-wizard-title">
     <div className="wt-wizard-heading"><span className="wt-overline">01 / ОСНОВА РАСЧЁТА</span><h1 id="wt-wizard-title">Начнём с дохода.</h1><p>Нам нужны только условия оплаты. Это не банковская информация — здесь ничего не списывается.</p></div>
     <div className="wt-wizard-field wt-wizard-salary"><label htmlFor="wt-setup-salary">Месячный оклад, ₽</label><input id="wt-setup-salary" type="number" min="0" step="1000" inputMode="decimal" value={state.salary} onChange={e=>patch({salary:clamp(e.target.value,100000000)})}/><span>До налогов и дополнительных выплат</span></div>
     <div className="wt-wizard-fields">
      <label className="wt-wizard-field">НДФЛ, %<input type="number" min="0" max="100" step=".1" inputMode="decimal" value={state.taxRate} onChange={e=>patch({taxRate:clamp(e.target.value,100)})}/><small>Стандартные ставки учитывают прогрессивный расчёт</small></label>
      <label className="wt-wizard-field">Стаж, лет<input type="number" min="0" max="60" value={state.stage} onChange={e=>patch({stage:clamp(e.target.value,60)})}/><small>Влияет на оплату больничных</small></label>
      <label className="wt-wizard-field">Отпуск, дней<input type="number" min="0" max="365" value={state.vacTotal} onChange={e=>patch({vacTotal:clamp(e.target.value,365)})}/><small>Годовой доступный остаток</small></label>
      <label className="wt-wizard-field">Ночная доплата, %<input type="number" min="0" max="200" value={state.nightExtraPercent} onChange={e=>patch({nightExtraPercent:clamp(e.target.value,200)})}/><small>Начисляется при ночных сменах</small></label>
     </div>
     <div className="wt-wizard-tip"><Icon name="shield" size={17}/><p>Параметры сохранятся в твоём профиле. Историю доходов для точного расчёта больничных можно добавить позже.</p></div>
    </section>}
    {step===2&&<section aria-labelledby="wt-wizard-title">
     <div className="wt-wizard-heading"><span className="wt-overline">02 / ГРАФИК И СМЕНЫ</span><h1 id="wt-wizard-title">Как ты работаешь?</h1><p>Выбери цикл — ниже сразу покажем, как будут чередоваться ближайшие дни.</p></div>
     <div className="wt-wizard-field"><span className="wt-wizard-field-title">Рабочий цикл</span><div className="wt-wizard-schedule-choices" role="group" aria-label="Тип рабочего графика">
      {scheduleTypeOptions.map(type=><button type="button" key={type} className={'wt-wizard-schedule '+(state.scheduleType===type?'is-active':'')} aria-pressed={state.scheduleType===type} onClick={()=>patch(applyScheduleType(state,type))}><strong>{type}</strong><small>{descriptions[type]}</small>{state.scheduleType===type&&<Icon name="check" size={16}/>}</button>)}
     </div></div>
     <div className="wt-wizard-fields">
      <label className="wt-wizard-field">Дата начала цикла<input type="date" value={state.startDate} onChange={e=>patch({startDate:e.target.value})}/><small>Отсчёт смен начнётся с этого дня</small></label>
      {state.scheduleType==='2/2'?<label className="wt-wizard-field">Порядок смен<select value={state.schedulePairType} onChange={e=>patch({schedulePairType:e.target.value as State['schedulePairType']})}><option value="day-day">День / день</option><option value="day-night">День / ночь</option><option value="night-night">Ночь / ночь</option></select><small>Типы двух рабочих дней</small></label>:<label className="wt-wizard-field">Тип смены<select value={state.scheduleShift} onChange={e=>patch({scheduleShift:e.target.value as State['scheduleShift']})}><option value="day">Дневная</option><option value="night">Ночная</option>{state.scheduleType==='7/0'&&<option value="full">Суточная</option>}</select><small>Применяется к рабочим дням</small></label>}
      {state.scheduleType==='7/0'&&<label className="wt-wizard-field">Продолжительность вахты, мес.<select value={state.scheduleVakhtaMonths} onChange={e=>patch({scheduleVakhtaMonths:Number(e.target.value)})}>{[1,2,3,4,5,6].map(n=><option value={n} key={n}>{n} {n===1?'месяц':n<5?'месяца':'месяцев'}</option>)}</select><small>После завершения периода показываются выходные</small></label>}
     </div>
     <div className="wt-wizard-cycle"><div><strong>Предпросмотр цикла</strong><span>{state.startDate||'Выберите дату'} · {state.scheduleType}</span></div><div className="wt-wizard-cycle-days">{previewDays.map((d,i)=><div key={i} className={'wt-wizard-cycle-day '+(d.shift==='off'?'is-off':d.shift==='night'?'is-night':'is-work')}><small>{d.day}</small><strong>{d.date}</strong><span>{shiftLabel(d.shift)}</span></div>)}</div><small>Показываем план по выбранным настройкам. Смены можно редактировать в календаре.</small></div>
    </section>}
    {step===3&&<section aria-labelledby="wt-wizard-title">
     <div className="wt-wizard-heading"><span className="wt-overline">03 / ВСЁ ГОТОВО</span><h1 id="wt-wizard-title">Твой ритм настроен.</h1><p>Проверь основные параметры. Всё ниже можно будет изменить в настройках WTinker.</p></div>
     <div className="wt-wizard-review-hero"><span>Предварительный расчёт на {MONTHS[new Date().getMonth()].toLowerCase()}</span><strong>{previewMonth?formatMoney(previewMonth.net):'—'}</strong><small>На руки · зависит от даты начала, графика и начислений</small></div>
     <div className="wt-wizard-review-list">
      <div><span><Icon name="pay" size={17}/> Оклад</span><strong>{formatMoney(state.salary)}</strong></div>
      <div><span><Icon name="calendar" size={17}/> График</span><strong>{state.scheduleType} · {formatShift()}</strong></div>
      <div><span><Icon name="work" size={17}/> Первая смена</span><strong>{state.startDate}</strong></div>
      <div><span><Icon name="absence" size={17}/> Отпуск</span><strong>{state.vacTotal} дней</strong></div>
      <div><span><Icon name="pay" size={17}/> Ночная доплата</span><strong>{state.nightExtraPercent}%</strong></div>
     </div>
     <div className="wt-wizard-tip"><Icon name="check" size={17}/><p>После сохранения откроется твоё рабочее пространство: календарь, расчёт зарплаты, отпуск и заметки.</p></div>
    </section>}
   </div>
   <footer className="wt-wizard-footer">
    <div className="wt-wizard-footer-copy"><strong>Шаг {step} из 3</strong><span>{step===3?'Готово к запуску':'Можно вернуться и изменить значения'}</span></div>
    <div className="wt-wizard-actions">
     {step>1&&<button type="button" className="wt-wizard-button secondary" disabled={busy} onClick={goBack}><Icon name="chevronLeft" size={17}/> Назад</button>}
     <button type="button" className="wt-wizard-button primary" onClick={()=>void next()} disabled={busy||!valid}>{busy?'Сохраняем…':step===3?'Открыть WTinker':'Продолжить'}<Icon name={step===3?'check':'chevronRight'} size={18}/></button>
    </div>
   </footer>
   {error&&<p role="alert" className="wt-wizard-error">{error}</p>}
  </main>
 </div>;
}
