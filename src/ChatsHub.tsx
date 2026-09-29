import {useState} from 'react';
import type {UserProfile,State} from './core';
import ChatView from './ChatView';
import GroupChatView from './GroupChatView';
import ChannelsView from './ChannelsView';
export default function ChatsHub({token,profile,state,onStateChange,onNotice}:{token:string;profile:UserProfile;state:State;onStateChange:(p:Partial<State>)=>void;onNotice:(s:string)=>void}){
 const [mode,setMode]=useState<'personal'|'groups'|'channels'>('personal');
 return <section className="chats-hub"><div className="chats-hub-nav"><button className={mode==='personal'?'active':''} onClick={()=>setMode('personal')}>Личные <small>E2E</small></button><button className={mode==='groups'?'active':''} onClick={()=>setMode('groups')}>Группы <small>команды</small></button><button className={mode==='channels'?'active':''} onClick={()=>setMode('channels')}>Корпоративные <small>каналы</small></button></div>{mode==='personal'&&<ChatView token={token} profile={profile} state={state} onStateChange={onStateChange} onNotice={onNotice}/>} {mode==='groups'&&<GroupChatView token={token} profile={profile} onNotice={onNotice}/>} {mode==='channels'&&<ChannelsView token={token} profile={profile} onNotice={onNotice}/>}</section>
}
