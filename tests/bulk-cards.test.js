import {it} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.js';
import {filterCardRecords,bulkCardParts} from '../domain/bulk-cards.js';
it('combines bulk card filters without mutating records',()=>{
 const s=fixture(),m=s.members[0];s.houses.push({...s.houses[0],id:'H-OTHER',subMahalId:'SM-02'});
 s.members=[{...m,id:'YES',approved:false,careOf:'Contact Person'},{...m,id:'OTHER',houseId:'H-OTHER'},{...m,id:'INACTIVE',active:false},{...m,id:'UNKNOWN',joined:''}];
 const base={type:'member',subMahalId:'SM-01',houseId:m.houseId,status:'active',approval:'pending',search:'contact',from:'2020-01-01',to:'2030-01-01'};
 assert.deepEqual(filterCardRecords(s,base).map(r=>r.id),['YES']);
 assert.deepEqual(filterCardRecords(s,{type:'house',occupancy:'empty'}),[]);
 s.members=s.members.filter(m=>m.houseId!=='H-OTHER');assert.equal(filterCardRecords(s,{type:'house',occupancy:'empty'})[0].id,'H-OTHER');
 assert.equal(filterCardRecords(s,{type:'member',status:'inactive'})[0].id,'INACTIVE');
});
it('splits bulk PDFs at page boundaries and preserves all household continuation pages',()=>{
 const s=fixture();s.members=Array.from({length:205},(_,i)=>({...s.members[0],id:'CUSTOM'+i}));
 const ids=s.members.map(m=>m.id);const parts=bulkCardParts(s,'member',[...ids,ids[0]]);
 assert.deepEqual(parts.map(p=>p.length),[100,100,5]);
 assert.equal(new Set(parts.flat().map(p=>p.id)).size,205);
 const houses=bulkCardParts(s,'house',[s.houses[0].id],10);
 assert.deepEqual(houses.map(p=>p.length),[10,10,10,5]);
 assert.equal(houses.flat().flatMap(p=>p.members).length,205);
});
