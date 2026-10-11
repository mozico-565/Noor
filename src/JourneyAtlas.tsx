import React,{useRef,useState} from 'react';
import {MapPin,BookOpen, X} from 'lucide-react';
import {JOURNEY_PLACES,atlasPoint,type JourneyPlace} from './journeyGeography';
import hijaz from './assets/journey/hijaz-atlas-ink.webp';
import makkah from './assets/journey/makkah-atlas-ink.webp';
import {JOURNEY_EVIDENCE} from './journeyEvidence';
export function JourneyAtlas({place,onPlace,onStation,onEvidence}:{place:string;onPlace:(id:string)=>void;onStation:(n:number)=>void;onEvidence:(id:string)=>React.ReactNode}){
 const [region,setRegion]=useState<'hijaz'|'makkah'>('hijaz'),[show,setShow]=useState(false);
 const [view,setView]=useState({scale:1,x:0,y:0}),[drag,setDrag]=useState(false);
 const frame=useRef<HTMLDivElement>(null),points=useRef(new Map<number,{x:number;y:number}>());
 const selected=JOURNEY_PLACES.find(p=>p.id===place)||JOURNEY_PLACES[3];
 function choose(p:JourneyPlace){onPlace(p.id);setRegion(p.region);setShow(true);const point=atlasPoint(p.lon,p.lat,p.region),w=frame.current?.clientWidth||300,h=w*(p.region==='hijaz'?1198/900:703/900),scale=1.25;setView({scale,x:Math.max(-w*(scale-1),Math.min(0,w/2-point.x/100*w*scale)),y:Math.max(-h*(scale-1),Math.min(0,h/2-point.y/100*h*scale))});}
 const pins=region==='hijaz'?JOURNEY_PLACES:JOURNEY_PLACES.filter(p=>p.region==='makkah');
 function constrain(v:typeof view){const r=frame.current?.getBoundingClientRect();if(!r)return v;const scale=Math.max(1,Math.min(3,v.scale));return {scale,x:Math.max(-r.width*(scale-1),Math.min(0,v.x)),y:Math.max(-r.height*(scale-1),Math.min(0,v.y))};}
 function move(e:React.PointerEvent){const old=points.current.get(e.pointerId);if(!old)return;const before=[...points.current.values()];points.current.set(e.pointerId,{x:e.clientX,y:e.clientY});const after=[...points.current.values()];setView(v=>{if(before.length===2){const distance=(p:typeof before)=>Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);const factor=distance(after)/Math.max(1,distance(before));const rect=frame.current!.getBoundingClientRect();const cx=(before[0].x+before[1].x)/2-rect.left,cy=(before[0].y+before[1].y)/2-rect.top;return constrain({scale:v.scale*factor,x:cx-(cx-v.x)*factor,y:cy-(cy-v.y)*factor});}return constrain({...v,x:v.x+e.clientX-old.x,y:v.y+e.clientY-old.y});});}
 return <section className="journeyMapPage historicalAtlas">
  <div className="journeyPlaceChoices atlasChips" aria-label="اختر موقعًا">{JOURNEY_PLACES.map(p=><button key={p.id} aria-pressed={place===p.id&&show} onClick={()=>choose(p)}>{p.title}</button>)}</div>
  <div className="atlasLegend"><b>شمال ↑</b><button onClick={()=>{setRegion('hijaz');setView({scale:1,x:0,y:0});setShow(false)}}>عرض جميع المواقع</button></div>
  <div className="historicalViewport" ref={frame} onPointerDown={e=>{if((e.target as HTMLElement).closest('button'))return;setDrag(true);e.currentTarget.setPointerCapture(e.pointerId);points.current.set(e.pointerId,{x:e.clientX,y:e.clientY})}} onPointerMove={move} onPointerUp={e=>{points.current.delete(e.pointerId);setDrag(points.current.size>0)}} onPointerCancel={e=>{points.current.delete(e.pointerId);setDrag(points.current.size>0)}}>
   <div className={`historicalMap ${region}`} style={{transform:`translate(${view.x}px,${view.y}px) scale(${view.scale})`,transition:drag?'none':'transform .28s ease'}} aria-label="أطلس تاريخي تفاعلي">
    <img src={region==='hijaz'?hijaz:makkah} alt="رسم حبر جغرافي من بيانات الارتفاع والساحل، على رقّ عاجي" draggable={false}/>
    {region==='hijaz'&&<span className="historicalSea">البحر الأحمر</span>}
    {pins.map(p=>{const point=atlasPoint(p.lon,p.lat,region);const dy=region==='hijaz'?(p.id==='hira'?-36:p.id==='arafat'?20:p.labelOffset||0):p.labelOffset||0;return <React.Fragment key={p.id}><span className="atlasPoint" aria-hidden="true" style={{left:`${point.x}%`,top:`${point.y}%`}}/><span className={`atlasLeader ${dy<0?'up':''}`} aria-hidden="true" style={{left:`${point.x}%`,top:`${point.y}%`,height:Math.abs(dy)}}/><button className="atlasPin" style={{left:`${point.x}%`,top:`calc(${point.y}% + ${dy}px)`}} aria-pressed={place===p.id&&show} aria-label={`موضع ${p.title}`} onClick={()=>choose(p)}><MapPin size={14}/><span>{p.title}</span></button></React.Fragment>})}
   </div>
  </div>
  {show&&<article className="atlasContext" aria-live="polite"><button className="atlasClose" aria-label="إغلاق معلومات الموقع" onClick={()=>setShow(false)}><X size={18}/></button><span className="journeyEyebrow"><MapPin size={17}/>{selected.title}</span><h2>{selected.hint}</h2><p>{selected.context}</p><details><summary>الموضع ومصدره</summary><p dir="ltr">{selected.lat.toFixed(4)}° N · {selected.lon.toFixed(4)}° E · approximate</p><a href={selected.url} target="_blank" rel="noreferrer">{selected.source}</a></details><div className="atlasStations">{selected.stations.map(n=><button key={n} onClick={()=>onStation(n)}><BookOpen size={16}/>استكشف السورة {n===96?'العلق':n===5?'المائدة':n===3?'آل عمران':n===8?'الأنفال':n===48?'الفتح':n===111?'المسد':n===93?'الضحى':n===2?'البقرة':'النور'}</button>)}</div>{JOURNEY_EVIDENCE.filter(e=>e.place===place).map(e=>onEvidence(e.id))}</article>}
  <details className="atlasAttribution"><summary>المصادر وحدود الدقة</summary><p>العلامات مواضع حديثة تقريبية؛ لا تعيّن مكان نزول كل سورة أو مسار الهجرة. الحديبية تحديد إقليمي فقط. الرسم أصلي من بيانات Mapzen Terrain Tiles: الارتفاعات من SRTM وGMTED2010 بإسناد USGS، وETOPO1 بإسناد NOAA؛ الساحل من Natural Earth (ملكية عامة). خطوط الحبر تمثيل للارتفاع، لا إعادة بناء لهيئة الأرض في القرن السابع. لا تستخدمه للملاحة.</p><a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noreferrer">بيانات الارتفاع</a><a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noreferrer">حقوق الساحل</a></details>
 </section>;
}
