const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
test.setTimeout(90000);
test.use({actionTimeout:10000});
function wav(seconds=60,frequency=220){const rate=22050,samples=seconds*rate;const out=Buffer.alloc(44+samples*2);out.write('RIFF');out.writeUInt32LE(out.length-8,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(1,22);out.writeUInt32LE(rate,24);out.writeUInt32LE(rate*2,28);out.writeUInt16LE(2,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(samples*2,40);for(let i=0;i<samples;i++)out.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*frequency/rate)*700),44+i*2);return out}
const profile={profileId:'WTinkID-845321',name:'Sound QA',position:'QA',username:'sound_qa',avatar:'',banner:'',isAdmin:false,isDev:false,isOfficial:false,isVerified:false};
async function setup(context,theme='light'){
 await context.addInitScript(({profile,theme})=>{if(!localStorage.getItem('workertink:v6'))localStorage.setItem('workertink:v6',JSON.stringify({schemaVersion:8,setupComplete:true,profile,directoryToken:'sound-test-token',theme}));localStorage.setItem('workertink:auth-token','sound-test-token')},{profile,theme});
 await context.route('**/workertink-directory.workertink-directory.workers.dev/**',route=>{const path=new URL(route.request().url()).pathname;const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type, Authorization, X-WTSound-Metadata','Access-Control-Allow-Methods':'GET, POST, PUT, DELETE, OPTIONS'};if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});const json=(value,status=200)=>route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(value)});if(path==='/auth/status')return json({profile,setup:null,security:{pinSet:true,onePassAvailable:false}});if(path==='/profiles')return json({profile});if(path==='/sound/capabilities')return json({cloud:false,vk:false,yandex:false});if(path==='/sound/import')throw new Error('Disabled transfer made a request');return json({error:'NOT_FOUND'},404)});
}
// Existing libraries must stay usable while new imports are unavailable.
async function seedSavedTracks(page,items){
 await page.evaluate(async({items,owner})=>{
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('wtinker-wtsound',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  await new Promise((resolve,reject)=>{const tx=db.transaction('libraries','readwrite');tx.objectStore('libraries').put({tracks:items.map((item,i)=>({id:crypto.randomUUID(),album:'',genre:'',year:0,duration:0,addedAt:Date.now()+i,liked:false,plays:0,lastPlayed:0,...item})),playlists:[]},owner);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close();
 },{items,owner:profile.profileId.toUpperCase()});
 await page.reload();await expect(page.getByRole('region',{name:'WTSound'})).toBeVisible();
}
for(const theme of ['light','dark'])for(const viewport of [{width:390,height:844},{width:1440,height:1000}]){
 test(`WTSound upload playback disabled transfer EQ offline ${theme} ${viewport.width}`,async({browser,browserName})=>{
  const context=await browser.newContext({viewport,colorScheme:theme,serviceWorkers:'block'});await setup(context,theme);const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(String(error)));
  await page.goto('/?tab=sound');await expect(page.getByRole('region',{name:'WTSound'})).toBeVisible();await expect(page.getByRole('heading',{name:'Ваш ритм.' ,exact:false})).toBeVisible();
  await page.getByLabel('Аудиофайлы').setInputFiles([{name:'Artist - First.wav',mimeType:'audio/wav',buffer:wav()},{name:'Artist - Second.wav',mimeType:'audio/wav',buffer:wav(60,330)}]);
  await expect(page.locator('.sound-track')).toHaveCount(2,{timeout:30000});await expect(page.locator('.sound-track').first()).toContainText('Artist');
  await page.getByRole('button',{name:'Слушать: First',exact:true}).click();await expect(page.locator('audio[data-wtsound-audio]')).toHaveCount(1);await expect.poll(()=>page.locator('audio[data-wtsound-audio]').evaluate(a=>!a.paused&&a.currentTime>0)).toBe(true);
  await expect(page.locator('.sound-player')).toContainText('First');await expect(page.locator('.sound-player')).toBeVisible();
  await page.locator('.sound-app').getByRole('button',{name:'В избранное: First',exact:true}).first().click();
  await page.locator('.sound-header').getByRole('button',{name:'Эквалайзер',exact:true}).click();await page.getByLabel('Эквалайзер включён').check();await page.getByLabel('Шаблон', {exact:true}).selectOption('Рок');await expect(page.getByLabel('32 Гц')).toHaveValue('4');await page.getByLabel('32 Гц').fill('7');await expect(page.getByLabel('Шаблон',{exact:true})).toHaveValue('Вручную');
  fs.mkdirSync('visual-audit-artifacts',{recursive:true});await page.screenshot({path:`visual-audit-artifacts/wtsound-eq-${browserName}-${theme}-${viewport.width}.png`});await page.getByRole('dialog').getByRole('button',{name:'Закрыть',exact:true}).click();
  await expect(page.getByRole('button',{name:'Перенести музыку В разработке',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Перенести плейлисты ВК и Яндекс Музыка · В разработке',exact:true})).toBeDisabled();await expect(page.locator('.sound-header-actions')).toContainText('В разработке');await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('.atlas-tray').getByRole('button',{name:'Главная',exact:true}).click();await expect(page.locator('.sound-player')).toContainText('First');await expect.poll(()=>page.locator('audio[data-wtsound-audio]').evaluate(a=>!a.paused)).toBe(true);
  await page.locator('.atlas-tray').getByRole('button',{name:'WTSound',exact:true}).click();await expect(page.getByRole('region',{name:'WTSound'})).toBeVisible();
  await page.screenshot({path:`visual-audit-artifacts/wtsound-home-${browserName}-${theme}-${viewport.width}.png`,fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.reload();await expect(page.locator('.sound-player')).toContainText('First');await page.getByRole('navigation',{name:'Разделы WTSound'}).getByRole('button',{name:/Мне нравится/}).click();await expect(page.locator('.sound-track')).toHaveCount(1);await expect(page.locator('.sound-track')).toContainText('First');
  await context.setOffline(true);await page.getByRole('navigation',{name:'Разделы WTSound'}).getByRole('button',{name:'Скачанное',exact:true}).click();await expect(page.locator('.sound-track')).toHaveCount(2);await page.getByRole('button',{name:'Слушать: Second',exact:true}).click();await expect.poll(()=>page.locator('audio[data-wtsound-audio]').evaluate(a=>({playing:!a.paused&&a.currentTime>0,src:a.src.slice(0,80),error:a.error?.message||'',ready:a.readyState,network:a.networkState}))).toMatchObject({playing:true});await expect(page.locator('.sound-player')).toContainText('Second');
  await page.screenshot({path:`visual-audit-artifacts/wtsound-offline-${browserName}-${theme}-${viewport.width}.png`,fullPage:true});expect(errors).toEqual([]);await context.close();
 });
}
test('WTSound account isolation, playlist editing and real offline PWA restart',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'});await setup(context);const page=await context.newPage();await page.goto('/?tab=sound');await expect(page.getByRole('region',{name:'WTSound'})).toBeVisible();
 await page.getByLabel('Аудиофайлы').setInputFiles({name:'Artist - Offline.wav',mimeType:'audio/wav',buffer:wav(4)});await expect(page.locator('.sound-track')).toHaveCount(1);
 await page.getByRole('navigation',{name:'Разделы WTSound'}).getByRole('button',{name:'Плейлисты',exact:true}).click();await page.getByRole('button',{name:'Создать плейлист',exact:true}).first().click();await page.getByLabel('Название',{exact:true}).fill('My playlist');await page.getByRole('button',{name:'Сохранить',exact:true}).click();await expect(page.getByRole('heading',{name:'My playlist',exact:true})).toBeVisible();
 await page.getByRole('navigation',{name:'Разделы WTSound'}).getByRole('button',{name:'Моя коллекция',exact:true}).click();await page.getByRole('button',{name:'Действия: Offline',exact:true}).click();await page.getByLabel('Добавить в плейлист',{exact:true}).selectOption({label:'My playlist'});await page.getByRole('navigation',{name:'Разделы WTSound'}).getByRole('button',{name:'Плейлисты',exact:true}).click();await page.getByRole('button',{name:/My playlist/}).click();await expect(page.locator('.sound-track')).toHaveCount(1);
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}))});
 await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await expect(page.getByRole('region',{name:'WTSound'})).toBeVisible();await page.getByRole('navigation',{name:'Разделы WTSound'}).getByRole('button',{name:'Скачанное',exact:true}).click();await expect(page.locator('.sound-track')).toHaveCount(1);await page.getByRole('button',{name:'Слушать: Offline',exact:true}).click();await expect.poll(()=>page.locator('audio[data-wtsound-audio]').evaluate(a=>!a.paused)).toBe(true);
 const otherOwner=await page.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('wtinker-wtsound',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});return new Promise(resolve=>{const request=db.transaction('libraries').objectStore('libraries').get('WTINKID-111111');request.onsuccess=()=>{db.close();resolve(request.result)}})});expect(otherOwner).toBeUndefined();await context.close();
});
test('WTSound simultaneous tab uploads retain both files and stop a second player',async({browser})=>{
 const context=await browser.newContext({viewport:{width:1100,height:800}});await setup(context);const first=await context.newPage(),second=await context.newPage();await Promise.all([first.goto('/?tab=sound'),second.goto('/?tab=sound')]);await Promise.all([expect(first.getByRole('region',{name:'WTSound'})).toBeVisible(),expect(second.getByRole('region',{name:'WTSound'})).toBeVisible()]);
 await Promise.all([first.getByLabel('Аудиофайлы').setInputFiles({name:'Artist - A.wav',mimeType:'audio/wav',buffer:wav(8)}),second.getByLabel('Аудиофайлы').setInputFiles({name:'Artist - B.wav',mimeType:'audio/wav',buffer:wav(8,440)})]);
 await expect(first.locator('.sound-track')).toHaveCount(2);await expect(second.locator('.sound-track')).toHaveCount(2);
 await first.getByRole('button',{name:'Слушать: A',exact:true}).click();await expect.poll(()=>first.locator('audio[data-wtsound-audio]').evaluate(a=>!a.paused)).toBe(true);
 await second.getByRole('button',{name:'Слушать: B',exact:true}).click();await expect.poll(()=>first.locator('audio[data-wtsound-audio]').evaluate(a=>a.paused)).toBe(true);await expect.poll(()=>second.locator('audio[data-wtsound-audio]').evaluate(a=>!a.paused)).toBe(true);await context.close();
});
test('WTSound previously saved missing audio can be attached explicitly with unrelated file tags',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844}});await setup(context);const page=await context.newPage();await page.goto('/?tab=sound');await expect(page.getByRole('region',{name:'WTSound'})).toBeVisible();
 await seedSavedTracks(page,[{artist:'Настоящий артист',title:'Нужная запись',duration:4,source:{provider:'vk',id:'old-import'}}]);await expect(page.locator('.sound-track')).toContainText('Нужен аудиофайл');
 await page.getByRole('button',{name:'Действия: Нужная запись',exact:true}).click();await page.getByRole('dialog').locator('input[type=file]').setInputFiles({name:'unrelated-name.wav',mimeType:'audio/wav',buffer:wav(4)});await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:'Слушать: Нужная запись',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Слушать: Нужная запись',exact:true}).click();await expect(page.locator('.sound-player')).toContainText('Настоящий артист');await expect.poll(()=>page.locator('audio[data-wtsound-audio]').evaluate(a=>!a.paused)).toBe(true);await context.close();
});
test('WTSound large collections use bounded rendering and search every track',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await setup(context);const page=await context.newPage();await page.goto('/?tab=sound');await expect(page.getByRole('region',{name:'WTSound'})).toBeVisible();
 await seedSavedTracks(page,Array.from({length:101},(_,i)=>({artist:'Artist',title:'Song '+String(i+1).padStart(4,'0')})));
 await page.getByRole('navigation',{name:'Разделы WTSound'}).getByRole('button',{name:'Моя коллекция',exact:true}).click();await expect(page.locator('.sound-track')).toHaveCount(100);await page.getByRole('button',{name:'Показать ещё · 1',exact:true}).click();await expect(page.locator('.sound-track')).toHaveCount(101);await page.getByRole('searchbox',{name:'Поиск музыки'}).fill('Song 0101');await expect(page.locator('.sound-track')).toHaveCount(1);await expect(page.locator('.sound-track')).toContainText('Song 0101');await context.close();
});

test('WTSound discovers a CC audio file, imports locally and keeps attribution',async({browser})=>{
 const context=await browser.newContext({viewport:{width:900,height:800},serviceWorkers:'block'});
 await setup(context);
 await context.route('https://api.openverse.org/v1/audio/**',route=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({next:null,results:[{id:'openverse-demo',title:'Free Sample',creator:'Demo Artist',url:'https://assets.example.net/demo.wav',foreign_landing_url:'https://assets.example.net/credits',license:'by',license_url:'https://creativecommons.org/licenses/by/4.0/',filetype:'wav',filesize:90000,mature:false,attribution:'Demo Artist · CC BY 4.0'}]})}));
 await context.route('https://assets.example.net/demo.wav',route=>route.fulfill({status:200,contentType:'audio/wav',headers:{'access-control-allow-origin':'*'},body:wav(1)}));
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?tab=sound');
 await page.locator('.sound-navigation').getByRole('button',{name:'Поиск музыки'}).click();
 await page.getByRole('combobox',{name:'Источник поиска'}).selectOption('openverse');
 await page.getByRole('searchbox',{name:'Название, исполнитель или жанр'}).fill('demo');
 await page.locator('.sound-discover-form').getByRole('button',{name:'Найти'}).click();
 await expect(page.locator('.sound-discover-result')).toHaveCount(1);
 await expect(page.locator('.sound-discover-result')).toContainText('Demo Artist');
 await page.getByRole('button',{name:'Добавить в медиатеку'}).click();
 await expect(page.locator('.sound-discover-result')).toContainText('Добавлено ✓',{timeout:20000});
 await page.locator('.sound-navigation').getByRole('button',{name:'Моя коллекция'}).click();
 await expect(page.locator('.sound-track')).toHaveCount(1);
 await expect(page.locator('.sound-track')).toContainText('Free Sample');
 await page.getByRole('button',{name:'Действия: Free Sample'}).click();
 await expect(page.getByRole('link',{name:'Источник записи'})).toHaveAttribute('href','https://assets.example.net/credits');
 await expect(page.getByRole('link',{name:'Условия лицензии'})).toHaveAttribute('href','https://creativecommons.org/licenses/by/4.0/');
 expect(errors).toEqual([]);
 await context.close();
});

test('WTSound iPhone Files picker accepts MP3 and WAV in collection and missing-audio attachment',async({browser,browserName})=>{
 const context=await browser.newContext({
  viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,serviceWorkers:'block',
  userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'
 });
 await setup(context);
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(String(error)));
 await page.goto('/?tab=sound');
 await expect(page.getByRole('region',{name:'WTSound'})).toBeVisible();
 await expect(page.locator('.sound-upload-hint')).toContainText('Файлы');
 const batch=page.getByLabel('Аудиофайлы');
 expect(await batch.evaluate(input=>input.hasAttribute('accept'))).toBe(false);
 const chooserPromise=page.waitForEvent('filechooser');
 await page.locator('.sound-header-actions').getByRole('button',{name:'Загрузить треки'}).click();
 const chooser=await chooserPromise;expect(chooser.isMultiple()).toBe(true);
 await chooser.setFiles([
  {name:'Artist - Phone.wav',mimeType:'audio/wav',buffer:wav(2)},
  {name:'Artist - MP3.mp3',mimeType:'audio/mpeg',buffer:Buffer.from([73,68,51,3,0,0,0,0,0,0,255,251,144,100,0,0,0,0])}
 ]);
 await expect(page.locator('.sound-track')).toHaveCount(2,{timeout:30000});
 await expect(page.locator('.sound-track')).toContainText('Phone');
 await expect(page.locator('.sound-track')).toContainText('MP3');
 await seedSavedTracks(page,[{artist:'Imported',title:'Missing Song',duration:2,source:{provider:'file',id:'old'}}]);
 await page.getByRole('button',{name:'Действия: Missing Song'}).click();
 const attach=page.getByRole('dialog').locator('input[type=file]');
 expect(await attach.evaluate(input=>input.hasAttribute('accept'))).toBe(false);
 const attachChooserPromise=page.waitForEvent('filechooser');
 await page.getByRole('dialog').getByText('Добавить аудиофайл').click();
 const attachChooser=await attachChooserPromise;expect(attachChooser.isMultiple()).toBe(false);
 await attachChooser.setFiles({name:'recovered.wav',mimeType:'audio/wav',buffer:wav(2,440)});
 await expect(page.getByRole('dialog')).toHaveCount(0,{timeout:20000});
 await expect(page.getByRole('button',{name:'Слушать: Missing Song'})).toBeEnabled();
 expect(errors).toEqual([]);
 await context.close();
});
