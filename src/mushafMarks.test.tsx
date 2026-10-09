// @vitest-environment jsdom
import React from "react";
import {describe,it,expect,vi} from "vitest";
import {render,cleanup} from "@testing-library/react";
import {readFileSync} from "node:fs";
import data from "./mushafMarksData.json";
import {markedWords,divisionLabel,MushafMargin,letterBoundary} from "./mushafMarks";
const quran=JSON.parse(readFileSync("public/data/quran.json","utf8"));
const verses=new Map<string,any>(quran.surahs.flatMap((s:any)=>s.ayahs.map((a:any)=>[a.verse_key,a])));
describe("Medina Hafs marks",()=>{
  it("preserves all 15 checked spans and all word text without relying on sajda end-ayah metadata",()=>{
    expect(data.sajdas).toHaveLength(15);
    expect(new Set(data.sajdas.map(m=>m.marginVerseKey)).size).toBe(15);
    for(const m of data.sajdas){
      const verse=verses.get(m.verseKey);
      expect(verse.page).toBe("datasetPage" in m?m.datasetPage:m.page);
      expect(verses.get(m.marginVerseKey).sajda).toBeTruthy();
      expect(verse.words.slice(m.firstWord-1,m.lastWord).map((w:any)=>w.text).join(" ")).toBe(m.phrase);
      const view=render(<div>{markedWords(m.verseKey,verse.words,w=><span key={w.index}>{w.text}</span>)}</div>);
      expect(view.container.textContent).toBe(verse.words.map((w:any)=>w.text+" ").join(""));
      expect(view.container.querySelector(".sajdaPhrase")?.textContent?.trim()).toBe(m.phrase);
      cleanup();
    }
    expect(data.sajdas.find(m=>m.marginVerseKey==="41:38")?.verseKey).toBe("41:37");
  });
  it("anchors within shaped base letters without counting small Quran vowel letters",()=>{
    const text=document.createTextNode("لَهُۥ");
    const range={setStart:vi.fn(),setEnd:vi.fn(),getBoundingClientRect:()=>({left:100,width:20})};
    const spy=vi.spyOn(document,"createRange").mockReturnValue(range as any);
    expect(letterBoundary(text,{letter:1,fraction:.25})?.x).toBe(105);
    expect(range.setStart).toHaveBeenCalledWith(text,2);
    expect(range.setEnd).toHaveBeenCalledWith(text,text.length);
    expect(letterBoundary(text,{letter:2,fraction:.5})).toBeNull();spy.mockRestore();
    for(const mark of data.sajdas){
      for(const [word,anchor] of [[mark.phrase.split(" ")[0],mark.startAnchor],[mark.phrase.split(" ").at(-1)!,mark.endAnchor]] as const){
        expect(anchor.letter).toBeLessThan(Array.from(word.matchAll(/\p{Lo}/gu)).length);
        expect(anchor.fraction).toBeGreaterThanOrEqual(0);expect(anchor.fraction).toBeLessThanOrEqual(1);
      }
    }
  });
  it("fails closed if word segmentation no longer matches the checked reference",()=>{
    const view=render(<div>{markedWords("7:206",[{index:10,text:"changed"},{index:11,text:"changed"}],w=>w.text)}</div>);
    expect(view.container.querySelector(".sajdaPhrase")).toBeNull();cleanup();
  });
  it("matches every canonical quarter boundary and emits no invented end-of-hizb sign",()=>{
    const starts:Array<string>=[];let prev=0;
    for(const [key,a] of verses){if(a.hizb_quarter!==prev){starts.push(key);prev=a.hizb_quarter;}}
    expect(data.quarters.map(m=>m.verseKey)).toEqual(starts);
    expect(starts).toHaveLength(240);
    expect(data.quarters.filter(m=>(m.quarter-1)%4===0)).toHaveLength(60);
    expect(data.quarters.filter(m=>(m.quarter-1)%8===0)).toHaveLength(30);
    expect(divisionLabel("2:1")).toBeNull();
    expect(divisionLabel("2:142")).toContain("الجزء ٢");
    for(const mark of data.quarters){
      const view=render(<MushafMargin verseKey={mark.verseKey} kind="division"/>);
      expect(view.container.querySelectorAll("[data-mark]")).toHaveLength(1);
      expect(view.container.textContent).not.toContain("نهاية");cleanup();
    }
  });
});
