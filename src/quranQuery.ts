export type QuranQueryIntent="COUNT"|"WHERE"|"MEANING"|"TOPIC"|"REFERENCE"|"GENERAL";

export type SearchableVerse={
  verse_key:string;
  text:string;
  number:number;
  surahNumber:number;
  surahName:string;
};

export type IndexedVerse<T extends SearchableVerse>={verse:T;tokens:string[]};

export type LexicalQueryResult<T extends SearchableVerse>={
  term:string;
  exactCount:number;
  normalizedCount:number;
  verses:T[];
};

export function normalizeArabicSearch(value:string){
  return String(value||"")
    .normalize("NFKD")
    .replace(/[٠-٩]/g,d=>String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g,d=>String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    // Expand the Quranic dagger alif to a normal alif for SEARCH ONLY.
    // This lets ordinary spelling such as «الإنسان» match the authoritative
    // Uthmani surface «ٱلْإِنسَٰنُ» without changing stored/displayed Quran text.
    .replace(/\u0670/g,"ا")
    .replace(/[\u064B-\u065F\u06D6-\u06ED]/g,"")
    .replace(/[إأآٱ]/g,"ا")
    .replace(/ى/g,"ي")
    .replace(/ؤ/g,"و")
    .replace(/ئ/g,"ي")
    .replace(/ة/g,"ه")
    .replace(/[^\u0621-\u063A\u0641-\u064A0-9\s]/g," ")
    .replace(/\s+/g," ")
    .trim();
}

export function classifyQuranQuery(question:string):QuranQueryIntent{
  const q=normalizeArabicSearch(question);
  if(/كم.*(مره|عدد|ورد|ذكر)|(?:ذكر|ذكرت|اتذكرت|وردت).*كم/.test(q))return "COUNT";
  if(/قصه|قصص/.test(q)&&/اين|ورد|مواضع/.test(q))return "TOPIC";
  if(/^(اين|في اي سوره|في اي ايه|ما مواضع)/.test(q))return "WHERE";
  if(/^(ما معني|ماذا يعني|اشرح معني|معني)/.test(q))return "MEANING";
  if(/^(ايات عن|ما الايات التي تتحدث عن|ما السور التي تتحدث عن|ماذا يقول القران عن|موضوع)/.test(q))return "TOPIC";
  if(/سوره\s+\S+\s+(ايه\s+)?[0-9٠-٩]+|ايه الكرسي/.test(q))return "REFERENCE";
  return "GENERAL";
}

export function extractQueryTerm(question:string,intent=classifyQuranQuery(question)){
  let q=normalizeArabicSearch(question);
  const patterns:Record<QuranQueryIntent,RegExp[]>={
    COUNT:[/^(كم مره\s+(ذكرت|ذكر|وردت|ورد)|كم عدد\s+(مرات\s+)?(ورود|ذكر)?|كم وردت|كم ورد|كم ذكرت|كم ذكر)\s*/,/^(كلمه|لفظ)\s*/],
    WHERE:[/^(اين ذكرت|اين ذكر|اين وردت|اين ورد|اين|في اي سوره ذكرت|في اي سوره ذكر|في اي ايه ذكرت|في اي ايه ذكر|ما مواضع)\s*/],
    MEANING:[/^(ما معني|ماذا يعني|اشرح معني|معني)\s*/],
    TOPIC:[/^(ما السور التي تتحدث عن|ما الايات التي تتحدث عن|ايات تتحدث عن|ايات عن|اين وردت قصه|اين وردت|ماذا يقول القران عن|موضوع)\s*/],
    REFERENCE:[],GENERAL:[]
  };
  for(const pattern of patterns[intent])q=q.replace(pattern,"");
  if(intent==="COUNT")q=q.replace(/اتذكرت|ذكرت|وردت|مرات|ورود|كلمه|مره|عدد|ذكر|ورد|لفظ|كم/g," ");
  return q.replace(/في القران|بالقران|القران/g,"").replace(/\s+/g," ").trim();
}

export function buildQuranSearchIndex<T extends SearchableVerse>(verses:T[]):IndexedVerse<T>[]{
  return verses.map(verse=>({verse,tokens:normalizeArabicSearch(verse.text).split(" ").filter(Boolean)}));
}

function withoutSimplePrefix(token:string,target:string){
  if(token===target)return token;
  if(token.length>target.length&&/^[وفبكل]$/.test(token[0])&&token.slice(1)===target)return target;
  return token;
}

export function runLexicalQuery<T extends SearchableVerse>(index:IndexedVerse<T>[],rawTerm:string):LexicalQueryResult<T>{
  const term=normalizeArabicSearch(rawTerm);
  let exactCount=0,normalizedCount=0;
  const verses:T[]=[];
  if(!term)return {term,exactCount,normalizedCount,verses};
  for(const row of index){
    let matched=false;
    for(const token of row.tokens){
      if(token===term){exactCount++;normalizedCount++;matched=true;continue}
      if(withoutSimplePrefix(token,term)===term){normalizedCount++;matched=true}
    }
    if(matched)verses.push(row.verse);
  }
  return {term,exactCount,normalizedCount,verses};
}
