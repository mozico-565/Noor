import {_android as android} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir='qa52/android';await mkdir(dir,{recursive:true});const [device]=await android.devices();assert(device);
const result={checks:[],status:'running'};
let page;
try{
 await device.shell('am start -n com.noor.quran/.MainActivity');
 page=await (await device.webView({pkg:'com.noor.quran'},{timeout:60000})).page();
 await page.waitForLoadState('domcontentloaded');
 await page.evaluate(()=>{localStorage.setItem('noor_guidance_seen','1');localStorage.setItem('noor_guidance_enabled','0');localStorage.setItem('noor_reciter','sudais');localStorage.setItem('noor_ab_settings',JSON.stringify({a:'1:1',b:'1:2',count:0,gap:1}));localStorage.setItem('noor_last_tab','home');localStorage.setItem('noor_quran_font','amiri')});
 await page.reload();await page.locator('.toolTile').first().waitFor({timeout:60000});page=await (await device.webView({pkg:'com.noor.quran'},{timeout:60000})).page();await page.locator('.nav').getByRole('button',{name:'القرآن',exact:true}).click();await page.locator('.app[data-tab="quran"]').waitFor();page=await (await device.webView({pkg:'com.noor.quran'},{timeout:60000})).page();await page.locator('.readerShell[aria-hidden="false"] .recitationOpen').waitFor({state:'visible',timeout:60000});await page.locator('.readerShell[aria-hidden="false"] .recitationOpen').click();await page.getByRole('button',{name:'بدء التكرار',exact:true}).click();
 await page.waitForFunction(()=>JSON.parse(window.Android.getNativeRepeatState()).status==='playing',{},{timeout:30000});
 await device.screenshot({path:`${dir}/repeat-playing.png`});
 const initial=await page.evaluate(()=>JSON.parse(window.Android.getNativeRepeatState()));
 await device.shell('input keyevent 3');await page.waitForTimeout(5000);
 let media=(await device.shell('dumpsys media_session')).toString();assert(media.includes('NoorRecitation'));assert.match(media,/state=PLAYING\(3\)/);result.checks.push('playing after Home');
 await device.shell('input keyevent 223');await page.waitForTimeout(16000);
 media=(await device.shell('dumpsys media_session')).toString();assert.match(media,/state=PLAYING\(3\)/);result.checks.push('playing with screen locked');
 await device.shell('input keyevent 224');await device.shell('wm dismiss-keyguard');await device.shell('am start -n com.noor.quran/.MainActivity');
 page=await (await device.webView({pkg:'com.noor.quran'},{timeout:60000})).page();
 await page.waitForFunction(()=>JSON.parse(window.Android.getNativeRepeatState()).cycle>1,{},{timeout:30000});
 page=await (await device.webView({pkg:'com.noor.quran'},{timeout:60000})).page();
 const after=await page.evaluate(()=>JSON.parse(window.Android.getNativeRepeatState()));assert(after.cycle>initial.cycle);result.checks.push({repeatAdvanced:after});
 page=await (await device.webView({pkg:'com.noor.quran'},{timeout:60000})).page();await page.locator('.nav').getByRole('button',{name:'القرآن',exact:true}).click();await page.locator('.readerShell[aria-hidden="false"] .recitationOpen').waitFor({state:'visible',timeout:60000});await page.locator('.readerShell[aria-hidden="false"] .recitationOpen').click();await page.getByRole('button',{name:'إيقاف مؤقت',exact:true}).click();await page.waitForFunction(()=>JSON.parse(window.Android.getNativeRepeatState()).status==='paused');await device.screenshot({path:`${dir}/repeat-paused.png`});
 await page.getByRole('button',{name:'استئناف',exact:true}).click();await page.waitForFunction(()=>['playing','waiting'].includes(JSON.parse(window.Android.getNativeRepeatState()).status));
 await page.locator('.sessionPanel').getByRole('button',{name:'إلغاء',exact:true}).click();await page.waitForFunction(()=>JSON.parse(window.Android.getNativeRepeatState()).status==='idle');result.checks.push('pause, resume, cancel');
 await page.getByRole('button',{name:'إغلاق',exact:true}).click().catch(()=>{});
 await page.evaluate(()=>{localStorage.setItem('noor_last_tab','home')});await page.reload();await page.locator('.toolTile').first().waitFor();await page.getByLabel('اعرف عن القرآن',{exact:true}).click();await page.getByLabel('اعرف عن القرآن',{exact:true}).fill('ما معنى الصمد؟');await device.screenshot({path:`${dir}/arabic-keyboard.png`});await page.getByLabel('اعرف عن القرآن',{exact:true}).press('Enter');await page.locator('.answerCard').waitFor({timeout:60000});await device.screenshot({path:`${dir}/arabic-answer.png`});result.checks.push('native Arabic input and sourced answer');result.status='passed';
}catch(e){result.status='failed';result.error=e.stack;await writeFile(`${dir}/device-diagnostics.txt`,(await device.shell('dumpsys activity activities; dumpsys media_session; logcat -d -t 200')).toString()).catch(()=>{});console.error('Native UI on failure',page?await page.evaluate(()=>({url:location.href,nav:document.querySelector('.nav')?.className,reader:document.querySelector('.readerShell')?.outerHTML.slice(0,500),text:document.body.innerText.slice(0,500)})).catch(()=>null):null);await device.screenshot({path:`${dir}/FAILURE.png`}).catch(()=>{});throw e}
finally{await writeFile(`${dir}/result.json`,JSON.stringify(result,null,2));await device.close()}
