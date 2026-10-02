import React, {createContext, useContext, useLayoutEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";

export const OverlayTheme = createContext({dark:false, quranFont:"hafs"});
const layers: {host:HTMLElement; close:()=>void}[] = [];
let sequence=0;
let restoreRoot:(()=>void)|undefined;
function syncLayers(){
  for(const layer of layers){
    if(layer===layers.at(-1)){layer.host.removeAttribute("inert");layer.host.removeAttribute("aria-hidden");}
    else{layer.host.setAttribute("inert","");layer.host.setAttribute("aria-hidden","true");}
  }
}
export function dismissTopOverlay(){
  const top=layers.at(-1);
  if(!top)return false;
  top.close();return true;
}

/** Escape the application's paint containment and glass stacking contexts.
 * The backdrop is a sibling of the card, never its dismissal parent. */
export function Overlay({children,className="modal",onClose,...props}:Omit<React.HTMLAttributes<HTMLDivElement>,"onClick">&{onClose?:()=>void}){
  const theme=useContext(OverlayTheme);
  const closeRef=useRef(onClose);closeRef.current=onClose;
  const [host]=useState(()=>document.createElement("div"));
  const pointer=useRef<{id:number;x:number;y:number;ended:boolean}|null>(null);
  useLayoutEffect(()=>{
    host.className="noorOverlayLayer";host.style.zIndex=String(2000+(++sequence));
    const previous=document.activeElement as HTMLElement|null;
    if(!layers.length){
      const root=document.getElementById("root");
      const oldInert=root?.getAttribute("inert"),oldHidden=root?.getAttribute("aria-hidden");
      root?.setAttribute("inert","");root?.setAttribute("aria-hidden","true");
      restoreRoot=()=>{
        if(oldInert==null)root?.removeAttribute("inert");else root?.setAttribute("inert",oldInert);
        if(oldHidden==null)root?.removeAttribute("aria-hidden");else root?.setAttribute("aria-hidden",oldHidden);
      };
    }
    const layer={host,close:()=>closeRef.current?.()};
    layers.push(layer);document.body.append(host);syncLayers();
    const focusable=()=>Array.from(host.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a[href],summary,[tabindex="0"]')).filter(el=>{
      const closed=el.closest("details:not([open])");return !el.closest("[hidden]")&&(!closed||closed.querySelector("summary")===el);
    });
    (focusable()[0]||host.querySelector<HTMLElement>("[role=dialog]"))?.focus();
    const keydown=(event:KeyboardEvent)=>{
      if(layers.at(-1)!==layer)return;
      if(event.key==="Escape"){event.preventDefault();event.stopPropagation();layer.close();}
      if(event.key==="Tab"){
        const items=focusable(),first=items[0],last=items.at(-1);
        if(!first){event.preventDefault();return;}
        if(event.shiftKey&&(document.activeElement===first||!host.contains(document.activeElement))){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&(document.activeElement===last||!host.contains(document.activeElement))){event.preventDefault();first.focus();}
      }
    };
    document.addEventListener("keydown",keydown,true);
    return()=>{
      document.removeEventListener("keydown",keydown,true);layers.splice(layers.indexOf(layer),1);host.remove();syncLayers();
      if(!layers.length){restoreRoot?.();restoreRoot=undefined;}
      if(previous?.isConnected&&(!layers.length||layers.at(-1)?.host.contains(previous)))previous.focus();
    };
  },[host]);
  const stop=(event:React.SyntheticEvent)=>event.stopPropagation();
  return createPortal(<div className={`noorOverlayTheme ${theme.dark?"dark":""} quran-font-${theme.quranFont}`} dir="rtl">
    <div {...props} className={`${className} noorOverlaySurface`} role="dialog" aria-modal="true" tabIndex={-1}
      onClick={stop} onPointerDown={stop} onPointerUp={stop} onTouchStart={stop} onTouchEnd={stop}>
      <div className="noorBackdrop" aria-hidden="true"
        onPointerDown={event=>{stop(event);pointer.current={id:event.pointerId,x:event.clientX,y:event.clientY,ended:false};}}
        onPointerUp={event=>{stop(event);const p=pointer.current;if(p&&p.id===event.pointerId)p.ended=Math.hypot(event.clientX-p.x,event.clientY-p.y)<10;}}
        onPointerCancel={()=>{pointer.current=null;}}
        onClick={event=>{stop(event);if(layers.at(-1)?.host===host&&(event.detail===0||pointer.current?.ended))closeRef.current?.();pointer.current=null;}}/>
      {children}
    </div>
  </div>,host);
}
