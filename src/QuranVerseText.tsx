import React from 'react';
// Presentation only: the bundled Quran text is never rewritten.
function openingWord(value:string){return value.normalize('NFKD').replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g,'').replace(/[إأآٱ]/g,'ا').replace(/[\u200B-\u200F\u2066-\u2069\uFEFF]/g,'').trim()}
export function splitOpeningBasmala(text:string,surah:number,ayah:number){
 if(surah===1||surah===9||ayah!==1)return {opening:'',text};
 const words=Array.from(text.matchAll(/\S+/gu));
 if(words.length<=4||words.slice(0,4).map(w=>openingWord(w[0])).join(' ')!=='بسم الله الرحمن الرحيم')return {opening:'',text};
 const end=words[3].index!+words[3][0].length;
 return {opening:text.slice(0,end),text:text.slice(end).trimStart()};
}
export function QuranVerseText({text,surah,ayah}:{text:string;surah:number;ayah:number}){
 const parts=splitOpeningBasmala(text,surah,ayah);
 return <>{parts.opening&&<span className="separatedBasmala quranTextSurface">{parts.opening}</span>}<span className="quranTextSurface">{parts.text}</span></>;
}
