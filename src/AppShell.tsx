import {useEffect,type ReactNode} from 'react';
import {Icon} from './Icon';

type NavItem={id:string;label:string;sub:string;icon:ReactNode};
type Props={
 items:NavItem[];active:string;onNavigate:(id:string)=>void;
 profile:ReactNode;profileAction:()=>void;privacy:ReactNode;children:ReactNode;
 searchAction:()=>void;title:string;kicker:string;version:string;
 mobileItems:{id:string;label:string;icon:ReactNode}[];mobileMore:ReactNode;
};
const clusters=[
 {name:'Сообщество',ids:['home','social','people','communities','chat']},
 {name:'Рабочие инструменты',ids:['work','calendar','pay','absence']},
 {name:'Личное',ids:['notifications','friends','profile','settings','admin']}
] as const;
const dock=['home','social','chat','work','profile'];
const contexts:Record<string,{eyebrow:string;title:string;description:string;shortcuts:string[]}>={
 home:{eyebrow:'ОБЗОР',title:'Мой день',description:'Смены, деньги и важные события на сегодня.',shortcuts:['calendar','pay','social']},
 social:{eyebrow:'СЕТЬ',title:'Общение',description:'Истории, идеи и новости вашей рабочей среды.',shortcuts:['people','communities','chat']},
 people:{eyebrow:'СЕТЬ',title:'Коллеги',description:'Найдите человека по имени, username или WTinkID.',shortcuts:['social','friends','chat']},
 communities:{eyebrow:'СЕТЬ',title:'Сообщества',description:'Объединяйтесь с людьми по общим интересам.',shortcuts:['social','people','chat']},
 chat:{eyebrow:'СВЯЗЬ',title:'Диалоги',description:'Личные беседы, группы и каналы.',shortcuts:['people','communities','social']},
 work:{eyebrow:'РАБОТА',title:'Диспетчерская',description:'Смены, выплаты, отдых и рабочие записи.',shortcuts:['calendar','pay','absence']},
 calendar:{eyebrow:'РАБОТА',title:'Мой график',description:'Вся последовательность смен и заметок.',shortcuts:['work','pay','absence']},
 pay:{eyebrow:'ФИНАНСЫ',title:'Мои деньги',description:'Расчёты, аванс, остаток и годовая история.',shortcuts:['work','calendar','absence']},
 absence:{eyebrow:'РАБОТА',title:'Отдых',description:'Отпускные дни, больничные и периоды.',shortcuts:['calendar','pay','work']}
};
export default function AppShell({items,active,onNavigate,profile,profileAction,privacy,children,searchAction,title,kicker,version,mobileItems,mobileMore}:Props){
 const byId=new Map(items.map(item=>[item.id,item]));
 const context=contexts[active]||{eyebrow:'ЛИЧНОЕ',title:'Аккаунт',description:'Ваши контакты, история и параметры.',shortcuts:['home','notifications','settings']};
 const go=(id:string)=>onNavigate(id);
 useEffect(()=>{
  const onKey=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();searchAction()}};
  document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey);
 },[searchAction]);
 const link=(item:NavItem,compact=false)=><button type="button" key={item.id} title={item.sub} className={`wt-os-link${active===item.id?' is-current':''}${compact?' is-shortcut':''}`} onClick={()=>go(item.id)} aria-current={active===item.id?'page':undefined}><span className="wt-os-link-symbol">{item.icon}</span><span>{item.label}</span>{!compact&&active===item.id&&<span className="wt-os-link-indicator" aria-hidden="true"/>}</button>;
 return <div className="wt-os-shell">
  <a className="wt-skip" href="#wt-main">Перейти к содержимому</a>
  <aside className="wt-os-dock" aria-label="Быстрый переход">
   <button className="wt-os-monogram" onClick={()=>go('home')} aria-label="WTinker — главная">wt<span>.</span></button>
   <div className="wt-os-dock-rule"/>
   <nav className="wt-os-dock-links" aria-label="Избранные разделы">{dock.map(id=>{const item=byId.get(id);return item?<button key={id} title={item.label} aria-label={item.label} aria-current={active===id?'page':undefined} className={active===id?'is-current':''} onClick={()=>go(id)}>{item.icon}</button>:null})}</nav>
   <div className="wt-os-dock-bottom">
    <button title="Уведомления" aria-label="Уведомления" onClick={()=>go('notifications')}><Icon name="bell" size={21}/></button>
    <button title="Настройки" aria-label="Настройки" onClick={()=>go('settings')}><Icon name="settings" size={21}/></button>
   </div>
  </aside>
  <aside className="wt-os-directory" aria-label="Навигация приложения">
   <div className="wt-os-directory-header"><span className="wt-os-stamp">W/T — ПЛАТФОРМА ДЛЯ РАБОТЫ</span><h2>{context.title}<span>.</span></h2><p>{context.description}</p></div>
   <button className="wt-os-search-button" type="button" onClick={searchAction}><Icon name="search" size={17}/><span>Найти в WTinker</span><kbd>⌘ K</kbd></button>
   <nav className="wt-os-sections" aria-label="Все разделы">{clusters.map((c,i)=><div className="wt-os-section" key={c.name}><div className="wt-os-section-title"><span>{String(i+1).padStart(2,'0')}</span>{c.name}</div>{c.ids.map(id=>{const item=byId.get(id);return item?link(item):null})}</div>)}</nav>
   <div className="wt-os-directory-account"><button type="button" onClick={profileAction}>{profile}</button><span className="wt-os-account-caption">Личное пространство</span></div>
  </aside>
  <main className="wt-os-main" id="wt-main">
   <header className="wt-os-toolbar"><div className="wt-os-toolbar-breadcrumb"><span>WTINKER</span><span aria-hidden="true">/</span><span>{context.eyebrow}</span><span aria-hidden="true">/</span><strong>{title}</strong></div><div className="wt-os-toolbar-actions"><span className="wt-os-local-time">{new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'})}</span><button onClick={searchAction} type="button" aria-label="Поиск" className="wt-os-action"><Icon name="search" size={19}/></button><button onClick={()=>go('notifications')} type="button" aria-label="Уведомления" className="wt-os-action"><Icon name="bell" size={19}/></button><button onClick={profileAction} type="button" aria-label="Профиль" className="wt-os-toolbar-avatar">{profile}</button></div></header>
   <div className="wt-os-stage">
    <div className="wt-os-chapter"><div><span className="wt-os-chapter-kicker">{kicker}</span><h1>{title}</h1></div><nav className="wt-os-shortcuts" aria-label="Связанные разделы">{context.shortcuts.map(id=>{const item=byId.get(id);return item?link(item,true):null})}</nav></div>
    <div className="wt-os-render">{children}</div>
   </div>
   <footer className="wt-os-foot"><span>WTINKER / {version}</span><span>{privacy}</span><span>ВАШЕ РАБОЧЕЕ ПРОСТРАНСТВО</span></footer>
  </main>
  <nav className="wt-os-mobile-dock" aria-label="Быстрая мобильная навигация">
   {mobileItems.map(item=><button key={item.id} type="button" className={active===item.id?'is-current':''} aria-current={active===item.id?'page':undefined} onClick={()=>go(item.id)}>{item.icon}<span>{item.label}</span></button>)}
   {mobileMore}
  </nav>
 </div>;
}
