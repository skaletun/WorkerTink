const {test,expect}=require('@playwright/test');
const {webcrypto}=require('node:crypto');
const fs=require('node:fs');

test('Secure Sync: two authorized devices compare codes and transfer encrypted private keys',async({browser})=>{
 const pair=await webcrypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveKey']);
 const identity={privateKey:await webcrypto.subtle.exportKey('jwk',pair.privateKey),publicKey:await webcrypto.subtle.exportKey('jwk',pair.publicKey)};
 const profile={profileId:'WTinkID-625501',name:'Secure Transfer',username:'transfer_test',position:'QA',avatar:'',banner:'',isAdmin:false,isDev:false,isVerified:false,isOfficial:false};
 const id='57ba9ba9-74a4-4bb4-8ecb-659b0023ff22';
 let session=null,privateKeyOnServer=false,payload=null,consumed=false;
 const requester=(route)=>{
  const url=new URL(route.request().url());
  if(!url.hostname.includes('workertink-directory'))return route.continue();
  const token=(route.request().headers()['authorization']||'').replace(/^Bearer /,'');
  const method=route.request().method(),path=url.pathname;
  const answer=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(path==='/auth/status')return answer({profile,setup:null,security:{pinSet:true,onePassAvailable:false}});
  if(path==='/profiles'&&method==='PUT')return answer({profile});
  if(path==='/chat/keys/me')return answer({key:{profileId:profile.profileId,publicKey:identity.publicKey,updatedAt:Date.now()}});
  if(path==='/friends')return answer({friends:[]});
  if(path==='/chat/e2e-transfer'&&method==='POST'){
   session={id,role:'target',createdAt:Date.now(),expiresAt:Date.now()+300000,status:'waiting',targetPublicKey:route.request().postDataJSON().publicKey,sourcePublicKey:null,sourceConfirmed:false,targetConfirmed:false,payloadReady:false};
   return answer({session},201);
  }
  if(path==='/chat/e2e-transfer/'+id){
   if(!session)return answer({error:'TRANSFER_NOT_FOUND'},404);
   if(method==='POST'){
    session.sourcePublicKey=route.request().postDataJSON().publicKey;
    session.status='paired';
    return answer({session:{...session,role:'source'}});
   }
   if(method==='GET')return answer({session:{...session,role:token==='source-token'?'source':'target'}});
   if(method==='DELETE')return answer({ok:true});
  }
  if(path==='/chat/e2e-transfer/'+id+'/confirm'){
   if(token==='source-token')session.sourceConfirmed=true;
   else session.targetConfirmed=true;
   return answer({session:{...session,role:token==='source-token'?'source':'target'}});
  }
  if(path==='/chat/e2e-transfer/'+id+'/payload'){
   if(method==='POST'){
    payload=route.request().postDataJSON().ciphertext;
    privateKeyOnServer=payload.includes(identity.privateKey.d);
    session.payloadReady=true;session.status='ready';
    return answer({session:{...session,role:'source'}});
   }
   if(!session.payloadReady||consumed)return answer({error:'TRANSFER_NOT_READY'},409);
   return answer({ciphertext:payload});
  }
  if(path==='/chat/e2e-transfer/'+id+'/ack'&&method==='POST'){consumed=true;return answer({ok:true})}
  return answer({error:'NOT_FOUND'},404);
 };
 const newContext=await browser.newContext({viewport:{width:390,height:844}});
 const oldContext=await browser.newContext({viewport:{width:1280,height:900}});
 const setup=async(context,token,hasKey)=>{
  const page=await context.newPage();
  await page.addInitScript(({profile,token,hasKey,identity})=>{
   localStorage.setItem('workertink:v6',JSON.stringify({schemaVersion:8,profile,directoryToken:token,setupComplete:true}));
   localStorage.setItem('workertink:auth-token',token);
   if(hasKey)localStorage.setItem('workertink:chat-e2e:v1:'+profile.profileId.toUpperCase(),JSON.stringify(identity));
  },{profile,token,hasKey,identity});
  await page.route('**/*',requester);
  await page.goto('/?tab=settings',{waitUntil:'domcontentloaded'});
  return page;
 };
 const target=await setup(newContext,'target-token',false);
 const source=await setup(oldContext,'source-token',true);
 await expect(target.getByRole('button',{name:'Это новое устройство'})).toBeVisible();
 await target.getByRole('button',{name:'Это новое устройство'}).click();
 await expect(target.locator('.wt-transfer-qr')).toBeVisible();
 await expect(target.locator('input[aria-label="Ссылка переноса"]')).toHaveValue(new RegExp(id));
 await source.getByRole('button',{name:'Перенести с этого устройства'}).click();
 await source.getByRole('textbox',{name:'Код соединения'}).fill(id);
 await source.getByRole('button',{name:'Связать устройства'}).click();
 await expect(source.locator('.wt-transfer-code')).toBeVisible({timeout:12000});
 await expect(target.locator('.wt-transfer-code')).toBeVisible({timeout:12000});
 const code=await source.locator('.wt-transfer-code').textContent();
 expect(code).toBe(await target.locator('.wt-transfer-code').textContent());
 await source.getByRole('textbox',{name:'Подтверждающий код'}).fill(code);
 await source.getByRole('button',{name:'Подтвердить совпадение кодов'}).click();
 await target.getByRole('textbox',{name:'Подтверждающий код'}).fill(code);
 await target.getByRole('button',{name:'Подтвердить совпадение кодов'}).click();
 await expect(source.getByRole('button',{name:'Отправить зашифрованные ключи'})).toBeVisible({timeout:12000});
 await source.getByRole('button',{name:'Отправить зашифрованные ключи'}).click();
 await expect(target.getByRole('button',{name:'Получить и восстановить ключи'})).toBeVisible({timeout:12000});
 await target.getByRole('button',{name:'Получить и восстановить ключи'}).click();
 await expect(target.getByRole('status').filter({hasText:'E2E-ключи восстановлены'})).toBeVisible();
 const restored=await target.evaluate(id=>JSON.parse(localStorage.getItem('workertink:chat-e2e:v1:'+id.toUpperCase())||'null'),profile.profileId);
 expect(restored.privateKey.d).toBe(identity.privateKey.d);
 expect(privateKeyOnServer).toBe(false);
 expect(consumed).toBe(true);
 fs.mkdirSync('visual-audit-artifacts',{recursive:true});
 await target.screenshot({path:'visual-audit-artifacts/e2e-paired-mobile.png'});
 await source.screenshot({path:'visual-audit-artifacts/e2e-paired-desktop.png'});
 await newContext.close();await oldContext.close();
});
