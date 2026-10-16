import {useState} from 'react';
import type {UserProfile,State} from './core';
import {Icon} from './Icon';
import ChatView from './ChatView';
import GroupChatView from './GroupChatView';
import ChannelsView from './ChannelsView';

type Mode='personal'|'groups'|'channels';
type Props={
 token:string;
 profile:UserProfile;
 state:State;
 onStateChange:(p:Partial<State>)=>void;
 onNotice:(s:string)=>void;
 onProfile?:(profile:UserProfile)=>void;
 onExit:()=>void;
 routePath?:string;
 initialPeerId?:string;
};

export default function ChatsHub({token,profile,state,onStateChange,onNotice,onProfile,onExit,routePath,initialPeerId}:Props){
 const [mode,setMode]=useState<Mode>(()=>routePath?.startsWith('/chat/group/')?'groups':routePath?.startsWith('/channel/')?'channels':'personal');
 const groupId=routePath?.match(/^\/chat\/group\/([^/]+)/)?.[1];
 const channelSlug=routePath?.match(/^\/channel\/([^/]+)/)?.[1];

 const modes:readonly {id:Mode;label:string}[]=[
  {id:'personal',label:'Личные'},
  {id:'groups',label:'Группы'},
  {id:'channels',label:'Каналы'}
 ];
 const navigation=<nav className="wt-chat-mode-tabs" aria-label="Типы переписок">
  {modes.map(item=><button key={item.id} type="button" aria-current={mode===item.id?'page':undefined} className={mode===item.id?'active':''} onClick={()=>setMode(item.id)}>{item.label}</button>)}
 </nav>;

 return <section className="wt-chat-workspace" aria-label="Сообщения WTinker">
  {mode==='personal'?
   <ChatView key="personal" token={token} profile={profile} state={state} onStateChange={onStateChange} onNotice={onNotice} onProfile={onProfile} onExit={onExit} navigation={navigation} initialPeerId={initialPeerId}/>:
   <div className="wt-chat-secondary">
    <header className="wt-chat-secondary-bar">
     <button type="button" onClick={onExit} className="wt-chat-icon-button" aria-label="Вернуться в WTinker"><Icon name="chevronLeft" size={22}/></button>
     <div><strong>{mode==='groups'?'Групповые чаты':'Корпоративные каналы'}</strong><small>WTinker · сообщения</small></div>
    </header>
    {navigation}
    <div className="wt-chat-secondary-content">
     {mode==='groups'?<GroupChatView token={token} profile={profile} onNotice={onNotice} onProfile={onProfile} initialGroupId={groupId}/>:<ChannelsView token={token} profile={profile} onNotice={onNotice} onProfile={onProfile} initialSlug={channelSlug}/>}
    </div>
   </div>}
 </section>;
}
