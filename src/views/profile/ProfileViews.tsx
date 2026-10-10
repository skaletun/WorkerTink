import {useEffect,useState,type Dispatch,type SetStateAction} from 'react';
import {ProfileQrModal} from '../../ProfileFeatures.tsx';
import {State,normalizeWTinkId,getScheduledShift,ymd,vacationUsedDays,type UserProfile} from '../../core.tsx';
import {updateProfile,searchUser,deleteProfile} from '../../directory.tsx';
import {Icon} from '../../Icon.tsx';
import {isDevProfile,NameWithBadge,Button,Field,copyText,Avatar,ConfirmModal} from '../../app/AppShared.tsx';
import {readImageSource,AvatarEditorModal,BannerEditorModal} from '../auth/AuthViews.tsx';

export function ProfileModal({profile,onClose,onChat,onNotice}:{profile:UserProfile;onClose:()=>void;onChat:()=>void;onNotice:(s:string)=>void}){
 const [resolved,setResolved]=useState<UserProfile>(profile);
 const [copied,setCopied]=useState(false);
 const [resolving,setResolving]=useState(false);
 const [qrOpen,setQrOpen]=useState(false);
 useEffect(()=>{
  let cancelled=false;
  setResolved(profile);
  setCopied(false);
  setResolving(!profile.username||!profile.banner);
  void searchUser(profile.profileId).then(r=>{if(!cancelled)setResolved(prev=>({...prev,...r.profile}))}).catch(()=>{}).finally(()=>{if(!cancelled)setResolving(false)});
  return()=>{cancelled=true};
 },[profile.profileId]);
 const publicUrl=resolved.username?window.location.origin+(window.location.hostname.endsWith('github.io')?'/WorkerTink':'')+'/user/'+encodeURIComponent(resolved.username):'';
 const copy=async()=>{
  if(!publicUrl)return;
  try{await copyText(publicUrl);onNotice('Публичная ссылка скопирована');setCopied(true);window.setTimeout(()=>setCopied(false),1800)}
  catch{onNotice('Не удалось скопировать ссылку')}
 };
 return <div className="modal-backdrop profile-modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
  <section className="profile-modal-card" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
   <button className="modal-close" onClick={onClose} aria-label="Закрыть"><Icon name="close" size={16}/></button>
   <div className="profile-modal-cover" style={resolved.banner?{backgroundImage:`url(${resolved.banner})`}:undefined}>{!resolved.banner&&<span>Добавьте баннер профиля</span>}</div>
   <div className="profile-modal-main">
    <Avatar profile={resolved} size="lg"/>
    <span className="redesign-overline">WTinker · рабочий профиль</span>
    <h2 id="profile-modal-title"><NameWithBadge profile={resolved}/></h2>
    <p>{resolved.position||'Должность не указана'}</p>
    <small>{resolved.username?`@${resolved.username}`:'Username не задан'}</small>
    <div className="profile-modal-facts">
      <div><small>WTinkID</small><b>{normalizeWTinkId(resolved.profileId)||resolved.profileId}</b></div>
      <div><small>Username</small><b>{resolved.username?`@${resolved.username}`:'Не задан'}</b></div>
      <div><small>Публичный адрес</small><b>{publicUrl||'Недоступен без username'}</b></div>
    </div>
    <div className="profile-modal-actions">
      <Button primary onClick={onChat}>Открыть чат</Button>
      <button className="btn quiet" disabled={!publicUrl} onClick={()=>void copy()}>{copied?'Ссылка скопирована':'Скопировать ссылку'}</button>
      {publicUrl?<><a className="btn quiet" href={publicUrl} target="_blank" rel="noreferrer">Публичный профиль</a><button className="btn quiet" onClick={()=>setQrOpen(true)}>QR-код</button></>:<span className="profile-link-missing">{resolving?'Обновляем профиль…':'Username не найден'}</span>}
    </div>
   </div>
  </section>
  {qrOpen&&<ProfileQrModal profile={resolved} onClose={()=>setQrOpen(false)}/>}
 </div>
}

export function ProfileView({state,setState,token,onNotice,onSettings}:{state:State;setState:Dispatch<SetStateAction<State>>;token:string;onNotice:(s:string)=>void;onSettings:()=>void}){
 const [busy,setBusy]=useState(false);const [avatarSource,setAvatarSource]=useState<string|null>(null);const [bannerSource,setBannerSource]=useState<string|null>(null);const [deleteOpen,setDeleteOpen]=useState(false);const [qrOpen,setQrOpen]=useState(false);const used=vacationUsedDays(state);const nextDate=(()=>{const d=new Date();for(let i=0;i<90;i++){const candidate=new Date(d.getFullYear(),d.getMonth(),d.getDate()+i);if(getScheduledShift(state,candidate)!=='off')return ymd(candidate)}return '—'})();const id=normalizeWTinkId(state.profile.profileId)||state.profile.profileId;
 const pickAvatar=async(file:File)=>{setBusy(true);try{setAvatarSource(await readImageSource(file))}catch{onNotice('Не удалось открыть изображение')}finally{setBusy(false)}};const pickBanner=async(file:File)=>{setBusy(true);try{setBannerSource(await readImageSource(file))}catch{onNotice('Не удалось открыть баннер')}finally{setBusy(false)}};
 const removeProfile=async()=>{setBusy(true);try{if(state.directoryToken)await deleteProfile(state.directoryToken);for(const key of ['workertink:v6','workertink:v5','workertink:v4','workertink:v3','workertink:v2','workertink'])localStorage.removeItem(key);window.location.reload()}catch{onNotice('Не удалось удалить профиль из каталога');setBusy(false)}};
 return <section className="canva-page canva-profile redesign-page redesign-profile">
  <header className="canva-page-head"><div><span className="canva-kicker">Profile</span><h1>Публичный профиль</h1><p>Ваше имя, рабочий контекст, WTinkID и публичная ссылка собраны на одной странице.</p></div><div className="canva-head-actions"><button className="canva-button" onClick={onSettings}>Настройки</button></div></header>
  <section className="canva-profile-hero">
    <div className="canva-profile-cover" style={state.profile.banner?{backgroundImage:`url(${state.profile.banner})`}:undefined}><span>{state.profile.banner?'':'Добавьте баннер профиля'}</span></div>
    <div className="canva-profile-identity">
      <Avatar profile={state.profile} size="lg"/>
      <div className="canva-profile-main"><div className="name-with-badge"><NameWithBadge profile={state.profile}/></div><p>{state.profile.position||'Должность не указана'}</p><span>WTinkID · {id}</span></div>
      <div className="canva-profile-buttons">
        <label className="canva-button canva-upload">{state.profile.banner?'Изменить баннер':'Добавить баннер'}<input type="file" accept="image/*" hidden disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void pickBanner(file);e.currentTarget.value=''}}/></label>
        <label className="canva-button canva-upload">{state.profile.avatar?'Изменить аватар':'Добавить аватар'}<input type="file" accept="image/*" hidden disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void pickAvatar(file);e.currentTarget.value=''}}/></label>
        <button className="canva-button canva-button-primary" onClick={()=>setQrOpen(true)} disabled={!state.profile.username}>QR-код</button>
      </div>
    </div>
  </section>
  <div className="canva-profile-grid">
    <main className="canva-profile-main-column">
      <section className="canva-profile-card">
        <div className="canva-section-head"><div><span className="canva-kicker">Identity</span><h2>Основная информация</h2></div></div>
        <div className="canva-field-grid">
          <Field label="Имя"><input value={state.profile.name} maxLength={80} onChange={e=>setState(s=>({...s,profile:{...s.profile,name:e.target.value}}))}/></Field>
          <Field label="Должность"><input value={state.profile.position} maxLength={120} onChange={e=>setState(s=>({...s,profile:{...s.profile,position:e.target.value}}))}/></Field>
          <Field label="Username"><input autoCapitalize="none" value={state.profile.username||''} maxLength={32} placeholder="WTinker" onChange={e=>setState(s=>({...s,profile:{...s.profile,username:e.target.value.replace(/[^A-Za-z0-9_]/g,'')}}))}/></Field>
          <div className="canva-public-link"><span>Публичная ссылка</span><b>{state.profile.username?window.location.origin+(window.location.hostname.endsWith('github.io')?'/WorkerTink':'')+'/user/'+state.profile.username:'Создайте username'}</b>{state.profile.username&&<button className="canva-text-button" onClick={()=>void copyText(window.location.origin+(window.location.hostname.endsWith('github.io')?'/WorkerTink':'')+'/user/'+state.profile.username).then(()=>onNotice('Ссылка скопирована')).catch(()=>onNotice('Не удалось скопировать ссылку'))}>Копировать ссылку</button>}</div>
        </div>
      </section>
      <section className="canva-profile-card">
        <div className="canva-section-head"><div><span className="canva-kicker">Work context</span><h2>Рабочий ритм</h2></div></div>
        <div className="canva-profile-metrics">
          <div><span>График</span><b>{state.scheduleType}</b><small>{state.scheduleType==='2/2'?(state.schedulePairType==='day-night'?'день / ночь':state.schedulePairType==='day-day'?'день / день':'ночь / ночь'):state.scheduleShift==='night'?'ночные':state.scheduleShift==='full'?'сутки':'дневные'}</small></div>
          <div><span>Ближайшая смена</span><b>{nextDate}</b><small>по вашему графику</small></div>
          <div><span>Отпуск</span><b>{Math.max(0,state.vacTotal-used)} дн.</b><small>осталось</small></div>
          <div><span>Контакты</span><b>{Object.keys(state.friends).length}</b><small>в профиле</small></div>
        </div>
      </section>
      <section className="canva-profile-card canva-profile-privacy"><div><span className="canva-kicker">Privacy</span><h2>Данные под контролем</h2><p>Профильные действия проходят через Directory API. Рабочие расчёты остаются на устройстве, а личные сообщения используют E2E-шифрование.</p></div><span className="canva-state">E2E</span></section>
    </main>
    <aside className="canva-profile-rail">
      <section className="canva-profile-card"><span className="canva-kicker">Public profile</span><h3>{state.profile.username?'@'+state.profile.username:'Username не задан'}</h3><p>Этот адрес используется для публичной страницы и QR-кода.</p><button className="canva-button canva-button-primary" onClick={()=>state.profile.username&&setQrOpen(true)} disabled={!state.profile.username}>Открыть QR</button></section>
      <section className="canva-profile-card"><span className="canva-kicker">Badges</span><div className="canva-badge-list"><div>{state.profile.isOfficial&&<><Icon name="check" size={12}/><span>Официальный аккаунт</span></>}</div><div>{state.profile.isVerified&&<><Icon name="check" size={12}/><span>Подтверждённый аккаунт</span></>}</div><div>{isDevProfile(state.profile)&&<><span className="dev-badge">dev</span><span>Разработчик</span></>}</div></div></section>
      <section className="canva-profile-card canva-danger"><span className="canva-kicker">Danger zone</span><h3>Удаление профиля</h3><p>Локальные рабочие данные и профиль WTinkID будут удалены без автоматического восстановления.</p><button className="canva-button" onClick={()=>setDeleteOpen(true)}>Удалить профиль</button></section>
    </aside>
  </div>
  {avatarSource&&<AvatarEditorModal source={avatarSource} onClose={()=>setAvatarSource(null)} onSave={avatar=>{setState(s=>({...s,profile:{...s.profile,avatar}}));setAvatarSource(null);onNotice('Аватар обновлён')}} onRemove={()=>{setState(s=>({...s,profile:{...s.profile,avatar:''}}));setAvatarSource(null);onNotice('Аватар удалён')}}/>}
  {bannerSource&&<BannerEditorModal source={bannerSource} onClose={()=>setBannerSource(null)} onSave={banner=>{const next={...state.profile,banner};setState(s=>({...s,profile:next}));setBannerSource(null);if(token){void updateProfile(next,token).then(r=>setState(s=>({...s,profile:{...s.profile,...r.profile}}))).then(()=>onNotice('Баннер обновлён')).catch(()=>onNotice('Баннер обновлён локально; каталог временно недоступен'))}else onNotice('Баннер обновлён')}} onRemove={()=>{const next={...state.profile,banner:''};setState(s=>({...s,profile:next}));setBannerSource(null);if(token){void updateProfile(next,token).then(r=>setState(s=>({...s,profile:{...s.profile,...r.profile}}))).then(()=>onNotice('Баннер удалён')).catch(()=>onNotice('Баннер удалён локально; каталог временно недоступен'))}else onNotice('Баннер удалён')}}/>}
  {deleteOpen&&<ConfirmModal title="Удалить профиль?" text="Это удалит профиль WTinkID из каталога и очистит локальные данные WTinker. Действие необратимо." confirmLabel="Удалить профиль" busy={busy} onClose={()=>setDeleteOpen(false)} onConfirm={()=>void removeProfile()}/>}
  {qrOpen&&state.profile.username&&<ProfileQrModal profile={state.profile} editable onClose={()=>setQrOpen(false)}/>}
 </section>
}
