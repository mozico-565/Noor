import {normalizeArabicSearch as norm} from './quranQuery';
export type EvidenceVerse={verse_key:string;text:string;surahName:string;number:number};
export type EvidenceHadith={book:string;id:string|number;arabic:string;reference?:string;grade?:string};
export type RelatedResult={id:string;kind:'quran'|'hadith';title:string;text:string;source:string;verseKey?:string;url?:string;association:'موضوعي'|'لفظي'};
const topics=[
 {stems:['سجد','سجود'],keys:['7:206','22:77','32:15','96:19'],hadith:[{book:'muslim',phrase:'اقرب ما يكون العبد من ربه وهو ساجد',ref:'صحيح مسلم ٤٨٢ · كتاب الصلاة',url:'https://sunnah.com/muslim:482'}]},
 {stems:['صبر','صابر'],keys:['2:153','2:155','3:200','16:127'],hadith:[{book:'bukhari',phrase:'ومن يتصبر يصبره الله',ref:'صحيح البخاري ١٤٦٩ · كتاب الزكاة',url:'https://sunnah.com/bukhari:1469'}]},
 {stems:['والدين','والدي','والدتي','ابويه'],keys:['17:23','17:24','31:14','46:15'],hadith:[{book:'bukhari',phrase:'ثم من قال امك',ref:'صحيح البخاري ٥٩٧١ · كتاب الأدب',url:'https://sunnah.com/bukhari:5971'}]},
 {stems:['ذكر الله','اذكروا الله','فاذكروني','تسبيح','يسبح','سبحان','سبحوا'],keys:['13:28','33:41','33:42','2:152'],hadith:[{book:'muslim',phrase:'وانا معه حين يذكرني',ref:'صحيح مسلم ٢٦٧٥ · كتاب الذكر والدعاء والتوبة والاستغفار',url:'https://sunnah.com/muslim:2675a'}]},
 {stems:['توب','تائب','استغفر'],keys:['39:53','66:8','4:110','24:31'],hadith:[{book:'muslim',phrase:'لله اشد فرحا بتوبه عبده',ref:'صحيح مسلم ٢٧٤٧ · كتاب التوبة',url:'https://sunnah.com/muslim:2747a'}]},
 {stems:['انفق','ينفق','صدقه','صدقات','يتيم','مسكين'],keys:['2:261','2:262','76:8','90:14'],hadith:[{book:'bukhari',phrase:'الساعي علي الارمله والمسكين',ref:'صحيح البخاري ٦٠٢١ · كتاب الأدب',url:'https://sunnah.com/bukhari:6021'}]},
];
export function relatedEvidence(selected:EvidenceVerse,word:string,verses:EvidenceVerse[],hadith:EvidenceHadith[]):RelatedResult[]{
 const text=norm(selected.text),matched=topics.filter(t=>t.stems.some(s=>text.includes(norm(s))));
 const byKey=new Map(verses.map(v=>[v.verse_key,v]));const results:RelatedResult[]=[];
 for(const topic of matched){for(const key of topic.keys){const v=byKey.get(key);if(v&&key!==selected.verse_key&&!results.some(r=>r.verseKey===key))results.push({id:`q-${key}`,kind:'quran',title:`سورة ${v.surahName} · الآية ${v.number.toLocaleString('ar')}`,text:v.text,source:'القرآن الكريم · رابط موضوعي مقترح من الآيات المذكورة',verseKey:key,association:'موضوعي'})}
 for(const h of topic.hadith){const found=hadith.find(v=>v.book===h.book&&norm(v.arabic).includes(norm(h.phrase)));if(found&&!results.some(r=>r.url===h.url))results.push({id:`h-${h.url}`,kind:'hadith',title:'حديث صحيح مرتبط بالموضوع',text:found.arabic,source:h.ref,url:h.url,association:'موضوعي'})}}
 const term=norm(word).trim();if(term.length>=4)for(const v of verses){if(results.filter(r=>r.kind==='quran').length>=8)break;if(v.verse_key!==selected.verse_key&&norm(v.text).includes(term)&&!results.some(r=>r.verseKey===v.verse_key))results.push({id:`q-${v.verse_key}`,kind:'quran',title:`سورة ${v.surahName} · الآية ${v.number.toLocaleString('ar')}`,text:v.text,source:'القرآن الكريم · تشابه لفظي يحتاج قراءة السياق',verseKey:v.verse_key,association:'لفظي'})}
 return results;
}
