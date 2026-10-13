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
 const days=Array.from({length:14},(_,offset)=>{
  const date=addDays(now,offset),kind=getScheduledShift(state,date);
  return {date,kind,label:kind==='off'?'Выходной':kind==='night'?'Ночь':kind==='full'?'Сутки':'День'};
 });
 const dateLong=now.toLocaleDateString('ru-RU',{weekday:'long'});
 return <section className="wt-control-room" aria-label="Личная главная">
  <header className="wt-control-hero">
   <div className="wt-control-date"><span className="wt-control-hero-eyebrow">СЕГОДНЯ · {now.toLocaleDateString('ru-RU',{month:'long',year:'numeric'}).toUpperCase()}</span><strong>{String(now.getDate()).padStart(2,'0')}</strong><span>{dateLong}</span><span className="wt-control-date-foot">ВАШ РАБОЧИЙ РИТМ / WT</span></div>
   <div className="wt-control-intro">
    <span className="wt-control-hero-eyebrow">ЛИЧНЫЙ РАБОЧИЙ ПУЛЬТ</span>
    <h2>День начинается <em>здесь.</em></h2>
    <p>Привет, {state.profile.name.split(' ')[0]||'коллега'}. Перед вами не отчёт, а ваш рабочий день: что впереди, что оплачено и что можно запланировать.</p>
    <div className="wt-control-status"><span className={`wt-control-status-indicator ${shift==='off'?'off':''}`}/><strong>{shiftLabel}</strong><span>Ваш график на сегодня</span></div>
    <div className="wt-control-hero-actions"><button onClick={()=>go('calendar')}><Icon name="calendar" size={18}/> Открыть график <Icon name="chevronRight" size={17}/></button><button onClick={()=>go('social')}>Новости коллег <Icon name="chevronRight" size={16}/></button></div>
   </div>
   <div className="wt-control-balance">
    <span className="wt-control-hero-eyebrow">РАСЧЁТ ЗА {MONTHS[month.month].toUpperCase()}</span>
    <span className="wt-control-balance-caption">К выплате</span>
    <strong>{formatMoney(month.net)}</strong>
    <div className="wt-control-balance-rule"><span style={{width:`${Math.min(100,Math.round(month.work/Math.max(1,new Date(yearNumber,now.getMonth()+1,0).getDate())*100))}%`}}/></div>
    <div className="wt-control-balance-bottom"><span>{month.work} смен в месяце<br/>Сумма после НДФЛ</span><button onClick={()=>go('pay')} aria-label="Открыть подробный расчёт зарплаты"><Icon name="chevronRight" size={21}/></button></div>
   </div>
  </header>
  <section className="wt-roster" aria-label="График на четырнадцать дней">
   <div className="wt-roster-caption"><div><span className="wt-index-label">01 / ГРАФИК</span><h3>Ближайшие две недели</h3></div><button onClick={()=>go('calendar')}>Полный календарь <Icon name="externalLink" size={15}/></button></div>
   <div className="wt-roster-lanes">{days.map(({date,kind,label},i)=><button key={iso(date)} className={`wt-roster-slot is-${kind}${i===0?' is-today':''}`} onClick={()=>go('calendar')} aria-label={`${date.toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'})}: ${label}`}><span>{date.toLocaleDateString('ru-RU',{weekday:'short'})}</span><strong>{date.getDate()}</strong><i/><small>{label}</small></button>)}</div>
   <div className="wt-roster-legend"><span><i className="day"/>Рабочая</span><span><i className="night"/>Ночь</span><span><i className="off"/>Выходной</span></div>
  </section>
  <div className="wt-control-grid">
   <div className="wt-control-workbench">
    <section className="wt-control-workbench-head"><span className="wt-index-label">02 / ПЛАНЫ</span><h2>Планируйте заранее.</h2><p>Настоящие расчёты — на основе вашего графика, оклада и сохранённых периодов.</p></section>
    <section className="wt-workbook wt-workbook-finance">
     <div className="wt-workbook-title"><span className="wt-workbook-index">A</span><div><span className="wt-index-label">ФИНАНСОВЫЙ ПРОГНОЗ</span><h3>Сколько получится</h3></div><button onClick={()=>go('pay')} aria-label="Детальный расчёт зарплаты"><Icon name="chevronRight" size={20}/></button></div>
     <div className="wt-workbook-figure"><strong>{formatMoney(forecast.net)}</strong><span>За {forecastMonths} мес. · среднемесячно {formatMoney(forecast.avg)}</span></div>
     <label htmlFor="wt-forecast-range" className="wt-workbook-range-label">Период прогноза <b>{forecastMonths} месяцев</b></label>
     <input id="wt-forecast-range" type="range" min="1" max="12" value={forecastMonths} onChange={e=>setForecastMonths(Number(e.target.value))}/>
     <div className="wt-workbook-axis"><span>1 мес.</span><span>6 мес.</span><span>12 мес.</span></div>
     <details className="wt-workbook-disclosure"><summary>Что, если изменить условия? <Icon name="chevronDown" size={16}/></summary><div className="wt-workbook-inputs"><label>Оклад, ₽<input type="number" min="0" value={scenarioSalary} onChange={e=>setScenarioSalary(Number(e.target.value)||0)}/></label><label>Ночная доплата · {scenarioNight}%<input type="range" min="0" max="100" value={scenarioNight} onChange={e=>setScenarioNight(Number(e.target.value))}/></label><div><span>Сценарий выплаты</span><strong>{formatMoney(scenario.net)}</strong></div></div></details>
    </section>
    <section className="wt-workbook wt-workbook-absence">
     <div className="wt-workbook-title"><span className="wt-workbook-index">B</span><div><span className="wt-index-label">ОТДЫХ И ЗДОРОВЬЕ</span><h3>Дни в вашем распоряжении</h3></div><button onClick={()=>go('absence')} aria-label="Планировать отсутствия"><Icon name="chevronRight" size={20}/></button></div>
     <div className="wt-workbook-vac"><strong>{Math.round(vacLeft)}<small>дней</small></strong><div><span>Осталось из {state.vacTotal}</span><div className="wt-workbook-vac-track"><i style={{width:`${state.vacTotal>0?Math.max(0,Math.min(100,vacLeft/state.vacTotal*100)):0}%`}}/></div></div></div>
     <details className="wt-workbook-disclosure"><summary>Расчёт отпуска и больничного <Icon name="chevronDown" size={16}/></summary><div className="wt-workbook-inputs"><label>Первый день отпуска<input type="date" value={vacStart} onChange={e=>setVacStart(e.target.value)}/></label><label>Длительность, дней<input type="number" min="1" max="60" value={vacLength} onChange={e=>setVacLength(Math.max(1,Number(e.target.value)||1))}/></label><p>{plannedVacation?`${plannedVacation.days} дней · останется ${Math.round(plannedVacation.balance)}`:'Укажите дату, чтобы узнать остаток.'}</p><label>Больничный, дней<input type="number" min="1" max="365" value={sickDays} onChange={e=>setSickDays(Math.max(1,Number(e.target.value)||1))}/></label><div><span>Выплата · {Math.round(sickRate*100)}%</span><strong>{formatMoney(sickPay)}</strong></div></div></details>
    </section>
    <section className="wt-control-command-list" aria-label="Быстрые переходы"><span className="wt-index-label">03 / ЧТО ДАЛЬШЕ</span><button onClick={()=>go('chat')}><span>01</span><strong>Написать коллегам</strong><Icon name="chevronRight" size={19}/></button><button onClick={()=>go('people')}><span>02</span><strong>Найти людей</strong><Icon name="chevronRight" size={19}/></button><button onClick={()=>go('work')}><span>03</span><strong>Перейти к работе</strong><Icon name="chevronRight" size={19}/></button></section>
   </div>
   <aside className="wt-control-notebook" aria-label="Записи и информация">
    <div className="wt-notebook-head"><span className="wt-index-label">ЛИЧНЫЙ БЛОКНОТ / WT</span><h2>На сегодня.</h2><span>{now.toLocaleDateString('ru-RU',{day:'numeric',month:'long'})}</span></div>
    <section className="wt-notebook-status"><span className="wt-index-label">ВАШИ ЦИФРЫ</span><div><span>Годовой доход</span><strong>{formatMoney(year.net)}</strong></div><div><span>Рабочие смены</span><strong>{month.work}</strong></div><div><span>Остаток отпуска</span><strong>{Math.round(vacLeft)}</strong></div></section>
    <section className="wt-notebook-notes"><h3>Заметка к смене</h3><label className="wt-sr-only" htmlFor="wt-quick-note">Текст заметки</label><textarea id="wt-quick-note" value={tip} onChange={e=>setTip(e.target.value)} placeholder="Что нужно не забыть сегодня?"/><button disabled={!tip.trim()} onClick={saveTip}><Icon name="check" size={17}/> Сохранить</button></section>
    <section className="wt-notebook-prompts"><h3>Обратить внимание</h3>{tips.length?tips.map((t,i)=><p key={i}>{t}</p>):<p>График и выплаты рассчитаны. Можно заняться планами или узнать новости коллег.</p>}</section>
    <details className="wt-notebook-backup"><summary><Icon name="shield" size={17}/> Резервная копия и защита <Icon name="chevronDown" size={16}/></summary><div><p>Ваши данные шифруются перед экспортом на этом устройстве.</p><label htmlFor="wt-backup-password">Пароль шифрования</label><input id="wt-backup-password" type="password" value={backupPassword} onChange={e=>setBackupPassword(e.target.value)} autoComplete="new-password"/><button onClick={()=>void backup()}><Icon name="download" size={16}/> Создать резервную копию</button><p>OnePass: {state.onePassEnabled?'включён':'выключен'}. Чаты защищены E2E-шифрованием.</p><button onClick={()=>go('settings')}>Настройки безопасности <Icon name="chevronRight" size={16}/></button></div></details>
   </aside>
  </div>
 </section>;
}
