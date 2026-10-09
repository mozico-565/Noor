import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import { createRoot } from "react-dom/client";
import { flushSync,createPortal } from "react-dom";
import {useVirtualizer} from "@tanstack/react-virtual";
import {
  Search, Send, BookOpen, Bookmark, BookmarkCheck, Settings, Sparkles, Moon, Sun,
  ChevronLeft, ChevronRight, ChevronDown, Quote, Info, X, List, RotateCcw, LibraryBig, Play, Pause, Share2, Eye, EyeOff, Download, Focus, CalendarDays, Minimize2, Check, ImageIcon, Mic, Compass, MapPinned, BarChart3, Layers3, Smartphone, Volume2, Target, Trophy, CircleCheck, CircleHelp, BookMarked
} from "lucide-react";
import "./styles.css";
import {ADHKAR, type DhikrCategory} from "./featureData";
import {buildQuranSearchIndex,classifyQuranQuery,extractQueryTerm,normalizeArabicSearch,runLexicalQuery,type QuranQueryIntent} from "./quranQuery";
import {readKhutbahCache,refreshKhutbah,saveKhutbahCache,type KhutbahRecord} from "./khutbah";
import {Overlay,OverlayTheme,dismissTopOverlay} from "./Overlay";
import {ExpandableText} from "./ExpandableText";
import {eligibleFlashcard,createFlashcardDeck} from "./flashcards";
import {loadReciterCatalog,searchCatalog,readCustomReciters,resolveCatalogReciter,reciterAudioUrl,downloadAudioBatch,verifyAudioResponse,type CustomReciter,type CatalogReciter} from "./reciters";
import {RepeatPanel,RevelationJourney,QuranStories,OrderQuiz} from "./NoorFeatures";
import {RecitationSession,type RepeatSettings,type SessionState} from "./recitationSession";
import {markedWords,MushafMargin} from "./mushafMarks";
import {fetchQuranpediaAsbab} from "./asbabQuranpedia";
const NOOR_LOGO="./noor-logo.png";
const NOOR_LIGHT_LOGO="./noor-logo-light.png";
const NOOR_CIRCLE="./noor-logo-circle.png";

type QWord = { index:number; text:string; buckwalter?:string };
type QAyah = {
  number:number; verse_key:string; global_number:number; text:string; words:QWord[];
  page:number; juz:number; hizb:number; ruku?:number; sajda?:unknown;
};
type QSurah = {
  number:number; name_arabic:string; name_transliteration?:string; counts:{ayahs:number};
  revelation?:{type:string;order:number}; ayahs:QAyah[];
};
type QuranData = { dataset?:unknown; surahs:QSurah[] };
type RootWord = {t:string; r?:string};
type RootAyah = {k:string; a:number; words:RootWord[]};
type MufradatEntry = {r?:string; t?:string; v?:string[]; vc?:number};
type RootEntry = {b?:string; m?:string; f?:number; v?:string[]};
type AsbabEntry = {surah:number; ayahs:number[]; occasions:string[]; sources?:string[]};
type TafsirItem = {type:string; text:string};
type TafsirAyah = {ayah_number:number; tafsir:TafsirItem[]};
type TafsirSurah = {surah?:string; number:number; ayahs:TafsirAyah[]};
type HadithIndexItem = {book:string; id:string|number; arabic:string; reference?:string; grade?:string};
type TafsirSearchItem = {verseKey:string; surah:number; ayah:number; text:string};
type CommonFact = {id:string; patterns:string[]; title:string; answer:string; verseKey?:string; source:string};
type KnowledgeItem = {id:string; category:string; title:string; aliases:string[]; answer:string; source:string; tags?:string[]; note?:string};

type ReaderVerse = QAyah & {surahNumber:number; surahName:string};
type Answer = {
  title:string; ayah:string; ref:string; meaning:string; context:string; sabab:string; source:string;
  verseKey?:string;
  details?:string;
  intent?:QuranQueryIntent;
  results?:ReaderVerse[];
  exactCount?:number;
  normalizedCount?:number;
  queryTerm?:string;
};
type WordInfo = {text:string; root?:string; contextMeaning?:string; lexicalMeaning?:string; english?:string; verseKey:string; source?:string};
type WordAction = {verse:ReaderVerse; index:number; text:string};
type LocalIntent = {
  intent?: "word_meaning"|"person"|"surah_fact"|"tafsir"|"hadith"|"sirah"|"fiqh"|"aqidah"|"worship"|"history"|"topic"|"verse_search"|"general";
  keywords?: string[];
  fact_id?: string;
  surah?: string;
  verse?: number;
};
type TopicResult = {id:string;kind:"quran"|"tafsir"|"hadith"|"knowledge";title:string;text:string;source:string;verseKey?:string};
type ReviewStrength = {score:number;attempts:number;updatedAt:number};
type ReviewSummary = {mode:string;total:number;correct:number;assisted:number;score:number;minutes:number};

declare global {
  interface Window {
    Android?: {
      saveReaderPage:(page:number)=>void;
      saveReaderPosition?:(page:number,surah:string,ayah:string)=>void;
      getReaderPage:()=>number;
      setSystemBarsDark?:(dark:boolean)=>void;
      isSystemDarkMode?:()=>boolean;
      canDrawIqamaOverlay?:()=>boolean;
      requestIqamaOverlayPermission?:()=>void;
      requestExactAlarmPermission?:()=>void;
      setIqamaSchedule?:(json:string)=>void;
      previewIqamaOverlay?:(prayer:string,dark:boolean)=>void;
      enableAutomaticIqama?:(enabled:boolean,dark:boolean)=>void;
      hasPrayerLocation?:()=>boolean;
      shareText?:(text:string)=>void;
      shareImage?:(base64Png:string,fileName:string,text:string)=>void;
      startVoiceRecognition?:()=>void;
      stopVoiceRecognition?:()=>void;
      cancelVoiceRecognition?:()=>void;
      downloadSudais?:(verseIdsCsv:string)=>void;
      cancelSudaisDownload?:()=>void;
      hasSudaisAyah?:(verseId:string)=>boolean;
      hasReciterAyah?:(reciter:string,verseId:string)=>boolean;
      downloadReciter?:(reciter:string,verseIdsCsv:string)=>boolean|void;
      saveOnlineReciter?:(id:string,name:string,baseUrl:string,numbering:string)=>boolean;
      removeCustomReciter?:(id:string)=>void;
      playDownloadedAyah?:(reciter:string,verseId:string)=>boolean;
      playReciterAyah?:(reciter:string,verseId:string)=>boolean;
      stopDownloadedAyah?:()=>void;
      setAudioRequest?:(token:number)=>void;
      pauseRecitation?:()=>void;
      resumeRecitation?:()=>void;
      exportRecitations?:(reciter:string)=>void;
      importRecitations?:()=>void;
      getPrayerLocationJson?:()=>string;
      getNextPrayerJson?:()=>string;
      getDailyPrayerTimesJson?:()=>string;
      getIqamaReminderMinutes?:()=>number;
      setIqamaReminderMinutes?:(minutes:number)=>void;
      getIqamaSoundEnabled?:()=>boolean;
      setIqamaSoundEnabled?:(enabled:boolean)=>void;
      previewIqamaSound?:()=>boolean;
      setThemeMode?:(mode:"system"|"light"|"dark")=>void;
      getNextIqamaJson?:()=>string;
      chooseReciterFolder?:()=>void;
      saveCustomReciterFolder?:(id:string,name:string,treeUri:string)=>void;
      playCustomReciterAyah?:(id:string,verseId:string)=>boolean;
      requestQiblaLocation?:()=>void;
      startQiblaCompass?:()=>void;
      stopQiblaCompass?:()=>void;
      requestPinWidget?:()=>boolean;
    };
    noorVoiceSearchResult?:(text:string,error:string)=>void;
    noorVoiceStatus?:(status:string)=>void;
    noorSudaisProgress?:(done:number,total:number,message:string)=>void;
    noorReciterProgress?:(reciter:string,done:number,total:number,message:string,running:boolean)=>void;
    noorRecitationTransfer?:(success:boolean,message:string)=>void;
    noorReciterFolderPicked?:(uri:string,label:string,error:string,foundFiles?:number,foundSurahs?:number)=>void;
    noorAudioEvent?:(token:number,id:string,event:string)=>void;
    noorAudioBackground?:()=>void;
    noorAudioError?:(message:string)=>void;
    noorQiblaLocation?:(lat:number,lon:number,error:string)=>void;
    noorQiblaHeading?:(heading:number,accuracy:number)=>void;
    noorSystemThemeChanged?:(dark:boolean)=>void;
    noorIqamaStatus?:(success:boolean,message:string)=>void;
    noorShowIqama?:(prayer:string,iqamaAt:number)=>void;
    noorHandleBack?:()=>boolean;
    noorWidgetAction?:(action:string)=>void;
    __NOOR_INITIAL_THEME__?:{mode:"system"|"light"|"dark";dark:boolean};
  }
}

const suggestions=["ما معنى الصمد؟","كم مرة ذُكرت الجنة؟"];
const contextualWordGlosses:Record<string,string>={
  "2:7|غشاوه":"غِشاوة: غطاءٌ وحجابٌ على الأبصار. في سياق الآية: جُعل على أبصارهم غطاء فلا ينتفعون برؤية الحق.",
  "2:7|ختم":"خَتَمَ: طبع وأغلق. في سياق الآية: طبع الله على قلوبهم وسمعهم بسبب كفرهم فلا يصل إليهما الهدى.",
  "2:2|المتقين":"المتقون: الذين يجعلون بينهم وبين عذاب الله وقاية بطاعته واجتناب معصيته."
};
const stopWords=new Set(["ما","ماذا","من","عن","في","الى","الي","هو","هي","معنى","اشرح","شرح","أين","اين","كيف","متى","اول","أول","شخص","وصل","ذكر","القرآن","القران","سورة","آية","اية","سبب","نزول","سبب النزول"]);
const functionWordMeanings:Record<string,string>={
  "من":"حرف جر، ويأتي لابتداء الغاية أو التبعيض أو غيرهما بحسب السياق.",
  "في":"حرف جر يفيد الظرفية غالبًا بحسب السياق.",
  "على":"حرف جر يفيد الاستعلاء حقيقةً أو مجازًا بحسب السياق.",
  "الى":"حرف جر يدل غالبًا على انتهاء الغاية.",
  "عن":"حرف جر يفيد المجاوزة أو البعد بحسب السياق.",
  "ب":"حرف جر، ومن معانيه الإلصاق والاستعانة والسببية بحسب السياق.",
  "ك":"حرف تشبيه وجر.",
  "ل":"حرف جر، ومن معانيه الملك والاختصاص والتعليل بحسب السياق.",
  "و":"حرف عطف أو استئناف بحسب السياق.",
  "ف":"حرف عطف أو تفريع يدل غالبًا على التعقيب بحسب السياق.",
  "ثم":"حرف عطف للترتيب مع التراخي.",
  "او":"حرف عطف، ويأتي للتخيير أو التقسيم أو الإباحة بحسب السياق.",
  "لا":"أداة نفي أو نهي أو غير ذلك بحسب السياق.",
  "ما":"قد تأتي اسمًا موصولًا أو أداة استفهام أو نفي أو غير ذلك بحسب السياق.",
  "ان":"قد تأتي أداة توكيد أو شرط أو نفي بحسب الضبط والسياق.",
  "انما":"أداة حصر وتوكيد.",
  "هل":"أداة استفهام.",
  "هذا":"اسم إشارة للمفرد المذكر.",
  "هذه":"اسم إشارة للمفرد المؤنث.",
  "ذلك":"اسم إشارة للبعيد المفرد المذكر.",
  "تلك":"اسم إشارة للبعيد المفرد المؤنث.",
  "الذي":"اسم موصول للمفرد المذكر.",
  "التي":"اسم موصول للمفرد المؤنث.",
  "الذين":"اسم موصول لجمع المذكر.",
  "هو":"ضمير منفصل للمفرد المذكر الغائب.",
  "هي":"ضمير منفصل للمفرد المؤنث الغائب.",
  "هم":"ضمير لجمع الغائبين.",
  "هن":"ضمير لجمع الغائبات.",
  "انا":"ضمير المتكلم المفرد.",
  "نحن":"ضمير المتكلمين.",
  "انت":"ضمير للمخاطب بحسب الضبط والسياق.",
  "كان":"فعل ماض ناقص، ويدل مع خبره على اتصاف الاسم بالخبر في الزمن أو السياق المذكور.",
  "ليس":"فعل ماض ناقص جامد يفيد النفي.",
  "كل":"لفظ يفيد الشمول بحسب ما يضاف إليه.",
  "بعض":"لفظ يدل على جزء من كل.",
  "قبل":"ظرف يدل على التقدم زمانًا أو مكانًا بحسب السياق.",
  "بعد":"ظرف يدل على التأخر زمانًا أو مكانًا بحسب السياق."
};

function Glass({children,className="",onClick}:{children:React.ReactNode,className?:string,onClick?:React.MouseEventHandler<HTMLDivElement>}) {
  return <div className={`glass ${className}`} onClick={onClick}>{children}</div>;
}

function ReciterChoiceButton({id,name,active,onSelect,onLongPress}:{id:string;name:string;active:boolean;onSelect:()=>void;onLongPress:()=>void}){
  const timer=useRef<number>(0),fired=useRef(false),origin=useRef({x:0,y:0});
  const clear=()=>{window.clearTimeout(timer.current);timer.current=0};
  useEffect(()=>()=>clear(),[]);
  return <button type="button" className={`reciterOption ${active?"active":""}`}
    onPointerDown={event=>{event.stopPropagation();if(event.button>0)return;origin.current={x:event.clientX,y:event.clientY};fired.current=false;clear();timer.current=window.setTimeout(()=>{fired.current=true;onLongPress()},520)}}
    onPointerMove={event=>{if(Math.hypot(event.clientX-origin.current.x,event.clientY-origin.current.y)>9)clear()}}
    onPointerUp={event=>{event.stopPropagation();clear()}} onPointerCancel={clear} onPointerLeave={clear}
    onClick={event=>{event.stopPropagation();if(fired.current){fired.current=false;return}onSelect()}}
    onContextMenu={event=>event.preventDefault()} aria-label={`${name}${active?"، القارئ الحالي":""}. اضغط مطولًا لإدارة التنزيل`}
  ><span>{name}</span>{active&&<Check/>}</button>;
}

function GlassSelect({label,value,onChange,children}:{label:string;value:number;onChange:(value:number)=>void;children:React.ReactNode}){
  const [open,setOpen]=useState(false);
  const root=useRef<HTMLDivElement>(null);
  const options=React.Children.toArray(children).filter(React.isValidElement) as React.ReactElement<{value:number|string;children:React.ReactNode}>[];
  const selected=options.find(option=>Number(option.props.value)===value);
  useEffect(()=>{
    if(!open)return;
    const close=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false)};
    document.addEventListener("pointerdown",close);
    return()=>document.removeEventListener("pointerdown",close);
  },[open]);
  return <div className={`glassSelect ${open?"isOpen":""}`} ref={root}>
    <span>{label}</span>
    <button type="button" className="glassSelectControl" role="combobox" aria-label={label} aria-expanded={open} onClick={()=>setOpen(current=>!current)}><b>{selected?.props.children??value}</b><ChevronDown/></button>
    {open&&<div className="glassSelectMenu" role="listbox" aria-label={`خيارات ${label}`}>{options.map(option=>{const next=Number(option.props.value);return <button type="button" role="option" aria-selected={next===value} className={next===value?"selected":""} key={next} onClick={()=>{onChange(next);setOpen(false)}}><span>{option.props.children}</span>{next===value&&<Check/>}</button>})}</div>}
  </div>;
}

function normalizeArabic(s:string){
  return normalizeArabicSearch(s);
}
function cleanQuranDisplay(s:string){
  // Only remove invisible bidi controls. The bundled Unicode Naskh font
  // supports the Quran's actual Uthmani letters and recitation marks.
  return s.normalize("NFC")
    .replace(/[\u200B-\u200F\u2066-\u2069\uFEFF]/g,"");
}
// Some Android WebView fonts draw Quranic annotation signs as empty boxes outside
// the reader. Keep the original Uthmani text in the dataset and reader unchanged.
function readableQuranPreview(s:string){return cleanQuranDisplay(s).replace(/[\u06D6-\u06ED]/g,"");}
function arNum(n:number){ return String(n).replace(/\d/g,d=>"٠١٢٣٤٥٦٧٨٩"[Number(d)]); }
function clamp(n:number,min:number,max:number){ return Math.max(min,Math.min(max,n)); }
function calculateQiblaBearing(lat:number,lon:number){
  const kaabaLat=21.422487,kaabaLon=39.826206;
  const phi1=lat*Math.PI/180,phi2=kaabaLat*Math.PI/180;
  const dl=(kaabaLon-lon)*Math.PI/180;
  const y=Math.sin(dl)*Math.cos(phi2);
  const x=Math.cos(phi1)*Math.sin(phi2)-Math.sin(phi1)*Math.cos(phi2)*Math.cos(dl);
  return (Math.atan2(y,x)*180/Math.PI+360)%360;
}
function normalizeDegrees(angle:number){return ((angle%360)+360)%360}
function wordSimilarity(a:string,b:string){
  const aw=normalizeArabic(a).split(" ").filter(Boolean),bw=normalizeArabic(b).split(" ").filter(Boolean);
  if(!aw.length||!bw.length)return 0;
  let matches=0;
  const used=new Set<number>();
  for(const w of aw){const i=bw.findIndex((x,idx)=>!used.has(idx)&&(x===w||x.includes(w)||w.includes(x)));if(i>=0){used.add(i);matches++}}
  return matches/Math.max(aw.length,Math.min(bw.length,aw.length+2));
}

function matchQuranVoice<T extends {text:string;verse_key:string}>(spoken:string,verses:T[]):{verse:T;score:number}|null{
  const heard=normalizeArabic(spoken).split(" ").filter(Boolean);
  if(heard.length<3)return null;
  const scores=verses.map(verse=>{
    const words=normalizeArabic(verse.text).split(" ").filter(Boolean);
    let best=0;
    for(let start=0;start<words.length;start++){
      let score=0;
      for(let i=0;i<heard.length&&start+i<words.length;i++){
        const a=heard[i],b=words[start+i];
        if(a===b)score+=1;
        else if(a.length>=4&&b.length>=4&&(a.startsWith(b)||b.startsWith(a)))score+=.72;
      }
      best=Math.max(best,score/heard.length);
      if(best===1)break;
    }
    return {verse,score:best};
  }).filter(item=>item.score>=.68).sort((a,b)=>b.score-a.score);
  if(!scores.length)return null;
  // Identical phrases can occur in several places; do not silently jump to
  // an arbitrary surah when the audio cannot distinguish them.
  if(scores[1]&&scores[0].score-scores[1].score<.08)return null;
  return scores[0];
}

function useLiquidRuntime(){
  useEffect(()=>{
    const root=document.documentElement;
    let pressed:HTMLElement|null=null;
    let raf=0;
    let timer=0;
    let maxViewport=Math.max(window.innerHeight,window.visualViewport?.height||0);
    const setVH=()=>{
      const h=Math.round(window.visualViewport?.height ?? window.innerHeight);
      if(h>maxViewport-40)maxViewport=Math.max(maxViewport,h);
      const keyboardOpen=(maxViewport-h)>120;
      root.style.setProperty("--vvh",`${h}px`);
      root.style.setProperty("--keyboard-gap",`${Math.max(0,maxViewport-h)}px`);
      root.classList.toggle("keyboard-open",keyboardOpen);
    };
    const update=(el:HTMLElement,ev:PointerEvent)=>{
      cancelAnimationFrame(raf);
      raf=requestAnimationFrame(()=>{
        const r=el.getBoundingClientRect();
        if(!r.width||!r.height)return;
        const px=clamp(ev.clientX-r.left,0,r.width), py=clamp(ev.clientY-r.top,0,r.height);
        el.style.setProperty("--touch-x",`${px}px`);
        el.style.setProperty("--touch-y",`${py}px`);
        el.style.setProperty("--gx",`${px/r.width*100}%`);
        el.style.setProperty("--gy",`${py/r.height*100}%`);
      });
    };
    const down=(ev:PointerEvent)=>{
      const el=(ev.target as HTMLElement)?.closest("button") as HTMLElement|null;
      if(!el)return;
      pressed=el; clearTimeout(timer); update(el,ev);
      el.classList.remove("liquid-release"); el.classList.add("liquid-press");
    };
    const move=(ev:PointerEvent)=>{ if(pressed) update(pressed,ev); };
    const release=()=>{
      if(!pressed)return;
      const el=pressed; pressed=null; el.classList.remove("liquid-press"); el.classList.add("liquid-release");
      timer=window.setTimeout(()=>el.classList.remove("liquid-release"),360);
    };
    setVH();
    window.visualViewport?.addEventListener("resize",setVH);
    window.addEventListener("orientationchange",setVH,{passive:true});
    document.addEventListener("pointerdown",down,{passive:true});
    document.addEventListener("pointermove",move,{passive:true});
    document.addEventListener("pointerup",release,{passive:true});
    document.addEventListener("pointercancel",release,{passive:true});
    return()=>{
      cancelAnimationFrame(raf); clearTimeout(timer);
      window.visualViewport?.removeEventListener("resize",setVH);
      window.removeEventListener("orientationchange",setVH);
      document.removeEventListener("pointerdown",down);
      document.removeEventListener("pointermove",move);
      document.removeEventListener("pointerup",release);
      document.removeEventListener("pointercancel",release);
    };
  },[]);
}

export function App(){
  useLiquidRuntime();

  const [q,setQ]=useState("");
  const [answer,setAnswer]=useState<Answer|null>(null);
  const [tab,setTab]=useState<"home"|"quran"|"saved"|"settings">(()=>{
    const saved=localStorage.getItem("noor_last_tab");
    return saved==="quran"||saved==="saved"||saved==="settings"||saved==="home"?saved:"home";
  });
  const [quranMounted,setQuranMounted]=useState(tab==="quran");
  const [themeMode,setThemeMode]=useState<"system"|"light"|"dark">(()=>window.__NOOR_INITIAL_THEME__?.mode??(()=>{const saved=localStorage.getItem("noor_theme_mode");return saved==="light"||saved==="dark"||saved==="system"?saved:"system"})());
  const systemDark=()=>window.Android?.isSystemDarkMode?.() ?? (window.matchMedia?.("(prefers-color-scheme: dark)").matches??false);
  const [dark,setDark]=useState(()=>window.__NOOR_INITIAL_THEME__?.dark??(themeMode==="system"?systemDark():themeMode==="dark"));
  const [quranFont,setQuranFont]=useState<"hafs"|"amiri"|"scheherazade">(()=>{
    const saved=localStorage.getItem("noor_quran_font");
    return saved==="amiri"||saved==="scheherazade"?saved:"hafs";
  });
  const [guideStep,setGuideStep]=useState(()=>localStorage.getItem("noor_guidance_seen")==="1"?-1:0);
  const [guidanceEnabled,setGuidanceEnabled]=useState(()=>localStorage.getItem("noor_guidance_enabled")!=="0");
  const [contextTip,setContextTip]=useState<"word"|"audio"|null>(null);
  const guidanceTipShownRef=useRef(false);
  const pickerGestureRef=useRef<{x:number;y:number;dragged:boolean}>({x:0,y:0,dragged:false});
  const beginPickerGesture=(e:React.PointerEvent)=>{pickerGestureRef.current={x:e.clientX,y:e.clientY,dragged:false}};
  const movePickerGesture=(e:React.PointerEvent)=>{const g=pickerGestureRef.current;if(Math.hypot(e.clientX-g.x,e.clientY-g.y)>8)g.dragged=true};
  const pickerWasDragged=()=>pickerGestureRef.current.dragged;
  const [toast,setToast]=useState("");
  const [sources,setSources]=useState(false);
  const [thinking,setThinking]=useState(false);
  const [askMode,setAskMode]=useState<"quran"|"sirah">("quran");
  const [sirahPage,setSirahPage]=useState(false);
  const [thinkingStage,setThinkingStage]=useState("أفهم سؤالك…");
  function learnGuidanceTip(tip:"word"|"audio") {
    localStorage.setItem(`noor_tip_${tip}`,"1");
    setContextTip(current=>current===tip?null:current);
  }
  const aiRateRef=useRef<number[]>([]);
  function allowAiRequest(){
    const now=Date.now();
    aiRateRef.current=aiRateRef.current.filter(t=>now-t<60*60*1000);
    if(aiRateRef.current.length>=30)return false;
    const last=aiRateRef.current[aiRateRef.current.length-1]||0;
    if(now-last<1500)return false;
    aiRateRef.current.push(now); return true;
  }
  const [customSources,setCustomSources]=useState<Array<{id:string;title:string;content:string}>>(()=>{try{return JSON.parse(localStorage.getItem("noor_custom_sources")||"[]")}catch{return []}});
  const [sourceTitle,setSourceTitle]=useState("");
  const [sourceContent,setSourceContent]=useState("");
  const [iqamaEnabled,setIqamaEnabled]=useState(()=>localStorage.getItem("noor_iqama_enabled")==="1");
  const [iqamaReminder,setIqamaReminder]=useState<{prayer:string;iqamaAt:number}|null>(null);
  const [iqamaNow,setIqamaNow]=useState(()=>Date.now());
  const [prayerLocationReady,setPrayerLocationReady]=useState(()=>Boolean(window.Android?.hasPrayerLocation?.()));
  const [nextPrayer,setNextPrayer]=useState<{name:string;timeMillis:number}|null>(()=>{try{const raw=window.Android?.getNextPrayerJson?.();return raw?JSON.parse(raw):null}catch{return null}});
  const [prayerTimesOpen,setPrayerTimesOpen]=useState(false);
  const [dailyPrayers,setDailyPrayers]=useState<Array<{name:string;adhanAt:number;iqamaAt:number;isFriday?:boolean}>>([]);
  const [khutbah,setKhutbah]=useState<KhutbahRecord|null>(()=>readKhutbahCache());
  const [khutbahDetailsOpen,setKhutbahDetailsOpen]=useState(false);
  const [iqamaReminderMinutes,setIqamaReminderMinutes]=useState(()=>window.Android?.getIqamaReminderMinutes?.()||Number(localStorage.getItem("noor_iqama_reminder_minutes")||5));
  const [iqamaReminderDraft,setIqamaReminderDraft]=useState(()=>String(iqamaReminderMinutes));
  const [iqamaReminderError,setIqamaReminderError]=useState("");
  const [iqamaSoundEnabled,setIqamaSoundEnabled]=useState(()=>window.Android?.getIqamaSoundEnabled?.()??localStorage.getItem("noor_iqama_sound_enabled")==="1");
  const [nextIqamaLabel,setNextIqamaLabel]=useState("");
  const [uiSoundsEnabled,setUiSoundsEnabled]=useState(()=>localStorage.getItem("noor_ui_sounds")!=="0");
  const uiAudioCtxRef=useRef<AudioContext|null>(null);
  const iqamaPollRef=useRef<number>(0);
  const refreshPrayerShortcut=()=>{setPrayerLocationReady(Boolean(window.Android?.hasPrayerLocation?.()));try{const raw=window.Android?.getNextPrayerJson?.();setNextPrayer(raw?JSON.parse(raw):null)}catch{setNextPrayer(null)};try{const raw=window.Android?.getNextIqamaJson?.();if(raw){const info=JSON.parse(raw);setNextIqamaLabel(`${info.name} · ${new Intl.DateTimeFormat("ar-SA",{hour:"numeric",minute:"2-digit"}).format(new Date(info.iqamaAt))}`)}else setNextIqamaLabel("")}catch{setNextIqamaLabel("")}};
  useEffect(()=>{refreshPrayerShortcut();const timer=window.setInterval(refreshPrayerShortcut,60_000);return()=>window.clearInterval(timer)},[]);
  const nextPrayerTime=nextPrayer?new Intl.DateTimeFormat("ar-SA",{hour:"numeric",minute:"2-digit"}).format(new Date(nextPrayer.timeMillis)):"";
  const openFlashcardShortcut=()=>{setTab("quran");setQuranMounted(true);window.setTimeout(()=>beginFlashcards(),80)};
  const openReviewShortcut=()=>{setTab("saved");setAnswer(null);window.setTimeout(()=>document.querySelector(".reviewRange")?.scrollIntoView({behavior:"smooth",block:"start"}),120)};
  const loadKhutbah=async()=>{const next=await refreshKhutbah();if(next.status!=="network_error"||next.targetFridayDate===readKhutbahCache()?.targetFridayDate){saveKhutbahCache(next);setKhutbah(next);return}setKhutbah(readKhutbahCache()||next)};
  const openPrayerTimes=()=>{try{const raw=window.Android?.getDailyPrayerTimesJson?.();setDailyPrayers(raw?JSON.parse(raw).prayers||[]:[])}catch{setDailyPrayers([])}setPrayerTimesOpen(true);void loadKhutbah()};
  const openIqamaShortcut=()=>{setPrayerTimesOpen(false);setTab("settings");setAnswer(null);window.setTimeout(()=>document.querySelector(".iqamaSettings")?.scrollIntoView({behavior:"smooth",block:"center"}),120)};
  const commitIqamaReminder=()=>{
    const text=iqamaReminderDraft.trim().replace(/[٠-٩۰-۹]/g,d=>String(d.charCodeAt(0)-(d<="٩"?0x660:0x6f0)));
    if(!/^[1-9]$/.test(text)){setIqamaReminderError("أدخل عددًا صحيحًا من ١ إلى ٩ دقائق");return false;}
    const minutes=Number(text);
    setIqamaReminderError("");setIqamaReminderDraft(text);
    if(minutes!==iqamaReminderMinutes){setIqamaReminderMinutes(minutes);localStorage.setItem("noor_iqama_reminder_minutes",text);window.Android?.setIqamaReminderMinutes?.(minutes);refreshPrayerShortcut();}
    return true;
  };
  const saveIqamaSchedule=()=>{
    if(!commitIqamaReminder())return;
    localStorage.setItem("noor_iqama_enabled",iqamaEnabled?"1":"0");
    if(!window.Android){setToast("تم حفظ الإعداد");setTimeout(()=>setToast(""),2200);return;}
    // Overlay permission is optional. Scheduling must still work as a normal Android
    // notification while Noor is closed or in the background.
    window.Android.requestExactAlarmPermission?.();
    window.Android.enableAutomaticIqama?.(iqamaEnabled,dark);
    if(!iqamaEnabled){setToast("تم إيقاف تنبيه الإقامة");setTimeout(()=>setToast(""),2200);return;}
    setToast("جاري تحديد الموقع وجدولة الإقامة…");
    window.clearInterval(iqamaPollRef.current);
    let tries=0; iqamaPollRef.current=window.setInterval(()=>{tries++;if(window.Android?.hasPrayerLocation?.()){clearInterval(iqamaPollRef.current);refreshPrayerShortcut();setToast("تم تحديد الموقع وجدولة الإقامة ✓");setTimeout(()=>setToast(""),3000)}else if(tries>40){clearInterval(iqamaPollRef.current);setToast("لم يكتمل تحديد الموقع. تأكد من تشغيل الموقع ومنح الإذن ثم حاول مرة أخرى.");setTimeout(()=>setToast(""),4200)}},500);
  };

  const [quran,setQuran]=useState<QuranData|null>(null);
  const [mufradat,setMufradat]=useState<Record<string,MufradatEntry>>({});
  const [roots,setRoots]=useState<Record<string,RootEntry>>({});
  const [asbab,setAsbab]=useState<AsbabEntry[]>([]);
  const [wordRootIndex,setWordRootIndex]=useState<Record<string,string>>({});
  const [commonFacts,setCommonFacts]=useState<CommonFact[]>([]);
  const [dataError,setDataError]=useState("");
  const rootCache=useRef<Record<number,RootAyah[]>>({});
  const tafsirCache=useRef<Record<number,TafsirSurah>>({});
  const tafsirSearchCache=useRef<TafsirSearchItem[]|null>(null);
  const hadithCache=useRef<HadithIndexItem[]|null>(null);
  const hadithWorkerRef=useRef<Worker|null>(null);
  const hadithWorkerQueries=useRef(new Map<string,{resolve:(items:HadithIndexItem[])=>void;timer:number}>());
  const knowledgeCache=useRef<KnowledgeItem[]|null>(null);

  const [readerPage,setReaderPage]=useState(()=>{
    const native=window.Android?.getReaderPage?.();
    if(native && native>0)return native;
    return Number(localStorage.getItem("noor_reader_page")||"1");
  });
  const [wordInfo,setWordInfo]=useState<WordInfo|null>(null);
  const [wordAction,setWordAction]=useState<WordAction|null>(null);
  const [asbabDetail,setAsbabDetail]=useState<{verse:ReaderVerse;entry:AsbabEntry;contextual?:boolean;relatedAyah?:number}|null>(null);
  const audioRef=useRef<HTMLAudioElement|null>(null);
  const audioCleanupRef=useRef<(()=>void)|null>(null);
  const [surahPicker,setSurahPicker]=useState(false);
  const [repeatOpen,setRepeatOpen]=useState(false),[orderOpen,setOrderOpen]=useState(false);
  const [autoScroll,setAutoScroll]=useState(false);
  const [autoScrollSpeed,setAutoScrollSpeed]=useState(()=>Number(localStorage.getItem("noor_auto_scroll_speed")||"2"));
  // Page-flip mode was removed: the Quran reader now always uses the smooth
  // continuous vertical reader. Legacy saved "pages" values are ignored.
  const [readerMode]=useState<"continuous"|"pages">("continuous");
  const [pageTurn,setPageTurn]=useState<{direction:"next"|"prev";token:number}>({direction:"next",token:0});
  const pageSwipeStart=useRef<number|null>(null);
  const pageInnerRef=useRef<HTMLDivElement>(null);
  const pageFontSize=30;
  const [pageScreen,setPageScreen]=useState(()=>Number(localStorage.getItem("noor_reader_screen")||0));
  const [pageScreens,setPageScreens]=useState(1);
  const pendingLastScreen=useRef(false);
  const [bookmarks,setBookmarks]=useState<string[]>(()=>JSON.parse(localStorage.getItem("noor_bookmarks")||"[]"));
  const [pickerTab,setPickerTab]=useState<"surahs"|"juz"|"hizb"|"pages">("surahs");
  const [quranSearch,setQuranSearch]=useState("");
  const [debouncedQuranSearch,setDebouncedQuranSearch]=useState("");
  const [focusMode,setFocusMode]=useState(false);
  useEffect(()=>{
    if(!guidanceEnabled||guideStep>=0||tab!=="quran"||focusMode||wordInfo||wordAction||guidanceTipShownRef.current)return;
    const next=!localStorage.getItem("noor_tip_word")?"word":!localStorage.getItem("noor_tip_audio")?"audio":null;
    if(!next)return;
    const timer=window.setTimeout(()=>{setContextTip(next);guidanceTipShownRef.current=true},1600);
    return()=>window.clearTimeout(timer);
  },[guidanceEnabled,guideStep,tab,focusMode,wordInfo,wordAction]);
  const [reviewMode,setReviewMode]=useState(false);
  const [reviewFromSurah,setReviewFromSurah]=useState(1);
  const [reviewFromAyah,setReviewFromAyah]=useState(1);
  const [reviewToSurah,setReviewToSurah]=useState(1);
  const [reviewToAyah,setReviewToAyah]=useState(7);
  const [revealedReview,setRevealedReview]=useState<Set<string>>(new Set());
  const [reviewStrength,setReviewStrength]=useState<Record<string,ReviewStrength>>(()=>{try{return JSON.parse(localStorage.getItem("noor_review_strength")||"{}")}catch{return {}}});
  const [reviewSessionStarted,setReviewSessionStarted]=useState(0);
  const [reviewSessionAssisted,setReviewSessionAssisted]=useState(0);
  const [reviewSessionCorrect,setReviewSessionCorrect]=useState(0);
  const [reviewSummary,setReviewSummary]=useState<ReviewSummary|null>(null);
  const [flashcardVerse,setFlashcardVerse]=useState<ReaderVerse|null>(null);
  const [flashcardRevealed,setFlashcardRevealed]=useState(false);
  const [flashcardActive,setFlashcardActive]=useState(false);
  const [flashcardQuestionNumber,setFlashcardQuestionNumber]=useState(1);
  const [flashcardDifficulty,setFlashcardDifficulty]=useState<"easy"|"medium"|"hard">("medium");
  const [flashcardScope,setFlashcardScope]=useState<"all"|"review"|"juz"|"surah">("all");
  const [flashcardJuz,setFlashcardJuz]=useState(1);
  const [flashcardJuzPickerOpen,setFlashcardJuzPickerOpen]=useState(false);
  const [pickerSearch,setPickerSearch]=useState("");
  const [flashcardSurah,setFlashcardSurah]=useState(1);
  const [customRangeMode,setCustomRangeMode]=useState<"single"|"between">("single");
  const [answerResultLimit,setAnswerResultLimit]=useState(30);
  const [pendingVerseJump,setPendingVerseJump]=useState<{key:string;highlight:boolean}|null>(null);
  const [widgetActionPending,setWidgetActionPending]=useState<string|null>(null);
  const flashcardDeckRef=useRef<ReaderVerse[]>([]);
  const flashcardCursorRef=useRef(0);
  const [flashcardQuestionLimit,setFlashcardQuestionLimit]=useState(10);
  const [recitationActive,setRecitationActive]=useState(false);
  const [recitationText,setRecitationText]=useState("");
  const [recitationResult,setRecitationResult]=useState("");
  const [voiceListening,setVoiceListening]=useState(false);
  const [voiceStatus,setVoiceStatus]=useState("");
  const voicePurposeRef=useRef<"quran"|"recitation"|null>(null);
  const voiceHandlerRef=useRef<(text:string,error:string)=>void>(()=>{});
  const [toolPage,setToolPage]=useState<null|"qibla"|"adhkar"|"topics"|"revelation"|"stories">(null);
  const [qiblaHeading,setQiblaHeading]=useState(0);
  const [qiblaBearing,setQiblaBearing]=useState<number|null>(null);
  const [qiblaStatus,setQiblaStatus]=useState("جاهز لتحديد اتجاه القبلة");
  const [qiblaAccuracy,setQiblaAccuracy]=useState(0);
  const [adhkarCategory,setAdhkarCategory]=useState<DhikrCategory>("morning");
  const [adhkarCounts,setAdhkarCounts]=useState<Record<string,number>>(()=>{try{return JSON.parse(localStorage.getItem("noor_adhkar_counts")||"{}")}catch{return {}}});
  const [topicQuery,setTopicQuery]=useState("");
  const [topicResults,setTopicResults]=useState<TopicResult[]>([]);
  const [topicLoading,setTopicLoading]=useState(false);
  const [khatmaDays,setKhatmaDays]=useState(()=>Number(localStorage.getItem("noor_khatma_days")||"30"));
  const [khatmaDaysDraft,setKhatmaDaysDraft]=useState(()=>localStorage.getItem("noor_khatma_days")||"30");
  const [khatmaStart,setKhatmaStart]=useState(()=>localStorage.getItem("noor_khatma_start")||"");
  const [khatmaRead,setKhatmaRead]=useState(()=>Number(localStorage.getItem("noor_khatma_read")||"0"));
  const [sudaisProgress,setSudaisProgress]=useState("");
  const [sudaisDownloading,setSudaisDownloading]=useState(false);
  const [reciterManageId,setReciterManageId]=useState<string|null>(null);
  const [reciterDownloadProgress,setReciterDownloadProgress]=useState<{reciter:string;done:number;total:number;message:string;running:boolean}|null>(null);
  const activeDownloadReciterRef=useRef<string>("");
  const [reciter,setReciter]=useState<string>(()=>{
    const stored=localStorage.getItem("noor_reciter");
    return stored&&(["sudais","minshawy","ali_jaber","shuraim","dosari"].includes(stored)||readCustomReciters().some(item=>item.id===stored))?stored:"sudais";
  });
  const [reciterPickerOpen,setReciterPickerOpen]=useState(false);
  const [customReciters,setCustomReciters]=useState<CustomReciter[]>(readCustomReciters);
  const [addingReciter,setAddingReciter]=useState(false);
  const [catalogResults,setCatalogResults]=useState<CatalogReciter[]>([]);
  const [catalogSearched,setCatalogSearched]=useState(false);
  const [catalogBusy,setCatalogBusy]=useState(false);
  const [catalogError,setCatalogError]=useState("");
  const [catalogChoice,setCatalogChoice]=useState<CatalogReciter[]|null>(null);
  const [catalogAdding,setCatalogAdding]=useState("");
  const reciterSearchRequestRef=useRef(0),browserDownloadAbortRef=useRef<AbortController|null>(null),downloadRunningRef=useRef(false),audioRequestRef=useRef(0);
  useEffect(()=>{for(const item of customReciters)if(item.baseUrl)window.Android?.saveOnlineReciter?.(item.id,item.name,item.baseUrl,item.numbering||"verseId");},[customReciters]);
  useEffect(()=>()=>{browserDownloadAbortRef.current?.abort();audioRef.current?.pause();},[]);
  const [newReciterName,setNewReciterName]=useState("");
  const [newReciterUrl,setNewReciterUrl]=useState("");
  const [newReciterFolder,setNewReciterFolder]=useState<{uri:string;label:string;foundFiles:number;foundSurahs:number}|null>(null);
  const [newReciterSource,setNewReciterSource]=useState<"folder"|"url">("folder");
  const [verseContext,setVerseContext]=useState<ReaderVerse|null>(null);
  const [lastVerseKey,setLastVerseKey]=useState(()=>localStorage.getItem("noor_last_verse")||"");
  const readerRef=useRef<HTMLDivElement>(null);
  const readerPositionRef=useRef(Number(localStorage.getItem("noor_reader_continuous_scroll")||"0"));
  const restoringReader=useRef(false);
  const scrollSaveTimer=useRef<number>(0);
  const highlightTimer=useRef<number>(0);
  const navigationRaf=useRef<number>(0);
  const lastVerseRef=useRef(lastVerseKey);
  const reviewFrom=`${reviewFromSurah}:${reviewFromAyah}`;
  const reviewTo=`${reviewToSurah}:${reviewToAyah}`;

  useEffect(()=>{
    let active=true;
    // The reader must not wait for dictionaries, tafsir helpers or the search
    // knowledge base. Load the Quran first, then prepare secondary data in the
    // background. This turns the Quran button into a cheap tab switch.
    fetch("./data/quran.json")
      .then(r=>{if(!r.ok)throw new Error("quran");return r.json()})
      .then(q=>{if(active)setQuran(q as QuranData)})
      .catch(()=>{if(active)setDataError("تعذر تحميل بيانات القرآن. أعد بناء النسخة من GitHub Actions.")});
    Promise.all([
      fetch("./data/mufradat.json").then(r=>r.ok?r.json():{}),
      fetch("./data/roots_index.json").then(r=>r.ok?r.json():{}),
      fetch("./data/asbab.json").then(r=>r.ok?r.json():[]),
      fetch("./data/word_root_index.json").then(r=>r.ok?r.json():{}).catch(()=>({})),
      fetch("./data/common_facts.json").then(r=>r.ok?r.json():[]).catch(()=>([]))
    ]).then(([m,r,a,w,f])=>{
      if(!active)return;
      setMufradat(m);setRoots(r);setAsbab(Array.isArray(a)?a:[]);
      setWordRootIndex(w||{});setCommonFacts(Array.isArray(f)?f:[]);
    }).catch(()=>{});
    return()=>{active=false};
  },[]);

  useEffect(()=>{
    const timer=window.setTimeout(()=>setDebouncedQuranSearch(quranSearch),320);
    return()=>window.clearTimeout(timer);
  },[quranSearch]);

  useEffect(()=>{lastVerseRef.current=lastVerseKey},[lastVerseKey]);


  function runThemeTransition(update:()=>void,origin?:{x:number;y:number}){
    const root=document.documentElement;
    const x=origin?.x??window.innerWidth/2,y=origin?.y??0;
    root.style.setProperty("--theme-x",`${x}px`);root.style.setProperty("--theme-y",`${y}px`);
    const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const doc=document as Document&{startViewTransition?:(cb:()=>void)=>unknown};
    if(!reduced&&doc.startViewTransition){doc.startViewTransition(()=>flushSync(update));return}
    root.classList.add("theme-crossfade");flushSync(update);window.setTimeout(()=>root.classList.remove("theme-crossfade"),380);
  }
  function chooseTheme(mode:"system"|"light"|"dark",event?:React.MouseEvent<HTMLElement>){
    const rect=event?.currentTarget.getBoundingClientRect();
    const next=mode==="system"?systemDark():mode==="dark";
    runThemeTransition(()=>{setThemeMode(mode);setDark(next)},rect?{x:rect.left+rect.width/2,y:rect.top+rect.height/2}:undefined);
  }
  useEffect(()=>{
    localStorage.setItem("noor_theme_mode",themeMode);
    window.Android?.setThemeMode?.(themeMode);
    const media=window.matchMedia?.("(prefers-color-scheme: dark)");
    const syncSystemTheme=()=>{if(themeMode!=="system")return;const next=systemDark();if(next===dark)return;runThemeTransition(()=>setDark(next),{x:window.innerWidth/2,y:0})};
    syncSystemTheme();
    const apply=()=>syncSystemTheme();
    media?.addEventListener?.("change",apply);
    window.addEventListener("focus",apply);
    document.addEventListener("visibilitychange",apply);
    const poll=window.setInterval(()=>{if(document.visibilityState==="visible")syncSystemTheme()},1500);
    return()=>{media?.removeEventListener?.("change",apply);window.removeEventListener("focus",apply);document.removeEventListener("visibilitychange",apply);window.clearInterval(poll)};
  },[themeMode,dark]);
  useEffect(()=>{
    window.noorSystemThemeChanged=(isDark)=>{if(themeMode==="system")runThemeTransition(()=>setDark(Boolean(isDark)),{x:window.innerWidth/2,y:0})};
    return()=>{window.noorSystemThemeChanged=undefined};
  },[themeMode]);
  useEffect(()=>{localStorage.setItem("noor_quran_font",quranFont)},[quranFont]);
  useLayoutEffect(()=>{
    localStorage.setItem("noor_theme",dark?"dark":"light");
    document.documentElement.style.colorScheme=dark?"dark":"light";
    document.documentElement.classList.toggle("dark-root",dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content",dark?"#06110d":"#e8eee9");
    window.Android?.setSystemBarsDark?.(dark);
  },[dark]);

  useEffect(()=>{
    localStorage.setItem("noor_ui_sounds",uiSoundsEnabled?"1":"0");
    if(!uiSoundsEnabled)return;
    const play=(event:PointerEvent)=>{
      const target=(event.target as Element|null)?.closest?.("button,[role=button]") as HTMLElement|null;
      if(!target||target.hasAttribute("disabled")||target.closest(".mushafText"))return;
      try{
        const AudioCtor=window.AudioContext||(window as any).webkitAudioContext;if(!AudioCtor)return;
        const ctx=uiAudioCtxRef.current||(uiAudioCtxRef.current=new AudioCtor());
        if(ctx.state==="suspended")void ctx.resume();
        const osc=ctx.createOscillator(),gain=ctx.createGain();
        osc.type="sine";osc.frequency.setValueAtTime(520,ctx.currentTime);osc.frequency.exponentialRampToValueAtTime(390,ctx.currentTime+.038);
        gain.gain.setValueAtTime(.018,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.045);
        osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.05);
      }catch{}
    };
    document.addEventListener("pointerdown",play,{capture:true,passive:true});
    return()=>document.removeEventListener("pointerdown",play,true);
  },[uiSoundsEnabled]);

  useEffect(()=>{
    window.noorWidgetAction=action=>setWidgetActionPending(String(action||"home"));
    window.noorIqamaStatus=(success,message)=>{
      window.clearInterval(iqamaPollRef.current);
      setToast(message||(success?"تم تحديد الموقع وجدولة الإقامة ✓":"تعذر تحديد الموقع"));
      window.setTimeout(()=>setToast(""),success?3000:4500);
    };
    window.noorShowIqama=(prayer,iqamaAt)=>{
      setIqamaNow(Date.now());
      setIqamaReminder({prayer,iqamaAt:Number(iqamaAt)});
    };
    window.noorVoiceSearchResult=(text,error)=>{setVoiceListening(false);setVoiceStatus("");voiceHandlerRef.current(String(text||""),String(error||""))};
    window.noorVoiceStatus=status=>setVoiceStatus(String(status||""));
    window.noorReciterProgress=(id,done,total,message,running)=>{
      activeDownloadReciterRef.current=id;downloadRunningRef.current=running;setSudaisDownloading(running);setSudaisProgress(message);
      setReciterDownloadProgress({reciter:id,done:Number(done)||0,total:Number(total)||0,message,running});
    };
    window.noorSudaisProgress=(done,total,message)=>{
      const finished=message.startsWith("✓")||message.includes("توقف")||message.includes("أوقفت");
      setSudaisProgress(message);
      setReciterDownloadProgress({reciter:activeDownloadReciterRef.current||reciter,done:Number(done)||0,total:Number(total)||0,message,running:!finished});
      downloadRunningRef.current=!finished;
      if(finished)setSudaisDownloading(false);
    };
    window.noorRecitationTransfer=(success,message)=>{setSudaisProgress(message);setToast(message);window.setTimeout(()=>setToast(""),3600)};
    window.noorReciterFolderPicked=(uri,label,error,foundFiles=0,foundSurahs=0)=>{if(error){setToast(error);window.setTimeout(()=>setToast(""),3200);return}setNewReciterFolder({uri:String(uri||""),label:String(label||"مجلد التلاوات"),foundFiles:Number(foundFiles)||0,foundSurahs:Number(foundSurahs)||0});setNewReciterSource("folder")};
    window.noorAudioError=(message)=>{setToast(message);window.setTimeout(()=>setToast(""),4000)};
    window.noorQiblaLocation=(lat,lon,error)=>{
      if(error){setQiblaStatus(error);return;}
      const bearing=calculateQiblaBearing(Number(lat),Number(lon));
      setQiblaBearing(bearing);setQiblaStatus("تم تحديد الموقع · حرّك الهاتف بعيدًا عن المعادن لمعايرة البوصلة");
      window.Android?.startQiblaCompass?.();
    };
    window.noorQiblaHeading=(heading,accuracy)=>{
      const next=normalizeDegrees(Number(heading)||0);
      // Interpolate along the shortest circular arc so 359°→0° never spins backwards.
      setQiblaHeading(prev=>{const delta=((next-prev+540)%360)-180;return normalizeDegrees(prev+delta*.28)});
      setQiblaAccuracy(Number(accuracy)||0)
    };
    return()=>{
      window.noorWidgetAction=undefined;
      window.noorIqamaStatus=undefined;
      window.noorShowIqama=undefined;
      window.noorVoiceSearchResult=undefined;
      window.noorVoiceStatus=undefined;
      window.noorSudaisProgress=undefined;window.noorReciterProgress=undefined;
      window.noorReciterFolderPicked=undefined;
      window.noorAudioError=undefined;
      window.noorQiblaLocation=undefined;
      window.noorQiblaHeading=undefined;
      window.Android?.stopQiblaCompass?.();
      window.clearInterval(iqamaPollRef.current);
    };
  },[]);

  useEffect(()=>{
    if(!iqamaReminder)return;
    const tick=()=>{
      const now=Date.now();
      setIqamaNow(now);
      if(now>=iqamaReminder.iqamaAt)setIqamaReminder(null);
    };
    tick();
    const timer=window.setInterval(tick,1000);
    return()=>window.clearInterval(timer);
  },[iqamaReminder]);

  useEffect(()=>{
    window.noorHandleBack=()=>{
      if(dismissTopOverlay())return true;
      if(focusMode){setFocusMode(false);return true;}
      if(surahPicker){setSurahPicker(false);return true;}
      if(wordInfo){setWordInfo(null);return true;}
      if(wordAction){setWordAction(null);return true;}
      if(asbabDetail){setAsbabDetail(null);return true;}
      if(sources){setSources(false);return true;}
      if(reviewSummary){setReviewSummary(null);return true;}
      if(flashcardActive){finishFlashcards();return true;}
      if(recitationActive){finishRecitation();return true;}
      if(repeatOpen){setRepeatOpen(false);return true;}
      if(orderOpen){setOrderOpen(false);buildReviewSummary("ترتيب الآيات",reviewSessionCorrect,reviewSessionAssisted,reviewSessionCorrect+reviewSessionAssisted);return true;}
      if(toolPage){if(toolPage==="qibla")window.Android?.stopQiblaCompass?.();setToolPage(null);return true;}
      if(sirahPage){setSirahPage(false);return true;}
      if(answer){setAnswer(null);return true;}
      if(tab!=="home"){setTab("home");return true;}
      return false;
    };
    return()=>{window.noorHandleBack=undefined;};
  },[focusMode,surahPicker,wordInfo,wordAction,asbabDetail,sources,reviewSummary,flashcardActive,recitationActive,toolPage,sirahPage,answer,tab,reviewSessionCorrect,reviewSessionAssisted,reviewSessionStarted,repeatOpen,orderOpen]);

  useEffect(()=>{
    localStorage.setItem("noor_tab",tab);
  },[tab]);

  useEffect(()=>{
    localStorage.setItem("noor_bookmarks",JSON.stringify(bookmarks));
  },[bookmarks]);

  useEffect(()=>{localStorage.setItem("noor_review_strength",JSON.stringify(reviewStrength))},[reviewStrength]);
  useEffect(()=>{localStorage.setItem("noor_adhkar_counts",JSON.stringify(adhkarCounts))},[adhkarCounts]);

  useEffect(()=>{
    localStorage.setItem("noor_last_tab",tab);
  },[tab]);

  const pages=useMemo(()=>{
    const map:Record<number,ReaderVerse[]>={};
    if(!quran)return map;
    for(const s of quran.surahs){
      for(const a of s.ayahs){
        (map[a.page] ||= []).push({...a,surahNumber:s.number,surahName:s.name_arabic});
      }
    }
    return map;
  },[quran]);

  useEffect(()=>{
    if(!quran||lastVerseKey)return;
    const legacyPage=clamp(Number(localStorage.getItem("noor_reader_page")||readerPage)||1,1,604);
    const fallback=pages[legacyPage]?.[0];
    if(!fallback)return;
    lastVerseRef.current=fallback.verse_key;
    setLastVerseKey(fallback.verse_key);
    localStorage.setItem("noor_last_verse",fallback.verse_key);
  },[quran,pages,lastVerseKey,readerPage]);

  const verseByKey=useMemo(()=>{
    const map=new Map<string,ReaderVerse>();
    if(quran) for(const s of quran.surahs) for(const a of s.ayahs) map.set(a.verse_key,{...a,surahNumber:s.number,surahName:s.name_arabic});
    return map;
  },[quran]);
  const quranSearchIndex=useMemo(()=>buildQuranSearchIndex(Array.from(verseByKey.values())),[verseByKey]);
  useEffect(()=>{setAnswerResultLimit(30)},[answer?.title,answer?.queryTerm]);

  const reviewVerses=useMemo(()=>{
    const a=verseByKey.get(reviewFrom)?.global_number??0,b=verseByKey.get(reviewTo)?.global_number??0;
    const low=Math.min(a,b),high=Math.max(a,b);
    return Array.from(verseByKey.values()).filter(v=>v.global_number>=low&&v.global_number<=high).sort((x,y)=>x.global_number-y.global_number);
  },[verseByKey,reviewFrom,reviewTo]);

  const flashcardPool=useMemo(()=>Array.from(verseByKey.values()).filter(v=>{
    if(flashcardScope==="juz" && v.juz!==flashcardJuz)return false;
    if(flashcardScope==="surah" && v.surahNumber!==flashcardSurah)return false;
    if(flashcardScope==="review"){
      const a=verseByKey.get(reviewFrom)?.global_number??0,b=verseByKey.get(reviewTo)?.global_number??0;
      const low=Math.min(a,b),high=Math.max(a,b);
      if(!a||!b||v.global_number<low||v.global_number>high)return false;
    }
    const skip=hasBasmalaPrefix(v)?4:0;
    const count=v.words.slice(skip).filter(w=>cleanQuranDisplay(w.text).trim()).length;
    return eligibleFlashcard(count,flashcardDifficulty);
  }),[verseByKey,flashcardDifficulty,flashcardScope,flashcardJuz,flashcardSurah,reviewFrom,reviewTo]);

  const flashcardParts=useMemo(()=>{
    if(!flashcardVerse)return null;
    const skip=hasBasmalaPrefix(flashcardVerse)?4:0;
    const words=flashcardVerse.words.slice(skip).map(w=>cleanQuranDisplay(w.text)).filter(Boolean);
    if(words.length<2)return null;
    const promptCount=words.length>=8?3:words.length>=4?2:1;
    return {
      prompt:words.slice(0,promptCount).join(" "),
      answer:words.slice(promptCount).join(" "),
      full:words.join(" ")
    };
  },[flashcardVerse]);
  const flashcardScopeLabel=useMemo(()=>{
    if(flashcardScope==="all")return "القرآن كاملًا";
    if(flashcardScope==="juz")return `الجزء ${arNum(flashcardJuz)}`;
    if(flashcardScope==="surah")return `سورة ${quran?.surahs.find(s=>s.number===flashcardSurah)?.name_arabic||arNum(flashcardSurah)}`;
    const fromName=quran?.surahs.find(s=>s.number===reviewFromSurah)?.name_arabic||arNum(reviewFromSurah);
    const toName=quran?.surahs.find(s=>s.number===reviewToSurah)?.name_arabic||arNum(reviewToSurah);
    return customRangeMode==="single"?`سورة ${fromName} · من ${arNum(reviewFromAyah)} إلى ${arNum(reviewToAyah)}`:`من ${fromName} ${arNum(reviewFromAyah)} إلى ${toName} ${arNum(reviewToAyah)}`;
  },[flashcardScope,flashcardJuz,flashcardSurah,quran,reviewFromSurah,reviewFromAyah,reviewToSurah,reviewToAyah,customRangeMode]);

  const surahStrengthStats=useMemo(()=>quran?.surahs.map(s=>{
    const tested=s.ayahs.map(a=>reviewStrength[a.verse_key]).filter((item): item is ReviewStrength=>Boolean(item));
    const avg=tested.length?Math.round(tested.reduce((sum,item)=>sum+item.score,0)/tested.length):-1;
    return {number:s.number,name:s.name_arabic,score:avg,tested:tested.length,total:s.ayahs.length};
  })||[],[quran,reviewStrength]);

  function updateReviewStrength(key:string,delta:number){
    setReviewStrength(current=>{const prev=current[key]||{score:50,attempts:0,updatedAt:0};return {...current,[key]:{score:clamp(Math.round(prev.score+delta),0,100),attempts:prev.attempts+1,updatedAt:Date.now()}}});
  }
  function startReviewSession(){setReviewSessionStarted(Date.now());setReviewSessionAssisted(0);setReviewSessionCorrect(0)}
  function buildReviewSummary(mode:string,correct:number,assisted:number,total:number){
    const used=Math.max(1,correct+assisted);
    const score=clamp(Math.round(correct/used*100),0,100);
    setReviewSummary({mode,total,correct,assisted,score,minutes:Math.max(1,Math.round((Date.now()-(reviewSessionStarted||Date.now()))/60000))});
  }
  function toggleReviewReveal(v:ReaderVerse){
    const wasRevealed=revealedReview.has(v.verse_key);
    setRevealedReview(current=>{const next=new Set(current);if(wasRevealed)next.delete(v.verse_key);else next.add(v.verse_key);return next});
    if(!wasRevealed){setReviewSessionAssisted(n=>n+1);updateReviewStrength(v.verse_key,-8)}
  }
  function beginClassicReview(){
    if(!verseByKey.has(reviewFrom)||!verseByKey.has(reviewTo)){setToast("تحقق من نطاق المراجعة");return}
    startReviewSession();setRevealedReview(new Set());setReviewMode(true);setQuranMounted(true);setTab("quran");requestAnimationFrame(()=>requestAnimationFrame(()=>jumpToVerse(verseByKey.get(reviewFrom)!)));
  }
  function finishClassicReview(){
    const assisted=revealedReview.size,correct=Math.max(0,reviewVerses.length-assisted);
    for(const v of reviewVerses)if(!revealedReview.has(v.verse_key))updateReviewStrength(v.verse_key,2);
    setReviewMode(false);setRevealedReview(new Set());setReviewSessionCorrect(correct);buildReviewSummary("المراجعة الأساسية",correct,assisted,reviewVerses.length);
  }
  const FLASHCARD_QUESTION_LIMIT=10;
  function pickFlashcard(){
    const next=flashcardDeckRef.current[flashcardCursorRef.current];if(!next)return;
    setFlashcardVerse(next);setFlashcardRevealed(false);
  }
  function beginFlashcards(){
    if(flashcardScope==="review"){
      const start=verseByKey.get(reviewFrom)?.global_number||0;
      const end=verseByKey.get(reviewTo)?.global_number||0;
      if(!start||!end){setToast("تحقق من بداية ونهاية نطاق الآيات");setTimeout(()=>setToast(""),2600);return}
      if(start>end){setToast("بداية النطاق يجب أن تسبق نهايته");setTimeout(()=>setToast(""),2800);return}
      if(customRangeMode==="single"&&reviewFromSurah!==reviewToSurah){setToast("اختر البداية والنهاية داخل السورة نفسها");setTimeout(()=>setToast(""),2800);return}
    }
    if(!flashcardPool.length){setToast("لا توجد آيات مناسبة لهذا النطاق ومستوى الصعوبة");setTimeout(()=>setToast(""),2800);return}
    const deck=createFlashcardDeck(flashcardPool,FLASHCARD_QUESTION_LIMIT);
    flashcardDeckRef.current=deck;flashcardCursorRef.current=0;
    setFlashcardQuestionLimit(deck.length);setFlashcardQuestionNumber(1);
    if(deck.length<FLASHCARD_QUESTION_LIMIT){setToast(`هذا النطاق يحتوي ${arNum(deck.length)} آيات مناسبة؛ سيشمل الاختبار هذا العدد دون تكرار.`);setTimeout(()=>setToast(""),5000);}
    startReviewSession();setFlashcardActive(true);pickFlashcard();
  }
  function gradeFlashcard(knew:boolean){
    if(!flashcardVerse||flashcardDeckRef.current[flashcardCursorRef.current]?.verse_key!==flashcardVerse.verse_key)return;
    flashcardCursorRef.current++;
    const nextCorrect=reviewSessionCorrect+(knew?1:0),nextAssisted=reviewSessionAssisted+(knew?0:1);
    updateReviewStrength(flashcardVerse.verse_key,knew?10:-7);setReviewSessionCorrect(nextCorrect);setReviewSessionAssisted(nextAssisted);
    if(flashcardCursorRef.current>=flashcardDeckRef.current.length){setFlashcardActive(false);buildReviewSummary("اختبار البطاقات",nextCorrect,nextAssisted,nextCorrect+nextAssisted);return;}
    setFlashcardQuestionNumber(n=>n+1);pickFlashcard();
  }
  function finishFlashcards(){
    const correct=reviewSessionCorrect,assisted=reviewSessionAssisted,total=correct+assisted;setFlashcardActive(false);buildReviewSummary("اختبار البطاقات",correct,assisted,total);
  }
  function handleVoiceTranscript(text:string,error:string){
    setVoiceListening(false);
    if(error){setToast(error||"تعذر التعرف على الصوت");setTimeout(()=>setToast(""),2600);return}
    const clean=text.trim();if(!clean)return;
    if(voicePurposeRef.current==="quran"){
      const best=matchQuranVoice(clean,Array.from(verseByKey.values()));
      if(!best){setToast("لم أتعرف على آية بوضوح. اقرأ كلمات أكثر وحاول مجددًا.");setTimeout(()=>setToast(""),3500);return}
      setQuranSearch("");jumpToVerse(best.verse,true);
      setToast(`سورة ${best.verse.surahName} · الآية ${arNum(best.verse.number)}`);
      setTimeout(()=>setToast(""),3000);return;
    }
    if(voicePurposeRef.current==="recitation"){
      const best=matchQuranVoice(clean,reviewVerses);
      if(!best){setRecitationText("");setRecitationResult("لم أستطع مطابقة القراءة بوضوح مع نطاق المراجعة. حاول قراءة آية كاملة وبصوت هادئ.");return}
      setRecitationText(best.verse.text);
      const pct=Math.round(best.score*100);
      setRecitationResult(`أقرب آية: سورة ${best.verse.surahName} · الآية ${arNum(best.verse.number)} · تشابه الكلمات ${arNum(pct)}٪. النتيجة ليست حكمًا على صحة التلاوة.`);
      const ok=pct>=75;updateReviewStrength(best.verse.verse_key,ok?8:-4);if(ok)setReviewSessionCorrect(n=>n+1);else setReviewSessionAssisted(n=>n+1);
    }
  }
  voiceHandlerRef.current=handleVoiceTranscript;

  function finishRecitation(){
    window.Android?.cancelVoiceRecognition?.();setVoiceListening(false);setRecitationActive(false);
    buildReviewSummary("التسميع الذكي Beta",reviewSessionCorrect,reviewSessionAssisted,reviewSessionCorrect+reviewSessionAssisted);
  }

  function startVoiceListening(purpose:"quran"|"recitation"){
    if(voiceListening){window.Android?.stopVoiceRecognition?.();setVoiceStatus("أتعرف على الآية محليًا…");return}
    voicePurposeRef.current=purpose;setVoiceListening(true);
    setVoiceStatus("أستمع لتلاوتك…");
    if(window.Android?.startVoiceRecognition){window.Android.startVoiceRecognition();return}
    const Ctor=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
    if(!Ctor){setVoiceListening(false);setToast("البحث الصوتي متاح داخل تطبيق Android على هذا الجهاز");setTimeout(()=>setToast(""),2800);return}
    const recognition=new Ctor();recognition.lang="ar-SA";recognition.interimResults=false;recognition.maxAlternatives=1;
    recognition.onresult=(event:any)=>handleVoiceTranscript(String(event.results?.[0]?.[0]?.transcript||""),"");
    recognition.onerror=()=>handleVoiceTranscript("","تعذر التعرف على الصوت");recognition.onend=()=>setVoiceListening(false);recognition.start();
  }

  function openQibla(){
    setAnswer(null);setToolPage("qibla");setQiblaStatus("جاري تحديث موقعك للقبلة…");
    const raw=window.Android?.getPrayerLocationJson?.();
    if(raw){try{const p=JSON.parse(raw);if(Number.isFinite(p.lat)&&Number.isFinite(p.lon)){setQiblaBearing(calculateQiblaBearing(p.lat,p.lon));setQiblaStatus("اتجاه مؤقت من آخر موقع · جاري تحديث الموقع الحالي")}}catch{}}
    window.Android?.startQiblaCompass?.();
    if(window.Android?.requestQiblaLocation)window.Android.requestQiblaLocation();
    else setQiblaStatus("ميزة القبلة الدقيقة متاحة داخل تطبيق Android");
  }
  function closeTool(){if(toolPage==="qibla")window.Android?.stopQiblaCompass?.();setToolPage(null)}

  async function runTopicSearch(){
    const raw=topicQuery.trim();const terms=extractTerms(raw);if(!raw||!terms.length)return;setTopicLoading(true);
    try{
      const results:TopicResult[]=[];
      for(const v of Array.from(verseByKey.values()).map(v=>({v,score:textScore(v.text,terms)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,6))
        results.push({id:`q-${v.v.verse_key}`,kind:"quran",title:`سورة ${v.v.surahName} · الآية ${arNum(v.v.number)}`,text:verseDisplayText(v.v),source:"القرآن الكريم",verseKey:v.v.verse_key});
      const tafsir=(await loadTafsirSearch()).map(t=>({t,score:textScore(t.text,terms)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,4);
      for(const x of tafsir)results.push({id:`t-${x.t.verseKey}`,kind:"tafsir",title:`تفسير مرتبط · ${x.t.verseKey}`,text:compactText(x.t.text,260),source:"فهرس التفاسير المحلي",verseKey:x.t.verseKey});
      const hadith=await findHadithSupport(terms);for(const h of hadith.slice(0,3))results.push({id:`h-${h.book}-${h.id}`,kind:"hadith",title:h.book,text:compactText(h.arabic,260),source:h.reference||`حديث ${h.id}`});
      const knowledge=await findKnowledge(raw,terms);for(const k of knowledge.slice(0,3))results.push({id:`k-${k.id}`,kind:"knowledge",title:k.title,text:compactText(k.answer,260),source:k.source});
      setTopicResults(results);
    }finally{setTopicLoading(false)}
  }

  const continuousPageEstimates=useMemo(()=>Array.from({length:604},(_,index)=>{
    const verses=pages[index+1]||[];
    const words=verses.reduce((total,ayah)=>total+ayah.words.length,0);
    // A data-derived estimate is used only until ResizeObserver records the
    // real variable height. It avoids any fixed-height assumption.
    const wordsPerLine=window.innerWidth<=390?5.2:6.4;
    const surahStarts=verses.filter(verse=>verse.number===1).length;
    return Math.max(180,45+Math.ceil(words/wordsPerLine)*70+surahStarts*120);
  }),[pages]);
  const continuousVirtualizer=useVirtualizer({
    count:readerMode==="continuous"&&quran?604:0,
    getScrollElement:()=>readerRef.current,
    estimateSize:index=>continuousPageEstimates[index]||420,
    overscan:3,
    getItemKey:index=>index+1,
    initialOffset:()=>Number(localStorage.getItem("noor_reader_continuous_scroll")||"0"),
    initialRect:{width:window.innerWidth,height:window.innerHeight}
  });


  const quranSearchResults=useMemo(()=>{const term=normalizeArabic(debouncedQuranSearch.trim());if(term.length<2||!quran)return [] as ReaderVerse[];const out:ReaderVerse[]=[];for(const surah of quran.surahs)for(const a of surah.ayahs)if(normalizeArabic(a.text).includes(term)){out.push({...a,surahNumber:surah.number,surahName:surah.name_arabic});if(out.length>=60)return out}return out},[quran,debouncedQuranSearch]);
  function animateReaderTo(target:number){
    const root=readerRef.current;if(!root)return;
    cancelAnimationFrame(navigationRaf.current);
    const top=clamp(target,0,Math.max(0,root.scrollHeight-root.clientHeight));
    if(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches){root.scrollTop=top;return}
    const start=root.scrollTop,delta=top-start;
    if(Math.abs(delta)<2)return;
    const began=performance.now(),duration=Math.min(360,220+Math.abs(delta)/90);
    const frame=(now:number)=>{const p=Math.min(1,(now-began)/duration);const eased=1-Math.pow(1-p,3);root.scrollTop=start+delta*eased;if(p<1)navigationRaf.current=requestAnimationFrame(frame)};
    navigationRaf.current=requestAnimationFrame(frame);
  }
  function revealContinuousVerse(v:ReaderVerse,highlight=false,attempt=0){
    const root=readerRef.current;
    const el=document.getElementById(`ayah-${v.verse_key.replace(":","-")}`);
    if(el&&root){
      const rootRect=root.getBoundingClientRect();const rect=el.getBoundingClientRect();
      animateReaderTo(root.scrollTop+rect.top-rootRect.top-root.clientHeight*.28);
      if(highlight){window.clearTimeout(highlightTimer.current);el.classList.add("searchHighlight");highlightTimer.current=window.setTimeout(()=>el.classList.remove("searchHighlight"),1800)}
      return;
    }
    if(attempt<5)window.setTimeout(()=>revealContinuousVerse(v,highlight,attempt+1),attempt?40:0);
  }
  function jumpToVerse(v:ReaderVerse,highlight=false){
    document.documentElement.classList.remove("keyboard-open");
    (document.activeElement as HTMLElement|null)?.blur?.();
    if(sessionRef.current?.state.key&&sessionRef.current.state.key.split(":")[0]!==String(v.surahNumber))sessionRef.current.cancel();
    setAutoScroll(false);
    setQuranMounted(true);
    setTab("quran");
    setPendingVerseJump({key:v.verse_key,highlight});
    if(readerMode==="pages"){
      const direction=v.page>=readerPage?"next":"prev";
      setPageTurn({direction,token:Date.now()});
      setPageScreen(0);
      localStorage.setItem("noor_reader_screen","0");
      setReaderPage(v.page);
      localStorage.setItem("noor_reader_page",String(v.page));
      localStorage.setItem("noor_last_verse",v.verse_key);
      lastVerseRef.current=v.verse_key;
      setLastVerseKey(v.verse_key);
      window.Android?.saveReaderPage?.(v.page);window.Android?.saveReaderPosition?.(v.page,v.surahName,String(v.number));
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        const el=document.getElementById(`ayah-${v.verse_key.replace(":","-")}`);
        if(highlight&&el){window.clearTimeout(highlightTimer.current);el.classList.add("searchHighlight");highlightTimer.current=window.setTimeout(()=>el.classList.remove("searchHighlight"),1800)}
      }));
      return;
    }
    continuousVirtualizer.scrollToIndex(v.page-1,{align:"start",behavior:"auto"});
    requestAnimationFrame(()=>requestAnimationFrame(()=>revealContinuousVerse(v,highlight)));
  }
  useEffect(()=>{
    if(!pendingVerseJump||tab!=="quran"||!quranMounted||!quran)return;
    const verse=verseByKey.get(pendingVerseJump.key);if(!verse){setPendingVerseJump(null);return}
    let cancelled=false,tries=0;
    const go=()=>{if(cancelled)return;const root=readerRef.current;if(!root){if(tries++<12)window.setTimeout(go,50);return}
      if(readerMode==="continuous"){continuousVirtualizer.scrollToIndex(Math.max(0,verse.page-1),{align:"start",behavior:"auto"});window.setTimeout(()=>{if(!cancelled){revealContinuousVerse(verse,pendingVerseJump.highlight);setPendingVerseJump(null)}},70)}else setPendingVerseJump(null);
    };requestAnimationFrame(()=>requestAnimationFrame(go));return()=>{cancelled=true};
  },[pendingVerseJump,tab,quranMounted,quran,readerMode,verseByKey]);

  function resumeReading(){
    const key=localStorage.getItem("noor_last_verse")||lastVerseKey;
    const verse=key?verseByKey.get(key):null;
    if(verse)jumpToVerse(verse,false);
  }
  useEffect(()=>{
    if(!widgetActionPending)return;
    if(widgetActionPending==="home"){setTab("home");setToolPage(null);setWidgetActionPending(null);return}
    if(!quran)return;
    if(widgetActionPending==="reader"){resumeReading();setWidgetActionPending(null);return}
    if(widgetActionPending==="recitation"){setTab("saved");setAnswer(null);setWidgetActionPending(null);window.setTimeout(()=>document.querySelector(".reviewLab")?.scrollIntoView({behavior:"smooth",block:"center"}),180);return}
  },[widgetActionPending,quran,lastVerseKey]);

  function askVerse(v:ReaderVerse){setVerseContext(v);setAskMode("quran");setTab("home");setAnswer(null);setQ("");setToast(`السياق: سورة ${v.surahName} · الآية ${arNum(v.number)}`);setTimeout(()=>setToast(""),2200)}
  async function copyShareFallback(text:string){
    try{await navigator.clipboard.writeText(text);setToast("تم نسخ الآية للمشاركة")}catch{setToast("تعذرت المشاركة والنسخ")}
    window.setTimeout(()=>setToast(""),1900);
  }
  async function shareVerse(v:ReaderVerse){
    const text=`﴿${verseDisplayText(v)}﴾\nسورة ${v.surahName} - الآية ${v.number}`;
    try{
      if(window.Android?.shareText){window.Android.shareText(text);return;}
      if(navigator.share){await navigator.share({title:"نور",text});return;}
      await copyShareFallback(text);
    }catch(error){if((error as DOMException)?.name!=="AbortError")await copyShareFallback(text)}
  }
  async function shareVerseImage(v:ReaderVerse){
    try{
      const canvasQuranFont=quranFont==="amiri"?"Noor Amiri Quran":quranFont==="scheherazade"?"Noor Scheherazade Quran":"Noor Default Quran";
      await document.fonts.load(`52px "${canvasQuranFont}"`,verseDisplayText(v));
      const canvas=document.createElement("canvas");canvas.width=1080;canvas.height=1080;const c=canvas.getContext("2d");if(!c)throw new Error("canvas");
      const g=c.createLinearGradient(0,0,1080,1080);g.addColorStop(0,dark?"#071f18":"#eef8f2");g.addColorStop(1,dark?"#164c3b":"#d8eee2");c.fillStyle=g;c.fillRect(0,0,1080,1080);
      c.save();c.shadowColor=dark?"rgba(0,0,0,.28)":"rgba(14,70,48,.14)";c.shadowBlur=36;c.shadowOffsetY=18;c.fillStyle=dark?"rgba(255,255,255,.10)":"rgba(255,255,255,.62)";c.strokeStyle=dark?"rgba(255,255,255,.20)":"rgba(255,255,255,.86)";c.lineWidth=3;c.beginPath();c.roundRect(70,80,940,880,64);c.fill();c.stroke();c.restore();
      c.fillStyle=dark?"#f7f7f2":"#123d31";c.textAlign="center";c.direction="rtl";c.font=`52px "${canvasQuranFont}", "Noor Default Quran", "Noor Amiri Quran", serif`;
      const words=verseDisplayText(v).split(" ");const lines:string[]=[];let line="";for(const w of words){const next=line?`${line} ${w}`:w;if(c.measureText(next).width>800&&line){lines.push(line);line=w}else line=next}if(line)lines.push(line);
      const visible=lines.slice(0,11);const lineHeight=76;let y=470-(visible.length-1)*lineHeight/2;for(const l of visible){c.fillText(l,540,y);y+=lineHeight}
      c.font='34px system-ui, sans-serif';c.fillStyle=dark?"#b9dacb":"#356b57";c.fillText(`سورة ${v.surahName} · الآية ${arNum(v.number)}`,540,850);c.font='700 46px system-ui, sans-serif';c.fillStyle=dark?"#ffffff":"#17664b";c.fillText("نور",540,920);
      const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/png",1));if(!blob)throw new Error("blob");const fileName=`Noor-${v.verse_key.replace(":","-")}.png`;const caption=`سورة ${v.surahName} - الآية ${v.number}`;
      if(window.Android?.shareImage){const dataUrl=canvas.toDataURL("image/png");window.Android.shareImage(dataUrl.slice(dataUrl.indexOf(",")+1),fileName,caption);return;}
      const file=new File([blob],fileName,{type:"image/png"});if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:"نور",text:caption});return;}
      const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=fileName;a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);setToast("تم تنزيل صورة الآية");window.setTimeout(()=>setToast(""),1800);
    }catch(error){if((error as DOMException)?.name!=="AbortError"){setToast("تعذر إنشاء صورة المشاركة");window.setTimeout(()=>setToast(""),2200)}}
  }

  const firstPageBySurah=useMemo(()=>{
    const map=new Map<number,number>();
    if(quran) for(const s of quran.surahs) if(s.ayahs.length) map.set(s.number,s.ayahs[0].page);
    return map;
  },[quran]);

  async function loadRootSurah(n:number){
    if(rootCache.current[n])return rootCache.current[n];
    try{
      const r=await fetch(`./data/surahs/${n}.json`);
      const d=r.ok?await r.json():[];
      rootCache.current[n]=d;
      return d as RootAyah[];
    }catch{return [] as RootAyah[];}
  }

  useEffect(()=>{
    localStorage.setItem("noor_auto_scroll_speed",String(autoScrollSpeed));
  },[autoScrollSpeed]);

  useEffect(()=>{
    localStorage.setItem("noor_reader_mode",readerMode);
    setAutoScroll(false);
  },[readerMode]);

  useEffect(()=>{
    if(readerMode!=="continuous" || !autoScroll || tab!=="quran")return;
    let raf=0,last=performance.now(),carry=0;
    const tick=(now:number)=>{
      const el=readerRef.current;if(!el)return;
      const pxPerSecond=12+autoScrollSpeed*10;
      carry += pxPerSecond*((now-last)/1000); last=now;
      if(carry>=1){ const step=Math.floor(carry); carry-=step; el.scrollTop+=step; }
      if(el.scrollTop+el.clientHeight>=el.scrollHeight-2){setAutoScroll(false);return;}
      raf=requestAnimationFrame(tick);
    };
    raf=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(raf);
  },[autoScroll,autoScrollSpeed,tab,readerMode]);

  function saveReaderPosition(){
    if(readerMode==="pages"){
      const first=pages[readerPage]?.[0];
      localStorage.setItem("noor_reader_page",String(readerPage));
      window.Android?.saveReaderPage?.(readerPage);
      if(first){window.Android?.saveReaderPosition?.(readerPage,first.surahName,String(first.number));
        lastVerseRef.current=first.verse_key;
        localStorage.setItem("noor_last_verse",first.verse_key);
        if(first.verse_key!==lastVerseKey)setLastVerseKey(first.verse_key);
      }
      return;
    }
    const el=readerRef.current;if(!el)return;
    const rect=el.getBoundingClientRect();
    const hit=typeof document.elementFromPoint==="function"
      ? document.elementFromPoint(rect.left+rect.width/2,rect.top+Math.min(150,rect.height*.3)) as HTMLElement|null
      : null;
    const visibleVerse=hit?.closest?.("[data-verse]") as HTMLElement|null;
    const visibleKey=visibleVerse?.dataset.verse;
    if(visibleKey)lastVerseRef.current=visibleKey;
    readerPositionRef.current=el.scrollTop;
    localStorage.setItem("noor_reader_continuous_scroll",String(el.scrollTop));
    const key=lastVerseRef.current;
    if(key){
      localStorage.setItem("noor_last_verse",key);
      if(key!==lastVerseKey)setLastVerseKey(key);
      const anchor=document.getElementById(`ayah-${key.replace(":","-")}`);
      if(anchor)localStorage.setItem("noor_reader_anchor_offset",String(Math.round(anchor.getBoundingClientRect().top-el.getBoundingClientRect().top)));
      const verse=verseByKey.get(key);
      if(verse){localStorage.setItem("noor_reader_page",String(verse.page));window.Android?.saveReaderPage?.(verse.page);window.Android?.saveReaderPosition?.(verse.page,verse.surahName,String(verse.number))}
    }
  }
  function onReaderScroll(){
    if(readerMode!=="continuous" || !readerRef.current)return;
    if(tab!=="quran" || restoringReader.current)return;
    readerPositionRef.current=readerRef.current.scrollTop;
    localStorage.setItem("noor_reader_continuous_scroll",String(readerPositionRef.current));
    clearTimeout(scrollSaveTimer.current);
    scrollSaveTimer.current=window.setTimeout(saveReaderPosition,120);
  }
  useEffect(()=>{
    const save=()=>saveReaderPosition();
    const vis=()=>{if(document.visibilityState==="hidden")save()};
    window.addEventListener("pagehide",save);document.addEventListener("visibilitychange",vis);
    return()=>{window.removeEventListener("pagehide",save);document.removeEventListener("visibilitychange",vis)};
  },[readerMode,readerPage,lastVerseKey,pages]);
  useLayoutEffect(()=>{
    // Explicit verse navigation takes precedence over restoring the old tab pixel.
    if(tab!=="quran"||!quran||!readerRef.current||pendingVerseJump)return;
    const root=readerRef.current,top=readerPositionRef.current;
    if(top<=0)return;
    // Keep the saved pixel while virtual rows are measured after opening the tab.
    // Ignore scroll events from layout changes until those measurements settle.
    restoringReader.current=true;
    let frame=0,remaining=3;
    const restore=()=>{
      if(Math.abs(root.scrollTop-top)>1)root.scrollTo({top,behavior:"auto"});
      if(--remaining>0)frame=requestAnimationFrame(restore);
      else restoringReader.current=false;
    };
    frame=requestAnimationFrame(restore);
    return()=>{
      cancelAnimationFrame(frame);
      if(root.clientHeight>0 && !restoringReader.current){
        readerPositionRef.current=root.scrollTop;
        localStorage.setItem("noor_reader_continuous_scroll",String(root.scrollTop));
      }
      restoringReader.current=false;
    };
  },[tab,quran]);

  function scrollToSurah(n:number,behavior:ScrollBehavior="smooth"){
    const page=firstPageBySurah.get(n)||1;
    continuousVirtualizer.scrollToIndex(page-1,{align:"start",behavior:"auto"});
    // A printed page can contain several surahs. Scrolling only to the page
    // made selections such as Quraysh land at a neighbouring surah. Wait for
    // the virtual row to mount, then reveal the exact surah start.
    const reveal=(attempt=0)=>{
      const root=readerRef.current;
      const target=document.getElementById(`surah-${n}`);
      if(root&&target){
        const rootRect=root.getBoundingClientRect();
        const rect=target.getBoundingClientRect();
        const top=root.scrollTop+rect.top-rootRect.top-8;
        if(behavior==="smooth")animateReaderTo(top);else root.scrollTop=top;
        return;
      }
      if(attempt<8)window.setTimeout(()=>reveal(attempt+1),attempt<2?0:32);
    };
    requestAnimationFrame(()=>requestAnimationFrame(()=>reveal()));
  }

  function goPage(n:number,reset=true){
    const next=clamp(n,1,604);
    const direction=next>=readerPage?"next":"prev";
    setPageTurn({direction,token:Date.now()});
    setReaderPage(next);
    setPageScreen(0);
    localStorage.setItem("noor_reader_screen","0");
    const first=pages[next]?.[0];
    if(readerMode==="pages"){
      setQuranMounted(true);setTab("quran");
      localStorage.setItem("noor_reader_page",String(next));
      window.Android?.saveReaderPage?.(next);
      if(first){lastVerseRef.current=first.verse_key;localStorage.setItem("noor_last_verse",first.verse_key);setLastVerseKey(first.verse_key)}
      requestAnimationFrame(()=>readerRef.current?.scrollTo({top:0,behavior:"auto"}));
      return;
    }
    if(first){setQuranMounted(true);setTab("quran");requestAnimationFrame(()=>requestAnimationFrame(()=>scrollToSurah(first.surahNumber,reset?"smooth":"auto")));}
  }

  function turnReaderScreen(direction:number){
    const next=pageScreen+direction;
    if(next>=0&&next<pageScreens){setPageScreen(next);return;}
    const targetPage=readerPage===1&&direction>0?3:readerPage===3&&direction<0?1:readerPage+direction;
    if(targetPage<1||targetPage>604)return;
    pendingLastScreen.current=direction<0;
    goPage(targetPage);
  }

  function onPageTouchStart(event:React.TouchEvent){
    pageSwipeStart.current=event.touches[0]?.clientX??null;
  }
  function onPageTouchEnd(event:React.TouchEvent){
    const start=pageSwipeStart.current;pageSwipeStart.current=null;
    const end=event.changedTouches[0]?.clientX;if(start==null||end==null)return;
    const delta=end-start;if(Math.abs(delta)<54)return;
    // Arabic book direction: drag to the right for the next page.
    turnReaderScreen(delta>0?1:-1);
  }

  function openQuran(){
    if(tab==="quran")return;
    setQuranMounted(true);
    setTab("quran");
  }

  function startKhatma(){
    const days=clamp(Math.trunc(Number(khatmaDaysDraft)||30),1,365);
    setKhatmaDays(days);setKhatmaDaysDraft(String(days));
    const d=khatmaStart||new Date().toISOString().slice(0,10);
    if(!khatmaStart){setKhatmaStart(d);setKhatmaRead(0);localStorage.setItem("noor_khatma_read","0")}
    localStorage.setItem("noor_khatma_start",d);localStorage.setItem("noor_khatma_days",String(days));
    setToast(khatmaStart?"تم تعديل أيام الختمة دون تصفير تقدمك":"تم إنشاء خطة الختمة");window.setTimeout(()=>setToast(""),1800);
  }
  function updateKhatmaProgress(){
    const page=lastVerseKey?verseByKey.get(lastVerseKey)?.page||readerPage:readerPage;
    const read=clamp(page,0,604);setKhatmaRead(read);localStorage.setItem("noor_khatma_read",String(read));
    setToast("تم تحديث إنجاز الختمة من موضع القراءة");window.setTimeout(()=>setToast(""),2000);
  }
  const khatmaStats=useMemo(()=>{
    if(!khatmaStart)return null;
    const start=new Date(`${khatmaStart}T00:00:00`);const now=new Date();now.setHours(0,0,0,0);
    const day=clamp(Math.floor((now.getTime()-start.getTime())/86400000)+1,1,khatmaDays);
    const remaining=Math.max(0,604-khatmaRead);const remainingDays=Math.max(1,khatmaDays-day+1);
    return {day,remaining,daily:Math.ceil(remaining/remainingDays),percent:Math.round(khatmaRead/604*100)};
  },[khatmaStart,khatmaDays,khatmaRead]);

  function sudaisId(verse:ReaderVerse){const [surah,ayah]=verse.verse_key.split(":").map(Number);return `${String(surah).padStart(3,"0")}${String(ayah).padStart(3,"0")}`}
  const builtinReciterNames:Record<string,string>={sudais:"عبدالرحمن السديس",minshawy:"محمد صديق المنشاوي",ali_jaber:"علي جابر",shuraim:"سعود الشريم",dosari:"ياسر الدوسري"};
  const reciterNames:Record<string,string>={...builtinReciterNames,...Object.fromEntries(customReciters.map(r=>[r.id,r.name]))};
  const reciterDirs={sudais:"Abdurrahmaan_As-Sudais_192kbps",minshawy:"Minshawy_Murattal_128kbps",ali_jaber:"Ali_Jaber_64kbps",shuraim:"Saood_ash-Shuraym_128kbps",dosari:"Yasser_Ad-Dussary_128kbps"};
  function audioSource(id:string):CustomReciter|undefined{
    return customReciters.find(item=>item.id===id)||(reciterDirs[id as keyof typeof reciterDirs]?{id,name:reciterNames[id],baseUrl:`https://everyayah.com/data/${reciterDirs[id as keyof typeof reciterDirs]}`,numbering:"verseId",sourceType:"url"}:undefined);
  }
  function sudaisUrl(verse:ReaderVerse){const source=audioSource(reciter);return source?reciterAudioUrl(source,sudaisId(verse),verse.global_number):"";}
  const [repeatSettings,setRepeatSettings]=useState<RepeatSettings>(()=>{try{const v=JSON.parse(localStorage.getItem("noor_ab_settings")||"null");if(v&&typeof v.a==="string"&&typeof v.b==="string"&&Number.isFinite(v.count)&&Number.isFinite(v.gap))return v}catch{}return {a:"1:1",b:"1:1",count:3,gap:2}});
  const [followAudio,setFollowAudio]=useState(()=>localStorage.getItem("noor_follow_audio")==="true");
  const [sessionState,setSessionState]=useState<SessionState>({status:"idle",key:null,cycle:0});
  const [playingVerse,setPlayingVerse]=useState<string|null>(null);
  const currentAudioVerse=useRef<ReaderVerse|null>(null),sessionRef=useRef<RecitationSession|null>(null);
  const latestAudio=useRef({play:(key:string)=>{},follow:followAudio,ended:(verse:ReaderVerse)=>{}});
  function stopAudio(){++audioRequestRef.current;audioRef.current?.pause();audioRef.current=null;audioCleanupRef.current?.();audioCleanupRef.current=null;window.Android?.stopDownloadedAyah?.();currentAudioVerse.current=null;setPlayingVerse(null)}
  if(!sessionRef.current)sessionRef.current=new RecitationSession({play:key=>latestAudio.current.play(key),stop:stopAudio,pause:()=>{audioRef.current?.pause();window.Android?.pauseRecitation?.()},resume:()=>{void audioRef.current?.play().catch(()=>sessionRef.current?.fail("تعذر استئناف الصوت"));window.Android?.resumeRecitation?.()}},state=>{setSessionState({...state});setPlayingVerse(state.status==="playing"?state.key:null)});
  latestAudio.current={play:key=>{const v=verseByKey.get(key);if(v)void playAyah(v,true);else sessionRef.current?.fail("الآية غير متاحة")},follow:followAudio,ended:verse=>{if(sessionRef.current?.state.status!=="idle"){sessionRef.current?.ended(verse.verse_key);return}setPlayingVerse(null);if(latestAudio.current.follow){const next=verseByKey.get(`${verse.surahNumber}:${verse.number+1}`);if(next)void playAyah(next,true)}}};
  useEffect(()=>{localStorage.setItem("noor_ab_settings",JSON.stringify(repeatSettings))},[repeatSettings]);
  useEffect(()=>{localStorage.setItem("noor_follow_audio",String(followAudio));if(followAudio)setAutoScroll(false)},[followAudio]);
  useEffect(()=>{sessionRef.current?.cancel()},[reciter]);
  useEffect(()=>{
    window.noorAudioEvent=(token,id,event)=>{if(token!==audioRequestRef.current)return;const v=currentAudioVerse.current;if(!v||sudaisId(v)!==id)return;if(event==="playing"){if(sessionRef.current?.state.status==="paused"){window.Android?.pauseRecitation?.();return}setPlayingVerse(v.verse_key);sessionRef.current?.started(v.verse_key)}else if(event==="ended")latestAudio.current.ended(v);else if(event==="error"){setPlayingVerse(null);sessionRef.current?.fail("تعذر تشغيل الآية؛ تحقق من المصدر أو الملف المحلي")}};
    const background=()=>{if(sessionRef.current?.state.status!=="idle")sessionRef.current?.pause();else{audioRef.current?.pause();window.Android?.pauseRecitation?.();setPlayingVerse(null)}};
    window.noorAudioBackground=background;const visible=()=>{if(document.hidden)background()};document.addEventListener("visibilitychange",visible);
    return()=>{window.noorAudioEvent=undefined;window.noorAudioBackground=undefined;document.removeEventListener("visibilitychange",visible);sessionRef.current?.cancel()};
  },[]);
  useEffect(()=>{
    if(!followAudio||!playingVerse||tab!=="quran")return;
    setAutoScroll(false);const verse=verseByKey.get(playingVerse);if(!verse)return;
    const el=document.getElementById(`ayah-${playingVerse.replace(":","-")}`),root=readerRef.current;
    if(el&&root){const a=el.getBoundingClientRect(),b=root.getBoundingClientRect();if(a.top>=b.top+8&&a.bottom<=b.bottom-8)return;root.scrollBy({top:a.top-b.top-50,behavior:"smooth"})}
    else{continuousVirtualizer.scrollToIndex(verse.page-1,{align:"start",behavior:"auto"});requestAnimationFrame(()=>requestAnimationFrame(()=>revealContinuousVerse(verse,false)))}
  },[playingVerse,followAudio,tab]);
  function startRepeat(){const a=verseByKey.get(repeatSettings.a),b=verseByKey.get(repeatSettings.b);if(!a||!b||a.surahNumber!==b.surahNumber||b.number<a.number){setToast("تحقق من بداية المقطع ونهايته");return}const keys=Array.from(verseByKey.values()).filter(v=>v.global_number>=a.global_number&&v.global_number<=b.global_number).sort((x,y)=>x.global_number-y.global_number).map(v=>v.verse_key);sessionRef.current?.start(keys,repeatSettings.count,repeatSettings.gap);setRepeatOpen(false);setQuranMounted(true);setTab("quran");}
  async function playAyah(verse:ReaderVerse,fromSession=false){
    if(!fromSession)sessionRef.current?.cancel();

    const request=++audioRequestRef.current,id=sudaisId(verse),selected=reciter;
    audioRef.current?.pause();audioCleanupRef.current?.();audioCleanupRef.current=null;window.Android?.stopDownloadedAyah?.();
    currentAudioVerse.current=verse;setPlayingVerse(null);window.Android?.setAudioRequest?.(request);
    const custom=customReciters.find(item=>item.id===selected);
    if(custom?.sourceType==="folder"){
      if(!window.Android?.playCustomReciterAyah?.(selected,id)){setToast("ملف هذه الآية غير موجود في المجلد المختار");sessionRef.current?.fail("ملف هذه الآية غير موجود في المجلد المختار")}return;
    }
    if(custom?.baseUrl)window.Android?.saveOnlineReciter?.(custom.id,custom.name,custom.baseUrl,custom.numbering||"verseId");
    if(window.Android?.playReciterAyah?.(selected,id))return;
    if(window.Android?.hasReciterAyah?.(selected,id)&&window.Android.playDownloadedAyah?.(selected,id))return;
    const url=sudaisUrl(verse);if(!url){setToast("مصدر تلاوة هذا القارئ غير متاح");sessionRef.current?.fail("مصدر تلاوة هذا القارئ غير متاح");return;}
    let source=url;
    if("caches" in window){
      try{const cache=await caches.open(`noor-audio-${selected}-v1`),cached=await cache.match(url);
        if(cached)source=URL.createObjectURL(await cached.blob());
        else void fetch(url).then(async response=>{await verifyAudioResponse(response.clone());await cache.put(url,response);}).catch(()=>{});
      }catch{/* Streaming remains available when persistent storage is blocked. */}
    }
    if(request!==audioRequestRef.current){if(source!==url)URL.revokeObjectURL(source);return;}
    const audio=new Audio(source);audioRef.current=audio;audio.preload="auto";
    let released=false;const release=()=>{if(released)return;released=true;if(source!==url)URL.revokeObjectURL(source);};audioCleanupRef.current=release;
    const failed=()=>{release();if(request!==audioRequestRef.current)return;setPlayingVerse(null);sessionRef.current?.fail("تعذر تشغيل الصوت");setToast(`تعذر تشغيل تلاوة ${reciterNames[selected]}. تحقق من الإنترنت أو نزّل السورة.`);setTimeout(()=>setToast(""),4000);};
    audio.addEventListener?.("playing",()=>{if(request===audioRequestRef.current){if(sessionRef.current?.state.status==="paused"){audio.pause();return}setPlayingVerse(verse.verse_key);sessionRef.current?.started(verse.verse_key)}});audio.addEventListener?.("ended",()=>{release();if(request===audioRequestRef.current)latestAudio.current.ended(verse)},{once:true});audio.addEventListener?.("error",failed,{once:true});if(!(fromSession&&sessionRef.current?.state.status==="paused"))audio.play().catch(failed);
  }
  async function startReciterDownload(id:string,verses:ReaderVerse[]){
    const source=audioSource(id);if(!source)return;
    if(source.sourceType==="folder"){setToast("هذا القارئ يستخدم ملفات المجلد المحلي. أضف تلاوة من البحث لتنزيلها من الإنترنت.");return;}
    if(downloadRunningRef.current){setToast("هناك تنزيل تلاوة جارٍ بالفعل؛ انتظر اكتماله أو أوقفه أولًا.");return;}
    if(source.baseUrl)window.Android?.saveOnlineReciter?.(source.id,source.name,source.baseUrl,source.numbering||"verseId");
    activeDownloadReciterRef.current=id;
    const ids=verses.map(sudaisId),message="بدأ تنزيل التلاوات. الملفات الموجودة مسبقًا ستُتخطى تلقائيًا.";
    if(window.Android?.downloadReciter){
      const accepted=window.Android.downloadReciter(id,ids.join(","));
      if(accepted===false){setToast("تعذر بدء التنزيل؛ تحقق من المصدر أو التنزيل الجاري.");return;}
      downloadRunningRef.current=true;setSudaisDownloading(true);setReciterDownloadProgress({reciter:id,done:0,total:ids.length,message,running:true});setSudaisProgress(message);return;
    }
    if(!("caches" in window)){setToast("التخزين الصوتي غير متاح في هذا المتصفح");return;}
    const controller=new AbortController();browserDownloadAbortRef.current=controller;downloadRunningRef.current=true;
    setSudaisDownloading(true);setReciterDownloadProgress({reciter:id,done:0,total:ids.length,message,running:true});
    let done=0;
    try{
      await downloadAudioBatch({reciter:source,verses:verses.map(v=>({id:sudaisId(v),globalNumber:v.global_number})),signal:controller.signal,onProgress:(count,total)=>{
        done=count;if(count===1||count%5===0||count===total)setReciterDownloadProgress({reciter:id,done:count,total,message:`جاري تنزيل التلاوة: ${arNum(count)} / ${arNum(total)}`,running:true});
      }});
      setReciterDownloadProgress({reciter:id,done,total:ids.length,message:"✓ اكتمل تنزيل التلاوة",running:false});setSudaisProgress("✓ اكتمل تنزيل التلاوة");
    }catch{
      controller.abort();const message="توقف التنزيل؛ الملفات المكتملة محفوظة. اضغط تنزيل مجددًا لاستكمال الباقي.";
      setReciterDownloadProgress({reciter:id,done,total:ids.length,message,running:false});setSudaisProgress(message);
    }finally{browserDownloadAbortRef.current=null;downloadRunningRef.current=false;setSudaisDownloading(false);}
  }
  function cancelReciterDownload(){window.Android?.cancelSudaisDownload?.();browserDownloadAbortRef.current?.abort();}
  function downloadSudaisSurah(n:number){const surah=quran?.surahs.find(item=>item.number===n);if(surah)void startReciterDownload(reciter,surah.ayahs.map(ayah=>({...ayah,surahNumber:n,surahName:surah.name_arabic})));}
  function downloadAllSudais(){startFullReciterDownload(reciter);}
  function startFullReciterDownload(id:string){if(quran)void startReciterDownload(id,quran.surahs.flatMap(surah=>surah.ayahs.map(ayah=>({...ayah,surahNumber:surah.number,surahName:surah.name_arabic}))));}
  function isCatalogReciterAdded(item:CatalogReciter){return Boolean(item.builtinId)||customReciters.some(existing=>existing.edition===item.identifier);}
  async function searchReciter(){
    const query=newReciterName.trim(),request=++reciterSearchRequestRef.current;
    setCatalogChoice(null);setCatalogResults([]);setCatalogError("");setCatalogSearched(false);
    if(query.length<2){setCatalogError("اكتب اسم القارئ أولًا");return;}
    setCatalogBusy(true);
    const builtins:CatalogReciter[]=Object.entries(builtinReciterNames).map(([id,name])=>({identifier:`builtin_${id}`,builtinId:id,name,englishName:"",language:"ar",format:"audio",type:"versebyverse"}));
    try{
      const catalog=await loadReciterCatalog();if(request!==reciterSearchRequestRef.current)return;
      setCatalogResults(searchCatalog([...builtins,...catalog],query));setCatalogSearched(true);
    }catch{if(request===reciterSearchRequestRef.current){const existing=searchCatalog(builtins,query);setCatalogResults(existing);setCatalogSearched(Boolean(existing.length));setCatalogError("تعذر الوصول إلى قائمة القراء. تحقق من الإنترنت وحاول مجددًا.");}}
    finally{if(request===reciterSearchRequestRef.current)setCatalogBusy(false);}
  }
  function persistReciter(item:CustomReciter){
    if(customReciters.some(existing=>existing.id===item.id)){setToast("هذا القارئ موجود في قائمتك بالفعل");return;}
    const next=[...customReciters,item];
    try{localStorage.setItem("noor_custom_reciters",JSON.stringify(next));}catch{setCatalogError("لم نستطع حفظ القارئ؛ تحقق من مساحة التخزين.");return;}
    if(item.baseUrl&&window.Android?.saveOnlineReciter?.(item.id,item.name,item.baseUrl,item.numbering||"verseId")===false){localStorage.setItem("noor_custom_reciters",JSON.stringify(customReciters));setCatalogError("تعذر حفظ مصدر التلاوة على الهاتف.");return;}
    setCustomReciters(next);setCatalogChoice(null);setAddingReciter(false);setReciterPickerOpen(true);setToast("✓ تمت إضافة القارئ");setTimeout(()=>setToast(""),3000);
  }
  async function addCatalogReciter(item:CatalogReciter){
    if(catalogAdding||isCatalogReciterAdded(item))return;
    setCatalogAdding(item.identifier);setCatalogError("");
    try{persistReciter(await resolveCatalogReciter(item));}
    catch{setCatalogError("تعذر التحقق من ملف صوتي لهذا القارئ. لم نضفه؛ تحقق من الإنترنت أو اختر تلاوة أخرى.");}
    finally{setCatalogAdding("");}
  }
  async function addManualReciter(){
    const name=newReciterName.trim();if(!name){setCatalogError("اكتب اسم القارئ أولًا");return;}
    const id=`custom_${Date.now()}`;
    if(newReciterSource==="folder"){
      if(!newReciterFolder?.uri||newReciterFolder.foundFiles<1){setCatalogError("اختر مجلدًا يحتوي ملفات آيات معروفة");return;}
      window.Android?.saveCustomReciterFolder?.(id,name,newReciterFolder.uri);persistReciter({id,name,displayName:name,provider:"manual",treeUri:newReciterFolder.uri,sourceType:"folder"});
    }else{
      let url:URL;try{url=new URL(newReciterUrl.trim());}catch{setCatalogError("أدخل رابط HTTPS صالحًا");return;}
      if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash){setCatalogError("أدخل رابط HTTPS لمجلد الآيات بدون بيانات دخول");return;}
      const baseUrl=url.href.replace(/\/$/,"");setCatalogAdding(id);
      try{await verifyAudioResponse(await fetch(`${baseUrl}/001001.mp3`));persistReciter({id,name,displayName:name,provider:"manual",baseUrl,sourceType:"url",numbering:"verseId"});}
      catch{setCatalogError("لم نستطع قراءة ملف آية صالح من هذا المصدر. لم تتم إضافة القارئ.");}
      finally{setCatalogAdding("");}
    }
  }
  function removeReciter(id:string){
    if(!customReciters.some(item=>item.id===id)||reciterDownloadProgress?.running&&reciterDownloadProgress.reciter===id)return;
    const next=customReciters.filter(item=>item.id!==id);
    try{localStorage.setItem("noor_custom_reciters",JSON.stringify(next));}catch{setToast("تعذر حفظ التغيير");return;}
    setCustomReciters(next);window.Android?.removeCustomReciter?.(id);
    if(reciter===id){++audioRequestRef.current;audioRef.current?.pause();window.Android?.stopDownloadedAyah?.();setReciter("sudais");localStorage.setItem("noor_reciter","sudais");}
    setReciterManageId(null);setToast("تم حذف القارئ من قائمتك. ملفات التلاوة المحفوظة باقية.");setTimeout(()=>setToast(""),4000);
  }

  function normalizeOpeningBasmalaWord(value:string){
    return String(value||"").normalize("NFKD")
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g,"")
      .replace(/[إأآٱ]/g,"ا")
      .replace(/[\u200B-\u200F\u2066-\u2069\uFEFF]/g,"")
      .trim();
  }
  function hasEmbeddedBasmalaPrefix(v:ReaderVerse){
    if(v.surahNumber===9||v.number!==1||v.words.length<4)return false;
    const first=v.words.slice(0,4).map(w=>normalizeOpeningBasmalaWord(w.text));
    return first[0]==="بسم"&&first[1]==="الله"&&first[2]==="الرحمن"&&first[3]==="الرحيم";
  }
  function hasBasmalaPrefix(v:ReaderVerse){return v.surahNumber!==1&&hasEmbeddedBasmalaPrefix(v)}
  function verseDisplayText(v:ReaderVerse){
    if(!hasBasmalaPrefix(v))return readableQuranPreview(v.text);
    return v.words.slice(4).map(w=>readableQuranPreview(w.text)).filter(Boolean).join(" ");
  }
  function VersePreview({verse,compact=false}:{verse:ReaderVerse;compact?:boolean}){
    const text=compact?compactText(verseDisplayText(verse),105):verseDisplayText(verse);
    return <>{hasBasmalaPrefix(verse)&&<em className="resultBasmala quranTextSurface">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</em>}<span className="quranTextSurface">{text}</span></>;
  }

  function toggleBookmark(k:string){
    setBookmarks(b=>b.includes(k)?b.filter(x=>x!==k):[...b,k]);
  }

  function findAsbab(surah:number,ayah:number){
    return asbab.find(x=>Number(x.surah)===surah && Array.isArray(x.ayahs) && x.ayahs.map(Number).includes(ayah));
  }
  function findAsbabForDisplay(surah:number,ayah:number){
    const exact=findAsbab(surah,ayah);
    if(exact)return {entry:exact,contextual:false,relatedAyah:ayah};
    // The established report concerns 24:3, while 24:2 is the immediately
    // preceding legal context. Show it as related context without misattribution.
    if(surah===24&&ayah===2){const related=findAsbab(24,3);if(related)return {entry:related,contextual:true,relatedAyah:3};}
    return null;
  }

  async function openAsbab(verse:ReaderVerse){
    const local=findAsbabForDisplay(verse.surahNumber,verse.number);
    if(local){setWordAction(null);setAsbabDetail({verse,...local});return;}
    setWordAction(null);
    setToast("جاري البحث في مصادر أسباب النزول…");
    try{
      const remote=await fetchQuranpediaAsbab(verse.surahNumber,verse.number);
      if(remote.length){
        setToast("");
        setAsbabDetail({verse,entry:{surah:verse.surahNumber,ayahs:[verse.number],occasions:remote.map(x=>x.text),sources:remote.map(x=>x.source)},contextual:false,relatedAyah:verse.number});
        return;
      }
      setToast("لم يرد سبب نزول خاص لهذه الآية في المصادر المتاحة");
    }catch{
      setToast("تعذر الوصول للمصادر الموسعة الآن؛ لا يوجد سبب محلي محفوظ لهذه الآية");
    }
    window.setTimeout(()=>setToast(""),4200);
  }

  async function openWord(verse:ReaderVerse,index:number,text:string){
    const target=normalizeArabic(text);

    // Resolve the root from the exact surface form first. The old implementation
    // trusted the word array index before validating the token, which could return
    // the root of a neighbouring word when two datasets segment an ayah differently.
    let root:string|undefined=wordRootIndex[target];

    const rootData=await loadRootSurah(verse.surahNumber);
    const row=rootData.find(x=>x.k===verse.verse_key);

    if(!root && row?.words){
      const exact=row.words.find(w=>normalizeArabic(w.t)===target);
      root=exact?.r;
    }

    if(!root && row?.words?.[index]){
      const indexed=row.words[index];
      // Index fallback is accepted only when the actual surface word matches.
      if(normalizeArabic(indexed.t)===target) root=indexed.r;
    }

    const mf=root?mufradat[root]:undefined;
    const ri=root?roots[root]:undefined;

    // Prefer a context-specific gloss, then a short excerpt from the tafsir of
    // this exact ayah. The root dictionary remains visible separately as a
    // lexical reference and is never presented as the contextual meaning itself.
    let contextMeaning=contextualWordGlosses[`${verse.verse_key}|${target}`];

    const tafsir=await loadTafsirSurah(verse.surahNumber);
    const ayahTafsir=tafsir?.ayahs?.find(a=>Number(a.ayah_number)===verse.number);
    const preferred=(ayahTafsir?.tafsir||[]).find(x=>
      /الميسر|السعدي|المختصر/.test(x.type||"")
    ) || ayahTafsir?.tafsir?.[0];

    if(!contextMeaning && preferred?.text){
      const clean=preferred.text.replace(/\s+/g," ").trim();
      contextMeaning=`في سياق الآية (${preferred.type}): ${clean}`;
    }

    if(!contextMeaning){
      contextMeaning=functionWordMeanings[target] || "لم أجد شرحًا سياقيًا مستقلًا لهذه الكلمة في المراجع المحلية الحالية.";
    }

    setWordInfo({
      text:readableQuranPreview(text),
      root,
      contextMeaning,
      lexicalMeaning:mf?.t
        ? `المعنى المعجمي للجذر «${root}»: ${mf.t}`
        : undefined,
      english:ri?.m,
      verseKey:verse.verse_key,
      source:preferred?.type
        ? `${preferred.type} · مفردات الراغب · فهرس الجذور المحلي`
        : "مفردات ألفاظ القرآن للراغب الأصفهاني · فهرس الجذور المحلي"
    });
  }

  function extractTerms(text:string){
    const norm=normalizeArabic(text);
    return norm.split(" ").filter(w=>w.length>1&&!stopWords.has(w)).sort((a,b)=>b.length-a.length);
  }

  function matchCommonFact(text:string){
    const n=normalizeArabic(text);
    return commonFacts.find(f=>f.patterns.some(p=>n.includes(normalizeArabic(p))));
  }

  async function loadTafsirSurah(surah:number){
    if(tafsirCache.current[surah])return tafsirCache.current[surah];
    try{
      const key=String(surah).padStart(3,"0");
      const r=await fetch(`./data/tafsir/${key}.json`);
      if(!r.ok)return null;
      const data=await r.json() as TafsirSurah;
      tafsirCache.current[surah]=data;
      return data;
    }catch{return null}
  }

  async function loadHadithIndex(){
    if(hadithCache.current)return hadithCache.current;
    try{
      const r=await fetch("./data/hadith_index.json");
      if(!r.ok)return [];
      const data=await r.json();
      hadithCache.current=Array.isArray(data)?data:[];
      return hadithCache.current;
    }catch{return []}
  }

  async function loadIslamKnowledge(){
    if(knowledgeCache.current)return knowledgeCache.current;
    try{
      const r=await fetch("./data/islam_knowledge.json");
      if(!r.ok)return [];
      const data=await r.json();
      knowledgeCache.current=Array.isArray(data)?data:[];
      return knowledgeCache.current;
    }catch{return []}
  }

  async function findKnowledge(question:string, terms:string[], categories:string[]=[]){
    const data=await loadIslamKnowledge();
    const qn=normalizeArabic(question);
    return data.map(k=>{
      const hay=[k.title,...(k.aliases||[]),...(k.tags||[]),k.answer].join(" ");
      let score=textScore(hay,terms);
      for(const a of k.aliases||[]) if(qn.includes(normalizeArabic(a))) score+=10;
      if(qn.includes(normalizeArabic(k.title)))score+=12;
      if(categories.includes(k.category))score+=4;
      return {k,score};
    }).filter(x=>x.score>=4).sort((a,b)=>b.score-a.score).slice(0,5).map(x=>x.k);
  }

  async function loadTafsirSearch(){
    if(tafsirSearchCache.current)return tafsirSearchCache.current;
    try{
      const r=await fetch("./data/tafsir_search.json");
      if(!r.ok)return [];
      const data=await r.json();
      tafsirSearchCache.current=Array.isArray(data)?data:[];
      return tafsirSearchCache.current;
    }catch{return []}
  }

  function compactText(text:string,max=250){
    const clean=String(text||"")
      .replace(/<[^>]+>/g," ")
      .replace(/\s+/g," ")
      .trim();
    if(clean.length<=max)return clean;
    const sentence=clean.slice(0,max);
    const cut=Math.max(sentence.lastIndexOf("。"),sentence.lastIndexOf("."),sentence.lastIndexOf("؛"),sentence.lastIndexOf("،"));
    return (cut>90?sentence.slice(0,cut):sentence).trim()+"…";
  }

  function tafsirPriority(name:string){
    const n=normalizeArabic(name);
    if(n.includes("الميسر"))return 0;
    if(n.includes("السعدي"))return 1;
    if(n.includes("ابن كثير"))return 2;
    if(n.includes("الطبري"))return 3;
    if(n.includes("القرطبي"))return 4;
    return 9;
  }

  async function understandQuestion(_question:string):Promise<LocalIntent|null>{
    return null;
  }

  async function composeGroundedAnswer(question:string,evidence:string){
    const extra=customEvidence(question);
    if(extra)evidence=(evidence?evidence+"\n\n":"")+extra;
    return compactText(evidence,520);
  }

  function textScore(text:string,terms:string[]){
    const n=normalizeArabic(text);
    let score=0;
    for(const term of terms){
      if(n.includes(term))score += term.length>=5?4:2;
    }
    return score;
  }

  async function findHadithSupport(terms:string[]){
    if(!terms.length)return [] as HadithIndexItem[];
    if(typeof Worker!=="undefined"){
      try{
        if(!hadithWorkerRef.current){
          const worker=new Worker(new URL("./hadith-worker.js",window.location.href));
          worker.onmessage=(event:MessageEvent<{id:string;items?:HadithIndexItem[]}>)=>{
            const pending=hadithWorkerQueries.current.get(event.data?.id);
            if(!pending)return;
            window.clearTimeout(pending.timer);hadithWorkerQueries.current.delete(event.data.id);
            pending.resolve(Array.isArray(event.data.items)?event.data.items:[]);
          };
          hadithWorkerRef.current=worker;
        }
        return await new Promise<HadithIndexItem[]>(resolve=>{
          const id=`h${Date.now()}${Math.random().toString(36).slice(2,7)}`;
          const timer=window.setTimeout(()=>{hadithWorkerQueries.current.delete(id);resolve([])},15000);
          hadithWorkerQueries.current.set(id,{resolve,timer});
          hadithWorkerRef.current!.postMessage({id,terms});
        });
      }catch{}
    }
    const data=await loadHadithIndex();
    return data
      .map(h=>({h,score:textScore(h.arabic,terms)}))
      .filter(x=>x.score>0)
      .sort((a,b)=>b.score-a.score)
      .slice(0,3)
      .map(x=>x.h);
  }

  useEffect(()=>()=>{
    hadithWorkerRef.current?.terminate();hadithWorkerRef.current=null;
    for(const query of hadithWorkerQueries.current.values()){window.clearTimeout(query.timer);query.resolve([])}
    hadithWorkerQueries.current.clear();
  },[]);

  async function submitSirah(text=q){
    const t=text.trim(); if(!t || thinking)return;
    setQ(t); setThinking(true); setThinkingStage("أفهم سؤالك وأراجع السيرة…");
    if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
    try{
      const ai=await understandQuestion(t);
      const baseTerms=extractTerms(t);
      const aiTerms=(ai?.keywords||[]).map(normalizeArabic).filter(x=>x.length>1&&!stopWords.has(x));
      const terms=[...new Set([...aiTerms,...baseTerms])].sort((a,b)=>b.length-a.length);
      const direct=await findKnowledge(t,terms,["sirah","companions","history"]);
      if(direct.length){
        const evidence=direct.map(k=>`${k.title}: ${k.answer}\nالمصدر: ${k.source}`).join("\n\n");
        setThinkingStage("أصيغ الجواب من قاعدة السيرة…");
        const concise=await composeGroundedAnswer(t,evidence);
        setAnswer({title:direct[0].title,ayah:"",ref:"",meaning:concise||direct[0].answer,details:direct.slice(1,3).map(k=>`${k.title}: ${k.answer}`).join("\n\n"),context:"",sabab:"",source:direct.map(k=>k.source).filter((x,i,a)=>a.indexOf(x)===i).join(" · ")});
        return;
      }
      if(ai?.intent==="hadith" || /حديث|روى|رواه|البخاري|مسلم/.test(normalizeArabic(t))){
        setThinkingStage("أراجع كتب الحديث…");
        const preferred=(await findHadithSupport(terms)).filter(h=>/البخاري|bukhari|مسلم|muslim/i.test(h.book||""));
        if(preferred.length){
          const evidence=preferred.slice(0,3).map(h=>`${h.book}${h.reference?` · ${h.reference}`:""}: ${h.arabic}`).join("\n\n");
          const concise=await composeGroundedAnswer(t,evidence);
          setAnswer({title:"جواب من الحديث",ayah:"",ref:"",meaning:concise||compactText(preferred[0].arabic,260),details:"",context:"",sabab:"",source:preferred.map(h=>h.book).join(" · ")}); return;
        }
      }
      setAnswer({title:"المراجع المحلية غير كافية",ayah:"",ref:"",meaning:"لم أجد في قاعدة نور المحلية جوابًا موثوقًا كافيًا لهذا السؤال.",details:"",context:"",sabab:"",source:"قاعدة نور المحلية"});
    } finally {setThinking(false)}
  }

  function customEvidence(question:string){
    const terms=extractTerms(question);
    return customSources.map(x=>({x,score:textScore(x.title+" "+x.content,terms)}))
      .filter(v=>v.score>0).sort((a,b)=>b.score-a.score).slice(0,3)
      .map(v=>`مرجع مضاف: ${v.x.title}\n${compactText(v.x.content,900)}`).join("\n\n");
  }

  async function submit(text=q){
    const raw=text.trim(); if(!raw||thinking)return;
    setQ(raw);setThinking(true);setThinkingStage("أبحث في مصادر نور المحلية…");
    if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
    try{
      const intent=classifyQuranQuery(raw);
      const queryTerm=extractQueryTerm(raw,intent);
      if(intent==="COUNT"||intent==="WHERE"){
        const found=runLexicalQuery(quranSearchIndex,queryTerm);
        const label=queryTerm||"اللفظ المطلوب";
        const countText=found.verses.length
          ? intent==="COUNT"
            ? `ظهر اللفظ «${label}» ${arNum(found.normalizedCount)} مرة في ${arNum(found.verses.length)} آية. منها ${arNum(found.exactCount)} مطابقة مستقلة تمامًا، والباقي بعد فصل حرف عطف أو جر ملتصق. لم تُضم صيغ الجذر أو المرادفات إلى العدد.`
            : `وجدت ${arNum(found.verses.length)} آية تحتوي اللفظ «${label}» بعد إزالة التشكيل وتوحيد الرسم للبحث فقط. النص المعروض أدناه هو النص القرآني الأصلي.`
          : `لم أجد اللفظ «${label}» بهذه المطابقة اللفظية في بيانات القرآن المحلية.`;
        setAnswer({title:intent==="COUNT"?`عدد ورود «${label}»`:`مواضع «${label}»`,ayah:"",ref:"",meaning:countText,details:"",context:"",sabab:"",source:"نص القرآن المحلي المعتمد داخل نور",intent,results:found.verses,exactCount:found.exactCount,normalizedCount:found.normalizedCount,queryTerm:label});
        return;
      }
      if(intent==="MEANING"){
        const bare=normalizeArabic(queryTerm).replace(/^ال/,"");
        const mufradatEntry=Object.entries(mufradat).find(([key,value])=>normalizeArabic(key)===bare||normalizeArabic(value.r||"")===bare)?.[1];
        if(mufradatEntry?.t){
          setAnswer({title:`معنى «${queryTerm}»`,ayah:"",ref:"",meaning:compactText(mufradatEntry.t,620),details:"",context:"",sabab:"",source:"مفردات ألفاظ القرآن للراغب الأصفهاني · النسخة المحلية في نور",intent,queryTerm});
          return;
        }
        const lexical=runLexicalQuery(quranSearchIndex,queryTerm);
        const verseKeys=new Set(lexical.verses.map(v=>v.verse_key));
        const tafsir=(await loadTafsirSearch()).find(item=>verseKeys.has(item.verseKey));
        if(tafsir){
          const verse=verseByKey.get(tafsir.verseKey);
          setAnswer({title:`معنى «${queryTerm}» من التفسير المحلي`,ayah:"",ref:verse?`${verse.surahName} · ${arNum(verse.number)}`:"",meaning:compactText(tafsir.text,620),details:"",context:"",sabab:"",source:"فهرس التفاسير المحلي في نور (الميسر والسعدي)",intent,verseKey:tafsir.verseKey,queryTerm});
          return;
        }
        setAnswer({title:"المصدر المحلي غير كافٍ",ayah:"",ref:"",meaning:`لم أجد في معاجم نور أو تفاسيره المحلية معنى موثقًا كافيًا للفظ «${queryTerm}».`,details:"",context:"",sabab:"",source:"مفردات القرآن وفهرس التفاسير المحلي",intent,queryTerm});
        return;
      }
      if(intent==="TOPIC"){
        const terms=extractTerms(queryTerm||raw);
        const tafsirMatches=(await loadTafsirSearch()).map(item=>({item,score:textScore(item.text,terms)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
        const seen=new Set<string>();
        const related:ReaderVerse[]=[];
        for(const match of tafsirMatches){
          const verse=verseByKey.get(match.item.verseKey);
          if(verse&&!seen.has(verse.verse_key)){seen.add(verse.verse_key);related.push(verse)}
          if(related.length>=30)break;
        }
        const knowledge=await findKnowledge(raw,terms);
        const note=knowledge[0]?.answer?compactText(knowledge[0].answer,360):related.length?`هذه الآيات رُشحت من فهرس التفسير المحلي لارتباط شرحها بموضوع «${queryTerm}».`:"لم أجد نتائج موضوعية موثوقة كافية في الفهرس المحلي.";
        setAnswer({title:`آيات مرتبطة بموضوع «${queryTerm}»`,ayah:"",ref:"",meaning:note,details:"",context:"",sabab:"",source:knowledge[0]?.source?`${knowledge[0].source} · فهرس التفاسير المحلي`:"فهرس التفاسير المحلي في نور",intent,results:related,queryTerm});
        return;
      }
      const ai=await understandQuestion(raw);
      const terms=[...new Set([...(ai?.keywords||[]).map(normalizeArabic),...extractTerms(raw)])].filter(Boolean);
      const knowledge=await findKnowledge(raw,terms);
      const hadith=(ai?.intent==="hadith"||/حديث|البخاري|مسلم|رواه|روى/.test(normalizeArabic(raw)))?await findHadithSupport(terms):[];
      const verses=[...verseByKey.values()].map(v=>({v,score:textScore(cleanQuranDisplay(v.text),terms)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,4).map(x=>x.v);
      const evidence=[
        ...knowledge.slice(0,4).map(k=>`${k.title}: ${k.answer}\nالمصدر: ${k.source}`),
        ...hadith.slice(0,3).map(h=>`${h.book}${h.reference?` · ${h.reference}`:""}: ${h.arabic}`),
        ...verses.map(v=>`القرآن ${v.verse_key}: ${cleanQuranDisplay(v.text)}`)
      ].join("\n\n");
      if(!evidence.trim()){setAnswer({title:"المراجع المحلية غير كافية",ayah:"",ref:"",meaning:"لم أجد في مصادر نور المحلية ما يكفي للإجابة بثقة. جرّب صياغة السؤال بكلمات أوضح أو أضف مرجعًا موثوقًا من الإعدادات.",details:"",context:"",sabab:"",source:"مصادر نور المحلية"});return;}
      setThinkingStage("أجهز النتيجة من المراجع المحلية…");
      const answerText=await composeGroundedAnswer(raw,evidence);
      const first=verses[0];
      setAnswer({title:"جواب من مصادر نور المحلية",ayah:first?cleanQuranDisplay(first.text):"",ref:first?`${first.surahName} · ${arNum(first.number)}`:"",meaning:answerText||compactText(evidence,520),details:"",context:"",sabab:"",source:"القرآن والمراجع المحلية في نور"});
    }finally{setThinking(false)}
  }

  const currentVerses=pages[readerPage]||[];
  const currentSurahs=[...new Map(currentVerses.map(v=>[v.surahNumber,v.surahName])).entries()];
  useLayoutEffect(()=>{
    if(readerMode!=="pages")return;
    const inner=pageInnerRef.current;
    if(!inner)return;
    let cancelled=false;
    const measure=()=>{
      if(cancelled||!inner.clientWidth||!inner.clientHeight)return;
      inner.style.setProperty("--reading-column-width",`${inner.clientWidth}px`);
      // Fit a printed page to one physical screen whenever possible. This
      // prevents a final column containing only one verse and a large blank
      // area. Keep a readable floor for unusually dense pages.
      let fitted=30;
      inner.style.setProperty("--page-font-size",`${fitted}px`);
      while(fitted>18 && inner.scrollWidth>inner.clientWidth+2){
        fitted-=1;
        inner.style.setProperty("--page-font-size",`${fitted}px`);
      }
      const count=Math.max(1,Math.round(inner.scrollWidth/inner.clientWidth));
      setPageScreens(count);
      const useLastScreen=pendingLastScreen.current;
      setPageScreen(screen=>useLastScreen?count-1:Math.min(screen,count-1));
      pendingLastScreen.current=false;
    };
    measure();
    const observer=typeof ResizeObserver!=="undefined"?new ResizeObserver(measure):null;
    observer?.observe(inner);
    window.addEventListener("resize",measure);
    document.fonts?.ready.then(measure);
    return()=>{cancelled=true;observer?.disconnect();window.removeEventListener("resize",measure);};
  },[readerPage,readerMode,focusMode,quran,tab]);
  useLayoutEffect(()=>{
    if(readerMode!=="pages")return;
    const inner=pageInnerRef.current;
    if(inner)inner.scrollLeft=-pageScreen*inner.clientWidth;
    localStorage.setItem("noor_reader_screen",String(pageScreen));
  },[pageScreen,pageScreens,readerPage,readerMode]);
  const fromReviewGlobal=verseByKey.get(reviewFrom)?.global_number??0;
  const toReviewGlobal=verseByKey.get(reviewTo)?.global_number??6236;
  const relativeQiblaAngle=qiblaBearing==null?0:normalizeDegrees(qiblaBearing-qiblaHeading);
  const qiblaSignedDelta=qiblaBearing==null?0:((relativeQiblaAngle+540)%360)-180;
  const qiblaAligned=qiblaBearing!=null&&Math.abs(qiblaSignedDelta)<=3;
  const measuredVirtualRows=continuousVirtualizer.getVirtualItems().map(row=>({index:row.index,start:row.start,key:row.key}));
  const virtualRows=measuredVirtualRows.length?measuredVirtualRows:Array.from({length:quran?3:0},(_,index)=>({
    index,key:index+1,start:continuousPageEstimates.slice(0,index).reduce((sum,size)=>sum+size,0)
  }));
  const quranSurahContent=readerMode==="pages"||!quran?null:<div className="virtualQuran" style={{height:`${continuousVirtualizer.getTotalSize()}px`}}>
    {virtualRows.map(virtualRow=>{
      const pageNumber=virtualRow.index+1;
      const pageVerses=pages[pageNumber]||[];
      const groups:Array<{surahNumber:number;surahName:string;verses:ReaderVerse[]}>=[];
      for(const verse of pageVerses){let group=groups[groups.length-1];if(!group||group.surahNumber!==verse.surahNumber){group={surahNumber:verse.surahNumber,surahName:verse.surahName,verses:[]};groups.push(group)}group.verses.push(verse)}
      return <div className="virtualSurahRow virtualPageRow" key={pageNumber} data-index={virtualRow.index} data-page={pageNumber} ref={continuousVirtualizer.measureElement} style={{transform:`translateY(${virtualRow.start}px)`}}>
        {groups.map(group=>{const surah=quran.surahs.find(item=>item.number===group.surahNumber);const startsHere=group.verses.some(v=>v.number===1);return <section className="mushafSurah continuousSurah continuousPageSurah" id={startsHere?`surah-${group.surahNumber}`:undefined} key={`${pageNumber}-${group.surahNumber}`}>
          {startsHere&&<div className="surahBanner ornate">
            <span className="surahMeta">{surah?.revelation?.type==="Meccan"?"مكية":"مدنية"}</span>
            <b>سورة {group.surahName}</b>
            <span className="surahMeta">{arNum(surah?.counts.ayahs||group.verses.length)} آية</span>
          </div>}
          {startsHere&&group.surahNumber!==1&&group.surahNumber!==9&&<div className="basmalaLine">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</div>}
          <div className="mushafText">
            {group.verses.map(v=>{const skip=hasBasmalaPrefix(v)?4:0;const inReview=reviewMode&&v.global_number>=Math.min(fromReviewGlobal,toReviewGlobal)&&v.global_number<=Math.max(fromReviewGlobal,toReviewGlobal);const hidden=inReview&&!revealedReview.has(v.verse_key);return <span className={`verseUnit ${hidden?"reviewHidden":""} ${playingVerse===v.verse_key?"recitationActive":""}`} id={`ayah-${v.verse_key.replace(":","-")}`} data-verse={v.verse_key} key={v.verse_key} onClick={()=>{if(inReview)toggleReviewReveal(v)}}>
              <MushafMargin verseKey={v.verse_key} kind="division"/>
              {markedWords(v.verse_key,v.words.slice(skip),(w,offset)=>{const wi=offset+skip;return <React.Fragment key={`${v.verse_key}-${wi}`}><WordSpan text={cleanQuranDisplay(w.text)} onLong={()=>{learnGuidanceTip("word");setWordAction({verse:v,index:wi,text:w.text})}} onDouble={()=>{learnGuidanceTip("audio");playAyah(v)}}/></React.Fragment>})}
              <MushafMargin verseKey={v.verse_key} kind="sajda"/>{(v.surahNumber!==1||v.number!==1||skip===0)&&<AyahButton bookmarked={bookmarks.includes(v.verse_key)} number={v.number} onClick={()=>toggleBookmark(v.verse_key)} onLong={()=>askVerse(v)}/>}{' '}
            </span>})}
          </div>
        </section>})}
      </div>;
    })}
  </div>;

  const pagedQuranContent=useMemo(()=>{
    // The opening reader screen is presented as a decorative opening spread:
    // Al-Fatihah followed by the opening of Al-Baqarah. Other screens keep the
    // canonical page mapping used for navigation/bookmarks.
    const verses=readerPage===1?[...(pages[1]||[]),...(pages[2]||[])]:pages[readerPage]||[];
    if(!verses.length)return <div className="readerLoading">جاري تجهيز الصفحة…</div>;
    const groups:Array<{surahNumber:number;surahName:string;verses:ReaderVerse[]}>=[];
    for(const verse of verses){
      let group=groups[groups.length-1];
      if(!group||group.surahNumber!==verse.surahNumber){group={surahNumber:verse.surahNumber,surahName:verse.surahName,verses:[]};groups.push(group)}
      group.verses.push(verse);
    }
    const wordCount=verses.reduce((sum,verse)=>sum+verse.words.length,0);
    const density=wordCount>135?"dense":wordCount>105?"medium":"normal";
    const juz=verses[0]?.juz;
    return <div key={`${readerPage}-${pageTurn.token}`} className={`mushafPage pageDensity-${density} pageTurn-${pageTurn.direction}`} style={{"--page-font-size":`${pageFontSize}px`} as React.CSSProperties} onTouchStart={onPageTouchStart} onTouchEnd={onPageTouchEnd}>
      <div className="mushafPageInner" ref={pageInnerRef}>
        <div className="readingColumns">
        {groups.map(group=>{
          const surah=quran?.surahs.find(item=>item.number===group.surahNumber);
          const startsHere=group.verses.some(v=>v.number===1);
          return <section className="mushafPageSurah" key={`${readerPage}-${group.surahNumber}`}>
            {startsHere&&<div className="surahBanner ornate pageSurahBanner">
              <span className="surahMeta">{surah?.revelation?.type==="Meccan"?"مكية":"مدنية"}</span>
              <b>سورة {group.surahName}</b>
              <span className="surahMeta">{arNum(surah?.counts.ayahs||group.verses.length)} آية</span>
            </div>}
            {startsHere&&group.surahNumber!==1&&group.surahNumber!==9&&<div className="basmalaLine pageBasmala">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</div>}
            <div className="mushafText pageMushafText">
              {group.verses.map(v=>{const skip=hasBasmalaPrefix(v)?4:0;return <span className={`verseUnit ${playingVerse===v.verse_key?"recitationActive":""}`} id={`ayah-${v.verse_key.replace(":","-")}`} data-verse={v.verse_key} key={v.verse_key}>
                <MushafMargin verseKey={v.verse_key} kind="division"/>
                {markedWords(v.verse_key,v.words.slice(skip),(w,offset)=>{const wi=offset+skip;return <React.Fragment key={`${v.verse_key}-${wi}`}><WordSpan text={cleanQuranDisplay(w.text)} onLong={()=>{learnGuidanceTip("word");setWordAction({verse:v,index:wi,text:w.text})}} onDouble={()=>{learnGuidanceTip("audio");playAyah(v)}}/></React.Fragment>})}
                <MushafMargin verseKey={v.verse_key} kind="sajda"/>{(v.surahNumber!==1||v.number!==1||skip===0)&&<AyahButton bookmarked={bookmarks.includes(v.verse_key)} number={v.number} onClick={()=>toggleBookmark(v.verse_key)} onLong={()=>askVerse(v)}/>} {' '}
              </span>})}
            </div>
          </section>
        })}
        </div>
      </div>
      <div className="pageTurnControls" aria-label="التنقل بين صفحات المصحف">
        <button disabled={readerPage>=604&&pageScreen>=pageScreens-1} onClick={()=>turnReaderScreen(1)}><ChevronRight/> التالية</button>
        <span>{arNum(readerPage)} / ٦٠٤{pageScreens>1&&<small className="readerScreenCount">شاشة {arNum(pageScreen+1)} من {arNum(pageScreens)}</small>}</span>
        <button disabled={readerPage<=1&&pageScreen===0} onClick={()=>turnReaderScreen(-1)}>السابقة <ChevronLeft/></button>
      </div>
    </div>;
  },[pages,readerPage,pageTurn,quran,bookmarks,currentSurahs,pageFontSize,pageScreen,pageScreens,playingVerse]);

  if(sirahPage){
    return <OverlayTheme.Provider value={{dark,quranFont}}><main className={`${dark?"app dark":"app"} quran-font-${quranFont}`} data-tab="sirah">
      <div className="aurora a1"/><div className="aurora a2"/>
      <header>
        <div className="brand"><div><b>نور</b><small>اسأل عن السيرة</small></div></div>
      </header>
      <section className="content sirahStandalone">
        <button className="sirahBack glass" onClick={()=>{setSirahPage(false);setAnswer(null);setQ("")}}><ChevronRight/> العودة</button>
        {!answer ? <div className="sirahHero">
          <img src={NOOR_LOGO} className="sirahPageLogo" alt="نور"/>
          <h1>اسأل عن السيرة</h1>
          <p>من صحيح البخاري وصحيح مسلم</p>
        </div> : <div className="answer pageEnter"><Glass className="answerCard">
          <div className="answerHead"><Sparkles/><div><small>إجابة موثقة من السنة</small><h2>{answer.title}</h2></div></div>
          <section className="answerSummary"><h3>الجواب</h3><p>{answer.meaning}</p></section>
          {answer.details&&<details className="referenceDetails"><summary>تفاصيل من المراجع</summary><p>{answer.details}</p></details>}
          <button className="source" onClick={()=>setSources(true)}><Info/> المصادر <ChevronLeft/></button>
        </Glass></div>}
        <div className="composer glass"><Search/><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!thinking&&submitSirah()} placeholder="اسأل عن السيرة…"/><button disabled={thinking} onClick={()=>submitSirah()}>{thinking?<span className="miniSpinner"/>:<Send/>}</button></div>
      </section>
      {thinking&&<div className="thinkingOverlay" role="status"><Glass className="thinkingCard"><div className="thinkingMark"><span/><span/><span/></div><h3>{thinkingStage}</h3><p>نور يراجع صحيح البخاري ومسلم.</p></Glass></div>}
      {sources&&<Overlay className="modalWrap" onClose={()=>setSources(false)}><Glass className="sourcesModal" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setSources(false)}><X/></button><h2>المصادر</h2><p>صحيح البخاري · صحيح مسلم</p></Glass></Overlay>}
    </main></OverlayTheme.Provider>
  }

  return <OverlayTheme.Provider value={{dark,quranFont}}><main className={`${dark?"app dark":"app"} quran-font-${quranFont}`} data-tab={tab}>
    <div className="aurora a1"/><div className="aurora a2"/>

    {tab!=="quran" && <header>
      <div className="brand"><div><b>نور</b><small>اعرف عن القرآن</small></div></div>
      {lastVerseKey&&verseByKey.has(lastVerseKey)&&<button className="headerContinue glass" onClick={resumeReading}><BookOpen/><span>تابع القرآن من حيث توقفت</span></button>}
    </header>}

    <section className="content">
      {tab==="home" && <>
        {toolPage&&<Glass className="page toolPage pageEnter">
          <button className="toolBack" onClick={closeTool}><ChevronRight/> رجوع</button>
          {toolPage==="revelation"&&<RevelationJourney surahs={quran?.surahs||[]} onOpen={key=>{const v=verseByKey.get(key);if(v){closeTool();jumpToVerse(v,true)}}}/>}
          {toolPage==="stories"&&<QuranStories surahs={quran?.surahs||[]} onOpen={key=>{const v=verseByKey.get(key);if(v){closeTool();jumpToVerse(v,true)}}}/>}
          {toolPage==="qibla"&&<div className="qiblaPage">
            <div className="toolTitle"><Compass/><div><small>اتجاه محلي على الجهاز</small><h2>القبلة</h2></div></div>
            <div className={`qiblaDialWrap ${qiblaAligned?"qiblaAligned":""}`}><div className="qiblaDial">
              <div className="qiblaTicks"/>
              <span className="cardinal north">N</span><span className="cardinal east">E</span><span className="cardinal south">S</span><span className="cardinal west">W</span>
              {[30,60,120,150,180,210,240,300,330].map(deg=><span className={`degree d${deg}`} key={deg}>{deg}</span>)}
              <div className="qiblaMapWatermark"/>
              <div className="deviceForwardMark" aria-label="اتجاه أعلى الهاتف"><span/></div>
              <div className="qiblaGuideLayer" style={{transform:`rotate(${qiblaSignedDelta}deg)`}} aria-label="اتجاه القبلة بالنسبة للهاتف"><span className="qiblaGuideCone"/><span className="qiblaGuideArrow"/></div>
              <div className={`qiblaKaabaDisplay ${qiblaAligned?"aligned":""}`} aria-hidden="true"><div className="qiblaKaaba"><i className="kaabaBand"/><i className="kaabaDoor"/></div></div>
              <div className="needleHub"/>
            </div></div>
            <div className={`qiblaReadout glassPanel ${qiblaAligned?"aligned":""}`}><strong>{qiblaBearing==null?"—":qiblaAligned?"✓":`${qiblaSignedDelta<0?"−":""}${arNum(Math.abs(Math.round(qiblaSignedDelta)))}°`}</strong><span>{qiblaBearing==null?"بانتظار الموقع":qiblaAligned?"الاتجاه الصحيح":"زاوية الجهاز إلى القبلة"}</span><small>{qiblaStatus}</small>{qiblaAccuracy>0&&<small>دقة المستشعر: {qiblaAccuracy>=3?"جيدة":qiblaAccuracy===2?"متوسطة":"تحتاج معايرة · حرّك الهاتف على شكل ٨"}</small>}</div>
            <button className="primaryGlass qiblaLocate" onClick={()=>window.Android?.requestQiblaLocation?.()}><MapPinned/> تحديث موقعي</button>
          </div>}
          {toolPage==="adhkar"&&<div className="adhkarPage">
            <div className="toolTitle"><BookMarked/><div><small>كل بطاقة تعرض مصدرها</small><h2>الأذكار والأدعية</h2></div></div>
            <div className="adhkarTabs">{([["morning","الصباح"],["evening","المساء"],["prayer","بعد الصلاة"],["sleep","النوم"],["daily","يومية"],["general","أدعية"]] as const).map(([key,label])=><button key={key} className={adhkarCategory===key?"active":""} onClick={()=>setAdhkarCategory(key)}>{label}</button>)}</div>
            <div className="adhkarList">{ADHKAR.filter(item=>item.categories.includes(adhkarCategory)).map(item=>{const count=adhkarCounts[item.id]||0;const done=count>=item.target;return <article className={`dhikrCard glassPanel ${done?"done":""}`} key={item.id}><div className="dhikrHead"><div><b>{item.title}</b><small>{item.source}</small></div><button className="dhikrCounter" aria-label={`عداد ${item.title}`} onClick={()=>setAdhkarCounts(current=>({...current,[item.id]:done?0:Math.min(item.target,(current[item.id]||0)+1)}))}>{done?<CircleCheck/>:<span>{arNum(count)}/{arNum(item.target)}</span>}</button></div><p>{adhkarCategory==="evening"&&item.eveningText?item.eveningText:item.text}</p><small className="dhikrHint">اضغط العداد بعد كل مرة</small></article>})}</div>
          </div>}
          {toolPage==="topics"&&<div className="topicsPage">
            <div className="toolTitle"><Layers3/><div><small>القرآن · التفسير · الحديث · المعرفة المحلية</small><h2>البحث الموضوعي</h2></div></div>
            <div className="topicSearch glassPanel"><Search/><input value={topicQuery} onChange={e=>setTopicQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&void runTopicSearch()} placeholder="مثال: الصبر، بر الوالدين، التوبة…"/><button disabled={topicLoading} onClick={()=>void runTopicSearch()}>{topicLoading?<span className="miniSpinner"/>:<Search/>}</button></div>
            {!topicLoading&&topicQuery&&topicResults.length===0&&<p className="topicEmpty">اكتب موضوعًا ثم اضغط بحث.</p>}
            <div className="topicResults">{topicResults.map(result=><article className="topicResult glassPanel" key={result.id} onClick={()=>{if(result.verseKey&&verseByKey.has(result.verseKey)){closeTool();jumpToVerse(verseByKey.get(result.verseKey)!,true)}}}><div><span className={`resultKind ${result.kind}`}>{result.kind==="quran"?"قرآن":result.kind==="tafsir"?"تفسير":result.kind==="hadith"?"حديث":"مرجع"}</span><b>{result.title}</b></div><p>{result.text}</p><small>{result.source}</small>{result.verseKey&&<ChevronLeft/>}</article>)}</div>
          </div>}
        </Glass>}
        {!toolPage&&<>
        {!answer ? <div className="hero">
          <button className="orb noorLogoOrb sirahLauncher" onClick={()=>{setSirahPage(true);setAnswer(null);setQ("");}} aria-label="فتح اسأل عن السيرة">
            <img src={dark?NOOR_LOGO:NOOR_LIGHT_LOGO} alt="اسأل عن السيرة"/>
          </button>
          <h1 className="simpleTitle"><span>اعرف عن القرآن</span></h1>
          <div className="chips">{suggestions.map((s,i)=>
            <button className="chip glass" onClick={()=>submit(s)} key={s}>
              <span className="chipIcon">{i===0?<BookOpen/>:i===1?<Sparkles/>:i===2?<Quote/>:<BookOpen/>}</span>
              <span>{s}</span><ChevronLeft/>
            </button>)}
          </div>
          <div className="noorTools" aria-label="أدوات نور">
            <button className="toolTile glass" onClick={()=>{setToolPage("revelation");setAnswer(null)}}><span><CalendarDays/></span><b>رحلة نزول القرآن</b><small>ترتيب ومصادر</small></button>
            <button className="toolTile glass" onClick={()=>{setToolPage("stories");setAnswer(null)}}><span><BookOpen/></span><b>قصص القرآن</b><small>فصول وآيات</small></button>
            <button className="toolTile glass" onClick={openQibla}><span><Compass/></span><b>القبلة</b><small>اتجاه مباشر</small></button>
            <button className="toolTile glass" onClick={()=>{setToolPage("adhkar");setAnswer(null)}}><span><BookMarked/></span><b>الأذكار</b><small>بالمصادر</small></button>
            <button className="toolTile glass" onClick={()=>{setToolPage("topics");setAnswer(null)}}><span><Layers3/></span><b>موضوعات</b><small>بحث مترابط</small></button>
            <button className="toolTile glass" onClick={openFlashcardShortcut}><span><Target/></span><b>اختبار البطاقات</b><small>ابدأ مباشرة</small></button>
            <button className="toolTile glass prayerShortcut" onClick={iqamaEnabled&&prayerLocationReady?openPrayerTimes:openIqamaShortcut} aria-label={iqamaEnabled&&prayerLocationReady&&nextPrayer?`الصلاة القادمة ${nextPrayer.name} ${nextPrayerTime}، عرض جميع المواقيت`:"ضبط أوقات الإقامة"}><span><CalendarDays/></span><b>{iqamaEnabled&&prayerLocationReady&&nextPrayer?nextPrayer.name:"ضبط الإقامة"}</b><small className="prayerTimeValue">{iqamaEnabled&&prayerLocationReady&&nextPrayer?nextPrayerTime:"اضبطها مرة واحدة"}</small></button>
            <button className="toolTile glass" onClick={openReviewShortcut}><span><EyeOff/></span><b>مراجعة الحفظ</b><small>اختر نطاقك</small></button>
          </div>
        </div> :
        <div className="answer pageEnter">
          <button className="back glass" onClick={()=>{setAnswer(null);setQ("")}}><X/> سؤال جديد</button>
          <Glass className="answerCard">
            <div className="answerHead"><Sparkles/><div><small>إجابة موثقة ومختصرة</small><h2>{answer.title}</h2></div></div>
            <section className="answerSummary"><h3>الجواب</h3><p>{answer.meaning}</p></section>
            {answer.ayah && (answer.ayah.length>280
              ? <details className="ayah ayahDetails"><summary><Quote/> عرض الآية المرتبطة <small>{answer.ref}</small></summary><p>{answer.verseKey&&verseByKey.has(answer.verseKey)?<VersePreview verse={verseByKey.get(answer.verseKey)!}/>:answer.ayah}</p></details>
              : <div className="ayah"><Quote/><p>{answer.verseKey&&verseByKey.has(answer.verseKey)?<VersePreview verse={verseByKey.get(answer.verseKey)!}/>:answer.ayah}</p><small>{answer.ref}</small></div>)}
            {answer.details && <details className="referenceDetails"><summary>تفاصيل من المراجع</summary><p>{answer.details}</p></details>}
            {answer.context && <section className="compactSection"><h3>مرتبط أيضًا</h3><p>{answer.context}</p></section>}
            {answer.sabab && <section className="compactSection"><h3>سبب النزول</h3><p>{compactText(answer.sabab,360)}</p></section>}
            {answer.verseKey&&verseByKey.has(answer.verseKey)&&<button className="answerVerseLink glassPanel" onClick={()=>jumpToVerse(verseByKey.get(answer.verseKey!)!,true)}><BookOpen/><span>فتح الآية المرتبطة</span><small>{answer.ref}</small><ChevronLeft/></button>}
            {answer.results&&answer.results.length>0&&<section className="answerResults" aria-label="نتائج الآيات"><h3>{answer.intent==="TOPIC"?"الآيات المرتبطة":"جميع المواضع"}</h3><div>{answer.results.slice(0,answerResultLimit).map(verse=><button key={verse.verse_key} className="quranResult glassPanel" onClick={()=>jumpToVerse(verse,true)}><b>سورة {verse.surahName} · الآية {arNum(verse.number)}</b><VersePreview verse={verse}/><ChevronLeft/></button>)}</div>{answer.results.length>answerResultLimit&&<button className="loadMoreResults" onClick={()=>setAnswerResultLimit(limit=>limit+30)}>عرض {arNum(Math.min(30,answer.results!.length-answerResultLimit))} نتيجة أخرى</button>}</section>}
            <button className="source" onClick={()=>setSources(true)}><Info/> المصادر <ChevronLeft/></button>
          </Glass>
        </div>}
        <div className="composer glass"><Search/><input value={q} aria-label="اعرف عن القرآن" onFocus={()=>document.documentElement.classList.add("keyboard-open")} onBlur={()=>window.setTimeout(()=>{const h=window.visualViewport?.height??window.innerHeight;if(window.innerHeight-h<100)document.documentElement.classList.remove("keyboard-open")},120)} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!thinking&&submit()} placeholder="اعرف عن القرآن…"/><button disabled={thinking} onClick={()=>submit()}>{thinking?<span className="miniSpinner"/>:<Send/>}</button></div>
        </>}
      </>}

      {quranMounted&&<div aria-hidden={tab!=="quran"} className={`readerShell continuousReader ${focusMode?"focusReader":""}`}>
        {focusMode&&<button className="focusExit glass" onClick={()=>setFocusMode(false)} aria-label="الخروج من وضع التركيز"><Minimize2/></button>}
        <div className="readerToolbar glass continuousToolbar">
          <button className="recitationOpen" aria-label="تلاوة A–B" onClick={()=>setRepeatOpen(true)}>A–B</button>
          <button className="surahPickerButton" aria-label="اختر السورة أو الجزء أو الصفحة" onClick={()=>setSurahPicker(true)}><List/><span>انتقال</span></button>
          <button className="focusButton" onClick={()=>setFocusMode(v=>!v)} aria-label="وضع التركيز"><Focus/></button>
          <div className="autoScrollControls" aria-label="التمرير التلقائي">
            <button className={autoScroll?"autoActive":""} onClick={()=>{setFollowAudio(false);setAutoScroll(v=>!v)}} aria-label={autoScroll?"إيقاف التمرير التلقائي":"تشغيل التمرير التلقائي"}>{autoScroll?<Pause/>:<Play/>}</button>
            <input className="speedSlider" type="range" min="1" max="6" step="0.1" value={autoScrollSpeed} onInput={e=>setAutoScrollSpeed(Number((e.target as HTMLInputElement).value))} onChange={e=>setAutoScrollSpeed(Number(e.target.value))} aria-label="سرعة التمرير"/>
          </div>
        </div>
        {sessionState.status!=="idle"&&<div className="reviewSession glass"><span>{sessionState.key} · {sessionState.status==="paused"?"متوقف مؤقتًا":sessionState.status==="error"?sessionState.message:`التكرار ${arNum(sessionState.cycle)}`}</span><button onClick={()=>setRepeatOpen(true)}>تحكم</button><button onClick={()=>sessionRef.current?.cancel()}>إلغاء</button></div>}
        {!focusMode&&<div className={`quranInlineSearch glass ${quranSearch?"hasValue":""}`}><Search/><input aria-label="البحث داخل المصحف" value={quranSearch} onChange={e=>setQuranSearch(e.target.value)} placeholder="البحث داخل المصحف…"/>{quranSearch&&<button className="searchClear" aria-label="مسح البحث" onClick={()=>setQuranSearch("")}><X/></button>}</div>}
        {!focusMode&&quranSearch.trim().length>=2&&quranSearchResults.length===0&&debouncedQuranSearch===quranSearch&&<div className="quranSearchResults glass emptySearch">لا توجد نتائج مطابقة</div>}
        {!focusMode&&quranSearchResults.length>0&&<div className="quranSearchResults glass">{quranSearchResults.slice(0,20).map(v=><button key={v.verse_key} onClick={()=>{setQuranSearch("");setDebouncedQuranSearch("");jumpToVerse(v,true)}}><b>سورة {v.surahName} · الآية {arNum(v.number)}</b><VersePreview verse={v} compact/></button>)}</div>}
        {reviewMode&&<div className="reviewSession glass"><span><EyeOff/> وضع مراجعة الحفظ</span><button onClick={finishClassicReview}>إنهاء المراجعة</button></div>}
        <div className="readerViewport continuousViewport" ref={readerRef} onScroll={onReaderScroll}>
          {!quran&&<div className="readerLoading">{dataError||"جاري تحميل القرآن الكامل…"}</div>}
          {quran&&quranSurahContent}
          <div className="readerBottomPad"/>
        </div>
        {focusMode&&<div className="focusScrollControls autoScrollControls glass" aria-label="التمرير التلقائي في وضع التركيز">
          <button className={autoScroll?"autoActive":""} onClick={()=>{setFollowAudio(false);setAutoScroll(v=>!v)}} aria-label={autoScroll?"إيقاف التمرير التلقائي":"تشغيل التمرير التلقائي"}>{autoScroll?<Pause/>:<Play/>}</button>
          <input className="speedSlider" type="range" min="1" max="6" step="0.1" value={autoScrollSpeed} onInput={e=>setAutoScrollSpeed(Number((e.target as HTMLInputElement).value))} onChange={e=>setAutoScrollSpeed(Number(e.target.value))} aria-label="سرعة التمرير في وضع التركيز"/>
        </div>}
      </div>}

      {tab==="saved" && <Glass className="page savedPage pageEnter">
        <Bookmark/><h2>المحفوظات</h2>
        <div className="khatmaCard glassPanel"><div className="cardTitle"><CalendarDays/><b>خطة ختم القرآن</b></div><label className="glassInput"><span>عدد الأيام</span><input aria-label="عدد أيام الختمة" type="number" inputMode="numeric" min="1" max="365" value={khatmaDaysDraft} onChange={e=>setKhatmaDaysDraft(e.target.value)} onBlur={()=>{const days=clamp(Math.trunc(Number(khatmaDaysDraft)||30),1,365);setKhatmaDays(days);setKhatmaDaysDraft(String(days));localStorage.setItem("noor_khatma_days",String(days))}}/><em>يومًا</em></label><button className="primaryGlass" onClick={startKhatma}>{khatmaStart?"تحديث الخطة":"ابدأ الخطة"}</button>{khatmaStats&&<div className="khatmaStats"><div><small>اليوم</small><b>{arNum(khatmaStats.day)}</b></div><div><small>قراءة اليوم</small><b>{arNum(khatmaStats.daily)} صفحة</b></div><div><small>المتبقي</small><b>{arNum(khatmaStats.remaining)} صفحة</b></div><div><small>الإنجاز</small><b>{arNum(khatmaStats.percent)}٪</b></div><div className="planProgress"><span style={{width:`${khatmaStats.percent}%`}}/></div><button onClick={updateKhatmaProgress}><Check/> تحديث من موضع القراءة</button></div>}</div>
        <div className="reviewCard glassPanel"><div className="cardTitle"><EyeOff/><b>مراجعة الحفظ</b></div><small>اختر بداية ونهاية النطاق. يمكن أن يمتد النطاق بين سورتين.</small><div className="reviewRange"><fieldset><legend>من</legend><GlassSelect label="سورة البداية" value={reviewFromSurah} onChange={n=>{setReviewFromSurah(n);setReviewFromAyah(1)}}>{quran?.surahs.map(s=><option value={s.number} key={s.number}>{s.name_arabic}</option>)}</GlassSelect><GlassSelect label="آية البداية" value={reviewFromAyah} onChange={setReviewFromAyah}>{Array.from({length:quran?.surahs.find(s=>s.number===reviewFromSurah)?.counts.ayahs||1},(_,i)=><option value={i+1} key={i+1}>{arNum(i+1)}</option>)}</GlassSelect></fieldset><fieldset><legend>إلى</legend><GlassSelect label="سورة النهاية" value={reviewToSurah} onChange={n=>{setReviewToSurah(n);setReviewToAyah(1)}}>{quran?.surahs.map(s=><option value={s.number} key={s.number}>{s.name_arabic}</option>)}</GlassSelect><GlassSelect label="آية النهاية" value={reviewToAyah} onChange={setReviewToAyah}>{Array.from({length:quran?.surahs.find(s=>s.number===reviewToSurah)?.counts.ayahs||1},(_,i)=><option value={i+1} key={i+1}>{arNum(i+1)}</option>)}</GlassSelect></fieldset></div><button className="primaryGlass" onClick={beginClassicReview}>ابدأ المراجعة</button></div>
        <div className="reviewLab glassPanel"><div className="cardTitle"><Sparkles/><b>مختبر المراجعة</b><span className="betaBadge">BETA</span></div><small>يستخدم التسميع نفس النطاق المختار بالأعلى. البطاقات تستخدم النطاق الذي تختاره هنا مع مستوى الصعوبة.</small><div className="reviewModeGrid"><button className="reviewModeCard" onClick={()=>{startReviewSession();setOrderOpen(true)}}><span><Layers3/></span><div><b>ترتيب الآيات</b><small>أعد ترتيب النطاق المختار</small></div><ChevronLeft/></button><button className="reviewModeCard" onClick={()=>{startReviewSession();setReviewSessionCorrect(0);setReviewSessionAssisted(0);setRecitationText("");setRecitationResult("");setRecitationActive(true)}}><span><Mic/></span><div><b>التسميع الذكي</b><small>استمع لقراءتك وطابقها مع النطاق</small></div><ChevronLeft/></button><button className="reviewModeCard" onClick={beginFlashcards}><span><Target/></span><div><b>اختبار البطاقات</b><small>أكمل الآية من بدايتها</small></div><ChevronLeft/></button></div><div className="flashcardScope" role="group" aria-label="نطاق اختبار البطاقات"><button type="button" className={flashcardScope==="all"?"active":""} onClick={()=>setFlashcardScope("all")}>القرآن كاملًا</button><button type="button" className={flashcardScope==="review"?"active":""} onClick={()=>setFlashcardScope("review")}>نطاق آيات مخصص</button><button type="button" className={flashcardScope==="juz"?"active":""} onClick={()=>setFlashcardScope("juz")}>جزء محدد</button><button type="button" className={flashcardScope==="surah"?"active":""} onClick={()=>setFlashcardScope("surah")}>سورة معينة</button></div>{flashcardScope==="surah"&&<div className="flashcardJuzPicker"><span>السورة</span><GlassSelect label="السورة" value={flashcardSurah} onChange={setFlashcardSurah}>{quran?.surahs.map(s=><option value={s.number} key={s.number}>{s.name_arabic}</option>)}</GlassSelect></div>}{flashcardScope==="juz"&&<div className="flashcardJuzPicker"><span>الجزء</span><button type="button" className="glassSelectControl juzPickerTrigger" aria-haspopup="dialog" aria-expanded={flashcardJuzPickerOpen} onClick={()=>setFlashcardJuzPickerOpen(true)}><b>الجزء {arNum(flashcardJuz)}</b><ChevronDown/></button></div>}{flashcardScope==="review"&&<div className="flashcardCustomRange"><div className="rangeModeToggle"><button className={customRangeMode==="single"?"active":""} onClick={()=>{setCustomRangeMode("single");setReviewToSurah(reviewFromSurah)}}>داخل سورة واحدة</button><button className={customRangeMode==="between"?"active":""} onClick={()=>setCustomRangeMode("between")}>بين سور مختلفة</button></div><div className="reviewRange"><fieldset><legend>من</legend><GlassSelect label="سورة البداية" value={reviewFromSurah} onChange={n=>{setReviewFromSurah(n);setReviewFromAyah(1);if(customRangeMode==="single"){setReviewToSurah(n);setReviewToAyah(1)}}}>{quran?.surahs.map(s=><option value={s.number} key={s.number}>{s.name_arabic}</option>)}</GlassSelect><GlassSelect label="آية البداية" value={reviewFromAyah} onChange={setReviewFromAyah}>{Array.from({length:quran?.surahs.find(s=>s.number===reviewFromSurah)?.counts.ayahs||1},(_,i)=><option value={i+1} key={i+1}>{arNum(i+1)}</option>)}</GlassSelect></fieldset><fieldset><legend>إلى</legend>{customRangeMode==="between"&&<GlassSelect label="سورة النهاية" value={reviewToSurah} onChange={n=>{setReviewToSurah(n);setReviewToAyah(1)}}>{quran?.surahs.map(s=><option value={s.number} key={s.number}>{s.name_arabic}</option>)}</GlassSelect>}<GlassSelect label="آية النهاية" value={reviewToAyah} onChange={setReviewToAyah}>{Array.from({length:quran?.surahs.find(s=>s.number===(customRangeMode==="single"?reviewFromSurah:reviewToSurah))?.counts.ayahs||1},(_,i)=><option value={i+1} key={i+1}>{arNum(i+1)}</option>)}</GlassSelect></fieldset></div></div>}<div className="flashcardDifficulty" role="group" aria-label="صعوبة اختبار البطاقات">{([["easy","سهل"],["medium","متوسط"],["hard","صعب"]] as const).map(([key,label])=><button type="button" key={key} aria-pressed={flashcardDifficulty===key} className={flashcardDifficulty===key?"active":""} onClick={()=>setFlashcardDifficulty(key)}>{label}</button>)}</div><small className="difficultyHint">{flashcardDifficulty==="easy"?"آيات قصيرة من النطاق المختار":flashcardDifficulty==="hard"?"آيات طويلة من النطاق المختار":"آيات متوسطة الطول من القرآن كاملًا"}</small></div>
        <div className="memoryMap glassPanel"><div className="cardTitle"><BarChart3/><b>خريطة قوة الحفظ</b></div><small>الرمادي لم يُختبر بعد. كلما تحسن أداؤك يصبح اللون أقوى.</small><div className="strengthLegend"><span>غير مختبر</span><span>يحتاج مراجعة</span><span>متوسط</span><span>قوي</span></div><div className="surahHeatmap">{surahStrengthStats.map(item=><button key={item.number} className={item.score<0?"untested":item.score<45?"weak":item.score<75?"medium":"strong"} title={`سورة ${item.name}`} onClick={()=>{setReviewFromSurah(item.number);setReviewToSurah(item.number);setReviewFromAyah(1);setReviewToAyah(quran?.surahs.find(s=>s.number===item.number)?.counts.ayahs||1);setToast(`تم اختيار سورة ${item.name} للمراجعة`);setTimeout(()=>setToast(""),1800)}}><b>{arNum(item.number)}</b><small>{item.score<0?"—":`${arNum(item.score)}٪`}</small></button>)}</div></div>
        {bookmarks.length===0?<p>اضغط رقم أي آية داخل المصحف لحفظها هنا.</p>:
          <div className="savedList">{bookmarks.map(k=>{
            const v=verseByKey.get(k); if(!v)return null;
            return <div className="savedItem glassPanel" key={k}><button onClick={()=>jumpToVerse(v,true)}><b>سورة {v.surahName} · {arNum(v.number)}</b><VersePreview verse={v}/></button><button className="removeBookmark" aria-label={`إزالة ${k} من المحفوظات`} onClick={()=>toggleBookmark(k)}><X/></button></div>;
          })}</div>}
      </Glass>}

      {tab==="settings" && <Glass className="page settingsPage pageEnter">
        <Settings/><h2>الإعدادات</h2>
        <div className="settingsChoiceCard themeModeSetting glassPanel"><div className="settingsChoiceHead"><div><span>المظهر</span><small>اختر شكل التطبيق حسب تفضيلك</small></div><Smartphone/></div><div className="themeModeButtons settingsSegmented"><button className={themeMode==="system"?"active":""} onClick={e=>chooseTheme("system",e)}><Smartphone/> حسب الهاتف</button><button className={themeMode==="light"?"active":""} onClick={e=>chooseTheme("light",e)}><Sun/> فاتح</button><button className={themeMode==="dark"?"active":""} onClick={e=>chooseTheme("dark",e)}><Moon/> داكن</button></div></div>
        <div className="settingsChoiceCard quranFontSetting glassPanel"><div className="settingsChoiceHead"><div><span>خط المصحف</span><small>الخط الحالي هو الافتراضي. الخطوط القرآنية الإضافية تعمل دون إنترنت مع رجوع آمن للمحارف.</small></div><BookOpen/></div><div className="themeModeButtons settingsSegmented"><button className={quranFont==="hafs"?"active":""} onClick={()=>setQuranFont("hafs")}>الافتراضي</button><button className={quranFont==="amiri"?"active":""} onClick={()=>setQuranFont("amiri")}>أميري قرآن</button><button className={quranFont==="scheherazade"?"active":""} onClick={()=>setQuranFont("scheherazade")}>شهرزاد الجديدة</button></div></div>
        <div className="settingsInfoCard lastPageInfo glassPanel" aria-label={`آخر صفحة ${arNum(readerPage)}`}><div className="settingsInfoIcon"><BookOpen/></div><div><span>آخر صفحة</span><small>الصفحة التي توقفت عندها آخر مرة</small></div><b>{arNum(readerPage)}</b></div>
        <button type="button" className="settingsActionRow reciterSettingRow" onClick={()=>setReciterPickerOpen(true)}><div className="settingsActionIcon"><Volume2/></div><div><span>القارئ</span><small>تغيير صوت تلاوة القرآن</small></div><div className="settingActionValue"><b>{reciterNames[reciter]||"عبدالرحمن السديس"}</b><ChevronLeft/></div></button>
        <div className="setting"><div><span>أصوات الواجهة</span><small>نقرة خفيفة محلية عند الضغط على الأزرار، ولا تؤثر في التلاوة.</small></div><button className={uiSoundsEnabled?"isOn":""} onClick={()=>setUiSoundsEnabled(v=>!v)}><Volume2/> {uiSoundsEnabled?"مفعّلة":"متوقفة"}</button></div>
        <div className="settingsEditor iqamaSettings">
          <b>تنبيه إقامة الصلاة</b>
          <small>يظهر تنبيه الإقامة فوق أي تطبيق قبلها بالمدة التي تختارها. يعيد نور حساب المواقيت محليًا كل يوم بعد العشاء، ويمكنك تحديثها يدويًا في أي وقت. كما يصلك تذكير الجمعة قبل وقت الظهر بـ45 دقيقة.</small>
          <div className="setting"><span>تشغيل التنبيه</span><button onClick={()=>setIqamaEnabled(v=>!v)}>{iqamaEnabled?"مفعّل":"متوقف"}</button></div><div className="setting"><div><span>صوت الإقامة</span><small>ينطق «الله أكبر، الله أكبر» عند وصول التنبيه إذا كان الصوت مسموحًا في الهاتف.</small></div><button className={iqamaSoundEnabled?"isOn":""} onClick={()=>{const next=!iqamaSoundEnabled;setIqamaSoundEnabled(next);localStorage.setItem("noor_iqama_sound_enabled",next?"1":"0");window.Android?.setIqamaSoundEnabled?.(next)}}>{iqamaSoundEnabled?"مفعّل":"متوقف"}</button></div>
          <label className="iqamaLeadSetting"><span>التنبيه قبل الإقامة</span><div><input aria-label="دقائق التنبيه قبل الإقامة" type="text" role="spinbutton" inputMode="numeric" aria-valuemin={1} aria-valuemax={9} aria-valuenow={iqamaReminderMinutes} aria-invalid={Boolean(iqamaReminderError)} aria-describedby={iqamaReminderError?"iqamaReminderError":undefined} value={iqamaReminderDraft} onFocus={e=>e.currentTarget.select()} onChange={e=>{setIqamaReminderDraft(e.target.value);setIqamaReminderError("")}} onBlur={commitIqamaReminder}/><b>دقائق</b></div>{iqamaReminderError&&<small id="iqamaReminderError" role="alert">{iqamaReminderError}</small>}<small>اختر من ١ إلى ٩ دقائق، لضمان أن يكون التنبيه بعد الأذان وقبل أقصر إقامة.</small></label>
          {nextIqamaLabel&&<div className="nextIqamaState"><span>التنبيه القادم</span><b>{nextIqamaLabel}</b></div>}<small>تُحسب مواقيت الأذان تلقائيًا على الجهاز من موقعك الدقيق بطريقة أم القرى. لا يُرسل موقعك إلى خادم نور. الإقامة: الفجر +25 دقيقة، المغرب +10، وبقية الصلوات +20.</small>
          <div className="editorActions"><button onClick={saveIqamaSchedule}>{iqamaEnabled?"تفعيل الموقع وجدولة الإقامة":"حفظ"}</button>{iqamaEnabled&&<button onClick={saveIqamaSchedule}>تحديث الأوقات الآن</button>}{window.Android&&<button onClick={()=>window.Android?.previewIqamaOverlay?.("العشاء",dark)}>معاينة المربع</button>}{window.Android&&<button onClick={()=>{const ok=window.Android?.previewIqamaSound?.();setToast(ok===false?"تعذر تشغيل صوت الإقامة":"تشغيل تجربة صوت الإقامة…");window.setTimeout(()=>setToast(""),2200)}}>تجربة الصوت</button>}</div>
          {window.Android&&!window.Android.canDrawIqamaOverlay?.()&&<button onClick={()=>window.Android?.requestIqamaOverlayPermission?.()}>السماح بالظهور فوق التطبيقات</button>}
        </div>
        <div className="settingsEditor">
          <b>مصادر ومراجع إضافية</b>
          <small>أضف نص مرجع موثوق. يبحث نور فيه محليًا ويضيف المقاطع المرتبطة بالسؤال إلى مراجع الذكاء الاصطناعي.</small>
          <input maxLength={120} value={sourceTitle} onChange={e=>setSourceTitle(e.target.value)} placeholder="اسم المرجع"/>
          <textarea maxLength={200000} value={sourceContent} onChange={e=>setSourceContent(e.target.value)} rows={6} placeholder="الصق نص المرجع هنا…"/>
          <button onClick={()=>{if(!sourceTitle.trim()||!sourceContent.trim())return;const next=[...customSources,{id:String(Date.now()),title:sourceTitle.replace(/[\u0000-\u001F\u007F]/g," ").trim().slice(0,120),content:sourceContent.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g," ").trim().slice(0,200000)}];setCustomSources(next);localStorage.setItem("noor_custom_sources",JSON.stringify(next));setSourceTitle("");setSourceContent("")}}>+ إضافة المرجع</button>
          {customSources.length>0&&<div className="customSourceList">{customSources.map(x=><div key={x.id}><span>{x.title}</span><button onClick={()=>{const next=customSources.filter(v=>v.id!==x.id);setCustomSources(next);localStorage.setItem("noor_custom_sources",JSON.stringify(next))}}>حذف</button></div>)}</div>}
        </div>
        <div className="settingsEditor guidanceSettings"><div className="guidanceSettingsHead"><div className="guidanceSettingsIcon"><Sparkles/></div><div><b>تعرف على نور</b><small>مساعدة هادئة تظهر وقت الحاجة، وتختفي بعد أن تتعلم الميزة.</small></div></div><div className="setting guidanceToggle"><div><span>التلميحات الذكية</span><small>تلميح واحد فقط في الوقت المناسب، بدون مقاطعة القراءة.</small></div><button className={guidanceEnabled?"isOn":""} onClick={()=>{const next=!guidanceEnabled;setGuidanceEnabled(next);localStorage.setItem("noor_guidance_enabled",next?"1":"0")}}>{guidanceEnabled?"مفعّلة":"متوقفة"}</button></div><div className="guidanceSettingsActions"><button onClick={()=>{localStorage.removeItem("noor_guidance_seen");setGuideStep(0)}}><BookOpen/> الجولة الأساسية</button><button onClick={()=>{Object.keys(localStorage).filter(k=>k.startsWith("noor_tip_")).forEach(k=>localStorage.removeItem(k));setToast("تمت إعادة التلميحات");setTimeout(()=>setToast(""),1800)}}><RotateCcw/> إعادة التلميحات</button></div></div>
        <div className="setting"><span>العمل بدون إنترنت</span><b>القرآن والمعاني وأسباب النزول وحقائق شائعة محلية</b></div>
        <div className="credits">
          <b>المصادر</b>
          <p>نص القرآن: Tanzil عبر Quran Core Dataset. المعاني: مفردات الراغب. أسباب النزول: صحيح أسباب النزول. وعند نجاح Build تُضاف ثمانية تفاسير رئيسية وفهرس حديثي واسع للاستخدام دون إنترنت.</p>
        </div>
      </Glass>}
    </section>

    {toast&&createPortal(<div className={`noorToastLayer noorOverlayTheme ${dark?"dark":""}`}><div className="appToast" role="status">{toast}</div></div>,document.body)}
    {contextTip&&guideStep<0&&tab==="quran"&&<div className="contextCoach" role="status"><div className="contextCoachIcon"><Sparkles/></div><div className="contextCoachCopy"><b>{contextTip==="word"?"معنى أي كلمة":"استمع من نفس الكلمة"}</b><span>{contextTip==="word"?"اضغط مطولًا على كلمة في المصحف لمعرفة معناها.":"اضغط مرتين على أي كلمة لتشغيل الآية بصوت القارئ المختار."}</span><small>جرّبها الآن، وسيختفي هذا التلميح تلقائيًا.</small></div><button aria-label="إغلاق التلميح" onClick={()=>{localStorage.setItem(`noor_tip_${contextTip}`,"1");setContextTip(null)}}><X/></button></div>}
    {guideStep>=0&&<Overlay className="modal guidanceModal" role="dialog" aria-modal="true" aria-label="تعرف على نور"><Glass className="sheet guidanceSheet"><button className="guidanceClose" aria-label="تخطي الإرشادات" onClick={()=>{localStorage.setItem("noor_guidance_seen","1");setGuideStep(-1)}}><X/></button><div className="guidanceHero"><div className="guidanceHalo"></div><div className="guidanceIcon">{guideStep===0?<BookOpen/>:guideStep===1?<Sparkles/>:<CircleCheck/>}</div></div><div className="guidanceProgress" aria-label={`الخطوة ${guideStep+1} من 3`}>{[0,1,2].map(i=><span key={i} className={i===guideStep?"active":i<guideStep?"done":""}></span>)}</div><div className="guidanceCopy"><small>تعرف على نور · {arNum(guideStep+1)} من ٣</small><h2>{guideStep===0?"القرآن في قلب التجربة":guideStep===1?"كل ميزة تظهر في وقتها":"تعلّم بالتجربة، لا بالمحاضرات"}</h2><p>{guideStep===0?"اقرأ براحة، استمع للآيات، اعرف معنى الكلمات، واحفظ موضعك لتعود إليه مباشرة.":guideStep===1?"الأذكار والقبلة والختمة والاختبارات والتلاوات تبقى قريبة منك، من غير أن تزدحم الشاشة بالتعليمات.":"عند أول استخدام لميزة مهمة سيظهر تلميح صغير فوق مكانها الحقيقي. جرّبها مرة، وبعدها يختفي التلميح."}</p></div><div className="guidancePreview">{guideStep===0?<><span><BookOpen/> قراءة</span><span><Volume2/> تلاوة</span><span><BookMarked/> حفظ</span></>:guideStep===1?<><span><Compass/> قبلة</span><span><CalendarDays/> ختمة</span><span><Target/> اختبار</span></>:<><span className="guidanceTipDemo"><Sparkles/> تلميحات سياقية</span><span><CircleCheck/> تختفي بعد التعلم</span></>}</div><div className="guidanceActions"><button className="guidancePrimary" onClick={()=>{if(guideStep<2)setGuideStep(v=>v+1);else{localStorage.setItem("noor_guidance_seen","1");setGuideStep(-1)}}}>{guideStep<2?<>التالي <ChevronLeft/></>:<>ابدأ مع نور <CircleCheck/></>}</button>{guideStep>0?<button className="guidanceSecondary" onClick={()=>setGuideStep(v=>Math.max(0,v-1))}>السابق</button>:<button className="guidanceSecondary" onClick={()=>{localStorage.setItem("noor_guidance_seen","1");setGuideStep(-1)}}>تخطي</button>}</div></Glass></Overlay>}
    {flashcardJuzPickerOpen&&<Overlay className="modal juzPickerModal" role="dialog" aria-modal="true" aria-labelledby="juz-picker-title" onClose={()=>setFlashcardJuzPickerOpen(false)}><Glass className="sheet juzPickerSheet" onClick={e=>e.stopPropagation()}><div className="juzPickerHead"><div><small>اختبار البطاقات</small><h2 id="juz-picker-title">اختر الجزء</h2></div><button type="button" className="sheetIconButton" aria-label="إغلاق" onClick={()=>setFlashcardJuzPickerOpen(false)}><X/></button></div><div className="juzPickerGrid" role="listbox" aria-label="أجزاء القرآن">{Array.from({length:30},(_,i)=>i+1).map(n=><button type="button" role="option" aria-selected={flashcardJuz===n} className={`juzPickerOption ${flashcardJuz===n?"selected":""}`} key={n} onClick={()=>{setFlashcardJuz(n);setFlashcardJuzPickerOpen(false)}}><span>الجزء {arNum(n)}</span><span className="juzPickerCheck" aria-hidden="true">{flashcardJuz===n?<Check/>:null}</span></button>)}</div></Glass></Overlay>}

    {repeatOpen&&<Overlay className="modal" aria-label="تكرار التلاوة" onClose={()=>setRepeatOpen(false)}><Glass className="sheet featureSheet"><div className="featureTitle"><h2>التلاوة والمتابعة</h2><button className="sheetIconButton" aria-label="إغلاق التلاوة" onClick={()=>setRepeatOpen(false)}><X/></button></div><RepeatPanel surahs={quran?.surahs||[]} settings={repeatSettings} onSettings={settings=>{sessionRef.current?.cancel();setRepeatSettings(settings)}} state={sessionState} onStart={startRepeat} onPause={()=>sessionRef.current?.pause()} onResume={()=>sessionRef.current?.resume()} onCancel={()=>sessionRef.current?.cancel()} follow={followAudio} onFollow={setFollowAudio}/></Glass></Overlay>}
    {orderOpen&&<Overlay className="modal" aria-label="اختبار ترتيب الآيات" onClose={()=>{setOrderOpen(false);buildReviewSummary("ترتيب الآيات",reviewSessionCorrect,reviewSessionAssisted,reviewSessionCorrect+reviewSessionAssisted)}}><Glass className="sheet featureSheet"><div className="featureTitle"><h2>ترتيب الآيات</h2><button className="sheetIconButton" aria-label="إنهاء ترتيب الآيات" onClick={()=>{setOrderOpen(false);buildReviewSummary("ترتيب الآيات",reviewSessionCorrect,reviewSessionAssisted,reviewSessionCorrect+reviewSessionAssisted)}}><X/></button></div><OrderQuiz verses={reviewVerses} onScore={results=>{setReviewSessionCorrect(n=>n+results.filter(r=>r.correct).length);setReviewSessionAssisted(n=>n+results.filter(r=>!r.correct).length);for(const r of results)updateReviewStrength(r.key,r.correct?8:-8)}}/></Glass></Overlay>}
    {reciterPickerOpen&&<Overlay className="modal reciterModal" aria-label="اختر القارئ" onClose={()=>setReciterPickerOpen(false)}><Glass className="sheet reciterSheet"><div className="reviewSheetHead"><Play/><div><small>تلاوة القرآن</small><h2>اختر القارئ</h2><span className="reciterHoldHint">اضغط مطولًا على اسم الشيخ لتنزيل جميع السور</span></div></div>{["sudais","shuraim","minshawy","ali_jaber","dosari",...customReciters.map(r=>r.id)].map(id=><ReciterChoiceButton key={id} id={id} name={reciterNames[id]} active={id===reciter} onSelect={()=>{++audioRequestRef.current;audioRef.current?.pause();window.Android?.stopDownloadedAyah?.();setReciter(id);localStorage.setItem("noor_reciter",id);setSudaisProgress("");setReciterPickerOpen(false)}} onLongPress={()=>setReciterManageId(id)}/>)}
      <button className="reciterOption addReciterOption" onClick={()=>{setReciterPickerOpen(false);setAddingReciter(true);setCatalogResults([]);setCatalogSearched(false);setCatalogError("")}}><span>＋ إضافة قارئ جديد</span><small>ابحث باسم القارئ فقط</small></button><button className="reciterCancel satinSecondary" onClick={()=>setReciterPickerOpen(false)}>إغلاق</button></Glass></Overlay>}
    {addingReciter&&<Overlay className="modal reciterModal" aria-label="إضافة قارئ جديد" onClose={()=>{if(!catalogAdding)setAddingReciter(false)}}><Glass className="sheet reciterSheet addReciterSheet">
      <button className="sheetIconButton closeSheet" aria-label="إغلاق إضافة القارئ" disabled={Boolean(catalogAdding)} onClick={()=>setAddingReciter(false)}><X/></button><div className="reviewSheetHead"><Search/><div><small>كتالوج التلاوات · آية بآية</small><h2>إضافة قارئ جديد</h2></div></div>
      <form className="customReciterForm" onSubmit={event=>{event.preventDefault();void searchReciter()}}><label><span>اسم القارئ</span><input value={newReciterName} disabled={Boolean(catalogAdding)} onChange={event=>{reciterSearchRequestRef.current++;setNewReciterName(event.target.value);setCatalogSearched(false);setCatalogBusy(false);setCatalogResults([]);setCatalogError("")}} placeholder="مثال: محمود خليل الحصري" autoComplete="off"/></label><button type="submit" className="primaryGlass" disabled={catalogBusy||Boolean(catalogAdding)}><Search/> {catalogBusy?"جاري البحث…":"بحث"}</button></form>
      {catalogError&&<p className="reciterSearchMessage" role="alert">{catalogError}</p>}{catalogSearched&&!catalogResults.length&&<p className="reciterSearchMessage" role="status">لم نجد تلاوة متاحة لهذا القارئ</p>}
      <div className="reciterSearchResults">{Array.from(new Set(catalogResults.map(item=>item.name.replace(/\s*\([^)]*\)\s*/g,"").trim()))).map(name=>{
        const variants=catalogResults.filter(item=>item.name.replace(/\s*\([^)]*\)\s*/g,"").trim()===name),allAdded=variants.every(isCatalogReciterAdded);
        return <div className="reciterSearchResult glassPanel" key={name}><b>{name}</b><small>تلاوة آية بآية{variants.length>1?` · ${arNum(variants.length)} نسخ متاحة`:""}</small><button className="primaryGlass" disabled={allAdded||Boolean(catalogAdding)} onClick={()=>variants.length>1?setCatalogChoice(variants):void addCatalogReciter(variants[0])}>{allAdded?"مضاف بالفعل":catalogAdding?"جاري التحقق من الصوت…":"إضافة القارئ"}</button></div>;
      })}</div>
      <details className="advancedReciterSource"><summary>إضافة مصدر يدوي · متقدم</summary><div className="customReciterForm"><div className="reciterSourceChoice"><button disabled={!window.Android?.chooseReciterFolder} className={newReciterSource==="folder"?"active":""} onClick={()=>setNewReciterSource("folder")}>مجلد من الهاتف</button><button className={newReciterSource==="url"?"active":""} onClick={()=>setNewReciterSource("url")}>رابط التلاوات</button></div>
        {newReciterSource==="folder"?<><button className="folderPickerButton" disabled={!window.Android?.chooseReciterFolder} onClick={()=>window.Android?.chooseReciterFolder?.()}><LibraryBig/> {newReciterFolder?.label||"اختيار مجلد التلاوات"}</button><small>{newReciterFolder?`تم العثور على ${arNum(newReciterFolder.foundFiles)} ملف آية في ${arNum(newReciterFolder.foundSurahs)} سورة.`:"اختر المجلد الذي يحتوي ملفات الآيات بأسماء 001001.mp3 ونحوها."}</small></>:<><input dir="ltr" value={newReciterUrl} onChange={event=>setNewReciterUrl(event.target.value)} placeholder="https://everyayah.com/data/…"/><small>مصدر عام آية بآية؛ الملفات بأسماء 001001.mp3، 001002.mp3…</small></>}
        <button className="primaryGlass" disabled={Boolean(catalogAdding)} onClick={()=>void addManualReciter()}>إضافة المصدر</button></div></details>
    </Glass></Overlay>}
    {catalogChoice&&<Overlay className="modal reciterModal" aria-label="اختر التلاوة" onClose={()=>{if(!catalogAdding)setCatalogChoice(null)}}><Glass className="sheet reciterSheet"><button className="sheetIconButton closeSheet" aria-label="إغلاق اختيار التلاوة" disabled={Boolean(catalogAdding)} onClick={()=>setCatalogChoice(null)}><X/></button><h2>اختر التلاوة</h2>{catalogChoice.map((item,index)=><div className="reciterSearchResult glassPanel" key={item.identifier}><b>{item.name}</b><small>{item.builtinId?"ضمن قراء نور":"آية بآية"} · النسخة {arNum(index+1)}</small><button className="primaryGlass" disabled={Boolean(catalogAdding)||isCatalogReciterAdded(item)} onClick={()=>void addCatalogReciter(item)}>{isCatalogReciterAdded(item)?"مضاف بالفعل":catalogAdding===item.identifier?"جاري التحقق من الصوت…":"إضافة القارئ"}</button></div>)}{catalogError&&<p className="reciterSearchMessage" role="alert">{catalogError}</p>}</Glass></Overlay>}
    {reciterManageId&&<Overlay className="modal reciterDownloadModal" role="dialog" aria-modal="true" aria-label={`تنزيل تلاوات ${reciterNames[reciterManageId]||"القارئ"}`} onClose={()=>setReciterManageId(null)}><Glass className="sheet reciterDownloadSheet" onClick={e=>e.stopPropagation()}><button className="sheetIconButton closeSheet" aria-label="إغلاق" onClick={()=>setReciterManageId(null)}><X/></button><div className="reviewSheetHead"><Download/><div><small>إدارة التلاوات</small><h2>{reciterNames[reciterManageId]}</h2></div></div><p className="reciterDownloadDescription">نزّل جميع سور القرآن لهذا الشيخ مرة واحدة. عند إعادة المحاولة يتخطى نور الملفات الموجودة ويكمل الباقي.</p><button className="primaryGlass downloadAllReciterButton" onClick={()=>startFullReciterDownload(reciterManageId)} disabled={Boolean(reciterDownloadProgress?.running&&reciterDownloadProgress.reciter===reciterManageId)}><Download/> {reciterDownloadProgress?.running&&reciterDownloadProgress.reciter===reciterManageId?"جاري التنزيل…":"تنزيل كل السور"}</button>{reciterDownloadProgress?.reciter===reciterManageId&&<div className="reciterDownloadStatus" aria-live="polite"><div className="reciterDownloadProgressTrack"><span style={{width:`${reciterDownloadProgress.total?Math.min(100,Math.round(reciterDownloadProgress.done/reciterDownloadProgress.total*100)):0}%`}}/></div><div className="reciterDownloadProgressMeta"><b>{reciterDownloadProgress.total?`${arNum(Math.round(reciterDownloadProgress.done/reciterDownloadProgress.total*100))}٪`:"—"}</b><span>{reciterDownloadProgress.total?`${arNum(reciterDownloadProgress.done)} / ${arNum(reciterDownloadProgress.total)}`:""}</span></div><small>{reciterDownloadProgress.message}</small>{reciterDownloadProgress.running&&<button className="satinSecondary reciterDownloadCancel" onClick={cancelReciterDownload}>إيقاف التنزيل</button>}</div>}{customReciters.some(item=>item.id===reciterManageId)&&<button className="removeCustomReciter satinSecondary" disabled={Boolean(reciterDownloadProgress?.running&&reciterDownloadProgress.reciter===reciterManageId)} onClick={()=>removeReciter(reciterManageId)}>حذف القارئ من قائمتي</button>}<button className="reciterCancel satinSecondary" onClick={()=>setReciterManageId(null)}>إغلاق</button></Glass></Overlay>}
    {prayerTimesOpen&&<Overlay className="prayerTimesSheet" role="dialog" aria-modal="true" aria-label="مواقيت الصلاة والإقامة" onClose={()=>setPrayerTimesOpen(false)}><div className="prayerTimesCard glass"><div className="sheetHead"><div><b>مواقيت الصلاة والإقامة</b><small>تُحدّث محليًا كل يوم بعد العشاء</small></div><button aria-label="إغلاق مواقيت الصلاة" onClick={()=>setPrayerTimesOpen(false)}><X/></button></div>{dailyPrayers.length?<div className="prayerTimesList">{dailyPrayers.map((prayer,index)=>prayer.isFriday?<button className="prayerScheduleRow fridayPrayer khutbahRow" key={`${prayer.name}-${index}`} onClick={()=>khutbah?.status==="official"&&setKhutbahDetailsOpen(true)}><span>{prayer.name}<small>الجمعة القادمة</small></span><div><small>بداية الخطبة</small><b>{new Intl.DateTimeFormat("ar-SA",{hour:"numeric",minute:"2-digit"}).format(new Date(prayer.adhanAt))}</b></div><div className="khutbahTitle"><small>موضوع الخطبة</small><b>{khutbah?.status==="official"?khutbah.khutbahTitle:"لم يُعلن موضوع محدد بعد"}</b></div></button>:<div className="prayerScheduleRow" key={`${prayer.name}-${index}`}><span>{prayer.name}</span><div><small>الأذان</small><b>{new Intl.DateTimeFormat("ar-SA",{hour:"numeric",minute:"2-digit"}).format(new Date(prayer.adhanAt))}</b></div><div><small>الإقامة</small><b>{new Intl.DateTimeFormat("ar-SA",{hour:"numeric",minute:"2-digit"}).format(new Date(prayer.iqamaAt))}</b></div></div>)}</div>:<p className="prayerEmpty">فعّل الموقع من إعدادات الإقامة لعرض المواقيت الدقيقة.</p>}<div className="sheetActions"><button onClick={openIqamaShortcut}>إعدادات التنبيه</button><button onClick={()=>{saveIqamaSchedule();void loadKhutbah();openPrayerTimes()}}>تحديث الآن</button></div></div></Overlay>}
    {khutbahDetailsOpen&&khutbah?.status==="official"&&<Overlay className="modal" role="dialog" aria-modal="true" aria-label="موضوع خطبة الجمعة القادمة" onClose={()=>setKhutbahDetailsOpen(false)}><Glass className="sheet khutbahSheet" onClick={e=>e.stopPropagation()}><button className="sheetIconButton closeSheet" aria-label="إغلاق" onClick={()=>setKhutbahDetailsOpen(false)}><X/></button><small>موضوع خطبة الجمعة القادمة</small><h2>{khutbah.khutbahTitle}</h2>{khutbah.khutbahSummary&&<p>{khutbah.khutbahSummary}</p>}<small>الجمعة: {khutbah.targetFridayDate}<br/>المصدر: {khutbah.sourceName}</small><a className="primaryGlass khutbahSource" href={khutbah.sourceUrl} target="_blank" rel="noreferrer">عرض المصدر الرسمي</a></Glass></Overlay>}
    {iqamaReminder&&<Overlay className="iqamaInApp" role="dialog" aria-modal="true" aria-label={`تذكير إقامة صلاة ${iqamaReminder.prayer}`}>
      <div className="iqamaInAppCard glass">
        <small>نور · تذكير الصلاة</small>
        <h2>إقامة صلاة {iqamaReminder.prayer} بعد</h2>
        <strong>{`${String(Math.floor(Math.max(0,iqamaReminder.iqamaAt-iqamaNow)/60000)).padStart(2,"0")}:${String(Math.ceil(Math.max(0,iqamaReminder.iqamaAt-iqamaNow)/1000)%60).padStart(2,"0")}`}</strong>
        <button type="button" onClick={()=>setIqamaReminder(null)}>تم</button>
      </div>
    </Overlay>}

    {flashcardActive&&flashcardVerse&&flashcardParts&&<Overlay className="modal reviewModal" role="dialog" aria-modal="true" aria-label="اختبار بطاقات الحفظ" onClose={finishFlashcards}><Glass className="sheet reviewSheet" onClick={e=>e.stopPropagation()}><button className="sheetIconButton closeSheet" aria-label="إنهاء الاختبار" onClick={finishFlashcards}><X/></button><div className="reviewSheetHead"><Target/><div><small>اختبار عشوائي من {flashcardScopeLabel} · {arNum(flashcardQuestionNumber)}/{arNum(flashcardQuestionLimit)}</small><h2>أكمل الآية</h2></div></div><div className="flashcardPrompt"><small>سورة {flashcardVerse.surahName} · الآية {arNum(flashcardVerse.number)}</small><p>{flashcardParts.prompt} <span>…</span></p></div>{flashcardRevealed?<><div className="flashcardAnswer"><small>التكملة الصحيحة</small><p>{flashcardParts.answer}</p></div><div className="gradeActions"><button className="knew" onClick={()=>gradeFlashcard(true)}><CircleCheck/> أكملتها قبل الكشف</button><button className="neededHelp" onClick={()=>gradeFlashcard(false)}><CircleHelp/> احتجت مساعدة</button></div></>:<button className="primaryGlass revealCard" onClick={()=>setFlashcardRevealed(true)}><Eye/> إظهار التكملة الصحيحة</button>}<div className="sessionMini"><span>صحيح {arNum(reviewSessionCorrect)}</span><span>مساعدة {arNum(reviewSessionAssisted)}</span></div></Glass></Overlay>}

    {recitationActive&&<Overlay className="modal reviewModal" role="dialog" aria-modal="true" aria-label="التسميع الذكي التجريبي" onClose={finishRecitation}><Glass className="sheet reviewSheet recitationSheet" onClick={e=>e.stopPropagation()}><button className="sheetIconButton closeSheet" aria-label="إنهاء التسميع" onClick={finishRecitation}><X/></button><div className="reviewSheetHead"><Mic/><div><small>ميزة تجريبية · BETA</small><h2>التسميع الذكي</h2></div></div><p className="recitationIntro">اقرأ آية كاملة من النطاق المحدد. نور يطابق الكلام مع نص القرآن المحلي، ولا يعتبر النتيجة حكمًا على التجويد.</p><button className={`recitationMic ${voiceListening?"listening":""}`} onClick={()=>startVoiceListening("recitation")}>{voiceListening?<span className="voicePulse large"/>:<Mic/>}<b>{voiceListening?(voiceStatus||"أستمع الآن…"):"ابدأ الاستماع"}</b></button>{recitationText&&<div className="heardText glassPanel"><small>ما تم التعرف عليه</small><p>{recitationText}</p></div>}{recitationResult&&<div className="recitationResult glassPanel">{recitationResult}</div>}<div className="sessionMini"><span>مطابقة جيدة {arNum(reviewSessionCorrect)}</span><span>تحتاج إعادة {arNum(reviewSessionAssisted)}</span></div><button className="primaryGlass" onClick={finishRecitation}>إنهاء وعرض الملخص</button></Glass></Overlay>}

    {reviewSummary&&<Overlay className="modal reviewModal" role="dialog" aria-modal="true" aria-label="ملخص جلسة المراجعة" onClose={()=>setReviewSummary(null)}><Glass className="sheet reviewSummarySheet" onClick={e=>e.stopPropagation()}><button className="sheetIconButton closeSheet" aria-label="إغلاق" onClick={()=>setReviewSummary(null)}><X/></button><div className="summaryHero"><Trophy/><small>{reviewSummary.mode}</small><strong>{arNum(reviewSummary.score)}٪</strong><span>نتيجة الجلسة</span></div><div className="summaryGrid"><div><b>{arNum(reviewSummary.total)}</b><small>موضع/محاولة</small></div><div><b>{arNum(reviewSummary.correct)}</b><small>صحيح</small></div><div><b>{arNum(reviewSummary.assisted)}</b><small>بمساعدة</small></div><div><b>{arNum(reviewSummary.minutes)}</b><small>دقيقة</small></div></div><p>تم تحديث خريطة قوة الحفظ لهذه الجلسة تلقائيًا.</p><button className="primaryGlass" onClick={()=>setReviewSummary(null)}>تم</button></Glass></Overlay>}

    {thinking&&<div className="thinkingOverlay" role="status" aria-live="polite">
      <Glass className="thinkingCard">
        <div className="thinkingMark"><span/><span/><span/></div>
        <h3>{thinkingStage}</h3>
        <p>نور يتحقق من الإنترنت قبل عرض الإجابة.</p>
      </Glass>
    </div>}

    {!focusMode&&<nav className={`nav glass nav-${tab}`}>
      <span className="liquidSelection" aria-hidden="true"/>
      <button className={tab==="home"?"active":""} onClick={()=>setTab("home")}><Sparkles/><span>اعرف</span></button>
      <button className={tab==="quran"?"active":""} onClick={openQuran}><BookOpen/><span>القرآن</span></button>
      <button className={tab==="saved"?"active":""} onClick={()=>setTab("saved")}><Bookmark/><span>محفوظات</span></button>
      <button className={tab==="settings"?"active":""} onClick={()=>setTab("settings")}><Settings/><span>الإعدادات</span></button>
    </nav>}

    {sources&&<Overlay className="modal" onClose={()=>setSources(false)}>
      <Glass className="sheet" onClick={e=>e.stopPropagation()}><button onClick={()=>setSources(false)}><X/></button><h2>المصادر</h2><p>{answer?.source}</p></Glass>
    </Overlay>}

    {wordAction&&<Overlay className="modal wordModal" onClose={()=>setWordAction(null)}>
      <Glass className="sheet wordChoiceSheet" onClick={e=>e.stopPropagation()}>
        <button className="sheetIconButton closeSheet" aria-label="إغلاق" onClick={()=>setWordAction(null)}><X/></button><small>سورة {wordAction.verse.surahName} · الآية {arNum(wordAction.verse.number)}</small><h2 className="quranTextSurface">{readableQuranPreview(wordAction.text)}</h2>
        <button className="sheetIconButton shareTop" aria-label="مشاركة الآية" onClick={()=>shareVerse(wordAction.verse)}><Share2/></button>
        <div className="wordChoiceActions"><button aria-label={`استماع بصوت ${reciterNames[reciter]}`} onClick={()=>playAyah(wordAction.verse)}><Play/> استماع بصوت {reciterNames[reciter]}</button><button onClick={()=>{const a=wordAction;setWordAction(null);void openWord(a.verse,a.index,a.text)}}><BookOpen/> معنى الكلمة</button><button onClick={()=>void openAsbab(wordAction.verse)}>سبب النزول</button><button onClick={()=>{setQ(`ما الآيات والأحاديث الصحيحة المرتبطة بموضوع الآية ${wordAction.verse.verse_key}؟`);setVerseContext(wordAction.verse);setWordAction(null);setTab("home")}}>آيات وأحاديث مرتبطة</button><button onClick={()=>shareVerse(wordAction.verse)}><Share2/> مشاركة نص</button><button onClick={()=>void shareVerseImage(wordAction.verse)}><ImageIcon/> مشاركة كصورة</button></div>
      </Glass>
    </Overlay>}

    {wordInfo&&<Overlay className="modal wordModal" onClose={()=>setWordInfo(null)}>
      <Glass className="sheet wordSheet" onClick={e=>e.stopPropagation()}>
        <button className="sheetIconButton closeSheet" aria-label="إغلاق" onClick={()=>setWordInfo(null)}><X/></button>
        <small>ضغط مطول · {wordInfo.verseKey}</small>
        <h2 className="quranTextSurface">{wordInfo.text}</h2>
        {wordInfo.root&&<div className="rootBadge">الجذر: {wordInfo.root}</div>}
        <h3 className="wordSectionTitle">المعنى في هذه الآية</h3>
        <ExpandableText text={wordInfo.contextMeaning||""}/>
        {wordInfo.lexicalMeaning&&<details className="lexicalDetails"><summary>المعنى المعجمي للجذر</summary><ExpandableText text={wordInfo.lexicalMeaning} className="lexicalDefinition"/></details>}
        {wordInfo.english&&<details><summary>مرجع لغوي إضافي</summary><p>{wordInfo.english}</p></details>}
        <small>المصدر: {wordInfo.source}</small>
      </Glass>
    </Overlay>}

    {asbabDetail&&<Overlay className="modal wordModal" onClose={()=>setAsbabDetail(null)}>
      <Glass className="sheet asbabSheet" onClick={event=>event.stopPropagation()}>
        <button className="sheetIconButton closeSheet" aria-label="إغلاق" onClick={()=>setAsbabDetail(null)}><X/></button>
        <small>سورة {asbabDetail.verse.surahName} · الآية {arNum(asbabDetail.verse.number)}</small>
        <h2>{asbabDetail.contextual?"سياق نزول مرتبط":"سبب النزول"}</h2>
        {asbabDetail.contextual&&<p className="asbabRelation">الرواية الموثقة الآتية مرتبطة بالآية {arNum(asbabDetail.relatedAyah||0)} التالية، وتُعرض لفهم سياق المقطع؛ لا ننسبها إلى الآية {arNum(asbabDetail.verse.number)} نفسها.</p>}
        <div className="asbabNarrations">{asbabDetail.entry.occasions.map((occasion,index)=><article key={index}><ExpandableText text={occasion} className="asbabNarrationText"/>{asbabDetail.entry.sources?.[index]&&<small>المصدر: {asbabDetail.entry.sources[index]}</small>}</article>)}</div>
        <p className="asbabNote">تعرض نور ما ورد في المصادر فقط؛ ليس لكل آية سبب نزول خاص.</p>
      </Glass>
    </Overlay>}

    {surahPicker&&<Overlay className="modal" onClose={()=>setSurahPicker(false)}>
      <Glass className="sheet surahSheet" onClick={e=>e.stopPropagation()}>
        <button type="button" className="sheetIconButton closeSheet" aria-label="إغلاق الانتقال" onClick={event=>{event.stopPropagation();setSurahPicker(false)}}><X/></button>
        <h2>الانتقال</h2><label className="pickerSearch glassInput"><Search/><input value={pickerSearch} onChange={e=>setPickerSearch(e.target.value)} placeholder={pickerTab==="surahs"?"ابحث باسم السورة أو رقمها…":pickerTab==="juz"?"ابحث برقم الجزء…":pickerTab==="hizb"?"ابحث برقم الحزب…":"ابحث برقم الصفحة…"}/>{pickerSearch&&<button aria-label="مسح البحث" onClick={()=>setPickerSearch("")}><X/></button>}</label><div className={`pickerTabs picker-${pickerTab}`} role="tablist"><span className="pickerIndicator" aria-hidden="true"/>{([['surahs','السور'],['juz','الأجزاء'],['hizb','الأحزاب'],['pages','الصفحات']] as const).map(([k,l])=><button role="tab" aria-selected={pickerTab===k} className={pickerTab===k?'active':''} onClick={()=>setPickerTab(k)} key={k}>{l}</button>)}</div>
        <div className="surahList" onPointerDown={beginPickerGesture} onPointerMove={movePickerGesture}>{pickerTab==='surahs'?quran?.surahs.filter(s=>{const q=normalizeArabic(pickerSearch).replace(/سوره|سورة/g,"").trim();return !q||normalizeArabic(s.name_arabic).includes(q)||String(s.number)===q||arNum(s.number)===pickerSearch.trim()}).map(s=><button className="navCard" key={s.number} onClick={()=>{if(pickerWasDragged())return;setSurahPicker(false);const first=s.ayahs[0];if(first)jumpToVerse({...first,surahNumber:s.number,surahName:s.name_arabic},true)}}><span>{arNum(s.number)}</span><b>{s.name_arabic}</b><small>{arNum(s.counts.ayahs)} آية</small></button>):Array.from({length:pickerTab==='juz'?30:pickerTab==='hizb'?60:604},(_,i)=>i+1).filter(n=>{const q=pickerSearch.replace(/[^0-9٠-٩]/g,"");if(!q)return true;const western=q.replace(/[٠-٩]/g,d=>String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));return String(n)===western}).map(n=><button className="navCard" key={n} onClick={()=>{if(pickerWasDragged())return;const v=Array.from(verseByKey.values()).find(v=>pickerTab==='juz'?v.juz===n:pickerTab==='hizb'?v.hizb===n:v.page===n);if(v){setSurahPicker(false);jumpToVerse(v,true)}}}><b>{pickerTab==='juz'?'الجزء':pickerTab==='hizb'?'الحزب':'الصفحة'} {arNum(n)}</b></button>)}</div>
      </Glass>
    </Overlay>}
  </main></OverlayTheme.Provider>;
}

function AyahButton({bookmarked,number,onClick,onLong}:{bookmarked:boolean;number:number;onClick:()=>void;onLong:()=>void}){const t=useRef<number>(0);const fired=useRef(false);return <button className={`ayahNumber ${bookmarked?"bookmarked":""}`} onPointerDown={e=>{e.stopPropagation();fired.current=false;t.current=window.setTimeout(()=>{fired.current=true;onLong()},520)}} onPointerUp={e=>{e.stopPropagation();clearTimeout(t.current);if(!fired.current)onClick()}} onPointerCancel={()=>clearTimeout(t.current)} onContextMenu={e=>e.preventDefault()}><span>{arNum(number)}</span></button>}

function WordSpan({text,onLong,onDouble}:{text:string;onLong:()=>void;onDouble:()=>void}){
  const timer=useRef<number>(0);
  const origin=useRef<{x:number;y:number}|null>(null);
  const lastTap=useRef<{time:number;x:number;y:number}|null>(null);
  const lastTouchPlay=useRef(0);
  const longPressed=useRef(false);
  const start=(e:React.PointerEvent<HTMLSpanElement>)=>{
    origin.current={x:e.clientX,y:e.clientY};
    longPressed.current=false;
    clearTimeout(timer.current);
    timer.current=window.setTimeout(()=>{longPressed.current=true;lastTap.current=null;onLong(); if(navigator.vibrate)navigator.vibrate(18);},520);
  };
  const move=(e:React.PointerEvent<HTMLSpanElement>)=>{
    if(!origin.current)return;
    if(Math.hypot(e.clientX-origin.current.x,e.clientY-origin.current.y)>9){
      clearTimeout(timer.current); origin.current=null;
    }
  };
  const stop=()=>{clearTimeout(timer.current);origin.current=null};
  const finish=(e:React.PointerEvent<HTMLSpanElement>)=>{
    const tapped=!!origin.current&&!longPressed.current;
    stop();
    if(e.pointerType==="mouse"||!tapped)return;
    const previous=lastTap.current,now=Date.now();
    if(previous&&now-previous.time<380&&Math.hypot(e.clientX-previous.x,e.clientY-previous.y)<28){lastTap.current=null;lastTouchPlay.current=now;onDouble()}
    else lastTap.current={time:now,x:e.clientX,y:e.clientY};
  };
  return <span className="qWord" role="button" aria-label={`إجراءات الكلمة ${text}`} onDoubleClick={e=>{e.preventDefault();if(Date.now()-lastTouchPlay.current>600)onDouble()}} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onLong()}}} onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={stop} onPointerLeave={stop} onContextMenu={e=>{e.preventDefault();stop();onLong()}}>{text}</span>;
}

const rootElement=document.getElementById("root");
if(rootElement)createRoot(rootElement).render(<App/>);
