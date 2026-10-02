import React, {useId, useLayoutEffect, useRef, useState} from "react";

/** Clipping affects the preview only; preserve the complete source in the DOM. */
export function ExpandableText({text,className="wordDefinition"}:{text:string;className?:string}){
  const id=useId(),paragraph=useRef<HTMLParagraphElement>(null);
  const [expanded,setExpanded]=useState(false),[hasMore,setHasMore]=useState(false);
  useLayoutEffect(()=>{setExpanded(false);},[text]);
  useLayoutEffect(()=>{
    let alive=true;
    const measure=()=>{const el=paragraph.current;if(alive&&el&&!expanded)setHasMore(el.scrollHeight>el.clientHeight+1);};
    measure();
    const observer=typeof ResizeObserver!=="undefined"?new ResizeObserver(measure):null;
    if(paragraph.current)observer?.observe(paragraph.current);
    document.fonts?.ready.then(measure);window.addEventListener("resize",measure);
    return()=>{alive=false;observer?.disconnect();window.removeEventListener("resize",measure);};
  },[text,expanded]);
  return <div className="explanationText"><p ref={paragraph} id={id} className={`${className} ${expanded?"explanationFull":"explanationPreview"}`}>{text}</p>
    {hasMore&&<button type="button" className="explanationMore primaryGlass" aria-controls={id} aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>{expanded?"أقل":"المزيد"}</button>}
  </div>;
}
