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

export default function AppShell({items,active,onNavigate,profile,profileAction,privacy,children,searchAction,title,kicker,version,mobileItems,mobileMore}:Props){
  const groups=[
    {label:'Сеть',ids:['home','social','people','communities','chat']},
    {label:'Работа',ids:['work','calendar','pay','absence']},
    {label:'Личное',ids:['notifications','friends','profile','settings','admin']}
  ];
  const itemById=new Map(items.map(item=>[item.id,item]));
  const renderItem=(item:NavItem)=>(
    <button key={item.id} className={active===item.id?'wt-nav-item active':'wt-nav-item'} aria-current={active===item.id?'page':undefined} onClick={()=>onNavigate(item.id)}>
      <i aria-hidden="true">{item.icon}</i>
      <span><b>{item.label}</b><small>{item.sub}</small></span>
    </button>
  );
  return <div className="wt-shell">
    <a className="wt-skip" href="#wt-main">К содержимому</a>

    <aside className="wt-sidebar">
      <button className="wt-brand" onClick={()=>onNavigate('home')} aria-label="WTinker — Главная">
        <span className="wt-brand-mark">W</span>
        <span className="wt-brand-copy"><b>WTinker</b><small>people × work</small></span>
      </button>

      <button className="wt-profile" onClick={profileAction} aria-label="Открыть профиль">
        {profile}
        <span className="wt-profile-chevron">›</span>
      </button>

      <button className="wt-search-mini" onClick={searchAction} aria-label="Открыть поиск">
        <span>⌕</span><b>Поиск</b><kbd>⌘ K</kbd>
      </button>

      <nav className="wt-nav" aria-label="Основная навигация">
        {groups.map(group=><div className="wt-nav-group" key={group.label}>
          <span className="wt-nav-label">{group.label}</span>
          {group.ids.map(id=>{const item=itemById.get(id);return item?renderItem(item):null})}
        </div>)}
      </nav>

      <div className="wt-sidebar-bottom">
        <div className="wt-privacy">{privacy}</div>
        <span className="wt-version">WTinker {version}</span>
      </div>
    </aside>

    <main id="wt-main" className="wt-main">
      <header className="wt-topbar">
        <div className="wt-context">
          <span>{kicker}</span>
          <h1>{title}</h1>
        </div>
        <div className="wt-topbar-actions">
          <button className="wt-command-search" onClick={searchAction} aria-label="Поиск">
            <span>⌕</span><span>Поиск людей, публикаций, сообществ и работы…</span><kbd>⌘ K</kbd>
          </button>
          <button className="wt-top-icon" onClick={()=>onNavigate('notifications')} aria-label="Уведомления">◌</button>
          <button className="wt-top-avatar" onClick={profileAction} aria-label="Профиль">{profile}</button>
        </div>
      </header>

      <div className="wt-content">
        <div className="wt-content-inner">{children}</div>
      </div>
    </main>

    <nav className="wt-mobile-nav" aria-label="Мобильная навигация">
      {mobileItems.map(item=><button key={item.id} className={active===item.id?'active':''} onClick={()=>onNavigate(item.id)}>{item.icon}<span>{item.label}</span></button>)}
      {mobileMore}
    </nav>
  </div>;
}
