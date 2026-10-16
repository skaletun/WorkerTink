const {test,expect}=require('@playwright/test');

test('editorial marketing landing is usable at mobile, tablet and desktop widths',async({browser})=>{
 for(const viewport of [{width:320,height:740},{width:390,height:844},{width:768,height:1024},{width:1440,height:900}]){
  const context=await browser.newContext({viewport,deviceScaleFactor:1,reducedMotion:'reduce'});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  await page.goto('/?welcome=1',{waitUntil:'domcontentloaded'});
  await expect(page.locator('.wt-landing')).toBeVisible();
  await expect(page.getByRole('heading',{level:1})).toHaveText('Рабочие дела.Без лишнего.');
  await expect(page.locator('.wl-feature')).toHaveCount(4);
  await expect(page.locator('.wl-calendar-day')).toHaveCount(7);
  await expect(page.locator('.wl-product-side')).toBeVisible();
  await expect(page.locator('.wl-preview-caption')).toContainText('Демонстрационные данные');
  await expect(page.locator('.wt-landing-ticker')).toHaveCount(0);
  await expect(page.locator('.wt-preview-float')).toHaveCount(0);
  await expect(page.locator('.wl-faq-list details')).toHaveCount(4);
  const faq=page.locator('.wl-faq-list details').first();
  await faq.locator('summary').click();
  await expect(faq).toHaveAttribute('open','');
  await expect(faq.locator('p')).toBeVisible();
  await faq.locator('summary').click();
  await expect(faq).not.toHaveAttribute('open','');

  const measurements=await page.evaluate(()=>{
   const root=document.querySelector('.wt-landing');
   const hero=root.querySelector('.wl-hero-copy');
   const product=root.querySelector('.wl-product');
   const bounds=product.getBoundingClientRect();
   return {overflow:document.documentElement.scrollWidth-window.innerWidth,
    rootOverflow:root.scrollWidth-root.clientWidth,
    headingSize:Number.parseFloat(getComputedStyle(hero.querySelector('h1')).fontSize),
    preview:{left:bounds.left,right:bounds.right},
    featureWidths:[...root.querySelectorAll('.wl-feature')].map(el=>el.getBoundingClientRect().width)};
  });
  expect(measurements.overflow).toBeLessThanOrEqual(2);
  expect(measurements.rootOverflow).toBeLessThanOrEqual(2);
  expect(measurements.headingSize).toBeGreaterThan(39);
  expect(measurements.preview.left).toBeGreaterThanOrEqual(-1);
  expect(measurements.preview.right).toBeLessThanOrEqual(viewport.width+1);
  expect(measurements.featureWidths.every(n=>n>200)).toBe(true);
  expect(errors).toEqual([]);

  const fs=require('node:fs');
  fs.mkdirSync('visual-audit-artifacts',{recursive:true});
  await page.screenshot({path:'visual-audit-artifacts/landing-'+viewport.width+'.png',fullPage:true});
  await expect(page.locator('a[href*="auth=join"]').first()).toHaveAttribute('href','/?auth=join');
  await expect(page.locator('a[href*="auth=login"]').first()).toHaveAttribute('href','/?auth=login');
  await page.locator('.wl-header-actions a[href*="auth=join"]').click();
  await expect(page).toHaveURL(/auth=join/);
  await expect(page.locator('.wt-landing')).toHaveCount(0);
  await context.close();
 }
});
