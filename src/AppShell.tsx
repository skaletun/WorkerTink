import {useEffect,useState,type ReactNode} from 'react';
import {Icon} from './Icon';

type NavItem={id:string;label:string;sub:string;icon:ReactNode};
type Props={items:NavItem[];active:string;onNavigate:(id:string)=>void;profile:ReactNode;profileAction:()=>void;privacy:ReactNode;children:ReactNode;searchAction:()=>void;title:string;kicker:string;version:string;mobileItems:{id:string;label:string;icon:ReactNode}[];mobileMore:ReactNode};
const sets=[
 {id:'live',title:'01 / МОЙ ДЕНЬ',message:'Личное пространство',list:['home','calendar','work','pay','absence']},
 {id:'world',title:'02 / ЛЮДИ И СВЯЗЬ',message:'Коллеги и общение',list:['social','people','communities','chat','friends']},
 {id:'identity',title:'03 / МОЙ ПРОФИЛЬ',message:'Профиль и управление',list:['notifications','profile','settings','admin']}
];
const spaces=['home','social','calendar','pay','chat'];
export default function AppShell({items,active,onNavigate,profile,profileAction,privacy,children,searchAction,title,kicker,version,mobileItems,mobileMore}:Props){
 const [launcher,setLauncher]=useState(false);
 const map=new Map(items.map(i=>[i.id,i]));
 const navigate=(id:string)=>{setLauncher(false);onNavigate(id)};
 useEffect(()=>{
  const listener=(e:KeyboardEvent)=>{
   if(e.key==='Escape')setLauncher(false);
   if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();searchAction()}
   if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='b'){e.preventDefault();setLauncher(v=>!v)}
  };
  window.addEventListener('keydown',listener);return()=>window.removeEventListener('keydown',listener);
 },[searchAction]);
 useEffect(()=>{setLauncher(false)},[active]);
 return <div className="atlas-app">
  <a href="#wt-main" className="atlas-skip">Перейти к содержимому</a>
  <header className="atlas-bar">
   <button className="atlas-wordmark" type="button" onClick={()=>navigate('home')} aria-label="WTinker — главная"><span className="atlas-asterisk"><img src="./icon-256.png" alt="" /></span><strong>WTINKER</strong><span className="atlas-wordmark-n">/ SPACE</span></button>
   <div className="atlas-bar-locations"><span>РАЗДЕЛ</span><span className="atlas-path-separator">→</span><strong>{title}</strong></div>
   <div className="atlas-bar-actions"><button onClick={searchAction} aria-label="Найти людей" title="Поиск" type="button"><Icon name="search" size={18}/></button><button onClick={()=>navigate('notifications')} title="Уведомления" aria-label="Уведомления" type="button"><Icon name="bell" size={18}/></button><button onClick={profileAction} className="atlas-user" title="Профиль" type="button" aria-label="Открыть профиль">{profile}</button></div>
  </header>
  <main id="wt-main" className="atlas-main">
   <div className="atlas-route-stage" key={active}>
    {active!=='home'&&<div className="atlas-route-ticket"><span><i/>РАЗДЕЛ / {kicker.toUpperCase()}</span><button onClick={()=>setLauncher(true)}><Icon name="more" size={15}/> СМЕНИТЬ РАЗДЕЛ</button></div>}
    <div className="atlas-route-content">{children}</div>
   </div>
  </main>
  <footer className="atlas-footer"><span>WTINKER / <strong>{version}</strong></span><span>{privacy}</span><button onClick={()=>setLauncher(true)}>Карта приложения <Icon name="externalLink" size={15}/></button></footer>
  <nav className="atlas-tray" aria-label="Быстрая навигация">
   {spaces.map(id=>{const item=map.get(id);return item?<button key={id} type="button" onClick={()=>navigate(id)} aria-label={item.label} aria-current={active===id?'page':undefined} className={active===id?'is-on':''} title={item.label}><span>{item.icon}</span><small>{item.label}</small></button>:null})}
   <button className="atlas-tray-launcher" type="button" onClick={()=>setLauncher(v=>!v)} aria-expanded={launcher} aria-label="Все разделы"><Icon name={launcher?'close':'more'} size={24}/><small>Все</small></button>
  </nav>
  {launcher&&<div className="atlas-launcher-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setLauncher(false)}}>
   <section className="atlas-launcher" role="dialog" aria-modal="true" aria-label="Карта пространств">
    <header className="atlas-launcher-header"><div><span>НАВИГАЦИЯ</span><h2>Все разделы</h2></div><button onClick={()=>setLauncher(false)} type="button" aria-label="Закрыть меню"><Icon name="close" size={22}/></button></header>
    <div className="atlas-launcher-groups">{sets.map((set,j)=><section key={set.id} className="atlas-launcher-group"><div className="atlas-launcher-group-head"><span>{set.title}</span><small>{set.message}</small></div><div className="atlas-launcher-items">{set.list.map((id,n)=>{const item=map.get(id);return item?<button onClick={()=>navigate(id)} key={id} className={active===id?'is-active':''}><span className="atlas-launcher-item-icon">{item.icon}</span><span className="atlas-launcher-item-copy"><strong>{item.label}</strong><small>{item.sub}</small></span><span className="atlas-launcher-item-number">{String(j*5+n+1).padStart(2,'0')}</span></button>:null})}</div></section>)}</div>
    <div className="atlas-launcher-foot"><span>WTINKER · 8.1.0</span><span>ESC — закрыть</span></div>
   </section>
  </div>}
 </div>;
}
