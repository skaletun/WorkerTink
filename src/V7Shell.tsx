import type {ReactNode} from 'react';

type NavItem={id:string;label:string;sub:string;icon:ReactNode};
type Props={
  items:NavItem[];
  active:string;
  onNavigate:(id:string)=>void;
  profile:ReactNode;
  profileAction:()=>void;
  privacy:ReactNode;
  children:ReactNode;
  searchAction:()=>void;
  title:string;
  kicker:string;
  version:string;
  mobileItems:{id:string;label:string;icon:ReactNode}[];
  mobileMore:ReactNode;
};

export default function V7Shell({items,active,onNavigate,profile,profileAction,privacy,children,searchAction,title,kicker,version,mobileItems,mobileMore}:Props){
  const groups=[
    {label:'Основное',ids:['home','social','people','communities','chat']},
    {label:'Работа',ids:['work','calendar','pay','absence']},
    {label:'Аккаунт',ids:['friends','notifications','profile','settings','admin']}
  ];
  const renderItem=(item:NavItem)=><button key={item.id} className={active===item.id?'active':''} aria-current={active===item.id?'page':undefined} onClick={()=>onNavigate(item.id)}>
    <i aria-hidden="true">{item.icon}</i><span><b>{item.label}</b><small>{item.sub}</small></span>
  </button>;
  return <div className="v7-shell">
    <a className="v7-skip" href="#v7-main">К содержимому</a>
    <aside className="v7-sidebar">
      <button className="v7-brand" onClick={()=>onNavigate('home')} aria-label="WorkerTink — Главная">
        <span className="v7-brand-mark">W</span>
        <span className="v7-brand-copy"><b>WorkerTink</b><small>work · people · life</small></span>
        <em>{version}</em>
      </button>
      <button className="v7-profile" onClick={profileAction} aria-label="Открыть профиль">{profile}</button>
      <nav className="v7-nav" aria-label="Основная навигация">
        {groups.map(group=><div className="v7-nav-group" key={group.label}>
          <span className="v7-nav-label">{group.label}</span>
          {group.ids.map(id=>{const item=items.find(x=>x.id===id);return item?renderItem(item):null})}
        </div>)}
      </nav>
      <div className="v7-sidebar-bottom">{privacy}<span className="v7-version">WorkerTink {version}</span></div>
    </aside>
    <main id="v7-main" className="v7-main">
      <header className="v7-topbar">
        <div className="v7-context"><span>{kicker}</span><strong>{title}</strong></div>
        <button className="v7-global-search" onClick={searchAction} aria-label="Глобальный поиск">
          <span className="v7-search-icon" aria-hidden="true">⌕</span>
          <span>Поиск людей, публикаций, сообществ…</span>
          <kbd>⌘ K</kbd>
        </button>
        <div className="v7-top-actions">
          <button className="v7-icon-button" onClick={()=>onNavigate('notifications')} aria-label="Уведомления">○</button>
          <button className="v7-icon-button" onClick={()=>onNavigate('settings')} aria-label="Настройки">⚙</button>
        </div>
      </header>
      <div className="v7-content">{children}</div>
    </main>
    <nav className="v7-mobile-nav" aria-label="Мобильная навигация">
      {mobileItems.map(item=><button key={item.id} className={active===item.id?'active':''} onClick={()=>onNavigate(item.id)}>{item.icon}<span>{item.label}</span></button>)}
      {mobileMore}
    </nav>
  </div>;
}
