import {useMemo} from 'react';
import {Icon} from './Icon';
import type {State} from './core';
import {MONTHS,calcYear,formatMoney,getScheduledShift,vacationUsedDays,ymd} from './core';
import WorkTeamsView from './WorkTeamsView';

type Props={state:State;calc:any;view:Date;onNavigate:(tab:'calendar'|'pay'|'absence')=>void;onNetwork:()=>void;token?:string;onNotice?:(s:string)=>void};
function shiftName(v:string){return v==='night'?'Ночная':v==='full'?'Суточная':v==='day'?'Дневная':'Выходной'}
export default function WorkHubView({state,calc,view,onNavigate,onNetwork,token,onNotice}:Props){
 const upcoming=useMemo(()=>{const out:{date:Date;shift:string}[]=[];for(let i=0;i<14&&out.length<6;i++){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()+i);const s=getScheduledShift(state,d);if(s!=='off')out.push({date:d,shift:s})}return out},[state]);
 const annual=useMemo(()=>calcYear(state,view.getFullYear()),[state,view]);
 const vacationLeft=Math.max(0,state.vacTotal-vacationUsedDays(state));
 return <section className="canva-page canva-work">
  <header className="canva-page-head">
    <div><span className="canva-kicker">Work + Calendar + Payroll</span><h1>Рабочий контур</h1><p>Смены, доход и отсутствия собраны в одной рабочей области.</p></div>
    <div className="canva-head-actions"><button className="canva-button" onClick={()=>onNavigate('calendar')}>Календарь</button><button className="canva-button canva-button-primary" onClick={()=>onNavigate('pay')}>Зарплата</button></div>
  </header>
  <section className="canva-work-overview">
    <article className="canva-work-calendar">
      <div className="canva-section-head"><div><span className="canva-kicker">Manage your time</span><h2>Ближайшие смены</h2></div><span className="canva-state">{upcoming.length} активных</span></div>
      <div className="canva-work-week">
        {upcoming.map((x,i)=><button key={ymd(x.date)} onClick={()=>onNavigate('calendar')} className={i===0?'active':''}><span>{x.date.toLocaleDateString('ru-RU',{weekday:'short'})}</span><b>{x.date.getDate()}</b><small>{shiftName(x.shift)}</small><em>{x.date.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</em></button>)}
      </div>
      <button className="canva-button canva-button-primary" onClick={()=>onNavigate('calendar')}>Открыть полный график</button>
    </article>
    <aside className="canva-work-side">
      <section className="canva-work-summary"><span className="canva-kicker">Current pay period</span><h2>{formatMoney(calc.net)}</h2><p>Начислено {formatMoney(calc.gross)}</p><button className="canva-button" onClick={()=>onNavigate('pay')}>Открыть выплаты</button></section>
      <section className="canva-work-summary"><span className="canva-kicker">Time off</span><h3>{Math.round(vacationLeft)} дн.</h3><p>Доступный остаток отпуска</p><button className="canva-button" onClick={()=>onNavigate('absence')}>Запросить отсутствие</button></section>
    </aside>
  </section>
  <section className="canva-work-lower">
    <article className="canva-work-card"><div className="canva-section-head"><div><span className="canva-kicker">Upcoming</span><h2>Смены</h2></div><button className="canva-text-button" onClick={()=>onNavigate('calendar')}>Редактировать</button></div>
      {upcoming.slice(0,5).map(x=><div className="canva-shift-row" key={ymd(x.date)}><span className="canva-shift-index">{x.date.getDate()}</span><div><b>{x.date.toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'})}</b><small>{shiftName(x.shift)}</small></div><strong>{x.date.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</strong></div>)}
    </article>
    <article className="canva-work-card"><div className="canva-section-head"><div><span className="canva-kicker">Shift Notes</span><h2>Память по сменам</h2></div><button className="canva-text-button" onClick={()=>onNavigate('calendar')}>Все заметки</button></div>
      {Object.entries(state.shiftNotes).filter(([,v])=>v.trim()).sort(([a],[b])=>b.localeCompare(a)).slice(0,5).map(([date,text])=><div className="canva-note-row" key={date}><time>{date}</time><p>{text.slice(0,180)}</p></div>)}
      {!Object.values(state.shiftNotes).some(v=>v.trim())&&<div className="canva-empty">Заметок пока нет.</div>}
    </article>
  </section>
  <section className="canva-work-actions">
    <button onClick={onNetwork}><span>01</span><div><b>Обсудить смену</b><small>Публикация или вопрос в сети</small></div><Icon name="chevronRight" size={15}/></button>
    <button onClick={onNetwork}><span>02</span><div><b>Найти замену</b><small>Открыть рабочее обсуждение</small></div><Icon name="chevronRight" size={15}/></button>
    <button onClick={onNetwork}><span>03</span><div><b>Найти сообщество</b><small>Отдел, профессия или вахта</small></div><Icon name="chevronRight" size={15}/></button>
    <button onClick={()=>onNavigate('absence')}><span>04</span><div><b>Спланировать отсутствие</b><small>Отпуск или больничный</small></div><Icon name="chevronRight" size={15}/></button>
  </section>
  {token&&onNotice&&<WorkTeamsView token={token} onNotice={onNotice}/>}
 </section>
}
