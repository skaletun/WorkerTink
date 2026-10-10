import {useEffect,useMemo,useRef,useState} from 'react';
import {isElectronDesktop,showDesktopNotification} from './desktop';
import {sounds,unlockSounds} from './sounds';
import {getSocialNotifications} from './directory';
import {PublicProfileView,LegalSurface} from './ProfileFeatures';
import {State,normalizeWTinkId,calcMonth,monthKey,periodsOverlap,type UserProfile} from './core';
import {loadState,saveState,normalizeState,saveAuthToken,clearAuthToken} from './storage';
import {parseNotesMarkdown,notesExport} from './markdown';
import {directoryConfigured,updateProfile,syncPushReminders,getAuthStatus,getDirectoryFriends,heartbeatPresence,putChatKey,getOwnChatKey,checkUsername,updateUsername} from './directory';
import NetworkView from './NetworkView';
import WorkHubView from './WorkHubView';
import NotificationsView from './NotificationsView';
import NotificationToasts from './NotificationToasts';
import HomeView from './HomeView';
import ChatsHub from './ChatsHub';
import AppShell from './AppShell';
import {getChatIdentity,getChatIdentityMatching} from './chatCrypto';
import {Icon} from './Icon';
import {isDevProfile,isAdminProfile,NameWithBadge,download,Avatar,type PeriodDraft} from './app/AppShared';
import {buildPushReminders} from './app/reminders';
import {ProfileModal,ProfileView} from './views/profile/ProfileViews';
import {BootScreen,SetupWizard,RegistrationWizard,LoginScreen} from './views/auth/AuthViews';
import AdminView from './views/admin/AdminView';
import {FriendsView} from './views/people/PeopleViews';
import {CalendarView,PayView,AbsenceView} from './views/work/WorkViews';
import SettingsView from './views/settings/SettingsView';
import ShiftEditor from './views/work/ShiftEditor';

type Tab='home'|'social'|'people'|'communities'|'work'|'calendar'|'pay'|'absence'|'friends'|'chat'|'notifications'|'profile'|'settings'|'admin';

function App(){
 const [booting,setBooting]=useState(true);
 const [authProfileReady,setAuthProfileReady]=useState(false);
 const [state,setState]=useState<State>(loadState);const [tab,setTab]=useState<Tab>(()=>{const path=window.location.pathname.replace(/^\/WorkerTink(?=\/|$)/,'')||'/';const value=new URLSearchParams(window.location.search).get('tab');if(/^\/community\//i.test(path))return 'social';if(/^\/chat\/group\//i.test(path)||/^\/channel\//i.test(path))return 'chat';if(['home','social','people','communities','work','calendar','pay','absence','friends','chat','notifications','profile','settings','admin'].includes(value||''))return value as Tab;return 'social'});const [view,setView]=useState(()=>new Date());const [mobileMenuOpen,setMobileMenuOpen]=useState(false);
 useEffect(()=>{const timer=window.setTimeout(()=>setBooting(false),720);return()=>window.clearTimeout(timer)},[]);
 useEffect(()=>{const unlock=()=>unlockSounds();window.addEventListener('pointerdown',unlock,{once:true});window.addEventListener('keydown',unlock,{once:true});const handler=(e:Event)=>{e.preventDefault();setInstallEvent(e);setInstallBanner(true)};window.addEventListener('beforeinstallprompt',handler);const standalone=window.matchMedia?.('(display-mode: standalone)').matches||Boolean((navigator as any).standalone);const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);if((ios&&!standalone)||(standalone===false&&/android/i.test(navigator.userAgent)))setInstallBanner(true);return()=>{window.removeEventListener('beforeinstallprompt',handler);window.removeEventListener('pointerdown',unlock);window.removeEventListener('keydown',unlock)}},[]);
 useEffect(()=>{if(!state.directoryToken||!state.profile.name)return;if(state.profile.username){setUsernameGate(false);setUsernameDraft('');return}setUsernameDraft('');setUsernameGate(true)},[state.directoryToken,state.profile.name,state.profile.username]);
 const [viewedProfile,setViewedProfile]=useState<UserProfile|null>(null);
 const [vac,setVac]=useState<PeriodDraft>({start:'',end:''});const [sick,setSick]=useState<PeriodDraft>({start:'',end:''});const [notice,setNotice]=useState('');const [editorDate,setEditorDate]=useState<string|null>(null);
 const [usernameGate,setUsernameGate]=useState(false);const [usernameDraft,setUsernameDraft]=useState('');const [usernameBusy,setUsernameBusy]=useState(false);const [installEvent,setInstallEvent]=useState<any>(null);const [installBanner,setInstallBanner]=useState(false);
 useEffect(()=>{if(!notice)return;const timer=window.setTimeout(()=>setNotice(''),4000);return()=>window.clearTimeout(timer)},[notice]);
 useEffect(()=>{if(!saveState(state))setNotice('Не удалось сохранить профиль: хранилище браузера переполнено')},[state]);
 const directorySync=useRef('');
 useEffect(()=>{if(!directoryConfigured||!state.directoryToken||!state.profile.name)return;const signature=JSON.stringify(state.profile);if(directorySync.current===signature)return;let cancelled=false;(async()=>{try{await updateProfile(state.profile,state.directoryToken);if(!cancelled)directorySync.current=signature}catch{if(!cancelled)setNotice('Не удалось синхронизировать профиль с каталогом')}})();return()=>{cancelled=true}},[state.profile,state.directoryToken]);
 useEffect(()=>{setAuthProfileReady(false);if(!directoryConfigured||!state.directoryToken){setAuthProfileReady(true);return}let cancelled=false;let retryTimer:number|undefined;let attempts=0;
 const syncAuth=async()=>{
  try{
   const result=await getAuthStatus(state.directoryToken);
   if(cancelled)return;
   attempts=0;
   saveAuthToken(state.directoryToken);
   setState(current=>{const setup=result.setup;return {...current,profile:{...current.profile,...result.profile,isDev:isDevProfile(result.profile),isAdmin:isAdminProfile(result.profile)},onePassEnabled:result.security.onePassAvailable,...(setup?{salary:setup.salary,taxRate:setup.taxRate,stage:setup.stage,vacTotal:setup.vacTotal,startDate:setup.startDate,scheduleType:setup.scheduleType,scheduleShift:setup.scheduleShift,scheduleVakhtaMonths:setup.scheduleVakhtaMonths,schedulePairType:setup.schedulePairType,holidayCoeff:setup.holidayCoeff,nightExtraPercent:setup.nightExtraPercent,setupComplete:true}:{})}});
   setAuthProfileReady(true);
  }catch(error){
   if(cancelled)return;
   const message=String(error);
   if((message.includes('UNAUTHORIZED')||message.includes('HTTP_401'))&&attempts<1){
    attempts+=1;
    retryTimer=window.setTimeout(()=>{if(!cancelled)void syncAuth()},1200);
    return;
   }
   setAuthProfileReady(true);
   if(message.includes('UNAUTHORIZED')||message.includes('HTTP_401')){
    clearAuthToken();
    setState(current=>({...current,directoryToken:'',onePassEnabled:false}));
   }
  }
 };
 void syncAuth();
 return()=>{cancelled=true;if(retryTimer!==undefined)window.clearTimeout(retryTimer)};
},[state.directoryToken]);
useEffect(()=>{if(!directoryConfigured||!authProfileReady||!state.directoryToken||!state.profile.profileId)return;let cancelled=false;(async()=>{try{const remote=await getOwnChatKey(state.directoryToken);if(cancelled)return;try{const id=await getChatIdentityMatching(state.profile.profileId,remote.key.publicKey);if(!cancelled)await putChatKey(id.publicKey,state.directoryToken);return}catch{} }catch{} try{const id=await getChatIdentity(state.profile.profileId);if(!cancelled)await putChatKey(id.publicKey,state.directoryToken)}catch{}})();return()=>{cancelled=true}},[authProfileReady,state.directoryToken,state.profile.profileId]);
 useEffect(()=>{if(!directoryConfigured||!state.directoryToken)return;const timer=window.setTimeout(()=>{void syncPushReminders(buildPushReminders(state),state.directoryToken).catch(()=>{})},1200);return()=>window.clearTimeout(timer)},[state.directoryToken,state.notifications.enabled,state.notifications.shifts,state.notifications.absences,state.notifications.payroll,state.notifications.groupMessages,state.notifications.channelInvites,state.notifications.social,state.notifications.events,state.startDate,state.scheduleType,state.scheduleShift,state.schedulePairType,state.scheduleVakhtaMonths,state.vacations,state.sickLeaves,state.paymentDates]);
 useEffect(()=>{if(!directoryConfigured||!state.directoryToken||!state.profile.profileId)return;let cancelled=false;const beat=async()=>{if(cancelled)return;try{await heartbeatPresence(state.directoryToken)}catch{}};void beat();const timer=window.setInterval(beat,20000);return()=>{cancelled=true;window.clearInterval(timer)}},[state.directoryToken,state.profile.profileId]);
 useEffect(()=>{if(!directoryConfigured||!state.directoryToken||!state.profile.profileId||!isElectronDesktop||!state.notifications.enabled)return;let cancelled=false;let initialized=false;const key='workertink:desktop:last-notification';const poll=async()=>{try{const result=await getSocialNotifications(state.directoryToken);if(cancelled)return;const rows=result.notifications||[];if(!rows.length)return;const lastTime=Number(localStorage.getItem(key+'-time')||0);const newest=rows[0];const fresh=initialized?rows.filter((n:any)=>Number(n.createdAt||0)>lastTime).slice(0,3):[];localStorage.setItem(key,String(newest.id));localStorage.setItem(key+'-time',String(newest.createdAt||Date.now()));if(initialized)for(const n of fresh){sounds.notification();showDesktopNotification({title:n.title||'WTinker',body:n.body||'Новое уведомление',url:n.url||'./?tab=notifications',tag:`wtink-${n.id}`});}initialized=true}catch{}};void poll();const timer=window.setInterval(()=>void poll(),25000);return()=>{cancelled=true;window.clearInterval(timer)}},[state.directoryToken,state.profile.profileId,state.notifications.enabled]);

 useEffect(()=>{if(!directoryConfigured||!state.directoryToken||!state.profile.profileId)return;let cancelled=false;const syncPresence=async()=>{if(cancelled||document.visibilityState==='hidden')return;try{const result=await getDirectoryFriends(state.directoryToken);if(cancelled)return;setState(s=>{const friends={...s.friends};for(const item of result.friends){const current=friends[item.profile.profileId];friends[item.profile.profileId]={profile:{...item.profile,isDev:isDevProfile(item.profile)},addedAt:current?.addedAt||item.addedAt,lastSeen:item.lastSeen,online:item.online,connected:current?.connected}}const currentSignature=Object.values(s.friends).map(x=>`${x.profile.profileId}:${x.online?'1':'0'}:${x.lastSeen||0}`).sort().join('|');const nextSignature=Object.values(friends).map(x=>`${x.profile.profileId}:${x.online?'1':'0'}:${x.lastSeen||0}`).sort().join('|');return currentSignature===nextSignature?s:{...s,friends}})}catch{}};void syncPresence();const timer=window.setInterval(syncPresence,30000);const onVisible=()=>{if(document.visibilityState==='visible')void syncPresence()};document.addEventListener('visibilitychange',onVisible);return()=>{cancelled=true;window.clearInterval(timer);document.removeEventListener('visibilitychange',onVisible)}},[state.directoryToken,state.profile.profileId]);
 useEffect(()=>{const apply=()=>{document.documentElement.dataset.theme=state.theme==='auto'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):state.theme};apply();if(state.theme==='auto'){const mq=window.matchMedia('(prefers-color-scheme: dark)');mq.addEventListener?.('change',apply);return()=>mq.removeEventListener?.('change',apply)}},[state.theme]);
 const calc=useMemo(()=>calcMonth(state,view.getFullYear(),view.getMonth()),[state,view]);const key=monthKey(view.getFullYear(),view.getMonth());
 const patch=(p:Partial<State>)=>setState(s=>({...s,...p}));
 const payment=(field:'advanceDate'|'remainderDate',value:string)=>setState(s=>({...s,paymentDates:{...s.paymentDates,[key]:{...(s.paymentDates[key]||{advanceDate:'',remainderDate:''}),[field]:value}}}));
 const setAdvance=(value:string)=>setState(s=>{const advances={...s.advances};if(value.trim()==='')delete advances[key];else{const n=Number(value);if(Number.isFinite(n))advances[key]=Math.max(0,n)}return {...s,advances}});
 const monthDays=useMemo(()=>{const first=new Date(view.getFullYear(),view.getMonth(),1),last=new Date(view.getFullYear(),view.getMonth()+1,0),lead=(first.getDay()+6)%7;const arr:(Date|null)[]=Array(lead).fill(null);for(let i=1;i<=last.getDate();i++)arr.push(new Date(view.getFullYear(),view.getMonth(),i));return arr},[view]);
 const addPeriod=(kind:'vacations'|'sickLeaves',draft:PeriodDraft)=>{if(!draft.start||!draft.end||draft.end<draft.start){setNotice('Укажите корректный период');return}const candidate={start:draft.start,end:draft.end};const otherKind=kind==='vacations'?'sickLeaves':'vacations';if(state[kind].some(p=>periodsOverlap(p,candidate))||state[otherKind].some(p=>periodsOverlap(p,candidate))){setNotice('Период пересекается с уже сохранённым отпуском или больничным');return}setState(s=>({...s,[kind]:[...s[kind],candidate]}));kind==='vacations'?setVac({start:'',end:''}):setSick({start:'',end:''});setNotice(kind==='vacations'?'Отпуск добавлен':'Больничный добавлен')};
 const removePeriod=(kind:'vacations'|'sickLeaves',i:number)=>setState(s=>({...s,[kind]:s[kind].filter((_,idx)=>idx!==i)}));
 const exportData=()=>{download('workertink-profile.json',JSON.stringify(normalizeState(state),null,2),'application/json');setNotice('Профиль экспортирован')};
 const importData=(file:File)=>{const r=new FileReader();r.onload=()=>{try{const incoming=normalizeState(JSON.parse(String(r.result)));setState({...incoming,setupComplete:true});setNotice('Профиль импортирован')}catch{setNotice('Не удалось прочитать профиль')}};r.readAsText(file)};
 const importNotes=(file:File)=>{const r=new FileReader();r.onload=()=>{const notes=parseNotesMarkdown(String(r.result));if(!Object.keys(notes).length){setNotice('В MD не найдены заметки WTinker');return}setState(s=>({...s,shiftNotes:{...s.shiftNotes,...notes}}));setNotice(`Импортировано заметок: ${Object.keys(notes).length}`)};r.readAsText(file)};
 const exportAllNotes=()=>{const dates=Object.keys(state.shiftNotes).filter(d=>state.shiftNotes[d]?.trim()).sort();if(!dates.length){setNotice('Нет заметок для экспорта');return}download('workertink-shift-notes.md',notesExport(state,dates));setNotice('Заметки экспортированы в MD')};
 const navItems:[Tab,string,string][]=[['home','Главная','Ваш рабочий контур'],['social','Лента','Публикации и рабочие новости'],['people','Люди','Коллеги и профессиональные связи'],['communities','Сообщества','Команды и профессиональные группы'],['chat','Чаты','Личные, группы и каналы'],['work','Работа','Смены, зарплата и отсутствие'],['notifications','Уведомления','Социальные и рабочие события'],['profile','Профиль','Ваша профессиональная страница'],['settings','Настройки','Аккаунт и безопасность'],...(isAdminProfile(state.profile)?[['admin','Админ','Управление каталогом'] as [Tab,string,string]]:[])];
 const saveUsername=async()=>{const value=usernameDraft.trim().replace(/^@/,'');if(!/^[A-Za-z0-9_]{3,32}$/.test(value)){setNotice('Username: 3–32 символа, только латиница, цифры и _');return}setUsernameBusy(true);try{const check=await checkUsername(value);if(!check.available){setNotice('Этот username уже занят');return}const r=await updateUsername(value,state.directoryToken);setState(s=>({...s,profile:{...s.profile,...r.profile}}));setUsernameGate(false);setNotice(`Ваш username: @${value}`)}catch(e){setNotice(String(e).includes('USERNAME_TAKEN')?'Этот username уже занят':'Не удалось сохранить username')}finally{setUsernameBusy(false)}};
 const syncTabUrl=(next:Tab)=>{const base=window.location.hostname.endsWith('github.io')?'/WorkerTink':'';const pathname=base?base+'/':'/';const url=new URL(window.location.href);url.pathname=pathname;url.searchParams.delete('wtRoute');url.searchParams.set('tab',next);url.hash='';window.history.replaceState({},'',url.pathname+url.search+url.hash)}; const navigate=(next:Tab)=>{setTab(next);setMobileMenuOpen(false);syncTabUrl(next)};
 const openNotification=(notification:{url:string})=>{try{const target=new URL(notification.url||'./?tab=notifications',window.location.href);const base=window.location.hostname.endsWith('github.io')?'/WorkerTink':'';const path=target.pathname.startsWith(base)?target.pathname.slice(base.length)||'/':target.pathname;window.history.replaceState({},'',`${path}${target.search}${target.hash}`);const requested=target.searchParams.get('tab');if(requested&&['home','social','people','communities','work','calendar','pay','absence','friends','chat','notifications','profile','settings','admin'].includes(requested))setTab(requested as Tab);else if(path.startsWith('/community/'))setTab('social');else if(path.startsWith('/channel/')||path.startsWith('/chat/'))setTab('chat');else if(path.startsWith('/user/'))setTab('profile');else setTab('notifications');setMobileMenuOpen(false)}catch{navigate('notifications')}};
 const openProfile=(profile:UserProfile)=>{const id=normalizeWTinkId(profile.profileId);const cached=id===normalizeWTinkId(state.profile.profileId)?state.profile:Object.values(state.friends).find(x=>normalizeWTinkId(x.profile.profileId)===id)?.profile;const merged={...(cached||{}),...profile,username:profile.username||cached?.username||undefined,banner:profile.banner||cached?.banner||''};if(merged.username){const base=window.location.hostname.endsWith('github.io')?'/WorkerTink':'';window.history.pushState({},'',base+'/user/'+encodeURIComponent(merged.username));setViewedProfile({...merged,isDev:isDevProfile(merged),isAdmin:isAdminProfile(merged)});return}setViewedProfile({...merged,isDev:isDevProfile(merged),isAdmin:isAdminProfile(merged)})};
 const openChat=(profileId:string)=>{syncTabUrl('chat');const url=new URL(window.location.href);url.searchParams.set('chatWith',profileId);window.history.replaceState({},'',url.pathname+url.search);setTab('chat')};
 if(booting)return <BootScreen/>;
 const routePath=(()=>{const q=new URLSearchParams(window.location.search).get('wtRoute');if(q){try{const decoded=decodeURIComponent(q);window.history.replaceState({},'',decoded);return decoded}catch{return q}}return window.location.pathname})();
 const basePrefix=window.location.hostname.endsWith('github.io')?'/WorkerTink':'';
 const cleanRoute=routePath.startsWith(basePrefix)?routePath.slice(basePrefix.length)||'/':routePath;
 const legalPath=cleanRoute.match(/^\/rules\/(privacy|terms)\/?$/i);
 if(legalPath)return <LegalSurface kind={legalPath[1] as 'privacy'|'terms'}/>;
 const publicPath=cleanRoute.match(/^\/user\/([^/]+)\/?$/i);
 if(publicPath)return <PublicProfileView username={decodeURIComponent(publicPath[1])} token={state.directoryToken} currentProfile={state.profile} onNotice={setNotice} onChat={openChat}/>;
 if(!state.profile.name)return <RegistrationWizard state={state} setState={setState}/>;
 if(!state.directoryToken)return <LoginScreen state={state} setState={setState}/>;
 if(!state.setupComplete)return <SetupWizard state={state} setState={setState}/>;
 const heading=tab==='home'?'Главная':tab==='social'?'Лента':tab==='people'?'Люди':tab==='communities'?'Сообщества':tab==='work'?'Работа':tab==='calendar'?'Ваш график':tab==='pay'?'Зарплата':tab==='absence'?'Отпуск и больничные':tab==='friends'?'Контакты':tab==='chat'?'Сообщения':tab==='notifications'?'Уведомления':tab==='profile'?'Ваш профиль':tab==='admin'?'Админ-панель':'Настройки';
 const kicker=tab==='home'?'WTinker':tab==='social'?'Социальная сеть для работы':tab==='people'?'Люди · WTinkID + username':tab==='communities'?'Сообщества · люди и работа':tab==='work'?'Рабочий контур':tab==='calendar'?'Рабочий календарь':tab==='pay'?'Финансы':tab==='absence'?'Периоды отсутствия':tab==='friends'?'Контакты и коллеги':tab==='chat'?'Личные сообщения и файлы':tab==='notifications'?'Центр событий':tab==='profile'?'Профессиональный профиль':tab==='admin'?'Управление каталогом':'Параметры профиля';
 return <><AppShell
  items={navItems.map(([id,label,sub])=>({id,label,sub,icon:<Icon name={id}/> }))}
  active={tab}
  onNavigate={id=>navigate(id as Tab)}
  profile={<><Avatar profile={state.profile} size="sm"/><span><b><NameWithBadge profile={state.profile}/></b><small>{state.profile.username?'@'+state.profile.username:'@username'}</small></span></>}
  profileAction={()=>navigate('profile')}
  privacy={<div className="wt-privacy" role="status" aria-label="E2E шифрование включено">
  <div className="wt-privacy-icon" aria-hidden="true"><Icon name="shield" size={17}/></div>
  <div className="wt-privacy-copy">
    <div><b>Личные сообщения</b><span>Защищены E2E</span></div>
    <small>Шифрование выполняется на устройстве</small>
  </div>
  <span className="wt-privacy-dot" aria-hidden="true"/>
</div>}
  searchAction={()=>navigate('people')}
  title={heading}
  kicker={kicker}
  version="7.6.2"
  mobileItems={([['home','Главная'],['social','Сеть'],['chat','Чаты'],['work','Работа'],['profile','Профиль']] as [Tab,string][]).map(([id,label])=>({id,label,icon:<Icon name={id}/> }))}
  mobileMore={<button className={mobileMenuOpen||['people','communities','calendar','pay','absence','friends','notifications','settings','admin'].includes(tab)?'active':''} onClick={()=>setMobileMenuOpen(v=>!v)} aria-expanded={mobileMenuOpen} aria-label="Все разделы"><Icon name="settings"/><span>Ещё</span></button>}
>
 <div className={`wt-page-content ${tab==='chat'?'wt-page-chat':''}`}>
 <div className="tab-stage" key={tab}>
 {tab==='home'&&<HomeView state={state} patch={patch} onNotice={setNotice} go={navigate}/>}
 {tab==='social'&&<NetworkView token={state.directoryToken} profile={state.profile} onNotice={setNotice} onChat={openChat} onProfile={openProfile} initialArea="feed" initialGroupSlug={cleanRoute.match(/^\/community\/([^/]+)/)?.[1]}/>} {tab==='people'&&<NetworkView token={state.directoryToken} profile={state.profile} onNotice={setNotice} onChat={openChat} onProfile={openProfile} initialArea="people"/>} {tab==='communities'&&<NetworkView token={state.directoryToken} profile={state.profile} onNotice={setNotice} onChat={openChat} onProfile={openProfile} initialArea="groups"/>}
 {tab==='work'&&<WorkHubView state={state} calc={calc} view={view} onNetwork={()=>navigate('social')} onNavigate={next=>navigate(next)} token={state.directoryToken} onNotice={setNotice}/>}{tab==='calendar'&&<CalendarView state={state} view={view} days={monthDays} calc={calc} shiftMonth={n=>setView(new Date(view.getFullYear(),view.getMonth()+n,1))} onPay={()=>navigate('pay')} onAbsence={()=>navigate('absence')} onEdit={setEditorDate}/>}
 {tab==='pay'&&<PayView state={state} calc={calc} keyMonth={key} payment={payment} setAdvance={setAdvance} goMonth={n=>setView(new Date(view.getFullYear(),view.getMonth()+n,1))} goYear={n=>setView(new Date(view.getFullYear()+n,view.getMonth(),1))}/>} 
 {tab==='absence'&&<AbsenceView state={state} vac={vac} sick={sick} setVac={setVac} setSick={setSick} addPeriod={addPeriod} removePeriod={removePeriod}/>}
 {tab==='friends'&&<FriendsView state={state} setState={setState} onNotice={setNotice} onOpenChat={openChat} onProfile={openProfile}/>}
 {tab==='notifications'&&<NotificationsView token={state.directoryToken} onNotice={setNotice} onOpen={openNotification}/>}
 {tab==='chat'&&<ChatsHub token={state.directoryToken} profile={state.profile} state={state} onStateChange={patch} onNotice={setNotice} onProfile={openProfile} routePath={cleanRoute}/>}
 {tab==='profile'&&<ProfileView state={state} setState={setState} token={state.directoryToken} onNotice={setNotice} onSettings={()=>navigate('settings')}/>} 
 {tab==='admin'&&isAdminProfile(state.profile)&&<AdminView token={state.directoryToken} onNotice={setNotice}/>}
 {tab==='settings'&&<SettingsView state={state} patch={patch} exportData={exportData} importData={importData} importNotes={importNotes} exportAllNotes={exportAllNotes} reopenSetup={()=>patch({setupComplete:false})} onNotice={setNotice} isAdmin={isAdminProfile(state.profile)}/>} 
 </div>
 <NotificationToasts token={state.directoryToken} onOpen={openNotification}/>
 {editorDate&&<ShiftEditor state={state} date={editorDate} setState={setState} close={()=>setEditorDate(null)} onNotice={setNotice}/>} {notice&&<button className="toast" onClick={()=>setNotice('')}>{notice}<span aria-hidden="true"><Icon name="close" size={14}/></span></button>}</div>
</AppShell>{mobileMenuOpen&&<div className="mobile-menu-backdrop" role="presentation" onMouseDown={e=>{if(e.currentTarget===e.target)setMobileMenuOpen(false)}}><section className="mobile-menu-sheet" role="dialog" aria-modal="true" aria-labelledby="mobile-menu-title"><div className="mobile-menu-handle"/><div className="mobile-menu-head"><div><span className="eyebrow">WTinker</span><h2 id="mobile-menu-title">Все разделы</h2></div><button type="button" className="mobile-menu-close" onClick={()=>setMobileMenuOpen(false)} aria-label="Закрыть"><Icon name="close" size={16}/></button></div><div className="mobile-menu-grid">{navItems.map(([id,label,sub])=><button key={id} className={tab===id?'active':''} onClick={()=>navigate(id)}><i><Icon name={id}/></i><span><b>{label}</b><small>{sub}</small></span></button>)}</div></section></div>}{viewedProfile&&<ProfileModal profile={viewedProfile} onClose={()=>setViewedProfile(null)} onNotice={setNotice} onChat={()=>{setViewedProfile(null);openChat(viewedProfile.profileId)}}/>}{usernameGate&&<div className="modal-backdrop"><div className="modal-card username-modal"><span className="eyebrow">Ваш публичный адрес</span><h2>Создайте username</h2><p>Он нужен для профиля и ссылки вида <b>/WorkerTink/user/username</b>. Его можно изменить позже.</p><input autoFocus value={usernameDraft} onChange={e=>setUsernameDraft(e.target.value.replace(/[^A-Za-z0-9_]/g,''))} placeholder="WTinker" maxLength={32}/><small>3–32 символа · латиница, цифры и _</small><button className="btn primary" disabled={usernameBusy} onClick={()=>void saveUsername()}>{usernameBusy?'Сохраняем…':'Сохранить username'}</button></div></div>}{installBanner&&<div className="pwa-install-banner"><div><b>Установить WTinker</b><span>{installEvent?'Установите приложение на устройство для быстрого доступа и push-уведомлений.':'В Safari: Поделиться → На экран «Домой». В Chrome выберите «Установить приложение».'}</span></div><div><button className="btn primary" onClick={async()=>{if(installEvent){await installEvent.prompt();setInstallEvent(null)}setInstallBanner(false)}}>{installEvent?'Установить':'Понятно'}</button><button className="btn quiet" onClick={()=>setInstallBanner(false)}>×</button></div></div>}</>;
}

export default App;
