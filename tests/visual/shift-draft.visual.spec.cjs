const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const profile={profileId:'WTinkID-610028',name:'Shift Draft Test',position:'Operator',username:'shift_draft_test',avatar:'',banner:'',isAdmin:false,isDev:false,isOfficial:false,isVerified:false};
const initial={
 schemaVersion:8,setupComplete:true,salary:80000,taxRate:13,stage:3,vacTotal:28,startDate:'2026-01-05',
 scheduleType:'2/2',scheduleShift:'day',scheduleVakhtaMonths:1,schedulePairType:'day-night',
 vacations:[],sickLeaves:[],holidayCoeff:2,nightExtraPercent:20,advances:{},paymentDates:{},incomeHistory:{},
 shiftOverrides:{},shiftNotes:{},theme:'light',profile,directoryToken:'shift-draft-session',
 friends:{},friendRequestsIncoming:[],friendRequestsOutgoing:[],chats:{},notifications:{enabled:true}
};
test('offline shift draft recovers after reload and only clears after durable Save',async({browser})=>{
 for(const [viewport,theme] of [[{width:390,height:844},'light'],[{width:1440,height:900},'dark']]){
  const context=await browser.newContext({viewport,colorScheme:theme});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(data=>{
   localStorage.setItem('workertink:v6',JSON.stringify({...data.initial,theme:data.theme}));
   localStorage.setItem('workertink:auth-token','shift-draft-session');
  },{initial,theme});
  await page.route('**/*',route=>{
   if(route.request().url().includes('workertink-directory.workertink-directory.workers.dev'))return route.abort();
   return route.continue();
  });
  await page.goto('/?tab=calendar',{waitUntil:'domcontentloaded'});
  const calendar=page.locator('button.calendar-day:not(.pre-start)').first();
  await expect(calendar).toBeVisible();
  const title=await calendar.getAttribute('title');
  await calendar.click();
  const editor=page.locator('.shift-modal .markdown-editor');
  await expect(editor).toBeVisible();
  const modal=page.locator('.shift-modal');
  const selectedDate=(await modal.locator('#shift-editor-title').textContent()).trim();
  await editor.fill('Незавершённая запись перед обновлением');
  await expect(modal.locator('.editor-label')).toContainText('Черновик сохранён',{timeout:6000});
  const key='workertink:shift-draft:v1:'+profile.profileId.toUpperCase()+':'+selectedDate;
  const before=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
  expect(before.note).toBe('Незавершённая запись перед обновлением');
  expect(before.phase).toBe('editing');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('button.calendar-day:not(.pre-start)').first().click();
  await expect(page.locator('.shift-modal .markdown-editor')).toContainText('Незавершённая запись перед обновлением');
  await expect(page.locator('.shift-modal .editor-label')).toContainText('Черновик восстановлен');
  await page.locator('.shift-modal .modal-actions').getByRole('button',{name:'Сохранить'}).click();
  await expect(page.locator('.shift-modal')).toHaveCount(0);
  await expect.poll(async()=>page.evaluate(({date,key})=>{
   const state=JSON.parse(localStorage.getItem('workertink:v6')||'{}');
   return state.shiftNotes?.[date]||'';
  },{date:selectedDate,key}),{timeout:7000}).toBe('Незавершённая запись перед обновлением');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('button.calendar-day:not(.pre-start)').first().click();
  await expect(page.locator('.shift-modal .markdown-editor')).toContainText('Незавершённая запись перед обновлением');
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBeNull();
  await page.locator('.shift-modal .markdown-editor').fill('Этот черновик пользователь отменит');
  await expect(page.locator('.shift-modal .editor-label')).toContainText('Черновик сохранён');
  await page.locator('.shift-modal .modal-actions').getByRole('button',{name:'Отмена'}).click();
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBeNull();
  fs.mkdirSync('visual-audit-artifacts',{recursive:true});
  await page.screenshot({path:'visual-audit-artifacts/shift-draft-'+theme+'.png'});
  expect(errors).toEqual([]);
  await context.close();
 }
});
