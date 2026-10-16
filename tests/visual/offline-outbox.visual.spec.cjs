const {test,expect}=require('@playwright/test');
const {webcrypto}=require('node:crypto');

test('encrypted chat ciphertext stays queued across reload and retries with one stable id',async({browser})=>{
 const sender={profileId:'WTinkID-835501',name:'Отправитель',position:'QA',username:'sender_offline',avatar:'',banner:'',isAdmin:false,isDev:false,isOfficial:false,isVerified:false};
 const friend={profileId:'WTinkID-835502',name:'Получатель',position:'QA',username:'receiver_offline',avatar:'',banner:'',isAdmin:false,isDev:false,isOfficial:false,isVerified:false};
 const keys=await Promise.all([0,1].map(()=>webcrypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveKey'])));
 const own={privateKey:await webcrypto.subtle.exportKey('jwk',keys[0].privateKey),publicKey:await webcrypto.subtle.exportKey('jwk',keys[0].publicKey)};
 const remote=await webcrypto.subtle.exportKey('jwk',keys[1].publicKey);
 for(const viewport of [{width:390,height:844},{width:1440,height:900}]){
  let unavailable=true,attempts=0;
  const seen=new Map();
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(({sender,own})=>{
   localStorage.setItem('workertink:v6',JSON.stringify({schemaVersion:8,profile:sender,setupComplete:true,directoryToken:'outbox-test-token'}));
   localStorage.setItem('workertink:auth-token','outbox-test-token');
   localStorage.setItem('workertink:chat-e2e:v1:'+sender.profileId.toUpperCase(),JSON.stringify(own));
  },{sender,own});
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(!url.hostname.includes('workertink-directory'))return route.continue();
   const path=url.pathname,method=route.request().method();
   const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
   if(path==='/auth/status')return json({profile:sender,setup:null,security:{pinSet:true,onePassAvailable:false}});
   if(path==='/profiles'&&method==='PUT')return json({profile:sender});
   if(path==='/friends')return json({friends:[{profile:friend,addedAt:Date.now(),online:true,lastSeen:Date.now()}]});
   if(path==='/chat/keys/me')return json({key:{profileId:sender.profileId,publicKey:own.publicKey,updatedAt:Date.now()}});
   if(path==='/chat/keys/'+friend.profileId)return json({key:{profileId:friend.profileId,publicKey:remote,updatedAt:Date.now()}});
   if(path==='/chat/messages/'+friend.profileId&&method==='GET')return json({messages:[...seen.values()]});
   if(path==='/chat/messages'&&method==='POST'){
    attempts++;
    if(unavailable)return json({error:'HTTP_503'},503);
    const input=route.request().postDataJSON();
    if(!input.clientMessageId||!JSON.parse(input.body).iv)return json({error:'INVALID_MESSAGE'},400);
    if(!seen.has(input.clientMessageId))seen.set(input.clientMessageId,{id:'server-'+input.clientMessageId,from:sender.profileId,to:friend.profileId,body:input.body,kind:input.kind,createdAt:Date.now(),readAt:null});
    return json({ok:true,message:seen.get(input.clientMessageId)});
   }
   if(path.startsWith('/chat/mute/')&&method==='GET')return json({mute:{mutedUntil:null}});
   if(path.includes('/pins'))return json({pins:[]});
   return json({error:'NOT_FOUND'},404);
  });
  await page.goto('/?tab=chat',{waitUntil:'domcontentloaded'});
  await expect(page.locator('.chat-contact-v2')).toHaveCount(1);
  await page.locator('.chat-contact-v2').click();
  await expect(page.getByRole('textbox',{name:'Текст сообщения'})).toBeEnabled({timeout:10000});
  await page.getByRole('textbox',{name:'Текст сообщения'}).fill('Зашифрованная офлайн-запись');
  await page.getByRole('button',{name:'Отправить сообщение'}).click();
  await expect(page.locator('.wt-pending-icon')).toBeVisible({timeout:12000});
  await expect(page.locator('.message-bubble-v2')).toContainText('Зашифрованная офлайн-запись');
  await page.goto('/?tab=settings',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:/Данные/}).click();
  await expect(page.locator('.wt-offline-queue')).toBeVisible();
  await expect(page.locator('.wt-offline-queue-item')).toHaveCount(1);
  await expect(page.locator('.wt-offline-queue-item')).toContainText(friend.profileId.toUpperCase());
  const records=await page.evaluate(async()=>{
   const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('workertink-offline-outbox');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
   try{return await new Promise((resolve,reject)=>{const tx=db.transaction('chat-messages','readonly');const req=tx.objectStore('chat-messages').getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
   finally{db.close()}
  });
  expect(records).toHaveLength(1);
  expect(records[0].body).not.toContain('Зашифрованная офлайн-запись');
  expect(records[0].id).toMatch(/^[a-f0-9-]{36}$/);
  unavailable=false;
  await page.getByRole('button',{name:'Отправить сейчас'}).click();
  await expect(page.locator('.wt-offline-queue-item')).toHaveCount(0);
  expect(seen.size).toBe(1);
  expect(attempts).toBeGreaterThanOrEqual(2);
  expect(errors).toEqual([]);
  await context.close();
 }
});
