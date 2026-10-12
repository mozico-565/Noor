// @vitest-environment jsdom
import React from 'react';
import {it,expect,afterEach,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,act} from '@testing-library/react';
import {FiqhLearning,FIQH_QUESTIONS,LESSONS} from './FiqhLearning';
afterEach(()=>{cleanup();localStorage.clear();vi.useRealTimers()});
it('scores ten sourced answers exactly once and ends at question ten',()=>{
 render(<FiqhLearning onBack={()=>{}}/>);fireEvent.click(screen.getByRole('button',{name:'اختبر نفسك'}));
 for(let i=0;i<10;i++){
  const question=FIQH_QUESTIONS.find(q=>screen.queryByRole('heading',{name:q.prompt}))!;
  for(const n of question.correct)fireEvent.click(screen.getByRole('button',{name:question.options[n]}));
  fireEvent.click(screen.getByRole('button',{name:'تحقق'}));
  expect(screen.getByRole('status').textContent).toContain('المصدر:');
  fireEvent.click(screen.getByRole('button',{name:i===9?'عرض النتيجة':'السؤال التالي'}));
 }
 expect(screen.getByRole('heading',{name:'نتيجتك 10 / ١٠'})).toBeTruthy();
});
it('expires after twenty seconds and does not credit an unsubmitted selection',()=>{
 vi.useFakeTimers();render(<FiqhLearning onBack={()=>{}}/>);fireEvent.click(screen.getByRole('button',{name:'اختبر نفسك'}));
 const question=FIQH_QUESTIONS.find(q=>screen.queryByRole('heading',{name:q.prompt}))!;
 for(const n of question.correct)fireEvent.click(screen.getByRole('button',{name:question.options[n]}));
 act(()=>vi.advanceTimersByTime(20000));expect(screen.getByRole('status').textContent).toContain('انتهى الوقت');
 expect(screen.queryByRole('button',{name:'تحقق'})).toBeNull();
});
it('keeps the current selection when declining to end a quiz',()=>{
 render(<FiqhLearning onBack={()=>{}}/>);fireEvent.click(screen.getByRole('button',{name:'اختبر نفسك'}));
 const q=FIQH_QUESTIONS.find(q=>screen.queryByRole('heading',{name:q.prompt}))!;
 const selected=screen.getByRole('button',{name:q.options[0]});fireEvent.click(selected);fireEvent.click(screen.getByRole('button',{name:'رجوع'}));
 fireEvent.click(screen.getByRole('button',{name:'متابعة الاختبار'}));expect(selected.getAttribute('aria-pressed')).toBe('true');
});

it('handles Android back without resetting the active question or its deadline',()=>{
 vi.useFakeTimers();const exit=vi.fn();render(<FiqhLearning onBack={exit}/>);fireEvent.click(screen.getByRole('button',{name:'اختبر نفسك'}));
 const q=FIQH_QUESTIONS.find(q=>screen.queryByRole('heading',{name:q.prompt}))!,selected=screen.getByRole('button',{name:q.options[0]});fireEvent.click(selected);act(()=>vi.advanceTimersByTime(5000));
 let cancelled=false;act(()=>{cancelled=!window.dispatchEvent(new Event('noor-fiqh-back',{cancelable:true}))});expect(cancelled).toBe(true);expect(exit).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'متابعة الاختبار'}));expect(selected.getAttribute('aria-pressed')).toBe('true');expect(screen.getByText(/15 ثانية/)).toBeTruthy();
 act(()=>window.dispatchEvent(new Event('noor-fiqh-back',{cancelable:true})));fireEvent.click(screen.getByRole('button',{name:'إنهاء الاختبار والعودة للدروس'}));expect(screen.getByRole('button',{name:'اختبر نفسك'})).toBeTruthy();
});

it('renders the eight Hanbali duties separately from sunnahs and explanatory prose',()=>{
 render(<FiqhLearning onBack={()=>{}}/>);fireEvent.click(screen.getByRole('button',{name:/الواجب والسنّة/}));
 expect(screen.getByRole('heading',{name:'واجبات الصلاة عند الحنابلة'})).toBeTruthy();
 expect(document.querySelector('.fiqhLesson ol')?.children.length).toBe(8);
 expect(document.querySelectorAll('.fiqhLesson ul').length).toBe(2);
 expect(screen.getByText(/ليست هذه التصنيفات محل إجماع/)).toBeTruthy();
 expect(LESSONS.find(l=>l.id==='duties')?.sourceUrl).toContain('risala.prh.gov.sa');
});
import {dailyTadabbur} from './Tadabbur';
it('keeps the daily reflection stable through a local day and advances across midnight',()=>{
 const morning=dailyTadabbur(new Date(2026,9,12,0,1));
 expect(dailyTadabbur(new Date(2026,9,12,23,59))).toEqual(morning);
 expect(dailyTadabbur(new Date(2026,9,13,0,1))[0]).not.toBe(morning[0]);
});
