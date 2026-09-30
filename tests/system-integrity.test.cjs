const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'src/App.tsx'),'utf8');
const network=fs.readFileSync(path.join(root,'src/NetworkView.tsx'),'utf8');
const update=fs.readFileSync(path.join(root,'src/UpdateGate.tsx'),'utf8');
const sw=fs.readFileSync(path.join(root,'src/sw.js'),'utf8');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/deploy.yml'),'utf8');
const home=fs.readFileSync(path.join(root,'src/HomeView.tsx'),'utf8');
const notifications=fs.readFileSync(path.join(root,'src/NotificationsView.tsx'),'utf8');
const chats=fs.readFileSync(path.join(root,'src/ChatsHub.tsx'),'utf8');
const chat=fs.readFileSync(path.join(root,'src/ChatView.tsx'),'utf8');
const work=fs.readFileSync(path.join(root,'src/WorkHubView.tsx'),'utf8');
const rebuildCss=fs.readFileSync(path.join(root,'src/rebuild.css'),'utf8');

for(const x of ['redesign-home','Ваш график','Сценарий выплаты','Резервная копия']) if(!home.includes(x)) throw new Error('rebuilt home surface missing '+x);
for(const x of ['redesign-notifications','notification-timeline','timeline-item']) if(!notifications.includes(x)) throw new Error('rebuilt notification surface missing '+x);
for(const x of ['redesign-chats','chats-mode-nav','Формат разговора']) if(!chats.includes(x)) throw new Error('rebuilt chats surface missing '+x);
if(!chat.includes('chat-page-rebuilt')) throw new Error('rebuilt personal chat surface missing');
if(!chat.includes('is-empty')) throw new Error('chat empty-state contract missing');
if(!work.includes('redesign-work')) throw new Error('rebuilt work surface missing');
if(!rebuildCss.includes('.v7-work-page.calendar-layout>.v7-page-header')) throw new Error('calendar header grid fix missing');
if(!rebuildCss.includes('.redesign-chats .chats-mode-nav button')) throw new Error('chat mode tab styling missing');
if(!rebuildCss.includes('.v7-work-page.calendar-layout{display:grid!important')) throw new Error('calendar two-column grid contract missing');
if(!network.includes('PostAttachment')||!network.includes('shift-note-editor')||!network.includes('post-attachments-v2')) throw new Error('rich post surface missing');
if(!app.includes('Добавить баннер')||!app.includes('profile.username')||!app.includes('searchUser(profile.profileId)')) throw new Error('profile customization or username fallback missing');
for(const x of ['.redesign-page-intro','.home-snapshot','.network-layout-v2','.notification-timeline','.chat-page-rebuilt','.redesign-work']) if(!rebuildCss.includes(x)) throw new Error('rebuilt design token missing '+x);

if(!app.includes('syncTabUrl=(next:Tab)=>')) throw new Error('navigation URL sync is missing');
if(!app.includes("const openChat=(profileId:string)=>{syncTabUrl('chat')")) throw new Error('chat navigation does not use the canonical URL sync');
if(!app.includes("window.history.replaceState({},'',url.pathname+url.search+url.hash)")) throw new Error('navigation URL sync does not write browser URL');
if(app.includes('<main className={')) throw new Error('nested main remains inside V7Shell');
if(!app.includes('</div>\n</V7Shell>')) throw new Error('v7 page container is not closed as a div');
if(!app.includes("message.includes('UNAUTHORIZED')||message.includes('HTTP_401')")) throw new Error('expired-session recovery is missing');
if(!app.includes("directoryToken:'',onePassEnabled:false")) throw new Error('expired-session recovery does not clear credentials');

if(!network.includes('Promise.allSettled([getNetworkHome(token)')) throw new Error('network refresh failure isolation is missing');
if(!network.includes("if(savedResult.status==='fulfilled')setSaved(savedResult.value.posts);else setSaved([])")) throw new Error('saved posts must be optional during network refresh');
if(network.includes('Promise.all([getNetworkHome(token),import(\'./directory\').then(m=>m.getSocialFeed(token,60)),getSavedNetworkPosts(token)])')) throw new Error('network refresh still fails atomically on saved posts');

if(!update.includes("if(!('serviceWorker' in navigator)){try{localStorage.setItem(BUILD_STORAGE_KEY,BUILD_ID)}catch{};window.setTimeout(()=>window.location.reload(),250);return;}")) throw new Error('update fallback without Service Worker is missing');
if(!update.includes('WTINKER')) throw new Error('UpdateGate brand was not migrated');

if(!sw.includes("title:'WTinker'")) throw new Error('service worker default notification brand is stale');
if(!workflow.includes('VITE_BUILD_ID: ${{ github.sha }}')) throw new Error('production build ID is not injected');
console.log('WTinker system integrity regression tests: OK');