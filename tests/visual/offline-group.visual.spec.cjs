const {test,expect}=require('@playwright/test');
test('Offline First encrypted group queue persists across PWA reload and sends once',async({browser})=>{
 const profile={profileId:'WTinkID-845321',name:'Group Outbox',position:'QA',username:'group_queue',avatar:'',banner:'',isAdmin:false,isDev:false,isOfficial:false,isVerified:false};
 const groupId='group-offline-2026',clientId='deec57fb-5d2e-4dbe-8834-9ff1ae758524';
 for(const viewport of [{width:390,height:844},{width:1440,height:900}]){
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  let serverAvailable=false,requests=0;
  const stored=new Map(),errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  await page.addInitScript(profile=>{
   if(!localStorage.getItem('workertink:v6'))localStorage.setItem('workertink:v6',JSON.stringify({schemaVersion:8,setupComplete:true,profile,directoryToken:'group-outbox-token'}));
   localStorage.setItem('workertink:auth-token','group-outbox-token');
  },profile);
  await page.route('**/*',route=>{
   if(!route.request().url().includes('workertink-directory.workertink-directory.workers.dev'))return route.continue();
   const url=new URL(route.request().url());
   const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
   if(url.pathname==='/auth/status')return json({profile,setup:null,security:{pinSet:true,onePassAvailable:false}});
   if(url.pathname==='/profiles'&&route.request().method()==='PUT')return json({profile});
   if(url.pathname==='/chat/groups/'+groupId+'/messages'&&route.request().method()==='POST'){
    requests++;
    if(!serverAvailable)return json({error:'HTTP_503'},503);
    const input=route.request().postDataJSON();
    if(!input.clientMessageId||!input.body||input.body.includes('Нельзя сохранять открытым текстом'))return json({error:'INVALID_MESSAGE'},400);
    if(!stored.has(input.clientMessageId))stored.set(input.clientMessageId,{id:'server-message',from:profile.profileId,to:groupId,body:input.body,kind:'text',createdAt:Date.now(),readAt:null});
    return json({ok:true,message:stored.get(input.clientMessageId),replayed:requests>1},requests>1?200:201);
   }
   return json({error:'NOT_FOUND'},404);
  });
  await page.goto('/?tab=settings',{waitUntil:'domcontentloaded'});
  await page.evaluate(async({profile,groupId,clientId})=>{
   const secret=crypto.getRandomValues(new Uint8Array(32));
   const key=await crypto.subtle.importKey('raw',secret,{name:'AES-GCM'},false,['encrypt']);
   const iv=crypto.getRandomValues(new Uint8Array(12));
   const clear=new TextEncoder().encode(JSON.stringify({text:'Нельзя сохранять открытым текстом',meta:{}}));
   const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,clear);
   const base64=input=>btoa(Array.from(new Uint8Array(input),x=>String.fromCharCode(x)).join(''));
   const envelope=JSON.stringify({v:1,kind:'text',iv:base64(iv),data:base64(encrypted)});
   const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('workertink-offline-group-outbox',1);request.onupgradeneeded=()=>request.result.createObjectStore('messages',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
   await new Promise((resolve,reject)=>{
    const tx=db.transaction('messages','readwrite');
    tx.objectStore('messages').put({id:clientId,ownerId:profile.profileId.toUpperCase(),groupId,body:envelope,kind:'text',createdAt:Date.now(),attempts:0,nextAttemptAt:0,status:'pending',lastError:''});
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
   });
   db.close();
  },{profile,groupId,clientId});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:/Данные/}).click();
  const card=page.locator('.wt-offline-queue');
  await expect(card).toBeVisible();
  await expect(card.locator('.wt-offline-queue-item')).toHaveCount(1);
  await expect(card.locator('.wt-offline-queue-item')).toContainText('Группа · '+groupId);
  await card.getByRole('button',{name:'Отправить сейчас'}).click();
  await expect(card.locator('.wt-offline-queue-item')).toHaveCount(1);
  serverAvailable=true;
  await card.getByRole('button',{name:'Отправить сейчас'}).click();
  await expect(card.locator('.wt-offline-queue-item')).toHaveCount(0);
  expect(stored.size).toBe(1);
  expect(requests).toBe(2);
  expect(errors).toEqual([]);
  await context.close();
 }
});
