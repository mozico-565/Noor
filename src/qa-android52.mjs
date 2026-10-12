import {_android as android} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
const adb=async args=>(await run('adb',['-s','emulator-5554',...args],{encoding:'buffer',timeout:20000,maxBuffer:16*1024*1024})).stdout;
const screenshot=async ({path})=>{const png=await adb(['exec-out','screencap','-p']);assert(png.length>8 && png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'ADB screenshot must be a real nonempty PNG');await writeFile(path,png)};
import assert from 'node:assert/strict';
const dir='qa52/android';await mkdir(dir,{recursive:true});const [device]=await android.devices();assert(device);
const result={checks:[],status:'running'};
let page;
try{
 await device.shell('am start -n com.noor.quran/.MainActivity');
 page=await (await device.webView({pkg:'com.noor.quran'},{timeout:60000})).page();
 await page.waitForLoadState('domcontentloaded');
 await page.evaluate(()=>{localStorage.setItem('noor_guidance_seen','1');localStorage.setItem('noor_guidance_enabled','0');localStorage.setItem('noor_reciter','sudais');localStorage.setItem('noor_ab_settings',JSON.stringify({a:'1:1',b:'1:2',count:0,gap:1}));localStorage.setItem('noor_last_tab','home');localStorage.setItem('noor_quran_font','amiri')});
 await page.reload();await page.locator('.toolTile').first().waitFor({timeout:60000});
 // Exercise the real soft keyboard, including hardware-keyboard emulator mode.
 await device.shell('settings put secure show_ime_with_hard_keyboard 1');
 const fullHeight=await page.evaluate(()=>innerHeight);
 const input=page.getByLabel('اعرف عن القرآن',{exact:true}),inputBox=await input.boundingBox();assert(inputBox);
 await device.shell('uiautomator dump /sdcard/noor-qa-window.xml');
 const windowXml=(await device.shell('cat /sdcard/noor-qa-window.xml')).toString();
 const webViewBounds=windowXml.match(/<node[^>]*class="android.webkit.WebView"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);assert(webViewBounds,'Native WebView bounds must be observable');
 const scale=(Number(webViewBounds[3])-Number(webViewBounds[1]))/await page.evaluate(()=>innerWidth);
 await device.shell(`input tap ${Math.round(Number(webViewBounds[1])+(inputBox.x+inputBox.width/2)*scale)} ${Math.round(Number(webViewBounds[2])+(inputBox.y+inputBox.height/2)*scale)}`);
 await page.waitForFunction(h=>innerHeight<h-120,fullHeight,{timeout:15000});
 await input.fill('ما معنى الصمد؟');
 const inputState=await input.evaluate(e=>{const r=e.getBoundingClientRect(),v=visualViewport;return {value:e.value,top:r.top,bottom:r.bottom,visibleBottom:(v?.offsetTop||0)+(v?.height||innerHeight),color:getComputedStyle(e).color}});
 assert.equal(inputState.value,'ما معنى الصمد؟');assert(inputState.top>=0&&inputState.bottom<=inputState.visibleBottom+1,'Arabic input must be above the real IME');
 const sendBox=await page.locator('.composer button').boundingBox();assert(sendBox&&sendBox.y+sendBox.height<=inputState.visibleBottom+1,'Submit button must remain above IME');
 await screenshot({path:`${dir}/arabic-keyboard.png`});result.checks.push({realImeInput:inputState});
 await input.press('Enter');await page.locator('.answerCard').waitFor({timeout:60000});await screenshot({path:`${dir}/arabic-answer.png`});result.checks.push('native Arabic input and sourced answer');
 if(await page.evaluate(h=>innerHeight<h-120,fullHeight))await device.shell('input keyevent 4');
 await page.waitForFunction(h=>innerHeight>=h-40,fullHeight,{timeout:15000});
 await page.evaluate(()=>localStorage.setItem('noor_last_tab','home'));await page.reload();await page.locator('.toolTile').first().waitFor({timeout:60000});
 await page.locator('.dailyTadabbur').scrollIntoViewIfNeeded();await screenshot({path:`${dir}/daily-reflection.png`});
 page=await (await device.webView({pkg:'com.noor.quran'},{timeout:60000})).page();await page.locator('.nav').getByRole('button',{name:'القرآن',exact:true}).click();await page.locator('.app[data-tab="quran"]').waitFor();page=await (await device.webView({pkg:'com.noor.quran'},{timeout:60000})).page();await page.locator('.readerShell[aria-hidden="false"] .recitationOpen').waitFor({state:'visible',timeout:60000});await page.locator('.readerShell[aria-hidden="false"] .recitationOpen').click();await page.getByRole('button',{name:'بدء التكرار',exact:true}).click();
 await page.waitForFunction(()=>JSON.parse(window.Android.getNativeRepeatState()).status==='playing',{},{timeout:30000});
 await screenshot({path:`${dir}/repeat-playing.png`});
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
 page=await (await device.webView({pkg:'com.noor.quran'},{timeout:60000})).page();await screenshot({path:`${dir}/after-unlock.png`});console.log('After unlock',await page.evaluate(()=>({tab:document.querySelector('.app')?.getAttribute('data-tab'),height:innerHeight,viewport:visualViewport?.height,repeat:JSON.parse(window.Android.getNativeRepeatState())})));if(!await page.locator('.app[data-tab="quran"]').count())await page.locator('.nav').getByRole('button',{name:'القرآن',exact:true}).click();await page.locator('.readerShell[aria-hidden="false"] .recitationOpen').waitFor({state:'visible',timeout:60000});await page.locator('.readerShell[aria-hidden="false"] .recitationOpen').click();await page.getByRole('button',{name:'إيقاف مؤقت',exact:true}).click();await page.waitForFunction(()=>JSON.parse(window.Android.getNativeRepeatState()).status==='paused');await screenshot({path:`${dir}/repeat-paused.png`});
 await page.getByRole('button',{name:'استئناف',exact:true}).click();await page.waitForFunction(()=>['playing','waiting'].includes(JSON.parse(window.Android.getNativeRepeatState()).status));
 await page.locator('.sessionPanel').getByRole('button',{name:'إلغاء',exact:true}).click();await page.waitForFunction(()=>JSON.parse(window.Android.getNativeRepeatState()).status==='idle');result.checks.push('pause, resume, cancel');console.log('Native audio controls passed');
 await page.getByRole('button',{name:'إغلاق',exact:true}).click().catch(()=>{});
 const home=async()=>{await page.evaluate(()=>localStorage.setItem('noor_last_tab','home'));await page.reload();await page.locator('.toolTile').first().waitFor({timeout:60000})};
 const nativeTap=async locator=>{
  const box=await locator.boundingBox();assert(box);assert(box.y>=0&&box.y+box.height<=await page.evaluate(()=>innerHeight),'Native tap target must be fully visible');
  await device.shell('uiautomator dump /sdcard/noor-qa-window.xml');
  const xml=(await device.shell('cat /sdcard/noor-qa-window.xml')).toString(),bounds=xml.match(/<node[^>]*class="android.webkit.WebView"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);assert(bounds);
  const scale=(Number(bounds[3])-Number(bounds[1]))/await page.evaluate(()=>innerWidth);
  await device.shell(`input tap ${Math.round(Number(bounds[1])+(box.x+box.width/2)*scale)} ${Math.round(Number(bounds[2])+(box.y+box.height/2)*scale)}`);
 };
 await device.shell('settings put system font_scale 1.3');page=await (await device.webView({pkg:'com.noor.quran'},{timeout:60000})).page();await home();await nativeTap(page.locator('.fiqhBanner'));await page.locator('.fiqhLearning').waitFor();
 assert.equal(await page.locator('.fiqhLessons button').count(),16);await screenshot({path:`${dir}/fiqh-top-font130.png`});
 for(let i=0;i<16;i++){console.log('Opening fiqh lesson',i+1);const lesson=page.locator('.fiqhLessons button').nth(i),title=(await lesson.innerText()).replace('‹','').trim();await lesson.scrollIntoViewIfNeeded();await lesson.click();assert.equal(await page.locator('.fiqhLesson h2').innerText(),title);if(title.includes('الواجب')){assert.equal(await page.locator('.fiqhLesson ol>li').count(),8);await screenshot({path:`${dir}/prayer-duties.png`})}await page.locator('.fiqhLesson a').last().scrollIntoViewIfNeeded();assert(await page.locator('.fiqhLesson a').last().isVisible());await page.getByRole('button',{name:'رجوع',exact:true}).click()}
 await page.locator('.fiqhLessons button').last().scrollIntoViewIfNeeded();await screenshot({path:`${dir}/fiqh-bottom-font130.png`});
 await page.getByRole('button',{name:'اختبر نفسك',exact:true}).click();
 for(let i=0;i<10;i++){await page.locator('.fiqhOptions button').last().click();if(i===0){await device.shell('input keyevent 4');await page.getByRole('button',{name:'متابعة الاختبار',exact:true}).click();assert.equal(await page.locator('.fiqhOptions button[aria-pressed="true"]').count(),1)}await page.getByRole('button',{name:'تحقق',exact:true}).click();const next=page.getByRole('button',{name:i===9?'عرض النتيجة':'السؤال التالي',exact:true});await next.scrollIntoViewIfNeeded();assert(await next.isVisible());if([4,9].includes(i))await screenshot({path:`${dir}/quiz-${i+1}.png`});await next.click()}
 assert(await page.locator('.fiqhResult').isVisible());await screenshot({path:`${dir}/quiz-score.png`});result.checks.push('all 16 lessons and 10 questions reachable with Android font_scale 1.3 (existing WebView textZoom 100)');
 await device.shell('settings put system font_scale 1.0');page=await (await device.webView({pkg:'com.noor.quran'},{timeout:60000})).page();await home();await page.locator('.toolTile').filter({hasText:'رحلة نزول القرآن'}).click();await page.getByRole('button',{name:'الخريطة',exact:true}).click();
 assert.equal(await page.locator('.atlasChips button').count(),8);await screenshot({path:`${dir}/historical-map.png`});await page.locator('.atlasChips').getByRole('button',{name:'مكة',exact:true}).click();
 assert.equal(await page.locator('.atlasPin[aria-pressed="true"] span').evaluate(e=>getComputedStyle(e).webkitTextFillColor),'rgb(255, 255, 255)');await screenshot({path:`${dir}/makkah-selected.png`});await page.locator('.atlasClose').click();assert.equal(await page.locator('.atlasContext').count(),0);result.checks.push('native atlas selection and close');result.status='passed';
}catch(e){result.status='failed';result.error=e.stack;console.error('Original native QA failure',e);await adb(['shell','dumpsys activity activities; dumpsys media_session; logcat -d -t 200']).then(data=>writeFile(`${dir}/device-diagnostics.txt`,data.toString())).catch(error=>console.error('Diagnostics unavailable',error.message));console.error('Native UI on failure',page?await page.evaluate(()=>({url:location.href,nav:document.querySelector('.nav')?.className,reader:document.querySelector('.readerShell')?.outerHTML.slice(0,500),text:document.body.innerText.slice(0,500)})).catch(()=>null):null);await screenshot({path:`${dir}/FAILURE.png`}).catch(()=>{});throw e}
finally{await writeFile(`${dir}/result.json`,JSON.stringify(result,null,2));await device.close().catch(error=>console.error('Device close unavailable',error.message))}
