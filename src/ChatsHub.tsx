import {useState} from 'react';
import type {UserProfile,State} from './core';
import ChatView from './ChatView';
import GroupChatView from './GroupChatView';
import ChannelsView from './ChannelsView';
export default function ChatsHub({token,profile,state,onStateChange,onNotice,onProfile,routePath}:{token:string;profile:UserProfile;state:State;onStateChange:(p:Partial<State>)=>void;onNotice:(s:string)=>void;onProfile?:(profile:UserProfile)=>void;routePath?:string}){
 const [mode,setMode]=useState<'personal'|'groups'|'channels'>(()=>routePath?.startsWith('/chat/group/')?'groups':routePath?.startsWith('/channel/')?'channels':'personal');
 const groupId=routePath?.match(/^\/chat\/group\/([^/]+)/)?.[1]; const channelSlug=routePath?.match(/^\/channel\/([^/]+)/)?.[1];
 return <section className="chats-hub"><div className="chats-hub-nav"><button className={mode==='personal'?'active':''} onClick={()=>setMode('personal')}>Личные <small>E2E</small></button><button className={mode==='groups'?'active':''} onClick={()=>setMode('groups')}>Группы <small>команды</small></button><button className={mode==='channels'?'active':''} onClick={()=>setMode('channels')}>Корпоративные <small>каналы</small></button></div>{mode==='personal'&&<ChatView token={token} profile={profile} state={state} onStateChange={onStateChange} onNotice={onNotice} onProfile={onProfile}/>} {mode==='groups'&&<GroupChatView token={token} profile={profile} onNotice={onNotice} onProfile={onProfile} initialGroupId={groupId}/>} {mode==='channels'&&<ChannelsView token={token} profile={profile} onNotice={onNotice} onProfile={onProfile} initialSlug={channelSlug}/>}</section>
}
