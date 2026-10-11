import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir='qa51/web';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
const result={checks:[],errors:[]};
try{
 for(const [width,height] of [[390,844],[430,932],[320,740]])for(const theme of ['light','dark']){
  const page=await browser.newPage({viewport:{width,height}});
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
  await page.getByRole('button',{name:'الخريطة',exact:true}).click();await page.locator('.atlasPin').first().waitFor();await page.locator('.atlasPin').first().click();
  const color=await page.locator('.atlasPin[aria-pressed="true"]').evaluate(e=>getComputedStyle(e).color);assert.equal(color,'rgb(255, 255, 255)');await shot('map');
  await home();await page.locator('.toolTile').filter({hasText:'تدبّر آية'}).click();await page.locator('.tadabburPage').waitFor();await shot('tadabbur');
  await home();await page.getByRole('button',{name:/تفقّه في الدين/}).first().click();await page.locator('.fiqhLearning').waitFor();await shot('fiqh');
  await page.getByRole('button',{name:'اختبار · ١٠ أسئلة',exact:true}).click();
  for(let i=0;i<10;i++){assert.match(await page.locator('.fiqhQuiz small').first().innerText(),new RegExp(`السؤال ${i+1} من`));await page.locator('.fiqhOptions button').first().click();await page.getByRole('button',{name:'تحقق',exact:true}).click();assert.match(await page.locator('.fiqhQuiz [role=status]').innerText(),/المصدر/);if(i===0)await shot('quiz');await page.getByRole('button',{name:i===9?'عرض النتيجة':'السؤال التالي',exact:true}).click()}
  assert.match(await page.locator('.fiqhResult').innerText(),/١٠/);await shot('quiz-score');
  await page.getByRole('button',{name:'جولة جديدة',exact:true}).click();await page.locator('.fiqhQuiz').waitFor();
  if(width===390&&theme==='light'){await page.getByText('انتهى الوقت',{exact:true}).waitFor({timeout:23000});await shot('quiz-timeout')}
  await home();await page.locator('.nav').getByRole('button',{name:'القرآن',exact:true}).click({force:true});await page.locator('.continuousToolbar').waitFor();
  const x=await page.evaluate(()=>['.surahPickerButton','.focusButton','.recitationOpen','.speedSlider','.autoScrollControls>button'].map(s=>document.querySelector('.continuousToolbar '+s).getBoundingClientRect().x));
  assert(x.every((n,i)=>i===0||n<x[i-1]),`RTL toolbar: ${x}`);await shot('toolbar');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  result.checks.push({width,height,theme,tiles:9,quiz:10,toolbar:x});await page.close();
 }
 assert.equal(result.errors.length,0);result.status='passed';
}catch(e){result.status='failed';result.error=e.stack;throw e}
finally{await writeFile(`${dir}/result.json`,JSON.stringify(result,null,2));await browser.close()}
