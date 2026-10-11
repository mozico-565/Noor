// @vitest-environment jsdom
import React from 'react';
import {it,expect,afterEach,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,act} from '@testing-library/react';
import {FiqhLearning,FIQH_QUESTIONS} from './FiqhLearning';
afterEach(()=>{cleanup();localStorage.clear();vi.useRealTimers()});
it('scores ten sourced answers exactly once and ends at question ten',()=>{
 render(<FiqhLearning onBack={()=>{}}/>);fireEvent.click(screen.getByRole('button',{name:'اختبار · ١٠ أسئلة'}));
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
 vi.useFakeTimers();render(<FiqhLearning onBack={()=>{}}/>);fireEvent.click(screen.getByRole('button',{name:'اختبار · ١٠ أسئلة'}));
 const question=FIQH_QUESTIONS.find(q=>screen.queryByRole('heading',{name:q.prompt}))!;
 for(const n of question.correct)fireEvent.click(screen.getByRole('button',{name:question.options[n]}));
 act(()=>vi.advanceTimersByTime(20000));expect(screen.getByRole('status').textContent).toContain('انتهى الوقت');
 expect(screen.queryByRole('button',{name:'تحقق'})).toBeNull();
});
