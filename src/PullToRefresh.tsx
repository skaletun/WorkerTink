import {useEffect,useRef,useState,type ReactNode} from 'react';

type PullPhase='idle'|'pulling'|'ready'|'refreshing';

const EDGE_START=36;
const TRIGGER_DISTANCE=72;
const MAX_DISTANCE=110;

export default function PullToRefresh({children}:{children:ReactNode}){
  const [distance,setDistance]=useState(0);
  const [phase,setPhase]=useState<PullPhase>('idle');
  const stateRef=useRef({active:false,startX:0,startY:0,lastY:0,moved:false,refreshing:false});
  const rafRef=useRef<number|undefined>(undefined);

  useEffect(()=>{
    const standalone=window.matchMedia?.('(display-mode: standalone)').matches||Boolean((navigator as any).standalone);
    const coarse=window.matchMedia?.('(pointer: coarse)').matches;
    if(!standalone||!coarse)return;

    const scheduleDistance=(next:number)=>{
      if(rafRef.current!==undefined)cancelAnimationFrame(rafRef.current);
      rafRef.current=requestAnimationFrame(()=>setDistance(next));
    };

    const onTouchStart=(event:TouchEvent)=>{
      if(stateRef.current.refreshing||event.touches.length!==1)return;
      const touch=event.touches[0];
      if(window.scrollY>1||touch.clientY>EDGE_START)return;
      stateRef.current={active:true,startX:touch.clientX,startY:touch.clientY,lastY:touch.clientY,moved:false,refreshing:false};
      setPhase('pulling');
      scheduleDistance(0);
    };

    const onTouchMove=(event:TouchEvent)=>{
      const s=stateRef.current;
      if(!s.active||s.refreshing||event.touches.length!==1)return;
      const touch=event.touches[0];
      const dy=touch.clientY-s.startY;
      const dx=Math.abs(touch.clientX-s.startX);
      s.lastY=touch.clientY;
      if(dx>Math.abs(dy)*1.15||dy<=0){
        s.active=false;
        setPhase('idle');
        scheduleDistance(0);
        return;
      }
      s.moved=true;
      if(window.scrollY<=1&&dy>0){
        event.preventDefault();
        const eased=Math.min(MAX_DISTANCE,dy*.62+Math.max(0,dy-TRIGGER_DISTANCE)*.18);
        scheduleDistance(eased);
        setPhase(eased>=TRIGGER_DISTANCE?'ready':'pulling');
      }
    };

    const onTouchEnd=()=>{
      const s=stateRef.current;
      if(!s.active)return;
      s.active=false;
      if(s.moved&&distance>=TRIGGER_DISTANCE){
        s.refreshing=true;
        stateRef.current=s;
        setPhase('refreshing');
        scheduleDistance(82);
        window.setTimeout(()=>window.location.reload(),520);
        return;
      }
      setPhase('idle');
      scheduleDistance(0);
    };

    document.addEventListener('touchstart',onTouchStart,{passive:true});
    document.addEventListener('touchmove',onTouchMove,{passive:false});
    document.addEventListener('touchend',onTouchEnd,{passive:true});
    document.addEventListener('touchcancel',onTouchEnd,{passive:true});
    return()=>{
      document.removeEventListener('touchstart',onTouchStart);
      document.removeEventListener('touchmove',onTouchMove);
      document.removeEventListener('touchend',onTouchEnd);
      document.removeEventListener('touchcancel',onTouchEnd);
      if(rafRef.current!==undefined)cancelAnimationFrame(rafRef.current);
    };
  },[distance]);

  if((window.matchMedia?.('(display-mode: standalone)').matches||Boolean((navigator as any).standalone))&&((window.matchMedia?.('(pointer: coarse)').matches)||/android|iphone|ipad|ipod/i.test(navigator.userAgent))){
    const progress=Math.min(1,distance/TRIGGER_DISTANCE);
    return <div className="pull-refresh-root"><div className="pull-refresh-indicator" data-phase={phase} style={{transform:`translate3d(-50%,${Math.max(-8,distance-18)}px,0)`}} aria-live="polite" aria-hidden={phase==='idle'}><span className="pull-refresh-icon">{phase==='refreshing'?'↻':phase==='ready'?'↓':'⌄'}</span><span className="pull-refresh-text">{phase==='refreshing'?'Обновляем…':phase==='ready'?'Отпустите для обновления':'Потяните для обновления'}</span><i className="pull-refresh-progress" style={{transform:`scaleX(${Math.max(.08,progress)})`}}/></div>{children}</div>;
  }
  return <>{children}</>;
}
