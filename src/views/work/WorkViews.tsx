import {useMemo} from 'react';
import {DOW,MONTHS,State,calcMonth,calcYear,formatMoney,getShift,getScheduledShift,isHoliday,holidayName,ymd,shiftLabel,vacationUsedDays,vacationCalendarDays,isValidYmd} from '../../core.ts';
import {Icon} from '../../Icon.tsx';
import {Button,Field,SectionTitle,type PeriodDraft} from '../../app/AppShared.tsx';
export function CalendarView({state,view,days,calc,shiftMonth,onPay,onAbsence,onEdit}:{state:State;view:Date;days:(Date|null)[];calc:ReturnType<typeof calcMonth>;shiftMonth:(n:number)=>void;onPay:()=>void;onAbsence:()=>void;onEdit:(date:string)=>void}){
 return <section className="canva-page canva-calendar wt-shift-planner">
  <header className="wt-shift-planner-heading"><div><span className="wt-shift-planner-overline">РАБОЧИЙ ПЛАНЕР / {view.getFullYear()}</span><h1>Календарь<br/><em>моих смен.</em></h1><p>Выберите день, чтобы изменить смену, оставить заметку или посмотреть выплаты.</p></div><div className="wt-shift-planner-heading-actions"><button onClick={onPay}>Зарплата <Icon name="chevronRight" size={16}/></button><button onClick={onAbsence}>Отсутствия <Icon name="chevronRight" size={16}/></button></div></header>
  <div className="wt-shift-planner-layout">
   <aside className="wt-shift-planner-rail">
    <div className="wt-shift-rail-top"><span className="wt-shift-planner-overline">01 / ПЕРИОД</span><strong>{MONTHS[view.getMonth()]}</strong><small>{view.getFullYear()} год</small><div className="wt-shift-rail-controls"><button onClick={()=>shiftMonth(-1)} aria-label="Предыдущий месяц"><Icon name="chevronLeft" size={19}/></button><button onClick={()=>shiftMonth(1)} aria-label="Следующий месяц"><Icon name="chevronRight" size={19}/></button></div></div>
    <div className="wt-shift-rail-stat"><span>РАСЧЁТ К ВЫПЛАТЕ</span><strong>{formatMoney(calc.net)}</strong><button onClick={onPay}>Открыть ведомость <Icon name="chevronRight" size={15}/></button></div>
    <div className="wt-shift-rail-facts"><span className="wt-shift-planner-overline">02 / НАГРУЗКА</span><div><b>{calc.work}</b><span>Рабочих смен</span></div><div><b>{calc.vacDays}</b><span>Дней отпуска</span></div><div><b>{calc.sickDays}</b><span>Дней больничного</span></div></div>
    <div className="wt-shift-rail-guidance"><span className="wt-shift-planner-overline">НАВИГАЦИЯ</span><p>Нажмите на день: откроется редактор смены и заметки.</p><button onClick={onAbsence}>Периоды отсутствия <Icon name="chevronRight" size={16}/></button></div>
   </aside>
   <section className="canva-calendar-shell wt-shift-planner-grid">
    <div className="wt-shift-planner-grid-title"><div><span className="wt-shift-planner-overline">{state.scheduleType} · {state.scheduleType==='2/2'?(state.schedulePairType==='day-night'?'день / ночь':state.schedulePairType==='day-day'?'день / день':'ночь / ночь'):state.scheduleShift==='day'?'дневные':state.scheduleShift==='night'?'ночные':'сутки'}</span><h2>{MONTHS[view.getMonth()]} <small>{view.getFullYear()}</small></h2></div><div><button onClick={()=>shiftMonth(-1)} aria-label="Предыдущий месяц"><Icon name="chevronLeft" size={17}/></button><button onClick={()=>shiftMonth(1)} aria-label="Следующий месяц"><Icon name="chevronRight" size={17}/></button></div></div>
    <div className="canva-calendar-week">{DOW.map(d=><span key={d}>{d}</span>)}</div>
    <div className="canva-calendar-grid">{days.map((d,i)=>d?<CalendarDay key={i} state={state} date={d} onEdit={onEdit}/>:<div className="canva-calendar-empty" key={i}/>)}</div>
    <div className="wt-shift-planner-legend"><span>Нажмите день для редактирования</span><span>П · праздник</span><span>З · заметка</span></div>
   </section>
  </div>
 </section>;
}
function CalendarDay({state,date,onEdit}:{state:State;date:Date;onEdit:(date:string)=>void}){const dateKey=ymd(date),beforeStart=state.startDate?dateKey<state.startDate:false,today=ymd(new Date())===dateKey,holiday=isHoliday(date),note=Boolean(state.shiftNotes[dateKey]?.trim());if(beforeStart)return <button className={`calendar-day pre-start ${today?'today':''}`} disabled title="До даты выхода на работу"><div className="day-top"><b>{date.getDate()}</b><span>—</span></div><span>До начала</span></button>;const shift=getShift(state,date),scheduled=getScheduledShift(state,date),vacation=state.vacations.some(p=>p.start<=dateKey&&dateKey<=p.end),sick=state.sickLeaves.some(p=>p.start<=dateKey&&dateKey<=p.end);const label=vacation?'Отпуск':sick?'Больничный':shiftLabel(shift);return <button className={`calendar-day ${shift} ${holiday?'holiday':''} ${today?'today':''} ${note?'has-note':''}`} data-shift={shift} onClick={()=>onEdit(dateKey)} title={holiday?holidayName(date):label}><div className="day-top"><b>{date.getDate()}</b><span>{holiday?'П':note?'З':''}</span></div><span>{label}</span>{scheduled!==shift&&<small>изменено</small>}</button>}

export function PayView({state,calc,keyMonth,payment,setAdvance,goMonth,goYear}:{state:State;calc:ReturnType<typeof calcMonth>;keyMonth:string;payment:(field:'advanceDate'|'remainderDate',value:string)=>void;setAdvance:(value:string)=>void;goMonth:(n:number)=>void;goYear:(n:number)=>void}){
 const hasCustomAdvance=calc.advanceIsCustom;const annual=useMemo(()=>calcYear(state,calc.year),[state,calc.year]);
 return <section className="canva-page canva-pay wt-pay-console">
  <header className="wt-pay-console-heading"><div><span className="wt-pay-console-overline">ЛИЧНАЯ БУХГАЛТЕРИЯ / {calc.year}</span><h1>Деньги<br/><em>под контролем.</em></h1><p>Все начисления и выплаты за выбранный месяц — по строкам, без скрытых формул.</p></div><div className="wt-pay-console-period"><span>Расчётный период</span><div><button onClick={()=>goMonth(-1)} aria-label="Предыдущий месяц"><Icon name="chevronLeft" size={20}/></button><strong>{MONTHS[calc.month]} {calc.year}</strong><button onClick={()=>goMonth(1)} aria-label="Следующий месяц"><Icon name="chevronRight" size={20}/></button></div></div></header>
  <div className="wt-pay-console-layout">
   <section className="wt-pay-console-statement" aria-label="Расчётная ведомость">
    <div className="wt-pay-statement-top"><span>ВЕДОМОСТЬ № {String(calc.month+1).padStart(2,'0')} / {calc.year}</span><span>WT / PAYROLL</span></div>
    <div className="wt-pay-statement-net"><span>К ВЫПЛАТЕ НА РУКИ</span><strong>{formatMoney(calc.net)}</strong><p>Начислено {formatMoney(calc.gross)} · НДФЛ {formatMoney(calc.tax)}</p></div>
    <div className="wt-pay-statement-rows"><div className="wt-pay-statement-headrow"><span>НАЧИСЛЕНИЯ И УДЕРЖАНИЯ</span><span>СУММА, ₽</span></div><div><span>Базовая часть</span><b>{formatMoney(calc.base)}</b></div><div><span>Дополнительные смены</span><b>{formatMoney(calc.extraPay)}</b></div><div><span>Праздничные · коэффициент {state.holidayCoeff}×</span><b>{formatMoney(calc.holidayExtra)}</b></div><div><span>Ночные · доплата {state.nightExtraPercent}%</span><b>{formatMoney(calc.nightExtra)}</b></div><div><span>Отпускные</span><b>{formatMoney(calc.vacPay)}</b></div><div><span>Больничные</span><b>{formatMoney(calc.sickPay)}</b></div><div className="wt-pay-statement-tax"><span>НДФЛ</span><b>− {formatMoney(calc.tax)}</b></div><div className="wt-pay-statement-total"><span>ИТОГО НА РУКИ</span><b>{formatMoney(calc.net)}</b></div></div>
   </section>
   <aside className="wt-pay-console-sidebar">
    <section className="wt-pay-console-split"><span>СХЕМА ВЫПЛАТ</span><div><span>01 · Аванс</span><strong>{formatMoney(calc.advance)}</strong><small>{calc.paymentDates.advanceDate||'Дата не выбрана'}</small></div><div><span>02 · Остаток</span><strong>{formatMoney(calc.remainder)}</strong><small>{calc.paymentDates.remainderDate||'Дата не выбрана'}</small></div></section>
    <section className="wt-pay-console-editor"><span className="wt-pay-console-overline">КОРРЕКТИРОВКИ</span><h2>План выплат</h2><p>По умолчанию аванс составляет 50% оклада. Здесь можно задать сумму и даты на текущий месяц.</p><Field label="Аванс, ₽"><input type="number" min="0" step="1" value={hasCustomAdvance?state.advances[keyMonth]:calc.advance} onChange={e=>setAdvance(e.target.value)} onFocus={e=>{if(!hasCustomAdvance)e.currentTarget.select()}}/></Field><Field label="Дата аванса"><input type="date" value={calc.paymentDates.advanceDate} onChange={e=>payment('advanceDate',e.target.value)}/></Field><Field label="Дата остатка"><input type="date" value={calc.paymentDates.remainderDate} onChange={e=>payment('remainderDate',e.target.value)}/></Field></section>
   </aside>
  </div>
  <AnnualSummary annual={annual} goYear={goYear}/>
 </section>;
}
function AnnualSummary({annual,goYear}:{annual:ReturnType<typeof calcYear>;goYear:(n:number)=>void}){const peak=Math.max(1,...annual.months.map(m=>m.net));return <section className="annual-card"><div className="annual-head"><div><span className="eyebrow">Годовой итог</span><h2>Доход за {annual.year}</h2><p>Все 12 месяцев с учётом смен, дополнительных смен, ночных и праздничных доплат, отпуска, больничных и НДФЛ.</p></div><div className="annual-year-controls"><button onClick={()=>goYear(-1)} aria-label="Предыдущий год"><Icon name="chevronLeft" size={16}/></button><strong>{annual.year}</strong><button onClick={()=>goYear(1)} aria-label="Следующий год"><Icon name="chevronRight" size={16}/></button></div></div><div className="annual-kpis"><div><span>На руки</span><b>{formatMoney(annual.net)}</b><small>итог за год</small></div><div><span>Начислено</span><b>{formatMoney(annual.gross)}</b><small>до НДФЛ</small></div><div><span>НДФЛ</span><b>{formatMoney(annual.tax)}</b><small>удержано</small></div><div><span>Среднее на руки</span><b>{formatMoney(annual.averageMonthlyNet)}</b><small>в месяц</small></div></div><div className="wt-pay-trend" role="img" aria-label={"Чистый доход за каждый месяц "+annual.year+" года"}>
 <div className="wt-pay-trend-title"><div><strong>Динамика дохода</strong><span>После налогов · по месяцам</span></div><span>{annual.year}</span></div>
 <div className="wt-pay-trend-chart">{annual.months.map(month=><div className="wt-pay-trend-month" key={month.month} title={MONTHS[month.month]+": "+formatMoney(month.net)}>
   <div className="wt-pay-trend-track"><div className="wt-pay-trend-bar" style={{height:Math.max(month.net>0?6:0,Math.round(month.net/peak*100))+"%"}}/></div>
   <span>{MONTHS[month.month].slice(0,3)}</span>
 </div>)}</div>
 </div><details className="wt-annual-details"><summary><span><Icon name="calendar" size={17}/> Подробная годовая ведомость</span><Icon name="chevronDown" size={18}/></summary><div className="wt-annual-details-body"><div className="annual-components"><div><span>Базовая часть</span><b>{formatMoney(annual.base)}</b></div><div><span>Доп. смены</span><b>{formatMoney(annual.extraPay)}</b></div><div><span>Праздничные доплаты</span><b>{formatMoney(annual.holidayExtra)}</b></div><div><span>Ночные доплаты</span><b>{formatMoney(annual.nightExtra)}</b></div><div><span>Отпускные</span><b>{formatMoney(annual.vacPay)}</b></div><div><span>Больничные</span><b>{formatMoney(annual.sickPay)}</b></div><div><span>Смены</span><b>{annual.work}</b></div><div><span>Праздничные смены</span><b>{annual.holidayWork}</b></div><div><span>Дни отпуска</span><b>{annual.vacDays}</b></div><div><span>Дни больничного</span><b>{annual.sickDays}</b></div></div><div className="annual-table-wrap"><table className="annual-table"><thead><tr><th>Месяц</th><th>Начислено</th><th>НДФЛ</th><th>На руки</th><th>Аванс</th><th>Остаток</th></tr></thead><tbody>{annual.months.map((m)=><tr key={m.month}><td>{MONTHS[m.month]}</td><td>{formatMoney(m.gross)}</td><td>{formatMoney(m.tax)}</td><td><b>{formatMoney(m.net)}</b></td><td>{formatMoney(m.advance)}</td><td>{formatMoney(m.remainder)}</td></tr>)}</tbody><tfoot><tr><th>Итого</th><th>{formatMoney(annual.gross)}</th><th>{formatMoney(annual.tax)}</th><th>{formatMoney(annual.net)}</th><th>{formatMoney(annual.advance)}</th><th>{formatMoney(annual.remainder)}</th></tr></tfoot></table></div><p className="annual-footnote">Годовой итог считается по месяцам начисления. До даты выхода зарплата не начисляется. Аванс по умолчанию составляет 50% указанного оклада; его можно изменить отдельно для каждого месяца.</p></div></details></section>}

export function AbsenceView({state,vac,sick,setVac,setSick,addPeriod,removePeriod}:{state:State;vac:PeriodDraft;sick:PeriodDraft;setVac:(v:PeriodDraft)=>void;setSick:(v:PeriodDraft)=>void;addPeriod:(k:'vacations'|'sickLeaves',d:PeriodDraft)=>void;removePeriod:(k:'vacations'|'sickLeaves',i:number)=>void}){
 const used=vacationUsedDays(state),remaining=Math.max(0,state.vacTotal-used);
 return <section className="atlas-time-off canva-page canva-absence">
  <div className="atlas-time-off-hero">
   <div><span>БАЛАНС СВОБОДНОГО ВРЕМЕНИ / WT</span><h1>Время<br/><em>на себя.</em></h1><p>Ваши периоды отдыха и здоровья, без путаницы с рабочими днями.</p></div>
   <div className="atlas-time-off-balance"><span>ДОСТУПНО СЕЙЧАС</span><strong>{remaining}</strong><b>ДНЕЙ ОТПУСКА</b><div className="atlas-time-off-meter"><i style={{width:`${state.vacTotal?Math.min(100,remaining/state.vacTotal*100):0}%`}}/></div><small>{used} использовано / {state.vacTotal} всего</small></div>
  </div>
  <div className="atlas-time-off-tracks"><div><span>01 / ОТДЫХ</span><h2>Отпуск</h2><p>{state.vacations.length} запланированных периодов</p></div><div><span>02 / ЗДОРОВЬЕ</span><h2>Больничные</h2><p>{state.sickLeaves.length} записей</p></div></div>
  <div className="atlas-time-off-editors">
   <PeriodEditor state={state} title="Отпуск" description="Праздничные дни внутри периода не уменьшают количество оплачиваемых дней отпуска." draft={vac} setDraft={setVac} kind="vacations" periods={state.vacations} addPeriod={addPeriod} removePeriod={removePeriod}/>
   <PeriodEditor state={state} title="Больничный" description="Фактический период больничного исключается из отработанных смен." draft={sick} setDraft={setSick} kind="sickLeaves" periods={state.sickLeaves} addPeriod={addPeriod} removePeriod={removePeriod}/>
  </div>
 </section>;
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
