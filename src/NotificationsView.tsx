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
 return <section className="redesign-page redesign-notifications">
  <div className="redesign-page-intro">
   <div><span className="redesign-overline">Центр событий</span><h1>Что произошло</h1><p>Сообщения, заявки, события и рабочие изменения — в одной последовательности.</p></div>
   <div className="notification-count"><strong>{unreadCount}</strong><span>непрочитанных</span></div>
  </div>
  <div className="notification-controls"><div className="segmented-control"><button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>Все <b>{items.length}</b></button><button className={filter==='unread'?'active':''} onClick={()=>setFilter('unread')}>Непрочитанные <b>{unreadCount}</b></button></div><div className="notification-control-actions"><button className="redesign-btn" onClick={()=>void load()}>Обновить</button><button className="redesign-btn redesign-btn-soft" onClick={()=>void readAll()}>Прочитать всё</button></div></div>
  {loading&&!items.length?<div className="notification-timeline"><div className="timeline-item"><div className="skeleton" style={{width:34,height:34}}/><div className="timeline-main"><div className="skeleton" style={{width:'45%',height:12}}/><div className="skeleton" style={{width:'75%',height:9,marginTop:8}}/></div></div><div className="timeline-item"><div className="skeleton" style={{width:34,height:34}}/><div className="timeline-main"><div className="skeleton" style={{width:'38%',height:12}}/><div className="skeleton" style={{width:'68%',height:9,marginTop:8}}/></div></div></div>:loadError&&!items.length?<div className="error-state"><strong>Не удалось загрузить события</strong><span>Проверьте соединение и попробуйте обновить центр уведомлений.</span><div style={{marginTop:12}}><button className="redesign-btn redesign-btn-soft" onClick={()=>void load()}>Повторить</button></div></div>:<div className="notification-timeline">{visible.map(n=><button type="button" className={`timeline-item ${n.readAt?'read':'unread'}`} key={n.id} onClick={()=>void (async()=>{if(!n.readAt)await read(n.id);onOpen(n)})()}><div className="timeline-marker"><Icon name={iconName(n.kind)} size={17}/></div><div className="timeline-main">{n.actor&&<div className="timeline-actor">{n.actor.name}{n.actor.position?` · ${n.actor.position}`:''}</div>}<div className="timeline-title"><b>{n.title}</b><time>{ago(n.createdAt)}</time></div><p>{n.body}</p><span className="timeline-kind">{n.kind.replaceAll('_',' ')}</span></div>{!n.readAt&&<span className="timeline-unread"/>}</button>)}{!visible.length&&<div className="redesign-empty">Новых событий нет.</div>}</div>}
 </section>
}
