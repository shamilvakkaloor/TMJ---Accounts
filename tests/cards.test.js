import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.js';
import {cardPages,houseMembers} from '../domain/cards.js';
import {cardPdf} from '../lib/card-pdf.js';
describe('ID cards and house members',()=>{
 it('uses configured names, custom IDs, house links and private care of for admin cards',()=>{
  const s=fixture();s.members[0].id='TMJ123';s.members[0].careOf='Care Person';
  const [card]=cardPages(s,'member','TMJ123');
  assert.equal(card.mahal,s.settings[0].name);assert.equal(card.careOf,'Care Person');
  assert.equal(card.houseId,s.houses[0].id);assert.equal(card.subMahal,s.subMahals[0].name);
  assert.equal(card.pages,1);assert.throws(()=>cardPages(s,'member','missing'),/unavailable/);
 });
 it('includes all current house members including inactive/pending, across continuation cards',()=>{
  const s=fixture();const member=s.members[0];
  s.members=Array.from({length:15},(_,i)=>({...member,id:'MEM'+i,name:'Name '+String(i).padStart(2,'0'),active:i!==1,approved:false}));
  s.members.push({...member,id:'OTHER',houseId:'H-OTHER'});
  assert.equal(houseMembers(s,member.houseId).length,15);
  const cards=cardPages(s,'house',member.houseId);
  assert.deepEqual(cards.map(c=>c.members.length),[6,6,3]);
  assert.equal(new Set(cards.flatMap(c=>c.members.map(m=>m.id))).size,15);
  assert.ok(cards.every(c=>c.memberCount===15&&c.pages===3));
  s.members=[];assert.equal(cardPages(s,'house',member.houseId).length,1);
 });
 it('writes byte-accurate PDF objects and multiple card pages',async()=>{
  const bytes=new Uint8Array([255,216,0,255,217]);
  const pdf=cardPdf([{bytes,width:1600,height:1010},{bytes,width:1600,height:1010}]);
  const data=new Uint8Array(await pdf.arrayBuffer());
  const text=new TextDecoder('latin1').decode(data);
  assert.match(text,/\/Count 2/);assert.match(text,/\/MediaBox \[0 0 242/);
  const start=Number(text.match(/startxref\n(\d+)/)[1]);
  assert.equal(new TextDecoder().decode(data.slice(start,start+4)),'xref');
  const lines=text.slice(start).split('\n');
  for(let id=1;id<9;id++){
   const offset=Number(lines[id+2].slice(0,10));
   assert.equal(new TextDecoder().decode(data.slice(offset,offset+7)),`${id} 0 obj`);
  }
 });
});
