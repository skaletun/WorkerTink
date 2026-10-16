const {test,expect}=require('@playwright/test');
const {webcrypto}=require('node:crypto');
const fs=require('node:fs/promises');

const profile={profileId:'WTinkID-846210',name:'Secure Sync Tester',position:'Developer',username:'secure_sync_tester',avatar:'',banner:'',isDev:false,isAdmin:false,isOfficial:false,isVerified:false};
test('portable E2E recovery: encrypted download, rejected password, safe restoration',async({browser})=>{
 const pair=await webcrypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveKey']);
 const identity={privateKey:await webcrypto.subtle.exportKey('jwk',pair.privateKey),publicKey:await webcrypto.subtle.exportKey('jwk',pair.publicKey)};
 for(const viewport of [{width:390,height:844},{width:1280,height:900}]){
  const context=await browser.newContext({viewport,acceptDownloads:true,colorScheme:'light'});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(String(error)));
  await page.addInitScript(({identity,profile})=>{
   localStorage.setItem('workertink:chat-e2e:v1:'+profile.profileId.toUpperCase(),JSON.stringify(identity));
   localStorage.setItem('workertink:v6',JSON.stringify({schemaVersion:8,profile,setupComplete:true,directoryToken:'secure-sync-test-token'}));
   localStorage.setItem('workertink:auth-token','secure-sync-test-token');
  },{identity,profile});
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(!url.hostname.includes('workertink-directory'))return route.continue();
   const path=url.pathname;
   const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
   if(path==='/auth/status')return json({profile,setup:null,security:{pinSet:true,onePassAvailable:false}});
   if(path==='/chat/keys/me')return json({key:{profileId:profile.profileId,publicKey:identity.publicKey,updatedAt:Date.now()}});
   if(path==='/profiles'&&route.request().method()==='PUT')return json({profile});
   return json({error:'NOT_FOUND'},404);
  });
  await page.goto('/?tab=settings',{waitUntil:'domcontentloaded'});
  const card=page.locator('.wt-e2e-backup-card');
  await expect(card).toBeVisible();
  await card.getByRole('button',{name:'Сохранить ключи'}).click();
  await card.getByLabel('Пароль резервной копии',{exact:true}).fill('A secure backup passphrase 2026');
  await card.getByLabel('Повторите пароль').fill('A secure backup passphrase 2026');
  const waiting=page.waitForEvent('download');
  await card.getByRole('button',{name:'Скачать зашифрованную копию'}).click();
  const download=await waiting;
  expect(download.suggestedFilename()).toMatch(/\.wte2e$/);
  const raw=await fs.readFile(await download.path());
  expect(raw.toString()).not.toContain(identity.privateKey.d);
  await expect(card.getByRole('status')).toContainText('Зашифрованная копия создана');
  await card.getByRole('button',{name:'Восстановить ключи'}).click();
  await card.locator('input[type=file]').setInputFiles({name:'backup.wte2e',mimeType:'application/json',buffer:raw});
  await card.getByLabel('Пароль резервной копии',{exact:true}).fill('Wrong password for file');
  await card.getByRole('button',{name:'Восстановить E2E-ключи'}).click();
  await expect(card.getByRole('alert')).toContainText('Не удалось расшифровать файл');
  await page.evaluate(id=>{
   localStorage.removeItem('workertink:chat-e2e:v1:'+id.toUpperCase());
  },profile.profileId);
  await card.getByLabel('Пароль резервной копии',{exact:true}).fill('A secure backup passphrase 2026');
  await card.getByRole('button',{name:'Восстановить E2E-ключи'}).click();
  await expect(card.getByRole('status')).toContainText('Ключи восстановлены');
  const restored=await page.evaluate(id=>JSON.parse(localStorage.getItem('workertink:chat-e2e:v1:'+id.toUpperCase())||'null'),profile.profileId);
  expect(restored.privateKey.d).toBe(identity.privateKey.d);
  const sizes=await page.evaluate(()=>({width:document.documentElement.scrollWidth,window:innerWidth}));
  expect(sizes.width).toBeLessThanOrEqual(sizes.window+2);
  expect(errors).toEqual([]);
  await context.close();
 }
});
