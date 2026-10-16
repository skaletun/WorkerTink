const {test,expect}=require('@playwright/test');
const {webcrypto}=require('node:crypto');

test('PWA worker install, revalidation and reload preserve E2E identity and queued ciphertext',async({browser})=>{
 const profile={profileId:'WTinkID-913447',name:'Update Safety',position:'QA',username:'update_safety',avatar:'',banner:'',isAdmin:false,isDev:false,isOfficial:false,isVerified:false};
 const pair=await webcrypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveKey']);
 const identity={privateKey:await webcrypto.subtle.exportKey('jwk',pair.privateKey),publicKey:await webcrypto.subtle.exportKey('jwk',pair.publicKey)};
 for(const viewport of [{width:390,height:844},{width:1440,height:900}]){
  const context=await browser.newContext({viewport,serviceWorkers:'allow'});
  const page=await context.newPage();
  const failures=[];page.on('pageerror',error=>failures.push(String(error)));
  await page.addInitScript(({profile,identity})=>{
   if(!localStorage.getItem('workertink:v6'))localStorage.setItem('workertink:v6',JSON.stringify({schemaVersion:8,profile,directoryToken:'pwa-update-safety-test',setupComplete:true}));
   if(!localStorage.getItem('workertink:chat-e2e:v1:'+profile.profileId.toUpperCase()))localStorage.setItem('workertink:chat-e2e:v1:'+profile.profileId.toUpperCase(),JSON.stringify(identity));
   localStorage.setItem('workertink:auth-token','pwa-update-safety-test');
  },{profile,identity});
  await page.route('**/*',route=>{
   if(route.request().url().includes('workertink-directory.workertink-directory.workers.dev'))return route.fulfill({status:503,contentType:'application/json',body:'{"error":"SERVICE_UNAVAILABLE"}'});
   return route.continue();
  });
  await page.goto('/?tab=home',{waitUntil:'domcontentloaded'});
  await expect.poll(()=>page.evaluate(async()=>{
   const r=await navigator.serviceWorker.getRegistration();
   return Boolean(r?.active&&navigator.serviceWorker.controller);
  }),{timeout:30000}).toBe(true);
  await page.evaluate(async profile=>{
   const idb=await new Promise((resolve,reject)=>{
    const req=indexedDB.open('workertink-offline-outbox',1);
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('chat-messages'))req.result.createObjectStore('chat-messages',{keyPath:'id'})};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
   });
   const item={id:'b053ed14-e269-40b5-a0e7-468bac9a0be2',ownerId:profile.profileId.toUpperCase(),to:'WTINKID-913448',body:'{"v":1,"kind":"text","iv":"dGVzdGl2","data":"dGVzdGNpcGhlcnRleHQ="}',kind:'text',createdAt:Date.now(),attempts:0,nextAttemptAt:0,status:'blocked',lastError:'TEST_STORED_ONLY'};
   await new Promise((resolve,reject)=>{const tx=idb.transaction('chat-messages','readwrite');tx.objectStore('chat-messages').put(item);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
   idb.close();
  },profile);
  // The browser may revalidate a worker while preserving its private vault.
  await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update()});
  await page.reload({waitUntil:'domcontentloaded'});
  await expect.poll(()=>page.evaluate(async()=>Boolean((await navigator.serviceWorker.getRegistration())?.active)),{timeout:12000}).toBe(true);
  const result=await page.evaluate(async profile=>{
   const saved=JSON.parse(localStorage.getItem('workertink:chat-e2e:v1:'+profile.profileId.toUpperCase())||'null');
   const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('workertink-offline-outbox',1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
   const items=await new Promise((resolve,reject)=>{const tx=db.transaction('chat-messages','readonly');const req=tx.objectStore('chat-messages').getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
   db.close();return {saved,items};
  },profile);
  expect(result.saved.privateKey.d).toBe(identity.privateKey.d);
  expect(result.items).toHaveLength(1);
  expect(result.items[0].body).not.toContain('test readable plaintext');
  expect(failures).toEqual([]);
  await context.close();
 }
});
