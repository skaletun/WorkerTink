import {useMemo,useState} from 'react';
import {Icon} from './Icon';
import type {State} from './core';
import {MONTHS,calcYear,formatMoney,getWorkingShift,vacationUsedDays,ymd} from './core';
import WorkTeamsView from './WorkTeamsView';

type Props={state:State;calc:any;view:Date;onNavigate:(tab:'calendar'|'pay'|'absence')=>void;onEditWork:()=>void;onNetwork:()=>void;token?:string;onNotice?:(s:string)=>void};
const shiftName=(value:string)=>value==='night'?'Ночная смена':value==='full'?'Суточная смена':value==='day'?'Дневная смена':'Выходной';
const dayNames=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

export default function WorkHubView({state,calc,view,onNavigate,onEditWork,onNetwork,token,onNotice}:Props){
 const [teamsOpen,setTeamsOpen]=useState(false);
 const annual=useMemo(()=>calcYear(state,view.getFullYear()),[state,view]);
 const vacationLeft=Math.max(0,state.vacTotal-vacationUsedDays(state));
 const daysInMonth=new Date(view.getFullYear(),view.getMonth()+1,0).getDate();
 const firstWeekday=(new Date(view.getFullYear(),view.getMonth(),1).getDay()+6)%7;
 const monthDays=useMemo(()=>Array.from({length:daysInMonth},(_,i)=>{
  const date=new Date(view.getFullYear(),view.getMonth(),i+1);
  return {date,shift:getWorkingShift(state,date),key:ymd(date)};
 }),[state,view,daysInMonth]);
 const plannedShifts=monthDays.filter(d=>d.shift!=='off').length;
 const nightShifts=monthDays.filter(d=>d.shift==='night').length;
 const plannedPercent=Math.round(plannedShifts/daysInMonth*100);
 const upcoming=useMemo(()=>{
  const today=new Date();today.setHours(12,0,0,0);
  const out:{date:Date;shift:string}[]=[];
  for(let i=0;i<35&&out.length<6;i++){
   const date=new Date(today);date.setDate(today.getDate()+i);
   const shift=getWorkingShift(state,date);
   if(shift!=='off')out.push({date,shift});
  }
  return out;
 },[state]);
 const notes=Object.entries(state.shiftNotes).filter(([,value])=>Boolean(value.trim())).sort(([left],[right])=>right.localeCompare(left)).slice(0,3);
 return <section className="wt-operations redesign-work" aria-label="Рабочая диспетчерская">
  <header className="wt-operations-intro"><div><span className="wt-index-label">РАБОЧАЯ ДИСПЕТЧЕРСКА / {view.getFullYear()}</span><h2>Ваш график.<br/><em>Ваша система.</em></h2><p>Месяц, ближайшие смены, начисления и отпуск — в одной операционной области.</p></div><div className="wt-operations-head-buttons"><button onClick={onEditWork}><Icon name="settings" size={16}/> Изменить условия работы</button><button onClick={()=>onNavigate('calendar')}><Icon name="calendar" size={16}/> Изменить смены</button><button onClick={()=>onNavigate('pay')}>Расчёт зарплаты <Icon name="chevronRight" size={17}/></button></div></header>
  <section className="wt-operations-numbers" aria-label="Показатели"><div className="wt-operations-number-main"><span>К выплате / {MONTHS[view.getMonth()]}</span><strong>{formatMoney(calc.net)}</strong><button onClick={()=>onNavigate('pay')}>Расчёт <Icon name="chevronRight" size={17}/></button></div><div><span>Смены</span><strong>{plannedShifts}<small> / {daysInMonth}</small></strong><p>С учётом правок</p></div><div><span>Ночные</span><strong>{nightShifts}</strong><p>За месяц</p></div><div><span>Отпуск</span><strong>{Math.round(vacationLeft)}<small> дн.</small></strong><p>Доступно</p></div></section>
  <div className="wt-operations-layout">
   <section className="wt-operations-calendar"><div className="wt-operations-section-head"><div><span className="wt-index-label">01 / РИТМ МЕСЯЦА</span><h3>{MONTHS[view.getMonth()]} <small>{view.getFullYear()}</small></h3></div><button onClick={()=>onNavigate('calendar')}>Редактор графика <Icon name="chevronRight" size={16}/></button></div>
    <div className="wt-operations-calendar-grid" role="group" aria-label="Календарь смен">{dayNames.map(d=><span key={d} className="wt-ops-dayname">{d}</span>)}{Array.from({length:firstWeekday},(_,i)=><span className="wt-ops-empty" key={`lead-${i}`}/>)}
     {monthDays.map(({date,shift,key})=><button key={key} onClick={()=>onNavigate('calendar')} className={`wt-ops-cell is-${shift}${key===ymd(new Date())?' is-today':''}`} aria-label={`${date.toLocaleDateString('ru-RU',{day:'numeric',month:'long'})} — ${shiftName(shift)}`}><strong>{date.getDate()}</strong><i/><span>{shift==='off'?'—':shift==='night'?'Ночь':shift==='full'?'Сутки':'День'}</span></button>)}</div>
    <div className="wt-operations-calendar-footer"><div><span className="wt-ops-legend-dot is-day"/>Дневная</div><div><span className="wt-ops-legend-dot is-night"/>Ночная</div><div><span className="wt-ops-legend-dot is-off"/>Выходной</div><strong>{plannedPercent}% дней занято сменами</strong></div>
   </section>
   <aside className="wt-operations-upcoming"><div className="wt-operations-section-head"><div><span className="wt-index-label">02 / БЛИЖАЙШЕЕ</span><h3>На очереди</h3></div></div><ol>{upcoming.map(({date,shift},i)=><li key={ymd(date)}><button onClick={()=>onNavigate('calendar')}><span className="wt-ops-seq">{String(i+1).padStart(2,'0')}</span><span className="wt-ops-when"><b>{date.toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}</b><small>{date.toLocaleDateString('ru-RU',{weekday:'long'})}</small></span><span className={`wt-ops-shift-chip is-${shift}`}>{shift==='night'?'Ночь':shift==='full'?'Сутки':'День'}</span></button></li>)}{!upcoming.length&&<li className="wt-ops-empty-note">В ближайшие 35 дней рабочих смен не запланировано.</li>}</ol></aside>
  </div>
  <div className="wt-operations-lower">
   <section className="wt-operations-ledger"><div className="wt-operations-section-head"><div><span className="wt-index-label">03 / МОЯ ЭКОНОМИКА</span><h3>Выплаты и отдых</h3></div></div><div className="wt-ops-ledger-row"><span>На руки за {view.getFullYear()} год</span><strong>{formatMoney(annual.net)}</strong></div><div className="wt-ops-ledger-row"><span>Среднее за месяц</span><strong>{formatMoney(annual.averageMonthlyNet)}</strong></div><div className="wt-ops-ledger-row"><span>Оставшийся отпуск</span><strong>{Math.round(vacationLeft)} дн.</strong></div><div className="wt-ops-ledger-actions"><button onClick={()=>onNavigate('pay')}>Финансы <Icon name="chevronRight" size={16}/></button><button onClick={()=>onNavigate('absence')}>Отпуск / больничный <Icon name="chevronRight" size={16}/></button></div></section>
   <section className="wt-operations-notes"><div className="wt-operations-section-head"><div><span className="wt-index-label">04 / РАБОЧИЕ ЗАПИСИ</span><h3>Из блокнота</h3></div><button onClick={()=>onNavigate('calendar')}>Все <Icon name="chevronRight" size={16}/></button></div>{notes.map(([date,note])=><div className="wt-ops-note" key={date}><time dateTime={date}>{new Date(date+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}</time><p>{note.slice(0,220)}</p></div>)}{!notes.length&&<p className="wt-ops-empty-note">Заметки появятся здесь после первой записи в календаре.</p>}<button className="wt-ops-social-link" onClick={onNetwork}>Обсудить с коллегами <Icon name="externalLink" size={16}/></button></section>
  </div>
  {token&&onNotice&&<section className="wt-operations-team-space"><button type="button" onClick={()=>setTeamsOpen(v=>!v)} aria-expanded={teamsOpen}><Icon name="people" size={21}/><span><b>Команды и документы</b><small>Совместные рабочие пространства и материалы</small></span><span>{teamsOpen?'Свернуть':'Открыть'} <Icon name="chevronDown" size={16}/></span></button>{teamsOpen&&<WorkTeamsView token={token} onNotice={onNotice}/>}</section>}
 </section>;
}
