import{it}from'node:test';import assert from'node:assert/strict';import{fixture,apply,payment}from'./fixture.js';import{rateFor}from'../domain/engine.js';
it('uses dated historical rates for annual and monthly dues',()=>{
 for(const frequency of ['annual','monthly']){
 let s=fixture();s.members[0].joined='2010-01-01';
 const rates=[{from:'2020-01-01',amount:100000},{from:'2016-01-01',amount:50000}];
 s=apply(s,{type:'saveFund',value:{...s.funds[0],id:'history',start:'2016-01-01',frequency,rates}});
 for(const year of ['2016','2019','2020'])s=apply(s,{type:'assess',fundId:'history',payerId:'M-000001',period:frequency==='annual'?year:year+'-01'});
 assert.deepEqual(s.dues.slice(-3).map(d=>d.assessed),[50000,50000,100000]);
 assert.deepEqual(s.funds.at(-1).rates.map(r=>r.from),['2016-01-01','2020-01-01']);
 }
});
it('adds past rates after payments without rewriting recorded dues or receipts',()=>{
 let s=apply(fixture(),payment(25000));const dues=structuredClone(s.dues),receipts=structuredClone(s.receipts);
 s=apply(s,{type:'saveFund',value:{...s.funds[0],start:'2016-01-01',rates:[...s.funds[0].rates,{from:'2016-01-01',amount:50000},{from:'2020-01-01',amount:75000}]}});
 assert.deepEqual(s.dues,dues);assert.deepEqual(s.receipts,receipts);
 assert.equal(rateFor(s.funds[0],'2019-12-31').amount,50000);assert.equal(rateFor(s.funds[0],'2020-01-01').amount,75000);
 assert.throws(()=>apply(s,{type:'saveFund',value:{...s.funds[0],rates:[...s.funds[0].rates,{from:'2020-01-01',amount:1000}]}}),/unique/);
 assert.throws(()=>apply(s,{type:'saveFund',value:{...s.funds[0],rates:s.funds[0].rates.map(r=>({...r,amount:1}))}}),/Saved rates/);
});
