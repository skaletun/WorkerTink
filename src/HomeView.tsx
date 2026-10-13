import {useMemo,useState} from 'react';
import {Icon} from './Icon';
import {calcMonth,calcYear,formatMoney,getScheduledShift,parseYmd,addDays,ymd,vacationCalendarDays,vacationUsedDays,vacationProjectedUsedDays,sickPayForDays,MONTHS,type State} from './core';

type Tab='home'|'social'|'people'|'communities'|'chat'|'work'|'calendar'|'pay'|'absence'|'friends'|'notifications'|'profile'|'settings'|'admin';
type Props={state:State;patch:(p:Partial<State>)=>void;onNotice:(s:string)=>void;go:(tab:Tab)=>void};
const iso=(d:Date)=>ymd(d);
function download(name:string,blob:Blob){const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
async function encryptBackup(state:State,password:string){
 const enc=new TextEncoder(),salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const base=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']);
 const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:100000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt']);
 const data=enc.encode(JSON.stringify(state));
 const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,data));
 const result=new Uint8Array(4+salt.length+iv.length+cipher.length);result.set([87,84,66,49]);result.set(salt,4);result.set(iv,20);result.set(cipher,32);
 return new Blob([result],{type:'application/octet-stream'});
}
export default function HomeView({state,patch,onNotice,go}:Props){
 const now=new Date(), yearNumber=now.getFullYear(), month=calcMonth(state,yearNumber,now.getMonth());
 const year=useMemo(()=>calcYear(state,yearNumber),[state,yearNumber]);
 const [forecastMonths,setForecastMonths]=useState(3);
 const [scenarioSalary,setScenarioSalary]=useState(state.salary);
 const [scenarioNight,setScenarioNight]=useState(state.nightExtraPercent);
 const [vacStart,setVacStart]=useState('');
 const [vacLength,setVacLength]=useState(14);
 const [sickDays,setSickDays]=useState(5);
 const [tip,setTip]=useState('');
 const [backupPassword,setBackupPassword]=useState('');
 const forecast=useMemo(()=>{
  let gross=0,net=0;
  for(let i=0;i<forecastMonths;i++){const date=new Date(yearNumber,now.getMonth()+i,1);const result=calcMonth(state,date.getFullYear(),date.getMonth());gross+=result.gross;net+=result.net}
  return {gross,net,avg:net/forecastMonths};
 },[state,forecastMonths,yearNumber,now.getMonth()]);
 const scenario=useMemo(()=>calcMonth({...state,salary:Math.max(0,scenarioSalary),nightExtraPercent:Math.max(0,scenarioNight)},yearNumber,now.getMonth()),[state,scenarioSalary,scenarioNight,yearNumber,now.getMonth()]);
 const plannedVacation=useMemo(()=>{
  if(!vacStart)return null;
  const start=parseYmd(vacStart),end=addDays(start,Math.max(0,vacLength-1)),period={start:iso(start),end:iso(end)};
  return {period,days:vacationCalendarDays(state,period),balance:Math.max(0,state.vacTotal-vacationProjectedUsedDays(state,period))};
 },[state,vacStart,vacLength]);
 const sickRate=state.stage<5?.6:state.stage<8?.8:1;
 const sickPay=sickPayForDays(state,yearNumber,now.getMonth(),sickDays);
 const vacLeft=Math.max(0,state.vacTotal-vacationUsedDays(state));
 const shift=getScheduledShift(state,now);
 const shiftLabel=shift==='off'?'Выходной':shift==='night'?'Ночная смена':shift==='full'?'Суточная смена':'Дневная смена';
 const tips=useMemo(()=>{
  const list:string[]=[];
  if(month.sickDays)list.push('Есть больничные в текущем месяце — проверьте выплаты.');
  if(month.vacDays)list.push('В этом месяце запланирован отпуск — сверьте остаток дней.');
  if(month.nightWork)list.push('Проверьте процент доплаты за ночные смены.');
  if(year.averageMonthlyNet&&year.averageMonthlyNet<state.salary*(1-state.taxRate/100)*.8)list.push('Средний доход ниже обычного оклада — проверьте график и отсутствия.');
  return list;
 },[month,year,state]);
 const saveTip=()=>{if(!tip.trim())return;patch({shiftNotes:{...state.shiftNotes,[iso(now)]:`${state.shiftNotes[iso(now)]||''}${state.shiftNotes[iso(now)]?'\n':''}${tip.trim()}`}});setTip('');onNotice('Заметка сохранена для сегодняшнего дня')};
 const backup=async()=>{if(!backupPassword){onNotice('Введите пароль резервной копии');return}try{download(`workertink-backup-${iso(now)}.wtbackup`,await encryptBackup(state,backupPassword));setBackupPassword('');onNotice('Зашифрованная резервная копия создана')}catch{onNotice('Не удалось создать резервную копию')}};
 const week=Array.from({length:7},(_,offset)=>{
  const date=addDays(now,offset),kind=getScheduledShift(state,date);
  return {date,kind,label:kind==='off'?'Выходной':kind==='night'?'Ночь':kind==='full'?'Сутки':'День'};
 });
 return <section className="wt-home wt-home-v8" aria-label="Личная главная">
  <header className="wt-home-hero">
   <div className="wt-home-hero-marker"><span className="wt-overline">РАБОЧИЙ ДНЕВНИК / {now.toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'})}</span><span className="wt-home-index">01 — ОБЗОР</span></div>
   <div className="wt-home-hero-grid">
    <div className="wt-home-hero-intro">
     <h2>Привет,<br/><em>{state.profile.name.split(' ')[0]||'коллега'}.</em></h2>
     <p>Ваш день в одном месте: ближайшие смены, выплаты и люди, с которыми вы работаете.</p>
     <div className="wt-home-hero-links">
      <button className="wt-button primary" onClick={()=>go('social')}><Icon name="social" size={18}/> Открыть ленту <Icon name="chevronRight" size={17}/></button>
      <button className="wt-home-quiet-link" onClick={()=>go('people')}>Найти коллег <Icon name="chevronRight" size={16}/></button>
      <button className="wt-home-quiet-link" onClick={()=>go('chat')}>Мои чаты <Icon name="chevronRight" size={16}/></button>
     </div>
    </div>
    <div className="wt-home-income">
     <div className="wt-home-income-head"><span>НА РУКИ В {MONTHS[month.month].toUpperCase()}</span><Icon name="pay" size={25}/></div>
     <strong>{formatMoney(month.net)}</strong>
     <div className="wt-home-income-foot"><span>{month.work} рабочих смен · после НДФЛ</span><button onClick={()=>go('pay')}>Выплаты <Icon name="chevronRight" size={18}/></button></div>
    </div>
   </div>
   <div className="wt-week-preview">
    <div className="wt-week-preview-title"><div><span className="wt-overline">ПЛАН НА 7 ДНЕЙ</span><strong>Неделя в сменах</strong></div><button onClick={()=>go('calendar')}>Весь календарь <Icon name="chevronRight" size={16}/></button></div>
    <div className="wt-week-days">
     {week.map(({date,kind,label},index)=><button key={iso(date)} type="button" className={`wt-week-day ${kind==='off'?'is-off':kind==='night'?'is-night':'is-work'}${index===0?' is-today':''}`} onClick={()=>go('calendar')} aria-label={`${date.toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'})}: ${label}. Открыть календарь`}>
       <span>{date.toLocaleDateString('ru-RU',{weekday:'short'})}</span><strong>{date.getDate()}</strong><small>{label}</small>
      </button>)}
    </div>
   </div>
  </header>
  <section className="wt-home-ledger" aria-label="Важные показатели">
   <div className="wt-home-ledger-heading"><span className="wt-overline">МОЙ СТАТУС</span><h3>Главное сейчас</h3></div>
   <div className="wt-home-ledger-list">
    <button onClick={()=>go('calendar')}><span className="wt-ledger-number">01</span><span className="wt-ledger-label">Сегодня</span><strong>{shiftLabel}</strong><Icon name="chevronRight" size={18}/></button>
    <button onClick={()=>go('absence')}><span className="wt-ledger-number">02</span><span className="wt-ledger-label">Отпуск доступен</span><strong>{Math.round(vacLeft)} дней</strong><Icon name="chevronRight" size={18}/></button>
    <button onClick={()=>go('pay')}><span className="wt-ledger-number">03</span><span className="wt-ledger-label">Доход за {yearNumber}</span><strong>{formatMoney(year.net)}</strong><Icon name="chevronRight" size={18}/></button>
   </div>
  </section>
  <div className="wt-home-columns">
   <div className="wt-home-main">
    <section className="wt-home-section wt-home-projection">
     <div className="wt-section-heading"><div><span className="wt-overline">ПЛАНИРОВАНИЕ / 01</span><h3>Деньги на горизонте</h3></div><button className="wt-link-button" onClick={()=>go('pay')}>Расчёт зарплаты <Icon name="chevronRight" size={16}/></button></div>
     <div className="wt-home-forecast"><div><span>Прогноз на {forecastMonths} мес.</span><strong>{formatMoney(forecast.net)}</strong><small>В среднем {formatMoney(forecast.avg)} в месяц, по текущим настройкам</small></div><label htmlFor="wt-forecast-range">Период: {forecastMonths} мес.</label><input id="wt-forecast-range" type="range" min="1" max="12" value={forecastMonths} onChange={e=>setForecastMonths(Number(e.target.value))}/></div>
     <details className="wt-home-disclosure"><summary>Смоделировать другой оклад <Icon name="chevronDown" size={17}/></summary>
      <div className="wt-home-planner"><div className="wt-tool-heading"><span className="wt-overline">ЕСЛИ ИЗМЕНИТЬ УСЛОВИЯ</span><h4>Ожидаемая выплата</h4><strong>{formatMoney(scenario.net)}</strong></div><div className="wt-form-pair"><label>Оклад, ₽<input type="number" min="0" value={scenarioSalary} onChange={e=>setScenarioSalary(Number(e.target.value)||0)}/></label><label>Ночная доплата · {scenarioNight}%<input type="range" min="0" max="100" value={scenarioNight} onChange={e=>setScenarioNight(Number(e.target.value))}/></label></div></div>
     </details>
    </section>
    <section className="wt-home-section wt-home-absence">
     <div className="wt-section-heading"><div><span className="wt-overline">ПЛАНИРОВАНИЕ / 02</span><h3>Время для себя</h3></div><button className="wt-link-button" onClick={()=>go('absence')}>Все отсутствия <Icon name="chevronRight" size={16}/></button></div>
     <div className="wt-home-absence-intro"><strong>{Math.round(vacLeft)}<span> / {state.vacTotal}</span></strong><p>Осталось дней отпуска</p></div>
     <details className="wt-home-disclosure"><summary>Рассчитать отпуск и больничный <Icon name="chevronDown" size={17}/></summary>
      <div className="wt-home-planner"><div className="wt-form-pair"><label>Первый день отпуска<input type="date" value={vacStart} onChange={e=>setVacStart(e.target.value)}/></label><label>Календарных дней<input type="number" min="1" max="60" value={vacLength} onChange={e=>setVacLength(Math.max(1,Number(e.target.value)||1))}/></label></div>
       <p>{plannedVacation?`${plannedVacation.days} дней по расчёту · останется ${Math.round(plannedVacation.balance)} дней`:'Выберите первый день отпуска, чтобы проверить остаток.'}</p>
       <div className="wt-sick-inline"><label>Больничный · дней<input type="number" min="1" max="365" value={sickDays} onChange={e=>setSickDays(Math.max(1,Number(e.target.value)||1))}/></label><div><span>Расчёт выплаты · {Math.round(sickRate*100)}%</span><strong>{formatMoney(sickPay)}</strong></div></div>
      </div>
     </details>
    </section>
   </div>
   <aside className="wt-home-aside">
    <section className="wt-home-section wt-home-advice">
     <div className="wt-section-heading"><div><span className="wt-overline">ВАЖНО ЗНАТЬ</span><h3>На заметку</h3></div></div>
     <ul>{tips.length?tips.map((text,i)=><li key={i}>{text}</li>):<li>В расчётах нет предупреждений. Загляните в ленту — там новости коллег.</li>}</ul>
    </section>
    <section className="wt-home-section wt-home-quicknote">
     <div className="wt-section-heading"><div><span className="wt-overline">МОИ ЗАПИСИ</span><h3>Заметка к смене</h3></div></div>
     <label className="wt-sr-only" htmlFor="wt-quick-note">Текст заметки</label>
     <textarea id="wt-quick-note" value={tip} onChange={e=>setTip(e.target.value)} placeholder="Что важно не забыть?"/>
     <button className="wt-button primary" disabled={!tip.trim()} onClick={saveTip}>Сохранить заметку <Icon name="chevronRight" size={17}/></button>
    </section>
    <details className="wt-home-utility"><summary><span><Icon name="shield" size={18}/> Резервная копия и безопасность</span><Icon name="chevronDown" size={16}/></summary>
     <section className="wt-home-section"><div className="wt-section-heading"><div><span className="wt-overline">ЭКСПОРТ</span><h3>Ваши данные</h3></div></div><p>Резервная копия шифруется на устройстве.</p><label htmlFor="wt-backup-password">Пароль шифрования</label><input id="wt-backup-password" type="password" value={backupPassword} onChange={e=>setBackupPassword(e.target.value)} autoComplete="new-password"/><button className="wt-button secondary" onClick={()=>void backup()}>Создать копию <Icon name="download" size={16}/></button></section>
     <section className="wt-home-section wt-home-security"><span className="wt-overline">ЗАЩИТА</span><h3>Аккаунт</h3><p>OnePass: {state.onePassEnabled?'включён':'выключен'}. Личные чаты используют E2E-шифрование.</p><button className="wt-button secondary" onClick={()=>go('settings')}>Настройки безопасности</button></section>
    </details>
   </aside>
  </div>
 </section>;
}
