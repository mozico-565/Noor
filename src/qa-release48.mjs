import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const output=process.env.QA_OUTPUT||'qa48',url=process.env.QA_URL||'http://127.0.0.1:4173';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];
const rect=async loc=>{const b=await loc.boundingBox();assert(b,'missing box');return b};
for(const [width,height] of [[390,844],[430,932],[320,640]])for(const theme of ['dark','light']){
 const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,colorScheme:theme,reducedMotion:'reduce'});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({theme})=>{localStorage.setItem('noor_guidance_seen','1');localStorage.setItem('noor_guidance_enabled','0');localStorage.setItem('noor_theme_mode',theme);localStorage.setItem('noor_ui_sounds','0');localStorage.setItem('noor_last_tab','home');localStorage.setItem('noor_last_verse','1:1');}, {theme});
 const key=`${width}x${height}-${theme}`;
 const shot=async name=>page.screenshot({path:`${output}/${key}-${name}.png`});
 const checkWidth=async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal document overflow');
 try{
  await page.goto(url);await page.locator('.noorTools').waitFor();await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('.noorTools').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),3);
  const brand=await rect(page.locator('.brand')),cont=await rect(page.locator('.headerContinue'));
  assert(brand.y>=0&&cont.y>=0&&brand.x>width/2&&cont.x<width/2,'header needs opposite edges');
  assert(brand.x+brand.width<=width&&cont.x+cont.width<=width,'clipped header');await shot('home');
  const scroller=page.locator('.content');await scroller.evaluate(e=>e.scrollTop=e.scrollHeight);await page.waitForTimeout(120);
  const last=await rect(page.locator('.noorTools .sortableCard').last()),composer=await rect(page.locator('.composer'));
  assert(last.y>=0&&last.y+last.height<composer.y+2,'last tool must be reachable above composer');await shot('home-scrolled');await checkWidth();
  await page.locator('[data-sort-id="revelation"]').scrollIntoViewIfNeeded();
  const dragFrom=await rect(page.locator('[data-sort-id="revelation"]')),dragTo=await rect(page.locator('[data-sort-id="stories"]'));
  const cdp=await context.newCDPSession(page),a={x:dragFrom.x+dragFrom.width/2,y:dragFrom.y+dragFrom.height/2},b={x:dragTo.x+dragTo.width/2,y:dragTo.y+dragTo.height/2};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});await page.waitForTimeout(450);
  for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*i/8,y:a.y+(b.y-a.y)*i/8}]});await page.waitForTimeout(35)}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(450);
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('noor_home_order')).slice(0,2)),['stories','revelation'],'touch drag ordering');
  assert.equal(await page.locator('.toolPage').count(),0,'drag release must not open a tool');
  await page.evaluate(()=>localStorage.removeItem('noor_home_order'));await page.reload();await page.locator('.noorTools').waitFor();
  await page.locator('.nav').getByRole('button',{name:'القرآن',exact:true}).click();await page.locator('.continuousToolbar').waitFor();
  const g=await rect(page.locator('.surahPickerButton')),f=await rect(page.locator('.continuousToolbar .focusButton')),r=await rect(page.locator('.continuousToolbar .recitationOpen')),sp=await rect(page.locator('.continuousToolbar .speedSlider'));
  assert(g.x<f.x&&f.x<r.x&&r.x<sp.x,'physical toolbar order');assert(g.y>=0&&sp.x+sp.width<=width,'toolbar clip');await shot('quran');
  await page.locator('.surahPickerButton').click();await page.locator('.modal').waitFor();await shot('goto-list');await page.evaluate(()=>window.noorHandleBack());
  await page.locator('.continuousToolbar .recitationOpen').click();await shot('repeat');await page.evaluate(()=>window.noorHandleBack());
  await page.locator('.continuousToolbar .focusButton').click();await page.locator('.focusExit').waitFor();await page.locator('.focusExit').click();
  await page.locator('.nav').getByRole('button',{name:'اعرف',exact:true}).click();await page.locator('.toolTile').filter({hasText:'رحلة نزول القرآن'}).click();await page.locator('.journey48').waitFor();
  assert.equal(await page.locator('.journeyStop').count(),114);await shot('journey');
  await page.getByRole('button',{name:'مكية',exact:true}).click();assert.equal(await page.locator('.journeyStop.Medinan').count(),0);await shot('makkah');
  await page.getByRole('button',{name:'مدنية',exact:true}).click();assert.equal(await page.locator('.journeyStop.Meccan').count(),0);await shot('madinah');
  await page.getByRole('button',{name:'الكل',exact:true}).click();await page.getByRole('button',{name:'ترتيب المصحف',exact:true}).click();assert.equal(await page.locator('.journeyStop').first().getAttribute('data-journey'),'1');
  await page.getByRole('button',{name:'بداية النزول',exact:true}).click();assert.equal(await page.locator('.journeyStop').first().getAttribute('data-journey'),'96');
  for(const [name,n] of [['العلق',96],['القصص',28],['النصر',110]]){
   await page.getByLabel('البحث في رحلة النزول').fill(name);await page.locator(`[data-journey="${n}"] .journeyHeading`).click();await page.locator('.journeyDetail').waitFor();
   assert(await page.locator('.journeyThemes article').count()>=2);assert(await page.locator('.journeySelections .journeyQuran').count()===2);
   await shot(`detail-${n}`);await page.locator('.journeyThemes details').first().locator('summary').click();assert.equal(await page.locator('.journeyThemes details').first().locator('a').count(),3);
   if(n===28){await page.getByRole('button',{name:'أضف للمفضلة',exact:true}).click();await page.getByRole('button',{name:'افتح السورة في المصحف',exact:true}).click();await page.locator('.journeyReaderReturn').waitFor();await page.locator('#ayah-28-1.searchHighlight').waitFor();const target=await rect(page.locator('#ayah-28-1')),viewport=await rect(page.locator('.continuousViewport'));assert(target.y>=viewport.y&&target.y<viewport.y+viewport.height,'exact requested verse visible');assert.equal(await page.evaluate(()=>localStorage.getItem('noor_last_verse')),'28:1');await shot('journey-quran');await page.locator('.journeyReaderReturn').click();await page.locator('.journeyDetail').waitFor();assert(await page.locator('.journeyDetail').innerText().then(t=>t.includes('القصص')));}
   await page.getByRole('button',{name:'العودة إلى الرحلة',exact:true}).click();
  }
  await page.getByLabel('البحث في رحلة النزول').fill('');await page.locator('[data-journey="28"]').scrollIntoViewIfNeeded();
  const before=await rect(page.locator('[data-journey="28"]'));await page.locator('[data-journey="28"] .journeyHeading').click();await page.locator('.journeyDetail').waitFor();await page.evaluate(()=>window.noorHandleBack());await page.locator('.journeyTimeline48').waitFor();await page.waitForTimeout(100);
  assert(Math.abs((await rect(page.locator('[data-journey="28"]'))).y-before.y)<5,'return scroll restoration');
  await page.getByRole('button',{name:'الخريطة',exact:true}).click();await page.getByRole('button',{name:'موضع عرفة',exact:true}).click();await page.locator('.journeyMapPage').getByText('إكمال الدين بعرفة',{exact:true}).waitFor();await shot('map');
  await page.getByRole('button',{name:'تقدمي',exact:true}).click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('noor_journey_progress')).visited.length),3);assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('noor_journey_progress')).favorites),[28]);await shot('progress');await checkWidth();assert.deepEqual(errors,[]);
  results.push({key,status:'passed',visited:[96,28,110],checks:['three column cards','reachable last tool','header bounds','physical toolbar order','repeat/focus/goto','touch drag + persistent ordering','114 stops','filters/search/order','first/middle/last details','exact Quran and return','scroll restoration','map','persisted favorites and progress','no page errors']});
 }catch(e){await shot('FAILURE').catch(()=>{});results.push({key,status:'failed',error:e.stack,errors});console.error(key,e.message)}finally{await context.close();await writeFile(`${output}/results.json`,JSON.stringify(results,null,2));}
}
await browser.close();assert(results.every(r=>r.status==='passed'),JSON.stringify(results.filter(r=>r.status==='failed')));
