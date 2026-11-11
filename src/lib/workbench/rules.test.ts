import {describe,it,expect} from 'vitest';
import {readiness,nextStatus,belongsToSide,matchThread} from './rules';
describe('Workbench rules',()=>{
 it('excludes N/A from ready percentage',()=>expect(readiness([{status:'ok'},{status:'pending'},{status:'na'}])).toBe(50));
 it('cycles manual statuses',()=>expect(['ok','pending','missing','na'].map(s=>nextStatus(s as 'ok'))).toEqual(['pending','missing','na','ok']));
 it('keeps operations separate from sales and excludes archives',()=>{expect(belongsToSide({nethunt_stage:'OPERATIONS - Deposit/Payment Received'},'ops')).toBe(true);expect(belongsToSide({nethunt_stage:'OPERATIONS - Archive'},'ops')).toBe(false);expect(belongsToSide({nethunt_stage:'SALES - New Lead'},'ops')).toBe(false)});
 it('matches official YT before sender and rejects ambiguous sender',()=>{const leads=[{id:'1',yt_id:'YT5180',email:'a@b.pt'},{id:'2',yt_id:'YT5181',email:'a@b.pt'}];expect(matchThread('RE: YT5180', 'a@b.pt',leads)?.id).toBe('1');expect(matchThread('', 'a@b.pt',leads)).toBeNull()});
});
