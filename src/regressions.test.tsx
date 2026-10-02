// @vitest-environment jsdom
import React,{useState} from "react";
import {readFileSync} from "node:fs";
import {afterEach,describe,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {Overlay,OverlayTheme,dismissTopOverlay} from "./Overlay";
import {ExpandableText} from "./ExpandableText";
import {createFlashcardDeck,eligibleFlashcard} from "./flashcards";
import {downloadAudioBatch,matchReciterName,normalizeReciterName,readCustomReciters,reciterAudioUrl,resolveCatalogReciter,searchCatalog,verifyAudioResponse} from "./reciters";
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();localStorage.clear();});
const data=JSON.parse(readFileSync("public/data/quran.json","utf8"));
const all=data.surahs.flatMap((surah:any)=>surah.ayahs.map((ayah:any)=>({...ayah,surah:surah.number})));
describe("unique flashcard sessions from the complete bundled Quran",()=>{
  for(const difficulty of ["easy","medium","hard"] as const)for(const scope of ["all","baqarah","juz","range","between"]){
    it(`${difficulty}: ${scope} samples without replacement even with constant random`,()=>{
      const pool=all.filter((ayah:any)=>eligibleFlashcard(ayah.words.length,difficulty)).filter((ayah:any)=>scope==="all"||scope==="baqarah"&&ayah.surah===2||scope==="juz"&&ayah.juz===2||scope==="range"&&ayah.global_number>=15&&ayah.global_number<=35||scope==="between"&&ayah.global_number>=280&&ayah.global_number<=310);
      const deck=createFlashcardDeck(pool,10,()=>0);
      expect(deck).toHaveLength(Math.min(10,pool.length));expect(new Set(deck.map((ayah:any)=>ayah.verse_key)).size).toBe(deck.length);
      expect(deck.every(ayah=>pool.includes(ayah))).toBe(true);if(scope==="baqarah"&&difficulty==="easy")expect(deck).toHaveLength(10);
    });
  }
  it("stops at a tiny range and ignores duplicate input keys",()=>{
    expect(createFlashcardDeck([all[8],all[8],all[9]],10)).toHaveLength(2);expect(createFlashcardDeck([],10)).toEqual([]);
  });
});
describe("shared body portals and dismissal",()=>{
  it("escapes parent stacking contexts, keeps the theme and blocks lower layers",()=>{
    function Demo(){const [child,setChild]=useState(false);return <OverlayTheme.Provider value={{dark:true,quranFont:"amiri"}}><div id="root" style={{transform:"translateZ(0)",overflow:"hidden",contain:"paint"}}><Overlay aria-label="main"><div className="sheet"><button onClick={()=>setChild(true)}>nested</button></div></Overlay>{child&&<Overlay aria-label="child" onClose={()=>setChild(false)}><div className="sheet"><button>child control</button></div></Overlay>}</div></OverlayTheme.Provider>;}
    render(<Demo/>);const main=screen.getByRole("dialog",{name:"main"});expect(main.closest("#root")).toBeNull();
    expect(main.closest(".noorOverlayTheme")?.classList.contains("dark")).toBe(true);expect(document.getElementById("root")?.hasAttribute("inert")).toBe(true);
    fireEvent.click(screen.getByRole("button",{name:"nested"}));expect(screen.queryByRole("dialog",{name:"main"})).toBeNull();
    fireEvent.keyDown(document,{key:"Escape"});expect(screen.queryByRole("dialog",{name:"child"})).toBeNull();expect(screen.getByRole("dialog",{name:"main"})).toBeTruthy();
  });
  it("keeps every part of the card interactive and ignores the opening long-press release",()=>{
    const close=vi.fn();render(<Overlay onClose={close}><div className="sheet"><span>top</span><span>middle</span><span>bottom</span></div></Overlay>);
    for(const position of ["top","middle","bottom"])for(const event of ["pointerDown","pointerUp","touchStart","touchEnd","click"])(fireEvent as any)[event](screen.getByText(position));
    expect(close).not.toHaveBeenCalled();const backdrop=document.querySelector(".noorBackdrop")!;
    fireEvent.pointerUp(backdrop);fireEvent.click(backdrop,{detail:1});expect(close).not.toHaveBeenCalled();
    fireEvent.pointerDown(backdrop,{clientX:2,clientY:4});fireEvent.pointerUp(backdrop,{clientX:2,clientY:4});fireEvent.click(backdrop);expect(close).toHaveBeenCalledOnce();
  });
  it("routes Android back to the top sheet and removes the root lock on unmount",()=>{
    const close=vi.fn();render(<div id="root"><Overlay onClose={close}><div className="sheet">reader</div></Overlay></div>);
    expect(dismissTopOverlay()).toBe(true);expect(close).toHaveBeenCalledOnce();cleanup();expect(dismissTopOverlay()).toBe(false);
  });
});
describe("complete long explanations",()=>{
  it("measures overflow and preserves the entire final sentence and source",()=>{
    vi.spyOn(HTMLElement.prototype,"scrollHeight","get").mockImplementation(function(this:HTMLElement){return this.classList.contains("explanationPreview")?400:0;});
    vi.spyOn(HTMLElement.prototype,"clientHeight","get").mockReturnValue(120);
    const text="شرح طويل. ".repeat(100)+"هذه الجملة الأخيرة مع مصدرها لا يجوز فقدها.";render(<ExpandableText text={text}/>);
    fireEvent.click(screen.getByRole("button",{name:"المزيد"}));expect(document.querySelector(".explanationFull")?.textContent).toBe(text);
    fireEvent.click(screen.getByRole("button",{name:"أقل"}));expect(document.querySelector(".explanationPreview")?.textContent).toBe(text);
  });
  it("does not show More for a short explanation",()=>{render(<ExpandableText text="شرح قصير كامل."/>);expect(screen.queryByRole("button",{name:"المزيد"})).toBeNull();});
});
describe("catalogue matching, saved readers and resumable audio",()=>{
  it.each([["عبد الرحمن السديس","عبدالرحمن السديس"],["محمد صديق المنشاوى","محمد صديق المنشاوي"],["ياسر الدوسرى","ياسر الدوسري"],[" مَحْمُود   خَلِيل الحُصَرِي ","محمود خليل الحصري"]])("matches %s without altering the official name",(query,name)=>{
    expect(matchReciterName(query,name)).toBeGreaterThan(0);expect(normalizeReciterName(query)).not.toContain("ُ");
    const item={identifier:"ar.husary",name,englishName:"Husary",language:"ar",format:"audio",type:"versebyverse"};
    expect(searchCatalog([item],query)[0].name).toBe(name);expect(matchReciterName("قارئ غير موجود",name)).toBe(0);
  });
  it("preserves complete source metadata and migrates existing folder readers",()=>{
    const rows=[{id:"catalog_ar_husary",name:"محمود خليل الحصري",displayName:"محمود خليل الحصري",provider:"alquran-cloud",sourceType:"url",numbering:"global",baseUrl:"https://cdn.islamic.network/quran/audio/128/ar.husary",moshaf:"تلاوة آية بآية"},{id:"custom_old",name:"قارئ محلي",treeUri:"content://tree"}];
    localStorage.setItem("noor_custom_reciters",JSON.stringify(rows));expect(readCustomReciters()[0]).toMatchObject(rows[0]);expect(readCustomReciters()[1].sourceType).toBe("folder");
    expect(reciterAudioUrl(readCustomReciters()[0],"002001",8)).toBe(rows[0].baseUrl+"/8.mp3");expect(reciterAudioUrl(readCustomReciters()[1],"001001",1)).toBe("");
  });
  it("rejects HTML and never turns an invalid catalogue source into a reader",async()=>{
    await expect(verifyAudioResponse(new Response("<html>"+"bad".repeat(1000)))).rejects.toThrow("audio");
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(JSON.stringify({data:{audio:"https://example.com/1.mp3"}}))));
    await expect(resolveCatalogReciter({identifier:"ar.husary",name:"الحصري",englishName:"Husary",language:"ar",format:"audio",type:"versebyverse"})).rejects.toThrow("audio");
    expect(localStorage.getItem("noor_custom_reciters")).toBeNull();
  });
  it("resumes a batch without downloading saved files and then skips the whole completed batch",async()=>{
    const saved=new Map<string,Response>(),cache={match:vi.fn(async(url:string)=>saved.get(url)?.clone()),put:vi.fn(async(url:string,response:Response)=>{saved.set(url,response.clone());})};
    vi.stubGlobal("caches",{open:vi.fn(async()=>cache)});
    const bytes=new Uint8Array(2048);bytes.set([73,68,51]);const fetcher=vi.fn(async()=>new Response(bytes));vi.stubGlobal("fetch",fetcher);
    const reciter={id:"catalog_ar_husary",name:"الحصري",sourceType:"url" as const,numbering:"global" as const,baseUrl:"https://cdn.islamic.network/quran/audio/128/ar.husary"};
    saved.set(reciter.baseUrl+"/1.mp3",new Response(bytes));const verses=Array.from({length:7},(_,i)=>({id:`00100${i+1}`,globalNumber:i+1})),progress=vi.fn();
    await downloadAudioBatch({reciter,verses,signal:new AbortController().signal,onProgress:progress});expect(fetcher).toHaveBeenCalledTimes(6);expect(saved.size).toBe(7);expect(progress).toHaveBeenLastCalledWith(7,7);
    await downloadAudioBatch({reciter,verses,signal:new AbortController().signal,onProgress:progress});expect(fetcher).toHaveBeenCalledTimes(6);
    const cancelled=new AbortController();cancelled.abort();await expect(downloadAudioBatch({reciter,verses,signal:cancelled.signal,onProgress:progress})).rejects.toThrow();
  });
});
