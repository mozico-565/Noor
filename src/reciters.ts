export type CustomReciter={
  id:string;name:string;displayName?:string;provider?:"alquran-cloud"|"manual";
  moshaf?:string;riwaya?:string;baseUrl?:string;numbering?:"global"|"verseId";
  edition?:string;treeUri?:string;sourceType?:"url"|"folder";
};
export type CatalogReciter={identifier:string;name:string;englishName:string;language:string;format:string;type:string;builtinId?:string};
export const RECITER_CATALOG_URL="https://api.alquran.cloud/v1/edition?format=audio&type=versebyverse&language=ar";
const API="https://api.alquran.cloud/v1";
export function normalizeReciterName(name:string){
  return name.normalize("NFKD").replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06EDـ]/g,"")
    .replace(/[أإآٱ]/g,"ا").replace(/ى/g,"ي").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim().replace(/\s+/g," ");
}
function withinOneEdit(a:string,b:string){
  if(Math.abs(a.length-b.length)>1)return false;
  let i=0,j=0,edits=0;
  while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue;}if(++edits>1)return false;if(a.length>=b.length)i++;if(b.length>=a.length)j++;}
  return edits+(i<a.length||j<b.length?1:0)<=1;
}
export function matchReciterName(query:string,name:string){
  const q=normalizeReciterName(query).replace(/ /g,""),n=normalizeReciterName(name).replace(/ /g,"");
  if(q.length<2)return 0;
  if(q===n)return 3;
  if(n.includes(q))return 2;
  if(q.length>=5&&(withinOneEdit(q,n)||normalizeReciterName(name).split(" ").some(word=>withinOneEdit(q,word))))return 1;
  return 0;
}
export function searchCatalog(catalog:CatalogReciter[],query:string){
  return catalog.map(item=>({item,score:Math.max(matchReciterName(query,item.name),matchReciterName(query,item.englishName))}))
    .filter(item=>item.score>0).sort((a,b)=>b.score-a.score||a.item.name.localeCompare(b.item.name,"ar")).slice(0,30).map(item=>item.item);
}
async function fetchTimed(url:string,timeout=18000){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{return await fetch(url,{signal:controller.signal});}finally{clearTimeout(timer);}
}
export async function loadReciterCatalog():Promise<CatalogReciter[]>{
  let cached:{at:number;data:CatalogReciter[]}|undefined;
  try{cached=JSON.parse(localStorage.getItem("noor_reciter_catalog")||"null")||undefined;}catch{/* Ignore corrupt cache. */}
  if(cached&&Array.isArray(cached.data)&&cached.data.length&&Date.now()-cached.at<86400000)return cached.data;
  try{
    const response=await fetchTimed(RECITER_CATALOG_URL);if(!response.ok)throw Error("catalog");
    const json=await response.json();
    const data:CatalogReciter[]=Array.isArray(json.data)?json.data.filter((item:CatalogReciter)=>item&&item.language==="ar"&&item.format==="audio"&&item.type==="versebyverse"&&/^ar\.[a-z0-9-]+$/.test(item.identifier)&&typeof item.name==="string"&&item.name.trim()):[];
    if(!data.length)throw Error("catalog");
    try{localStorage.setItem("noor_reciter_catalog",JSON.stringify({at:Date.now(),data}));}catch{/* Search works even if storage is full. */}
    return data;
  }catch(error){if(cached?.data?.length)return cached.data;throw error;}
}
export function readCustomReciters():CustomReciter[]{
  try{
    const rows=JSON.parse(localStorage.getItem("noor_custom_reciters")||"[]");if(!Array.isArray(rows))return [];
    return rows.filter(item=>item&&/^[a-zA-Z0-9_-]{1,100}$/.test(item.id)&&typeof item.name==="string").map(item=>({...item,displayName:item.displayName||item.name,sourceType:item.sourceType||(item.treeUri?"folder":"url"),numbering:item.numbering||"verseId"}));
  }catch{return [];}
}
export function reciterAudioUrl(reciter:CustomReciter,verseId:string,globalNumber:number){
  if(!reciter.baseUrl||reciter.sourceType==="folder")return "";
  return `${reciter.baseUrl.replace(/\/$/,"")}/${reciter.numbering==="global"?globalNumber:verseId}.mp3`;
}
export async function verifyAudioResponse(response:Response){
  if(!response.ok)throw Error("audio");const bytes=new Uint8Array(await response.arrayBuffer());
  const mp3=bytes[0]===73&&bytes[1]===68&&bytes[2]===51||bytes.slice(0,4096).some((byte,index)=>byte===255&&(bytes[index+1]&224)===224);
  if(bytes.length<1024||!mp3)throw Error("audio");
}
export async function resolveCatalogReciter(item:CatalogReciter):Promise<CustomReciter>{
  const response=await fetchTimed(`${API}/ayah/1/${encodeURIComponent(item.identifier)}`);if(!response.ok)throw Error("audio");
  const json=await response.json(),audio=new URL(json.data?.audio||"");
  const match=audio.pathname.match(/^\/quran\/audio\/(\d+)\/([a-z0-9.-]+)\/1\.mp3$/);
  if(audio.protocol!=="https:"||audio.hostname!=="cdn.islamic.network"||audio.port||audio.username||audio.password||!match||match[2]!==item.identifier)throw Error("audio");
  // Verify actual MP3 bytes before a reciter becomes selectable.
  await verifyAudioResponse(await fetchTimed(audio.href));
  return {id:`catalog_${item.identifier.replace(/\./g,"_")}`,name:item.name,displayName:item.name,provider:"alquran-cloud",edition:item.identifier,
    moshaf:/المجود/.test(item.name)?"المصحف المجود":"تلاوة آية بآية",sourceType:"url",numbering:"global",baseUrl:audio.href.slice(0,-"/1.mp3".length)};
}
export async function downloadAudioBatch({reciter,verses,signal,onProgress}:{
  reciter:CustomReciter;verses:{id:string;globalNumber:number}[];signal:AbortSignal;onProgress:(done:number,total:number)=>void;
}){
  const cache=await caches.open(`noor-audio-${reciter.id}-v1`),batch=new AbortController();
  const abort=()=>batch.abort();signal.addEventListener("abort",abort,{once:true});if(signal.aborted)abort();
  let cursor=0,done=0,failure:unknown;
  const worker=async()=>{
    try{while(cursor<verses.length&&!failure){
      if(batch.signal.aborted)throw new DOMException("Cancelled","AbortError");
      const verse=verses[cursor++],url=reciterAudioUrl(reciter,verse.id,verse.globalNumber);if(!url)throw Error("source");
      if(!await cache.match(url)){
        const controller=new AbortController(),cancel=()=>controller.abort();
        batch.signal.addEventListener("abort",cancel,{once:true});if(batch.signal.aborted)cancel();
        const timer=setTimeout(cancel,45000);
        try{const response=await fetch(url,{signal:controller.signal});await verifyAudioResponse(response.clone());await cache.put(url,response);}
        finally{clearTimeout(timer);batch.signal.removeEventListener("abort",cancel);}
      }
      if(!failure)onProgress(++done,verses.length);
    }}catch(error){if(!failure)failure=error;batch.abort();throw error;}
  };
  try{await Promise.allSettled([worker(),worker(),worker()]);if(failure)throw failure;}
  finally{signal.removeEventListener("abort",abort);}
}
