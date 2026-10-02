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
  {label:'Сеть',ids:['home','social','people','communities','chat']},
  {label:'Работа',ids:['work','calendar','pay','absence']},
  {label:'Личное',ids:['notifications','friends','profile','settings','admin']}
];

export default function AppShell({items,active,onNavigate,profile,profileAction,privacy,children,searchAction,title,kicker,version,mobileItems,mobileMore}:Props){
  const byId=new Map(items.map(item=>[item.id,item]));
  const nav=(item:NavItem)=>(
    <button key={item.id} className={active===item.id?'wt-nav-item active':'wt-nav-item'}
      aria-current={active===item.id?'page':undefined} onClick={()=>onNavigate(item.id)}>
      <span className="wt-nav-icon" aria-hidden="true">{item.icon}</span>
      <span className="wt-nav-copy"><b>{item.label}</b><small>{item.sub}</small></span>
    </button>
  );

  return <div className="wt-shell">
    <a className="wt-skip" href="#wt-main">К содержимому</a>

    <aside className="wt-sidebar" aria-label="WTinker">
      <button className="wt-brand" onClick={()=>onNavigate('home')} aria-label="WTinker — Главная">
        <span className="wt-brand-mark" aria-hidden="true">W</span>
        <span className="wt-brand-word">WTinker</span>
      </button>

      <div className="wt-sidebar-user">
        <button className="wt-profile" onClick={profileAction} aria-label="Открыть профиль">{profile}</button>
      </div>

      <button className="wt-search-mini" onClick={searchAction} aria-label="Открыть поиск">
        <Icon name="search" size={17}/><span>Поиск</span><kbd>Ctrl K</kbd>
      </button>

      <nav className="wt-nav" aria-label="Основная навигация">
        {groups.map(group=><section className="wt-nav-group" key={group.label}>
          <span className="wt-nav-label">{group.label}</span>
          {group.ids.map(id=>{const item=byId.get(id);return item?nav(item):null})}
        </section>)}
      </nav>

      <div className="wt-sidebar-footer">
        {privacy}
        <span>WTinker {version}</span>
      </div>
    </aside>

    <main id="wt-main" className="wt-main">
      <header className="wt-topbar">
        <div className="wt-context">
          <span className="wt-context-kicker">{kicker}</span>
          <h1>{title}</h1>
        </div>
        <div className="wt-topbar-actions">
          <button className="wt-command-search" onClick={searchAction} aria-label="Поиск">
            <Icon name="search" size={17}/><span>Поиск людей, публикаций, сообществ и работы</span><kbd>Ctrl K</kbd>
          </button>
          <button className="wt-top-icon" onClick={()=>onNavigate('notifications')} aria-label="Уведомления">
            <Icon name="bell" size={18}/>
          </button>
          <button className="wt-top-avatar" onClick={profileAction} aria-label="Профиль">{profile}</button>
        </div>
      </header>

      <div className="wt-content"><div className="wt-content-inner">{children}</div></div>
    </main>

    <nav className="wt-mobile-nav" aria-label="Мобильная навигация">
      {mobileItems.map(item=><button key={item.id} className={active===item.id?'active':''}
        onClick={()=>onNavigate(item.id)} aria-current={active===item.id?'page':undefined}>
        {item.icon}<span>{item.label}</span>
      </button>)}
      {mobileMore}
    </nav>
  </div>;
}
