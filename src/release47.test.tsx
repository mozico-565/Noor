// @vitest-environment jsdom
import React from 'react';
import {describe,it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {readFileSync} from 'node:fs';
import {mergeOrder,validateRanks} from './SortableItems';
import {OrderQuiz,RevelationJourney} from './NoorFeatures';
import {relatedEvidence} from './relatedEvidence';
import {divisionKind,divisionLabel} from './mushafMarks';
import topics from './journeyTopics.json';
const q=JSON.parse(readFileSync('public/data/quran.json','utf8'));
const verses=q.surahs.flatMap((s:any)=>s.ayahs.map((v:any)=>({...v,surahName:s.name_arabic,surahNumber:s.number})));
const h=JSON.parse(readFileSync('public/data/hadith_index.json','utf8'));
afterEach(()=>{cleanup();localStorage.clear()});
describe('Release 47 data and interactions',()=>{
 it('retains saved home order, removes obsolete and duplicate ids and adds future tools',()=>{expect(mergeOrder(['b','b','gone','a'],['a','b','new'])).toEqual(['b','a','new']);expect(mergeOrder({bad:true},['a','b'])).toEqual(['a','b'])});
 it('validates missing, duplicate, out of range, fractional and Arabic ranks',()=>{for(const values of [['','2','3'],['1','1','3'],['0','2','3'],['4','2','3'],['1.5','2','3']])expect(validateRanks(values,3)).toBeTruthy();expect(validateRanks(['٣','١','٢'],3)).toBeNull();expect(validateRanks(['۳','۱','۲'],3)).toBeNull()});
 it('keeps the correct solution hidden before attempt and does not grade invalid ranks',()=>{const score=vi.fn();render(<OrderQuiz verses={verses.slice(0,3)} onScore={score}/>);fireEvent.click(screen.getByRole('button',{name:'ابدأ اختبار ترتيب الآيات'}));expect(screen.queryByRole('button',{name:'عرض الترتيب الصحيح'})).toBeNull();const inputs=screen.getAllByRole('textbox');fireEvent.change(inputs[0],{target:{value:''}});fireEvent.click(screen.getByRole('button',{name:'تحقق من الإجابة'}));expect(score).not.toHaveBeenCalled();expect(screen.getByRole('alert').textContent).toContain('كل آية');fireEvent.change(inputs[0],{target:{value:'1'}});fireEvent.change(inputs[1],{target:{value:'2'}});fireEvent.change(inputs[2],{target:{value:'3'}});fireEvent.click(screen.getByRole('button',{name:'تحقق من الإجابة'}));expect(score).toHaveBeenCalledOnce();expect(screen.getByRole('button',{name:'عرض الترتيب الصحيح'})).toBeTruthy()});
 it('maps 8:1 to actual half of hizb 18 and does not insert at every surah',()=>{expect(divisionKind('8:1')).toBe('quarter');expect(divisionLabel('8:1')).toContain('نصف');expect(divisionKind('2:1')).toBeNull();expect(divisionKind('2:142')).toBe('juz');expect(divisionKind('2:75')).toBe('hizb')});
 it('supplies a Quran sourced topic for each actual surah without invented years',()=>{expect(topics).toHaveLength(114);for(const t of topics){expect(t.to).toBe(q.surahs[t.number-1].ayahs.length);expect(t.summary.length).toBeGreaterThan(10);expect(t.summary).not.toMatch(/\d{4}/)}});
 it('persists journey visits and restores a valid last position',()=>{render(<RevelationJourney surahs={q.surahs} onOpen={vi.fn()}/>);fireEvent.change(screen.getByLabelText('البحث في رحلة النزول'),{target:{value:'العلق'}});fireEvent.click(screen.getByRole('button',{name:/١ · العلق/}));expect(JSON.parse(localStorage.getItem('noor_journey_progress')!).last).toBe(96);expect(screen.getByRole('button',{name:'استئناف آخر موضع'})).toBeTruthy()});
 it('finds actual related verses and only independently verified authentic hadith references',()=>{const selected=verses.find((v:any)=>v.verse_key==='7:206');const results=relatedEvidence(selected,'يسجدون',verses,h);expect(results.some(r=>r.verseKey==='96:19')).toBe(true);expect(results.some(r=>r.url==='https://sunnah.com/muslim:482')).toBe(true);expect(results.every(r=>r.verseKey?verses.some((v:any)=>v.verse_key===r.verseKey&&v.text===r.text):h.some((x:any)=>x.arabic===r.text&&['bukhari','muslim'].includes(x.book)))).toBe(true)});
 it('does not promote unsupported narrations or lexical overlap into thematic evidence',()=>{const v={verse_key:'x',number:1,surahName:'',text:'نص مختلف'};expect(relatedEvidence(v,'غيرمتاح',verses,[{book:'unknown',id:1,arabic:'اقرب ما يكون العبد من ربه وهو ساجد'}])).toEqual([]);const results=relatedEvidence({...v,text:'كلمة'},'يستكبرون',verses,[]);expect(results.every(r=>r.association==='لفظي')).toBe(true)});
});
