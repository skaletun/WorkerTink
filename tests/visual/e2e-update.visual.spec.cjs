const {test,expect}=require('@playwright/test');

const id='WTinkID-878787';
const profile={profileId:id,name:'Update Continuity',position:'QA',username:'e2e_update',avatar:'',banner:'',isDev:false,isAdmin:false,isOfficial:false,isVerified:false};

async function vaultIdentity(page){
 return page.evaluate(async id=>{
  const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('workertink-e2e-vault');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
  try{
   const value=await new Promise((resolve,reject)=>{
    const tx=db.transaction('identities','readonly');
    const req=tx.objectStore('identities').get(id.toUpperCase());
    req.onsuccess=()=>resolve(req.result?.identity||null);
    req.onerror=()=>reject(req.error);
   });
   return value;
  }finally{db.close()}
 },id);
}

test('E2E identity survives real app update reload and storage mirror loss',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage();
 let publishedKey=null,rotationAttempts=0;
 await page.addInitScript(({profile})=>{
  localStorage.setItem('workertink:v6',JSON.stringify({schemaVersion:8,setupComplete:true,profile,directoryToken:'e2e-continuity-session'}));
  localStorage.setItem('workertink:auth-token','e2e-continuity-session');
 },{profile});
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(!url.hostname.includes('workertink-directory'))return route.continue();
  const path=url.pathname,method=route.request().method();
  const json=(object,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(object)});
  if(path==='/auth/status')return json({profile,setup:null,security:{pinSet:true,onePassAvailable:false}});
  if(path==='/profiles'&&method==='PUT')return json({profile});
  if(path==='/chat/keys/me')return publishedKey?json({key:{profileId:id,publicKey:publishedKey,updatedAt:Date.now()}}):json({error:'CHAT_KEY_NOT_READY'},404);
  if(path==='/chat/keys'&&method==='PUT'){
   const incoming=route.request().postDataJSON().publicKey;
   if(publishedKey&&(incoming.x!==publishedKey.x||incoming.y!==publishedKey.y)){
    rotationAttempts++;
    return json({error:'CHAT_KEY_ROTATION_BLOCKED'},409);
   }
   publishedKey=incoming;return json({ok:true,key:{profileId:id,publicKey:incoming,updatedAt:Date.now()}});
  }
  if(path==='/friends')return json({friends:[]});
  if(path==='/social/notifications')return json({notifications:[],unread:0});
  return json({error:'NOT_FOUND'},404);
 });
 await page.goto('/?tab=chat',{waitUntil:'domcontentloaded'});
 await expect.poll(()=>Boolean(publishedKey),{timeout:12000}).toBe(true);
 const initial=await vaultIdentity(page);
 expect(initial).not.toBeNull();
 expect(initial.publicKey.x).toEqual(publishedKey.x);
 expect(initial.privateKey.d).toBeTruthy();

 // The web app is rebuilt/reloaded, while the IndexedDB vault persists.
 await page.evaluate(id=>localStorage.removeItem('workertink:chat-e2e:v1:'+id.toUpperCase()),id);
 await page.reload({waitUntil:'domcontentloaded'});
 await expect.poll(async()=>{
  const found=await vaultIdentity(page);
  return found?.publicKey.x===publishedKey?.x;
 },{timeout:12000}).toBe(true);
 expect((await vaultIdentity(page)).privateKey.d).toEqual(initial.privateKey.d);

 // A stale canonical mirror is restored to the server-registered key on boot.
 await page.evaluate(async id=>{
  const pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveKey']);
  const stale={
   privateKey:await crypto.subtle.exportKey('jwk',pair.privateKey),
   publicKey:await crypto.subtle.exportKey('jwk',pair.publicKey)
  };
  localStorage.setItem('workertink:chat-e2e:v1:'+id.toUpperCase(),JSON.stringify(stale));
 },id);
 await page.reload({waitUntil:'domcontentloaded'});
 await expect.poll(async()=>page.evaluate(id=>{
  const mirror=JSON.parse(localStorage.getItem('workertink:chat-e2e:v1:'+id.toUpperCase())||'null');
  return mirror?.publicKey?.x||'';
 },id),{timeout:12000}).toBe(publishedKey.x);
 expect((await vaultIdentity(page)).privateKey.d).toEqual(initial.privateKey.d);
 expect(rotationAttempts).toBe(0);
 await context.close();
});
