const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const app=fs.readFileSync(path.join(root,'src/App.tsx'),'utf8');
const network=fs.readFileSync(path.join(root,'src/NetworkView.tsx'),'utf8');
const networkParts=fs.readFileSync(path.join(root,'src/views/network/NetworkParts.tsx'),'utf8');
const channels=fs.readFileSync(path.join(root,'src/ChannelsView.tsx'),'utf8');
const spaceControls=fs.readFileSync(path.join(root,'src/SpaceControls.tsx'),'utf8');
const uiEntry=fs.readFileSync(path.join(root,'src/ui.css'),'utf8');
const ui=uiEntry.replace(/@import\s+['"](.+?)['"]\s*;/g,(_,file)=>fs.readFileSync(path.resolve(root,'src',file),'utf8'));
const update=fs.readFileSync(path.join(root,'src/UpdateGate.tsx'),'utf8');
const pull=fs.readFileSync(path.join(root,'src/PullToRefresh.tsx'),'utf8');
const shell=fs.readFileSync(path.join(root,'src/AppShell.tsx'),'utf8');
if(fs.existsSync(path.join(root,'src/V7Shell.tsx'))) throw new Error('legacy V7 shell file still exists');
const sw=fs.readFileSync(path.join(root,'src/sw.js'),'utf8');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/deploy.yml'),'utf8');
const packageJson=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));

const profileViews=fs.readFileSync(path.join(root,'src/views/profile/ProfileViews.tsx'),'utf8');
const authViews=fs.readFileSync(path.join(root,'src/views/auth/AuthViews.tsx'),'utf8');
const adminView=fs.readFileSync(path.join(root,'src/views/admin/AdminView.tsx'),'utf8');
const peopleViews=fs.readFileSync(path.join(root,'src/views/people/PeopleViews.tsx'),'utf8');
const workViews=fs.readFileSync(path.join(root,'src/views/work/WorkViews.tsx'),'utf8');
const settingsView=fs.readFileSync(path.join(root,'src/views/settings/SettingsView.tsx'),'utf8');
const shiftEditor=fs.readFileSync(path.join(root,'src/views/work/ShiftEditor.tsx'),'utf8');
const appShared=fs.readFileSync(path.join(root,'src/app/AppShared.tsx'),'utf8');
const appFeatures=[profileViews,authViews,adminView,peopleViews,workViews,settingsView,shiftEditor,appShared].join('\n');
const home=fs.readFileSync(path.join(root,'src/HomeView.tsx'),'utf8');
const notifications=fs.readFileSync(path.join(root,'src/NotificationsView.tsx'),'utf8');
const chats=fs.readFileSync(path.join(root,'src/ChatsHub.tsx'),'utf8');
const chat=fs.readFileSync(path.join(root,'src/ChatView.tsx'),'utf8');
const groupChat=fs.readFileSync(path.join(root,'src/GroupChatView.tsx'),'utf8');
if(!shell.includes('atlas-app')||!shell.includes('atlas-launcher')||!shell.includes('atlas-tray')) throw new Error('fullscreen atlas navigation missing');
if(!ui.includes('.atlas-app')||!ui.includes('.atlas-orbit-ring')||!ui.includes('.atlas-app-grid')) throw new Error('atlas spatial design system missing');
if(!ui.includes('.social-hero')||!ui.includes('.work-kpis')||!ui.includes('.notification-timeline')) throw new Error('new page design system missing');
for(const legacy of ['styles.css','design.css','v7.css','rebuild.css']) if(fs.existsSync(path.join(root,'src',legacy))) throw new Error(`legacy stylesheet remains: ${legacy}`);
if(!appFeatures.includes('BannerEditorModal')) throw new Error('profile banner editor missing');
if(!appFeatures.includes('Скопировать ссылку')) throw new Error('profile link copy action missing');
if(!networkParts.includes('Обложка')) throw new Error('community customization UI missing');
if(!channels.includes('Оформить канал')) throw new Error('channel customization UI missing');
if(!spaceControls.includes('SpaceIconPicker')||!spaceControls.includes('SpaceThemePicker')) throw new Error('space picker controls missing');
if(!channels.includes('canManage')||!channels.includes('deleteCompanyChannel')) throw new Error('channel owner guard missing');
if(!networkParts.includes('SpaceIconPicker')||!networkParts.includes('SpaceThemePicker')||!networkParts.includes('Удалить сообщество')) throw new Error('community owner customization controls missing');
if(!ui.includes('.profile-cover{')||!ui.includes('background-size:cover')) throw new Error('profile banner rendering CSS fix missing');
if(!appFeatures.includes('deleteNetworkGroup')||!appFeatures.includes('deleteCompanyChannel')) throw new Error('admin space moderation actions missing');
if(!networkParts.includes('post-attachment-v2')) throw new Error('flexible post attachment rendering missing');
const work=fs.readFileSync(path.join(root,'src/WorkHubView.tsx'),'utf8');
const rebuildCss=ui;

for(const x of ['atlas-home','atlas-world','atlas-orbit-ring','atlas-app-grid','atlas-lab','scenarioSalary','plannedVacation','encryptBackup']) if(!home.includes(x)) throw new Error('new workday home surface missing '+x);
for(const x of ['redesign-notifications','notification-timeline','timeline-item']) if(!notifications.includes(x)) throw new Error('rebuilt notification surface missing '+x);
for(const x of ['wt-chat-workspace','wt-chat-mode-tabs','onExit','initialPeerId']) if(!chats.includes(x)) throw new Error('fullscreen messenger navigation missing '+x);
if(!app.includes("onExit={()=>navigate('home')}")||!app.includes("initialPeerId={chatTargetId}")) throw new Error('messenger routing is not integrated with App');
if(!chat.includes('wt-compose-inputrow')||!chat.includes('wt-chat-attach-menu')||!chat.includes('wt-chat-emoji-menu')) throw new Error('Telegram-style composer controls are missing');
if(!ui.includes('.atlas-app.atlas-chat-mode')||!ui.includes('.chat-shell-v2.has-selection .chat-main-v2')) throw new Error('dedicated responsive messenger layout is missing');
if(!chat.includes('chat-page-rebuilt')) throw new Error('rebuilt personal chat surface missing');
if(!groupChat.includes('URL.revokeObjectURL')||!groupChat.includes('mediaUrlsRef')) throw new Error('group chat media object URL cleanup missing');
if(!chat.includes('is-empty')) throw new Error('chat empty-state contract missing');
if(!work.includes('redesign-work')||!work.includes('wt-operations-calendar-grid')||!work.includes('wt-operations-upcoming')) throw new Error('dispatch-room structure missing');
if(!shell.includes('atlas-launcher-groups')||!shell.includes('atlas-route-stage')) throw new Error('spatial launcher architecture missing');
if(!network.includes('wt-network-index')||!network.includes('wt-network-content')) throw new Error('social studio structure missing');
if(!workViews.includes('wt-pay-console-statement')||!workViews.includes('wt-pay-console-sidebar')) throw new Error('financial statement architecture missing');
if(!/\.calendar-layout\s*\{[^}]*display\s*:\s*grid/.test(ui)) throw new Error('new calendar layout missing');
if(!/\.atlas-tray\s*\{[^}]*position\s*:\s*fixed/.test(ui)) throw new Error('floating atlas tray missing');
if(!/\.social-layout\s*\{[^}]*display\s*:\s*grid/.test(ui)) throw new Error('new social layout missing');
if(!/\.work-grid\s*\{[^}]*display\s*:\s*grid/.test(ui)) throw new Error('new work layout missing');
if(!networkParts.includes('PostAttachment')||!network.includes('shift-note-editor')||!networkParts.includes('post-attachments-v2')||!networkParts.includes('groupAttachments')) throw new Error('rich post surface missing');
if(!appFeatures.includes('Добавить баннер')||!appFeatures.includes('profile.username')||!appFeatures.includes('searchUser(profile.profileId)')) throw new Error('profile customization or username hydration missing');
for(const x of ['.redesign-page-intro','.home-snapshot','.notification-timeline','.chat-page-rebuilt','.work-grid']) if(!ui.includes(x)) throw new Error('new page token missing '+x);

if(!app.includes('syncTabUrl=(next:Tab)=>')) throw new Error('navigation URL sync is missing');
if(!app.includes("const openChat=(profileId:string)=>{syncTabUrl('chat')")) throw new Error('chat navigation does not use the canonical URL sync');
if(!app.includes("window.history.replaceState({},'',url.pathname+url.search+url.hash)")) throw new Error('navigation URL sync does not write browser URL');
if(!app.includes("message.includes('UNAUTHORIZED')||message.includes('HTTP_401')")) throw new Error('expired-session recovery is missing');
if(!app.includes("directoryToken:'',onePassEnabled:false")) throw new Error('expired-session recovery does not clear credentials');

if(!network.includes('Promise.allSettled([getNetworkHome(token)')) throw new Error('network refresh failure isolation is missing');
if(!network.includes("if(savedResult.status==='fulfilled')setSaved(savedResult.value.posts);else setSaved([])")) throw new Error('saved posts must be optional during network refresh');
if(network.includes('Promise.all([getNetworkHome(token),import(\'./directory\').then(m=>m.getSocialFeed(token,60)),getSavedNetworkPosts(token)])')) throw new Error('network refresh still fails atomically on saved posts');

if(!update.includes("updateSWRef.current(true)")) throw new Error('PWA update must activate the waiting worker and reload');
if(!update.includes('onRegisteredSW(swUrl,registration)')) throw new Error('PWA update registration lifecycle hook is missing');
if(!update.includes("cache:'no-store'")) throw new Error('PWA update check must bypass HTTP cache');
if(!update.includes("'cache-control':'no-cache'")) throw new Error('PWA update check must send no-cache header');
if(update.includes("updateSWRef.current(false)")) throw new Error('PWA update must not leave the worker waiting after confirmation');
if(!update.includes("localStorage.setItem(BUILD_STORAGE_KEY,BUILD_ID)")) throw new Error('current build marker must be reconciled after update');
if(!update.includes('dismissUpdate')||!update.includes('setNeedRefresh(false)')) throw new Error('update dialog must support dismissal and recover after installation');
if(!sw.includes("event.data?.type==='SKIP_WAITING'")||!sw.includes('self.skipWaiting()')) throw new Error('custom prompt service worker missing SKIP_WAITING handler');
if(!update.includes('WTINKER')) throw new Error('UpdateGate brand was not migrated');
if(!pull.includes('EDGE_START')||!pull.includes('TRIGGER_DISTANCE')) throw new Error('PWA pull-to-refresh thresholds missing');
if(!pull.includes("display-mode: standalone")) throw new Error('pull-to-refresh must be PWA-only');
if(!pull.includes("event.preventDefault()")) throw new Error('pull-to-refresh must suppress native overscroll while pulling');
if(!pull.includes("window.location.reload()")) throw new Error('pull-to-refresh reload action missing');
if(!pull.includes('pull-refresh-indicator')||!pull.includes("setPhase('refreshing')")) throw new Error('pull-to-refresh animated indicator missing');


if(!sw.includes("title:'WTinker'")) throw new Error('service worker default notification brand is stale');
if(packageJson.scripts?.api!=='npm run directory:dev') throw new Error('root api script must use the production-equivalent Directory API');
if(fs.existsSync(path.join(root,'directory-api/.wrangler'))) throw new Error('tracked local Wrangler state must not be present in repository');
if(fs.existsSync(path.join(root,'tsconfig.tsbuildinfo'))) throw new Error('generated TypeScript build info must not be tracked');
if(!workflow.includes('VITE_BUILD_ID: ${{ github.sha }}')) throw new Error('production build ID is not injected');
console.log('WTinker system integrity regression tests: OK');
// The generated logo is shipped to all browser, iOS and desktop icon paths.
for(const name of ['public/icon-256.png','public/apple-touch-icon.png','build/icons/icon.png','build/icons/icon.ico','public/icon.svg','icon.svg'])if(!fs.existsSync(path.join(root,name)))throw new Error('Missing branded icon asset: '+name);
if(!fs.readFileSync(path.join(root,'index.html'),'utf8').includes('icon-256.png'))throw new Error('Website favicon is not the generated icon');
if(!fs.readFileSync(path.join(root,'src/AppShell.tsx'),'utf8').includes('src="./icon-256.png"'))throw new Error('Application header is missing generated logo');


// Community detail must remain a single-column mobile page and its owner editor
// must mount outside the animated route container.
const groupParts=fs.readFileSync(path.join(root,'src/views/network/NetworkParts.tsx'),'utf8');
const mobileGroups=fs.readFileSync(path.join(root,'src/styles/136-community-mobile.css'),'utf8');
if(!groupParts.includes('community-admin-backdrop')||!groupParts.includes('createPortal(')||!groupParts.includes('document.body)'))throw new Error('Community owner settings must use a separate modal portal');
if(!mobileGroups.includes('.community-detail-grid{grid-template-columns:minmax(0,1fr)!important')||!mobileGroups.includes('.community-composer'))throw new Error('Community mobile layout must prevent horizontal overflow');
if(!fs.readFileSync(path.join(root,'src/styles/131-atlas-stories.css'),'utf8').includes("136-community-mobile.css"))throw new Error('Community mobile fix must be included in production styles');
