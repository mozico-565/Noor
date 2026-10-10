import {_android as android} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir='qa49/android';await mkdir(dir,{recursive:true});
const [device]=await android.devices();assert(device,'emulator not connected');
const result={model:device.model(),serial:device.serial(),status:'running',checks:[]};
try{
 await device.shell('am start -n com.noor.quran/.MainActivity');
 const view=await device.webView({pkg:'com.noor.quran'},{timeout:60000});const page=await view.page();
 await page.waitForLoadState('domcontentloaded');
 const shot=async(name)=>{await page.waitForFunction(()=>Array.from(document.images).filter(i=>{const r=i.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight&&r.width>0}).every(i=>i.complete&&i.naturalWidth>0),{},{timeout:10000});await page.evaluate(()=>document.fonts.ready);await device.screenshot({path:`${dir}/${name}.png`})};
 await page.evaluate(()=>{localStorage.setItem('noor_guidance_seen','1');localStorage.setItem('noor_guidance_enabled','0');localStorage.setItem('noor_last_tab','home');localStorage.setItem('noor_last_verse','1:1');});await page.reload();await page.locator('.noorTools').waitFor();await page.locator('.headerContinue').waitFor();await page.evaluate(()=>document.fonts.ready);
 for(const theme of ['light','dark']){
  await page.evaluate(theme=>{localStorage.setItem('noor_theme_mode',theme);localStorage.setItem('noor_last_tab','home');localStorage.removeItem('noor_journey_view')},theme);await page.reload();await page.locator('.noorTools').waitFor();await page.locator('.headerContinue').waitFor();await page.evaluate(()=>document.fonts.ready);
  const bounds=await page.evaluate(()=>({viewport:innerHeight,screen:screen.height,header:document.querySelector('header').getBoundingClientRect().toJSON(),columns:getComputedStyle(document.querySelector('.noorTools')).gridTemplateColumns}));
  assert(bounds.viewport<bounds.screen,'native viewport must exclude system bars');assert(bounds.header.top>=0,'header outside viewport');assert.equal(bounds.columns.split(' ').length,3);
  await shot(`android-${theme}-home`);
  await page.locator('.nav').getByRole('button',{name:'القرآن',exact:true}).click({force:true});await page.locator('.continuousToolbar').waitFor();
  const controls=await page.evaluate(()=>['.surahPickerButton','.continuousToolbar .focusButton','.continuousToolbar .recitationOpen','.continuousToolbar .speedSlider'].map(s=>document.querySelector(s).getBoundingClientRect().toJSON()));assert(controls.every(b=>b.top>=0));assert(controls[0].left<controls[1].left&&controls[1].left<controls[2].left&&controls[2].left<controls[3].left);
  await shot(`android-${theme}-quran`);
  await page.locator('.nav').getByRole('button',{name:'اعرف',exact:true}).click({force:true});await page.locator('.toolTile').filter({hasText:'رحلة نزول القرآن'}).click({force:true});await page.locator('.journey48').waitFor();await shot(`android-${theme}-journey`);
  await page.getByLabel('البحث في رحلة النزول').fill('العلق');await page.locator('[data-journey="96"] .journeyHeading').click({force:true});await page.locator('.journeyDetail').waitFor();await shot(`android-${theme}-detail`);
  await page.getByRole('button',{name:'افتح السورة في المصحف',exact:true}).click({force:true});await page.locator('.journeyReaderReturn').waitFor();await device.shell('input keyevent 4');await page.locator('.journeyDetail').waitFor();
  await device.shell('input keyevent 4');await page.locator('.journeyTimeline48').waitFor();
  await page.getByRole('button',{name:'الخريطة',exact:true}).click({force:true});await page.getByRole('button',{name:'الحجاز',exact:true}).click({force:true});await page.locator('.content').evaluate(e=>{const legend=e.querySelector('.atlasLegend');e.scrollTop+=legend.getBoundingClientRect().top-e.getBoundingClientRect().top-12});await shot(`android-${theme}-map`);
  await page.getByRole('button',{name:'تقدمي',exact:true}).click({force:true});await shot(`android-${theme}-progress`);
  await device.shell('input keyevent 4');await page.locator('.noorTools').waitFor();await page.locator('.headerContinue').waitFor();await page.evaluate(()=>document.fonts.ready);
  result.checks.push({theme,bounds,controls,nativeBack:'reader -> detail -> list -> home'});
 }
 result.status='passed';
}catch(e){result.status='failed';result.error=e.stack;await device.screenshot({path:`dir/FAILURE.png`.replace('dir/',dir+'/')}).catch(()=>{});throw e}
finally{await writeFile(`${dir}/result.json`,JSON.stringify(result,null,2));await device.close()}
