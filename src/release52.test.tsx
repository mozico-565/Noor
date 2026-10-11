// @vitest-environment jsdom
import React from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {JourneyAtlas} from './JourneyAtlas';
import {JOURNEY_PLACES} from './journeyGeography';
afterEach(cleanup);
it('shows all eight sourced locations above the map, and closes a selected card',()=>{
 const choose=vi.fn();render(<JourneyAtlas place="makkah" onPlace={choose} onStation={vi.fn()} onEvidence={()=>null}/>);
 const chips=screen.getByLabelText('اختر موقعًا');expect(chips.querySelectorAll('button')).toHaveLength(8);
 expect(chips.compareDocumentPosition(screen.getByLabelText('أطلس تاريخي تفاعلي'))&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 expect(screen.queryByRole('slider')).toBeNull();expect(screen.queryByRole('checkbox')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'مكة'}));expect(choose).toHaveBeenCalledWith('makkah');expect(screen.getByText('الدعوة والإنذار')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'إغلاق معلومات الموقع'}));expect(screen.queryByText('الدعوة والإنذار')).toBeNull();
});
it('keeps references and geographical uncertainty for the added locations',()=>{
 for(const id of ['quba','hudaybiyyah']){const p=JOURNEY_PLACES.find(p=>p.id===id)!;expect(p.url).toMatch(/^https:/);expect(p.context).toContain('تقريبي');}
});
