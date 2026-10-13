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
 return <section className="wt-home redesign-home" aria-label="Личная главная">
  <header className="wt-home-opening">
   <span className="wt-overline">ЛИЧНОЕ ПРОСТРАНСТВО / {now.toLocaleDateString('ru-RU',{day:'numeric',month:'long'})}</span>
   <h2>Привет, {state.profile.name.split(' ')[0]||'коллега'}<span className="wt-greeting-dot">.</span></h2>
   <p>Люди, смены и деньги — всё важное для рабочего дня в одном месте.</p>
   <div className="wt-home-launch">
    <button className="wt-button primary" onClick={()=>go('social')}><Icon name="social" size={18}/>К ленте</button>
    <button className="wt-button secondary" onClick={()=>go('people')}><Icon name="people" size={18}/>Найти людей</button>
    <button className="wt-button secondary" onClick={()=>go('chat')}><Icon name="chat" size={18}/>Сообщения</button>
   </div>
  </header>
  <section className="home-snapshot wt-home-snapshot" aria-label="Показатели рабочего месяца">
   <button onClick={()=>go('calendar')}><span>СЕГОДНЯ</span><b>{shiftLabel}</b><small>Ваш график · открыть смены <Icon name="chevronRight" size={13}/></small></button>
   <button onClick={()=>go('pay')}><span>НА РУКИ · {MONTHS[month.month]}</span><b>{formatMoney(month.net)}</b><small>{month.work} смен в этом месяце <Icon name="chevronRight" size={13}/></small></button>
   <button onClick={()=>go('absence')}><span>ОСТАТОК ОТПУСКА</span><b>{Math.round(vacLeft)} дней</b><small>Планирование отсутствия <Icon name="chevronRight" size={13}/></small></button>
  </section>
  <div className="wt-home-columns">
   <div className="wt-home-main">
    <section className="wt-home-section">
     <div className="wt-section-heading"><div><span className="wt-overline">Ваш график</span><h3>Рабочий день</h3></div><button className="wt-link-button" onClick={()=>go('calendar')}>Календарь <Icon name="chevronRight" size={16}/></button></div>
     <div className="wt-today-feature"><div><span className="wt-today-day">{now.toLocaleDateString('ru-RU',{weekday:'long'})}</span><strong>{now.toLocaleDateString('ru-RU',{day:'numeric',month:'long'})}</strong><span className={`wt-today-state${shift==='off'?' is-off':''}`}>{shiftLabel}</span></div><button className="wt-button secondary" onClick={()=>go('calendar')}>Изменить смену</button></div>
    </section>
    <section className="wt-home-section">
     <div className="wt-section-heading"><div><span className="wt-overline">РАСЧЁТЫ</span><h3>Доход и планы</h3></div><button className="wt-link-button" onClick={()=>go('pay')}>Зарплата <Icon name="chevronRight" size={16}/></button></div>
     <div className="wt-home-forecast"><div><span>Прогноз выплат</span><strong>{formatMoney(forecast.net)}</strong><small>За {forecastMonths} мес. · {formatMoney(forecast.avg)} в среднем за месяц</small></div><label htmlFor="wt-forecast-range">Горизонт: {forecastMonths} мес.</label><input id="wt-forecast-range" type="range" min="1" max="12" value={forecastMonths} onChange={e=>setForecastMonths(Number(e.target.value))}/></div>
     <details className="wt-home-disclosure"><summary>Изменить условия расчёта <Icon name="chevronDown" size={16}/></summary>
     <div className="wt-home-planner">
      <div className="wt-tool-heading"><span className="wt-overline">Сценарий выплаты</span><h4>Если изменить условия</h4><strong>{formatMoney(scenario.net)}</strong></div>
      <div className="wt-form-pair"><label>Оклад<input type="number" min="0" value={scenarioSalary} onChange={e=>setScenarioSalary(Number(e.target.value)||0)}/></label><label>Ночная доплата · {scenarioNight}%<input type="range" min="0" max="100" value={scenarioNight} onChange={e=>setScenarioNight(Number(e.target.value))}/></label></div>
     </div>
     </details>
    </section>
    <section className="wt-home-section">
     <div className="wt-section-heading"><div><span className="wt-overline">Спланировать заранее</span><h3>Отпуск и больничный</h3></div><button className="wt-link-button" onClick={()=>go('absence')}>Отсутствия <Icon name="chevronRight" size={16}/></button></div>
     <details className="wt-home-disclosure"><summary>Рассчитать отпуск и больничный <Icon name="chevronDown" size={16}/></summary>
     <div className="wt-home-planner">
      <div className="wt-form-pair"><label>Начало отпуска<input type="date" value={vacStart} onChange={e=>setVacStart(e.target.value)}/></label><label>Календарных дней<input type="number" min="1" max="60" value={vacLength} onChange={e=>setVacLength(Math.max(1,Number(e.target.value)||1))}/></label></div>
      <p>{plannedVacation?`${plannedVacation.days} дней по расчёту · останется ${Math.round(plannedVacation.balance)} дней`:'Выберите дату начала — остаток рассчитается автоматически.'}</p>
      <div className="wt-sick-inline"><label>Больничный · дней<input type="number" min="1" max="365" value={sickDays} onChange={e=>setSickDays(Math.max(1,Number(e.target.value)||1))}/></label><div><span>Оценка выплаты · {Math.round(sickRate*100)}%</span><strong>{formatMoney(sickPay)}</strong></div></div>
     </div>
     </details>
    </section>
   </div>
   <aside className="wt-home-aside">
    <section className="wt-home-section wt-home-advice"><div className="wt-section-heading"><div><span className="wt-overline">КОНТЕКСТ</span><h3>Стоит проверить</h3></div></div><ul>{tips.length?tips.map((text,i)=><li key={i}>{text}</li>):<li>График и расчёты готовы. Посмотрите, что нового у коллег.</li>}</ul></section>
    <section className="wt-home-section"><div className="wt-section-heading"><div><span className="wt-overline">ЗАМЕТКА К СМЕНЕ</span><h3>Сохранить мысль</h3></div></div><label className="wt-sr-only" htmlFor="wt-quick-note">Текст заметки</label><textarea id="wt-quick-note" value={tip} onChange={e=>setTip(e.target.value)} placeholder="Что важно не забыть после смены?"/><button className="wt-button primary" disabled={!tip.trim()} onClick={saveTip}>Сохранить заметку</button></section>
    <section className="wt-home-section"><span className="wt-overline">ЗА ГОД</span><h3>{formatMoney(year.net)}</h3><p>Чистый доход за {yearNumber} год по вашим настройкам.</p></section>
    <details className="wt-home-utility"><summary><span><Icon name="shield" size={18}/> Данные и безопасность</span><Icon name="chevronDown" size={16}/></summary>
    <section className="wt-home-section"><div className="wt-section-heading"><div><span className="wt-overline">Резервная копия</span><h3>Ваши данные</h3></div></div><p>Данные шифруются на устройстве перед экспортом.</p><label htmlFor="wt-backup-password">Пароль шифрования</label><input id="wt-backup-password" type="password" value={backupPassword} onChange={e=>setBackupPassword(e.target.value)} autoComplete="new-password"/><button className="wt-button secondary" onClick={()=>void backup()}>Создать копию <Icon name="download" size={16}/></button></section>
    <section className="wt-home-section wt-home-security"><span className="wt-overline">Безопасность</span><h3>Аккаунт и защита</h3><p>OnePass: {state.onePassEnabled?'включён':'выключен'}. Личные сообщения используют E2E-шифрование.</p><button className="wt-button secondary" onClick={()=>go('settings')}>Настройки безопасности</button></section>
    </details>
   </aside>
  </div>
 </section>;
}
