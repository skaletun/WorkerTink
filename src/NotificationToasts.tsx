import {Icon} from './Icon';
import {useEffect,useRef,useState} from 'react';
import {getSocialNotifications,readSocialNotification,type SocialNotification} from './directory';

type Props={token:string;onOpen:(notification:SocialNotification)=>void};

const iconName=(kind:string)=>kind.includes('message')?'message':kind.includes('friend')?'people':kind.includes('event')?'calendar':kind.includes('channel')?'communities':kind.includes('shift')?'refresh':kind.includes('pay')?'pay':'bell';

export default function NotificationToasts({token,onOpen}:Props){
  const [items,setItems]=useState<SocialNotification[]>([]);
  const [exiting,setExiting]=useState<Record<string,boolean>>({});
  const seen=useRef<Set<string>>(new Set());
  const initialized=useRef(false);
  const timers=useRef<number[]>([]);

  useEffect(()=>{
    let cancelled=false;
    const dismiss=(id:string)=>{
      setExiting(x=>({...x,[id]:true}));
      window.setTimeout(()=>setItems(x=>x.filter(n=>n.id!==id)),240);
    };
    const load=async()=>{
      try{
        const result=await getSocialNotifications(token);
        if(cancelled)return;
        const rows=result.notifications||[];
        if(!initialized.current){
          rows.forEach(n=>seen.current.add(n.id));
          initialized.current=true;
          return;
        }
        const fresh=rows.filter(n=>!seen.current.has(n.id)&&!n.readAt).slice(0,3);
        rows.forEach(n=>seen.current.add(n.id));
        if(!fresh.length)return;
        setItems(current=>[...fresh,...current].slice(0,3));
        fresh.forEach(n=>{
          const timer=window.setTimeout(()=>dismiss(n.id),6500);
          timers.current.push(timer);
        });
      }catch{}
    };
    void load();
    const timer=window.setInterval(()=>void load(),12000);
    return()=>{
      cancelled=true;
      window.clearInterval(timer);
      timers.current.forEach(window.clearTimeout);
    };
  },[token]);

  const open=async(notification:SocialNotification)=>{
    setExiting(x=>({...x,[notification.id]:true}));
    try{if(!notification.readAt)await readSocialNotification(notification.id,token)}catch{}
    window.setTimeout(()=>setItems(x=>x.filter(n=>n.id!==notification.id)),240);
    onOpen(notification);
  };

  if(!items.length)return null;
  return <div className="notification-toasts" aria-live="polite" aria-label="Новые уведомления">
    {items.map(n=><button key={n.id} type="button" className={"notification-toast "+(exiting[n.id]?'is-exiting':'')} onClick={()=>void open(n)}>
      <span className="notification-toast-icon" aria-hidden="true"><Icon name={iconName(n.kind)} size={16}/></span>
      <span className="notification-toast-copy"><strong>{n.title}</strong><span>{n.body}</span></span>
      <span className="notification-toast-arrow" aria-hidden="true"><Icon name="chevronRight" size={14}/></span>
    </button>)}
  </div>;
}