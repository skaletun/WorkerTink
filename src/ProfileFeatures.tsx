import {createPortal} from 'react-dom';
import {useEffect,useMemo,useState} from 'react';
import type {UserProfile} from './core';
// @ts-ignore — qr ships runtime + declarations, but its package export differs across TS bundler versions.
import encodeQR from 'qr';
import {getUserByUsername,searchUser,sendFriendRequest} from './directory';
import {Icon} from './Icon';

const basePath=()=>window.location.hostname.endsWith('github.io')?'/WorkerTink':'';
export const publicProfileUrl=(username:string)=>`${window.location.origin}${basePath()}/user/${encodeURIComponent(username)}`;

function Badge({kind}:{kind:'official'|'verified'}){return <span className={`profile-badge ${kind}`} title={kind==='official'?'Официальный аккаунт':'Подтверждённый аккаунт'} aria-label={kind==='official'?'Официальный аккаунт':'Подтверждённый аккаунт'}><Icon name="check" size={10} strokeWidth={2.4}/></span>}

export function ProfileName({profile}:{profile:UserProfile}){return <span className="profile-name-with-badges">{profile.name}{profile.isOfficial&&<Badge kind="official"/>}{profile.isVerified&&<Badge kind="verified"/>}{profile.isDev&&<b className="dev-badge">dev</b>}</span>}

export function LegalSurface({kind}:{kind:'privacy'|'terms'}){const privacy=kind==='privacy';return <div className="public-profile-page legal-surface"><article className="legal-card"><span className="redesign-overline">WTinker · Правила платформы</span><h1>{privacy?'Политика конфиденциальности':'Условия использования'}</h1><p className="legal-version">Редакция {privacy?'1.0':'1.0'} · действует с 1 октября 2026</p>{privacy?<><h2>1. Какие данные используются</h2><p>WTinker использует данные, необходимые для учётной записи и работы социальной сети: WTinkID, имя, username, должность, аватар, баннер, социальные связи, заявки и технические сведения о сессиях и устройствах.</p><h2>2. Рабочие данные</h2><p>Локальные рабочие расчёты и содержимое личных E2E-сообщений не становятся частью публичного профиля. Сервер получает только данные, необходимые для соответствующего сетевого действия.</p><h2>3. Публичный профиль</h2><p>Публичный профиль может содержать имя, username, аватар, баннер, должность и статусы подтверждения. Скрытые рабочие расчёты туда не публикуются.</p><h2>4. Управление данными</h2><p>Пользователь может изменить профиль или удалить учётную запись через WTinker. Административные действия ограничены серверными правами.</p></>:<><h2>1. Учётная запись</h2><p>Пользователь отвечает за сохранность PIN, устройств OnePass и данных, которые он добровольно публикует в профиле.</p><h2>2. Социальные функции</h2><p>Публикации, заявки, сообщества и сообщения должны использоваться добросовестно и не нарушать права других пользователей.</p><h2>3. Верификация</h2><p>Официальный статус назначается администрацией WTinker. Подтверждённый статус связан с наличием активного OnePass и снимается после удаления последнего ключа.</p><h2>4. Изменения правил</h2><p>Редакции правил фиксируются версией. Существенные изменения требуют нового принятия условий при регистрации или следующем предусмотренном продуктом подтверждении.</p></>}<a className="btn quiet" href={basePath()+'/'}>Вернуться в WTinker</a></article></div>}

type QrShape='Square'|'Rounded'|'Dots';
type QrCard='Minimal'|'Soft'|'Poster';
const qrSafeColor=(color:string,fallback:string)=>/^#[0-9a-f]{6}$/i.test(color)?color:fallback;
function brandedQrSvg(url:string,shape:QrShape,foreground:string,background:string,variant:QrCard){
 const border=2;
 const matrix=encodeQR(url,'raw',{ecc:'high',border}) as boolean[][];
 const n=matrix.length,pad=5,cell=8,side=(n+pad*2)*cell;
 const fg=qrSafeColor(foreground,'#142a23'),bg=qrSafeColor(background,'#ffffff');
 const rect=(x:number,y:number,w:number,h:number,fill:string,r=0)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;
 let content=rect(0,0,side,side,bg);
 const insideFinder=(x:number,y:number)=>[[border,border],[n-border-7,border],[border,n-border-7]].some(([fx,fy])=>x>=fx&&x<fx+7&&y>=fy&&y<fy+7);
 const logoStart=Math.floor(n/2)-3;
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  if(!matrix[y][x]||insideFinder(x,y))continue;
  // High error correction permits a small clear center for the recognizable WT symbol.
  if(x>=logoStart&&x<logoStart+6&&y>=logoStart&&y<logoStart+6)continue;
  const px=(x+pad)*cell,py=(y+pad)*cell;
  if(shape==='Dots')content+=`<circle cx="${px+4}" cy="${py+4}" r="3.6" fill="${fg}"/>`;
  else content+=rect(px,py,cell,cell,fg,shape==='Rounded'?2.9:0);
 }
 for(const [fx,fy] of [[border,border],[n-border-7,border],[border,n-border-7]]){
  const x=(fx+pad)*cell,y=(fy+pad)*cell,r=shape==='Square'?0:10;
  content+=rect(x,y,56,56,fg,r)+rect(x+8,y+8,40,40,bg,shape==='Square'?0:7)+rect(x+16,y+16,24,24,fg,shape==='Square'?0:5);
 }
 const center=(logoStart+pad)*cell;
 content+=rect(center-2,center-2,52,52,bg,12);
 content+=rect(center+3,center+3,42,42,fg,11);
 content+=`<text x="${center+24}" y="${center+31}" text-anchor="middle" fill="${bg}" font-family="Arial,sans-serif" font-weight="900" font-size="25">W</text>`;
 const hue=variant==='Poster'?'#ec512f':variant==='Soft'?'#dff5bb':fg;
 const header=variant==='Minimal'?'':`<rect width="${side}" height="37" rx="12" fill="${hue}"/><text x="${side/2}" y="24" text-anchor="middle" fill="${variant==='Soft'?'#17251c':'#ffffff'}" font-size="14" font-family="Arial,sans-serif" font-weight="900">✳ WTINKER</text>`;
 // The decorative heading is placed outside the encoded matrix to preserve its quiet zone.
 const shift=variant==='Minimal'?0:44,full=side+shift;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${full}" width="${side}" height="${full}" role="img" aria-label="QR-код профиля WTinker"><rect width="${side}" height="${full}" rx="15" fill="${bg}"/>${header}<g transform="translate(0 ${shift})">${content}</g></svg>`;
}
export function ProfileQrModal({profile,onClose,editable=false}:{profile:UserProfile;onClose:()=>void;editable?:boolean}){
 const url=profile.username?publicProfileUrl(profile.username):'';
 const storageKey=`workertink:qr-style:${profile.profileId}`;
 const readStyle=()=>{const fallback={shape:'Rounded' as QrShape,fg:'#142a23',bg:'#ffffff',card:'Soft' as QrCard};try{const v=JSON.parse(localStorage.getItem(storageKey)||'{}');return {...fallback,...v}}catch{return fallback}};
 const initial=useMemo(readStyle,[storageKey]);
 const [shape,setShape]=useState<QrShape>(initial.shape),[fg,setFg]=useState(initial.fg),[bg,setBg]=useState(initial.bg),[card,setCard]=useState<QrCard>(initial.card);
 const [notice,setNotice]=useState('');
 const svg=useMemo(()=>url?brandedQrSvg(url,shape,fg,bg,card):'',[url,shape,fg,bg,card]);
 useEffect(()=>{if(!editable)return;try{localStorage.setItem(storageKey,JSON.stringify({shape,fg,bg,card}))}catch{}},[editable,storageKey,shape,fg,bg,card]);
 const download=()=>{if(!svg)return;const obj=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));const a=document.createElement('a');a.href=obj;a.download=`wtinker-${profile.username||'profile'}-branded-qr.svg`;a.click();setTimeout(()=>URL.revokeObjectURL(obj),1500)};
 const copy=async()=>{try{if(!navigator.clipboard?.writeText)throw Error('clipboard');await navigator.clipboard.writeText(url);setNotice('Ссылка скопирована')}catch{setNotice('Скопируйте адрес из поля ниже')}};
 const reset=()=>{setShape('Rounded');setFg('#142a23');setBg('#ffffff');setCard('Soft')};
 if(!url)return null;
 return createPortal(<div className="modal-backdrop qr-modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
  <section className="qr-modal qr-modal-branded" role="dialog" aria-modal="true" aria-labelledby="qr-modal-title">
   <button type="button" className="qr-close" onClick={onClose} aria-label="Закрыть QR"><Icon name="close" size={20}/></button>
   <div className={`qr-card ${card.toLowerCase()}`}><span className="qr-card-label">WTINKER · SCAN TO CONNECT</span><div className="qr-render" data-shape={shape} data-theme={card} dangerouslySetInnerHTML={{__html:svg}}/><strong>@{profile.username}</strong><small>Откройте профиль камерой телефона</small></div>
   <div className="qr-modal-copy"><span className="eyebrow">ПЕРСОНАЛЬНЫЙ QR</span><h2 id="qr-modal-title">Мой код.<br/>Мой стиль.</h2><p>QR открывает публичный профиль @{profile.username}. Дизайн обновляется сразу в предпросмотре.</p>
   {editable?<div className="qr-controls"><label>Форма модулей<select aria-label="Форма QR" value={shape} onChange={e=>setShape(e.target.value as QrShape)}><option value="Square">Квадраты</option><option value="Rounded">Скругления</option><option value="Dots">Точки</option></select></label><label>Цвет кода<input aria-label="Цвет QR" type="color" value={fg} onChange={e=>setFg(e.target.value)}/></label><label>Цвет фона<input aria-label="Фон QR" type="color" value={bg} onChange={e=>setBg(e.target.value)}/></label><label>Оформление<select aria-label="Оформление QR" value={card} onChange={e=>setCard(e.target.value as QrCard)}><option value="Minimal">Чистый</option><option value="Soft">Фирменный</option><option value="Poster">Постер</option></select></label><button type="button" className="btn quiet" onClick={reset}>Сбросить оформление</button></div>:<p className="qr-readonly-note">Редактировать QR может владелец профиля.</p>}
   <label className="qr-share-url">Адрес профиля<input readOnly value={url} onFocus={e=>e.target.select()}/></label>{notice&&<span role="status" className="qr-status">{notice}</span>}
   <div className="modal-actions"><button type="button" className="btn quiet" onClick={()=>void copy()}>Копировать ссылку</button><button type="button" className="btn primary" onClick={download}>Скачать SVG</button></div></div>
  </section>
 </div>,document.body);
}
export function PublicProfileView({username,token,currentProfile,onNotice,onChat}:{username:string;token:string;currentProfile:UserProfile;onNotice:(s:string)=>void;onChat:(id:string)=>void}){const [profile,setProfile]=useState<UserProfile|null>(null);const [loading,setLoading]=useState(true);const [sent,setSent]=useState(false);const [qr,setQr]=useState(false);useEffect(()=>{let cancelled=false;(async()=>{try{const byUsername=await getUserByUsername(username);let full=byUsername.profile;try{const byId=await searchUser(full.profileId);full={...full,...byId.profile}}catch{}if(!cancelled)setProfile(full)}catch{if(!cancelled)setProfile(null)}finally{if(!cancelled)setLoading(false)}})();return()=>{cancelled=true}},[username]);if(loading)return <div className="public-profile-page"><div className="public-profile-card"><span className="eyebrow">WTinker</span><h1>Загружаем профиль…</h1></div></div>;if(!profile)return <div className="public-profile-page"><div className="public-profile-card"><h1>Профиль не найден</h1><p>@{username} не существует или был изменён.</p></div></div>;const self=normalize(currentProfile.profileId)===normalize(profile.profileId);const url=profile.username?publicProfileUrl(profile.username):'';const request=async()=>{if(!token||self||sent)return;try{await sendFriendRequest(currentProfile,profile.profileId,token);setSent(true);onNotice('Заявка отправлена')}catch(e){const code=String(e);onNotice(code.includes('REQUEST_EXISTS')?'Заявка уже существует':code.includes('ALREADY_FRIENDS')?'Вы уже друзья':'Не удалось отправить заявку')}};return <div className="public-profile-page public-profile-rebuilt"><article className="public-profile-card"><div className="public-profile-banner" style={profile.banner?{backgroundImage:`url(${profile.banner})`}:undefined}>{!profile.banner&&<span>WTinker</span>}</div><div className="public-profile-body"><AvatarLike profile={profile}/><span className="redesign-overline">WTinker · публичный профиль</span><h1><ProfileName profile={profile}/></h1><p className="public-username">@{profile.username}</p><p>{profile.position||'Профиль сотрудника'}</p><div className="public-profile-facts"><span>WTinkID <b>{profile.profileId}</b></span><span>Username <b>@{profile.username}</b></span><span>Публичная ссылка <b>{url}</b></span></div><div className="public-profile-actions">{token&&!self&&<button className="btn primary" onClick={()=>void request()} disabled={sent}>{sent?'Заявка отправлена':'Добавить в друзья'}</button>}{token&&!self&&<button className="btn quiet" onClick={()=>onChat(profile.profileId)}>Написать</button>}<button className="btn quiet" onClick={()=>{void navigator.clipboard?.writeText(url);onNotice('Ссылка скопирована')}}>Скопировать ссылку</button>{profile.username&&<button className="btn quiet" onClick={()=>setQr(true)}>Показать QR</button>}</div><section className="public-confirmations"><span className="eyebrow">Подтверждения</span><div>{profile.isOfficial?<span className="confirmation official"><b><Icon name="check" size={11} strokeWidth={2.4}/></b> Официальный аккаунт</span>:null}{profile.isVerified?<span className="confirmation verified"><b><Icon name="check" size={11} strokeWidth={2.4}/></b> Подтверждённый аккаунт</span>:null}{!profile.isOfficial&&!profile.isVerified&&<span className="confirmation muted">Статусы подтверждения отсутствуют</span>}</div></section><section className="public-info"><span className="eyebrow">Публичная информация</span><p>Профиль предназначен для знакомства и рабочих контактов. Публично отображаются только данные, которые владелец профиля разрешил использовать как identity-поля.</p></section></div></article>{qr&&<ProfileQrModal profile={profile} onClose={()=>setQr(false)}/>}</div>}

function normalize(v:string){return v.trim().toUpperCase()}
function AvatarLike({profile}:{profile:UserProfile}){return <div className="public-avatar">{profile.avatar?<img src={profile.avatar} alt="" />:<span>{profile.name.slice(0,1).toUpperCase()||'W'}</span>}</div>}
