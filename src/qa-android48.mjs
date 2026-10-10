import {_android as android} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir='qa48/android';await mkdir(dir,{recursive:true});
const [device]=await android.devices();assert(device,'emulator not connected');
const result={model:device.model(),serial:device.serial(),status:'running',checks:[]};
try{
 await device.shell('am start -n com.noor.quran/.MainActivity');
 const view=await device.webView({pkg:'com.noor.quran'},{timeout:60000});const page=await view.page();
 await page.waitForLoadState('domcontentloaded');
 await page.evaluate(()=>{localStorage.setItem('noor_guidance_seen','1');localStorage.setItem('noor_guidance_enabled','0');localStorage.setItem('noor_last_tab','home');localStorage.setItem('noor_last_verse','1:1');});await page.reload();await page.locator('.noorTools').waitFor();
 for(const theme of ['light','dark']){
  await page.evaluate(theme=>{localStorage.setItem('noor_theme_mode',theme);localStorage.setItem('noor_last_tab','home')},theme);await page.reload();await page.locator('.noorTools').waitFor();
  const bounds=await page.evaluate(()=>({viewport:innerHeight,screen:screen.height,header:document.querySelector('header').getBoundingClientRect().toJSON(),columns:getComputedStyle(document.querySelector('.noorTools')).gridTemplateColumns}));
  assert(bounds.viewport<bounds.screen,'native viewport must exclude system bars');assert(bounds.header.top>=0,'header outside viewport');assert.equal(bounds.columns.split(' ').length,3);
  await device.screenshot({path:`${dir}/android-${theme}-home.png`});
  await page.locator('.nav').getByRole('button',{name:'القرآن',exact:true}).click();await page.locator('.continuousToolbar').waitFor();
  const controls=await page.evaluate(()=>['.surahPickerButton','.continuousToolbar .focusButton','.continuousToolbar .recitationOpen','.continuousToolbar .speedSlider'].map(s=>document.querySelector(s).getBoundingClientRect().toJSON()));assert(controls.every(b=>b.top>=0));assert(controls[0].left<controls[1].left&&controls[1].left<controls[2].left&&controls[2].left<controls[3].left);
  await device.screenshot({path:`${dir}/android-${theme}-quran.png`});
  await page.locator('.nav').getByRole('button',{name:'اعرف',exact:true}).click();await page.locator('.toolTile').filter({hasText:'رحلة نزول القرآن'}).click();await page.locator('.journey48').waitFor();await device.screenshot({path:`${dir}/android-${theme}-journey.png`});
  await page.getByLabel('البحث في رحلة النزول').fill('العلق');await page.locator('[data-journey="96"] .journeyHeading').click();await page.locator('.journeyDetail').waitFor();await device.screenshot({path:`${dir}/android-${theme}-detail.png`});
  await page.getByRole('button',{name:'افتح السورة في المصحف',exact:true}).click();await page.locator('.journeyReaderReturn').waitFor();await device.shell('input keyevent 4');await page.locator('.journeyDetail').waitFor();
  await device.shell('input keyevent 4');await page.locator('.journeyTimeline48').waitFor();await device.shell('input keyevent 4');await page.locator('.noorTools').waitFor();
  result.checks.push({theme,bounds,controls,nativeBack:'reader -> detail -> list -> home'});
 }
 result.status='passed';
}catch(e){result.status='failed';result.error=e.stack;await device.screenshot({path:`dir/FAILURE.png`.replace('dir/',dir+'/')}).catch(()=>{});throw e}
finally{await writeFile(`${dir}/result.json`,JSON.stringify(result,null,2));await device.close()}
