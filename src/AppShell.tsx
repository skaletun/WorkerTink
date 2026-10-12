import type {ReactNode} from 'react';
import {Icon} from './Icon';

type NavItem={id:string;label:string;sub:string;icon:ReactNode};
type Props={
  items:NavItem[]; active:string; onNavigate:(id:string)=>void;
  profile:ReactNode; profileAction:()=>void; privacy:ReactNode; children:ReactNode;
  searchAction:()=>void; title:string; kicker:string; version:string;
  mobileItems:{id:string;label:string;icon:ReactNode}[]; mobileMore:ReactNode;
};

const groups=[
  {label:'ТВОЯ СЕТЬ',ids:['home','social','people','communities','chat']},
  {label:'РАБОЧЕЕ',ids:['work','calendar','pay','absence']},
  {label:'АККАУНТ',ids:['notifications','friends','profile','settings','admin']}
];

export default function AppShell({items,active,onNavigate,profile,profileAction,privacy,children,searchAction,title,kicker,version,mobileItems,mobileMore}:Props){
  const byId=new Map(items.map(item=>[item.id,item]));
  const nav=(item:NavItem)=>(
    <button key={item.id} className={active===item.id?'wt-nav-item active':'wt-nav-item'}
      aria-current={active===item.id?'page':undefined} onClick={()=>onNavigate(item.id)}>
      <span className="wt-nav-icon" aria-hidden="true">{item.icon}</span>
      <span className="wt-nav-copy"><b>{item.label}</b></span>
    </button>
  );

  return <div className="wt-shell">
    <a className="wt-skip" href="#wt-main">К содержимому</a>
    <aside className="wt-sidebar" aria-label="Навигация WTinker">
      <button className="wt-brand-lockup" onClick={()=>onNavigate('home')} aria-label="WTinker — Главная">
        <span className="wt-brand-mark">w</span><span className="wt-brand-word">wtinker<span className="wt-brand-period">.</span></span>
      </button>
      <button className="wt-search-mini" onClick={searchAction} aria-label="Найти людей и публикации">
        <Icon name="search" size={17}/><span>Поиск по сети</span><kbd>⌘ K</kbd>
      </button>
      <nav className="wt-nav" aria-label="Основная навигация">
        {groups.map(group=><section className="wt-nav-group" key={group.label}>
          <span className="wt-nav-label">{group.label}</span>
          {group.ids.map(id=>{const item=byId.get(id);return item?nav(item):null})}
        </section>)}
      </nav>
      <button className="wt-compose-button" onClick={()=>onNavigate('social')}><Icon name="plus" size={17}/><span>Новая публикация</span></button>
      <div className="wt-sidebar-footer">
        {privacy}
        <button className="wt-profile" onClick={profileAction} aria-label="Открыть профиль">{profile}<span className="wt-profile-caption">Мой профиль <span aria-hidden="true">↗</span></span></button>
        <span className="wt-version">WTinker {version}</span>
      </div>
    </aside>
    <main id="wt-main" className="wt-main">
      <header className="wt-topbar">
        <div className="wt-context"><span className="wt-context-kicker">{kicker}</span><h1>{title}</h1></div>
        <div className="wt-topbar-actions">
          <button className="wt-command-search" onClick={searchAction} aria-label="Найти людей, публикации, сообщества и работу">
            <Icon name="search" size={17}/><span>Люди, публикации, сообщества…</span><kbd>Ctrl K</kbd>
          </button>
          <button className="wt-top-icon" onClick={()=>onNavigate('notifications')} aria-label="Уведомления"><Icon name="bell" size={19}/></button>
          <button className="wt-top-avatar" onClick={profileAction} aria-label="Профиль">{profile}</button>
        </div>
      </header>
      <div className="wt-content"><div className="wt-content-inner"><div className="wt-page-frame">{children}</div></div></div>
    </main>
    <nav className="wt-mobile-nav" aria-label="Мобильная навигация">
      {mobileItems.map(item=><button key={item.id} className={active===item.id?'active':''} onClick={()=>onNavigate(item.id)} aria-current={active===item.id?'page':undefined}>{item.icon}<span>{item.label}</span></button>)}
      {mobileMore}
    </nav>
  </div>;
}
