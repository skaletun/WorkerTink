import {useCallback,useEffect,useRef,useState,type Dispatch,type SetStateAction} from 'react';
import {State,normalizeWTinkId,type UserProfile,type ChatMessage,type FriendRequest} from '../../core.ts';
import {searchUser,getUserByUsername,searchNetworkPeople,sendFriendRequest,respondFriendRequest,cancelFriendRequest,removeFriend,getDirectoryFriends,getIncoming,getOutgoing} from '../../directory.ts';
import {NameWithBadge,Button,Avatar} from '../../app/AppShared.tsx';

export function FriendsView({state,setState,onNotice,onOpenChat,onProfile}:{state:State;setState:Dispatch<SetStateAction<State>>;onNotice:(s:string)=>void;onOpenChat:(profileId:string)=>void;onProfile:(profile:UserProfile)=>void}){
 const [friendTab,setFriendTab]=useState<'friends'|'incoming'|'outgoing'>('friends');
 const [search,setSearch]=useState('');
 const [found,setFound]=useState<UserProfile[]>([]);
 const [friends,setFriends]=useState<Awaited<ReturnType<typeof getDirectoryFriends>>['friends']>([]);
 const [searching,setSearching]=useState(false);
 const [loading,setLoading]=useState(true);
 const [loadError,setLoadError]=useState(false);
 const [pendingAction,setPendingAction]=useState('');
 const refreshVersion=useRef(0);
 const token=state.directoryToken,profileId=state.profile.profileId;
 const incoming=state.friendRequestsIncoming.filter(r=>r.status==='pending');
 const outgoing=state.friendRequestsOutgoing.filter(r=>r.status==='pending');

 const refresh=useCallback(async(showError=false)=>{
  const sequence=++refreshVersion.current;
  if(!token||!profileId){setFriends([]);setLoading(false);return}
  try{
   const [friendResult,incomingResult,outgoingResult]=await Promise.all([
    getDirectoryFriends(token),getIncoming(profileId,token),getOutgoing(profileId,token)
   ]);
   if(sequence!==refreshVersion.current)return;
   setFriends(friendResult.friends);
   const incomingRequests=incomingResult.requests.filter(r=>r.status==='pending');
   const outgoingRequests=outgoingResult.requests.filter(r=>r.status==='pending');
   setState(current=>{
    if(JSON.stringify(current.friendRequestsIncoming)===JSON.stringify(incomingRequests)
      &&JSON.stringify(current.friendRequestsOutgoing)===JSON.stringify(outgoingRequests))return current;
    return {...current,friendRequestsIncoming:incomingRequests,friendRequestsOutgoing:outgoingRequests};
   });
   setLoadError(false);
  }catch{
   if(sequence!==refreshVersion.current)return;
   setLoadError(true);
   if(showError)onNotice('Не удалось обновить друзей и заявки. Проверьте подключение.');
  }finally{
   if(sequence===refreshVersion.current)setLoading(false);
  }
 },[token,profileId,onNotice,setState]);

 useEffect(()=>{
  setLoading(true);
  void refresh();
  const tick=()=>{if(document.visibilityState==='visible')void refresh()};
  const timer=window.setInterval(tick,30000);
  document.addEventListener('visibilitychange',tick);
  return()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',tick);refreshVersion.current++};
 },[refresh]);

 const doSearch=async()=>{
  const raw=search.trim();
  if(!raw){onNotice('Введите имя, WTinkID или @username');return}
  if(!token){onNotice('Для поиска коллег необходимо войти в аккаунт');return}
  setSearching(true);setFound([]);
  try{
   const id=normalizeWTinkId(raw);
   const exactUsername=raw.startsWith('@')&&/^[A-Za-z0-9_]{3,32}$/.test(raw.slice(1));
   const results=id?[ (await searchUser(id)).profile ]:
    exactUsername?[ (await getUserByUsername(raw.slice(1))).profile ]:
    (await searchNetworkPeople(raw,token)).people.map(person=>person.profile);
   const unique=new Map<string,UserProfile>();
   for(const profile of results){
    const normalized=normalizeWTinkId(profile.profileId);
    if(normalized&&normalized!==normalizeWTinkId(profileId))unique.set(normalized,profile);
   }
   setFound([...unique.values()]);
   if(!unique.size)onNotice('Никого не нашли. Попробуйте другое имя или WTinkID.');
  }catch{onNotice('Не удалось выполнить поиск. Проверьте подключение и повторите.')}
  finally{setSearching(false)}
 };

 const requestFriend=async(profile:UserProfile)=>{
  if(!token||pendingAction)return;
  setPendingAction(profile.profileId);
  try{
   const result=await sendFriendRequest(state.profile,profile.profileId,token);
   setState(current=>({...current,friendRequestsOutgoing:[...current.friendRequestsOutgoing.filter(r=>r.id!==result.request.id),result.request]}));
   await refresh();
   onNotice('Заявка отправлена');
  }catch(error){
   const code=String(error);
   onNotice(code.includes('REQUEST_EXISTS')?'Заявка уже отправлена или ожидает вашего ответа':
    code.includes('ALREADY_FRIENDS')?'Вы уже друзья':
    code.includes('PROFILE_BLOCKED')?'Невозможно отправить заявку этому пользователю':
    code.includes('SELF_REQUEST')?'Нельзя добавить себя в друзья':'Не удалось отправить заявку');
   await refresh();
  }finally{setPendingAction('')}
 };

 const respond=async(id:string,action:'accept'|'decline')=>{
  if(!token||pendingAction)return;
  setPendingAction(id);
  try{
   await respondFriendRequest(id,action,token);
   setState(current=>({...current,friendRequestsIncoming:current.friendRequestsIncoming.filter(r=>r.id!==id)}));
   await refresh();
   onNotice(action==='accept'?'Заявка принята. Пользователь добавлен в друзья.':'Заявка отклонена');
  }catch{await refresh();onNotice('Не удалось обработать заявку')}
  finally{setPendingAction('')}
 };

 const cancel=async(id:string)=>{
  if(!token||pendingAction)return;
  setPendingAction(id);
  try{
   await cancelFriendRequest(id,token);
   setState(current=>({...current,friendRequestsOutgoing:current.friendRequestsOutgoing.filter(r=>r.id!==id)}));
   await refresh();onNotice('Заявка отменена');
  }catch{await refresh();onNotice('Не удалось отменить заявку')}
  finally{setPendingAction('')}
 };

 const remove=async(profile:UserProfile)=>{
  if(!token||pendingAction||!window.confirm('Удалить '+profile.name+' из друзей?'))return;
  setPendingAction(profile.profileId);
  try{
   await removeFriend(profile.profileId,token);
   setFriends(current=>current.filter(friend=>normalizeWTinkId(friend.profile.profileId)!==normalizeWTinkId(profile.profileId)));
   await refresh();onNotice('Пользователь удалён из друзей');
  }catch{await refresh();onNotice('Не удалось удалить друга')}
  finally{setPendingAction('')}
 };

 const friendIds=new Set(friends.map(friend=>normalizeWTinkId(friend.profile.profileId)));
 const requestsTo=new Set(outgoing.map(request=>normalizeWTinkId(request.to.profileId)));
 const requestsFrom=new Set(incoming.map(request=>normalizeWTinkId(request.from.profileId)));

 return <section className="canva-page canva-friends redesign-page redesign-people friends-page">
  <header className="canva-page-head"><div><span className="canva-kicker">Friends</span><h1>Ваши люди</h1><p>Ищите коллег, отправляйте заявки и переходите в защищённые разговоры.</p></div><span className="canva-state">{friends.length} друзей</span></header>
  <section className="canva-friends-search"><div><span className="canva-kicker">Поиск коллег</span><h2>Найти человека</h2><p>По имени, должности, WTinkID или username.</p></div>
   <div className="canva-search"><input aria-label="Поиск людей" value={search} onChange={e=>{setSearch(e.target.value);setFound([])}} placeholder="Имя, WTinkID-592391 или @username" maxLength={100} onKeyDown={e=>{if(e.key==='Enter')void doSearch()}}/><button className="canva-button canva-button-primary" onClick={()=>void doSearch()} disabled={searching||!token}>{searching?'Поиск…':'Найти'}</button></div>
   {found.map(profile=>{
    const id=normalizeWTinkId(profile.profileId);
    const connected=friendIds.has(id),sent=requestsTo.has(id),received=requestsFrom.has(id);
    return <div className="canva-found-person" key={id}><Avatar profile={profile} size="lg"/><div><b><NameWithBadge profile={profile}/></b><small>{profile.username?'@'+profile.username+' · ':''}{id}</small><p>{profile.position||'Должность не указана'}</p></div><button className="canva-button" onClick={()=>onProfile(profile)}>Профиль</button>{received?<button className="canva-button canva-button-primary" onClick={()=>setFriendTab('incoming')}>Ответить на заявку</button>:<button className="canva-button canva-button-primary" disabled={Boolean(pendingAction)||connected||sent} onClick={()=>void requestFriend(profile)}>{connected?'Уже друзья':sent?'Заявка отправлена':pendingAction===profile.profileId?'Отправляем…':'Добавить в друзья'}</button>}</div>
   })}
  </section>
  <div className="canva-friends-layout"><main className="canva-friends-main"><nav className="canva-filter-row" aria-label="Списки друзей и заявок"><button className={friendTab==='friends'?'active':''} onClick={()=>setFriendTab('friends')}>Друзья · {friends.length}</button><button className={friendTab==='incoming'?'active':''} onClick={()=>setFriendTab('incoming')}>Входящие · {incoming.length}</button><button className={friendTab==='outgoing'?'active':''} onClick={()=>setFriendTab('outgoing')}>Исходящие · {outgoing.length}</button><button onClick={()=>void refresh(true)} disabled={loading}>Обновить</button></nav>
   {loadError&&<p className="hint" role="status">Не удалось синхронизировать друзей. Нажмите «Обновить», чтобы повторить.</p>}
   {friendTab==='friends'?<div className="canva-friends-list">{friends.map(friend=><article className="canva-friend-row" key={friend.profile.profileId}><Avatar profile={friend.profile} size="lg"/><div><b><NameWithBadge profile={friend.profile}/></b><small>{friend.profile.username?'@'+friend.profile.username+' · ':''}{friend.profile.position||'Сотрудник'}</small><span>{friend.online?'В сети':'Не в сети'} · {normalizeWTinkId(friend.profile.profileId)||friend.profile.profileId}</span></div><div className="canva-person-actions"><button className="canva-button" onClick={()=>onProfile(friend.profile)}>Профиль</button><button className="canva-button canva-button-primary" onClick={()=>onOpenChat(friend.profile.profileId)}>Открыть чат</button><button className="canva-button" disabled={Boolean(pendingAction)} onClick={()=>void remove(friend.profile)}>Удалить</button></div></article>)}{!friends.length&&<div className="canva-empty">{loading?'Загружаем друзей…':'Пока нет друзей. Найдите коллегу выше.'}</div>}</div>:
    <RequestList type={friendTab} requests={friendTab==='incoming'?incoming:outgoing} pendingAction={pendingAction} onRespond={respond} onCancel={cancel}/>}
  </main><aside className="canva-friends-rail"><span className="canva-kicker">Разделы</span><button onClick={()=>setFriendTab('incoming')}><b>Входящие заявки</b><small>{incoming.length} ожидают ответа</small></button><button onClick={()=>setFriendTab('outgoing')}><b>Исходящие заявки</b><small>{outgoing.length} ожидают ответа</small></button><button onClick={()=>void refresh(true)}><b>Синхронизировать</b><small>Обновить контакты и запросы</small></button></aside></div>
 </section>;
}

function RequestList({type,requests,pendingAction,onRespond,onCancel}:{type:'incoming'|'outgoing';requests:FriendRequest[];pendingAction:string;onRespond:(id:string,action:'accept'|'decline')=>void;onCancel:(id:string)=>void}){
 return <div className="requests-page"><div className="requests-card"><div className="requests-head"><div><span className="eyebrow">{type==='incoming'?'Входящие':'Исходящие'}</span><h3>{type==='incoming'?'Заявки в друзья':'Отправленные заявки'}</h3></div><span>{requests.length}</span></div>{requests.length?requests.map(r=>{const profile=type==='incoming'?r.from:r.to;return <div className="request-item" key={r.id}><Avatar profile={profile} size="md"/><div><b><NameWithBadge profile={profile}/></b><small>{profile.position||'Должность не указана'}</small><span>{normalizeWTinkId(profile.profileId)||profile.profileId} · {new Date(r.createdAt).toLocaleDateString('ru-RU')}</span></div><div className="request-actions">{type==='incoming'?<><Button primary disabled={Boolean(pendingAction)} onClick={()=>onRespond(r.id,'accept')}>Принять</Button><Button quiet disabled={Boolean(pendingAction)} onClick={()=>onRespond(r.id,'decline')}>Отклонить</Button></>:<Button quiet disabled={Boolean(pendingAction)} onClick={()=>onCancel(r.id)}>Отменить заявку</Button>}</div></div>}):<div className="friends-empty">{type==='incoming'?'Нет новых входящих заявок.':'Нет исходящих заявок, ожидающих ответа.'}</div>}</div></div>;
}

function ChatBubble({message,own,onActivate,onApplyNote}:{message:ChatMessage;own:boolean;onActivate:(p:UserProfile)=>void;onApplyNote:(n:{date:string;note:string})=>void}){
 const profile=message.type==='profile'?message.profile:undefined;
 const note=message.type==='note'?message.note:undefined;
 return <div className={`chat-row ${own?'own':''}`}><div className="chat-bubble">{message.type==='text'&&<p>{message.text}</p>}{profile&&<div className="share-card"><div className="share-title"><Avatar profile={profile} size="sm"/><div><b>Профиль</b><span><NameWithBadge profile={profile}/></span></div></div><p>{profile.position||'Должность не указана'}</p><Button primary onClick={()=>onActivate(profile)}>Активировать профиль</Button></div>}{note&&<div className="share-card"><div className="share-title"><span className="share-icon">✎</span><div><b>Заметка смены</b><span>{note.date} · {note.shift||'смена'}</span></div></div><div className="note-preview">{note.note.slice(0,260)}</div><Button primary onClick={()=>onApplyNote(note)}>Активировать на {note.date}</Button></div>}<time>{new Date(message.at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</time></div></div>}