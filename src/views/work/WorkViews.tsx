import {useMemo} from 'react';
import {DOW,MONTHS,State,calcMonth,calcYear,formatMoney,getShift,getScheduledShift,isHoliday,holidayName,ymd,shiftLabel,vacationUsedDays,vacationCalendarDays,isValidYmd} from '../../core.ts';
import {Icon} from '../../Icon.tsx';
import {Button,Field,SectionTitle,type PeriodDraft} from '../../app/AppShared.tsx';
export function CalendarView({state,view,days,calc,shiftMonth,onPay,onAbsence,onEdit}:{state:State;view:Date;days:(Date|null)[];calc:ReturnType<typeof calcMonth>;shiftMonth:(n:number)=>void;onPay:()=>void;onAbsence:()=>void;onEdit:(date:string)=>void}){
 return <section className="canva-page canva-calendar">
  <header className="canva-page-head"><div><span className="canva-kicker">КАЛЕНДАРЬ СМЕН</span><h1>Ваш график</h1><p>Смены, изменения и рабочие заметки собраны в календарной области.</p></div><div className="canva-head-actions"><button className="canva-button" onClick={onAbsence}>Отсутствия</button><button className="canva-button canva-button-primary" onClick={onPay}>Зарплата</button></div></header>
  <section className="canva-calendar-shell">
   <div className="canva-calendar-head"><div><span className="canva-kicker">{state.scheduleType} · {state.scheduleType==='2/2'?(state.schedulePairType==='day-night'?'день / ночь':state.schedulePairType==='day-day'?'день / день':'ночь / ночь'):state.scheduleShift==='day'?'дневные':state.scheduleShift==='night'?'ночные':'сутки'}</span><h2>{MONTHS[view.getMonth()]} <em>{view.getFullYear()}</em></h2></div><div className="canva-calendar-controls"><button onClick={()=>shiftMonth(-1)} aria-label="Предыдущий месяц"><Icon name="chevronLeft" size={16}/></button><button onClick={()=>shiftMonth(1)} aria-label="Следующий месяц"><Icon name="chevronRight" size={16}/></button></div></div>
   <div className="canva-calendar-week">{DOW.map(d=><span key={d}>{d}</span>)}</div>
   <div className="canva-calendar-grid">{days.map((d,i)=>d?<CalendarDay key={i} state={state} date={d} onEdit={onEdit}/>:<div className="canva-calendar-empty" key={i}/>)}</div>
   <div className="canva-calendar-note"><span>Нажмите на день, чтобы изменить смену и открыть заметку.</span><span>П · праздник</span></div>
  </section>
  <section className="canva-calendar-summary">
   <div><span className="canva-kicker">ЗА ВЫБРАННЫЙ МЕСЯЦ</span><strong>{formatMoney(calc.net)}</strong><small>На руки · {MONTHS[view.getMonth()].toLowerCase()}</small></div>
   <div><span className="canva-kicker">РАБОЧАЯ НАГРУЗКА</span><strong>{calc.work}</strong><small>смен</small></div>
   <div><span className="canva-kicker">ОТПУСК</span><strong>{calc.vacDays}</strong><small>дней отпуска</small></div>
   <div><span className="canva-kicker">БОЛЬНИЧНЫЙ</span><strong>{calc.sickDays}</strong><small>дней больничного</small></div>
  </section>
  <section className="canva-calendar-actions"><button onClick={onPay}><b>Зарплата и выплаты</b><small>Аванс · остаток · даты</small><Icon name="chevronRight" size={15}/></button><button onClick={onAbsence}><b>Отпуск и больничные</b><small>Добавить или изменить период</small><Icon name="chevronRight" size={15}/></button></section>
 </section>
}
function CalendarDay({state,date,onEdit}:{state:State;date:Date;onEdit:(date:string)=>void}){const dateKey=ymd(date),beforeStart=state.startDate?dateKey<state.startDate:false,today=ymd(new Date())===dateKey,holiday=isHoliday(date),note=Boolean(state.shiftNotes[dateKey]?.trim());if(beforeStart)return <button className={`calendar-day pre-start ${today?'today':''}`} disabled title="До даты выхода на работу"><div className="day-top"><b>{date.getDate()}</b><span>—</span></div><span>До начала</span></button>;const shift=getShift(state,date),scheduled=getScheduledShift(state,date),vacation=state.vacations.some(p=>p.start<=dateKey&&dateKey<=p.end),sick=state.sickLeaves.some(p=>p.start<=dateKey&&dateKey<=p.end);const label=vacation?'Отпуск':sick?'Больничный':shiftLabel(shift);return <button className={`calendar-day ${shift} ${holiday?'holiday':''} ${today?'today':''} ${note?'has-note':''}`} data-shift={shift} onClick={()=>onEdit(dateKey)} title={holiday?holidayName(date):label}><div className="day-top"><b>{date.getDate()}</b><span>{holiday?'П':note?'З':''}</span></div><span>{label}</span>{scheduled!==shift&&<small>изменено</small>}</button>}

export function PayView({state,calc,keyMonth,payment,setAdvance,goMonth,goYear}:{state:State;calc:ReturnType<typeof calcMonth>;keyMonth:string;payment:(field:'advanceDate'|'remainderDate',value:string)=>void;setAdvance:(value:string)=>void;goMonth:(n:number)=>void;goYear:(n:number)=>void}){
 const hasCustomAdvance=calc.advanceIsCustom;const annual=useMemo(()=>calcYear(state,calc.year),[state,calc.year]);
 return <section className="canva-page canva-pay">
  <header className="canva-page-head"><div><span className="canva-kicker">ФИНАНСЫ</span><h1>Зарплата и выплаты</h1><p>Расчёт месяца, аванс и годовая динамика в одной финансовой области.</p></div><div className="canva-head-actions"><button className="canva-button" onClick={()=>goYear(-1)}>Предыдущий год</button><button className="canva-button canva-button-primary" onClick={()=>goYear(1)}>Следующий год</button></div></header>
  <section className="canva-pay-overview"><div className="canva-pay-hero"><span className="canva-kicker">ЗА ВЫБРАННЫЙ МЕСЯЦ</span><strong>{formatMoney(calc.net)}</strong><p>На руки · начислено {formatMoney(calc.gross)}</p></div><div className="canva-pay-metric"><span>Аванс</span><b>{formatMoney(calc.advance)}</b><small>{calc.paymentDates.advanceDate||'дата не указана'}</small></div><div className="canva-pay-metric"><span>Остаток</span><b>{formatMoney(calc.remainder)}</b><small>{calc.paymentDates.remainderDate||'дата не указана'}</small></div></section>
  <div className="canva-pay-grid">
   <section className="canva-pay-breakdown"><div className="canva-section-head"><div><span className="canva-kicker">НАЧИСЛЕНИЯ</span><h2>Из чего складывается зарплата</h2></div><div className="canva-month-picker"><button onClick={()=>goMonth(-1)} aria-label="Предыдущий месяц"><Icon name="chevronLeft" size={14}/></button><b>{MONTHS[calc.month]} {calc.year}</b><button onClick={()=>goMonth(1)} aria-label="Следующий месяц"><Icon name="chevronRight" size={14}/></button></div></div>
   <div className="canva-money-list"><div>Базовая часть <b>{formatMoney(calc.base)}</b></div><div>Дополнительные смены <b>{formatMoney(calc.extraPay)}</b></div><div>Праздничная доплата · {state.holidayCoeff}× <b>{formatMoney(calc.holidayExtra)}</b></div><div>Ночная доплата · {state.nightExtraPercent}% <b>{formatMoney(calc.nightExtra)}</b></div><div>Отпускные <b>{formatMoney(calc.vacPay)}</b></div><div>Больничные <b>{formatMoney(calc.sickPay)}</b></div><div className="tax">НДФЛ <b>− {formatMoney(calc.tax)}</b></div><div className="total">На руки <b>{formatMoney(calc.net)}</b></div></div>
   </section>
   <aside className="canva-pay-form"><div className="canva-section-head"><div><span className="canva-kicker">ГРАФИК ВЫПЛАТ</span><h2>Аванс и остаток</h2></div></div><p>Аванс по умолчанию — 50% оклада. Для этого месяца значение можно изменить вручную.</p><Field label="Сумма аванса, ₽"><input type="number" min="0" step="1" value={hasCustomAdvance?state.advances[keyMonth]:calc.advance} onChange={e=>setAdvance(e.target.value)} onFocus={e=>{if(!hasCustomAdvance)e.currentTarget.select()}}/></Field><Field label="Дата аванса"><input type="date" value={calc.paymentDates.advanceDate} onChange={e=>payment('advanceDate',e.target.value)}/></Field><Field label="Дата остатка"><input type="date" value={calc.paymentDates.remainderDate} onChange={e=>payment('remainderDate',e.target.value)}/></Field></aside>
  </div>
  <AnnualSummary annual={annual} goYear={goYear}/>
 </section>
}
function AnnualSummary({annual,goYear}:{annual:ReturnType<typeof calcYear>;goYear:(n:number)=>void}){const peak=Math.max(1,...annual.months.map(m=>m.net));return <section className="annual-card"><div className="annual-head"><div><span className="eyebrow">Годовой итог</span><h2>Доход за {annual.year}</h2><p>Все 12 месяцев с учётом смен, дополнительных смен, ночных и праздничных доплат, отпуска, больничных и НДФЛ.</p></div><div className="annual-year-controls"><button onClick={()=>goYear(-1)} aria-label="Предыдущий год"><Icon name="chevronLeft" size={16}/></button><strong>{annual.year}</strong><button onClick={()=>goYear(1)} aria-label="Следующий год"><Icon name="chevronRight" size={16}/></button></div></div><div className="annual-kpis"><div><span>На руки</span><b>{formatMoney(annual.net)}</b><small>итог за год</small></div><div><span>Начислено</span><b>{formatMoney(annual.gross)}</b><small>до НДФЛ</small></div><div><span>НДФЛ</span><b>{formatMoney(annual.tax)}</b><small>удержано</small></div><div><span>Среднее на руки</span><b>{formatMoney(annual.averageMonthlyNet)}</b><small>в месяц</small></div></div><div className="wt-pay-trend" role="img" aria-label={"Чистый доход за каждый месяц "+annual.year+" года"}>
 <div className="wt-pay-trend-title"><div><strong>Динамика дохода</strong><span>После налогов · по месяцам</span></div><span>{annual.year}</span></div>
 <div className="wt-pay-trend-chart">{annual.months.map(month=><div className="wt-pay-trend-month" key={month.month} title={MONTHS[month.month]+": "+formatMoney(month.net)}>
   <div className="wt-pay-trend-track"><div className="wt-pay-trend-bar" style={{height:Math.max(month.net>0?6:0,Math.round(month.net/peak*100))+"%"}}/></div>
   <span>{MONTHS[month.month].slice(0,3)}</span>
 </div>)}</div>
 </div><details className="wt-annual-details"><summary><span><Icon name="calendar" size={17}/> Подробная годовая ведомость</span><Icon name="chevronDown" size={18}/></summary><div className="wt-annual-details-body"><div className="annual-components"><div><span>Базовая часть</span><b>{formatMoney(annual.base)}</b></div><div><span>Доп. смены</span><b>{formatMoney(annual.extraPay)}</b></div><div><span>Праздничные доплаты</span><b>{formatMoney(annual.holidayExtra)}</b></div><div><span>Ночные доплаты</span><b>{formatMoney(annual.nightExtra)}</b></div><div><span>Отпускные</span><b>{formatMoney(annual.vacPay)}</b></div><div><span>Больничные</span><b>{formatMoney(annual.sickPay)}</b></div><div><span>Смены</span><b>{annual.work}</b></div><div><span>Праздничные смены</span><b>{annual.holidayWork}</b></div><div><span>Дни отпуска</span><b>{annual.vacDays}</b></div><div><span>Дни больничного</span><b>{annual.sickDays}</b></div></div><div className="annual-table-wrap"><table className="annual-table"><thead><tr><th>Месяц</th><th>Начислено</th><th>НДФЛ</th><th>На руки</th><th>Аванс</th><th>Остаток</th></tr></thead><tbody>{annual.months.map((m)=><tr key={m.month}><td>{MONTHS[m.month]}</td><td>{formatMoney(m.gross)}</td><td>{formatMoney(m.tax)}</td><td><b>{formatMoney(m.net)}</b></td><td>{formatMoney(m.advance)}</td><td>{formatMoney(m.remainder)}</td></tr>)}</tbody><tfoot><tr><th>Итого</th><th>{formatMoney(annual.gross)}</th><th>{formatMoney(annual.tax)}</th><th>{formatMoney(annual.net)}</th><th>{formatMoney(annual.advance)}</th><th>{formatMoney(annual.remainder)}</th></tr></tfoot></table></div><p className="annual-footnote">Годовой итог считается по месяцам начисления. До даты выхода зарплата не начисляется. Аванс по умолчанию составляет 50% указанного оклада; его можно изменить отдельно для каждого месяца.</p></div></details></section>}

export function AbsenceView({state,vac,sick,setVac,setSick,addPeriod,removePeriod}:{state:State;vac:PeriodDraft;sick:PeriodDraft;setVac:(v:PeriodDraft)=>void;setSick:(v:PeriodDraft)=>void;addPeriod:(k:'vacations'|'sickLeaves',d:PeriodDraft)=>void;removePeriod:(k:'vacations'|'sickLeaves',i:number)=>void}){
 const used=vacationUsedDays(state);
 return <section className="canva-page canva-absence">
  <header className="canva-page-head"><div><span className="canva-kicker">ОТСУТСТВИЯ</span><h1>Отпуск и больничные</h1><p>Планируйте отсутствие без выхода из рабочего контура.</p></div></header>
  <section className="canva-absence-overview"><div><span>Лимит отпуска</span><strong>{state.vacTotal}</strong><small>дней</small></div><div><span>Использовано</span><strong>{used}</strong><small>дней</small></div><div className="active"><span>Осталось</span><strong>{Math.max(0,state.vacTotal-used)}</strong><small>дней</small></div></section>
  <div className="canva-absence-grid">
   <PeriodEditor state={state} title="Отпуск" description="Праздничные дни внутри периода не уменьшают количество оплачиваемых дней отпуска." draft={vac} setDraft={setVac} kind="vacations" periods={state.vacations} addPeriod={addPeriod} removePeriod={removePeriod}/>
   <PeriodEditor state={state} title="Больничный" description="Фактический период больничного исключается из отработанных смен." draft={sick} setDraft={setSick} kind="sickLeaves" periods={state.sickLeaves} addPeriod={addPeriod} removePeriod={removePeriod}/>
  </div>
 </section>
}
function PeriodEditor({state,title,description,draft,setDraft,kind,periods,addPeriod,removePeriod}:{state:State;title:string;description:string;draft:PeriodDraft;setDraft:(v:PeriodDraft)=>void;kind:'vacations'|'sickLeaves';periods:{start:string;end:string}[];addPeriod:(k:'vacations'|'sickLeaves',d:PeriodDraft)=>void;removePeriod:(k:'vacations'|'sickLeaves',i:number)=>void}){
 const valid=isValidYmd(draft.start)&&isValidYmd(draft.end)&&draft.end>=draft.start;
 const reversed=isValidYmd(draft.start)&&isValidYmd(draft.end)&&draft.end<draft.start;
 const days=valid?(kind==='vacations'
  ?vacationCalendarDays(state,{start:draft.start,end:draft.end})
  :Math.round((new Date(draft.end+'T12:00:00').getTime()-new Date(draft.start+'T12:00:00').getTime())/86400000)+1):0;
 const readable=(value:string)=>new Date(value+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'short',year:'numeric'});
 return <section className="period-editor" aria-label={title}>
  <div className="wt-period-heading"><span className="wt-period-symbol"><Icon name={kind==='vacations'?'calendar':'absence'} size={21}/></span><div><span className="wt-overline">{kind==='vacations'?'ПЛАНИРОВАНИЕ ОТДЫХА':'УЧЁТ БОЛЬНИЧНЫХ'}</span><h2>{title}</h2></div></div>
  <p className="hint">{description}</p>
  <div className="period-items" aria-label={title+' — сохранённые периоды'}>
   {periods.length?periods.map((period,index)=><div className="period-item" key={period.start+'-'+period.end+'-'+index}>
    <span className="wt-period-calendar"><Icon name="calendar" size={17}/></span>
    <div><b>{readable(period.start)} — {readable(period.end)}</b><small>{kind==='vacations'?vacationCalendarDays(state,period):Math.round((new Date(period.end+'T12:00:00').getTime()-new Date(period.start+'T12:00:00').getTime())/86400000)+1} дн. · сохранено</small></div>
    <button type="button" onClick={()=>removePeriod(kind,index)} aria-label={'Удалить период '+period.start+' — '+period.end}><Icon name="close" size={16}/></button>
   </div>):<div className="wt-period-empty"><Icon name="calendar" size={21}/><strong>Нет сохранённых периодов</strong><span>Выбери даты ниже, чтобы добавить первый период.</span></div>}
  </div>
  <div className="wt-period-create">
   <strong>Новый период</strong>
   <div className="wt-period-dates"><label>Первый день<input type="date" aria-label={title+': первый день'} value={draft.start} onChange={e=>setDraft({...draft,start:e.target.value})}/></label><label>Последний день<input type="date" aria-label={title+': последний день'} min={draft.start||undefined} value={draft.end} onChange={e=>setDraft({...draft,end:e.target.value})}/></label></div>
   <div className="wt-period-create-footer"><span className={reversed?'wt-period-validation is-invalid':'wt-period-validation'} aria-live="polite">{reversed?'Дата окончания раньше даты начала':valid?(days+' '+(kind==='vacations'?'дн. отпуска':'календарных дней')):'Укажи дату начала и окончания'}</span><Button primary disabled={!valid} onClick={()=>addPeriod(kind,draft)}><Icon name="plus" size={16}/> Добавить</Button></div>
  </div>
 </section>;
}
