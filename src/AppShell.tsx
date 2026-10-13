import {useEffect,useState,type ReactNode} from 'react';
import {Icon} from './Icon';
import AnimatedContent from './components/react-bits/AnimatedContent';

type NavItem = {id:string;label:string;sub:string;icon:ReactNode};
type Props = {
 items:NavItem[];active:string;onNavigate:(id:string)=>void;
 profile:ReactNode;profileAction:()=>void;privacy:ReactNode;children:ReactNode;
 searchAction:()=>void;title:string;kicker:string;version:string;
 mobileItems:{id:string;label:string;icon:ReactNode}[];mobileMore:ReactNode;
};

const navSections=[
 {label:'Пространство',ids:['home','social','people','communities','chat']},
 {label:'Работа',ids:['work','calendar','pay','absence']},
 {label:'Аккаунт',ids:['notifications','friends','profile','settings','admin']}
] as const;

function useReducedMotion(){
 const [reduced,setReduced]=useState(()=>typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{const query=window.matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(query.matches);query.addEventListener('change',update);return()=>query.removeEventListener('change',update)},[]);
 return reduced;
}

export default function AppShell({items,active,onNavigate,profile,profileAction,privacy,children,searchAction,title,kicker,version,mobileItems,mobileMore}:Props){
 const reduced=useReducedMotion();
 const byId=new Map(items.map(item=>[item.id,item]));
 useEffect(()=>{
  const listener=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();searchAction()}};
  document.addEventListener('keydown',listener);
  return()=>document.removeEventListener('keydown',listener);
 },[searchAction]);
 const itemButton=(item:NavItem)=><button key={item.id} type="button" className={`wt-nav-item${active===item.id?' active':''}`} aria-current={active===item.id?'page':undefined} onClick={()=>onNavigate(item.id)}>
  <span className="wt-nav-icon">{item.icon}</span><span className="wt-nav-copy">{item.label}</span>
 </button>;
 const sectionTitle=<div className="wt-context" key={active}><span className="wt-context-kicker">{kicker}</span><h1>{title}</h1></div>;
 return <div className="wt-shell">
  <a className="wt-skip" href="#wt-main">Перейти к содержимому</a>
  <aside className="wt-sidebar">
   <button className="wt-brand-lockup" type="button" onClick={()=>onNavigate('home')} aria-label="WTinker — главная"><span className="wt-brand-mark" aria-hidden="true">w</span><span className="wt-brand-word">wtinker<span className="wt-brand-period">.</span></span></button>
   <nav className="wt-nav" aria-label="Основная навигация">
    {navSections.map(section=><div key={section.label} className="wt-nav-group"><span className="wt-nav-label">{section.label}</span>{section.ids.map(id=>{const item=byId.get(id);return item?itemButton(item):null})}</div>)}
   </nav>
   <button className="wt-compose-button" type="button" onClick={()=>onNavigate('social')}><span aria-hidden="true" className="wt-compose-plus">+</span><span>Написать в ленту</span></button>
   <div className="wt-sidebar-footer">
    <button className="wt-profile" onClick={profileAction} type="button" aria-label="Открыть профиль">{profile}</button>
    <div className="wt-private-meta">{privacy}<span className="wt-version">WTinker · {version}</span></div>
   </div>
  </aside>
  <main className="wt-main" id="wt-main">
   <header className="wt-topbar">
    <div className="wt-mobile-brand"><span className="wt-brand-mark">w</span><span className="wt-brand-word">wtinker<span className="wt-brand-period">.</span></span></div>
    {reduced?sectionTitle:<AnimatedContent key={active} distance={12} duration={0.24} threshold={0} animateOpacity={true} initialOpacity={0} className="wt-heading-motion">{sectionTitle}</AnimatedContent>}
    <div className="wt-topbar-actions">
     <button type="button" className="wt-command-search" onClick={searchAction} aria-label="Поиск по WTinker"><Icon name="search" size={18}/><span>Поиск в сети</span><kbd>⌘ K</kbd></button>
     <button type="button" className="wt-top-icon" onClick={()=>onNavigate('notifications')} aria-label="Открыть уведомления"><Icon name="bell" size={20}/></button>
     <button type="button" className="wt-top-avatar" onClick={profileAction} aria-label="Открыть профиль">{profile}</button>
    </div>
   </header>
   <div className="wt-content">
    <div className="wt-content-inner"><div className="wt-page-frame">{children}</div></div>
   </div>
  </main>
  <nav className="wt-mobile-nav" aria-label="Быстрая мобильная навигация">
   {mobileItems.map(item=><button key={item.id} type="button" className={active===item.id?'active':''} aria-current={active===item.id?'page':undefined} onClick={()=>onNavigate(item.id)}>{item.icon}<span>{item.label}</span></button>)}
   {mobileMore}
  </nav>
 </div>;
}
