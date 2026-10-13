import {useMemo} from 'react';
import {Icon} from './Icon';
import type {State} from './core';
import {MONTHS,calcYear,formatMoney,getScheduledShift,vacationUsedDays,ymd} from './core';
import {RingChart} from './components/charts/ring-chart';
import {Ring} from './components/charts/ring';
import {RingCenter} from './components/charts/ring-center';
import WorkTeamsView from './WorkTeamsView';

type Props={state:State;calc:any;view:Date;onNavigate:(tab:'calendar'|'pay'|'absence')=>void;onNetwork:()=>void;token?:string;onNotice?:(s:string)=>void};
const shiftName=(value:string)=>value==='night'?'Ночная смена':value==='full'?'Суточная смена':value==='day'?'Дневная смена':'Выходной';

export default function WorkHubView({state,calc,view,onNavigate,onNetwork,token,onNotice}:Props){
 const upcoming=useMemo(()=>{
  const out:{date:Date;shift:string}[]=[];
  for(let i=0;i<21&&out.length<7;i++){
   const date=new Date();date.setHours(0,0,0,0);date.setDate(date.getDate()+i);
   const shift=getScheduledShift(state,date);
   if(shift!=='off')out.push({date,shift});
  }
  return out;
 },[state]);
 const annual=useMemo(()=>calcYear(state,view.getFullYear()),[state,view]);
 const vacationLeft=Math.max(0,state.vacTotal-vacationUsedDays(state));
 const daysInMonth=new Date(view.getFullYear(),view.getMonth()+1,0).getDate();
 const plannedShifts=useMemo(()=>{
  let total=0;
  for(let day=1;day<=daysInMonth;day++)if(getScheduledShift(state,new Date(view.getFullYear(),view.getMonth(),day))!=='off')total++;
  return total;
 },[state,view,daysInMonth]);
 const ringData=useMemo(()=>[{label:'Плановые смены',value:plannedShifts,maxValue:daysInMonth,color:'var(--chart-1)'}],[plannedShifts,daysInMonth]);
 const notes=Object.entries(state.shiftNotes).filter(([,value])=>Boolean(value.trim())).sort(([left],[right])=>right.localeCompare(left)).slice(0,4);
 return <section className="wt-work-dashboard redesign-work" aria-label="Рабочая область">
  <header className="wt-work-header">
   <div><span className="wt-overline">РАБОЧАЯ ОБЛАСТЬ / {view.getFullYear()}</span><h2>Всё о твоей работе.</h2><p>График, заработок и доступные дни отдыха — без переходов между разными сервисами.</p></div>
   <div className="wt-work-header-actions"><button className="wt-button secondary" onClick={()=>onNavigate('calendar')}><Icon name="calendar" size={17}/>Календарь</button><button className="wt-button primary" onClick={()=>onNavigate('pay')}>Мои выплаты <Icon name="chevronRight" size={16}/></button></div>
  </header>
  <div className="wt-work-metrics" role="group" aria-label="Ключевые показатели работы">
   <button onClick={()=>onNavigate('pay')}><span>К выплате · {MONTHS[view.getMonth()]}</span><strong>{formatMoney(calc.net)}</strong><small>С учётом начислений и удержаний</small></button>
   <button onClick={()=>onNavigate('calendar')}><span>Смены в месяце</span><strong>{plannedShifts}<em> / {daysInMonth}</em></strong><small>По настроенному графику</small></button>
   <button onClick={()=>onNavigate('absence')}><span>Доступный отпуск</span><strong>{Math.round(vacationLeft)}<em> дней</em></strong><small>Остаток по вашему профилю</small></button>
   <button onClick={()=>onNavigate('pay')}><span>За {view.getFullYear()} год</span><strong>{formatMoney(annual.net)}</strong><small>Расчёт чистого дохода</small></button>
  </div>
  <div className="wt-work-layout">
   <section className="wt-work-primary" aria-label="Ближайшие смены">
    <div className="wt-section-heading"><div><span className="wt-overline">КАЛЕНДАРЬ</span><h3>Следующие смены</h3></div><button className="wt-link-button" onClick={()=>onNavigate('calendar')}>Весь график <Icon name="chevronRight" size={16}/></button></div>
    <ol className="wt-work-shift-list">
     {upcoming.map(({date,shift},index)=><li key={ymd(date)}><button className="wt-work-shift" onClick={()=>onNavigate('calendar')}><span className="wt-date-plate"><b>{date.getDate()}</b><small>{date.toLocaleDateString('ru-RU',{month:'short'})}</small></span><span className="wt-work-shift-text"><b>{date.toLocaleDateString('ru-RU',{weekday:'long'})}</b><small>{shiftName(shift)}{index===0?' · ближайшая':''}</small></span><span className="wt-shift-type">{shift==='night'?'Ночь':shift==='full'?'Сутки':'День'}</span><Icon name="chevronRight" size={16}/></button></li>)}
     {!upcoming.length&&<li className="wt-empty-row">Рабочих смен в ближайшие три недели нет.</li>}
    </ol>
   </section>
   <aside className="wt-work-insights" aria-label="Данные рабочего периода">
    <div className="wt-section-heading"><div><span className="wt-overline">АНАЛИТИКА · BKLIT UI</span><h3>Рабочий ритм</h3></div></div>
    <div className="wt-ring-wrap"><RingChart data={ringData} size={240} strokeWidth={16} baseInnerRadius={68}><Ring index={0} showGlow={false}/><RingCenter defaultLabel="смен в месяце" formatValue={value=>Math.round(value).toString()}/></RingChart></div>
    <div className="wt-ring-legend"><span><i/> Плановые смены</span><strong>{plannedShifts} из {daysInMonth}</strong></div>
    <p className="wt-insights-caption">Доля рабочих дней в выбранном месяце на основе вашего графика. Показатель не зависит от начисленной зарплаты.</p>
   </aside>
  </div>
  <div className="wt-work-secondary">
   <section className="wt-work-notes"><div className="wt-section-heading"><div><span className="wt-overline">ЗАМЕТКИ</span><h3>Записано на сменах</h3></div><button className="wt-link-button" onClick={()=>onNavigate('calendar')}>К заметкам <Icon name="chevronRight" size={16}/></button></div>
    <ul>{notes.map(([date,text])=><li key={date}><time dateTime={date}>{new Date(date+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long'})}</time><p>{text.slice(0,180)}</p></li>)}{!notes.length&&<li className="wt-empty-row">Пока нет записей. Заметку можно добавить в календаре смен.</li>}</ul>
   </section>
   <section className="wt-work-quick"><div className="wt-section-heading"><div><span className="wt-overline">БЫСТРЫЕ ДЕЙСТВИЯ</span><h3>Что нужно сделать?</h3></div></div>
    <button onClick={()=>onNavigate('absence')}><span>01</span><span>Отпуск или больничный</span><Icon name="chevronRight" size={16}/></button>
    <button onClick={()=>onNavigate('pay')}><span>02</span><span>Проверить начисления</span><Icon name="chevronRight" size={16}/></button>
    <button onClick={onNetwork}><span>03</span><span>Обсудить смену с коллегами</span><Icon name="chevronRight" size={16}/></button>
   </section>
  </div>
  {token&&onNotice&&<div className="wt-work-teams"><WorkTeamsView token={token} onNotice={onNotice}/></div>}
 </section>;
}
