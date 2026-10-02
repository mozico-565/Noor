export type QuranpediaAsbabNarration = {
  text: string;
  source: string;
  bookId: 460 | 2919;
};

const BASE = "https://api.quranpedia.net/v1";
const BOOKS = [
  {id: 460 as const, source: "المحرر في أسباب نزول القرآن من خلال الكتب التسعة"},
  {id: 2919 as const, source: "أسباب نزول القرآن - الواحدي"},
];

type BookResponse = {content?: Array<{text?: unknown}>};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

async function fetchBook(surah:number, ayah:number, book:(typeof BOOKS)[number], signal?:AbortSignal):Promise<QuranpediaAsbabNarration[]> {
  const response = await fetch(`${BASE}/ayah/${surah}/${ayah}/book/${book.id}`, {
    headers:{Accept:"application/json"},
    signal,
  });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`Quranpedia ${response.status}`);
  const payload = await response.json() as BookResponse;
  const seen = new Set<string>();
  return (Array.isArray(payload.content) ? payload.content : [])
    .map(row=>cleanText(row?.text))
    .filter(text=>text.length>0 && !seen.has(text) && Boolean(seen.add(text)))
    .map(text=>({text,source:book.source,bookId:book.id}));
}

export async function fetchQuranpediaAsbab(surah:number, ayah:number, signal?:AbortSignal):Promise<QuranpediaAsbabNarration[]> {
  if (!Number.isInteger(surah)||surah<1||surah>114||!Number.isInteger(ayah)||ayah<1) return [];
  const settled=await Promise.allSettled(BOOKS.map(book=>fetchBook(surah,ayah,book,signal)));
  const merged=settled.flatMap(result=>result.status==="fulfilled"?result.value:[]);
  const seen=new Set<string>();
  return merged.filter(item=>{const key=`${item.bookId}|${item.text}`;if(seen.has(key))return false;seen.add(key);return true;});
}
