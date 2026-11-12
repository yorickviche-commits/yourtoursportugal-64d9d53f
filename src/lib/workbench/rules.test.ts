import {describe,it,expect} from 'vitest';
import {readiness,nextStatus,belongsToSide,matchThread} from './rules';
describe('Workbench rules',()=>{
 it('excludes N/A from ready percentage',()=>expect(readiness([{status:'ok'},{status:'pending'},{status:'na'}])).toBe(50));
 it('cycles manual statuses',()=>expect(['ok','pending','missing','na'].map(s=>nextStatus(s as 'ok'))).toEqual(['pending','missing','na','ok']));
 it('keeps operations separate from sales and excludes archives',()=>{expect(belongsToSide({nethunt_stage:'OPERATIONS - Deposit/Payment Received'},'ops')).toBe(true);expect(belongsToSide({nethunt_stage:'OPERATIONS - Archive'},'ops')).toBe(false);expect(belongsToSide({nethunt_stage:'SALES - New Lead'},'ops')).toBe(false)});
 it('matches official YT before sender and rejects ambiguous sender',()=>{const leads=[{id:'1',yt_id:'YT5180',email:'a@b.pt'},{id:'2',yt_id:'YT5181',email:'a@b.pt'}];expect(matchThread('RE: YT5180', 'a@b.pt',leads)?.id).toBe('1');expect(matchThread('', 'a@b.pt',leads)).toBeNull()});
});

import {matchThread as m2} from './rules';
describe('reference formats', () => {
  const leads=[{id:'a',yt_id:'YT-2026-4474',email:null,bokun_confirmation_code:'YOU-108697038'},{id:'b',yt_id:'YT5180',email:null}];
  it('matches YT-YYYY-####', () => expect(m2('Re: yt-2026-4474 dúvida','',leads)?.id).toBe('a'));
  it('matches Bókun code', () => expect(m2('Booking YOU-108697038','',leads)?.id).toBe('a'));
  it('matches YT ####', () => expect(m2('YT 5180','',leads)?.id).toBe('b'));
});
