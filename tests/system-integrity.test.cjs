const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'src/App.tsx'),'utf8');
const network=fs.readFileSync(path.join(root,'src/NetworkView.tsx'),'utf8');
const update=fs.readFileSync(path.join(root,'src/UpdateGate.tsx'),'utf8');
const sw=fs.readFileSync(path.join(root,'src/sw.js'),'utf8');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/deploy.yml'),'utf8');

if(!app.includes('syncTabUrl=(next:Tab)=>')) throw new Error('navigation URL sync is missing');
if(!app.includes("window.history.replaceState({},'',url.pathname+url.search+url.hash)")) throw new Error('navigation URL sync does not write browser URL');
if(app.includes('<main className={')) throw new Error('nested main remains inside V7Shell');
if(!app.includes('</div>\n</V7Shell>')) throw new Error('v7 page container is not closed as a div');

if(!network.includes('let coreFailed=0')) throw new Error('network refresh failure isolation is missing');
if(!network.includes('try{const savedRows=await getSavedNetworkPosts(token);setSaved(savedRows.posts)}catch{setSaved([])}')) throw new Error('saved posts must be optional during network refresh');
if(network.includes('Promise.all([getNetworkHome(token),import(\'./directory\').then(m=>m.getSocialFeed(token,60)),getSavedNetworkPosts(token)])')) throw new Error('network refresh still fails atomically on saved posts');

if(!update.includes("if(!('serviceWorker' in navigator)){try{localStorage.setItem(BUILD_STORAGE_KEY,BUILD_ID)}catch{};window.setTimeout(()=>window.location.reload(),250);return;}")) throw new Error('update fallback without Service Worker is missing');
if(!update.includes('WTINKER')) throw new Error('UpdateGate brand was not migrated');

if(!sw.includes("title:'WTinker'")) throw new Error('service worker default notification brand is stale');
if(!workflow.includes('VITE_BUILD_ID: ${{ github.sha }}')) throw new Error('production build ID is not injected');
console.log('WTinker system integrity regression tests: OK');