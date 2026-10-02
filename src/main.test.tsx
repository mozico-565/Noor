// @vitest-environment jsdom
import React from "react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {act,cleanup,fireEvent,render,screen,waitFor,within} from "@testing-library/react";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {App} from "./main";
import {buildQuranSearchIndex,classifyQuranQuery,extractQueryTerm,runLexicalQuery} from "./quranQuery";

const projectRoot=resolve(process.cwd());
const fixtureCache=new Map<string,string>();
const responseCache=new Map<string,string>();

function installRuntimeMocks(){
  Object.defineProperty(navigator,"onLine",{configurable:true,value:false});
  Object.defineProperty(navigator,"vibrate",{configurable:true,value:vi.fn()});
  Object.defineProperty(window,"visualViewport",{configurable:true,value:undefined});
  Object.defineProperty(HTMLElement.prototype,"scrollTo",{configurable:true,value:function(arg:any){
    this.scrollTop=typeof arg==="number"?arg:Number(arg?.top||0);
  }});
  Object.defineProperty(HTMLElement.prototype,"scrollIntoView",{configurable:true,value:vi.fn()});
  vi.stubGlobal("fetch",vi.fn(async(input:RequestInfo|URL)=>{
    const url=String(input);
    const marker="/data/";
    const at=url.indexOf(marker);
    if(at<0)return new Response("",{status:404});
    const relative=url.slice(at+1).split(/[?#]/)[0];
    try{
      let body=fixtureCache.get(relative);
      if(!body){body=await readFile(resolve(projectRoot,"public",relative),"utf8");fixtureCache.set(relative,body)}
      const ready=responseCache.get(relative);
      if(ready)return new Response(ready,{status:200,headers:{"Content-Type":"application/json"}});
      if(relative==="data/quran.json"){
        const parsed=JSON.parse(body);
        parsed.surahs=parsed.surahs.slice(0,3);
        const compact=JSON.stringify(parsed);responseCache.set(relative,compact);
        return new Response(compact,{status:200,headers:{"Content-Type":"application/json"}});
      }
      if(relative==="data/asbab.json"){
        const compact=JSON.stringify(JSON.parse(body).filter((entry:any)=>Number(entry.surah)<=3));
        responseCache.set(relative,compact);
        return new Response(compact,{status:200,headers:{"Content-Type":"application/json"}});
      }
      if(relative==="data/hadith_index.json"||relative==="data/tafsir_search.json")return new Response("[]",{status:200,headers:{"Content-Type":"application/json"}});
      responseCache.set(relative,body);
      return new Response(body,{status:200,headers:{"Content-Type":"application/json"}});
    }catch{return new Response("",{status:404});}
  }));
  class AudioMock{
    static lastSrc="";
    src:string;
    preload="";
    constructor(src:string){this.src=src;AudioMock.lastSrc=src;}
    play(){return Promise.resolve();}
    pause(){}
  }
  vi.stubGlobal("Audio",AudioMock as any);
  return AudioMock;
}

async function waitForQuran(){
  await waitFor(()=>expect(document.querySelectorAll(".continuousSurah").length).toBeGreaterThan(0),{timeout:20000});
}

async function ask(question:string){
  const input=screen.getByPlaceholderText("اعرف عن القرآن…");
  fireEvent.change(input,{target:{value:question}});
  fireEvent.click(input.parentElement!.querySelector("button")!);
  await waitFor(()=>expect(screen.queryByText("نور يراجع المراجع قبل عرض الإجابة.")).toBeNull(),{timeout:20000});
}

describe("Noor end-to-end UI behavior",()=>{
  beforeEach(()=>{localStorage.clear();localStorage.setItem("noor_guidance_seen","1");installRuntimeMocks();});
  afterEach(()=>{cleanup();vi.restoreAllMocks();delete (window as any).Android;});

  it("adds a catalogue reader by name and variant, then restores its selection after remount",async()=>{
    const runtimeFetch=globalThis.fetch,bytes=new Uint8Array(2048);bytes.set([73,68,51]);
    const entries=[{identifier:"ar.husary",name:"محمود خليل الحصري",englishName:"Husary",language:"ar",format:"audio",type:"versebyverse"},{identifier:"ar.husarymujawwad",name:"محمود خليل الحصري (المجود)",englishName:"Husary",language:"ar",format:"audio",type:"versebyverse"}];
    vi.stubGlobal("fetch",vi.fn((input:RequestInfo|URL)=>{
      const url=String(input);
      if(url.includes("/edition?"))return Promise.resolve(new Response(JSON.stringify({data:entries})));
      if(url.endsWith("/ayah/1/ar.husary"))return Promise.resolve(new Response(JSON.stringify({data:{audio:"https://cdn.islamic.network/quran/audio/128/ar.husary/1.mp3"}})));
      if(url.endsWith("ar.husary/1.mp3"))return Promise.resolve(new Response(bytes));
      return runtimeFetch(input);
    }));
    render(<App/>);fireEvent.click(screen.getByRole("button",{name:"الإعدادات"}));fireEvent.click(document.querySelector("button.reciterSettingRow")!);
    fireEvent.click(screen.getByRole("button",{name:/إضافة قارئ جديد/}));fireEvent.change(screen.getByRole("textbox",{name:"اسم القارئ"}),{target:{value:"محمود خليل الحصرى"}});fireEvent.click(screen.getByRole("button",{name:"بحث"}));
    fireEvent.click(await screen.findByRole("button",{name:"إضافة القارئ"}));
    const variants=screen.getByRole("dialog",{name:"اختر التلاوة"});expect(variants.textContent).toContain("المجود");fireEvent.click(within(variants).getAllByRole("button",{name:"إضافة القارئ"})[0]);
    const picker=await screen.findByRole("dialog",{name:"اختر القارئ"});fireEvent.click(within(picker).getByRole("button",{name:/محمود خليل الحصري/}));
    expect(JSON.parse(localStorage.getItem("noor_custom_reciters")!)[0]).toMatchObject({id:"catalog_ar_husary",displayName:"محمود خليل الحصري",provider:"alquran-cloud",edition:"ar.husary",numbering:"global",moshaf:"تلاوة آية بآية"});
    cleanup();render(<App/>);fireEvent.click(screen.getByRole("button",{name:"الإعدادات"}));expect(document.querySelector("button.reciterSettingRow")?.textContent).toContain("محمود خليل الحصري");
  });

  it("does not add a missing reciter and matches the built-in Dosari spelling",async()=>{
    const runtimeFetch=globalThis.fetch;vi.stubGlobal("fetch",vi.fn((input:RequestInfo|URL)=>String(input).includes("/edition?")?Promise.resolve(new Response(JSON.stringify({data:[{identifier:"ar.husary",name:"محمود خليل الحصري",englishName:"Husary",language:"ar",format:"audio",type:"versebyverse"}]}))):runtimeFetch(input)));
    render(<App/>);fireEvent.click(screen.getByRole("button",{name:"الإعدادات"}));fireEvent.click(document.querySelector("button.reciterSettingRow")!);fireEvent.click(screen.getByRole("button",{name:/إضافة قارئ جديد/}));
    const name=screen.getByRole("textbox",{name:"اسم القارئ"});fireEvent.change(name,{target:{value:"قارئ غير موجود"}});fireEvent.click(screen.getByRole("button",{name:"بحث"}));
    expect(await screen.findByText("لم نجد تلاوة متاحة لهذا القارئ")).toBeTruthy();expect(localStorage.getItem("noor_custom_reciters")).toBeNull();
    fireEvent.change(name,{target:{value:"ياسر الدوسرى"}});fireEvent.click(screen.getByRole("button",{name:"بحث"}));expect(await screen.findByRole("button",{name:"مضاف بالفعل"})).toBeTruthy();expect(localStorage.getItem("noor_custom_reciters")).toBeNull();
  });

  it("never repeats Baqarah easy questions with a constant random source",async()=>{
    vi.spyOn(Math,"random").mockReturnValue(0);render(<App/>);
    fireEvent.click(screen.getByRole("button",{name:"محفوظات"}));fireEvent.click(screen.getByRole("button",{name:"سهل"}));
    fireEvent.click(screen.getByRole("button",{name:"سورة معينة"}));fireEvent.click(screen.getByRole("combobox",{name:"السورة"}));
    fireEvent.click(await screen.findByRole("option",{name:"البقرة"}));fireEvent.click(screen.getByRole("button",{name:/اختبار البطاقات/}));
    const seen=new Set<string>();
    for(let i=0;i<10;i++){
      const dialog=await screen.findByRole("dialog",{name:"اختبار بطاقات الحفظ"}),question=dialog.querySelector(".flashcardPrompt small")!.textContent!;
      expect(seen.has(question)).toBe(false);seen.add(question);
      fireEvent.click(screen.getByRole("button",{name:"إظهار التكملة الصحيحة"}));expect(dialog.querySelector(".flashcardAnswer p")!.textContent!.trim().length).toBeGreaterThan(0);
      fireEvent.click(screen.getByRole("button",{name:"أكملتها قبل الكشف"}));
    }
    expect(seen.size).toBe(10);expect(await screen.findByRole("dialog",{name:"ملخص جلسة المراجعة"})).toBeTruthy();
  });

  it("reduces a one-ayah range and explicitly explains the question limit",async()=>{
    render(<App/>);fireEvent.click(screen.getByRole("button",{name:"محفوظات"}));fireEvent.click(screen.getByRole("button",{name:"سهل"}));
    fireEvent.click(screen.getByRole("button",{name:"نطاق آيات مخصص"}));fireEvent.click(screen.getAllByRole("combobox",{name:"آية النهاية"}).at(-1)!);
    fireEvent.click(await screen.findByRole("option",{name:"١"}));fireEvent.click(screen.getByRole("button",{name:/اختبار البطاقات/}));
    const dialog=await screen.findByRole("dialog",{name:"اختبار بطاقات الحفظ"});expect(dialog.textContent).toContain("١/١");expect(screen.getByRole("status").textContent).toContain("دون تكرار");
    fireEvent.click(screen.getByRole("button",{name:"إظهار التكملة الصحيحة"}));fireEvent.click(screen.getByRole("button",{name:"أكملتها قبل الكشف"}));
    expect(screen.queryByRole("dialog",{name:"اختبار بطاقات الحفظ"})).toBeNull();
  });

  it("restores an added reader and routes real global numbering and every Quran ID to the Android bridge",async()=>{
    const full=await readFile(resolve(projectRoot,"public/data/quran.json"),"utf8"),runtimeFetch=globalThis.fetch;
    vi.stubGlobal("fetch",vi.fn((input:RequestInfo|URL)=>String(input).endsWith("data/quran.json")?Promise.resolve(new Response(full)):runtimeFetch(input)));
    const reader={id:"catalog_ar_husary",name:"محمود خليل الحصري",displayName:"محمود خليل الحصري",provider:"alquran-cloud",edition:"ar.husary",baseUrl:"https://cdn.islamic.network/quran/audio/128/ar.husary",numbering:"global",sourceType:"url",moshaf:"تلاوة آية بآية"};
    localStorage.setItem("noor_custom_reciters",JSON.stringify([reader]));localStorage.setItem("noor_reciter",reader.id);
    const download=vi.fn((_id:string,_csv:string)=>true),play=vi.fn(()=>true),save=vi.fn(()=>true),remove=vi.fn();
    window.Android={saveReaderPage:vi.fn(),getReaderPage:()=>1,saveOnlineReciter:save,downloadReciter:download,playReciterAyah:play,removeCustomReciter:remove};
    render(<App/>);fireEvent.click(screen.getByRole("button",{name:"القرآن"}));await waitForQuran();
    const word=document.querySelector<HTMLElement>('.continuousSurah .qWord')!;
    fireEvent.doubleClick(word);await waitFor(()=>expect(play).toHaveBeenCalledWith(reader.id,"001001"));
    fireEvent.click(screen.getByRole("button",{name:"الإعدادات"}));
    const trigger=document.querySelector<HTMLButtonElement>("button.reciterSettingRow")!;expect(trigger.textContent).toContain(reader.name);fireEvent.click(trigger);
    const choice=within(screen.getByRole("dialog",{name:"اختر القارئ"})).getByRole("button",{name:/محمود خليل الحصري/});fireEvent.pointerDown(choice,{button:0});
    await waitFor(()=>expect(screen.getByRole("dialog",{name:/تنزيل تلاوات محمود/})).toBeTruthy(),{timeout:2000});
    fireEvent.pointerUp(choice);fireEvent.click(screen.getByRole("button",{name:"تنزيل كل السور"}));
    const ids=download.mock.calls[0][1].split(",");expect(ids).toHaveLength(6236);expect(new Set(ids).size).toBe(6236);expect(ids[0]).toBe("001001");expect(ids.at(-1)).toBe("114006");
    act(()=>window.noorReciterProgress?.(reader.id,6236,6236,"✓ اكتمل تنزيل التلاوة",false));fireEvent.click(screen.getByRole("button",{name:"حذف القارئ من قائمتي"}));
    expect(remove).toHaveBeenCalledWith(reader.id);expect(JSON.parse(localStorage.getItem("noor_custom_reciters")!)).toEqual([]);
    expect(localStorage.getItem("noor_reciter")).toBe("sudais");
  });

  it("loads the complete continuous Quran, shows loading, separates basmala and supports surah selection",async()=>{
    const full=JSON.parse(await readFile(resolve(projectRoot,"public/data/quran.json"),"utf8"));
    expect(full.surahs).toHaveLength(114);
    expect(full.surahs.reduce((n:number,s:any)=>n+s.ayahs.length,0)).toBe(6236);
    const asbab=JSON.parse(await readFile(resolve(projectRoot,"public/data/asbab.json"),"utf8"));
    expect(asbab.length).toBeGreaterThan(600);
    expect(asbab.some((entry:any)=>entry.sources?.some((source:string)=>source.includes("Quranpedia")))).toBe(true);
    render(<App/>);
    fireEvent.click(screen.getByRole("button",{name:"القرآن"}));
    await waitForQuran();
    expect(screen.queryByText("جاري فتح المصحف…")).toBeNull();
    expect(document.querySelectorAll(".basmalaLine").length).toBeGreaterThan(0);
    expect(document.querySelectorAll(".continuousSurah").length).toBeLessThan(full.surahs.length);
    expect(document.querySelector(".virtualQuran")).toBeTruthy();
    expect(document.querySelectorAll(".continuousViewport")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button",{name:/اختر السورة/}));
    expect(screen.getByText("البقرة")).toBeTruthy();
    fireEvent.click(screen.getByText("البقرة"));
    expect(document.getElementById("surah-2")).toBeTruthy();
  });

  it("follows live native system theme, preserves manual overrides and exposes the auto-scroll range",async()=>{
    let systemDark=false;
    const setThemeMode=vi.fn();
    const setSystemBarsDark=vi.fn();
    (window as any).Android={isSystemDarkMode:()=>systemDark,setThemeMode,setSystemBarsDark};
    render(<App/>);
    fireEvent.click(screen.getByRole("button",{name:"الإعدادات"}));
    fireEvent.click(screen.getByRole("button",{name:"داكن"}));
    expect(localStorage.getItem("noor_theme_mode")).toBe("dark");
    expect(localStorage.getItem("noor_theme")).toBe("dark");
    act(()=>window.noorSystemThemeChanged?.(false));
    expect(document.querySelector("main.app")?.classList.contains("dark")).toBe(true);

    fireEvent.click(screen.getByRole("button",{name:"فاتح"}));
    act(()=>window.noorSystemThemeChanged?.(true));
    expect(document.querySelector("main.app")?.classList.contains("dark")).toBe(false);

    fireEvent.click(screen.getByRole("button",{name:"حسب الهاتف"}));
    systemDark=true;
    act(()=>window.noorSystemThemeChanged?.(true));
    expect(document.querySelector("main.app")?.classList.contains("dark")).toBe(true);
    systemDark=false;
    act(()=>window.noorSystemThemeChanged?.(false));
    expect(document.querySelector("main.app")?.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("noor_theme_mode")).toBe("system");
    expect(setThemeMode).toHaveBeenCalledWith("system");

    fireEvent.click(screen.getByRole("button",{name:"داكن"}));
    cleanup();
    render(<App/>);
    expect(document.querySelector("main.app")?.classList.contains("dark")).toBe(true);
    fireEvent.click(screen.getByRole("button",{name:"القرآن"}));
    await waitForQuran();
    const slider=screen.getByRole("slider",{name:"سرعة التمرير"}) as HTMLInputElement;
    expect([slider.min,slider.max]).toEqual(["1","6"]);
    fireEvent.input(slider,{target:{value:"1"}});
    expect(slider.value).toBe("1");
    expect(localStorage.getItem("noor_auto_scroll_speed")).toBe("1");
    fireEvent.input(slider,{target:{value:"6"}});
    expect(slider.value).toBe("6");
    expect(localStorage.getItem("noor_auto_scroll_speed")).toBe("6");
    expect(document.querySelectorAll(".autoScrollControls button")).toHaveLength(1);
  });

  it("opens the long-press word actions and creates the real Sudais audio URL",async()=>{
    const AudioMock=installRuntimeMocks();
    render(<App/>);
    fireEvent.click(screen.getByRole("button",{name:"القرآن"}));
    await waitForQuran();
    const word=document.querySelector(".qWord") as HTMLElement;
    fireEvent.contextMenu(word);
    const play=await screen.findByRole("button",{name:/عبدالرحمن السديس/},{timeout:5000});
    fireEvent.click(play);
    expect(AudioMock.lastSrc).toMatch(/^https:\/\/everyayah\.com\/data\/Abdurrahmaan_As-Sudais_192kbps\/\d{6}\.mp3$/);
    fireEvent.click(screen.getByRole("button",{name:"سبب النزول"}));
    await waitFor(()=>expect(screen.getByText(/تعرض نور ما ورد في المصادر فقط/)).toBeTruthy());
    expect(screen.getAllByText(/المصدر:/).length).toBeGreaterThan(0);
  });

  it("keeps large Quran answer cards on normal WebView paint flow and auto-caches streamed reciter ayahs",async()=>{
    const css=await readFile(resolve(projectRoot,"src/styles.css"),"utf8");
    expect(css).toContain(".answerResults>div>.quranResult{content-visibility:visible!important");
    expect(css).not.toContain(".answerResults>div>.quranResult{content-visibility:auto");
    const android=await readFile(resolve(projectRoot,"android/app/src/main/java/com/noor/quran/MainActivity.java"),"utf8");
    expect(android).toContain("cacheReciterAyahInBackground");
    expect(android).toContain(".autocache.part");
  });

  it("plays a touchscreen double tap through Android while a download is active",async()=>{
    const playReciterAyah=vi.fn(()=>true);
    (window as any).Android={playReciterAyah,stopDownloadedAyah:vi.fn()};
    render(<App/>);
    fireEvent.click(screen.getByRole("button",{name:"القرآن"}));
    await waitForQuran();
    const word=document.querySelector(".qWord") as HTMLElement;
    for(let i=0;i<2;i++){
      for(const eventName of ["pointerdown","pointerup"]){
        const event=new MouseEvent(eventName,{bubbles:true,clientX:80,clientY:120});
        Object.defineProperty(event,"pointerType",{value:"touch"});
        fireEvent(word,event);
      }
    }
    expect(playReciterAyah).toHaveBeenCalledTimes(1);
    expect(playReciterAyah).toHaveBeenCalledWith("sudais",expect.stringMatching(/^\d{6}$/));
  });

  it("saves and restores the exact continuous reading position",async()=>{
    render(<App/>);
    fireEvent.click(screen.getByRole("button",{name:"القرآن"}));
    await waitForQuran();
    await new Promise(resolve=>setTimeout(resolve,50));
    const viewport=document.querySelector(".continuousViewport") as HTMLElement;
    viewport.scrollTop=1379;
    fireEvent.scroll(viewport);
    await waitFor(()=>expect(localStorage.getItem("noor_reader_continuous_scroll")).toBe("1379"));
    cleanup();
    render(<App/>);
    await waitForQuran();
    await waitFor(()=>expect((document.querySelector(".continuousViewport") as HTMLElement).scrollTop).toBe(1379));
  });

  it("keeps the mounted Quran reader alive between tabs",async()=>{
    render(<App/>);
    fireEvent.click(screen.getByRole("button",{name:"القرآن"}));
    await waitForQuran();
    const viewport=document.querySelector(".continuousViewport") as HTMLElement;
    viewport.scrollTop=944;
    fireEvent.click(screen.getByRole("button",{name:"الإعدادات"}));
    expect(document.querySelector(".continuousViewport")).toBe(viewport);
    expect(document.querySelector("main.app")?.getAttribute("data-tab")).toBe("settings");
    fireEvent.click(screen.getByRole("button",{name:"القرآن"}));
    expect(document.querySelector(".continuousViewport")).toBe(viewport);
    expect(viewport.scrollTop).toBe(944);
  });

  it("closes Quran navigation reliably and shows an in-app iqama reminder",async()=>{
    render(<App/>);
    fireEvent.click(screen.getByRole("button",{name:"القرآن"}));
    await waitForQuran();
    fireEvent.click(screen.getByRole("button",{name:"اختر السورة أو الجزء أو الصفحة"}));
    const close=screen.getByRole("button",{name:"إغلاق الانتقال"});
    fireEvent.click(close);
    await waitFor(()=>expect(screen.queryByRole("button",{name:"إغلاق الانتقال"})).toBeNull());
    window.noorShowIqama?.("العصر",Date.now()+300000);
    await waitFor(()=>expect(screen.getByRole("dialog",{name:"تذكير إقامة صلاة العصر"})).toBeTruthy());
    fireEvent.click(screen.getByRole("button",{name:"تم"}));
    expect(screen.queryByRole("dialog",{name:"تذكير إقامة صلاة العصر"})).toBeNull();
  });

  it("preserves Uthmani dagger-alif marks and bundles the Quran font",async()=>{
    const full=JSON.parse(await readFile(resolve(projectRoot,"public/data/quran.json"),"utf8"));
    const verse=full.surahs.find((s:any)=>s.number===27).ayahs.find((a:any)=>a.number===19);
    expect(verse.text).toContain("وَٰلِدَىَّ");
    const font=await readFile(resolve(projectRoot,"public/fonts/hafssmart.8.woff2"));
    expect(font.byteLength).toBeGreaterThan(50000);
  });

  it("searches inside the Quran, opens the exact verse and exposes all navigation datasets",async()=>{
    render(<App/>);
    fireEvent.click(screen.getByRole("button",{name:"القرآن"}));
    await waitForQuran();
    const search=screen.getByRole("textbox",{name:"البحث داخل المصحف"});
    fireEvent.change(search,{target:{value:"الحمد"}});
    await waitFor(()=>expect(screen.getAllByText(/سورة الفاتحة · الآية/).length).toBeGreaterThan(0),{timeout:5000});
    document.documentElement.classList.add("keyboard-open");
    fireEvent.click(screen.getAllByText(/سورة الفاتحة · الآية/)[0]);
    await waitFor(()=>expect(document.querySelectorAll(".searchHighlight").length).toBeGreaterThan(0));
    expect(document.documentElement.classList.contains("keyboard-open")).toBe(false);
    expect(screen.getByRole("button",{name:"وضع التركيز"})).toBeTruthy();
    expect(screen.getByRole("button",{name:"محفوظات"})).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:"اختر السورة أو الجزء أو الصفحة"}));
    expect(screen.getAllByRole("tab")).toHaveLength(4);
    fireEvent.click(screen.getByRole("tab",{name:"الأجزاء"}));
    expect(screen.getByRole("button",{name:/الجزء ٣٠/})).toBeTruthy();
    fireEvent.click(screen.getByRole("tab",{name:"الأحزاب"}));
    expect(screen.getByRole("button",{name:/الحزب ٦٠/})).toBeTruthy();
    fireEvent.click(screen.getByRole("tab",{name:"الصفحات"}));
    expect(screen.getByRole("button",{name:/الصفحة ٦٠٤/})).toBeTruthy();
  });

  it("always exits focus mode with its glass button or Android back before leaving the reader",async()=>{
    render(<App/>);
    fireEvent.click(screen.getByRole("button",{name:"القرآن"}));
    await waitForQuran();
    const viewport=document.querySelector(".continuousViewport") as HTMLElement;
    viewport.scrollTop=812;
    fireEvent.click(screen.getByRole("button",{name:"وضع التركيز"}));
    expect(screen.getByRole("button",{name:"الخروج من وضع التركيز"})).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:"الخروج من وضع التركيز"}));
    expect(viewport.scrollTop).toBe(812);
    fireEvent.click(screen.getByRole("button",{name:"وضع التركيز"}));
    expect(window.noorHandleBack?.()).toBe(true);
    await waitFor(()=>expect(screen.queryByRole("button",{name:"الخروج من وضع التركيز"})).toBeNull());
    expect(document.querySelector(".continuousViewport")).toBe(viewport);
    expect(viewport.scrollTop).toBe(812);
  });

  it("keeps the original auto-scroll slider and synchronizes its focus-mode copy",async()=>{
    render(<App/>);
    fireEvent.click(screen.getByRole("button",{name:"القرآن"}));
    await waitForQuran();
    const original=screen.getByRole("slider",{name:"سرعة التمرير"}) as HTMLInputElement;
    fireEvent.click(screen.getByRole("button",{name:"وضع التركيز"}));
    const focus=screen.getByRole("slider",{name:"سرعة التمرير في وضع التركيز"}) as HTMLInputElement;
    expect(original.isConnected).toBe(true);
    expect(focus.closest(".focusScrollControls")).toBeTruthy();
    fireEvent.input(focus,{target:{value:"5"}});
    expect(original.value).toBe("5");
    expect(localStorage.getItem("noor_auto_scroll_speed")).toBe("5");
    const focusButton=focus.closest(".focusScrollControls")!.querySelector("button")!;
    fireEvent.click(focusButton);
    expect(focusButton.getAttribute("aria-label")).toBe("إيقاف التمرير التلقائي");
    fireEvent.click(screen.getByRole("button",{name:"الخروج من وضع التركيز"}));
    expect(screen.queryByRole("slider",{name:"سرعة التمرير في وضع التركيز"})).toBeNull();
    expect(original.value).toBe("5");
  });

  it("creates a cross-surah memorization review and keeps the review exit visible",async()=>{
    render(<App/>);
    fireEvent.click(screen.getByRole("button",{name:"محفوظات"}));
    const fromSurah=await screen.findByRole("combobox",{name:"سورة البداية"});
    fireEvent.click(fromSurah);
    fireEvent.click(await screen.findByRole("option",{name:"البقرة"}));
    fireEvent.click(screen.getByRole("combobox",{name:"آية البداية"}));
    await waitFor(()=>expect(screen.getAllByRole("option")).toHaveLength(286));
    fireEvent.click(screen.getByRole("option",{name:"٢"}));
    fireEvent.click(screen.getByRole("combobox",{name:"سورة النهاية"}));
    fireEvent.click(await screen.findByRole("option",{name:"آل عمران"}));
    fireEvent.click(screen.getByRole("combobox",{name:"آية النهاية"}));
    await waitFor(()=>expect(screen.getAllByRole("option")).toHaveLength(200));
    fireEvent.click(screen.getByRole("option",{name:"٢"}));
    fireEvent.click(screen.getByRole("button",{name:"ابدأ المراجعة"}));
    await waitForQuran();
    expect(screen.getByRole("button",{name:"إنهاء المراجعة"})).toBeTruthy();
    expect(document.querySelectorAll(".reviewHidden").length).toBeGreaterThan(0);
  });

  it("builds flashcards from random Quran verses and reveals only the missing continuation",async()=>{
    vi.spyOn(Math,"random").mockReturnValue(0.72);
    render(<App/>);
    fireEvent.click(screen.getByRole("button",{name:"محفوظات"}));
    const cards=await screen.findByRole("button",{name:/اختبار البطاقات/});
    fireEvent.click(cards);
    const dialog=await screen.findByRole("dialog",{name:"اختبار بطاقات الحفظ"});
    expect(dialog.textContent).toContain("اختبار عشوائي من القرآن كاملًا");
    const prompt=dialog.querySelector(".flashcardPrompt p")?.textContent?.replace("…","").trim()||"";
    expect(prompt.length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button",{name:"إظهار التكملة الصحيحة"}));
    const answer=dialog.querySelector(".flashcardAnswer p")?.textContent?.trim()||"";
    expect(answer.length).toBeGreaterThan(0);
    expect(answer).not.toBe(prompt);
    expect(dialog.textContent).toContain("١/١٠");
  });

  it("offers short easy flashcards and sourced prayer, sleep and daily adhkar",async()=>{
    render(<App/>);
    fireEvent.click(screen.getByRole("button",{name:"محفوظات"}));
    fireEvent.click(screen.getByRole("button",{name:"سهل"}));
    fireEvent.click(await screen.findByRole("button",{name:/اختبار البطاقات/}));
    const dialog=await screen.findByRole("dialog",{name:"اختبار بطاقات الحفظ"});
    fireEvent.click(screen.getByRole("button",{name:"إظهار التكملة الصحيحة"}));
    const words=(dialog.querySelector(".flashcardPrompt p")?.textContent||"").replace("…","").trim()+" "+(dialog.querySelector(".flashcardAnswer p")?.textContent||"");
    expect(words.trim().split(/\s+/).length).toBeLessThanOrEqual(10);
    fireEvent.click(screen.getByRole("button",{name:"إنهاء الاختبار"}));
    fireEvent.click(screen.getByRole("button",{name:"تم"}));
    fireEvent.click(screen.getByRole("button",{name:"اعرف"}));
    fireEvent.click(screen.getByRole("button",{name:/الأذكار/}));
    fireEvent.click(screen.getByRole("button",{name:"بعد الصلاة"}));
    expect(screen.getByText("الاستغفار بعد الصلاة")).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:"النوم"}));
    expect(screen.getByText("عند النوم")).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:"يومية"}));
    expect(screen.getByText("عند الخروج من المنزل")).toBeTruthy();
  });

  it("keeps Quran search text-only while smart recitation uses the microphone",async()=>{
    const startVoiceRecognition=vi.fn();
    (window as any).Android={startVoiceRecognition,stopVoiceRecognition:vi.fn()};
    render(<App/>);
    fireEvent.click(screen.getByRole("button",{name:"القرآن"}));
    await waitForQuran();
    expect(screen.getByRole("textbox",{name:"البحث داخل المصحف"})).toBeTruthy();
    expect(screen.queryByRole("button",{name:"البحث بالصوت عن آية"})).toBeNull();
    expect(startVoiceRecognition).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button",{name:"محفوظات"}));
    fireEvent.click(await screen.findByRole("button",{name:/التسميع الذكي/}));
    fireEvent.click(screen.getByRole("button",{name:"ابدأ الاستماع"}));
    expect(startVoiceRecognition).toHaveBeenCalledTimes(1);
    await act(async()=>{window.noorVoiceSearchResult?.("الحمد لله رب العالمين","")});
    expect(screen.getByRole("dialog",{name:"التسميع الذكي التجريبي"}).textContent).toContain("أقرب آية: سورة الفاتحة");
  });

  it("opens all daily prayer times including Friday and keeps the configurable overlay reminder native",async()=>{
    const now=Date.now();
    localStorage.setItem("noor_iqama_enabled","1");
    (window as any).Android={
      hasPrayerLocation:()=>true,
      getNextPrayerJson:()=>JSON.stringify({name:"الفجر",timeMillis:now+3600000}),
      getDailyPrayerTimesJson:()=>JSON.stringify({prayers:[
        {name:"الفجر",adhanAt:now+3600000,iqamaAt:now+5100000},
        {name:"الجمعة",adhanAt:now+7200000,iqamaAt:now+8400000,isFriday:true}
      ]}),
      getIqamaReminderMinutes:()=>5,
      setIqamaReminderMinutes:vi.fn()
    };
    render(<App/>);
    fireEvent.click(screen.getByRole("button",{name:/الصلاة القادمة الفجر/}));
    const dialog=screen.getByRole("dialog",{name:"مواقيت الصلاة والإقامة"});
    expect(dialog.textContent).toContain("الفجر");
    expect(dialog.textContent).toContain("الجمعة القادمة");
    fireEvent.click(screen.getByRole("button",{name:"إعدادات التنبيه"}));
    const minutes=screen.getByRole("spinbutton",{name:"دقائق التنبيه قبل الإقامة"});
    fireEvent.change(minutes,{target:{value:"8"}});
    expect((window as any).Android.setIqamaReminderMinutes).toHaveBeenCalledWith(8);
  });

  it("uses a system overlay for iqama even while Noor is foreground and honors the selected lead time",async()=>{
    const service=await readFile(resolve(projectRoot,"android/app/src/main/java/com/noor/quran/IqamaOverlayService.java"),"utf8");
    const scheduler=await readFile(resolve(projectRoot,"android/app/src/main/java/com/noor/quran/IqamaScheduler.java"),"utf8");
    expect(service).not.toContain("showIqamaIfForeground");
    expect(service).toContain("TYPE_APPLICATION_OVERLAY");
    expect(service).toContain("reminderMinutes");
    expect(scheduler).toContain("iqama_reminder_minutes");
  });

  it("uses the new identity and opens the existing memorization review from its Satin shortcut",async()=>{
    render(<App/>);
    expect(screen.getByRole("heading",{name:"اعرف عن القرآن"})).toBeTruthy();
    expect(screen.getByPlaceholderText("اعرف عن القرآن…")).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:/مراجعة الحفظ/}));
    expect(document.querySelector("main.app")?.getAttribute("data-tab")).toBe("saved");
    expect(await screen.findByText("اختر بداية ونهاية النطاق. يمكن أن يمتد النطاق بين سورتين.")).toBeTruthy();
  });

  it("answers COUNT from Quran data and opens the exact selected result",async()=>{
    render(<App/>);
    await waitFor(()=>expect(screen.getByPlaceholderText("اعرف عن القرآن…")).toBeTruthy());
    await ask("كم مرة ذُكرت الجنة؟");
    await waitFor(()=>expect(document.querySelectorAll(".quranResult").length).toBeGreaterThan(0),{timeout:20000});
    expect(screen.getByText(/لم تُضم صيغ الجذر أو المرادفات/)).toBeTruthy();
    const first=document.querySelector(".quranResult") as HTMLButtonElement;
    const reference=first.querySelector("b")?.textContent||"";
    fireEvent.click(first);
    await waitFor(()=>expect(document.querySelector("main.app")?.getAttribute("data-tab")).toBe("quran"));
    expect(reference).toMatch(/سورة .+ · الآية/);
  });

  it("ignores legacy page-flip preferences and always opens the continuous reader",async()=>{
    localStorage.setItem("noor_reader_mode","pages");
    localStorage.setItem("noor_reader_page","10");
    render(<App/>);
    fireEvent.click(screen.getByRole("button",{name:"القرآن"}));
    await waitForQuran();
    expect(document.querySelector(".mushafPage")).toBeNull();
    expect(document.querySelector(".continuousViewport")).toBeTruthy();
    expect(document.querySelectorAll(".continuousSurah").length).toBeGreaterThan(0);
    expect(localStorage.getItem("noor_reader_mode")).toBe("continuous");
  });

  it("preserves Uthmani annotation marks in the reader without changing stored Quran text",async()=>{
    const full=JSON.parse(await readFile(resolve(projectRoot,"public/data/quran.json"),"utf8"));
    const ayah10=full.surahs.find((s:any)=>s.number===2).ayahs.find((a:any)=>a.number===10);
    const ayah11=full.surahs.find((s:any)=>s.number===2).ayahs.find((a:any)=>a.number===11);
    expect(ayah10.text).toContain("ۢ");
    expect(ayah10.text).toContain("۟");
    expect(ayah11.text).toContain("۟");
    render(<App/>);
    fireEvent.click(screen.getByRole("button",{name:"القرآن"}));
    await waitForQuran();
    const reader=document.querySelector(".continuousViewport")?.textContent||"";
    expect(reader).toContain("ۢ");
    expect(reader).toContain("۟");
    expect(reader).toContain("يَكْذِبُونَ");
    expect(reader).toContain("تُفْسِدُوا");
  });
  it("uses Noor Satin Glass instead of the native Android/WebView select for Juz flashcards",async()=>{
    render(<App/>);
    fireEvent.click(screen.getByRole("button",{name:"محفوظات"}));
    const juzScope=await screen.findByRole("button",{name:"جزء محدد"});
    fireEvent.click(juzScope);
    const trigger=screen.getByRole("button",{name:/^الجزء /});
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog",{name:"اختر الجزء"})).toBeTruthy();
    const option=screen.getByRole("option",{name:/الجزء ٣٠/});
    fireEvent.click(option);
    expect(screen.queryByRole("dialog",{name:"اختر الجزء"})).toBeNull();
    expect(document.querySelector("select")).toBeNull();
  });

});

describe("local Quran query engine",()=>{
  it.each([
    ["كم مرة ذُكرت الجنة؟","COUNT"],
    ["أين ذُكرت الجنة؟","WHERE"],
    ["ما معنى الصبر؟","MEANING"],
    ["آيات عن الصبر","TOPIC"],
    ["كَمْ مَرَّةً ذُكِرَتِ الجَنَّةُ؟","COUNT"]
  ] as const)("classifies %s as %s",(question,intent)=>{
    expect(classifyQuranQuery(question)).toBe(intent);
  });

  it("extracts the requested lexical term instead of counting the question verb",()=>{
    expect(extractQueryTerm("كم مرة ذُكرت الجنة؟","COUNT")).toBe("الجنه");
    expect(extractQueryTerm("أين ذُكرت الجنة؟","WHERE")).toBe("الجنه");
  });

  it("matches ordinary modern spelling to Uthmani dagger-alif spelling",async()=>{
    const full=JSON.parse(await readFile(resolve(projectRoot,"public/data/quran.json"),"utf8"));
    const verses=full.surahs.flatMap((surah:any)=>surah.ayahs.map((ayah:any)=>({...ayah,surahNumber:surah.number,surahName:surah.name_arabic})));
    const index=buildQuranSearchIndex(verses);
    const modern=runLexicalQuery(index,"الإنسان");
    const uthmani=runLexicalQuery(index,"ٱلْإِنسَٰنُ");
    expect(modern.normalizedCount).toBeGreaterThan(0);
    expect(modern).toEqual(uthmani);
    expect(modern.verses.some((verse:any)=>verse.verse_key==="4:28")).toBe(true);
  });

  it("counts normalized words deterministically and returns every matching location",async()=>{
    const full=JSON.parse(await readFile(resolve(projectRoot,"public/data/quran.json"),"utf8"));
    const verses=full.surahs.flatMap((surah:any)=>surah.ayahs.map((ayah:any)=>({...ayah,surahNumber:surah.number,surahName:surah.name_arabic})));
    const index=buildQuranSearchIndex(verses);
    const first=runLexicalQuery(index,"الجنة");
    const second=runLexicalQuery(index,"الْجَنَّةِ");
    expect(first.normalizedCount).toBeGreaterThan(0);
    expect(second).toEqual(first);
    expect(first.verses.every((verse:any)=>verse.verse_key&&verse.surahName&&verse.number)).toBe(true);
    expect(new Set(first.verses.map((verse:any)=>verse.verse_key)).size).toBe(first.verses.length);
  });

  it("keeps the authoritative Uthmani text intact and free of replacement placeholders",async()=>{
    const full=JSON.parse(await readFile(resolve(projectRoot,"public/data/quran.json"),"utf8"));
    const verses=full.surahs.flatMap((surah:any)=>surah.ayahs);
    const verse=full.surahs.find((surah:any)=>surah.number===24).ayahs.find((ayah:any)=>ayah.number===58);
    expect(verse.text).toContain("۟");
    expect(verses.some((ayah:any)=>/[□�]/.test(ayah.text))).toBe(false);
  });
});
