import {Icon} from './Icon';
import {useEffect,useMemo,useState} from 'react';
import {getSocialNotifications,readAllSocialNotifications,readSocialNotification,type SocialNotification} from './directory';

type Props={token:string;onNotice:(message:string)=>void;onOpen:(notification:SocialNotification)=>void};
const iconName=(kind:string)=>kind.includes('message')?'message':kind.includes('friend')?'people':kind.includes('event')?'calendar':kind.includes('channel')?'communities':kind.includes('shift')?'refresh':kind.includes('pay')?'pay':'bell';
const ago=(ts:number)=>{const d=Math.max(0,Date.now()-ts);if(d<60000)return 'только что';if(d<3600000)return `${Math.floor(d/60000)} мин назад`;if(d<86400000)return `${Math.floor(d/3600000)} ч назад`;return new Date(ts).toLocaleDateString('ru-RU',{day:'numeric',month:'short'})};
export default function NotificationsView({token,onNotice,onOpen}:Props){
 const [items,setItems]=useState<SocialNotification[]>([]);const [loading,setLoading]=useState(true);const [loadError,setLoadError]=useState(false);const [filter,setFilter]=useState<'all'|'unread'>('all');
 const load=async()=>{try{setLoading(true);setLoadError(false);const r=await getSocialNotifications(token);setItems(r.notifications)}catch{setLoadError(true);onNotice('Не удалось загрузить уведомления')}finally{setLoading(false)}};
 useEffect(()=>{void load();const timer=window.setInterval(()=>void load(),30000);return()=>window.clearInterval(timer)},[token]);
 const visible=useMemo(()=>filter==='unread'?items.filter(x=>!x.readAt):items,[items,filter]);
 const read=async(id:string)=>{try{await readSocialNotification(id,token);setItems(xs=>xs.map(x=>x.id===id?{...x,readAt:Date.now()}:x))}catch{onNotice('Не удалось отметить уведомление')}};
 const readAll=async()=>{try{await readAllSocialNotifications(token);setItems(xs=>xs.map(x=>({...x,readAt:x.readAt||Date.now()})))}catch{onNotice('Не удалось отметить уведомления')}};
 const unreadCount=items.filter(x=>!x.readAt).length;
 return <section className="canva-page canva-notifications redesign-page redesign-notifications">
  <header className="canva-page-head">
    <div><span className="canva-kicker">Notifications</span><h1>Центр событий</h1><p>Уведомления о сообщениях, заявках и рабочих изменениях собраны в одной последовательности.</p></div>
    <div className="canva-head-actions"><span className="canva-state">{unreadCount} непрочитанных</span><button className="canva-button" onClick={()=>void load()}>Обновить</button><button className="canva-button canva-button-primary" onClick={()=>void readAll()}>Прочитать всё</button></div>
  </header>
  <div className="canva-notification-layout">
    <aside className="canva-notification-sidebar">
      <button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}><span>Все уведомления</span><b>{items.length}</b></button>
      <button className={filter==='unread'?'active':''} onClick={()=>setFilter('unread')}><span>Непрочитанные</span><b>{unreadCount}</b></button>
      <div className="canva-notification-help"><span className="canva-kicker">Flow</span><b>Ничего важного не теряется</b><p>Откройте событие, чтобы перейти к связанному контексту.</p></div>
    </aside>
    <main className="canva-notification-feed">
      {loading&&!items.length?<div className="canva-feed-list"><article className="canva-post canva-skeleton-card"><div/><div/><div/></article><article className="canva-post canva-skeleton-card"><div/><div/><div/></article></div>:loadError&&!items.length?<div className="canva-error">Уведомления временно недоступны. <button onClick={()=>void load()}>Повторить</button></div>:<div className="canva-event-list">{visible.map(n=><button type="button" className={n.readAt?'canva-event':'canva-event unread'} key={n.id} onClick={()=>void (async()=>{if(!n.readAt)await read(n.id);onOpen(n)})()}><span className="canva-event-marker"><Icon name={iconName(n.kind)} size={15}/></span><div><small>{n.actor?.name||'WTinker'} · {n.kind.replaceAll('_',' ')}</small><b>{n.title}</b><p>{n.body}</p></div><time>{ago(n.createdAt)}</time></button>)}{!visible.length&&<div className="canva-empty">Новых событий нет.</div>}</div>}
    </main>
  </div>
 </section>
}
