import React,{useState} from 'react';
import {Compass,MapPin,ChevronLeft,BookOpen} from 'lucide-react';
import {JOURNEY_PLACES,atlasPoint,type JourneyPlace} from './journeyGeography';
import hijaz from './assets/journey/hijaz-atlas.webp';
import makkah from './assets/journey/makkah-atlas.webp';
import {JOURNEY_EVIDENCE} from './journeyEvidence';
export function JourneyAtlas({place,onPlace,onStation,onEvidence}:{place:string;onPlace:(id:string)=>void;onStation:(n:number)=>void;onEvidence:(id:string)=>React.ReactNode}){
 const [migration,setMigration]=useState(false),[zoom,setZoom]=useState(1);
 const [region,setRegion]=useState<'hijaz'|'makkah'>(JOURNEY_PLACES.find(p=>p.id===place)?.region||'hijaz');
 const selected=JOURNEY_PLACES.find(p=>p.id===place)||JOURNEY_PLACES[4];
 function choose(p:JourneyPlace){onPlace(p.id);setRegion(p.region)}
 const pins=region==='hijaz'?JOURNEY_PLACES.filter(p=>['madinah','uhud','badr','makkah'].includes(p.id)):JOURNEY_PLACES.filter(p=>p.region==='makkah');
 return <section className="journeyMapPage">
  <div className="atlasTitle"><span className="journeyEyebrow">أطلس المكان والسياق</span><h1>الحجاز… ومواطن الوحي</h1><p>المواضع المعروفة اليوم، وأحداثها الموثقة.</p></div>
  <div className="atlasRegions" aria-label="نطاق الخريطة"><button aria-pressed={region==='hijaz'} onClick={()=>setRegion('hijaz')}>الحجاز</button><button aria-pressed={region==='makkah'} onClick={()=>setRegion('makkah')}>مكة ومحيطها</button></div>
  <div className="atlasLegend"><div className="atlasNorth"><b>شمال ↑</b></div><span className="atlasScale">{region==='hijaz'?'الحجاز · مواضع تقريبية':'عرض مكبّر · مكة ومحيطها'}</span></div>
  <div className="atlasControls"><label><input type="checkbox" checked={migration} onChange={e=>setMigration(e.target.checked)}/> إظهار انتقال الهجرة التقريبي</label><label>تكبير<input aria-label="تكبير الخريطة" type="range" min="1" max="2" step=".1" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/></label></div><div className="atlasViewport"><div style={{width:`${zoom*100}%`}} className={`journeyMap atlas49 ${region}`} aria-label={`خريطة ${region==='hijaz'?'الحجاز':'مكة'} التفاعلية`}>
   <img src={region==='hijaz'?hijaz:makkah} alt="تضاريس فعلية مع تلوين أطلس؛ العلامات والتسميات طبقة تفاعلية"/>
   {migration&&region==='hijaz'&&<svg className="migrationLayer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="خط تقريبي بين مكة والمدينة، ليس إعادة بناء لمسار الهجرة"><path d="M66 84 Q42 69 46 54 T61 25" fill="none" stroke="#976532" strokeWidth=".7" strokeDasharray="2 2"/></svg>}
   {region==='hijaz'&&<span className="atlasSea">البحر الأحمر</span>}
   {pins.map(p=>{const point=atlasPoint(p.lon,p.lat,region),dy=p.labelOffset||0;return <React.Fragment key={p.id}><span className="atlasPoint" aria-hidden="true" style={{left:`${point.x}%`,top:`${point.y}%`}}/><span className={`atlasLeader ${dy<0?'up':''}`} aria-hidden="true" style={{left:`${point.x}%`,top:`${point.y}%`,height:Math.abs(dy)}}/><button className="atlasPin" style={{left:`${point.x}%`,top:`calc(${point.y}% + ${dy}px)`}} aria-pressed={place===p.id} aria-label={`موضع ${p.title==='مكة'?'مكة ومحيطها':p.title}`} onClick={()=>choose(p)}><MapPin size={15}/><span>{p.title}</span></button></React.Fragment>})}
  </div>
  </div><p className="atlasNotice">{migration&&"الخط المتقطع يمثل انتقالًا تقريبيًا بين مكة والمدينة فقط، وليس مسارًا تاريخيًا موثقًا أو طريق نزول الوحي. "}التضاريس والساحل من بيانات جغرافية. العلامات تقريبية، ولا تمثل طريق الهجرة أو مكان نزول كل سورة.</p>
  <p className="atlasKey">● موضع تقريبي · العلامة الخضراء: الموقع المحدد · الخط المتقطع: انتقال تقريبي اختياري</p><div className="journeyPlaceChoices" aria-label="اختر موقعًا">{JOURNEY_PLACES.map(p=><button key={p.id} aria-pressed={place===p.id} onClick={()=>choose(p)}>{p.title}<ChevronLeft size={16}/></button>)}</div>
  <article className="atlasContext" aria-live="polite"><span className="journeyEyebrow"><MapPin size={17}/>{selected.title}</span><h2>{selected.hint}</h2><p>{selected.context}</p><details><summary>الموضع ومصدره</summary><p dir="ltr">{selected.lat.toFixed(4)}° N · {selected.lon.toFixed(4)}° E</p><a href={selected.url} target="_blank" rel="noreferrer">{selected.source}</a></details><div className="atlasStations">{selected.stations.map(n=><button key={n} onClick={()=>onStation(n)}><BookOpen size={16}/>{n===96?'استكشف سورة العلق':n===5?'استكشف سورة المائدة':n===3?'استكشف آل عمران':n===8?'استكشف الأنفال':n===111?'استكشف المسد':n===93?'استكشف الضحى':n===2?'استكشف البقرة':'استكشف النور'}<ChevronLeft size={16}/></button>)}</div></article>
  {JOURNEY_EVIDENCE.filter(e=>e.place===place).map(e=>onEvidence(e.id))}
  {place==='badr'&&<article className="journeyEvidence"><span className="journeyEyebrow">نص قرآني · آل عمران ١٢٣</span><p>تذكر الآية نصر الله للمؤمنين ببدر. هذا ذكر للحدث في القرآن، وليس سبب نزول خاصًا للسورة كاملة.</p><button className="journeyTextButton" onClick={()=>onStation(3)}>استكشف آل عمران<ChevronLeft size={16}/></button></article>}
  <details className="atlasAttribution"><summary>مصادر الأطلس وحدود دقته</summary><p>رسم تضاريسي بإسقاط ميركاتور من Mapzen Terrain Tiles؛ بيانات SRTM وGMTED2010 بإسناد USGS، وETOPO1 بإسناد NOAA. الساحل من Natural Earth، ملكية عامة. الألوان أسلوب فني، وليست وصفًا للغطاء الأرضي في القرن السابع. لا تستخدم الخريطة للملاحة.</p><a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noreferrer">Mapzen · Terrain Tiles</a><a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noreferrer">Natural Earth · الملكية العامة</a></details>
 </section>;
}
