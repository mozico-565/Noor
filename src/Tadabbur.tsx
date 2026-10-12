import React,{useEffect,useState} from 'react';
import type {FeatureSurah} from './NoorFeatures';
import {QuranVerseText} from './QuranVerseText';
const entries=[['2:153','كيف أستعين بالصبر والصلاة في موقف أواجهه؟'],['13:28','ما الوقت الذي أخصصه اليوم لذكر الله؟'],['94:5','ما باب الأمل الذي أراه رغم الصعوبة؟'],['49:13','كيف أتعامل باحترام مع من يختلف عني؟'],['17:23','ما الإحسان الذي أستطيع تقديمه لوالدي؟'],['39:53','ما الخطوة التي أبدأ بها التوبة اليوم؟'],['16:90','هل أعدِل في معاملتي للناس؟'],['3:134','كيف أضبط غضبي وأختار العفو؟'],['65:3','ما الأسباب التي آخذ بها مع التوكل؟'],['31:18','هل في سلوكي شيء من الكِبر يحتاج مراجعة؟'],['103:3','كيف أوصي نفسي بالحق والصبر؟'],['2:286','ما المسؤولية التي أقدر عليها اليوم؟']];
function choose(previous=''){let recent:string[]=[];try{recent=JSON.parse(localStorage.getItem('noor_tadabbur_recent')||'[]')}catch{};let available=entries.filter(e=>!recent.includes(e[0])&&e[0]!==previous);if(!available.length)available=entries.filter(e=>e[0]!==previous);const item=available[Math.floor(Math.random()*available.length)];try{localStorage.setItem('noor_tadabbur_recent',JSON.stringify([...recent,item[0]].slice(-entries.length+1)))}catch{};return item}
// Local calendar day, independent of storage availability and opening frequency.
export function dailyTadabbur(date=new Date()){
 const day=Math.floor(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())/86400000);
 return entries[((day%entries.length)+entries.length)%entries.length];
}
function useDay(){
 const [day,setDay]=useState(()=>dailyTadabbur());
 useEffect(()=>{const refresh=()=>setDay(dailyTadabbur());const timer=window.setInterval(refresh,30000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh)}},[]);
 return day;
}
function useTafsir(key:string){
 const [tafsir,setTafsir]=useState<{type:string;text:string}|null>(null),[status,setStatus]=useState('');
 useEffect(()=>{let cancelled=false;const [s,a]=key.split(':').map(Number);setTafsir(null);setStatus('تحميل التفسير…');fetch(`./data/tafsir/${String(s).padStart(3,'0')}.json`).then(r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{if(cancelled)return;const v=data.ayahs.find((v:{ayah_number:number})=>v.ayah_number===a);const t=v?.tafsir.find((t:{type:string})=>t.type==='التفسير الميسر')||v?.tafsir[0];setTafsir(t||null);setStatus(t?'':'التفسير غير متاح لهذه الآية')}).catch(()=>{if(!cancelled)setStatus('تعذر تحميل التفسير المحلي')});return()=>{cancelled=true}},[key]);
 return {tafsir,status};
}
export function DailyTadabburCard({surahs,onOpen}:{surahs:FeatureSurah[];onOpen:()=>void}){
 const item=useDay(),[s,a]=item[0].split(':').map(Number),surah=surahs.find(v=>v.number===s),verse=surah?.ayahs[a-1];
 const {tafsir,status}=useTafsir(item[0]);
 return <section className="dailyTadabbur glassPanel" aria-label="آية اليوم" onClick={e=>{if(!(e.target as HTMLElement).closest('button,summary,details,a'))onOpen()}}><button className="dailyTadabburOpen" onClick={onOpen}><b>تدبّر آية · آية اليوم</b><span>فتح التدبّر ‹</span></button>{verse&&<><p className="storyQuran"><QuranVerseText text={verse.text} surah={s} ayah={a}/></p><small>سورة {surah?.name_arabic} · الآية {a}</small></>}<h3>التفسير المختصر</h3>{tafsir?<><p>{tafsir.text.length>300?tafsir.text.slice(0,300)+'…':tafsir.text}</p>{tafsir.text.length>300&&<details><summary>التفسير كاملًا</summary><p>{tafsir.text}</p></details>}<small>المصدر: {tafsir.type} · النسخة المحلية</small></>:<p role="status">{status}</p>}<h3>سؤال للتأمل</h3><p>{item[1]}</p><small>سؤال تعليمي، منفصل عن التفسير.</small></section>
}
export function Tadabbur({surahs,onOpen,onSave,saved}:{surahs:FeatureSurah[];onOpen:(key:string)=>void;onSave:(key:string)=>void;saved:string[]}){
 const today=useDay();const [alternative,setAlternative]=useState<string[]|null>(null);const item=alternative||today;
 useEffect(()=>setAlternative(null),[today]);
 const [s,a]=item[0].split(':').map(Number),surah=surahs.find(v=>v.number===s),verse=surah?.ayahs[a-1];const {tafsir,status}=useTafsir(item[0]);
 return <article className="tadabburPage"><h1>تدبّر آية</h1>{verse&&<section className="glassPanel"><p className="storyQuran"><QuranVerseText text={verse.text} surah={s} ayah={a}/></p><small>سورة {surah?.name_arabic} · الآية {a}</small></section>}<section className="glassPanel"><h2>التفسير</h2>{tafsir?<><p>{tafsir.text.length>650?tafsir.text.slice(0,650)+'…':tafsir.text}</p>{tafsir.text.length>650&&<details><summary>اقرأ التفسير كاملًا</summary><p>{tafsir.text}</p></details>}<small>المصدر: {tafsir.type} · النسخة المحلية</small></>:<p role="status">{status}</p>}</section><section className="glassPanel"><h2>سؤال للتأمل</h2><p>{item[1]}</p><small>سؤال تعليمي للتأمل، منفصل عن نص التفسير.</small></section><div className="sessionActions"><button onClick={()=>setAlternative(choose(item[0]))}>آية أخرى</button><button onClick={()=>onOpen(item[0])}>افتح في المصحف</button><button aria-pressed={saved.includes(item[0])} onClick={()=>onSave(item[0])}>{saved.includes(item[0])?'الآية محفوظة':'حفظ الآية'}</button></div></article>
}
