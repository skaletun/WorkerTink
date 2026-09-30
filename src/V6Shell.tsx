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

export default function V6Shell({items,active,onNavigate,profile,profileAction,privacy,children,searchAction,title,kicker,version,mobileItems,mobileMore}:Props){
  const primary=items.filter(x=>['home','social','people','communities','chat'].includes(x.id));
  const work=items.filter(x=>['work','calendar','pay','absence'].includes(x.id));
  const system=items.filter(x=>['friends','notifications','profile','settings','admin'].includes(x.id));
  const renderItem=(item:NavItem)=><button key={item.id} className={active===item.id?'active':''} aria-current={active===item.id?'page':undefined} onClick={()=>onNavigate(item.id)}>
    <i>{item.icon}</i><span><b>{item.label}</b><small>{item.sub}</small></span>
  </button>;
  return <div className="v6-shell">
    <aside className="v6-sidebar">
      <button className="v6-brand" onClick={()=>onNavigate('home')} aria-label="WorkerTink — Главная">
        <span className="v6-brand-mark">W</span><span className="v6-brand-copy"><b>WorkerTink</b><small>work · people · life</small></span><em>{version}</em>
      </button>
      <button className="v6-profile" onClick={profileAction}>{profile}</button>
      <nav className="v6-nav" aria-label="Основная навигация">
        <span className="v6-nav-label">Основное</span>{primary.map(renderItem)}
        <span className="v6-nav-label">Работа</span>{work.map(renderItem)}
        <span className="v6-nav-label">Аккаунт</span>{system.map(renderItem)}
      </nav>
      <div className="v6-sidebar-bottom">{privacy}<span className="v6-version">WorkerTink {version}</span></div>
    </aside>
    <main className="v6-main">
      <header className="v6-topbar">
        <div className="v6-context"><span>{kicker}</span><strong>{title}</strong></div>
        <button className="v6-global-search" onClick={searchAction} aria-label="Глобальный поиск">
          <span className="v6-search-icon">⌕</span><span>Поиск людей, публикаций, сообществ…</span><kbd>⌘ K</kbd>
        </button>
        <div className="v6-top-actions"><button className="v6-icon-button" onClick={()=>onNavigate('notifications')} aria-label="Уведомления">♢</button><button className="v6-icon-button" onClick={()=>onNavigate('settings')} aria-label="Настройки">⚙</button></div>
      </header>
      <div className="v6-content">{children}</div>
    </main>
    <nav className="v6-mobile-nav" aria-label="Мобильная навигация">
      {mobileItems.map(item=><button key={item.id} className={active===item.id?'active':''} onClick={()=>onNavigate(item.id)}>{item.icon}<span>{item.label}</span></button>)}{mobileMore}
    </nav>
  </div>;
}
