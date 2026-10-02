const {test,expect}=require('@playwright/test');

const profile={profileId:'WTinkID-214994',name:'Visual Audit',position:'Product engineer',avatar:'',banner:'',username:'visual_audit',isDev:true,isAdmin:true,isOfficial:true,isVerified:true};
const friend=(id,name,username)=>({profile:{profileId:id,name,position:'Сотрудник',avatar:'',username,isDev:false,isAdmin:false,isOfficial:false,isVerified:true},addedAt:Date.now(),lastSeen:Date.now(),online:true});
const state={schemaVersion:8,setupComplete:true,salary:125000,taxRate:13,stage:8,vacTotal:28,startDate:'2026-01-05',scheduleType:'2/2',scheduleShift:'day',scheduleVakhtaMonths:1,schedulePairType:'day-night',vacations:[],sickLeaves:[],holidayCoeff:2,nightExtraPercent:20,advances:{},paymentDates:{},incomeHistory:{},shiftOverrides:{},shiftNotes:{'2026-10-01':'Передача смены: проверить документы и статус оборудования.','2026-09-29':'Рабочая заметка для визуального аудита.'},theme:'light',profile,directoryToken:'visual-audit-token',friends:{'WTinkID-200001':friend('WTinkID-200001','Анна Смирнова','anna_s'),'WTinkID-200002':friend('WTinkID-200002','Дмитрий Орлов','d_orlov')},friendRequestsIncoming:[],friendRequestsOutgoing:[],chats:{},notifications:{enabled:true,friendRequests:true,friendAccepted:true,messages:true,groupMessages:true,channelInvites:true,social:true,events:true,shifts:true,absences:true,payroll:true},onePassEnabled:true};
const appScreens=[['home','Главная'],['social','Лента'],['people','Люди'],['communities','Сообщества'],['chat','Чаты'],['work','Работа'],['notifications','Уведомления'],['calendar','Ваш график'],['pay','Зарплата'],['absence','Отпуск и больничные'],['friends','Контакты'],['profile','Ваш профиль'],['settings','Настройки'],['admin','Админ-панель']];

async function prepare(page,theme){
  await page.addInitScript(({payload})=>{try{localStorage.clear();localStorage.setItem('workertink:v6',JSON.stringify(payload));localStorage.setItem('workertink:auth-token',payload.directoryToken);}catch{}},{payload:{...state,theme}});
  await page.route('**/*',(route)=>{if(route.request().url().includes('workertink-directory.workertink-directory.workers.dev'))return route.abort();return route.continue();});
}

async function audit(page,label){
  await page.waitForTimeout(900);
  await expect(page.locator('#root')).not.toBeEmpty();
  const result=await page.evaluate(()=>{
    const visible=(el)=>{const s=getComputedStyle(el);const r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>0&&r.width>0&&r.height>0};
    const elements=[...document.querySelectorAll('*')].filter(visible);
    const overflows=elements.filter(el=>{
      const r=el.getBoundingClientRect();
      if(!(r.right>window.innerWidth+2||r.left<-2)) return false;
      let node=el.parentElement;
      while(node){
        const s=getComputedStyle(node);
        if(['hidden','clip'].includes(s.overflow)||['hidden','clip'].includes(s.overflowX)||['hidden','clip'].includes(s.overflowY)) return false;
        node=node.parentElement;
      }
      return true;
    }).slice(0,12).map(el=>({tag:el.tagName,cls:String(el.className||''),right:Math.round(el.getBoundingClientRect().right),left:Math.round(el.getBoundingClientRect().left)}));
    const gradients=elements.filter(el=>/gradient\(/i.test(getComputedStyle(el).backgroundImage)).length;
    const buttons=[...document.querySelectorAll('button')].filter(visible);
    const unlabeledIconButtons=buttons.filter(btn=>{const text=btn.textContent?.trim()||'';const label=btn.getAttribute('aria-label')||btn.getAttribute('title');return !text&&!label&&!btn.querySelector('svg')}).length;
    const root=getComputedStyle(document.documentElement);
    return {text:document.body.innerText.trim().length,overflow:document.documentElement.scrollWidth-window.innerWidth,overflows,gradients,unlabeledIconButtons,bg:root.getPropertyValue('--bg').trim(),surface:root.getPropertyValue('--surface').trim()};
  });
  expect(result.text).toBeGreaterThan(20);
  expect(result.overflow).toBeLessThanOrEqual(2);
  expect(result.overflows).toEqual([]);
  expect(result.gradients).toBe(0);
  expect(result.unlabeledIconButtons).toBe(0);
  await page.screenshot({path:'visual-audit-artifacts/'+label+'.png',fullPage:true});
}

test('WTinker authenticated screens — light/dark desktop + mobile',async({browser})=>{
  for(const theme of ['light','dark']){
    for(const [viewport,name] of [[{width:1440,height:900},'desktop'],[{width:390,height:844},'mobile']]){
      for(const [tab,label] of appScreens){
        const context=await browser.newContext({viewport,colorScheme:theme});
        const page=await context.newPage();
        const errors=[];
        page.on('pageerror',error=>errors.push(String(error)));
        await prepare(page,theme);
        await page.goto('?tab='+tab,{waitUntil:'networkidle'});
        await audit(page,theme+'-'+name+'-'+tab);
        expect(errors,theme+'/'+name+'/'+tab+' page errors').toEqual([]);
        await context.close();
      }
    }
  }
});

test('WTinker public/legal/special and registration screens',async({browser})=>{
  for(const theme of ['light','dark']){
    const context=await browser.newContext({viewport:{width:1440,height:900},colorScheme:theme});
    const page=await context.newPage();
    await prepare(page,theme);
    for(const [path,label] of [['/user/visual_audit','public-profile'],['/rules/privacy','privacy'],['/rules/terms','terms'],['/community/visual-community','community-route'],['/chat/group/visual-group','group-chat-route'],['/channel/visual-channel','channel-route']]){
      await page.goto('/?wtRoute='+encodeURIComponent(path),{waitUntil:'networkidle'});
      await audit(page,theme+'-desktop-'+label);
    }
    await context.close();
  }
  for(const [theme,label] of [['light','light'],['dark','dark']]){
    const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:theme});
    const page=await context.newPage();
    await page.addInitScript(()=>localStorage.clear());
    await page.goto('/',{waitUntil:'networkidle'});
    await audit(page,label+'-mobile-registration');
    await context.close();
  }
});

test('WTinker bug-archive interaction states',async({browser})=>{
  const context=await browser.newContext({viewport:{width:1440,height:900},colorScheme:'light'});
  const page=await context.newPage();
  await prepare(page,'light');

  await page.goto('?tab=communities',{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Обмен сменами'}).click();
  await page.waitForTimeout(250);
  await page.screenshot({path:'visual-audit-artifacts/light-desktop-shift-exchange.png',fullPage:true});

  await page.goto('?tab=calendar',{waitUntil:'networkidle'});
  await page.locator('button.calendar-day:not(.pre-start)').first().click();
  await page.waitForTimeout(250);
  await page.screenshot({path:'visual-audit-artifacts/light-desktop-shift-editor.png',fullPage:true});

  await page.goto('?tab=profile',{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'QR-код'}).first().click();
  await page.waitForTimeout(250);
  await page.screenshot({path:'visual-audit-artifacts/light-desktop-profile-qr.png',fullPage:true});

  await context.close();

  const mobile=await browser.newContext({
    viewport:{width:390,height:844},
    colorScheme:'light',
    userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36'
  });
  const mobilePage=await mobile.newPage();
  await mobilePage.addInitScript(({payload})=>{
    try{
      localStorage.clear();
      localStorage.setItem('workertink:v6',JSON.stringify(payload));
      localStorage.setItem('workertink:auth-token',payload.directoryToken);
    }catch{}
  },{payload:state});
  await mobilePage.route('**/*',(route)=>{
    if(route.request().url().includes('workertink-directory.workertink-directory.workers.dev'))return route.abort();
    return route.continue();
  });
  await mobilePage.goto('?tab=home',{waitUntil:'networkidle'});
  await mobilePage.waitForTimeout(300);
  await mobilePage.screenshot({path:'visual-audit-artifacts/android-mobile-pwa.png',fullPage:true});

  await mobilePage.getByRole('button',{name:'Понятно'}).click().catch(()=>{});
  await mobilePage.goto('?tab=calendar',{waitUntil:'networkidle'});
  await mobilePage.getByRole('button',{name:'Понятно'}).click().catch(()=>{});
  await mobilePage.locator('button.calendar-day:not(.pre-start)').first().click();
  await mobilePage.waitForTimeout(250);
  await mobilePage.screenshot({path:'visual-audit-artifacts/android-mobile-shift-editor.png',fullPage:true});

  await mobilePage.getByRole('button',{name:'Закрыть'}).click().catch(()=>{});
  await mobilePage.goto('?tab=profile',{waitUntil:'networkidle'});
  await mobilePage.getByRole('button',{name:'Понятно'}).click().catch(()=>{});
  await mobilePage.getByRole('button',{name:'QR-код'}).first().click();
  await mobilePage.waitForTimeout(250);
  await mobilePage.screenshot({path:'visual-audit-artifacts/android-mobile-profile-qr.png',fullPage:true});

  await mobile.close();
});
