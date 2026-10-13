import {useMemo,useState} from 'react';
import {Icon} from './Icon';
import {calcMonth,calcYear,formatMoney,getScheduledShift,parseYmd,addDays,ymd,vacationCalendarDays,vacationUsedDays,vacationProjectedUsedDays,sickPayForDays,MONTHS,type State} from './core';
type Tab='home'|'social'|'people'|'communities'|'chat'|'work'|'calendar'|'pay'|'absence'|'friends'|'notifications'|'profile'|'settings'|'admin';
type Props={state:State;patch:(p:Partial<State>)=>void;onNotice:(s:string)=>void;go:(tab:Tab)=>void};
const iso=(d:Date)=>ymd(d);
const label=(shift:string)=>shift==='off'?'Выходной':shift==='night'?'Ночная смена':shift==='full'?'Суточная смена':'Дневная смена';
async function encryptBackup(state:State,password:string){
 const enc=new TextEncoder(),salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const base=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']);
 const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:100000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt']);
 const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(JSON.stringify(state))));
 const result=new Uint8Array(32+cipher.length);result.set([87,84,66,49]);result.set(salt,4);result.set(iv,20);result.set(cipher,32);return new Blob([result],{type:'application/octet-stream'});
}
export default function HomeView({state,patch,onNotice,go}:Props){
 const now=new Date(),yearNumber=now.getFullYear(),current=calcMonth(state,yearNumber,now.getMonth());
 const yearly=useMemo(()=>calcYear(state,yearNumber),[state,yearNumber]);
 const [focus,setFocus]=useState(iso(now));const focusDate=parseYmd(focus),focusShift=getScheduledShift(state,focusDate);
 const [forecastMonths,setForecastMonths]=useState(3),[scenarioSalary,setScenarioSalary]=useState(state.salary),[scenarioNight,setScenarioNight]=useState(state.nightExtraPercent);
 const [vacStart,setVacStart]=useState(''),[vacLength,setVacLength]=useState(14),[sickDays,setSickDays]=useState(5);
 const [tip,setTip]=useState(''),[backupPassword,setBackupPassword]=useState('');
 const orbit=useMemo(()=>Array.from({length:28},(_,i)=>{const date=addDays(now,i);return {date,kind:getScheduledShift(state,date),theta:i/28*Math.PI*2-Math.PI/2}}),[state,yearNumber,now.getMonth(),now.getDate()]);
 const monthGrid=useMemo(()=>Array.from({length:new Date(yearNumber,now.getMonth()+1,0).getDate()},(_,i)=>{const date=new Date(yearNumber,now.getMonth(),i+1);return {date,kind:getScheduledShift(state,date)}}),[state,yearNumber,now.getMonth()]);
 const forecast=useMemo(()=>{let total=0;for(let i=0;i<forecastMonths;i++){const d=new Date(yearNumber,now.getMonth()+i,1);total+=calcMonth(state,d.getFullYear(),d.getMonth()).net}return total},[state,yearNumber,now.getMonth(),forecastMonths]);
 const scenario=useMemo(()=>calcMonth({...state,salary:Math.max(0,scenarioSalary),nightExtraPercent:Math.max(0,scenarioNight)},yearNumber,now.getMonth()),[state,scenarioSalary,scenarioNight,yearNumber,now.getMonth()]);
 const vacLeft=Math.max(0,state.vacTotal-vacationUsedDays(state));
 const plannedVacation=useMemo(()=>{if(!vacStart)return null;const start=parseYmd(vacStart);const period={start:iso(start),end:iso(addDays(start,Math.max(0,vacLength-1)))};return {days:vacationCalendarDays(state,period),balance:Math.max(0,state.vacTotal-vacationProjectedUsedDays(state,period))}},[state,vacStart,vacLength]);
 const sickRate=state.stage<5?.6:state.stage<8?.8:1;
 const sickPay=sickPayForDays(state,yearNumber,now.getMonth(),sickDays);
 const saveNote=()=>{if(!tip.trim())return;patch({shiftNotes:{...state.shiftNotes,[focus]:[state.shiftNotes[focus],tip.trim()].filter(Boolean).join('\n')}});setTip('');onNotice('Заметка сохранена')};
 const backup=async()=>{if(!backupPassword){onNotice('Нужен пароль для резервной копии');return}try{const blob=await encryptBackup(state,backupPassword),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`workertink-backup-${iso(now)}.wtbackup`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setBackupPassword('');onNotice('Зашифрованная копия сохранена')}catch{onNotice('Не удалось создать резервную копию')}};
 const tile=(tab:Tab,no:string,headline:string,sub:string,icon:string,klass:string)=><button onClick={()=>go(tab)} className={`atlas-app-tile ${klass}`}><span className="atlas-app-tile-top"><span>{no} / ПРОСТРАНСТВО</span><Icon name={icon} size={25}/></span><span className="atlas-app-tile-body"><strong>{headline}</strong><small>{sub}</small></span><span className="atlas-app-tile-arrow">↗</span></button>;
 return <section className="atlas-home" aria-label="Главная — карта рабочего дня">
  <div className="atlas-home-overline"><span>✳ &nbsp; РАБОТА И ЖИЗНЬ, В ОДНОЙ СИСТЕМЕ</span><span>{now.toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'})}</span></div>
  <section className="atlas-world" aria-label="Интерактивная орбита смен">
   <div className="atlas-world-intro"><span className="atlas-world-tag">WT / ВАШЕ ВРЕМЯ</span><h1>Ваш день.<br/><em>Ваш ход.</em></h1><p>{state.profile.name.split(' ')[0]||'Привет'}, перед вами всё, что помогает жить и работать без лишней суеты. Выберите день на орбите или откройте нужное пространство.</p><div className="atlas-world-pulse"><i/><span>{label(getScheduledShift(state,now))} сегодня</span></div><button className="atlas-world-forward" onClick={()=>go('calendar')}>Открыть календарь <span>↗</span></button></div>
   <div className="atlas-orbit-area">
    <div className="atlas-orbit-ring"><div className="atlas-orbit-ring-mid"/><div className="atlas-orbit-ring-core"><span>ВЫБРАННЫЙ ДЕНЬ</span><strong>{String(focusDate.getDate()).padStart(2,'0')}<small>/{String(focusDate.getMonth()+1).padStart(2,'0')}</small></strong><b>{label(focusShift)}</b><small>Нажмите на точку вокруг</small></div>
    {orbit.map(({date,kind,theta})=><button key={iso(date)} className={`atlas-orbit-point atlas-orbit-${kind}${iso(date)===focus?' is-focus':''}`} onClick={()=>setFocus(iso(date))} style={{left:`${50+45*Math.cos(theta)}%`,top:`${50+45*Math.sin(theta)}%`}} title={`${date.toLocaleDateString('ru-RU',{day:'numeric',month:'long'})} · ${label(kind)}`} aria-label={`${date.toLocaleDateString('ru-RU',{day:'numeric',month:'long'})}: ${label(kind)}`}><span>{date.getDate()}</span></button>)}
    </div>
    <div className="atlas-orbit-legend"><span><i className="is-work"/>Работа</span><span><i className="is-night"/>Ночь</span><span><i className="is-off"/>Отдых</span></div>
   </div>
  </section>
  <section className="atlas-live-tape" aria-label="Текущие показатели">
   <div><span>01 / СМЕН В МЕСЯЦЕ</span><strong>{current.work}<small> рабочих дней</small></strong></div>
   <div><span>02 / ПОСЛЕ НДФЛ</span><strong>{formatMoney(current.net)}</strong></div>
   <div><span>03 / ОТПУСК</span><strong>{Math.round(vacLeft)}<small> дней доступно</small></strong></div>
   <div><span>04 / ЗА ГОД</span><strong>{formatMoney(yearly.net)}</strong></div>
  </section>
  <section className="atlas-launchpad" aria-label="Пространства приложения">
   <header className="atlas-section-intro"><div><span>КАРТА СИСТЕМЫ / 01</span><h2>Выбирайте,<br/><em>куда двигаться.</em></h2></div><p>Каждый раздел — отдельный инструмент. Не нужно искать функцию в бесконечной ленте карточек.</p></header>
   <div className="atlas-app-grid">
    <button className="atlas-app-tile atlas-app-tile-calendar" onClick={()=>go('calendar')}><span className="atlas-app-tile-top"><span>01 / МОИ СМЕНЫ</span><Icon name="calendar" size={25}/></span><span className="atlas-calendar-title">{MONTHS[now.getMonth()]}<small>{yearNumber}</small></span><span className="atlas-mini-month">{monthGrid.map(({date,kind})=><i key={iso(date)} className={`is-${kind}${iso(date)===iso(now)?' is-today':''}`} title={`${date.getDate()} · ${label(kind)}`}/>)}</span><span className="atlas-app-tile-foot">Планировать график <b>↗</b></span></button>
    {tile('pay','02','Мои деньги','Начисления, налог, аванс и остаток','pay','atlas-app-tile-money')}
    {tile('social','03','Наша сеть','Новости и разговоры коллег','social','atlas-app-tile-social')}
    {tile('chat','04','На связи','Личные и групповые диалоги','chat','atlas-app-tile-chat')}
    {tile('work','05','Работа','График, заметки и рабочие инструменты','work','atlas-app-tile-work')}
    {tile('absence','06','Время отдыхать','Отпуск, больничные и расчёты','absence','atlas-app-tile-absence')}
    {tile('people','07','Коллеги','Люди, профили и контакты','people','atlas-app-tile-people')}
   </div>
  </section>
  <section className="atlas-lab" aria-label="Планирование и личные инструменты">
   <div className="atlas-lab-intro"><span>ЛАБОРАТОРИЯ / 02</span><h2>Что если?</h2><p>Меняйте параметры и смотрите прогноз на основе ваших данных. Эти расчёты не меняют настройки.</p></div>
   <div className="atlas-lab-tools">
    <details className="atlas-lab-tool" open><summary><b>01</b><span>Прогноз дохода</span><strong>{formatMoney(forecast)}</strong><Icon name="chevronDown" size={16}/></summary><div className="atlas-lab-body"><label>Горизонт: {forecastMonths} месяцев<input type="range" min="1" max="12" value={forecastMonths} onChange={e=>setForecastMonths(Number(e.target.value))}/></label><div className="atlas-lab-pair"><label>Оклад, ₽<input type="number" min="0" value={scenarioSalary} onChange={e=>setScenarioSalary(Number(e.target.value)||0)}/></label><label>Ночная доплата {scenarioNight}%<input type="range" min="0" max="100" value={scenarioNight} onChange={e=>setScenarioNight(Number(e.target.value))}/></label></div><p>При новых условиях на руки: <b>{formatMoney(scenario.net)}</b></p></div></details>
    <details className="atlas-lab-tool"><summary><b>02</b><span>Отпуск и здоровье</span><strong>{Math.round(vacLeft)} дней</strong><Icon name="chevronDown" size={16}/></summary><div className="atlas-lab-body"><div className="atlas-lab-pair"><label>Начало отпуска<input type="date" value={vacStart} onChange={e=>setVacStart(e.target.value)}/></label><label>Дней<input type="number" min="1" max="60" value={vacLength} onChange={e=>setVacLength(Math.max(1,Number(e.target.value)||1))}/></label></div><p>{plannedVacation?`Отпуск: ${plannedVacation.days} дней, останется ${Math.round(plannedVacation.balance)}`:'Укажите дату, чтобы рассчитать остаток.'}</p><label>Больничный, дней<input type="number" min="1" max="365" value={sickDays} onChange={e=>setSickDays(Math.max(1,Number(e.target.value)||1))}/></label><p>Выплата при стаже {Math.round(sickRate*100)}%: <b>{formatMoney(sickPay)}</b></p></div></details>
    <details className="atlas-lab-tool"><summary><b>03</b><span>Заметка и сохранение данных</span><strong>Личное</strong><Icon name="chevronDown" size={16}/></summary><div className="atlas-lab-body"><label>Заметка за {focusDate.toLocaleDateString('ru-RU',{day:'numeric',month:'long'})}<textarea value={tip} onChange={e=>setTip(e.target.value)} placeholder="Что важно запомнить?"/></label><button onClick={saveNote} disabled={!tip.trim()}>Сохранить заметку</button><hr/><label>Пароль для зашифрованной копии<input type="password" autoComplete="new-password" value={backupPassword} onChange={e=>setBackupPassword(e.target.value)}/></label><button onClick={()=>void backup()}>Создать резервную копию</button></div></details>
   </div>
  </section>
 </section>;
}
