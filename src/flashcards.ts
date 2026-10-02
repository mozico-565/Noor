export type FlashcardDifficulty="easy"|"medium"|"hard";

// Difficulty belongs to the question, never a whitelist of surahs or ayahs.
export function eligibleFlashcard(wordCount:number,difficulty:FlashcardDifficulty){
  if(wordCount<2)return false;
  if(difficulty==="easy")return wordCount<=10;
  if(difficulty==="hard")return wordCount>=12;
  return wordCount>=5&&wordCount<=17;
}

/** A session owns one unique, shuffled deck. Never recycle an exhausted pool. */
export function createFlashcardDeck<T extends {verse_key:string}>(pool:readonly T[],limit:number,random:()=>number=Math.random):T[]{
  const deck=[...new Map(pool.map(item=>[item.verse_key,item])).values()];
  for(let i=deck.length-1;i>0;i--){
    const j=Math.floor(Math.max(0,Math.min(.999999999,random()))*(i+1));
    [deck[i],deck[j]]=[deck[j],deck[i]];
  }
  return deck.slice(0,Math.max(0,Math.floor(limit)));
}
