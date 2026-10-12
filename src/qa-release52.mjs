import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir='qa52/web';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
const result={checks:[],errors:[]};let currentPage;
try{
 for(const [width,height] of [[390,844],[430,932],[320,640]])for(const theme of ['light','dark']){
  const page=currentPage=await browser.newPage({viewport:{width,height},hasTouch:true});
  page.on('pageerror',e=>result.errors.push(e.message));
  await page.goto('http://127.0.0.1:4173');
  await page.evaluate(theme=>{localStorage.setItem('noor_guidance_seen','1');localStorage.setItem('noor_guidance_enabled','0');localStorage.setItem('noor_theme_mode',theme);localStorage.setItem('noor_quran_font','amiri');localStorage.setItem('noor_last_tab','home')},theme);
  await page.reload();await page.locator('.toolTile').first().waitFor();
  const shot=async name=>{await page.waitForFunction(()=>Array.from(document.images).filter(i=>{const r=i.getBoundingClientRect();return r.width&&r.bottom>0&&r.top<innerHeight}).every(i=>i.complete&&i.naturalWidth>0),{},{timeout:15000});await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:`${dir}/${width}-${theme}-${name}.png`})};
  const home=async()=>{await page.evaluate(()=>localStorage.setItem('noor_last_tab','home'));await page.reload();await page.locator('.toolTile').first().waitFor()};
  assert.equal(await page.locator('.toolTile').count(),9);
  assert.equal(await page.locator('.fiqhBanner svg.lucide-book-open').count(),0);
  await shot('home');
  await page.getByLabel('اعرف عن القرآن',{exact:true}).fill('كلمة الجنة كم مرة وردت في القرآن؟');
  await shot('arabic-input');
  await page.locator('.composer').getByRole('button').first().click();
  await page.locator('.answerResults').waitFor({timeout:60000});
  assert.match(await page.locator('.content').innerText(),/المصدر|مصدر|نص القرآن/);await shot('answer');
  await home();await page.locator('.toolTile').filter({hasText:'قصص القرآن'}).click();await page.locator('.storyIndexCard').first().waitFor();await shot('stories');
  await page.locator('.storyIndexCard').first().click();await page.locator('.storyChapterList button').first().click();await page.locator('.storyQuran').first().waitFor();
  assert.equal(await page.locator('.storyArt img').count(),1);await shot('chapter');
  await page.getByRole('button',{name:'التالي',exact:true}).click();assert.match(await page.locator('.storyEyebrow').innerText(),/٢/);await shot('next-chapter');
  await home();await page.locator('.toolTile').filter({hasText:'رحلة نزول القرآن'}).click();await page.locator('.journey48').waitFor();await shot('journey');
  await page.getByRole('button',{name:'الخريطة',exact:true}).click();await page.locator('.atlasPin').first().waitFor();assert(await page.locator('.atlasPin').evaluateAll(els=>{const frame=document.querySelector('.historicalViewport').getBoundingClientRect();return els.every(e=>{const r=e.getBoundingClientRect();return r.left>=frame.left-1&&r.right<=frame.right+1&&r.top>=frame.top-1&&r.bottom<=frame.bottom+1})}),'All overview pin labels must fit their map');await shot('map-overview');await page.locator('.atlasPin').first().click();
  const color=await page.locator('.atlasPin[aria-pressed="true"]').evaluate(e=>getComputedStyle(e).color);assert.equal(color,'rgb(255, 255, 255)');assert.equal(await page.locator('.atlasPin[aria-pressed="true"] span').evaluate(e=>getComputedStyle(e).webkitTextFillColor),'rgb(255, 255, 255)');await shot('map');
  assert.equal(await page.locator('.atlasChips button').count(),8);
  assert.equal(await page.locator('.atlasControls,.atlasRegions,.journeyProgressLine').count(),0);
  const top=await page.locator('.app>header').boundingBox();await page.locator('.atlasChips').getByRole('button',{name:'مكة',exact:true}).click();assert.equal(await page.locator('.atlasChips button[aria-pressed="true"]').evaluate(e=>getComputedStyle(e).webkitTextFillColor),'rgb(255, 255, 255)');await shot('makkah');await page.locator('.atlasContext').scrollIntoViewIfNeeded();await shot('makkah-card');
  await page.locator('.atlasAttribution').scrollIntoViewIfNeeded();const bottom=await page.locator('.app>header').boundingBox();assert.equal(top.y,bottom.y);assert(top.height<=64);await shot('map-bottom');
  await page.locator('.atlasClose').click();assert.equal(await page.locator('.atlasContext').count(),0);
  await page.getByRole('button',{name:'عرض جميع المواقع',exact:true}).click();await page.locator('.historicalViewport').scrollIntoViewIfNeeded();
  const frame=await page.locator('.historicalViewport').boundingBox(),cx=frame.x+frame.width*.35,cy=Math.max(80,Math.min(height-80,frame.y+frame.height*.4));
  const cdp=await page.context().newCDPSession(page),touch=async(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y,id])=>({x,y,id}))});
  await touch('touchStart',[[cx-20,cy,1],[cx+20,cy,2]]);await touch('touchMove',[[cx-60,cy,1],[cx+60,cy,2]]);await touch('touchEnd',[]);
  await page.waitForFunction(()=>Number(document.querySelector('.historicalMap').style.transform.match(/scale\(([^)]+)\)/)?.[1])>1.5);
  const zoomed=await page.locator('.historicalMap').getAttribute('style');await touch('touchStart',[[cx,cy,1]]);await touch('touchMove',[[cx-25,cy-25,1]]);await touch('touchEnd',[]);
  assert.notEqual(await page.locator('.historicalMap').getAttribute('style'),zoomed);await shot('map-touch');await cdp.detach();

  await page.getByRole('button',{name:'تقدمي',exact:true}).click();await page.locator('.journeyStats').scrollIntoViewIfNeeded();assert(await page.locator('.journeyStats').isVisible());
  await home();await page.locator('.toolTile').filter({hasText:'تدبّر آية'}).click();await page.locator('.tadabburPage').waitFor();await shot('tadabbur');
  await home();await page.getByRole('button',{name:/تفقّه في الدين/}).first().click();await page.locator('.fiqhLearning').waitFor();await shot('fiqh');
  assert.equal(await page.locator('.fiqhLessons button').count(),16);
  const fiqhScroll=await page.locator('.fiqhStandalone').evaluate(e=>({scroll:e.scrollHeight,client:e.clientHeight,overflow:getComputedStyle(e).overflowY}));assert(fiqhScroll.scroll>fiqhScroll.client);assert.equal(fiqhScroll.overflow,'auto');
  await page.locator('.fiqhLessons button').last().scrollIntoViewIfNeeded();await shot('fiqh-bottom');await page.locator('.fiqhLessons button').last().click();assert.match(await page.locator('.fiqhLesson').innerText(),/أداء الأمانات/);await shot('fiqh-lesson');await page.getByRole('button',{name:'رجوع',exact:true}).click();
  await page.getByRole('button',{name:'اختبر نفسك',exact:true}).click();
  for(let i=0;i<10;i++){assert.match(await page.locator('.fiqhQuiz small').first().innerText(),new RegExp(`السؤال ${i+1} من`));await page.locator('.fiqhOptions button').first().click();await page.getByRole('button',{name:'تحقق',exact:true}).click();assert.match(await page.locator('.fiqhQuiz [role=status]').innerText(),/المصدر/);const next=page.getByRole('button',{name:i===9?'عرض النتيجة':'السؤال التالي',exact:true});await next.scrollIntoViewIfNeeded();await page.waitForFunction(()=>{const r=document.querySelector('.fiqhQuiz [role="status"] button')?.getBoundingClientRect();return r&&r.top>=-1&&r.bottom<=innerHeight+1},{},{timeout:5000});const box=await next.boundingBox();assert(box.y>=-1&&box.y+box.height<=height+1,`Quiz action outside viewport: ${JSON.stringify(box)} height=${height}`);if([0,4,9].includes(i))await shot(`quiz-${i+1}`);await next.click()}
  assert.match(await page.locator('.fiqhResult').innerText(),/١٠/);await shot('quiz-score');
  await page.getByRole('button',{name:'جولة جديدة',exact:true}).click();await page.locator('.fiqhQuiz').waitFor();
  if(width===390&&theme==='light'){await page.getByText('انتهى الوقت',{exact:true}).waitFor({timeout:23000});await shot('quiz-timeout')}

  await page.getByRole('button',{name:'رجوع',exact:true}).click();await page.getByRole('button',{name:'متابعة الاختبار',exact:true}).click();assert(await page.locator('.fiqhQuiz').isVisible());
  await page.locator('.fiqhLearning').evaluate(e=>e.style.zoom='1.3');await page.locator('.fiqhOptions button').last().scrollIntoViewIfNeeded();await page.locator('.fiqhQuiz .primaryGlass').last().scrollIntoViewIfNeeded();await shot('quiz-large-text');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  await home();await page.locator('.nav').getByRole('button',{name:'القرآن',exact:true}).click({force:true});await page.locator('.continuousToolbar').waitFor();
  const x=await page.evaluate(()=>['.surahPickerButton','.focusButton','.recitationOpen','.speedSlider','.autoScrollControls>button'].map(s=>document.querySelector('.continuousToolbar '+s).getBoundingClientRect().x));
  assert(x.every((n,i)=>i===0||n<x[i-1]),`RTL toolbar: ${x}`);await shot('toolbar');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  result.checks.push({width,height,theme,tiles:9,quiz:10,toolbar:x});await page.close();
 }
 assert.equal(result.errors.length,0);result.status='passed';
}catch(e){result.status='failed';result.error=e.stack;if(currentPage&&!currentPage.isClosed()){await currentPage.screenshot({path:`${dir}/FAILURE.png`}).catch(()=>{});result.ui=await currentPage.evaluate(()=>({text:document.body.innerText,pins:[...document.querySelectorAll('.atlasPin')].map(e=>({title:e.textContent,selected:e.getAttribute('aria-pressed'),transform:getComputedStyle(e).transform})),card:!!document.querySelector('.atlasContext')})).catch(()=>null)}throw e}
finally{await writeFile(`${dir}/result.json`,JSON.stringify(result,null,2));await browser.close()}
