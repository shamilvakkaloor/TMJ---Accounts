import {it} from 'node:test';import assert from 'node:assert/strict';
import {fixture,apply} from './fixture.js';import{rowCommand}from'../domain/csv.js';import{reportData}from'../domain/reports.js';
it('allows clearing due day, preserves existing deadlines and generates undated dues',()=>{
 let s=fixture();s=apply(s,{type:'saveFund',value:{...s.funds[0],dueDay:null}});
 assert.equal(s.funds[0].dueDay,null);assert.equal(s.dues[0].dueDate,'2026-01-28');
 s=apply(s,{type:'assess',payerId:'M-000001',fundId:'annual',period:'2027'});
 assert.equal(s.dues.at(-1).dueDate,'');
 assert.equal(reportData(s,{from:'2027-01-01',to:'2027-12-31'}).dues.length,1);
 assert.equal(reportData(s,{from:'2028-01-01',to:'2028-12-31'}).dues.length,0);
 for(const dueDay of [0,29,1.5,NaN])assert.throws(()=>apply(s,{type:'saveFund',value:{...s.funds[0],dueDay}}),/Due day/);
});
it('accepts missing or blank due days in fund CSV without defaulting to 28',()=>{
 const s=fixture();for(const dueDay of [undefined,'','   ','12']){
 const cmd=rowCommand('funds',{id:'new',title:'New fund',target:'member',frequency:'annual',mode:'voluntary',start:'2026-01-01',dueDay},s);
 const next=apply(s,cmd);assert.equal(next.funds.at(-1).dueDay,dueDay==='12'?12:null);
 }
});
