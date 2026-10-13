import {useEffect,type ReactNode} from 'react';
import {Icon} from './Icon';

type NavItem = {id:string;label:string;sub:string;icon:ReactNode};
type Props = {
 items:NavItem[];active:string;onNavigate:(id:string)=>void;
 profile:ReactNode;profileAction:()=>void;privacy:ReactNode;children:ReactNode;
 searchAction:()=>void;title:string;kicker:string;version:string;
 mobileItems:{id:string;label:string;icon:ReactNode}[];mobileMore:ReactNode;
};

const navSections=[
 {label:'Общение',number:'01',ids:['home','social','people','communities','chat']},
 {label:'Моя работа',number:'02',ids:['work','calendar','pay','absence']},
 {label:'Личное',number:'03',ids:['notifications','friends','profile','settings','admin']}
] as const;

export default function AppShell({items,active,onNavigate,profile,profileAction,privacy,children,searchAction,title,kicker,version,mobileItems,mobileMore}:Props){
 const byId=new Map(items.map(item=>[item.id,item]));
 const activeGroup=navSections.find(section=>(section.ids as readonly string[]).includes(active));
 useEffect(()=>{
  const listener=(event:KeyboardEvent)=>{
   if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
    event.preventDefault();searchAction();
   }
  };
  document.addEventListener('keydown',listener);
  return()=>document.removeEventListener('keydown',listener);
 },[searchAction]);
 const itemButton=(item:NavItem)=><button key={item.id} type="button" className={`wt-nav-item${active===item.id?' active':''}`} aria-current={active===item.id?'page':undefined} title={item.sub} onClick={()=>onNavigate(item.id)}>
  <span className="wt-nav-icon" aria-hidden="true">{item.icon}</span><span className="wt-nav-copy">{item.label}</span>
 </button>;
 return <div className="wt-shell wt-shell-v8">
  <a className="wt-skip" href="#wt-main">Перейти к содержимому</a>
  <header className="wt-masthead">
   <div className="wt-masthead-row">
    <button className="wt-brand-lockup" type="button" onClick={()=>onNavigate('home')} aria-label="WTinker — главная">
     <span className="wt-brand-mark" aria-hidden="true"><span>W</span><i/></span>
     <span className="wt-brand-identity"><span className="wt-brand-word">WTinker<span className="wt-brand-period">.</span></span><small>ЛЮДИ × РАБОТА</small></span>
    </button>
    <div className="wt-masthead-trail">
     <span className="wt-live-label"><span className="wt-live-indicator"/> На связи с работой</span>
     <button type="button" className="wt-command-search" onClick={searchAction} aria-label="Поиск по WTinker"><Icon name="search" size={19}/><span>Найти человека или сообщество</span><kbd>Ctrl K</kbd></button>
     <button type="button" className="wt-top-icon" onClick={()=>onNavigate('notifications')} aria-label="Открыть уведомления"><Icon name="bell" size={19}/></button>
     <button type="button" className="wt-top-avatar" onClick={profileAction} aria-label="Открыть профиль">{profile}</button>
    </div>
   </div>
   <nav className="wt-nav wt-nav-horizontal" aria-label="Основные разделы">
    <div className="wt-nav-track">
     {navSections.map(section=><div key={section.label} className="wt-nav-group"><span className="wt-nav-label"><em>{section.number}</em> {section.label}</span><div className="wt-nav-items">{section.ids.map(id=>{const item=byId.get(id);return item?itemButton(item):null})}</div></div>)}
    </div>
   </nav>
  </header>
  <main className="wt-main" id="wt-main">
   <div className="wt-viewhead"><div className="wt-viewhead-copy"><span className="wt-viewhead-kicker"><span>{activeGroup?.label||'WTinker'}</span><span aria-hidden="true">/</span>{kicker}</span><h1>{title}</h1></div><div className="wt-viewhead-side"><span className="wt-viewhead-edition">WT / ПРОСТРАНСТВО</span><button type="button" onClick={()=>onNavigate('social')} className="wt-viewhead-compose"><Icon name="plus" size={17}/> Новая публикация</button></div></div>
   <div className="wt-content"><div className="wt-content-inner"><div className="wt-page-frame">{children}</div></div></div>
   <footer className="wt-shell-footer"><span>WTinker / работа и связи</span><span>{privacy}</span><span>Версия {version}</span></footer>
  </main>
  <nav className="wt-mobile-nav" aria-label="Быстрая мобильная навигация">
   {mobileItems.map(item=><button key={item.id} type="button" className={active===item.id?'active':''} aria-current={active===item.id?'page':undefined} onClick={()=>onNavigate(item.id)}>{item.icon}<span>{item.label}</span></button>)}
   {mobileMore}
  </nav>
 </div>;
}
