import {Icon} from './Icon';
import {useMemo,useState} from 'react';
import {calcMonth,calcYear,formatMoney,getScheduledShift,parseYmd,addDays,ymd,vacationCalendarDays,vacationUsedDays,vacationProjectedUsedDays,sickPayForDays,MONTHS,type State} from './core';

type Props={state:State;patch:(p:Partial<State>)=>void;onNotice:(s:string)=>void;go:(tab:'home'|'social'|'people'|'communities'|'chat'|'work'|'calendar'|'pay'|'absence'|'friends'|'notifications'|'profile'|'settings'|'admin')=>void};
const iso=(d:Date)=>ymd(d);
function download(name:string,blob:Blob){const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
async function encryptBackup(state:State,password:string){const enc=new TextEncoder();const salt=crypto.getRandomValues(new Uint8Array(16));const iv=crypto.getRandomValues(new Uint8Array(12));const base=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']);const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:100000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt']);const data=enc.encode(JSON.stringify(state));const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,data));const out=new Uint8Array(4+salt.length+iv.length+cipher.length);out.set([87,84,66,49]);out.set(salt,4);out.set(iv,20);out.set(cipher,32);return new Blob([out],{type:'application/octet-stream'})}
function daysOff(state:State,days:number){let off=0;const start=new Date();for(let i=0;i<days;i++){const d=addDays(start,i);if(getScheduledShift(state,d)==='off')off++}return off}
export default function HomeView({state,patch,onNotice,go}:Props){
 const now=new Date(), month=calcMonth(state,now.getFullYear(),now.getMonth()), year=useMemo(()=>calcYear(state,now.getFullYear()),[state,now.getFullYear()]);
 const [forecastMonths,setForecastMonths]=useState(3); const [scenarioSalary,setScenarioSalary]=useState(state.salary); const [scenarioNight,setScenarioNight]=useState(state.nightExtraPercent); const [vacStart,setVacStart]=useState(''); const [vacLength,setVacLength]=useState(14); const [sickDays,setSickDays]=useState(5); const [tip,setTip]=useState(''); const [backupPassword,setBackupPassword]=useState('');
 const forecast=useMemo(()=>{let gross=0,net=0;for(let i=0;i<forecastMonths;i++){const d=new Date(now.getFullYear(),now.getMonth()+i,1);const c=calcMonth(state,d.getFullYear(),d.getMonth());gross+=c.gross;net+=c.net}return {gross,net,avg:net/forecastMonths}},[state,forecastMonths]);
 const scenario=useMemo(()=>{const copy={...state,salary:Math.max(0,scenarioSalary),nightExtraPercent:Math.max(0,scenarioNight)} as State;const c=calcMonth(copy,now.getFullYear(),now.getMonth());return c},[state,scenarioSalary,scenarioNight]);
 const plannedVacation=useMemo(()=>{if(!vacStart)return null;const start=parseYmd(vacStart);const end=addDays(start,Math.max(0,vacLength-1));const period={start:iso(start),end:iso(end)};return {period,days:vacationCalendarDays(state,period),balance:Math.max(0,state.vacTotal-vacationProjectedUsedDays(state,period))}},[state,vacStart,vacLength]);
 const sickRate=state.stage<5?.6:state.stage<8?.8:1;const sickPay=sickPayForDays(state,now.getFullYear(),now.getMonth(),sickDays);
 const tips=useMemo(()=>{const list:string[]=[];if(month.sickDays)list.push('В этом месяце есть больничные — проверьте средний заработок и даты выплат.');if(month.vacDays)list.push('В текущем месяце есть отпуск — проверьте остаток дней.');if(month.nightWork)list.push('Есть ночные смены — убедитесь, что процент ночной доплаты актуален.');if(year.averageMonthlyNet&&year.averageMonthlyNet<state.salary*(1-state.taxRate/100)*.8)list.push('Средний доход ниже обычного оклада — проверьте ручные выходы и отсутствия.');return list.length?list:['График и выплаты синхронизированы. Можно открыть ленту и поделиться рабочей новостью.']},[month,year,state]);
 const saveTip=()=>{if(!tip.trim())return;patch({shiftNotes:{...state.shiftNotes,[iso(now)]:`${state.shiftNotes[iso(now)]||''}${state.shiftNotes[iso(now)]?'\n':''}${tip.trim()}`}});setTip('');onNotice('Совет сохранён в заметках текущего дня')};
 const backup=async()=>{if(!backupPassword){onNotice('Введите пароль для шифрования резервной копии');return}try{download(`workertink-backup-${iso(now)}.wtbackup`,await encryptBackup(state,backupPassword));setBackupPassword('');onNotice('Зашифрованная резервная копия создана')}catch{onNotice('Не удалось создать резервную копию')}};
 return <section className="canva-page canva-home redesign-page redesign-home">
  <header className="canva-page-head">
    <div>
      <span className="canva-kicker">Home Dashboard</span>
      <h1>Ваш рабочий день в одном окне</h1>
      <p>Расписание, выплаты и рабочие действия — без лишних переходов.</p>
    </div>
    <div className="canva-head-actions">
      <button className="canva-button canva-button-primary" onClick={()=>go('calendar')}>Открыть календарь</button>
      <button className="canva-button" onClick={()=>go('social')}>Открыть ленту</button>
    </div>
  </header>

  <section className="canva-kpi-grid" aria-label="Ключевые показатели">
    <button className="canva-kpi" onClick={()=>go('pay')}>
      <span>На руки · {MONTHS[month.month]}</span>
      <strong>{formatMoney(month.net)}</strong>
      <small>{month.work} смен · текущий месяц</small>
    </button>
    <button className="canva-kpi" onClick={()=>go('pay')}>
      <span>Годовой доход</span>
      <strong>{formatMoney(year.net)}</strong>
      <small>{formatMoney(year.averageMonthlyNet)} в среднем / мес.</small>
    </button>
    <button className="canva-kpi" onClick={()=>go('absence')}>
      <span>Отпуск</span>
      <strong>{Math.max(0,state.vacTotal-vacationUsedDays(state))} дн.</strong>
      <small>доступно по вашему профилю</small>
    </button>
    <button className="canva-kpi" onClick={()=>go('calendar')}>
      <span>Выходные</span>
      <strong>{daysOff(state,30)}</strong>
      <small>в ближайшие 30 дней</small>
    </button>
  </section>

  <div className="canva-home-main">
    <section className="canva-shift-card">
      <div className="canva-section-head">
        <div><span className="canva-kicker">Ваш график · Today's Shift</span><h2>Текущая смена</h2></div>
        <span className="canva-state">{getScheduledShift(state,now)==='off'?'Выходной':'В работе'}</span>
      </div>
      <div className="canva-shift-time">{getScheduledShift(state,now)==='off'?'—':getScheduledShift(state,now)==='night'?'20:00 – 08:00':getScheduledShift(state,now)==='full'?'09:00 – 09:00':'09:00 – 17:00'}</div>
      <div className="canva-shift-meta">
        <div><span>Начало</span><b>{getScheduledShift(state,now)==='off'?'—':'08:58'}</b></div>
        <div><span>Статус</span><b>{getScheduledShift(state,now)==='off'?'Выходной':'Активна'}</b></div>
        <div><span>Отметка</span><b>{getScheduledShift(state,now)==='off'?'Нет':'Сегодня'}</b></div>
      </div>
      <div className="canva-shift-actions">
        <button className="canva-button canva-button-primary" onClick={()=>go('calendar')}>Изменить смену</button>
        <button className="canva-button" onClick={()=>go('absence')}>Оформить отсутствие</button>
      </div>
    </section>

    <aside className="canva-actions-card">
      <div className="canva-section-head"><div><span className="canva-kicker">Quick Actions</span><h2>Действия</h2></div></div>
      <div className="canva-action-list">
        <button onClick={()=>go('calendar')}><span>01</span><div><b>График</b><small>Сегодня и следующие смены</small></div><Icon name="chevronRight" size={15}/></button>
        <button onClick={()=>go('absence')}><span>02</span><div><b>Отсутствие</b><small>Отпуск или больничный</small></div><Icon name="chevronRight" size={15}/></button>
        <button onClick={()=>go('pay')}><span>03</span><div><b>Зарплата</b><small>Текущий период и начисления</small></div><Icon name="chevronRight" size={15}/></button>
        <button onClick={()=>go('social')}><span>04</span><div><b>Сеть</b><small>Новости команды и сообщества</small></div><Icon name="chevronRight" size={15}/></button>
      </div>
    </aside>
  </div>

  <div className="canva-home-lower">
    <section className="canva-activity-card">
      <div className="canva-section-head"><div><span className="canva-kicker">Recent Activity</span><h2>Последние события</h2></div><button className="canva-text-button" onClick={()=>go('notifications')}>Все события</button></div>
      <div className="canva-activity-list">
        {(tips.slice(0,4).length?tips.slice(0,4):['График и выплаты синхронизированы.','Система готова к работе.']).map((item,i)=><button key={i} onClick={()=>go(i<2?'notifications':'work')}><span className="canva-activity-dot"/><div><b>{item}</b><small>{i===0?'Сейчас':i===1?'Сегодня':'Ранее'}</small></div><time>{i===0?'10:32':i===1?'09:47':i===2?'09:15':'08:58'}</time></button>)}
      </div>
    </section>

    <section className="canva-summary-card">
      <div className="canva-section-head"><div><span className="canva-kicker">This week</span><h2>Доход и баланс</h2></div></div>
      <div className="canva-summary-number">{formatMoney(forecast.net)}</div>
      <p>Прогноз на {forecastMonths} мес. · среднее {formatMoney(forecast.avg)} / мес.</p>
      <input className="canva-range" type="range" min="1" max="12" value={forecastMonths} onChange={e=>setForecastMonths(Number(e.target.value))}/>
      <div className="canva-summary-grid">
        <div><span>Отпуск</span><b>{Math.max(0,state.vacTotal-vacationUsedDays(state))} дн.</b></div>
        <div><span>Больничный</span><b>{formatMoney(sickPay)}</b></div>
        <div><span>Ставка</span><b>{Math.round(sickRate*100)}%</b></div>
      </div>
    </section>
  </div>

  <section className="canva-tools-grid">
    <article className="canva-tool-card"><span className="canva-kicker">Прогноз</span><h3>Доход на {forecastMonths} мес.</h3><strong>{formatMoney(forecast.net)}</strong><small>Среднее {formatMoney(forecast.avg)} / мес.</small><input className="canva-range" type="range" min="1" max="12" value={forecastMonths} onChange={e=>setForecastMonths(Number(e.target.value))}/></article>
    <article className="canva-tool-card"><span className="canva-kicker">Спланировать заранее</span><h3>Отпуск</h3><div className="canva-inline-fields"><input type="date" value={vacStart} onChange={e=>setVacStart(e.target.value)}/><input type="number" min="1" max="60" value={vacLength} onChange={e=>setVacLength(Number(e.target.value)||1)}/></div><small>{plannedVacation?plannedVacation.period.start+' → '+plannedVacation.period.end:'Выберите дату и длительность'}</small></article>
    <article className="canva-tool-card"><span className="canva-kicker">Сценарий выплаты</span><h3>Что изменится?</h3><label>Оклад<input type="number" value={scenarioSalary} onChange={e=>setScenarioSalary(Number(e.target.value)||0)}/></label><label>Ночная доплата · {scenarioNight}%<input type="range" min="0" max="100" value={scenarioNight} onChange={e=>setScenarioNight(Number(e.target.value))}/></label><strong>{formatMoney(scenario.net)}</strong></article>
    <article className="canva-tool-card"><span className="canva-kicker">Безопасность</span><h3>Аккаунт под контролем</h3><div className="canva-security-line"><b>OnePass</b><span>{state.onePassEnabled?'Включён':'Выключен'}</span></div><div className="canva-security-line"><b>E2E</b><span>Личные сообщения защищены</span></div><button className="canva-button" onClick={()=>go('settings')}>Открыть настройки</button></article>
  </section>

  <section className="canva-note-card">
    <div>
      <span className="canva-kicker">Work notes</span>
      <h2>Добавить рабочий контекст</h2>
      <p>Сохраните короткую заметку прямо из главной страницы — она останется связанной с сегодняшней датой.</p>
    </div>
    <div className="canva-note-form">
      <input value={tip} onChange={e=>setTip(e.target.value)} placeholder="Например: передать смену следующему оператору"/>
      <button className="canva-button canva-button-primary" onClick={saveTip}>Сохранить заметку</button>
    </div>
  </section>

  <section className="canva-security-row">
    <div className="canva-security-copy"><span className="canva-kicker">Резервная копия</span><b>Зашифрованная резервная копия</b><small>Резервная копия создаётся локально и не меняет рабочие расчёты.</small></div>
    <div className="canva-backup-form"><input type="password" value={backupPassword} onChange={e=>setBackupPassword(e.target.value)} placeholder="Пароль шифрования"/><button className="canva-button" onClick={()=>void backup()}>Создать копию</button></div>
  </section>
 </section>
}
