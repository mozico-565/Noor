import React,{useLayoutEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import data from "./mushafMarksData.json";

export const sajdaRanges=new Map(data.sajdas.map(mark=>[mark.verseKey,mark]));
const sajdaMargins=new Map(data.sajdas.map(mark=>[mark.marginVerseKey,mark]));
const divisions=new Map(data.quarters.map(mark=>[mark.verseKey,mark]));
const arabic=(n:number)=>String(n).replace(/\d/g,d=>"٠١٢٣٤٥٦٧٨٩"[Number(d)]);
export function divisionLabel(verseKey:string){
  const mark=divisions.get(verseKey);
  if(!mark)return null;
  const quarter=(mark.quarter-1)%4;
  if(quarter===0)return `${(mark.quarter-1)%8===0?`الجزء ${arabic(mark.juz)} · `:""}الحزب ${arabic(mark.hizb)}`;
  return `${["","ربع","نصف","ثلاثة أرباع"][quarter]} الحزب ${arabic(mark.hizb)}`;
}
export function MushafMargin({verseKey,kind}:{verseKey:string;kind:"division"|"sajda"}){
  const label=kind==="division"?divisionLabel(verseKey):sajdaMargins.has(verseKey)?"سجدة":null;
  return label?<span className={`mushafInlineMark ${kind}`} data-mark={`${kind}-${verseKey}`} aria-label={label} title={label}>{kind==="division"?"۞":"۩"}</span>:null;
}

type LetterAnchor={letter:number;fraction:number};
type Stroke={left:number;top:number;width:number};
// DOM Range measures the already-shaped text. No span splits an Arabic letter
// or ligature; changing the font, width or zoom recomputes these coordinates.
export function letterBoundary(node:Text,anchor:LetterAnchor){
  const letters=Array.from(node.data.matchAll(/\p{Lo}/gu));
  const letter=letters[anchor.letter];
  if(!letter)return null;
  const range=document.createRange();
  range.setStart(node,letter.index!);range.setEnd(node,letters[anchor.letter+1]?.index??node.length);
  const rect=range.getBoundingClientRect();
  return {x:rect.left+rect.width*anchor.fraction,rect};
}
function SajdaPhrase({verseKey,children}:{verseKey:string;children:React.ReactNode}){
  const mark=sajdaRanges.get(verseKey)!;
  const ref=useRef<HTMLSpanElement>(null);
  const [surface,setSurface]=useState<HTMLElement|null>(null);
  const [strokes,setStrokes]=useState<Stroke[]>([]);
  useLayoutEffect(()=>{
    const phrase=ref.current,text=phrase?.closest<HTMLElement>(".mushafText");
    if(!phrase||!text)return;
    setSurface(text);
    let disposed=false,frame=0;
    const layout=()=>{
      if(disposed)return;
      const words=Array.from(phrase.querySelectorAll<HTMLElement>(".sajdaWord"));
      const measured=words.map(word=>{
        const walker=document.createTreeWalker(word,NodeFilter.SHOW_TEXT);
        const node=walker.nextNode() as Text|null;
        if(!node)return null;
        const range=document.createRange();range.selectNodeContents(node);
        return {node,rect:range.getBoundingClientRect()};
      }).filter((word):word is NonNullable<typeof word>=>!!word);
      if(measured.length!==words.length||!measured.length)return;
      const start=letterBoundary(measured[0].node,mark.startAnchor);
      const end=letterBoundary(measured[measured.length-1].node,mark.endAnchor);
      if(!start||!end)return;
      const origin=text.getBoundingClientRect(),scale=origin.width/text.offsetWidth||1;
      const fontSize=parseFloat(getComputedStyle(phrase).fontSize);
      const lines:Array<{left:number;right:number;top:number;first:number;last:number}>=[];
      measured.forEach(({rect},i)=>{
        let line=lines.find(l=>Math.abs(l.top-rect.top)<2*scale);
        if(!line){line={left:rect.left,right:rect.right,top:rect.top,first:i,last:i};lines.push(line);}
        else{line.left=Math.min(line.left,rect.left);line.right=Math.max(line.right,rect.right);line.last=i;}
      });
      const next=lines.map(line=>{
        const right=line.first===0?start.x:line.right;
        const left=line.last===measured.length-1?end.x:line.left;
        return {left:(left-origin.left)/scale-text.clientLeft,top:(line.top-origin.top)/scale-text.clientTop+fontSize*.08,width:Math.max(0,(right-left)/scale)};
      });
      setStrokes(old=>old.length===next.length&&old.every((s,i)=>["left","top","width"].every(k=>Math.abs(s[k as keyof Stroke]-next[i][k as keyof Stroke])<.05))?old:next);
    };
    const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(layout)};
    layout();const observer=typeof ResizeObserver!=="undefined"?new ResizeObserver(schedule):null;
    observer?.observe(text);document.fonts?.ready.then(schedule);document.fonts?.addEventListener("loadingdone",schedule);window.addEventListener("resize",schedule);
    return()=>{disposed=true;cancelAnimationFrame(frame);observer?.disconnect();document.fonts?.removeEventListener("loadingdone",schedule);window.removeEventListener("resize",schedule)};
  },[children,mark]);
  return <span ref={ref} className="sajdaPhrase" data-sajda-range={verseKey} data-first-word={mark.firstWord} data-last-word={mark.lastWord}>{children}{surface&&!ref.current?.closest(".reviewHidden")&&createPortal(strokes.map((stroke,i)=><span key={i} data-sajda-stroke={verseKey} className="sajdaStroke" aria-hidden="true" style={stroke}/>),surface)}</span>;
}
export function markedWords<T extends {index:number;text:string}>(verseKey:string,words:T[],render:(word:T,offset:number)=>React.ReactNode){
  const range=sajdaRanges.get(verseKey);
  const spaced=(items:T[],start=0)=>items.map((w,i)=><React.Fragment key={w.index}>{render(w,start+i)}{" "}</React.Fragment>);
  if(!range)return spaced(words);
  const first=words.findIndex(word=>word.index===range.firstWord);
  const last=words.findIndex(word=>word.index===range.lastWord);
  if(first<0||last<first||words.slice(first,last+1).map(w=>w.text).join(" ")!==range.phrase)return spaced(words);
  return <>{spaced(words.slice(0,first))}<SajdaPhrase verseKey={verseKey}>{words.slice(first,last+1).map((w,i)=><React.Fragment key={w.index}><span className="sajdaWord">{render(w,first+i)}</span>{first+i<last?" ":null}</React.Fragment>)}</SajdaPhrase>{" "}{spaced(words.slice(last+1),last+1)}</>;
}
