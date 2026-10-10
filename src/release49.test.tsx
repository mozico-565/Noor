// @vitest-environment jsdom
import React from 'react';
import {readFileSync} from 'node:fs';
import {describe,it,expect,afterEach,beforeAll,vi} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {RevelationJourney} from './RevelationJourney';
import {JOURNEY_PLACES,ATLAS_BOUNDS,atlasPoint} from './journeyGeography';
import metadata from './revelationData.json';
const q=JSON.parse(readFileSync('public/data/quran.json','utf8'));
beforeAll(()=>{vi.stubGlobal('requestAnimationFrame',(cb:FrameRequestCallback)=>setTimeout(cb,0));vi.stubGlobal('cancelAnimationFrame',clearTimeout)});
afterEach(()=>{cleanup();localStorage.clear()});
const mount=()=>render(<section className="content"><RevelationJourney surahs={q.surahs} onOpen={vi.fn()}/></section>);
describe('Release 49 reference corrections and atlas',()=>{
 it('keeps the documented first stations and Furqan 42',()=>{expect([...metadata.surahs].sort((a,b)=>a.order-b.order).slice(0,4).map(s=>s.number)).toEqual([96,68,73,74]);expect(metadata.surahs.find(s=>s.number===25)?.order).toBe(42)});
 it('preserves verified cardinal relationships between places',()=>{const p=(id:string)=>JOURNEY_PLACES.find(p=>p.id===id)!;expect(p('uhud').lat).toBeGreaterThan(p('madinah').lat);expect(p('badr').lat).toBeLessThan(p('madinah').lat);expect(p('badr').lon).toBeLessThan(p('madinah').lon);expect(p('hira').lat).toBeGreaterThan(p('makkah').lat);expect(p('hira').lon).toBeGreaterThan(p('makkah').lon);expect(p('arafat').lat).toBeLessThan(p('makkah').lat);expect(p('arafat').lon).toBeGreaterThan(p('makkah').lon)});
 it('projects all locations within their atlas and north upwards',()=>{for(const p of JOURNEY_PLACES){const xy=atlasPoint(p.lon,p.lat,p.region);expect(xy.x).toBeGreaterThan(0);expect(xy.x).toBeLessThan(100);expect(xy.y).toBeGreaterThan(0);expect(xy.y).toBeLessThan(100)}const [w,s,e,n]=ATLAS_BOUNDS.hijaz;expect(atlasPoint(w,n,'hijaz')).toEqual({x:0,y:0});expect(atlasPoint(e,s,'hijaz')).toEqual({x:100,y:100})});
 it('accepts Arabic station numbers and rejects out of range input',()=>{mount();fireEvent.change(screen.getByLabelText('انتقل إلى محطة'),{target:{value:'٠'}});fireEvent.click(screen.getByRole('button',{name:'انتقال'}));expect(screen.getByRole('alert').textContent).toContain('١١٤');fireEvent.change(screen.getByLabelText('انتقل إلى محطة'),{target:{value:'٤٢'}});fireEvent.click(screen.getByRole('button',{name:'انتقال'}));expect(screen.getByRole('region',{name:'تفاصيل سورة الفرقان'})).toBeTruthy()});
 it('keeps the number after marking a station visited',()=>{mount();fireEvent.click(screen.getByRole('button',{name:'١ · العلق'}));fireEvent.click(screen.getByRole('button',{name:'العودة إلى الرحلة'}));expect(screen.getByLabelText('ترتيب النزول ١').textContent).toBe('١');expect(screen.getByLabelText('ترتيب النزول ١').querySelector('.journeyVisitCheck')).toBeTruthy()});
 it('switches atlas scopes and selects a sourced place without assigning a whole surah to it',()=>{mount();fireEvent.click(screen.getByRole('button',{name:'الخريطة'}));fireEvent.click(screen.getByRole('button',{name:'الحجاز'}));fireEvent.click(screen.getByRole('button',{name:'موضع أُحد'}));expect(screen.getByText('أُحد شمال المدينة')).toBeTruthy();expect(screen.getByText(/ليست نسبة نزول السورة كلها/)).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'عرفة'}));expect(screen.getByRole('button',{name:'موضع عرفة'}).getAttribute('aria-pressed')).toBe('true');expect(screen.getByText('إكمال الدين بعرفة')).toBeTruthy()});
});
