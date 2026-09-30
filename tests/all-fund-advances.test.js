import{it}from'node:test';import assert from'node:assert/strict';import{fixture,apply,payment}from'./fixture.js';import{nextAdvancePeriod}from'../domain/engine.js';import{balance,outstanding}from'../domain/utils.js';import{validateBackup}from'../domain/backup.js';
for(const target of ['member','house'])for(const frequency of ['annual','monthly','one_time'])it(`supports ${target} ${frequency} advance, application and refund`,()=>{
 let s=fixture();const payerId=target==='house'?'H-000001':'M-000001';const period=frequency==='annual'?'2027':frequency==='monthly'?'2026-10':'campaign';
 s=apply(s,{type:'saveFund',value:{...s.funds[0],id:'newfund',target,frequency,advance:false,campaign:'campaign',eligibleIds:[payerId]}});
 const cmd={...payment(60000),payerId,lines:[{fundId:'newfund',amount:60000,advancePeriod:period}]};
 s=apply(s,cmd,'prepaid');assert.equal(s.credits.at(-1).period,period);assert.equal(balance(s,'cash'),60000);
 s=apply(s,{type:'assess',payerId,fundId:'newfund',period});
 s=apply(s,{type:'applyCredit',creditId:s.credits.at(-1).id,dueId:s.dues.at(-1).id,amount:40000});
 assert.equal(s.credits.at(-1).amount,20000);assert.equal(outstanding(s.dues.at(-1)),60000);assert.equal(balance(s,'cash'),60000);
 s=apply(s,{type:'refund',receiptId:'prepaid',amount:30000,walletId:'cash',date:'2026-09-25',reason:'Refund request'});
 assert.equal(s.credits.at(-1).amount,0);assert.equal(outstanding(s.dues.at(-1)),70000);assert.equal(balance(s,'cash'),30000);
 validateBackup({format:'mahal-backup-v1',data:s});
});
it('reserves explicit advances without paying old dues and checks period input',()=>{
 let s=fixture();s=apply(s,{...payment(),lines:[{fundId:'annual',amount:100000,advancePeriod:'2028'}]});
 assert.equal(s.dues[0].paid,0);assert.equal(s.credits[0].period,'2028');
 for(const advancePeriod of ['2025','bad'])assert.throws(()=>apply(s,{...payment(),lines:[{fundId:'annual',amount:1000,advancePeriod}]}));
 assert.throws(()=>apply(s,{...payment(),lines:[{fundId:'annual',amount:1000,advancePeriod:'2028',dueId:s.dues[0].id}]}),/either/);
});
it('records upfront voluntary contributions for their chosen period without fictitious dues',()=>{
 let s=fixture();s=apply(s,{type:'saveFund',value:{...s.funds[0],id:'donation',mode:'voluntary',frequency:'monthly',advance:true,rates:[]}});
 s=apply(s,{...payment(),lines:[{fundId:'donation',amount:100000,advancePeriod:'2026-12'}]});
 assert.equal(s.receipts.at(-1).lines[0].period,'2026-12');assert.equal(s.credits.length,0);assert.equal(s.dues.length,1);assert.equal(balance(s,'cash'),100000);
});
it('computes frequency-aware automatic advance periods including December rollover',()=>{
 assert.equal(nextAdvancePeriod({frequency:'monthly'},'2026-12-15'),'2027-01');
 assert.equal(nextAdvancePeriod({frequency:'annual'},'2026-12-15'),'2027');
 assert.equal(nextAdvancePeriod({frequency:'one_time',campaign:'one'},'2026-12-15'),'one');
});
it('keeps one-time campaign credit out of a different campaign',()=>{
 let s=fixture();s=apply(s,{type:'saveFund',value:{...s.funds[0],id:'campaign-fund',frequency:'one_time',campaign:'A',eligibleIds:['M-000001']}});
 s=apply(s,{...payment(),lines:[{fundId:'campaign-fund',amount:1000,advancePeriod:'A'}]});
 s=apply(s,{type:'saveFund',value:{...s.funds.at(-1),campaign:'B'}});
 s=apply(s,{type:'assess',fundId:'campaign-fund',payerId:'M-000001',period:'B'});
 assert.throws(()=>apply(s,{type:'applyCredit',creditId:s.credits[0].id,dueId:s.dues.at(-1).id,amount:1000}),/different campaign/);
});
