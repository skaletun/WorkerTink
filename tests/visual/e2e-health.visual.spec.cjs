const {test,expect}=require('@playwright/test');
const {webcrypto}=require('node:crypto');
test('E2E diagnostics verify locally preserved key and export a secret-free report',async({browser})=>{
 const identityKey=await webcrypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
 const pair={privateKey:await webcrypto.subtle.exportKey('jwk',identityKey.privateKey),publicKey:await webcrypto.subtle.exportKey('jwk',identityKey.publicKey)};
 const profile={profileId:'WTinkID-993528',name:'E2E Diagnostics',username:'e2e_audit',position:'QA',avatar:'',banner:'',isDev:false,isAdmin:false,isOfficial:false,isVerified:false};
 for(const viewport of [{width:390,height:844},{width:1440,height:900}]){
  const context=await browser.newContext({viewport,acceptDownloads:true});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(String(error)));
  let remoteRequests=0;
  await page.addInitScript(({profile,pair})=>{
   const p='workertink:v6';
   if(!localStorage.getItem(p))localStorage.setItem(p,JSON.stringify({schemaVersion:8,setupComplete:true,profile,directoryToken:'e2e-diagnostics-session'}));
   localStorage.setItem('workertink:auth-token','e2e-diagnostics-session');
   localStorage.setItem('workertink:chat-e2e:v1:'+profile.profileId.toUpperCase(),JSON.stringify(pair));
  },{profile,pair});
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(!url.hostname.includes('workertink-directory'))return route.continue();
   const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
   if(url.pathname==='/auth/status')return json({profile,setup:null,security:{pinSet:true,onePassAvailable:false}});
   if(url.pathname==='/profiles'&&route.request().method()==='PUT')return json({profile});
   if(url.pathname==='/chat/keys/me'){
    remoteRequests++;return json({key:{profileId:profile.profileId,publicKey:pair.publicKey}});
   }
   if(url.pathname==='/friends')return json({friends:[]});
   return json({error:'NOT_FOUND'},404);
  });
  await page.goto('/?tab=settings',{waitUntil:'domcontentloaded'});
  const card=page.locator('.wt-e2e-integrity');
  await expect(card).toBeVisible();
  await card.getByRole('button',{name:'Проверить ключи'}).click();
  await expect(card.getByText('Ключ подтверждён сервером')).toBeVisible({timeout:15000});
  await expect(card.getByText('Локальные ключи доступны')).toBeVisible();
  expect(remoteRequests).toBeGreaterThan(0);
  const downloadPromise=page.waitForEvent('download');
  await card.getByRole('button',{name:'Экспорт безопасного отчёта'}).click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toBe('wtinker-e2e-diagnostics.json');
  const fs=require('node:fs/promises');
  const contents=await fs.readFile(await download.path(),'utf8');
  expect(contents).not.toContain(pair.privateKey.d);
  expect(contents).not.toContain(pair.publicKey.x);
  expect(contents).not.toContain('e2e-diagnostics-session');
  expect(contents).not.toContain(profile.profileId);
  expect(JSON.parse(contents).remote).toBe('matched');
  expect(errors).toEqual([]);
  await context.close();
 }
});
